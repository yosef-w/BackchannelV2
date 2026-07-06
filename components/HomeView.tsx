import {
  trackHomeIntroDismissed,
  trackHomeIntroShown,
  trackJobCardViewed,
  trackJobLiked,
  trackJobSkipped,
  trackJobWaitlistJoined,
  trackMatchCreated,
  trackProfileCardViewed,
  trackProfileLiked,
  trackProfileSkipped,
  trackSponsorRequested,
  trackTesterModeEnabled,
} from "@/lib/analytics/mixpanel";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchJobsPack,
  fetchProfilesPack,
  getLikedJobs,
  getMyJobs,
  getPublicProfile,
  getWaitlistedJobs,
  joinWaitlist,
  likeJob,
  likeProfile,
  recordJobFeedAction,
  recordProfileFeedAction,
  requestSponsorForJob,
} from "@/lib/api";
import { transformJobApiResponse, type JobApiResponse } from "@/types/jobs";
import { transformProfilePackRows } from "@/types/profiles";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import {
  BellRing,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Heart,
  Info,
  MapPin,
  RefreshCcw,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useJobsStore } from "../stores/useJobsStore";
import { useToastStore } from "../stores/useToastStore";
import { useSubscriptionStore } from "../stores/useSubscriptionStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import { saveSponsorRequestOutcome } from "../utils/sponsorRequestCache";
import { AlreadyLikedOverlay } from "./home/AlreadyLikedOverlay";
import { DeckDoneCard } from "./home/DeckDoneCard";
import { GetSponsorModal } from "./home/GetSponsorModal";
import { JobSwitcherSheet } from "./home/JobSwitcherSheet";
import { MatchCelebrationModal } from "./home/MatchCelebrationModal";
import { WorkEmailVerificationModal } from "./home/WorkEmailVerificationModal";
import { YourMoveStrip } from "./home/YourMoveStrip";
import { ProfileCompletionModal } from "./ProfileCompletionModal";
import { CompanyLogo } from "./ui/CompanyLogo";
import { ExpandableText } from "./ui/ExpandableText";
import { HOME_INTRO_PENDING_KEY, HomeIntro } from "./ui/HomeIntro";

interface HomeViewProps {
  userType: "applicant" | "sponsor";
  onNavigateToProfile?: () => void;
  /**
   * Shared value that drives the floating bottom nav bar's translateY in
   * MainApp. HomeView writes to it on scroll so the bar slides off-screen
   * as the user scrolls into a profile (revealing the sticky Pass/Connect
   * action bar) and reappears when they return to the top. Optional so
   * HomeView can still render standalone without breaking.
   */
  navTranslateY?: import("react-native-reanimated").SharedValue<number>;
  /**
   * Companion shared value for the TOP header (progress bar + role
   * switcher). Mirrors `navTranslateY` but moves the header upward
   * off-screen as the user scrolls down, reappearing when they return
   * to the top. HomeView writes to both from the same scroll handler so
   * header (up) and nav (down) move in sync.
   */
  headerTranslateY?: import("react-native-reanimated").SharedValue<number>;
  /**
   * Opens the given conversation (job + counterpart user) on the Messages
   * tab. Used by the match-celebration modal's "Message Now" button so it
   * actually opens the new thread instead of just dismissing the modal.
   */
  onNavigateToMessages?: (jobId: string, userId?: string) => void;
  /**
   * Fired the moment a mutual match happens. MainApp uses this as the
   * trigger to (finally) ask for push-notification permission — a match is
   * the first point in the app where the user has an obvious reason to want
   * to be notified, unlike the previous cold on-mount ask.
   */
  onMatchCreated?: () => void;
}

/**
 * Normalizes the backend's job-relevance score into a display percentage.
 *
 * The API contract for this field isn't pinned down — it's been observed as
 * both a 0–1 fraction and an already-scaled percentage — so this guesses
 * based on magnitude (>1 → already a percent) the same way the inline code
 * used to. That guess is inherently ambiguous for raw values just over 1
 * (e.g. is 1.2 "1.2%" or an out-of-range 0–1 fraction?). Until the backend
 * contract is confirmed and documented, this at least clamps the output to
 * a sane 1–100 range so a bad value can't render something like "1500% AI
 * Match" instead of silently doing the wrong-but-plausible thing.
 */
function formatRelevancePercent(raw: unknown): number | null {
  const score = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(score) || score <= 0) return null;
  const percent = score > 1 ? score : score * 100;
  return Math.min(100, Math.max(1, Math.round(percent)));
}

// Exported so MainApp can compute "cards remaining" for the unfinished-deck
// local-notification reminder without duplicating this constant.
export const DECK_SIZE = 10;
// How long a cached per-role deck stays "fresh" before a role re-fetches on
// re-entry (so new applicants surface). Keeps rapid role-switching instant
// without serving a stale deck all day.
const DECK_CACHE_TTL_MS = 5 * 60 * 1000;

