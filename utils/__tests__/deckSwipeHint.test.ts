import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    markDeckSwipeLearned,
    shouldPlayDeckSwipeHint,
} from "../deckSwipeHint";

// Official AsyncStorage jest mock (in-memory map, same API).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("deckSwipeHint", () => {
  it("plays on a fresh device with nothing recorded yet", async () => {
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
  });

  it("plays up to MAX_SHOWN (2) cards, then stops even if never learned", async () => {
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
    expect(await shouldPlayDeckSwipeHint()).toBe(false);
    expect(await shouldPlayDeckSwipeHint()).toBe(false);
  });

  it("stops immediately once the user has demonstrably learned it", async () => {
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
    await markDeckSwipeLearned();
    expect(await shouldPlayDeckSwipeHint()).toBe(false);
  });

  it("markDeckSwipeLearned is idempotent and survives being called repeatedly", async () => {
    await markDeckSwipeLearned();
    await markDeckSwipeLearned();
    expect(await shouldPlayDeckSwipeHint()).toBe(false);
  });

  it("treats corrupted storage as the default (never shown, not learned)", async () => {
    await AsyncStorage.setItem("@bc/deckSwipeHint", "not json");
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
  });

  it("recovers from a getItem rejection by treating it as default state", async () => {
    const spy = jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk error"));
    expect(await shouldPlayDeckSwipeHint()).toBe(true);
    spy.mockRestore();
  });
});
