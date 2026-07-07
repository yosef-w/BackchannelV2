import {
    getInterestedSponsors,
    getJobApplicantsLikes,
    getLikedJobs,
    getMatches,
    getMyJobs,
    getSponsorMatches,
    getSponsorRequests,
    getWaitlistedJobs,
    listReferrals,
} from "@/lib/api";
import {
    getLocalCheckInStages,
    getLocalCheckInTimes,
} from "@/utils/checkInStageCache";
import { getSponsorRequestOutcomes } from "@/utils/sponsorRequestCache";

// React Query keys for every list on the Matches screen. Caching these is
// what makes the tab render instantly on re-entry instead of re-spinning
// every time: each cached list paints immediately while a fresh fetch runs
// in the background (stale-while-revalidate). All keys share the
// "matchesScreen" root so a single invalidate refetches the whole screen
// after a mutation that changes any of them.
//
// Lives in its own module (rather than inside MatchesView) so other screens
// can subscribe to the SAME cache entries — e.g. HomeView's "Your Move"
// strip reads interestedSponsors without issuing a competing fetch or
// duplicating the transform.
const MATCHES_SCREEN_ROOT = "matchesScreen";
export const matchesScreenKeys = {
  root: [MATCHES_SCREEN_ROOT] as const,
  matches: (u: string) => [MATCHES_SCREEN_ROOT, "matches", u] as const,
  likedJobs: (u: string) => [MATCHES_SCREEN_ROOT, "likedJobs", u] as const,
  waitlistedJobs: (u: string) =>
    [MATCHES_SCREEN_ROOT, "waitlistedJobs", u] as const,
  interestedSponsors: (u: string) =>
    [MATCHES_SCREEN_ROOT, "interestedSponsors", u] as const,
  sponsorRequests: (u: string) =>
    [MATCHES_SCREEN_ROOT, "sponsorRequests", u] as const,
  interestedApplicants: (u: string) =>
    [MATCHES_SCREEN_ROOT, "interestedApplicants", u] as const,
  referrals: (u: string) => [MATCHES_SCREEN_ROOT, "referrals", u] as const,
};

