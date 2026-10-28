// Stage layout for the sponsor deck's hero opening — pure, so it's testable.
//
// HomeView pins the Pass/Connect pills a fixed distance above the bottom
// of `cardStage` (the box that holds the scroll AND the floating pills) —
// and, while the tab bar is showing (the top of the scroll, which is where
// the opening is read), lifts them a further FLOATING_NAV_CLEARANCE to sit
// clear of it. So what's left above the pills at rest is
// `stageHeight - reserve`. The hero opening
// (role row + photo + stat ledger) is given exactly that much room, and the
// photo card's height is what's left after the role row and the ledger are
// measured — a plain number computed here and passed down, not left to
// flex (a flex-resolved height that changes after first layout left the
// photo and gradient layers drawn at a stale size). So the ledger's last
// row ends a clear gap above the pills on every device: a small phone (the
// photo shrinks to its floor), a Pro Max (it grows to its cap), iPad in
// either orientation or Split View (the stage is measured, never
// assumed), and large Dynamic Type (the pills stack, so the reserve grows;
// the role row and ledger are measured, so their growth is accounted for).
//
// Below the floor the pills can still overlap the ledger — a Slide Over
// sliver, or an accessibility size on a small phone — which is inherent to
// floating controls; the card scrolls, so nothing is ever unreachable.

/** The photo card's floor: one-line name + subline + room for the badge
 * (a longer name wraps and grows the card — it uses minHeight). */
export const HERO_MIN = 160;
/** ...and its cap: the Figma's tall portrait. Spare room on an iPad or a
 * Pro Max is left to the sections below instead of stretching the photo. */
export const HERO_MAX = 480;
/** The hero opening's top padding (SponsorApplicantCard's heroWrap). */
export const HERO_WRAP_PADDING_TOP = 8;
/** First-render guesses for the measured role row / ledger, so the photo
 * lands near its final height before the real numbers arrive. */
export const ROLE_ROW_ESTIMATE = 89;
export const LEDGER_ESTIMATE = 137;

/** Keep in sync with DecisionPills' `segment.minHeight`. */
export const SEGMENT_MIN_HEIGHT = 48;
/** Padding + hairline on both sides of the capsule (4pt pad + 1pt border,
 * top and bottom) — keep in sync with DecisionPills' `capsule`. */
export const CAPSULE_CHROME = 10;
/** Gap between the segments when they stack — keep in sync with
 * DecisionPills' `capsuleStacked.gap`. */
export const SEGMENT_STACK_GAP = 4;
/** Clear space between the ledger's last row and the top of the pills. */
export const PILLS_CLEARANCE = 18;
/**
 * How far HomeView lifts the pills above their resting spot while the tab
 * bar is visible (it slides away, and the pills drop into its place, as
 * the user scrolls). The hero is read at rest, so the reserve uses the
 * lifted position. One source for HomeView's animation and this math.
 */
export const FLOATING_NAV_CLEARANCE = 88;

/**
 * HomeView's `floatingActionsRow.bottom` — the pills' distance above the
 * stage's bottom edge. One source for the style and for the reserve below.
 */
export function floatingActionsBottom(platformOS: string): number {
  return platformOS === "ios" ? 28 : 20;
}

/** Height of the decision capsule: one row of two segments, or — at
 * accessibility text sizes — the two segments stacked inside it. */
export function pillsHeight(stacked: boolean): number {
  return (
    CAPSULE_CHROME +
    (stacked
      ? SEGMENT_MIN_HEIGHT * 2 + SEGMENT_STACK_GAP
      : SEGMENT_MIN_HEIGHT)
  );
}

/**
 * Space at the bottom of the stage the hero opening must keep clear: the
 * pills' resting offset, the tab-bar lift, the capsule itself, and a gap.
 */
export function pillsReserve(bottomOffset: number, stacked: boolean): number {
  return (
    bottomOffset +
    FLOATING_NAV_CLEARANCE +
    pillsHeight(stacked) +
    PILLS_CLEARANCE
  );
}

/**
 * Minimum height for the hero opening's wrapper. `stageHeight` is the
 * measured stage (null before the first layout → estimate from the window
 * so there's no visible jump when the real number arrives).
 */
export function heroOpeningMinHeight(
  stageHeight: number | null,
  windowHeight: number,
  reserve: number,
): number {
  const stage = stageHeight ?? Math.round(windowHeight * 0.72);
  return Math.max(0, Math.round(stage - reserve));
}

/**
 * The photo card's height: what the opening has (`openingHeight`) minus the
 * fixed top padding and the measured role row and ledger — clamped to the
 * card's floor and cap.
 */
export function heroPhotoHeight(
  openingHeight: number,
  roleRowHeight: number,
  ledgerHeight: number,
): number {
  const free =
    openingHeight - HERO_WRAP_PADDING_TOP - roleRowHeight - ledgerHeight;
  return Math.min(HERO_MAX, Math.max(HERO_MIN, Math.round(free)));
}
