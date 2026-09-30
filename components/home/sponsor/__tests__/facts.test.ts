import type { PublicProfileExperience } from "@/lib/api";
import type { Job } from "@/types/jobs";
import type {
  EnrichedApplicantProfile,
  ProfileDeckCard,
} from "@/types/profiles";
import {
  buildApplicantFacts,
  buildExperienceGroups,
  buildFitSummary,
  buildRoleContext,
  fitHeadline,
  formatCompRange,
  formatDateRange,
  formatDuration,
  heroStats,
  numberWord,
  parseAchievements,
  parseExperienceRequirement,
  parseMonthYear,
  parseStringList,
  relativeAgo,
  roleSubline,
  statsCardCells,
  summarizeBio,
} from "../facts";
import type { ApplicantFacts, RoleContext } from "../model";

// Fixed clock: 20 Aug 2026, local time.
const NOW = new Date(2026, 7, 20, 12, 0, 0);

const exp = (o: Partial<PublicProfileExperience>): PublicProfileExperience => ({
  jobTitle: "",
  company: "",
  startDate: "",
  current: false,
  description: "",
  ...o,
});

const CARD: ProfileDeckCard = {
  id: "u1",
  USER_ID: "u1",
  name: "Amy Smith",
  location: "New York, NY",
  skills: ["Figma", "figma ", "Prototyping", "User research"],
  desiredRole: "Senior Product Designer",
  bio: "Looking for new opportunities",
  prompts: [
    { question: "What I'm known for", answer: "  Shipping calm products. " },
    { question: "Empty answer", answer: "  " },
    { question: "", answer: "Orphan answer" },
  ],
  image: "https://cdn.example.com/amy.jpg",
  company: "",
  HAS_LIKED_JOB: true,
  LIKED_AT: "2026-08-18T09:00:00Z",
};

const ENRICHED: EnrichedApplicantProfile = {
  experiences: [
    exp({ jobTitle: "Product Designer", company: "The New York Times", startDate: "Jun 2019", endDate: "Dec 2021" }),
    exp({ jobTitle: "Product Design Lead", company: "Capital One", startDate: "2025-01", current: true, employmentType: "Full-time" }),
    exp({ jobTitle: "Senior Product Designer", company: "the new york times ", startDate: "Jan 2022", endDate: "Dec 2024", location: "New York, NY" }),
  ],
  education: [
    { degree: "B.A.", major: "Digital Product Management", university: "NYU", graduationYear: "2019", startYear: "2015" },
    { degree: "", university: "RISD", graduationYear: "2020", activities: "Design club" },
    { degree: "Cert", university: "  " },
  ],
  certifications: [],
  languages: [],
  achievements: "• Rebuilt checkout. Lifted conversion 12%.\n- Led a team of six\n\n1. Won a Webby.",
  prompts: [],
  bio: "I design calm products. I've spent seven years in news and fintech, most recently leading design for Capital One's card servicing experience.",
  skills: [],
  workPreferences: ["remote", "Hybrid", "full time", "Something else"],
  targetComp: { min: 150000, max: 175000, currency: "USD" },
  startAvailability: "2 weeks",
  level: "Senior IC",
};

const ROLE: RoleContext = {
  jobId: "j1",
  title: "Staff Product Designer",
  company: "Snowflake",
  logoUrl: null,
  salaryMin: 160000,
  salaryMax: 190000,
  salaryCurrency: "USD",
  remote: true,
  experienceLevel: "Senior",
  employmentType: "Full-time",
  skills: ["Figma", "Prototyping", "Design systems", "User research", "SQL"],
};

const facts = (o: Partial<ApplicantFacts> = {}): ApplicantFacts => ({
  ...buildApplicantFacts({ ...CARD, name: "Amy Smith" }, null, NOW),
  years: null,
  workStyle: null,
  seeking: null,
  targetComp: null,
  startAvailability: null,
  level: null,
  skills: [],
  location: null,
  desiredRole: null,
  ...o,
});

