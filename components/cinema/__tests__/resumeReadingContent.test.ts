import {
  buildReadingRows,
  pickResumeLines,
} from "../resumeReadingContent";

describe("pickResumeLines", () => {
  const SAMPLE = [
    "JANE DOE",
    "jane@example.com | (555) 123-4567",
    "https://linkedin.com/in/janedoe",
    "EXPERIENCE",
    "Led a team of nine engineers through a full replatform.",
    "• Cut customer onboarding time from six weeks to two.",
    "Shipped the mobile checkout redesign ahead of schedule.",
    "EDUCATION",
    "Mentored four junior engineers into senior roles.",
    "BS",
  ].join("\n");

  it("picks presentable prose lines and strips bullets", () => {
    const lines = pickResumeLines(SAMPLE);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) {
      expect(line).not.toMatch(/^•/);
      expect(line).not.toMatch(/@|linkedin|https?:/i);
    }
  });

  it("rejects headers, contact rows, and short fragments", () => {
    const lines = pickResumeLines(SAMPLE);
    expect(lines).not.toContain("JANE DOE");
    expect(lines).not.toContain("EXPERIENCE");
    expect(lines).not.toContain("BS");
    expect(lines.join(" ")).not.toMatch(/555/);
  });

  it("spreads picks across the document", () => {
    const lines = pickResumeLines(SAMPLE);
    // First acceptable line always leads the skim.
    expect(lines[0]).toBe(
      "Led a team of nine engineers through a full replatform.",
    );
  });

  it("clips very long lines with an ellipsis", () => {
    // 65–90 chars: passes the length filter but exceeds the display clip.
    const long =
      "Delivered the migration across seven teams without a single day of downtime";
    const lines = pickResumeLines(long);
    expect(lines[0].length).toBeLessThanOrEqual(64);
    expect(lines[0].endsWith("…")).toBe(true);
  });

  it("returns empty for null, empty, or unusable text", () => {
    expect(pickResumeLines(null)).toEqual([]);
    expect(pickResumeLines("")).toEqual([]);
    expect(pickResumeLines("SHORT\nALL CAPS HEADER LINE HERE")).toEqual([]);
  });
});

describe("buildReadingRows", () => {
  const EXPERIENCES = [
    {
      jobTitle: "Product Designer",
      company: "Acme",
      startDate: "2020-01-01",
      endDate: "",
      current: true,
    },
  ];

  it("mirrors the deck card ledger when data is rich", () => {
    const rows = buildReadingRows({
      experiences: EXPERIENCES,
      skills: ["Systems thinking", "Prototyping", "Research"],
      achievements: "Calm under fire",
    });
    expect(rows.map((r) => r.label)).toEqual([
      "EXPERIENCE",
      "SHARPEST AT",
      "KNOWN FOR",
    ]);
    expect(rows[1].value).toBe("Systems thinking · Prototyping");
  });

  it("falls back to role and industry on a sparse classify", () => {
    const rows = buildReadingRows({
      currentRole: "Software Engineer",
      industry: "Technology",
    });
    expect(rows.map((r) => r.label)).toEqual(["ROLE", "INDUSTRY"]);
  });

  it("caps at three rows", () => {
    const rows = buildReadingRows({
      experiences: EXPERIENCES,
      skills: ["A", "B"],
      achievements: "Something notable",
      currentRole: "Engineer",
      industry: "Tech",
    });
    expect(rows).toHaveLength(3);
  });

  it("clips long values to a single displayable line", () => {
    const rows = buildReadingRows({
      achievements:
        "Won the international grand championship of extremely long sentences three years running",
    });
    expect(rows[0].value.length).toBeLessThanOrEqual(40);
    expect(rows[0].value.endsWith("…")).toBe(true);
  });

  it("returns empty when nothing is available", () => {
    expect(buildReadingRows({})).toEqual([]);
  });
});
