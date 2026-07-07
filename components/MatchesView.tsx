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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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
});
