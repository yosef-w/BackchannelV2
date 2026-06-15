import {
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
import {
  fetchJobsPack,
  fetchProfilesPack,
  getMyJobs,
  getPublicProfile,
  joinWaitlist,
  likeJob,
  likeProfile,
  recordJobFeedAction,
  recordProfileFeedAction,
  requestSponsorForJob,
} from "@/lib/api";
import { authApi } from "@/lib/auth-api";
import { transformJobApiResponse, type JobApiResponse } from "@/types/jobs";
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
  Mail,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import { ProfileCompletionModal } from "./ProfileCompletionModal";
import { CompanyLogo } from "./ui/CompanyLogo";
import { DismissibleSheet } from "./ui/DismissibleSheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
}

const DECK_SIZE = 10;

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
}: HomeViewProps) {
  const router = useRouter();
  const profileData = useUserProfileStore((state) => state.data);
  const workEmailVerified = useUserProfileStore(
    (state) => state.workEmailVerified,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const pendingWorkEmail = useUserProfileStore(
    (state) => state.pendingWorkEmail,
  );
  const setPendingWorkEmail = useUserProfileStore(
    (state) => state.setPendingWorkEmail,
  );
  const updatePersonalStore = useUserProfileStore(
    (state) => state.updatePersonal,
  );

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
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState("");
  // Inline-edit state for the work-email shown in the verification modal.
  // The backend's send endpoint embeds the supplied email into the JWT and
  // (on link click) persists it to sponsor_profiles.work_email along with
  // setting verified=TRUE — so one call corrects typos AND triggers
  // verification. The `pendingWorkEmail` value lives in useUserProfileStore
  // (AsyncStorage-persisted) so the latest address the user submitted
  // survives tab switches, app relaunches, and full profile re-fetches —
  // it's cleared only when the backend confirms verification of that same
  // address.
  const [isEditingWorkEmail, setIsEditingWorkEmail] = useState(false);
  const [editedWorkEmail, setEditedWorkEmail] = useState("");
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

  // Drives the cross-fade between profiles. The old swipeX horizontal
  // translation + rotateY card-flip shared values were removed with the
  // card UI; only the opacity-driven fade survives the redesign.
  const swipeOpacity = useSharedValue(1);
  const matchRingScale = useSharedValue(0.8);
  const matchRingOpacity = useSharedValue(0);
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

  // Pulse-ring that radiates outward from both avatars when a mutual match fires
  useEffect(() => {
    if (matchedUser) {
      matchRingScale.value = 0.8;
      matchRingOpacity.value = 0;
      matchRingScale.value = withTiming(1.9, { duration: 750 });
      matchRingOpacity.value = withSequence(
        withTiming(0.28, { duration: 260 }),
        withTiming(0, { duration: 490 }),
      );
    }
  }, [matchedUser]);

  const matchRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: matchRingScale.value }],
    opacity: matchRingOpacity.value,
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

  console.log("[HomeView] Using data:", {
    userType,
    apiJobsCount: jobs.length,
    apiProfilesCount: profiles.length,
    usingApiJobs: jobs.length > 0,
    usingApiProfiles: profiles.length > 0,
    currentIndex: currentProfileIndex,
  });

  const currentData =
    userType === "sponsor"
      ? sponsorProfiles[currentProfileIndex % sponsorProfiles.length]
      : applicantJobs[currentProfileIndex % applicantJobs.length];
  const isDeckFinished = progress > DECK_SIZE;

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

        // Snapshot the id we're fetching for. If the user clicks a
        // different role before this resolves, we'll detect the
        // mismatch and discard the response so we don't overwrite
        // a fresher fetch with stale data.
        const fetchingForJobId = activeSponsoredJobId;
        try {
          console.log(
            "[HomeView] Fetching profiles for sponsored job:",
            fetchingForJobId,
          );
          setProfilesLoading(true);
          setProfilesError(null);
          const response = await fetchProfilesPack(fetchingForJobId);
          console.log(
            "[HomeView] Profile pack response:",
            JSON.stringify(response, null, 2),
          );
          console.log(
            "[HomeView] Fetched",
            response.profiles.length,
            "profiles from API",
          );
          console.log("[HomeView] First profile sample:", response.profiles[0]);

          // Transform API response to match UI expectations
          const transformedProfiles = response.profiles.map((profile: any) => {
            // Parse JSON strings
            const skills = profile.SKILLS ? JSON.parse(profile.SKILLS) : [];
            const positions = profile.POSITIONS
              ? JSON.parse(profile.POSITIONS)
              : [];

            // PR #39 (Opt C, 2026-05-05): the pack endpoint now includes
            // ap.INSIGHTS and up.BIO directly, so the back-of-card prompts +
            // the richer "About" text render on first paint. The lazy
            // `fetchFullProfileFor` call below still runs for the deeper
            // sections (experiences / education / certifications / languages
            // / achievements) which the pack does NOT include.
            const bio: string =
              profile.BIO || profile.REASON || "Looking for new opportunities";
            let prompts: any[] = [];
            if (profile.INSIGHTS) {
              try {
                const parsed = JSON.parse(profile.INSIGHTS);
                if (Array.isArray(parsed)) prompts = parsed;
              } catch {
                // Malformed JSON — fall through with empty prompts; the
                // lazy fetch will fill them in if it succeeds.
              }
            }

            return {
              ...profile, // Keep all original fields
              id: profile.USER_ID,
              name: `${profile.FIRST_NAME} ${profile.LAST_NAME}`.trim(),
              location: profile.LOCATION || "",
              skills: skills,
              desiredRole: positions[0] || "Open to opportunities",
              bio,
              prompts,
              image: profile.PHOTO_URL || "",
              company: "", // Applicants don't have company
            };
          });

          console.log(
            "[HomeView] Transformed first profile:",
            transformedProfiles[0],
          );
          setProfiles(transformedProfiles);
          // Mark which role this list represents so the empty-state
          // check can tell genuine "no applicants" apart from "still
          // loading after a role switch".
          setProfilesJobId(fetchingForJobId);
        } catch (err) {
          console.warn("[HomeView] Failed to fetch profiles:", err);
          setProfilesError(
            err instanceof Error ? err.message : "Failed to fetch profiles",
          );
          // profilesError drives the error state — deck stays empty
        } finally {
          setProfilesLoading(false);
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
    // Check profile completeness for applicants before any swipe action (unless they're a tester)
    if (
      userType === "applicant" &&
      profileCompletion.percentage < 90 &&
      !isTester
    ) {
      setShowProfileCompletionModal(true);
      return;
    }

    // Block sponsors from swiping until they've verified their work email
    if (userType === "sponsor" && !workEmailVerified && !isTester) {
      setEmailVerifyError("");
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

    if (isAccept) {
      // Call like API when accepting
      let didMatch = false;
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
        // Continue with UI update even if API fails
      }

      if (!didMatch) {
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
    // Scroll back to the top so the next profile starts at its hero, not
    // mid-bio. Snap (not animated) — the cross-fade hides the jump.
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    swipeOpacity.value = withTiming(0, { duration: 220 });

    setTimeout(() => {
      setProgress(progress + 1);
      setCurrentProfileIndex(currentProfileIndex + 1);
      swipeOpacity.value = withTiming(1, { duration: 280 });
    }, 220);
  };

  const handleMatchModalDismiss = () => {
    setMatchedUser(null);
    nextProfile(true);
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
    const [requestRes] = await Promise.allSettled([
      requestSponsorForJob(jobId),
      joinWaitlist(jobId),
    ]);
    trackSponsorRequested({ jobId });
    trackJobWaitlistJoined({ jobId });
    if (requestRes.status === "fulfilled") {
      // Backend's context-aware copy: count of sponsors, "already has a
      // sponsor", "no sponsors at this company yet", duplicate request, etc.
      setSponsorRequestMessage(requestRes.value.message ?? null);
    } else {
      console.warn("[HomeView] request-sponsor failed:", requestRes.reason);
    }
    setIsRequestingSponsor(false);
    setApplyStep("requested");
    // Track both client-side sets so the card overlay reflects either kind
    // of pending state — waitlisted badge OR sponsor-requested badge.
    setRequestedSponsorJobIds((prev) => new Set([...prev, jobId]));
    setWaitlistedJobIds((prev) => new Set([...prev, jobId]));
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
  const mainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: swipeOpacity.value,
    transform: [{ translateY: (1 - swipeOpacity.value) * 8 }],
  }));

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
          </Animated.View>

          {isDeckFinished ? (
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color="#000" size={32} />
                </View>
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptySub}>
                  You've reviewed your deck. Come back tomorrow for more.
                </Text>
                <TouchableOpacity
                  style={styles.returnBtn}
                  onPress={() => {
                    resetNavigation();
                  }}
                >
                  <Text style={styles.returnBtnText}>Refresh Deck</Text>
                </TouchableOpacity>
              </Animated.View>
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
                            setProfiles(response.profiles);
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
                          const transformed = (response.profiles || []).map(
                            (profile: any) => {
                              const skills = profile.SKILLS
                                ? JSON.parse(profile.SKILLS)
                                : [];
                              const positions = profile.POSITIONS
                                ? JSON.parse(profile.POSITIONS)
                                : [];
                              let prompts: any[] = [];
                              if (profile.INSIGHTS) {
                                try {
                                  const parsed = JSON.parse(profile.INSIGHTS);
                                  if (Array.isArray(parsed)) prompts = parsed;
                                } catch {}
                              }
                              return {
                                ...profile,
                                id: profile.USER_ID,
                                name: `${profile.FIRST_NAME} ${profile.LAST_NAME}`.trim(),
                                location: profile.LOCATION || "",
                                skills,
                                desiredRole:
                                  positions[0] || "Open to opportunities",
                                bio:
                                  profile.BIO ||
                                  profile.REASON ||
                                  "Looking for new opportunities",
                                prompts,
                                image: profile.PHOTO_URL || "",
                                company: "",
                              };
                            },
                          );
                          setProfiles(transformed);
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
              {/* Hinge-style: one big vertically-scrolling profile with a
                  cross-fade transition between deck entries. The card
                  metaphor — front face / back face / flip / "show more"
                  toggle — is gone. Everything that used to be split across
                  those surfaces now lives inline below the hero, so the
                  user scrolls through one continuous, well-paced read. */}
              <Animated.View style={[styles.profileFader, mainAnimatedStyle]}>
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
                          {"relevanceScore" in currentData &&
                            (currentData as any).relevanceScore > 0 && (
                              <View style={styles.heroPillAccent}>
                                <Zap size={10} color="#FFF" strokeWidth={2.5} />
                                <Text style={styles.heroPillAccentText}>
                                  {Math.round(
                                    (currentData as any).relevanceScore > 1
                                      ? (currentData as any).relevanceScore
                                      : (currentData as any).relevanceScore *
                                          100,
                                  )}
                                  % AI Match
                                </Text>
                              </View>
                            )}
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
                                              <Text
                                                style={
                                                  styles.jobInsightBodyText
                                                }
                                              >
                                                {it.text}
                                              </Text>
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

              {/* Floating action buttons — Hinge-style. Two circular
                  buttons sit on top of the scroll content with no tray
                  background, drop-shadowed against whatever's behind
                  them. The wrapper uses pointerEvents="box-none" so taps
                  on empty space between the buttons fall through to the
                  scroll, while the buttons themselves still receive
                  touches. The scroll content has bottom padding that
                  matches the button stack so the last section isn't
                  hidden under them. */}
              <Animated.View
                style={[styles.floatingActionsRow, floatingActionsAnimatedStyle]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  onPress={() => handleSwipe(false)}
                  style={styles.floatingPassBtn}
                  activeOpacity={0.85}
                >
                  <X color="#000" size={26} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSwipe(true)}
                  style={styles.floatingConnectBtn}
                  activeOpacity={0.85}
                >
                  <Check color="#FFF" size={26} strokeWidth={2.8} />
                </TouchableOpacity>
              </Animated.View>
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
              <Text style={styles.celebrationTitle}>
                {userType === "sponsor" ? "Request Sent!" : "Application Sent!"}
              </Text>
              <Text style={styles.celebrationSub}>
                {userType === "sponsor"
                  ? `You've connected with ${"name" in currentData ? currentData.name : ""}`
                  : `You've applied to ${"title" in currentData ? currentData.title : ""}`}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* ── Match Celebration Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!matchedUser}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <View style={styles.matchModalOverlay}>
            <Animated.View
              entering={ZoomIn.springify().damping(14).stiffness(180)}
              style={styles.matchCard}
            >
              {/* "IT'S A MATCH" pill label */}
              <Animated.View
                entering={FadeInDown.delay(150).duration(350)}
                style={styles.matchLabelPill}
              >
                <Text style={styles.matchLabelText}>IT’S A MATCH</Text>
              </Animated.View>

              {/* Avatar row */}
              <Animated.View
                entering={FadeInUp.delay(100).duration(400)}
                style={styles.matchAvatarRow}
              >
                {/* Current user's avatar */}
                <View style={styles.matchAvatarWrapper}>
                  <Animated.View
                    style={[styles.matchAvatarRing, matchRingStyle]}
                  />
                  {profileData?.personal?.profileImage ? (
                    <Image
                      source={{ uri: profileData.personal.profileImage }}
                      style={styles.matchAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.matchAvatar, styles.matchAvatarInitial]}
                    >
                      <Text style={styles.matchAvatarInitialText}>
                        {(profileData?.personal?.firstName ||
                          "Y")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Spark connector */}
                <View style={styles.matchSparkWrapper}>
                  <Sparkles size={18} color="#000" />
                </View>

                {/* Matched user's avatar */}
                <View style={styles.matchAvatarWrapper}>
                  <Animated.View
                    style={[styles.matchAvatarRing, matchRingStyle]}
                  />
                  {matchedUser?.image ? (
                    <Image
                      source={{ uri: matchedUser.image }}
                      style={styles.matchAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.matchAvatar, styles.matchAvatarInitial]}
                    >
                      <Text style={styles.matchAvatarInitialText}>
                        {(matchedUser?.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Title */}
              <Animated.View entering={FadeInUp.delay(300).duration(400)}>
                <Text style={styles.matchTitle}>It’s a Match!</Text>
              </Animated.View>

              {/* Subtitle */}
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                <Text style={styles.matchSubtitle}>
                  {userType === "applicant"
                    ? `You and ${
                        matchedUser?.name ?? "your sponsor"
                      } are both interested${
                        matchedUser?.jobTitle
                          ? ` in ${matchedUser.jobTitle}`
                          : ""
                      }`
                    : `You and ${
                        matchedUser?.name ?? "this applicant"
                      } are both interested in connecting`}
                </Text>
              </Animated.View>

              {/* Action buttons */}
              <Animated.View
                entering={FadeInUp.delay(500).duration(400)}
                style={styles.matchActions}
              >
                <TouchableOpacity
                  style={styles.matchMsgBtn}
                  onPress={handleMatchModalDismiss}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={18} color="#FFF" />
                  <Text style={styles.matchMsgBtnText}>Message Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.matchSkipBtn}
                  onPress={handleMatchModalDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={styles.matchSkipBtnText}>
                    Continue Exploring
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      {/* Get-a-Sponsor Action Modal (For Non-Sponsored Jobs) */}
      <Modal visible={showApplyModal} animationType="none" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowApplyModal(false)}
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
            style={styles.applyModalContent}
          >
            <View style={styles.modalHandle} />

            <View style={styles.applyModalHeader}>
              <Text style={styles.applyModalTitle}>
                {applyStep === "select" ? "Get a Sponsor" : "Request sent!"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowApplyModal(false)}
                style={styles.closeBtn}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            {applyStep === "select" && (
              <Text style={styles.applyModalSubtitle}>
                This role at {pendingJob?.company} doesn't have an active
                sponsor yet.
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {applyStep === "select" && (
                <View style={styles.modalOptionsContainer}>
                  {/* Single combined action — both "request a sponsor"
                      (notify employees at the company) AND "join waitlist"
                      (get notified when any sponsor signs on) fire in
                      parallel. They were redundant from the user's point of
                      view; one button, two backend writes. */}
                  <TouchableOpacity
                    style={[
                      styles.modalOptionBtn,
                      isRequestingSponsor && { opacity: 0.6 },
                    ]}
                    onPress={handleGetSponsor}
                    disabled={isRequestingSponsor}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOptionIcon}>
                      <BellRing color="#000" size={24} />
                    </View>
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionTitle}>Get a Sponsor</Text>
                      <Text style={styles.modalOptionDesc}>
                        We'll let employees at{" "}
                        {pendingJob?.company ?? "this company"} know and notify
                        you the moment someone signs on.
                      </Text>
                    </View>
                    {isRequestingSponsor ? (
                      <ActivityIndicator size="small" color="#999" />
                    ) : (
                      <ChevronRight color="#CCC" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {applyStep === "requested" && (
                <View style={styles.successContainer}>
                  <View style={styles.successCircleLarge}>
                    <Check color="#FFF" size={40} strokeWidth={3} />
                  </View>
                  <Text style={styles.successMessage}>
                    {`This role doesn't have a dedicated sponsor yet, but your request has been sent to everyone we have available at ${pendingJob?.company ?? "this company"}. If someone is able to sponsor you for this role, you'll be notified right away.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.successActionBtn}
                    onPress={handleApplyModalDone}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.successActionBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
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
      <Modal visible={showJobSwitcher} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.jobSwitcherOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowJobSwitcher(false)}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setShowJobSwitcher(false)}
            fullSheetGesture
            style={styles.jobSwitcherSheet}
          >
            <Text style={styles.jobSwitcherSheetTitle}>Switch role</Text>
            <Text style={styles.jobSwitcherSheetSubtitle}>
              Pick which sponsored role to review applicants for. We'll match
              them with that role when you swipe right.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ marginTop: 8 }}
            >
              {sponsoredJobs.map((job) => {
                const isActive = job.jobId === activeSponsoredJobId;
                const count = job.likesCount ?? 0;
                return (
                  <TouchableOpacity
                    key={job.jobId}
                    style={[
                      styles.jobSwitcherRow,
                      isActive && styles.jobSwitcherRowActive,
                    ]}
                    onPress={() => {
                      if (!isActive) {
                        setActiveSponsoredJobId(job.jobId);
                        // Fresh pack for the new role — start at card 1.
                        resetNavigation();
                      }
                      setShowJobSwitcher(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.jobSwitcherRowTitle}
                        numberOfLines={1}
                      >
                        {job.title || "Untitled role"}
                      </Text>
                      {!!job.company && (
                        <Text
                          style={styles.jobSwitcherRowCompany}
                          numberOfLines={1}
                        >
                          {job.company}
                        </Text>
                      )}
                    </View>
                    {/* Pending-applicant signal — same pill shape across
                        every row so the eye can scan high/low counts
                        easily. Active counts render as black-bg/white-fg
                        ("12"); zero is the same shape but muted gray ("0").
                        Visual rhythm beats descriptive copy here. */}
                    <View
                      style={[
                        styles.jobSwitcherCountBadge,
                        count === 0 && styles.jobSwitcherCountBadgeMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.jobSwitcherCountBadgeText,
                          count === 0 && styles.jobSwitcherCountBadgeTextMuted,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Verification Modal — sponsors must verify work email before
          swiping. Soft gate: closing the modal just blocks swiping; the user
          can still navigate to other tabs (Profile etc.) to fix things. */}
      <Modal
        visible={showEmailVerificationModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowEmailVerificationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.emailVerifOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              // Reset the inline edit state so the modal reopens fresh.
              setIsEditingWorkEmail(false);
              setEditedWorkEmail("");
              setEmailVerifyError("");
              setShowEmailVerificationModal(false);
            }}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => {
              setIsEditingWorkEmail(false);
              setEditedWorkEmail("");
              setEmailVerifyError("");
              setShowEmailVerificationModal(false);
            }}
            fullSheetGesture
            style={styles.emailVerifModal}
          >
            <View style={styles.emailVerifIconCircle}>
              <Mail color="#FFF" size={32} strokeWidth={1.5} />
            </View>

            <Text style={styles.emailVerifTitle}>Verify Your Work Email</Text>

            {(() => {
              const displayedEmail =
                pendingWorkEmail ?? profileData.personal.workEmail ?? "";
              if (isEditingWorkEmail) {
                return (
                  <View style={styles.emailVerifEditBlock}>
                    <Text style={styles.emailVerifEditLabel}>
                      Update your work email
                    </Text>
                    <TextInput
                      value={editedWorkEmail}
                      onChangeText={setEditedWorkEmail}
                      placeholder="name@company.com"
                      placeholderTextColor="#BBB"
                      style={styles.emailVerifEditInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    <View style={styles.emailVerifEditActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditingWorkEmail(false);
                          setEditedWorkEmail("");
                          setEmailVerifyError("");
                        }}
                        style={styles.emailVerifEditCancel}
                        activeOpacity={0.7}
                        disabled={emailVerifyLoading}
                      >
                        <Text style={styles.emailVerifEditCancelText}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          const trimmed = editedWorkEmail.trim();
                          if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
                            setEmailVerifyError(
                              "That doesn't look like a valid email.",
                            );
                            return;
                          }
                          setEmailVerifyLoading(true);
                          setEmailVerifyError("");
                          try {
                            // Two coordinated backend calls + a local mirror:
                            //   1. PATCH sponsor profile so the backend
                            //      persists work_email immediately and
                            //      auto-flips work_email_verified=FALSE
                            //      (services/profiles.py:162). Without this
                            //      the column doesn't update until the user
                            //      clicks the verification link.
                            //   2. Send the verification email — backend
                            //      embeds the email in a JWT; on link click
                            //      it re-saves and flips verified=TRUE.
                            // Run them in parallel since they're independent.
                            await Promise.all([
                              authApi.updateWorkEmail(trimmed),
                              authApi.sendWorkEmailVerification(trimmed),
                            ]);
                            await setPendingWorkEmail(trimmed);
                            // Mirror to data.personal.workEmail so ProfileView
                            // reflects the new address immediately without
                            // waiting for a full profile refetch.
                            await updatePersonalStore({ workEmail: trimmed });
                            setIsEditingWorkEmail(false);
                            setEditedWorkEmail("");
                            setEmailVerifyError(`Sent! Check ${trimmed}.`);
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : "Couldn't send.";
                            setEmailVerifyError(
                              msg.toLowerCase().includes("rate")
                                ? "Too many sends — please wait a bit and try again."
                                : "Couldn't send to that address. Please try again.",
                            );
                          } finally {
                            setEmailVerifyLoading(false);
                          }
                        }}
                        style={styles.emailVerifEditSave}
                        activeOpacity={0.8}
                        disabled={emailVerifyLoading}
                      >
                        {emailVerifyLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.emailVerifEditSaveText}>
                            Save & resend
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              return (
                <>
                  <Text style={styles.emailVerifSubtitle}>
                    To start discovering candidates, verify the link we sent to{" "}
                    <Text style={styles.emailVerifAddress}>
                      {displayedEmail || "your work address"}
                    </Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditedWorkEmail(displayedEmail);
                      setIsEditingWorkEmail(true);
                      setEmailVerifyError("");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emailVerifEditLink}>
                      Wrong email? Update it
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            <View style={styles.emailVerifInfoBox}>
              <Text style={styles.emailVerifInfoText}>
                This keeps the network trusted — every candidate knows they're
                talking to a real, verified professional.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.emailVerifPrimaryBtn}
              onPress={() => Linking.openURL("message:")}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifPrimaryBtnText}>
                Open Email App
              </Text>
              <ChevronRight color="#FFF" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailVerifSecondaryBtn}
              onPress={async () => {
                setEmailVerifyLoading(true);
                setEmailVerifyError("");
                try {
                  await fetchFromBackend();
                  const isNowVerified =
                    useUserProfileStore.getState().workEmailVerified;
                  if (isNowVerified) {
                    setShowEmailVerificationModal(false);
                  } else {
                    setEmailVerifyError(
                      "Still pending — please click the link in your inbox.",
                    );
                  }
                } catch {
                  setEmailVerifyError(
                    "Could not check status. Please try again.",
                  );
                } finally {
                  setEmailVerifyLoading(false);
                }
              }}
              disabled={emailVerifyLoading}
              activeOpacity={0.8}
            >
              {emailVerifyLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.emailVerifSecondaryBtnText}>
                  I've Verified My Email
                </Text>
              )}
            </TouchableOpacity>

            {emailVerifyError ? (
              <Text style={styles.emailVerifErrorText}>{emailVerifyError}</Text>
            ) : null}

            {/* Resend (PR #42) — re-trigger the verification email if the user
              never received it. Prefers the in-modal pendingWorkEmail (the
              corrected address from the "Update it" flow) over whatever's on
              file. Backend rate-limits to 5/hour per user. */}
            <TouchableOpacity
              style={styles.emailVerifTesterBtn}
              onPress={async () => {
                const workEmail =
                  pendingWorkEmail ?? profileData.personal.workEmail;
                if (!workEmail) {
                  setEmailVerifyError(
                    "We don't have a work email on file. Tap 'Update it' to add one.",
                  );
                  return;
                }
                setEmailVerifyError("");
                try {
                  await authApi.sendWorkEmailVerification(workEmail);
                  setEmailVerifyError("Sent! Check your inbox.");
                } catch (err) {
                  const msg =
                    err instanceof Error ? err.message : "Couldn't resend.";
                  setEmailVerifyError(
                    msg.toLowerCase().includes("rate")
                      ? "Too many resends — please wait a bit and try again."
                      : "Couldn't resend. Please try again.",
                  );
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifTesterBtnText}>Resend email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailVerifTesterBtn}
              onPress={() => {
                trackTesterModeEnabled({ source: "email_verification_modal" });
                setIsTester(true);
                setShowEmailVerificationModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifTesterBtnText}>I am a tester</Text>
            </TouchableOpacity>
          </DismissibleSheet>
        </KeyboardAvoidingView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 36, paddingBottom: 100 },
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
  // The fade/translate wrapper around the active profile scroll. Drives
  // the cross-fade between deck entries via `mainAnimatedStyle`.
  profileFader: { flex: 1 },
  // Vertical scroll for the active profile. Bottom padding leaves room
  // for the sticky action bar so the last section isn't covered.
  profileScrollContent: { paddingBottom: 120, paddingTop: 4 },

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
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
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
  hingeStatsRow: {
    flexDirection: "row",
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    paddingVertical: 14,
    marginVertical: 8,
  },
  hingeStatCell: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#E8E8E8",
  },
  hingeStatCellLast: { borderRightWidth: 0 },
  hingeStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  hingeStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: "uppercase",
  },

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
    borderColor: "#EAEAEA",
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
    borderColor: "#EAEAEA",
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
  sponsorZoneHeader: {
    backgroundColor: "#000",
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sponsorZoneHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1.6,
  },
  sponsorZoneBody: { padding: 16 },
  sponsorZoneDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginVertical: 16,
  },
  // "SPONSOR INSIGHTS" sub-label — light gray, personal voice
  sponsorZoneQALabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  // "JOB INSIGHTS" sub-label — darker to signal role data vs personal
  sponsorZoneJobLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#444",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  sponsorZoneQACard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 14,
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
  jobSwitcherOverlay: { flex: 1, justifyContent: "flex-end" },
  jobSwitcherSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    // Absolute px (not "70%") because the sheet sits inside
    // DismissibleSheet's GestureHandlerRootView wrapper, which is
    // content-sized. A % maxHeight against it would resolve to 0 / clip
    // content — same fix we applied to MatchesView's modalContent.
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  jobSwitcherSheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  jobSwitcherSheetSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  jobSwitcherRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    backgroundColor: "#FFF",
    marginBottom: 8,
  },
  // Subtle active state — black border (no fill) so the row reads as
  // "currently selected" without competing with content underneath.
  jobSwitcherRowActive: {
    borderColor: "#000",
    borderWidth: 2,
  },
  jobSwitcherRowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  jobSwitcherRowCompany: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginTop: 2,
  },
  // Count badge — pending applicants for a sponsored role. Same shape
  // regardless of count so the eye finds the high numbers fast; zero
  // counts use the muted variant below.
  jobSwitcherCountBadge: {
    backgroundColor: "#000",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  jobSwitcherCountBadgeMuted: {
    backgroundColor: "#F0F0F0",
  },
  jobSwitcherCountBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  jobSwitcherCountBadgeTextMuted: {
    color: "#999",
  },

  // Modal Styles
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  closeModalBtn: { padding: 4, backgroundColor: "#F5F5F5", borderRadius: 20 },
  modalContent: { padding: 28, paddingBottom: 40 },
  modalFooter: {
    padding: 28,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 16,
  },
  applyBtn: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  clearBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  clearBtnText: { color: "#000", fontSize: 14, fontWeight: "600" },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1.2,
  },
  cardContainer: { marginBottom: 24 },
  cardOuter: {
    borderRadius: 24,
    backgroundColor: "#FFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
      },
      android: { elevation: 18 },
    }),
  },
  cardOuterBack: { backgroundColor: "#FBFBFB" },
  cardInner: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    height: 460,
  },
  cardInnerBack: { backgroundColor: "#FBFBFB" },

  // Waitlisted overlay
  waitlistedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  waitlistedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  waitlistedBadgeText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  appliedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  appliedBadgeText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Layout: Image on Left + Details on Right
  profileCardTop: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileImageSquare: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  companyImageSquare: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  profileInfoColumn: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },

  // Name Header - Full Width Below Image Section
  profileNameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileNameTop: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  sponsorTag: {
    backgroundColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sponsorTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  sponsorTagMuted: {
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sponsorTagMutedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#999",
    letterSpacing: 0.3,
  },
  profileRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileRole: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    flex: 1,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  companyPill: {
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  companyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  profileLocation: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999",
  },
  profileExperience: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },

  // Content Section
  profileCardContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 16,
  },
  descriptionSection: {
    gap: 8,
  },
  sectionLabelSmall: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 21,
    fontWeight: "500",
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  readMoreBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.2,
  },

  // ── Centered-profile card front face (redesign) ──
  // Circular avatar + centered identity + centered fact pills, with a
  // left-aligned ABOUT block below. Shared by the sponsor view (applicant
  // profile cards) and the applicant view (job cards).
  heroCentered: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0F0F0",
  },
  heroAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarInitial: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFF",
  },
  heroName: {
    fontSize: 21,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 14,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    marginTop: 3,
  },
  heroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
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
  heroAboutBlock: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 8,
  },
  // "Meet your sponsor" back face — centered sponsor identity block.
  sponsorMeetHero: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },
  // The sponsor's own-words Q&A section beneath the trust strip.
  sponsorWordsSection: {
    marginTop: 16,
    gap: 14,
  },
  skillsSection: {
    gap: 10,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChipSmall: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skillChipSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },

  // Back Card Insights
  insightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  // Section header on the back of the card (JOB SPONSOR, INSIGHTS) —
  // matches the front card's "ABOUT" label (sectionLabelSmall) so the
  // two faces share one type system.
  insightSectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
  },

  // Legacy styles (keep for backward compatibility)
  imageWrapperRedesign: {
    height: 180,
    backgroundColor: "#F9F9F9",
    position: "relative",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 40,
  },
  nameTagCard: {
    gap: 4,
  },
  nameTextCard: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleTextCard: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Company & Location Badges
  companyLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  companyBadge: {
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  companyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },

  // Summary Content
  summaryLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 4,
  },
  mentalityText: {
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "600",
  },

  // Detail Sections (for back of card)
  // Flat block — no shadow. The expanded-details list reads as a clean
  // stack of bordered sections rather than a pile of floating cards.
  detailSection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 12,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  detailSectionTitle: {
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    color: "#000",
    letterSpacing: 0.8,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  detailSectionText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
    fontWeight: "500",
  },

  // Legacy styles (keep for backward compatibility)
  cardHeader: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 14,
    backgroundColor: "#FAFAFA",
  },
  profileImageCompact: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  companyTextBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  infoFloatingBtnCompact: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  cardContentExpanded: {
    padding: 20,
    gap: 18,
    flex: 1,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
  },
  bioTextExpanded: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    fontWeight: "500",
  },
  insightPreviewText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
    fontStyle: "italic",
  },
  promptPreviewText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 19,
    fontStyle: "italic",
  },
  tapForMoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginTop: "auto",
  },
  tapForMoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.5,
  },

  // Legacy styles (keep for backward compatibility with other parts)
  imageWrapper: { height: 220, backgroundColor: "#F9F9F9" },
  profileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  infoFloatingBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 6,
    borderRadius: 8,
  },
  cardInfo: { padding: 24 },
  // Back-face content padding. Bottom is trimmed so the insights preview
  // (up to 4 subsections + the expand hint) fits the fixed card height.
  cardInfoScrollable: { padding: 24, paddingBottom: 20 },
  nameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  metaText: { fontSize: 12, fontWeight: "600", color: "#333" },
  locationText: { fontSize: 12, color: "#666", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10 },
  bioText: { fontSize: 15, color: "#444", lineHeight: 22 },
  expandedDetails: { marginBottom: 32, gap: 14 },

  // New Experience Card Styles
  experienceCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 12,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    flex: 1,
    letterSpacing: -0.3,
  },
  experienceDates: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 0.2,
  },
  experienceCompany: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  experienceDescription: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },

  // Education Card Styles
  educationCard: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  educationDegree: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  educationSchool: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  educationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  educationYear: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  educationGpa: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },

  // Certifications Grid
  certificationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  certificationBadge: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
    minWidth: "48%",
    flexGrow: 1,
    maxWidth: "100%",
  },
  certificationName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 3,
  },
  certificationDetails: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
  },

  // Languages Grid
  languagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageBadge: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  languageName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  languageProficiency: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999",
  },

  // Achievements Text
  achievementsText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },

  // Job Detail Card (for expanded job details)
  jobDetailCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  jobDetailText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },

  detailItem: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  detailTitle: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    color: "#000",
    letterSpacing: 0.5,
  },
  detailBody: { color: "#555", fontSize: 14, lineHeight: 20 },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: "#000", borderColor: "#000" },
  // Primary CTA — a gentle, diffuse lift rather than a hard drop shadow,
  // so it reads as "the main action" without clashing with the now-flat
  // detail sections.
  primaryActionBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#000",
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryActionLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // BACK OF CARD (INSIGHTS)
  backHeader: { marginBottom: 24 },
  backTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },

  // Redesigned Prompt Cards
  promptCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  promptIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  promptIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  promptQuestion: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 1,
    textTransform: "uppercase",
    lineHeight: 14,
  },
  promptAnswer: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    lineHeight: 24,
    letterSpacing: -0.2,
  },

  // Redesigned applicant back-of-card
  applicantBackScroll: { padding: 20, paddingBottom: 40 },
  applicantBackIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  applicantBackPhoto: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEE",
  },
  applicantBackIdentityText: { flex: 1, gap: 2 },
  applicantBackName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
  },
  applicantBackRole: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  applicantBackLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  applicantBackLocationText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },

  applicantBackStatsRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 14,
    marginBottom: 24,
  },
  applicantBackStatCell: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#F0F0F0",
  },
  applicantBackStatCellLast: {
    borderRightWidth: 0,
  },
  applicantBackStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
  },
  applicantBackStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },

  applicantBackSection: { marginBottom: 24 },
  applicantBackSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  applicantBackSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1.4,
  },

  applicantBackLoadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  applicantBackLoadingText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  applicantBackEmptyWrap: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  applicantBackEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginTop: 4,
  },
  applicantBackEmptyBody: {
    fontSize: 12,
    color: "#C0C0C0",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // Insight (prompt) cards — quote-bar style
  insightQuoteCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    marginBottom: 10,
  },
  insightQuoteAccent: {
    width: 3,
    backgroundColor: "#000",
  },
  insightQuoteContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  insightQuoteQuestion: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  insightQuoteAnswer: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  // Experience timeline
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineDotWrap: {
    width: 12,
    alignItems: "center",
    paddingTop: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#000",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E5E5",
    marginTop: 4,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    gap: 2,
  },
  timelineRole: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.2,
  },
  timelineCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  timelineDates: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
  },

  // Education (back-of-card)
  eduBackCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 2,
  },
  eduBackSchool: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.2,
  },
  eduBackDegree: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
  },
  eduBackYear: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
  },

  // Achievements (back-of-card)
  achievementsBackCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  achievementsBackText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#222",
    lineHeight: 20,
  },

  // Languages
  languagePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  languagePillName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  languagePillProf: {
    fontSize: 11,
    fontWeight: "500",
    color: "#999",
  },

  insightSection: { marginBottom: 24 },
  // Centered "chapter" header for the INSIGHTS block on the back of the
  // card — uppercase label flanked by hairline rules.
  insightsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  insightsHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EEE",
  },
  insightsHeaderCentered: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1.6,
  },
  // Expand affordance under the insights preview — mirrors the front
  // card's "Read more" so the down-chevron's purpose is discoverable.
  insightsExpandHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 16,
  },
  insightsExpandHintText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.2,
  },
  // Sub-label inside the INSIGHTS section (DAY-TO-DAY, TEAM CULTURE…) —
  // matches the app's small uppercase label convention.
  insightLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  // Body copy — aligned to the app's standard body text (descriptionText /
  // ProfileDetailSheet body): 14px / 500 / #333. Was 16/600/#000, which
  // ran heavier and larger than the rest of the app.
  insightContent: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    lineHeight: 21,
  },

  // PROMPTS (Legacy)
  promptWrapper: { marginBottom: 24, paddingLeft: 2 },
  promptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  promptContent: {
    fontSize: 16,
    fontWeight: "500",
    color: "#444",
    fontStyle: "italic",
    lineHeight: 24,
  },

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
  returnBtn: {
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  returnBtnText: { color: "#FFF", fontWeight: "700" },
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
  secondaryBtn: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  secondaryBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    paddingHorizontal: 20,
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
    borderColor: "#EAEAEA",
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
  checkInBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  checkInBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#000",
  },
  checkInBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  sponsorHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sponsorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F5",
  },
  sponsorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  sponsorRole: { fontSize: 13, color: "#666", marginBottom: 2 },
  sponsorYears: { fontSize: 12, color: "#999", marginLeft: 4 },
  canReferBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FFF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  canReferText: { fontSize: 12, fontWeight: "700", color: "#00CB54" },
  sponsorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
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
  insightBlock: {},
  insightsEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  insightsEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  insightsEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
    textAlign: "center",
  },
  insightsEmptySubtext: {
    fontSize: 13,
    fontWeight: "500",
    color: "#888",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  skillBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillBadgeText: { fontSize: 12, fontWeight: "700", color: "#000" },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, color: "#555", flex: 1 },

  // JOB CARD SPECIFIC STYLES
  jobCardContent: { padding: 24, paddingTop: 28 },
  companyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  companyDetails: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "700", color: "#000" },
  jobTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    lineHeight: 30,
    marginBottom: 16,
  },
  jobMetaList: { gap: 8, marginBottom: 10 },
  jobMetaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  jobMetaLineText: { fontSize: 14, color: "#666", fontWeight: "500" },
  infoFloatingBtnSmall: {
    backgroundColor: "#F9F9F9",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  jobDescription: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    marginBottom: 18,
  },
  skillsPreviewSection: { marginTop: 4 },
  skillsPreviewLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    marginBottom: 10,
    letterSpacing: 1,
  },
  skillChip: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skillChipMore: { backgroundColor: "#000", borderColor: "#000" },
  skillChipText: { fontSize: 12, fontWeight: "700", color: "#000" },
  skillChipTextWhite: { color: "#FFF" },

  // Non-Sponsored Back Design
  companyLogoLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  companyDescriptionSection: { marginBottom: 20 },
  companyDescriptionText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 24,
    fontWeight: "500",
  },
  insightsHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  insightContentSmall: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
    lineHeight: 20,
  },
  noSponsorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  noSponsorText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
  emptyStateDivider: {
    height: 1,
    backgroundColor: "#EEE",
    alignSelf: "stretch",
    marginVertical: 24,
  },
  noSponsorEmptyState: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Small centered kicker label at the top of the back faces.
  backKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1.4,
    textAlign: "center",
    marginBottom: 18,
  },
  // Non-sponsored back — centered "no sponsor yet" status block.
  noSponsorHero: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 8,
  },
  // About-the-company blurb beneath the no-sponsor status block.
  noSponsorAboutBlock: {
    marginTop: 24,
    gap: 8,
  },
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

  // Apply Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  applyModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  applyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  applyModalTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  applyModalSubtitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 24,
  },
  closeBtn: { padding: 4 },

  modalOptionsContainer: { gap: 12 },
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionContent: { flex: 1 },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  modalOptionDesc: { fontSize: 13, color: "#666", lineHeight: 18 },

  successContainer: { alignItems: "center", paddingVertical: 32 },
  successCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  successActionBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    minWidth: 200,
  },
  successActionBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  // Relevance badge & requirements summary
  relevancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  relevancePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  requirementsSummaryBlock: {
    marginTop: 12,
    backgroundColor: "#F6F6F6",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
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

  // ── Match Celebration Modal ────────────────────────────────────────────────
  matchModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  matchCard: {
    backgroundColor: "#FFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 20,
  },
  matchLabelPill: {
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  matchLabelText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  matchAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  matchAvatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
  },
  matchAvatarRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#000",
  },
  matchAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  matchAvatarInitial: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarInitialText: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
  },
  matchSparkWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  matchSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  matchActions: {
    width: "100%",
    gap: 10,
  },
  matchMsgBtn: {
    backgroundColor: "#000",
    borderRadius: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  matchMsgBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  matchSkipBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  matchSkipBtnText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },

  // Email Verification Modal — overlay anchors the sheet to the bottom of
  // the screen via flex; the sheet itself is content-sized.
  emailVerifOverlay: { flex: 1, justifyContent: "flex-end" },
  emailVerifModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
  },
  emailVerifIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  emailVerifTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 12,
  },
  emailVerifSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emailVerifAddress: {
    fontWeight: "700",
    color: "#000",
  },
  emailVerifInfoBox: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  emailVerifInfoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
  },
  emailVerifPrimaryBtn: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  emailVerifPrimaryBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  emailVerifSecondaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifSecondaryBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  emailVerifErrorText: {
    fontSize: 13,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  emailVerifTesterBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emailVerifTesterBtnText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Inline "Wrong email? Update it" affordance + edit form for fixing typos
  // in the modal without leaving the verification flow. Muted gray to match
  // the modal's neutral palette (no bright accent — the existing primary CTA
  // already owns the visual emphasis).
  emailVerifEditLink: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
    textDecorationLine: "underline",
  },
  emailVerifEditBlock: {
    width: "100%",
    marginVertical: 8,
  },
  emailVerifEditLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emailVerifEditInput: {
    width: "100%",
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  emailVerifEditActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  emailVerifEditCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditCancelText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  emailVerifEditSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditSaveText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
