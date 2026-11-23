// jobFacts — the applicant deck v2 view model (components/home/applicant).
//
// Pure derivations from a Job (+ the sponsor's enriched profile and the
// applicant's own skills) into what JobBriefCard renders: the ink hero, the
// four-cell ledger, and the short read. Mirrors the sponsor deck's facts.ts:
// the card stays presentational, and everything here is testable.
//
// DATA HONESTY RULE as on the sponsor side: every field is optional and an
// absent one produces nothing — no "N/A", no invented fit.

import type { Job } from "@/types/jobs";
import type { EnrichedSponsorProfile } from "@/types/profiles";
import { joinFacts } from "../dossierFacts";
import { briefOf, skillOverlap } from "../plates/plateContent";
import type { StatCell } from "../sponsor/model";

export interface JobSponsorFacts {
  name: string;
  firstName: string;
  /** "Design Manager · 4 years here" — whatever of it exists. */
  detail: string;
  image: string;
  canRefer: boolean;
  verified: boolean;
  userId: string | null;
}

export interface JobQuote {
  question: string;
  answer: string;
}

export interface JobPassage {
  label: string;
  text: string;
}

export interface JobFacts {
  id: string;
  title: string;
  company: string;
  logoUrl: string;
  /** "Meridian Health · Hybrid · Austin" — under the title on the card. */
  subline: string;
  /** One or two opening sentences — the role, introduced. */
  brief: string;
  /** null = a role nobody has put their name on yet. */
  sponsor: JobSponsorFacts | null;
  /** True only when the backend says so outright (drives WAITLIST copy). */
  unsponsored: boolean;
  ledger: StatCell[];
  /** Required skills the applicant already lists, then the rest. */
  skillsMatched: string[];
  skillsOther: string[];
  /** Up to three short requirement lines. */
  needs: string[];
  /** The sponsor's first answer, promoted; the rest follow in `moreQuotes`. */
  quote: JobQuote | null;
  moreQuotes: JobQuote[];
  /** Sponsor-written passages about the role (day-to-day, culture…). */
  insights: JobPassage[];
  perks: string[];
  /** The long read, kept behind a disclosure. */
  fullRead: JobPassage[];
  companyDescription: string;
  sourceUrl: string;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function fitPercent(raw: unknown): number | null {
  const score = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(score) || score <= 0) return null;
  const percent = score > 1 ? score : score * 100;
  return Math.min(100, Math.max(1, Math.round(percent)));
}

/** "Seattle, Washington, United States" → "Seattle". */
export function shortLocation(location: string | null | undefined): string {
  return clean(location).split(",")[0].trim();
}

/** A bare range ("0-2", "5+") reads as years; a word level passes through. */
export function shortLevel(level: string | null | undefined): string {
  const t = clean(level).replace(/\s+/g, " ");
  if (!t) return "";
  return /^[\d+\-\s]+$/.test(t) ? `${t} years` : t;
}

/**
 * Break a requirements blob into short lines: bullets and line breaks
 * first, else sentences. Keeps the first `max` that are worth a line.
 */
