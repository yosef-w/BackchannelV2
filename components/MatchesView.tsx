import {
    getInterestedSponsors,
    getLikedJobs,
    getMatches,
    getPublicProfile,
    getSponsorMatches,
    getWaitlistedJobs,
} from "@/lib/api";
import { BlurView } from "expo-blur";
import {
    Award,
    Briefcase,
    CheckCircle,
    Clock,
    DollarSign,
    Heart,
    MapPin,
    MessageCircle,
    Sparkles,
    Users,
    Zap,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    FadeInRight,
    FadeInUp,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

const mockMatches: Match[] = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior Product Manager",
    company: "Google",
    image: "https://images.unsplash.com/photo-1563132337-f159f484226c?w=200",
    status: "referred",
    date: "2 days ago",
    appliedRole: "Lead Product Strategist",
    experience: "8+ Years",
    skills: ["Product Vision", "Agile", "SQL"],
    insights: {
      funFact: "Built a side project that reached 100k users in 3 months.",
    },
    prompts: [
      {
        question: "MY SECRET SUPERPOWER",
        answer: "Turning complex data into simple, actionable stories.",
      },
    ],
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    role: "Software Engineer",
    company: "Meta",
    image: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?w=200",
    status: "pending",
    date: "5 days ago",
    appliedRole: "Full Stack Lead",
    experience: "5 Years",
    skills: ["React", "Node.js", "System Design"],
    insights: {
      funFact: "Contributed to 3 major open-source libraries used by millions.",
    },
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer: "Writing code that's so clean it doesn't need comments.",
      },
    ],
  },
  {
    id: 3,
    name: "Emily Watson",
    role: "UX Design Lead",
    company: "Airbnb",
    image: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=200",
    status: "connected",
    date: "1 week ago",
    appliedRole: "Principal Designer",
    experience: "10+ Years",
    skills: ["Figma", "Design Systems", "User Research"],
    insights: {
      funFact: "Has a collection of over 50 rare design books from the 60s.",
    },
    prompts: [
      {
        question: "MY DESIGN PHILOSOPHY",
        answer: "If it's not intuitive, it's not finished.",
      },
    ],
  },
];

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
  sponsorInfo: {
    name: string;
    role: string;
    image: string;
    canRefer: boolean;
  };
}

const mockJobs: JobOpportunity[] = [
  {
    id: 1,
    title: "Senior Software Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    salary: "$180k - $240k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200",
    description:
      "Join our Payments Platform team to build the financial infrastructure for the internet.",
    skills: ["TypeScript", "React", "Go", "Kubernetes"],
    benefits: ["Unlimited PTO", "401k Match", "Full Health Coverage"],
    sponsorInfo: {
      name: "Sarah Chen",
      role: "Engineering Manager",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
      canRefer: true,
    },
  },
  {
    id: 2,
    title: "Product Designer",
    company: "Notion",
    location: "New York, NY",
    salary: "$140k - $190k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200",
    description:
      "Help us reimagine how teams collaborate with beautiful, intuitive design.",
    skills: ["Figma", "Prototyping", "Design Systems"],
    benefits: ["Equity Package", "Learning Stipend", "Remote Flexible"],
    sponsorInfo: {
      name: "Alex Kim",
      role: "Head of Design",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
      canRefer: true,
    },
  },
  {
    id: 3,
    title: "Data Scientist",
    company: "Spotify",
    location: "Remote",
    salary: "$150k - $200k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200",
    description:
      "Use ML to personalize music recommendations for 500M+ users worldwide.",
    skills: ["Python", "SQL", "Machine Learning"],
    benefits: ["Remote First", "Premium Spotify", "Annual Bonus"],
    sponsorInfo: {
      name: "Maria Rodriguez",
      role: "Data Science Lead",
      image:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200",
      canRefer: true,
    },
  },
];

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

