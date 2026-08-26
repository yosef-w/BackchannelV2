import {
  type Plate,
  buildApplicantPlates,
  buildJobPlates,
  deriveApplicantClaim,
  deriveAnchor,
  firstSentence,
  plainText,
  skillOverlap,
  splitYears,
} from "../plateContent";
import type { Job } from "@/types/jobs";
import type { ProfileDeckCard } from "@/types/profiles";

const CARD: ProfileDeckCard = {
  id: "u1",
  USER_ID: "u1",
  name: "Jordan Okafor",
  location: "Chicago, IL",
  skills: ["Systems thinking", "Incident command", "Go"],
  desiredRole: "Staff Platform Engineer",
  bio: "Six years of platform work.",
  prompts: [{ question: "What I'm known for", answer: "Calm under fire." }],
  image: "",
  company: "",
};

const ENRICHED = {
  experiences: [
    { jobTitle: "Engineer", company: "Stripe", startDate: "2018-06-01", endDate: "2020-01-01", current: false },
    { jobTitle: "Staff Engineer", company: "Northline", startDate: "2023-02-01", endDate: "", current: true },
  ],
  education: [],
  certifications: [],
  languages: [],
  achievements: "Led the payments replatform across seven teams. Nobody quit.",
  prompts: [],
  bio: "",
};

describe("helpers", () => {
  it("firstSentence clips to one sentence and a max length", () => {
    expect(firstSentence("One. Two.")).toBe("One.");
    expect(firstSentence("x".repeat(100), 20).endsWith("…")).toBe(true);
  });
  it("skillOverlap is case/punctuation-insensitive and keeps my spelling", () => {
    expect(skillOverlap(["React Native", "Go"], ["react-native", "GO", "Rust"])).toEqual(["React Native", "Go"]);
    expect(skillOverlap([], ["Go"])).toEqual([]);
  });
  it("splitYears parses the ledger's year phrases", () => {
    expect(splitYears("6 years")).toEqual({ stat: "6", suffix: "yrs" });
    expect(splitYears("1 year")).toEqual({ stat: "1", suffix: "yr" });
    expect(splitYears("Under a year")).toEqual({ stat: "<1", suffix: "yr" });
    expect(splitYears("Stripe")).toBeNull();
  });
});

describe("deriveApplicantClaim", () => {
  it("prefers achievements, then a skill, then the role", () => {
    expect(plainText(deriveApplicantClaim({ achievements: "Calm under fire. More." }))).toBe("Calm under fire.");
    expect(deriveApplicantClaim({ skills: ["Go"] })).toEqual([
      { text: "Sharpest at " }, { text: "Go", accent: true }, { text: "." },
    ]);
    expect(plainText(deriveApplicantClaim({ desiredRole: "Designer" }))).toBe("Ready for Designer.");
    expect(plainText(deriveApplicantClaim({ desiredRole: "Open to opportunities" }))).toMatch(/right introduction/);
  });
});

