/**
 * Job API Response Types
 * Based on the jobs/pack endpoint response
 */

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
  // Required for UI
  applicants: number;
  image: string;
  currentSponsors: any[]; // Sponsor information
  // Optional fields for UI
  logo?: string;
  benefits: string[]; // Job benefits/perks
  isSponsored?: boolean;
  topApplicants?: any[];
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
    salary: formatSalary(
      apiJob.AI_SALARY_MINVALUE,
      apiJob.AI_SALARY_MAXVALUE,
      apiJob.AI_SALARY_CURRENCY,
    ),
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
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    benefits: highlights,
    currentSponsors: [],
    isSponsored: false,
    topApplicants: [],
    // Add applicationUrl for HomeView compatibility
    applicationUrl: apiJob.URL,
  } as any; // Cast to any to allow extra fields for compatibility
}
