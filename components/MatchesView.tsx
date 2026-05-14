import {
  trackMatchMessageTapped,
  trackReferralWithdrawn,
  trackSponsorLikedBack,
} from "@/lib/analytics/mixpanel";
import {
  getInterestedSponsors,
  getLikedJobs,
  getMatches,
  getNotifications,
  getPublicProfile,
  getSponsorMatches,
  getWaitlistedJobs,
  likeBackSponsor,
  likeProfile,
  listReferrals,
  markNotificationAsRead,
  sponsorJob,
  withdrawReferral,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import { BlurView } from "expo-blur";
import {
  AlertTriangle,
  Award,
  BellRing,
  Briefcase,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Sparkles,
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
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInUp,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { DismissibleSheet } from "./ui/DismissibleSheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

interface Match {
  id: number;
  name: string;
  role: string;
  company: string;
  image: string;
  status: string;
  date: string;
  appliedRole: string;
  experience: string;
  skills: string[];
  jobId?: string;
  sponsorUserId?: string;
  applicantUserId?: string; // sponsor view — the matched applicant's user ID
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

interface Referral {
  referralId: string;
  jobId: string;
  applicantUserId: string;
  sponsorUserId: string;
  status: "REFERRED" | "WITHDRAWN" | string;
  referralNote: string | null;
  createdAt: string;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  applicantPhotoUrl: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
}

interface JobOpportunity {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  image: string;
  description: string;
  skills: string[];
  benefits: string[];
  status?: string;
  likedAt?: string;
  // Raw API fields
  jobId?: string;
  likeId?: string;
  remoteOption?: boolean;
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  // Rich detail fields. Backend may or may not return these on the
  // liked-jobs endpoint yet — surface them when present so this modal
  // matches the depth of HomeView's expanded job card.
  coreResponsibilities?: string;
  workArrangement?: string;
  sponsorInfo: {
    name: string;
    role: string;
    image: string;
    canRefer: boolean;
  };
}

/**
 * Incoming sponsor-request notification for a sponsor — the applicant has
 * asked someone at their company to sponsor a specific job. Surfaced as a
 * dedicated section on the Matches screen so it's actionable in one place
 * rather than buried in the notifications list.
 */
interface SponsorRequest {
  notificationId: string;
  applicantUserId: string;
  applicantName: string;
  applicantPhoto: string | null;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  createdAt: string;
}

interface InterestedSponsor {
  likeId: string;
  userId: string;
  likedAt: string;
  name: string;
  firstName: string;
  role: string;
  company: string;
  image: string;
  jobId?: string;
}

interface WaitlistedJob {
  waitlist_id: string;
  job_id: string;
  status: string;
  waitlisted_at: string;
  title: string;
  organization: string;
  location: string;
  employment_type: string | null;
  is_remote: boolean;
  experience_level: string | null;
  is_now_sponsored: boolean;
  sponsored_job_id: string | null;
}

const QUICK_REPLIES = [
  "Nice to meet you!",
  "Great profile!",
  "Let's chat!",
  "Impressive skills!",
];

const getRelativeTime = (dateStr: string): string => {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
};

export function MatchesView({
  userType = "sponsor",
  onNavigateToMessages,
}: {
  userType?: "applicant" | "sponsor";
  onNavigateToMessages?: (jobId: string) => void;
}) {
  const [selectedProfile, setSelectedProfile] = useState<Match | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobOpportunity | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "message">("view");
  const [activeSlide, setActiveSlide] = useState(0);
  const [message, setMessage] = useState("");
  const [sponsorPublicProfile, setSponsorPublicProfile] = useState<any>(null);
  const [sponsorPublicProfileLoading, setSponsorPublicProfileLoading] =
    useState(false);

  // Interested sponsors state (sponsors who liked the applicant, no match yet)
  const [interestedSponsors, setInterestedSponsors] = useState<
    InterestedSponsor[]
  >([]);
  const [interestedSponsorsLoading, setInterestedSponsorsLoading] =
    useState(false);
  const [interestedSponsorsError, setInterestedSponsorsError] = useState<
    string | null
  >(null);
  const [selectedInterestedSponsor, setSelectedInterestedSponsor] =
    useState<InterestedSponsor | null>(null);
  const [interestedSponsorProfile, setInterestedSponsorProfile] =
    useState<any>(null);
  const [interestedSponsorProfileLoading, setInterestedSponsorProfileLoading] =
    useState(false);
  // likeId of the sponsor we're currently "liking back" (shows a spinner)
  const [likingBackSponsorId, setLikingBackSponsorId] = useState<string | null>(
    null,
  );
  // Bumped after a successful like-back to force matches/interested re-fetch
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0);

  // Sponsor-requests state — applicants asking sponsors at the company to
  // sponsor a specific job. Source is notifications filtered by type;
  // when a dedicated GET endpoint ships this will be swapped out cleanly.
  const [sponsorRequests, setSponsorRequests] = useState<SponsorRequest[]>([]);
  const [sponsorRequestsLoading, setSponsorRequestsLoading] = useState(false);
  const [sponsorRequestsError, setSponsorRequestsError] = useState<
    string | null
  >(null);
  const [selectedSponsorRequest, setSelectedSponsorRequest] =
    useState<SponsorRequest | null>(null);
  const [isConnectingToApplicant, setIsConnectingToApplicant] = useState(false);

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

  // Real matches state
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // Liked jobs state (for applicants)
  const [likedJobs, setLikedJobs] = useState<JobOpportunity[]>([]);
  const [likedJobsLoading, setLikedJobsLoading] = useState(false);
  const [likedJobsError, setLikedJobsError] = useState<string | null>(null);

  // Waitlisted jobs state (for applicants)
  const [waitlistedJobs, setWaitlistedJobs] = useState<WaitlistedJob[]>([]);
  const [waitlistedJobsLoading, setWaitlistedJobsLoading] = useState(false);
  const [waitlistedJobsError, setWaitlistedJobsError] = useState<string | null>(
    null,
  );
  const [selectedWaitlistedJob, setSelectedWaitlistedJob] =
    useState<WaitlistedJob | null>(null);

  // Referrals state (for sponsors — submitted referrals & their statuses)
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsError, setReferralsError] = useState<string | null>(null);
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

  // Fetch matches on mount
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setMatchesLoading(true);
        console.log("[MatchesView] Fetching matches for:", userType);

        if (userType === "applicant") {
          const response = await getMatches();
          console.log("[MatchesView] Applicant matches:", response);

          // API returns job_matches and profile_matches
          const matches =
            response.job_matches || response.profile_matches || [];

          // Transform API response to Match interface
          const transformedMatches: Match[] = matches.map((m) => {
            const match = m as any;
            const sponsorName = match.sponsor?.name
              ? match.sponsor.name
              : `${match.SPONSOR_FIRST_NAME || ""} ${match.SPONSOR_LAST_NAME || ""}`.trim();
            const matchedAt = match.matched_at || match.MATCHED_AT;

            return {
              id: Number(match.id || match.LIKE_ID) || 0,
              name: sponsorName || "Sponsor",
              role: match.sponsor?.role || match.SPONSOR_JOB_TITLE || "Sponsor",
              company:
                match.sponsor?.company ||
                match.job?.company ||
                match.COMPANY ||
                "",
              image:
                match.sponsor?.profile_image_url ||
                match.SPONSOR_PHOTO_URL ||
                "",
              status: "connected",
              date: matchedAt ? new Date(matchedAt).toLocaleDateString() : "",
              appliedRole:
                match.job?.title || match.TITLE || match.JOB_TITLE || "",
              experience: "", // Not provided by API
              skills: [], // Not provided by API
              jobId: match.JOB_ID || match.job?.id || "",
              sponsorUserId: match.sponsor?.id || match.SPONSOR_USER_ID || "",
              insights: undefined,
              prompts: undefined,
            };
          });

          setMatches(transformedMatches);
        } else {
          // Sponsor view
          const response = await getSponsorMatches();
          console.log("[MatchesView] Sponsor matches:", response);

          // Transform API response to Match interface
          const transformedMatches: Match[] = response.matches.map((match) => {
            const applicantName =
              `${match.FIRST_NAME || ""} ${match.LAST_NAME || ""}`.trim();
            const matchedAt = match.matched_at;

            // SKILLS arrives as a JSON-encoded string from Snowflake ::TEXT cast
            let skills: string[] = [];
            if (match.SKILLS) {
              try {
                const parsed = JSON.parse(match.SKILLS);
                skills = Array.isArray(parsed) ? parsed : [];
              } catch {
                skills = [];
              }
            }

            return {
              id: Number(match.LIKE_ID) || 0,
              name: applicantName || "Applicant",
              role: "Job Seeker",
              company: "",
              image: match.PHOTO_URL || "",
              status: "connected",
              date: matchedAt ? new Date(matchedAt).toLocaleDateString() : "",
              appliedRole: match.TITLE || "",
              experience: "",
              skills,
              jobId: match.JOB_ID || "",
              applicantUserId: match.applicant_user_id || "",
              insights: undefined,
              prompts: undefined,
            };
          });

          setMatches(transformedMatches);
        }
      } catch (err) {
        console.warn("[MatchesView] Failed to fetch matches:", err);
        setMatchesError(
          err instanceof Error ? err.message : "Failed to fetch matches",
        );
      } finally {
        setMatchesLoading(false);
      }
    };

    fetchMatches();
  }, [userType, matchesRefreshKey]);

  // Fetch liked jobs for applicants
  useEffect(() => {
    const fetchLikedJobs = async () => {
      if (userType !== "applicant") return;

      try {
        setLikedJobsLoading(true);
        console.log("[MatchesView] Fetching liked jobs for applicant...");

        const response = await getLikedJobs();
        console.log("[MatchesView] Liked jobs response:", response);

        // API returns array directly or object with liked_jobs
        const likedJobsArray = Array.isArray(response)
          ? response
          : (response as any).liked_jobs || [];

        // Backend can send arrays as either real arrays or JSONB-cast strings.
        const parseArray = (v: any): string[] => {
          if (!v) return [];
          if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
          if (typeof v === "string") {
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed)
                ? parsed.filter((x) => typeof x === "string")
                : [];
            } catch {
              return [];
            }
          }
          return [];
        };

        // Transform API response to JobOpportunity interface
        const transformedJobs: JobOpportunity[] = likedJobsArray.map(
          (likedJob: any) => ({
            id: likedJob.LIKE_ID || likedJob.id || Math.random(),
            likeId: likedJob.LIKE_ID || "",
            jobId: likedJob.JOB_ID || "",
            title: likedJob.TITLE || likedJob.job_title || "Untitled Position",
            company: likedJob.COMPANY || likedJob.company || "Unknown Company",
            location:
              likedJob.LOCATION || (likedJob.REMOTE_OPTION ? "Remote" : ""),
            remoteOption: !!likedJob.REMOTE_OPTION,
            salary:
              likedJob.SALARY_MIN && likedJob.SALARY_MAX
                ? `$${Math.round(likedJob.SALARY_MIN / 1000)}k – $${Math.round(likedJob.SALARY_MAX / 1000)}k`
                : "Competitive",
            salaryMin: likedJob.SALARY_MIN ?? undefined,
            salaryMax: likedJob.SALARY_MAX ?? undefined,
            salaryCurrency: likedJob.SALARY_CURRENCY || "USD",
            type: likedJob.EXPERIENCE_LEVEL || "Full-time",
            experienceLevel: likedJob.EXPERIENCE_LEVEL || "",
            image: likedJob.SPONSOR_PHOTO_URL || "",
            description: likedJob.DESCRIPTION || "",
            // ATS-enriched fields from PR #41 — COALESCE'd from the sponsored
            // posting first, ats.silver_jobs second. Manually-created jobs
            // without a reference_job_id come back null and the sections stay
            // hidden.
            coreResponsibilities: likedJob.RESPONSIBILITIES || "",
            workArrangement: likedJob.WORK_ARRANGEMENT || "",
            skills: parseArray(likedJob.KEY_SKILLS),
            benefits: parseArray(likedJob.BENEFITS),
            status: likedJob.STATUS || "ACTIVE",
            likedAt: likedJob.LIKED_AT || likedJob.liked_at || "",
            sponsorInfo: {
              name:
                likedJob.SPONSOR_FIRST_NAME && likedJob.SPONSOR_LAST_NAME
                  ? `${likedJob.SPONSOR_FIRST_NAME} ${likedJob.SPONSOR_LAST_NAME}`
                  : "Pending",
              role: likedJob.SPONSOR_JOB_TITLE || "Sponsor",
              image: likedJob.SPONSOR_PHOTO_URL || "",
              canRefer: likedJob.STATUS === "MATCHED",
            },
          }),
        );

        setLikedJobs(transformedJobs);
      } catch (err) {
        console.warn("[MatchesView] Failed to fetch liked jobs:", err);
        setLikedJobsError(
          err instanceof Error ? err.message : "Failed to fetch liked jobs",
        );
      } finally {
        setLikedJobsLoading(false);
      }
    };

    fetchLikedJobs();
  }, [userType]);

  // Fetch interested sponsors (sponsors who liked applicant but haven't matched)
  useEffect(() => {
    const fetchInterestedSponsors = async () => {
      if (userType !== "applicant") return;

      try {
        setInterestedSponsorsLoading(true);
        const response = await getInterestedSponsors();
        const sponsorArray = Array.isArray(response) ? response : [];

        setInterestedSponsors(
          sponsorArray.map((s: any) => ({
            likeId: s.LIKE_ID || String(Math.random()),
            userId: s.SPONSOR_USER_ID || "",
            likedAt: s.LIKED_AT || "",
            name:
              s.SPONSOR_FIRST_NAME && s.SPONSOR_LAST_NAME
                ? `${s.SPONSOR_FIRST_NAME} ${s.SPONSOR_LAST_NAME}`
                : s.SPONSOR_FIRST_NAME || "Sponsor",
            firstName: s.SPONSOR_FIRST_NAME || "Sponsor",
            role: s.SPONSOR_JOB_TITLE || "",
            company: s.SPONSOR_COMPANY || "",
            image: s.SPONSOR_PHOTO_URL || "",
            jobId: s.JOB_ID || "",
          })),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 404 = endpoint not yet deployed on backend — show empty state silently
        if (msg === "Not found" || msg.includes("404")) {
          console.log(
            "[MatchesView] /api/likes/profiles/received/ not available yet — showing empty state",
          );
          setInterestedSponsors([]);
        } else {
          console.warn(
            "[MatchesView] Failed to fetch interested sponsors:",
            err,
          );
          setInterestedSponsorsError(msg);
        }
      } finally {
        setInterestedSponsorsLoading(false);
      }
    };

    fetchInterestedSponsors();
  }, [userType, matchesRefreshKey]);

  // Fetch sponsor-requests (sponsor view) — applicants asking employees at
  // the sponsor's company to sponsor a job. Until a dedicated endpoint
  // exists (see BACKEND_CHANGES_NEEDED.md) we derive these from the
  // notifications feed: type === "sponsor_request" + IS_READ === false so a
  // request drops off as soon as the sponsor connects with the applicant.
  useEffect(() => {
    const fetchSponsorRequests = async () => {
      if (userType !== "sponsor") return;
      try {
        setSponsorRequestsLoading(true);
        const response = await getNotifications({ limit: 50 });
        const requests: SponsorRequest[] = response.notifications
          .filter((n) => n.TYPE === "sponsor_request" && !n.IS_READ)
          .filter(
            (n) =>
              !!n.RELATED_USER_ID &&
              !!n.RELATED_JOB_ID &&
              !!n.RELATED_USER_NAME,
          )
          .map((n) => ({
            notificationId: n.NOTIFICATION_ID,
            applicantUserId: n.RELATED_USER_ID as string,
            applicantName: n.RELATED_USER_NAME as string,
            applicantPhoto: n.RELATED_USER_PHOTO_URL,
            jobId: n.RELATED_JOB_ID as string,
            jobTitle: n.RELATED_JOB_TITLE ?? "Untitled role",
            jobCompany: n.RELATED_JOB_COMPANY ?? "",
            createdAt: n.CREATED_AT,
          }));
        setSponsorRequests(requests);
        setSponsorRequestsError(null);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load sponsor requests";
        if (msg.includes("404") || msg.includes("Not found")) {
          setSponsorRequests([]);
        } else {
          console.warn("[MatchesView] Failed to fetch sponsor requests:", err);
          setSponsorRequestsError(msg);
        }
      } finally {
        setSponsorRequestsLoading(false);
      }
    };
    fetchSponsorRequests();
  }, [userType, matchesRefreshKey]);

  // Fetch waitlisted jobs for applicants
  useEffect(() => {
    const fetchWaitlistedJobs = async () => {
      if (userType !== "applicant") return;

      try {
        setWaitlistedJobsLoading(true);
        const response = await getWaitlistedJobs();
        setWaitlistedJobs(response.jobs);
      } catch (err) {
        console.warn("[MatchesView] Failed to fetch waitlisted jobs:", err);
        setWaitlistedJobsError(
          err instanceof Error
            ? err.message
            : "Failed to fetch waitlisted jobs",
        );
      } finally {
        setWaitlistedJobsLoading(false);
      }
    };

    fetchWaitlistedJobs();
  }, [userType]);

  // Fetch referrals — role-aware: sponsors see submitted referrals, applicants see received referrals
  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        setReferralsLoading(true);
        const response = await listReferrals({ limit: 50, offset: 0 });

        const transformed: Referral[] = (response.referrals || []).map(
          (r: any) => ({
            referralId: r.REFERRAL_ID || r.referral_id || "",
            jobId: r.JOB_ID || r.job_id || "",
            applicantUserId: r.APPLICANT_USER_ID || r.applicant_user_id || "",
            sponsorUserId: r.SPONSOR_USER_ID || r.sponsor_user_id || "",
            status: r.STATUS || r.status || "REFERRED",
            referralNote: r.REFERRAL_NOTE || r.referral_note || null,
            createdAt: r.CREATED_AT || r.created_at || "",
            applicantFirstName:
              r.APPLICANT_FIRST_NAME || r.applicant_first_name || null,
            applicantLastName:
              r.APPLICANT_LAST_NAME || r.applicant_last_name || null,
            applicantPhotoUrl:
              r.APPLICANT_PHOTO_URL || r.applicant_photo_url || null,
            jobTitle: r.JOB_TITLE || r.job_title || null,
            jobCompany: r.JOB_COMPANY || r.job_company || null,
          }),
        );
        setReferrals(transformed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 404 means no referrals yet — show empty state, not an error
        if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
          console.warn("[MatchesView] Failed to fetch referrals:", err);
          setReferralsError(msg);
        }
      } finally {
        setReferralsLoading(false);
      }
    };

    fetchReferrals();
  }, [userType]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveSlide(slide);
  };

  const openProfile = (profile: Match, mode: "view" | "message") => {
    setModalMode(mode);
    setSelectedProfile(profile);
    setActiveSlide(0);
    setSponsorPublicProfile(null);
    // Fetch the sponsor's full public profile for the Key Insights page.
    // SPONSOR_USER_ID is returned by GET /api/matches/ as of April 2026.
    if (profile.sponsorUserId) {
      setSponsorPublicProfileLoading(true);
      getPublicProfile(String(profile.sponsorUserId))
        .then((p) => setSponsorPublicProfile(p))
        .catch(() => {}) // silently fall through to placeholder UI
        .finally(() => setSponsorPublicProfileLoading(false));
    }
  };

  const openJob = (job: JobOpportunity) => {
    setSelectedJob(job);
    setActiveSlide(0);
  };

  const openInterestedSponsor = async (sponsor: InterestedSponsor) => {
    setActiveSlide(0);
    setInterestedSponsorProfile(null);
    setSelectedInterestedSponsor(sponsor);
    if (sponsor.userId) {
      try {
        setInterestedSponsorProfileLoading(true);
        const profile = await getPublicProfile(sponsor.userId);
        setInterestedSponsorProfile(profile);
      } catch (err) {
        console.warn(
          "[MatchesView] Failed to load sponsor public profile:",
          err,
        );
      } finally {
        setInterestedSponsorProfileLoading(false);
      }
    }
  };

  const closeAllModals = () => {
    setSelectedProfile(null);
    setSelectedJob(null);
    setSelectedInterestedSponsor(null);
    setInterestedSponsorProfile(null);
    setSelectedWaitlistedJob(null);
    setSelectedSponsorRequest(null);
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

      // Step C: mark the source notification read so the request disappears.
      markNotificationAsRead(request.notificationId).catch(() => {});
      setSponsorRequests((prev) =>
        prev.filter((r) => r.notificationId !== request.notificationId),
      );
      setMatchesRefreshKey((k) => k + 1);

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

  // Legacy single-tap connect (no longer exposed in UI — kept for reference)
  const handleConnectToApplicant = async (request: SponsorRequest) => {
    setIsConnectingToApplicant(true);
    try {
      const res = await likeProfile(request.applicantUserId, request.jobId);
      // Mark the source notification read so the request drops off the
      // section immediately (and won't reappear on next fetch).
      markNotificationAsRead(request.notificationId).catch((err) =>
        console.warn(
          "[MatchesView] Failed to mark sponsor-request notification read:",
          err,
        ),
      );
      setSponsorRequests((prev) =>
        prev.filter((r) => r.notificationId !== request.notificationId),
      );
      setMatchesRefreshKey((k) => k + 1);
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
        setInterestedSponsors((prev) =>
          prev.filter((s) => s.likeId !== sponsor.likeId),
        );
        setMatchesRefreshKey((k) => k + 1);
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
      setReferrals((prev) =>
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
    setReferrals((prev) =>
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
      setReferrals((prev) =>
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
      >
        <View style={styles.header}>
          <Text style={styles.title}>Opportunities</Text>
          <Text style={styles.subtitle}>
            {userType === "applicant"
              ? "Your active opportunities & sponsors"
              : "Talent you are sponsoring"}
          </Text>
        </View>

        {userType === "sponsor" ? (
          /* SPONSOR VIEW */
          <>
            {/* Sponsor Requests — applicants asking employees at the company
                to sponsor a job for them. Top of funnel: incoming asks. */}
            <View style={styles.sectionContainer}>
              <Text style={styles.listSectionTitle}>
                {sponsorRequestsLoading
                  ? "Loading..."
                  : `Sponsor Requests (${sponsorRequests.length})`}
              </Text>
              <Text style={[styles.sectionSubtitle, { marginBottom: 15 }]}>
                Applicants asking you to sponsor a role at your company
              </Text>
              {sponsorRequestsError && (
                <Text
                  style={{
                    color: "#FF3B30",
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {sponsorRequestsError}
                </Text>
              )}
              {!sponsorRequestsLoading && sponsorRequests.length === 0 ? (
                <View style={styles.emptyLikedSection}>
                  <View style={styles.emptyIconContainer}>
                    <BellRing size={32} color="#CCC" />
                  </View>
                  <Text style={styles.emptyLikedTitle}>No requests yet</Text>
                  <Text style={styles.emptyLikedText}>
                    When applicants ask for sponsorship on a job at your
                    company, they'll show up here.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {sponsorRequests.map((req, index) => (
                    <Animated.View
                      key={req.notificationId}
                      entering={FadeInRight.delay(index * 100)}
                      style={styles.card}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelectedSponsorRequest(req)}
                      >
                        {req.applicantPhoto ? (
                          <Image
                            source={{ uri: req.applicantPhoto }}
                            style={styles.profileImage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.profileImage,
                              {
                                backgroundColor: "#F2F2F2",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 24,
                                fontWeight: "700",
                                color: "#999",
                              }}
                            >
                              {(req.applicantName || "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.cardName}>{req.applicantName}</Text>
                        <Text style={styles.cardRole} numberOfLines={2}>
                          {req.jobTitle}
                        </Text>
                        {!!req.jobCompany && (
                          <Text
                            style={[
                              styles.cardRole,
                              { color: "#999", fontSize: 12 },
                            ]}
                            numberOfLines={1}
                          >
                            {req.jobCompany}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Interested Applicants */}
            <View style={styles.sectionContainer}>
              <Text style={styles.listSectionTitle}>
                {matchesLoading
                  ? "Loading..."
                  : `Interested Applicants (${matches.length})`}
              </Text>
              <Text style={[styles.sectionSubtitle, { marginBottom: 15 }]}>
                Applicants you've matched with — message them to start a
                conversation
              </Text>
              {matchesError && (
                <Text
                  style={{
                    color: "#FF3B30",
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {matchesError}
                </Text>
              )}
              {!matchesLoading && matches.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: "#666", fontSize: 15 }}>
                    No matches yet. Keep swiping!
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {matches.map((match, index) => (
                    <Animated.View
                      key={match.id}
                      entering={FadeInRight.delay(index * 100)}
                      style={styles.card}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openProfile(match, "view")}
                      >
                        {match.image ? (
                          <Image
                            source={{ uri: match.image }}
                            style={styles.profileImage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.profileImage,
                              {
                                backgroundColor: "#000",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 26,
                                fontWeight: "800",
                                color: "#FFF",
                              }}
                            >
                              {(match.name || "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.cardName}>{match.name}</Text>
                      <Text style={styles.cardRole}>{match.role}</Text>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() => {
                          trackMatchMessageTapped({ jobId: match.jobId });
                          onNavigateToMessages?.(match.jobId ?? "");
                        }}
                      >
                        <MessageCircle
                          color="#FFF"
                          size={16}
                          strokeWidth={2.5}
                        />
                        <Text style={styles.messageBtnText}>Message</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Active Pipeline — driven by real submitted referrals */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>
                {referralsLoading
                  ? "Loading Pipeline..."
                  : `Active Pipeline (${referrals.filter((r) => r.status === "REFERRED").length})`}
              </Text>
              <Text style={[styles.sectionSubtitle, { marginBottom: 12 }]}>
                Applicants you've formally referred — track their status here
              </Text>
              {referralsError && (
                <Text
                  style={{ color: "#FF3B30", marginBottom: 12, fontSize: 13 }}
                >
                  {referralsError}
                </Text>
              )}
              {!referralsLoading && referrals.length === 0 ? (
                <Animated.View
                  entering={FadeInUp}
                  style={styles.pipelineEmptyState}
                >
                  <View style={styles.pipelineEmptyIcon}>
                    <Users size={28} color="#CCC" />
                  </View>
                  <Text style={styles.pipelineEmptyTitle}>
                    No referrals yet
                  </Text>
                  <Text style={styles.pipelineEmptyText}>
                    When you submit a referral from the Messages tab, it will
                    appear here with live status tracking.
                  </Text>
                </Animated.View>
              ) : (
                referrals.map((referral, index) => {
                  // Try to find the full match object so "View" opens the profile modal
                  const matchForReferral = matches.find(
                    (m) => m.applicantUserId === referral.applicantUserId,
                  );
                  const applicantName =
                    [referral.applicantFirstName, referral.applicantLastName]
                      .filter(Boolean)
                      .join(" ") ||
                    matchForReferral?.name ||
                    "Applicant";
                  const applicantImage =
                    referral.applicantPhotoUrl || matchForReferral?.image || "";
                  const isReferred = referral.status === "REFERRED";
                  const isWithdrawing =
                    withdrawingReferralId === referral.referralId;

                  return (
                    <Animated.View
                      key={`referral-${referral.referralId || index}`}
                      entering={FadeInUp.delay(index * 80)}
                      style={[
                        styles.listItem,
                        !isReferred && styles.listItemWithdrawn,
                      ]}
                    >
                      {applicantImage ? (
                        <Image
                          source={{ uri: applicantImage }}
                          style={styles.listImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.listImage,
                            {
                              backgroundColor: "#000",
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 20,
                              fontWeight: "800",
                              color: "#FFF",
                            }}
                          >
                            {(applicantName || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.listInfo}>
                        <Text
                          style={[
                            styles.listName,
                            !isReferred && styles.listNameWithdrawn,
                          ]}
                        >
                          {applicantName}
                        </Text>
                        <Text style={styles.pipelineRoleText}>
                          {referral.jobTitle || matchForReferral?.appliedRole
                            ? `Referred for ${referral.jobTitle || matchForReferral?.appliedRole}`
                            : "Referred"}
                        </Text>
                        <View
                          style={
                            isReferred
                              ? styles.referralBadgeReferred
                              : styles.referralBadgeWithdrawn
                          }
                        >
                          <View
                            style={[
                              styles.statusDot,
                              isReferred
                                ? styles.statusDotReferred
                                : styles.statusDotWithdrawn,
                            ]}
                          />
                          <Text
                            style={
                              isReferred
                                ? styles.referralStatusTextReferred
                                : styles.referralStatusTextWithdrawn
                            }
                          >
                            {isReferred ? "Referred" : "Withdrawn"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.pipelineActions}>
                        {matchForReferral && (
                          <TouchableOpacity
                            style={styles.viewProfileBtn}
                            onPress={() =>
                              openProfile(matchForReferral, "view")
                            }
                          >
                            <Text style={styles.viewProfileText}>View</Text>
                          </TouchableOpacity>
                        )}
                        {isReferred && (
                          <TouchableOpacity
                            style={[
                              styles.withdrawBtn,
                              isWithdrawing && styles.withdrawBtnDisabled,
                            ]}
                            onPress={() =>
                              setConfirmingWithdrawReferral(referral)
                            }
                            disabled={isWithdrawing}
                          >
                            {isWithdrawing ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text style={styles.withdrawBtnText}>
                                Withdraw
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </>
        ) : (
          /* APPLICANT VIEW */
          <>
            {/* Liked Jobs - Waiting for Response */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.listSectionTitle}>
                    {likedJobsLoading
                      ? "Loading..."
                      : `Applied Jobs (${likedJobs.length})`}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Jobs you've expressed interest in — waiting for the sponsor
                    to respond
                  </Text>
                </View>
              </View>
              {likedJobsError && (
                <Text
                  style={{
                    color: "#FF3B30",
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {likedJobsError}
                </Text>
              )}
              {!likedJobsLoading && likedJobs.length === 0 ? (
                <View style={styles.emptyLikedSection}>
                  <View style={styles.emptyIconContainer}>
                    <Heart size={32} color="#CCC" />
                  </View>
                  <Text style={styles.emptyLikedTitle}>
                    No Applications Yet
                  </Text>
                  <Text style={styles.emptyLikedText}>
                    Start exploring jobs and express your interest!
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {likedJobs.map((job, index) => (
                    <Animated.View
                      key={String(job.id)}
                      entering={FadeInRight.delay(index * 100)}
                      style={styles.likedJobCard}
                    >
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => openJob(job)}
                      >
                        <View style={styles.jobCardInfo}>
                          <View style={styles.likedJobInitial}>
                            <Text style={styles.likedJobInitialText}>
                              {(job.company || "?")[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.jobCardTitle} numberOfLines={2}>
                            {job.title}
                          </Text>
                          <Text style={styles.jobCardCompany}>
                            {job.company}
                          </Text>
                          {!!job.location && (
                            <Text
                              style={styles.likedJobLocation}
                              numberOfLines={1}
                            >
                              {job.location}
                            </Text>
                          )}
                          {job.status === "MATCHED" ? (
                            <View style={styles.waitingBadge}>
                              <CheckCircle size={10} color="#00CB54" />
                              <Text
                                style={[
                                  styles.waitingText,
                                  { color: "#00CB54" },
                                ]}
                              >
                                Matched!
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.waitingBadge}>
                              <View style={styles.pulsingDot} />
                              <Text style={styles.waitingText}>
                                Pending match...
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Waitlisted Jobs — jobs the applicant joined the waitlist for */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.listSectionTitle}>
                    {waitlistedJobsLoading
                      ? "Loading..."
                      : `Waitlisted (${waitlistedJobs.length})`}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Jobs you’ve asked to be sponsored — we’ll notify you the
                    moment a sponsor signs on
                  </Text>
                </View>
                {waitlistedJobs.some((j) => j.is_now_sponsored) && (
                  <View
                    style={[
                      styles.pendingBadge,
                      { backgroundColor: "#F0FFF4", borderColor: "#BBF7D0" },
                    ]}
                  >
                    <Sparkles size={12} color="#00CB54" />
                    <Text style={[styles.pendingText, { color: "#00CB54" }]}>
                      Sponsored!
                    </Text>
                  </View>
                )}
              </View>

              {waitlistedJobsError && (
                <Text
                  style={{
                    color: "#FF3B30",
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {waitlistedJobsError}
                </Text>
              )}

              {!waitlistedJobsLoading && waitlistedJobs.length === 0 ? (
                <View style={styles.emptyLikedSection}>
                  <View style={styles.emptyIconContainer}>
                    <Clock size={32} color="#CCC" />
                  </View>
                  <Text style={styles.emptyLikedTitle}>No Waitlisted Jobs</Text>
                  <Text style={styles.emptyLikedText}>
                    Join a waitlist when you see a job without a sponsor —
                    you’ll be notified the moment one signs on.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {waitlistedJobs.map((job, index) => (
                    <Animated.View
                      key={job.waitlist_id}
                      entering={FadeInRight.delay(index * 100)}
                      style={[
                        styles.likedJobCard,
                        job.is_now_sponsored &&
                          styles.waitlistedJobCardSponsored,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => setSelectedWaitlistedJob(job)}
                      >
                        <View style={styles.jobCardInfo}>
                          <View
                            style={[
                              styles.likedJobInitial,
                              job.is_now_sponsored && {
                                backgroundColor: "#00CB54",
                              },
                            ]}
                          >
                            <Text style={styles.likedJobInitialText}>
                              {(job.organization || "?")[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.jobCardTitle} numberOfLines={2}>
                            {job.title}
                          </Text>
                          <Text style={styles.jobCardCompany}>
                            {job.organization}
                          </Text>
                          {!!job.location && (
                            <Text
                              style={styles.likedJobLocation}
                              numberOfLines={1}
                            >
                              {job.location}
                            </Text>
                          )}
                          {job.is_now_sponsored ? (
                            <View
                              style={[
                                styles.waitingBadge,
                                styles.waitingBadgeSponsored,
                              ]}
                            >
                              <CheckCircle size={10} color="#00CB54" />
                              <Text
                                style={[
                                  styles.waitingText,
                                  { color: "#00CB54" },
                                ]}
                              >
                                Now Sponsored!
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.waitingBadge,
                                styles.waitingBadgeWaitlist,
                              ]}
                            >
                              <Clock size={10} color="#D97706" />
                              <Text
                                style={[
                                  styles.waitingText,
                                  { color: "#D97706" },
                                ]}
                              >
                                Waiting for sponsor
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Matched Opportunities */}
            {matches.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.listSectionTitle}>
                  Matched Opportunities ({matches.length})
                </Text>
                <Text style={[styles.sectionSubtitle, { marginBottom: 15 }]}>
                  You and the sponsor both said yes — start chatting
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {matches.map((match, index) => (
                    <Animated.View
                      key={match.id}
                      entering={FadeInRight.delay(index * 100)}
                      style={styles.card}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openProfile(match, "view")}
                      >
                        {match.image ? (
                          <Image
                            source={{ uri: match.image }}
                            style={styles.profileImage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.profileImage,
                              {
                                backgroundColor: "#000",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 26,
                                fontWeight: "800",
                                color: "#FFF",
                              }}
                            >
                              {(match.name || "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.cardName}>{match.name}</Text>
                      <Text style={styles.cardRole}>{match.role}</Text>
                      <View style={styles.matchBadgeCard}>
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.matchBadgeText}>Matched!</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() => {
                          trackMatchMessageTapped({ jobId: match.jobId });
                          onNavigateToMessages?.(match.jobId ?? "");
                        }}
                      >
                        <MessageCircle
                          color="#FFF"
                          size={16}
                          strokeWidth={2.5}
                        />
                        <Text style={styles.messageBtnText}>Message</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Interested Sponsors Section */}
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.listSectionTitle}>
                    {interestedSponsorsLoading
                      ? "Loading..."
                      : `Interested in You (${interestedSponsors.length})`}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Sponsors who swiped right on your profile — connect back to
                    match
                  </Text>
                </View>
              </View>

              {interestedSponsorsError && (
                <Text
                  style={{
                    color: "#FF3B30",
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  {interestedSponsorsError}
                </Text>
              )}

              {!interestedSponsorsLoading && interestedSponsors.length === 0 ? (
                <View style={styles.emptySponsorsContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Users size={32} color="#CCC" />
                  </View>
                  <Text style={styles.emptyLikedTitle}>No Sponsors Yet</Text>
                  <Text style={styles.emptyLikedText}>
                    Keep building your profile — sponsors who want to connect
                    with you will appear here.
                  </Text>
                </View>
              ) : (
                interestedSponsors.map((sponsor, index) => (
                  <Animated.View
                    key={sponsor.likeId}
                    entering={FadeInUp.delay(index * 80)}
                  >
                    <TouchableOpacity
                      style={styles.interestedSponsorCard}
                      activeOpacity={0.85}
                      onPress={() => openInterestedSponsor(sponsor)}
                    >
                      {sponsor.image ? (
                        <Image
                          source={{ uri: sponsor.image }}
                          style={styles.interestedSponsorAvatar}
                        />
                      ) : (
                        <View style={styles.interestedSponsorInitial}>
                          <Text style={styles.interestedSponsorInitialText}>
                            {(sponsor.name || "S")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.interestedSponsorInfo}>
                        <Text style={styles.interestedSponsorName}>
                          {sponsor.name}
                        </Text>
                        {!!(sponsor.role || sponsor.company) && (
                          <Text
                            style={styles.interestedSponsorRole}
                            numberOfLines={1}
                          >
                            {sponsor.role}
                            {sponsor.role && sponsor.company ? " · " : ""}
                            {sponsor.company}
                          </Text>
                        )}
                        {!!sponsor.likedAt && (
                          <View style={styles.interestedSponsorTimestamp}>
                            <Heart size={10} color="#E53E3E" />
                            <Text style={styles.interestedSponsorTimestampText}>
                              {getRelativeTime(sponsor.likedAt)}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.interestedSponsorCta}>
                        <Text style={styles.interestedSponsorCtaText}>
                          View
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))
              )}
            </View>

            {/* Referrals Received — applicants see referrals submitted for them */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>
                {referralsLoading
                  ? "Loading Referrals..."
                  : `Referrals Received (${referrals.filter((r) => r.status === "REFERRED").length})`}
              </Text>
              <Text style={[styles.sectionSubtitle, { marginBottom: 12 }]}>
                Sponsors who have formally referred you for a role
              </Text>

              {referralsError && (
                <Text
                  style={{ color: "#FF3B30", fontSize: 13, marginBottom: 12 }}
                >
                  {referralsError}
                </Text>
              )}

              {!referralsLoading && referrals.length === 0 ? (
                <Animated.View
                  entering={FadeInUp}
                  style={styles.pipelineEmptyState}
                >
                  <View style={styles.pipelineEmptyIcon}>
                    <Award size={28} color="#CCC" />
                  </View>
                  <Text style={styles.pipelineEmptyTitle}>
                    No Referrals Yet
                  </Text>
                  <Text style={styles.pipelineEmptyText}>
                    When a matched sponsor formally refers you for a role, it
                    will appear here.
                  </Text>
                </Animated.View>
              ) : (
                referrals.map((referral, index) => {
                  const isReferred = referral.status === "REFERRED";
                  const sponsorName =
                    [referral.applicantFirstName, referral.applicantLastName]
                      .filter(Boolean)
                      .join(" ") || "Sponsor";
                  // For applicants the "applicantFirstName" field from the API
                  // actually holds the SPONSOR name (since the role-aware endpoint
                  // returns the other party's name). Use sponsorUserId for display.
                  return (
                    <Animated.View
                      key={`recv-referral-${referral.referralId || index}`}
                      entering={FadeInUp.delay(index * 80)}
                      style={[
                        styles.listItem,
                        !isReferred && styles.listItemWithdrawn,
                      ]}
                    >
                      <View style={styles.listImagePlaceholder}>
                        <Award
                          size={20}
                          color={isReferred ? "#00CB54" : "#CCC"}
                        />
                      </View>
                      <View style={styles.listInfo}>
                        <Text
                          style={[
                            styles.listName,
                            !isReferred && styles.listNameWithdrawn,
                          ]}
                        >
                          {referral.jobTitle || "Open Role"}
                        </Text>
                        <Text style={styles.pipelineRoleText}>
                          {referral.jobCompany
                            ? `at ${referral.jobCompany}`
                            : "Role referred"}
                        </Text>
                        <View
                          style={
                            isReferred
                              ? styles.referralBadgeReferred
                              : styles.referralBadgeWithdrawn
                          }
                        >
                          <View
                            style={[
                              styles.statusDot,
                              isReferred
                                ? styles.statusDotReferred
                                : styles.statusDotWithdrawn,
                            ]}
                          />
                          <Text
                            style={
                              isReferred
                                ? styles.referralStatusTextReferred
                                : styles.referralStatusTextWithdrawn
                            }
                          >
                            {isReferred ? "Referred" : "Withdrawn"}
                          </Text>
                        </View>
                        {!!referral.createdAt && (
                          <Text style={styles.referralDateText}>
                            {getRelativeTime(referral.createdAt)}
                          </Text>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sponsor Profile Modal (for Applicants) */}
      <Modal visible={!!selectedProfile} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeAllModals}
            style={styles.modalContent}
          >
            {selectedProfile && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* ── Sponsor Identity ─────────────────────────────── */}
                <View style={styles.smHeroRow}>
                  {selectedProfile.image ? (
                    <Image
                      source={{ uri: selectedProfile.image }}
                      style={styles.smAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.smAvatar,
                        {
                          backgroundColor: "#000",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: "800",
                          color: "#FFF",
                        }}
                      >
                        {(selectedProfile.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.smName}>{selectedProfile.name}</Text>
                    {!!(selectedProfile.role || selectedProfile.company) && (
                      <Text style={styles.smMeta} numberOfLines={2}>
                        {[selectedProfile.role, selectedProfile.company]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                    <View style={styles.smMatchedBadge}>
                      <CheckCircle size={11} color="#00CB54" />
                      <Text style={styles.smMatchedText}>Matched</Text>
                    </View>
                  </View>
                </View>

                {/* ── Role / Job Context ───────────────────────────── */}
                {!!(selectedProfile.appliedRole || selectedProfile.company) && (
                  <View style={styles.smJobBlock}>
                    <Text style={styles.smSectionLabel}>ROLE</Text>
                    <Text style={styles.smJobTitle}>
                      {selectedProfile.appliedRole ||
                        sponsorPublicProfile?.sponsor_profile?.JOB_TITLE ||
                        "Open Role"}
                    </Text>
                    {!!selectedProfile.company && (
                      <Text style={styles.smJobCompany}>
                        {selectedProfile.company}
                      </Text>
                    )}
                  </View>
                )}

                {/* ── Sponsor Capabilities ─────────────────────────── */}
                {sponsorPublicProfileLoading ? (
                  <View style={styles.smLoadingRow}>
                    <ActivityIndicator size="small" color="#999" />
                    <Text style={styles.smLoadingText}>
                      Loading sponsor details…
                    </Text>
                  </View>
                ) : sponsorPublicProfile ? (
                  <>
                    {/* Capability pills */}
                    {(sponsorPublicProfile?.sponsor_profile
                      ?.OPEN_TO_REFERRALS ||
                      sponsorPublicProfile?.sponsor_profile?.FINANCIAL_REWARD ||
                      !!sponsorPublicProfile?.sponsor_profile?.DURATION) && (
                      <View style={styles.smCapRow}>
                        {sponsorPublicProfile.sponsor_profile
                          .OPEN_TO_REFERRALS && (
                          <View style={styles.smCapPill}>
                            <Text style={styles.smCapPillText}>
                              Open to Referrals
                            </Text>
                          </View>
                        )}
                        {sponsorPublicProfile.sponsor_profile
                          .FINANCIAL_REWARD && (
                          <View style={styles.smCapPill}>
                            <Text style={styles.smCapPillText}>
                              Financial Reward
                            </Text>
                          </View>
                        )}
                        {!!sponsorPublicProfile.sponsor_profile.DURATION && (
                          <View style={styles.smCapPill}>
                            <Text style={styles.smCapPillText}>
                              {sponsorPublicProfile.sponsor_profile.DURATION}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Companies can refer to */}
                    {(sponsorPublicProfile?.sponsor_profile
                      ?.COMPANIES_CAN_REFER_TO?.length ?? 0) > 0 && (
                      <View style={styles.smBlock}>
                        <Text style={styles.smSectionLabel}>CAN REFER TO</Text>
                        <View style={styles.smChipRow}>
                          {sponsorPublicProfile.sponsor_profile.COMPANIES_CAN_REFER_TO.map(
                            (co: string, i: number) => (
                              <View key={i} style={styles.smDarkChip}>
                                <Text style={styles.smDarkChipText}>{co}</Text>
                              </View>
                            ),
                          )}
                        </View>
                      </View>
                    )}

                    {/* Insight prompts */}
                    {(sponsorPublicProfile?.sponsor_profile?.INSIGHTS?.length ??
                      0) > 0 && (
                      <View style={styles.smBlock}>
                        <Text style={styles.smSectionLabel}>INSIGHTS</Text>
                        {sponsorPublicProfile.sponsor_profile.INSIGHTS.map(
                          (
                            insight: { question: string; answer: string },
                            idx: number,
                          ) => (
                            <View key={idx} style={styles.smInsightItem}>
                              <Text style={styles.smInsightQ}>
                                {insight.question}
                              </Text>
                              <Text style={styles.smInsightA}>
                                {insight.answer}
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  /* Fallback when sponsorUserId is absent */
                  <>
                    {(selectedProfile.role ||
                      selectedProfile.company ||
                      selectedProfile.appliedRole) && (
                      <View style={styles.smBlock}>
                        <Text style={styles.smSectionLabel}>DETAILS</Text>
                        {!!selectedProfile.role && (
                          <Text style={styles.smFallbackLine}>
                            {selectedProfile.role}
                          </Text>
                        )}
                        {!!selectedProfile.company && (
                          <Text style={styles.smFallbackLine}>
                            {selectedProfile.company}
                          </Text>
                        )}
                        {!!selectedProfile.appliedRole && (
                          <Text style={styles.smFallbackLine}>
                            Hiring for: {selectedProfile.appliedRole}
                          </Text>
                        )}
                      </View>
                    )}
                    <View style={styles.smFallbackNote}>
                      <Text style={styles.smFallbackNoteText}>
                        Message {selectedProfile.name?.split(" ")[0] ?? "them"}{" "}
                        to learn more about this opportunity.
                      </Text>
                    </View>
                  </>
                )}

                {/* ── Message CTA ──────────────────────────────────── */}
                <TouchableOpacity
                  style={styles.smMessageBtn}
                  onPress={() => {
                    trackMatchMessageTapped({ jobId: selectedProfile.jobId });
                    closeAllModals();
                    onNavigateToMessages?.(selectedProfile.jobId ?? "");
                  }}
                >
                  <MessageCircle color="#FFF" size={18} strokeWidth={2.5} />
                  <Text style={styles.smMessageBtnText}>
                    Message {selectedProfile.name?.split(" ")[0] ?? "Sponsor"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Job Details Modal (for Liked Jobs) */}
      <Modal visible={!!selectedJob} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeAllModals}
            style={styles.modalContent}
          >
            {selectedJob && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Status + Liked Date Row */}
                <View style={styles.jobModalTopRow}>
                  {selectedJob.status === "MATCHED" ? (
                    <View style={styles.jobModalMatchedBadge}>
                      <CheckCircle size={12} color="#00CB54" />
                      <Text style={styles.jobModalMatchedText}>Matched!</Text>
                    </View>
                  ) : (
                    <View style={styles.jobModalPendingBadge}>
                      <View style={styles.pulsingDot} />
                      <Text style={styles.jobModalPendingText}>
                        Pending match
                      </Text>
                    </View>
                  )}
                  {!!selectedJob.likedAt && (
                    <Text style={styles.jobModalLikedDate}>
                      Liked{" "}
                      {new Date(selectedJob.likedAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </Text>
                  )}
                </View>

                {/* Hero: Company Initial + Title + Company + Location */}
                <View style={styles.jobModalHero}>
                  <View style={styles.jobModalHeroInitial}>
                    <Text style={styles.jobModalHeroInitialText}>
                      {(selectedJob.company || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.jobModalHeroTitle}>
                    {selectedJob.title}
                  </Text>
                  <Text style={styles.jobModalHeroCompany}>
                    {selectedJob.company}
                  </Text>
                  {!!selectedJob.location && (
                    <View style={styles.jobModalLocationRow}>
                      <MapPin size={13} color="#999" />
                      <Text style={styles.jobModalLocationText}>
                        {selectedJob.location}
                      </Text>
                      {selectedJob.remoteOption && (
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
                    <DollarSign size={14} color="#555" />
                    <View>
                      <Text style={styles.jobModalCompLabel}>SALARY</Text>
                      <Text style={styles.jobModalCompValue}>
                        {selectedJob.salary}
                        {selectedJob.salaryCurrency &&
                          selectedJob.salaryCurrency !== "USD" &&
                          ` ${selectedJob.salaryCurrency}`}
                      </Text>
                    </View>
                  </View>
                  {!!selectedJob.experienceLevel && (
                    <View
                      style={[
                        styles.jobModalCompCell,
                        styles.jobModalCompCellBorder,
                      ]}
                    >
                      <Briefcase size={14} color="#555" />
                      <View>
                        <Text style={styles.jobModalCompLabel}>EXPERIENCE</Text>
                        <Text style={styles.jobModalCompValue}>
                          {selectedJob.experienceLevel}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Role Details — work arrangement chip. Experience already
                    lives in the comp strip above so we don't duplicate it. */}
                {!!selectedJob.workArrangement && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Info size={16} color="#000" />
                      <Text style={styles.detailSectionTitle}>
                        Role Details
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      <View style={styles.roleDetailChip}>
                        <MapPin size={13} color="#000" />
                        <Text style={styles.roleDetailChipText}>
                          {selectedJob.workArrangement}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Core Responsibilities */}
                {!!selectedJob.coreResponsibilities && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Briefcase size={16} color="#000" />
                      <Text style={styles.detailSectionTitle}>
                        Core Responsibilities
                      </Text>
                    </View>
                    <View style={styles.jobDetailCard}>
                      <Text style={styles.jobDetailText}>
                        {selectedJob.coreResponsibilities}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Required Skills */}
                {selectedJob.skills.length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <TrendingUp size={16} color="#000" />
                      <Text style={styles.detailSectionTitle}>
                        Required Skills
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      {selectedJob.skills.map((skill, idx) => (
                        <View key={idx} style={styles.skillBadge}>
                          <Text style={styles.skillBadgeText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Highlights / Benefits */}
                {selectedJob.benefits.length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Sparkles size={16} color="#000" />
                      <Text style={styles.detailSectionTitle}>Highlights</Text>
                    </View>
                    {selectedJob.benefits.map((benefit, idx) => (
                      <View key={idx} style={styles.benefitRow}>
                        <Check size={14} color="#00CB54" />
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* About the Role — full description, last because it's the
                    longest free-form text. */}
                {!!selectedJob.description && (
                  <View style={styles.jobSection}>
                    <Text style={styles.jobSectionTitle}>About the Role</Text>
                    <Text style={styles.jobSectionText}>
                      {selectedJob.description}
                    </Text>
                  </View>
                )}

                {/* Sponsor Card */}
                <View style={styles.sponsorInfoCard}>
                  <View style={styles.sponsorCardHeader}>
                    <Users size={16} color="#000" />
                    <Text style={[styles.sponsorCardTitle, { flex: 1 }]}>
                      Introduced By
                    </Text>
                    {selectedJob.status === "MATCHED" && (
                      <View style={styles.jobMatchedSponsorBadge}>
                        <CheckCircle size={10} color="#00CB54" />
                        <Text style={styles.jobMatchedSponsorText}>
                          Matched Sponsor
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.sponsorCardContent}>
                    {selectedJob.sponsorInfo.image ? (
                      <Image
                        source={{ uri: selectedJob.sponsorInfo.image }}
                        style={styles.sponsorCardAvatar}
                      />
                    ) : (
                      <View style={styles.jobSponsorInitialAvatar}>
                        <Text style={styles.jobSponsorInitialText}>
                          {(selectedJob.sponsorInfo.name ||
                            "S")[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sponsorCardName}>
                        {selectedJob.sponsorInfo.name}
                      </Text>
                      {!!selectedJob.sponsorInfo.role &&
                        selectedJob.sponsorInfo.role !== "Sponsor" && (
                          <Text style={styles.sponsorCardRole}>
                            {selectedJob.sponsorInfo.role}
                          </Text>
                        )}
                    </View>
                  </View>
                </View>

                {/* Primary CTA. Messaging is gated on a mutual match —
                    applicants can only DM the sponsor after status flips to
                    "MATCHED". Before that, the CTA shows "Awaiting Sponsor"
                    so the user knows why the action is unavailable. */}
                {selectedJob.status === "MATCHED" &&
                onNavigateToMessages &&
                !!selectedJob.jobId ? (
                  <TouchableOpacity
                    style={styles.applyBtnLarge}
                    onPress={() => {
                      const jid = selectedJob.jobId as string;
                      closeAllModals();
                      onNavigateToMessages(jid);
                    }}
                  >
                    <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                    <Text style={styles.applyBtnLargeText}>
                      Message{" "}
                      {selectedJob.sponsorInfo.name !== "Pending"
                        ? selectedJob.sponsorInfo.name.split(" ")[0]
                        : "Sponsor"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.applyBtnLarge, { opacity: 0.6 }]}
                    onPress={closeAllModals}
                    activeOpacity={0.6}
                  >
                    <Clock color="#FFF" size={20} strokeWidth={2.5} />
                    <Text style={styles.applyBtnLargeText}>Pending Match</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Interested Sponsor Profile Modal */}
      <Modal
        visible={!!selectedInterestedSponsor}
        transparent
        animationType="none"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeAllModals}
            style={styles.modalContent}
          >
            {selectedInterestedSponsor && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* "Expressed Interest" tag */}
                <View style={styles.interestedModalTag}>
                  <Heart size={12} color="#E53E3E" />
                  <Text style={styles.interestedModalTagText}>
                    Wants to connect with you
                    {selectedInterestedSponsor.likedAt
                      ? ` · ${getRelativeTime(selectedInterestedSponsor.likedAt)}`
                      : ""}
                  </Text>
                </View>

                {interestedSponsorProfileLoading ? (
                  <View style={styles.interestedLoadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                    <Text style={styles.interestedLoadingText}>
                      Loading profile…
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Swipeable cards */}
                    <View style={styles.swipableContainer}>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                      >
                        {/* Page 1: Profile Overview */}
                        <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                          <View style={styles.infoCardHeader}>
                            {selectedInterestedSponsor.image ? (
                              <Image
                                source={{
                                  uri: selectedInterestedSponsor.image,
                                }}
                                style={styles.modalAvatar}
                              />
                            ) : (
                              <View style={styles.sponsorModalInitial}>
                                <Text style={styles.sponsorModalInitialText}>
                                  {(selectedInterestedSponsor.name ||
                                    "S")[0].toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.modalName}>
                                {selectedInterestedSponsor.name}
                              </Text>
                              {!!selectedInterestedSponsor.role && (
                                <Text style={styles.sponsorSubtitle}>
                                  {selectedInterestedSponsor.role}
                                </Text>
                              )}
                              {!!selectedInterestedSponsor.company && (
                                <Text style={styles.sponsorCompany}>
                                  {selectedInterestedSponsor.company}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Location */}
                          {!!interestedSponsorProfile?.LOCATION && (
                            <View
                              style={[styles.locationRow, { marginBottom: 12 }]}
                            >
                              <MapPin size={12} color="#AAA" />
                              <Text style={styles.locationText}>
                                {interestedSponsorProfile.LOCATION}
                              </Text>
                            </View>
                          )}

                          {/* Bio */}
                          {!!interestedSponsorProfile?.BIO && (
                            <Text style={styles.bioText}>
                              {interestedSponsorProfile.BIO}
                            </Text>
                          )}

                          {/* Capability Badges */}
                          <View style={styles.sponsorCapabilityRow}>
                            {interestedSponsorProfile?.sponsor_profile
                              ?.OPEN_TO_REFERRALS && (
                              <View style={styles.sponsorCapBadge}>
                                <CheckCircle size={11} color="#00CB54" />
                                <Text style={styles.sponsorCapBadgeText}>
                                  Open to Referrals
                                </Text>
                              </View>
                            )}
                            {interestedSponsorProfile?.sponsor_profile
                              ?.FINANCIAL_REWARD && (
                              <View style={styles.sponsorCapBadge}>
                                <DollarSign size={11} color="#000" />
                                <Text style={styles.sponsorCapBadgeText}>
                                  Financial Reward
                                </Text>
                              </View>
                            )}
                            {!!interestedSponsorProfile?.sponsor_profile
                              ?.DURATION && (
                              <View style={styles.sponsorCapBadge}>
                                <Award size={11} color="#000" />
                                <Text style={styles.sponsorCapBadgeText}>
                                  {
                                    interestedSponsorProfile.sponsor_profile
                                      .DURATION
                                  }
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Companies Can Refer To */}
                          {(interestedSponsorProfile?.sponsor_profile
                            ?.COMPANIES_CAN_REFER_TO?.length ?? 0) > 0 && (
                            <View style={styles.referCompaniesBlock}>
                              <Text style={styles.referCompaniesLabel}>
                                CAN REFER TO
                              </Text>
                              <View style={styles.referCompaniesList}>
                                {interestedSponsorProfile.sponsor_profile.COMPANIES_CAN_REFER_TO.map(
                                  (co: string, i: number) => (
                                    <View
                                      key={i}
                                      style={styles.referCompanyChip}
                                    >
                                      <Text style={styles.referCompanyText}>
                                        {co}
                                      </Text>
                                    </View>
                                  ),
                                )}
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Page 2: Insights */}
                        <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                          <View style={styles.insightsHeader}>
                            <Sparkles size={20} color="#000" />
                            <Text style={styles.insightsTitle}>
                              Why They Sponsor
                            </Text>
                          </View>

                          {(interestedSponsorProfile?.sponsor_profile?.INSIGHTS
                            ?.length ?? 0) > 0 ? (
                            interestedSponsorProfile.sponsor_profile.INSIGHTS.map(
                              (
                                insight: {
                                  question: string;
                                  answer: string;
                                },
                                idx: number,
                              ) => (
                                <View key={idx} style={styles.promptWrapper}>
                                  <View style={styles.promptHeaderRow}>
                                    <Zap size={14} color="#000" />
                                    <Text style={styles.insightLabel}>
                                      {insight.question}
                                    </Text>
                                  </View>
                                  <Text style={styles.promptContent}>
                                    {insight.answer}
                                  </Text>
                                </View>
                              ),
                            )
                          ) : (
                            <Text style={styles.bioText}>
                              No insights shared yet.
                            </Text>
                          )}

                          <View
                            style={[
                              styles.statItem,
                              { alignSelf: "flex-start", marginTop: 16 },
                            ]}
                          >
                            <CheckCircle size={14} color="#00CB54" />
                            <Text style={styles.statLabel}>Active Sponsor</Text>
                          </View>
                        </View>
                      </ScrollView>

                      {/* Page indicators */}
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

                    {/* CTA — connect back to close the loop and create a match */}
                    <TouchableOpacity
                      style={[
                        styles.applyBtnLarge,
                        { marginTop: 20 },
                        likingBackSponsorId ===
                          selectedInterestedSponsor.likeId && { opacity: 0.6 },
                      ]}
                      onPress={() =>
                        handleLikeBackSponsor(selectedInterestedSponsor)
                      }
                      disabled={
                        likingBackSponsorId === selectedInterestedSponsor.likeId
                      }
                    >
                      {likingBackSponsorId ===
                      selectedInterestedSponsor.likeId ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Heart color="#FFF" size={20} strokeWidth={2.5} />
                          <Text style={styles.applyBtnLargeText}>
                            Connect with {selectedInterestedSponsor.firstName}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Waitlisted Job Detail Modal */}
      <Modal visible={!!selectedWaitlistedJob} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedWaitlistedJob(null)}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeAllModals}
            style={[styles.modalContent, { maxHeight: SCREEN_HEIGHT * 0.65 }]}
          >
            {selectedWaitlistedJob && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Hero */}
                <View style={styles.jobModalHero}>
                  <View
                    style={[
                      styles.jobModalHeroInitial,
                      selectedWaitlistedJob.is_now_sponsored && {
                        backgroundColor: "#00CB54",
                      },
                    ]}
                  >
                    <Text style={styles.jobModalHeroInitialText}>
                      {(selectedWaitlistedJob.organization ||
                        "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.jobModalHeroTitle}>
                    {selectedWaitlistedJob.title}
                  </Text>
                  <Text style={styles.jobModalHeroCompany}>
                    {selectedWaitlistedJob.organization}
                  </Text>
                  {!!selectedWaitlistedJob.location && (
                    <View style={styles.jobModalLocationRow}>
                      <MapPin size={13} color="#999" />
                      <Text style={styles.jobModalLocationText}>
                        {selectedWaitlistedJob.location}
                      </Text>
                      {selectedWaitlistedJob.is_remote && (
                        <View style={styles.jobRemoteBadge}>
                          <Text style={styles.jobRemoteText}>Remote</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Status banner */}
                {selectedWaitlistedJob.is_now_sponsored ? (
                  <View
                    style={{
                      backgroundColor: "#F0FFF4",
                      borderWidth: 1,
                      borderColor: "#BBF7D0",
                      borderRadius: 18,
                      padding: 18,
                      marginBottom: 20,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                    }}
                  >
                    <CheckCircle size={22} color="#00CB54" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: "#00CB54",
                          marginBottom: 4,
                        }}
                      >
                        Now Sponsored!
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#555",
                          lineHeight: 19,
                          fontWeight: "500",
                        }}
                      >
                        A sponsor has picked up this role. Head back to your
                        feed to connect with them directly.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: "#FFFBEB",
                      borderWidth: 1,
                      borderColor: "#FDE68A",
                      borderRadius: 18,
                      padding: 18,
                      marginBottom: 20,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                    }}
                  >
                    <Clock size={22} color="#D97706" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: "#D97706",
                          marginBottom: 4,
                        }}
                      >
                        Waiting for a Sponsor
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#555",
                          lineHeight: 19,
                          fontWeight: "500",
                        }}
                      >
                        We’ll notify you as soon as someone sponsors this role.
                        Keep an eye on your notifications.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Waitlist date */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#BBB",
                    textAlign: "center",
                    marginBottom: 28,
                  }}
                >
                  Waitlisted{" "}
                  {getRelativeTime(selectedWaitlistedJob.waitlisted_at)}
                </Text>
              </ScrollView>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeAllModals}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={closeAllModals}
            style={styles.modalContent}
          >
            {selectedSponsorRequest && (
              <>
                {/* ── Step indicator (steps 2 & 3 only) ───────────────── */}
                {srStep === 2 && (
                  <View style={styles.srStepRow}>
                    <TouchableOpacity
                      onPress={() => setSrStep(1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={20} color="#999" />
                    </TouchableOpacity>
                    <View style={styles.srStepDots}>
                      <View style={[styles.srDot, styles.srDotActive]} />
                      <View style={styles.srDot} />
                    </View>
                    <Text style={styles.srStepLabel}>Step 1 of 2</Text>
                  </View>
                )}
                {srStep === 3 && (
                  <View style={styles.srStepRow}>
                    <TouchableOpacity
                      onPress={() => setSrStep(2)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={20} color="#999" />
                    </TouchableOpacity>
                    <View style={styles.srStepDots}>
                      <View style={[styles.srDot, styles.srDotActive]} />
                      <View style={[styles.srDot, styles.srDotActive]} />
                    </View>
                    <Text style={styles.srStepLabel}>Step 2 of 2</Text>
                  </View>
                )}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {/* ── STEP 1: Overview ─────────────────────────────── */}
                  {srStep === 1 && (
                    <>
                      {/* Header tag */}
                      <View style={styles.interestedModalTag}>
                        <BellRing size={12} color="#000" />
                        <Text style={styles.interestedModalTagText}>
                          Asked for sponsorship
                          {selectedSponsorRequest.createdAt
                            ? ` · ${getRelativeTime(selectedSponsorRequest.createdAt)}`
                            : ""}
                        </Text>
                      </View>

                      {/* Applicant hero */}
                      <View style={styles.sponsorRequestHero}>
                        {selectedSponsorRequest.applicantPhoto ? (
                          <Image
                            source={{
                              uri: selectedSponsorRequest.applicantPhoto,
                            }}
                            style={styles.sponsorRequestAvatar}
                          />
                        ) : (
                          <View style={styles.sponsorRequestInitial}>
                            <Text style={styles.sponsorRequestInitialText}>
                              {(selectedSponsorRequest.applicantName ||
                                "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.sponsorRequestName}>
                          {selectedSponsorRequest.applicantName}
                        </Text>
                        <Text style={styles.srOverviewSub}>
                          is asking you to sponsor this role for them
                        </Text>
                      </View>

                      {/* Job context card */}
                      <View style={styles.sponsorRequestJobCard}>
                        <View style={styles.sponsorRequestJobIconCircle}>
                          <Briefcase color="#FFF" size={18} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sponsorRequestJobLabel}>
                            WANTS SPONSORSHIP FOR
                          </Text>
                          <Text
                            style={styles.sponsorRequestJobTitle}
                            numberOfLines={2}
                          >
                            {selectedSponsorRequest.jobTitle}
                          </Text>
                          {!!selectedSponsorRequest.jobCompany && (
                            <Text style={styles.sponsorRequestJobCompany}>
                              {selectedSponsorRequest.jobCompany}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* What happens callout */}
                      <View style={[styles.srCallout, { marginTop: 20 }]}>
                        <Text style={styles.srCalloutTitle}>
                          💡 How this works
                        </Text>
                        <Text style={styles.srCalloutText}>
                          Sponsoring this role puts your name behind the job and
                          gives{" "}
                          {selectedSponsorRequest.applicantName.split(" ")[0]}{" "}
                          your insider perspective. Once you sponsor, they'll
                          see you under "Wants to Connect With You" and can
                          message you directly.
                        </Text>
                      </View>

                      {/* Primary CTA → step 2 */}
                      <TouchableOpacity
                        style={styles.applyBtnLarge}
                        onPress={() => setSrStep(2)}
                      >
                        <Briefcase color="#FFF" size={20} strokeWidth={2.5} />
                        <Text style={styles.applyBtnLargeText}>
                          Sponsor & Connect
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.srDismissBtn}
                        onPress={closeAllModals}
                      >
                        <Text style={styles.srDismissBtnText}>
                          Not right now
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── STEP 2: Relationship + Can Refer ─────────────── */}
                  {srStep === 2 && (
                    <>
                      <Text style={styles.srStepTitle}>
                        Confirm Sponsorship
                      </Text>
                      <Text style={styles.srStepSub}>
                        Help us understand your role and referral capability
                      </Text>

                      <View style={styles.srFormSection}>
                        <Text style={styles.srFieldLabel}>
                          Your relationship to this role
                        </Text>
                        {["Hiring Manager", "Team Member", "Other"].map(
                          (item) => (
                            <TouchableOpacity
                              key={item}
                              style={styles.srRadioOption}
                              onPress={() => setSrRelationship(item)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.srRadioLeft}>
                                <View
                                  style={[
                                    styles.srRadioCircle,
                                    srRelationship === item &&
                                      styles.srRadioCircleActive,
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.srRadioText,
                                    srRelationship === item &&
                                      styles.srRadioTextActive,
                                  ]}
                                >
                                  {item}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ),
                        )}
                      </View>

                      <View style={styles.srFormSection}>
                        <Text style={styles.srFieldLabel}>
                          Can you provide a referral?
                        </Text>
                        <View style={styles.srSideBySide}>
                          {[
                            { label: "Yes", value: true },
                            { label: "No", value: false },
                          ].map(({ label, value }) => (
                            <TouchableOpacity
                              key={label}
                              style={styles.srHalfOption}
                              onPress={() => setSrCanRefer(value)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.srRadioCircle,
                                  srCanRefer === value &&
                                    styles.srRadioCircleActive,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.srRadioText,
                                  srCanRefer === value &&
                                    styles.srRadioTextActive,
                                ]}
                              >
                                {label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.applyBtnLarge,
                          (!srRelationship || srCanRefer === null) && {
                            opacity: 0.35,
                          },
                        ]}
                        disabled={!srRelationship || srCanRefer === null}
                        onPress={() => setSrStep(3)}
                      >
                        <Text style={styles.applyBtnLargeText}>Continue</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── STEP 3: Insider Insights ──────────────────────── */}
                  {srStep === 3 && (
                    <>
                      <Text style={styles.srStepTitle}>
                        Add Insider Insights
                      </Text>
                      <Text style={styles.srStepSub}>
                        Share the inside story candidates won't find anywhere
                        else. All fields are optional.
                      </Text>

                      <View style={styles.srCallout}>
                        <Text style={styles.srCalloutTitle}>
                          💡 Why This Matters
                        </Text>
                        <Text style={styles.srCalloutText}>
                          Unlike traditional job boards, Backchannel gives
                          candidates real insider knowledge — which means better
                          applicants and fewer surprises on both sides.
                        </Text>
                      </View>

                      {[
                        {
                          label: "The Real Day-to-Day",
                          hint: "What does this role actually look like beyond the job description?",
                          placeholder:
                            "Be honest about daily work — meetings, focus time, pace, autonomy...",
                          value: srDayToDay,
                          setter: setSrDayToDay,
                        },
                        {
                          label: "Team Culture & Dynamics",
                          hint: "Give candidates a real sense of who they'll be working with.",
                          placeholder:
                            "Team size, seniority mix, remote vs. in-office norms, collaboration style...",
                          value: srTeamCulture,
                          setter: setSrTeamCulture,
                        },
                        {
                          label: "Who Actually Thrives Here",
                          hint: "What matters more than what's on the resume?",
                          placeholder:
                            "Mindset, soft skills, working style, previous backgrounds that tend to succeed...",
                          value: srIdealCandidate,
                          setter: setSrIdealCandidate,
                        },
                        {
                          label: "Everything Else Worth Knowing",
                          hint: "Interview process, growth path, comp notes, anything candidates should know.",
                          placeholder:
                            "Interview format, timeline, promotion path, equity situation...",
                          value: srInsiderInsights,
                          setter: setSrInsiderInsights,
                        },
                      ].map(({ label, hint, placeholder, value, setter }) => (
                        <View key={label} style={styles.srFormSection}>
                          <Text style={styles.srFieldLabel}>{label}</Text>
                          <Text style={styles.srFieldHint}>{hint}</Text>
                          <TextInput
                            style={styles.srTextInput}
                            placeholder={placeholder}
                            placeholderTextColor="#999"
                            value={value}
                            onChangeText={setter}
                            multiline
                            numberOfLines={4}
                            onSubmitEditing={() => Keyboard.dismiss()}
                          />
                        </View>
                      ))}

                      <TouchableOpacity
                        style={[
                          styles.applyBtnLarge,
                          srSponsoring && { opacity: 0.6 },
                        ]}
                        disabled={srSponsoring}
                        onPress={() =>
                          handleSponsorAndConnect(selectedSponsorRequest)
                        }
                      >
                        {srSponsoring ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Check color="#FFF" size={20} strokeWidth={2.5} />
                            <Text style={styles.applyBtnLargeText}>
                              Confirm Sponsorship
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── STEP 4: Success ───────────────────────────────── */}
                  {srStep === 4 && (
                    <Animated.View
                      entering={FadeIn}
                      style={styles.srSuccessContainer}
                    >
                      <View style={styles.srSuccessIconCircle}>
                        <Check color="#FFF" size={36} strokeWidth={3} />
                      </View>
                      <Text style={styles.srSuccessTitle}>
                        Sponsorship Confirmed!
                      </Text>
                      <Text style={styles.srSuccessDesc}>
                        You're now sponsoring{" "}
                        <Text style={{ fontWeight: "800" }}>
                          {selectedSponsorRequest.jobTitle}
                        </Text>
                        .{"\n\n"}
                        {
                          selectedSponsorRequest.applicantName.split(" ")[0]
                        }{" "}
                        will see you under "Wants to Connect With You" and can
                        message you directly once they connect back.
                      </Text>

                      {/* Message now — only available if we already have a\n                          matched jobId back from the sponsorJob call */}
                      {srNewJobId && onNavigateToMessages && (
                        <TouchableOpacity
                          style={[styles.applyBtnLarge, { marginBottom: 12 }]}
                          onPress={() => {
                            const jid = srNewJobId;
                            closeAllModals();
                            onNavigateToMessages(jid);
                          }}
                        >
                          <MessageCircle
                            color="#FFF"
                            size={20}
                            strokeWidth={2.5}
                          />
                          <Text style={styles.applyBtnLargeText}>
                            Message Now
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.srDismissBtn}
                        onPress={closeAllModals}
                      >
                        <Text style={styles.srDismissBtnText}>
                          Back to Matches
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </ScrollView>
              </>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdraw Referral Confirmation Modal */}
      <Modal
        visible={!!confirmingWithdrawReferral}
        transparent
        animationType="none"
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setConfirmingWithdrawReferral(null)}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setConfirmingWithdrawReferral(null)}
            style={[styles.modalContent, { maxHeight: SCREEN_HEIGHT * 0.6 }]}
          >
            {confirmingWithdrawReferral &&
              (() => {
                const matchForReferral = matches.find(
                  (m) =>
                    m.applicantUserId ===
                    confirmingWithdrawReferral.applicantUserId,
                );
                const applicantName =
                  [
                    confirmingWithdrawReferral.applicantFirstName,
                    confirmingWithdrawReferral.applicantLastName,
                  ]
                    .filter(Boolean)
                    .join(" ") ||
                  matchForReferral?.name ||
                  "this applicant";
                const isProcessing =
                  withdrawingReferralId ===
                  confirmingWithdrawReferral.referralId;

                return (
                  <View>
                    <View style={styles.withdrawIconCircle}>
                      <AlertTriangle
                        size={28}
                        color="#DC2626"
                        strokeWidth={2.5}
                      />
                    </View>

                    <Text style={styles.withdrawModalTitle}>
                      Withdraw referral?
                    </Text>
                    <Text style={styles.withdrawModalSubtitle}>
                      You're about to withdraw{" "}
                      <Text style={styles.withdrawModalEmphasis}>
                        {applicantName}
                      </Text>
                      {confirmingWithdrawReferral.jobTitle
                        ? `'s referral for ${confirmingWithdrawReferral.jobTitle}.`
                        : "'s referral."}
                    </Text>

                    <View style={styles.withdrawWarningCard}>
                      <View style={styles.withdrawWarningRow}>
                        <View style={styles.withdrawWarningDot} />
                        <Text style={styles.withdrawWarningText}>
                          You'll have a few seconds to undo this.
                        </Text>
                      </View>
                      <View style={styles.withdrawWarningRow}>
                        <View style={styles.withdrawWarningDot} />
                        <Text style={styles.withdrawWarningText}>
                          The applicant will be notified of the withdrawal.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.withdrawModalActions}>
                      <TouchableOpacity
                        style={styles.withdrawCancelBtn}
                        onPress={() => setConfirmingWithdrawReferral(null)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.withdrawCancelBtnText}>
                          Keep referral
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.withdrawConfirmBtn,
                          isProcessing && styles.withdrawBtnDisabled,
                        ]}
                        onPress={() =>
                          handleConfirmWithdrawWithUndo(
                            confirmingWithdrawReferral,
                          )
                        }
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.withdrawConfirmBtnText}>
                            Yes, withdraw
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
          </DismissibleSheet>
        </View>
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
  sectionContainer: { marginBottom: 40 },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#BBB",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 15,
  },
  horizontalScroll: { marginHorizontal: -28 },
  horizontalScrollContent: { paddingHorizontal: 28, gap: 16 },
  card: {
    width: 190,
    backgroundColor: "#F8F9FA",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  profileImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardRole: { fontSize: 13, color: "#666", marginBottom: 15 },
  messageBtn: {
    backgroundColor: "#000",
    width: "100%",
    padding: 10,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  messageBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

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
  jobCardInfo: { padding: 16 },
  jobCardCompany: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  jobCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
    lineHeight: 20,
  },
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

  listSection: { gap: 12 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 20,
  },
  listImage: { width: 50, height: 50, borderRadius: 15 },
  listInfo: { flex: 1, marginLeft: 15 },
  listName: { fontSize: 16, fontWeight: "700" },
  listStatus: { fontSize: 11, color: "#999", fontWeight: "700", marginTop: 2 },
  // ─── Interested Sponsors Section ─────────────────────────────────────────
  emptySponsorsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  interestedSponsorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    gap: 12,
  },
  interestedSponsorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  interestedSponsorInitial: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  interestedSponsorInitialText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
  },
  interestedSponsorInfo: { flex: 1, gap: 2 },
  interestedSponsorName: { fontSize: 15, fontWeight: "700", color: "#000" },
  interestedSponsorRole: { fontSize: 12, color: "#888", fontWeight: "500" },
  interestedSponsorTimestamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  interestedSponsorTimestampText: {
    fontSize: 11,
    color: "#E53E3E",
    fontWeight: "600",
  },
  interestedSponsorCta: {
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  interestedSponsorCtaText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  // ─── Interested Sponsor Modal ─────────────────────────────────────────────
  interestedModalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FED7D7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  interestedModalTagText: {
    fontSize: 12,
    color: "#E53E3E",
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
    backgroundColor: "#F0FFF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  matchScoreText: { fontSize: 12, fontWeight: "800", color: "#00CB54" },

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
    color: "#00CB54",
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
  pipelineRoleText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    marginBottom: 6,
  },
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
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#000" },
  statusText: { fontSize: 11, fontWeight: "700", color: "#000" },
  viewProfileBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewProfileText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  // Liked Jobs Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  pendingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  likedJobCard: {
    width: 180,
    backgroundColor: "#F8F9FA",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEE",
  },
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
  likedJobLocation: {
    fontSize: 11,
    color: "#999",
    marginBottom: 10,
    marginTop: -6,
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignSelf: "flex-start",
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#999",
  },
  waitingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  emptyLikedSection: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyLikedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  emptyLikedText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  matchBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FFF4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00CB54",
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
    backgroundColor: "#F0FFF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalMatchedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00CB54",
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
    backgroundColor: "#F0F4FF",
    borderWidth: 1,
    borderColor: "#D0DDFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  jobRemoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4060D0",
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
    backgroundColor: "#F0FFF4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  jobMatchedSponsorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00CB54",
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
  waitlistedJobCardSponsored: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FFF4",
  },
  waitingBadgeWaitlist: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  waitingBadgeSponsored: {
    backgroundColor: "#F0FFF4",
    borderColor: "#BBF7D0",
  },

  // Pipeline empty state
  pipelineEmptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  pipelineEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pipelineEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  pipelineEmptyText: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
  // ─── Referral pipeline styles ───────────────────────────────────────────────
  listItemWithdrawn: {
    opacity: 0.55,
  },
  listNameWithdrawn: {
    color: "#AAA",
  },
  listImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  referralBadgeReferred: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 5,
    backgroundColor: "#F0FFF4",
    borderColor: "#BBF7D0",
  },
  referralBadgeWithdrawn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 5,
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
  },
  statusDotReferred: {
    backgroundColor: "#00CB54",
  },
  statusDotWithdrawn: {
    backgroundColor: "#BBB",
  },
  referralStatusTextReferred: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#065F46",
  },
  referralStatusTextWithdrawn: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#999",
  },
  pipelineActions: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  withdrawBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#FFCDD2",
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 74,
  },
  withdrawBtnDisabled: {
    opacity: 0.5,
  },
  withdrawBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#DC2626",
  },
  withdrawIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  withdrawModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  withdrawModalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  withdrawModalEmphasis: {
    fontWeight: "800",
    color: "#000",
  },
  withdrawWarningCard: {
    backgroundColor: "#FFF5F5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE5E5",
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  withdrawWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  withdrawWarningDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DC2626",
    marginTop: 7,
  },
  withdrawWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#7F1D1D",
    lineHeight: 19,
    fontWeight: "600",
  },
  withdrawModalActions: {
    flexDirection: "row",
    gap: 10,
  },
  withdrawCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  withdrawConfirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#00CB54",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  undoToastBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  withdrawConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
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
