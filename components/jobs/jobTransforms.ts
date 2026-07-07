import type { BrowseJobResponse, Job } from "@/types/jobs";
import { formatSalary, parseEmploymentType } from "@/types/jobs";
import type { MyJobRow } from "@/lib/api";

// Pure transforms and constants shared across the Jobs screen. No React, no
// state, no I/O — everything here is a plain function of its inputs, which
// also makes this the first natural home for unit tests in the repo.

// Reasons a sponsor can pick when unsponsoring a job. `value` is sent to the
// backend (see §12 in docs/BACKEND_CHANGES_NEEDED.md) — "posting_expired" and
// "role_filled" in particular let the backend prune stale ATS listings.
export const UNSPONSOR_REASONS: { value: string; label: string }[] = [
  { value: "role_filled", label: "The role has been filled" },
  { value: "posting_expired", label: "The job posting expired or was closed" },
  { value: "cannot_refer", label: "I can no longer refer for this role" },
  { value: "poor_applicant_fit", label: "Not getting the right applicants" },
  { value: "wrong_role", label: "I sponsored the wrong role" },
  { value: "other", label: "Other" },
];

/** Robustly parse a skills/requirements string that may be a JSON array or comma-separated list. */
export function parseSkillsField(raw: string | null | undefined): string[] {
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
export function cleanJobText(raw: string | null | undefined): string {
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
export function formatExperienceLevel(raw: string | null | undefined): string {
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

// Transform a browse (SILVER_JOBS) API response into the UI Job shape. Shared
// by the mount load and the "did you mean" company-correction refetch so both
// produce identical cards. `sponsoredJobs` marks which ATS jobs the sponsor
// has already sponsored (drives the green-border state).
export function transformBrowseResponse(
  apiJobs: BrowseJobResponse[],
  sponsoredJobs: { atsJobId?: string }[],
): Job[] {
  return apiJobs.map((job) => {
    const isSponsored = sponsoredJobs.some((sj) => sj.atsJobId === job.JOB_ID);
    const salary = formatSalary(
      job.SALARY_ANNUAL_MIN,
      job.SALARY_ANNUAL_MAX,
      job.SALARY_CURRENCY,
    );
    return {
      id: job.JOB_ID,
      title: job.TITLE,
      company: job.ORGANIZATION,
      location: job.FULL_LOCATION,
      locations: [job.FULL_LOCATION],
      type: parseEmploymentType(job.EMPLOYMENT_TYPES),
      salary: salary !== "Salary not specified" ? salary : "Competitive",
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
      image:
        job.ORGANIZATION_LOGO ||
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
      currentSponsors: [],
      benefits: [],
      isSponsored,
    } as Job;
  });
}

// Transform a GET /api/jobs/mine/ row into the UI Job shape. Shared by
// refreshMyJobs (My Sponsored tab) and initMyJobs (mount pre-populate) so
// both produce identical cards — previously they were separate copies that
// had already drifted (initMyJobs was missing pendingApplicants, so the "N
// new" badge on freshly-mounted SponsoredJobCards read wrong until the tab
// was manually opened and refreshMyJobs re-ran).
export function transformMyJobRow(j: MyJobRow): Job {
  return {
    id: j.JOB_ID,
    title: j.TITLE,
    company: j.COMPANY,
    location: j.LOCATION,
    locations: [j.LOCATION],
    type: parseEmploymentType(j.EMPLOYMENT_TYPE),
    salary:
      j.SALARY_MIN && j.SALARY_MAX
        ? formatSalary(j.SALARY_MIN, j.SALARY_MAX, j.SALARY_CURRENCY || "USD")
        : "Competitive",
    salaryMin: j.SALARY_MIN ?? null,
    salaryMax: j.SALARY_MAX ?? null,
    salaryCurrency: j.SALARY_CURRENCY || "USD",
    postedAt: j.CREATED_AT ? new Date(j.CREATED_AT).toLocaleDateString() : "",
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
    pendingApplicants: Number(j.PENDING_LIKES_COUNT ?? 0) || 0,
    image:
      j.LOGO_URL ||
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    currentSponsors: [],
    benefits: [],
    isSponsored: true,
  } as Job;
}
