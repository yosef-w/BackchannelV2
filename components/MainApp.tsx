import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams } from "expo-router";
import {
    Bell,
    Briefcase,
    ClipboardCheck,
    Home,
    MessageCircle,
    Star,
    User,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    trackCheckInModalOpened,
    trackPushNotificationTapped,
    trackScreenViewed,
} from "../lib/analytics/mixpanel";
import {
    getUnreadNotificationCount,
    listReferrals,
    registerDevice,
} from "../lib/api";
import { useAuthStore } from "../stores/useAuthStore";
import {
    ApplicantCheckInModal,
    type CheckInReferral,
} from "./ApplicantCheckInModal";
import { ApplicantPublicProfileView } from "./ApplicantPublicProfileView";
import { HomeView } from "./HomeView";
import { JobsView } from "./JobsView";
import { MatchesView } from "./MatchesView";
import { MessagesView } from "./MessagesView";
import { NotificationsView } from "./NotificationsView";
import { ProfileView } from "./ProfileView";
import {
    SponsorCheckInModal,
    type SponsorCheckInReferral,
} from "./SponsorCheckInModal";
import { SponsorPublicProfileView } from "./SponsorPublicProfileView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Foreground push display ──────────────────────────────────────────────
// When a push arrives while the app is open, iOS does NOT show it
// automatically — it hands the notification to this handler to decide what
// to do, and the default with no handler is to show NOTHING. That's why a
// user actively testing (app on screen) sees no banner even when delivery
// works. Registered at module scope so it's set once before any UI mounts.
// (Background / killed display is handled by the OS from the aps payload and
// does not depend on this handler.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface MainAppProps {
  userType: "applicant" | "sponsor";
}

type ViewType =
  | "home"
  | "matches"
  | "messages"
  | "jobs"
  | "profile"
  | "notifications"
  | "publicProfile";

const navItems = [
  { id: "home", icon: Home, label: "Feed" },
  { id: "matches", icon: Star, label: "Matches" },
  { id: "jobs", icon: Briefcase, label: "Jobs", sponsorOnly: true },
  { id: "messages", icon: MessageCircle, label: "Inbox" },
  { id: "profile", icon: User, label: "Account" },
];

