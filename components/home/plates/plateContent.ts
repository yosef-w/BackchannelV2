// Plate content — the pure, testable half of the "Skim & Dive" deck card
// (PlateDeck). A deck entry is rendered as a short row of full-screen
// PLATES (one idea each, slid through at decide-speed) above the full
// dossier (scrolled into at read-speed). This module turns the raw deck
// data into those plates, using the SAME derivations the dossier ledger
// uses (dossierFacts) so the skim and the dive never disagree.
//
// Every claim on a plate is DERIVED, never invented: claim lines come from
// the applicant's own achievements/skills, receipts are their real
// experience rows, fit lines are computed overlaps against the viewer's
// own role or profile. Plates whose data is absent are simply omitted —
// a thin profile gets two plates, a rich one gets four.

import type { Job } from "@/types/jobs";
import type {
  EnrichedApplicantProfile,
  EnrichedSponsorProfile,
  ProfileDeckCard,
  ProfilePrompt,
} from "@/types/profiles";
import {
  deriveExperienceFact,
  formatExperienceLevelLabel,
  joinFacts,
  yearFromDateString,
} from "../dossierFacts";

/** A line of serif type with optional italic-muted accent spans. */
export interface RichSegment {
  text: string;
  accent?: boolean;
}
export type RichLine = RichSegment[];

export interface LedgerRow {
  key: string;
  value: string;
  sub?: string;
}

export type Plate =
  | {
      kind: "placard";
      eyebrow: string;
      image: string;
      name: string;
      sub: string;
      claim: RichLine;
    }
  | {
      kind: "record";
      eyebrow: string;
      stat: string;
      statSuffix: string;
      statline: RichLine;
      receipts: string[];
    }
  | { kind: "voice"; quote: string; attribution: string }
  | {
      kind: "role";
      eyebrow: string;
      logoUrl?: string;
      company: string;
      title: string;
      sub: RichLine;
    }
  | { kind: "setup"; eyebrow: string; rows: LedgerRow[] }
  | {
      kind: "vouch";
      statement: RichLine;
      sponsorName: string;
      sponsorRole: string;
      image: string;
      quote?: string;
      attribution?: string;
      chips: string[];
    }
  | { kind: "fit"; eyebrow: string; line: RichLine; receipts: string[] };

/** The identity strip that persists from plate two onward and through the
 * dossier — derived from the first plate so the two can never disagree. */
