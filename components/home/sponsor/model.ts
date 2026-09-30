// Sponsor deck v2 — the view model behind SponsorApplicantCard.
//
// Tori's "Home & Matches" Figma (2026-09) reframes the sponsor's card from
// "read a dossier" to "decide whether to put your name on this person":
// what role they want, how they line up with what you posted, and the
// record underneath. Every screen in that file is a function of two
// normalized objects defined here —
//
//   ApplicantFacts — the applicant, flattened from the pack row + the lazy
//                    public-profile enrichment
//   RoleContext    — the sponsor's active role, from GET /api/jobs/mine/
//
// — so the presentational components never touch raw backend rows, and
// every derivation (fit rows, stats, date labels) is pure and unit-tested
// in facts.ts.
//
// DATA HONESTY RULE: the Figma shows target comp, start date and level for
// every applicant. The backend doesn't collect those yet (see
// docs/BACKEND_CHANGES_NEEDED.md §"Sponsor deck v2"). Fields that can be
// missing are nullable, and every consumer OMITS a row/stat whose data is
// missing — never a placeholder, never "N/A", never a fabricated value.

/** The sponsor's active role — the "YOUR ROLE" column and the role row. */
export interface RoleContext {
  jobId: string;
  title: string;
  company: string;
  logoUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  /** true = remote, false = on-site, null = unknown (job details not loaded). */
  remote: boolean | null;
  /** Display-formatted experience level ("Senior", "Mid-level", "5+ years"), or null. */
  experienceLevel: string | null;
  /** Display-formatted employment type ("Full-time"), or null. */
  employmentType: string | null;
  /** Required skills parsed from the posting — drives the skills fit row. */
  skills: string[];
}

export interface CompRange {
  min: number | null;
  max: number | null;
  currency: string | null;
}

/** One role inside an employer group ("Senior Product Designer" at NYT). */
export interface ExperienceRole {
  title: string;
  /** "Full-time", when the resume parse carries it. */
  employmentType: string | null;
  /** "Jan 2024 - Oct 2025 · 1 yr 10 mos" / "Oct 2025 - Present · 11 mos"; null if no dates. */
  dateLabel: string | null;
  location: string | null;
  description: string | null;
}

/**
 * Consecutive roles at one employer, collapsed LinkedIn-style: a group of
 * one renders as a single row ("Product Design Lead / Capital One ·
 * Full-time / dates"); a group of 2+ renders the company header ("The New
 * York Times / 5 yrs 4 mos") over a dotted timeline of its roles.
 */
export interface ExperienceGroup {
  company: string;
  logoUrl: string | null;
  /** Total tenure across the group's roles ("5 yrs 4 mos"); null if unknowable. */
  tenureLabel: string | null;
  roles: ExperienceRole[];
}

export interface EducationItem {
  school: string;
  /** "B.A. Digital Product Management". */
  degree: string | null;
  /** "2015 - 2019" or "2019". */
  years: string | null;
  /** "Activities and societies: …" text, when present. */
  detail: string | null;
  logoUrl: string | null;
}

export interface Achievement {
  title: string;
  detail: string | null;
}

export interface PromptAnswer {
  question: string;
  answer: string;
}

export interface ApplicantFacts {
  userId: string;
  /** "Amy Smith". */
  name: string;
  /** "Amy" — used in "ABOUT AMY", "MORE ABOUT AMY", "Amy wants your role." */
  firstName: string;
  photoUrl: string | null;
  /** "New York, NY" (pack LOCATION, else City, ST). */
  location: string | null;
  /** Current seat: title + company from the current/most-recent experience. */
  currentTitle: string | null;
  currentCompany: string | null;
  /** What they're looking for (POSITIONS[0]); null when it's the generic default. */
  desiredRole: string | null;
  /** Full bio, or null when empty / the backend's default filler. */
  bio: string | null;
  /** One- or two-sentence cut of the bio for the photo card; null if no bio. */
  bioSummary: string | null;
  /** HAS_LIKED_JOB — this person tapped "Interested" on the sponsor's role. */
  likedRole: boolean;
  /** When they liked the role (ISO), if the pack ships it; drives "2D AGO". */
  likedAt: string | null;
  /** Total years in the field (resume-derived, else YEARS_EXPERIENCE). */
  years: number | null;
  /** Raw work preferences ("Remote", "Hybrid", "Full-time", ...). */
  workPreferences: string[];
  /** Arrangement prefs only, joined: "Hybrid · Remote"; null if none. */
  workStyle: string | null;
  /** Employment-type prefs: "Full-time"; null if none. */
  seeking: string | null;
  /** Not collected yet — null until the backend ships TARGET_COMP_*. */
  targetComp: CompRange | null;
  /** Not collected yet — "Immediately", "2 weeks", "Jan 2027". */
  startAvailability: string | null;
  /** Not collected yet — "Senior IC", "Lead". */
  level: string | null;
  skills: string[];
  experienceGroups: ExperienceGroup[];
  education: EducationItem[];
  achievements: Achievement[];
  prompts: PromptAnswer[];
  /** True once the lazy public-profile enrichment has landed. */
  enriched: boolean;
}

/** match ✓ (ink/green check) · stretch ↗ (amber, "a step up") · gap (no mark). */
export type FitStatus = "match" | "stretch" | "gap";

export type FitKey =
  | "comp"
  | "workStyle"
  | "start"
  | "experience"
  | "level"
  | "skills";

export interface FitRow {
  key: FitKey;
  /** Row label: "Comp", "Work style", "Start", "Experience", "Level", "Skills". */
  label: string;
  /** Applicant column: "$150–175K", "Hybrid · Remote", "7 yrs", "4 of 6". */
  applicantValue: string;
  /** Your-role column: "$160–190K", "Hybrid", "6+ yrs", "6 needed". */
  roleValue: string;
  status: FitStatus;
}

export interface FitSummary {
  /** Only rows where BOTH sides have data, in the Figma's order. */
  rows: FitRow[];
  /** Rows with status "match". */
  matched: number;
  total: number;
  /** "strong" when ≥ 3 comparable rows and ≥ 75% match; null otherwise. */
  strength: "strong" | null;
  /** "Four of five line up with what you posted." — null when total < 2. */
  headline: string | null;
  /** "LEVEL · A STEP UP FOR AMY" for the first stretch row, else null. */
  stretchNote: string | null;
}

/** A label/value cell in the hero's frosted grid or the stats card. */
export interface StatCell {
  /** "Experience" / "Years exp." — callers uppercase via style, not text. */
  label: string;
  value: string;
}
