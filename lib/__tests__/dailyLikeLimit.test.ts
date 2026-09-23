/**
 * Contract tests for the persistent daily-like-cap counter.
 *
 * The whole reason this exists as its own persisted counter (rather than
 * reusing useJobsStore's in-memory `sessionLikes`) is that `sessionLikes`
 * resets on both "Review again" AND a successful premium purchase
 * (resetNavigation) — a cap built on it could be reset by the user just by
 * tapping either of those. These tests cover the two properties that
 * actually matter: the count persists across calls, and it rolls over at
 * the calendar-day boundary rather than accumulating forever or resetting
 * mid-day.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDailyLikesUsed,
  incrementDailyLikesUsed,
} from "../dailyLikeLimit";

describe("getDailyLikesUsed", () => {
  beforeEach(async () => {
    // The async-storage jest mock persists across tests within a file
    // otherwise — each test needs a clean slate.
    await AsyncStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-23T12:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at 0 with nothing recorded yet", async () => {
    expect(await getDailyLikesUsed("applicant")).toBe(0);
  });

  it("reflects likes recorded earlier the same day", async () => {
    await incrementDailyLikesUsed("applicant");
    await incrementDailyLikesUsed("applicant");
    expect(await getDailyLikesUsed("applicant")).toBe(2);
  });

  it("keeps applicant and sponsor counts independent", async () => {
    await incrementDailyLikesUsed("applicant");
    await incrementDailyLikesUsed("sponsor");
    await incrementDailyLikesUsed("sponsor");
    expect(await getDailyLikesUsed("applicant")).toBe(1);
    expect(await getDailyLikesUsed("sponsor")).toBe(2);
  });

  it("rolls over to 0 on a new calendar day, not a stale carry-over", async () => {
    await incrementDailyLikesUsed("applicant");
    await incrementDailyLikesUsed("applicant");
    expect(await getDailyLikesUsed("applicant")).toBe(2);

    // Cross midnight into the next day.
    jest.setSystemTime(new Date("2026-09-24T00:05:00"));
    expect(await getDailyLikesUsed("applicant")).toBe(0);
  });

  it("increment after a day rollover starts back at 1, not 3", async () => {
    await incrementDailyLikesUsed("applicant");
    await incrementDailyLikesUsed("applicant");

    jest.setSystemTime(new Date("2026-09-24T00:05:00"));
    const next = await incrementDailyLikesUsed("applicant");
    expect(next).toBe(1);
    expect(await getDailyLikesUsed("applicant")).toBe(1);
  });

  it("does not roll over just from crossing into a new hour the same day", async () => {
    await incrementDailyLikesUsed("applicant");
    jest.setSystemTime(new Date("2026-09-23T23:59:00"));
    expect(await getDailyLikesUsed("applicant")).toBe(1);
  });
});
