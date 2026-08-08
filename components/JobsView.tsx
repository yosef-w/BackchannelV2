import {
  trackBrowseJobsViewed,
  trackJobCreatedFromUrl,
  trackJobCreateFromUrlFailed,
  trackJobCreateFromUrlStarted,
  trackJobSponsored,
  trackJobSponsorStarted,
  trackJobUnsponsored,
} from "@/lib/analytics/mixpanel";
import {
  type AtsOrganization,
  browseJobs,
  createJobFromUrl,
  getJobApplicantsLikes,
  getMyJobs,
  likeProfile,
  searchAtsOrganizations,
  sponsorJob,
  unsponsorJob,
  updateJob,
  updateSponsorProfile,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useJobsStore } from "@/stores/useJobsStore";
import { Colors, Fonts, Type } from "@/constants/theme";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import type { Job } from "@/types/jobs";
import { CheckCircle, Plus, Zap } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { JobsEmptyState } from "./jobs/JobsEmptyState";
import {
  type Applicant,
  parseSkillsField,
  transformBrowseResponse,
  transformMyJobRow,
} from "./jobs/jobTransforms";
import { BrowseJobsTab } from "./jobs/BrowseJobsTab";
import {
  CreateJobFlowScreen,
  type CreateJobPublishPayload,
} from "./jobs/create/CreateJobFlowScreen";
import { JobDetailsModal } from "./jobs/JobDetailsModal";
import { JobMenuModal } from "./jobs/JobMenuModal";
import { SponsorGateModal } from "./jobs/SponsorGateModal";
import { SponsorJobModal } from "./jobs/SponsorJobModal";
import { SponsoredJobsTab } from "./jobs/SponsoredJobsTab";
import { TopApplicantsModal } from "./jobs/TopApplicantsModal";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;

interface SponsorInfo {
  name: string;
  role: string;
  image: string;
  canRefer: boolean;
}

// The Applicant shape lives in components/jobs/jobTransforms.ts (shared
// with TopApplicantsModal).

// Extend Job type with UI-specific fields (JobPosting is now just an alias)
type JobPosting = Job;

// UNSPONSOR_REASONS, parseSkillsField, cleanJobText, formatExperienceLevel,
// transformBrowseResponse, and transformMyJobRow live in
// components/jobs/jobTransforms.ts (pure functions, unit-testable).
// SponsorInsightCards (the 4 insight prompt cards) lives in
// components/jobs/SponsorInsightCards.tsx.

