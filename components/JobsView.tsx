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
  browseJobs,
  createJobFromUrl,
  getJobApplicantsLikes,
  getMyJobs,
  likeProfile,
  sponsorJob,
  unsponsorJob,
  updateJob,
} from "@/lib/api";
import { useJobsStore } from "@/stores/useJobsStore";
import { useToastStore } from "@/stores/useToastStore";
import type { BrowseJobResponse, Job } from "@/types/jobs";
import { formatSalary, parseEmploymentType } from "@/types/jobs";
import { BlurView } from "expo-blur";
import {
  Briefcase,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Globe,
  Image as ImageIcon,
  Info,
  Lock,
  MapPin,
  MoreHorizontal,
  Plus,
  Sparkles,
  ThumbsDown,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  ScrollView,
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
} from "react-native-reanimated";
import { WebView } from "react-native-webview";
import { CompanyLogo } from "./ui/CompanyLogo";
import { DismissibleSheet } from "./ui/DismissibleSheet";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";
import { tokens } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

interface SponsorInfo {
  name: string;
  role: string;
  image: string;
  canRefer: boolean;
}

// Empty State Component
const EmptyState = ({
  icon,
  title,
  description,
  actionText,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}) => (
  <Animated.View
    entering={FadeIn.duration(400)}
    style={styles.emptyStateContainer}
  >
    <View style={styles.emptyStateIconContainer}>{icon}</View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateDescription}>{description}</Text>
    {actionText && onAction && (
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={onAction}
        activeOpacity={0.8}
      >
        <Text style={styles.emptyStateButtonText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </Animated.View>
);

interface Applicant {
  id: string;
  name: string;
  role: string;
  company: string;
  image: string;
  matchScore: number;
  experience: string;
  skills: string[];
  appliedRole: string;
  // Like status from getJobApplicantsLikes — "MATCHED" means the sponsor has
  // already matched with this applicant, so the detail sheet shows an inert
  // "Matched" status instead of a "Match with…" CTA.
  status?: "ACTIVE" | "MATCHED";
  // Enriched fields populated from `getPublicProfile` when the sponsor taps
  // the message icon. The lightweight list endpoint doesn't include these.
  bio?: string;
  location?: string;
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

// Reasons a sponsor can pick when unsponsoring a job. `value` is sent to the
// backend (see §12 in docs/BACKEND_CHANGES_NEEDED.md) — "posting_expired" and
// "role_filled" in particular let the backend prune stale ATS listings.
const UNSPONSOR_REASONS: { value: string; label: string }[] = [
  { value: "role_filled", label: "The role has been filled" },
  { value: "posting_expired", label: "The job posting expired or was closed" },
  { value: "cannot_refer", label: "I can no longer refer for this role" },
  { value: "poor_applicant_fit", label: "Not getting the right applicants" },
  { value: "wrong_role", label: "I sponsored the wrong role" },
  { value: "other", label: "Other" },
];

/** Robustly parse a skills/requirements string that may be a JSON array or comma-separated list. */
function parseSkillsField(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
      }
    } catch {}
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Clean rich/HTML-ish job text so UI surfaces render human-readable copy.
 * We keep line breaks for long-form fields and collapse noisy whitespace.
 */
function cleanJobText(raw: string | null | undefined): string {
  if (!raw) return "";
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ");

  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  return decoded
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Format raw experience level values (e.g. "2-5", "5+", "0-2") into readable labels. */
function formatExperienceLevel(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  if (!s || s.toLowerCase() === "null") return "";
  // Already human-readable (contains letters beyond a pure digit/range/plus)
  if (/[a-zA-Z]/.test(s)) return s;
  // Numeric ranges from SILVER_JOBS
  if (s === "0-2") return "Entry Level (0–2 yrs)";
  if (s === "2-5") return "Mid-Level (2–5 yrs)";
  if (s === "5+") return "Senior (5+ yrs)";
  return s;
}

// Extend Job type with UI-specific fields (JobPosting is now just an alias)
type JobPosting = Job;

export function JobsView() {
  // Zustand store
  const jobs = useJobsStore((state) => state.jobs);
  const isLoading = useJobsStore((state) => state.isLoading);
  const error = useJobsStore((state) => state.error);
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

  const [activeTab, setActiveTab] = useState<"browse" | "sponsored">("browse");
  const [displayLimit, setDisplayLimit] = useState(20);

  // Fetch browse jobs on mount.
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLoading(true);
        console.log("[JobsView] Fetching browse jobs for sponsor");
        trackBrowseJobsViewed();
        const response = await browseJobs({ limit: 50 });
        console.log("[JobsView] Browse response:", response);

        // Transform SILVER_JOBS (browse) response to Job format
        const transformedJobs: Job[] = response.jobs.map(
          (job: BrowseJobResponse) => {
            // Check if this job was already sponsored (check by ATS job ID)
            const isSponsored = sponsoredJobs.some(
              (sj) => sj.atsJobId === job.JOB_ID,
            );

            return {
              id: job.JOB_ID,
              title: job.TITLE,
              company: job.ORGANIZATION,
              location: job.FULL_LOCATION,
              locations: [job.FULL_LOCATION],
              type: parseEmploymentType(job.EMPLOYMENT_TYPES),
              salary:
                formatSalary(
                  job.SALARY_ANNUAL_MIN,
                  job.SALARY_ANNUAL_MAX,
                  job.SALARY_CURRENCY,
                ) !== "Salary not specified"
                  ? formatSalary(
                      job.SALARY_ANNUAL_MIN,
                      job.SALARY_ANNUAL_MAX,
                      job.SALARY_CURRENCY,
                    )
                  : "Competitive",
              salaryMin: job.SALARY_ANNUAL_MIN,
              salaryMax: job.SALARY_ANNUAL_MAX,
              salaryCurrency: job.SALARY_CURRENCY || "USD",
              postedAt: new Date(job.DATE_POSTED).toLocaleDateString(),
              description: cleanJobText(job.DESCRIPTION_TEXT),
              summary: cleanJobText(job.DESCRIPTION_TEXT).substring(0, 150),
              skills: parseSkillsField(job.SKILLS),
              highlights: [],
              experienceLevel: formatExperienceLevel(job.EXPERIENCE_LEVEL),
              workArrangement: job.IS_REMOTE ? "Remote" : "On-site",
              isRemote: job.IS_REMOTE,
              url: "",
              applicants: 0,
              // PR #62 — ORGANIZATION_LOGO resolved by Logo.dev pipeline.
              // Fall back to the generic Unsplash placeholder so existing
              // cards never render with a broken image.
              image:
                job.ORGANIZATION_LOGO ||
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
              currentSponsors: [],
              benefits: [],
              isSponsored, // Mark based on Zustand store
            };
          },
        );

        console.log("[JobsView] Transformed jobs:", transformedJobs.length);
        console.log(
          "[JobsView] Sponsored jobs from store:",
          sponsoredJobs.length,
        );
        setJobs(transformedJobs);
      } catch (err) {
        console.warn("Failed to fetch browse jobs:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
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

  // Shared helper — fetch sponsor's own jobs and update store
  const refreshMyJobs = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setMyJobsLoading(true);
      const response = await getMyJobs();
      const transformed: Job[] = response.jobs.map((j: any) => ({
        id: j.JOB_ID,
        title: j.TITLE,
        company: j.COMPANY,
        location: j.LOCATION,
        locations: [j.LOCATION],
        type: parseEmploymentType(j.EMPLOYMENT_TYPE),
        salary:
          j.SALARY_MIN && j.SALARY_MAX
            ? formatSalary(
                j.SALARY_MIN,
                j.SALARY_MAX,
                j.SALARY_CURRENCY || "USD",
              )
            : "Competitive",
        salaryMin: j.SALARY_MIN ?? null,
        salaryMax: j.SALARY_MAX ?? null,
        salaryCurrency: j.SALARY_CURRENCY || "USD",
        postedAt: j.CREATED_AT
          ? new Date(j.CREATED_AT).toLocaleDateString()
          : "",
        description: cleanJobText(j.DESCRIPTION),
        summary: cleanJobText(j.DESCRIPTION).substring(0, 150),
        skills: parseSkillsField(cleanJobText(j.REQUIREMENTS)),
        requirements: cleanJobText(j.REQUIREMENTS),
        highlights: [],
        experienceLevel: formatExperienceLevel(j.EXPERIENCE_LEVEL),
        workArrangement: j.REMOTE_OPTION ? "Remote" : "On-site",
        isRemote: j.REMOTE_OPTION,
        url: "",
        applicants: j.LIKES_COUNT ?? 0,
        image:
          j.LOGO_URL ||
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
        currentSponsors: [],
        benefits: [],
        isSponsored: true,
      }));
      setMyJobs(transformed);
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
    } catch (err) {
      console.warn("[JobsView] Failed to unsponsor job:", err);
      // Revert by re-fetching the real list from backend
      refreshMyJobs(false);
      showToast("Failed to remove sponsorship. Please try again.", "error");
    } finally {
      setIsUnsponsoringId(null);
    }
  };

  // Fetch real sponsored jobs from backend whenever the "My Sponsored" tab is opened
  useEffect(() => {
    if (activeTab !== "sponsored") return;
    refreshMyJobs();
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
        response.jobs.forEach((j: any) => {
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
        const transformed: Job[] = response.jobs.map((j: any) => ({
          id: j.JOB_ID,
          title: j.TITLE,
          company: j.COMPANY,
          location: j.LOCATION,
          locations: [j.LOCATION],
          type: parseEmploymentType(j.EMPLOYMENT_TYPE),
          salary:
            j.SALARY_MIN && j.SALARY_MAX
              ? formatSalary(
                  j.SALARY_MIN,
                  j.SALARY_MAX,
                  j.SALARY_CURRENCY || "USD",
                )
              : "Competitive",
          salaryMin: j.SALARY_MIN ?? null,
          salaryMax: j.SALARY_MAX ?? null,
          salaryCurrency: j.SALARY_CURRENCY || "USD",
          postedAt: j.CREATED_AT
            ? new Date(j.CREATED_AT).toLocaleDateString()
            : "",
          description: cleanJobText(j.DESCRIPTION),
          summary: cleanJobText(j.DESCRIPTION).substring(0, 150),
          skills: parseSkillsField(cleanJobText(j.REQUIREMENTS)),
          requirements: cleanJobText(j.REQUIREMENTS),
          highlights: [],
          experienceLevel: formatExperienceLevel(j.EXPERIENCE_LEVEL),
          workArrangement: j.REMOTE_OPTION ? "Remote" : "On-site",
          isRemote: j.REMOTE_OPTION,
          url: "",
          applicants: j.LIKES_COUNT ?? 0,
          image:
            j.LOGO_URL ||
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
          currentSponsors: [],
          benefits: [],
          isSponsored: true,
        }));
        setMyJobs(transformed);
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
  const [createFlowStep, setCreateFlowStep] = useState<
    "url" | "webview" | "insights"
  >("url");
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [webviewLoading, setWebviewLoading] = useState(false);
  const [webviewCanGoBack, setWebviewCanGoBack] = useState(false);
  const [webviewCanGoForward, setWebviewCanGoForward] = useState(false);
  const [insiderInsights, setInsiderInsights] = useState("");
  const [dayToDay, setDayToDay] = useState("");
  const [teamCulture, setTeamCulture] = useState("");
  const [idealCandidate, setIdealCandidate] = useState("");
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [jobScrapedData, setJobScrapedData] = useState<{
    url: string;
    structured: Record<string, string | null> | null;
    rawText: string;
  } | null>(null);

  const previewWebViewRef = useRef<WebView>(null);

  // Injected JS: tries JSON-LD JobPosting schema (Option 3) first,
  // supplements with OG meta tags, then falls back to body.innerText (Option 1).
  const jobScrapingScript = `
    (function() {
      try {
        var structured = null;

        // --- Option 3: JSON-LD structured data ---
        var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (var i = 0; i < ldScripts.length; i++) {
          try {
            var parsed = JSON.parse(ldScripts[i].textContent || ldScripts[i].innerText || '');
            var items = Array.isArray(parsed) ? parsed : [parsed];
            for (var j = 0; j < items.length; j++) {
              var item = items[j];
              if (item['@type'] === 'JobPosting') {
                var salaryNode = item.baseSalary;
                var salaryStr = null;
                if (salaryNode && salaryNode.value) {
                  var sv = salaryNode.value;
                  salaryStr = (sv.minValue || '') + (sv.maxValue ? ' - ' + sv.maxValue : '') + (salaryNode.currency ? ' ' + salaryNode.currency : '');
                  salaryStr = salaryStr.trim() || null;
                }
                var locNode = item.jobLocation;
                var locStr = null;
                if (locNode) {
                  var addr = Array.isArray(locNode) ? locNode[0] : locNode;
                  if (addr && addr.address) {
                    locStr = [addr.address.addressLocality, addr.address.addressRegion, addr.address.addressCountry]
                      .filter(Boolean).join(', ') || null;
                  }
                }
                structured = {
                  title: item.title || null,
                  company: (item.hiringOrganization && item.hiringOrganization.name) || null,
                  location: locStr,
                  description: item.description || null,
                  employmentType: item.employmentType || null,
                  salary: salaryStr,
                  datePosted: item.datePosted || null,
                };
                break;
              }
            }
            if (structured) break;
          } catch(e) {}
        }

        // --- Supplement / fallback: OG + standard meta tags ---
        if (!structured) {
          var getMeta = function(sel) {
            var el = document.querySelector(sel);
            return el ? (el.getAttribute('content') || null) : null;
          };
          var ogTitle = getMeta('meta[property="og:title"]') || getMeta('meta[name="title"]');
          var ogDesc  = getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]');
          var ogSite  = getMeta('meta[property="og:site_name"]');
          if (ogTitle || ogDesc) {
            structured = {
              title: ogTitle,
              company: ogSite,
              location: null,
              description: ogDesc,
              employmentType: null,
              salary: null,
              datePosted: null,
            };
          }
        }

        // --- Option 1: Raw visible text fallback ---
        var rawText = (document.body && document.body.innerText) || '';
        if (rawText.length > 60000) rawText = rawText.slice(0, 60000);

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'JOB_CONTENT_SCRAPED',
          data: {
            url: window.location.href,
            structured: structured,
            rawText: rawText,
          }
        }));
      } catch(err) {
        // Last-resort: at least send the URL and whatever text we can get
        var fallbackText = '';
        try { fallbackText = (document.body && document.body.innerText.slice(0, 60000)) || ''; } catch(e2) {}
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'JOB_CONTENT_SCRAPED',
          data: {
            url: window.location.href,
            structured: null,
            rawText: fallbackText,
          }
        }));
      }
      true;
    })();
  `;

  const isFormComplete = relationship !== null && canRefer !== null;

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
    setCreateFlowStep("url");
    setJobUrlInput("");
    setPreviewUrl("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFlowStep("url");
    setJobUrlInput("");
    setPreviewUrl("");
    setWebviewLoading(false);
    setWebviewCanGoBack(false);
    setWebviewCanGoForward(false);
    setInsiderInsights("");
    setDayToDay("");
    setTeamCulture("");
    setIdealCandidate("");
    setIsCreatingJob(false);
    setIsScraping(false);
    setJobScrapedData(null);
  };

  const handlePreviewJob = () => {
    let url = jobUrlInput.trim();
    if (url && !url.startsWith("http")) url = "https://" + url;
    setPreviewUrl(url);
    setWebviewLoading(true);
    setCreateFlowStep("webview");
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "JOB_CONTENT_SCRAPED") {
        const payload = msg.data as {
          url: string;
          structured: Record<string, string | null> | null;
          rawText: string;
        };
        setJobScrapedData(payload);
        setIsScraping(false);

        // ── Dev logging ─────────────────────────────────────────────────────
        console.log("[CreateJob] ✅ Job content scraped successfully");
        console.log("[CreateJob] URL:", payload.url);
        if (payload.structured) {
          console.log(
            "[CreateJob] Structured data (JSON-LD / OG):",
            JSON.stringify(payload.structured, null, 2),
          );
        } else {
          console.log(
            "[CreateJob] No structured data found — using raw text only.",
          );
        }
        console.log(
          "[CreateJob] Raw text preview (first 500 chars):\n",
          payload.rawText.slice(0, 500),
        );
        console.log("[CreateJob] Full payload ready to send to backend:", {
          url: payload.url,
          hasStructured: !!payload.structured,
          rawTextLength: payload.rawText.length,
        });
        // ────────────────────────────────────────────────────────────────────

        // Advance to insights step
        setCreateFlowStep("insights");
      }
    } catch {
      // Non-JSON messages from the page itself — ignore
    }
  };

  const handleConfirmJob = () => {
    setIsScraping(true);
    previewWebViewRef.current?.injectJavaScript(jobScrapingScript);
  };

  const handleCreateJob = async () => {
    const cleanedStructured: Record<string, string | null> | null =
      jobScrapedData?.structured
        ? {
            ...jobScrapedData.structured,
            // JSON-LD descriptions often contain inline HTML.
            description: cleanJobText(jobScrapedData.structured.description),
          }
        : null;

    const payload = {
      url: jobScrapedData?.url ?? previewUrl,
      structured: cleanedStructured,
      rawText: jobScrapedData?.rawText ?? "",
      insights: { dayToDay, teamCulture, idealCandidate, insiderInsights },
    };

    if (__DEV__) {
      const structuredForLog = payload.structured as Record<
        string,
        string | null
      > | null;
      console.log("[JobsView] create-from-url payload", {
        url: payload.url,
        hasStructured: !!structuredForLog,
        structuredTitle: structuredForLog?.title,
        structuredCompany: structuredForLog?.company,
        structuredDescriptionPreview:
          structuredForLog?.description?.slice(0, 220) || "",
        rawTextLength: payload.rawText.length,
      });
    }

    try {
      setIsCreatingJob(true);
      const response = await createJobFromUrl(payload);
      console.log("[JobsView] Job created from URL:", response);
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

      closeCreateModal();

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

  // Validation for each step
  const canProceedStep3 = true; // insights are all optional

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Job Board</Text>
          <Text style={styles.subtitle}>
            Manage your listings and find the right talent
          </Text>
        </View>

        <Animated.View entering={FadeInDown.duration(300)}>
          <TouchableOpacity
            style={styles.createButton}
            activeOpacity={0.9}
            onPress={openCreateModal}
          >
            <Plus color={tokens.colors.brandText} size={20} strokeWidth={3} />
            <Text style={styles.createButtonText}>Create Listing</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          style={styles.sectionTitleRow}
        >
          <Text style={styles.listSectionTitle}>Available Jobs</Text>
        </Animated.View>

        {isLoading ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.loadingContainer}
          >
            <View style={styles.loadingSpinner}>
              <Sparkles size={32} color={tokens.colors.text} />
            </View>
            <Text style={styles.loadingText}>Finding opportunities...</Text>
          </Animated.View>
        ) : error ? (
          <EmptyState
            icon={<Zap size={40} color={tokens.colors.text} strokeWidth={2.5} />}
            title="Something went wrong"
            description="We couldn't load jobs right now. Please try again in a moment."
            actionText="Retry"
            onAction={() => {
              const loadJobs = async () => {
                try {
                  setLoading(true);
                  const response = await browseJobs({ limit: 50 });
                  const transformedJobs: Job[] = response.jobs.map(
                    (job: BrowseJobResponse) => ({
                      id: job.JOB_ID,
                      title: job.TITLE,
                      company: job.ORGANIZATION,
                      location: job.FULL_LOCATION,
                      locations: [job.FULL_LOCATION],
                      type: job.EMPLOYMENT_TYPES || "Full-time",
                      salary:
                        job.SALARY_ANNUAL_MIN && job.SALARY_ANNUAL_MAX
                          ? `$${Math.round(job.SALARY_ANNUAL_MIN / 1000)}k - $${Math.round(job.SALARY_ANNUAL_MAX / 1000)}k`
                          : "Competitive",
                      salaryMin: job.SALARY_ANNUAL_MIN,
                      salaryMax: job.SALARY_ANNUAL_MAX,
                      salaryCurrency: job.SALARY_CURRENCY || "USD",
                      postedAt: new Date(job.DATE_POSTED).toLocaleDateString(),
                      description: job.DESCRIPTION_TEXT,
                      summary: job.DESCRIPTION_TEXT.substring(0, 150) + "...",
                      requirements: "",
                      experienceLevel: job.EXPERIENCE_LEVEL || "Not specified",
                      skills: job.SKILLS
                        ? job.SKILLS.split(",").map((s) => s.trim())
                        : [],
                      highlights: [],
                      benefits: [],
                      applicationUrl: "",
                      companyLogo: "",
                      isRemote: job.IS_REMOTE || false,
                      workArrangement: job.IS_REMOTE ? "Remote" : "On-site",
                      department: "",
                      url: "",
                      applicants: 0,
                      image: job.ORGANIZATION_LOGO || "",
                      currentSponsors: [],
                      isSponsored: false,
                    }),
                  );
                  setJobs(transformedJobs);
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
              <>
                {jobs.length === 0 ? (
                  <EmptyState
                    icon={
                      <Briefcase size={40} color={tokens.colors.text} strokeWidth={2.5} />
                    }
                    title="No available jobs"
                    description="Check back soon for new opportunities, or create your own listing."
                    actionText="Create Listing"
                    onAction={openCreateModal}
                  />
                ) : (
                  <>
                    {jobs.slice(0, displayLimit).map((job, index) => (
                      <Animated.View
                        key={job.id}
                        entering={FadeInUp.delay(100 + index * 40).duration(
                          300,
                        )}
                      >
                        <JobCard
                          job={job}
                          isSponsored={job.isSponsored}
                          onSponsor={() => handleOpenModal(job)}
                          onPress={() => setViewJobDetails(job)}
                          onMenu={() => setMenuJob(job)}
                          onApplicantPress={() => handleApplicantPress(job)}
                        />
                      </Animated.View>
                    ))}

                    {/* Load More Button */}
                    {jobs.length > displayLimit && (
                      <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={() => setDisplayLimit((prev) => prev + 20)}
                      >
                        <Text style={styles.loadMoreText}>Load More Jobs</Text>
                        <ChevronRight size={16} color={tokens.colors.text} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            )}

            {/* Sponsored Jobs Tab */}
            {activeTab === "sponsored" && (
              <>
                {isMyJobsLoading ? (
                  <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.simpleEmptyState}
                  >
                    <Sparkles size={24} color={tokens.colors.textMuted} strokeWidth={2.5} />
                    <View style={styles.simpleEmptyTextContainer}>
                      <Text style={styles.simpleEmptyText}>
                        Loading your sponsored jobs...
                      </Text>
                    </View>
                  </Animated.View>
                ) : myJobs.length === 0 ? (
                  <Animated.View
                    entering={FadeIn.duration(400)}
                    style={styles.simpleEmptyState}
                  >
                    <Sparkles size={24} color={tokens.colors.textMuted} strokeWidth={2.5} />
                    <View style={styles.simpleEmptyTextContainer}>
                      <Text style={styles.simpleEmptyText}>
                        You haven't sponsored any jobs yet
                      </Text>
                      <Text style={styles.simpleEmptySubtext}>
                        Sponsor a listing to unlock applicant profiles and get
                        featured
                      </Text>
                    </View>
                  </Animated.View>
                ) : (
                  myJobs.map((job, index) => (
                    <Animated.View
                      key={job.id}
                      entering={FadeInUp.delay(250 + index * 40).duration(300)}
                    >
                      <JobCard
                        job={job}
                        isSponsored
                        onPress={() => setViewJobDetails(job)}
                        onMenu={() => setMenuJob(job)}
                        onApplicantPress={() => handleApplicantPress(job)}
                      />
                    </Animated.View>
                  ))
                )}
              </>
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
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
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>
                {sponsorshipStep === 1
                  ? "Confirm Sponsorship"
                  : sponsorshipStep === 2
                    ? "Add Insider Insights"
                    : "Sponsorship Active!"}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <X color={tokens.colors.text} size={24} />
              </TouchableOpacity>
            </View>
            {sponsorshipStep === 1 ? (
              <>
                <View style={styles.insightsStepRow}>
                  <View
                    style={[styles.stepDot, styles.stepDotActive, { width: 8 }]}
                  />
                  <View style={styles.stepDot} />
                  <Text style={styles.insightsStepLabel}>Step 1 of 2</Text>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Text style={styles.modalSubTitle}>
                    Help us understand your role and referral capability
                  </Text>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>
                      Your relationship to this role
                    </Text>
                    {["Hiring Manager", "Team Member", "Other"].map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={styles.radioOption}
                        onPress={() => setRelationship(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View
                            style={[
                              styles.radioCircle,
                              relationship === item && styles.radioCircleActive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.radioText,
                              relationship === item && styles.radioTextActive,
                            ]}
                          >
                            {item}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>
                      Can you provide a referral?
                    </Text>
                    <View style={styles.sideBySide}>
                      <TouchableOpacity
                        style={styles.halfOption}
                        onPress={() => setCanRefer(true)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.radioCircle,
                            canRefer === true && styles.radioCircleActive,
                          ]}
                        />
                        <Text
                          style={[
                            styles.radioText,
                            canRefer === true && styles.radioTextActive,
                          ]}
                        >
                          Yes
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.halfOption}
                        onPress={() => setCanRefer(false)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.radioCircle,
                            canRefer === false && styles.radioCircleActive,
                          ]}
                        />
                        <Text
                          style={[
                            styles.radioText,
                            canRefer === false && styles.radioTextActive,
                          ]}
                        >
                          No
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    !isFormComplete && styles.confirmBtnDisabled,
                  ]}
                  disabled={!isFormComplete}
                  onPress={() => setSponsorshipStep(2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmBtnText}>Continue</Text>
                </TouchableOpacity>
              </>
            ) : sponsorshipStep === 2 ? (
              <>
                <View style={styles.insightsStepRow}>
                  <View
                    style={[styles.stepDot, styles.stepDotActive, { width: 8 }]}
                  />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <Text style={styles.insightsStepLabel}>Step 2 of 2</Text>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.modalSubTitle}>
                    Share the inside story that candidates won't find anywhere
                    else. All fields are optional.
                  </Text>

                  <View style={styles.backchannelCallout}>
                    <Text style={styles.backchannelTitle}>
                      💡 Why This Matters
                    </Text>
                    <Text style={styles.backchannelText}>
                      Unlike traditional job boards, BackChannel gives
                      candidates real insider knowledge — which means better
                      applicants and fewer surprises on both sides.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>The Real Day-to-Day</Text>
                    <Text style={styles.fieldHint}>
                      What does this role actually look like beyond the job
                      description?
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Be honest about daily work — meetings, focus time, pace, autonomy..."
                      placeholderTextColor={tokens.colors.textFaint}
                      value={sponsorDayToDay}
                      onChangeText={setSponsorDayToDay}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>
                      Team Culture & Dynamics
                    </Text>
                    <Text style={styles.fieldHint}>
                      Give candidates a real sense of who they'll be working
                      with.
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Team size, seniority mix, remote vs. in-office norms, collaboration style..."
                      placeholderTextColor={tokens.colors.textFaint}
                      value={sponsorTeamCulture}
                      onChangeText={setSponsorTeamCulture}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>
                      Who Actually Thrives Here
                    </Text>
                    <Text style={styles.fieldHint}>
                      What matters more than what's on the resume?
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Mindset, soft skills, working style, previous backgrounds that tend to succeed..."
                      placeholderTextColor={tokens.colors.textFaint}
                      value={sponsorIdealCandidate}
                      onChangeText={setSponsorIdealCandidate}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>
                      Everything Else Worth Knowing
                    </Text>
                    <Text style={styles.fieldHint}>
                      Interview process, growth path, comp notes, anything
                      candidates should know.
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Interview format, timeline, promotion path, equity situation..."
                      placeholderTextColor={tokens.colors.textFaint}
                      value={sponsorInsiderInsights}
                      onChangeText={setSponsorInsiderInsights}
                      multiline
                      numberOfLines={5}
                    />
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    isSponsoring && styles.confirmBtnDisabled,
                  ]}
                  disabled={isSponsoring}
                  onPress={handleConfirmSponsorship}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmBtnText}>
                    {isSponsoring ? "Sponsoring..." : "Confirm Sponsorship"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Animated.View entering={FadeIn} style={styles.successStep}>
                <View style={styles.successIconCircle}>
                  <Check color={tokens.colors.brandText} size={32} strokeWidth={3} />
                </View>
                <Text style={styles.successTitle}>Sponsorship Confirmed!</Text>
                <Text style={styles.successDesc}>
                  You are now sponsoring {selectedJob?.title}. Applicants will
                  be able to see your sponsorship.
                </Text>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmBtnText}>Back to Job Board</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Step 1: URL Entry Modal */}
      <Modal
        visible={showCreateModal && createFlowStep === "url"}
        transparent
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeCreateModal}
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
            style={styles.createModalContent}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>Add a Job</Text>
              <TouchableOpacity
                onPress={closeCreateModal}
                style={styles.closeButton}
              >
                <X color={tokens.colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubTitle}>
              Paste the URL of the job posting you want to add to BackChannel.
            </Text>

            {/* URL Input */}
            <View style={styles.urlInputContainer}>
              <Globe color={tokens.colors.textMuted} size={18} />
              <TextInput
                style={styles.urlTextInput}
                placeholder="https://jobs.company.com/role"
                placeholderTextColor={tokens.colors.textFaint}
                value={jobUrlInput}
                onChangeText={setJobUrlInput}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={
                  jobUrlInput.trim() ? handlePreviewJob : undefined
                }
                returnKeyType="go"
              />
              {jobUrlInput.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => setJobUrlInput("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X color={tokens.colors.textMuted} size={16} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.urlHintText}>
              Works with Greenhouse, Lever, Workday, and most job boards.
            </Text>

            {/* Preview Button */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  marginTop: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
                !jobUrlInput.trim() && styles.confirmBtnDisabled,
              ]}
              disabled={!jobUrlInput.trim()}
              onPress={handlePreviewJob}
              activeOpacity={0.85}
            >
              <Globe color={!jobUrlInput.trim() ? "#999" : "#FFF"} size={18} />
              <Text
                style={[
                  styles.confirmBtnText,
                  !jobUrlInput.trim() && { color: tokens.colors.textMuted },
                ]}
              >
                Preview Job
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Step 2: Full-Screen WebView Job Preview */}
      <Modal
        visible={showCreateModal && createFlowStep === "webview"}
        animationType="slide"
        onRequestClose={() => setCreateFlowStep("url")}
      >
        <SafeAreaView style={styles.webviewModalContainer}>
          {/* Header */}
          <View style={styles.createWebViewHeader}>
            <TouchableOpacity
              onPress={() => setCreateFlowStep("url")}
              style={styles.createWebViewNavBtn}
              activeOpacity={0.7}
            >
              <X color={tokens.colors.text} size={22} />
            </TouchableOpacity>

            <View style={styles.createWebViewUrlWrap}>
              <Globe color={tokens.colors.textMuted} size={13} />
              <Text style={styles.createWebViewUrl} numberOfLines={1}>
                {previewUrl}
              </Text>
            </View>

            <View style={styles.createWebViewNavGroup}>
              <TouchableOpacity
                onPress={() => previewWebViewRef.current?.goBack()}
                disabled={!webviewCanGoBack}
                style={styles.createWebViewNavBtn}
                activeOpacity={0.7}
              >
                <ChevronLeft
                  color={webviewCanGoBack ? "#000" : "#CCC"}
                  size={22}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => previewWebViewRef.current?.goForward()}
                disabled={!webviewCanGoForward}
                style={styles.createWebViewNavBtn}
                activeOpacity={0.7}
              >
                <ChevronRight
                  color={webviewCanGoForward ? "#000" : "#CCC"}
                  size={22}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* WebView */}
          <WebView
            ref={previewWebViewRef}
            source={{ uri: previewUrl }}
            style={{ flex: 1 }}
            onLoadStart={() => setWebviewLoading(true)}
            onLoadEnd={() => setWebviewLoading(false)}
            onNavigationStateChange={(nav) => {
              setWebviewCanGoBack(nav.canGoBack);
              setWebviewCanGoForward(nav.canGoForward);
            }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          />

          {/* Loading overlay */}
          {webviewLoading && (
            <View style={styles.webviewLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={tokens.colors.text} />
            </View>
          )}

          {/* Confirm bar */}
          <View style={styles.confirmJobBar}>
            <View style={styles.confirmJobBarInner}>
              <View style={styles.confirmJobStepPill}>
                <Sparkles color={tokens.colors.brandText} size={11} />
                <Text style={styles.confirmJobStepText}>Step 1 of 2</Text>
              </View>
              <Text style={styles.confirmJobBarLabel}>
                Is this the right job?
              </Text>
              <TouchableOpacity
                style={[styles.confirmJobBtn, isScraping && { opacity: 0.6 }]}
                onPress={handleConfirmJob}
                disabled={isScraping}
                activeOpacity={0.85}
              >
                {isScraping ? (
                  <ActivityIndicator size="small" color={tokens.colors.brandText} />
                ) : (
                  <>
                    <Check color={tokens.colors.brandText} size={17} strokeWidth={2.5} />
                    <Text style={styles.confirmJobBtnText}>Confirm Job</Text>
                    <ChevronRight color={tokens.colors.brandText} size={17} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Step 3: BackChannel Insights Modal */}
      <Modal
        visible={showCreateModal && createFlowStep === "insights"}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateFlowStep("webview")}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeCreateModal}
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
            style={styles.createModalContent}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { gap: 8 }]}>
              <TouchableOpacity
                onPress={() => setCreateFlowStep("webview")}
                style={[styles.closeButton, { marginRight: 4 }]}
              >
                <ChevronLeft color={tokens.colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalMainTitle, { flex: 1 }]}>
                BackChannel Insights
              </Text>
              <TouchableOpacity
                onPress={closeCreateModal}
                style={styles.closeButton}
              >
                <X color={tokens.colors.text} size={22} />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View style={styles.insightsStepRow}>
              <View
                style={[styles.stepDot, styles.stepDotActive, { width: 8 }]}
              />
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <Text style={styles.insightsStepLabel}>Step 2 of 2</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={styles.createScrollView}
            >
              <Text style={styles.modalSubTitle}>
                Share the inside story that candidates won't find anywhere else.
                All fields are optional.
              </Text>

              <View style={styles.backchannelCallout}>
                <Text style={styles.backchannelTitle}>💡 Why This Matters</Text>
                <Text style={styles.backchannelText}>
                  Unlike traditional job boards, BackChannel gives candidates
                  real insider knowledge — which means better applicants and
                  fewer surprises on both sides.
                </Text>
              </View>

              {/* Day-to-Day */}
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>The Real Day-to-Day</Text>
                <Text style={styles.fieldHint}>
                  What does this role actually look like beyond the job
                  description?
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  placeholder="Be honest about daily work — meetings, focus time, pace, autonomy..."
                  placeholderTextColor={tokens.colors.textFaint}
                  value={dayToDay}
                  onChangeText={setDayToDay}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Team Culture */}
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Team Culture & Dynamics</Text>
                <Text style={styles.fieldHint}>
                  Give candidates a real sense of who they'll be working with.
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  placeholder="Team size, seniority mix, remote vs. in-office norms, collaboration style..."
                  placeholderTextColor={tokens.colors.textFaint}
                  value={teamCulture}
                  onChangeText={setTeamCulture}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Ideal Candidate */}
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Who Actually Thrives Here</Text>
                <Text style={styles.fieldHint}>
                  What matters more than what's on the resume?
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  placeholder="Mindset, soft skills, working style, previous backgrounds that tend to succeed..."
                  placeholderTextColor={tokens.colors.textFaint}
                  value={idealCandidate}
                  onChangeText={setIdealCandidate}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Other Notes */}
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>
                  Everything Else Worth Knowing
                </Text>
                <Text style={styles.fieldHint}>
                  Interview process, growth path, comp notes, anything
                  candidates should know.
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  placeholder="Interview format, timeline, promotion path, equity situation..."
                  placeholderTextColor={tokens.colors.textFaint}
                  value={insiderInsights}
                  onChangeText={setInsiderInsights}
                  multiline
                  numberOfLines={5}
                />
              </View>
            </ScrollView>

            {/* Create Job Button */}
            <TouchableOpacity
              style={[styles.createJobBtn, isCreatingJob && { opacity: 0.6 }]}
              onPress={handleCreateJob}
              disabled={isCreatingJob}
              activeOpacity={0.85}
            >
              {isCreatingJob ? (
                <ActivityIndicator color={tokens.colors.brandText} size="small" />
              ) : (
                <>
                  <Sparkles color={tokens.colors.brandText} size={18} />
                  <Text style={styles.confirmBtnText}>Create Job</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={!!menuJob}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeMenu}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeMenu}
            style={[
              styles.modalContent,
              // Absolute maxHeight — a "%" value resolves against the
              // gesture-root wrapper (which is content-sized), so the sheet
              // mis-measures and floats above the bottom. Absolute doesn't.
              { maxHeight: SCREEN_HEIGHT * 0.9 },
            ]}
          >
            {/* Job context — title + company so the user knows which card they tapped */}
            {menuJob && (
              <View style={styles.menuSheetJobHeader}>
                <Text style={styles.menuSheetJobTitle} numberOfLines={1}>
                  {menuJob.title}
                </Text>
                <Text style={styles.menuSheetJobCompany} numberOfLines={1}>
                  {menuJob.company}
                </Text>
              </View>
            )}

            {showLogoEditor ? (
              /* Step 2 — replace the company logo. PR #62 ships a
                 sponsor-overridable `logo_url` on PATCH /api/jobs/<id>/edit/,
                 useful when the Logo.dev resolver picked the wrong domain
                 or doesn't know a boutique company. */
              <View style={{ flexShrink: 1, paddingBottom: 8 }}>
                <Text style={styles.unsponsorReasonHeading}>
                  Replace Company Logo
                </Text>
                <Text style={styles.unsponsorReasonSub}>
                  Paste a direct image URL (PNG, JPG, or SVG). Leave blank
                  to keep the current logo.
                </Text>
                <View style={{ alignItems: "center", marginVertical: 16 }}>
                  <CompanyLogo
                    logoUrl={logoUrlInput.trim() || menuJob?.image}
                    name={menuJob?.company}
                    size={72}
                    borderRadius={22}
                    initialFontSize={32}
                  />
                </View>
                <TextInput
                  style={styles.reasonOtherInput}
                  placeholder="https://example.com/logo.png"
                  placeholderTextColor={tokens.colors.textFaint}
                  value={logoUrlInput}
                  onChangeText={setLogoUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[
                    styles.unsponsorConfirmBtn,
                    (!logoUrlInput.trim() || isSavingLogo) && { opacity: 0.4 },
                  ]}
                  disabled={!logoUrlInput.trim() || isSavingLogo}
                  onPress={handleSaveLogoUrl}
                  activeOpacity={0.8}
                >
                  {isSavingLogo ? (
                    <ActivityIndicator size="small" color={tokens.colors.brandText} />
                  ) : (
                    <Text style={styles.unsponsorConfirmBtnText}>
                      Save Logo
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : showUnsponsorReasons ? (
              /* Step 2 — capture WHY before removing the listing, so the
                 backend can prune stale jobs (see §12 in
                 docs/BACKEND_CHANGES_NEEDED.md). */
              <View style={{ flexShrink: 1, paddingBottom: 8 }}>
                <Text style={styles.unsponsorReasonHeading}>
                  Why are you unsponsoring?
                </Text>
                <Text style={styles.unsponsorReasonSub}>
                  This helps us keep job listings accurate and up to date.
                </Text>
                <ScrollView
                  style={{ flexShrink: 1 }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {UNSPONSOR_REASONS.map((reason) => {
                    const selected = unsponsorReason === reason.value;
                    return (
                      <TouchableOpacity
                        key={reason.value}
                        style={styles.reasonRow}
                        onPress={() => setUnsponsorReason(reason.value)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.radioOuter,
                            selected && styles.radioOuterActive,
                          ]}
                        >
                          {selected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.reasonLabel}>{reason.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {unsponsorReason === "other" && (
                    <TextInput
                      style={styles.reasonOtherInput}
                      placeholder="Tell us more (optional)"
                      placeholderTextColor={tokens.colors.textFaint}
                      value={unsponsorReasonDetail}
                      onChangeText={setUnsponsorReasonDetail}
                      multiline
                    />
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.unsponsorConfirmBtn,
                    !unsponsorReason && { opacity: 0.4 },
                  ]}
                  disabled={!unsponsorReason}
                  onPress={() =>
                    menuJob &&
                    unsponsorReason &&
                    handleUnsponsor(
                      menuJob,
                      unsponsorReason,
                      unsponsorReasonDetail,
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.unsponsorConfirmBtnText}>
                    Unsponsor Job
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10, paddingBottom: 8 }}>
                {activeTab === "sponsored" && menuJob ? (
                  <>
                    <TouchableOpacity
                      style={styles.menuOptionCard}
                      onPress={() => {
                        // Seed the input with whatever logo the card is
                        // showing right now so the sponsor can edit it
                        // instead of re-typing from scratch.
                        setLogoUrlInput(menuJob.image || "");
                        setShowLogoEditor(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuIconContainer}>
                        <ImageIcon size={18} color={tokens.colors.textBody} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuOptionTitle}>Replace Logo</Text>
                        <Text style={styles.menuOptionDesc}>
                          Override the auto-resolved company logo
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.menuOptionCard}
                      onPress={() => setShowUnsponsorReasons(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuIconContainer}>
                        <Trash2 size={18} color={tokens.colors.textBody} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuOptionTitle}>Unsponsor Job</Text>
                        <Text style={styles.menuOptionDesc}>
                          Remove this listing from your sponsored jobs
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.menuOptionCard}
                    onPress={closeMenu}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIconContainer}>
                      <ThumbsDown size={18} color={tokens.colors.textBody} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionTitle}>Not Interested</Text>
                      <Text style={styles.menuOptionDesc}>
                        Hide this job from your feed
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </DismissibleSheet>
        </View>
      </Modal>

      {/* Job Details Modal */}
      <Modal visible={!!viewJobDetails} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setViewJobDetails(null)}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setViewJobDetails(null)}
            style={[styles.modalContent, { maxHeight: SCREEN_HEIGHT * 0.88 }]}
          >
            {viewJobDetails && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Hero: Company Logo (initial fallback) + Title + Company + Location */}
                <View style={styles.jobModalHero}>
                  <CompanyLogo
                    logoUrl={viewJobDetails.image}
                    name={viewJobDetails.company}
                    size={72}
                    borderRadius={22}
                    initialFontSize={32}
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={styles.jobModalHeroTitle}>
                    {viewJobDetails.title}
                  </Text>
                  <Text style={styles.jobModalHeroCompany}>
                    {viewJobDetails.company}
                  </Text>
                  {!!viewJobDetails.location && (
                    <View style={styles.jobModalLocationRow}>
                      <MapPin size={13} color={tokens.colors.textMuted} />
                      <Text style={styles.jobModalLocationText}>
                        {viewJobDetails.location}
                      </Text>
                      {viewJobDetails.isRemote && (
                        <View style={styles.jobRemoteBadge}>
                          <Text style={styles.jobRemoteText}>Remote</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Compensation Strip */}
                <View style={styles.jobModalCompStrip}>
                  <View style={styles.jobModalCompCell}>
                    <DollarSign size={14} color={tokens.colors.textBody} />
                    <View style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={styles.jobModalCompLabel}>SALARY</Text>
                      <Text style={styles.jobModalCompValue}>
                        {viewJobDetails.salaryMin && viewJobDetails.salaryMax
                          ? formatSalary(
                              viewJobDetails.salaryMin,
                              viewJobDetails.salaryMax,
                              viewJobDetails.salaryCurrency,
                            )
                          : viewJobDetails.salary || "Not specified"}
                      </Text>
                    </View>
                  </View>
                  {!!viewJobDetails.experienceLevel && (
                    <View
                      style={[
                        styles.jobModalCompCell,
                        styles.jobModalCompCellBorder,
                      ]}
                    >
                      <Briefcase size={14} color={tokens.colors.textBody} />
                      <View style={{ flex: 1, flexShrink: 1 }}>
                        <Text style={styles.jobModalCompLabel}>EXPERIENCE</Text>
                        <Text style={styles.jobModalCompValue}>
                          {viewJobDetails.experienceLevel}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Role Details — work arrangement + employment type chips */}
                {(!!viewJobDetails.workArrangement ||
                  !!viewJobDetails.type) && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Info size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Role Details
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      {!!viewJobDetails.workArrangement && (
                        <View style={styles.roleDetailChip}>
                          <MapPin size={13} color={tokens.colors.text} />
                          <Text style={styles.roleDetailChipText}>
                            {viewJobDetails.workArrangement}
                          </Text>
                        </View>
                      )}
                      {!!viewJobDetails.type && (
                        <View style={styles.roleDetailChip}>
                          <Briefcase size={13} color={tokens.colors.text} />
                          <Text style={styles.roleDetailChipText}>
                            {viewJobDetails.type}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Core Responsibilities */}
                {!!viewJobDetails.coreResponsibilities && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Briefcase size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Core Responsibilities
                      </Text>
                    </View>
                    <View style={styles.jobDetailCard}>
                      <Text style={styles.jobDetailText}>
                        {viewJobDetails.coreResponsibilities}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Required Skills */}
                {(viewJobDetails.skills || []).length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <TrendingUp size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Required Skills
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      {viewJobDetails.skills.map((skill, i) => (
                        <View key={i} style={styles.skillBadge}>
                          <Text style={styles.skillBadgeText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Requirements text fallback when no structured skills */}
                {(viewJobDetails.skills || []).length === 0 &&
                  !!viewJobDetails.requirements && (
                    <View style={styles.detailSection}>
                      <View style={styles.detailSectionHeader}>
                        <TrendingUp size={16} color={tokens.colors.text} />
                        <Text style={styles.detailSectionTitle}>
                          Requirements
                        </Text>
                      </View>
                      <View style={styles.jobDetailCard}>
                        <Text style={styles.jobDetailText}>
                          {viewJobDetails.requirements}
                        </Text>
                      </View>
                    </View>
                  )}

                {/* Benefits / Highlights */}
                {(viewJobDetails.benefits || []).length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Sparkles size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>Highlights</Text>
                    </View>
                    {viewJobDetails.benefits.map((benefit, i) => (
                      <View key={i} style={styles.benefitRow}>
                        <Check size={14} color={tokens.colors.text} />
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* About the Role — full description last (longest free-form text) */}
                {!!viewJobDetails.description && (
                  <View style={styles.jobSection}>
                    <Text style={styles.jobSectionTitle}>About the Role</Text>
                    <Text style={styles.jobSectionText}>
                      {viewJobDetails.description}
                    </Text>
                  </View>
                )}

                {/* Job Sponsors */}
                {(viewJobDetails.currentSponsors || []).length > 0 && (
                  <View style={styles.sponsorInfoCard}>
                    <View style={styles.sponsorCardHeader}>
                      <Users size={16} color={tokens.colors.text} />
                      <Text style={styles.sponsorCardTitle}>Job Sponsors</Text>
                    </View>
                    <View style={{ gap: 12 }}>
                      {viewJobDetails.currentSponsors.map((sponsor, i) => (
                        <View key={i} style={styles.sponsorCardContent}>
                          {sponsor.image ? (
                            <Image
                              source={{ uri: sponsor.image }}
                              style={styles.sponsorCardAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.sponsorCardAvatar,
                                {
                                  backgroundColor: tokens.colors.brand,
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "800",
                                  color: tokens.colors.brandText,
                                }}
                              >
                                {(sponsor.name || "?")[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sponsorCardName}>
                              {sponsor.name}
                            </Text>
                            {!!sponsor.role && (
                              <Text style={styles.sponsorCardRole}>
                                {sponsor.role}
                              </Text>
                            )}
                          </View>
                          {sponsor.canRefer && (
                            <View style={styles.canReferBadge}>
                              <CheckCircle size={12} color={tokens.colors.text} />
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Button */}
                {viewJobDetails.isSponsored ? (
                  (() => {
                    const sponsoredEntry = sponsoredJobs.find(
                      (sj) =>
                        sj.atsJobId === viewJobDetails.id ||
                        sj.jobId === viewJobDetails.id,
                    );
                    const jobPostingsId =
                      sponsoredEntry?.jobId ?? viewJobDetails.id;
                    const isBusy = isUnsponsoringId === jobPostingsId;
                    return (
                      <View style={styles.unsponsorBtnContainer}>
                        <View style={styles.unsponsorBtn}>
                          <Check color={tokens.colors.text} size={18} strokeWidth={3} />
                          <Text style={styles.unsponsorBtnText}>
                            Already Sponsoring
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.unsponsorActiveBtn,
                            (!jobPostingsId || isBusy) && { opacity: 0.4 },
                          ]}
                          activeOpacity={0.7}
                          disabled={!jobPostingsId || isBusy}
                          onPress={() => {
                            if (!jobPostingsId || isBusy) return;
                            setIsUnsponsoringId(jobPostingsId);
                            removeMyJob(jobPostingsId);
                            setJobs(
                              jobs.map((j) =>
                                j.id === viewJobDetails.id
                                  ? { ...j, isSponsored: false }
                                  : j,
                              ),
                            );
                            setViewJobDetails(null);
                            unsponsorJob(jobPostingsId)
                              .catch((err) => {
                                console.warn(
                                  "[JobsView] Failed to unsponsor:",
                                  err,
                                );
                                refreshMyJobs(false);
                                showToast(
                                  "Failed to remove sponsorship. Please try again.",
                                  "error",
                                );
                              })
                              .finally(() => setIsUnsponsoringId(null));
                          }}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color={tokens.colors.brandText} />
                          ) : (
                            <>
                              <Trash2 size={15} color={tokens.colors.brandText} />
                              <Text style={styles.unsponsorActiveBtnText}>
                                Remove Sponsorship
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })()
                ) : (
                  <TouchableOpacity
                    style={styles.applyBtnLarge}
                    onPress={() => {
                      const jobToSponsor = viewJobDetails;
                      setViewJobDetails(null);
                      setTimeout(() => {
                        if (jobToSponsor) handleOpenModal(jobToSponsor);
                      }, 50);
                    }}
                  >
                    <Zap color={tokens.colors.brandText} size={20} fill={tokens.colors.brandText} />
                    <Text style={styles.applyBtnLargeText}>Sponsor</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </DismissibleSheet>
        </View>
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSelectedApplicantJob(null);
              setJobApplicants([]);
              setApplicantsError(null);
            }}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.modalContent, { maxHeight: "60%" }]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>Top Applicants</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedApplicantJob(null);
                  setJobApplicants([]);
                  setApplicantsError(null);
                }}
                style={styles.closeButton}
              >
                <X color={tokens.colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {isLoadingApplicants ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={tokens.colors.text} />
                  <Text
                    style={{
                      marginTop: 12,
                      color: tokens.colors.textMuted,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Loading applicants…
                  </Text>
                </View>
              ) : applicantsError ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text
                    style={{
                      textAlign: "center",
                      color: "#DC2626",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {applicantsError}
                  </Text>
                </View>
              ) : jobApplicants.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text
                    style={{ textAlign: "center", color: tokens.colors.textMuted, fontSize: 16 }}
                  >
                    No applicants yet.
                  </Text>
                </View>
              ) : (
                jobApplicants.map((applicant, i) => (
                  // Entire row is the tap target — opens the applicant
                  // profile detail modal. Larger hit area than just the
                  // chevron, and matches MatchesView's "tap the card"
                  // affordance for consistency.
                  <TouchableOpacity
                    key={applicant.id || i}
                    style={styles.applicantRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedApplicantJob(null);
                      setTimeout(() => {
                        openMessagingModal(applicant);
                      }, 100);
                    }}
                  >
                    {applicant.image ? (
                      <Image
                        source={{ uri: applicant.image }}
                        style={styles.applicantAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.applicantAvatar,
                          {
                            backgroundColor: tokens.colors.brand,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "800",
                            color: tokens.colors.brandText,
                          }}
                        >
                          {(applicant.name || "?")[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.applicantName}>{applicant.name}</Text>
                      <Text style={styles.applicantRole}>
                        {applicant.company
                          ? `${applicant.role} · ${applicant.company}`
                          : applicant.role}
                      </Text>
                    </View>
                    {/* "Matched" status tag — a sibling of the info column
                        so the row's alignItems:"center" keeps it vertically
                        centered against the avatar, not pinned to the name. */}
                    {applicant.status === "MATCHED" && (
                      <View style={styles.applicantMatchedTag}>
                        <CheckCircle size={11} color={tokens.colors.text} />
                        <Text style={styles.applicantMatchedTagText}>
                          Matched
                        </Text>
                      </View>
                    )}
                    {/* Chevron now a visual affordance only — the entire
                        row above handles the tap. */}
                    <View style={styles.messageApplicantBtn}>
                      <ChevronRight color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!showSponsorGate}
        onRequestClose={() => setShowSponsorGate(null)}
      >
        <View style={styles.gateModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSponsorGate(null)}
          >
            <BlurView
              intensity={40}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.gateModalContent}
          >
            <TouchableOpacity
              style={styles.gateCloseBtn}
              onPress={() => setShowSponsorGate(null)}
            >
              <X color={tokens.colors.textBody} size={20} />
            </TouchableOpacity>

            <View style={styles.gateIconContainer}>
              <Lock size={32} color={tokens.colors.text} />
            </View>
            <Text style={styles.gateTitle}>Sponsor to View</Text>
            <Text style={styles.gateDesc}>
              You must be a sponsor of this job listing to view the full
              applicant list.
            </Text>

            <View style={styles.gateActions}>
              <TouchableOpacity
                style={styles.gateBtnPrimary}
                onPress={() => {
                  const job = showSponsorGate;
                  setShowSponsorGate(null);
                  if (job) handleOpenModal(job);
                }}
              >
                <Text style={styles.gateBtnPrimaryText}>Sponsor Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gateBtnSecondary}
                onPress={() => setShowSponsorGate(null)}
              >
                <Text style={styles.gateBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
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
                { label: "Matched", color: tokens.colors.text, bgColor: "#F4F4F5" }
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
                    <CheckCircle color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
                  ),
                  disabled: true,
                  onPress: () => {},
                }
              : {
                  label: `Match with ${selectedApplicantForMessage.name.split(" ")[0]}`,
                  icon: (
                    <CheckCircle color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
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

function JobCard({
  job,
  isSponsored,
  onSponsor,
  onPress,
  onMenu,
  onApplicantPress,
}: {
  job: JobPosting;
  isSponsored?: boolean;
  onSponsor?: () => void;
  onPress?: () => void;
  onMenu?: () => void;
  onApplicantPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        styles.cardShadow,
        isSponsored && styles.sponsoredCardBorder,
        isSponsored && onSponsor !== undefined && { opacity: 0.78 },
      ]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {/* Already-sponsoring banner — only shown in browse tab for sponsored jobs */}
      {isSponsored && onSponsor !== undefined && (
        <View style={styles.sponsoredBanner} pointerEvents="none">
          <Check color={tokens.colors.text} size={12} strokeWidth={3} />
          <Text style={styles.sponsoredBannerText}>Already Sponsoring</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <CompanyLogo
            logoUrl={job.image}
            name={job.company}
            size={60}
            borderRadius={14}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>{job.company}</Text>
            <Text style={styles.jobTitleText} numberOfLines={1}>
              {job.title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={(e) => {
              e.stopPropagation();
              onMenu && onMenu();
            }}
            activeOpacity={0.7}
          >
            <MoreHorizontal color={tokens.colors.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <MapPin size={10} color={tokens.colors.textBody} />
            <Text style={styles.tagText}>{job.location}</Text>
          </View>
          <View style={styles.tag}>
            <DollarSign size={10} color={tokens.colors.textBody} />
            <Text style={styles.tagText}>{job.salary}</Text>
          </View>
        </View>

        <Text style={styles.cardDescription} numberOfLines={2}>
          {job.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.applicantInfo}>
            <TouchableOpacity
              onPress={onApplicantPress}
              activeOpacity={0.7}
              style={styles.applicantBadge}
            >
              <Users color={tokens.colors.text} size={12} />
              <Text style={styles.applicantText}>
                {job.applicants} Applicants
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onSponsor && onSponsor();
            }}
            disabled={isSponsored}
            style={[
              styles.cardSponsorBtn,
              isSponsored
                ? styles.cardSponsorBtnActive
                : styles.cardSponsorBtnDefault,
            ]}
          >
            {isSponsored && (
              <Zap
                size={14}
                color={tokens.colors.brandText}
                fill={tokens.colors.brandText}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.cardSponsorBtnText,
                isSponsored ? styles.textWhite : styles.textBlack,
              ]}
            >
              {isSponsored ? "Sponsoring" : "Sponsor"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 20 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  title: { fontSize: 32, fontWeight: "800", color: tokens.colors.text, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: tokens.colors.textBody, marginTop: 6, fontWeight: "500" },

  createButton: {
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: { color: tokens.colors.brandText, fontSize: 16, fontWeight: "700" },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sponsoredHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 32,
    marginBottom: 16,
    paddingLeft: 4,
  },

  card: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  sponsoredCardBorder: { borderColor: tokens.colors.brand, borderWidth: 1.5 },
  sponsoredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 9,
    backgroundColor: tokens.colors.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  sponsoredBannerText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
      },
      android: { elevation: 18 },
    }),
  },

  cardCoverInfo: { display: "none" },
  cardContent: { padding: 24, paddingTop: 26 },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  companyLogo: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerInfo: { flex: 1 },
  companyName: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.textBody,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  jobTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.5,
  },
  moreBtn: { padding: 12, margin: -8, alignSelf: "flex-start" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: tokens.colors.textBody },
  cardDescription: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginBottom: 16,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  applicantInfo: { flexDirection: "row", alignItems: "center" },
  applicantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  applicantText: { fontSize: 12, fontWeight: "700", color: tokens.colors.text },

  cardSponsorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
  },
  cardSponsorBtnDefault: {
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.brand,
  },
  cardSponsorBtnActive: {
    backgroundColor: tokens.colors.brand,
    borderWidth: 1.5,
    borderColor: tokens.colors.brand,
  },
  cardSponsorBtnText: { fontSize: 13, fontWeight: "700" },
  textBlack: { color: tokens.colors.text },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalMainTitle: { fontSize: 24, fontWeight: "800", color: tokens.colors.text },
  closeButton: { padding: 4 },
  modalSubTitle: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginBottom: 32,
  },
  formSection: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 12,
  },
  radioOption: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 12,
  },
  radioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCC",
  },
  radioCircleActive: { borderColor: tokens.colors.brand, borderWidth: 6 },
  radioText: { fontSize: 15, color: tokens.colors.textBody, fontWeight: "600" },
  radioTextActive: { color: tokens.colors.text, fontWeight: "600" },
  sideBySide: { flexDirection: "row", gap: 12 },
  halfOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  confirmBtn: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    width: "100%",
  },
  confirmBtnDisabled: { backgroundColor: tokens.colors.border },
  confirmBtnText: { color: tokens.colors.brandText, fontSize: 16, fontWeight: "700" },
  textWhite: { color: tokens.colors.brandText },
  successStep: { alignItems: "center", paddingVertical: 20, width: "100%" },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  successDesc: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  createModalContent: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    paddingBottom: 40,
    width: "100%",
    maxHeight: "90%",
  },

  // URL Entry Step
  urlInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 10,
  },
  urlTextInput: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.text,
    paddingVertical: 14,
    fontWeight: "500",
  },
  urlHintText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginTop: 10,
    fontWeight: "500",
    lineHeight: 18,
  },

  // WebView Preview Step
  webviewModalContainer: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  createWebViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: tokens.colors.bg,
    gap: 8,
  },
  createWebViewNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: tokens.colors.bgSurface,
  },
  createWebViewUrlWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createWebViewUrl: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.textBody,
    fontWeight: "500",
  },
  createWebViewNavGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  webviewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmJobBar: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  confirmJobBarInner: {
    alignItems: "center",
    gap: 10,
  },
  confirmJobStepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.colors.brand,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confirmJobStepText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.colors.brandText,
    letterSpacing: 0.3,
  },
  confirmJobBarLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  confirmJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
    width: "100%",
  },
  confirmJobBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.colors.brandText,
  },

  // Insights Step
  insightsStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  insightsStepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.textMuted,
    marginLeft: 4,
  },
  createJobBtn: {
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 18,
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.border },
  stepDotActive: { backgroundColor: tokens.colors.brand, width: 24 },
  createScrollView: { maxHeight: 420 },
  textInput: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: tokens.colors.text,
  },
  skillsInput: { minHeight: 50 },
  multilineInput: { minHeight: 100, textAlignVertical: "top", paddingTop: 16 },
  skillsPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  previewSkillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  previewSkillText: { fontSize: 13, fontWeight: "700", color: tokens.colors.brandText },
  skillsTagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillTag: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  skillTagActive: { backgroundColor: tokens.colors.brand, borderColor: tokens.colors.brand },
  skillTagText: { fontSize: 13, fontWeight: "600", color: tokens.colors.textBody },
  skillTagTextActive: { color: tokens.colors.brandText },
  backchannelCallout: {
    backgroundColor: tokens.colors.border,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  backchannelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 8,
  },
  backchannelText: { fontSize: 14, color: tokens.colors.textBody, lineHeight: 22 },
  reviewCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  reviewSection: { marginBottom: 20 },
  reviewLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: tokens.colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  reviewSubValue: { fontSize: 14, color: tokens.colors.textBody },
  reviewSkills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  reviewSkillBadge: {
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  reviewSkillText: { fontSize: 12, fontWeight: "700", color: tokens.colors.text },
  navigationButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  backNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
  },
  backNavText: { fontSize: 16, fontWeight: "700", color: tokens.colors.text },
  nextBtn: {
    flex: 1,
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
  },
  infoCallout: {
    backgroundColor: tokens.colors.border,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  infoCalloutTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 8,
  },
  infoCalloutText: { fontSize: 14, color: tokens.colors.textBody, lineHeight: 22 },
  fieldHint: { fontSize: 13, color: tokens.colors.textMuted, marginBottom: 12, lineHeight: 18 },
  radioOptionWithDesc: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 12,
  },
  radioDescription: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  supportOptions: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  supportItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  supportText: { fontSize: 14, color: tokens.colors.textBody, fontWeight: "600", flex: 1 },

  // Menu Modal
  menuOptionCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  menuOptionDesc: { fontSize: 13, color: tokens.colors.textBody, fontWeight: "500" },
  // ── Unsponsor-reason step ──
  unsponsorReasonHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 4,
  },
  unsponsorReasonSub: {
    fontSize: 13,
    color: tokens.colors.textBody,
    fontWeight: "500",
    marginBottom: 10,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#DDD",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: tokens.colors.brand },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: tokens.colors.brand,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  reasonOtherInput: {
    marginTop: 14,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    fontSize: 14,
    color: tokens.colors.text,
    minHeight: 72,
    textAlignVertical: "top",
  },
  unsponsorConfirmBtn: {
    marginTop: 16,
    backgroundColor: tokens.colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  unsponsorConfirmBtnText: {
    color: tokens.colors.brandText,
    fontSize: 16,
    fontWeight: "700",
  },
  menuSheetJobHeader: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 16,
  },
  menuSheetJobTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  menuSheetJobCompany: {
    fontSize: 14,
    color: tokens.colors.textBody,
    fontWeight: "500",
  },

  // Modal
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: tokens.colors.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  // ─── Job Details Modal ──────────────────────────────────────────────────────
  jobModalHero: {
    alignItems: "center",
    marginBottom: 24,
  },
  jobModalHeroInitial: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  jobModalHeroInitialText: {
    fontSize: 32,
    fontWeight: "800",
    color: tokens.colors.brandText,
  },
  jobModalHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  jobModalHeroCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.textBody,
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
    color: tokens.colors.textMuted,
    fontWeight: "500",
  },
  jobRemoteBadge: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  jobRemoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.colors.text,
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
    color: tokens.colors.textFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jobModalCompValue: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.colors.text,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.colors.text,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillBadge: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  skillBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: 0.2,
  },
  roleDetailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleDetailChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  jobDetailCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  jobDetailText: {
    fontSize: 14,
    color: tokens.colors.text,
    lineHeight: 21,
    fontWeight: "500",
  },
  jobSection: { marginBottom: 24 },
  jobSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: tokens.colors.text,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  jobSectionText: { fontSize: 14, color: tokens.colors.textBody, lineHeight: 22 },
  jobSectionEmpty: {
    fontSize: 13,
    color: "#AAA",
    fontStyle: "italic",
    fontWeight: "500" as const,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: tokens.colors.textBody, fontWeight: "500" },
  sponsorInfoCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
    textTransform: "uppercase",
  },
  sponsorCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 20 },
  sponsorCardName: { fontSize: 14, fontWeight: "800", color: tokens.colors.text },
  sponsorCardRole: {
    fontSize: 12,
    color: tokens.colors.textBody,
    fontWeight: "600",
    marginTop: 2,
  },
  canReferBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnLarge: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnLargeText: { color: tokens.colors.brandText, fontSize: 16, fontWeight: "800" },

  unsponsorBtnContainer: {
    alignItems: "center",
    gap: 6,
  },
  unsponsorBtn: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  unsponsorBtnText: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "800" as const,
  },
  unsponsorBtnSubtext: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: "500" as const,
  },
  unsponsorActiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.colors.brand,
    borderRadius: 18,
    paddingVertical: 16,
    width: "100%",
  },
  unsponsorActiveBtnText: {
    color: tokens.colors.brandText,
    fontSize: 15,
    fontWeight: "700" as const,
  },

  // Applicant Modal
  applicantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  applicantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.border,
  },
  applicantName: { fontSize: 16, fontWeight: "700", color: tokens.colors.text },
  // Monochrome "Matched" status tag — black icon/text on a light-gray pill,
  // matching the app's black/gray palette.
  applicantMatchedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  applicantMatchedTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: tokens.colors.text,
  },
  applicantRole: { fontSize: 13, color: tokens.colors.textBody, marginTop: 2 },
  messageApplicantBtn: {
    backgroundColor: tokens.colors.brand,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  matchScoreBadge: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchScoreText: { color: tokens.colors.text, fontWeight: "800", fontSize: 12 },

  // Swipeable Card Modal Styles (from MatchesView)
  jobRefTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 15,
    marginBottom: 20,
  },
  jobRefLabel: { fontSize: 10, fontWeight: "900", color: tokens.colors.textMuted },
  jobRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobRefText: { fontSize: 12, fontWeight: "700" },
  swipableContainer: { width: CARD_WIDTH, alignSelf: "center" },
  infoCard: {
    height: 280,
    borderRadius: 24,
    padding: 20,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 15,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: tokens.colors.brand },
  dotInactive: { width: 6, backgroundColor: "#DDD" },
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
  bioText: { fontSize: 14, color: tokens.colors.textBody, lineHeight: 20, marginBottom: 15 },
  skillsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skillText: { fontSize: 11, fontWeight: "700", color: tokens.colors.textBody },
  statsRow: { flexDirection: "row", gap: 8 },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  statLabel: { fontSize: 11, fontWeight: "800" },
  resumeBtn: {
    flex: 1,
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  resumeBtnText: { color: tokens.colors.brandText, fontSize: 12, fontWeight: "700" },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  insightsTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: "800" },
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
    color: tokens.colors.text,
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
    color: tokens.colors.textBody,
    fontStyle: "italic",
    lineHeight: 20,
  },

  // Message Modal
  messageModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 8,
  },
  messageModalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tokens.colors.border,
  },
  messageModalName: { fontSize: 18, fontWeight: "800", color: tokens.colors.text },
  messageModalRole: { fontSize: 14, color: tokens.colors.textBody, marginTop: 2 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: tokens.colors.textFaint,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  replyScroll: {
    marginBottom: 15,
    marginHorizontal: -28,
    paddingHorizontal: 28,
  },
  replyChip: {
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.brand,
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
    backgroundColor: tokens.colors.brand,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // Match CTA — replaces the in-modal messaging UI. Matches the visual
  // weight of HomeView's "Sponsor & Connect" so the action feels equally
  // committal (it kicks off the same notification + conversation flow).
  matchHintText: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.colors.textBody,
    lineHeight: 19,
    marginBottom: 14,
  },
  matchBtn: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  matchBtnText: {
    color: tokens.colors.brandText,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  // Applicant-profile modal styles (ap*) — these are 1:1 copies of
  // MatchesView's `sm*` styles. Keep them in sync if the MatchesView
  // sponsor-detail modal styles change.
  apHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  apAvatar: { width: 68, height: 68, borderRadius: 34 },
  apName: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  apMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.colors.textBody,
    lineHeight: 18,
    marginTop: 4,
  },
  apInterestedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  apInterestedText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: 0.2,
  },
  apJobBlock: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  apSectionLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: tokens.colors.textFaint,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  apJobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  apBodyText: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.textBody,
    lineHeight: 22,
  },
  apLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  apLoadingText: { fontSize: 13, color: "#AAA", fontWeight: "500" },
  apCapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  apCapPill: {
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  apCapPillText: { fontSize: 11, fontWeight: "700", color: tokens.colors.text },
  apBlock: { marginBottom: 20 },
  apChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  apDarkChip: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  apDarkChipText: { fontSize: 12, fontWeight: "700", color: tokens.colors.brandText },
  apInsightItem: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  apInsightQ: {
    fontSize: 10,
    fontWeight: "800",
    color: "#AAA",
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  apInsightA: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.text,
    lineHeight: 20,
  },
  apFallbackNote: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  apFallbackNoteText: {
    fontSize: 13,
    color: tokens.colors.textBody,
    fontWeight: "500",
    lineHeight: 19,
  },

  // Gate Modal
  gateModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  gateModalContent: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: tokens.colors.brand,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  gateCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  gateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: tokens.colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  gateDesc: {
    fontSize: 15,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  gateActions: { width: "100%", gap: 12 },
  gateBtnPrimary: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
  },
  gateBtnPrimaryText: { color: tokens.colors.brandText, fontSize: 16, fontWeight: "700" },
  gateBtnSecondary: { paddingVertical: 12, alignItems: "center" },
  gateBtnSecondaryText: { color: tokens.colors.textBody, fontSize: 15, fontWeight: "600" },

  // Empty State Styles
  emptyStateContainer: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 24,
    padding: 40,
    marginHorizontal: 4,
    marginVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptyStateDescription: {
    fontSize: 15,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
    fontWeight: "500",
  },
  emptyStateButton: {
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 160,
    alignItems: "center",
  },
  emptyStateButtonText: {
    color: tokens.colors.brandText,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Loading State Styles
  loadingContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.bg,
    borderRadius: 24,
    marginHorizontal: 4,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: tokens.colors.text,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // Simple Empty State for Sponsored Section
  simpleEmptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  simpleEmptyTextContainer: {
    flex: 1,
  },
  simpleEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  simpleEmptySubtext: {
    fontSize: 13,
    color: tokens.colors.textBody,
    lineHeight: 18,
    fontWeight: "500",
  },

  // Action bar — holds the segmented tab control on the left and the
  // ghost-style company filter on the right, all in one row.
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  // Segmented control: a single rounded track with inset active segment.
  // The 3px inner padding creates a 2-3px gap around the active pill so it
  // visually floats inside the track (iOS-style).
  segmentedControl: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.brand,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.textBody,
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    color: tokens.colors.brandText,
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
    color: tokens.colors.textBody,
  },
  segmentBadgeTextActive: {
    color: tokens.colors.brandText,
  },
  // Ghost filter — borderless chip sitting next to the segmented control,
  // showing which company is scoping the Browse tab. Renders a chevron
  // only when there's more than one company to choose from (otherwise it's
  // an informational label, not an interactive picker).
  ghostFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    maxWidth: 130,
  },
  ghostFilterText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },

  // Load More Button
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
});