const SkeletonCard = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // flex:1 + alignSelf:"stretch" fills fullEmptyContainer top-to-bottom and
    // edge-to-edge, defeating its justifyContent:"center"/alignItems:"center".
    // paddingTop/paddingBottom mirror profileScrollContent so the skeleton hero
    // lands at the exact same Y position as a real profile's hero avatar.
    <ScrollView
      style={{ flex: 1, alignSelf: "stretch" }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 24 }}>
        {/* 96×96 circular avatar */}
        <Animated.View
          style={[
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#EBEBEB",
            },
            shimmerStyle,
          ]}
        />
        {/* Name shimmer ~60% */}
        <Animated.View
          style={[
            {
              backgroundColor: "#EBEBEB",
              width: "58%",
              height: 26,
              borderRadius: 6,
              marginTop: 16,
            },
            shimmerStyle,
          ]}
        />
        {/* Subtitle shimmer ~38% */}
        <Animated.View
          style={[
            {
              backgroundColor: "#EBEBEB",
              width: "38%",
              height: 16,
              borderRadius: 4,
              marginTop: 8,
            },
            shimmerStyle,
          ]}
        />
        {/* Fact-pill row */}
        <View
          style={{
            flexDirection: "row",
            gap: 7,
            marginTop: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {([80, 90, 75, 65] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: "#EBEBEB",
                  width: w,
                  height: 28,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── ABOUT section ────────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        {/* Section label */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "28%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3 body-text lines */}
        <View style={{ gap: 8 }}>
          <Animated.View
            style={[
              { backgroundColor: "#EBEBEB", height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              { backgroundColor: "#EBEBEB", height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: "#EBEBEB",
                width: "70%",
                height: 15,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── AT-A-GLANCE stats strip ───────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "38%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3-cell strip — single block that mirrors hingeStatsRow shape */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 16,
              height: 64,
              overflow: "hidden",
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── INSIGHTS section ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18, gap: 10 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "32%",
              height: 11,
              borderRadius: 4,
            },
            shimmerStyle,
          ]}
        />
        {/* 2 insight card placeholders matching hingeInsightCard shape */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: "#EFEFEF",
            },
            shimmerStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: "#EFEFEF",
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── TOP SKILLS chips ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "30%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([70, 90, 60, 80, 75] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: "#EBEBEB",
                  width: w,
                  height: 30,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export function HomeView({
  userType,
  onNavigateToProfile,
  navTranslateY,
  headerTranslateY,
  onNavigateToMessages,
  onMatchCreated,
}: HomeViewProps) {
  const router = useRouter();
  const profileData = useUserProfileStore((state) => state.data);
  const workEmailVerified = useUserProfileStore(
    (state) => state.workEmailVerified,
  );

  const showToast = useToastStore((state) => state.showToast);

  // Jobs store
  const jobs = useJobsStore((state) => state.jobs);
  const jobsLoading = useJobsStore((state) => state.isLoading);
  const jobsError = useJobsStore((state) => state.error);
  const setJobs = useJobsStore((state) => state.setJobs);
  const setJobsLoading = useJobsStore((state) => state.setLoading);
  const setJobsError = useJobsStore((state) => state.setError);

  // Sponsored jobs (for sponsors)
  const sponsoredJobs = useJobsStore((state) => state.sponsoredJobs);
  const addSponsoredJob = useJobsStore((state) => state.addSponsoredJob);
  const activeSponsoredJobId = useJobsStore(
    (state) => state.activeSponsoredJobId,
  );
  const setActiveSponsoredJobId = useJobsStore(
    (state) => state.setActiveSponsoredJobId,
  );
  // Job-switcher (sponsor-only) — lets a sponsor with multiple sponsored
  // roles pick which one the deck represents. Switching changes
  // activeSponsoredJobId, which both re-fetches the profile pack for that
  // role AND becomes the JOB_ID stamped on every like the sponsor creates.
  const [showJobSwitcher, setShowJobSwitcher] = useState(false);
  // First-run editorial intro. Shown once per role the first time the deck is
  // live (so it lands as a "you've arrived" brand moment, not over a spinner).
  const [showIntro, setShowIntro] = useState(false);
  const introCheckedRef = useRef(false);
  const activeSponsoredJob = sponsoredJobs.find(
    (j) => j.jobId === activeSponsoredJobId,
  );

  // Profiles state (for sponsors)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  // Which sponsored-job id the current `profiles` list belongs to.
  // The empty state ("No applicants yet") needs this to distinguish
  // "we genuinely fetched and got zero" from "we haven't fetched for
  // this role yet". Without it, switching roles flashes the empty
  // state for one render between the role change and the effect
  // firing, and a failed fetch leaves the empty state stuck.
  const [profilesJobId, setProfilesJobId] = useState<string | null>(null);
  // Per-role deck cache so switching roles is instant + consistent: each
  // entry holds the role's deck plus the sponsor's position in it
  // (index/progress). On switch we snapshot the role we're leaving and
  // restore the one we're entering, instead of re-downloading and resetting
  // the progress bar every time. Entries expire after DECK_CACHE_TTL_MS so a
  // role eventually re-fetches (new applicants show up).
  const deckCacheRef = useRef<
    Map<
      string,
      { profiles: any[]; index: number; progress: number; fetchedAt: number }
    >
  >(new Map());
  // Cache of lazily-fetched full profiles keyed by USER_ID
  const [fullProfileCache, setFullProfileCache] = useState<Record<string, any>>(
    {},
  );
  const [fullProfileLoading, setFullProfileLoading] = useState(false);
  // Cache of sponsor public profiles, keyed by sponsor user id. Powers the
  // "Meet your sponsor" back face on applicant job cards — the job payload
  // only carries a thin sponsor object, so we fetch the rest (bio, the
  // sponsor's Q&A insights, referral network, verified status) once per
  // sponsor and reuse it.
  const [sponsorProfileCache, setSponsorProfileCache] = useState<
    Record<
      string,
      {
        bio: string;
        insights: { question: string; answer: string }[];
        companiesCanReferTo: string[];
        verified: boolean;
      }
    >
  >({});

  // Navigation state from store
  const currentProfileIndex = useJobsStore((state) => state.currentIndex);
  const setCurrentProfileIndex = useJobsStore((state) => state.setCurrentIndex);
  const progress = useJobsStore((state) => state.progress);
  const setProgress = useJobsStore((state) => state.setProgress);
  const resetNavigation = useJobsStore((state) => state.resetNavigation);
  const lastFetched = useJobsStore((state) => state.lastFetched);
  const sessionLikes = useJobsStore((state) => state.sessionLikes);
  const sessionMatches = useJobsStore((state) => state.sessionMatches);
  const incrementSessionLikes = useJobsStore(
    (state) => state.incrementSessionLikes,
  );
  const incrementSessionMatches = useJobsStore(
    (state) => state.incrementSessionMatches,
  );

  // Premium / paywall — the end-of-deck "unlock more cards" upsell reuses the
  // same RevenueCat paywall as ProfileView's "Upgrade to Pro". No-ops in
  // builds where PREMIUM_ENABLED is false (presentPaywall returns false).
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const presentPaywall = useSubscriptionStore((state) => state.presentPaywall);

  // Tapping "Unlock more cards" opens the paywall. On a successful purchase we
  // reset the deck so they can keep swiping immediately. (A larger/unlimited
  // daily allotment for premium users needs backend support — see note in
  // docs/BACKEND_CHANGES_NEEDED.md; for now this returns them to the top.)
  const handleUnlockMoreCards = async () => {
    const purchased = await presentPaywall();
    if (purchased) resetNavigation();
  };

  const scrollRef = useRef<ScrollView>(null);
  // Initialize loading based on whether we already have data
  const [isLoading, setIsLoading] = useState(() => {
    return userType === "applicant" ? jobs.length === 0 : false;
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{
    name: string;
    image: string;
    role: string;
    jobTitle?: string;
    /** jobId/userId for the new conversation — lets "Message Now" actually
     * open it instead of just dismissing the modal. */
    jobId?: string;
    userId?: string;
  } | null>(null);
  // 2026-05-26 redesign: the card-flip metaphor was retired in favor of a
  // Hinge-style vertical scroll. All content (front-face hero + former
  // back-face content + former "show more" expanded section) now lives in
  // a single scrollable column, so the flip and show-more toggles are
  // gone — but a few modals (full bio / full job description) are still
  // useful for very long copy, so their visibility state stays.
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);

  // Profile completion state
  const [showProfileCompletionModal, setShowProfileCompletionModal] =
    useState(false);
  const [isTester, setIsTester] = useState(false);

  // Email verification gate (sponsors only)
  const [showEmailVerificationModal, setShowEmailVerificationModal] =
    useState(false);
  const profileCompletion = profileData
    ? checkProfileCompleteness(profileData)
    : { isComplete: false, percentage: 0, missingFields: [] };

  // Apply Modal State (for non-sponsored jobs)
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyStep, setApplyStep] = useState<"select" | "requested">("select");
  const [pendingJob, setPendingJob] = useState<any>(null);
  const [isRequestingSponsor, setIsRequestingSponsor] = useState(false);
  // Server-rendered message for the "requested" success step. The backend
  // returns context-aware copy (count of sponsors notified, "already has a
  // sponsor", "no sponsors at this company yet", etc.) — surface it verbatim
  // so the user sees the actual outcome.
  const [sponsorRequestMessage, setSponsorRequestMessage] = useState<
    string | null
  >(null);
  const [waitlistedJobIds, setWaitlistedJobIds] = useState<Set<string>>(
    new Set(),
  );
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [requestedSponsorJobIds, setRequestedSponsorJobIds] = useState<
    Set<string>
  >(new Set());
  // Ids (job ids for applicants, applicant user ids for sponsors) already
  // successfully liked this session. "Review again" (see the deck-done
  // state) resets currentIndex/progress to replay the same deck, but this
  // set is untouched by that reset — it's what stops a re-swipe on an
  // already-actioned card from firing a second like API call / a second
  // match celebration for something already matched.
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  // Id of the card currently mid-transition away from, set by nextProfile()
  // for the ~220ms it takes the cross-fade to fade out BEFORE currentIndex
  // actually advances. Without this, a card that just got added to
  // likedIds (a fresh like, or the "already liked" overlay's own Continue
  // tap) would briefly re-qualify as "already liked" during that gap —
  // showCelebration/matchedUser only cover the celebration/match-modal
  // window that precedes it, not this trailing fade-out window.
  const [leavingItemId, setLeavingItemId] = useState<string | null>(null);

  // Drives the cross-fade between profiles. The old swipeX horizontal
  // translation + rotateY card-flip shared values were removed with the
  // card UI; only the opacity-driven fade survives the redesign.
  const swipeOpacity = useSharedValue(1);
  // Tracks the previous scroll Y on the worklet thread so the scroll
  // handler can derive direction (scroll-up vs scroll-down) frame-by-
  // frame. Used by the Hinge-style nav-bar hide animation below.
  const prevScrollY = useSharedValue(0);
  // Pulsing LIVE dot for the "No Applicants Yet" empty state. Loops
  // a gentle opacity oscillation so the indicator reads as active /
  // running, the way streaming UIs and status dashboards do it.
  const livePulse = useSharedValue(1);
  useEffect(() => {
    livePulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [livePulse]);
  const livePulseStyle = useAnimatedStyle(() => ({
    opacity: livePulse.value,
  }));

  // Use profiles for sponsors, jobs for applicants. The wrong-role side is
  // always an empty array — the deck only ever renders real backend data,
  // and the loading/empty/error states below handle a zero-length deck.
  const applicantJobs = userType === "applicant" ? jobs : [];
  const sponsorProfiles = userType === "sponsor" ? profiles : [];
  // Only fire the empty state when we've actually fetched FOR THE CURRENT
  // ROLE and got zero back. Without this gate the state flashes during
  // role transitions (new id is set, effect hasn't yet flipped loading)
  // and sticks permanently if the fetch errors before profiles is
  // written — both of which manifest as "Your sponsored job is live,
  // but no applicants have shown interest yet" appearing on every role.
  const hasNoApplicants =
    userType === "sponsor" &&
    sponsoredJobs.length > 0 &&
    profiles.length === 0 &&
    !profilesLoading &&
    profilesJobId === activeSponsoredJobId &&
    !profilesError;

  const currentData =
    userType === "sponsor"
      ? sponsorProfiles[currentProfileIndex % sponsorProfiles.length]
      : applicantJobs[currentProfileIndex % applicantJobs.length];
  const isDeckFinished = progress > DECK_SIZE;

  // True when the current card is one we've already liked this session —
  // most commonly because "Review again" replayed the deck from the top.
  // Drives the "already seen" overlay below instead of silently letting a
  // re-swipe fire a duplicate like.
  //
  // `likedIds` is updated the moment a like API call succeeds — which is
  // BEFORE the "Interest Sent!" celebration (or match modal) plays for that
  // same still-on-screen card, and that card also stays on screen for a
  // further ~220ms fade-out AFTER the celebration closes (nextProfile only
  // swaps currentData once its cross-fade-out finishes — see nextProfile).
  // Both showCelebration/matchedUser (the celebration window) and
  // leavingItemId (the trailing fade-out window) need to suppress the
  // overlay, or it flashes in right as the celebration disappears and just
  // before the new card swaps in.
  const currentItemId = currentData
    ? userType === "applicant"
      ? (currentData as any)?.id
      : (currentData as any)?.USER_ID || (currentData as any)?.id
    : null;
  const isAlreadyLiked =
    !!currentItemId &&
    likedIds.has(String(currentItemId)) &&
    !showCelebration &&
    !matchedUser &&
    String(currentItemId) !== leavingItemId;

  // True only when real cards are loaded and being displayed.
  // Used to dim the progress bar + show an em-dash placeholder
  // when the deck isn't active (empty/error/loading states).
  const deckIsActive =
    !isDeckFinished &&
    !isLoading &&
    !(userType === "sponsor" && sponsoredJobs.length === 0) &&
    !hasNoApplicants &&
    !(
      userType === "sponsor" &&
      profilesError != null &&
      profiles.length === 0
    ) &&
    !(userType === "applicant" && jobsError != null && jobs.length === 0) &&
    !(userType === "applicant" && !jobsLoading && jobs.length === 0);

  // ── First-run editorial intro ─────────────────────────────────────────────
  // Shown once, ONLY to users who just signed up: signup sets a one-time
  // "pending" flag, which we consume on the first Home view and then clear.
  // Existing users (login) never see it.
  useEffect(() => {
    if (introCheckedRef.current) return;
    introCheckedRef.current = true;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(HOME_INTRO_PENDING_KEY);
        if (pending === "1") {
          setShowIntro(true);
          trackHomeIntroShown("first_time");
        }
      } catch {
        // Storage unavailable — skip silently.
      }
    })();
  }, []);

  const handleIntroDone = (action: "complete" | "skip") => {
    setShowIntro(false);
    trackHomeIntroDismissed(action);
    AsyncStorage.removeItem(HOME_INTRO_PENDING_KEY).catch(() => {});
  };

  // Replay affordance (the header "?").
  const handleReplayIntro = () => {
    trackHomeIntroShown("replay");
    setShowIntro(true);
  };

  // Hydrate deck-action state (waitlisted / applied / sponsor-requested)
  // from the backend on mount — previously these Sets only ever grew from
  // in-session swipes, so a restart lost the "Waitlisted" / "Applied"
  // banner on every already-actioned card, and a re-swipe on one could
  // re-open the Get-a-Sponsor modal for a job the applicant already
  // requested. `getWaitlistedJobs` seeds both waitlistedJobIds and
  // requestedSponsorJobIds — the backend doesn't distinguish "waitlisted
  // only" from "waitlisted + requested a sponsor" (handleGetSponsor always
  // does both together), so both banners resolve to the same signal here;
  // that matches how the two are actually always set in tandem.
  useEffect(() => {
    if (userType !== "applicant") return;
    (async () => {
      try {
        const [waitlistRes, likedRes] = await Promise.allSettled([
          getWaitlistedJobs(),
          getLikedJobs(),
        ]);
        if (waitlistRes.status === "fulfilled") {
          const ids = waitlistRes.value.jobs.map((j) => String(j.job_id));
          setWaitlistedJobIds((prev) => new Set([...prev, ...ids]));
          setRequestedSponsorJobIds((prev) => new Set([...prev, ...ids]));
        }
        if (likedRes.status === "fulfilled") {
          const ids = likedRes.value.map((j) => String(j.JOB_ID));
          setAppliedJobIds((prev) => new Set([...prev, ...ids]));
          setLikedIds((prev) => new Set([...prev, ...ids]));
        }
      } catch {
        // Non-fatal — banners just won't reflect prior sessions until the
        // next successful fetch; the deck itself still works.
      }
    })();
  }, [userType]);

  // Bootstrap sponsor state on mount — ensures activeSponsoredJobId is set
  // even when the user lands on the dashboard before visiting the jobs tab.
  // Adds every sponsored job to the store (no REFERENCE_JOB_ID filter — that
  // would exclude manually-created jobs and cause the role dropdown to show
  // fewer roles than the "My Sponsored" tab on the Jobs board).
  //
  // SMART DEFAULT: after populating the store, set the active role to the
  // one with the highest PENDING_LIKES_COUNT (most unactioned applicants
  // waiting on the sponsor — PR #56's pending-only signal). The sponsor
  // lands on whatever role has the most work to do, instead of whatever
  // the backend happened to return first. Ties break by response order
  // (CREATED_AT DESC, so the most-recent role wins ties — including the
  // all-zero cold-start case).
  useEffect(() => {
    if (userType !== "sponsor") return;
    if (activeSponsoredJobId) return;
    const bootstrap = async () => {
      try {
        const response = await getMyJobs();
        if (!response.jobs?.length) return;
        response.jobs.forEach((j: any) => {
          addSponsoredJob({
            jobId: String(j.JOB_ID),
            // Empty string for manually-created jobs that have no ATS source.
            atsJobId: j.REFERENCE_JOB_ID ? String(j.REFERENCE_JOB_ID) : "",
            title: j.TITLE || "",
            company: j.COMPANY || "",
            likesCount: Number(j.PENDING_LIKES_COUNT ?? j.LIKES_COUNT) || 0,
          });
        });
        // Pick the role with the highest PENDING_LIKES_COUNT as the smart
        // default. Fall back to LIKES_COUNT if the new field is absent
        // (older backend, defensive). Reduce-with-strict-greater-than gives
        // "ties go to first seen" → first in the response (most recent)
        // wins ties, including the all-zero case.
        const pending = (j: any) =>
          Number(j.PENDING_LIKES_COUNT ?? j.LIKES_COUNT ?? 0);
        const winner = response.jobs.reduce(
          (best: any, j: any) => (pending(j) > pending(best) ? j : best),
          response.jobs[0],
        );
        if (winner) {
          setActiveSponsoredJobId(String(winner.JOB_ID));
        }
      } catch {
        // silent fail — dashboard will show empty state with CTA
      }
    };
    bootstrap();
  }, [userType]);

  // Fetch jobs/profiles on mount (only if we don't have recent data).
  //
  // 2026-05-27 — Daily-pack cache window.
  // The applicant job deck is treated as STABLE for the rest of the
  // calendar day once fetched. Tab-switching, backgrounding for a few
  // minutes, or remounting HomeView all hit the cache and reuse the
  // existing deck + scroll position. The cache rolls over at midnight
  // local-time so the next morning's first mount fetches a fresh pack.
  //
  // This is forward-compatible with the upcoming backend daily-pack
  // flag (every user gets 10 jobs per day, refreshes at the day
  // boundary). Once that flag is on server-side, this client-side
  // gate becomes redundant but harmless — both will agree.
  //
  // Previously this was a rolling 5-minute TTL, which caused decks to
  // silently swap underneath users whenever they returned to Home
  // after a coffee break.
  useEffect(() => {
    const loadData = async () => {
      if (userType === "applicant") {
        const lastFetchedDate = lastFetched ? new Date(lastFetched) : null;
        const now = new Date();
        const isSameDay =
          !!lastFetchedDate &&
          lastFetchedDate.getFullYear() === now.getFullYear() &&
          lastFetchedDate.getMonth() === now.getMonth() &&
          lastFetchedDate.getDate() === now.getDate();
        const isCacheValid = isSameDay && jobs.length > 0;

        if (isCacheValid) {
          console.log("[HomeView] Reusing today's cached deck — no refetch.");
          return;
        }

        try {
          console.log("[HomeView] Fetching jobs for applicant...");
          setJobsLoading(true);
          const apiJobs = await fetchJobsPack();
          console.log("[HomeView] Fetched", apiJobs.length, "jobs from API");
          const transformedJobs = apiJobs.map((job: JobApiResponse) =>
            transformJobApiResponse(job),
          );
          console.log("[HomeView] Transformed jobs:", transformedJobs.length);
          setJobs(transformedJobs);
          // Fresh deck → start at card 1. Without this, currentIndex
          // would persist from the previous (now-replaced) deck and
          // the user would land mid-pack on an arbitrary card.
          resetNavigation();
          console.log("[HomeView] Job deck URLs:");
          transformedJobs.forEach((job, i) => {
            console.log(
              `  ${i + 1}. ${job.title} @ ${job.company} → ${job.applicationUrl}`,
            );
          });
        } catch (err) {
          console.warn("[HomeView] Failed to fetch jobs:", err);
          setJobsError(
            err instanceof Error ? err.message : "Failed to fetch jobs",
          );
        } finally {
          setJobsLoading(false);
        }
      } else if (userType === "sponsor") {
        // Fetch profiles for sponsors only if they have a sponsored job
        if (!activeSponsoredJobId) {
          console.log(
            "[HomeView] No sponsored jobs yet, skipping profile fetch",
          );
          setProfilesLoading(false);
          return;
        }

        // Per-role cache: if we have a fresh deck for this role, restore it
        // (and the sponsor's exact position) instantly — no spinner, no
        // re-download, no progress reset. This is what makes switching back
        // to a role consistent instead of reshuffling a fresh pack.
        const cached = deckCacheRef.current.get(activeSponsoredJobId);
        if (cached && Date.now() - cached.fetchedAt < DECK_CACHE_TTL_MS) {
          setProfiles(cached.profiles);
          setProfilesJobId(activeSponsoredJobId);
          setCurrentProfileIndex(cached.index);
          setProgress(cached.progress);
          setProfilesLoading(false);
          return;
        }

        // No fresh cache → fetch a new deck and start at card 1. Snapshot the
        // id we're fetching for so a response that resolves AFTER the user has
        // already switched roles is discarded instead of overwriting the
        // newer deck (the previous code snapshotted this id but never checked
        // it — the actual cause of the inconsistent reload).
        const fetchingForJobId = activeSponsoredJobId;
        try {
          console.log(
            "[HomeView] Fetching profiles for sponsored job:",
            fetchingForJobId,
          );
          setProfilesLoading(true);
          setProfilesError(null);
          // Fresh deck → reset to card 1 (no cached position to restore).
          resetNavigation();
          const response = await fetchProfilesPack(fetchingForJobId);
          // Race guard: if the sponsor switched to a different role while this
          // was in flight, drop the response so it can't overwrite the newer
          // role's deck.
          if (
            useJobsStore.getState().activeSponsoredJobId !== fetchingForJobId
          ) {
            return;
          }
          console.log(
            "[HomeView] Fetched",
            response.profiles.length,
            "profiles from API",
          );
          console.log("[HomeView] First profile sample:", response.profiles[0]);

          // PR #39 (Opt C, 2026-05-05): the pack endpoint now includes
          // ap.INSIGHTS and up.BIO directly, so the back-of-card prompts +
          // the richer "About" text render on first paint. The lazy
          // `fetchFullProfileFor` call below still runs for the deeper
          // sections (experiences / education / certifications / languages
          // / achievements) which the pack does NOT include.
          const transformedProfiles = transformProfilePackRows(
            response.profiles,
          );

          console.log(
            "[HomeView] Transformed first profile:",
            transformedProfiles[0],
          );
          setProfiles(transformedProfiles);
          // Mark which role this list represents so the empty-state
          // check can tell genuine "no applicants" apart from "still
          // loading after a role switch".
          setProfilesJobId(fetchingForJobId);
          // Cache the fresh deck (at the start) so re-entering this role is
          // instant and consistent until the TTL expires.
          deckCacheRef.current.set(fetchingForJobId, {
            profiles: transformedProfiles,
            index: 0,
            progress: 1,
            fetchedAt: Date.now(),
          });
        } catch (err) {
          console.warn("[HomeView] Failed to fetch profiles:", err);
          // Don't clobber a newer role's error state with a stale failure.
          if (
            useJobsStore.getState().activeSponsoredJobId === fetchingForJobId
          ) {
            setProfilesError(
              err instanceof Error ? err.message : "Failed to fetch profiles",
            );
          }
          // profilesError drives the error state — deck stays empty
        } finally {
          // Only flip loading off if we're still on the role we fetched for.
          if (
            useJobsStore.getState().activeSponsoredJobId === fetchingForJobId
          ) {
            setProfilesLoading(false);
          }
        }
      }
    };

    loadData();
  }, [userType, activeSponsoredJobId]); // Re-fetch when sponsored job changes

  // Update local loading state based on store loading and whether we have data
  useEffect(() => {
    if (userType === "applicant") {
      // Show skeleton only while the fetch is actually in flight and we
      // have no data yet. Previously this was `|| jobs.length === 0`
      // which kept isLoading=true permanently when the API returned an
      // empty deck, making the skeleton spin forever.
      const shouldLoad = jobsLoading && jobs.length === 0;
      setIsLoading(shouldLoad);
    } else {
      // For sponsors, show loading while fetching profiles
      const shouldLoad = profilesLoading && profiles.length === 0;
      setIsLoading(shouldLoad);
    }
  }, [userType, jobsLoading, jobs.length, profilesLoading, profiles.length]);

  // Lazy-load the deeper applicant profile (experiences, education,
  // certifications, languages, achievements) on demand. As of PR #39 (Opt C,
  // 2026-05-05) the pack endpoint already includes BIO + INSIGHTS so the
  // back-of-card prompts and richer About text are populated upfront — this
  // lazy fetch only fills in the heavier sections that the pack still omits.
  const fetchFullProfileFor = useCallback(
    async (userId: string) => {
      if (!userId || fullProfileCache[userId] || fullProfileLoading) return;
      setFullProfileLoading(true);
      try {
        const pub = await getPublicProfile(String(userId));
        const ap = (pub as any).applicant_profile || {};
        const parseV = (v: any): any[] => {
          if (!v) return [];
          if (typeof v === "string") {
            try {
              return JSON.parse(v) || [];
            } catch {
              return [];
            }
          }
          return Array.isArray(v) ? v : [];
        };
        setFullProfileCache((prev) => ({
          ...prev,
          [userId]: {
            experiences: parseV(ap.PROFESSIONAL_EXPERIENCES),
            education: parseV(ap.EDUCATION_ENTRIES),
            certifications: parseV(ap.CERTIFICATIONS),
            languages: parseV(ap.LANGUAGES),
            achievements: ap.ACHIEVEMENTS || "",
            prompts: parseV(ap.INSIGHTS),
            bio: (pub as any).BIO || "",
          },
        }));
      } catch {
        // silent — feature degrades gracefully if backend call fails
      } finally {
        setFullProfileLoading(false);
      }
    },
    [fullProfileCache, fullProfileLoading],
  );

  // Eager-fetch the full applicant profile when a sponsor advances to a
  // new card so the back-of-card insights + richer front-of-card bio are
  // ready before the user flips.
  useEffect(() => {
    if (userType !== "sponsor") return;
    const userId = (currentData as any)?.USER_ID;
    if (userId) fetchFullProfileFor(String(userId));
  }, [userType, currentData, fetchFullProfileFor]);

  // Fetch the sponsor's public profile for the "Meet your sponsor" back
  // face. The job's `sponsorInfo` only has name/photo/role/years — bio,
  // the sponsor's personal Q&A insights, and referral network come from
  // GET /api/profiles/<id>/public/.
  const fetchSponsorProfileFor = useCallback(
    async (userId: string) => {
      if (!userId || sponsorProfileCache[userId]) return;
      try {
        const pub = await getPublicProfile(String(userId));
        const sp = (pub as any).sponsor_profile || {};
        const parseV = (v: any): any[] => {
          if (!v) return [];
          if (typeof v === "string") {
            try {
              return JSON.parse(v) || [];
            } catch {
              return [];
            }
          }
          return Array.isArray(v) ? v : [];
        };
        setSponsorProfileCache((prev) => ({
          ...prev,
          [userId]: {
            bio: (pub as any).BIO || "",
            insights: parseV(sp.INSIGHTS),
            companiesCanReferTo: parseV(sp.COMPANIES_CAN_REFER_TO),
            // WORK_EMAIL_VERIFIED isn't on the public-profile payload yet —
            // see BACKEND_CHANGES_NEEDED.md §9. The badge stays hidden until
            // the backend exposes it; reading both casings defensively.
            verified:
              (pub as any).WORK_EMAIL_VERIFIED === true ||
              (pub as any).sponsor_profile?.WORK_EMAIL_VERIFIED === true,
          },
        }));
      } catch {
        // silent — the back face degrades to the thin sponsorInfo data
      }
    },
    [sponsorProfileCache],
  );

  // Eager-fetch the sponsor profile when an applicant advances to a new
  // sponsored job card, so the back face is ready before they flip.
  useEffect(() => {
    if (userType === "sponsor") return;
    const sponsorId = (currentData as any)?.sponsorInfo?.userId;
    if (sponsorId) fetchSponsorProfileFor(String(sponsorId));
  }, [userType, currentData, fetchSponsorProfileFor]);

  // Record "viewed" in the feed history and Mixpanel whenever the active
  // card changes. Fire-and-forget — failures must never block the UI.
  useEffect(() => {
    if (!currentData) return;
    if (userType === "applicant") {
      const jobId = currentData?.id;
      if (jobId) {
        const isSponsored =
          "isSponsored" in currentData
            ? Boolean(currentData.isSponsored)
            : false;
        recordJobFeedAction(String(jobId), "viewed").catch(() => {});
        trackJobCardViewed({ jobId: String(jobId), isSponsored });
      }
    } else {
      const applicantUserId = (currentData as any)?.USER_ID || currentData?.id;
      if (applicantUserId && activeSponsoredJobId) {
        recordProfileFeedAction(
          activeSponsoredJobId,
          String(applicantUserId),
          "viewed",
        ).catch(() => {});
        trackProfileCardViewed({
          applicantUserId: String(applicantUserId),
          jobId: activeSponsoredJobId,
        });
      }
    }
  }, [currentData, userType, activeSponsoredJobId]);

  // Hinge-style redesign — when a profile becomes current, kick off the
  // deep-profile fetch (experiences/education/certs/languages) eagerly
  // since they're inline in the scroll now instead of behind a Show More
  // toggle. Idempotent on the cache side so this is a no-op once loaded.
  useEffect(() => {
    if (userType !== "sponsor") return;
    const userId = currentData?.USER_ID;
    if (userId) fetchFullProfileFor(String(userId));
    // fetchFullProfileFor is stable enough for our use; we re-fire only on
    // profile change, not when the function identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData?.USER_ID, userType]);

  const handleSwipe = async (isAccept: boolean) => {
    // Check profile completeness for applicants before any swipe action (unless they're a tester).
    // Gate on isComplete (every required field present) rather than a percentage
    // threshold, so no single required field — e.g. photo or bio — can be skipped.
    if (userType === "applicant" && !profileCompletion.isComplete && !isTester) {
      setShowProfileCompletionModal(true);
      return;
    }

    // Block sponsors from swiping until they've verified their work email
    if (userType === "sponsor" && !workEmailVerified && !isTester) {
      setShowEmailVerificationModal(true);
      return;
    }

    // If applicant tries to apply to Non-Sponsored Job, intercept
    if (
      userType === "applicant" &&
      isAccept &&
      "isSponsored" in currentData &&
      currentData.isSponsored === false
    ) {
      // Already waitlisted — skip silently and advance the deck.
      // Route through nextProfile so progress (and the dots/number) bumps
      // in lock-step with currentIndex, like every other action.
      if (waitlistedJobIds.has(String(currentData.id))) {
        nextProfile(true);
        return;
      }
      setPendingJob(currentData);
      setApplyStep("select");
      setShowApplyModal(true);
      return;
    }

    // Already liked this item earlier in the session — most likely because
    // "Review again" replayed the deck from the top. Skip the API call
    // entirely (no duplicate like, no duplicate match celebration) and just
    // advance, the same way a fresh like would.
    if (isAccept && currentItemId && likedIds.has(String(currentItemId))) {
      nextProfile(true);
      return;
    }

    if (isAccept) {
      // Call like API when accepting
      let didMatch = false;
      let jobGone = false;
      let apiError = false;
      try {
        if (userType === "applicant") {
          // Applicant liking a job
          const jobId = currentData?.id;
          if (jobId) {
            console.log("[HomeView] Applicant liking job:", jobId);
            const response = await likeJob(jobId);
            console.log("[HomeView] Like job response:", response);

            // Mark sponsored job as applied
            setAppliedJobIds((prev) => new Set([...prev, String(jobId)]));
            setLikedIds((prev) => new Set([...prev, String(jobId)]));
            incrementSessionLikes();

            // Record "liked" in the feed history (fire-and-forget)
            recordJobFeedAction(String(jobId), "liked").catch(() => {});

            const isSponsoredJob =
              "isSponsored" in currentData
                ? Boolean(currentData.isSponsored)
                : false;
            trackJobLiked({
              jobId: String(jobId),
              isSponsored: isSponsoredJob,
              matched: Boolean(response.matched),
            });

            // Show match celebration modal on mutual like
            if (response.matched) {
              console.log("[HomeView] 🎉 It's a match!");
              didMatch = true;
              onMatchCreated?.();
              incrementSessionMatches();
              const matchName =
                "sponsorInfo" in currentData && currentData.sponsorInfo?.name
                  ? (currentData.sponsorInfo.name as string)
                  : "company" in currentData
                    ? (currentData.company as string) || "Your Sponsor"
                    : "Your Sponsor";
              setMatchedUser({
                name: matchName,
                image:
                  "sponsorInfo" in currentData
                    ? (currentData.sponsorInfo?.image as string) || ""
                    : "",
                role:
                  "sponsorInfo" in currentData
                    ? (currentData.sponsorInfo?.role as string) || ""
                    : "",
                jobTitle:
                  "title" in currentData
                    ? (currentData.title as string)
                    : undefined,
                jobId: String(jobId),
                userId:
                  "sponsorInfo" in currentData && currentData.sponsorInfo?.userId
                    ? String(currentData.sponsorInfo.userId)
                    : undefined,
              });
              trackMatchCreated({
                matchedWithName: matchName,
                jobId: String(jobId),
                origin: "applicant_swipe",
              });
            }
          } else {
            console.warn("[HomeView] No job ID found for current data");
          }
        } else {
          // Sponsor liking a profile
          const applicantUserId = currentData?.USER_ID || currentData?.id;
          if (applicantUserId) {
            console.log("[HomeView] Sponsor liking profile:", applicantUserId);
            console.log(
              "[HomeView] Active sponsored job:",
              activeSponsoredJobId,
            );
            const response = await likeProfile(
              String(applicantUserId),
              activeSponsoredJobId || undefined,
            );
            console.log("[HomeView] Like profile response:", response);
            setLikedIds((prev) => new Set([...prev, String(applicantUserId)]));
            incrementSessionLikes();

            trackProfileLiked({
              applicantUserId: String(applicantUserId),
              jobId: activeSponsoredJobId || undefined,
              matched: Boolean(response.matched),
            });

            // Record "liked" in the feed history (fire-and-forget)
            if (activeSponsoredJobId) {
              recordProfileFeedAction(
                activeSponsoredJobId,
                String(applicantUserId),
                "liked",
              ).catch(() => {});
            }

            // Show match celebration modal on mutual like
            if (response.matched) {
              console.log("[HomeView] 🎉 It's a match!");
              didMatch = true;
              onMatchCreated?.();
              incrementSessionMatches();
              const matchName =
                (currentData.name as string) ||
                `${(currentData.FIRST_NAME as string) || ""} ${(currentData.LAST_NAME as string) || ""}`.trim() ||
                "Applicant";
              setMatchedUser({
                name: matchName,
                image:
                  (currentData.image as string) ||
                  (currentData.PHOTO_URL as string) ||
                  "",
                role:
                  (currentData.desiredRole as string) ||
                  (currentData.role as string) ||
                  "",
                jobId: activeSponsoredJobId || undefined,
                userId: String(applicantUserId),
              });
              trackMatchCreated({
                matchedWithName: matchName,
                jobId: activeSponsoredJobId || undefined,
                origin: "sponsor_swipe",
              });
            }
          } else {
            console.warn(
              "[HomeView] No applicant user ID found for current data",
            );
          }
        }
      } catch (err) {
        console.warn("[HomeView] Failed to record like:", err);
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (
          msg.includes("not found") ||
          msg.includes("inactive") ||
          msg.includes("404")
        ) {
          // Job was unsponsored/deleted since the deck was fetched.
          jobGone = true;
        } else {
          // Server error (5xx) or network failure — the like was not recorded.
          // Do not show "Request Sent!" which would falsely imply success.
          apiError = true;
        }
      }

      if (jobGone) {
        showToast("This job is no longer available.", "info");
        nextProfile(true);
      } else if (apiError) {
        showToast("Couldn't connect right now. Please try again.", "error");
        // Keep the card in place so the user can retry the swipe.
      } else if (!didMatch) {
        // Standard swipe-right toast — only shown when there is no mutual match
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          nextProfile(true);
        }, 1800);
      }
      // When didMatch=true, nextProfile is called when the match modal is dismissed
    } else {
      // Skip / swipe-left analytics — fired regardless of role.
      if (userType === "applicant") {
        const skippedJobId = currentData?.id;
        if (skippedJobId) {
          trackJobSkipped({
            jobId: String(skippedJobId),
            isSponsored:
              "isSponsored" in currentData
                ? Boolean(currentData.isSponsored)
                : false,
          });
          // Record "passed" in the feed history (fire-and-forget)
          recordJobFeedAction(String(skippedJobId), "passed").catch(() => {});
        }
      } else {
        const skippedApplicantId = currentData?.USER_ID || currentData?.id;
        if (skippedApplicantId) {
          trackProfileSkipped({
            applicantUserId: String(skippedApplicantId),
            jobId: activeSponsoredJobId || undefined,
          });
          // Record "passed" in the feed history (fire-and-forget)
          if (activeSponsoredJobId) {
            recordProfileFeedAction(
              activeSponsoredJobId,
              String(skippedApplicantId),
              "passed",
            ).catch(() => {});
          }
        }
      }
      nextProfile(false);
    }
  };

  // Hinge-style profile transition. The card-flip metaphor is gone, so
  // there's no horizontal swipe to animate — we just cross-fade with a
  // subtle vertical lift to keep the action feeling responsive. The
  // `isAccept` arg is retained for API compatibility but no longer drives
  // a direction since both Pass and Connect feel the same to the layout.
  const nextProfile = (_isAccept: boolean) => {
    // Mark the card we're leaving so the "already liked" overlay can
    // suppress itself for it specifically during the fade-out below, even
    // after showCelebration/matchedUser have already cleared.
    if (currentItemId) setLeavingItemId(String(currentItemId));

    // Scroll back to the top so the next profile starts at its hero, not
    // mid-bio. Snap (not animated) — the cross-fade hides the jump.
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    swipeOpacity.value = withTiming(0, { duration: 220 });

    setTimeout(() => {
      setProgress(progress + 1);
      setCurrentProfileIndex(currentProfileIndex + 1);
      swipeOpacity.value = withTiming(1, { duration: 280 });
      setLeavingItemId(null);
    }, 220);
  };

  // Switch the active sponsored role from the pill's job switcher. Snapshots
  // the role we're leaving (deck + the sponsor's exact position) so we can
  // restore it on return; the load effect then restores the target role from
  // cache or fetches it fresh. Progress is no longer blindly reset here — that
  // was the "switching resets the progress bar" complaint.
  const handleSwitchRole = (newJobId: string) => {
    setShowJobSwitcher(false);
    if (!newJobId || newJobId === activeSponsoredJobId) return;
    if (
      activeSponsoredJobId &&
      profilesJobId === activeSponsoredJobId &&
      profiles.length > 0
    ) {
      const prev = deckCacheRef.current.get(activeSponsoredJobId);
      deckCacheRef.current.set(activeSponsoredJobId, {
        profiles,
        index: currentProfileIndex,
        progress,
        // Keep the original fetch time so the TTL is based on when the deck
        // was downloaded, not when it was last viewed.
        fetchedAt: prev?.fetchedAt ?? Date.now(),
      });
    }
    setActiveSponsoredJobId(newJobId);
  };

  const handleMatchModalDismiss = () => {
    setMatchedUser(null);
    nextProfile(true);
  };

  // "Message Now" — actually opens the new conversation instead of just
  // dismissing the modal like "Continue Exploring" does.
  const handleMatchModalMessage = () => {
    const jobId = matchedUser?.jobId;
    const userId = matchedUser?.userId;
    setMatchedUser(null);
    nextProfile(true);
    if (jobId && onNavigateToMessages) {
      onNavigateToMessages(jobId, userId);
    }
  };

  // Combined "Get a Sponsor" — fires both APIs in parallel. Request-sponsor
  // pushes notifications to employees at the company; join-waitlist makes
  // sure the applicant is queued for a notification when *anyone* sponsors
  // the job (whether through our outbound notification or any other path).
  // Promise.allSettled so a single failure doesn't lose the other half.
  const handleGetSponsor = async () => {
    if (!pendingJob?.id) return;
    const jobId = String(pendingJob.id);
    setIsRequestingSponsor(true);
    setSponsorRequestMessage(null);
    const [requestRes, waitlistRes] = await Promise.allSettled([
      requestSponsorForJob(jobId),
      joinWaitlist(jobId),
    ]);
    // Only track + flip local pending state for the half of the pair that
    // actually succeeded — previously both fired unconditionally, so a
    // fully-failed request (e.g. offline) still recorded
    // trackSponsorRequested/trackJobWaitlistJoined and showed "Request
    // sent!" with a badge, overcounting the funnel and lying to the user.
    if (requestRes.status === "fulfilled") {
      trackSponsorRequested({ jobId });
      // Backend's context-aware copy: count of sponsors, "already has a
      // sponsor", "no sponsors at this company yet", duplicate request, etc.
      setSponsorRequestMessage(requestRes.value.message ?? null);
      // Mirror it locally so the Matches screen's Waitlisted detail can show
      // it later — the backend doesn't persist/return this message anywhere
      // (see utils/sponsorRequestCache.ts), so without this it's gone the
      // moment the user navigates away.
      if (requestRes.value.message) {
        saveSponsorRequestOutcome(jobId, requestRes.value.message);
      }
      setRequestedSponsorJobIds((prev) => new Set([...prev, jobId]));
    } else {
      console.warn("[HomeView] request-sponsor failed:", requestRes.reason);
    }
    if (waitlistRes.status === "fulfilled") {
      trackJobWaitlistJoined({ jobId });
      setWaitlistedJobIds((prev) => new Set([...prev, jobId]));
    } else {
      console.warn("[HomeView] join-waitlist failed:", waitlistRes.reason);
    }
    setIsRequestingSponsor(false);
    // Only show the "Request sent!" success step if at least one half
    // actually succeeded; otherwise let the user retry from the select step.
    if (requestRes.status === "fulfilled" || waitlistRes.status === "fulfilled") {
      setApplyStep("requested");
    } else {
      showToast("Couldn't send that right now. Please try again.", "error");
    }
  };

  const handleApplyModalDone = () => {
    setShowApplyModal(false);
    setPendingJob(null);
    // Advance the deck so the actioned card moves to the back. Use
    // nextProfile so progress advances in lock-step with currentIndex —
    // a bare setCurrentProfileIndex left the progress bar frozen.
    nextProfile(true);
  };

  // Hinge-style transition — pure opacity cross-fade with a subtle 8px
  // lift so the swap feels responsive without the abrupt swipe-out the
  // old card UI used. translateX is intentionally dropped; the page is
  // a vertical scroll now, so horizontal motion would feel mis-aligned.
  //
  // The dimmed-background look for an "already liked" card is computed
  // HERE rather than via a separate plain style layered on top in the
  // style array — Reanimated applies an animated style's props directly on
  // the UI thread, which wins over a later plain-object opacity in the
  // array regardless of ordering, so bolting a static { opacity: 0.35 }
  // onto the array silently had no visual effect. Folding isAlreadyLiked
  // into the worklet (with it listed as a dependency, since it's a plain
  // JS/React value, not a shared value) is what actually applies it.
  const mainAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: isAlreadyLiked ? 0.35 : swipeOpacity.value,
      transform: [{ translateY: (1 - swipeOpacity.value) * 8 }],
    }),
    [isAlreadyLiked],
  );

  // Hinge-style hide-on-scroll for BOTH chrome elements: the bottom nav
  // bar (slides down) and the top header (slides up). The handler runs
  // on the worklet thread (no JS bridge), so it stays buttery even on
  // long profiles. Direction is derived from the frame-to-frame delta of
  // contentOffset.y; small deltas under DEAD_ZONE are ignored to keep
  // the bars from juddering during fingertip-jitter.
  //
  // The thresholds:
  //   • Y <= TOP_PIN          → always pin both visible (covers top bounce)
  //   • Y >= maxY - BOTTOM_PIN → freeze state (covers bottom rubber-band)
  //   • dy > DEAD_ZONE        → scrolling down → hide both
  //   • dy < -DEAD_ZONE       → scrolling up   → reveal both
  //
  // Why the bottom freeze: when the user reaches the end of the scroll
  // and keeps pulling, iOS rubber-bands — contentOffset.y overshoots
  // past maxY, then snaps back. The snap-back fires a burst of frames
  // with dy < 0 (looks like "scrolling up" to a naive handler), which
  // would re-reveal the nav and cause it to vibrate against the user's
  // finger. Freezing the chrome state inside the overscroll zone
  // kills the jitter completely.
  //
  // navTranslateY + headerTranslateY are owned by MainApp; HomeView is
  // the sole writer to both. Different HIDE_OFFSETs because the header
  // is shorter than the nav pill — 80 is enough to clear it.
  const TOP_PIN = 4;
  const BOTTOM_PIN = 4;
  const DEAD_ZONE = 3;
  const NAV_HIDE_OFFSET = 120;
  const HEADER_HIDE_OFFSET = 80;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      "worklet";
      const y = e.contentOffset.y;
      const dy = y - prevScrollY.value;
      const maxY = e.contentSize.height - e.layoutMeasurement.height;
      // Guard `maxY > 0` so we don't accidentally treat a short
      // profile (no scroll possible) as "always at the bottom".
      const atBottom = maxY > 0 && y >= maxY - BOTTOM_PIN;

      if (y <= TOP_PIN) {
        // At (or above) the top — always reveal. Covers the iOS
        // overscroll bounce, which can briefly report negative Y.
        if (navTranslateY && navTranslateY.value !== 0) {
          navTranslateY.value = withTiming(0, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== 0) {
          headerTranslateY.value = withTiming(0, { duration: 220 });
        }
      } else if (atBottom) {
        // At (or past) the bottom — hold the current chrome state.
        // The rubber-band snap-back generates a flurry of negative
        // dy frames that would otherwise re-reveal the nav and make
        // it vibrate against the user's finger. By doing nothing
        // here, the bar stays exactly where it was when the user
        // hit the end. As soon as they scroll BACK up past the
        // bottom zone, the regular dy logic takes over again.
      } else if (dy > DEAD_ZONE) {
        if (navTranslateY && navTranslateY.value !== NAV_HIDE_OFFSET) {
          navTranslateY.value = withTiming(NAV_HIDE_OFFSET, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== HEADER_HIDE_OFFSET) {
          headerTranslateY.value = withTiming(HEADER_HIDE_OFFSET, {
            duration: 220,
          });
        }
      } else if (dy < -DEAD_ZONE) {
        if (navTranslateY && navTranslateY.value !== 0) {
          navTranslateY.value = withTiming(0, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== 0) {
          headerTranslateY.value = withTiming(0, { duration: 220 });
        }
      }
      prevScrollY.value = y;
    },
  });

  // Animated style consumed by the header element itself. Translates
  // upward (negative Y) and fades as the shared value grows toward
  // HEADER_HIDE_OFFSET. Reading the shared value here is what makes
  // the header tween in lock-step with the nav bar.
  // headerHeight is captured once via onLayout so we can interpolate the
  // layout height to 0 as the header hides, collapsing the dead white band.
  const headerHeight = useSharedValue(0);
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, (headerTranslateY?.value ?? 0) / 80);
    const collapsing = progress > 0 && headerHeight.value > 0;
    return {
      transform: [{ translateY: -(headerTranslateY?.value ?? 0) }],
      opacity: 1 - progress,
      // Only constrain height while actively collapsing. When fully
      // visible, let natural height through so taller content (e.g. the
      // sponsor's role-switcher pill that mounts later, once sponsoredJobs
      // loads) isn't clipped by a stale onLayout capture against
      // overflow:"hidden".
      height: collapsing
        ? Math.max(0, headerHeight.value * (1 - progress))
        : undefined,
      marginBottom: collapsing ? (1 - progress) * 28 : undefined,
      overflow: "hidden",
    };
  });

  // Floating Pass/Connect buttons ride in lock-step with the bottom nav
  // pill. At the top of the scroll the nav is visible (navTranslateY = 0)
  // and would otherwise sit directly on top of the buttons — so we lift
  // them FLOATING_NAV_CLEARANCE px clear of the pill. As the user scrolls
  // down the nav slides off-screen (navTranslateY → NAV_HIDE_OFFSET) and
  // the buttons drop in unison into the space it vacates, landing at their
  // natural bottom position. Scrolling back up reverses it. Reading the
  // same shared value the nav uses keeps the two glued together frame-for-
  // frame, and the nav's withTiming tween carries the buttons along.
  const FLOATING_NAV_CLEARANCE = 88;
  const floatingActionsAnimatedStyle = useAnimatedStyle(() => {
    const navHidden = Math.min(
      1,
      Math.max(0, (navTranslateY?.value ?? 0) / NAV_HIDE_OFFSET),
    );
    return {
      transform: [{ translateY: -FLOATING_NAV_CLEARANCE * (1 - navHidden) }],
    };
  });

  // Reset both chrome shared values whenever HomeView unmounts (user
  // switches tab away from Home) so the bar AND header are visible on
  // the next screen, even if HomeView happened to leave them hidden.
  useEffect(() => {
    return () => {
      if (navTranslateY) navTranslateY.value = 0;
      if (headerTranslateY) headerTranslateY.value = 0;
    };
  }, [navTranslateY, headerTranslateY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Hinge-style page layout: sticky header at top, full-bleed
            scrollable profile in the middle, sticky action bar at the
            bottom. The old page-wide ScrollView wrapped EVERYTHING
            (header + card + nav) which forced the action buttons to
            scroll with the content. That metaphor's gone — the bar is
            now persistent so swipe decisions are always one tap away,
            no matter where you are in a long profile. */}
        <View style={styles.pageContainer}>
          {/* Sticky header — outside the scroll so the progress and
              role-switcher never leave the viewport. */}
          <Animated.View
            entering={FadeInDown}
            onLayout={(e) => {
              // Re-capture natural height whenever the header isn't mid-
              // hide animation. Capturing only once was wrong: the first
              // onLayout fires before sponsoredJobs loads (no role pill),
              // so the captured height was too small and the pill got
              // clipped by overflow:"hidden" once it mounted.
              if ((headerTranslateY?.value ?? 0) === 0) {
                headerHeight.value = e.nativeEvent.layout.height;
              }
            }}
            style={[styles.headerRow, headerAnimatedStyle]}
          >
            {/* Progress indicator — dims + shows "–/10" when the deck
                isn't active (empty/error/loading states). */}
            <View
              style={[
                styles.progressHeaderContainer,
                !deckIsActive && { opacity: 0.3 },
              ]}
            >
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressCurrent}>
                  {deckIsActive ? Math.min(progress, DECK_SIZE) : 0}
                </Text>
                <Text style={styles.progressTotal}>/{DECK_SIZE}</Text>
              </View>
              <View style={styles.progressDotsRow}>
                {Array.from({ length: DECK_SIZE }).map((_, i) => {
                  const cardNumber = i + 1;
                  const isPast = cardNumber < progress;
                  const isCurrent = cardNumber === progress;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        (isPast || isCurrent) && styles.progressDotFilled,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
            {/* Role switcher — sponsor-only. Hidden when the sponsor has
                no sponsored jobs (deck shows the empty state). Always
                tappable so the sponsor can change roles whenever, even
                with just one job currently sponsored.
                Redesigned as a high-contrast black pill (matches the
                primary CTA language elsewhere in the app). Shows a
                pending-applicants count badge inline when the active
                role has unactioned interest, so the most important
                signal lives right in the header. */}
            {userType === "sponsor" && sponsoredJobs.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowJobSwitcher(true)}
                activeOpacity={0.85}
                style={styles.roleSwitcherPill}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={styles.roleSwitcherTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeSponsoredJob?.title || "Pick a role"}
                </Text>
                {!!activeSponsoredJob?.likesCount &&
                  activeSponsoredJob.likesCount > 0 && (
                    <View style={styles.roleSwitcherBadge}>
                      <Text style={styles.roleSwitcherBadgeText}>
                        {activeSponsoredJob.likesCount > 99
                          ? "99+"
                          : activeSponsoredJob.likesCount}
                      </Text>
                    </View>
                  )}
                <ChevronDown color="#555" size={14} strokeWidth={2.5} />
              </TouchableOpacity>
            )}

            {/* Replay the first-run "how it works" intro. */}
            <TouchableOpacity
              style={styles.introHelpBtn}
              onPress={handleReplayIntro}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Info color="#999" size={16} strokeWidth={2.4} />
            </TouchableOpacity>
          </Animated.View>

          {/* "Sponsors are interested in you" teaser — reads the same
              React Query cache MatchesView populates; renders nothing for
              sponsors or when nobody's interested. Shown on every deck
              state (including deck-done) since it's actionable whenever
              it's true. */}
          <YourMoveStrip
            userType={userType}
            onPress={() =>
              router.push(`/dashboard?mode=${userType}&tab=matches`)
            }
          />

          {isDeckFinished ? (
            <View style={styles.fullEmptyContainer}>
              <DeckDoneCard
                userType={userType}
                deckSize={DECK_SIZE}
                sessionLikes={sessionLikes}
                sessionMatches={sessionMatches}
                isPremium={isPremium}
                onUnlockMore={handleUnlockMoreCards}
                onReviewAgain={resetNavigation}
                onViewMatches={() =>
                  router.push(`/dashboard?mode=${userType}&tab=matches`)
                }
              />
            </View>
          ) : userType === "sponsor" && sponsoredJobs.length === 0 ? (
            /* "Start Your Journey" — sponsor has no sponsored jobs yet.
               Redesigned: instead of a flat icon-circle, render a
               stacked-deck illustration that visually represents "your
               applicant deck is empty, waiting to be filled". Clean
               monochrome, generous spacing, single primary CTA. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.emptyDeckIllustration}>
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardBack]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardMid]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardFront]}
                  >
                    <Briefcase color="#000" size={28} strokeWidth={1.8} />
                  </View>
                </View>

                <Text style={styles.sponsorEmptyTitle}>Build your deck</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  Sponsor a role to start seeing applicants matched to it. Pick
                  one from the ATS feed or post your own.
                </Text>

                <TouchableOpacity
                  style={styles.sponsorEmptyPrimary}
                  onPress={() => {
                    router.push("/dashboard?mode=sponsor&tab=jobs");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sponsorEmptyPrimaryText}>
                    Browse Jobs
                  </Text>
                  <ChevronRight color="#FFF" size={18} strokeWidth={2.5} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : hasNoApplicants ? (
            /* "No Applicants Yet" — sponsor has a sponsored role but no
               one's shown interest yet. Redesigned to feel less "empty"
               and more "in flight": a pulsing LIVE indicator at the
               top, a preview card of the role itself (so the user
               knows exactly which sponsored job they're waiting on),
               and momentum-positive copy. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.livePill}>
                  <Animated.View style={[styles.liveDot, livePulseStyle]} />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>

                {activeSponsoredJob && (
                  <View style={styles.sponsorWaitingJobCard}>
                    <CompanyLogo
                      logoUrl={undefined}
                      name={activeSponsoredJob.company}
                      size={48}
                      borderRadius={24}
                      initialFontSize={20}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={styles.sponsorWaitingJobTitle}
                        numberOfLines={1}
                      >
                        {activeSponsoredJob.title || "Untitled role"}
                      </Text>
                      {!!activeSponsoredJob.company && (
                        <Text
                          style={styles.sponsorWaitingJobCompany}
                          numberOfLines={1}
                        >
                          {activeSponsoredJob.company}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <Text style={styles.sponsorEmptyTitle}>Out in the wild</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  Your role is in front of candidates. New applicants surface
                  here the moment they show interest — usually within a day of
                  going live.
                </Text>

                <View style={styles.sponsorEmptyActions}>
                  <TouchableOpacity
                    style={styles.sponsorEmptySecondary}
                    onPress={() => {
                      // Reset both the list and the job-id tag so the
                      // empty-state check goes through the loading
                      // branch while the retry is in flight.
                      setProfiles([]);
                      setProfilesJobId(null);
                      setProfilesError(null);
                      const loadData = async () => {
                        if (activeSponsoredJobId) {
                          const fetchingForJobId = activeSponsoredJobId;
                          try {
                            setProfilesLoading(true);
                            const response =
                              await fetchProfilesPack(fetchingForJobId);
                            setProfiles(
                              transformProfilePackRows(response.profiles),
                            );
                            setProfilesJobId(fetchingForJobId);
                          } catch (err) {
                            console.warn(
                              "[HomeView] Failed to fetch profiles:",
                              err,
                            );
                            setProfilesError(
                              err instanceof Error
                                ? err.message
                                : "Failed to fetch profiles",
                            );
                          } finally {
                            setProfilesLoading(false);
                          }
                        }
                      };
                      loadData();
                    }}
                    activeOpacity={0.85}
                  >
                    <RefreshCcw color="#000" size={16} strokeWidth={2.2} />
                    <Text style={styles.sponsorEmptySecondaryText}>
                      Refresh
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sponsorEmptyPrimary}
                    onPress={() => {
                      router.push("/dashboard?mode=sponsor&tab=jobs");
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.sponsorEmptyPrimaryText}>
                      Sponsor Another
                    </Text>
                    <ChevronRight color="#FFF" size={18} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : userType === "sponsor" &&
            profilesError &&
            profiles.length === 0 ? (
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color="#000" size={32} />
                </View>
                <Text style={styles.emptyTitle}>Couldn't Load Profiles</Text>
                <Text style={styles.emptySub}>
                  We hit a snag fetching applicants for this role.
                  {"\n\n"}
                  {profilesError}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    // Re-trigger the load effect by clearing the
                    // tagged jobId. Setting profilesJobId to null
                    // and clearing the error nudges the dependency
                    // chain so the user gets a fresh attempt.
                    setProfilesError(null);
                    setProfilesJobId(null);
                    const id = activeSponsoredJobId;
                    if (id) {
                      (async () => {
                        try {
                          setProfilesLoading(true);
                          const response = await fetchProfilesPack(id);
                          setProfiles(
                            transformProfilePackRows(response.profiles),
                          );
                          setProfilesJobId(id);
                        } catch (err) {
                          setProfilesError(
                            err instanceof Error
                              ? err.message
                              : "Failed to fetch profiles",
                          );
                        } finally {
                          setProfilesLoading(false);
                        }
                      })();
                    }
                  }}
                >
                  <RefreshCcw color="#FFF" size={18} />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : userType === "applicant" && jobsError && jobs.length === 0 ? (
            /* Applicant error state — fetch threw or returned an error.
               Mirrors the sponsor error state visually (icon circle +
               RefreshCcw + Try Again) so the design language is
               consistent regardless of which side of the market you're on. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color="#000" size={32} />
                </View>
                <Text style={styles.emptyTitle}>Couldn't Load Roles</Text>
                <Text style={styles.emptySub}>
                  Something went wrong fetching your deck. Check your connection
                  and try again.
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    (async () => {
                      try {
                        setJobsLoading(true);
                        setJobsError(null);
                        const apiJobs = await fetchJobsPack();
                        const transformedJobs = apiJobs.map(
                          (job: JobApiResponse) => transformJobApiResponse(job),
                        );
                        setJobs(transformedJobs);
                        resetNavigation();
                      } catch (err) {
                        setJobsError(
                          err instanceof Error
                            ? err.message
                            : "Failed to fetch jobs",
                        );
                      } finally {
                        setJobsLoading(false);
                      }
                    })();
                  }}
                >
                  <RefreshCcw color="#FFF" size={18} />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : userType === "applicant" && !jobsLoading && jobs.length === 0 ? (
            /* Applicant no-jobs state — fetch completed successfully but
               the API returned an empty deck. Uses the same stacked-deck
               illustration as the sponsor "Build your deck" state to keep
               visual language consistent; copy is applicant-appropriate. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.emptyDeckIllustration}>
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardBack]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardMid]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardFront]}
                  >
                    <Briefcase color="#000" size={28} strokeWidth={1.8} />
                  </View>
                </View>

                <Text style={styles.sponsorEmptyTitle}>You're early</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  We're filling the deck with roles matched to your profile.
                  Check back tomorrow for a fresh batch.
                </Text>

                <View style={styles.sponsorEmptyActions}>
                  <TouchableOpacity
                    style={styles.sponsorEmptySecondary}
                    onPress={() => {
                      (async () => {
                        try {
                          setJobsLoading(true);
                          const apiJobs = await fetchJobsPack();
                          const transformedJobs = apiJobs.map(
                            (job: JobApiResponse) =>
                              transformJobApiResponse(job),
                          );
                          setJobs(transformedJobs);
                          resetNavigation();
                        } catch (err) {
                          setJobsError(
                            err instanceof Error
                              ? err.message
                              : "Failed to fetch jobs",
                          );
                        } finally {
                          setJobsLoading(false);
                        }
                      })();
                    }}
                    activeOpacity={0.85}
                  >
                    <RefreshCcw color="#000" size={16} strokeWidth={2.2} />
                    <Text style={styles.sponsorEmptySecondaryText}>
                      Refresh
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : isLoading || !currentData ? (
            <View style={styles.fullEmptyContainer}>
              <SkeletonCard />
            </View>
          ) : (
            <>
              {/* Wraps the scrollable card AND whatever sits on top of it
                  (the floating Pass/Connect buttons, or — when the card is
                  one we've already liked, most commonly because "Review
                  again" replayed the deck — the "already seen" overlay
                  below). Giving this its own flex:1 box means an
                  absoluteFillObject overlay covers exactly the card area,
                  not the header above it. */}
              <View style={styles.cardStage}>
                {/* Hinge-style: one big vertically-scrolling profile with a
                    cross-fade transition between deck entries. The card
                    metaphor — front face / back face / flip / "show more"
                    toggle — is gone. Everything that used to be split across
                    those surfaces now lives inline below the hero, so the
                    user scrolls through one continuous, well-paced read. */}
                <Animated.View
                  style={[styles.profileFader, mainAnimatedStyle]}
                  // Already-seen cards are look-but-don't-touch — the
                  // overlay's Continue button is the only way forward, so
                  // scrolling/tapping into the dimmed content underneath is
                  // disabled rather than just visually suggested.
                  pointerEvents={isAlreadyLiked ? "none" : "auto"}
                >
                <Animated.ScrollView
                  ref={scrollRef as any}
                  contentContainerStyle={styles.profileScrollContent}
                  showsVerticalScrollIndicator={false}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                >
                  {userType === "sponsor" ? (
                    /* ────────────────────────────────────────────────────
                       SPONSOR VIEW — applicant profile, vertical scroll
                       ──────────────────────────────────────────────────── */
                    <>
                      {/* "Liked your role" badge (PR #56) — high-conviction
                          interest, anchored at the top before the hero so
                          it's the first thing the sponsor sees. */}
                      {(currentData as any).HAS_LIKED_JOB === true && (
                        <View style={styles.likedYourRoleRow}>
                          <View style={styles.likedYourRolePill}>
                            <Heart
                              size={11}
                              color="#FFF"
                              fill="#FFF"
                              strokeWidth={2}
                            />
                            <Text style={styles.likedYourRolePillText}>
                              LIKED YOUR ROLE
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* HERO — applicant identity */}
                      <View style={styles.hingeHero}>
                        {"image" in currentData && currentData.image ? (
                          <Image
                            source={{ uri: currentData.image as string }}
                            style={styles.hingeHeroAvatar}
                          />
                        ) : (
                          <View style={styles.hingeHeroAvatarFallback}>
                            <Text style={styles.hingeHeroAvatarInitial}>
                              {("name" in currentData
                                ? currentData.name || "?"
                                : "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.hingeHeroName} numberOfLines={2}>
                          {"name" in currentData ? currentData.name : ""}
                        </Text>
                        {"desiredRole" in currentData &&
                          !!currentData.desiredRole && (
                            <Text
                              style={styles.hingeHeroSubtitle}
                              numberOfLines={2}
                            >
                              {currentData.desiredRole}
                            </Text>
                          )}
                        <View style={styles.hingeHeroPillRow}>
                          {"company" in currentData &&
                            !!currentData.company && (
                              <View style={styles.heroPill}>
                                <Briefcase color="#666" size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.company}
                                </Text>
                              </View>
                            )}
                          {"location" in currentData &&
                            !!currentData.location && (
                              <View style={styles.heroPill}>
                                <MapPin color="#666" size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.location}
                                </Text>
                              </View>
                            )}
                        </View>
                      </View>

                      <View style={styles.hingeDivider} />

                      {/* ABOUT — full bio, no clamp */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cachedBio =
                          uid && fullProfileCache[String(uid)]?.bio;
                        const bio: string =
                          cachedBio ||
                          ("bio" in currentData ? currentData.bio : "") ||
                          "";
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>ABOUT</Text>
                            <Text style={styles.hingeBodyText}>
                              {bio.trim().length > 0
                                ? bio
                                : "No bio added yet."}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* INSIGHTS — Q&A cards, full text */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const inlinePrompts =
                          "prompts" in currentData
                            ? (currentData as any).prompts
                            : null;
                        const prompts: any[] =
                          cached?.prompts && cached.prompts.length > 0
                            ? cached.prompts
                            : Array.isArray(inlinePrompts)
                              ? inlinePrompts
                              : [];
                        if (prompts.length === 0 && fullProfileLoading) {
                          return (
                            <View style={styles.hingeSection}>
                              <Text style={styles.hingeSectionLabel}>
                                INSIGHTS
                              </Text>
                              <View
                                style={{
                                  alignItems: "flex-start",
                                  paddingVertical: 4,
                                }}
                              >
                                <ActivityIndicator color="#999" />
                              </View>
                            </View>
                          );
                        }
                        if (prompts.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              INSIGHTS
                            </Text>
                            {prompts.map((prompt: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeInsightCard,
                                  idx > 0 && { marginTop: 14 },
                                ]}
                              >
                                {/* Vertical black accent stripe — pulls
                                    the eye to the content without
                                    introducing color into the monochrome
                                    palette. */}
                                <View style={styles.hingeInsightAccent} />
                                <View style={styles.hingeInsightBody}>
                                  {!!prompt.question && (
                                    <Text style={styles.hingeInsightQuestion}>
                                      {prompt.question}
                                    </Text>
                                  )}
                                  {/* Decorative opening quote — large
                                      serif-style mark sits flush with
                                      the answer's first line, giving
                                      the card its "in their own words"
                                      gravitas. */}
                                  <View style={styles.hingeInsightAnswerRow}>
                                    <Text style={styles.hingeInsightQuoteMark}>
                                      “
                                    </Text>
                                    <Text style={styles.hingeInsightAnswer}>
                                      {prompt.answer}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* TOP SKILLS — chips */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const fromCache = Array.isArray((cached as any)?.skills)
                          ? ((cached as any).skills as string[])
                          : [];
                        const fromCard =
                          "skills" in currentData &&
                          Array.isArray((currentData as any).skills)
                            ? ((currentData as any).skills as string[])
                            : [];
                        const skills =
                          fromCache.length > 0 ? fromCache : fromCard;
                        if (skills.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              TOP SKILLS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {skills.map((skill: string, idx: number) => (
                                <View key={idx} style={styles.hingeSkillChip}>
                                  <Text style={styles.hingeSkillChipText}>
                                    {skill}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* EXPERIENCE — timeline */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const experiences: any[] = Array.isArray(
                          cached?.experiences,
                        )
                          ? cached!.experiences
                          : [];
                        if (experiences.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              EXPERIENCE
                            </Text>
                            {experiences.map((exp: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeTimelineRow,
                                  idx > 0 && { marginTop: 18 },
                                ]}
                              >
                                <View style={styles.hingeTimelineDot} />
                                <View style={styles.hingeTimelineBody}>
                                  <Text style={styles.hingeTimelineTitle}>
                                    {exp.jobTitle}
                                  </Text>
                                  <Text style={styles.hingeTimelineSubtitle}>
                                    {exp.company}
                                  </Text>
                                  <Text style={styles.hingeTimelineMeta}>
                                    {exp.startDate}
                                    {exp.current
                                      ? " — Present"
                                      : exp.endDate
                                        ? ` — ${exp.endDate}`
                                        : ""}
                                  </Text>
                                  {!!exp.description && (
                                    <Text
                                      style={styles.hingeTimelineDescription}
                                    >
                                      {exp.description}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* EDUCATION — timeline */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const education: any[] = Array.isArray(
                          cached?.education,
                        )
                          ? cached!.education
                          : [];
                        if (education.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              EDUCATION
                            </Text>
                            {education.map((edu: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeTimelineRow,
                                  idx > 0 && { marginTop: 18 },
                                ]}
                              >
                                <View style={styles.hingeTimelineDot} />
                                <View style={styles.hingeTimelineBody}>
                                  <Text style={styles.hingeTimelineTitle}>
                                    {edu.degree}
                                    {edu.major ? ` in ${edu.major}` : ""}
                                  </Text>
                                  <Text style={styles.hingeTimelineSubtitle}>
                                    {edu.university}
                                  </Text>
                                  <Text style={styles.hingeTimelineMeta}>
                                    {[
                                      edu.graduationYear &&
                                        `Class of ${edu.graduationYear}`,
                                      edu.gpa && `GPA ${edu.gpa}`,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* CERTIFICATIONS — credential blocks */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const certs: any[] = Array.isArray(
                          cached?.certifications,
                        )
                          ? cached!.certifications
                          : [];
                        if (certs.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              CERTIFICATIONS
                            </Text>
                            <View style={styles.hingeCredentialList}>
                              {certs.map((cert: any, idx: number) => (
                                <View
                                  key={idx}
                                  style={styles.hingeCredentialBlock}
                                >
                                  <Text style={styles.hingeCredentialName}>
                                    {cert.name}
                                  </Text>
                                  <Text style={styles.hingeCredentialMeta}>
                                    {cert.organization}
                                    {cert.year ? ` · ${cert.year}` : ""}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* LANGUAGES — credential blocks */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const langs: any[] = Array.isArray(cached?.languages)
                          ? cached!.languages
                          : [];
                        if (langs.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              LANGUAGES
                            </Text>
                            <View style={styles.hingeCredentialList}>
                              {langs.map((lang: any, idx: number) => (
                                <View
                                  key={idx}
                                  style={styles.hingeCredentialBlock}
                                >
                                  <Text style={styles.hingeCredentialName}>
                                    {lang.language}
                                  </Text>
                                  <Text style={styles.hingeCredentialMeta}>
                                    {lang.proficiency}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* ACHIEVEMENTS */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const ach: string = cached?.achievements || "";
                        if (!ach) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ACHIEVEMENTS
                            </Text>
                            <Text style={styles.hingeBodyText}>{ach}</Text>
                          </View>
                        );
                      })()}
                    </>
                  ) : (
                    /* ────────────────────────────────────────────────────
                       APPLICANT VIEW — job, vertical scroll
                       ──────────────────────────────────────────────────── */
                    <>
                      {/* Status banner at the top — waitlisted /
                          sponsor-requested / applied. Replaces the old
                          "overlay" that floated above the card image. */}
                      {"id" in currentData &&
                        (waitlistedJobIds.has(String(currentData.id)) ||
                          requestedSponsorJobIds.has(String(currentData.id)) ||
                          appliedJobIds.has(String(currentData.id))) && (
                          <View style={styles.statusBannerRow}>
                            {waitlistedJobIds.has(String(currentData.id)) ? (
                              <View style={styles.statusBanner}>
                                <Check color="#FFF" size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Waitlisted
                                </Text>
                              </View>
                            ) : requestedSponsorJobIds.has(
                                String(currentData.id),
                              ) ? (
                              <View style={styles.statusBanner}>
                                <Check color="#FFF" size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Sponsor requested
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.statusBanner}>
                                <Check color="#FFF" size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Applied
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                      {/* HERO — company logo + role identity */}
                      <View style={styles.hingeHero}>
                        <CompanyLogo
                          logoUrl={
                            "image" in currentData
                              ? (currentData.image as string)
                              : undefined
                          }
                          name={
                            "company" in currentData
                              ? (currentData.company as string)
                              : ""
                          }
                          size={88}
                          borderRadius={44}
                          initialFontSize={32}
                        />
                        <Text style={styles.hingeHeroName} numberOfLines={3}>
                          {"title" in currentData ? currentData.title : ""}
                        </Text>
                        {"company" in currentData && !!currentData.company && (
                          <Text
                            style={styles.hingeHeroSubtitle}
                            numberOfLines={1}
                          >
                            {currentData.company}
                          </Text>
                        )}
                        {"isSponsored" in currentData && (
                          <View
                            style={
                              currentData.isSponsored
                                ? styles.heroStatusSponsored
                                : styles.heroStatusMuted
                            }
                          >
                            {currentData.isSponsored && (
                              <Check color="#FFF" size={10} strokeWidth={3} />
                            )}
                            <Text
                              style={
                                currentData.isSponsored
                                  ? styles.heroStatusSponsoredText
                                  : styles.heroStatusMutedText
                              }
                            >
                              {currentData.isSponsored
                                ? "Sponsored"
                                : "No sponsor yet"}
                            </Text>
                          </View>
                        )}
                        <View style={styles.hingeHeroPillRow}>
                          {"location" in currentData &&
                            !!currentData.location && (
                              <View style={styles.heroPill}>
                                <MapPin color="#666" size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.location}
                                </Text>
                              </View>
                            )}
                          {"salary" in currentData && !!currentData.salary && (
                            <View style={styles.heroPill}>
                              <DollarSign color="#666" size={11} />
                              <Text style={styles.heroPillText}>
                                {currentData.salary}
                              </Text>
                            </View>
                          )}
                          {"type" in currentData && !!currentData.type && (
                            <View style={styles.heroPill}>
                              <Briefcase color="#666" size={11} />
                              <Text style={styles.heroPillText}>
                                {currentData.type}
                              </Text>
                            </View>
                          )}
                          {(() => {
                            const percent =
                              "relevanceScore" in currentData
                                ? formatRelevancePercent(
                                    (currentData as any).relevanceScore,
                                  )
                                : null;
                            if (percent === null) return null;
                            return (
                              <View style={styles.heroPillAccent}>
                                <Zap size={10} color="#FFF" strokeWidth={2.5} />
                                <Text style={styles.heroPillAccentText}>
                                  {percent}% AI Match
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                      </View>

                      <View style={styles.hingeDivider} />

                      {/* ABOUT THE ROLE — full text, no clamp */}
                      {(() => {
                        const description =
                          "description" in currentData
                            ? currentData.description || ""
                            : "";
                        if (!description.trim()) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ABOUT THE ROLE
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {description}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* ROLE DETAILS — experience level + work arrangement chips */}
                      {(() => {
                        const expLvl =
                          "experienceLevel" in currentData
                            ? (currentData as any).experienceLevel
                            : "";
                        const workArr =
                          "workArrangement" in currentData
                            ? (currentData as any).workArrangement
                            : "";
                        if (!expLvl && !workArr) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ROLE DETAILS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {!!expLvl && (
                                <View style={styles.roleDetailChip}>
                                  <Briefcase size={13} color="#000" />
                                  <Text style={styles.roleDetailChipText}>
                                    {(() => {
                                      const v = String(expLvl).trim();
                                      return /^[\d+\-\s]+$/.test(v)
                                        ? `${v} years experience`
                                        : v;
                                    })()}
                                  </Text>
                                </View>
                              )}
                              {!!workArr && (
                                <View style={styles.roleDetailChip}>
                                  <MapPin size={13} color="#000" />
                                  <Text style={styles.roleDetailChipText}>
                                    {workArr}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {/* CORE RESPONSIBILITIES */}
                      {"coreResponsibilities" in currentData &&
                        (currentData as any).coreResponsibilities && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              CORE RESPONSIBILITIES
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {(currentData as any).coreResponsibilities}
                            </Text>
                          </View>
                        )}

                      {/* REQUIREMENTS */}
                      {"requirementsSummary" in currentData &&
                        (currentData as any).requirementsSummary && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              REQUIREMENTS
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {(currentData as any).requirementsSummary}
                            </Text>
                          </View>
                        )}

                      {/* REQUIRED SKILLS — chips */}
                      {"skills" in currentData &&
                        currentData.skills &&
                        currentData.skills.length > 0 && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              REQUIRED SKILLS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {currentData.skills.map(
                                (skill: string, idx: number) => (
                                  <View key={idx} style={styles.hingeSkillChip}>
                                    <Text style={styles.hingeSkillChipText}>
                                      {skill}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          </View>
                        )}

                      {/* HIGHLIGHTS — benefits as a checked list */}
                      {"benefits" in currentData &&
                        currentData.benefits &&
                        currentData.benefits.length > 0 && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              HIGHLIGHTS
                            </Text>
                            <View style={styles.benefitsList}>
                              {currentData.benefits.map(
                                (benefit: string, idx: number) => (
                                  <View key={idx} style={styles.benefitRow}>
                                    <Check size={14} color="#000" />
                                    <Text style={styles.benefitText}>
                                      {benefit}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          </View>
                        )}

                      {/* NO SPONSOR YET — status block + company description */}
                      {"isSponsored" in currentData &&
                      currentData.isSponsored === false ? (
                        <>
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>STATUS</Text>
                            <View style={styles.noSponsorInlineBlock}>
                              <View style={styles.noSponsorIconCircle}>
                                <BellRing
                                  size={22}
                                  color="#000"
                                  strokeWidth={2}
                                />
                              </View>
                              <Text style={styles.noSponsorHeadline}>
                                No sponsor yet
                              </Text>
                              <Text style={styles.noSponsorSubtext}>
                                When someone at{" "}
                                {"company" in currentData && currentData.company
                                  ? currentData.company
                                  : "this company"}{" "}
                                signs on to sponsor this role, you'll be
                                notified instantly.
                              </Text>
                            </View>
                          </View>
                          {"companyDescription" in currentData &&
                            currentData.companyDescription && (
                              <View style={styles.hingeSection}>
                                <Text style={styles.hingeSectionLabel}>
                                  ABOUT THE COMPANY
                                </Text>
                                <Text style={styles.hingeBodyText}>
                                  {currentData.companyDescription}
                                </Text>
                              </View>
                            )}
                        </>
                      ) : (
                        /* MEET YOUR SPONSOR — identity, trust, words; plus
                           the role's inside-story insights below it. */
                        "sponsorInfo" in currentData &&
                        currentData.sponsorInfo &&
                        (() => {
                          const si = currentData.sponsorInfo;
                          const sid = si.userId ? String(si.userId) : "";
                          const sp = sid ? sponsorProfileCache[sid] : null;
                          const company =
                            "company" in currentData ? currentData.company : "";
                          const qa = (sp?.insights || []).filter(
                            (i) => i && i.question && i.answer,
                          );
                          const ins =
                            "backchannelInsights" in currentData &&
                            currentData.backchannelInsights
                              ? currentData.backchannelInsights
                              : null;
                          const jobInsights: {
                            label: string;
                            text: string;
                          }[] = [];
                          if (ins?.dayToDay)
                            jobInsights.push({
                              label: "DAY-TO-DAY",
                              text: ins.dayToDay,
                            });
                          if (ins?.teamCulture)
                            jobInsights.push({
                              label: "TEAM CULTURE",
                              text: ins.teamCulture,
                            });
                          if (ins?.idealCandidate)
                            jobInsights.push({
                              label: "WHO THRIVES HERE",
                              text: ins.idealCandidate,
                            });
                          if ((ins as any)?.insiderInsights)
                            jobInsights.push({
                              label: "EVERYTHING ELSE",
                              text: (ins as any).insiderInsights,
                            });
                          return (
                            <>
                              {/* ── SPONSOR ZONE CARD ───────────────── */}
                              <View style={styles.sponsorZoneOuter}>
                                <View style={styles.sponsorZoneCard}>
                                  <View style={styles.sponsorZoneBody}>
                                    {/* Subtle "SPONSORED BY" kicker */}
                                    <Text style={styles.sponsorZoneQALabel}>
                                      SPONSORED BY
                                    </Text>

                                    {/* Identity row */}
                                    <View
                                      style={[
                                        styles.sponsorMeetInline,
                                        { marginTop: 10 },
                                      ]}
                                    >
                                      {si.image ? (
                                        <Image
                                          source={{ uri: si.image }}
                                          style={styles.sponsorMeetAvatar}
                                        />
                                      ) : (
                                        <View
                                          style={
                                            styles.sponsorMeetAvatarFallback
                                          }
                                        >
                                          <Text
                                            style={
                                              styles.sponsorMeetAvatarInitial
                                            }
                                          >
                                            {(si.name || "?")[0].toUpperCase()}
                                          </Text>
                                        </View>
                                      )}
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                          style={styles.sponsorMeetName}
                                          numberOfLines={1}
                                        >
                                          {si.name}
                                        </Text>
                                        {!!(si.role || company) && (
                                          <Text
                                            style={styles.sponsorMeetRole}
                                            numberOfLines={1}
                                          >
                                            {si.role}
                                            {si.role && company ? " · " : ""}
                                            {company}
                                          </Text>
                                        )}
                                        {sp?.verified && (
                                          <View
                                            style={[
                                              styles.canReferTag,
                                              { marginTop: 6 },
                                            ]}
                                          >
                                            <Check
                                              size={10}
                                              color="#000"
                                              strokeWidth={3}
                                            />
                                            <Text
                                              style={styles.canReferTagText}
                                            >
                                              Verified employee
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>

                                    {/* Fact pills */}
                                    {(!!si.yearsAtCompany || si.canRefer) && (
                                      <View
                                        style={[
                                          styles.hingeChipsWrap,
                                          { marginTop: 12 },
                                        ]}
                                      >
                                        {!!si.yearsAtCompany && (
                                          <View style={styles.heroPill}>
                                            <Calendar color="#666" size={11} />
                                            <Text style={styles.heroPillText}>
                                              {si.yearsAtCompany} here
                                            </Text>
                                          </View>
                                        )}
                                        {si.canRefer && (
                                          <View style={styles.heroPill}>
                                            <Check
                                              color="#666"
                                              size={11}
                                              strokeWidth={3}
                                            />
                                            <Text style={styles.heroPillText}>
                                              Can refer directly
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    )}

                                    {/* Sponsor Q&A — matches the
                                        applicant-from-sponsor view's
                                        quote-style card so the
                                        sponsor's voice reads with the
                                        same "in their own words"
                                        treatment everywhere it appears
                                        in the app. */}
                                    {qa.length > 0 && (
                                      <>
                                        <View
                                          style={styles.sponsorZoneDivider}
                                        />
                                        <Text style={styles.sponsorZoneQALabel}>
                                          SPONSOR INSIGHTS
                                        </Text>
                                        {qa.map((item, i) => (
                                          <View
                                            key={item.question}
                                            style={[
                                              styles.hingeInsightCard,
                                              i > 0 && { marginTop: 12 },
                                            ]}
                                          >
                                            <View
                                              style={styles.hingeInsightAccent}
                                            />
                                            <View
                                              style={styles.hingeInsightBody}
                                            >
                                              <Text
                                                style={
                                                  styles.hingeInsightQuestion
                                                }
                                              >
                                                {item.question}
                                              </Text>
                                              <View
                                                style={
                                                  styles.hingeInsightAnswerRow
                                                }
                                              >
                                                <Text
                                                  style={
                                                    styles.hingeInsightQuoteMark
                                                  }
                                                >
                                                  “
                                                </Text>
                                                <Text
                                                  style={
                                                    styles.hingeInsightAnswer
                                                  }
                                                >
                                                  {item.answer}
                                                </Text>
                                              </View>
                                            </View>
                                          </View>
                                        ))}
                                      </>
                                    )}

                                    {/* Job insights — role-specific
                                        spec written BY the sponsor
                                        ABOUT the role. Uses a
                                        documented "header strip" card
                                        (dark label band on top, body
                                        below) so it reads as a formal
                                        role brief rather than a
                                        personal quote — distinct from
                                        the SPONSOR INSIGHTS cards
                                        right above it. */}
                                    {jobInsights.length > 0 && (
                                      <>
                                        <View
                                          style={styles.sponsorZoneDivider}
                                        />
                                        <Text
                                          style={styles.sponsorZoneJobLabel}
                                        >
                                          JOB INSIGHTS
                                        </Text>
                                        {jobInsights.map((it, idx) => (
                                          <View
                                            key={it.label}
                                            style={[
                                              styles.jobInsightCard,
                                              idx > 0 && { marginTop: 12 },
                                            ]}
                                          >
                                            <View
                                              style={styles.jobInsightHeader}
                                            >
                                              <Text
                                                style={
                                                  styles.jobInsightHeaderLabel
                                                }
                                              >
                                                {it.label}
                                              </Text>
                                            </View>
                                            <View style={styles.jobInsightBody}>
                                              <ExpandableText
                                                style={
                                                  styles.jobInsightBodyText
                                                }
                                                numberOfLines={6}
                                              >
                                                {it.text}
                                              </ExpandableText>
                                            </View>
                                          </View>
                                        ))}
                                      </>
                                    )}
                                  </View>
                                </View>
                              </View>
                            </>
                          );
                        })()
                      )}
                    </>
                  )}
                </Animated.ScrollView>
              </Animated.View>

              {isAlreadyLiked ? (
                /* "Already seen" overlay — replaces the floating Pass/
                   Connect buttons when the current card is one we've
                   already liked this session (almost always because
                   "Review again" replayed the deck from the top). The
                   dimmed card underneath is deliberately non-interactive
                   (see pointerEvents on profileFader above) so the only
                   way forward is a conscious tap on Continue — no
                   duplicate like call, no silent no-op that looks like a
                   bug. */
                <AlreadyLikedOverlay
                  userType={userType}
                  jobTitle={
                    "title" in currentData && currentData.title
                      ? String(currentData.title)
                      : undefined
                  }
                  company={
                    "company" in currentData && currentData.company
                      ? String(currentData.company)
                      : undefined
                  }
                  name={
                    "name" in currentData && (currentData as any).name
                      ? String((currentData as any).name)
                      : undefined
                  }
                  onContinue={() => nextProfile(true)}
                />
              ) : (
                /* Floating action buttons — Hinge-style. Two circular
                    buttons sit on top of the scroll content with no tray
                    background, drop-shadowed against whatever's behind
                    them. The wrapper uses pointerEvents="box-none" so taps
                    on empty space between the buttons fall through to the
                    scroll, while the buttons themselves still receive
                    touches. The scroll content has bottom padding that
                    matches the button stack so the last section isn't
                    hidden under them. */
                <Animated.View
                  style={[
                    styles.floatingActionsRow,
                    floatingActionsAnimatedStyle,
                  ]}
                  pointerEvents="box-none"
                >
                  <TouchableOpacity
                    onPress={() => handleSwipe(false)}
                    style={styles.floatingPassBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={
                      userType === "applicant" ? "Pass on this role" : "Pass"
                    }
                  >
                    <X color="#000" size={26} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSwipe(true)}
                    style={styles.floatingConnectBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={
                      userType === "applicant"
                        ? "Show interest in this role"
                        : "Connect with this applicant"
                    }
                  >
                    <Check color="#FFF" size={26} strokeWidth={2.8} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Celebration Message */}
      {showCelebration && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={80}
            style={StyleSheet.absoluteFill}
            tint="light"
          />
          <View style={styles.overlayCenter}>
            <Animated.View
              entering={ZoomIn.duration(400)}
              style={styles.celebrationCard}
            >
              <View style={styles.successCircle}>
                <Check color="#FFF" size={32} strokeWidth={3} />
              </View>
              <Text style={styles.celebrationTitle}>Interest Sent!</Text>
              <Text style={styles.celebrationSub}>
                {userType === "sponsor"
                  ? `You've shown interest in ${"name" in currentData ? currentData.name : "this applicant"} — we'll let you know if they connect back.`
                  : `You've shown interest in ${"title" in currentData ? currentData.title : "this role"} — we'll let you know if the sponsor connects.`}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      <MatchCelebrationModal
        matchedUser={matchedUser}
        userType={userType}
        onDismiss={handleMatchModalDismiss}
        onMessage={handleMatchModalMessage}
      />

      {/* Get-a-Sponsor Action Modal (For Non-Sponsored Jobs) */}
      <Modal visible={showApplyModal} animationType="none" transparent>
        <GetSponsorModal
          visible={showApplyModal}
          applyStep={applyStep}
          companyName={pendingJob?.company}
          isRequestingSponsor={isRequestingSponsor}
          onClose={() => setShowApplyModal(false)}
          onGetSponsor={handleGetSponsor}
          onDone={handleApplyModalDone}
        />
      </Modal>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        visible={showProfileCompletionModal}
        onClose={() => setShowProfileCompletionModal(false)}
        profileCompletion={profileCompletion}
        onGoToProfile={() => {
          setShowProfileCompletionModal(false);
          onNavigateToProfile?.();
        }}
        onTesterMode={() => {
          trackTesterModeEnabled({ source: "profile_completion_modal" });
          setIsTester(true);
          setShowProfileCompletionModal(false);
        }}
      />

      {/* Job Switcher Modal — sponsor picks which sponsored role the deck
          represents. Selection updates activeSponsoredJobId (re-fetches the
          profile pack relevant to that role) and resets the deck index so
          they start from card 1 of the new pack. */}
      <JobSwitcherSheet
        visible={showJobSwitcher}
        jobs={sponsoredJobs}
        activeJobId={activeSponsoredJobId}
        onSwitch={handleSwitchRole}
        onClose={() => setShowJobSwitcher(false)}
      />

      {/* Email Verification Modal — sponsors must verify work email before
          swiping. Soft gate: closing the modal just blocks swiping; the user
          can still navigate to other tabs (Profile etc.) to fix things. */}
      <Modal
        visible={showEmailVerificationModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowEmailVerificationModal(false)}
      >
        <WorkEmailVerificationModal
          visible={showEmailVerificationModal}
          onClose={() => setShowEmailVerificationModal(false)}
          onTesterBypass={() => {
            setIsTester(true);
            setShowEmailVerificationModal(false);
          }}
        />
      </Modal>

      {/* Description Modal */}
      <Modal
        visible={showDescriptionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDescriptionModal(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowDescriptionModal(false)}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </TouchableOpacity>

        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#FFF",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 40,
            maxHeight: "50%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {/* Drag Handle */}
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#D1D5DB",
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 28,
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Briefcase color="#000" size={20} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#000",
                    letterSpacing: -0.5,
                  }}
                >
                  About the Role
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#999",
                    marginTop: 2,
                  }}
                >
                  {currentData && "company" in currentData
                    ? currentData.company
                    : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowDescriptionModal(false)}
              style={{
                width: 36,
                height: 36,
                backgroundColor: "#F5F5F5",
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color="#666" size={18} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "#F0F0F0",
              marginHorizontal: 28,
              marginVertical: 20,
            }}
          />

          {/* Content */}
          <ScrollView
            style={{ maxHeight: "100%", paddingHorizontal: 28 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              style={{
                fontSize: 16,
                lineHeight: 26,
                color: "#444",
                fontWeight: "500",
                letterSpacing: -0.2,
              }}
            >
              {currentData && "description" in currentData
                ? currentData.description
                : ""}
            </Text>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Full Bio Modal */}
      <Modal
        visible={showFullBio}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullBio(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowFullBio(false)}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </TouchableOpacity>

        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#FFF",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 40,
            maxHeight: "75%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#D1D5DB",
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 28,
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Info color="#000" size={20} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#000",
                    letterSpacing: -0.5,
                  }}
                >
                  About
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#999",
                    marginTop: 2,
                  }}
                >
                  {currentData && "name" in currentData
                    ? (currentData as any).name
                    : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowFullBio(false)}
              style={{
                width: 36,
                height: 36,
                backgroundColor: "#F5F5F5",
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color="#666" size={18} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "#F0F0F0",
              marginHorizontal: 28,
              marginVertical: 20,
            }}
          />

          <ScrollView
            style={{ paddingHorizontal: 28 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              style={{
                fontSize: 16,
                lineHeight: 26,
                color: "#444",
                fontWeight: "500",
                letterSpacing: -0.2,
              }}
            >
              {(() => {
                if (!currentData) return "";
                const uid = (currentData as any)?.USER_ID;
                const cachedBio = uid && fullProfileCache[String(uid)]?.bio;
                if (cachedBio) return cachedBio;
                return "bio" in currentData ? currentData.bio : "";
              })()}
            </Text>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* First-run editorial intro — full-screen, one-time per role,
          replayable via the header "?". */}
      <HomeIntro
        visible={showIntro}
        userType={userType}
        onDone={handleIntroDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  // 2026-05-26 Hinge-style redesign — layout primitives.
  // `pageContainer` is the flex-column that holds the sticky header,
  // the active profile scroll, and the sticky bottom action bar.
  pageContainer: { flex: 1, paddingHorizontal: 24 },
  // Each non-active deck state (empty / loading / no-applicants etc.)
  // fills the page beneath the header with its centered illustration.
  fullEmptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  // Wraps the profile scroll + whatever floats on top of it (the normal
  // Pass/Connect buttons, or the "already liked" overlay). Its bounds are
  // exactly the card area below the header, so an absoluteFillObject
  // overlay inside it never bleeds over the header/progress bar.
  cardStage: { flex: 1 },
  // The fade/translate wrapper around the active profile scroll. Drives
  // the cross-fade between deck entries via `mainAnimatedStyle` — which
  // also folds in the "already liked" dimmed-opacity look (see the comment
  // on mainAnimatedStyle for why that can't be a separate plain style).
  profileFader: { flex: 1 },
  // Vertical scroll for the active profile. Bottom padding leaves room
  // for the sticky action bar so the last section isn't covered.
  profileScrollContent: { paddingBottom: 120, paddingTop: 4 },

  // ── "Already liked" overlay (Review-again replay guard) ────────────

  // ── Hero (applicant identity / job identity) ──────────────────────
  hingeHero: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  hingeHeroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F0F0F0",
  },
  hingeHeroAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  hingeHeroAvatarInitial: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFF",
  },
  hingeHeroName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.6,
    marginTop: 16,
    textAlign: "center",
  },
  hingeHeroSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  hingeHeroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },

  // ── "Liked your role" top-of-card pill ────────────────────────────
  likedYourRoleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },

  // ── Section primitives ────────────────────────────────────────────
  hingeDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 4,
  },
  hingeSection: { paddingVertical: 18 },
  hingeSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#999",
    marginBottom: 10,
  },
  hingeBodyText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    lineHeight: 23,
  },

  // ── At-a-glance stats strip (sponsor view) ────────────────────────

  // ── Insight Q&A cards — quote-style with vertical accent ──────────
  // White card with a soft drop shadow + thin hairline border for
  // depth (instead of the prior gray-on-gray look that disappeared
  // into the page). A 3px black stripe runs the full height of the
  // left edge as a brand accent — the only color is monochrome, but
  // the stripe gives the card a strong sense of authorship ("here are
  // the applicant's actual words"). A large opening quote mark next
  // to the answer plays the same role typographically.
  hingeInsightCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  hingeInsightAccent: {
    width: 3,
    backgroundColor: "#000",
  },
  hingeInsightBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  hingeInsightQuestion: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1.0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  hingeInsightAnswerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hingeInsightQuoteMark: {
    fontSize: 36,
    lineHeight: 30,
    fontWeight: "800",
    color: "#000",
    marginRight: 8,
    marginTop: -2,
  },
  hingeInsightAnswer: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
    lineHeight: 24,
  },

  // ── Job-brief cards (role-spec insights from the sponsor) ─────────
  // Same depth treatment as the sponsor's quote cards (white bg, soft
  // shadow, hairline border), but a totally different visual rhythm:
  // a dark "header strip" at the top carries the label, then body
  // text below. Reads as a formal documented brief rather than a
  // personal quote — distinct enough at a glance that the user knows
  // this is "what the sponsor wrote ABOUT the role" vs. "what the
  // sponsor said in their own words".
  jobInsightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  jobInsightHeader: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  jobInsightHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  jobInsightBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  jobInsightBodyText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1A1A1A",
    lineHeight: 23,
  },

  // ── Chip wrapping (skills, credentials, role details) ─────────────
  hingeChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hingeSkillChip: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  hingeSkillChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
  },

  // ── Timeline (experience, education) ──────────────────────────────
  hingeTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  hingeTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#000",
    marginTop: 7,
  },
  hingeTimelineBody: { flex: 1, minWidth: 0 },
  hingeTimelineTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  hingeTimelineSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 2,
  },
  hingeTimelineMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    marginTop: 3,
    letterSpacing: 0.1,
  },
  hingeTimelineDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    lineHeight: 21,
    marginTop: 8,
  },

  // ── Credential blocks (certifications, languages) ─────────────────
  hingeCredentialList: { gap: 12 },
  hingeCredentialBlock: {
    backgroundColor: "#F8F9FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  hingeCredentialName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  hingeCredentialMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777",
    marginTop: 3,
  },

  // ── Status banner (waitlisted / applied / sponsor-requested) ──────
  statusBannerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.4,
  },

  // ── "No sponsor yet" inline block (applicant view) ────────────────
  noSponsorInlineBlock: {
    alignItems: "center",
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  // ── Sponsor zone card (sponsored jobs — distinct section) ─────────
  sponsorZoneOuter: { paddingVertical: 18 },
  sponsorZoneCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  sponsorZoneBody: { padding: 16 },
  sponsorZoneDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginVertical: 16,
  },
  // "SPONSOR INSIGHTS" sub-label — light gray, personal voice
  sponsorZoneQALabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // "JOB INSIGHTS" sub-label — darker to signal role data vs personal
  sponsorZoneJobLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#444",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // ── Meet your sponsor inline block ────────────────────────────────
  sponsorMeetInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sponsorMeetAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F0F0",
  },
  sponsorMeetAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorMeetAvatarInitial: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFF",
  },
  sponsorMeetName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
  },
  sponsorMeetRole: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginTop: 2,
  },

  // ── Floating action buttons (Hinge-style) ────────────────────────
  // Two free-standing circular buttons that sit on top of the scroll
  // content. The row is absolute so it stays pinned to the bottom of
  // the page while the scroll content flows freely behind it.
  // `pointerEvents="box-none"` on this wrapper (set on the JSX) means
  // taps in the gap between buttons fall through to the underlying
  // scroll, while the circles themselves still catch their own taps.
  floatingActionsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 28 : 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  floatingPassBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // Drop shadow so the white circle reads against light content
    // underneath. Subtle to keep the brand minimal.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  floatingConnectBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 12,
  },
  introHelpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  progressHeaderContainer: { flex: 1 },
  // 2026-05-27 redesign — progress indicator typography + segmented dots.
  //
  // The label row stacks a large bold current-card number against a thin
  // gray "/N" suffix (e.g. "3" + "/10"), matching the modern app pattern
  // used by Hinge / Bumble / similar swipe-decks. Below it, a row of 10
  // equal-width pill segments (one per card in DECK_SIZE) lights up
  // as the user advances — past cards filled black, current card filled
  // black, future cards a soft gray. Reads as a "deck remaining" gauge
  // rather than a generic loading bar, which fits the rest of the
  // deck-of-cards branding language in the app.
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    marginBottom: 8,
  },
  progressCurrent: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  progressTotal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    letterSpacing: -0.1,
  },
  progressDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E8E8E8",
  },
  progressDotFilled: {
    backgroundColor: "#000",
  },

  // 2026-05-27 redesign — Role switcher pill (sponsor-only).
  //
  // Replaces the prior low-contrast outlined chip with a filled black
  // pill that reads as a primary affordance (same language as the
  // floating Connect button + sponsor empty-state CTAs). When the
  // active role has pending applicants, a compact white-on-darker
  // count badge appears inline — the most important signal lives
  // directly in the header. Long titles still truncate gracefully
  // because the title text wraps in a flex-shrink wrapper.
  roleSwitcherPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#D0D0D0",
    paddingVertical: 9,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 999,
    maxWidth: 200,
    gap: 8,
  },
  roleSwitcherTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -0.1,
  },
  roleSwitcherBadge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  roleSwitcherBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.2,
  },
  // Modal: bottom sheet, content-sized, listing all sponsored jobs.
  // Matches the matches-screen modal aesthetic (40px top radius, 28px
  // padding) for visual consistency with the other DismissibleSheets.
  // Subtle active state — black border (no fill) so the row reads as
  // "currently selected" without competing with content underneath.
  // Count badge — pending applicants for a sponsored role. Same shape
  // regardless of count so the eye finds the high numbers fast; zero
  // counts use the muted variant below.

  // Modal Styles

  // Waitlisted overlay
  // Layout: Image on Left + Details on Right

  // Name Header - Full Width Below Image Section

  // Content Section

  // ── Centered-profile card front face (redesign) ──
  // Circular avatar + centered identity + centered fact pills, with a
  // left-aligned ABOUT block below. Shared by the sponsor view (applicant
  // profile cards) and the applicant view (job cards).
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  // PR #56 — "Liked your role" badge at the top of a sponsor's profile-pack
  // card. Black accent pill so it visually anchors the high-conviction
  // signal above the neutral hero block.
  likedYourRolePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    backgroundColor: "#000",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  likedYourRolePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.8,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    letterSpacing: -0.1,
  },
  // Accent pill — used for the AI-match score. Black so it stands apart
  // from the neutral fact pills.
  heroPillAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroPillAccentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.1,
  },
  // Sponsorship status pill (job cards only).
  heroStatusSponsored: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
  },
  heroStatusSponsoredText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.2,
  },
  heroStatusMuted: {
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
  },
  heroStatusMutedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.2,
  },
  // "Meet your sponsor" back face — centered sponsor identity block.
  // The sponsor's own-words Q&A section beneath the trust strip.

  // Back Card Insights
  // Section header on the back of the card (JOB SPONSOR, INSIGHTS) —
  // matches the front card's "ABOUT" label (sectionLabelSmall) so the
  // two faces share one type system.

  // Legacy styles (keep for backward compatibility)

  // Company & Location Badges

  // Summary Content

  // Detail Sections (for back of card)
  // Flat block — no shadow. The expanded-details list reads as a clean
  // stack of bordered sections rather than a pile of floating cards.

  // Legacy styles (keep for backward compatibility)


  // Legacy styles (keep for backward compatibility with other parts)
  // Back-face content padding. Bottom is trimmed so the insights preview
  // (up to 4 subsections + the expand hint) fits the fixed card height.

  // New Experience Card Styles

  // Education Card Styles

  // Certifications Grid

  // Languages Grid

  // Achievements Text

  // Job Detail Card (for expanded job details)

  // Primary CTA — a gentle, diffuse lift rather than a hard drop shadow,
  // so it reads as "the main action" without clashing with the now-flat
  // detail sections.

  // BACK OF CARD (INSIGHTS)

  // Redesigned Prompt Cards

  // Redesigned applicant back-of-card




  // Insight (prompt) cards — quote-bar style

  // Experience timeline

  // Education (back-of-card)

  // Achievements (back-of-card)

  // Languages

  // Centered "chapter" header for the INSIGHTS block on the back of the
  // card — uppercase label flanked by hairline rules.
  // Expand affordance under the insights preview — mirrors the front
  // card's "Read more" so the down-chevron's purpose is discoverable.
  // Sub-label inside the INSIGHTS section (DAY-TO-DAY, TEAM CULTURE…) —
  // matches the app's small uppercase label convention.
  // Body copy — aligned to the app's standard body text (descriptionText /
  // ProfileDetailSheet body): 14px / 500 / #333. Was 16/600/#000, which
  // ran heavier and larger than the rest of the app.

  // PROMPTS (Legacy)

  overlayCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    zIndex: 10000,
  },
  celebrationCard: {
    width: "100%",
    backgroundColor: "#FFF",
    padding: 40,
    borderRadius: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 15,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  celebrationTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  celebrationSub: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  emptySub: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },

  // ── End-of-deck "You're all caught up" state ───────────────────────────────
  // When premium hides the primary CTA, the "Review again" button is the only
  // action — drop the top margin that otherwise spaces it under the primary.
  primaryBtn: {
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    flex: 1,
  },
  primaryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Sponsor empty states (modern redesign) ────────────────────────
  // Container is similar to `emptyState` but with more breathing room,
  // wider max content area, and styling primitives shared across both
  // sponsor empty states ("Build your deck" + "Out in the wild").
  sponsorEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    width: "100%",
    maxWidth: 380,
  },

  // Stacked-deck illustration — three nested rounded squares offset
  // like a deck of cards, the front one carrying an icon. Replaces
  // the generic gray icon circle for the "Build your deck" empty
  // state to visually evoke the missing roles.
  emptyDeckIllustration: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  emptyDeckCard: {
    width: 96,
    height: 116,
    borderRadius: 18,
    position: "absolute",
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  emptyDeckCardBack: {
    transform: [{ translateX: 18 }, { translateY: 10 }, { rotate: "8deg" }],
    opacity: 0.55,
  },
  emptyDeckCardMid: {
    transform: [{ translateX: -14 }, { translateY: 4 }, { rotate: "-5deg" }],
    opacity: 0.8,
  },
  emptyDeckCardFront: {
    backgroundColor: "#F4F4F5",
    borderColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero typography shared by both sponsor empty states.
  sponsorEmptyTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 10,
  },
  sponsorEmptySubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 26,
    paddingHorizontal: 8,
  },

  // Primary CTA — black pill with a trailing chevron, modeled after
  // the floating Connect button so the brand reads consistently.
  sponsorEmptyPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  sponsorEmptyPrimaryText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  // Secondary action — outlined, lower visual weight.
  sponsorEmptySecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  sponsorEmptySecondaryText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sponsorEmptyActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },

  // ── "LIVE" status pill (pulsing dot) ──────────────────────────────
  // Anchored above the "Out in the wild" state so the user reads
  // "your job is up and running" before "no applicants yet". The
  // dot animates between full opacity and 35% via `livePulseStyle`.
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#0F0F11",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFF",
  },
  livePillText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  // Compact preview of the active sponsored job, anchored under the
  // LIVE pill in the "Out in the wild" state so the sponsor sees
  // exactly which role is being shopped around.
  sponsorWaitingJobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sponsorWaitingJobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.2,
  },
  sponsorWaitingJobCompany: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginTop: 3,
  },

  // ── Referral Check-in Banner ───────────────────────────────────────────────
  canReferTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8FBEF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  canReferTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00CB54",
    letterSpacing: 0.2,
  },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, color: "#555", flex: 1 },

  // JOB CARD SPECIFIC STYLES

  // Non-Sponsored Back Design
  // Small centered kicker label at the top of the back faces.
  // Non-sponsored back — centered "no sponsor yet" status block.
  // About-the-company blurb beneath the no-sponsor status block.
  noSponsorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  noSponsorHeadline: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  noSponsorSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },

  // Relevance badge & requirements summary
  roleDetailChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  roleDetailChipText: {
    fontSize: 13,
    color: "#000",
    fontWeight: "500" as const,
  },
});
