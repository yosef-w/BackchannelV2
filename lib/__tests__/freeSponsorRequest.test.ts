jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  hasUsedFreeSponsorRequest,
  markFreeSponsorRequestUsed,
} from "../freeSponsorRequest";

describe("freeSponsorRequest", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("starts unused on a fresh install", async () => {
    expect(await hasUsedFreeSponsorRequest()).toBe(false);
  });

  it("stays used once marked", async () => {
    await markFreeSponsorRequestUsed();
    expect(await hasUsedFreeSponsorRequest()).toBe(true);
    expect(await hasUsedFreeSponsorRequest()).toBe(true);
  });

  it("fails closed when storage is unreadable", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk"));
    expect(await hasUsedFreeSponsorRequest()).toBe(true);
  });
});
