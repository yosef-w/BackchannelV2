// Where to crop the hero's profile photo — pure, so it's testable.
//
// Every profile photo is cropped SQUARE by its owner at upload
// (`allowsEditing: true, aspect: [1, 1]` in both pickers), but the hero shows
// it in a box that's wider than tall (~370 × 260–290). `cover` therefore
// crops the top and bottom of the square. Pinned to the top (what it used
// to do) it kept the sky above a head and cut the bottom ~25% — which put a
// typical face about 58% of the way down the card, exactly under the name
// overlay, so the chin disappeared behind the name.
//
// We have no face detection in the binary (a native dependency would block
// OTA), so this positions the crop from what we DO know: the photo's real
// shape (read when it loads) and where a face usually sits in a photo of
// that shape. The assumed face centre is placed at FACE_TARGET_Y of the
// card — above the overlay, which starts around 70% down.
//
// When a real focal point is available (explicit `focus`, e.g. from a
// future face-aware upload) it replaces the guess and the clamp is lifted.

export interface PhotoFocus {
  /** 0–1 across the photo's width. */
  x: number;
  /** 0–1 down the photo's height. */
  y: number;
}

/** Where the face centre should land in the card (0 = top, 1 = bottom): high
 * enough that the chin clears the name overlay, low enough to keep headroom. */
export const FACE_TARGET_Y = 0.38;
/** Assumed face centre in a square / landscape photo (a selfie-style crop
 * with a little headroom — measured on a real deck photo: 0.44). */
const FACE_Y_SQUARE = 0.42;
/** …and in a tall portrait, where faces ride higher. */
const FACE_Y_PORTRAIT = 0.34;
/** Photos taller than this aspect (w/h) count as portrait. */
const PORTRAIT_ASPECT = 0.85;
/** Without real focal data, never slide the crop past this fraction of the
 * overflow — a wrong guess then costs headroom, not a forehead. */
const GUESSED_MAX_TOP = 0.6;

export interface PhotoPosition {
  top: string;
  left: string;
}

const CENTER: PhotoPosition = { top: "50%", left: "50%" };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** The face centre we assume for a photo of this aspect (w/h). */
export function assumedFocus(aspect: number): PhotoFocus {
  return { x: 0.5, y: aspect < PORTRAIT_ASPECT ? FACE_Y_PORTRAIT : FACE_Y_SQUARE };
}

/**
 * `contentPosition` for a `cover`-fit image. Percentages follow CSS
 * `object-position`: p% aligns the image's p% point with the box's p% point,
 * so 0% is top/left-aligned and 100% bottom/right-aligned.
 */
export function heroPhotoPosition(args: {
  imgW: number;
  imgH: number;
  boxW: number;
  boxH: number;
  focus?: PhotoFocus;
}): PhotoPosition {
  const { imgW, imgH, boxW, boxH, focus } = args;
  if (!(imgW > 0 && imgH > 0 && boxW > 0 && boxH > 0)) return CENTER;

  // `cover` scales until BOTH dimensions fill the box.
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const overflowX = scaledW - boxW;
  const overflowY = scaledH - boxH;

  const f = focus ?? assumedFocus(imgW / imgH);

  // Nothing is cropped along an axis that doesn't overflow.
  let left = 0.5;
  let top = 0.5;
  if (overflowX > 0.5) {
    // Put the focal x on the box's horizontal centre.
    left = clamp((f.x * scaledW - 0.5 * boxW) / overflowX, 0, 1);
  }
  if (overflowY > 0.5) {
    // Put the focal y at FACE_TARGET_Y of the box.
    top = clamp(
      (f.y * scaledH - FACE_TARGET_Y * boxH) / overflowY,
      0,
      focus ? 1 : GUESSED_MAX_TOP,
    );
  }
  return { top: pct(top), left: pct(left) };
}
