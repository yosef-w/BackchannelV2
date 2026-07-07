import { getRelativeTime } from "../relativeTime";

// getRelativeTime is pure date math against Date.now() — pin the clock so
// every assertion is deterministic.
describe("getRelativeTime", () => {
  const NOW = new Date("2026-07-07T12:00:00Z");

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const daysAgo = (d: number) =>
    new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  it("returns empty string for empty or unparseable input", () => {
    expect(getRelativeTime("")).toBe("");
    expect(getRelativeTime("not-a-date")).toBe("");
  });

  it("returns 'Today' for same-day timestamps", () => {
    expect(getRelativeTime(NOW.toISOString())).toBe("Today");
    expect(getRelativeTime(daysAgo(0.5))).toBe("Today");
  });

  it("returns 'Today' (not a negative value) for future timestamps / clock skew", () => {
    expect(getRelativeTime(daysAgo(-1))).toBe("Today");
  });

  it("returns 'Yesterday' at exactly one day", () => {
    expect(getRelativeTime(daysAgo(1))).toBe("Yesterday");
  });

  it("formats 2-6 days as 'Nd ago'", () => {
    expect(getRelativeTime(daysAgo(2))).toBe("2d ago");
    expect(getRelativeTime(daysAgo(6))).toBe("6d ago");
  });

  it("formats 1-4 weeks as 'Nw ago'", () => {
    expect(getRelativeTime(daysAgo(7))).toBe("1w ago");
    expect(getRelativeTime(daysAgo(34))).toBe("4w ago");
  });

  it("formats 5+ weeks as months", () => {
    expect(getRelativeTime(daysAgo(35))).toBe("1mo ago");
    expect(getRelativeTime(daysAgo(90))).toBe("3mo ago");
  });

  it("treats timezone-less backend strings as UTC (no negative diffs)", () => {
    // "2026-07-07T10:00:00" (no Z) — two hours before the pinned NOW in UTC.
    // Without normalization a user in a UTC+3 zone would parse this as local
    // time and see a future date; the function must still say "Today".
    expect(getRelativeTime("2026-07-07T10:00:00")).toBe("Today");
    // A tz-less string from yesterday stays "Yesterday" regardless of zone.
    expect(getRelativeTime("2026-07-06T10:00:00")).toBe("Yesterday");
  });

  it("respects explicit timezone offsets when present", () => {
    // 12:00+02:00 === 10:00Z — same day as NOW.
    expect(getRelativeTime("2026-07-07T12:00:00+02:00")).toBe("Today");
  });
});
