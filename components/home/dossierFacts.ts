// dossierFacts — pure derivations for the deck cards' hero ledger
// (2026-08 "Dossier" card redesign). The ledger surfaces the handful of
// facts that decide a swipe — years of experience, current seat, top
// skills, compensation, sponsor — from data the cards already carry.
// Backend date/level fields are free-form and inconsistent, so every
// function here is total over messy input: bad data degrades to null
// (the row is simply omitted), never to a crash or "NaN years".

import type { PublicProfileExperience } from "@/lib/api";

/**
 * First plausible 4-digit year (1900–2099) found in a free-form date
 * string — handles "2022", "Jan 2022", "2022-01", "01/2022", etc.
 */
export function yearFromDateString(value?: string | null): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

/** Joins the present, non-empty parts with " · " (the card fact separator). */
export function joinFacts(
  parts: (string | null | undefined | false)[],
): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0)
    .join(" · ");
}

export interface LedgerFact {
  value: string;
  sub?: string;
}

/**
 * "EXPERIENCE" ledger row: total years in the field (span from earliest
 * start to latest end / today) with the current seat as the sub-line.
 * Falls back gracefully — years without a seat, seat without years, or
 * null when the experience list is empty/unparseable.
 */
export function deriveExperienceFact(
  experiences: PublicProfileExperience[] | undefined | null,
  nowYear: number = new Date().getFullYear(),
): LedgerFact | null {
  const list = Array.isArray(experiences)
    ? experiences.filter((exp) => !!exp)
    : [];
  if (list.length === 0) return null;

  // Current seat: an explicitly-current entry wins; else the most recent
  // start year; else the first row as listed.
  const seat_entry =
    list.find((exp) => exp.current === true) ??
    [...list].sort(
      (a, b) =>
        (yearFromDateString(b.startDate) ?? -1) -
        (yearFromDateString(a.startDate) ?? -1),
    )[0];
  const seat = joinFacts([seat_entry?.jobTitle, seat_entry?.company]);

  const startYears = list
    .map((exp) => yearFromDateString(exp.startDate))
    .filter((year): year is number => year !== null);

  let years: string | null = null;
  if (startYears.length > 0) {
    const earliest = Math.min(...startYears);
    const latest = Math.max(
      ...list.map((exp) => {
        if (exp.current) return nowYear;
        return (
          yearFromDateString(exp.endDate) ??
          yearFromDateString(exp.startDate) ??
          earliest
        );
      }),
    );
    // Clamp to today so a typo'd future date can't claim decades.
    const span = Math.max(0, Math.min(latest, nowYear) - earliest);
    years =
      span <= 0 ? "Under a year" : span === 1 ? "1 year" : `${span} years`;
  }

  if (years && seat) return { value: years, sub: seat };
  if (years) return { value: years };
  if (seat) return { value: seat };
  return null;
}

/**
 * Experience-level field for the "THE SETUP" row. The backend sends
 * either a label ("Senior") or bare digits ("5+", "3-5") — digits get
 * the "years experience" suffix so they read as a phrase.
 */
export function formatExperienceLevelLabel(
  value?: string | null,
): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return /^[\d+\-\s]+$/.test(trimmed)
    ? `${trimmed} years experience`
    : trimmed;
}
