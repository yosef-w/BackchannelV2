/**
 * ─── Responsive layout primitives ───────────────────────────────────────
 *
 * The single source of truth for "how wide may this get" and "what window
 * size are we in". Before this file the app was a phone layout stretched to
 * fit: 25 places froze `Dimensions.get("window")` at import (wrong after any
 * iPad rotation / Split View / Stage Manager resize) and nothing capped a
 * column's width, so an iPad Pro 13" got ~976pt-wide buttons and ~130
 * character text lines.
 *
 * RULES (also in CLAUDE.md — a test enforces the first one):
 *  1. NEVER call `Dimensions.get` — it is a snapshot that goes stale. Read
 *     the live size with `useResponsive()` / `useWindowDimensions()`.
 *  2. Prefer a static width CAP over a measurement. `contentColumn` etc. are
 *     plain style objects: they read no window size at all, work at every
 *     size including mid-resize, and are the safest possible fix for
 *     "this stretches too wide".
 *  3. Never derive page/slide width from the WINDOW when the thing lives in
 *     a padded or capped container — measure the container with `onLayout`.
 *  4. Height caps for sheets go through `sheetMaxHeight()` with the live
 *     window height — never a module-level constant.
 *
 * On a phone (≤ ~430pt) every cap below is larger than the screen, so none
 * of this changes anything on iPhone.
 */

import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";

/** Maximum widths, in points. */
export const Layout = {
  /** Reading / feed column: tab screens, profile hub, lists that stay
   * single-column on iPad. */
  contentMaxWidth: 640,
  /** Narrower column for form flows — auth, onboarding, questionnaires,
   * editors. Long inputs read badly past ~520. */
  formMaxWidth: 520,
  /** Bottom sheets and dialogs. */
  sheetMaxWidth: 600,
  /** Multi-column grids (job lists on iPad). */
  wideMaxWidth: 1040,
  /** The floating tab-bar capsule. */
  tabBarMaxWidth: 440,
  /** The toast pill. */
  toastMaxWidth: 480,
  /** Inbox pane in the two-pane Messages layout. */
  masterPaneWidth: 340,
} as const;

/** Window-width breakpoints, in points. */
export const Breakpoints = {
  /** iPad-class or larger. Phones (max 430), Slide Over (~320) and a 1/3
   * Split View stay below this and keep the phone layout exactly. */
  regular: 600,
  /** Wide enough for the two-pane Messages layout (iPad mini portrait = 744). */
  split: 720,
  /** Wide enough for 2-column grids (each column ≈ a phone card wide). */
  twoColumn: 700,
  /** Wide enough for 3-column grids (iPad Pro 11" landscape and up). */
  threeColumn: 1000,
} as const;

/** Apple's minimum comfortable touch target. */
export const MIN_TAP_TARGET = 44;

/**
 * Caps for `maxFontSizeMultiplier` on text that lives in FIXED geometry
 * (tab-bar labels, count badges, chips, stamps). Text that can grow with its
 * container should NOT be capped — that's what Dynamic Type is for. Prefer
 * converting a fixed `height` to `minHeight` first; cap only when the
 * geometry genuinely can't grow.
 */
export const FontScale = {
  /** Tab labels, count badges — the tightest boxes. */
  chrome: 1.2,
  /** Chips, pills, verdict-bar labels. */
  control: 1.35,
  /** Buttons/labels with a little slack. */
  label: 1.5,
} as const;

// ── Static column styles (read NO window size) ────────────────────────────

/** Centered reading column. Spread into a ScrollView `contentContainerStyle`
 * or a container's `style`. */
export const contentColumn = {
  width: "100%",
  maxWidth: Layout.contentMaxWidth,
  alignSelf: "center",
} as const;

/** Centered form column (auth / onboarding / questionnaires / editors). */
export const formColumn = {
  width: "100%",
  maxWidth: Layout.formMaxWidth,
  alignSelf: "center",
} as const;

/** Centered sheet/dialog column. */
export const sheetColumn = {
  width: "100%",
  maxWidth: Layout.sheetMaxWidth,
  alignSelf: "center",
} as const;

