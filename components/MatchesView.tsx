import {
    trackApplicantLikedBack,
    trackMatchMessageTapped,
    trackReferralWithdrawn,
    trackSponsorLikedBack,
} from "@/lib/analytics/mixpanel";
import {
    getJobDetail,
    likeBackSponsor,
    likeProfile,
    requestSponsorForJob,
    sponsorJob,
    withdrawReferral,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import { saveSponsorRequestOutcome } from "@/utils/sponsorRequestCache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ChevronRight,
    Clock,
    Heart,
    MessageCircle,
    Zap,
} from "@/components/ui/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";
import { getRelativeTime } from "../utils/relativeTime";
import {
    InterestedApplicant,
    InterestedSponsor,
    JobOpportunity,
    Match,
    Referral,
    SponsorRequest,
    WaitlistedJob,
    interestedApplicantsQuery,
    interestedSponsorsQuery,
    likedJobsQuery,
    matchesQuery,
    matchesScreenKeys,
    referralsQuery,
    sponsorRequestsQuery,
    waitlistedJobsQuery,
} from "./matches/matchesQueries";
import { JobDetailModal } from "./matches/JobDetailModal";
import { ReferralDetailModal } from "./matches/ReferralDetailModal";
import { RolePickerModal } from "./matches/RolePickerModal";
import { SponsorMatchesSections } from "./matches/SponsorMatchesSections";
import { ApplicantMatchesSections } from "./matches/ApplicantMatchesSections";
import { SponsorRequestModal } from "./matches/SponsorRequestModal";
import { SrJobDetailModal } from "./matches/SrJobDetailModal";
import { WaitlistedJobModal } from "./matches/WaitlistedJobModal";
import { WithdrawReferralModal } from "./matches/WithdrawReferralModal";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

// React Query keys + shared query definitions, plus the Match/Referral/
// JobOpportunity/SponsorRequest/InterestedApplicant/WaitlistedJob types and
// the parseSkillsField helper, live in matchesQueries.ts so other screens
// (e.g. HomeView's "Your Move" strip) can subscribe to the same cache
// entries and reuse the same shapes.

const QUICK_REPLIES = [
  "Nice to meet you!",
  "Great profile!",
  "Let's chat!",
  "Impressive skills!",
];

