/**
 * Hero photo framing must keep faces in view across the photo shapes we meet:
 *   1. the square crops every upload produces land near-centre — not pinned
 *      to the top, which put the chin under the name overlay
 *   2. a taller portrait slides the crop up (faces ride higher there)
 *   3. a wide photo is cropped horizontally, on the focal x
 *   4. an explicit focal point beats the guess and lifts the safety clamp
 *   5. nothing is cropped on an axis that doesn't overflow; bad input is safe
 */

import { FACE_TARGET_Y, assumedFocus, heroPhotoPosition } from "../photoFraming";

const num = (s: string) => parseFloat(s);
// The hero box on an iPhone 17: 370 wide, ~280 tall.
const BOX = { boxW: 370, boxH: 280 };

describe("heroPhotoPosition — square uploads (the common case)", () => {
  it("lands near-centre, slightly high, instead of pinned to the top", () => {
    const p = heroPhotoPosition({ imgW: 340, imgH: 342, ...BOX });
    expect(num(p.top)).toBeGreaterThan(45);
    expect(num(p.top)).toBeLessThan(62);
    expect(p.left).toBe("50%");
  });

  it("puts the assumed face centre at the target height of the card", () => {
    const { top } = heroPhotoPosition({ imgW: 1000, imgH: 1000, ...BOX });
    const scaled = 370; // square scaled to the box width
    const overflow = scaled - BOX.boxH;
    const offset = (num(top) / 100) * overflow;
    const faceInCard = (assumedFocus(1).y * scaled - offset) / BOX.boxH;
    expect(faceInCard).toBeCloseTo(FACE_TARGET_Y, 1);
  });

  it("keeps the face centre of the measured deck photo above the name overlay", () => {
    // Real photo: 340×342, face centre ≈ 0.44, chin ≈ 0.60 of the height.
    const { top } = heroPhotoPosition({ imgW: 340, imgH: 342, ...BOX });
    const scaledH = 342 * (370 / 340);
    const offset = (num(top) / 100) * (scaledH - BOX.boxH);
    const chinInCard = (0.6 * scaledH - offset) / BOX.boxH;
    const headTopInCard = (0.27 * scaledH - offset) / BOX.boxH;
    expect(chinInCard).toBeLessThan(0.68); // the name block starts ≈ 70% down
    expect(headTopInCard).toBeGreaterThan(0.05); // and the head isn't clipped
  });
});

describe("heroPhotoPosition — other shapes", () => {
  it("slides a tall portrait's crop upward (faces ride higher)", () => {
    const portrait = heroPhotoPosition({ imgW: 3000, imgH: 4000, ...BOX });
    const square = heroPhotoPosition({ imgW: 1000, imgH: 1000, ...BOX });
    expect(num(portrait.top)).toBeLessThan(num(square.top));
    expect(num(portrait.top)).toBeGreaterThanOrEqual(0);
  });

  it("crops a panorama horizontally, centred", () => {
    const p = heroPhotoPosition({ imgW: 1600, imgH: 900, ...BOX });
    expect(p.left).toBe("50%");
    expect(p.top).toBe("50%"); // height fits exactly — nothing to crop
  });

  it("does not crop an axis that fits", () => {
    const p = heroPhotoPosition({ imgW: 370, imgH: 280, ...BOX });
    expect(p).toEqual({ top: "50%", left: "50%" });
  });

  it("falls back to centre on bad dimensions", () => {
    expect(heroPhotoPosition({ imgW: 0, imgH: 0, ...BOX })).toEqual({
      top: "50%",
      left: "50%",
    });
    expect(heroPhotoPosition({ imgW: 100, imgH: 100, boxW: 0, boxH: 0 })).toEqual({
      top: "50%",
      left: "50%",
    });
  });
});

describe("heroPhotoPosition — the safety clamp and explicit focus", () => {
  it("never slides a GUESSED crop past 60% of the overflow", () => {
    // A near-square box leaves little overflow, so the raw ratio explodes.
    const p = heroPhotoPosition({ imgW: 1000, imgH: 1000, boxW: 370, boxH: 350 });
    expect(num(p.top)).toBeLessThanOrEqual(60);
  });

  it("lets an explicit focal point go further, and honours its x", () => {
    const guessed = heroPhotoPosition({ imgW: 1000, imgH: 1000, boxW: 370, boxH: 350 });
    const explicit = heroPhotoPosition({
      imgW: 1000,
      imgH: 1000,
      boxW: 370,
      boxH: 350,
      focus: { x: 0.5, y: 0.6 },
    });
    expect(num(explicit.top)).toBeGreaterThan(num(guessed.top));
  });

  it("clamps an explicit focus that would push the crop off the top", () => {
    const p = heroPhotoPosition({
      imgW: 3000,
      imgH: 4000,
      ...BOX,
      focus: { x: 0.5, y: 0.1 },
    });
    expect(p.top).toBe("0%");
  });

  it("follows an explicit focal x on a wide photo", () => {
    const left = heroPhotoPosition({
      imgW: 1600,
      imgH: 900,
      ...BOX,
      focus: { x: 0.2, y: 0.4 },
    });
    expect(num(left.left)).toBeLessThan(50);
  });
});
