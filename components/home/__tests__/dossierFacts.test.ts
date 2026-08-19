import type { PublicProfileExperience } from "@/lib/api";
import {
  deriveExperienceFact,
  formatExperienceLevelLabel,
  joinFacts,
  yearFromDateString,
} from "../dossierFacts";

const exp = (
  overrides: Partial<PublicProfileExperience>,
): PublicProfileExperience => ({
  jobTitle: "",
  company: "",
  startDate: "",
  current: false,
  description: "",
  ...overrides,
});

describe("yearFromDateString", () => {
  it("extracts a year from common backend date formats", () => {
    expect(yearFromDateString("2022")).toBe(2022);
    expect(yearFromDateString("Jan 2022")).toBe(2022);
    expect(yearFromDateString("2022-01-15")).toBe(2022);
    expect(yearFromDateString("01/2019")).toBe(2019);
  });

  it("returns null for garbage, empty, and non-string input", () => {
    expect(yearFromDateString("")).toBeNull();
    expect(yearFromDateString("recently")).toBeNull();
    expect(yearFromDateString(null)).toBeNull();
    expect(yearFromDateString(undefined)).toBeNull();
  });
});

describe("joinFacts", () => {
  it("joins present parts and drops empties/falsy", () => {
    expect(joinFacts(["Design Lead", "Meridian Labs"])).toBe(
      "Design Lead · Meridian Labs",
    );
    expect(joinFacts(["Hybrid", "", null, undefined, false, "Senior"])).toBe(
      "Hybrid · Senior",
    );
    expect(joinFacts(["  ", ""])).toBe("");
  });
});

describe("deriveExperienceFact", () => {
  it("returns null for empty or missing lists", () => {
    expect(deriveExperienceFact([])).toBeNull();
    expect(deriveExperienceFact(undefined)).toBeNull();
    expect(deriveExperienceFact(null)).toBeNull();
  });

  it("computes span from earliest start to now for a current role", () => {
    const fact = deriveExperienceFact(
      [
        exp({
          jobTitle: "Design Lead",
          company: "Meridian Labs",
          startDate: "2022",
          current: true,
        }),
        exp({
          jobTitle: "Product Designer",
          company: "Northport",
          startDate: "Jan 2019",
          endDate: "2022",
        }),
      ],
      2026,
    );
    expect(fact).toEqual({
      value: "7 years",
      sub: "Design Lead · Meridian Labs",
    });
  });

  it("uses the latest end date when nothing is current", () => {
    const fact = deriveExperienceFact(
      [
        exp({
          jobTitle: "Analyst",
          company: "Acme",
          startDate: "2018",
          endDate: "2021",
        }),
      ],
      2026,
    );
    expect(fact).toEqual({ value: "3 years", sub: "Analyst · Acme" });
  });

  it("singularizes one year and floors sub-year spans", () => {
    expect(
      deriveExperienceFact([exp({ startDate: "2025", current: true })], 2026)
        ?.value,
    ).toBe("1 year");
    expect(
      deriveExperienceFact([exp({ startDate: "2026", current: true })], 2026)
        ?.value,
    ).toBe("Under a year");
  });

  it("clamps typo'd future dates to today", () => {
    expect(
      deriveExperienceFact(
        [exp({ startDate: "2020", endDate: "2072" })],
        2026,
      )?.value,
    ).toBe("6 years");
  });

  it("falls back to the seat alone when no dates parse", () => {
    expect(
      deriveExperienceFact(
        [exp({ jobTitle: "Designer", company: "Acme", startDate: "n/a" })],
        2026,
      ),
    ).toEqual({ value: "Designer · Acme" });
  });

  it("prefers the explicitly-current entry as the seat", () => {
    const fact = deriveExperienceFact(
      [
        exp({ jobTitle: "Newer", company: "B", startDate: "2024" }),
        exp({
          jobTitle: "Current",
          company: "A",
          startDate: "2020",
          current: true,
        }),
      ],
      2026,
    );
    expect(fact?.sub).toBe("Current · A");
  });
});

describe("formatExperienceLevelLabel", () => {
  it("suffixes bare digit ranges (NBSP-glued against widows) and passes labels through", () => {
    expect(formatExperienceLevelLabel("5+")).toBe(
      "5+ years experience",
    );
    expect(formatExperienceLevelLabel("3 - 5")).toBe(
      "3 - 5 years experience",
    );
    expect(formatExperienceLevelLabel("Senior")).toBe("Senior");
  });

  it("returns null for empty input", () => {
    expect(formatExperienceLevelLabel("")).toBeNull();
    expect(formatExperienceLevelLabel(null)).toBeNull();
    expect(formatExperienceLevelLabel("   ")).toBeNull();
  });
});