export interface PlateAnchor {
  name: string;
  claim: string;
  image?: string;
  /** Sponsor-side cards show a photo; job cards show the company logo. */
  logoName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const CLAIM_MAX = 72;

/** First sentence of a block of text, clipped to a display length. */
export function firstSentence(text: string | null | undefined, max = CLAIM_MAX): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  let s = (m ? m[1] : t).trim();
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

function endsWithPunctuation(s: string): boolean {
  return /[.!?…]$/.test(s);
}

export function plainText(line: RichLine): string {
  return line.map((s) => s.text).join("");
}

function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

/**
 * Skills present in both lists (case/punctuation-insensitive). Returns the
 * `mine` spelling so the viewer sees their own words.
 */
export function skillOverlap(mine: string[], theirs: string[]): string[] {
  const theirSet = new Set(theirs.map(normalizeSkill).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of mine) {
    const n = normalizeSkill(raw);
    if (!n || seen.has(n) || !theirSet.has(n)) continue;
    seen.add(n);
    out.push(raw.trim());
  }
  return out;
}

/** "6 years" → {stat:"6", suffix:"yrs"}; "1 year" → {"1","yr"}; "Under a year" → {"<1","yr"}. */
export function splitYears(value: string): { stat: string; suffix: string } | null {
  const m = value.match(/^(\d+)\s+years?$/i);
  if (m) return { stat: m[1], suffix: m[1] === "1" ? "yr" : "yrs" };
  if (/^under a year$/i.test(value)) return { stat: "<1", suffix: "yr" };
  return null;
}

function validPrompts(prompts: ProfilePrompt[] | null | undefined): ProfilePrompt[] {
  return (Array.isArray(prompts) ? prompts : []).filter(
    (p) => p && typeof p.answer === "string" && p.answer.trim().length > 0,
  );
}

// ─── Applicant (sponsor is looking) ───────────────────────────────────────

export interface ApplicantPlateContext {
  /** The sponsor's active role — drives the fit plate. */
  roleTitle?: string | null;
  roleSkills?: string[] | null;
}

/**
 * The placard's claim line: one derived sentence that says who this person
 * is. Priority — their own achievements (first sentence), then the skill
 * they lead with, then the seat they want. Never fabricated; composed at
 * most as "Sharpest at X."
 */
export function deriveApplicantClaim(input: {
  achievements?: string | null;
  skills?: string[] | null;
  desiredRole?: string | null;
  bio?: string | null;
}): RichLine {
  const ach = firstSentence(input.achievements);
  if (ach) return [{ text: endsWithPunctuation(ach) ? ach : `${ach}.` }];
  const skill = (input.skills || []).map((s) => s.trim()).find(Boolean);
  if (skill) return [{ text: "Sharpest at " }, { text: skill, accent: true }, { text: "." }];
  const role = (input.desiredRole || "").trim();
  if (role && !/^open to opportunities$/i.test(role))
    return [{ text: "Ready for " }, { text: role, accent: true }, { text: "." }];
  const bio = firstSentence(input.bio);
  if (bio && !/^looking for new opportunities/i.test(bio))
    return [{ text: endsWithPunctuation(bio) ? bio : `${bio}.` }];
  return [{ text: "Open to the " }, { text: "right introduction.", accent: true }];
}

export function buildApplicantPlates(
  card: ProfileDeckCard,
  cached: EnrichedApplicantProfile | null,
  ctx: ApplicantPlateContext = {},
): Plate[] {
  const name = (card.name || "").trim();
  const image = (card.image || "").trim();
  const desiredRole = (card.desiredRole || "").trim();
  const location = (card.location || "").trim();
  const skills = (cached?.skills?.length ? cached.skills : card.skills) || [];
  const prompts = validPrompts(cached?.prompts?.length ? cached.prompts : card.prompts);
  const bio = (cached?.bio || card.bio || "").trim();
  const experiences = Array.isArray(cached?.experiences) ? cached.experiences : [];
  const achievements = (cached?.achievements || "").trim();

  const plates: Plate[] = [];

  // 1 · PLACARD
  const experienceFact = deriveExperienceFact(experiences);
  const seat = experienceFact?.sub || "";
  const wantsRole = desiredRole && !/^open to opportunities$/i.test(desiredRole);
  plates.push({
    kind: "placard",
    eyebrow: wantsRole ? `APPLICANT · ${desiredRole.toUpperCase()}` : "APPLICANT",
    image,
    name,
    sub: joinFacts([seat, location]),
    claim: deriveApplicantClaim({ achievements, skills, desiredRole, bio }),
  });

  // 2 · THE RECORD — only when there is a record to show
  if (experiences.length > 0 || experienceFact?.value) {
    const years = experienceFact ? splitYears(experienceFact.value) : null;
    const stat = years ?? {
      stat: String(experiences.length),
      suffix: experiences.length === 1 ? "role" : "roles",
    };
    const sorted = [...experiences].sort(
      (a, b) => (yearFromDateString(a.startDate) ?? 0) - (yearFromDateString(b.startDate) ?? 0),
    );
    const first = (sorted[0]?.company || "").trim();
    const last = (sorted[sorted.length - 1]?.company || "").trim();
    const statline: RichLine =
      first && last && first !== last
        ? [{ text: `${first}, then ` }, { text: `${last}.`, accent: true }]
        : last
          ? [{ text: last, accent: true }]
          : seat
            ? [{ text: seat, accent: true }]
            : [];
    // Most recent first; identical strings (two untitled rows at the same
    // company) collapse to one — a repeated receipt reads as a glitch.
    const receipts = [
      ...new Set(
        sorted
          .slice(-3)
          .reverse()
          .map((e) => joinFacts([e.jobTitle, e.company]))
          .filter(Boolean),
      ),
    ];
    plates.push({
      kind: "record",
      eyebrow: "THE RECORD",
      stat: stat.stat,
      statSuffix: stat.suffix,
      statline,
      receipts,
    });
  }

  // 3 · IN THEIR WORDS — the first prompt, else the bio
  const hero = prompts[0];
  if (hero) {
    plates.push({
      kind: "voice",
      quote: hero.answer!.trim(),
      attribution: (hero.question || "In their words").toUpperCase(),
    });
  } else if (bio && !/^looking for new opportunities$/i.test(bio)) {
    plates.push({ kind: "voice", quote: bio, attribution: "FROM THEIR BIO" });
  }

  // 4 · WHY YOU'RE SEEING THEM
  const roleTitle = (ctx.roleTitle || "").trim();
  const roleSkills = (ctx.roleSkills || []).filter(Boolean);
  const overlap = skillOverlap(skills, roleSkills);
  let line: RichLine;
  let receipts: string[] = [];
  if (roleSkills.length > 0 && overlap.length > 0) {
    line = [
      { text: "Brings " },
      { text: `${overlap.length} of the ${roleSkills.length} skills`, accent: true },
      { text: roleTitle ? ` your ${roleTitle} needs.` : " this role needs." },
    ];
    receipts = overlap.slice(0, 4);
  } else if (wantsRole && roleTitle) {
    line = [
      { text: "Wants " },
      { text: desiredRole, accent: true },
      { text: ` — you're hiring a ${roleTitle}.` },
    ];
  } else if (wantsRole) {
    line = [{ text: "Looking for " }, { text: desiredRole, accent: true }, { text: location ? ` · ${location}` : "." }];
  } else {
    line = [{ text: "Open to the right role" }, { text: location ? ` · ${location}` : ".", accent: !!location }];
  }
  plates.push({ kind: "fit", eyebrow: "WHY YOU'RE SEEING THEM", line, receipts });

  return plates;
}

// ─── Job (applicant is looking) ───────────────────────────────────────────

export interface JobPlateContext {
  /** The applicant's own skills — drives the fit plate. */
  mySkills?: string[] | null;
}

function fitPercent(raw: unknown): number | null {
  const score = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(score) || score <= 0) return null;
  const percent = score > 1 ? score : score * 100;
  return Math.min(100, Math.max(1, Math.round(percent)));
}

