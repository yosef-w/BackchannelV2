import { Colors } from "../theme";

// WCAG 2.x relative luminance / contrast ratio.
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("text contrast tokens", () => {
  it("mutedOnInk passes 4.5:1 on ink (toast Dismiss)", () => {
    expect(ratio(Colors.mutedOnInk, Colors.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it("muted (placeholders) passes 4.5:1 on paper, offWhite and surface", () => {
    for (const bg of [Colors.paper, Colors.offWhite, Colors.surface]) {
      expect(ratio(Colors.muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("muted is NOT safe on ink, which is why mutedOnInk exists", () => {
    expect(ratio(Colors.muted, Colors.ink)).toBeLessThan(4.5);
  });
});