describe("small helpers", () => {
  it("numberWord spells 0–10 and digits beyond", () => {
    expect(numberWord(1)).toBe("One");
    expect(numberWord(10)).toBe("Ten");
    expect(numberWord(11)).toBe("11");
  });

  it("parseStringList accepts arrays, JSON strings and comma strings", () => {
    expect(parseStringList(["Remote", " ", 3, "Hybrid"])).toEqual(["Remote", "Hybrid"]);
    expect(parseStringList('["Remote","Full-time"]')).toEqual(["Remote", "Full-time"]);
    expect(parseStringList("Remote, Hybrid")).toEqual(["Remote", "Hybrid"]);
    expect(parseStringList("[broken")).toEqual(["broken"]);
    expect(parseStringList(null)).toEqual([]);
  });

  it("summarizeBio extends a short first sentence and clips on a word", () => {
    expect(summarizeBio("Short one. Second sentence here. Third.")).toBe(
      "Short one. Second sentence here.",
    );
    const long = `${"word ".repeat(60)}end.`;
    const out = summarizeBio(long)!;
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
    expect(summarizeBio("")).toBeNull();
  });
});

describe("dates", () => {
  it("parseMonthYear handles common resume formats", () => {
    expect(parseMonthYear("Jan 2024")).toEqual({ year: 2024, month: 1 });
    expect(parseMonthYear("January 2024")).toEqual({ year: 2024, month: 1 });
    expect(parseMonthYear("2024-01")).toEqual({ year: 2024, month: 1 });
    expect(parseMonthYear("2024-01-15")).toEqual({ year: 2024, month: 1 });
    expect(parseMonthYear("01/2024")).toEqual({ year: 2024, month: 1 });
    expect(parseMonthYear("2019")).toEqual({ year: 2019, month: null });
    expect(parseMonthYear("Summer 2019")).toEqual({ year: 2019, month: null });
    expect(parseMonthYear("recently")).toBeNull();
    expect(parseMonthYear(undefined)).toBeNull();
  });

  it("formatDuration omits zero parts", () => {
    expect(formatDuration(22)).toBe("1 yr 10 mos");
    expect(formatDuration(12)).toBe("1 yr");
    expect(formatDuration(11)).toBe("11 mos");
    expect(formatDuration(1)).toBe("1 mo");
    expect(formatDuration(0)).toBeNull();
  });

  it("formatDateRange builds LinkedIn-style labels", () => {
    expect(formatDateRange(parseMonthYear("Jan 2024"), parseMonthYear("Oct 2025"), NOW)).toBe(
      "Jan 2024 - Oct 2025 · 1 yr 10 mos",
    );
    expect(formatDateRange(parseMonthYear("Oct 2025"), "present", NOW)).toBe(
      "Oct 2025 - Present · 11 mos",
    );
    expect(formatDateRange(parseMonthYear("2019"), parseMonthYear("2020"), NOW)).toBe(
      "2019 - 2020 · 1 yr",
    );
    expect(formatDateRange(null, null, NOW)).toBeNull();
  });

  it("relativeAgo steps days → weeks → a date", () => {
    const now = new Date(2026, 8, 29, 12);
    expect(relativeAgo(new Date(2026, 8, 29, 8).toISOString(), now)).toBe("Today");
    expect(relativeAgo(new Date(2026, 8, 28, 8).toISOString(), now)).toBe("1d ago");
    expect(relativeAgo(new Date(2026, 8, 27, 8).toISOString(), now)).toBe("2d ago");
    expect(relativeAgo(new Date(2026, 8, 8, 8).toISOString(), now)).toBe("3w ago");
    expect(relativeAgo(new Date(2026, 6, 31, 8).toISOString(), now)).toBe("Jul 31");
    expect(relativeAgo("not a date", now)).toBeNull();
    expect(relativeAgo(null, now)).toBeNull();
  });
});