/** Wide column for multi-column grids. */
export const wideColumn = {
  width: "100%",
  maxWidth: Layout.wideMaxWidth,
  alignSelf: "center",
} as const;

// ── Pure helpers (unit-tested) ────────────────────────────────────────────

export interface ResponsiveInfo {
  width: number;
  height: number;
  isLandscape: boolean;
  /** iPad-class width (≥ Breakpoints.regular). */
  isRegular: boolean;
  /** Wide enough for master–detail (≥ Breakpoints.split). */
  isSplit: boolean;
  /** Grid columns for list-of-cards screens: 1 phone, 2 iPad portrait, 3
   * iPad landscape. */
  columns: 1 | 2 | 3;
}

/** Grid column count for a given available width. */
export function columnsForWidth(width: number): 1 | 2 | 3 {
  if (width >= Breakpoints.threeColumn) return 3;
  if (width >= Breakpoints.twoColumn) return 2;
  return 1;
}

/**
 * Everything a screen needs to know about its window, as pure data.
 *
 * `isTablet` defaults to the real device class (`Platform.isPad`) and only
 * needs to be passed explicitly in a test. It exists because `isSplit`
 * can't be decided from width alone: this app is orientation-locked to
 * portrait on iPhone via `app.json`, but a few full-screen Modals in the
 * Messages/referral flow opt back into landscape (`supportedOrientations`),
 * and iOS lets that Modal's rotation carry to the whole app window. Rotated,
 * a Pro-Max-class iPhone is ~930pt wide — past `Breakpoints.split` — so a
 * width-only check would flip the iPad-only master–detail Messages layout
 * on for a phone. Gating on device class as well keeps that rotated-phone
 * case on the phone layout, the only one the split view was built for.
 */
export function getResponsiveInfo(
  width: number,
  height: number,
  isTablet: boolean = Platform.OS === "ios" && Boolean(Platform.isPad),
): ResponsiveInfo {
  return {
    width,
    height,
    isLandscape: width > height,
    isRegular: width >= Breakpoints.regular,
    isSplit: isTablet && width >= Breakpoints.split,
    columns: columnsForWidth(width),
  };
}

/**
 * Width of one grid cell: `columns` cells with `gap` between them fill
 * `containerWidth`. Floors so rounding can never push the last cell onto a
 * new row.
 */
export function gridItemWidth(
  containerWidth: number,
  columns: number,
  gap: number,
): number {
  const cols = Math.max(1, Math.floor(columns));
  return Math.max(0, Math.floor((containerWidth - gap * (cols - 1)) / cols));
}

/**
 * Max height for a bottom sheet: `fraction` of the LIVE window height, but
 * never so tall the sheet's top (handle, close button) leaves the window.
 * Pass `useWindowDimensions().height`. This replaces the old
 * `SCREEN_HEIGHT * 0.88` module constants, which froze at launch and cropped
 * the tops off sheets after a rotation or a shorter Stage Manager window.
 */
export function sheetMaxHeight(windowHeight: number, fraction = 0.88): number {
  const cap = windowHeight - 60; // status-bar / grabber breathing room
  return Math.max(0, Math.min(windowHeight * fraction, cap));
}

/**
 * Symmetric `hitSlop` that grows a small control's touch area to at least
 * 44×44. For a 24×24 icon: `{top:10,bottom:10,left:10,right:10}`.
 */
export function hitSlopTo44(width: number, height: number) {
  const dx = Math.max(0, Math.ceil((MIN_TAP_TARGET - width) / 2));
  const dy = Math.max(0, Math.ceil((MIN_TAP_TARGET - height) / 2));
  return { top: dy, bottom: dy, left: dx, right: dx };
}

// ── Hooks ─────────────────────────────────────────────────────────────────

/** Live window info. Re-renders on rotation, Split View and Stage Manager
 * resize (it is `useWindowDimensions` underneath). */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getResponsiveInfo(width, height), [width, height]);
}

/** Live `maxHeight` for a sheet — see `sheetMaxHeight`. */
export function useSheetMaxHeight(fraction = 0.88): number {
  const { height } = useWindowDimensions();
  return sheetMaxHeight(height, fraction);
}
