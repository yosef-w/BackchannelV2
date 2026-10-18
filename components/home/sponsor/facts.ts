// Sponsor deck v2 — the pure half of Tori's redesign. Everything the new
// sponsor card shows (the hero's stat grid, "YOUR ROLE" fit rows, the
// LinkedIn-style experience timeline, date and comp labels) is derived
// here from the raw deck data, so the presentational components in this
// folder only ever lay out strings they're handed.
//
// Two jobs, both load-bearing:
//
//  1. Normalize. The pack row, the lazy public-profile enrichment and the
//     sponsor's own job row each have their own casing, JSON-string-vs-
//     array quirks and free-form dates. Every function here is total over
//     that mess — bad input degrades to null / [] (the row disappears),
//     never to a crash, "NaN yrs" or "Invalid Date".
//
//  2. Keep the DATA HONESTY RULE (see model.ts). The Figma shows comp,
//     start date and level for every applicant; the backend doesn't
//     collect most of that yet. So nothing is defaulted: a fit row exists
//     only when BOTH sides have data, a stat cell only when its value
//     does, and the transform's filler strings ("Open to opportunities",
//     "Looking for new opportunities") are recognized and dropped rather
//     than shown as if the applicant wrote them.
//
// Reuses dossierFacts (seat + year span) and plateContent (skill overlap)
// so the new card, the plates and the ledger can never disagree.

import type { PublicProfileExperience } from "@/lib/api";
import type { Job } from "@/types/jobs";
import type {
  EnrichedApplicantProfile,
  ProfileDeckCard,
  ProfilePrompt,
} from "@/types/profiles";
import {
  currentSeatEntry,
  experienceSpanYears,
  joinFacts,
  yearFromDateString,
} from "../dossierFacts";
import { skillOverlap } from "../plates/plateContent";
import type {
  Achievement,
  ApplicantFacts,
  CompRange,
  EducationItem,
  ExperienceGroup,
  ExperienceRole,
  FitRow,
  FitStatus,
  FitSummary,
  PromptAnswer,
  RoleContext,
  StatCell,
} from "./model";

// ─── Small total helpers ──────────────────────────────────────────────────

/** Trimmed non-empty string, else null. Non-strings are null. */
export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

/** A finite number from a number or numeric string ("175000", "7"), else null. */
export function looseNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * A list of strings from an array, a JSON-encoded array, or a comma
 * string ("Remote, Full-time") — WORK_PREFERENCES has shown up in all
 * three shapes. Non-string elements are dropped.
 */
export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => cleanString(v))
      .filter((v): v is string => v !== null);
  }
  if (typeof value !== "string") return [];
  const t = value.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      return parseStringList(JSON.parse(t));
    } catch {
      // fall through to the comma split
    }
  }
  return parseStringList(t.replace(/^\[|\]$/g, "").split(","));
}

/** Case-insensitive, order-preserving dedupe of trimmed strings. */
export function dedupeStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = cleanString(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** "One".."Ten" for 1–10 ("Zero" for 0); digits beyond. */
export function numberWord(n: number): string {
  const words = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  return Number.isInteger(n) && n >= 0 && n <= 10 ? words[n] : String(n);
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Dates ────────────────────────────────────────────────────────────────

/** A parsed resume date: month is 1–12, or null when only the year is known. */
export interface MonthYear {
  year: number;
  month: number | null;
}

const PRESENT_RE = /^(present|current|now|today|ongoing)$/i;

function validYear(y: number): boolean {
  return y >= 1900 && y <= 2099;
}

/**
 * Month + year from a free-form resume date: "Jan 2024", "January 2024",
 * "2024-01", "2024-01-15", "01/2024", "1/15/2024"; year-only strings
 * ("2019", "Summer 2019") give month null. Garbage → null.
 */
export function parseMonthYear(value: unknown): MonthYear | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;

  let m = t.match(/^(\d{4})-(\d{1,2})(?:\b|-)/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (validYear(year) && month >= 1 && month <= 12) return { year, month };
  }
  m = t.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})\b/);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (validYear(year) && month >= 1 && month <= 12) return { year, month };
  }
  m = t.match(/\b([A-Za-z]{3,})\.?,?\s+(\d{4})\b/);
  if (m) {
    const idx = MONTHS_SHORT.findIndex(
      (name) => name.toLowerCase() === m![1].slice(0, 3).toLowerCase(),
    );
    const year = Number(m[2]);
    if (idx >= 0 && validYear(year)) return { year, month: idx + 1 };
  }
  const year = yearFromDateString(t);
  return year !== null ? { year, month: null } : null;
}

