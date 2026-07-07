import type { AutofillData } from "../../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../profileCompletion";

// Build a minimal AutofillData covering only the fields the completeness
// check reads. Cast through unknown — the real type carries many more
// fields the function never touches.
function makeData(overrides: Record<string, unknown> = {}): AutofillData {
  const base = {
    personal: {
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah@example.com",
      profileImage: "https://cdn/x.jpg",
      address: { city: "Brooklyn" },
    },
    professional: {
      title: "Data Engineer",
      summary: "I build pipelines.",
      experiences: [{ jobTitle: "Data Engineer", company: "Acme" }],
    },
    education: {
      entries: [
        { degree: "BS", university: "NYU", graduationYear: "2020" },
      ],
    },
    skills: ["Python"],
  };
  return deepMerge(base, overrides) as unknown as AutofillData;
}

function deepMerge(
  base: Record<string, any>,
  overrides: Record<string, any>,
): Record<string, any> {
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && base[k]
        ? deepMerge(base[k], v)
        : v;
  }
  return out;
}

describe("checkProfileCompleteness — applicant", () => {
  it("is complete when every required field is present", () => {
    const res = checkProfileCompleteness(makeData(), "applicant");
    expect(res.isComplete).toBe(true);
    expect(res.percentage).toBe(100);
    expect(res.missingFields).toEqual([]);
  });

  it("completion is all-or-nothing, not a percentage threshold", () => {
    const res = checkProfileCompleteness(
      makeData({ personal: { profileImage: "" } }),
      "applicant",
    );
    expect(res.isComplete).toBe(false);
    expect(res.percentage).toBeGreaterThan(80); // 9 of 10 filled
    expect(res.missingFields).toEqual([
      expect.objectContaining({ field: "profileImage", label: "Photo" }),
    ]);
  });

  it("treats 'Not set' placeholder values as missing", () => {
    const res = checkProfileCompleteness(
      makeData({ personal: { firstName: "Not set" } }),
      "applicant",
    );
    expect(res.missingFields).toContainEqual(
      expect.objectContaining({ field: "firstName" }),
    );
  });

  it("requires at least one skill", () => {
    const res = checkProfileCompleteness(makeData({ skills: [] }), "applicant");
    expect(res.missingFields).toContainEqual(
      expect.objectContaining({ field: "skills" }),
    );
  });

  it("requires a COMPLETE experience entry (title + company), not just any row", () => {
    const res = checkProfileCompleteness(
      makeData({
        professional: { experiences: [{ jobTitle: "Engineer", company: " " }] },
      }),
      "applicant",
    );
    expect(res.missingFields).toContainEqual(
      expect.objectContaining({ field: "experiences" }),
    );
  });

  it("requires a complete education entry (degree + university + year)", () => {
    const res = checkProfileCompleteness(
      makeData({
        education: { entries: [{ degree: "BS", university: "NYU" }] },
      }),
      "applicant",
    );
    expect(res.missingFields).toContainEqual(
      expect.objectContaining({ field: "entries", label: "Education" }),
    );
  });
});

describe("checkProfileCompleteness — sponsor", () => {
  it("does NOT require experience or education (sponsors have no Résumé UI)", () => {
    // The regression this parameter fixed: sponsors were permanently flagged
    // incomplete over fields they had no UI to provide (Emily Rodriguez bug).
    const res = checkProfileCompleteness(
      makeData({
        professional: { experiences: [] },
        education: { entries: [] },
      }),
      "sponsor",
    );
    expect(res.isComplete).toBe(true);
    expect(res.percentage).toBe(100);
  });

  it("still requires skills and the shared identity fields", () => {
    const res = checkProfileCompleteness(
      makeData({ skills: [], personal: { profileImage: "" } }),
      "sponsor",
    );
    expect(res.isComplete).toBe(false);
    expect(res.missingFields.map((f) => f.field).sort()).toEqual([
      "profileImage",
      "skills",
    ]);
  });
});

describe("checkProfileCompleteness — defaults", () => {
  it("defaults userType to applicant (experience/education gated)", () => {
    const res = checkProfileCompleteness(
      makeData({ professional: { experiences: [] } }),
    );
    expect(res.isComplete).toBe(false);
  });
});
