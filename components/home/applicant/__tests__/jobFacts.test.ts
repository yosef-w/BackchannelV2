import type { Job } from "@/types/jobs";
import type { EnrichedSponsorProfile } from "@/types/profiles";
import { buildJobFacts, requirementLines, shortLevel, shortLocation } from "../jobFacts";

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: "7",
    title: "Senior Product Designer",
    company: "Meridian Health",
    location: "Austin",
    workArrangement: "Hybrid",
    type: "Full-time",
    experienceLevel: "Senior",
    salary: "$145–170k",
    description: "Lead design for the scheduling app. You work with two PMs. And more.",
    summary: "",
    skills: ["Figma", "Design Systems", "Healthcare"],
    benefits: ["Equity", "401(k) match"],
    url: "",
    image: "",
    isSponsored: true,
    sponsorInfo: {
      name: "Dana Okafor",
      role: "Design Manager",
      image: "",
      yearsAtCompany: "4 years",
      canRefer: true,
      userId: 12,
    },
    ...over,
  }) as Job;

describe("requirementLines", () => {
  it("splits bullets and line breaks, keeping the first three", () => {
    expect(
      requirementLines("• 5+ years in product design\n• Shipped a design system\n• Runs research\n• Extra"),
    ).toEqual(["5+ years in product design", "Shipped a design system", "Runs research"]);
  });

  it("falls back to sentences and drops trailing punctuation", () => {
    expect(requirementLines("Five years of design work. Comfortable with research.")).toEqual([
      "Five years of design work",
      "Comfortable with research",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(requirementLines("")).toEqual([]);
    expect(requirementLines(null)).toEqual([]);
  });
});

describe("ledger shorthands", () => {
  it("keeps only the city", () => {
    expect(shortLocation("Seattle, Washington, United States")).toBe("Seattle");
    expect(shortLocation("")).toBe("");
  });

  it("reads a bare range as years and leaves words alone", () => {
    expect(shortLevel("0-2")).toBe("0-2 years");
    expect(shortLevel("Senior")).toBe("Senior");
  });
});

describe("buildJobFacts", () => {
  it("builds the sponsor, ledger and fit from a sponsored job", () => {
    const f = buildJobFacts(job(), null, ["figma", "Design systems", "Sketch"]);
    expect(f.sponsor).toMatchObject({
      firstName: "Dana",
      detail: "Design Manager · 4 years here",
      canRefer: true,
      userId: "12",
    });
    expect(f.ledger).toEqual([
      { label: "Salary", value: "$145–170k" },
      { label: "Your fit", value: "2 of 3 skills" },
      { label: "Where", value: "Hybrid · Austin" },
      { label: "Level", value: "Senior" },
    ]);
    expect(f.skillsMatched).toHaveLength(2);
    expect(f.skillsOther).toEqual(["Healthcare"]);
    expect(f.brief).toBe("Lead design for the scheduling app. You work with two PMs.");
    expect(f.fullRead.map((p) => p.label)).toEqual(["About the role"]);
  });

  it("has no sponsor, quote or insights on an unsponsored role", () => {
    const f = buildJobFacts(
      job({ isSponsored: false, backchannelInsights: { dayToDay: "Standups" } }),
      { insights: [{ question: "Q", answer: "A" }], verified: true } as unknown as EnrichedSponsorProfile,
      [],
    );
    expect(f.unsponsored).toBe(true);
    expect(f.sponsor).toBeNull();
    expect(f.quote).toBeNull();
    expect(f.insights).toEqual([]);
  });

  it("omits ledger cells with no data and never invents a fit", () => {
    const f = buildJobFacts(
      job({ salary: "", skills: [], workArrangement: "", location: "", experienceLevel: "", type: "" }),
      null,
      ["Figma"],
    );
    expect(f.ledger).toEqual([]);
  });

  it("falls back to the relevance score when no skills overlap", () => {
    const f = buildJobFacts(job({ relevanceScore: 0.82 }), null, []);
    expect(f.ledger).toContainEqual({ label: "Your fit", value: "82% match" });
  });

  it("promotes the first sponsor answer and keeps the rest", () => {
    const profile = {
      verified: true,
      insights: [
        { question: "Why here?", answer: "Small team." },
        { question: "Hardest part?", answer: "Pace." },
      ],
    } as unknown as EnrichedSponsorProfile;
    const f = buildJobFacts(job(), profile, []);
    expect(f.quote).toEqual({ question: "Why here?", answer: "Small team." });
    expect(f.moreQuotes).toHaveLength(1);
    expect(f.sponsor?.verified).toBe(true);
  });
});
