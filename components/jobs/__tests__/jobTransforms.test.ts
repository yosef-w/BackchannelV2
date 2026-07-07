import type { BrowseJobResponse } from "@/types/jobs";
import type { MyJobRow } from "@/lib/api";
import {
    cleanJobText,
    extractDisplayDomain,
    formatExperienceLevel,
    parseSkillsField,
    transformBrowseResponse,
    transformMyJobRow,
} from "../jobTransforms";

describe("extractDisplayDomain", () => {
  it("extracts the host, subdomain and all, from a full URL", () => {
    expect(
      extractDisplayDomain(
        "https://careers.snowflake.com/us/en/job/SNC123/Software-Engineer",
      ),
    ).toBe("careers.snowflake.com");
  });

  it("strips a leading www.", () => {
    expect(extractDisplayDomain("https://www.example.com/jobs/1")).toBe(
      "example.com",
    );
  });

  it("tolerates a URL with no scheme", () => {
    expect(extractDisplayDomain("jobs.acme.com/role/123")).toBe(
      "jobs.acme.com",
    );
  });

  it("ignores query params and fragments", () => {
    expect(
      extractDisplayDomain(
        "https://careers.snowflake.com/job?utm_campaign=google_jobs_apply",
      ),
    ).toBe("careers.snowflake.com");
  });

  it("returns empty string for null/undefined/empty input", () => {
    expect(extractDisplayDomain(null)).toBe("");
    expect(extractDisplayDomain(undefined)).toBe("");
    expect(extractDisplayDomain("")).toBe("");
  });

  it("returns empty string for unparseable input", () => {
    expect(extractDisplayDomain("not a url at all")).toBe("");
  });
});

describe("parseSkillsField", () => {
  it("parses JSON array strings", () => {
    expect(parseSkillsField('["React", "TypeScript"]')).toEqual([
      "React",
      "TypeScript",
    ]);
  });

  it("parses comma-separated strings", () => {
    expect(parseSkillsField("React, TypeScript , SQL")).toEqual([
      "React",
      "TypeScript",
      "SQL",
    ]);
  });

  it("coerces non-string JSON entries and drops empties", () => {
    expect(parseSkillsField('[1, "SQL", ""]')).toEqual(["1", "SQL"]);
    expect(parseSkillsField("a,,b")).toEqual(["a", "b"]);
  });

  it("falls back to comma-splitting when the bracket string is malformed JSON", () => {
    expect(parseSkillsField("[not json")).toEqual(["[not json"]);
  });

  it("returns [] for null/undefined/empty", () => {
    expect(parseSkillsField(null)).toEqual([]);
    expect(parseSkillsField(undefined)).toEqual([]);
    expect(parseSkillsField("")).toEqual([]);
  });
});

describe("cleanJobText", () => {
  it("converts breaks and block-element closers to newlines", () => {
    expect(cleanJobText("line one<br/>line two")).toBe("line one\nline two");
    expect(cleanJobText("<p>para one</p><p>para two</p>")).toBe(
      "para one\npara two",
    );
  });

  it("turns list items into dashes", () => {
    expect(cleanJobText("<ul><li>first</li><li>second</li></ul>")).toBe(
      "- first\n- second",
    );
  });

  it("strips remaining tags and decodes common entities", () => {
    expect(cleanJobText("<b>R&amp;D</b> &nbsp; team")).toBe("R&D team");
    expect(cleanJobText("&lt;script&gt;")).toBe("<script>");
    expect(cleanJobText("it&#39;s &quot;fine&quot;")).toBe('it\'s "fine"');
  });

  it("collapses per-line whitespace and drops blank lines", () => {
    expect(cleanJobText("a   b\n\n\n  c  ")).toBe("a b\nc");
  });

  it("returns empty string for null/undefined", () => {
    expect(cleanJobText(null)).toBe("");
    expect(cleanJobText(undefined)).toBe("");
  });
});

describe("formatExperienceLevel", () => {
  it("maps the SILVER_JOBS numeric ranges to labels", () => {
    expect(formatExperienceLevel("0-2")).toBe("Entry Level (0–2 yrs)");
    expect(formatExperienceLevel("2-5")).toBe("Mid-Level (2–5 yrs)");
    expect(formatExperienceLevel("5+")).toBe("Senior (5+ yrs)");
  });

  it("passes through already-human-readable values", () => {
    expect(formatExperienceLevel("Senior")).toBe("Senior");
    expect(formatExperienceLevel("Mid-Level (2–5 yrs)")).toBe(
      "Mid-Level (2–5 yrs)",
    );
  });

  it("returns empty for null/empty/'null' strings", () => {
    expect(formatExperienceLevel(null)).toBe("");
    expect(formatExperienceLevel("")).toBe("");
    expect(formatExperienceLevel("NULL")).toBe("");
  });

  it("passes through unknown numeric ranges unchanged", () => {
    expect(formatExperienceLevel("10+")).toBe("10+");
  });
});

