/**
 * The hero opening's stage math must hold on every Apple device class:
 *   1. the pill reserve matches HomeView's geometry (resting offset + the
 *      88pt tab-bar lift) and DecisionPills' size, and grows when the pills
 *      stack at large Dynamic Type
 *   2. the opening's minimum height tracks the measured stage and falls
 *      back to a window-based estimate before the first layout
 *   3. across real device sizes the photo card is left a usable height:
 *      at least its floor on every phone down to the SE, taller on bigger
 *      phones, never negative on tiny windows
 */

import {
  FLOATING_NAV_CLEARANCE,
  floatingActionsBottom,
  HERO_MAX,
  HERO_MIN,
  HERO_WRAP_PADDING_TOP,
  heroOpeningMinHeight,
  heroPhotoHeight,
  LEDGER_ESTIMATE,
  PILLS_CLEARANCE,
  pillsHeight,
  pillsReserve,
  ROLE_ROW_ESTIMATE,
} from "../stageLayout";

// What the hero opening spends besides the photo card, with a role row and
// a two-row ledger (the first-render estimates, which match what the
// simulator measures).
const HERO_FLOOR = HERO_MIN;

describe("pills geometry", () => {
  it("is one capsule row normally and two stacked segments at large text", () => {
    expect(pillsHeight(false)).toBe(58);
    expect(pillsHeight(true)).toBe(110);
  });

  it("reserves the resting offset + tab-bar lift + pills + clearance", () => {
    expect(FLOATING_NAV_CLEARANCE).toBe(88);
    expect(pillsReserve(28, false)).toBe(28 + 88 + 58 + PILLS_CLEARANCE);
    expect(pillsReserve(28, true) - pillsReserve(28, false)).toBe(52);
  });

  it("uses iOS's 28pt and everyone else's 20pt bottom offset", () => {
    expect(floatingActionsBottom("ios")).toBe(28);
    expect(floatingActionsBottom("android")).toBe(20);
  });
});

describe("heroOpeningMinHeight", () => {
  it("is the measured stage minus the reserve", () => {
    // iPhone 17, measured on the simulator: stage 710.
    expect(heroOpeningMinHeight(710, 874, pillsReserve(28, false))).toBe(518);
  });

  it("estimates from the window before the first layout", () => {
    expect(heroOpeningMinHeight(null, 874, 184)).toBe(Math.round(874 * 0.72) - 184);
  });

  it("never goes negative on a tiny window", () => {
    expect(heroOpeningMinHeight(60, 300, 184)).toBe(0);
  });
});

describe("photo card height left across devices", () => {
  // [name, measured-style stage height, window height]. The iPhone 17 stage
  // (710) was measured on the simulator: window − safe-top 62 − header 68 −
  // safe-bottom 34. The rest apply the same chrome to each device's safe
  // areas; iPad has a smaller top inset and a home-indicator bar.
  const DEVICES: [string, number, number][] = [
    ["iPhone SE (375x667)", 667 - 20 - 68, 667],
    ["iPhone 16e / 17e (390x844)", 844 - 47 - 68 - 34, 844],
    ["iPhone 17 (402x874)", 710, 874],
    ["iPhone 17 Pro Max (440x956)", 956 - 62 - 68 - 34, 956],
    ["iPad mini portrait (744x1133)", 1133 - 24 - 68 - 20, 1133],
    ["iPad Pro 13 portrait (1032x1376)", 1376 - 24 - 68 - 20, 1376],
    ["iPad Pro 13 landscape (1376x1032)", 1032 - 24 - 68 - 20, 1032],
  ];
  const reserve = pillsReserve(28, false);

  it.each(DEVICES)("%s leaves the photo at least its floor", (_n, stage, win) => {
    const opening = heroOpeningMinHeight(stage, win, reserve);
    const photo = heroPhotoHeight(opening, ROLE_ROW_ESTIMATE, LEDGER_ESTIMATE);
    expect(opening).toBeGreaterThan(0);
    expect(photo).toBeGreaterThanOrEqual(HERO_FLOOR);
    expect(photo).toBeLessThanOrEqual(HERO_MAX);
  });

  it("gives larger phones a taller photo than smaller ones", () => {
    const se = heroOpeningMinHeight(667 - 20 - 68, 667, reserve);
    const pro = heroOpeningMinHeight(956 - 62 - 68 - 34, 956, reserve);
    expect(pro).toBeGreaterThan(se);
  });

  it("leaves less room when the pills stack at accessibility sizes", () => {
    const normal = heroOpeningMinHeight(695, 844, pillsReserve(28, false));
    const stacked = heroOpeningMinHeight(695, 844, pillsReserve(28, true));
    expect(normal - stacked).toBe(52);
  });
});

describe("heroPhotoHeight", () => {
  it("is what the opening has left after padding, role row and ledger", () => {
    // iPhone 17: opening 518 → 518 − 8 − 89 − 137 = 284.
    expect(heroPhotoHeight(518, 89, 137)).toBe(284);
    expect(HERO_WRAP_PADDING_TOP).toBe(8);
  });

  it("never drops below the floor, however little room there is", () => {
    expect(heroPhotoHeight(300, 89, 137)).toBe(HERO_MIN);
    expect(heroPhotoHeight(0, 89, 137)).toBe(HERO_MIN);
  });

  it("never exceeds the cap on a tall iPad stage", () => {
    expect(heroPhotoHeight(1500, 89, 137)).toBe(HERO_MAX);
  });

  it("shrinks when the ledger or role row grows at larger text", () => {
    expect(heroPhotoHeight(526, 89, 137)).toBeGreaterThan(
      heroPhotoHeight(526, 110, 190),
    );
  });

  it("uses all the room when there is no role row", () => {
    expect(heroPhotoHeight(526, 0, 137)).toBe(526 - 8 - 137);
  });
});