describe("formatCompRange", () => {
  it("compacts same-magnitude ranges with an en dash", () => {
    expect(formatCompRange({ min: 150000, max: 175000, currency: "USD" })).toBe("$150–175K");
    expect(formatCompRange({ min: 900000, max: 1200000, currency: null })).toBe("$900K–1.2M");
    expect(formatCompRange({ min: 1000000, max: 1500000, currency: "USD" })).toBe("$1–1.5M");
  });
  it("handles open ends and currencies", () => {
    expect(formatCompRange({ min: 150000, max: null, currency: "USD" })).toBe("$150K+");
    expect(formatCompRange({ min: null, max: 175000, currency: "USD" })).toBe("Up to $175K");
    expect(formatCompRange({ min: 90000, max: 110000, currency: "EUR" })).toBe("€90–110K");
    expect(formatCompRange({ min: 90000, max: 110000, currency: "gbp" })).toBe("£90–110K");
    expect(formatCompRange({ min: 90000, max: 110000, currency: "CAD" })).toBe("CAD 90–110K");
  });
  it("is null without a positive bound", () => {
    expect(formatCompRange(null)).toBeNull();
    expect(formatCompRange({ min: 0, max: null, currency: "USD" })).toBeNull();
    expect(formatCompRange({ min: -5, max: NaN, currency: "USD" })).toBeNull();
  });
});

describe("buildExperienceGroups", () => {
  it("sorts newest-first and groups consecutive same-company roles", () => {
    const groups = buildExperienceGroups(ENRICHED.experiences, NOW);
    expect(groups.map((g) => g.company)).toEqual(["Capital One", "The New York Times"]);
    expect(groups[0].tenureLabel).toBeNull();
    expect(groups[0].roles[0]).toEqual({
      title: "Product Design Lead",
      employmentType: "Full-time",
      dateLabel: "Jan 2025 - Present · 1 yr 8 mos",
      location: null,
      description: null,
    });
    const nyt = groups[1];
    expect(nyt.roles.map((r) => r.title)).toEqual(["Senior Product Designer", "Product Designer"]);
    expect(nyt.roles[0].dateLabel).toBe("Jan 2022 - Dec 2024 · 3 yrs");
    expect(nyt.roles[0].location).toBe("New York, NY");
    // Jun 2019 → Dec 2024, inclusive.
    expect(nyt.tenureLabel).toBe("5 yrs 7 mos");
  });

  it("does not merge non-consecutive stints", () => {
    const groups = buildExperienceGroups(
      [
        exp({ jobTitle: "A1", company: "Acme", startDate: "2018" }),
        exp({ jobTitle: "B", company: "Beta", startDate: "2020" }),
        exp({ jobTitle: "A2", company: "Acme", startDate: "2022" }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.company)).toEqual(["Acme", "Beta", "Acme"]);
  });

  it("tolerates junk rows and missing dates", () => {
    const groups = buildExperienceGroups(
      [null as unknown as PublicProfileExperience, exp({}), exp({ jobTitle: "Designer", company: "X", startDate: "n/a" })],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].roles[0].dateLabel).toBeNull();
    expect(buildExperienceGroups(undefined, NOW)).toEqual([]);
  });
});

describe("parseAchievements", () => {
  it("splits bullets/newlines/numbered items into title + detail", () => {
    expect(parseAchievements(ENRICHED.achievements)).toEqual([
      { title: "Rebuilt checkout.", detail: "Lifted conversion 12%." },
      { title: "Led a team of six", detail: null },
      { title: "Won a Webby.", detail: null },
    ]);
  });
  it("treats one paragraph as one achievement", () => {
    expect(parseAchievements("Grew revenue 3x. Hired the team.")).toEqual([
      { title: "Grew revenue 3x.", detail: "Hired the team." },
    ]);
    expect(parseAchievements("")).toEqual([]);
    expect(parseAchievements(null)).toEqual([]);
  });
});

