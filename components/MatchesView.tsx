import {
    trackApplicantLikedBack,
    trackMatchMessageTapped,
    trackReferralWithdrawn,
    trackSponsorLikedBack,
} from "@/lib/analytics/mixpanel";
import {
    getInterestedSponsors,
    getJobApplicantsLikes,
    getJobDetail,
    getLikedJobs,
    getMatches,
    getMyJobs,
    getPublicProfile,
    getSponsorMatches,
    getSponsorRequests,
    getWaitlistedJobs,
    likeBackSponsor,
    likeProfile,
    listReferrals,
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
    ChevronLeft,
    ChevronRight,
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
import { CompanyLogo } from "./ui/CompanyLogo";
import { DismissibleSheet, SheetScrollView } from "./ui/DismissibleSheet";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";
import { tokens } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

interface Match {
  // String (was number) — backend LIKE_IDs are UUIDs, and coercing them
  // through Number() returned NaN→0 for every match, which produced
  // duplicate React keys the moment a user had more than one match.
  id: string;
  name: string;
  role: string;
  company: string;
  image: string;
  /**
   * Company logo for the matched job. The /api/matches/ and
   * /api/matches/sponsor/ endpoints don't ship a logo field yet — present
   * here for forward-compat so cards can light up automatically once the
   * backend joins LOGO_URL into those responses. Until then it's undefined
   * and the CompanyLogo component renders the company initial.
   */
  companyLogoUrl?: string;
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
  // The role-aware /referrals endpoint returns the OTHER party — so for an
  // applicant viewing received referrals these hold the sponsor's identity.
  sponsorFirstName: string | null;
  sponsorLastName: string | null;
  sponsorPhotoUrl: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
  /**
   * Optional pass-through for the PR #62 logo pipeline. /api/referrals/
   * doesn't currently surface a logo, but typing it as optional means the
   * card will light up automatically once the backend joins it in.
   */
  jobLogoUrl?: string | null;
}

interface JobOpportunity {
  // String (was number) — see Match.id note above; LIKE_IDs are UUIDs.
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  /** Sponsor's photo — used in the modal hero (NOT the company logo). */
  image: string;
  /**
   * Company logo for the liked job. /api/likes/jobs/ doesn't currently
   * include LOGO_URL (PR #62 only added it to pack/mine/browse). Present
   * here so cards light up automatically once the backend joins it.
   */
  companyLogoUrl?: string;
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
  // matching.sponsor_requests.REQUEST_ID — survives the sponsor deleting or
  // reading the underlying notification (PR #57 dedicated endpoint).
  requestId: string;
  applicantUserId: string;
  applicantName: string;
  applicantPhoto: string | null;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  createdAt: string;
}

interface InterestedApplicant {
  applicantUserId: string;
  likedAt: string;
  name: string;
  image: string;
  roleType: string;
  location: string;
  industry: string;
  skills: string[];
  // The job they liked
  jobId: string;
  jobTitle: string;
  jobCompany: string;
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
  // The role the sponsor liked the applicant FOR — distinct from `role` /
  // `company` (which describe the sponsor's own job/employer). Empty strings
  // when the backend hasn't yet wired §4 of BACKEND_CHANGES_NEEDED.md (or
  // for legacy profile-likes that pre-date the JOB_ID-carrying change). UI
  // renders the role-context line only when both are present.
  jobId?: string;
  jobTitle: string;
  jobCompany: string;
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
  /**
   * Company logo. /api/jobs/waitlist/mine/ doesn't currently surface one
   * (the underlying query only selects basic silver-job columns); kept as
   * optional pass-through for forward compatibility. Falls back to the
   * organization initial when absent.
   */
  organization_logo?: string | null;
}

const QUICK_REPLIES = [
  "Nice to meet you!",
  "Great profile!",
  "Let's chat!",
  "Impressive skills!",
];

/** Parse a skills field that may be a JSON array string or comma-separated. */
function parseSkillsField(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed))
        return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch {}
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const getRelativeTime = (dateStr: string): string => {
  if (!dateStr) return "";
  const now = new Date();
  // Backends often return ISO strings without a timezone suffix (e.g.
  // "2026-05-15T14:30:00"). Without a marker JS parses them as *local* time,
  // which makes the diff negative for users behind UTC and produces nonsense
  // like "-1d ago". Append 'Z' to force UTC interpretation when no offset is
  // present.
  const hasTimezone =
    /Z$/i.test(dateStr.trim()) || /[+-]\d{2}:?\d{2}$/.test(dateStr.trim());
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  // Guard against minor clock skew or future timestamps — anything within the
  // same day should just read "Today" rather than a negative value.
  if (diffMs < 0) return "Today";
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
  // Second arg is the counterpart user id (the OTHER participant in the
  // conversation — sponsor for an applicant caller, applicant for a sponsor
  // caller). Required to disambiguate when a sponsor has multiple matched
  // applicants on the same job, since every one of those conversations
  // shares the same jobId. Optional for legacy call sites where there can
  // only ever be one conversation per job (applicant→sponsor direction).
  onNavigateToMessages?: (jobId: string, userId?: string) => void;
}) {
  const [selectedProfile, setSelectedProfile] = useState<Match | null>(null);
  // Role-picker for grouped match cards: when a person is matched on several
  // roles, tapping the card (or its Message button) opens this sheet so the
  // user explicitly chooses which role to view or message — instead of the
  // card silently picking the most-recent one.
  const [roleGroup, setRoleGroup] = useState<{
    items: Match[];
    getMessageUserId: (m: Match) => string | undefined;
  } | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobOpportunity | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<"view" | "message">("view");
  const [activeSlide, setActiveSlide] = useState(0);
  const [message, setMessage] = useState("");
  // Public-profile fetch state for the matched-profile modal moved into
  // the shared ProfileDetailSheet component — no longer needed here.

  // Interested applicants state (applicants who liked a sponsored job, sponsor hasn't liked back)
  const [interestedApplicants, setInterestedApplicants] = useState<
    InterestedApplicant[]
  >([]);
  const [interestedApplicantsLoading, setInterestedApplicantsLoading] =
    useState(false);
  const [interestedApplicantsError, setInterestedApplicantsError] = useState<
    string | null
  >(null);
  const [selectedInterestedApplicant, setSelectedInterestedApplicant] =
    useState<InterestedApplicant | null>(null);
  const [likingApplicantId, setLikingApplicantId] = useState<string | null>(
    null,
  );

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
              id: String(match.id || match.LIKE_ID || ""),
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
              // Defensive: backend doesn't currently join LOGO_URL onto
              // /api/matches/ but if/when it does, pick it up automatically.
              companyLogoUrl:
                match.LOGO_URL ||
                match.logo_url ||
                match.ORGANIZATION_LOGO ||
                undefined,
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
          const transformedMatches: Match[] = response.matches.map((m) => {
            // The Postgres adapter uppercases every returned column name
            // (pg_utils.py:110), so SQL aliases written lowercase like
            // `applicant_user_id` and `matched_at` come back as
            // APPLICANT_USER_ID / MATCHED_AT. Read uppercase first, fall
            // back to lowercase to stay tolerant if the backend ever
            // changes the adapter behavior.
            const match = m as any;
            const applicantName =
              `${match.FIRST_NAME || ""} ${match.LAST_NAME || ""}`.trim();
            const matchedAt = match.MATCHED_AT || match.matched_at;
            const applicantUserId =
              match.APPLICANT_USER_ID || match.applicant_user_id || "";

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
              id: String(match.LIKE_ID || ""),
              name: applicantName || "Applicant",
              role: "Job Seeker",
              company: "",
              image: match.PHOTO_URL || "",
              companyLogoUrl:
                match.LOGO_URL ||
                match.logo_url ||
                match.ORGANIZATION_LOGO ||
                undefined,
              status: "connected",
              date: matchedAt ? new Date(matchedAt).toLocaleDateString() : "",
              appliedRole: match.TITLE || "",
              experience: "",
              skills,
              jobId: match.JOB_ID || "",
              applicantUserId,
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
            id: String(
              likedJob.LIKE_ID || likedJob.id || `tmp-${Math.random()}`,
            ),
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
            // Defensive: backend may surface either naming once it joins
            // logos into /api/likes/jobs/. Until then this stays undefined
            // and the CompanyLogo component falls back to the initial.
            companyLogoUrl:
              likedJob.LOGO_URL || likedJob.ORGANIZATION_LOGO || undefined,
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
            // Job context shipped in PR #55 — the role the sponsor was
            // viewing when they liked. Drives the "Wants you for ..."
            // line on the Interested-in-You card below.
            jobTitle: s.JOB_TITLE || "",
            jobCompany: s.JOB_COMPANY || "",
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
  // the sponsor's company to sponsor a job. Source of truth is
  // `matching.sponsor_requests` via GET /api/jobs/sponsor-requests/ (PR #57),
  // so this section is robust to the sponsor deleting / marking-read the
  // associated notification on the Notifications screen.
  useEffect(() => {
    const fetchSponsorRequests = async () => {
      if (userType !== "sponsor") return;
      try {
        setSponsorRequestsLoading(true);
        const response = await getSponsorRequests({ limit: 50 });
        const requests: SponsorRequest[] = (response.requests || [])
          .filter((r) => !!r.APPLICANT_USER_ID && !!r.JOB_ID)
          .map((r) => {
            const name =
              [r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(" ").trim() ||
              "Applicant";
            return {
              requestId: r.REQUEST_ID,
              applicantUserId: r.APPLICANT_USER_ID,
              applicantName: name,
              applicantPhoto: r.PHOTO_URL,
              jobId: r.JOB_ID,
              jobTitle: r.JOB_TITLE ?? "Untitled role",
              jobCompany: r.JOB_COMPANY ?? r.COMPANY ?? "",
              createdAt: r.CREATED_AT,
            };
          });
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

  // Fetch interested applicants (sponsor view) — applicants who swiped right
  // on one of the sponsor's active jobs but the sponsor hasn't liked them back.
  // Queries all active sponsored jobs in parallel, then flattens and deduplicates.
  useEffect(() => {
    const fetchInterestedApplicants = async () => {
      if (userType !== "sponsor") return;

      try {
        setInterestedApplicantsLoading(true);
        setInterestedApplicantsError(null);

        // Get the sponsor's own active jobs
        const myJobsRes = await getMyJobs();
        const activeJobs = (myJobsRes.jobs || []).filter((j) => j.IS_ACTIVE);

        if (activeJobs.length === 0) {
          setInterestedApplicants([]);
          return;
        }

        // Fetch applicant likes for each active job in parallel
        const results = await Promise.allSettled(
          activeJobs.map((job) =>
            getJobApplicantsLikes(job.JOB_ID).then((res) => ({
              jobId: job.JOB_ID,
              jobTitle: job.TITLE,
              jobCompany: job.COMPANY,
              applicants: res.applicants,
            })),
          ),
        );

        // Flatten fulfilled results, filter to ACTIVE (not yet matched),
        // and deduplicate by applicant user ID (keep the most recent like)
        const seen = new Set<string>();
        const all: InterestedApplicant[] = [];
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { jobId, jobTitle, jobCompany, applicants } = result.value;
          for (const a of applicants) {
            if (a.STATUS !== "ACTIVE") continue;
            if (seen.has(a.APPLICANT_USER_ID)) continue;
            seen.add(a.APPLICANT_USER_ID);
            all.push({
              applicantUserId: a.APPLICANT_USER_ID,
              likedAt: a.LIKED_AT,
              name:
                a.FIRST_NAME && a.LAST_NAME
                  ? `${a.FIRST_NAME} ${a.LAST_NAME}`
                  : a.FIRST_NAME || "Applicant",
              image: a.PHOTO_URL || "",
              roleType: a.ROLE_TYPE || "",
              location: a.LOCATION || "",
              industry: a.INDUSTRY || "",
              skills: parseSkillsField(a.SKILLS),
              jobId,
              jobTitle,
              jobCompany,
            });
          }
        }

        // Sort by most recently liked
        all.sort(
          (a, b) =>
            new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
        );
        setInterestedApplicants(all);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setInterestedApplicants([]);
        } else {
          console.warn(
            "[MatchesView] Failed to fetch interested applicants:",
            err,
          );
          setInterestedApplicantsError(msg);
        }
      } finally {
        setInterestedApplicantsLoading(false);
      }
    };

    fetchInterestedApplicants();
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
            sponsorFirstName:
              r.SPONSOR_FIRST_NAME || r.sponsor_first_name || null,
            sponsorLastName: r.SPONSOR_LAST_NAME || r.sponsor_last_name || null,
            sponsorPhotoUrl: r.SPONSOR_PHOTO_URL || r.sponsor_photo_url || null,
            jobTitle: r.JOB_TITLE || r.job_title || null,
            jobCompany: r.JOB_COMPANY || r.job_company || null,
            // Forward-compat — backend doesn't ship logos on /api/referrals/
            // yet; component falls back to initial when this is null.
            jobLogoUrl: r.LOGO_URL || r.logo_url || r.ORGANIZATION_LOGO || null,
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
    // The matched-profile modal is now the shared ProfileDetailSheet,
    // which owns its own public-profile fetch. We just need to flag
    // which profile is selected; the sheet handles the rest.
    setModalMode(mode);
    setSelectedProfile(profile);
    setActiveSlide(0);
  };

  // ── Match grouping ────────────────────────────────────────────────
  // A match exists per JOB_ID, so matching the same person on multiple roles
  // produces multiple cards with an identical name (and, on the applicant
  // side, an identical sponsor-title subtitle — literally indistinguishable).
  // Collapse them into one card per counterpart, keyed by the other person's
  // user id. The matched JOB rows stay separate underneath; only the card
  // collapses, and a "N roles" pill signals the multi-role relationship.
  const matchGroupKey = (m: Match, keyField: "sponsorUserId" | "applicantUserId") =>
    (m[keyField] as string) || m.id;

  const groupMatches = (
    list: Match[],
    keyField: "sponsorUserId" | "applicantUserId",
  ) => {
    const map = new Map<string, Match[]>();
    list.forEach((m) => {
      const key = matchGroupKey(m, keyField);
      const arr = map.get(key);
      if (arr) arr.push(m);
      else map.set(key, [m]);
    });
    // Preserve API order (matched_at DESC) for both groups and members; the
    // first member is the most-recent match and represents the group.
    return Array.from(map.values()).map((items) => ({
      key: matchGroupKey(items[0], keyField),
      items,
      latest: items[0],
    }));
  };

  // Render a section's matches as grouped cards. Single-match people render
  // exactly as before; multi-match people render one card with a roles pill.
  const renderMatchCards = (
    list: Match[],
    opts: {
      keyField: "sponsorUserId" | "applicantUserId";
      showMatchedBadge: boolean;
      getMessageUserId: (m: Match) => string | undefined;
    },
  ) =>
    groupMatches(list, opts.keyField).map((group, index) => {
      const match = group.latest;
      const grouped = group.items.length > 1;
      // Grouped cards can't resolve a single role, so both the card and the
      // Message button open the role-picker. Single cards act directly.
      const openPicker = () =>
        setRoleGroup({ items: group.items, getMessageUserId: opts.getMessageUserId });
      const onCardPress = grouped ? openPicker : () => openProfile(match, "view");
      const onMessagePress = grouped
        ? openPicker
        : () => {
            trackMatchMessageTapped({ jobId: match.jobId });
            onNavigateToMessages?.(match.jobId ?? "", opts.getMessageUserId(match));
          };
      return (
        <Animated.View
          key={group.key}
          entering={FadeInRight.delay(index * 100)}
          style={styles.card}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onCardPress}
            style={{ alignItems: "center" }}
          >
            {match.image ? (
              <Image source={{ uri: match.image }} style={styles.profileImage} />
            ) : (
              <View
                style={[
                  styles.profileImage,
                  {
                    backgroundColor: tokens.colors.brand,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: tokens.fontFamilies.serif,
                    fontSize: 28,
                    color: tokens.colors.brandText,
                  }}
                >
                  {(match.name || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.cardName} numberOfLines={1}>
              {match.name}
            </Text>
            {grouped ? (
              <View style={styles.cardRolesPill}>
                <Briefcase size={11} color={tokens.colors.textBody} />
                <Text style={styles.rolesPillText}>
                  {group.items.length} roles
                </Text>
              </View>
            ) : (
              <Text style={styles.cardRole} numberOfLines={1}>
                {match.role}
              </Text>
            )}
          </TouchableOpacity>
          {opts.showMatchedBadge && (
            <View style={styles.matchBadgeCard}>
              <CheckCircle size={14} color={tokens.colors.text} />
              <Text style={styles.matchBadgeText}>Matched!</Text>
            </View>
          )}
          <TouchableOpacity style={styles.messageBtn} onPress={onMessagePress}>
            <MessageCircle color={tokens.colors.brandText} size={16} strokeWidth={2.5} />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    });

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
    setSelectedProfile(null);
    setRoleGroup(null);
    setSelectedJob(null);
    setSelectedReferral(null);
    setSelectedInterestedSponsor(null);
    setInterestedSponsorProfile(null);
    setSelectedInterestedApplicant(null);
    setSelectedWaitlistedJob(null);
    setSelectedSponsorRequest(null);
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
      setSponsorRequests((prev) =>
        prev.filter((r) => r.requestId !== request.requestId),
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
        setInterestedApplicants((prev) =>
          prev.filter((a) => a.applicantUserId !== applicant.applicantUserId),
        );
        setMatchesRefreshKey((k) => k + 1);
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
      console.warn("[MatchesView] Failed to like back applicant:", err);
      showToast("Couldn't do that right now. Please try again.", "error");
    } finally {
      setLikingApplicantId(null);
    }
  };

  // Legacy single-tap connect (no longer exposed in UI — kept for reference)
  const handleConnectToApplicant = async (request: SponsorRequest) => {
    setIsConnectingToApplicant(true);
    try {
      const res = await likeProfile(request.applicantUserId, request.jobId);
      setSponsorRequests((prev) =>
        prev.filter((r) => r.requestId !== request.requestId),
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
                    color: tokens.colors.dangerFg,
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
                    <BellRing size={32} color={tokens.colors.textFaint} />
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
                      key={req.requestId}
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
                                backgroundColor: tokens.colors.bgSurface,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontFamily: tokens.fontFamilies.serif,
                                fontSize: 26,
                                color: tokens.colors.textMuted,
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
                              { color: tokens.colors.textMuted, fontSize: 12 },
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

            {/* Interested in Your Jobs — applicants who swiped right but
                sponsor hasn't connected back yet. Mirrors the applicant's
                "Interested in You" section. */}
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.listSectionTitle}>
                    {interestedApplicantsLoading
                      ? "Loading..."
                      : `Interested in Your Jobs (${interestedApplicants.length})`}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Applicants who swiped right on your jobs — connect back to
                    match
                  </Text>
                </View>
              </View>

              {interestedApplicantsError && (
                <Text
                  style={{
                    color: tokens.colors.dangerFg,
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  {interestedApplicantsError}
                </Text>
              )}

              {!interestedApplicantsLoading &&
              interestedApplicants.length === 0 ? (
                <View style={styles.emptySponsorsContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Heart size={32} color={tokens.colors.textFaint} />
                  </View>
                  <Text style={styles.emptyLikedTitle}>No Interest Yet</Text>
                  <Text style={styles.emptyLikedText}>
                    Applicants who swipe right on your jobs will appear here.
                    Keep your jobs visible!
                  </Text>
                </View>
              ) : (
                interestedApplicants.map((applicant, index) => (
                  <Animated.View
                    key={applicant.applicantUserId}
                    entering={FadeInUp.delay(index * 80)}
                  >
                    <TouchableOpacity
                      style={styles.interestedSponsorCard}
                      activeOpacity={0.85}
                      onPress={() => setSelectedInterestedApplicant(applicant)}
                    >
                      {applicant.image ? (
                        <Image
                          source={{ uri: applicant.image }}
                          style={styles.interestedSponsorAvatar}
                        />
                      ) : (
                        <View style={styles.interestedSponsorInitial}>
                          <Text style={styles.interestedSponsorInitialText}>
                            {(applicant.name || "A")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.interestedSponsorInfo}>
                        <Text style={styles.interestedSponsorName}>
                          {applicant.name}
                        </Text>
                        {!!(applicant.roleType || applicant.location) && (
                          <Text
                            style={styles.interestedSponsorRole}
                            numberOfLines={1}
                          >
                            {applicant.roleType}
                            {applicant.roleType && applicant.location
                              ? " · "
                              : ""}
                            {applicant.location}
                          </Text>
                        )}
                        {!!applicant.jobTitle && (
                          <Text
                            style={styles.interestedSponsorJobContext}
                            numberOfLines={1}
                          >
                            Interested in {applicant.jobTitle}
                            {applicant.jobCompany
                              ? ` · ${applicant.jobCompany}`
                              : ""}
                          </Text>
                        )}
                        {!!applicant.likedAt && (
                          <View style={styles.interestedSponsorTimestamp}>
                            <Heart size={10} color={tokens.colors.dangerFg} />
                            <Text style={styles.interestedSponsorTimestampText}>
                              {getRelativeTime(applicant.likedAt)}
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
                    color: tokens.colors.dangerFg,
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {matchesError}
                </Text>
              )}
              {!matchesLoading && matches.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: tokens.fontFamilies.sans400,
                      color: tokens.colors.textBody,
                      fontSize: 15,
                    }}
                  >
                    No matches yet. Keep swiping.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                  style={styles.horizontalScroll}
                >
                  {renderMatchCards(matches, {
                    keyField: "applicantUserId",
                    showMatchedBadge: false,
                    getMessageUserId: (m) => m.sponsorUserId,
                  })}
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
                  style={{
                    fontFamily: tokens.fontFamilies.sans500,
                    color: tokens.colors.dangerFg,
                    marginBottom: 12,
                    fontSize: 13,
                  }}
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
                    <Users size={28} color={tokens.colors.textFaint} />
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
                              backgroundColor: tokens.colors.brand,
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontFamily: tokens.fontFamilies.serif,
                              fontSize: 22,
                              color: tokens.colors.brandText,
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
                              <ActivityIndicator size="small" color={tokens.colors.dangerFg} />
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
                    color: tokens.colors.dangerFg,
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
                    <Heart size={32} color={tokens.colors.textFaint} />
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
                          {/* /api/likes/jobs/ doesn't include LOGO_URL yet
                              (PR #62 only added it to pack/mine/browse). The
                              CompanyLogo component falls back to the company
                              initial when no logoUrl is supplied. */}
                          <CompanyLogo
                            logoUrl={job.companyLogoUrl}
                            name={job.company}
                            size={44}
                            borderRadius={14}
                            initialFontSize={20}
                            style={{ marginBottom: 12 }}
                          />
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
                              <CheckCircle size={10} color={tokens.colors.text} />
                              <Text
                                style={[styles.waitingText, { color: tokens.colors.text }]}
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
                      { backgroundColor: tokens.colors.bgSurface, borderColor: tokens.colors.border },
                    ]}
                  >
                    <Sparkles size={12} color={tokens.colors.text} />
                    <Text style={[styles.pendingText, { color: tokens.colors.text }]}>
                      Sponsored!
                    </Text>
                  </View>
                )}
              </View>

              {waitlistedJobsError && (
                <Text
                  style={{
                    color: tokens.colors.dangerFg,
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
                    <Clock size={32} color={tokens.colors.textFaint} />
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
                          <CompanyLogo
                            logoUrl={job.organization_logo}
                            name={job.organization}
                            size={44}
                            borderRadius={14}
                            initialFontSize={20}
                            style={{ marginBottom: 12 }}
                          />
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
                              <CheckCircle size={10} color={tokens.colors.text} />
                              <Text
                                style={[styles.waitingText, { color: tokens.colors.text }]}
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
                              <Clock size={10} color={tokens.colors.textBody} />
                              <Text
                                style={[styles.waitingText, { color: tokens.colors.textBody }]}
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
                  {renderMatchCards(matches, {
                    keyField: "sponsorUserId",
                    showMatchedBadge: true,
                    getMessageUserId: (m) => m.applicantUserId,
                  })}
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
                    color: tokens.colors.dangerFg,
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
                    <Users size={32} color={tokens.colors.textFaint} />
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
                        {/* Role the sponsor liked the applicant FOR — backed
                            by JOB_TITLE / JOB_COMPANY shipped in PR #55. */}
                        {!!(sponsor.jobTitle || sponsor.jobCompany) && (
                          <Text
                            style={styles.interestedSponsorJobContext}
                            numberOfLines={1}
                          >
                            Wants you for {sponsor.jobTitle}
                            {sponsor.jobTitle && sponsor.jobCompany
                              ? " · "
                              : ""}
                            {sponsor.jobCompany}
                          </Text>
                        )}
                        {!!sponsor.likedAt && (
                          <View style={styles.interestedSponsorTimestamp}>
                            <Heart size={10} color={tokens.colors.dangerFg} />
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
                  style={{
                    fontFamily: tokens.fontFamilies.sans500,
                    color: tokens.colors.dangerFg,
                    fontSize: 13,
                    marginBottom: 12,
                  }}
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
                    <Award size={28} color={tokens.colors.textFaint} />
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
                    [referral.sponsorFirstName, referral.sponsorLastName]
                      .filter(Boolean)
                      .join(" ") || "Your sponsor";
                  return (
                    <Animated.View
                      key={`recv-referral-${referral.referralId || index}`}
                      entering={FadeInUp.delay(index * 80)}
                    >
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => setSelectedReferral(referral)}
                        style={[
                          styles.referralCard,
                          !isReferred && styles.referralCardWithdrawn,
                        ]}
                      >
                        {/* Row 1 — company + role */}
                        <View style={styles.referralCardTop}>
                          <CompanyLogo
                            logoUrl={referral.jobLogoUrl}
                            name={referral.jobCompany}
                            size={48}
                            borderRadius={14}
                            initialFontSize={19}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={styles.referralCardJobTitle}
                              numberOfLines={1}
                            >
                              {referral.jobTitle || "Open Role"}
                            </Text>
                            <Text
                              style={styles.referralCardCompany}
                              numberOfLines={1}
                            >
                              {referral.jobCompany || "Company"}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={tokens.colors.textFaint} />
                        </View>

                        <View style={styles.referralCardDivider} />

                        {/* Row 2 — sponsor + status */}
                        <View style={styles.referralCardBottom}>
                          {referral.sponsorPhotoUrl ? (
                            <Image
                              source={{ uri: referral.sponsorPhotoUrl }}
                              style={styles.referralCardSponsorAvatar}
                            />
                          ) : (
                            <View style={styles.referralCardSponsorInitial}>
                              <Text
                                style={styles.referralCardSponsorInitialText}
                              >
                                {sponsorName[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text
                            style={styles.referralCardSponsorText}
                            numberOfLines={1}
                          >
                            Referred by {sponsorName}
                            {!!referral.createdAt &&
                              ` · ${getRelativeTime(referral.createdAt)}`}
                          </Text>
                          <View style={styles.refPill}>
                            <View
                              style={[
                                styles.refPillDot,
                                isReferred
                                  ? styles.refPillDotReferred
                                  : styles.refPillDotWithdrawn,
                              ]}
                            />
                            <Text
                              style={[
                                styles.refPillText,
                                isReferred
                                  ? styles.refPillTextReferred
                                  : styles.refPillTextWithdrawn,
                              ]}
                            >
                              {isReferred ? "Referred" : "Withdrawn"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </>
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
            icon: <MessageCircle color={tokens.colors.brandText} size={18} strokeWidth={2.5} />,
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
          onDismiss={() => setSelectedInterestedApplicant(null)}
          userId={selectedInterestedApplicant.applicantUserId}
          variant="applicant"
          initial={{
            name: selectedInterestedApplicant.name,
            image: selectedInterestedApplicant.image,
            role: selectedInterestedApplicant.roleType,
          }}
          badge={{
            label: "Interested in Your Job",
            color: tokens.colors.dangerFg,
            bgColor: tokens.colors.dangerBg,
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
            icon: <Heart color={tokens.colors.brandText} size={18} strokeWidth={2.5} />,
            loading:
              likingApplicantId === selectedInterestedApplicant.applicantUserId,
            onPress: () => handleLikeBackApplicant(selectedInterestedApplicant),
          }}
        />
      )}

      {/* Role picker — shown when a grouped match card (same person, multiple
          roles) is tapped. Lets the user choose which role to view or message
          so neither action silently defaults to the most-recent match. */}
      <Modal visible={!!roleGroup} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setRoleGroup(null)}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setRoleGroup(null)}
            style={styles.modalContent}
            scrollCoupled
          >
            {roleGroup && (
              <>
                <View style={styles.rolePickerHeader}>
                  {roleGroup.items[0].image ? (
                    <Image
                      source={{ uri: roleGroup.items[0].image }}
                      style={styles.rolePickerAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.rolePickerAvatar,
                        {
                          backgroundColor: tokens.colors.brand,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Text
                        style={{
                              fontFamily: tokens.fontFamilies.serif,
                              fontSize: 22,
                              color: tokens.colors.brandText,
                            }}
                      >
                        {(roleGroup.items[0].name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.rolePickerName} numberOfLines={1}>
                      {roleGroup.items[0].name}
                    </Text>
                    <Text style={styles.rolePickerSub}>
                      Matched on {roleGroup.items.length} roles — pick one to
                      view or message
                    </Text>
                  </View>
                </View>

                <SheetScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {roleGroup.items.map((m) => (
                    <View key={m.id} style={styles.rolePickerRow}>
                      <TouchableOpacity
                        style={styles.rolePickerRowMain}
                        activeOpacity={0.7}
                        onPress={() => {
                          setRoleGroup(null);
                          openProfile(m, "view");
                        }}
                      >
                        <CompanyLogo
                          logoUrl={m.companyLogoUrl}
                          name={m.company || m.appliedRole}
                          size={44}
                          borderRadius={14}
                          initialFontSize={18}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.rolePickerRole} numberOfLines={1}>
                            {m.appliedRole || "Role"}
                          </Text>
                          <Text
                            style={styles.rolePickerMeta}
                            numberOfLines={1}
                          >
                            {[m.company, m.date && `Matched ${m.date}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rolePickerMsgBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          trackMatchMessageTapped({ jobId: m.jobId });
                          setRoleGroup(null);
                          onNavigateToMessages?.(
                            m.jobId ?? "",
                            roleGroup.getMessageUserId(m),
                          );
                        }}
                      >
                        <MessageCircle
                          color={tokens.colors.brandText}
                          size={16}
                          strokeWidth={2.5}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </SheetScrollView>
              </>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

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
            scrollCoupled
          >
            {selectedJob && (
              <SheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Status + Liked Date Row */}
                <View style={styles.jobModalTopRow}>
                  {selectedJob.status === "MATCHED" ? (
                    <View style={styles.jobModalMatchedBadge}>
                      <CheckCircle size={12} color={tokens.colors.text} />
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

                {/* Hero: Company Logo (initial fallback) + Title + Company + Location */}
                <View style={styles.jobModalHero}>
                  <CompanyLogo
                    logoUrl={selectedJob.companyLogoUrl}
                    name={selectedJob.company}
                    size={72}
                    borderRadius={22}
                    initialFontSize={32}
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={styles.jobModalHeroTitle}>
                    {selectedJob.title}
                  </Text>
                  <Text style={styles.jobModalHeroCompany}>
                    {selectedJob.company}
                  </Text>
                  {!!selectedJob.location && (
                    <View style={styles.jobModalLocationRow}>
                      <MapPin size={13} color={tokens.colors.textMuted} />
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
                    <DollarSign size={14} color={tokens.colors.textBody} />
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
                      <Briefcase size={14} color={tokens.colors.textBody} />
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
                      <Info size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Role Details
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      <View style={styles.roleDetailChip}>
                        <MapPin size={13} color={tokens.colors.text} />
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
                      <Briefcase size={16} color={tokens.colors.text} />
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
                      <TrendingUp size={16} color={tokens.colors.text} />
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
                      <Sparkles size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>Highlights</Text>
                    </View>
                    {selectedJob.benefits.map((benefit, idx) => (
                      <View key={idx} style={styles.benefitRow}>
                        <Check size={14} color={tokens.colors.text} />
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
                    <Users size={16} color={tokens.colors.text} />
                    <Text style={[styles.sponsorCardTitle, { flex: 1 }]}>
                      Introduced By
                    </Text>
                    {selectedJob.status === "MATCHED" && (
                      <View style={styles.jobMatchedSponsorBadge}>
                        <CheckCircle size={10} color={tokens.colors.text} />
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
                    <MessageCircle color={tokens.colors.brandText} size={20} strokeWidth={2.5} />
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
                    <Clock color={tokens.colors.brandText} size={20} strokeWidth={2.5} />
                    <Text style={styles.applyBtnLargeText}>Pending Match</Text>
                  </TouchableOpacity>
                )}
              </SheetScrollView>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Referral detail sheet — applicant taps a "Referrals Received" card.
          Mirrors the Applied-Jobs job modal: hero, sponsor card, and details. */}
      <Modal visible={!!selectedReferral} transparent animationType="none">
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
            scrollCoupled
          >
            {selectedReferral &&
              (() => {
                const r = selectedReferral;
                const isReferred = r.status === "REFERRED";
                const sponsorName =
                  [r.sponsorFirstName, r.sponsorLastName]
                    .filter(Boolean)
                    .join(" ") || "Your sponsor";
                const sponsorFirst = r.sponsorFirstName?.trim() || "Sponsor";
                const company = r.jobCompany || "the company";
                const canMessage =
                  isReferred && !!onNavigateToMessages && !!r.jobId;
                return (
                  <SheetScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    {/* Status + date */}
                    <View style={styles.jobModalTopRow}>
                      <View style={styles.refPill}>
                        <View
                          style={[
                            styles.refPillDot,
                            isReferred
                              ? styles.refPillDotReferred
                              : styles.refPillDotWithdrawn,
                          ]}
                        />
                        <Text
                          style={[
                            styles.refPillText,
                            isReferred
                              ? styles.refPillTextReferred
                              : styles.refPillTextWithdrawn,
                          ]}
                        >
                          {isReferred ? "Referred" : "Withdrawn"}
                        </Text>
                      </View>
                      {!!r.createdAt && (
                        <Text style={styles.jobModalLikedDate}>
                          Referred{" "}
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      )}
                    </View>

                    {/* Hero — company logo + role */}
                    <View style={styles.jobModalHero}>
                      <CompanyLogo
                        logoUrl={r.jobLogoUrl}
                        name={r.jobCompany}
                        size={72}
                        borderRadius={22}
                        initialFontSize={32}
                        style={{ marginBottom: 16 }}
                      />
                      <Text style={styles.jobModalHeroTitle}>
                        {r.jobTitle || "Open Role"}
                      </Text>
                      <Text style={styles.jobModalHeroCompany}>
                        {r.jobCompany || "Company"}
                      </Text>
                    </View>

                    {/* Referred By — the sponsor */}
                    <View style={styles.sponsorInfoCard}>
                      <View style={styles.sponsorCardHeader}>
                        <Award size={16} color={tokens.colors.text} />
                        <Text style={styles.sponsorCardTitle}>Referred By</Text>
                      </View>
                      <View style={styles.sponsorCardContent}>
                        {r.sponsorPhotoUrl ? (
                          <Image
                            source={{ uri: r.sponsorPhotoUrl }}
                            style={styles.sponsorCardAvatar}
                          />
                        ) : (
                          <View style={styles.jobSponsorInitialAvatar}>
                            <Text style={styles.jobSponsorInitialText}>
                              {sponsorName[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sponsorCardName}>
                            {sponsorName}
                          </Text>
                          <Text style={styles.sponsorCardRole}>
                            {isReferred
                              ? "Referred you for this role"
                              : "Withdrew this referral"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* What this means */}
                    <View style={styles.detailSection}>
                      <View style={styles.detailSectionHeader}>
                        <Info size={16} color={tokens.colors.text} />
                        <Text style={styles.detailSectionTitle}>
                          What This Means
                        </Text>
                      </View>
                      <Text style={styles.jobDetailText}>
                        {isReferred
                          ? `${sponsorFirst} has personally vouched for you and submitted you for this role at ${company}. A referral puts your application in front of their hiring team with a trusted employee's backing.`
                          : `${sponsorFirst} withdrew this referral, so it no longer counts as an active recommendation — but you're still connected and can reach out anytime.`}
                      </Text>
                    </View>

                    {/* CTA */}
                    {canMessage ? (
                      <TouchableOpacity
                        style={styles.applyBtnLarge}
                        onPress={() => {
                          const jid = r.jobId;
                          closeAllModals();
                          onNavigateToMessages?.(jid);
                        }}
                      >
                        <MessageCircle
                          color={tokens.colors.brandText}
                          size={20}
                          strokeWidth={2.5}
                        />
                        <Text style={styles.applyBtnLargeText}>
                          Message {sponsorFirst}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.applyBtnLarge}
                        onPress={closeAllModals}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.applyBtnLargeText}>Got It</Text>
                      </TouchableOpacity>
                    )}
                  </SheetScrollView>
                );
              })()}
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
            scrollCoupled
          >
            {selectedInterestedSponsor && (
              <SheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* "Expressed Interest" tag */}
                <View style={styles.interestedModalTag}>
                  <Heart size={12} color={tokens.colors.dangerFg} />
                  <Text style={styles.interestedModalTagText}>
                    Wants to connect with you
                    {selectedInterestedSponsor.likedAt
                      ? ` · ${getRelativeTime(selectedInterestedSponsor.likedAt)}`
                      : ""}
                  </Text>
                </View>

                {interestedSponsorProfileLoading ? (
                  <View style={styles.interestedLoadingContainer}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: tokens.colors.bgSurface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Users color={tokens.colors.textFaint} size={28} strokeWidth={2} />
                    </View>
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

                          {/* Role the sponsor liked the applicant FOR — pill
                              sits under the sponsor identity. Backed by
                              JOB_TITLE / JOB_COMPANY on received-likes (PR #55). */}
                          {!!(
                            selectedInterestedSponsor.jobTitle ||
                            selectedInterestedSponsor.jobCompany
                          ) && (
                            <View style={styles.likedForPill}>
                              <Text style={styles.likedForLabel}>
                                WANTS YOU FOR
                              </Text>
                              <Text
                                style={styles.likedForValue}
                                numberOfLines={2}
                              >
                                {selectedInterestedSponsor.jobTitle}
                                {selectedInterestedSponsor.jobTitle &&
                                selectedInterestedSponsor.jobCompany
                                  ? " · "
                                  : ""}
                                {selectedInterestedSponsor.jobCompany}
                              </Text>
                            </View>
                          )}

                          {/* Location */}
                          {!!interestedSponsorProfile?.LOCATION && (
                            <View
                              style={[styles.locationRow, { marginBottom: 12 }]}
                            >
                              <MapPin size={12} color={tokens.colors.textFaint} />
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
                                <CheckCircle size={11} color={tokens.colors.text} />
                                <Text style={styles.sponsorCapBadgeText}>
                                  Open to Referrals
                                </Text>
                              </View>
                            )}
                            {interestedSponsorProfile?.sponsor_profile
                              ?.FINANCIAL_REWARD && (
                              <View style={styles.sponsorCapBadge}>
                                <DollarSign size={11} color={tokens.colors.text} />
                                <Text style={styles.sponsorCapBadgeText}>
                                  Financial Reward
                                </Text>
                              </View>
                            )}
                            {!!interestedSponsorProfile?.sponsor_profile
                              ?.DURATION && (
                              <View style={styles.sponsorCapBadge}>
                                <Award size={11} color={tokens.colors.text} />
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
                            <Sparkles size={20} color={tokens.colors.text} />
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
                                    <Zap size={14} color={tokens.colors.text} />
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
                            <CheckCircle size={14} color={tokens.colors.text} />
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
                        <ActivityIndicator color={tokens.colors.brandText} size="small" />
                      ) : (
                        <>
                          <Heart color={tokens.colors.brandText} size={20} strokeWidth={2.5} />
                          <Text style={styles.applyBtnLargeText}>
                            Connect with {selectedInterestedSponsor.firstName}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </SheetScrollView>
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
            scrollCoupled
          >
            {selectedWaitlistedJob && (
              <SheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Hero */}
                <View style={styles.jobModalHero}>
                  <View style={styles.jobModalHeroInitial}>
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
                      <MapPin size={13} color={tokens.colors.textMuted} />
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
                      backgroundColor: tokens.colors.bgSurface,
                      borderWidth: 1,
                      borderColor: tokens.colors.border,
                      borderRadius: 18,
                      padding: 18,
                      marginBottom: 20,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                    }}
                  >
                    <CheckCircle size={22} color={tokens.colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: tokens.fontFamilies.sans600,
                          fontSize: 15,
                          color: tokens.colors.text,
                          letterSpacing: -0.2,
                          marginBottom: 4,
                        }}
                      >
                        Now Sponsored!
                      </Text>
                      <Text
                        style={{
                          fontFamily: tokens.fontFamilies.sans400,
                          fontSize: 13,
                          color: tokens.colors.textBody,
                          lineHeight: 20,
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
                      backgroundColor: tokens.colors.bgSurface,
                      borderWidth: 1,
                      borderColor: tokens.colors.border,
                      borderRadius: 18,
                      padding: 18,
                      marginBottom: 20,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                    }}
                  >
                    <Clock size={22} color={tokens.colors.textBody} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: tokens.fontFamilies.sans600,
                          fontSize: 15,
                          color: tokens.colors.textBody,
                          letterSpacing: -0.2,
                          marginBottom: 4,
                        }}
                      >
                        Waiting for a Sponsor
                      </Text>
                      <Text
                        style={{
                          fontFamily: tokens.fontFamilies.sans400,
                          fontSize: 13,
                          color: tokens.colors.textBody,
                          lineHeight: 20,
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
                    fontFamily: tokens.fontFamilies.sans500,
                    fontSize: 12,
                    color: tokens.colors.textFaint,
                    textAlign: "center",
                    marginBottom: 28,
                  }}
                >
                  Waitlisted{" "}
                  {getRelativeTime(selectedWaitlistedJob.waitlisted_at)}
                </Text>
              </SheetScrollView>
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
            scrollCoupled
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
                      <X size={20} color={tokens.colors.textMuted} />
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
                      <X size={20} color={tokens.colors.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.srStepDots}>
                      <View style={[styles.srDot, styles.srDotActive]} />
                      <View style={[styles.srDot, styles.srDotActive]} />
                    </View>
                    <Text style={styles.srStepLabel}>Step 2 of 2</Text>
                  </View>
                )}

                <SheetScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {/* ── STEP 1: Overview ─────────────────────────────── */}
                  {srStep === 1 && (
                    <>
                      {/* Header tag */}
                      <View style={styles.interestedModalTag}>
                        <BellRing size={12} color={tokens.colors.text} />
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
                          is requesting your sponsorship for this role
                        </Text>
                      </View>

                      {/* Job context card — tappable to review the full role.
                          Hero logo from the silver-detail fetch where possible
                          (the same job the chevron opens); /api/jobs/sponsor-requests/
                          doesn't currently include a logo, so the CompanyLogo
                          component falls back to the company initial. */}
                      <TouchableOpacity
                        style={styles.sponsorRequestJobCard}
                        onPress={openSrJobDetail}
                        activeOpacity={0.75}
                      >
                        <CompanyLogo
                          logoUrl={
                            srJobDetail?.organization_logo ||
                            srJobDetail?.ORGANIZATION_LOGO
                          }
                          name={selectedSponsorRequest.jobCompany}
                          size={40}
                          borderRadius={20}
                          initialFontSize={17}
                        />
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
                          <Text style={styles.srJobCardTapHint}>
                            Tap to review this role
                          </Text>
                        </View>
                        <ChevronRight color={tokens.colors.textFaint} size={18} />
                      </TouchableOpacity>

                      {/* What happens callout */}
                      <View style={[styles.srCallout, { marginTop: 20 }]}>
                        <Text style={styles.srCalloutTitle}>
                          How This Works
                        </Text>
                        <Text style={styles.srCalloutText}>
                          By sponsoring this role, you're putting your
                          professional backing behind{" "}
                          {selectedSponsorRequest.applicantName.split(" ")[0]}
                          's application. Once you do,{" "}
                          {
                            selectedSponsorRequest.applicantName.split(" ")[0]
                          }{" "}
                          will be able to connect with you directly — opening
                          the door to communicate and provide a referral.
                        </Text>
                      </View>

                      {/* Primary CTA → step 2 */}
                      <TouchableOpacity
                        style={styles.applyBtnLarge}
                        onPress={() => setSrStep(2)}
                      >
                        <Briefcase color={tokens.colors.brandText} size={20} strokeWidth={2.5} />
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
                            placeholderTextColor={tokens.colors.textFaint}
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
                          <ActivityIndicator color={tokens.colors.brandText} size="small" />
                        ) : (
                          <>
                            <Check color={tokens.colors.brandText} size={20} strokeWidth={2.5} />
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
                        <Check color={tokens.colors.brandText} size={36} strokeWidth={3} />
                      </View>
                      <Text style={styles.srSuccessTitle}>
                        Sponsorship Confirmed!
                      </Text>
                      <Text style={styles.srSuccessDesc}>
                        You're now sponsoring{" "}
                        <Text style={{ fontFamily: tokens.fontFamilies.sans600 }}>
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
                            onNavigateToMessages(
                              jid,
                              selectedSponsorRequest?.applicantUserId,
                            );
                          }}
                        >
                          <MessageCircle
                            color={tokens.colors.brandText}
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
                </SheetScrollView>
              </>
            )}
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sponsor-Request Job Detail Modal — full role data before committing to sponsor */}
      <Modal visible={srJobDetailVisible} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSrJobDetailVisible(false)}
          >
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setSrJobDetailVisible(false)}
            style={styles.modalContent}
            scrollCoupled
          >
            {/* Header row — back to request */}
            <TouchableOpacity
              style={styles.srJobDetailBackRow}
              onPress={() => setSrJobDetailVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={18} color={tokens.colors.text} />
              <Text style={styles.srJobDetailBackText}>Back to Request</Text>
            </TouchableOpacity>

            {srJobDetailLoading ? (
              <View style={styles.interestedLoadingContainer}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: tokens.colors.bgSurface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Briefcase color={tokens.colors.textFaint} size={28} strokeWidth={1.8} />
                </View>
                <Text style={styles.interestedLoadingText}>
                  Loading role details…
                </Text>
              </View>
            ) : srJobDetailError ? (
              <View style={styles.interestedLoadingContainer}>
                <AlertTriangle size={32} color={tokens.colors.dangerFg} />
                <Text style={styles.srJobDetailErrorTitle}>
                  Could not load role details
                </Text>
                <Text style={styles.srJobDetailErrorSub}>
                  {srJobDetailError}
                </Text>
              </View>
            ) : srJobDetail ? (
              <SheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Hero — company logo, title, company, location */}
                <View style={styles.jobModalHero}>
                  <CompanyLogo
                    logoUrl={
                      srJobDetail.organization_logo ||
                      srJobDetail.ORGANIZATION_LOGO
                    }
                    name={srJobDetail.ORGANIZATION}
                    size={72}
                    borderRadius={22}
                    initialFontSize={32}
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={styles.jobModalHeroTitle}>
                    {srJobDetail.TITLE}
                  </Text>
                  <Text style={styles.jobModalHeroCompany}>
                    {srJobDetail.ORGANIZATION}
                  </Text>
                  {!!srJobDetail.FULL_LOCATION && (
                    <View style={styles.jobModalLocationRow}>
                      <MapPin size={13} color={tokens.colors.textMuted} />
                      <Text style={styles.jobModalLocationText}>
                        {srJobDetail.FULL_LOCATION}
                      </Text>
                      {srJobDetail.IS_REMOTE && (
                        <View style={styles.jobRemoteBadge}>
                          <Text style={styles.jobRemoteText}>Remote</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Compensation + experience strip */}
                {(srJobDetail.SALARY_ANNUAL_MIN ||
                  srJobDetail.EXPERIENCE_LEVEL) && (
                  <View style={styles.jobModalCompStrip}>
                    {!!(
                      srJobDetail.SALARY_ANNUAL_MIN &&
                      srJobDetail.SALARY_ANNUAL_MAX
                    ) && (
                      <View style={styles.jobModalCompCell}>
                        <DollarSign size={14} color={tokens.colors.textBody} />
                        <View>
                          <Text style={styles.jobModalCompLabel}>SALARY</Text>
                          <Text style={styles.jobModalCompValue}>
                            {`$${Math.round(srJobDetail.SALARY_ANNUAL_MIN / 1000)}k – $${Math.round(srJobDetail.SALARY_ANNUAL_MAX / 1000)}k`}
                            {srJobDetail.SALARY_CURRENCY &&
                            srJobDetail.SALARY_CURRENCY !== "USD"
                              ? ` ${srJobDetail.SALARY_CURRENCY}`
                              : ""}
                          </Text>
                        </View>
                      </View>
                    )}
                    {!!srJobDetail.EXPERIENCE_LEVEL && (
                      <View
                        style={[
                          styles.jobModalCompCell,
                          srJobDetail.SALARY_ANNUAL_MIN &&
                            styles.jobModalCompCellBorder,
                        ]}
                      >
                        <Briefcase size={14} color={tokens.colors.textBody} />
                        <View>
                          <Text style={styles.jobModalCompLabel}>
                            EXPERIENCE
                          </Text>
                          <Text style={styles.jobModalCompValue}>
                            {srJobDetail.EXPERIENCE_LEVEL}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Role details — employment type + remote chip */}
                {!!(srJobDetail.EMPLOYMENT_TYPES || srJobDetail.IS_REMOTE) && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Info size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Role Details
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      {!!srJobDetail.EMPLOYMENT_TYPES && (
                        <View style={styles.roleDetailChip}>
                          <Text style={styles.roleDetailChipText}>
                            {srJobDetail.EMPLOYMENT_TYPES}
                          </Text>
                        </View>
                      )}
                      {srJobDetail.IS_REMOTE && (
                        <View style={styles.roleDetailChip}>
                          <MapPin size={13} color={tokens.colors.text} />
                          <Text style={styles.roleDetailChipText}>Remote</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Required skills */}
                {parseSkillsField(srJobDetail.SKILLS).length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <TrendingUp size={16} color={tokens.colors.text} />
                      <Text style={styles.detailSectionTitle}>
                        Required Skills
                      </Text>
                    </View>
                    <View style={styles.skillsRow}>
                      {parseSkillsField(srJobDetail.SKILLS).map(
                        (skill: string, idx: number) => (
                          <View key={idx} style={styles.skillBadge}>
                            <Text style={styles.skillBadgeText}>{skill}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  </View>
                )}

                {/* Description */}
                {!!srJobDetail.DESCRIPTION_TEXT && (
                  <View style={styles.jobSection}>
                    <Text style={styles.jobSectionTitle}>About the Role</Text>
                    <Text style={styles.jobSectionText}>
                      {srJobDetail.DESCRIPTION_TEXT}
                    </Text>
                  </View>
                )}
              </SheetScrollView>
            ) : null}
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
            fullSheetGesture
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
                        color={tokens.colors.dangerFg}
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
                          <ActivityIndicator size="small" color={tokens.colors.brandText} />
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
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  scrollContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 100 },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: tokens.colors.textBody, marginTop: 4 },
  sectionContainer: { marginBottom: 40 },
  listSectionTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 15,
  },
  horizontalScroll: { marginHorizontal: -28 },
  horizontalScrollContent: { paddingHorizontal: 28, gap: 16 },
  card: {
    width: 190,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  profileImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 12 },
  cardName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 18,
    lineHeight: 22,
    color: tokens.colors.text,
    letterSpacing: -0.3,
  },
  cardRole: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    marginBottom: 15,
  },
  // Roles pill shown in place of the single-role line on a grouped match
  // card (same person matched on multiple roles). marginBottom mirrors
  // cardRole so grouped and single cards keep a consistent height.
  cardRolesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginTop: 2,
    marginBottom: 15,
  },
  rolesPillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  // ── Role picker sheet (grouped match → choose a role) ───────────────
  rolePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rolePickerAvatar: { width: 52, height: 52, borderRadius: 26 },
  rolePickerName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 22,
    lineHeight: 26,
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  rolePickerSub: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    marginTop: 3,
    lineHeight: 18,
  },
  rolePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: tokens.borders.hairline,
    borderTopColor: tokens.colors.border,
  },
  rolePickerRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rolePickerRole: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  rolePickerMeta: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  rolePickerMsgBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  messageBtn: {
    backgroundColor: tokens.colors.brand,
    width: "100%",
    padding: 10,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  messageBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText, fontSize: 13, letterSpacing: -0.1 },

  // Job Cards for Applicants
  jobCard: {
    width: 190,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  jobImage: { width: "100%", height: 100, backgroundColor: tokens.colors.border },
  jobCardInfo: { padding: 16 },
  jobCardCompany: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  jobCardTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 17,
    lineHeight: 22,
    color: tokens.colors.text,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  applyBtn: {
    backgroundColor: tokens.colors.brand,
    width: "100%",
    padding: 10,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  applyBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText, fontSize: 13, letterSpacing: -0.1 },

  listSection: { gap: 12 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 20,
  },
  listImage: { width: 50, height: 50, borderRadius: 15 },
  listInfo: { flex: 1, marginLeft: 15 },
  listName: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  listStatus: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  // ─── Interested Sponsors Section ─────────────────────────────────────────
  emptySponsorsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  interestedSponsorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  interestedSponsorInitialText: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    color: tokens.colors.brandText,
  },
  interestedSponsorInfo: { flex: 1, gap: 2 },
  interestedSponsorName: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  interestedSponsorRole: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  // "Wants you for X · Y" — tighter than the sponsor identity line, slight
  // top spacing to separate it as its own piece of info.
  interestedSponsorJobContext: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 12,
    color: tokens.colors.textBody,
    marginTop: 4,
  },
  interestedSponsorTimestamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  interestedSponsorTimestampText: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  interestedSponsorCta: {
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radii.m,
  },
  interestedSponsorCtaText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.brandText,
    fontSize: 12,
    letterSpacing: -0.1,
  },

  // ─── Interested Sponsor Modal ─────────────────────────────────────────────
  interestedModalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.dangerBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.dangerBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  interestedModalTagText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.dangerFg,
    letterSpacing: 1.2,
    textTransform: "uppercase",
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
    backgroundColor: tokens.colors.bgSurface,
    marginBottom: 12,
  },
  sponsorRequestInitial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sponsorRequestInitialText: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 38,
    color: tokens.colors.textMuted,
  },
  sponsorRequestName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 28,
    lineHeight: 32,
    color: tokens.colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  // Job context card — what the applicant wants sponsored.
  sponsorRequestJobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    borderRadius: 16,
  },
  sponsorRequestJobIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorRequestJobLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sponsorRequestJobTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 16,
    color: tokens.colors.text,
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  sponsorRequestJobCompany: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 13,
    color: tokens.colors.textBody,
    marginTop: 2,
  },
  interestedLoadingText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textMuted,
  },
  sponsorModalInitial: {
    width: 55,
    height: 55,
    borderRadius: 27,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorModalInitialText: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    color: tokens.colors.brandText,
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
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  sponsorCapBadgeText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  referCompaniesBlock: { marginTop: 16 },
  referCompaniesLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  referCompaniesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  referCompanyChip: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  referCompanyText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },

  // ─── Shared Modal Styles ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: tokens.colors.bg,
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
    height: 4,
    backgroundColor: tokens.colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  jobRefTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    padding: 12,
    borderRadius: tokens.radii.ml,
    marginBottom: 20,
  },
  jobRefLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  jobRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.colors.bg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  jobRefText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 12,
    color: tokens.colors.text,
    letterSpacing: -0.1,
  },
  jobRefCompany: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 11,
    color: tokens.colors.textBody,
    marginTop: 4,
  },
  matchScoreTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.infoBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.infoBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  matchScoreText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.infoFg,
    letterSpacing: 0.4,
  },

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
    backgroundColor: tokens.colors.border,
  },
  smName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    lineHeight: 28,
    color: tokens.colors.text,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  smMeta: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
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
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  smJobBlock: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  smSectionLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  smJobTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 16,
    color: tokens.colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  smJobCompany: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
  },
  smLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  smLoadingText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  smCapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  smCapPill: {
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  smCapPillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
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
    backgroundColor: tokens.colors.brand,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  smDarkChipText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.brandText,
    letterSpacing: 0.4,
  },
  smInsightItem: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: tokens.radii.ml,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  smInsightQ: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  smInsightA: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  smFallbackLine: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 22,
  },
  smFallbackNote: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  smFallbackNoteText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  smMessageBtn: {
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  smMessageBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.brandText,
    letterSpacing: -0.1,
  },

  swipableContainer: { width: CARD_WIDTH, alignSelf: "center" },
  infoCard: {
    minHeight: 260,
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
  dotInactive: { width: 6, backgroundColor: tokens.colors.border },

  // Slide Styles
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  modalAvatar: { width: 55, height: 55, borderRadius: 27 },
  modalName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    lineHeight: 28,
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  // "Wants you for [role]" pill on the sponsor-profile modal. Sits below
  // the sponsor identity row; muted gray to match the card's job-context
  // styling. Stays hidden when the backend doesn't supply jobTitle/jobCompany.
  likedForPill: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.ml,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  likedForLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  likedForValue: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 14,
    color: tokens.colors.text,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  sponsorSubtitle: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 14,
    color: tokens.colors.textBody,
    marginTop: 2,
  },
  sponsorCompany: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  bioText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginBottom: 15,
  },
  skillsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  skillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  statLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  resumeBtn: {
    flex: 1,
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  resumeBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.brandText,
    fontSize: 12,
    letterSpacing: -0.1,
  },

  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  insightsTitle: {
    fontFamily: tokens.fontFamilies.serif,
    color: tokens.colors.text,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  insightSection: { marginBottom: 20 },
  insightLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginBottom: 6,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  insightContent: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
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
    fontFamily: tokens.fontFamilies.sans400Italic,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
  },

  // Liked-job modal: HomeView-mirrored detail sections
  detailSection: {
    backgroundColor: tokens.colors.bg,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
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
    borderBottomColor: tokens.colors.border,
  },
  detailSectionTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    textTransform: "uppercase",
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  jobDetailCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: tokens.radii.ml,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  jobDetailText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 21,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillBadge: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  skillBadgeText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  roleDetailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  roleDetailChipText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },

  // Job Modal Styles
  jobModalHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  jobModalImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: tokens.colors.bgSurface,
  },
  jobModalInfo: { flex: 1 },
  jobModalCompany: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  jobModalTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 22,
    lineHeight: 26,
    color: tokens.colors.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  jobModalMeta: { flexDirection: "row", gap: 12 },
  jobModalMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  jobModalMetaText: { fontSize: 12, color: tokens.colors.textMuted, fontWeight: "600" },
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
  applyBtnLargeText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText, fontSize: 16, letterSpacing: -0.1 },

  // Input
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
    backgroundColor: tokens.colors.bgSurface,
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

  // Active Pipeline Styles
  pipelineRoleText: {
    fontSize: 12,
    color: tokens.colors.textBody,
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
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.bgSurface,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.brand },
  statusText: { fontSize: 11, fontWeight: "700", color: tokens.colors.text },
  viewProfileBtn: {
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewProfileText: { color: tokens.colors.brandText, fontSize: 12, fontWeight: "700" },

  // Liked Jobs Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.textBody,
  },
  likedJobCard: {
    width: 180,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  likedJobInitial: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  likedJobInitialText: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.colors.brandText,
  },
  likedJobLocation: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginBottom: 10,
    marginTop: -6,
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignSelf: "flex-start",
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.textMuted,
  },
  waitingText: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.colors.textBody,
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
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyLikedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 8,
  },
  emptyLikedText: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  matchBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.colors.text,
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
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalMatchedText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  jobModalPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalPendingText: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.colors.textMuted,
  },
  jobModalLikedDate: {
    fontSize: 12,
    color: tokens.colors.textFaint,
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
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 18,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    borderLeftColor: tokens.colors.border,
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
  jobMatchedSponsorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  jobMatchedSponsorText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  jobSponsorInitialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  jobSponsorInitialText: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.brandText,
  },
  // Waitlisted Jobs
  waitlistedJobCardSponsored: {
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.bgSurface,
  },
  waitingBadgeWaitlist: {
    backgroundColor: tokens.colors.bgSurface,
    borderColor: tokens.colors.border,
  },
  waitingBadgeSponsored: {
    backgroundColor: tokens.colors.bgSurface,
    borderColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pipelineEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 6,
  },
  pipelineEmptyText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  // ─── Referral pipeline styles ───────────────────────────────────────────────
  listItemWithdrawn: {
    opacity: 0.55,
  },
  listNameWithdrawn: {
    color: tokens.colors.textFaint,
  },
  listImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.bgSurface,
    borderColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.bgSurface,
    borderColor: tokens.colors.border,
  },
  statusDotReferred: {
    backgroundColor: tokens.colors.brand,
  },
  statusDotWithdrawn: {
    backgroundColor: tokens.colors.textFaint,
  },
  referralStatusTextReferred: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: tokens.colors.text,
  },
  referralStatusTextWithdrawn: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: tokens.colors.textMuted,
  },
  // ─── Referrals Received — applicant card ───
  referralCard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  referralCardWithdrawn: { opacity: 0.55 },
  referralCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralCardInitial: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  referralCardInitialText: { fontSize: 19, fontWeight: "800", color: tokens.colors.brandText },
  referralCardJobTitle: { fontSize: 16, fontWeight: "700", color: tokens.colors.text },
  referralCardCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.textBody,
    marginTop: 2,
  },
  referralCardDivider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: 12,
  },
  referralCardBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  referralCardSponsorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.border,
  },
  referralCardSponsorInitial: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  referralCardSponsorInitialText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.brandText,
  },
  referralCardSponsorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.textMuted,
  },
  // Monochrome status pill — Referred = black, Withdrawn = grey.
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  refPillDot: { width: 6, height: 6, borderRadius: 3 },
  refPillDotReferred: { backgroundColor: tokens.colors.brand },
  refPillDotWithdrawn: { backgroundColor: tokens.colors.textFaint },
  refPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  refPillTextReferred: { color: tokens.colors.text },
  refPillTextWithdrawn: { color: tokens.colors.textMuted },
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
    borderColor: tokens.colors.dangerBorder,
    backgroundColor: tokens.colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 74,
  },
  withdrawBtnDisabled: {
    opacity: 0.5,
  },
  withdrawBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 12,
    color: tokens.colors.dangerFg,
    letterSpacing: -0.1,
  },
  withdrawIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  withdrawModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  withdrawModalSubtitle: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  withdrawModalEmphasis: {
    fontWeight: "800",
    color: tokens.colors.text,
  },
  withdrawWarningCard: {
    backgroundColor: tokens.colors.dangerBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.dangerBg,
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
    backgroundColor: tokens.colors.dangerFg,
    marginTop: 7,
  },
  withdrawWarningText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.dangerFg,
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
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawCancelBtnText: { fontFamily: tokens.fontFamilies.sans600, fontSize: 14,
    color: tokens.colors.text, letterSpacing: -0.1 },
  withdrawConfirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: tokens.colors.dangerFg,
    alignItems: "center",
    justifyContent: "center",
  },
  undoToast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: tokens.colors.brand,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  undoToastText: {
    color: tokens.colors.brandText,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  undoToastBtn: {
    // White on the dark (#1A1A1A) toast — a black button would vanish.
    backgroundColor: tokens.colors.bg,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  undoToastBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.text,
    fontSize: 13,
    letterSpacing: 0.3 },
  withdrawConfirmBtnText: { fontFamily: tokens.fontFamilies.sans600, fontSize: 14,
    color: tokens.colors.brandText, letterSpacing: -0.1 },
  referralDateText: {
    fontSize: 11,
    color: tokens.colors.textFaint,
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
    backgroundColor: tokens.colors.border,
  },
  srDotActive: { backgroundColor: tokens.colors.brand, width: 24, borderRadius: 4 },
  srStepLabel: { fontSize: 12, fontWeight: "700", color: tokens.colors.textMuted },
  srOverviewSub: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    marginTop: 4,
  },
  srCallout: {
    backgroundColor: tokens.colors.border,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.brand,
  },
  srCalloutTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 8,
  },
  srCalloutText: { fontSize: 14, color: tokens.colors.textBody, lineHeight: 22 },
  srDismissBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  srDismissBtnText: { fontFamily: tokens.fontFamilies.sans600, fontSize: 14, color: tokens.colors.textMuted, letterSpacing: -0.1 },
  srJobCardTapHint: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.colors.textFaint,
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
    color: tokens.colors.text,
  },
  srJobDetailErrorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.dangerFg,
    marginTop: 12,
    textAlign: "center" as const,
  },
  srJobDetailErrorSub: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginTop: 4,
    textAlign: "center" as const,
    lineHeight: 19,
  },
  srStepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 6,
  },
  srStepSub: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginBottom: 24,
  },
  srFormSection: { marginBottom: 24 },
  srFieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 12,
  },
  srFieldHint: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  srRadioOption: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 12,
  },
  srRadioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  srRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tokens.colors.borderStrong,
  },
  srRadioCircleActive: { borderColor: tokens.colors.brand, borderWidth: 6 },
  srRadioText: { fontSize: 15, color: tokens.colors.textBody, fontWeight: "600" },
  srRadioTextActive: { color: tokens.colors.text, fontWeight: "600" },
  srSideBySide: { flexDirection: "row", gap: 12 },
  srHalfOption: {
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
  srTextInput: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    fontSize: 15,
    color: tokens.colors.text,
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
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  srSuccessTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    color: tokens.colors.text,
  },
  srSuccessDesc: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
});
