/**
 * Job API Response Types
 * Based on the jobs/pack endpoint response
 */

export interface JobApiSponsor {
  user_id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  photo_url?: string | null;
  duration?: string | null;
  years_at_company?: number | null;
  can_provide_direct_referral?: boolean;
}

/**
 * Sponsor-authored "BackChannel Insights" attached to sponsored jobs.
 * Returned by `format_job_for_frontend_api` since PR #40 (2026-05-05).
 *
 * Note the lowercase top-level key — this is the only non-UPPERCASE field on
 * `JobApiResponse`. Sub-keys are camelCase per backend spec.
 *
 * The backend omits empty fields entirely (and the whole object if all four
 * are blank), so every property is optional.
 */
export interface JobApiInsights {
  dayToDay?: string;
  teamCulture?: string;
  idealCandidate?: string;
  insiderInsights?: string;
}

export interface JobApiResponse {
  ID: number;
  TITLE: string;
  ORGANIZATION: string;
  DESCRIPTION_TEXT: string;
  DATE_POSTED: string;
  LOCATIONS_DERIVED: string; // JSON string array
  EMPLOYMENT_TYPE: string | null; // JSON string array
  SALARY_RAW: string | null;
  REMOTE_DERIVED: boolean;
  URL: string;
  AI_SALARY_MINVALUE: number | null;
  AI_SALARY_MAXVALUE: number | null;
  AI_SALARY_CURRENCY: string | null;
  AI_EXPERIENCE_LEVEL: string;
  AI_WORK_ARRANGEMENT: string;
  AI_KEY_SKILLS: string; // JSON string array
  AI_JOB_HIGHLIGHTS: string; // JSON string array
  AI_JOB_SUMMARY: string;
  REQUIREMENTS_SUMMARY: string | null;
  CORE_RESPONSIBILITIES: string | null;
  /** Sponsor-authored insights — present on sponsored jobs only. */
  insights?: JobApiInsights;
  relevance_score: number;
  job_type?: "ats" | "sponsored";
  sponsor?: JobApiSponsor | null;
  /**
   * Company logo URL from PR #62's logo pipeline. Resolved server-side
   * (Logo.dev for sponsored / ATS-derived, sponsor-uploaded for manual jobs).
   * Empty string when unresolved — fall back to a generic placeholder.
   */
  LOGO_URL?: string;
}

/**
 * Browse Jobs Response (SILVER_JOBS table)
 * Used by sponsors to browse jobs available for sponsoring
 */
export interface BrowseJobResponse {
  JOB_ID: string;
  TITLE: string;
  ORGANIZATION: string;
  FULL_LOCATION: string;
  DESCRIPTION_TEXT: string;
  EMPLOYMENT_TYPES: string;
  IS_REMOTE: boolean;
  SALARY_ANNUAL_MIN: number | null;
  SALARY_ANNUAL_MAX: number | null;
  SALARY_CURRENCY: string | null;
  EXPERIENCE_LEVEL: string | null;
  SKILLS: string | null;
  DATE_POSTED: string;
  /**
   * Company logo URL from PR #62's logo pipeline. ATS/browse responses use
   * the `ORGANIZATION_LOGO` field name (not LOGO_URL — that's the sponsored
   * naming). Null when the pipeline couldn't resolve it.
   */
  ORGANIZATION_LOGO?: string | null;
}

/**
 * Browse Jobs API Response Envelope
 */
export interface BrowseJobsApiResponse {
  jobs: BrowseJobResponse[];
  total_count: number;
}

/**
 * Internal Job Posting Interface
 * Used throughout the app for displaying jobs
 */
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  locations: string[]; // All locations
  type: string;
  salary: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string;
  description: string;
  summary: string;
  skills: string[];
  highlights: string[];
  experienceLevel: string;
  workArrangement: string;
  isRemote: boolean;
  url: string;
  applicationUrl?: string; // Alias for url — used in HomeView for WebView navigation
  requirements?: string; // Raw requirements text (displayed when no skills chips available)
  // Required for UI
  applicants: number;
  image: string;
  currentSponsors: any[]; // Sponsor information
  // Optional fields for UI
  logo?: string;
  benefits: string[]; // Job benefits/perks
  isSponsored?: boolean;
  topApplicants?: any[];
  requirementsSummary?: string | null;
  coreResponsibilities?: string | null;
  relevanceScore?: number;
  sponsorInfo?: {
    name: string;
    role: string;
    image: string;
    yearsAtCompany?: string;
    canRefer: boolean;
    userId?: string | number;
  } | null;
  /**
   * Sponsor-authored insights surfaced on the back of sponsored job cards.
   * Aliased from `JobApiResponse.insights` (lowercase) so the existing render
   * code in HomeView (which looks for `currentData.backchannelInsights`) and
   * the mock-data shape both stay aligned.
   */
  backchannelInsights?: JobApiInsights;
}

/**
 * Parse locations from JSON string array
 */
