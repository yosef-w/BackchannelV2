jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHeldLikes, holdLike, releaseHeldLikes, type HeldLike } from "../heldLikes";

const stripe: HeldLike = {
  id: "j1",
  kind: "job",
  title: "Backend Engineer",
  sub: "Stripe",
  image: null,
};
const figma: HeldLike = { ...stripe, id: "j2", sub: "Figma" };

describe("heldLikes", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-25T12:00:00"));
  });
  afterEach(() => jest.useRealTimers());

  it("starts empty", async () => {
    expect(await getHeldLikes("applicant")).toEqual([]);
  });

  it("holds, dedupes, and keeps roles separate", async () => {
    await holdLike("applicant", stripe);
    await holdLike("applicant", stripe);
    const list = await holdLike("applicant", figma);
    expect(list.map((h) => h.id)).toEqual(["j1", "j2"]);
    expect(await getHeldLikes("sponsor")).toEqual([]);
  });

  it("releases by id", async () => {
    await holdLike("applicant", stripe);
    await holdLike("applicant", figma);
    const left = await releaseHeldLikes("applicant", ["j1"]);
    expect(left.map((h) => h.id)).toEqual(["j2"]);
    expect((await getHeldLikes("applicant")).map((h) => h.id)).toEqual(["j2"]);
  });

  it("forgets yesterday's holds at local midnight", async () => {
    await holdLike("applicant", stripe);
    jest.setSystemTime(new Date("2026-09-26T00:00:01"));
    expect(await getHeldLikes("applicant")).toEqual([]);
  });
});