// A realistic SILVER_JOBS browse row, matching the uppercase column names
// the Postgres adapter returns.
const browseRow: BrowseJobResponse = {
  JOB_ID: "job-123",
  TITLE: "Senior Engineer",
  ORGANIZATION: "Acme",
  FULL_LOCATION: "New York, NY",
  EMPLOYMENT_TYPES: "['FULL_TIME']",
  SALARY_ANNUAL_MIN: 150000,
  SALARY_ANNUAL_MAX: 190000,
  SALARY_CURRENCY: "USD",
  DATE_POSTED: "2026-06-01T00:00:00Z",
  DESCRIPTION_TEXT: "<p>Build things</p>",
  SKILLS: '["React", "SQL"]',
  EXPERIENCE_LEVEL: "5+",
  IS_REMOTE: true,
  ORGANIZATION_LOGO: "https://logo.dev/acme.png",
} as BrowseJobResponse;

describe("transformBrowseResponse", () => {
  it("maps a SILVER_JOBS row into the UI Job shape", () => {
    const [job] = transformBrowseResponse([browseRow], []);
    expect(job.id).toBe("job-123");
    expect(job.title).toBe("Senior Engineer");
    expect(job.company).toBe("Acme");
    expect(job.salary).toBe("$150k - $190k");
    expect(job.skills).toEqual(["React", "SQL"]);
    expect(job.experienceLevel).toBe("Senior (5+ yrs)");
    expect(job.workArrangement).toBe("Remote");
    expect(job.description).toBe("Build things");
    expect(job.image).toBe("https://logo.dev/acme.png");
    expect(job.isSponsored).toBe(false);
  });

  it("marks jobs the sponsor already sponsors via atsJobId", () => {
    const [job] = transformBrowseResponse(
      [browseRow],
      [{ atsJobId: "job-123" }],
    );
    expect(job.isSponsored).toBe(true);
  });

  it("shows 'Competitive' when no salary bounds exist", () => {
    const row = {
      ...browseRow,
      SALARY_ANNUAL_MIN: null,
      SALARY_ANNUAL_MAX: null,
    } as BrowseJobResponse;
    const [job] = transformBrowseResponse([row], []);
    expect(job.salary).toBe("Competitive");
  });

  it("falls back to the placeholder image when no logo", () => {
    const row = {
      ...browseRow,
      ORGANIZATION_LOGO: null,
    } as unknown as BrowseJobResponse;
    const [job] = transformBrowseResponse([row], []);
    expect(job.image).toMatch(/^https:\/\/images\.unsplash\.com/);
  });
});

// A realistic GET /api/jobs/mine/ row.
const myJobRow: MyJobRow = {
  JOB_ID: "posting-9",
  TITLE: "Product Designer",
  COMPANY: "Acme",
  LOCATION: "Austin, TX",
  EMPLOYMENT_TYPE: "FULL_TIME",
  SALARY_MIN: 100000,
  SALARY_MAX: 130000,
  SALARY_CURRENCY: "USD",
  CREATED_AT: "2026-05-20T00:00:00Z",
  DESCRIPTION: "<b>Design</b> the future",
  REQUIREMENTS: "Figma, Prototyping",
  EXPERIENCE_LEVEL: "2-5",
  REMOTE_OPTION: false,
  LIKES_COUNT: 4,
  PENDING_LIKES_COUNT: 2,
  LOGO_URL: null,
} as unknown as MyJobRow;

describe("transformMyJobRow", () => {
  it("maps a mine-row into the UI Job shape with counts", () => {
    const job = transformMyJobRow(myJobRow);
    expect(job.id).toBe("posting-9");
    expect(job.salary).toBe("$100k - $130k");
    expect(job.applicants).toBe(4);
    expect(job.pendingApplicants).toBe(2);
    expect(job.workArrangement).toBe("On-site");
    expect(job.description).toBe("Design the future");
    expect(job.skills).toEqual(["Figma", "Prototyping"]);
    expect(job.isSponsored).toBe(true);
  });

  it("defaults pendingApplicants to 0 when the column is absent", () => {
    // The drift bug this transform was deduplicated to fix: initMyJobs's
    // copy dropped PENDING_LIKES_COUNT and the "N new" badge read wrong.
    const row = {
      ...myJobRow,
      PENDING_LIKES_COUNT: undefined,
      LIKES_COUNT: undefined,
    } as unknown as MyJobRow;
    const job = transformMyJobRow(row);
    expect(job.pendingApplicants).toBe(0);
    expect(job.applicants).toBe(0);
  });

  it("shows 'Competitive' when either salary bound is missing", () => {
    const row = { ...myJobRow, SALARY_MAX: null } as unknown as MyJobRow;
    expect(transformMyJobRow(row).salary).toBe("Competitive");
  });
});
