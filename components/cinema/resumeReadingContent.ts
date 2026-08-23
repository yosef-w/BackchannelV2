// Content selection for the résumé-reading film (ResumeReadingFilm) — the
// pure, testable half. Two jobs:
//
//  1. pickResumeLines — choose a few short, human-readable lines from the
//     raw parsed résumé text for the "FROM YOUR RÉSUMÉ" drift scene. The
//     lines are shown verbatim (quoted), so the filter's whole purpose is
//     rejecting things that would look broken on a cinema stage: headers,
//     contact rows, URLs, page furniture.
//
//  2. buildReadingRows — derive the ledger rows for the build scene from
//     the freshly-classified profile, using the SAME derivations the deck
//     card uses (dossierFacts) so the film shows exactly what the user's
//     card will say. Falls back to role/industry so the scene never runs
//     empty on a thin résumé.

import {
  deriveExperienceFact,
  joinFacts,
} from "@/components/home/dossierFacts";

export interface ReadingRow {
  label: string;
  value: string;
}

/** Longest line shown on the drift stage before we clip with an ellipsis. */
const DRIFT_CLIP_CHARS = 64;

function clipLine(line: string): string {
  if (line.length <= DRIFT_CLIP_CHARS) return line;
  return `${line.slice(0, DRIFT_CLIP_CHARS - 3).trimEnd()}…`;
}

/**
 * Pick up to `max` presentable lines from raw extracted résumé text.
 * Spread across the document (first / middle / last acceptable line) so the
 * drift reads like a skim of the whole résumé, not just its header.
 */
export function pickResumeLines(
  text: string | null | undefined,
  max = 3,
): string[] {
  if (!text) return [];
  const candidates = text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/^[\s•\-–—▪◦*·]+/, "").trim())
    .filter((line) => {
      if (line.length < 24 || line.length > 90) return false;
      // Must read as prose: several words, some lowercase (rejects
      // ALL-CAPS section headers), no contact/URL noise.
      if (!/[a-z]/.test(line)) return false;
      if ((line.match(/[A-Za-z]+/g) || []).length < 4) return false;
      if (/[@]|https?:|www\.|linkedin|github/i.test(line)) return false;
      if (/\(\d{3}\)|\d{3}[-.\s]\d{3,4}[-.\s]\d{4}/.test(line)) return false;
      return true;
    });

  if (candidates.length <= max) return candidates.map(clipLine);

  // First, middle, and last acceptable line — a skim of the whole document.
  const picks = [
    candidates[0],
    candidates[Math.floor(candidates.length / 2)],
    candidates[candidates.length - 1],
  ];
  return [...new Set(picks)].slice(0, max).map(clipLine);
}

/** Longest ledger value before we clip — the row must stay on one line. */
const ROW_CLIP_CHARS = 40;

function clipValue(value: string): string {
  if (value.length <= ROW_CLIP_CHARS) return value;
  return `${value.slice(0, ROW_CLIP_CHARS - 3).trimEnd()}…`;
}

export interface ReadingRowsInput {
  experiences?: unknown[] | null;
  skills?: string[] | null;
  achievements?: string | null;
  currentRole?: string | null;
  industry?: string | null;
}

/**
 * Ledger rows for the build scene, mirroring the deck card's hero ledger
 * (EXPERIENCE / SHARPEST AT / KNOWN FOR via dossierFacts) with role and
 * industry as fallbacks so a sparse classify still yields 2–3 rows.
 */
export function buildReadingRows(input: ReadingRowsInput): ReadingRow[] {
  const rows: ReadingRow[] = [];

  const experienceFact = deriveExperienceFact(
    (input.experiences as Parameters<typeof deriveExperienceFact>[0]) ?? null,
  );
  if (experienceFact?.value) {
    rows.push({ label: "EXPERIENCE", value: clipValue(experienceFact.value) });
  }

  const sharpestAt = joinFacts((input.skills ?? []).slice(0, 2));
  if (sharpestAt) rows.push({ label: "SHARPEST AT", value: clipValue(sharpestAt) });

  const knownFor = (input.achievements ?? "").trim();
  if (knownFor) rows.push({ label: "KNOWN FOR", value: clipValue(knownFor) });

  const currentRole = (input.currentRole ?? "").trim();
  if (rows.length < 3 && currentRole) {
    rows.push({ label: "ROLE", value: clipValue(currentRole) });
  }
  const industry = (input.industry ?? "").trim();
  if (rows.length < 3 && industry) {
    rows.push({ label: "INDUSTRY", value: clipValue(industry) });
  }

  return rows.slice(0, 3);
}