describe("buildApplicantFacts", () => {
  const a = buildApplicantFacts(CARD, ENRICHED, NOW);

  it("flattens card + enrichment", () => {
    expect(a.name).toBe("Amy Smith");
    expect(a.firstName).toBe("Amy");
    expect(a.photoUrl).toBe("https://cdn.example.com/amy.jpg");
    expect(a.location).toBe("New York, NY");
    expect(a.currentTitle).toBe("Product Design Lead");
    expect(a.currentCompany).toBe("Capital One");
    expect(a.desiredRole).toBe("Senior Product Designer");
    expect(a.bio).toMatch(/^I design calm products\./);
    expect(a.bioSummary).toMatch(/^I design calm products\. I've spent seven years/);
    expect(a.likedRole).toBe(true);
    expect(a.likedAt).toBe("2026-08-18T09:00:00.000Z");
    expect(a.years).toBe(7);
    expect(a.workStyle).toBe("Hybrid · Remote");
    expect(a.seeking).toBe("Full-time");
    expect(a.targetComp).toEqual({ min: 150000, max: 175000, currency: "USD" });
    expect(a.startAvailability).toBe("2 weeks");
    expect(a.level).toBe("Senior IC");
    expect(a.skills).toEqual(["Figma", "Prototyping", "User research"]);
    expect(a.education).toEqual([
      { school: "NYU", degree: "B.A. Digital Product Management", years: "2015 - 2019", detail: null, logoUrl: null },
      { school: "RISD", degree: null, years: "2020", detail: "Design club", logoUrl: null },
    ]);
    expect(a.achievements).toHaveLength(3);
    expect(a.prompts).toEqual([{ question: "What I'm known for", answer: "Shipping calm products." }]);
    expect(a.enriched).toBe(true);
  });

  it("drops transform defaults and missing data to null, never placeholders", () => {
    const thin = buildApplicantFacts(
      { ...CARD, desiredRole: "Open to opportunities", bio: "Looking for new opportunities", HAS_LIKED_JOB: undefined, LIKED_AT: "garbage", location: "" },
      null,
      NOW,
    );
    expect(thin.desiredRole).toBeNull();
    expect(thin.bio).toBeNull();
    expect(thin.bioSummary).toBeNull();
    expect(thin.likedRole).toBe(false);
    expect(thin.likedAt).toBeNull();
    expect(thin.location).toBeNull();
    expect(thin.years).toBeNull();
    expect(thin.targetComp).toBeNull();
    expect(thin.workStyle).toBeNull();
    expect(thin.experienceGroups).toEqual([]);
    expect(thin.enriched).toBe(false);
  });

  it("reads card-level fallbacks (JSON prefs, comp, liked-at aliases, yearsExperience, city/state)", () => {
    const f = buildApplicantFacts(
      {
        ...CARD,
        location: "",
        LIKED_AT: undefined,
        LIKE_CREATED_AT: "2026-08-01",
        WORK_PREFERENCES: '["On-site","Contract"]',
        TARGET_COMP_MIN: "120000",
        TARGET_COMP_MAX: null,
        TARGET_COMP_CURRENCY: "eur",
        SENIORITY_LEVEL: "Lead",
        START_AVAILABILITY: " Immediately ",
      },
      { ...ENRICHED, experiences: [], workPreferences: [], targetComp: null, level: null, startAvailability: null, yearsExperience: 4, city: "Dallas", state: "TX" },
      NOW,
    );
    expect(f.likedAt).toBe(new Date("2026-08-01").toISOString());
    expect(f.workStyle).toBe("On-site");
    expect(f.seeking).toBe("Contract");
    expect(f.targetComp).toEqual({ min: 120000, max: null, currency: "EUR" });
    expect(f.level).toBe("Lead");
    expect(f.startAvailability).toBe("Immediately");
    expect(f.years).toBe(4);
    expect(f.location).toBe("Dallas, TX");
  });

  it("zero targetComp bounds mean no comp", () => {
    const f = buildApplicantFacts(CARD, { ...ENRICHED, targetComp: { min: 0, max: 0, currency: "USD" } }, NOW);
    expect(f.targetComp).toBeNull();
  });
});

describe("buildRoleContext / roleSubline", () => {
  const job = {
    id: "j9",
    title: "Staff Designer",
    company: "Snowflake",
    salaryMin: 160000,
    salaryMax: 190000,
    salaryCurrency: "USD",
    isRemote: true,
    experienceLevel: "",
    type: "",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    skills: ["Figma", "figma", "Must have shipped a design system at scale across teams."],
  } as unknown as Job;

  it("normalizes a Job, nulling placeholder logos and empty strings", () => {
    const role = buildRoleContext(job, null)!;
    expect(role.logoUrl).toBeNull();
    expect(role.experienceLevel).toBeNull();
    expect(role.employmentType).toBeNull();
    expect(role.remote).toBe(true);
    expect(role.skills).toEqual(["Figma"]);
    expect(roleSubline(role)).toBe("Snowflake · $160–190K · Remote");
  });

  it("prefers job.logo, then a real image", () => {
    expect(buildRoleContext({ ...job, logo: "https://logo/x.png" } as Job, null)!.logoUrl).toBe("https://logo/x.png");
    expect(buildRoleContext({ ...job, image: "https://img.logo.dev/snowflake.com" } as Job, null)!.logoUrl).toBe(
      "https://img.logo.dev/snowflake.com",
    );
  });

  it("falls back to the lightweight id/title list", () => {
    const role = buildRoleContext(undefined, { jobId: "j2", title: "PM", company: "Acme" })!;
    expect(role).toMatchObject({ jobId: "j2", title: "PM", company: "Acme", remote: null, salaryMin: null, skills: [] });
    expect(roleSubline(role)).toBe("Acme");
    expect(buildRoleContext(null, null)).toBeNull();
  });
});

describe("parseExperienceRequirement", () => {
  it("parses explicit years and level words", () => {
    expect(parseExperienceRequirement("5+ years")).toEqual({ floor: 5, roleValue: "5+ yrs" });
    expect(parseExperienceRequirement("3-5 yrs")).toEqual({ floor: 3, roleValue: "3–5 yrs" });
    expect(parseExperienceRequirement("Senior (5+ yrs)")).toEqual({ floor: 5, roleValue: "5+ yrs" });
    expect(parseExperienceRequirement("5+")).toEqual({ floor: 5, roleValue: "5+ yrs" });
    expect(parseExperienceRequirement("Senior")).toEqual({ floor: 5, roleValue: "Senior" });
    expect(parseExperienceRequirement("Staff")).toEqual({ floor: 7, roleValue: "Staff" });
    expect(parseExperienceRequirement("Whatever")).toBeNull();
    expect(parseExperienceRequirement("")).toBeNull();
  });
});

describe("buildFitSummary", () => {
  it("builds rows in order where both sides have data", () => {
    const a = buildApplicantFacts(CARD, ENRICHED, NOW);
    const fit = buildFitSummary(a, ROLE);
    expect(fit.rows.map((r) => [r.key, r.applicantValue, r.roleValue, r.status])).toEqual([
      ["comp", "$150–175K", "$160–190K", "match"],
      ["workStyle", "Hybrid · Remote", "Remote", "match"],
      // "Senior" is ONE signal: scored as Level (the applicant states a
      // level), not also as Experience.
      ["level", "Senior IC", "Senior", "match"],
      ["skills", "3 of 5", "5 listed", "match"],
    ]);
    expect(fit.matched).toBe(4);
    expect(fit.total).toBe(4);
    expect(fit.strength).toBe("strong");
    expect(fit.headline).toBe("All four line up with what you posted.");
    expect(fit.stretchNote).toBeNull();
    // start never renders — roles have no start date yet
    expect(fit.rows.find((r) => r.key === "start")).toBeUndefined();
  });

  it("comp: gap only when the applicant's floor exceeds the role ceiling", () => {
    const role = { ...ROLE, remote: null, experienceLevel: null, skills: [] };
    expect(buildFitSummary(facts({ targetComp: { min: 200000, max: 250000, currency: "USD" } }), role).rows[0].status).toBe("gap");
    expect(buildFitSummary(facts({ targetComp: { min: 90000, max: 120000, currency: "USD" } }), role).rows[0].status).toBe("match");
    // different currencies are never compared
    expect(buildFitSummary(facts({ targetComp: { min: 90000, max: 120000, currency: "EUR" } }), role).rows).toEqual([]);
  });

  it("workStyle rules", () => {
    const base = { ...ROLE, salaryMin: null, salaryMax: null, experienceLevel: null, skills: [] };
    expect(buildFitSummary(facts({ workStyle: "Hybrid" }), { ...base, remote: true }).rows[0].status).toBe("gap");
    expect(buildFitSummary(facts({ workStyle: "Hybrid" }), { ...base, remote: false }).rows[0]).toMatchObject({
      roleValue: "On-site",
      status: "match",
    });
    expect(buildFitSummary(facts({ workStyle: "Remote" }), { ...base, remote: false }).rows[0].status).toBe("gap");
  });

  it("experience/level stretch produces the step-up note", () => {
    const role = { ...ROLE, salaryMin: null, salaryMax: null, remote: null, skills: [] };
    // A level word is scored once — as Level when the applicant has one.
    const fit = buildFitSummary(facts({ years: 4, level: "Mid-level" }), role);
    expect(fit.rows.map((r) => [r.key, r.applicantValue, r.status])).toEqual([
      ["level", "Mid-level", "stretch"],
    ]);
    expect(fit.matched).toBe(0);
    expect(fit.strength).toBeNull();
    expect(fit.headline).toBeNull();
    expect(fit.stretchNote).toBe("LEVEL · A STEP UP FOR AMY");
    // …and as Experience (years vs the word's floor) when they don't.
    expect(buildFitSummary(facts({ years: 4 }), role).rows).toMatchObject([
      { key: "experience", applicantValue: "4 yrs", status: "stretch" },
    ]);
    // A years requirement ("5+ years") feeds Experience.
    expect(
      buildFitSummary(facts({ years: 7, level: "Senior" }), { ...role, experienceLevel: "5+ years" }).rows.map((r) => r.key),
    ).toEqual(["experience"]);
    expect(buildFitSummary(facts({ years: 1 }), role).rows[0]).toMatchObject({ applicantValue: "1 yr", status: "gap" });
    expect(buildFitSummary(facts({ level: "Junior" }), role).rows[0].status).toBe("gap");
    expect(buildFitSummary(facts({ level: "Director" }), role).rows[0].status).toBe("match");
  });

  it("skills row needs ≥ 2 role skills and uses the 60% bar", () => {
    const role = { ...ROLE, salaryMin: null, salaryMax: null, remote: null, experienceLevel: null };
    expect(buildFitSummary(facts({ skills: ["figma", "sql"] }), role).rows[0]).toMatchObject({
      applicantValue: "2 of 5",
      status: "gap",
    });
    expect(buildFitSummary(facts({ skills: ["Figma"] }), { ...role, skills: ["Figma"] }).rows).toEqual([]);
  });

  it("omits everything with no role or no data", () => {
    const empty = buildFitSummary(facts(), ROLE);
    expect(empty).toEqual({ rows: [], matched: 0, total: 0, strength: null, headline: null, stretchNote: null });
    expect(buildFitSummary(buildApplicantFacts(CARD, ENRICHED, NOW), null).rows).toEqual([]);
  });

  it("headline wording", () => {
    expect(fitHeadline(4, 5)).toBe("Four of five line up with what you posted.");
    expect(fitHeadline(2, 2)).toBe("Both line up with what you posted.");
    expect(fitHeadline(3, 3)).toBe("All three line up with what you posted.");
    expect(fitHeadline(1, 1)).toBeNull();
    expect(fitHeadline(2, 3)).toBe("Two of three line up with what you posted.");
    expect(fitHeadline(1, 3)).toBe("One of three lines up with what you posted.");
  });
});

describe("stat grids", () => {
  const a = buildApplicantFacts(CARD, ENRICHED, NOW);

  it("heroStats fills four in order", () => {
    expect(heroStats(a)).toEqual([
      { label: "Experience", value: "7 years" },
      { label: "Comp", value: "$150–175K" },
      { label: "Work style", value: "Hybrid / Remote" },
      { label: "Seeking", value: "Full-time" },
    ]);
  });

  it("heroStats backfills with location / looking-for and never pads", () => {
    const thin = facts({ years: 1, location: "Austin, TX", desiredRole: "PM" });
    expect(heroStats(thin)).toEqual([
      { label: "Experience", value: "1 year" },
      { label: "Location", value: "Austin, TX" },
      { label: "Looking for", value: "PM" },
    ]);
    expect(heroStats(facts())).toEqual([]);
    expect(JSON.stringify(heroStats(facts()))).not.toMatch(/N\/A/);
  });

  it("statsCardCells", () => {
    expect(statsCardCells(a)).toEqual([
      { label: "Years exp.", value: "7" },
      { label: "Target comp", value: "$150–175K" },
      { label: "New York, NY", value: "Hybrid · Remote" },
      { label: "Start date", value: "2 weeks" },
    ]);
    expect(statsCardCells(facts({ workStyle: "Remote", seeking: "Contract", desiredRole: "PM" }))).toEqual([
      { label: "Work style", value: "Remote" },
      { label: "Seeking", value: "Contract" },
      { label: "Looking for", value: "PM" },
    ]);
    expect(statsCardCells(facts())).toEqual([]);
  });
});