export function requirementLines(text: string | null | undefined, max = 3): string[] {
  const raw = clean(text);
  if (!raw) return [];
  let parts = raw
    .split(/\r?\n|•|·|;|\s[-–—]\s(?=[A-Z0-9])/)
    .map((p) => p.replace(/^\s*(?:[-–—*•]+|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (parts.length < 2) {
    parts = raw
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return parts
    .filter((p) => p.length >= 8)
    .slice(0, max)
    .map((p) => {
      const line = p.replace(/[.;,]+$/, "");
      return line.length > 120 ? `${line.slice(0, 117).trimEnd()}…` : line;
    });
}

export function buildJobFacts(
  job: Job,
  sponsorProfile: EnrichedSponsorProfile | null,
  mySkills: string[] | null | undefined,
): JobFacts {
  const title = clean(job.title);
  const company = clean(job.company);
  const si = job.sponsorInfo || null;
  const unsponsored = job.isSponsored === false;
  const hasSponsor = !unsponsored && !!si && !!clean(si.name);

  // ── Sponsor ────────────────────────────────────────────────────────
  let sponsor: JobSponsorFacts | null = null;
  if (hasSponsor && si) {
    const name = clean(si.name);
    const years = clean(si.yearsAtCompany).replace(/\s+/g, " ");
    sponsor = {
      name,
      firstName: name.split(/\s+/)[0] || name,
      detail: joinFacts([clean(si.role), years ? `${years} here` : ""]),
      image: clean(si.image),
      canRefer: !!si.canRefer,
      verified: !!sponsorProfile?.verified,
      userId: si.userId != null && si.userId !== "" ? String(si.userId) : null,
    };
  }

  // ── Ledger: salary · your fit · where · level ──────────────────────
  const skills = (job.skills || []).map(clean).filter(Boolean);
  const matched = skillOverlap((mySkills || []).filter(Boolean), skills);
  const matchedSet = new Set(matched.map((s) => s.toLowerCase()));
  const others = skills.filter((s) => !matchedSet.has(s.toLowerCase()));
  const pct = fitPercent(job.relevanceScore);

  const ledger: StatCell[] = [];
  const salary = clean(job.salary);
  if (salary) ledger.push({ label: "Salary", value: salary });
  if (skills.length > 0 && matched.length > 0) {
    ledger.push({ label: "Your fit", value: `${matched.length} of ${skills.length} skills` });
  } else if (pct !== null) {
    ledger.push({ label: "Your fit", value: `${pct}% match` });
  }
  // The city alone ("Seattle", not "Seattle, Washington, United States") —
  // a ledger cell and the card's subline both truncate on the long form.
  const where = joinFacts([clean(job.workArrangement), shortLocation(job.location)]);
  if (where) ledger.push({ label: "Where", value: where });
  // One fact per cell so it never truncates: the level, else the job type.
  const level = shortLevel(job.experienceLevel) || clean(job.type);
  if (level) ledger.push({ label: "Level", value: level });

  // ── The sponsor's words ────────────────────────────────────────────
  const qa: JobQuote[] = sponsor
    ? (sponsorProfile?.insights || [])
        .filter((q) => q && clean(q.question) && clean(q.answer))
        .map((q) => ({ question: clean(q.question), answer: clean(q.answer) }))
    : [];
  const ins = sponsor ? job.backchannelInsights || null : null;
  const insights: JobPassage[] = [];
  if (clean(ins?.dayToDay)) insights.push({ label: "Day-to-day", text: clean(ins?.dayToDay) });
  if (clean(ins?.teamCulture)) insights.push({ label: "Team culture", text: clean(ins?.teamCulture) });
  if (clean(ins?.idealCandidate))
    insights.push({ label: "Ideal candidate", text: clean(ins?.idealCandidate) });
  if (clean(ins?.insiderInsights))
    insights.push({ label: "Other notes", text: clean(ins?.insiderInsights) });

  // ── The long read ──────────────────────────────────────────────────
  const fullRead: JobPassage[] = [];
  if (clean(job.description)) fullRead.push({ label: "About the role", text: clean(job.description) });
  if (clean(job.coreResponsibilities))
    fullRead.push({ label: "Core responsibilities", text: clean(job.coreResponsibilities) });
  const requirementsText = clean(job.requirementsSummary) || clean(job.requirements);
  if (requirementsText) fullRead.push({ label: "Requirements", text: requirementsText });

  return {
    id: String(job.id ?? ""),
    title,
    company,
    logoUrl: clean(job.image) || clean(job.logo),
    subline: joinFacts([company, where]),
    brief: briefOf(job.summary || job.description, 230),
    sponsor,
    unsponsored,
    ledger,
    skillsMatched: matched,
    skillsOther: others,
    needs: requirementLines(requirementsText || job.coreResponsibilities),
    quote: qa[0] || null,
    moreQuotes: qa.slice(1),
    insights,
    perks: (job.benefits || []).map(clean).filter(Boolean),
    fullRead,
    companyDescription: clean(job.companyDescription),
    sourceUrl: clean(job.url),
  };
}