function formatMonthYear(d: MonthYear): string {
  return d.month ? `${MONTHS_SHORT[d.month - 1]} ${d.year}` : String(d.year);
}

function nowMonthYear(now: Date): MonthYear {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * LinkedIn-style month count. With months on both ends it's inclusive
 * (Jan–Jan = 1 mo, Jan 2024–Oct 2025 = 22 mos); with a year-only end it
 * falls back to whole years (2019–2020 = 12 mos). Negative spans → 0.
 */
export function monthsBetween(start: MonthYear, end: MonthYear): number {
  if (start.month !== null && end.month !== null) {
    return Math.max(
      0,
      end.year * 12 + end.month - (start.year * 12 + start.month) + 1,
    );
  }
  return Math.max(0, (end.year - start.year) * 12);
}

/** "1 yr 10 mos", "1 yr", "11 mos", "1 mo"; null for 0 / bad input. */
export function formatDuration(months: number): string | null {
  if (!Number.isFinite(months) || months <= 0) return null;
  const y = Math.floor(months / 12);
  const mo = Math.round(months % 12);
  const parts: string[] = [];
  if (y > 0) parts.push(y === 1 ? "1 yr" : `${y} yrs`);
  if (mo > 0) parts.push(mo === 1 ? "1 mo" : `${mo} mos`);
  return parts.length ? parts.join(" ") : null;
}

interface RoleSpan {
  start: MonthYear | null;
  /** null = no end known; "present" = current. */
  end: MonthYear | "present" | null;
}

function roleSpan(exp: PublicProfileExperience): RoleSpan {
  const start = parseMonthYear(exp.startDate);
  const endRaw = typeof exp.endDate === "string" ? exp.endDate.trim() : "";
  const isCurrent = exp.current === true || PRESENT_RE.test(endRaw);
  const end = isCurrent ? "present" : parseMonthYear(endRaw);
  return { start, end };
}

/**
 * "Jan 2024 - Oct 2025 · 1 yr 10 mos" / "Oct 2025 - Present · 11 mos" /
 * "2019 - 2020 · 1 yr". Just the dates when the duration is under a
 * month or unknowable; null when there are no dates at all.
 */
export function formatDateRange(
  start: MonthYear | null,
  end: MonthYear | "present" | null,
  now: Date = new Date(),
): string | null {
  if (!start) {
    if (end && end !== "present") return formatMonthYear(end);
    return null;
  }
  const startLabel = formatMonthYear(start);
  if (end === null) return startLabel;
  const endDate = end === "present" ? nowMonthYear(now) : end;
  const endLabel = end === "present" ? "Present" : formatMonthYear(end);
  const range =
    end !== "present" && endLabel === startLabel
      ? startLabel
      : `${startLabel} - ${endLabel}`;
  // Year-only start with a "present" end: count whole years only, so a
  // 2019 start doesn't claim the current partial-year months.
  const duration = formatDuration(
    monthsBetween(start, start.month === null ? { year: endDate.year, month: null } : endDate),
  );
  return duration ? `${range} · ${duration}` : range;
}

function monthKey(d: MonthYear, edge: "start" | "end"): number {
  return d.year * 12 + (d.month ?? (edge === "start" ? 1 : 12));
}

/**
 * "Today", "1d ago" … "6d ago", "1w ago" … "7w ago", then "Mar 4" (with
 * the year when it isn't this year). Calendar-day based in local time;
 * future dates read "Today". null on unparseable input.
 */
export function relativeAgo(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const dayStart = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 56) return `${Math.floor(days / 7)}w ago`;
  const label = `${MONTHS_SHORT[then.getMonth()]} ${then.getDate()}`;
  return then.getFullYear() === now.getFullYear()
    ? label
    : `${label}, ${then.getFullYear()}`;
}

/** An ISO string for a parseable date string, else null. */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Text ─────────────────────────────────────────────────────────────────

const DEFAULT_BIO_RE = /^looking for new opportunities\.?$/i;
const DEFAULT_ROLE_RE = /^open to opportunities\.?$/i;

