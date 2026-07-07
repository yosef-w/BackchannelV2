import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getLocalCheckInStages,
    getLocalCheckInTimes,
    saveLocalCheckInStage,
    saveLocalCheckInStages,
} from "../checkInStageCache";
import {
    getSponsorRequestOutcomes,
    saveSponsorRequestOutcome,
} from "../sponsorRequestCache";

// Official AsyncStorage jest mock (in-memory map, same API).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const NOW = new Date("2026-07-07T12:00:00Z");

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick"] });
  jest.setSystemTime(NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("checkInStageCache", () => {
  it("round-trips a single stage and stamps its time", async () => {
    await saveLocalCheckInStage("ref-1", "Recruiter Screen");
    expect(await getLocalCheckInStages()).toEqual({
      "ref-1": "Recruiter Screen",
    });
    expect(await getLocalCheckInTimes()).toEqual({
      "ref-1": NOW.toISOString(),
    });
  });

  it("merges rather than replaces across saves", async () => {
    await saveLocalCheckInStage("ref-1", "Referred");
    await saveLocalCheckInStage("ref-2", "Offer");
    await saveLocalCheckInStage("ref-1", "Onsite"); // update in place
    expect(await getLocalCheckInStages()).toEqual({
      "ref-1": "Onsite",
      "ref-2": "Offer",
    });
  });

  it("batch-saves stages (sponsor batch check-in) and stamps every id", async () => {
    await saveLocalCheckInStages([
      { referralId: "a", stage: "Referred" },
      { referralId: "b", stage: "Phone Screen" },
      { referralId: "", stage: "ignored" }, // dropped: no id
    ]);
    expect(await getLocalCheckInStages()).toEqual({
      a: "Referred",
      b: "Phone Screen",
    });
    const times = await getLocalCheckInTimes();
    expect(Object.keys(times).sort()).toEqual(["a", "b"]);
  });

  it("ignores empty ids/stages and never throws", async () => {
    await saveLocalCheckInStage("", "Offer");
    await saveLocalCheckInStage("ref-1", "");
    expect(await getLocalCheckInStages()).toEqual({});
  });

  it("returns {} when the stored blob is corrupt", async () => {
    await AsyncStorage.setItem("@bc/localCheckInStages", "not json{{{");
    expect(await getLocalCheckInStages()).toEqual({});
  });
});

describe("sponsorRequestCache", () => {
  it("round-trips an outcome message with its request time", async () => {
    await saveSponsorRequestOutcome("job-9", "5 employees notified at Stripe");
    expect(await getSponsorRequestOutcomes()).toEqual({
      "job-9": {
        message: "5 employees notified at Stripe",
        requestedAt: NOW.toISOString(),
      },
    });
  });

  it("ignores empty ids/messages", async () => {
    await saveSponsorRequestOutcome("", "msg");
    await saveSponsorRequestOutcome("job-1", "");
    expect(await getSponsorRequestOutcomes()).toEqual({});
  });

  it("returns {} when the stored blob is corrupt", async () => {
    await AsyncStorage.setItem("@bc/localSponsorRequestOutcomes", "42");
    expect(await getSponsorRequestOutcomes()).toEqual({});
  });
});
