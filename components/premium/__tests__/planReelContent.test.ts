/**
 * The plan reel's score must stay internally consistent:
 *   1. the acts tile the reel exactly and the tap-to-advance targets are
 *      their starts
 *   2. every haptic beat lands inside the beat whose choreography fires it,
 *      in ascending order (the engine only fires on a rising clock)
 *   3. every beat-local window is ordered and inside 0–1, and the captions
 *      leave before the beat ends
 *   4. copy: one headline + one sub per beat, each headline with an accent
 */

import {
  ACT_STARTS,
  ACTS,
  at,
  BEAT_COUNT,
  BEATS,
  CAPTION,
  DECK,
  HEADLINES,
  LETTERS,
  LISTING,
  SUBS,
  TOTAL_MS,
} from "../planReelContent";

describe("acts", () => {
  it("tile 0–1 with no gaps and start where tap-to-advance lands", () => {
    expect(ACTS).toHaveLength(BEAT_COUNT);
    expect(ACTS[0][0]).toBe(0);
    expect(ACTS[ACTS.length - 1][1]).toBe(1);
    for (let i = 1; i < ACTS.length; i++) expect(ACTS[i][0]).toBe(ACTS[i - 1][1]);
    expect(ACT_STARTS).toEqual(ACTS.map(([a]) => a));
    expect(TOTAL_MS).toBeGreaterThan(9000);
    expect(TOTAL_MS).toBeLessThan(20000);
  });
});

describe("haptic beats", () => {
  it("ascend strictly and stay inside the reel", () => {
    for (let i = 0; i < BEATS.length; i++) {
      expect(BEATS[i].at).toBeGreaterThan(0);
      expect(BEATS[i].at).toBeLessThan(1);
      if (i > 0) expect(BEATS[i].at).toBeGreaterThan(BEATS[i - 1].at);
    }
  });

  it("fire inside the beat whose choreography they belong to", () => {
    const inBeat = (t: number, beat: number) =>
      t >= ACTS[beat][0] && t < ACTS[beat][1];
    for (const t of DECK.stamps) expect(inBeat(at(0, t), 0)).toBe(true);
    expect(inBeat(at(1, LETTERS.lockOpen[0]), 1)).toBe(true);
    expect(inBeat(at(2, LISTING.tick[0]), 2)).toBe(true);
    // The success buzz is the last thing felt.
    expect(BEATS[BEATS.length - 1].kind).toBe("success");
  });
});

describe("beat-local windows", () => {
  const windows: readonly (readonly [number, number])[] = [
    DECK.strike,
    DECK.five,
    LETTERS.first,
    LETTERS.lockIn,
    LETTERS.lockOpen,
    LETTERS.lockOut,
    LETTERS.rest,
    LISTING.chipOut,
    LISTING.pillIn,
    LISTING.press,
    LISTING.labelOut,
    LISTING.tick,
    CAPTION.out,
  ];

  it("are ordered and inside 0–1", () => {
    for (const [a, b] of windows) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThan(a);
    }
    for (let i = 1; i < DECK.stamps.length; i++) {
      expect(DECK.stamps[i]).toBeGreaterThan(DECK.stamps[i - 1]);
    }
  });

  it("read in story order: the cap is struck between the free stamps and the member stamps", () => {
    expect(DECK.strike[0]).toBeGreaterThan(DECK.stamps[1]);
    expect(DECK.strike[1]).toBeLessThanOrEqual(DECK.stamps[2]);
    expect(LETTERS.lockIn[0]).toBeGreaterThan(LETTERS.first[0]);
    expect(LETTERS.rest[0]).toBeGreaterThan(LETTERS.lockOpen[0]);
    expect(LISTING.pillIn[0]).toBeGreaterThanOrEqual(LISTING.chipOut[0]);
    expect(LISTING.tick[0]).toBeGreaterThan(LISTING.press[0]);
  });

  it("captions enter after the scene opens and leave before it closes", () => {
    expect(CAPTION.headlineEnter).toBeGreaterThan(0);
    expect(CAPTION.subEnter).toBeGreaterThan(CAPTION.headlineEnter);
    expect(CAPTION.out[1]).toBeLessThan(1);
  });
});

describe("copy", () => {
  it("has one headline and one sub per beat, each headline with an accent", () => {
    expect(HEADLINES).toHaveLength(BEAT_COUNT);
    expect(SUBS).toHaveLength(BEAT_COUNT);
    for (const h of HEADLINES) {
      expect(h.some((s) => s.accent)).toBe(true);
      expect(h.every((s) => s.text.trim().length > 0)).toBe(true);
    }
    for (const s of SUBS) expect(s.length).toBeGreaterThan(20);
  });
});