const mockPipeline: Match[] = [
  {
    id: 101,
    name: "James Chen",
    role: "Frontend Developer",
    company: "Pinterest",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    status: "Application Submitted",
    date: "1 day ago",
    appliedRole: "Senior Frontend Engineer",
    experience: "4 Years",
    skills: ["React", "TypeScript", "Next.js"],
    insights: { funFact: "Won a national hackathon two years in a row." },
    prompts: [
      {
        question: "MY WORK STYLE",
        answer:
          "I believe in shipping fast and iterating based on user feedback.",
      },
    ],
  },
  {
    id: 102,
    name: "Elena Rodriguez",
    role: "Product Designer",
    company: "Freelance",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200",
    status: "Interviewing",
    date: "1 week ago",
    appliedRole: "Lead Product Designer",
    experience: "6 Years",
    skills: ["Figma", "UI/UX", "Prototyping"],
    insights: { funFact: "Designed a mobile game played by 1M+ users." },
    prompts: [
      {
        question: "DESIGN PHILOSOPHY",
        answer: "Simplicity is the ultimate sophistication.",
      },
    ],
  },
  {
    id: 103,
    name: "David Kim",
    role: "Data Analyst",
    company: "Uber",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
    status: "Hired",
    date: "2 weeks ago",
    appliedRole: "Data Scientist",
    experience: "3 Years",
    skills: ["Python", "SQL", "Tableau"],
    insights: { funFact: "Can solve a Rubik's cube in under 45 seconds." },
    prompts: [
      {
        question: "MOTIVATION",
        answer: "Turning raw data into actionable business insights.",
      },
    ],
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Application Submitted":
      return "#000";
    case "Recruiter Screen":
      return "#000";
    case "Interviewing":
      return "#000";
    case "Hired":
      return "#000";
    default:
      return "#000";
  }
};

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
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
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
            const match = m as any;
            const applicantName = match.applicant?.name
              ? match.applicant.name
              : `${match.FIRST_NAME || ""} ${match.LAST_NAME || ""}`.trim();
            const matchedAt = match.matched_at || match.MATCHED_AT;

            return {
              id: Number(match.id || match.LIKE_ID) || 0,
              name: applicantName || "Applicant",
              role:
                match.applicant?.current_role ||
                match.CURRENT_ROLE ||
                "Job Seeker",
              company: "", // Applicants don't have company in this context
              image:
                match.applicant?.profile_image_url ||
                match.PHOTO_URL ||
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
              status: "connected",
              date: matchedAt ? new Date(matchedAt).toLocaleDateString() : "",
              appliedRole: match.applicant?.seeking_role || match.TITLE || "",
              experience: "", // Not provided by API
              skills: Array.isArray(match.applicant?.skills || match.SKILLS)
                ? match.applicant?.skills || match.SKILLS
                : typeof (match.applicant?.skills || match.SKILLS) === "string"
                  ? (match.applicant?.skills || match.SKILLS)
                      .split(",")
                      .map((s: string) => s.trim())
                  : [],
              jobId: match.JOB_ID || match.job?.id || "",
              insights: undefined,
              prompts: undefined,
            };
          });

          setMatches(transformedMatches);
        }
      } catch (err) {
        console.error("[MatchesView] Failed to fetch matches:", err);
        setMatchesError(
          err instanceof Error ? err.message : "Failed to fetch matches",
        );
        // Fall back to mock data on error
        setMatches(mockMatches);
      } finally {
        setMatchesLoading(false);
      }
    };

    fetchMatches();
  }, [userType]);

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
          : response.liked_jobs || [];

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
            skills: [],
            benefits: [],
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
        console.error("[MatchesView] Failed to fetch liked jobs:", err);
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
          console.error(
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
  }, [userType]);

  // Fetch waitlisted jobs for applicants
  useEffect(() => {
    const fetchWaitlistedJobs = async () => {
      if (userType !== "applicant") return;

      try {
        setWaitlistedJobsLoading(true);
        const response = await getWaitlistedJobs();
        setWaitlistedJobs(response.jobs);
      } catch (err) {
        console.error("[MatchesView] Failed to fetch waitlisted jobs:", err);
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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveSlide(slide);
  };

  const openProfile = (profile: Match, mode: "view" | "message") => {
    setModalMode(mode);
    setSelectedProfile(profile);
    setActiveSlide(0);
    setSponsorPublicProfile(null);
    // NOTE: GET /api/matches/ does not return SPONSOR_USER_ID — j.SPONSOR_ID
    // is used in the JOIN but never SELECTed. Until the backend adds
    // `j.SPONSOR_ID AS SPONSOR_USER_ID` to get_job_matches_for_user, we
    // can only display the fields already on the match card.
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
        console.error(
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
    setMessage("");
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
            {/* Interested Applicants */}
            <View style={styles.sectionContainer}>
              <Text style={styles.listSectionTitle}>
                {matchesLoading
                  ? "Loading..."
                  : `Interested Applicants (${matches.length})`}
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
                        <Image
                          source={{ uri: match.image }}
                          style={styles.profileImage}
                        />
                      </TouchableOpacity>
                      <Text style={styles.cardName}>{match.name}</Text>
                      <Text style={styles.cardRole}>{match.role}</Text>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() =>
                          onNavigateToMessages?.(match.jobId ?? "")
                        }
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

            {/* Active Pipeline */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>Active Pipeline</Text>
              {mockPipeline.map((item, index) => (
                <Animated.View
                  key={`pipeline-${index}`}
                  entering={FadeInUp.delay(index * 100)}
                  style={styles.listItem}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={styles.listImage}
                  />
                  <View style={styles.listInfo}>
                    <Text style={styles.listName}>{item.name}</Text>
                    <Text style={styles.pipelineRoleText}>
                      Referred for {item.appliedRole}
                    </Text>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewProfileBtn}
                    onPress={() => openProfile(item, "view")}
                  >
                    <Text style={styles.viewProfileText}>View</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
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
                      : `Liked Jobs (${likedJobs.length})`}
                  </Text>
                </View>
                {likedJobs.length > 0 && (
                  <View style={styles.pendingBadge}>
                    <Sparkles size={12} color="#666" />
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )}
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
                  <Text style={styles.emptyLikedTitle}>No Liked Jobs Yet</Text>
                  <Text style={styles.emptyLikedText}>
                    Start swiping right on jobs you're interested in!
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
                                Awaiting sponsor...
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
                    You’ll be notified when a sponsor signs on
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
                        <Image
                          source={{ uri: match.image }}
                          style={styles.profileImage}
                        />
                      </TouchableOpacity>
                      <Text style={styles.cardName}>{match.name}</Text>
                      <Text style={styles.cardRole}>{match.role}</Text>
                      <View style={styles.matchBadgeCard}>
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.matchBadgeText}>Matched!</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() =>
                          onNavigateToMessages?.(match.jobId ?? "")
                        }
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
                    Sponsors who've shown interest in your profile
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
                    Keep building your profile — sponsors who swipe right on you
                    will appear here.
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

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {selectedProfile && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Job opportunity tag */}
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>JOB OPPORTUNITY</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>
                      {selectedProfile.appliedRole ||
                        sponsorPublicProfile?.sponsor_profile?.JOB_TITLE ||
                        "Open Role"}
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
                    {/* Page 1: Sponsor Profile */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image
                          source={{ uri: selectedProfile.image }}
                          style={styles.modalAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalName}>
                            {selectedProfile.name}
                          </Text>
                          {selectedProfile.role ? (
                            <Text style={styles.sponsorSubtitle}>
                              {selectedProfile.role}
                              {selectedProfile.company
                                ? ` @ ${selectedProfile.company}`
                                : ""}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.statsRow}>
                        {selectedProfile.company ? (
                          <View style={styles.statItem}>
                            <Briefcase size={13} color="#000" />
                            <Text style={styles.statLabel}>
                              {selectedProfile.company}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.statItem}>
                          <CheckCircle size={13} color="#00CB54" />
                          <Text style={styles.statLabel}>Matched!</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statItem,
                          {
                            marginTop: 16,
                            alignSelf: "flex-start",
                            backgroundColor: "#F0F0F0",
                          },
                        ]}
                      >
                        <Briefcase size={12} color="#666" />
                        <Text style={[styles.statLabel, { color: "#666" }]}>
                          Role: {selectedProfile.appliedRole || "Open Role"}
                        </Text>
                      </View>
                    </View>

                    {/* Page 2: Key Insights — needs SPONSOR_USER_ID from backend */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.insightsHeader}>
                        <Sparkles size={20} color="#000" />
                        <Text style={styles.insightsTitle}>Key Insights</Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 8,
                        }}
                      >
                        <Users size={28} color="#DDD" />
                        <Text
                          style={{
                            color: "#999",
                            fontSize: 13,
                            fontWeight: "600",
                            textAlign: "center",
                            lineHeight: 20,
                          }}
                        >
                          Full sponsor profile coming soon
                        </Text>
                        <Text
                          style={{
                            color: "#CCC",
                            fontSize: 11,
                            textAlign: "center",
                            lineHeight: 16,
                          }}
                        >
                          Message {selectedProfile.name} to learn more about
                          them
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Pagination dots */}
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
              </ScrollView>
            )}
          </Animated.View>
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

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {selectedJob && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
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
                        Awaiting sponsor
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

                {/* About the Role */}
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

                {/* Primary CTA */}
                {onNavigateToMessages && !!selectedJob.jobId ? (
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
                    style={styles.applyBtnLarge}
                    onPress={closeAllModals}
                  >
                    <Heart color="#FFF" size={20} strokeWidth={2.5} />
                    <Text style={styles.applyBtnLargeText}>Saved</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </Animated.View>
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

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {selectedInterestedSponsor && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* "Expressed Interest" tag */}
                <View style={styles.interestedModalTag}>
                  <Heart size={12} color="#E53E3E" />
                  <Text style={styles.interestedModalTagText}>
                    Expressed interest in your profile
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

                    {/* CTA */}
                    <TouchableOpacity
                      style={[styles.applyBtnLarge, { marginTop: 20 }]}
                      onPress={closeAllModals}
                    >
                      <Heart color="#FFF" size={20} strokeWidth={2.5} />
                      <Text style={styles.applyBtnLargeText}>
                        I'm Interested
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            )}
          </Animated.View>
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

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.modalContent, { maxHeight: "65%" }]}
          >
            <View style={styles.modalHandle} />
            {selectedWaitlistedJob && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
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
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
    maxHeight: "90%",
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
});