export function MatchesView({
  userType = "sponsor",
  onNavigateToMessages,
  onOpenCheckIn,
}: {
  userType?: "applicant" | "sponsor";
  // Second arg is the counterpart user id (the OTHER participant in the
  // conversation — sponsor for an applicant caller, applicant for a sponsor
  // caller). Required to disambiguate when a sponsor has multiple matched
  // applicants on the same job, since every one of those conversations
  // shares the same jobId. Optional for legacy call sites where there can
  // only ever be one conversation per job (applicant→sponsor direction).
  onNavigateToMessages?: (jobId: string, userId?: string) => void;
  /**
   * Opens the global referral check-in modal (owned by MainApp, triggered
   * normally via the header clipboard icon). Wired to the stale-referral
   * nudge banner below so "Check in now" doesn't need its own duplicate
   * modal — it just opens the same one, pre-loaded with the same data.
   */
  onOpenCheckIn?: () => void;
}) {
  // Every "which detail modal is open" question on this screen is mutually
  // exclusive (opening one always meant closing the others via
  // closeAllModals below) — a single discriminated union replaces what used
  // to be 8 separate useState<T | null> selections. Individual `selectedX`
  // consts below are derived so the rest of this file (and the render body)
  // reads exactly as it did before this consolidation.
  type ActiveModal =
    | { kind: "profile"; profile: Match }
    | {
        kind: "roleGroup";
        group: {
          items: Match[];
          getMessageUserId: (m: Match) => string | undefined;
        };
      }
    | { kind: "job"; job: JobOpportunity }
    | { kind: "referral"; referral: Referral }
    | { kind: "interestedApplicant"; applicant: InterestedApplicant }
    | { kind: "interestedSponsor"; sponsor: InterestedSponsor }
    | { kind: "sponsorRequest"; request: SponsorRequest }
    | { kind: "waitlistedJob"; job: WaitlistedJob };

  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const selectedProfile =
    activeModal?.kind === "profile" ? activeModal.profile : null;
  // Role-picker for grouped match cards: when a person is matched on several
  // roles, tapping the card (or its Message button) opens this sheet so the
  // user explicitly chooses which role to view or message — instead of the
  // card silently picking the most-recent one.
  const roleGroup =
    activeModal?.kind === "roleGroup" ? activeModal.group : null;
  const selectedJob = activeModal?.kind === "job" ? activeModal.job : null;
  const selectedReferral =
    activeModal?.kind === "referral" ? activeModal.referral : null;
  const [modalMode, setModalMode] = useState<"view" | "message">("view");
  const [activeSlide, setActiveSlide] = useState(0);
  const [message, setMessage] = useState("");
  // "See all" full-list screen for a MatchSection group that's over its row
  // cap. Only one role's sections are ever mounted at a time, so a single
  // piece of state (which group, for the current userType) is enough.
  const [expandedGroup, setExpandedGroup] = useState<
    "yourMove" | "matched" | "inProgress" | null
  >(null);
  // Public-profile fetch state for the matched-profile modal moved into
  // the shared ProfileDetailSheet component — no longer needed here.

  // Interested applicants (applicants who liked a sponsored job, sponsor
  // hasn't liked back). Spinner state stays local; the list itself is
  // cached via useQuery further below.
  const selectedInterestedApplicant =
    activeModal?.kind === "interestedApplicant" ? activeModal.applicant : null;
  const [likingApplicantId, setLikingApplicantId] = useState<string | null>(
    null,
  );

  // Interested sponsors (sponsors who liked the applicant, no match yet).
  const selectedInterestedSponsor =
    activeModal?.kind === "interestedSponsor" ? activeModal.sponsor : null;
  // likeId of the sponsor we're currently "liking back" (shows a spinner)
  const [likingBackSponsorId, setLikingBackSponsorId] = useState<string | null>(
    null,
  );

  // Sponsor-requests — applicants asking sponsors at the company to sponsor a
  // specific job. List cached via useQuery below.
  const selectedSponsorRequest =
    activeModal?.kind === "sponsorRequest" ? activeModal.request : null;
  const [isConnectingToApplicant, setIsConnectingToApplicant] = useState(false);

  // ── Sponsor-request job detail (full role data fetched on tap) ────────
  const [srJobDetailVisible, setSrJobDetailVisible] = useState(false);
  const [srJobDetailLoading, setSrJobDetailLoading] = useState(false);
  const [srJobDetailError, setSrJobDetailError] = useState<string | null>(null);
  const [srJobDetail, setSrJobDetail] = useState<any>(null);

  // ── Sponsor-request multi-step flow state ──────────────────────────────
  // Step 1 = overview, 2 = confirm (relationship + canRefer), 3 = insights, 4 = success
  const [srStep, setSrStep] = useState(1);
  const [srRelationship, setSrRelationship] = useState<string | null>(null);
  const [srCanRefer, setSrCanRefer] = useState<boolean | null>(null);
  const [srDayToDay, setSrDayToDay] = useState("");
  const [srTeamCulture, setSrTeamCulture] = useState("");
  const [srIdealCandidate, setSrIdealCandidate] = useState("");
  const [srInsiderInsights, setSrInsiderInsights] = useState("");
  const [srSponsoring, setSrSponsoring] = useState(false);
  const [srNewJobId, setSrNewJobId] = useState<string | null>(null);

  // Real matches — fetched via React Query so the list is cached across tab
  // switches. On re-entry the cached matches paint instantly (no spinner) and
  // a background refetch keeps them fresh. `matchesLoading` / `matchesError`
  // below preserve the exact shapes the JSX already consumes.

  // Liked / waitlisted jobs (applicants) and referrals (both roles) — all
  // cached via useQuery below; only the spinner UI state stays local.
  const selectedWaitlistedJob =
    activeModal?.kind === "waitlistedJob" ? activeModal.job : null;
  const [isNudgingSponsorRequest, setIsNudgingSponsorRequest] =
    useState(false);

  const [withdrawingReferralId, setWithdrawingReferralId] = useState<
    string | null
  >(null);
  const [confirmingWithdrawReferral, setConfirmingWithdrawReferral] =
    useState<Referral | null>(null);
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [pendingWithdrawReferralId, setPendingWithdrawReferralId] = useState<
    string | null
  >(null);
  const [pendingWithdrawApplicantName, setPendingWithdrawApplicantName] =
    useState<string>("");
  const withdrawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

  // Matches, likedJobs, sponsorRequests, interestedApplicants,
  // waitlistedJobs, and referrals — every list on this screen is defined
  // once in matchesQueries.ts (shared with HomeView's "Your Move" strip)
  // and just consumed here via useQuery. Caching keeps the tab painting
  // instantly on re-entry while a background refetch keeps lists fresh.
  const {
    data: matches = [],
    isPending: matchesLoading,
    error: matchesErrorObj,
  } = useQuery(matchesQuery(userType));
  const matchesError =
    matchesErrorObj instanceof Error
      ? matchesErrorObj.message
      : matchesErrorObj
        ? "Failed to fetch matches"
        : null;

  // Called after any mutation that changes the match set. Invalidates every
  // cached list on the screen (shared "matchesScreen" root) so they all
  // refetch in the background and stay in sync.
  const refreshMatchSections = () => {
    queryClient.invalidateQueries({ queryKey: matchesScreenKeys.root });
  };

  // Re-send a sponsor request for a waitlisted job that's gone quiet. Closes
  // the "request → silence" loop the original request-sponsor flow left
  // open — previously the only way to nudge again was to find the job in
  // the deck a second time (if it even reappeared).
  const handleNudgeSponsorRequest = async (job: WaitlistedJob) => {
    setIsNudgingSponsorRequest(true);
    try {
      const res = await requestSponsorForJob(job.job_id);
      if (res.message) {
        await saveSponsorRequestOutcome(job.job_id, res.message);
      }
      refreshMatchSections();
      showToast(res.message || "Request sent again.", "success");
    } catch (err) {
      console.warn("[MatchesView] Failed to nudge sponsor request:", err);
      showToast("Couldn't send that right now. Please try again.", "error");
    } finally {
      setIsNudgingSponsorRequest(false);
    }
  };

  // Pull-to-refresh. Nothing else live-updates this screen (no socket, and a
  // like from another device produces no client event), so this is the user's
  // reliable manual way to pull new likes/matches/requests. Invalidating the
  // shared root refetches every section; awaiting it keeps the spinner up
  // until the lists actually settle.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: matchesScreenKeys.root });
    } finally {
      setRefreshing(false);
    }
  };

  // Optimistic-update helpers — patch a cached sub-section list in place.
  // Each keeps the exact (prev) => ... updater shape the mutation handlers
  // used with their old useState setters, so the call sites are unchanged.
  const patchSponsorRequests = (
    updater: (prev: SponsorRequest[]) => SponsorRequest[],
  ) =>
    queryClient.setQueryData<SponsorRequest[]>(
      matchesScreenKeys.sponsorRequests(userType),
      (prev) => updater(prev ?? []),
    );
  const patchInterestedApplicants = (
    updater: (prev: InterestedApplicant[]) => InterestedApplicant[],
  ) =>
    queryClient.setQueryData<InterestedApplicant[]>(
      matchesScreenKeys.interestedApplicants(userType),
      (prev) => updater(prev ?? []),
    );
  const patchInterestedSponsors = (
    updater: (prev: InterestedSponsor[]) => InterestedSponsor[],
  ) =>
    queryClient.setQueryData<InterestedSponsor[]>(
      matchesScreenKeys.interestedSponsors(userType),
      (prev) => updater(prev ?? []),
    );
  const patchReferrals = (updater: (prev: Referral[]) => Referral[]) =>
    queryClient.setQueryData<Referral[]>(
      matchesScreenKeys.referrals(userType),
      (prev) => updater(prev ?? []),
    );

  // Liked jobs (applicant) — cached so the section paints instantly on re-entry.
  const {
    data: likedJobs = [],
    isLoading: likedJobsLoading,
    error: likedJobsErrorObj,
  } = useQuery(likedJobsQuery(userType));
  const likedJobsError =
    likedJobsErrorObj instanceof Error ? likedJobsErrorObj.message : null;

  // Interested sponsors (applicant) — cached for instant re-entry. Query
  // definition is shared with HomeView's "Your Move" strip (see
  // matchesQueries.ts) so both screens read one cache entry.
  const {
    data: interestedSponsors = [],
    isLoading: interestedSponsorsLoading,
    error: interestedSponsorsErrorObj,
  } = useQuery(interestedSponsorsQuery(userType));
  const interestedSponsorsError =
    interestedSponsorsErrorObj instanceof Error
      ? interestedSponsorsErrorObj.message
      : null;

  // Fetch sponsor-requests (sponsor view) — applicants asking employees at
  // the sponsor's company to sponsor a job. Source of truth is
  // `matching.sponsor_requests` via GET /api/jobs/sponsor-requests/ (PR #57),
  // so this section is robust to the sponsor deleting / marking-read the
  // associated notification on the Notifications screen.
  const {
    data: sponsorRequests = [],
    isLoading: sponsorRequestsLoading,
    error: sponsorRequestsErrorObj,
  } = useQuery(sponsorRequestsQuery(userType));
  const sponsorRequestsError =
    sponsorRequestsErrorObj instanceof Error
      ? sponsorRequestsErrorObj.message
      : null;

  // Fetch interested applicants (sponsor view) — applicants who swiped right
  // on one of the sponsor's active jobs but the sponsor hasn't liked them back.
  // Queries all active sponsored jobs in parallel, then flattens and deduplicates.
  const {
    data: interestedApplicants = [],
    isLoading: interestedApplicantsLoading,
    error: interestedApplicantsErrorObj,
  } = useQuery(interestedApplicantsQuery(userType));
  const interestedApplicantsError =
    interestedApplicantsErrorObj instanceof Error
      ? interestedApplicantsErrorObj.message
      : null;

  // Waitlisted jobs (applicant) — cached for instant re-entry.
  const {
    data: waitlistedJobs = [],
    isLoading: waitlistedJobsLoading,
    error: waitlistedJobsErrorObj,
  } = useQuery(waitlistedJobsQuery(userType));
  const waitlistedJobsError =
    waitlistedJobsErrorObj instanceof Error
      ? waitlistedJobsErrorObj.message
      : null;

  // Referrals (both roles) — sponsors see submitted, applicants see received.
  // Cached for instant re-entry.
  const {
    data: referrals = [],
    isLoading: referralsLoading,
    error: referralsErrorObj,
  } = useQuery(referralsQuery(userType));
  const referralsError =
    referralsErrorObj instanceof Error ? referralsErrorObj.message : null;

  // Stale-referral nudge — a referral that's been sitting at "Referred"
  // (no progress reported) for a week or more is exactly the kind of thing
  // that otherwise silently rots: the applicant forgets to update, the
  // sponsor never finds out either way. Surfaced as a banner rather than a
  // push, since it needs no backend support at all — just today's already-
  // fetched referrals list.
  const STALE_REFERRAL_DAYS = 7;
  const staleReferrals = useMemo(() => {
    const cutoff = Date.now() - STALE_REFERRAL_DAYS * 24 * 60 * 60 * 1000;
    return referrals.filter((r) => {
      if (r.status !== "REFERRED") return false;
      if (r.checkInStage && r.checkInStage !== "Referred") return false;
      // A check-in submitted from this device within the window counts as
      // an update even when the stage stayed "Referred" — confirming "no
      // movement yet" is still checking in, so stop nagging for a week.
      const lastCheckIn = Date.parse(r.lastLocalCheckInAt || "");
      if (!isNaN(lastCheckIn) && lastCheckIn > cutoff) return false;
      const created = Date.parse(r.createdAt);
      return !isNaN(created) && created <= cutoff;
    });
  }, [referrals]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveSlide(slide);
  };

  const openProfile = (profile: Match, mode: "view" | "message") => {
    // The matched-profile modal is now the shared ProfileDetailSheet,
    // which owns its own public-profile fetch. We just need to flag
    // which profile is selected; the sheet handles the rest.
    setModalMode(mode);
    setActiveModal({ kind: "profile", profile });
    setActiveSlide(0);
  };

  // Row-grouping callbacks for renderMatchRows (components/matches/matchRowBuilders.tsx):
  // one row per counterpart, opening the role picker when they matched on
  // multiple jobs, otherwise viewing/messaging that single match directly.
  const matchRowCallbacks = {
    onOpenRoleGroup: (group: {
      items: Match[];
      getMessageUserId: (m: Match) => string | undefined;
    }) => setActiveModal({ kind: "roleGroup", group }),
    onOpenProfile: openProfile,
    onMessageTapped: (match: Match, userId: string | undefined) => {
      trackMatchMessageTapped({ jobId: match.jobId });
      onNavigateToMessages?.(match.jobId ?? "", userId);
    },
  };

  const openJob = (job: JobOpportunity) => {
    setActiveModal({ kind: "job", job });
    setActiveSlide(0);
  };

  const openInterestedSponsor = (sponsor: InterestedSponsor) => {
    // The shared ProfileDetailSheet fetches the public profile itself from
    // `userId`, so this just flags which sponsor is selected.
    setActiveModal({ kind: "interestedSponsor", sponsor });
  };

  /** Fetch full role detail for the currently selected sponsor request. */
  const openSrJobDetail = async () => {
    if (!selectedSponsorRequest?.jobId) return;
    setSrJobDetailVisible(true);
    setSrJobDetailLoading(true);
    setSrJobDetailError(null);
    try {
      const detail = await getJobDetail(selectedSponsorRequest.jobId);
      setSrJobDetail(detail);
    } catch (err) {
      setSrJobDetailError(
        err instanceof Error ? err.message : "Failed to load role details",
      );
    } finally {
      setSrJobDetailLoading(false);
    }
  };

  // Quietly prefetch the silver job detail as soon as a sponsor-request
  // modal opens so the company logo can render on the hero card (PR #62
  // ships `organization_logo` on /api/jobs/silver/<id>/ but NOT on
  // /api/jobs/sponsor-requests/). Failures are silent — the modal still
  // works, the hero just shows the company initial.
  useEffect(() => {
    if (!selectedSponsorRequest?.jobId) {
      setSrJobDetail(null);
      return;
    }
    let cancelled = false;
    setSrJobDetail(null);
    (async () => {
      try {
        const detail = await getJobDetail(selectedSponsorRequest.jobId);
        if (!cancelled) setSrJobDetail(detail);
      } catch {
        // Don't surface a load error in the inline card — the user can
        // still tap "Tap to review this role" which has its own error UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSponsorRequest?.jobId]);

  const closeAllModals = () => {
    setActiveModal(null);
    setSrJobDetailVisible(false);
    setSrJobDetail(null);
    setSrJobDetailError(null);
    // Reset sponsor-request flow state
    setSrStep(1);
    setSrRelationship(null);
    setSrCanRefer(null);
    setSrDayToDay("");
    setSrTeamCulture("");
    setSrIdealCandidate("");
    setSrInsiderInsights("");
    setSrSponsoring(false);
    setSrNewJobId(null);
    setMessage("");
  };

  // Sponsor completes the full sponsorship + connect flow from the sponsor
  // request modal. Steps:
  //   1 → overview (already rendered in the sheet)
  //   2 → relationship + canRefer
  //   3 → insider insights
  //   4 → success
  // On step 3 submit: call sponsorJob() then likeProfile() using the new
  // JOB_POSTINGS id so the applicant immediately sees the sponsor in
  // "Wants to Connect With You" (or gets a mutual match if prior interest).
  const handleSponsorAndConnect = async (request: SponsorRequest) => {
    if (!srRelationship || srCanRefer === null) return;
    setSrSponsoring(true);
    try {
      // Step A: sponsor the silver job → get a new JOB_POSTINGS id
      const sponsorRes = await sponsorJob(request.jobId, {
        relationship: srRelationship,
        canRefer: srCanRefer,
        insights: {
          dayToDay: srDayToDay,
          teamCulture: srTeamCulture,
          idealCandidate: srIdealCandidate,
          insiderInsights: srInsiderInsights,
        },
      });
      const newJobId = sponsorRes.job_id;
      setSrNewJobId(newJobId);

      // Step B: like the applicant's profile so they see the sponsor under
      // "Wants to Connect With You" (or get an instant match if they already
      // expressed interest in the role).
      await likeProfile(request.applicantUserId, newJobId);

      // Step C: drop the row from the local list. The next fetch reads from
      // `matching.sponsor_requests` (PR #57), which the backend has already
      // transitioned out of the active set once the like+match landed.
      patchSponsorRequests((prev) =>
        prev.filter((r) => r.requestId !== request.requestId),
      );
      refreshMatchSections();

      // Advance to success screen
      setSrStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[MatchesView] Sponsor-and-connect failed:", err);
      showToast(
        msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("duplicate")
          ? "You're already sponsoring this job. We've connected you with the applicant."
          : "Something went wrong. Please try again.",
        "error",
      );
    } finally {
      setSrSponsoring(false);
    }
  };

  // Sponsor connects with an applicant who already liked their job → creates
  // a mutual match. Removes applicant from the interested list and bumps the
  // matches section so they appear under "Interested Applicants".
  const handleLikeBackApplicant = async (applicant: InterestedApplicant) => {
    setLikingApplicantId(applicant.applicantUserId);
    try {
      const res = await likeProfile(applicant.applicantUserId, applicant.jobId);
      trackApplicantLikedBack({
        applicantUserId: applicant.applicantUserId,
        jobId: applicant.jobId,
      });
      if (res.matched) {
        patchInterestedApplicants((prev) =>
          prev.filter((a) => a.applicantUserId !== applicant.applicantUserId),
        );
        refreshMatchSections();
      }
      closeAllModals();
      showToast(
        res.matched
          ? `It's a match with ${applicant.name.split(" ")[0]}!`
          : res.message ||
              `Sent — ${applicant.name.split(" ")[0]} will be notified.`,
        res.matched ? "success" : "info",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[MatchesView] Failed to like back applicant:", err);
      // Surface the actual reason instead of a generic retry message. The
      // backend's like_applicant_profile rejects with 404 "not owned" when the
      // job isn't owned by this sponsor (e.g. on a stale list whose job was
      // since deactivated/unsponsored), and 401 when the session has lapsed.
      // A generic toast made these indistinguishable in TestFlight where there
      // are no dev logs to read.
      const lower = msg.toLowerCase();
      const looksLikeNotOwned =
        lower.includes("404") ||
        lower.includes("403") ||
        lower.includes("not owned") ||
        lower.includes("not found");
      const looksLikeSession =
        lower.includes("session") ||
        lower.includes("401") ||
        lower.includes("log in");
      showToast(
        looksLikeSession
          ? "Your session expired — please sign out and back in, then try again."
          : looksLikeNotOwned
            ? "That job is no longer active on your side. Pull to refresh and try again."
            : `Couldn't connect right now: ${msg}`,
        "error",
      );
    } finally {
      setLikingApplicantId(null);
    }
  };

  // Legacy single-tap connect (no longer exposed in UI — kept for reference)
  const handleConnectToApplicant = async (request: SponsorRequest) => {
    setIsConnectingToApplicant(true);
    try {
      const res = await likeProfile(request.applicantUserId, request.jobId);
      patchSponsorRequests((prev) =>
        prev.filter((r) => r.requestId !== request.requestId),
      );
      refreshMatchSections();
      closeAllModals();
      showToast(
        res.matched
          ? `It's a match with ${request.applicantName.split(" ")[0]}!`
          : `Sent — ${request.applicantName.split(" ")[0]} will see you under Interested in You.`,
        res.matched ? "success" : "info",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[MatchesView] Failed to connect to applicant:", err);
      // The likeProfile backend requires the sponsor to own the job. If they
      // don't (common, since request-sponsor notifies all employees at the
      // company), surface a clear next step instead of a generic error.
      const looksLikeNotOwned =
        msg.includes("404") ||
        msg.includes("403") ||
        msg.toLowerCase().includes("not owned") ||
        msg.toLowerCase().includes("not found");
      showToast(
        looksLikeNotOwned
          ? "You need to sponsor this job first — head to the Jobs tab."
          : "Couldn't connect right now. Please try again.",
        "error",
      );
    } finally {
      setIsConnectingToApplicant(false);
    }
  };

  // Applicant accepts a sponsor's one-sided interest → creates a mutual match.
  // Backend resolves which of the sponsor's active jobs to match on and
  // returns a context-aware `message` (includes the job title on success,
  // or e.g. "This sponsor doesn't have any active jobs right now" on failure
  // to find a match target). Surface that message verbatim.
  const handleLikeBackSponsor = async (sponsor: InterestedSponsor) => {
    setLikingBackSponsorId(sponsor.likeId);
    try {
      const res = await likeBackSponsor(sponsor.likeId);
      trackSponsorLikedBack({ likeId: sponsor.likeId });
      if (res.matched) {
        // Pull them out of "Interested in You" and re-fetch matches so they
        // appear under "Matched Opportunities".
        patchInterestedSponsors((prev) =>
          prev.filter((s) => s.likeId !== sponsor.likeId),
        );
        refreshMatchSections();
      }
      closeAllModals();
      showToast(res.message, res.matched ? "success" : "info");
    } catch (err) {
      console.warn("[MatchesView] Failed to like back sponsor:", err);
      showToast("Couldn't do that right now. Please try again.", "error");
    } finally {
      setLikingBackSponsorId(null);
    }
  };

  const commitWithdrawReferral = async (referralId: string) => {
    setWithdrawingReferralId(referralId);
    try {
      await withdrawReferral(referralId);
      trackReferralWithdrawn({ referralId });
    } catch (err) {
      console.warn("[MatchesView] Failed to withdraw referral:", err);
      // Revert the optimistic update on error
      patchReferrals((prev) =>
        prev.map((r) =>
          r.referralId === referralId ? { ...r, status: "REFERRED" } : r,
        ),
      );
      showToast(
        "Something went wrong. Your referral is still active.",
        "error",
      );
    } finally {
      setWithdrawingReferralId(null);
      setPendingWithdrawReferralId(null);
      setPendingWithdrawApplicantName("");
      setUndoToastVisible(false);
    }
  };

  const handleConfirmWithdrawWithUndo = (referral: Referral) => {
    const referralId = referral.referralId;
    const applicantName =
      [referral.applicantFirstName, referral.applicantLastName]
        .filter(Boolean)
        .join(" ") || "Applicant";

    // Close the confirmation modal immediately
    setConfirmingWithdrawReferral(null);

    // Optimistically mark as withdrawn in local state
    patchReferrals((prev) =>
      prev.map((r) =>
        r.referralId === referralId ? { ...r, status: "WITHDRAWN" } : r,
      ),
    );

    // Show the undo toast
    setPendingWithdrawReferralId(referralId);
    setPendingWithdrawApplicantName(applicantName);
    setUndoToastVisible(true);

    // Clear any previous timer and schedule the actual API call after 6s
    if (withdrawTimeoutRef.current) {
      clearTimeout(withdrawTimeoutRef.current);
    }
    withdrawTimeoutRef.current = setTimeout(() => {
      setUndoToastVisible(false);
      commitWithdrawReferral(referralId);
    }, 6000);
  };

  const handleUndoWithdraw = () => {
    if (withdrawTimeoutRef.current) {
      clearTimeout(withdrawTimeoutRef.current);
      withdrawTimeoutRef.current = null;
    }
    // Revert optimistic update
    if (pendingWithdrawReferralId) {
      patchReferrals((prev) =>
        prev.map((r) =>
          r.referralId === pendingWithdrawReferralId
            ? { ...r, status: "REFERRED" }
            : r,
        ),
      );
    }
    setPendingWithdrawReferralId(null);
    setPendingWithdrawApplicantName("");
    setUndoToastVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
          />
        }
      >
        <View style={styles.header}>
          {/* Renamed from "Opportunities" to match the "Matches" bottom-nav
              label — the screen and the tab that opens it should say the
              same thing. */}
          <Text style={styles.title}>Matches</Text>
          <Text style={styles.subtitle}>
            {userType === "applicant"
              ? "Your active opportunities & sponsors"
              : "Talent you are sponsoring"}
          </Text>
        </View>

        {/* Stale-referral nudge — see the staleReferrals memo above for
            exactly what counts. Only rendered when there's something to
            act on, and only when the parent actually wired up a way to
            open the check-in modal. */}
        {staleReferrals.length > 0 && onOpenCheckIn && (
          <TouchableOpacity
            style={styles.staleReferralBanner}
            onPress={onOpenCheckIn}
            activeOpacity={0.85}
          >
            <View style={styles.staleReferralIconCircle}>
              <Clock size={18} color="#000" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staleReferralTitle}>
                {staleReferrals.length === 1
                  ? "A referral needs a status update"
                  : `${staleReferrals.length} referrals need a status update`}
              </Text>
              <Text style={styles.staleReferralSubtitle}>
                No update in over a week — check in now
              </Text>
            </View>
            <ChevronRight size={18} color="#999" />
          </TouchableOpacity>
        )}

        {userType === "sponsor" ? (
          <SponsorMatchesSections
            matches={matches}
            matchesLoading={matchesLoading}
            matchesError={matchesError}
            sponsorRequests={sponsorRequests}
            sponsorRequestsLoading={sponsorRequestsLoading}
            sponsorRequestsError={sponsorRequestsError}
            interestedApplicants={interestedApplicants}
            interestedApplicantsLoading={interestedApplicantsLoading}
            interestedApplicantsError={interestedApplicantsError}
            referrals={referrals}
            referralsLoading={referralsLoading}
            referralsError={referralsError}
            withdrawingReferralId={withdrawingReferralId}
            expandedGroup={expandedGroup}
            onSetExpandedGroup={setExpandedGroup}
            onSelectSponsorRequest={(request) =>
              setActiveModal({ kind: "sponsorRequest", request })
            }
            onSelectInterestedApplicant={(applicant) =>
              setActiveModal({ kind: "interestedApplicant", applicant })
            }
            onOpenProfile={openProfile}
            onConfirmWithdrawReferral={setConfirmingWithdrawReferral}
            matchRowCallbacks={matchRowCallbacks}
          />
        ) : (
          <ApplicantMatchesSections
            matches={matches}
            matchesLoading={matchesLoading}
            matchesError={matchesError}
            interestedSponsors={interestedSponsors}
            interestedSponsorsLoading={interestedSponsorsLoading}
            interestedSponsorsError={interestedSponsorsError}
            waitlistedJobs={waitlistedJobs}
            waitlistedJobsLoading={waitlistedJobsLoading}
            waitlistedJobsError={waitlistedJobsError}
            likedJobs={likedJobs}
            likedJobsLoading={likedJobsLoading}
            likedJobsError={likedJobsError}
            referrals={referrals}
            referralsLoading={referralsLoading}
            referralsError={referralsError}
            expandedGroup={expandedGroup}
            onSetExpandedGroup={setExpandedGroup}
            onSelectInterestedSponsor={openInterestedSponsor}
            onSelectWaitlistedJob={(job) =>
              setActiveModal({ kind: "waitlistedJob", job })
            }
            onSelectJob={openJob}
            onSelectReferral={(referral) =>
              setActiveModal({ kind: "referral", referral })
            }
            matchRowCallbacks={matchRowCallbacks}
          />
        )}
      </ScrollView>

      {/* Matched-profile detail sheet — applicants see sponsor capabilities,
          sponsors see applicant bio/skills/insights. Powered by the shared
          ProfileDetailSheet, which owns its own public-profile fetch and
          renders the standardized layout. */}
      {selectedProfile && (
        <ProfileDetailSheet
          visible={!!selectedProfile}
          onDismiss={closeAllModals}
          userId={String(
            userType === "sponsor"
              ? selectedProfile.applicantUserId || ""
              : selectedProfile.sponsorUserId || "",
          )}
          variant={userType === "sponsor" ? "applicant" : "sponsor"}
          initial={{
            name: selectedProfile.name,
            image: selectedProfile.image,
            role: selectedProfile.role,
            company: selectedProfile.company,
          }}
          badge={{ label: "Matched" }}
          roleContext={
            selectedProfile.appliedRole
              ? {
                  label: "ROLE",
                  title: selectedProfile.appliedRole,
                  company: selectedProfile.company,
                  logoUrl: selectedProfile.companyLogoUrl,
                }
              : undefined
          }
          primaryCta={{
            label: `Message ${selectedProfile.name?.split(" ")[0] ?? (userType === "sponsor" ? "Applicant" : "Sponsor")}`,
            icon: <MessageCircle color="#FFF" size={18} strokeWidth={2.5} />,
            onPress: () => {
              trackMatchMessageTapped({ jobId: selectedProfile.jobId });
              closeAllModals();
              onNavigateToMessages?.(
                selectedProfile.jobId ?? "",
                selectedProfile.applicantUserId ||
                  selectedProfile.sponsorUserId,
              );
            },
          }}
        />
      )}

      {/* Interested applicant detail sheet — sponsor tapped on an applicant
          who liked their job but hasn't been connected with yet. Connect CTA
          calls likeProfile to create a match. */}
      {selectedInterestedApplicant && (
        <ProfileDetailSheet
          visible={!!selectedInterestedApplicant}
          onDismiss={() => setActiveModal(null)}
          userId={selectedInterestedApplicant.applicantUserId}
          variant="applicant"
          initial={{
            name: selectedInterestedApplicant.name,
            image: selectedInterestedApplicant.image,
            role: selectedInterestedApplicant.roleType,
          }}
          badge={{
            label: "Interested in Your Job",
            color: "#DC2626",
            bgColor: "#FEF2F2",
          }}
          roleContext={
            selectedInterestedApplicant.jobTitle
              ? {
                  label: "INTERESTED IN",
                  title: selectedInterestedApplicant.jobTitle,
                  company: selectedInterestedApplicant.jobCompany,
                }
              : undefined
          }
          primaryCta={{
            label:
              likingApplicantId === selectedInterestedApplicant.applicantUserId
                ? "Connecting..."
                : `Connect with ${selectedInterestedApplicant.name.split(" ")[0]}`,
            icon: <Heart color="#FFF" size={18} strokeWidth={2.5} />,
            loading:
              likingApplicantId === selectedInterestedApplicant.applicantUserId,
            onPress: () => handleLikeBackApplicant(selectedInterestedApplicant),
          }}
        />
      )}

      {/* Role picker — shown when a grouped match card (same person, multiple
          roles) is tapped. Extracted to components/matches/RolePickerModal.tsx. */}
      <Modal visible={!!roleGroup} transparent animationType="none">
        <RolePickerModal
          roleGroup={roleGroup}
          onClose={() => setActiveModal(null)}
          onSelectRole={(m) => {
            setActiveModal(null);
            openProfile(m, "view");
          }}
          onMessageRole={(m) => {
            if (!roleGroup) return;
            trackMatchMessageTapped({ jobId: m.jobId });
            const getMessageUserId = roleGroup.getMessageUserId;
            setActiveModal(null);
            onNavigateToMessages?.(m.jobId ?? "", getMessageUserId(m));
          }}
        />
      </Modal>

      <Modal visible={!!selectedJob} transparent animationType="none">
        <JobDetailModal
          job={selectedJob}
          onClose={closeAllModals}
          onNavigateToMessages={onNavigateToMessages}
        />
      </Modal>

      {/* Referral detail sheet — applicant taps a "Referrals Received" card.
          Mirrors the Applied-Jobs job modal: hero, sponsor card, and details. */}
      <Modal visible={!!selectedReferral} transparent animationType="none">
        <ReferralDetailModal
          referral={selectedReferral}
          onClose={closeAllModals}
          onNavigateToMessages={onNavigateToMessages}
        />
      </Modal>

      {/* Interested-sponsor detail sheet — applicant tapped a sponsor who
          wants to connect but isn't matched yet. Uses the shared
          ProfileDetailSheet so it matches every other profile modal on this
          screen; the Connect CTA likes them back to create the match. */}
      {selectedInterestedSponsor && (
        <ProfileDetailSheet
          visible={!!selectedInterestedSponsor}
          onDismiss={closeAllModals}
          userId={selectedInterestedSponsor.userId}
          variant="sponsor"
          initial={{
            name: selectedInterestedSponsor.name,
            image: selectedInterestedSponsor.image,
            role: selectedInterestedSponsor.role,
            company: selectedInterestedSponsor.company,
          }}
          badge={{
            label: selectedInterestedSponsor.likedAt
              ? `Wants to connect · ${getRelativeTime(selectedInterestedSponsor.likedAt)}`
              : "Wants to connect with you",
            color: "#DC2626",
            bgColor: "#FEF2F2",
          }}
          roleContext={
            selectedInterestedSponsor.jobTitle ||
            selectedInterestedSponsor.jobCompany
              ? {
                  label: "WANTS YOU FOR",
                  title:
                    selectedInterestedSponsor.jobTitle ||
                    "A role at their company",
                  company: selectedInterestedSponsor.jobCompany,
                }
              : undefined
          }
          primaryCta={{
            label:
              likingBackSponsorId === selectedInterestedSponsor.likeId
                ? "Connecting..."
                : `Connect with ${selectedInterestedSponsor.firstName}`,
            icon: <Heart color="#FFF" size={18} strokeWidth={2.5} />,
            loading: likingBackSponsorId === selectedInterestedSponsor.likeId,
            onPress: () => handleLikeBackSponsor(selectedInterestedSponsor),
          }}
        />
      )}

      {/* Waitlisted Job Detail Modal */}
      <Modal visible={!!selectedWaitlistedJob} transparent animationType="none">
        <WaitlistedJobModal
          job={selectedWaitlistedJob}
          onClose={closeAllModals}
          isNudging={isNudgingSponsorRequest}
          onNudge={handleNudgeSponsorRequest}
        />
      </Modal>

      {/* Sponsor-Request Modal — sponsor's view of an incoming request from
          an applicant. Mirrors the styling of the Interested-Sponsor modal
          (header tag → hero → context card → primary CTA) so the two
          incoming-interest flows feel symmetrical across roles. */}
      <Modal
        visible={!!selectedSponsorRequest}
        transparent
        animationType="none"
      >
        <SponsorRequestModal
          request={selectedSponsorRequest}
          jobDetailPreview={srJobDetail}
          flow={{
            step: srStep,
            relationship: srRelationship,
            canRefer: srCanRefer,
            dayToDay: srDayToDay,
            teamCulture: srTeamCulture,
            idealCandidate: srIdealCandidate,
            insiderInsights: srInsiderInsights,
            sponsoring: srSponsoring,
            newJobId: srNewJobId,
          }}
          onClose={closeAllModals}
          onOpenJobDetail={openSrJobDetail}
          onSetStep={setSrStep}
          onSetRelationship={setSrRelationship}
          onSetCanRefer={setSrCanRefer}
          onSetDayToDay={setSrDayToDay}
          onSetTeamCulture={setSrTeamCulture}
          onSetIdealCandidate={setSrIdealCandidate}
          onSetInsiderInsights={setSrInsiderInsights}
          onSponsorAndConnect={handleSponsorAndConnect}
          onNavigateToMessages={onNavigateToMessages}
        />
      </Modal>

      {/* Sponsor-Request Job Detail Modal — full role data before committing to sponsor */}
      <Modal visible={srJobDetailVisible} transparent animationType="none">
        <SrJobDetailModal
          visible={srJobDetailVisible}
          loading={srJobDetailLoading}
          error={srJobDetailError}
          detail={srJobDetail}
          onBack={() => setSrJobDetailVisible(false)}
        />
      </Modal>

      {/* Withdraw Referral Confirmation Modal — extracted to
          components/matches/WithdrawReferralModal.tsx (self-contained: no
          shared animation/lazy-fetch state, same pattern as
          ApplicantCheckInModal/ProfileCompletionModal). */}
      <Modal
        visible={!!confirmingWithdrawReferral}
        transparent
        animationType="none"
      >
        <WithdrawReferralModal
          referral={confirmingWithdrawReferral}
          applicantName={
            confirmingWithdrawReferral
              ? [
                  confirmingWithdrawReferral.applicantFirstName,
                  confirmingWithdrawReferral.applicantLastName,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                matches.find(
                  (m) =>
                    m.applicantUserId ===
                    confirmingWithdrawReferral.applicantUserId,
                )?.name ||
                "this applicant"
              : ""
          }
          isProcessing={
            !!confirmingWithdrawReferral &&
            withdrawingReferralId === confirmingWithdrawReferral.referralId
          }
          onCancel={() => setConfirmingWithdrawReferral(null)}
          onConfirm={handleConfirmWithdrawWithUndo}
        />
      </Modal>

      {/* Undo toast — shown after confirming withdrawal, before API commit */}
      {undoToastVisible && (
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.springify().damping(20)}
          style={styles.undoToast}
          pointerEvents="box-none"
        >
          <Text style={styles.undoToastText}>
            Referral withdrawn
            {pendingWithdrawApplicantName
              ? ` for ${pendingWithdrawApplicantName}`
              : ""}
          </Text>
          <TouchableOpacity
            onPress={handleUndoWithdraw}
            style={styles.undoToastBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.undoToastBtnText}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 100 },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 4 },
  staleReferralBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 30,
  },
  staleReferralIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
  },
  staleReferralTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  staleReferralSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  // Roles pill shown in place of the single-role line on a grouped match
  // card (same person matched on multiple roles). marginBottom mirrors
  // cardRole so grouped and single cards keep a consistent height.
  // Role picker sheet styles moved to components/matches/RolePickerModal.tsx.

  // Job Cards for Applicants
  jobCard: {
    width: 190,
    backgroundColor: "#F8F9FA",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  jobImage: { width: "100%", height: 100, backgroundColor: "#E5E5E5" },
  applyBtn: {
    backgroundColor: "#000",
    width: "100%",
    padding: 10,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  applyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  // ─── Interested Sponsors Section ─────────────────────────────────────────
  // "Wants you for X · Y" — tighter than the sponsor identity line, slight
  // top spacing to separate it as its own piece of info.

  // ─── Interested Sponsor Modal ─────────────────────────────────────────────
  interestedModalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  interestedModalTagText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "700",
  },
  interestedLoadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  // Sponsor-request modal — applicant hero block (photo + name).
  sponsorRequestHero: {
    alignItems: "center",
    marginBottom: 18,
  },
  sponsorRequestAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F2F2F2",
    marginBottom: 12,
  },
  sponsorRequestInitial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sponsorRequestInitialText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#999",
  },
  sponsorRequestName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  // Job context card — what the applicant wants sponsored.
  sponsorRequestJobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 16,
    borderRadius: 16,
  },
  sponsorRequestJobIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorRequestJobLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sponsorRequestJobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    lineHeight: 21,
  },
  sponsorRequestJobCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },
  interestedLoadingText: {
    fontSize: 14,
    color: "#AAA",
    fontWeight: "500",
  },
  sponsorModalInitial: {
    width: 55,
    height: 55,
    borderRadius: 27,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorModalInitialText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
  },
  sponsorCapabilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  sponsorCapBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  sponsorCapBadgeText: { fontSize: 11, fontWeight: "700", color: "#333" },
  referCompaniesBlock: { marginTop: 16 },
  referCompaniesLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1,
    marginBottom: 8,
  },
  referCompaniesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  referCompanyChip: {
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  referCompanyText: { fontSize: 12, fontWeight: "700", color: "#FFF" },

  // ─── Shared Modal Styles ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    // Sheet sizes to its content; only grows to fill (and scroll) when the
    // content is taller than this cap — no empty whitespace for short modals.
    // Absolute px (not "88%") so it doesn't depend on a parent with a fixed
    // height — the GestureHandlerRootView wrapper inside DismissibleSheet is
    // content-sized, and a % maxHeight against it would collapse to nothing.
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  jobRefTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 15,
    marginBottom: 20,
  },
  jobRefLabel: { fontSize: 10, fontWeight: "900", color: "#999" },
  jobRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobRefText: { fontSize: 12, fontWeight: "700" },
  jobRefCompany: { fontSize: 11, color: "#666", marginTop: 4 },
  matchScoreTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  matchScoreText: { fontSize: 12, fontWeight: "800", color: "#000" },

  // ─── Sponsor Match Modal (sm) ─────────────────────────────────────────────
  smHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  smAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F0F0",
  },
  smName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  smMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    lineHeight: 18,
    marginBottom: 6,
  },
  smMatchedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  smMatchedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  smJobBlock: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 16,
    marginBottom: 16,
  },
  smSectionLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  smJobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  smJobCompany: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  smLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  smLoadingText: {
    fontSize: 13,
    color: "#AAA",
    fontWeight: "500",
  },
  smCapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  smCapPill: {
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  smCapPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
  },
  smBlock: {
    marginBottom: 20,
  },
  smChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  smDarkChip: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smDarkChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  smInsightItem: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 14,
    marginBottom: 10,
  },
  smInsightQ: {
    fontSize: 10,
    fontWeight: "800",
    color: "#AAA",
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  smInsightA: {
    fontSize: 14,
    fontWeight: "500",
    color: "#222",
    lineHeight: 20,
  },
  smFallbackLine: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    lineHeight: 22,
  },
  smFallbackNote: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 14,
    marginBottom: 16,
  },
  smFallbackNoteText: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  smMessageBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  smMessageBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
  },

  swipableContainer: { width: CARD_WIDTH, alignSelf: "center" },
  infoCard: {
    minHeight: 260,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 15,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: "#000" },
  dotInactive: { width: 6, backgroundColor: "#DDD" },

  // Slide Styles
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  modalAvatar: { width: 55, height: 55, borderRadius: 27 },
  modalName: { fontSize: 20, fontWeight: "800" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 12, color: "#AAA", fontWeight: "600" },
  // "Wants you for [role]" pill on the sponsor-profile modal. Sits below
  // the sponsor identity row; muted gray to match the card's job-context
  // styling. Stays hidden when the backend doesn't supply jobTitle/jobCompany.
  likedForPill: {
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  likedForLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  likedForValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    lineHeight: 19,
  },
  sponsorSubtitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    marginTop: 2,
  },
  sponsorCompany: { fontSize: 13, color: "#999", fontWeight: "600" },
  bioText: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 15 },
  skillsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  skillText: { fontSize: 11, fontWeight: "700", color: "#666" },
  statsRow: { flexDirection: "row", gap: 8 },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  statLabel: { fontSize: 11, fontWeight: "800" },
  resumeBtn: {
    flex: 1,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  resumeBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  insightsTitle: { color: "#000", fontSize: 18, fontWeight: "800" },
  insightSection: { marginBottom: 20 },
  insightLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#AAA",
    marginBottom: 6,
    letterSpacing: 1.2,
  },
  insightContent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    lineHeight: 20,
  },
  promptWrapper: { marginBottom: 20 },
  promptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  promptContent: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    fontStyle: "italic",
    lineHeight: 20,
  },

  // Liked-job modal: HomeView-mirrored detail sections
  detailSection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
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
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillBadgeText: { fontSize: 12, fontWeight: "700", color: "#000" },
  roleDetailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleDetailChipText: { fontSize: 13, fontWeight: "600", color: "#000" },

  // Job Modal Styles
  jobModalHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  jobModalImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  jobModalInfo: { flex: 1 },
  jobModalCompany: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  jobModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  jobModalMeta: { flexDirection: "row", gap: 12 },
  jobModalMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  jobModalMetaText: { fontSize: 12, color: "#999", fontWeight: "600" },
  jobSection: { marginBottom: 24 },
  jobSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  jobSectionText: { fontSize: 14, color: "#555", lineHeight: 22 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: "#555", fontWeight: "500" },
  sponsorInfoCard: {
    backgroundColor: "#F8F9FB",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  sponsorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sponsorCardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
  },
  sponsorCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 20 },
  sponsorCardName: { fontSize: 14, fontWeight: "800", color: "#000" },
  sponsorCardRole: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginTop: 2,
  },
  canReferBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnLarge: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnLargeText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  // Input
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#BBB",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  replyScroll: {
    marginBottom: 15,
    marginHorizontal: -28,
    paddingHorizontal: 28,
  },
  replyChip: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#000",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  replyChipText: { fontWeight: "700", fontSize: 13 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    padding: 8,
  },
  messageInput: { flex: 1, padding: 10, fontSize: 15, maxHeight: 80 },
  sendBtn: {
    backgroundColor: "#000",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Active Pipeline Styles
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    borderColor: "#EEE",
    backgroundColor: "#F5F5F5",
  },
  statusText: { fontSize: 11, fontWeight: "700", color: "#000" },

  // Liked Jobs Section
  likedJobInitial: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  likedJobInitialText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#999",
  },
  jobModalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  jobModalMatchedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalMatchedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  jobModalPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalPendingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  jobModalLikedDate: {
    fontSize: 12,
    color: "#BBB",
    fontWeight: "600",
  },
  jobModalHero: {
    alignItems: "center",
    marginBottom: 24,
  },
  jobModalHeroInitial: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  jobModalHeroInitialText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
  },
  jobModalHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  jobModalHeroCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  jobModalLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  jobModalLocationText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  jobRemoteBadge: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  jobRemoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  jobModalCompStrip: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 18,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  jobModalCompCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  jobModalCompCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "#EEEEEE",
  },
  jobModalCompLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jobModalCompValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  jobMatchedSponsorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  jobMatchedSponsorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
  },
  jobSponsorInitialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  jobSponsorInitialText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFF",
  },
  // Waitlisted Jobs

  // Pipeline empty state
  // ─── Referral pipeline styles ───────────────────────────────────────────────
  listImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  // ─── Referrals Received — applicant card ───
  referralCardInitial: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  referralCardInitialText: { fontSize: 19, fontWeight: "800", color: "#FFF" },
  // Monochrome status pill — Referred = black, Withdrawn = grey.
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  refPillDot: { width: 6, height: 6, borderRadius: 3 },
  refPillDotReferred: { backgroundColor: "#000" },
  refPillDotWithdrawn: { backgroundColor: "#BBB" },
  refPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  refPillTextReferred: { color: "#000" },
  refPillTextWithdrawn: { color: "#999" },
  // withdrawBtn/withdrawBtnText moved to SponsorMatchesSections.tsx.
  undoToast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  undoToastText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  undoToastBtn: {
    // White on the dark (#1A1A1A) toast — a black button would vanish.
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  undoToastBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  referralDateText: {
    fontSize: 11,
    color: "#BBB",
    marginTop: 3,
  },

  // ─── Sponsor-Request Multi-Step Flow ─────────────────────────────────────────
  srStepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  srStepDots: { flexDirection: "row", gap: 6 },
  srDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5E5",
  },
  srDotActive: { backgroundColor: "#000", width: 24, borderRadius: 4 },
  srStepLabel: { fontSize: 12, fontWeight: "700", color: "#999" },
  srOverviewSub: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  srCallout: {
    backgroundColor: "#F0F0F0",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  srCalloutTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  srCalloutText: { fontSize: 14, color: "#555", lineHeight: 22 },
  srDismissBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  srDismissBtnText: { fontSize: 14, color: "#999", fontWeight: "600" },
  srJobCardTapHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AAA",
    marginTop: 6,
    letterSpacing: 0.2,
  },
  srJobDetailBackRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginBottom: 18,
  },
  srJobDetailBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  srJobDetailErrorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
    marginTop: 12,
    textAlign: "center" as const,
  },
  srJobDetailErrorSub: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    textAlign: "center" as const,
    lineHeight: 19,
  },
  srStepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
  },
  srStepSub: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 24,
  },
  srFormSection: { marginBottom: 24 },
  srFieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  srFieldHint: {
    fontSize: 13,
    color: "#999",
    marginBottom: 12,
    lineHeight: 18,
  },
  srRadioOption: {
    backgroundColor: "#F9F9F9",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 12,
  },
  srRadioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  srRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCC",
  },
  srRadioCircleActive: { borderColor: "#000", borderWidth: 6 },
  srRadioText: { fontSize: 15, color: "#666", fontWeight: "600" },
  srRadioTextActive: { color: "#000", fontWeight: "600" },
  srSideBySide: { flexDirection: "row", gap: 12 },
  srHalfOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  srTextInput: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    fontSize: 15,
    color: "#000",
    minHeight: 110,
    textAlignVertical: "top",
  },
  srSuccessContainer: {
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
  },
  srSuccessIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  srSuccessTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    color: "#000",
  },
  srSuccessDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
});