export function parseLocations(locationsStr: string): string[] {
  try {
    const parsed = JSON.parse(locationsStr.replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse skills from JSON string array
 */
export function parseSkills(skillsStr: string): string[] {
  try {
    const parsed = JSON.parse(skillsStr.replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse highlights from JSON string array
 */
export function parseHighlights(highlightsStr: string): string[] {
  try {
    const parsed = JSON.parse(highlightsStr.replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse employment type from JSON string array
 */
export function parseEmploymentType(typeStr: string | null): string {
  if (!typeStr) return "Full-time";

  try {
    // Handle string representation of array like "['FULL_TIME']"
    let cleaned = typeStr.trim();

    // Remove outer brackets and quotes if present
    cleaned = cleaned.replace(/^\[['"]?|['"]?\]$/g, "");
    cleaned = cleaned.replace(/^['"]|['"]$/g, "");

    // If it's a JSON array, try to parse it
    if (typeStr.startsWith("[")) {
      try {
        const parsed = JSON.parse(typeStr.replace(/'/g, '"'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          cleaned = parsed[0];
        }
      } catch {
        // Already cleaned above
      }
    }

    // Convert FULL_TIME, PART_TIME, etc. to proper case
    if (cleaned) {
      // Replace underscores with spaces and convert to title case
      cleaned = cleaned
        .replace(/_/g, " ")
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("-");

      return cleaned;
    }

    return "Full-time";
  } catch {
    return "Full-time";
  }
}

/**
 * Format salary range for display
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string {
  if (!min && !max) return "Salary not specified";

  const currSymbol = currency === "USD" ? "$" : currency || "";

  if (min && max) {
    const minFormatted = (min / 1000).toFixed(0);
    const maxFormatted = (max / 1000).toFixed(0);
    return `${currSymbol}${minFormatted}k - ${currSymbol}${maxFormatted}k`;
  }

  if (min) {
    return `${currSymbol}${(min / 1000).toFixed(0)}k+`;
  }

  return `Up to ${currSymbol}${(max! / 1000).toFixed(0)}k`;
}

/**
 * Format posted date
 */
export function formatPostedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Transform API response to internal Job format
 */
export function transformJobApiResponse(apiJob: JobApiResponse): Job {
  const locations = parseLocations(apiJob.LOCATIONS_DERIVED);
  const skills = parseSkills(apiJob.AI_KEY_SKILLS);
  const highlights = parseHighlights(apiJob.AI_JOB_HIGHLIGHTS);
  const employmentType = parseEmploymentType(apiJob.EMPLOYMENT_TYPE);

  return {
    id: apiJob.ID.toString(),
    title: apiJob.TITLE,
    company: apiJob.ORGANIZATION,
    location: locations[0] || "Location not specified",
    locations,
    type: employmentType,
    salary:
      formatSalary(
        apiJob.AI_SALARY_MINVALUE,
        apiJob.AI_SALARY_MAXVALUE,
        apiJob.AI_SALARY_CURRENCY,
      ) !== "Salary not specified"
        ? formatSalary(
            apiJob.AI_SALARY_MINVALUE,
            apiJob.AI_SALARY_MAXVALUE,
            apiJob.AI_SALARY_CURRENCY,
          )
        : apiJob.SALARY_RAW || "Salary not specified",
    salaryMin: apiJob.AI_SALARY_MINVALUE,
    salaryMax: apiJob.AI_SALARY_MAXVALUE,
    salaryCurrency: apiJob.AI_SALARY_CURRENCY,
    postedAt: formatPostedDate(apiJob.DATE_POSTED),
    description: apiJob.DESCRIPTION_TEXT,
    summary: apiJob.AI_JOB_SUMMARY,
    skills,
    highlights,
    experienceLevel: apiJob.AI_EXPERIENCE_LEVEL,
    workArrangement: apiJob.AI_WORK_ARRANGEMENT,
    isRemote: apiJob.REMOTE_DERIVED,
    url: apiJob.URL,
    // Default values for UI
    applicants: 0,
    // PR #62 — company logo resolved server-side. Empty string falls through
    // to the consumer's placeholder logic (HomeView shows a company-initial
    // chip when image is empty).
    image: apiJob.LOGO_URL || "",
    benefits: highlights,
    currentSponsors: [],
    isSponsored: apiJob.job_type === "sponsored",
    topApplicants: [],
    // PR #24 relevance scoring + content fields
    requirementsSummary: apiJob.REQUIREMENTS_SUMMARY ?? null,
    coreResponsibilities: apiJob.CORE_RESPONSIBILITIES ?? null,
    relevanceScore: apiJob.relevance_score ?? 0,
    // PR #40 sponsor-authored insights — backend already drops empty
    // sub-fields and omits the object when all four are blank, so we just
    // pass it through. We coerce to undefined when the object is missing
    // *or* when every field happens to be empty (defensive — shouldn't
    // normally happen given backend's filter).
    backchannelInsights: (() => {
      const ins = apiJob.insights;
      if (!ins) return undefined;
      const hasAny =
        ins.dayToDay ||
        ins.teamCulture ||
        ins.idealCandidate ||
        ins.insiderInsights;
      return hasAny ? ins : undefined;
    })(),
    // Add applicationUrl for HomeView compatibility
    applicationUrl: apiJob.URL,
    // Sponsor info — present when job_type === "sponsored"
    sponsorInfo: apiJob.sponsor
      ? {
          userId: apiJob.sponsor.user_id,
          name:
            apiJob.sponsor.name ||
            [apiJob.sponsor.first_name, apiJob.sponsor.last_name]
              .filter(Boolean)
              .join(" ") ||
            "Sponsor",
          role: apiJob.sponsor.job_title || "",
          image: apiJob.sponsor.photo_url || "",
          yearsAtCompany:
            apiJob.sponsor.duration ||
            (apiJob.sponsor.years_at_company != null
              ? `${apiJob.sponsor.years_at_company} ${apiJob.sponsor.years_at_company === 1 ? "year" : "years"}`
              : undefined),
          canRefer: apiJob.sponsor.can_provide_direct_referral ?? false,
        }
      : null,
  } as any; // Cast to any to allow extra fields for compatibility
}
