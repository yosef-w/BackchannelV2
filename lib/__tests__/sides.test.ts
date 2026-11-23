import {
  addableRole,
  holdsBoth,
  otherRole,
  parseRoles,
  parseSidesSummary,
  waitingLine,
  waitingTotal,
  roleForNotification,
  roleToUserType,
  sideTitle,
  userTypeToRole,
} from "../sides";

describe("sides", () => {
  it("converts between the wire role and the UI user type", () => {
    expect(roleToUserType("Sponsor")).toBe("sponsor");
    expect(userTypeToRole("applicant")).toBe("Applicant");
    expect(otherRole("Applicant")).toBe("Sponsor");
  });

  it("parses roles in either casing, de-duplicated, in a stable order", () => {
    expect(parseRoles(["applicant", "Sponsor", "APPLICANT", 7, "admin"])).toEqual([
      "Sponsor",
      "Applicant",
    ]);
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles("Sponsor")).toEqual([]);
  });

  it("lets only a sponsor add a side, and only a job search", () => {
    expect(addableRole(["Sponsor"])).toBe("Applicant");
    // An applicant has no company to sponsor into: no second side.
    expect(addableRole(["Applicant"])).toBeNull();
    expect(addableRole(["Sponsor", "Applicant"])).toBeNull();
    expect(addableRole([])).toBeNull();
    expect(holdsBoth(["Applicant", "Sponsor"])).toBe(true);
    expect(holdsBoth(["Applicant"])).toBe(false);
  });

  it("names the sponsor side with the company when it has one", () => {
    expect(sideTitle("Sponsor", " Meridian Health ")).toBe("Sponsor at Meridian Health");
    expect(sideTitle("Sponsor", "")).toBe("Sponsor");
    expect(sideTitle("Applicant", "Meridian Health")).toBe("Job search");
  });

  it("routes a notification to the side it belongs to", () => {
    expect(roleForNotification({ type: "message", role: "applicant" })).toBe("Applicant");
    expect(roleForNotification({ type: "job_like" })).toBe("Sponsor");
    expect(roleForNotification({ type: "profile_like" })).toBe("Applicant");
    expect(roleForNotification({ type: "message" })).toBeNull();
    expect(roleForNotification(null)).toBeNull();
  });

  it("parses what's waiting on each side, tolerating casing and gaps", () => {
    const summary = parseSidesSummary({
      sides: {
        sponsor: { new_interest: 3, unread_messages: "2", new_matches: -1 },
        Applicant: { new_matches: 1 },
        admin: { new_interest: 9 },
      },
    });
    expect(summary.Sponsor).toEqual({
      newInterest: 3,
      newMatches: 0,
      unreadMessages: 2,
      referralUpdates: 0,
    });
    expect(waitingTotal(summary.Sponsor)).toBe(5);
    expect(waitingTotal(summary.Applicant)).toBe(1);
    expect(parseSidesSummary(null)).toEqual({});
    expect(parseSidesSummary("nope")).toEqual({});
  });

  it("describes what's waiting in the side's own words, two parts at most", () => {
    const base = { newInterest: 0, newMatches: 0, unreadMessages: 0, referralUpdates: 0 };
    expect(waitingLine("Sponsor", { ...base, newInterest: 3, unreadMessages: 2, referralUpdates: 1 })).toBe(
      "3 new applicants · 2 unread messages",
    );
    expect(waitingLine("Applicant", { ...base, newInterest: 1, newMatches: 1 })).toBe(
      "1 sponsor interested · 1 new match",
    );
    expect(waitingLine("Sponsor", base)).toBeNull();
    expect(waitingLine("Sponsor", undefined)).toBeNull();
  });
});
