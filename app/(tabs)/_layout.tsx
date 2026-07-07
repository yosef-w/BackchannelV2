// (tabs)/_layout — the authenticated app shell. Replaces MainApp.tsx's
// hand-rolled activeView state machine with real expo-router tabs.
//
// ── Behavior contract carried over from MainApp (Phase 0 checklist) ────────
//  1. Five tabs: home / matches / jobs (sponsor-only) / messages / profile.
//     Screens unmount on tab switch (route files guard on useIsFocused),
//     matching the old conditional-render semantics — views refetch on every
//     visit and deck position survives via useJobsStore, exactly as before.
//  2. Shared top bar: wordmark + contextual check-in icon (stale-count
//     badge) + notifications bell (unread badge, 60s poll).
//  3. Floating pill tab bar: hidden while a message thread is open;
//     translates off-screen with HomeView scroll via shared values.
//  4. Notifications + public-profile are full-screen overlays above the
//     current tab (not routes yet) — closing one reveals the tab untouched,
//     which retires MainApp's previousView bookkeeping. The messages tab
//     stays mounted (still focused) under the public-profile overlay,
//     preserving the reanimated ghost-overlay fix.
//  5. Push notification taps (live + cold-start, deduped) route to the
//     right tab / conversation / check-in sheet via the router.
//  6. Foreground pushes refresh the bell badge and invalidate the Matches
//     query cache for relationship-changing types.
//  7. Screen-view analytics fire on every effective screen change,
//     including overlays and the return to the underlying tab.
//  8. Auth gate: unauthenticated → black bridge screen + debounced redirect
//     to /splash (the 800ms grace lets in-flight cleanup callbacks run).
//  9. Push permission is only ever cold-asked after a contextual trigger
//     (first match / first message) — never on plain mount.

import {
  trackCheckInModalOpened,
  trackPushNotificationTapped,
  trackScreenViewed,
} from "@/lib/analytics/mixpanel";
import { getUnreadNotificationCount } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import type { PublicProfileUserData } from "@/types/profiles";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  Tabs,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { ApplicantPublicProfileView } from "@/components/ApplicantPublicProfileView";
import {
  ApplicantCheckInModal,
  type CheckInReferral,
} from "@/components/checkin/ApplicantCheckInModal";
import {
  SponsorCheckInModal,
  type SponsorCheckInReferral,
} from "@/components/checkin/SponsorCheckInModal";
import { NotificationsView } from "@/components/NotificationsView";
import { FloatingTabBar } from "@/components/shell/FloatingTabBar";
import {
  ShellContext,
  type ShellContextValue,
  type UserType,
} from "@/components/shell/ShellContext";
import { TopBar } from "@/components/shell/TopBar";
import { useCheckInReferrals } from "@/components/shell/useCheckInReferrals";
import { usePushSetup } from "@/components/shell/usePushSetup";
import { SponsorPublicProfileView } from "@/components/SponsorPublicProfileView";

