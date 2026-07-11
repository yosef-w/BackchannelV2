/**
 * Contract tests for the check-in session logic shared by both role sheets:
 * stale-first ordering, wrap-around pending-card search (skipped cards come
 * back around), and the recap summary.
 */
import {
  STALE_MS,
  isStale,
  nextPendingIndex,
  sortStaleFirst,
  summarize,
  type SessionResults,
} from "../checkInSession";

const NOW = Date.parse("2026-07-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const ref = (id: string, createdDaysAgo: number) => ({
  referralId: id,
  createdAt: new Date(NOW - createdDaysAgo * DAY).toISOString(),
});

describe("isStale", () => {
  it("stale when 7+ days old with no recent check-in", () => {
    expect(isStale(ref("a", 8), {}, NOW)).toBe(true);
  });

  it("fresh referrals are never stale", () => {
    expect(isStale(ref("a", 3), {}, NOW)).toBe(false);
  });

  it("a recent check-in clears staleness", () => {
    const times = { a: new Date(NOW - 1 * DAY).toISOString() };
    expect(isStale(ref("a", 20), times, NOW)).toBe(false);
  });

  it("an old check-in does not", () => {
    const times = { a: new Date(NOW - STALE_MS - DAY).toISOString() };
    expect(isStale(ref("a", 20), times, NOW)).toBe(true);
  });
});

describe("sortStaleFirst", () => {
  it("stale referrals lead, oldest first within each group", () => {
    const items = [ref("fresh-new", 1), ref("stale-old", 20), ref("stale-newer", 9), ref("fresh-old", 5)];
    const order = sortStaleFirst(items, {}, NOW).map((r) => r.referralId);
    expect(order).toEqual(["stale-old", "stale-newer", "fresh-old", "fresh-new"]);
  });

  it("does not mutate the input", () => {
    const items = [ref("b", 1), ref("a", 20)];
    sortStaleFirst(items, {}, NOW);
    expect(items[0].referralId).toBe("b");
  });
});

describe("nextPendingIndex", () => {
  const ids = ["a", "b", "c", "d"];

  it("advances to the next unhandled card", () => {
    const results: SessionResults = { a: { kind: "updated", stageIndex: 1, terminal: false } };
    expect(nextPendingIndex(ids, results, 0)).toBe(1);
  });

  it("wraps around so skipped cards come back at the end of the pass", () => {
    const results: SessionResults = {
      b: { kind: "skipped" },
      c: { kind: "updated", stageIndex: 0, terminal: false },
      d: { kind: "updated", stageIndex: 2, terminal: false },
    };
    // From the last card, the only pending one is "a" at the start.
    expect(nextPendingIndex(ids, results, 3)).toBe(0);
  });

  it("returns null when every card is handled", () => {
    const results: SessionResults = {
      a: { kind: "updated", stageIndex: 0, terminal: false },
      b: { kind: "skipped" },
      c: { kind: "skipped" },
      d: { kind: "updated", stageIndex: 5, terminal: false },
    };
    expect(nextPendingIndex(ids, results, 1)).toBeNull();
  });
});

describe("summarize", () => {
  it("counts updated vs skipped against the total", () => {
    const results: SessionResults = {
      a: { kind: "updated", stageIndex: 0, terminal: false },
      b: { kind: "skipped" },
    };
    expect(summarize(["a", "b", "c"], results)).toEqual({
      updated: 1,
      skipped: 1,
      total: 3,
    });
  });
});