/** Parse a skills field that may be a JSON array string or comma-separated. */
export function parseSkillsField(raw: string | null | undefined): string[] {
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

export interface Match {
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

export interface Referral {
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
  /**
   * Latest pipeline stage (e.g. "Recruiter Screen"). /api/referrals/ doesn't
   * return this yet (see docs/BACKEND_CHANGES_NEEDED.md §N2) — it's merged
   * in client-side from checkInStageCache.ts, which only reflects what the
   * CURRENT user last submitted from THIS device. Optional so the field
   * lights up for real, cross-party data automatically once the backend
   * ships it.
   */
  checkInStage?: string | null;
  /** ISO time of the last check-in submitted from THIS device (see
   * checkInStageCache.ts) — null when never checked in locally. */
  lastLocalCheckInAt?: string | null;
}

export interface JobOpportunity {
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
export interface SponsorRequest {
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

export interface InterestedApplicant {
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

export interface WaitlistedJob {
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
  /**
   * The context-aware message the backend returned at request time (e.g.
   * "5 employees notified at Stripe"). Not persisted server-side — merged
   * in client-side from sponsorRequestCache.ts, so this only reflects a
   * request made from THIS device. Undefined when no cached outcome exists
   * (e.g. the job was waitlisted without ever calling request-sponsor).
   */
  outcomeMessage?: string;
}

export interface InterestedSponsor {
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

/**
 * Shared query definition for "sponsors who liked this applicant" — spread
 * into useQuery so every consumer (MatchesView's Your Move group, HomeView's
 * deck strip) shares one key, one fetcher, one transform, one cache entry.
 */
export const interestedSponsorsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.interestedSponsors(userType),
  enabled: userType === "applicant",
  queryFn: async (): Promise<InterestedSponsor[]> => {
    try {
      const response = await getInterestedSponsors();
      const sponsorArray = Array.isArray(response) ? response : [];

      return sponsorArray.map((s: any) => ({
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
        // line on the Interested-in-You card.
        jobTitle: s.JOB_TITLE || "",
        jobCompany: s.JOB_COMPANY || "",
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 = endpoint not yet deployed on backend — treat as empty state.
      if (msg === "Not found" || msg.includes("404")) return [];
      throw err;
    }
  },
});

/**
 * Matches list — cached so the tab paints instantly on re-entry. Role-aware:
 * applicants read /api/matches/, sponsors read /api/matches/sponsor/. Errors
 * propagate to React Query (the api client already logs them) and surface
 * through the caller's `error` field.
 */
export const matchesQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.matches(userType),
  queryFn: async (): Promise<Match[]> => {
    if (userType === "applicant") {
      const response = await getMatches();

      // API returns job_matches and profile_matches
      const rawMatches =
        response.job_matches || response.profile_matches || [];

      // Transform API response to Match interface
      return rawMatches.map((m) => {
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
    }

    // Sponsor view
    const response = await getSponsorMatches();

    // Transform API response to Match interface
    return response.matches.map((m) => {
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
  },
});

/** Liked jobs (applicant) — cached so the section paints instantly on re-entry. */
export const likedJobsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.likedJobs(userType),
  enabled: userType === "applicant",
  queryFn: async (): Promise<JobOpportunity[]> => {
    const response = await getLikedJobs();

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
    return likedJobsArray.map((likedJob: any) => ({
      id: String(likedJob.LIKE_ID || likedJob.id || `tmp-${Math.random()}`),
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
    }));
  },
});

/**
 * Sponsor-requests (sponsor view) — applicants asking employees at the
 * sponsor's company to sponsor a job. Source of truth is
 * `matching.sponsor_requests` via GET /api/jobs/sponsor-requests/ (PR #57),
 * so this section is robust to the sponsor deleting / marking-read the
 * associated notification on the Notifications screen.
 */
export const sponsorRequestsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.sponsorRequests(userType),
  enabled: userType === "sponsor",
  queryFn: async (): Promise<SponsorRequest[]> => {
    try {
      const response = await getSponsorRequests({ limit: 50 });
      return (response.requests || [])
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
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load sponsor requests";
      // 404 = endpoint not deployed yet — treat as empty state.
      if (msg.includes("404") || msg.includes("Not found")) return [];
      throw err;
    }
  },
});

/**
 * Interested applicants (sponsor view) — applicants who swiped right on one
 * of the sponsor's active jobs but the sponsor hasn't liked them back.
 * Queries all active sponsored jobs in parallel, then flattens and
 * deduplicates.
 */
export const interestedApplicantsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.interestedApplicants(userType),
  enabled: userType === "sponsor",
  queryFn: async (): Promise<InterestedApplicant[]> => {
    try {
      // Get the sponsor's own active jobs
      const myJobsRes = await getMyJobs();
      const activeJobs = (myJobsRes.jobs || []).filter((j) => j.IS_ACTIVE);

      if (activeJobs.length === 0) return [];

      // All jobs share the same SPONSOR_ID — use it to guard against
      // the backend returning the sponsor's own record as an "interested" applicant.
      const myUserId = activeJobs[0]?.SPONSOR_ID;

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
          if (myUserId && a.APPLICANT_USER_ID === myUserId) continue;
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
        (a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
      );
      return all;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 = nothing yet — treat as empty state.
      if (msg.includes("404") || msg.toLowerCase().includes("not found"))
        return [];
      throw err;
    }
  },
});

/** Waitlisted jobs (applicant) — cached for instant re-entry. */
export const waitlistedJobsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.waitlistedJobs(userType),
  enabled: userType === "applicant",
  queryFn: async (): Promise<WaitlistedJob[]> => {
    const [response, outcomes] = await Promise.all([
      getWaitlistedJobs(),
      getSponsorRequestOutcomes(),
    ]);
    return response.jobs.map((j) => ({
      ...j,
      outcomeMessage: outcomes[j.job_id]?.message,
    }));
  },
});

/**
 * Referrals (both roles) — sponsors see submitted, applicants see received.
 * Cached for instant re-entry.
 */
export const referralsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.referrals(userType),
  queryFn: async (): Promise<Referral[]> => {
    try {
      const [response, localStages, localTimes] = await Promise.all([
        listReferrals({ limit: 50, offset: 0 }),
        getLocalCheckInStages(),
        getLocalCheckInTimes(),
      ]);

      return (response.referrals || []).map((r: any) => {
        const referralId = r.REFERRAL_ID || r.referral_id || "";
        return {
          referralId,
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
          sponsorLastName:
            r.SPONSOR_LAST_NAME || r.sponsor_last_name || null,
          sponsorPhotoUrl:
            r.SPONSOR_PHOTO_URL || r.sponsor_photo_url || null,
          jobTitle: r.JOB_TITLE || r.job_title || null,
          jobCompany: r.JOB_COMPANY || r.job_company || null,
          // Forward-compat — backend doesn't ship logos on /api/referrals/
          // yet; component falls back to initial when this is null.
          jobLogoUrl:
            r.LOGO_URL || r.logo_url || r.ORGANIZATION_LOGO || null,
          // Backend field, when it ships (§N2), takes priority over the
          // local mirror automatically since it'll be non-null here.
          checkInStage:
            r.CHECKIN_STAGE ||
            r.checkin_stage ||
            localStages[referralId] ||
            null,
          // Device-local "when did I last check in" — keeps the stale
          // nudge from nagging right after the user just submitted.
          lastLocalCheckInAt: localTimes[referralId] || null,
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 means no referrals yet — empty state, not an error.
      if (msg.includes("404") || msg.toLowerCase().includes("not found"))
        return [];
      throw err;
    }
  },
});