// ── Foreground push display ──────────────────────────────────────────────
// When a push arrives while the app is open, iOS hands the notification to
// this handler — and the default with no handler is to show NOTHING.
// Registered at module scope so it's set once before any UI mounts.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const TAB_NAMES = ["home", "matches", "jobs", "messages", "profile"] as const;
type TabName = (typeof TAB_NAMES)[number];

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ mode?: string }>();
  const queryClient = useQueryClient();

  // ── Auth gate + role (moved from the old dashboard screen) ──────────────
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const profileData = useUserProfileStore((state) => state.data);

  const userType: UserType = useMemo(() => {
    // 1. Role stored at login time — fastest, no async dependency.
    if (role) return role === "Sponsor" ? "sponsor" : "applicant";
    // 2. IS_SPONSOR flag on the loaded profile.
    if (profileData && "IS_SPONSOR" in profileData) {
      return (profileData as { IS_SPONSOR?: boolean }).IS_SPONSOR
        ? "sponsor"
        : "applicant";
    }
    // 3. Last resort: URL param set by the onboarding flow.
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [role, params.mode, profileData]);

  // Redirect to splash when the session ends. The 800ms debounce gives any
  // open WebView (or other component) time to run its onSessionExpired
  // cleanup before navigation fires.
  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        console.log("[Shell] Not authenticated, redirecting to splash...");
        router.replace("/splash");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  // ── Scroll-aware chrome shared values (HomeView writes, chrome reads) ───
  const navTranslateY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);
  const currentTab = (pathname.replace(/^\//, "") || "home") as TabName;
  // Snap the tab bar AND HomeView's header back the moment the user leaves
  // Home — HomeView's scroll handler is the only writer and it unmounts.
  useEffect(() => {
    if (currentTab !== "home") {
      navTranslateY.value = withTiming(0, { duration: 200 });
      headerTranslateY.value = withTiming(0, { duration: 200 });
    }
  }, [currentTab, navTranslateY, headerTranslateY]);

  // ── Cross-tab messaging handoffs ─────────────────────────────────────────
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [pendingMessageJobId, setPendingMessageJobId] = useState<string | null>(
    null,
  );
  const [pendingMessageUserId, setPendingMessageUserId] = useState<
    string | null
  >(null);
  const [pendingMessageConversationId, setPendingMessageConversationId] =
    useState<string | null>(null);
  const [isThreadActive, setIsThreadActive] = useState(false);

  const navigateToMessages = useCallback(
    (jobId: string, userId?: string) => {
      setPendingMessageJobId(jobId || null);
      setPendingMessageUserId(userId || null);
      router.navigate("/(tabs)/messages");
    },
    [router],
  );

  // ── Overlays (notifications / public profile) ────────────────────────────
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [publicProfileData, setPublicProfileData] =
    useState<PublicProfileUserData | null>(null);

  // ── Unread notification count for the bell badge ─────────────────────────
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { unread_count } = await getUnreadNotificationCount();
      setUnreadNotificationCount(unread_count);
    } catch {
      // non-fatal — badge just won't update
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    // Poll every 60s so the badge stays reasonably fresh.
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  // ── Referral check-in system ─────────────────────────────────────────────
  const [showApplicantCheckIn, setShowApplicantCheckIn] = useState(false);
  const [showSponsorCheckIn, setShowSponsorCheckIn] = useState(false);
  const {
    referrals,
    referralsLoading,
    fetchReferralsForCheckIn,
    activeReferralCount,
    staleReferralCount,
  } = useCheckInReferrals(userType, showApplicantCheckIn || showSponsorCheckIn);

  const openCheckIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userType === "applicant") setShowApplicantCheckIn(true);
    else setShowSponsorCheckIn(true);
    trackCheckInModalOpened({
      role: userType,
      referralCount: referrals.length,
    });
    // Fire fetch in the background — the modal renders its own loading state.
    fetchReferralsForCheckIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, referrals.length]);

  // ── Push registration + deck reminders ───────────────────────────────────
  const { requestPushPermission } = usePushSetup(userType);

  // ── Push notification tap routing (live + cold start, deduped) ───────────
  const lastHandledPushIdRef = useRef<string | null>(null);
  const handlePushResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (id && lastHandledPushIdRef.current === id) return;
      lastHandledPushIdRef.current = id ?? null;

      const data = response.notification.request.content.data as
        | Record<string, string>
        | undefined;
      if (!data) return;

      const type = data.type as string | undefined;
      trackPushNotificationTapped({ pushType: type });
      if (type === "match" || type === "referral") {
        router.navigate("/(tabs)/matches");
      } else if (type === "message") {
        // Deep-link straight into the conversation the push named.
        const convId = data.related_conversation_id;
        if (convId) setPendingMessageConversationId(convId);
        router.navigate("/(tabs)/messages");
      } else if (type === "daily_deck_ready" || type === "unfinished_deck") {
        // Local reminders — straight to the deck itself.
        router.navigate("/(tabs)/home");
      } else if (type === "checkin_nudge") {
        // Local check-in cadence — open the sheet for the scheduled role.
        const pushRole = data.role as "applicant" | "sponsor" | undefined;
        fetchReferralsForCheckIn();
        if (pushRole === "sponsor") setShowSponsorCheckIn(true);
        else setShowApplicantCheckIn(true);
      } else {
        // Generic fallback — the notifications list.
        setNotificationsOpen(true);
      }
      fetchUnreadCount();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, fetchUnreadCount],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    // Taps while the app is foreground/background. Does NOT fire for a tap
    // that launched the app from killed — that's the cold-start path below.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        handlePushResponse,
      );
    return () => subscription.remove();
  }, [isAuthenticated, handlePushResponse]);

  // Cold start: when the app is killed and launched from a push tap, the OS
  // delivers the tap BEFORE the listener above mounts. This surfaces the
  // launching tap once auth is ready; the dedupe ref stops the live listener
  // from acting on the same tap twice.
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!isAuthenticated) return;
    handlePushResponse(lastNotificationResponse ?? null);
  }, [isAuthenticated, lastNotificationResponse, handlePushResponse]);

  // Foreground pushes: refresh the bell badge immediately and invalidate the
  // Matches screen's cached lists for relationship-changing types.
  // ("matchesScreen" is MatchesView's MATCHES_SCREEN_ROOT query key.)
  useEffect(() => {
    if (!isAuthenticated) return;
    const received = Notifications.addNotificationReceivedListener(
      (notification) => {
        fetchUnreadCount();
        const data = notification.request.content.data as
          | Record<string, string>
          | undefined;
        const type = data?.type;
        if (
          type === "match" ||
          type === "referral" ||
          type === "job_like" ||
          type === "waitlist" ||
          type === "profile_like"
        ) {
          queryClient.invalidateQueries({ queryKey: ["matchesScreen"] });
        }
      },
    );
    return () => received.remove();
  }, [isAuthenticated, queryClient, fetchUnreadCount]);

  // ── Screen-view analytics ────────────────────────────────────────────────
  // The effective screen is the overlay when one is up, else the tab. This
  // fires on every effective change — including the initial screen, overlay
  // opens, AND the return to the underlying tab when an overlay closes —
  // mirroring the old activeView semantics exactly.
  const effectiveScreen = notificationsOpen
    ? "notifications"
    : publicProfileData
      ? "publicProfile"
      : currentTab;
  useEffect(() => {
    trackScreenViewed(effectiveScreen);
  }, [effectiveScreen]);

  const shellValue: ShellContextValue = useMemo(
    () => ({
      userType,
      navTranslateY,
      headerTranslateY,
      setThreadActive: setIsThreadActive,
      navigateToMessages,
      requestPushPermission,
      openCheckIn,
      showPublicProfile: setPublicProfileData,
      selectedConversationId,
      setSelectedConversationId,
      pendingMessageJobId,
      pendingMessageUserId,
      consumePendingJob: () => {
        setPendingMessageJobId(null);
        setPendingMessageUserId(null);
      },
      pendingMessageConversationId,
      consumePendingConversation: () => setPendingMessageConversationId(null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      userType,
      navigateToMessages,
      requestPushPermission,
      openCheckIn,
      selectedConversationId,
      pendingMessageJobId,
      pendingMessageUserId,
      pendingMessageConversationId,
    ],
  );

  // Once the session is cleared, stop rendering the shell immediately —
  // during the 800ms redirect debounce, userType recomputes to its
  // "applicant" default and would flash the wrong UI. Black matches the
  // splash background so logout reads as a seamless fade.
  if (!isAuthenticated) {
    return <View style={styles.loggedOutBridge} />;
  }

  const overlayOpen = notificationsOpen || publicProfileData !== null;

  return (
    <ShellContext.Provider value={shellValue}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <TopBar
            activeReferralCount={activeReferralCount}
            staleReferralCount={staleReferralCount}
            unreadNotificationCount={unreadNotificationCount}
            onOpenCheckIn={openCheckIn}
            onOpenNotifications={() => setNotificationsOpen(true)}
          />

          <View style={styles.mainContent}>
            <Tabs
              initialRouteName="home"
              screenOptions={{
                headerShown: false,
                sceneStyle: styles.scene,
              }}
              tabBar={(props) =>
                // The pill disappears entirely (not just visually) while a
                // thread or an overlay is up — same as MainApp's
                // conditional render.
                isThreadActive || overlayOpen ? null : (
                  <FloatingTabBar {...props} />
                )
              }
            >
              <Tabs.Screen name="home" options={{ title: "Feed" }} />
              <Tabs.Screen name="matches" options={{ title: "Matches" }} />
              <Tabs.Screen name="jobs" options={{ title: "Jobs" }} />
              <Tabs.Screen name="messages" options={{ title: "Inbox" }} />
              <Tabs.Screen name="profile" options={{ title: "Account" }} />
            </Tabs>

            {/* Notifications overlay — above the tab content, below nothing.
                Closing reveals the current tab untouched (previousView
                bookkeeping is gone: the router state never changed). */}
            {notificationsOpen && (
              <View style={StyleSheet.absoluteFillObject}>
                <NotificationsView
                  userType={userType}
                  onBack={() => {
                    setNotificationsOpen(false);
                    // Refresh the real unread count now that the user has
                    // seen (and possibly acted on) the list.
                    fetchUnreadCount();
                  }}
                  onOpenConversation={(conversationId) => {
                    setSelectedConversationId(conversationId);
                    setNotificationsOpen(false);
                    router.navigate("/(tabs)/messages");
                  }}
                  onOpenTab={(tab) => {
                    setNotificationsOpen(false);
                    router.navigate(`/(tabs)/${tab}`);
                  }}
                />
              </View>
            )}

            {/* Public profile overlay — rendered above the (still-mounted,
                still-focused) messages tab so reanimated worklets in
                MessagesView keep a live host view. */}
            {publicProfileData &&
              (userType === "sponsor" ? (
                <View style={StyleSheet.absoluteFillObject}>
                  <ApplicantPublicProfileView
                    userData={publicProfileData}
                    onClose={() => setPublicProfileData(null)}
                  />
                </View>
              ) : (
                <View style={StyleSheet.absoluteFillObject}>
                  <SponsorPublicProfileView
                    userData={publicProfileData}
                    onClose={() => setPublicProfileData(null)}
                  />
                </View>
              ))}
          </View>
        </SafeAreaView>

        {/* ── Referral check-in modals ──────────────────────────────────── */}
        <ApplicantCheckInModal
          visible={showApplicantCheckIn}
          onDismiss={() => setShowApplicantCheckIn(false)}
          referrals={referrals as CheckInReferral[]}
          loading={referralsLoading}
          onSubmitted={() =>
            queryClient.invalidateQueries({ queryKey: ["matchesScreen"] })
          }
        />
        <SponsorCheckInModal
          visible={showSponsorCheckIn}
          onDismiss={() => setShowSponsorCheckIn(false)}
          referrals={referrals as SponsorCheckInReferral[]}
          loading={referralsLoading}
          onSubmitted={() =>
            queryClient.invalidateQueries({ queryKey: ["matchesScreen"] })
          }
        />
      </View>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  scene: {
    backgroundColor: "#FFFFFF",
  },
  loggedOutBridge: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