export function JobsView() {
  // Zustand store
  const queryClient = useQueryClient();
  const jobs = useJobsStore((state) => state.jobs);
  const isLoading = useJobsStore((state) => state.isLoading);
  const error = useJobsStore((state) => state.error);
  const lastFetched = useJobsStore((state) => state.lastFetched);
  const setJobs = useJobsStore((state) => state.setJobs);
  const setLoading = useJobsStore((state) => state.setLoading);
  const setError = useJobsStore((state) => state.setError);
  const addSponsoredJob = useJobsStore((state) => state.addSponsoredJob);
  const setActiveSponsoredJobId = useJobsStore(
    (state) => state.setActiveSponsoredJobId,
  );
  const sponsoredJobs = useJobsStore((state) => state.sponsoredJobs);
  const myJobs = useJobsStore((state) => state.myJobs);
  const isMyJobsLoading = useJobsStore((state) => state.isMyJobsLoading);
  const setMyJobs = useJobsStore((state) => state.setMyJobs);
  const setMyJobsLoading = useJobsStore((state) => state.setMyJobsLoading);
  const removeMyJob = useJobsStore((state) => state.removeMyJob);
  const showToast = useToastStore((state) => state.showToast);

  // Sponsor's company drives the ATS browse filter. We read it here so an
  // empty board can offer "did you mean…" corrections, and write it back when
  // the sponsor picks a suggestion.
  const sponsorCompany = useUserProfileStore(
    (state) => state.data.professional.company,
  );
  const updateProfessional = useUserProfileStore(
    (state) => state.updateProfessional,
  );
  // "Did you mean…" suggestions for an empty board (likely a company typo /
  // naming mismatch). Fetched lazily once browse comes back empty.
  const [companySuggestions, setCompanySuggestions] = useState<
    AtsOrganization[]
  >([]);
  const [applyingCompany, setApplyingCompany] = useState<string | null>(null);
  // Remember which company we already searched suggestions for, so the effect
  // doesn't refire on every render while the board stays empty.
  const suggestionsForCompany = useRef<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [viewJobDetails, setViewJobDetails] = useState<JobPosting | null>(null);

  const [menuJob, setMenuJob] = useState<JobPosting | null>(null);
  const [isUnsponsoringId, setIsUnsponsoringId] = useState<string | null>(null);
  // Menu-modal step 2 — "why are you unsponsoring?" Tapping "Unsponsor Job"
  // flips `showUnsponsorReasons` on instead of unsponsoring immediately.
  const [showUnsponsorReasons, setShowUnsponsorReasons] = useState(false);
  const [unsponsorReason, setUnsponsorReason] = useState<string | null>(null);
  const [unsponsorReasonDetail, setUnsponsorReasonDetail] = useState("");
  // Menu-modal "Replace Logo" step — PR #62 ships a `logo_url` field on
  // PATCH /api/jobs/<id>/edit/ that lets a sponsor override the auto-
  // resolved Logo.dev URL (useful when the resolver picked the wrong
  // domain, or for boutique companies it doesn't know about).
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  const [selectedApplicantJob, setSelectedApplicantJob] =
    useState<JobPosting | null>(null);
  // Backend-fetched applicants for the selected sponsored job, mapped to
  // the local Applicant shape. The legacy `selectedApplicantJob.topApplicants`
  // field was never populated by any fetch path — switching to a dedicated
  // state slot is cleaner and lets us track loading/error explicitly.
  const [jobApplicants, setJobApplicants] = useState<Applicant[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(false);
  const [applicantsError, setApplicantsError] = useState<string | null>(null);
  const [showSponsorGate, setShowSponsorGate] = useState<JobPosting | null>(
    null,
  );
  const [selectedApplicantForMessage, setSelectedApplicantForMessage] =
    useState<Applicant | null>(null);
  // Public-profile fetch state lives inside ProfileDetailSheet now.
  // JOB_POSTINGS id that scopes the match. We need it for `likeProfile`
  // because the backend ties the match to a specific role. Set when the
  // sponsor opens the Top Applicants list and preserved through to the
  // messaging modal's Match button.
  const [matchJobPostingsId, setMatchJobPostingsId] = useState<string | null>(
    null,
  );
  const [isMatching, setIsMatching] = useState(false);
  // Vestigial: kept so existing close handlers still compile. The free-form
  // message UI was removed when we replaced "Quick Reply + Send" with a
  // single Match button (matching is the prerequisite for messaging — chats
  // happen in MatchesView after the match exists).
  const [message, setMessage] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  // Active sponsors land on My Sponsored (their working set — applicants
  // live there); sponsors with nothing sponsored yet land on Browse to go
  // shopping. Decided once at mount from the in-memory store (populated by
  // MainApp's initMyJobs), not re-evaluated on later changes — yanking the
  // tab out from under the user mid-session would be worse than a stale
  // default.
  const [activeTab, setActiveTab] = useState<"browse" | "sponsored">(() =>
    useJobsStore.getState().sponsoredJobs.length > 0 ? "sponsored" : "browse",
  );
  const [displayLimit, setDisplayLimit] = useState(20);
  // Browse search — client-side filter over the loaded (company-scoped)
  // list. Filtering locally keeps the store's cached list intact (the
  // did-you-mean company logic and isSponsored sync both key off it) and
  // makes search instant.
  const [searchQuery, setSearchQuery] = useState("");
  // Jobs the sponsor already sponsors are pulled out of the main Browse
  // list into a collapsed section at the bottom — they're not actionable
  // while shopping, and the old treatment (dimmed cards mid-list) made
  // the board read as half-disabled.
  const [showSponsoredInBrowse, setShowSponsoredInBrowse] = useState(false);

  // Fetch browse jobs on mount. The store is in-memory and survives tab
  // switches, so on re-entry we serve the cached list instantly: the
  // full-screen spinner only shows on a true cold load (`silent === false`),
  // and when results already exist we refetch silently in the background.
  useEffect(() => {
    const loadJobs = async (silent: boolean) => {
      try {
        if (!silent) setLoading(true);
        trackBrowseJobsViewed();
        const response = await browseJobs({ limit: 50 });
        const transformedJobs = transformBrowseResponse(
          response.jobs,
          sponsoredJobs,
        );
        setJobs(transformedJobs);
      } catch (err) {
        console.warn("Failed to fetch browse jobs:", err);
        // Don't surface an error screen over a list the user can already see.
        if (!silent)
          setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    // Skip the network entirely when the cached list is still fresh; otherwise
    // refetch — silently if we already have results to show, with the spinner
    // only on a true cold load.
    const FRESH_MS = 2 * 60 * 1000;
    const isFresh =
      !!lastFetched &&
      Date.now() - new Date(lastFetched).getTime() < FRESH_MS;
    if (jobs.length > 0 && isFresh) return;
    loadJobs(jobs.length > 0);
    // isSponsored flags are synced by a separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync isSponsored flags on browse jobs whenever sponsoredJobs changes
  // (e.g. after initMyJobs populates sponsoredJobs, or after sponsor/unsponsor).
  // This is a lightweight in-memory update — no API call.
  useEffect(() => {
    if (jobs.length === 0) return;
    setJobs(
      jobs.map((job) => ({
        ...job,
        isSponsored: sponsoredJobs.some((sj) => sj.atsJobId === job.id),
      })),
    );
  }, [sponsoredJobs]);

  // When the browse board comes back empty, the likeliest cause is a company
  // typo / naming mismatch (the filter matches the sponsor's company string
  // against ATS org names). Fetch fuzzy "did you mean…" suggestions once per
  // company so we can offer one-tap corrections. Skips while loading, when
  // there are results, or when we've already searched this exact company.
  useEffect(() => {
    const company = (sponsorCompany || "").trim();
    if (isLoading || jobs.length > 0 || !company) return;
    if (suggestionsForCompany.current === company) return;
    suggestionsForCompany.current = company;
    let cancelled = false;
    (async () => {
      const res = await searchAtsOrganizations(company, 6);
      if (cancelled || res === null) return;
      // Drop an exact match (that's the value that already returned nothing)
      // and surface the closest near-matches.
      const near = res.filter(
        (o) => o.organization.toLowerCase() !== company.toLowerCase(),
      );
      setCompanySuggestions(near.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [sponsorCompany, jobs.length, isLoading]);

  // Sponsor tapped a "did you mean…" suggestion — correct their stored company
  // (backend + local store) and refetch the board against the new company.
  const handleApplyCompany = async (organization: string) => {
    setApplyingCompany(organization);
    try {
      await updateSponsorProfile({ company: organization });
      await updateProfessional({ company: organization });
      // Let the suggestion effect re-run for the new company if needed.
      suggestionsForCompany.current = null;
      setCompanySuggestions([]);
      setLoading(true);
      const response = await browseJobs({ limit: 50 });
      setJobs(
        transformBrowseResponse(
          response.jobs,
          sponsoredJobs,
        ),
      );
      showToast(`Showing jobs for ${organization}`, "success");
    } catch (err) {
      console.warn("[JobsView] Failed to apply company correction:", err);
      showToast("Couldn't update your company. Please try again.", "error");
    } finally {
      setApplyingCompany(null);
      setLoading(false);
    }
  };

  // Shared helper — fetch sponsor's own jobs and update store
  const refreshMyJobs = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setMyJobsLoading(true);
      const response = await getMyJobs();
      setMyJobs(response.jobs.map(transformMyJobRow));
    } catch (err) {
      console.warn("[JobsView] Failed to fetch my jobs:", err);
    } finally {
      if (showLoadingSpinner) setMyJobsLoading(false);
    }
  };

  // Closes the menu modal and resets every step (unsponsor reason + logo
  // editor) so the menu always reopens on the root options list.
  const closeMenu = () => {
    setMenuJob(null);
    setShowUnsponsorReasons(false);
    setUnsponsorReason(null);
    setUnsponsorReasonDetail("");
    setShowLogoEditor(false);
    setLogoUrlInput("");
    setIsSavingLogo(false);
  };

  // PR #62 — override the auto-resolved Logo.dev URL with a sponsor-supplied
  // one. An empty / whitespace-only input is treated as "use the override
  // I'm sending" only when non-empty; we deliberately don't send an empty
  // string here since the backend would reject it (it validates as a URL).
  // Successful save updates the local jobs list optimistically so the new
  // logo appears immediately without a full refetch.
  const handleSaveLogoUrl = async () => {
    if (!menuJob) return;
    const trimmed = logoUrlInput.trim();
    if (!trimmed) {
      showToast("Paste a logo URL first.", "error");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      showToast("Logo URL must start with http:// or https://", "error");
      return;
    }
    setIsSavingLogo(true);
    try {
      await updateJob(menuJob.id, { logo_url: trimmed });
      // Optimistically refresh the card image in both lists so the new
      // logo appears immediately without waiting for a refetch.
      setJobs(
        jobs.map((j) => (j.id === menuJob.id ? { ...j, image: trimmed } : j)),
      );
      setMyJobs(
        myJobs.map((j) =>
          j.id === menuJob.id ? { ...j, image: trimmed } : j,
        ),
      );
      showToast("Logo updated.", "success");
      closeMenu();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[JobsView] Failed to update logo:", err);
      showToast(
        msg.toLowerCase().includes("invalid")
          ? "Backend rejected that URL — double-check it points to an image."
          : "Couldn't save the new logo. Please try again.",
        "error",
      );
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleUnsponsor = async (
    job: JobPosting,
    reason: string,
    reasonDetail?: string,
  ) => {
    closeMenu();
    setIsUnsponsoringId(job.id);
    // Optimistic remove from store so the list updates immediately
    removeMyJob(job.id);
    try {
      await unsponsorJob(job.id, reason, reasonDetail);
      trackJobUnsponsored({ jobId: job.id, reason });
      // Flush the Matches screen's "Interested in Your Jobs" cache so the
      // applicants who liked this job don't appear as ghost entries.
      queryClient.invalidateQueries({ queryKey: ["matchesScreen"] });
    } catch (err) {
      console.warn("[JobsView] Failed to unsponsor job:", err);
      // Revert by re-fetching the real list from backend
      refreshMyJobs(false);
      showToast("Failed to remove sponsorship. Please try again.", "error");
    } finally {
      setIsUnsponsoringId(null);
    }
  };

  // Fetch real sponsored jobs whenever the "My Sponsored" tab is opened.
  // Show the spinner only on a cold load; when the list is already cached
  // (in-memory store survives tab switches), refresh silently in the
  // background so the tab paints instantly.
  useEffect(() => {
    if (activeTab !== "sponsored") return;
    refreshMyJobs(myJobs.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Pre-populate both sponsoredJobs (for green borders) AND myJobs (for tab count)
  // on mount so the badge reflects reality before the user ever clicks the tab.
  useEffect(() => {
    const initMyJobs = async () => {
      try {
        const response = await getMyJobs();
        // Populate sponsoredJobs (powers green-border tracking in browse
        // AND the role-switcher dropdown on HomeView). All sponsored jobs
        // are added — manually-created ones (no REFERENCE_JOB_ID) get an
        // empty atsJobId, which is fine for the dropdown and harmless for
        // the green-border logic (empty atsJobId won't match any browse row).
        response.jobs.forEach((j) => {
          addSponsoredJob({
            jobId: String(j.JOB_ID),
            atsJobId: j.REFERENCE_JOB_ID ? String(j.REFERENCE_JOB_ID) : "",
            title: j.TITLE || "",
            company: j.COMPANY || "",
            // PR #56 — pending (unactioned) count powers the HomeView
            // role-switcher badge. Fall back to LIKES_COUNT when the
            // backend hasn't shipped PENDING_LIKES_COUNT yet (defensive).
            likesCount: Number(j.PENDING_LIKES_COUNT ?? j.LIKES_COUNT) || 0,
          });
        });
        // Also transform and store as myJobs so the badge count is correct immediately
        setMyJobs(response.jobs.map(transformMyJobRow));
      } catch {
        // silent fail — will be corrected when user opens the tab
      }
    };
    initMyJobs();
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideWidth = SCREEN_WIDTH - MODAL_PADDING * 2;
    const slide = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveSlide(slide);
  };

  // Tapped the message icon on a row → open the messaging modal with what we
  // already have, then fetch the full public profile in the background and
  // merge BIO / LOCATION / current role + company / years experience /
  // Opens the applicant detail modal. The shared ProfileDetailSheet owns
  // its own public-profile fetch now, so we just hand off the lightweight
  // applicant seed and the sheet hydrates the bio / location / skills /
  // insights itself.
  const openMessagingModal = (applicant: Applicant) => {
    setSelectedApplicantForMessage(applicant);
  };

  const handleApplicantPress = async (job: JobPosting) => {
    if (!job.isSponsored) {
      setShowSponsorGate(job);
      return;
    }
    // Open modal immediately with a loading state, fetch in parallel.
    // Resolve which JOB_POSTINGS id to query — the Browse tab carries the
    // ATS/SILVER_JOBS id, but the backend endpoint expects the JOB_POSTINGS
    // id. Look it up via the sponsoredJobs index (same trick used by the
    // unsponsor flow below).
    const sponsoredEntry = sponsoredJobs.find(
      (sj) => sj.atsJobId === job.id || sj.jobId === job.id,
    );
    const jobPostingsId = sponsoredEntry?.jobId ?? job.id;
    setSelectedApplicantJob(job);
    // Preserve the JOB_POSTINGS id for the eventual Match button — the
    // messaging modal needs it but doesn't have access to `job` directly.
    setMatchJobPostingsId(jobPostingsId);
    setJobApplicants([]);
    setApplicantsError(null);
    setIsLoadingApplicants(true);
    try {
      const response = await getJobApplicantsLikes(jobPostingsId);
      const mapped: Applicant[] = (response.applicants || []).map((a) => {
        const fullName = [a.FIRST_NAME, a.LAST_NAME]
          .filter(Boolean)
          .join(" ")
          .trim();
        const positions = parseSkillsField(a.POSITIONS);
        const skills = parseSkillsField(a.SKILLS);
        const targetRole = positions[0] || a.INDUSTRY || "Applicant";
        return {
          id: a.APPLICANT_USER_ID,
          name: fullName || "Applicant",
          role: targetRole,
          // Backend doesn't return current employer in this payload — show
          // their location as the secondary line instead so the row isn't
          // "Senior PM @ " with a dangling separator.
          company: a.LOCATION || "",
          image: a.PHOTO_URL || "",
          matchScore: 0,
          experience: "",
          skills,
          appliedRole: job.title,
          status: a.STATUS,
        };
      });
      setJobApplicants(mapped);
    } catch (err) {
      console.warn("[JobsView] Failed to fetch job applicants:", err);
      setApplicantsError(
        err instanceof Error ? err.message : "Couldn't load applicants",
      );
    } finally {
      setIsLoadingApplicants(false);
    }
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sponsorshipStep, setSponsorshipStep] = useState(1);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [canRefer, setCanRefer] = useState<boolean | null>(null);
  const [isSponsoring, setIsSponsoring] = useState(false);
  // Insights captured during sponsor_job flow (separate from create-from-url state)
  const [sponsorDayToDay, setSponsorDayToDay] = useState("");
  const [sponsorTeamCulture, setSponsorTeamCulture] = useState("");
  const [sponsorIdealCandidate, setSponsorIdealCandidate] = useState("");
  const [sponsorInsiderInsights, setSponsorInsiderInsights] = useState("");

  // Create Listing Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [published, setPublished] = useState(false);

  const handleOpenModal = (job: JobPosting) => {
    setSelectedJob(job);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSponsorshipStep(1);
    setSelectedJob(null);
    setRelationship(null);
    setCanRefer(null);
    setSponsorDayToDay("");
    setSponsorTeamCulture("");
    setSponsorIdealCandidate("");
    setSponsorInsiderInsights("");
  };

  const handleConfirmSponsorship = async () => {
    if (!selectedJob || !relationship || canRefer === null) {
      console.warn("[JobsView] Missing required sponsorship data");
      return;
    }

    try {
      setIsSponsoring(true);
      console.log("[JobsView] Sponsoring job:", selectedJob.id);
      trackJobSponsorStarted({ silverJobId: selectedJob.id });
      const response = await sponsorJob(selectedJob.id, {
        relationship,
        canRefer,
        insights: {
          dayToDay: sponsorDayToDay,
          teamCulture: sponsorTeamCulture,
          idealCandidate: sponsorIdealCandidate,
          insiderInsights: sponsorInsiderInsights,
        },
      });
      console.log("[JobsView] Sponsorship successful:", response);
      console.log("[JobsView] New JOB_POSTINGS ID:", response.job_id);
      const insightsCount = [
        sponsorDayToDay,
        sponsorTeamCulture,
        sponsorIdealCandidate,
        sponsorInsiderInsights,
      ].filter((v) => v && v.trim().length > 0).length;
      trackJobSponsored({
        silverJobId: selectedJob.id,
        newJobId: response.job_id,
        relationship,
        canRefer,
        insightsCount,
      });

      // Track sponsored job with BOTH IDs:
      // - jobId: JOB_POSTINGS ID (for API calls like likeProfile)
      // - atsJobId: SILVER_JOBS ID (for UI tracking/marking as sponsored)
      addSponsoredJob({
        jobId: response.job_id, // Use the NEW JOB_POSTINGS ID from backend
        atsJobId: selectedJob.id, // Store original ATS job ID
        title: selectedJob.title,
        company: selectedJob.company,
        // Brand-new sponsored job — no applicants yet by definition.
        likesCount: 0,
      });
      // Explicitly set the just-sponsored job as active. The store's
      // addSponsoredJob no longer auto-switches active when something is
      // already set, so we have to do it here to preserve the
      // "just-sponsored becomes the HomeView focus" behavior.
      setActiveSponsoredJobId(response.job_id);

      // Update the job to mark it as sponsored (optimistic)
      const updatedJobs = jobs.map((job) =>
        job.id === selectedJob.id ? { ...job, isSponsored: true } : job,
      );
      setJobs(updatedJobs);

      // Refresh "My Sponsored" list in background so badge + tab are instantly current
      refreshMyJobs(false);

      // Move to success step
      setSponsorshipStep(3);
    } catch (err) {
      console.warn("[JobsView] Failed to sponsor job:", err);
      // You could show an error message to the user here
      showToast("Failed to sponsor job. Please try again.", "error");
    } finally {
      setIsSponsoring(false);
    }
  };

  const openCreateModal = () => {
    trackJobCreateFromUrlStarted();
    setPublished(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setPublished(false);
    setIsCreatingJob(false);
  };

  const handlePublishJob = async (payload: CreateJobPublishPayload) => {
    if (__DEV__) {
      console.log("[JobsView] create-from-url payload", {
        url: payload.url,
        hasStructured: !!payload.structured,
        structuredTitle: payload.structured?.title,
        structuredCompany: payload.structured?.company,
        structuredDescriptionPreview:
          payload.structured?.description?.slice(0, 220) || "",
        rawTextLength: payload.rawText.length,
      });
    }

    try {
      setIsCreatingJob(true);
      const response = await createJobFromUrl(payload);
      console.log("[JobsView] Job created from URL:", response);
      const { dayToDay, teamCulture, idealCandidate, insiderInsights } =
        payload.insights;
      const hasInsights = [
        dayToDay,
        teamCulture,
        idealCandidate,
        insiderInsights,
      ].some((v) => v && v.trim().length > 0);
      trackJobCreatedFromUrl({
        jobId: response.job_id,
        source: response.source ?? "unknown",
        hasInsights,
      });

      // Refresh "My Sponsored" so the badge + tab reflect the new posting
      refreshMyJobs(false);

      setPublished(true);

      // If the backend used the LLM fallback path (no JSON-LD on the page),
      // nudge the sponsor to double-check the auto-extracted fields. The
      // structured path is high-confidence and doesn't need this hint.
      if (response.source === "llm") {
        showToast(
          "Job published. Auto-extracted by AI — review the listing in My Jobs.",
          "success",
        );
      } else {
        showToast("Job listing published.", "success");
      }
    } catch (err) {
      console.warn("[JobsView] Failed to create job from URL:", err);

      // The LLM extraction path is rate-limited at 10 req/hour per user
      // (PR #40). When the throttle trips we want to be explicit so the
      // sponsor knows (a) what hit and (b) the workaround — pasting a
      // Greenhouse / Lever / Workday URL takes the structured path which
      // doesn't count against the throttle.
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimited =
        msg.includes("429") ||
        msg.toLowerCase().includes("throttl") ||
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("too many");

      trackJobCreateFromUrlFailed({
        reason: msg || "unknown",
        rateLimited: isRateLimited,
      });

      if (isRateLimited) {
        showToast(
          "AI extraction limit reached. Try again in an hour, or paste a Greenhouse / Lever link (those skip AI).",
          "error",
        );
      } else {
        showToast("Failed to publish job listing. Please try again.", "error");
      }
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleDoneCreatingJob = () => {
    closeCreateModal();
    setActiveTab("sponsored");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {/* "Jobs" matches the bottom-nav label — the screen and the tab
                that opens it should say the same thing. Create Listing is a
                compact header action now: sponsoring existing ATS listings
                is the primary path, creating is the fallback (it keeps its
                full-size button inside the empty states, where it IS the
                primary action). */}
            <Text style={styles.title}>Jobs</Text>
            <TouchableOpacity
              style={styles.createAction}
              activeOpacity={0.85}
              onPress={openCreateModal}
            >
              <Plus color="#FFF" size={15} strokeWidth={3} />
              <Text style={styles.createActionText}>Create</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Manage your listings and find the right talent
          </Text>
        </View>

        {isLoading && jobs.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.loadingContainer}
          >
            <ActivityIndicator size="small" color={Colors.muted} />
            <Text style={styles.loadingText}>Finding opportunities...</Text>
          </Animated.View>
        ) : error ? (
          <JobsEmptyState
            icon={<Zap size={28} color="#000" strokeWidth={2} />}
            title="Something went wrong"
            description="We couldn't load jobs right now. Please try again in a moment."
            actionText="Retry"
            onAction={() => {
              const loadJobs = async () => {
                try {
                  setLoading(true);
                  const response = await browseJobs({ limit: 50 });
                  setJobs(
                    transformBrowseResponse(
                      response.jobs,
                      sponsoredJobs,
                    ),
                  );
                } catch (err) {
                  console.warn("Failed to fetch jobs:", err);
                  setError(
                    err instanceof Error ? err.message : "Failed to fetch jobs",
                  );
                } finally {
                  setLoading(false);
                }
              };
              loadJobs();
            }}
          />
        ) : (
          <>
            {/* Action bar — iOS-style segmented control toggling the
                Browse / My Sponsored tabs. */}
            <View style={styles.actionBar}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segment,
                    activeTab === "browse" && styles.segmentActive,
                  ]}
                  onPress={() => setActiveTab("browse")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeTab === "browse" && styles.segmentTextActive,
                    ]}
                  >
                    Browse
                  </Text>
                  <View
                    style={[
                      styles.segmentBadge,
                      activeTab === "browse" && styles.segmentBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBadgeText,
                        activeTab === "browse" && styles.segmentBadgeTextActive,
                      ]}
                    >
                      {jobs.length}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segment,
                    activeTab === "sponsored" && styles.segmentActive,
                  ]}
                  onPress={() => setActiveTab("sponsored")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeTab === "sponsored" && styles.segmentTextActive,
                    ]}
                  >
                    My Sponsored
                  </Text>
                  <View
                    style={[
                      styles.segmentBadge,
                      activeTab === "sponsored" && styles.segmentBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBadgeText,
                        activeTab === "sponsored" &&
                          styles.segmentBadgeTextActive,
                      ]}
                    >
                      {myJobs.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Browse Jobs Tab */}
            {activeTab === "browse" && (
              <BrowseJobsTab
                jobs={jobs}
                sponsorCompany={sponsorCompany}
                companySuggestions={companySuggestions}
                applyingCompany={applyingCompany}
                onApplyCompany={handleApplyCompany}
                onOpenCreateModal={openCreateModal}
                searchQuery={searchQuery}
                onSetSearchQuery={setSearchQuery}
                displayLimit={displayLimit}
                onLoadMore={() => setDisplayLimit((prev) => prev + 20)}
                showSponsoredInBrowse={showSponsoredInBrowse}
                onToggleSponsoredInBrowse={() =>
                  setShowSponsoredInBrowse((s) => !s)
                }
                onSponsor={handleOpenModal}
                onPressJob={setViewJobDetails}
                onMenuJob={setMenuJob}
                onApplicantPress={handleApplicantPress}
              />
            )}

            {/* Sponsored Jobs Tab */}
            {activeTab === "sponsored" && (
              <SponsoredJobsTab
                myJobs={myJobs}
                isLoading={isMyJobsLoading}
                onBrowse={() => setActiveTab("browse")}
                onPressJob={setViewJobDetails}
                onMenuJob={setMenuJob}
                onApplicantPress={handleApplicantPress}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Sponsorship Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <SponsorJobModal
          job={selectedJob}
          flow={{
            step: sponsorshipStep,
            relationship,
            canRefer,
            isSponsoring,
            dayToDay: sponsorDayToDay,
            teamCulture: sponsorTeamCulture,
            idealCandidate: sponsorIdealCandidate,
            insiderInsights: sponsorInsiderInsights,
          }}
          onClose={closeModal}
          onSetStep={setSponsorshipStep}
          onSetRelationship={setRelationship}
          onSetCanRefer={setCanRefer}
          onSetDayToDay={setSponsorDayToDay}
          onSetTeamCulture={setSponsorTeamCulture}
          onSetIdealCandidate={setSponsorIdealCandidate}
          onSetInsiderInsights={setSponsorInsiderInsights}
          onConfirm={handleConfirmSponsorship}
        />
      </Modal>

      {/* Create-from-URL flow: pushed full-screen editor (matches
          Account/Edit Profile) instead of a chain of modals. */}
      <CreateJobFlowScreen
        visible={showCreateModal}
        onClose={closeCreateModal}
        isPublishing={isCreatingJob}
        onPublish={handlePublishJob}
        published={published}
        onDone={handleDoneCreatingJob}
      />

      {/* Menu Modal */}
      <Modal
        visible={!!menuJob}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <JobMenuModal
          job={menuJob}
          activeTab={activeTab}
          showUnsponsorReasons={showUnsponsorReasons}
          onShowUnsponsorReasons={() => setShowUnsponsorReasons(true)}
          unsponsorReason={unsponsorReason}
          onSetUnsponsorReason={setUnsponsorReason}
          unsponsorReasonDetail={unsponsorReasonDetail}
          onSetUnsponsorReasonDetail={setUnsponsorReasonDetail}
          onUnsponsor={handleUnsponsor}
          showLogoEditor={showLogoEditor}
          onOpenLogoEditor={() => {
            // Seed the input with whatever logo the card is showing right
            // now so the sponsor can edit it instead of re-typing from
            // scratch.
            setLogoUrlInput(menuJob?.image || "");
            setShowLogoEditor(true);
          }}
          logoUrlInput={logoUrlInput}
          onSetLogoUrlInput={setLogoUrlInput}
          isSavingLogo={isSavingLogo}
          onSaveLogoUrl={handleSaveLogoUrl}
          onClose={closeMenu}
        />
      </Modal>

      {/* Job Details Modal */}
      <Modal visible={!!viewJobDetails} transparent animationType="none">
        <JobDetailsModal
          job={viewJobDetails}
          isUnsponsoringId={isUnsponsoringId}
          resolveJobPostingsId={(job) => {
            const sponsoredEntry = sponsoredJobs.find(
              (sj) => sj.atsJobId === job.id || sj.jobId === job.id,
            );
            return sponsoredEntry?.jobId ?? job.id;
          }}
          onRemoveSponsorship={(jobPostingsId, job) => {
            setIsUnsponsoringId(jobPostingsId);
            removeMyJob(jobPostingsId);
            setJobs(
              jobs.map((j) =>
                j.id === job.id ? { ...j, isSponsored: false } : j,
              ),
            );
            setViewJobDetails(null);
            unsponsorJob(jobPostingsId)
              .catch((err) => {
                console.warn("[JobsView] Failed to unsponsor:", err);
                refreshMyJobs(false);
                showToast(
                  "Failed to remove sponsorship. Please try again.",
                  "error",
                );
              })
              .finally(() => setIsUnsponsoringId(null));
          }}
          onSponsor={(job) => {
            setViewJobDetails(null);
            setTimeout(() => {
              handleOpenModal(job);
            }, 50);
          }}
          onClose={() => setViewJobDetails(null)}
        />
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedApplicantJob}
        onRequestClose={() => {
          setSelectedApplicantJob(null);
          setJobApplicants([]);
          setApplicantsError(null);
        }}
      >
        <TopApplicantsModal
          applicants={jobApplicants}
          isLoading={isLoadingApplicants}
          error={applicantsError}
          onSelectApplicant={(applicant) => {
            setSelectedApplicantJob(null);
            setTimeout(() => {
              openMessagingModal(applicant);
            }, 100);
          }}
          onClose={() => {
            setSelectedApplicantJob(null);
            setJobApplicants([]);
            setApplicantsError(null);
          }}
        />
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!showSponsorGate}
        onRequestClose={() => setShowSponsorGate(null)}
      >
        <SponsorGateModal
          onSponsorNow={() => {
            const job = showSponsorGate;
            setShowSponsorGate(null);
            if (job) handleOpenModal(job);
          }}
          onClose={() => setShowSponsorGate(null)}
        />
      </Modal>

      {/* Top Applicants → Applicant Detail Sheet — sponsor reviews an
          applicant who liked their role. Powered by the shared
          ProfileDetailSheet (matches MatchesView's layout exactly). The
          primary CTA flips the like pair to MATCHED via likeProfile(). */}
      {selectedApplicantForMessage && (
        <ProfileDetailSheet
          visible={!!selectedApplicantForMessage}
          onDismiss={() => {
            setSelectedApplicantForMessage(null);
            setMatchJobPostingsId(null);
            setMessage("");
            setActiveSlide(0);
          }}
          userId={selectedApplicantForMessage.id}
          variant="applicant"
          initial={{
            name: selectedApplicantForMessage.name,
            image: selectedApplicantForMessage.image,
            role: selectedApplicantForMessage.role,
            company: selectedApplicantForMessage.company,
          }}
          badge={
            selectedApplicantForMessage.status === "MATCHED"
              ? // Monochrome to match the "Matched" tag on the list row.
                { label: "Matched", color: "#000", bgColor: "#F4F4F5" }
              : { label: "Liked your role" }
          }
          roleContext={
            selectedApplicantForMessage.appliedRole
              ? {
                  label: "INTERESTED IN",
                  title: selectedApplicantForMessage.appliedRole,
                }
              : undefined
          }
          primaryCta={
            selectedApplicantForMessage.status === "MATCHED"
              ? {
                  // Already matched — show an inert status button rather
                  // than asking the sponsor to match again.
                  label: "Matched",
                  icon: (
                    <CheckCircle color="#FFF" size={18} strokeWidth={2.5} />
                  ),
                  disabled: true,
                  onPress: () => {},
                }
              : {
                  label: `Match with ${selectedApplicantForMessage.name.split(" ")[0]}`,
                  icon: (
                    <CheckCircle color="#FFF" size={18} strokeWidth={2.5} />
                  ),
                  loading: isMatching,
                  disabled: !matchJobPostingsId,
                  onPress: async () => {
                    if (!matchJobPostingsId) return;
                    const applicant = selectedApplicantForMessage;
                    if (!applicant) return;
                    setIsMatching(true);
                    try {
                      const result = await likeProfile(
                        applicant.id,
                        matchJobPostingsId,
                      );
                      const firstName =
                        applicant.name.split(" ")[0] || "this applicant";
                      if (result.matched) {
                        showToast(
                          `Matched with ${firstName}! Find them in your Matches.`,
                          "success",
                        );
                      } else {
                        showToast(
                          result.message || "Interest sent.",
                          "success",
                        );
                      }
                      setSelectedApplicantForMessage(null);
                      setMatchJobPostingsId(null);
                      setMessage("");
                      setActiveSlide(0);
                    } catch (err) {
                      console.warn("[JobsView] Match failed:", err);
                      showToast(
                        err instanceof Error
                          ? err.message
                          : "Couldn't match. Please try again.",
                        "error",
                      );
                    } finally {
                      setIsMatching(false);
                    }
                  },
                }
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 20 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...Type.title, color: Colors.ink },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    color: Colors.body,
    marginTop: 6,
  },
  createAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  createActionText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: "600",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  segmentedControl: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: "#000",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.body,
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    color: "#FFF",
  },
  segmentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    minWidth: 20,
    alignItems: "center",
  },
  segmentBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  segmentBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.body,
  },
  segmentBadgeTextActive: {
    color: "#FFF",
  },
});