export function buildJobPlates(
  job: Job,
  sponsorProfile: EnrichedSponsorProfile | null,
  ctx: JobPlateContext = {},
): Plate[] {
  const title = (job.title || "").trim();
  const company = (job.company || "").trim();
  const location = (job.location || "").trim();
  const salary = (job.salary || "").trim();
  const arrangement = (job.workArrangement || "").trim();
  const si = job.sponsorInfo || null;
  const sponsored = job.isSponsored !== false && !!si;
  const first = (si?.name || "").trim().split(/\s+/)[0] || "";

  const plates: Plate[] = [];

  // 1 · ROLE PLACARD
  const eyebrow =
    job.isSponsored === false
      ? "OPEN ROLE · NO SPONSOR YET"
      : sponsored
        ? `SPONSORED ROLE${company ? ` · ${company.toUpperCase()}` : ""}`
        : `ROLE${company ? ` · ${company.toUpperCase()}` : ""}`;
  const sub: RichLine = [];
  if (salary) sub.push({ text: salary });
  const where = joinFacts([arrangement, location]);
  if (where) sub.push({ text: salary ? ` · ${where}` : where, accent: true });
  plates.push({ kind: "role", eyebrow, logoUrl: job.image || job.logo, company, title, sub });

  // 2 · THE SETUP
  const rows: LedgerRow[] = [];
  if (salary) rows.push({ key: "COMPENSATION", value: salary });
  const setup = joinFacts([arrangement, job.type, formatExperienceLevelLabel(job.experienceLevel)]);
  if (setup) rows.push({ key: "THE SETUP", value: setup });
  if (location) rows.push({ key: "LOCATION", value: location });
  if (typeof job.applicants === "number" && job.applicants > 0)
    rows.push({ key: "INTEREST", value: `${job.applicants} showing interest` });
  if (rows.length > 0) plates.push({ kind: "setup", eyebrow: "THE SETUP", rows });

  // 3 · THE VOUCH — only a real sponsor gets the stage
  if (sponsored && si) {
    const qa = (sponsorProfile?.insights || []).filter((q) => q && q.question && q.answer);
    const chips: string[] = [];
    if (sponsorProfile?.verified) chips.push("VERIFIED");
    if ((si.yearsAtCompany || "").trim()) chips.push(`${si.yearsAtCompany!.trim()} HERE`.toUpperCase());
    if (si.canRefer) chips.push("CAN REFER");
    plates.push({
      kind: "vouch",
      statement: [{ text: `${first || "Someone"} put their ` }, { text: "name", accent: true }, { text: " on this role." }],
      sponsorName: si.name || "",
      sponsorRole: joinFacts([si.role, company]),
      image: si.image || "",
      quote: qa[0]?.answer?.trim() || undefined,
      attribution: qa[0] ? joinFacts([first, qa[0].question || ""]).toUpperCase() : undefined,
      chips,
    });
  }

  // 4 · YOUR FIT
  const mine = (ctx.mySkills || []).filter(Boolean);
  const overlap = skillOverlap(mine, job.skills || []);
  const pct = fitPercent(job.relevanceScore);
  let line: RichLine;
  let receipts: string[] = [];
  if (job.skills?.length && overlap.length > 0) {
    line = [
      { text: `${overlap.length} of the ${job.skills.length} required skills`, accent: true },
      { text: " are already on your profile." },
    ];
    receipts = overlap.slice(0, 4);
  } else if (pct !== null) {
    line = [{ text: `${pct}% match`, accent: true }, { text: ", by our read." }];
  } else if (sponsored && first) {
    line = [
      { text: "Ask " },
      { text: first, accent: true },
      { text: si?.canRefer ? " for the referral — they can refer you directly." : " for the referral — they can put in a word." },
    ];
  } else if (job.isSponsored === false) {
    line = [{ text: "No sponsor yet — join the waitlist and you'll hear the " }, { text: "moment one signs on.", accent: true }];
  } else {
    line = [{ text: "Worth a look" }, { text: company ? ` at ${company}.` : ".", accent: true }];
  }
  plates.push({ kind: "fit", eyebrow: "YOUR FIT", line, receipts });

  return plates;
}

// ─── Anchor ───────────────────────────────────────────────────────────────

export function deriveAnchor(plates: Plate[]): PlateAnchor {
  const first = plates[0];
  if (first?.kind === "placard")
    return { name: first.name, claim: plainText(first.claim), image: first.image };
  if (first?.kind === "role")
    return { name: first.title, claim: first.company, image: first.logoUrl, logoName: first.company };
  return { name: "", claim: "" };
}
