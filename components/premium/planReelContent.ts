// The plan reel's score — three beats, one per thing membership actually
// changes, each told as the real object it changes (the deck cards, the
// sponsor-request letters, a marketplace listing) rather than a ledger
// label. Timings live here, as plain numbers, so the component stays a
// renderer and the test can check the beats agree with the acts.
//
// The reel loops whole (loopStart 0): unlike the intro film there is no
// "problem act" to resolve once — every beat is a benefit worth replaying.

import type { CaptionSegment, CinemaBeat } from "@/components/cinema/engine";
import { DAILY_LIKE_LIMITS } from "@/constants/config";

export const BEAT_COUNT = 3;
export const BEAT_MS = 4400;
export const TOTAL_MS = BEAT_MS * BEAT_COUNT;

/** Master-clock value at which each beat starts (tap-to-advance targets). */
export const ACT_STARTS: readonly number[] = [0, 1 / 3, 2 / 3];
/** The progress hairline's segments. */
export const ACTS: readonly (readonly [number, number])[] = [
  [0, 1 / 3],
  [1 / 3, 2 / 3],
  [2 / 3, 1],
];

/** Master-clock value for a point `local` (0–1) inside beat `beat`. */
export function at(beat: number, local: number): number {
  return beat / BEAT_COUNT + local / BEAT_COUNT;
}

// ── Beat-local choreography (0–1 within the beat) ─────────────────────────
// Shared by the scenes (what moves when) and the haptics (what's felt when),
// so a retiming can't desynchronise the two.

export const DECK = {
  /** The two free stamps, then the strike through the free cap, then three more. */
  stamps: [0.12, 0.2, 0.46, 0.53, 0.6],
  strike: [0.34, 0.44],
  five: [0.66, 0.78],
} as const;

export const LETTERS = {
  first: [0.11, 0.3],
  lockIn: [0.27, 0.35],
  lockOpen: [0.48, 0.54],
  lockOut: [0.5, 0.58],
  /** The rest go out together, staggered. */
  rest: [0.57, 0.77],
  restStagger: 0.03,
} as const;

export const LISTING = {
  chipOut: [0.3, 0.36],
  pillIn: [0.34, 0.46],
  press: [0.6, 0.7],
  labelOut: [0.74, 0.78],
  tick: [0.76, 0.84],
} as const;

/** Caption windows, beat-local: the headline, then the line under it. */
export const CAPTION = {
  headlineEnter: 0.05,
  subEnter: 0.2,
  out: [0.88, 0.96],
} as const;

// ── Copy ──────────────────────────────────────────────────────────────────

export const HEADLINES: readonly CaptionSegment[][] = [
  [
    { text: `${DAILY_LIKE_LIMITS.premium === 5 ? "Five" : String(DAILY_LIKE_LIMITS.premium)} a day.` },
    { text: `Not ${DAILY_LIKE_LIMITS.free === 2 ? "two" : String(DAILY_LIKE_LIMITS.free)}.`, accent: true },
  ],
  [{ text: "Ask every sponsor." }, { text: "Not one.", accent: true }],
  [{ text: "Act on roles." }, { text: "Don't just look.", accent: true }],
];

export const SUBS: readonly string[] = [
  `Express interest in ${DAILY_LIKE_LIMITS.premium} roles from today's deck. Free stops at ${DAILY_LIKE_LIMITS.free}.`,
  "A real person at that company hears about you. Your first is on us; members never stop.",
  "Everyone can browse sponsored roles. Members are the ones who raise a hand.",
];

// ── Haptics (master-clock units) ──────────────────────────────────────────

// Listed by scene, sorted by time: the strike falls between the free
// stamps and the member stamps.
export const BEATS: readonly CinemaBeat[] = (
  [
    ...DECK.stamps.map((t) => ({ at: at(0, t), kind: "tick" as const })),
    { at: at(0, DECK.strike[1]), kind: "impact" },
    { at: at(1, LETTERS.first[0]), kind: "tick" },
    { at: at(1, LETTERS.lockOpen[0]), kind: "impact" },
    { at: at(1, LETTERS.rest[0]), kind: "tick" },
    { at: at(1, LETTERS.rest[0] + LETTERS.restStagger), kind: "tick" },
    { at: at(1, LETTERS.rest[0] + 2 * LETTERS.restStagger), kind: "tick" },
    { at: at(2, LISTING.pillIn[0]), kind: "impact" },
    { at: at(2, LISTING.press[0]), kind: "heavy" },
    { at: at(2, LISTING.tick[0]), kind: "success" },
  ] satisfies CinemaBeat[]
).sort((a, b) => a.at - b.at);