function NavItem({
  item,
  isActive,
  onPress,
}: {
  item: any;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const Icon = item.icon;

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 1, {
      damping: 15,
      stiffness: 150,
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
      style={styles.navItem}
    >
      <Animated.View style={animatedIconStyle}>
        <Icon
          color={isActive ? "#FFF" : "#666"}
          size={24}
          strokeWidth={isActive ? 2.5 : 1.5}
        />
      </Animated.View>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

export function MainApp({ userType }: MainAppProps) {
  const params = useLocalSearchParams<{ tab?: string }>();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [previousView, setPreviousView] = useState<ViewType>("home");
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);

  // Hinge-style scroll-aware nav bar — HomeView drives this shared value
  // off the scroll direction of its main profile scroll. 0 = visible,
  // ~120 = fully off-screen below. Other screens never write to it, so
  // the bar stays anchored on Matches / Messages / Jobs / Profile.
  const navTranslateY = useSharedValue(0);
  const navAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
    opacity: 1 - Math.min(1, navTranslateY.value / 120),
  }));
  // Mirror of navTranslateY but for HomeView's TOP header (progress bar +
  // role switcher). 0 = visible, ~80 = fully translated upward off-screen.
  // The header is shorter than the nav bar so a smaller offset is enough.
  // HomeView writes to both shared values from the same scroll handler so
  // header and nav move in sync — header up, nav down.
  const headerTranslateY = useSharedValue(0);
  // Snap the nav bar AND the header back into view the moment the user
  // leaves Home — otherwise they'd still be hidden when they land on
  // Matches/Messages/Jobs/Profile (HomeView's scroll handler is the only
  // writer, and it's not mounted there).
  useEffect(() => {
    if (activeView !== "home") {
      navTranslateY.value = withTiming(0, { duration: 200 });
      headerTranslateY.value = withTiming(0, { duration: 200 });
    }
  }, [activeView, navTranslateY, headerTranslateY]);
  const [publicProfileData, setPublicProfileData] = useState<any>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [pendingMessageJobId, setPendingMessageJobId] = useState<string | null>(
    null,
  );
  // Parallel hint to pendingMessageJobId — the counterpart user id, used by
  // MessagesView to disambiguate when a sponsor has multiple matched
  // applicants on the same job (every one of those conversations shares the
  // same jobId, so jobId alone isn't enough to pick the right thread).
  const [pendingMessageUserId, setPendingMessageUserId] = useState<
    string | null
  >(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setDeviceToken = useAuthStore((state) => state.setDeviceToken);

  // ── Unread notification count for the bell badge ─────────────────────────
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // ── Referral check-in modals ─────────────────────────────────────────────
  // Set DEV_SHOW_CHECKIN_MODAL to true to auto-open on load for demos
  const DEV_SHOW_CHECKIN_MODAL = false;
  const [showApplicantCheckIn, setShowApplicantCheckIn] = useState(false);
  const [showSponsorCheckIn, setShowSponsorCheckIn] = useState(false);
  const [referrals, setReferrals] = useState<
    CheckInReferral[] | SponsorCheckInReferral[]
  >([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const referralsRequestIdRef = useRef(0);

  // Accept both legacy and newer backend key variants so check-in modals stay
  // resilient across backend response-shape drift.
  const pickField = (row: any, keys: string[]): any => {
    for (const k of keys) {
      const v = row?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  };

  const normalizeReferralRow = (r: any) => ({
    referralId: String(
      pickField(r, ["REFERRAL_ID", "referral_id", "referralId", "id"]) || "",
    ),
    jobTitle: pickField(r, [
      "JOB_TITLE",
      "job_title",
      "jobTitle",
      // Fallbacks used by adjacent matching/messaging payloads.
      "SPONSOR_JOB_TITLE",
      "sponsor_job_title",
      "ROLE_TITLE",
      "role_title",
    ]),
    jobCompany: pickField(r, [
      "JOB_COMPANY",
      "job_company",
      "jobCompany",
      "SPONSOR_COMPANY",
      "sponsor_company",
      "COMPANY",
      "company",
    ]),
    sponsorFirstName: pickField(r, [
      "SPONSOR_FIRST_NAME",
      "sponsor_first_name",
      "sponsorFirstName",
    ]),
    sponsorLastName: pickField(r, [
      "SPONSOR_LAST_NAME",
      "sponsor_last_name",
      "sponsorLastName",
    ]),
    applicantFirstName: pickField(r, [
      "APPLICANT_FIRST_NAME",
      "applicant_first_name",
      "applicantFirstName",
    ]),
    applicantLastName: pickField(r, [
      "APPLICANT_LAST_NAME",
      "applicant_last_name",
      "applicantLastName",
    ]),
    status: String(pickField(r, ["STATUS", "status"]) || "REFERRED"),
    createdAt: String(
      pickField(r, ["CREATED_AT", "created_at", "createdAt"]) || "",
    ),
  });

  /**
   * Fetch referrals from /api/referrals/ and shape them into the props each
   * check-in modal needs. We fetch fresh every time the user opens the
   * check-in panel so the modal is never stale.
   *
   * The backend returns the same row shape for both roles; downstream consumers
   * pick the fields relevant to them, so the same fetcher serves both modals.
   */
  const fetchReferralsForCheckIn = async () => {
    const requestId = ++referralsRequestIdRef.current;
    try {
      setReferralsLoading(true);
      if (__DEV__) {
        console.log("[MainApp] fetchReferralsForCheckIn:start", {
          requestId,
          userType,
        });
      }
      const response = await listReferrals({ limit: 50, offset: 0 });
      const rows = Array.isArray((response as any)?.referrals)
        ? (response as any).referrals
        : [];
      const normalizedRows = rows.map((r: any) => normalizeReferralRow(r));
      const transformed = normalizedRows.filter((r: any) => !!r.referralId);
      const droppedNoId = normalizedRows.filter(
        (r: any) => !r.referralId,
      ).length;

      if (__DEV__) {
        console.log("[MainApp] fetchReferralsForCheckIn:result", {
          requestId,
          rawCount: rows.length,
          transformedCount: transformed.length,
          droppedNoId,
          statuses: transformed.map((r: any) => r.status),
          sample: transformed.slice(0, 3).map((r: any) => ({
            referralId: r.referralId,
            jobTitle: r.jobTitle,
            jobCompany: r.jobCompany,
            sponsorFirstName: r.sponsorFirstName,
            status: r.status,
          })),
        });
      }

      // Ignore stale in-flight responses when the modal is opened multiple times.
      if (requestId !== referralsRequestIdRef.current) return;
      setReferrals(transformed);
    } catch (err) {
      if (requestId !== referralsRequestIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (__DEV__) {
        console.log("[MainApp] fetchReferralsForCheckIn:error", {
          requestId,
          message: msg,
        });
      }
      // 404 means no referrals yet — that's an empty state, not an error
      if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
        console.warn("[MainApp] Failed to fetch referrals:", err);
      }
      setReferrals([]);
    } finally {
      if (requestId !== referralsRequestIdRef.current) return;
      setReferralsLoading(false);
    }
  };

  const handleOpenCheckIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReferralsLoading(true);
    if (userType === "applicant") setShowApplicantCheckIn(true);
    else setShowSponsorCheckIn(true);
    trackCheckInModalOpened({
      role: userType,
      referralCount: referrals.length,
    });
    // Fire fetch in the background — modal renders its own loading state.
    fetchReferralsForCheckIn();
  };

  useEffect(() => {
    if (!DEV_SHOW_CHECKIN_MODAL) return;
    const t = setTimeout(() => {
      if (userType === "applicant") setShowApplicantCheckIn(true);
      else setShowSponsorCheckIn(true);
      fetchReferralsForCheckIn();
    }, 800);
    return () => clearTimeout(t);
  }, []);
  const notifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = async () => {
    try {
      const { unread_count } = await getUnreadNotificationCount();
      setUnreadNotificationCount(unread_count);
    } catch {
      // non-fatal — badge just won't update
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    // Poll every 60s so the badge stays reasonably fresh without hammering the server
    notifPollRef.current = setInterval(fetchUnreadCount, 60_000);
    return () => {
      if (notifPollRef.current) clearInterval(notifPollRef.current);
    };
  }, [isAuthenticated]);

  /**
   * Register the device for push notifications whenever the user is
   * authenticated.  Runs once per login session.
   *
   * - Requests OS permission (prompt shown only on first run).
   * - Gets the Expo push token (requires a valid EAS projectId).
   * - POSTs the token to /api/devices/register/ so the backend can target
   *   this device with Firebase Cloud Messaging.
   * - Stores the token in useAuthStore so ProfileView can unregister it
   *   on logout.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    const registerPushToken = async () => {
      try {
        // Android requires an explicit notification channel.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#000000",
          });
        }

        // Request permission — iOS shows a dialog on first call, Android 13+
        // uses the POST_NOTIFICATIONS permission.
        const { status: current } = await Notifications.getPermissionsAsync();
        let finalStatus = current;
        if (current !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("[MainApp] Push notification permission not granted");
          return;
        }

        // projectId is required by Expo SDK ≥50 for getExpoPushTokenAsync.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as
          | string
          | undefined;
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!active) return;

        const platform: "ios" | "android" | "expo" =
          Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
              ? "android"
              : "expo";

        await registerDevice(token, platform);
        setDeviceToken(token);
        console.log("[MainApp] Push token registered:", token);
      } catch (err) {
        // Non-fatal — the app works without push notifications.
        console.warn("[MainApp] Failed to register push token:", err);
      }
    };

    registerPushToken();
    return () => {
      active = false;
    };
  }, [isAuthenticated, setDeviceToken]);

  // ── Handle push notification taps (deep-link to the right screen) ────────
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fired when the user taps a notification while the app is in foreground
    // or when it's brought to the foreground from background/killed state.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined;
        if (!data) return;

        const type = data.type as string | undefined;
        trackPushNotificationTapped({ pushType: type });
        if (type === "match" || type === "referral") {
          setActiveView("matches");
        } else if (type === "message") {
          setActiveView("messages");
        } else {
          // Generic fallback — open notifications list so the user can act on it
          setActiveView("notifications");
        }
        // Refresh unread count now that we're acting on a push
        fetchUnreadCount();
      },
    );

    return () => subscription.remove();
  }, [isAuthenticated]);

  // ── Refresh the bell badge the instant a push arrives in the foreground ──
  // The handler above shows the banner; this bumps the unread count right
  // away instead of waiting up to 60s for the next poll. It also invalidates
  // the Matches screen's cached lists for relationship-changing pushes so a
  // new like/match/referral appears without the user pulling to refresh.
  // ("matchesScreen" is MatchesView's MATCHES_SCREEN_ROOT query key — keep in
  // sync if that constant is ever renamed.) Note: a sponsor liking an
  // applicant's profile without a match currently sends NO push, so the
  // applicant's "Interested in You" list still relies on focus/pull-to-refresh.
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
          type === "waitlist"
        ) {
          queryClient.invalidateQueries({ queryKey: ["matchesScreen"] });
        }
      },
    );
    return () => received.remove();
  }, [isAuthenticated, queryClient]);

  const handleNavigateToMessages = (jobId: string, userId?: string) => {
    setPendingMessageJobId(jobId || null);
    setPendingMessageUserId(userId || null);
    setActiveView("messages");
  };

  // Handle initial tab from URL parameter
  useEffect(() => {
    if (params.tab) {
      const validTabs: ViewType[] = [
        "home",
        "matches",
        "jobs",
        "messages",
        "profile",
      ];
      if (validTabs.includes(params.tab as ViewType)) {
        setActiveView(params.tab as ViewType);
      }
    }
  }, [params.tab]);

  const handleShowPublicProfile = (userData: any) => {
    setPublicProfileData(userData);
    setActiveView("publicProfile");
  };

  const handleViewChange = (newView: ViewType) => {
    // Only save the "return-to" tab when entering an overlay (notifications /
    // publicProfile). For regular tab switches, previousView is irrelevant.
    // Guard against recording an overlay as the previousView (would loop back).
    if (
      (newView === "notifications" || newView === "publicProfile") &&
      activeView !== "notifications" &&
      activeView !== "publicProfile"
    ) {
      setPreviousView(activeView);
    }
    setActiveView(newView);
    // Fire screen-view event on every tab switch. The screen names mirror
    // ViewType ("home", "matches", etc.) so they map 1:1 to user-facing tabs.
    trackScreenViewed(newView);
  };

  const visibleNavItems = navItems.filter((item) => {
    return !item.sponsorOnly || userType === "sponsor";
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>Backchannel</Text>
          <View style={styles.topBarButtons}>
            <TouchableOpacity
              onPress={handleOpenCheckIn}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <ClipboardCheck color="#000" size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleViewChange("notifications");
                // Optimistically clear badge when the user opens the screen;
                // the NotificationsView will mark-all-read on its own.
                setUnreadNotificationCount(0);
              }}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <Bell color="#000" size={22} strokeWidth={1.5} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Main content wrapper */}
        <View style={styles.mainContent}>
          {activeView === "home" && (
            <HomeView
              userType={userType}
              onNavigateToProfile={() => setActiveView("profile")}
              navTranslateY={navTranslateY}
              headerTranslateY={headerTranslateY}
            />
          )}
          {activeView === "matches" && (
            <MatchesView
              userType={userType}
              onNavigateToMessages={handleNavigateToMessages}
            />
          )}
          {/* Keep MessagesView mounted when messages OR publicProfile is active.
              It always has flex:1 — the public-profile view is layered on top
              as an absoluteFillObject overlay. This means display:none is
              NEVER applied to this subtree, so Reanimated worklets (e.g. the
              profile-modal SlideInDown/SlideOutDown) always have a live host
              view and can complete normally, preventing the ghost-overlay
              freeze that occurred with the previous display:none approach. */}
          {(activeView === "messages" || activeView === "publicProfile") && (
            <View style={{ flex: 1 }}>
              <MessagesView
                onThreadActiveChange={setIsBottomNavHidden}
                userType={userType}
                onShowPublicProfile={handleShowPublicProfile}
                selectedConversationId={selectedConversationId}
                onConversationChange={setSelectedConversationId}
                pendingJobId={pendingMessageJobId}
                pendingUserId={pendingMessageUserId}
                onPendingJobConsumed={() => {
                  setPendingMessageJobId(null);
                  setPendingMessageUserId(null);
                }}
              />
            </View>
          )}
          {activeView === "jobs" && userType === "sponsor" && <JobsView />}
          {activeView === "profile" && <ProfileView userType={userType} />}
          {activeView === "notifications" && (
            <NotificationsView
              userType={userType}
              onBack={() => setActiveView(previousView)}
              onOpenConversation={(conversationId) => {
                setSelectedConversationId(conversationId);
                setPreviousView("messages");
                setActiveView("messages");
              }}
              onOpenTab={(tab) => {
                setPreviousView(tab);
                setActiveView(tab);
              }}
            />
          )}
          {/* Public profile rendered as a full-screen absolute overlay on top
              of MessagesView. Removing it unmounts cleanly without ever having
              hidden MessagesView underneath. */}
          {activeView === "publicProfile" &&
            publicProfileData &&
            (userType === "sponsor" ? (
              <View style={StyleSheet.absoluteFillObject}>
                <ApplicantPublicProfileView
                  userData={publicProfileData}
                  onClose={() => setActiveView("messages")}
                />
              </View>
            ) : (
              <View style={StyleSheet.absoluteFillObject}>
                <SponsorPublicProfileView
                  userData={publicProfileData}
                  onClose={() => setActiveView("messages")}
                />
              </View>
            ))}
        </View>

        {/* Bottom Navigation — Floating Pill. Slides down off-screen while
            the user scrolls down on HomeView (Hinge-style), driven by
            `navTranslateY` which only HomeView writes to. On every other
            screen the shared value stays at 0 so the bar is anchored. */}
        {activeView !== "notifications" &&
          activeView !== "publicProfile" &&
          !isBottomNavHidden && (
            <Animated.View
              entering={FadeInDown.duration(600)}
              style={[styles.navContainer, navAnimatedStyle]}
              pointerEvents="box-none"
            >
              <View style={styles.navBar}>
                {visibleNavItems.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    isActive={activeView === item.id}
                    onPress={() => handleViewChange(item.id as ViewType)}
                  />
                ))}
              </View>
            </Animated.View>
          )}
      </SafeAreaView>

      {/* ── Referral Check-in Modals ─────────────────────────────────────── */}
      <ApplicantCheckInModal
        visible={showApplicantCheckIn}
        onDismiss={() => setShowApplicantCheckIn(false)}
        referrals={referrals as CheckInReferral[]}
        loading={referralsLoading}
      />
      <SponsorCheckInModal
        visible={showSponsorCheckIn}
        onDismiss={() => setShowSponsorCheckIn(false)}
        referrals={referrals as SponsorCheckInReferral[]}
        loading={referralsLoading}
      />
    </View>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
  },
  topBarButtons: {
    flexDirection: "row",
    gap: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  notificationDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#FFF",
  },
  mainContent: {
    flex: 1,
  },
  navContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  navBar: {
    flexDirection: "row",
    backgroundColor: "#000",
    width: SCREEN_WIDTH * 0.85,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
  },
  activeIndicator: {
    position: "absolute",
    bottom: 8,
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFF",
  },
});
