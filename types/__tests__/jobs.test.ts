import {
    formatPostedDate,
    formatSalary,
    parseEmploymentType,
    parseHighlights,
    parseLocations,
    parseSkills,
} from "../jobs";

// parseLocations / parseSkills / parseHighlights share one implementation:
// JSON.parse after swapping single quotes for double (the backend emits
// Python-style list strings like "['a', 'b']").
describe("JSON-ish array parsers", () => {
  it("parses double-quoted JSON arrays", () => {
    expect(parseLocations('["NYC", "Remote"]')).toEqual(["NYC", "Remote"]);
    expect(parseSkills('["React", "SQL"]')).toEqual(["React", "SQL"]);
    expect(parseHighlights('["Equity"]')).toEqual(["Equity"]);
  });

  it("parses Python-style single-quoted list strings", () => {
    expect(parseLocations("['San Francisco', 'Austin']")).toEqual([
      "San Francisco",
      "Austin",
    ]);
  });

  it("returns [] for malformed input or non-arrays", () => {
    expect(parseLocations("not json")).toEqual([]);
    expect(parseSkills('{"a": 1}')).toEqual([]);
    expect(parseHighlights("")).toEqual([]);
  });
});

describe("parseEmploymentType", () => {
  it("defaults to Full-time for null/empty", () => {
    expect(parseEmploymentType(null)).toBe("Full-time");
    expect(parseEmploymentType("")).toBe("Full-time");
  });

  it("converts SNAKE_CASE array strings to Title-case", () => {
    expect(parseEmploymentType("['FULL_TIME']")).toBe("Full-Time");
    expect(parseEmploymentType('["PART_TIME"]')).toBe("Part-Time");
  });

  it("handles bare (non-array) values", () => {
    expect(parseEmploymentType("CONTRACT")).toBe("Contract");
    expect(parseEmploymentType("FULL_TIME")).toBe("Full-Time");
  });

  it("takes the first entry of a multi-value array", () => {
    expect(parseEmploymentType("['FULL_TIME', 'CONTRACT']")).toBe(
      "Full-Time",
    );
  });
});

describe("formatSalary", () => {
  it("formats a full range in thousands", () => {
    expect(formatSalary(90000, 120000, "USD")).toBe("$90k - $120k");
  });

  it("formats min-only as a floor and max-only as a ceiling", () => {
    expect(formatSalary(150000, null, "USD")).toBe("$150k+");
    expect(formatSalary(null, 80000, "USD")).toBe("Up to $80k");
  });

  it("falls back when neither bound is present", () => {
    expect(formatSalary(null, null, "USD")).toBe("Salary not specified");
  });

  it("uses the raw currency code for non-USD and empty for null currency", () => {
    expect(formatSalary(90000, 120000, "EUR")).toBe("EUR90k - EUR120k");
    expect(formatSalary(90000, 120000, null)).toBe("90k - 120k");
  });
});

describe("formatPostedDate", () => {
  const NOW = new Date("2026-07-07T12:00:00Z");

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const hoursAgo = (h: number) =>
    new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();

  it("formats the recency ladder: just now -> hours -> days -> weeks", () => {
    expect(formatPostedDate(hoursAgo(0.5))).toBe("Just now");
    expect(formatPostedDate(hoursAgo(5))).toBe("5h ago");
    expect(formatPostedDate(hoursAgo(3 * 24))).toBe("3d ago");
    expect(formatPostedDate(hoursAgo(14 * 24))).toBe("2w ago");
  });

  it("falls back to a short date past 30 days", () => {
    expect(formatPostedDate("2026-01-15T12:00:00Z")).toMatch(/Jan 15/);
  });
});
