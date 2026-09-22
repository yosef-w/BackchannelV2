import {
  Breakpoints,
  columnsForWidth,
  getResponsiveInfo,
  gridItemWidth,
  hitSlopTo44,
  sheetMaxHeight,
} from "../responsive";

describe("columnsForWidth", () => {
  it("stays single-column below the two-column breakpoint", () => {
    expect(columnsForWidth(375)).toBe(1); // iPhone
    expect(columnsForWidth(320)).toBe(1); // Slide Over
    expect(columnsForWidth(Breakpoints.twoColumn - 1)).toBe(1);
  });

  it("goes two-column at the iPad-portrait breakpoint", () => {
    expect(columnsForWidth(Breakpoints.twoColumn)).toBe(2);
    expect(columnsForWidth(820)).toBe(2); // iPad 10th gen portrait
  });

  it("goes three-column at the iPad-landscape breakpoint", () => {
    expect(columnsForWidth(Breakpoints.threeColumn)).toBe(3);
    expect(columnsForWidth(1376)).toBe(3); // iPad Pro 13" landscape
  });
});

describe("getResponsiveInfo", () => {
  it("flags a phone as neither regular nor split", () => {
    const info = getResponsiveInfo(393, 852);
    expect(info.isRegular).toBe(false);
    expect(info.isSplit).toBe(false);
    expect(info.isLandscape).toBe(false);
    expect(info.columns).toBe(1);
  });

  it("flags an iPad mini portrait as regular and split-capable", () => {
    const info = getResponsiveInfo(744, 1133, true);
    expect(info.isRegular).toBe(true);
    expect(info.isSplit).toBe(true);
    expect(info.columns).toBe(2);
  });

  it("never enters split (master–detail) on a phone, even at iPad-class width", () => {
    // A Pro-Max-class iPhone in landscape (reachable today: several Modals
    // in the Messages/referral flow opt into landscape via
    // `supportedOrientations`, and iOS can carry that rotation to the whole
    // app window even though app.json locks portrait) is ~930pt wide — past
    // Breakpoints.split. The master–detail Messages layout must still stay
    // off, because it was only ever built and tested for iPad.
    const info = getResponsiveInfo(932, 430, false);
    expect(info.isRegular).toBe(true); // continuous scaling is still fine
    expect(info.isSplit).toBe(false); // the layout SWITCH must not fire
  });

  it("defaults isTablet from the real device (Platform.isPad)", () => {
    // No explicit third argument: on this test's iOS/non-pad Platform mock,
    // a wide window must not be treated as split-capable.
    const info = getResponsiveInfo(744, 1133);
    expect(info.isSplit).toBe(false);
  });

  it("detects landscape purely from width > height", () => {
    expect(getResponsiveInfo(1180, 820).isLandscape).toBe(true);
    expect(getResponsiveInfo(820, 1180).isLandscape).toBe(false);
  });

  it("does not misclassify Split View 1/3 as regular", () => {
    // iPad in a 1/3 Split View reports a narrow window — the app must
    // keep the phone layout there even though the DEVICE is an iPad.
    const info = getResponsiveInfo(320, 1180);
    expect(info.isRegular).toBe(false);
    expect(info.columns).toBe(1);
  });
});

describe("gridItemWidth", () => {
  it("divides evenly with no gap", () => {
    expect(gridItemWidth(400, 2, 0)).toBe(200);
  });

  it("accounts for gaps between columns, not around them", () => {
    // 3 columns, 2 gaps of 12 inside a 636-wide container.
    expect(gridItemWidth(636, 3, 12)).toBe(204);
  });

  it("floors so 3 equal cells can never sum past the container", () => {
    const width = gridItemWidth(1000, 3, 16);
    expect(3 * width + 2 * 16).toBeLessThanOrEqual(1000);
  });

  it("never returns negative width for a too-small container", () => {
    expect(gridItemWidth(10, 3, 16)).toBe(0);
  });
});

describe("sheetMaxHeight", () => {
  it("uses the given fraction of window height on a tall window", () => {
    // 1180 * 0.88 = 1038.4, well under the 1120 safety cap (1180-60).
    expect(sheetMaxHeight(1180, 0.88)).toBeCloseTo(1038.4);
  });

  it("never exceeds window height minus the top safety margin", () => {
    // A short window (e.g. landscape iPad mini, or Stage Manager) — 0.88
    // of 500 is 440, which is fine, but at 0.98 the fraction would exceed
    // the cap and must be clamped.
    const height = 500;
    const result = sheetMaxHeight(height, 0.98);
    expect(result).toBeLessThanOrEqual(height - 60);
  });

  it("is never negative even for a tiny window", () => {
    expect(sheetMaxHeight(30)).toBeGreaterThanOrEqual(0);
  });

  it("defaults to the 0.88 fraction used throughout the app", () => {
    expect(sheetMaxHeight(1000)).toBeCloseTo(880);
  });
});

describe("hitSlopTo44", () => {
  it("adds nothing to a control already at 44pt", () => {
    expect(hitSlopTo44(44, 44)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("pads a small square icon symmetrically up to 44pt", () => {
    // 24pt icon needs 10pt on each side: 24 + 10 + 10 = 44.
    expect(hitSlopTo44(24, 24)).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
  });

  it("pads width and height independently for a non-square control", () => {
    expect(hitSlopTo44(14, 30)).toEqual({
      left: 15,
      right: 15,
      top: 7,
      bottom: 7,
    });
  });

  it("never returns negative padding for a control already larger than 44pt", () => {
    expect(hitSlopTo44(60, 60)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
