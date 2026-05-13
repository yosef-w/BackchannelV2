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
  sponsorJob,
  unsponsorJob,
} from "@/lib/api";
import { useJobsStore } from "@/stores/useJobsStore";
import { useToastStore } from "@/stores/useToastStore";
import type { BrowseJobResponse, Job } from "@/types/jobs";
import { BlurView } from "expo-blur";
import {
  Award,
  Briefcase,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share,
  Sparkles,
  ThumbsDown,
  Trash2,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

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

  const [selectedApplicantJob, setSelectedApplicantJob] =
    useState<JobPosting | null>(null);
  const [showSponsorGate, setShowSponsorGate] = useState<JobPosting | null>(
    null,
  );
  const [selectedApplicantForMessage, setSelectedApplicantForMessage] =
    useState<Applicant | null>(null);
  const [message, setMessage] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  const [activeTab, setActiveTab] = useState<"browse" | "sponsored">("browse");
  const [displayLimit, setDisplayLimit] = useState(20);

  // Fetch browse jobs on mount (for sponsors)
  useEffect(() => {
    const loadJobs = async () => {
      try {
        // Skip if we already have jobs (prevents re-fetch on navigation)
        if (jobs.length > 0) {
          console.log("[JobsView] Jobs already loaded, skipping fetch");
          return;
        }

        setLoading(true);
        console.log("[JobsView] Fetching browse jobs for sponsor...");
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
              type: job.EMPLOYMENT_TYPES || "Full-time",
              salary:
                job.SALARY_ANNUAL_MIN && job.SALARY_ANNUAL_MAX
                  ? `$${Math.round(job.SALARY_ANNUAL_MIN / 1000)}k - $${Math.round(job.SALARY_ANNUAL_MAX / 1000)}k`
                  : "Competitive",
              salaryMin: job.SALARY_ANNUAL_MIN,
              salaryMax: job.SALARY_ANNUAL_MAX,
              salaryCurrency: job.SALARY_CURRENCY || "USD",
              postedAt: new Date(job.DATE_POSTED).toLocaleDateString(),
              description: job.DESCRIPTION_TEXT || "",
              summary: job.DESCRIPTION_TEXT?.substring(0, 150) || "",
              skills: parseSkillsField(job.SKILLS),
              highlights: [],
              experienceLevel: job.EXPERIENCE_LEVEL || "Mid-level",
              workArrangement: job.IS_REMOTE ? "Remote" : "On-site",
              isRemote: job.IS_REMOTE,
              url: "",
              applicants: 0,
              image:
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
  }, []); // Run once on mount — isSponsored flags are synced by the effect below

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

  // Workaround until backend adds LIKES_COUNT to /api/jobs/mine/ (see
  // BACKEND_CHANGES_NEEDED.md §3). For each sponsored job we fan out to
  // GET /api/jobs/<id>/likes/applicants/ and patch the count back into
  // myJobs state. Failures fall back silently to the existing count so
  // one bad job doesn't blank the whole list.
  const enrichMyJobsWithApplicantCounts = async (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    const results = await Promise.allSettled(
      jobIds.map((id) => getJobApplicantsLikes(id)),
    );
    const counts = new Map<string, number>();
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        const v = r.value;
        counts.set(jobIds[idx], v.total_count ?? v.applicants?.length ?? 0);
      } else {
        console.warn(
          `[JobsView] Applicant count fetch failed for ${jobIds[idx]}:`,
          r.reason,
        );
      }
    });
    // setMyJobs from the Zustand store takes a Job[], not a functional
    // updater — read the latest state via getState() to avoid clobbering
    // any newer writes that happened while our N requests were in flight.
    const latest = useJobsStore.getState().myJobs;
    setMyJobs(
      latest.map((job) =>
        counts.has(job.id)
          ? { ...job, applicants: counts.get(job.id) ?? 0 }
          : job,
      ),
    );
  };

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
        type: j.EMPLOYMENT_TYPE || "Full-time",
        salary:
          j.SALARY_MIN && j.SALARY_MAX
            ? `$${Math.round(j.SALARY_MIN / 1000)}k – $${Math.round(j.SALARY_MAX / 1000)}k`
            : "Competitive",
        salaryMin: j.SALARY_MIN ?? undefined,
        salaryMax: j.SALARY_MAX ?? undefined,
        salaryCurrency: j.SALARY_CURRENCY || "USD",
        postedAt: j.CREATED_AT
          ? new Date(j.CREATED_AT).toLocaleDateString()
          : "",
        description: j.DESCRIPTION || "",
        summary: j.DESCRIPTION?.substring(0, 150) || "",
        skills: parseSkillsField(j.REQUIREMENTS),
        requirements: j.REQUIREMENTS || "",
        highlights: [],
        experienceLevel: j.EXPERIENCE_LEVEL || "Mid-level",
        workArrangement: j.REMOTE_OPTION ? "Remote" : "On-site",
        isRemote: j.REMOTE_OPTION,
        url: "",
        applicants: 0,
        image:
          j.LOGO_URL ||
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
        currentSponsors: [],
        benefits: [],
        isSponsored: true,
      }));
      setMyJobs(transformed);
      // Fire and forget — counts will patch in once requests resolve.
      enrichMyJobsWithApplicantCounts(transformed.map((j) => j.id));
    } catch (err) {
      console.warn("[JobsView] Failed to fetch my jobs:", err);
    } finally {
      if (showLoadingSpinner) setMyJobsLoading(false);
    }
  };

  const handleUnsponsor = async (job: JobPosting) => {
    setMenuJob(null);
    setIsUnsponsoringId(job.id);
    // Optimistic remove from store so the list updates immediately
    removeMyJob(job.id);
    try {
      await unsponsorJob(job.id);
      trackJobUnsponsored({ jobId: job.id });
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
        // Populate sponsoredJobs for green border tracking in browse tab
        response.jobs.forEach((j: any) => {
          if (j.REFERENCE_JOB_ID) {
            addSponsoredJob({
              jobId: String(j.JOB_ID),
              atsJobId: String(j.REFERENCE_JOB_ID),
              title: j.TITLE || "",
              company: j.COMPANY || "",
            });
          }
        });
        // Also transform and store as myJobs so the badge count is correct immediately
        const transformed: Job[] = response.jobs.map((j: any) => ({
          id: j.JOB_ID,
          title: j.TITLE,
          company: j.COMPANY,
          location: j.LOCATION,
          locations: [j.LOCATION],
          type: j.EMPLOYMENT_TYPE || "Full-time",
          salary:
            j.SALARY_MIN && j.SALARY_MAX
              ? `$${Math.round(j.SALARY_MIN / 1000)}k – $${Math.round(j.SALARY_MAX / 1000)}k`
              : "Competitive",
          salaryMin: j.SALARY_MIN ?? undefined,
          salaryMax: j.SALARY_MAX ?? undefined,
          salaryCurrency: j.SALARY_CURRENCY || "USD",
          postedAt: j.CREATED_AT
            ? new Date(j.CREATED_AT).toLocaleDateString()
            : "",
          description: j.DESCRIPTION || "",
          summary: j.DESCRIPTION?.substring(0, 150) || "",
          skills: parseSkillsField(j.REQUIREMENTS),
          requirements: j.REQUIREMENTS || "",
          highlights: [],
          experienceLevel: j.EXPERIENCE_LEVEL || "Mid-level",
          workArrangement: j.REMOTE_OPTION ? "Remote" : "On-site",
          isRemote: j.REMOTE_OPTION,
          url: "",
          applicants: 0,
          image:
            j.LOGO_URL ||
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
          currentSponsors: [],
          benefits: [],
          isSponsored: true,
        }));
        setMyJobs(transformed);
        enrichMyJobsWithApplicantCounts(transformed.map((j) => j.id));
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

  const handleApplicantPress = (job: JobPosting) => {
    if (job.isSponsored) {
      setSelectedApplicantJob(job);
    } else {
      setShowSponsorGate(job);
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
      });

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
    const payload = {
      url: jobScrapedData?.url ?? previewUrl,
      structured: jobScrapedData?.structured ?? null,
      rawText: jobScrapedData?.rawText ?? "",
      insights: { dayToDay, teamCulture, idealCandidate, insiderInsights },
    };

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
      // LinkedIn / Greenhouse / Lever / Workday URL takes the structured
      // path which doesn't count against the throttle.
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
          "AI extraction limit reached. Try again in an hour, or paste a LinkedIn/Greenhouse link (those skip AI).",
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
            <Plus color="#FFF" size={20} strokeWidth={3} />
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
              <Sparkles size={32} color="#000" />
            </View>
            <Text style={styles.loadingText}>Finding opportunities...</Text>
          </Animated.View>
        ) : error ? (
          <EmptyState
            icon={<Zap size={40} color="#000" strokeWidth={2.5} />}
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
                      image: "",
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
            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "browse" && styles.activeTab]}
                onPress={() => setActiveTab("browse")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "browse" && styles.activeTabText,
                  ]}
                >
                  Browse Jobs
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === "browse" && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === "browse" && styles.activeTabBadgeText,
                    ]}
                  >
                    {jobs.length}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "sponsored" && styles.activeTab,
                ]}
                onPress={() => setActiveTab("sponsored")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "sponsored" && styles.activeTabText,
                  ]}
                >
                  My Sponsored
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === "sponsored" && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === "sponsored" && styles.activeTabBadgeText,
                    ]}
                  >
                    {myJobs.length}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Browse Jobs Tab */}
            {activeTab === "browse" && (
              <>
                {jobs.length === 0 ? (
                  <EmptyState
                    icon={
                      <Briefcase size={40} color="#000" strokeWidth={2.5} />
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
                        <ChevronRight size={16} color="#000" />
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
                    <Sparkles size={24} color="#999" strokeWidth={2.5} />
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
                    <Sparkles size={24} color="#999" strokeWidth={2.5} />
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
                <X color="#000" size={24} />
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
                      placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
                  <Check color="#FFF" size={32} strokeWidth={3} />
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
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubTitle}>
              Paste the URL of the job posting you want to add to BackChannel.
            </Text>

            {/* URL Input */}
            <View style={styles.urlInputContainer}>
              <Globe color="#999" size={18} />
              <TextInput
                style={styles.urlTextInput}
                placeholder="https://jobs.company.com/role"
                placeholderTextColor="#999"
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
                  <X color="#999" size={16} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.urlHintText}>
              Works with LinkedIn, Greenhouse, Lever, Workday, and most job
              boards.
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
                  !jobUrlInput.trim() && { color: "#999" },
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
              <X color="#000" size={22} />
            </TouchableOpacity>

            <View style={styles.createWebViewUrlWrap}>
              <Globe color="#999" size={13} />
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
              <ActivityIndicator size="large" color="#000" />
            </View>
          )}

          {/* Confirm bar */}
          <View style={styles.confirmJobBar}>
            <View style={styles.confirmJobBarInner}>
              <View style={styles.confirmJobStepPill}>
                <Sparkles color="#FFF" size={11} />
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
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Check color="#FFF" size={17} strokeWidth={2.5} />
                    <Text style={styles.confirmJobBtnText}>Confirm Job</Text>
                    <ChevronRight color="#FFF" size={17} />
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
                <ChevronLeft color="#000" size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalMainTitle, { flex: 1 }]}>
                BackChannel Insights
              </Text>
              <TouchableOpacity
                onPress={closeCreateModal}
                style={styles.closeButton}
              >
                <X color="#000" size={22} />
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Sparkles color="#FFF" size={18} />
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
        animationType="fade"
        onRequestClose={() => setMenuJob(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMenuJob(null)}
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
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>Job Options</Text>
              <TouchableOpacity
                onPress={() => setMenuJob(null)}
                style={styles.closeButton}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.menuOptionCard}
                onPress={() => setMenuJob(null)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  <Share size={18} color="#000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuOptionTitle}>Share Job</Text>
                  <Text style={styles.menuOptionDesc}>
                    Send this opportunity to others
                  </Text>
                </View>
              </TouchableOpacity>

              {activeTab === "sponsored" && menuJob ? (
                <TouchableOpacity
                  style={styles.menuOptionCard}
                  onPress={() => handleUnsponsor(menuJob)}
                  disabled={isUnsponsoringId === menuJob?.id}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Trash2 size={18} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuOptionTitle}>Unsponsor Job</Text>
                    <Text style={styles.menuOptionDesc}>
                      Remove this listing from your sponsored jobs
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuOptionCard}
                  onPress={() => setMenuJob(null)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <ThumbsDown size={18} color="#666" />
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
          </Animated.View>
        </View>
      </Modal>

      {/* Job Details Modal */}
      <Modal visible={!!viewJobDetails} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
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

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {viewJobDetails && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Job Header */}
                <View style={styles.jobModalHeader}>
                  <Image
                    source={{ uri: viewJobDetails.image }}
                    style={styles.jobModalImage}
                  />
                  <View style={styles.jobModalInfo}>
                    <Text style={styles.jobModalCompany}>
                      {viewJobDetails.company}
                    </Text>
                    <Text style={styles.jobModalTitle}>
                      {viewJobDetails.title}
                    </Text>
                    <View style={styles.jobModalMeta}>
                      <View style={styles.jobModalMetaItem}>
                        <MapPin size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>
                          {viewJobDetails.location || "Location not specified"}
                        </Text>
                      </View>
                      <View style={styles.jobModalMetaItem}>
                        <DollarSign size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>
                          {viewJobDetails.salary || "Salary not specified"}
                        </Text>
                      </View>
                    </View>
                    {/* Info badges: type · experience · arrangement */}
                    <View style={styles.jobModalBadges}>
                      {!!viewJobDetails.type && (
                        <View style={styles.jobModalBadge}>
                          <Text style={styles.jobModalBadgeText}>
                            {viewJobDetails.type}
                          </Text>
                        </View>
                      )}
                      {!!viewJobDetails.experienceLevel && (
                        <View style={styles.jobModalBadge}>
                          <Text style={styles.jobModalBadgeText}>
                            {viewJobDetails.experienceLevel}
                          </Text>
                        </View>
                      )}
                      {!!viewJobDetails.workArrangement && (
                        <View style={styles.jobModalBadge}>
                          <Text style={styles.jobModalBadgeText}>
                            {viewJobDetails.workArrangement}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setViewJobDetails(null)}
                    style={styles.closeButton}
                  >
                    <X color="#000" size={24} />
                  </TouchableOpacity>
                </View>

                {/* Job Description */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>About the Role</Text>
                  {viewJobDetails.description ? (
                    <Text style={styles.jobSectionText}>
                      {viewJobDetails.description}
                    </Text>
                  ) : (
                    <Text style={styles.jobSectionEmpty}>
                      No description available
                    </Text>
                  )}
                </View>

                {/* Skills */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Required Skills</Text>
                  {(viewJobDetails.skills || []).length > 0 ? (
                    <View style={styles.skillsContainer}>
                      {viewJobDetails.skills.map((skill, i) => (
                        <View key={i} style={styles.skillChip}>
                          <Text style={styles.skillText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  ) : viewJobDetails.requirements ? (
                    <Text style={styles.jobSectionText}>
                      {viewJobDetails.requirements}
                    </Text>
                  ) : (
                    <Text style={styles.jobSectionEmpty}>Not specified</Text>
                  )}
                </View>

                {/* Benefits — only shown when data is available */}
                {(viewJobDetails.benefits || []).length > 0 && (
                  <View style={styles.jobSection}>
                    <Text style={styles.jobSectionTitle}>Benefits</Text>
                    {viewJobDetails.benefits.map((benefit, i) => (
                      <View key={i} style={styles.benefitRow}>
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Job Sponsors — only shown when data is available */}
                {(viewJobDetails.currentSponsors || []).length > 0 && (
                  <View style={styles.jobSection}>
                    <Text style={styles.jobSectionTitle}>Job Sponsors</Text>
                    <View style={{ gap: 12 }}>
                      {viewJobDetails.currentSponsors.map((sponsor, i) => (
                        <View key={i} style={styles.sponsorInfoCard}>
                          <View style={styles.sponsorCardContent}>
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
                                    backgroundColor: "#000",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontWeight: "800",
                                    color: "#FFF",
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
                              <Text style={styles.sponsorCardRole}>
                                {sponsor.role}
                              </Text>
                            </View>
                            {sponsor.canRefer && (
                              <View style={styles.canReferBadge}>
                                <CheckCircle size={12} color="#00CB54" />
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Button */}
                {viewJobDetails.isSponsored ? (
                  (() => {
                    // Browse-tab jobs have id = ATS/SILVER_JOBS ID → match via atsJobId.
                    // My Sponsored tab jobs have id = JOB_POSTINGS ID → match via jobId.
                    // Fall back to viewJobDetails.id directly — for myJobs it IS
                    // already the JOB_POSTINGS ID the API expects.
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
                          <Check color="#16a34a" size={18} strokeWidth={3} />
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
                            // Optimistic updates
                            removeMyJob(jobPostingsId);
                            // setJobs MUST receive an array, not a callback —
                            // the store action does set({ jobs }) directly.
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
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <Trash2 size={15} color="#FFF" />
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
                    <Zap color="#FFF" size={20} fill="#FFF" />
                    <Text style={styles.applyBtnLargeText}>Sponsor</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedApplicantJob}
        onRequestClose={() => setSelectedApplicantJob(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedApplicantJob(null)}
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
                onPress={() => setSelectedApplicantJob(null)}
                style={styles.closeButton}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedApplicantJob?.topApplicants?.map((applicant, i) => (
                <View key={i} style={styles.applicantRow}>
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
                          backgroundColor: "#000",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "800",
                          color: "#FFF",
                        }}
                      >
                        {(applicant.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.applicantName}>{applicant.name}</Text>
                    <Text style={styles.applicantRole}>
                      {applicant.role} @ {applicant.company}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.messageApplicantBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedApplicantJob(null);
                      setTimeout(() => {
                        setSelectedApplicantForMessage(applicant);
                      }, 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <MessageCircle color="#FFF" size={16} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ))}
              {(!selectedApplicantJob?.topApplicants ||
                selectedApplicantJob.topApplicants.length === 0) && (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text
                    style={{ textAlign: "center", color: "#999", fontSize: 16 }}
                  >
                    No applicants data available.
                  </Text>
                </View>
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
              <X color="#666" size={20} />
            </TouchableOpacity>

            <View style={styles.gateIconContainer}>
              <Lock size={32} color="#000" />
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

      {/* Applicant Messaging Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedApplicantForMessage}
        onRequestClose={() => {
          setSelectedApplicantForMessage(null);
          setMessage("");
          setActiveSlide(0);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSelectedApplicantForMessage(null);
              setMessage("");
              setActiveSlide(0);
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
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {selectedApplicantForMessage && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>
                      {selectedApplicantForMessage.appliedRole}
                    </Text>
                  </View>
                </View>

                {/* Swipable Card Section */}
                <View style={styles.swipableContainer}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  >
                    {/* Front: Bio & Resume */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image
                          source={{ uri: selectedApplicantForMessage.image }}
                          style={styles.modalAvatar}
                        />
                        <View>
                          <Text style={styles.modalName}>
                            {selectedApplicantForMessage.name}
                          </Text>
                          <View style={styles.locationRow}>
                            <MapPin size={12} color="#AAA" />
                            <Text style={styles.locationText}>
                              New York, NY
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.bioText} numberOfLines={3}>
                        Senior {selectedApplicantForMessage.role} with a focus
                        on scaling user-centric products at{" "}
                        {selectedApplicantForMessage.company}.
                      </Text>
                      <View style={styles.skillsContainer}>
                        {(selectedApplicantForMessage.skills || []).map(
                          (s, i) => (
                            <View key={i} style={styles.skillChip}>
                              <Text style={styles.skillText}>{s}</Text>
                            </View>
                          ),
                        )}
                      </View>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Award size={14} color="#000" />
                          <Text style={styles.statLabel}>
                            {selectedApplicantForMessage.experience}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.resumeBtn}
                          activeOpacity={0.7}
                        >
                          <FileText size={14} color="#FFF" />
                          <Text style={styles.resumeBtnText}>View Resume</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Back: Key Insights */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.insightsHeader}>
                        <Sparkles size={20} color="#000" />
                        <Text style={styles.insightsTitle}>Key Insights</Text>
                      </View>

                      {selectedApplicantForMessage.insights && (
                        <View style={styles.insightSection}>
                          <Text style={styles.insightLabel}>QUICK HIT</Text>
                          <Text style={styles.insightContent}>
                            {selectedApplicantForMessage.insights.funFact}
                          </Text>
                        </View>
                      )}

                      {selectedApplicantForMessage.prompts?.map(
                        (prompt, idx) => (
                          <View key={idx} style={styles.promptWrapper}>
                            <View style={styles.promptHeaderRow}>
                              <Zap size={14} color="#000" />
                              <Text style={styles.insightLabel}>
                                {prompt.question}
                              </Text>
                            </View>
                            <Text style={styles.promptContent}>
                              {prompt.answer}
                            </Text>
                          </View>
                        ),
                      )}

                      <View
                        style={[
                          styles.statItem,
                          { marginTop: "auto", alignSelf: "flex-start" },
                        ]}
                      >
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.statLabel}>Fully Verified</Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Indicators */}
                  <View style={styles.pagination}>
                    <View
                      style={[
                        styles.dot,
                        activeSlide === 0
                          ? styles.dotActive
                          : styles.dotInactive,
                      ]}
                    />
                    <View
                      style={[
                        styles.dot,
                        activeSlide === 1
                          ? styles.dotActive
                          : styles.dotInactive,
                      ]}
                    />
                  </View>
                </View>

                {/* Messaging Section */}
                <Animated.View entering={FadeInUp} style={{ marginTop: 24 }}>
                  <Text style={styles.inputLabel}>Quick Reply</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.replyScroll}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {[
                      "Nice to meet you!",
                      "Great profile!",
                      "Let's chat!",
                      "Impressive background!",
                    ].map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.replyChip}
                        onPress={() => setMessage(r)}
                      >
                        <Text style={styles.replyChipText}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="Write a message..."
                      value={message}
                      onChangeText={setMessage}
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.sendBtn}
                      onPress={() => {
                        setSelectedApplicantForMessage(null);
                        setMessage("");
                        setActiveSlide(0);
                      }}
                    >
                      <Send color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
          <Check color="#16a34a" size={12} strokeWidth={3} />
          <Text style={styles.sponsoredBannerText}>Already Sponsoring</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Image
            source={typeof job.logo === "string" ? { uri: job.logo } : job.logo}
            style={styles.companyLogo}
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
            <MoreHorizontal color="#999" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <MapPin size={10} color="#666" />
            <Text style={styles.tagText}>{job.location}</Text>
          </View>
          <View style={styles.tag}>
            <DollarSign size={10} color="#666" />
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
              <Users color="#000" size={12} />
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
                color="#FFF"
                fill="#FFF"
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
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 20 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  title: { fontSize: 32, fontWeight: "800", color: "#000", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 6, fontWeight: "500" },

  createButton: {
    backgroundColor: "#000",
    flexDirection: "row",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#999",
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
    backgroundColor: "#FFF",
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  sponsoredCardBorder: { borderColor: "#16a34a", borderWidth: 1.5 },
  sponsoredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 9,
    backgroundColor: "#f0fdf4",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#bbf7d0",
  },
  sponsoredBannerText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#16a34a",
    letterSpacing: -0.2,
  },
  cardShadow: {
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
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  headerInfo: { flex: 1 },
  companyName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  jobTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
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
    borderColor: "#F0F0F0",
  },
  tagText: { fontSize: 12, fontWeight: "600", color: "#444" },
  cardDescription: {
    fontSize: 14,
    color: "#555",
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
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  applicantText: { fontSize: 12, fontWeight: "700", color: "#000" },

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
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  cardSponsorBtnActive: {
    backgroundColor: "#000",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  cardSponsorBtnText: { fontSize: 13, fontWeight: "700" },
  textBlack: { color: "#000" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFF",
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
  modalMainTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  closeButton: { padding: 4 },
  modalSubTitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 32,
  },
  formSection: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  radioOption: {
    backgroundColor: "#F9F9F9",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
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
  radioCircleActive: { borderColor: "#000", borderWidth: 6 },
  radioText: { fontSize: 15, color: "#666", fontWeight: "600" },
  radioTextActive: { color: "#000", fontWeight: "600" },
  sideBySide: { flexDirection: "row", gap: 12 },
  halfOption: {
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
  confirmBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    width: "100%",
  },
  confirmBtnDisabled: { backgroundColor: "#E5E5E5" },
  confirmBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  textWhite: { color: "#FFF" },
  successStep: { alignItems: "center", paddingVertical: 20, width: "100%" },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  successDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  createModalContent: {
    backgroundColor: "#FFF",
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
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#EEE",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 10,
  },
  urlTextInput: {
    flex: 1,
    fontSize: 15,
    color: "#000",
    paddingVertical: 14,
    fontWeight: "500",
  },
  urlHintText: {
    fontSize: 13,
    color: "#999",
    marginTop: 10,
    fontWeight: "500",
    lineHeight: 18,
  },

  // WebView Preview Step
  webviewModalContainer: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  createWebViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
    gap: 8,
  },
  createWebViewNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
  },
  createWebViewUrlWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createWebViewUrl: {
    flex: 1,
    fontSize: 12,
    color: "#555",
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
    backgroundColor: "#FFF",
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
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confirmJobStepText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  confirmJobBarLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  confirmJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
    width: "100%",
  },
  confirmJobBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
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
    color: "#999",
    marginLeft: 4,
  },
  createJobBtn: {
    backgroundColor: "#000",
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
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5E5E5" },
  stepDotActive: { backgroundColor: "#000", width: 24 },
  createScrollView: { maxHeight: 420 },
  textInput: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#000",
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
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  previewSkillText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  skillsTagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillTag: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  skillTagActive: { backgroundColor: "#000", borderColor: "#000" },
  skillTagText: { fontSize: 13, fontWeight: "600", color: "#666" },
  skillTagTextActive: { color: "#FFF" },
  backchannelCallout: {
    backgroundColor: "#F0F0F0",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  backchannelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  backchannelText: { fontSize: 14, color: "#555", lineHeight: 22 },
  reviewCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  reviewSection: { marginBottom: 20 },
  reviewLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#999",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  reviewSubValue: { fontSize: 14, color: "#666" },
  reviewSkills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  reviewSkillBadge: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  reviewSkillText: { fontSize: 12, fontWeight: "700", color: "#000" },
  navigationButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  backNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
  },
  backNavText: { fontSize: 16, fontWeight: "700", color: "#000" },
  nextBtn: {
    flex: 1,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
  },
  infoCallout: {
    backgroundColor: "#F0F0F0",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  infoCalloutTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  infoCalloutText: { fontSize: 14, color: "#555", lineHeight: 22 },
  fieldHint: { fontSize: 13, color: "#999", marginBottom: 12, lineHeight: 18 },
  radioOptionWithDesc: {
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 12,
  },
  radioDescription: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    lineHeight: 18,
  },
  supportOptions: {
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  supportItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  supportText: { fontSize: 14, color: "#666", fontWeight: "600", flex: 1 },

  // Menu Modal
  menuOptionCard: {
    backgroundColor: "#F8F9FB",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  menuOptionDesc: { fontSize: 13, color: "#666", fontWeight: "500" },

  // Modal
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
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
  jobModalBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  jobModalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  jobModalBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#555",
  },
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
    backgroundColor: "#F0FFF4",
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

  unsponsorBtnContainer: {
    alignItems: "center",
    gap: 6,
  },
  unsponsorBtn: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  unsponsorBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800" as const,
  },
  unsponsorBtnSubtext: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500" as const,
  },
  unsponsorActiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    borderRadius: 18,
    paddingVertical: 16,
    width: "100%",
  },
  unsponsorActiveBtnText: {
    color: "#FFF",
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
    backgroundColor: "#EEE",
  },
  applicantName: { fontSize: 16, fontWeight: "700", color: "#000" },
  applicantRole: { fontSize: 13, color: "#666", marginTop: 2 },
  messageApplicantBtn: {
    backgroundColor: "#000",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  matchScoreBadge: {
    backgroundColor: "#F0F9F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchScoreText: { color: "#006633", fontWeight: "800", fontSize: 12 },

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
  swipableContainer: { width: CARD_WIDTH, alignSelf: "center" },
  infoCard: {
    height: 280,
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
    backgroundColor: "#EEE",
  },
  messageModalName: { fontSize: 18, fontWeight: "800", color: "#000" },
  messageModalRole: { fontSize: 14, color: "#666", marginTop: 2 },
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

  // Gate Modal
  gateModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  gateModalContent: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
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
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  gateDesc: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  gateActions: { width: "100%", gap: 12 },
  gateBtnPrimary: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
  },
  gateBtnPrimaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  gateBtnSecondary: { paddingVertical: 12, alignItems: "center" },
  gateBtnSecondaryText: { color: "#666", fontSize: 15, fontWeight: "600" },

  // Empty State Styles
  emptyStateContainer: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 40,
    marginHorizontal: 4,
    marginVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    borderColor: "#F0F0F0",
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptyStateDescription: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
    fontWeight: "500",
  },
  emptyStateButton: {
    backgroundColor: "#000",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 160,
    alignItems: "center",
  },
  emptyStateButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Loading State Styles
  loadingContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderRadius: 24,
    marginHorizontal: 4,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
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
    color: "#000",
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // Simple Empty State for Sponsored Section
  simpleEmptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FAFAFA",
    padding: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  simpleEmptyTextContainer: {
    flex: 1,
  },
  simpleEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  simpleEmptySubtext: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    fontWeight: "500",
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
  },
  activeTab: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    letterSpacing: -0.2,
  },
  activeTabText: {
    color: "#FFF",
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#E5E5E5",
    minWidth: 24,
    alignItems: "center",
  },
  activeTabBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },
  activeTabBadgeText: {
    color: "#FFF",
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
    borderColor: "#E5E5E5",
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.2,
  },
});
