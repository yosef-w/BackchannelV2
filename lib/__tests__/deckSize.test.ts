import { DAILY_DECK_SIZE, getDeckSize } from "@/constants/config";

describe("deck size", () => {
  it("is 10 free and 30 for members, matching the backend's pack sizes", () => {
    expect(getDeckSize(false)).toBe(10);
    expect(getDeckSize(true)).toBe(30);
    expect(DAILY_DECK_SIZE).toEqual({ free: 10, premium: 30 });
  });
});