function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Clip on a word boundary with "…", never mid-word. */
export function clipOnWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:–—-]+$/, "")}…`;
}

/**
 * The photo card's bio cut: the first sentence, extended to the second
 * when the first is short (< 60 chars), hard-capped at ~160 chars.
 */
export function summarizeBio(bio: string | null, max = 160): string | null {
  const t = (bio || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const sentences = sentencesOf(t);
  let out = sentences[0] ?? t;
  if (out.length < 60 && sentences[1]) out = `${out} ${sentences[1]}`;
  return clipOnWord(out, max);
}

const BULLET_RE = /^\s*(?:[•●▪◦*\-–—]|\d{1,2}[.)])\s+/;

/**
 * Freeform ACHIEVEMENTS text → items. Splits on newlines and "•" bullets,
 * strips list markers ("-", "*", "1."); each item's first sentence is the
 * title and the rest the detail. A single paragraph is one achievement.
 */
export function parseAchievements(text: unknown): Achievement[] {
  if (typeof text !== "string") return [];
  const items = text
    .split(/\r?\n|•/)
    .map((line) => line.replace(BULLET_RE, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && /[A-Za-z0-9]/.test(line));
  return items.map((item) => {
    const m = item.match(/^(.+?[.!?])\s+(\S.*)$/);
    return m
      ? { title: m[1].trim(), detail: m[2].trim() }
      : { title: item, detail: null };
  });
}

// ─── Work preferences ─────────────────────────────────────────────────────

const ARRANGEMENT_ORDER = ["Hybrid", "Remote", "On-site"] as const;
const EMPLOYMENT_ORDER = ["Full-time", "Part-time", "Contract"] as const;

function canonicalPreference(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  switch (key) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
    case "inoffice":
    case "office":
    case "inperson":
      return "On-site";
    case "fulltime":
      return "Full-time";
    case "parttime":
      return "Part-time";
    case "contract":
    case "contractor":
    case "freelance":
      return "Contract";
    default:
      return null;
  }
}

/** Canonical subset of `prefs` in `order`, joined with `sep`; null if none. */
export function preferenceSubset(
  prefs: string[],
  order: readonly string[],
  sep = " · ",
): string | null {
  const present = new Set(prefs.map(canonicalPreference));
  const picked = order.filter((p) => present.has(p));
  return picked.length ? picked.join(sep) : null;
}

// ─── Comp ─────────────────────────────────────────────────────────────────

function positive(n: unknown): number | null {
  const v = looseNumber(n);
  return v !== null && v > 0 ? v : null;
}

/** A CompRange with at least one positive bound, else null. */
export function normalizeCompRange(
  min: unknown,
  max: unknown,
  currency: unknown,
): CompRange | null {
  let lo = positive(min);
  let hi = positive(max);
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
  return { min: lo, max: hi, currency: cleanString(currency)?.toUpperCase() ?? null };
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

function compactParts(n: number): { num: string; suffix: string } {
  const trim = (x: number) => String(Math.round(x * 10) / 10);
  if (n >= 1_000_000) return { num: trim(n / 1_000_000), suffix: "M" };
  if (n >= 1_000) return { num: trim(n / 1_000), suffix: "K" };
  return { num: trim(n), suffix: "" };
}

/**
 * "$150–175K", "$900K–1.2M", "$150K+", "Up to $175K", "€90–110K",
 * "CAD 90–110K". null when neither bound is a positive number.
 */
export function formatCompRange(range: CompRange | null | undefined): string | null {
  if (!range) return null;
  const norm = normalizeCompRange(range.min, range.max, range.currency);
  if (!norm) return null;
  const code = norm.currency ?? "USD";
  const prefix = CURRENCY_SYMBOLS[code] ?? `${code} `;
  const { min, max } = norm;
  if (min !== null && max !== null) {
    const a = compactParts(min);
    const b = compactParts(max);
    if (a.num === b.num && a.suffix === b.suffix) return `${prefix}${a.num}${a.suffix}`;
    return a.suffix === b.suffix
      ? `${prefix}${a.num}–${b.num}${b.suffix}`
      : `${prefix}${a.num}${a.suffix}–${b.num}${b.suffix}`;
  }
  if (min !== null) {
    const a = compactParts(min);
    return `${prefix}${a.num}${a.suffix}+`;
  }
  const b = compactParts(max!);
  return `Up to ${prefix}${b.num}${b.suffix}`;
}

// ─── Applicant ────────────────────────────────────────────────────────────

function normCompany(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Newest-first (current roles first, then by start date desc; undated
 * last; stable), then CONSECUTIVE same-company roles collapse into one
 * group with a total tenure — the LinkedIn timeline.
 */
export function buildExperienceGroups(
  experiences: PublicProfileExperience[] | null | undefined,
  now: Date = new Date(),
): ExperienceGroup[] {
  const list = (Array.isArray(experiences) ? experiences : [])
    .filter((e): e is PublicProfileExperience => !!e && typeof e === "object")
    .filter((e) => cleanString(e.jobTitle) || cleanString(e.company))
    .map((exp) => ({ exp, span: roleSpan(exp) }));

  const sorted = [...list].sort((a, b) => {
    const ac = a.span.end === "present" ? 1 : 0;
    const bc = b.span.end === "present" ? 1 : 0;
    if (ac !== bc) return bc - ac;
    const ak = a.span.start ? monthKey(a.span.start, "start") : -1;
    const bk = b.span.start ? monthKey(b.span.start, "start") : -1;
    return bk - ak;
  });

  const groups: { company: string; items: typeof sorted }[] = [];
  for (const item of sorted) {
    const company = cleanString(item.exp.company) ?? "";
    const last = groups[groups.length - 1];
    if (last && company && normCompany(last.company) === normCompany(company)) {
      last.items.push(item);
    } else {
      groups.push({ company, items: [item] });
    }
  }

  return groups.map(({ company, items }) => {
    const roles: ExperienceRole[] = items.map(({ exp, span }) => ({
      title: cleanString(exp.jobTitle) ?? "",
      employmentType: cleanString(exp.employmentType),
      dateLabel: formatDateRange(span.start, span.end, now),
      location: cleanString(exp.location),
      description: cleanString(exp.description),
    }));
    let tenureLabel: string | null = null;
    if (items.length >= 2) {
      const starts = items
        .map((i) => i.span.start)
        .filter((s): s is MonthYear => s !== null);
      const ends = items
        .map((i) =>
          i.span.end === "present" ? nowMonthYear(now) : (i.span.end ?? i.span.start),
        )
        .filter((e): e is MonthYear => e !== null);
      if (starts.length && ends.length) {
        const earliest = starts.reduce((a, b) =>
          monthKey(b, "start") < monthKey(a, "start") ? b : a,
        );
        const latest = ends.reduce((a, b) =>
          monthKey(b, "end") > monthKey(a, "end") ? b : a,
        );
        tenureLabel = formatDuration(
          monthsBetween(
            earliest,
            earliest.month === null ? { year: latest.year, month: null } : latest,
          ),
        );
      }
    }
    // Resume parses mix casing across stints ("the new york times");
    // show the first spelling that has any capitals.
    const displayCompany =
      items
        .map((i) => cleanString(i.exp.company))
        .find((c) => !!c && c !== c.toLowerCase()) ?? company;
    return {
      company: displayCompany,
      logoUrl:
        items.map((i) => cleanString(i.exp.companyLogo)).find((u) => !!u) ?? null,
      tenureLabel,
      roles,
    };
  });
}

/** Education entries → display rows; entries without a school are dropped. */
export function buildEducation(
  education: EnrichedApplicantProfile["education"] | null | undefined,
): EducationItem[] {
  return (Array.isArray(education) ? education : [])
    .filter((e) => !!e && typeof e === "object")
    .map((e) => {
      const school = cleanString(e.university);
      if (!school) return null;
      const degree = [cleanString(e.degree), cleanString(e.major)]
        .filter(Boolean)
        .join(" ");
      const start = yearFromDateString(e.startYear ?? null);
      const grad = yearFromDateString(e.graduationYear ?? null);
      const years =
        start !== null && grad !== null && start !== grad
          ? `${start} - ${grad}`
          : grad !== null
            ? String(grad)
            : start !== null
              ? String(start)
              : null;
      return {
        school,
        degree: degree || null,
        years,
        detail: cleanString(e.activities),
        logoUrl: cleanString(e.logo),
      };
    })
    .filter((e): e is EducationItem => e !== null);
}

function cleanPrompts(prompts: ProfilePrompt[] | null | undefined): PromptAnswer[] {
  return (Array.isArray(prompts) ? prompts : [])
    .map((p) => ({
      question: cleanString(p?.question) ?? "",
      answer: cleanString(p?.answer) ?? "",
    }))
    .filter((p) => p.question && p.answer);
}

export function buildApplicantFacts(
  card: ProfileDeckCard,
  enriched: EnrichedApplicantProfile | null,
  now: Date = new Date(),
): ApplicantFacts {
  const name = cleanString(card?.name) ?? "";
  const experiences = Array.isArray(enriched?.experiences) ? enriched!.experiences : [];

  const location =
    cleanString(card?.location) ??
    (cleanString(enriched?.city) && cleanString(enriched?.state)
      ? `${cleanString(enriched?.city)}, ${cleanString(enriched?.state)}`
      : cleanString(enriched?.city) ?? cleanString(enriched?.state));

  const seat = currentSeatEntry(experiences);
  const desired = cleanString(card?.desiredRole);
  const bioRaw = cleanString(enriched?.bio) ?? cleanString(card?.bio);
  const bio = bioRaw && !DEFAULT_BIO_RE.test(bioRaw) ? bioRaw : null;

  const likedAt =
    parseIsoDate(card?.LIKED_AT) ??
    parseIsoDate(card?.LIKE_CREATED_AT) ??
    parseIsoDate(card?.LIKED_AT_TS);

  const span = experienceSpanYears(experiences, now.getFullYear());
  const fallbackYears = looseNumber(enriched?.yearsExperience);
  const years =
    span !== null
      ? span
      : fallbackYears !== null && fallbackYears >= 0
        ? Math.floor(fallbackYears)
        : null;

  const workPreferences = dedupeStrings(
    enriched?.workPreferences?.length
      ? enriched.workPreferences
      : parseStringList(card?.WORK_PREFERENCES),
  );

  const targetComp =
    (enriched?.targetComp
      ? normalizeCompRange(
          enriched.targetComp.min,
          enriched.targetComp.max,
          enriched.targetComp.currency,
        )
      : null) ??
    normalizeCompRange(
      card?.TARGET_COMP_MIN,
      card?.TARGET_COMP_MAX,
      card?.TARGET_COMP_CURRENCY,
    );

  const skillsSource =
    Array.isArray(enriched?.skills) && enriched!.skills.length > 0
      ? enriched!.skills
      : Array.isArray(card?.skills)
        ? card.skills
        : [];

  return {
    userId: String(card?.USER_ID ?? card?.id ?? ""),
    name,
    firstName: name.split(" ")[0] ?? "",
    photoUrl: cleanString(card?.image),
    location,
    currentTitle: cleanString(seat?.jobTitle) ?? cleanString(enriched?.currentRole),
    currentCompany: cleanString(seat?.company),
    desiredRole: desired && !DEFAULT_ROLE_RE.test(desired) ? desired : null,
    bio,
    bioSummary: summarizeBio(bio),
    likedRole: card?.HAS_LIKED_JOB === true,
    likedAt,
    years,
    workPreferences,
    workStyle: preferenceSubset(workPreferences, ARRANGEMENT_ORDER),
    seeking: preferenceSubset(workPreferences, EMPLOYMENT_ORDER),
    targetComp,
    startAvailability:
      cleanString(enriched?.startAvailability) ?? cleanString(card?.START_AVAILABILITY),
    level: cleanString(enriched?.level) ?? cleanString(card?.SENIORITY_LEVEL),
    skills: dedupeStrings(skillsSource),
    experienceGroups: buildExperienceGroups(experiences, now),
    education: buildEducation(enriched?.education),
    achievements: parseAchievements(enriched?.achievements),
    prompts: cleanPrompts(
      Array.isArray(enriched?.prompts) && enriched!.prompts.length > 0
        ? enriched!.prompts
        : card?.prompts,
    ),
    enriched: enriched != null,
  };
}

// ─── Role ─────────────────────────────────────────────────────────────────

/** transformMyJobRow / transformBrowseResponse fill a missing logo with this. */
const PLACEHOLDER_IMAGE_RE = /images\.unsplash\.com/i;

/**
 * transformMyJobRow derives `skills` by comma-splitting the free-text
 * REQUIREMENTS, so a requirements paragraph yields sentence fragments.
 * Only short, phrase-like items count as skills for the fit row.
 */
function looksLikeSkill(s: string): boolean {
  return s.length <= 40 && s.split(" ").length <= 5 && !/[.!?]$/.test(s);
}

export function buildRoleContext(
  job: Job | null | undefined,
  fallback: { jobId: string; title: string; company: string } | null,
): RoleContext | null {
  if (job) {
    const logo = cleanString(job.logo);
    const image = cleanString(job.image);
    return {
      jobId: String(job.id ?? fallback?.jobId ?? ""),
      title: cleanString(job.title) ?? cleanString(fallback?.title) ?? "",
      company: cleanString(job.company) ?? cleanString(fallback?.company) ?? "",
      logoUrl: logo ?? (image && !PLACEHOLDER_IMAGE_RE.test(image) ? image : null),
      salaryMin: positive(job.salaryMin),
      salaryMax: positive(job.salaryMax),
      salaryCurrency: cleanString(job.salaryCurrency),
      remote: typeof job.isRemote === "boolean" ? job.isRemote : null,
      experienceLevel: cleanString(job.experienceLevel),
      employmentType: cleanString(job.type),
      skills: dedupeStrings(Array.isArray(job.skills) ? job.skills : []).filter(
        looksLikeSkill,
      ),
    };
  }
  if (!fallback) return null;
  return {
    jobId: String(fallback.jobId ?? ""),
    title: cleanString(fallback.title) ?? "",
    company: cleanString(fallback.company) ?? "",
    logoUrl: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    remote: null,
    experienceLevel: null,
    employmentType: null,
    skills: [],
  };
}

function roleComp(role: RoleContext): CompRange | null {
  return normalizeCompRange(role.salaryMin, role.salaryMax, role.salaryCurrency);
}

/** "Snowflake · $160–190K · Remote" — missing parts drop out. */
export function roleSubline(role: RoleContext): string {
  return joinFacts([
    role.company,
    formatCompRange(roleComp(role)),
    role.remote === null ? null : role.remote ? "Remote" : "On-site",
  ]);
}

// ─── Fit ──────────────────────────────────────────────────────────────────

interface LevelWord {
  re: RegExp;
  rank: number;
  floor: number;
}

/** Ordered by rank. Used for both the experience floor and level compare. */
const LEVEL_WORDS: LevelWord[] = [
  { re: /\b(intern|internship|entry|junior|jr)\b/i, rank: 0, floor: 0 },
  { re: /\b(associate)\b/i, rank: 1, floor: 1 },
  { re: /\b(mid|intermediate)\b/i, rank: 2, floor: 3 },
  { re: /\b(senior|sr)\b/i, rank: 3, floor: 5 },
  { re: /\b(staff|principal|lead)\b/i, rank: 4, floor: 7 },
  { re: /\b(director)\b/i, rank: 5, floor: 10 },
];

/** Highest-ranked level word in a string ("Senior Staff" → Staff), else null. */
export function levelRank(level: string | null | undefined): LevelWord | null {
  if (typeof level !== "string") return null;
  let best: LevelWord | null = null;
  for (const w of LEVEL_WORDS) if (w.re.test(level)) best = w;
  return best;
}

/**
 * The role's years requirement. An explicit number wins ("5+ years",
 * "3-5 yrs", "Senior (5+ yrs)", bare "5+"); else a level word's floor.
 * null when the level means nothing we can compare against.
 */
export function parseExperienceRequirement(
  level: string | null | undefined,
): { floor: number; roleValue: string } | null {
  const t = cleanString(level);
  if (!t) return null;
  const m =
    t.match(/(\d{1,2})\s*(?:(\+)|\s*(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)\b/i) ??
    t.match(/^(\d{1,2})\s*(?:(\+)|\s*(?:-|–|to)\s*(\d{1,2}))?$/);
  if (m) {
    const lo = Number(m[1]);
    const hi = m[3] !== undefined ? Number(m[3]) : null;
    return {
      floor: lo,
      roleValue: hi !== null && hi > lo ? `${lo}–${hi} yrs` : `${lo}+ yrs`,
    };
  }
  const word = levelRank(t);
  return word ? { floor: word.floor, roleValue: t } : null;
}

function yearsShort(years: number): string {
  if (years <= 0) return "<1 yr";
  return years === 1 ? "1 yr" : `${years} yrs`;
}

const IMMEDIATE_RE = /\b(immediate(ly)?|asap|now|flexible|anytime)\b/i;

function compRow(a: ApplicantFacts, role: RoleContext): FitRow | null {
  const mine = a.targetComp;
  const theirs = roleComp(role);
  const applicantValue = formatCompRange(mine);
  const roleValue = formatCompRange(theirs);
  if (!mine || !theirs || !applicantValue || !roleValue) return null;
  // Never compare across currencies — no FX guesses.
  if ((mine.currency ?? "USD") !== (theirs.currency ?? "USD")) return null;
  const applicantFloor = mine.min ?? mine.max!;
  const roleCeiling = theirs.max ?? theirs.min!;
  // Overlapping, or the applicant asks for less than the role pays → match;
  // only an applicant floor above the role's ceiling is a gap.
  const status: FitStatus = applicantFloor > roleCeiling ? "gap" : "match";
  return { key: "comp", label: "Comp", applicantValue, roleValue, status };
}

function workStyleRow(a: ApplicantFacts, role: RoleContext): FitRow | null {
  if (!a.workStyle || role.remote === null) return null;
  const prefs = new Set(a.workStyle.split(" · "));
  const status: FitStatus = role.remote
    ? prefs.has("Remote")
      ? "match"
      : "gap"
    : prefs.has("On-site") || prefs.has("Hybrid")
      ? "match"
      : "gap";
  return {
    key: "workStyle",
    label: "Work style",
    applicantValue: a.workStyle,
    roleValue: role.remote ? "Remote" : "On-site",
    status,
  };
}

/**
 * Start date. RoleContext carries no start date today (job postings don't
 * have one), so `roleStart` is always null and this row never renders —
 * the path exists so it lights up the day roles gain a start field. Match
 * when the applicant can start immediately/flexibly or names the same
 * start; anything else is a gap (no date arithmetic on free text).
 */
function startRow(a: ApplicantFacts, roleStart: string | null): FitRow | null {
  if (!a.startAvailability || !roleStart) return null;
  const status: FitStatus =
    IMMEDIATE_RE.test(a.startAvailability) ||
    a.startAvailability.toLowerCase() === roleStart.toLowerCase()
      ? "match"
      : "gap";
  return {
    key: "start",
    label: "Start",
    applicantValue: a.startAvailability,
    roleValue: roleStart,
    status,
  };
}

function experienceRow(a: ApplicantFacts, role: RoleContext): FitRow | null {
  if (a.years === null) return null;
  const req = parseExperienceRequirement(role.experienceLevel);
  if (!req) return null;
  const status: FitStatus =
    a.years >= req.floor ? "match" : a.years >= req.floor - 1 ? "stretch" : "gap";
  return {
    key: "experience",
    label: "Experience",
    applicantValue: yearsShort(a.years),
    roleValue: req.roleValue,
    status,
  };
}

function levelRow(a: ApplicantFacts, role: RoleContext): FitRow | null {
  if (!a.level || !role.experienceLevel) return null;
  const mine = levelRank(a.level);
  const theirs = levelRank(role.experienceLevel);
  if (!mine || !theirs) return null;
  const diff = mine.rank - theirs.rank;
  const status: FitStatus = diff >= 0 ? "match" : diff === -1 ? "stretch" : "gap";
  return {
    key: "level",
    label: "Level",
    applicantValue: a.level,
    roleValue: role.experienceLevel,
    status,
  };
}

/**
 * Experience and Level must not both be scored off the same field. A years
 * requirement ("5+ years") feeds Experience; a level word ("Senior") is one
 * signal — scored as Level when the applicant states a level, else as
 * Experience (their years vs the word's floor) — never both, or one fact
 * would supply two of the rows behind "STRONG MATCH".
 */
function experienceAndLevelRows(
  a: ApplicantFacts,
  role: RoleContext,
): (FitRow | null)[] {
  const exp = experienceRow(a, role);
  const lvl = levelRow(a, role);
  const yearsBased = /\byrs?\b|\byears?\b/i.test(role.experienceLevel ?? "");
  if (lvl && exp && !yearsBased) return [lvl];
  return [exp, lvl];
}

function skillsRow(a: ApplicantFacts, role: RoleContext): FitRow | null {
  const needed = dedupeStrings(role.skills);
  // Dedupe on skillOverlap's own normalization so "React Native" and
  // "react-native" count once on the role side too.
  const roleSkills = needed.filter(
    (s, i) => skillOverlap([s], needed.slice(0, i)).length === 0,
  );
  if (roleSkills.length < 2 || a.skills.length === 0) return null;
  const overlap = skillOverlap(roleSkills, a.skills).length;
  return {
    key: "skills",
    label: "Skills",
    applicantValue: `${overlap} of ${roleSkills.length}`,
    roleValue: `${roleSkills.length} listed`,
    status: overlap / roleSkills.length >= 0.6 ? "match" : "gap",
  };
}

/** "Four of five line up with what you posted." / "Both …" / "All three …". */
export function fitHeadline(matched: number, total: number): string | null {
  if (total < 2) return null;
  const tail = "line up with what you posted.";
  if (matched === total) {
    return total === 2
      ? `Both ${tail}`
      : `All ${numberWord(total).toLowerCase()} ${tail}`;
  }
  if (matched === 0) return `None of ${numberWord(total).toLowerCase()} ${tail}`;
  // "One of three lines up" — singular verb for a single match.
  const verbTail = matched === 1 ? tail.replace(/^line /, "lines ") : tail;
  return `${numberWord(matched)} of ${numberWord(total).toLowerCase()} ${verbTail}`;
}

export function buildFitSummary(
  a: ApplicantFacts,
  role: RoleContext | null,
): FitSummary {
  const rows: FitRow[] = role
    ? [
        compRow(a, role),
        workStyleRow(a, role),
        startRow(a, null),
        ...experienceAndLevelRows(a, role),
        skillsRow(a, role),
      ].filter((r): r is FitRow => r !== null)
    : [];
  const matched = rows.filter((r) => r.status === "match").length;
  const total = rows.length;
  const stretch = rows.find((r) => r.status === "stretch");
  const first = (a.firstName || "").trim();
  return {
    rows,
    matched,
    total,
    strength: total >= 3 && matched / total >= 0.75 ? "strong" : null,
    headline: fitHeadline(matched, total),
    stretchNote: stretch
      ? (first
          ? `${stretch.label} · A step up for ${first}`
          : `${stretch.label} · A step up`
        ).toUpperCase()
      : null,
  };
}

// ─── Stat grids ───────────────────────────────────────────────────────────

function yearsLong(years: number): string {
  if (years <= 0) return "Under a year";
  return years === 1 ? "1 year" : `${years} years`;
}

function fill(primary: (StatCell | null)[], extras: (StatCell | null)[], max = 4): StatCell[] {
  const cells = primary.filter((c): c is StatCell => c !== null);
  for (const extra of extras) {
    if (cells.length >= max) break;
    if (extra) cells.push(extra);
  }
  return cells.slice(0, max);
}

function cell(label: string, value: string | null | undefined): StatCell | null {
  const v = cleanString(value);
  return v ? { label, value: v } : null;
}

/** The photo card's frosted 2×2 grid: up to four present facts, in order. */
export function heroStats(a: ApplicantFacts): StatCell[] {
  return fill(
    [
      a.years !== null ? cell("Experience", yearsLong(a.years)) : null,
      cell("Comp", formatCompRange(a.targetComp)),
      cell("Work style", a.workStyle ? a.workStyle.split(" · ").join(" / ") : null),
      cell("Seeking", a.seeking),
    ],
    [cell("Location", a.location), cell("Looking for", a.desiredRole)],
  );
}

/** The connector variant's stats card: up to four present facts, in order. */
export function statsCardCells(a: ApplicantFacts): StatCell[] {
  return fill(
    [
      a.years !== null ? cell("Years exp.", a.years <= 0 ? "<1" : String(a.years)) : null,
      cell("Target comp", formatCompRange(a.targetComp)),
      cell(a.location ?? "Work style", a.workStyle),
      cell("Start date", a.startAvailability),
    ],
    [cell("Seeking", a.seeking), cell("Looking for", a.desiredRole)],
  );
}
