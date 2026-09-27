jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
// invite.ts pulls in analytics; keep this a pure-logic test.
jest.mock("@/lib/analytics/mixpanel", () => ({ trackInviteShared: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INVITE_BASE_URL,
  buildInviteMessage,
  buildInviteUrl,
} from "../invite";
import {
  getPendingReferrer,
  isValidReferrerCode,
  setPendingReferrer,
} from "../referrer";

describe("buildInviteUrl", () => {
  it("builds a universal link from the user id", () => {
    expect(buildInviteUrl("u_123")).toBe(`${INVITE_BASE_URL}/u_123`);
  });
  it("refuses ids that could break out of the path", () => {
    expect(buildInviteUrl("../etc")).toBeNull();
    expect(buildInviteUrl("a b")).toBeNull();
    expect(buildInviteUrl("a?x=1")).toBeNull();
    expect(buildInviteUrl("")).toBeNull();
    expect(buildInviteUrl(null)).toBeNull();
  });
});

describe("buildInviteMessage", () => {
  const url = "https://example.test/invite/u_1";
  it("includes the link, in both role voices", () => {
    expect(buildInviteMessage("applicant", url)).toContain(url);
    expect(buildInviteMessage("sponsor", url)).toContain(url);
  });
  it("pitches each side differently", () => {
    expect(buildInviteMessage("applicant", url)).toMatch(/vouch/i);
    expect(buildInviteMessage("sponsor", url)).toMatch(/sponsor/i);
  });
  it("never uses an em dash (app copy rule)", () => {
    expect(buildInviteMessage("applicant", url)).not.toContain("—");
    expect(buildInviteMessage("sponsor", url)).not.toContain("—");
  });
});

describe("referrer capture", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("validates codes strictly", () => {
    expect(isValidReferrerCode("abc-DEF_123")).toBe(true);
    expect(isValidReferrerCode("x".repeat(65))).toBe(false);
    expect(isValidReferrerCode("a/b")).toBe(false);
    expect(isValidReferrerCode(undefined)).toBe(false);
    expect(isValidReferrerCode(42)).toBe(false);
  });

  it("stores a valid code and reads it back", async () => {
    expect(await setPendingReferrer("u_1")).toBe(true);
    expect(await getPendingReferrer()).toBe("u_1");
  });

  it("first touch wins: a later link can't reassign the referral", async () => {
    await setPendingReferrer("first");
    expect(await setPendingReferrer("second")).toBe(false);
    expect(await getPendingReferrer()).toBe("first");
  });

  it("never stores an invalid code", async () => {
    expect(await setPendingReferrer("../x")).toBe(false);
    expect(await getPendingReferrer()).toBeNull();
  });
});
