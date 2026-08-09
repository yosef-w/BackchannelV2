/**
 * Contract tests for identity-scoped onboarding drafts — the rules that
 * prevent an abandoned signup's draft from leaking into the next signup on
 * the same device (the "why is 'gggg' pre-filled in my fresh signup?" bug):
 *   1. same email → restore
 *   2. different email → discard from storage, start fresh
 *   3. legacy un-stamped drafts (the old flat shape) → discard
 *   4. stale drafts → discard even for the same email
 *   5. no email → never write, never restore
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  DRAFT_MAX_AGE_MS,
  clearOnboardingDraft,
  clearOnboardingRegistered,
  getPendingOnboardingRole,
  loadOnboardingDraft,
  markOnboardingRegistered,
  saveOnboardingDraft,
} from "../onboardingDraft";

const KEY = "onboarding_draft_applicant_v1";
const draftData = { answers: { positionSeeking: "iOS Engineer" } };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("save + load round trip", () => {
  it("restores the draft for the SAME signup email", async () => {
    await saveOnboardingDraft(KEY, "sarah@example.com", draftData);
    const restored = await loadOnboardingDraft<typeof draftData>(
      KEY,
      "sarah@example.com",
    );
    expect(restored).toEqual(draftData);
  });

  it("email matching is case- and whitespace-insensitive", async () => {
    await saveOnboardingDraft(KEY, "  Sarah@Example.COM ", draftData);
    const restored = await loadOnboardingDraft(KEY, "sarah@example.com");
    expect(restored).toEqual(draftData);
  });

  it("returns null when no draft exists", async () => {
    expect(await loadOnboardingDraft(KEY, "sarah@example.com")).toBeNull();
  });
});

describe("identity scoping", () => {
  it("a DIFFERENT email discards the draft and starts fresh", async () => {
    await saveOnboardingDraft(KEY, "old-tester@example.com", {
      answers: { positionSeeking: "gggg" },
    });

    const restored = await loadOnboardingDraft(KEY, "new-user@example.com");

    expect(restored).toBeNull();
    // The junk draft must be GONE, not lying in wait for a third signup.
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("an empty current email never restores (and discards defensively)", async () => {
    await saveOnboardingDraft(KEY, "someone@example.com", draftData);
    expect(await loadOnboardingDraft(KEY, "")).toBeNull();
    expect(await loadOnboardingDraft(KEY, undefined)).toBeNull();
  });

  it("never writes a draft without an email to stamp it with", async () => {
    await saveOnboardingDraft(KEY, "", draftData);
    await saveOnboardingDraft(KEY, undefined, draftData);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe("legacy + corrupt drafts", () => {
  it("discards the old un-stamped flat draft shape (pre-envelope)", async () => {
    // Exactly what the shipped app wrote before this module existed.
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ answers: { positionSeeking: "gggg" } }),
    );

    expect(await loadOnboardingDraft(KEY, "sarah@example.com")).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("discards corrupt JSON", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    expect(await loadOnboardingDraft(KEY, "sarah@example.com")).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe("age backstop", () => {
  it("discards a same-email draft older than DRAFT_MAX_AGE_MS", async () => {
    await saveOnboardingDraft(KEY, "sarah@example.com", draftData);
    const future = Date.now() + DRAFT_MAX_AGE_MS + 1000;

    expect(
      await loadOnboardingDraft(KEY, "sarah@example.com", future),
    ).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("keeps a same-email draft within the age window", async () => {
    await saveOnboardingDraft(KEY, "sarah@example.com", draftData);
    const later = Date.now() + DRAFT_MAX_AGE_MS - 1000;

    expect(await loadOnboardingDraft(KEY, "sarah@example.com", later)).toEqual(
      draftData,
    );
  });
});

describe("clearOnboardingDraft", () => {
  it("removes the stored draft", async () => {
    await saveOnboardingDraft(KEY, "sarah@example.com", draftData);
    await clearOnboardingDraft(KEY);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

// Registration happens at the questionnaire's FIRST step, well before the
// profile is actually filled out — this flag is what lets splash.tsx tell
// "authenticated + done" apart from "authenticated + app restarted
// mid-questionnaire" so it can route the latter back to finish instead of
// stranding them on a half-filled dashboard.
describe("pending registration flag", () => {
  it("has no pending role until one is marked", async () => {
    expect(await getPendingOnboardingRole()).toBeNull();
  });

  it("reports the marked role", async () => {
    await markOnboardingRegistered("applicant");
    expect(await getPendingOnboardingRole()).toBe("applicant");
  });

  it("a later mark for a different role overwrites the earlier one", async () => {
    await markOnboardingRegistered("applicant");
    await markOnboardingRegistered("sponsor");
    expect(await getPendingOnboardingRole()).toBe("sponsor");
  });

  it("clearing removes the pending role", async () => {
    await markOnboardingRegistered("applicant");
    await clearOnboardingRegistered();
    expect(await getPendingOnboardingRole()).toBeNull();
  });

  it("ignores a corrupt/unexpected stored value", async () => {
    await AsyncStorage.setItem("@bc/onboardingPendingRole", "garbage");
    expect(await getPendingOnboardingRole()).toBeNull();
  });
});