describe("buildApplicantPlates", () => {
  it("builds placard → record → voice → fit from a rich profile", () => {
    const plates = buildApplicantPlates(CARD, ENRICHED as never, {
      roleTitle: "Platform Lead",
      roleSkills: ["Go", "Kafka", "systems thinking"],
    });
    expect(plates.map((p) => p.kind)).toEqual(["placard", "record", "voice", "fit"]);
    const record = plates[1] as Extract<typeof plates[number], { kind: "record" }>;
    expect(record.stat).toBe("8");
    expect(plainText(record.statline)).toBe("Stripe, then Northline.");
    expect(record.receipts[0]).toBe("Staff Engineer · Northline");
    const fit = plates[3] as Extract<typeof plates[number], { kind: "fit" }>;
    expect(plainText(fit.line)).toBe("Brings 2 of the 3 skills your Platform Lead needs.");
    expect(fit.receipts).toEqual(["Systems thinking", "Go"]);
  });

  it("collapses duplicate receipts (two untitled rows at one company)", () => {
    const dupes = {
      ...ENRICHED,
      experiences: [
        { jobTitle: "", company: "Schlumberger", startDate: "2015-01-01", endDate: "2017-01-01", current: false },
        { jobTitle: "", company: "Schlumberger", startDate: "2017-02-01", endDate: "", current: true },
      ],
    };
    const record = buildApplicantPlates(CARD, dupes as never)[1] as Extract<Plate, { kind: "record" }>;
    expect(record.receipts).toEqual(["Schlumberger"]);
  });

  it("omits the record plate and falls back to the bio voice on a thin card", () => {
    const thin: ProfileDeckCard = { ...CARD, prompts: [], skills: [] };
    const plates = buildApplicantPlates(thin, null);
    expect(plates.map((p) => p.kind)).toEqual(["placard", "voice", "fit"]);
    expect((plates[1] as { quote: string }).quote).toBe("Six years of platform work.");
    expect(plainText((plates[2] as Extract<Plate, { kind: "fit" }>).line)).toBe("Looking for Staff Platform Engineer · Chicago, IL");
  });
});

const JOB: Job = {
  id: "j1", title: "Staff Platform Engineer", company: "Northline", location: "Remote",
  locations: [], type: "Full-time", salary: "$210–240k", salaryMin: null, salaryMax: null,
  salaryCurrency: null, postedAt: "", description: "", summary: "", skills: ["Go", "Kafka", "Postgres"],
  highlights: [], experienceLevel: "Senior", workArrangement: "Remote-first", isRemote: true, url: "",
  applicants: 12, image: "", currentSponsors: [], benefits: [], isSponsored: true, relevanceScore: 0.82,
  sponsorInfo: { name: "Dana Whitfield", role: "VP Engineering", image: "", yearsAtCompany: "4 years", canRefer: true, userId: "s1" },
};

describe("buildJobPlates", () => {
  it("builds role → setup → vouch → fit for a sponsored job", () => {
    const plates = buildJobPlates(JOB, { bio: "", insights: [{ question: "Why here", answer: "This team ships." }], companiesCanReferTo: [], verified: true }, { mySkills: ["go", "Kafka"] });
    expect(plates.map((p) => p.kind)).toEqual(["role", "setup", "vouch", "fit"]);
    const vouch = plates[2] as Extract<typeof plates[number], { kind: "vouch" }>;
    expect(plainText(vouch.statement)).toBe("Dana put their name on this role.");
    expect(vouch.chips).toEqual(["VERIFIED", "4 YEARS HERE", "CAN REFER"]);
    expect(vouch.quote).toBe("This team ships.");
    const fit = plates[3] as Extract<typeof plates[number], { kind: "fit" }>;
    expect(plainText(fit.line)).toBe("2 of the 3 required skills are already on your profile.");
  });

  it("skips the vouch and uses the match percent when there is no sponsor", () => {
    const plates = buildJobPlates({ ...JOB, isSponsored: false, sponsorInfo: null }, null, { mySkills: [] });
    expect(plates.map((p) => p.kind)).toEqual(["role", "setup", "fit"]);
    expect((plates[0] as { eyebrow: string }).eyebrow).toBe("OPEN ROLE · NO SPONSOR YET");
    expect(plainText((plates[2] as Extract<Plate, { kind: "fit" }>).line)).toBe("82% match, by our read.");
  });
});

describe("deriveAnchor", () => {
  it("reads identity off the first plate", () => {
    expect(deriveAnchor(buildApplicantPlates(CARD, ENRICHED as never))).toMatchObject({
      name: "Jordan Okafor", claim: "Led the payments replatform across seven teams.",
    });
    expect(deriveAnchor(buildJobPlates(JOB, null))).toMatchObject({ name: "Staff Platform Engineer", claim: "Northline" });
  });
});
