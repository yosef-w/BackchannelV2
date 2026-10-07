/**
 * The remote-config channel can lock people out of the app, so the two
 * properties that matter are pinned: version comparison is numeric (not
 * string) and malformed input can never produce a restriction.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.0" } },
}));

import {
  NO_RESTRICTIONS,
  compareVersions,
  getCurrentVersion,
  isUpdateRequired,
  parseAppConfig,
} from "../appConfig";

describe("compareVersions", () => {
  it("compares numerically, not lexically", () => {
    expect(compareVersions("1.2.10", "1.2.9")).toBe(1);
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
  });
  it("treats missing segments as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.1")).toBe(-1);
  });
  it("doesn't throw on garbage — degrades to equal", () => {
    expect(compareVersions("abc", "1.0.0")).toBe(-1);
    expect(() => compareVersions("", "")).not.toThrow();
  });
});

describe("isUpdateRequired", () => {
  it("is false with no min_version (the fail-open default)", () => {
    expect(isUpdateRequired("1.0.0", null)).toBe(false);
    expect(isUpdateRequired("1.0.0", "")).toBe(false);
  });
  it("is true only when strictly older", () => {
    expect(isUpdateRequired("1.0.0", "1.0.1")).toBe(true);
    expect(isUpdateRequired("1.0.1", "1.0.1")).toBe(false);
    expect(isUpdateRequired("2.0.0", "1.9.9")).toBe(false);
  });
});

describe("parseAppConfig", () => {
  it("returns no restrictions for non-objects", () => {
    expect(parseAppConfig(null)).toEqual(NO_RESTRICTIONS);
    expect(parseAppConfig("nope")).toEqual(NO_RESTRICTIONS);
    expect(parseAppConfig(42)).toEqual(NO_RESTRICTIONS);
  });
  it("reads the documented shape", () => {
    expect(
      parseAppConfig({
        min_version: "1.3.0",
        maintenance_message: "Back at 3pm.",
        flags: { premium_enabled: true, x: false },
      }),
    ).toEqual({
      minVersion: "1.3.0",
      maintenanceMessage: "Back at 3pm.",
      flags: { premium_enabled: true, x: false },
    });
  });
  it("drops wrong-typed fields instead of trusting them", () => {
    expect(
      parseAppConfig({
        min_version: 5,
        maintenance_message: { a: 1 },
        flags: { good: true, bad: "yes", worse: 1 },
      }),
    ).toEqual({ minVersion: null, maintenanceMessage: null, flags: { good: true } });
  });
  it("ignores blank strings (an empty message must not block the app)", () => {
    expect(parseAppConfig({ min_version: "  ", maintenance_message: "" })).toEqual(
      NO_RESTRICTIONS,
    );
  });
});

describe("getCurrentVersion", () => {
  it("reads the app.json version", () => {
    expect(getCurrentVersion()).toBe("1.2.0");
  });
});
