/**
 * The daily deck reminder is a bounded rolling window, not a forever-repeating
 * trigger (lapsed users must go quiet). The window rule is pure, so it's
 * pinned here.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-notifications", () => ({}));

import {
  DAILY_DECK_WINDOW_DAYS,
  nextDeckReminderDates,
} from "../localNotifications";

describe("nextDeckReminderDates", () => {
  it("starts today when 9:00 hasn't happened yet", () => {
    const now = new Date(2026, 8, 26, 7, 30); // 7:30am
    const [first] = nextDeckReminderDates(now);
    expect(first.getDate()).toBe(26);
    expect(first.getHours()).toBe(9);
    expect(first.getMinutes()).toBe(0);
  });

  it("starts tomorrow once 9:00 has passed", () => {
    const now = new Date(2026, 8, 26, 9, 1);
    expect(nextDeckReminderDates(now)[0].getDate()).toBe(27);
  });

  it("is exactly the window length, on consecutive days", () => {
    const dates = nextDeckReminderDates(new Date(2026, 8, 26, 12, 0));
    expect(dates).toHaveLength(DAILY_DECK_WINDOW_DAYS);
    dates.slice(1).forEach((d, i) => {
      const gapDays = Math.round((d.getTime() - dates[i].getTime()) / 86400000);
      expect(gapDays).toBe(1);
    });
  });

  it("is bounded: nothing is scheduled past the window", () => {
    const now = new Date(2026, 8, 26, 12, 0);
    const last = nextDeckReminderDates(now).at(-1)!;
    const daysOut = (last.getTime() - now.getTime()) / 86400000;
    expect(daysOut).toBeLessThan(DAILY_DECK_WINDOW_DAYS + 1);
  });

  it("crosses a month boundary correctly", () => {
    const dates = nextDeckReminderDates(new Date(2026, 8, 29, 12, 0)); // Sep 29
    expect(dates.map((d) => d.getDate())).toEqual([30, 1, 2, 3, 4, 5, 6]);
  });
});
