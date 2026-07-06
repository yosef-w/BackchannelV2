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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    AppState,
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
import {
    cancelUnfinishedDeckReminder,
    scheduleDailyDeckReminder,
    scheduleUnfinishedDeckReminder,
} from "../lib/localNotifications";
import { cancelCheckInNudges, scheduleCheckInNudges } from "../lib/checkInNudges";
import {
  getLocalCheckInStages,
  getLocalCheckInTimes,
} from "../utils/checkInStageCache";
import { useAuthStore } from "../stores/useAuthStore";
import { useJobsStore } from "../stores/useJobsStore";
import {
    ApplicantCheckInModal,
    type CheckInReferral,
} from "./ApplicantCheckInModal";
import { ApplicantPublicProfileView } from "./ApplicantPublicProfileView";
import { DECK_SIZE, HomeView } from "./HomeView";
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
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={animatedIconStyle}>
        <Icon
          color={isActive ? "#FFF" : "#666"}
          size={22}
          strokeWidth={isActive ? 2.5 : 1.5}
        />
      </Animated.View>
      {/* Labels were defined in navItems but never rendered — five
          unlabeled icons (plus a clipboard-check header icon whose meaning
          is unguessable) was a real discoverability gap. */}
      <Text
        style={[styles.navLabel, isActive && styles.navLabelActive]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
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
  // Deep-link target when a message push is tapped — the specific conversation
  // to open. MessagesView consumes it once the thread is loaded.
  const [pendingMessageConversationId, setPendingMessageConversationId] =
    useState<string | null>(null);

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

  // Eager referral fetch at mount so the header's check-in icon can be
  // contextual (hidden with no active referrals, badged with the stale
  // count). Opening the sheet still refetches fresh, so this only needs to
  // be roughly right, not live.
  useEffect(() => {
    fetchReferralsForCheckIn();
    // Refetch when the role flips — the referral list is role-scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType]);

  // Last locally-submitted check-in per referral — a referral the user just
  // checked in on shouldn't keep the header badge lit for 7 more days.
  // Reloaded whenever a check-in sheet closes (which covers submits).
  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    getLocalCheckInTimes().then(setCheckInTimes);
  }, [showApplicantCheckIn, showSponsorCheckIn]);

  // Recompute + reschedule this role's single check-in nudge notification
  // any time the referral list or local check-in times change (new referral
  // fetched, or a check-in just submitted). scheduleCheckInNudges cancels
  // any previously-pending nudge before scheduling the next one, so this is
  // safe to call repeatedly. If there's nothing left to nudge about (no
  // active referrals), fall through to a plain cancel.
  useEffect(() => {
    if (!referrals.length) {
      cancelCheckInNudges(userType);
      return;
    }
    getLocalCheckInStages().then((stages) => {
      scheduleCheckInNudges(
        userType,
        referrals as unknown as {
          referralId: string;
          status: string;
          createdAt: string;
          jobCompany?: string | null;
        }[],
        checkInTimes,
        stages,
      );
    });
  }, [referrals, checkInTimes, userType]);

  // Active = still-live referrals the check-in sheet can act on; stale =
  // created 7+ days ago (same threshold as MatchesView's nudge banner) AND
  // no check-in submitted from this device within the last 7 days.
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const activeReferralCount = referrals.filter(
    (r) => (r.status || "").toUpperCase() === "REFERRED",
  ).length;
  const staleReferralCount = referrals.filter((r) => {
    if ((r.status || "").toUpperCase() !== "REFERRED") return false;
    const created = Date.parse(r.createdAt || "");
    if (isNaN(created) || created > Date.now() - STALE_MS) return false;
    const lastCheckIn = Date.parse(checkInTimes[r.referralId] || "");
    return isNaN(lastCheckIn) || lastCheckIn <= Date.now() - STALE_MS;
  }).length;

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

  // Bumped by requestPushPermission() to trigger a fresh attempt at the
  // native permission dialog. Starts at 0 so the effect below runs once on
  // mount too — but that initial run only ever *checks* status and silently
  // registers a device that's already granted; it never cold-asks (see the
  // "undetermined" branch below). The actual OS prompt only fires once this
  // has been bumped by a contextual moment (first match, first message
  // sent) — see the onMatchCreated / onFirstMessageSent wiring below.
  const [pushPromptTrigger, setPushPromptTrigger] = useState(0);
  const requestPushPermission = useCallback(() => {
    setPushPromptTrigger((n) => n + 1);
  }, []);

  /**
   * Register the device for push notifications whenever the user is
   * authenticated, re-running whenever requestPushPermission() is called.
   *
   * - Silently registers an already-granted permission on every run (cheap,
   *   idempotent on the backend).
   * - Only shows the native OS permission dialog when explicitly triggered
   *   via pushPromptTrigger — previously this asked immediately on first
   *   mount, before the user had any reason to say yes, which is the
   *   single most common way an app burns its one shot at push permission
   *   on iOS (a decline is effectively permanent).
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

        const { status: current } = await Notifications.getPermissionsAsync();
        let finalStatus = current;
        if (current === "undetermined") {
          // Never asked before — only show the native dialog once a
          // contextual trigger has fired. On the initial mount (trigger
          // still at 0) just wait; a later match/message will bump it and
          // re-run this effect.
          if (pushPromptTrigger === 0) {
            console.log(
              "[MainApp] Deferring push permission prompt until a contextual trigger fires",
            );
            return;
          }
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        } else if (current !== "granted") {
          // Previously denied — the OS won't re-prompt anyway, so don't
          // bother asking again; just leave push notifications off.
          console.log("[MainApp] Push notification permission previously denied");
          return;
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

        // Permission is confirmed granted at this point (registration only
        // gets here past the earlier granted-check) — schedule the daily
        // "your deck is ready" local reminder. Idempotent: re-running this
        // on every app open just re-confirms the same schedule.
        scheduleDailyDeckReminder(userType);
      } catch (err) {
        // Non-fatal — the app works without push notifications.
        console.warn("[MainApp] Failed to register push token:", err);
      }
    };

    registerPushToken();
    return () => {
      active = false;
    };
  }, [isAuthenticated, setDeviceToken, pushPromptTrigger, userType]);

  // ── Unfinished-deck local reminder ────────────────────────────────────────
  // When the app backgrounds with cards still left in today's deck,
  // schedule a one-time local nudge for later. Cancel it the moment the app
  // comes back to the foreground — if cards are still left next time it
  // backgrounds, a fresh reminder gets scheduled with the current count;
  // if the deck got finished in the meantime, nothing gets rescheduled.
  useEffect(() => {
    if (!isAuthenticated) return;

    const onAppStateChange = (state: string) => {
      if (state === "background" || state === "inactive") {
        const jobsState = useJobsStore.getState();
        const hasDeck =
          userType === "sponsor"
            ? jobsState.sponsoredJobs.length > 0
            : jobsState.jobs.length > 0;
        if (!hasDeck) return;
        const remaining = DECK_SIZE - jobsState.progress + 1;
        if (remaining > 0) {
          scheduleUnfinishedDeckReminder(remaining, userType);
        }
      } else if (state === "active") {
        cancelUnfinishedDeckReminder();
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, [isAuthenticated, userType]);

  // ── Handle push notification taps (deep-link to the right screen) ────────
  // Shared routing for a tapped push, used by BOTH the live listener (below)
  // and the cold-start path. The launching tap can surface through both
  // channels, so we dedupe on the notification identifier and act on it once.
  const lastHandledPushIdRef = useRef<string | null>(null);
  const handlePushResponse = (
    response: Notifications.NotificationResponse | null,
  ) => {
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
      setActiveView("matches");
    } else if (type === "message") {
      // Deep-link straight into the conversation the push named, not just the
      // inbox. related_conversation_id is set on every message notification.
      const convId = data.related_conversation_id;
      if (convId) setPendingMessageConversationId(convId);
      setActiveView("messages");
    } else if (type === "daily_deck_ready" || type === "unfinished_deck") {
      // Local reminders (see lib/localNotifications.ts) — straight to the
      // deck itself, not the in-app notifications list (they're on-device
      // schedules, not backend notification records that would show up there).
      setActiveView("home");
    } else if (type === "checkin_nudge") {
      // Local check-in cadence (see lib/checkInNudges.ts). Opens the sheet
      // for whichever role the notification was scheduled for — not a
      // specific referral — since the sheet already triages everything that
      // needs attention (stale-first sort, needs-update section).
      const role = data.role as "applicant" | "sponsor" | undefined;
      fetchReferralsForCheckIn();
      if (role === "sponsor") setShowSponsorCheckIn(true);
      else setShowApplicantCheckIn(true);
    } else {
      // Generic fallback — open notifications list so the user can act on it
      setActiveView("notifications");
    }
    // Refresh unread count now that we're acting on a push
    fetchUnreadCount();
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fired when the user taps a notification while the app is in foreground
    // or when it's brought to the foreground from the background. This does
    // NOT fire for a tap that launches the app from a killed state — that case
    // is handled by the cold-start effect below.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handlePushResponse);

    return () => subscription.remove();
  }, [isAuthenticated]);

  // ── Cold start: route from the notification that launched the app ────────
  // When the app is killed and the user taps a push from the lock screen, the
  // OS launches the app and delivers the tap BEFORE the listener above mounts,
  // so it's lost and the app opens to its default (home) screen — the bug a
  // tester hit where a "new message" push from the lock screen landed on Home
  // instead of the inbox. useLastNotificationResponse() surfaces that launching
  // tap once the app (and auth) are ready, so it routes the same way a
  // background tap does. It returns `undefined` until ready and `null` when
  // there's no response; handlePushResponse guards both, and its dedupe ref
  // stops the live listener from acting on the same tap twice.
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!isAuthenticated) return;
    handlePushResponse(lastNotificationResponse ?? null);
  }, [isAuthenticated, lastNotificationResponse]);

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
          <Text style={styles.appTitle}>BackChannel</Text>
          <View style={styles.topBarButtons}>
            {/* Contextual — only rendered when there are live referrals to
                check in on. A brand-new user tapping this got a full-screen
                sheet saying "no active referrals"; better it simply isn't
                there until it has a job to do. The badge counts referrals
                with no update in 7+ days (same threshold as the Matches
                nudge banner), so the icon reads "N things need you". */}
            {activeReferralCount > 0 && (
              <TouchableOpacity
                onPress={handleOpenCheckIn}
                activeOpacity={0.7}
                style={styles.headerIconButton}
                accessibilityRole="button"
                accessibilityLabel={
                  staleReferralCount > 0
                    ? `Referral check-in, ${staleReferralCount} needing updates`
                    : "Referral check-in"
                }
                accessibilityHint="Review and update the status of your referrals"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <ClipboardCheck color="#000" size={20} strokeWidth={1.5} />
                {staleReferralCount > 0 && (
                  <View style={styles.headerCountPill}>
                    <Text style={styles.headerCountPillText}>
                      {staleReferralCount > 9 ? "9+" : staleReferralCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
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
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : "Notifications"
              }
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Bell color="#000" size={22} strokeWidth={1.5} />
              {unreadNotificationCount > 0 && (
                <View style={styles.headerCountPill}>
                  <Text style={styles.headerCountPillText}>
                    {unreadNotificationCount > 9
                      ? "9+"
                      : unreadNotificationCount}
                  </Text>
                </View>
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
              onNavigateToMessages={handleNavigateToMessages}
              onMatchCreated={requestPushPermission}
            />
          )}
          {activeView === "matches" && (
            <MatchesView
              userType={userType}
              onNavigateToMessages={handleNavigateToMessages}
              onOpenCheckIn={handleOpenCheckIn}
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
                pendingConversationId={pendingMessageConversationId}
                onPendingConversationConsumed={() =>
                  setPendingMessageConversationId(null)
                }
                onFirstMessageSent={requestPushPermission}
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
  // Count pill on a header icon — says HOW MUCH is waiting, not just that
  // something is (the old 6px dot). Same black count-pill language as the
  // section headers across every tab.
  headerCountPill: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  headerCountPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
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
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
    letterSpacing: -0.1,
  },
  navLabelActive: {
    color: "#FFF",
    fontWeight: "700",
  },
});
