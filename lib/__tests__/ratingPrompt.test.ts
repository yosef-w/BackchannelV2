/**
 * The eligibility rule is the part that protects users from a nagging app
 * (and protects the app's scarce iOS review-prompt quota from being burned
 * on a bad moment), so it's pinned here as a pure function.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  MAX_LIFETIME_PROMPTS,
  MIN_DAYS_BETWEEN_PROMPTS,
  MIN_DAYS_SINCE_INSTALL,
  shouldPromptForRating,
} from "../ratingPrompt";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-01T12:00:00Z");
const fresh = { lastPromptedAt: null, promptCount: 0 };

describe("shouldPromptForRating", () => {
  it("never asks when the install age is unknown", () => {
    expect(shouldPromptForRating(fresh, null, NOW)).toBe(false);
  });

  it("doesn't ask a brand-new install", () => {
    const firstSeen = NOW - (MIN_DAYS_SINCE_INSTALL - 1) * DAY;
    expect(shouldPromptForRating(fresh, firstSeen, NOW)).toBe(false);
  });

  it("asks once the install is old enough and never prompted", () => {
    const firstSeen = NOW - MIN_DAYS_SINCE_INSTALL * DAY;
    expect(shouldPromptForRating(fresh, firstSeen, NOW)).toBe(true);
  });

  it("waits out the cooldown after a prompt", () => {
    const firstSeen = NOW - 400 * DAY;
    const state = {
      lastPromptedAt: NOW - (MIN_DAYS_BETWEEN_PROMPTS - 1) * DAY,
      promptCount: 1,
    };
    expect(shouldPromptForRating(state, firstSeen, NOW)).toBe(false);
  });

  it("asks again after the cooldown", () => {
    const firstSeen = NOW - 400 * DAY;
    const state = {
      lastPromptedAt: NOW - MIN_DAYS_BETWEEN_PROMPTS * DAY,
      promptCount: 1,
    };
    expect(shouldPromptForRating(state, firstSeen, NOW)).toBe(true);
  });

  it("stops for good at the lifetime cap", () => {
    const firstSeen = NOW - 2000 * DAY;
    const state = {
      lastPromptedAt: NOW - 1000 * DAY,
      promptCount: MAX_LIFETIME_PROMPTS,
    };
    expect(shouldPromptForRating(state, firstSeen, NOW)).toBe(false);
  });
});
