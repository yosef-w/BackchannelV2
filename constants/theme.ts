/**
 * BackChannel design tokens.
 *
 * Source of truth for the app's editorial monochrome identity (mirrors the
 * tester-site CSS at `--ink`, `--paper`, etc.). Every screen should reference
 * these tokens — not inline hex codes. If the same value appears in two views
 * and isn't here yet, it belongs here.
 *
 * Conventions:
 *  - Colors are warm-neutral, not pure black/white. `paper` is an off-white,
 *    `ink` is a near-black. Hairlines lean beige to feel like paper, not glass.
 *  - Typography is DM Sans (300–600) for body / UI, with DM Serif Display
 *    Italic as the single editorial accent (the "I'm a *Sponsor*" pattern).
 *    Use `fontFamily: Type.serifItalic` only on emphasized words inside
 *    sans-serif titles.
 *  - Spacing follows a 4-multiple scale.
 */

import { TextStyle } from "react-native";

// ── Color ───────────────────────────────────────────────────────────
export const Color = {
  ink: "#0a0a0a",
  paper: "#ffffff",
  offWhite: "#fafaf8",
  surface: "#f5f5f2",

  border: "#e8e8e4",
  borderStrong: "#d0d0ca",

  body: "#4a4a44",
  muted: "#888880",
  faint: "#b8b8b0",

  // Semantic — only for status, never as brand accent
  status: {
    okBg: "#f0fdf4",
    okText: "#15803d",
    okBorder: "#bbf7d0",

    warnBg: "#fffbeb",
    warnText: "#92400e",
    warnBorder: "#fde68a",

    blockBg: "#fef2f2",
    blockText: "#b91c1c",
    blockBorder: "#fecaca",

    infoBg: "#eff6ff",
    infoText: "#1d4ed8",
    infoBorder: "#bfdbfe",
  },
} as const;

// ── Typography ──────────────────────────────────────────────────────
// Font family names match the @expo-google-fonts/* module exports so we can
// reference them symbolically and have one place to swap if we ever change.
export const Type = {
  sans300: "DMSans_300Light",
  sans400: "DMSans_400Regular",
  sans500: "DMSans_500Medium",
  sans600: "DMSans_600SemiBold",
  // The italic of DM Serif Display is the editorial accent. The Google Fonts
  // package exports it as `DMSerifDisplay_400Regular_Italic` (long form).
  serifItalic: "DMSerifDisplay_400Regular_Italic",
} as const;

// Reusable text styles. Composable — use spread to extend, e.g.:
//   { ...Text.body, color: Color.muted }
// Keep these few and generic; screen-specific tweaks belong on the screen.
export const Text: Record<string, TextStyle> = {
  // The signature editorial display — large, serif italic, calm. Used inside
  // a HeroTitle as the emphasized word ("Welcome to *BackChannel*.").
  displayItalic: {
    fontFamily: Type.serifItalic,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1,
    color: Color.muted,
  },
  // Sans heading that pairs with displayItalic on the same line.
  display: {
    fontFamily: Type.sans400,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1,
    color: Color.ink,
  },
  // Section / page title (e.g. "Final thoughts.")
  title: {
    fontFamily: Type.sans600,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: Color.ink,
  },
  // Body copy — light by default, the website's signature 300 weight.
  body: {
    fontFamily: Type.sans300,
    fontSize: 16,
    lineHeight: 26,
    color: Color.body,
  },
  // Default UI text — medium weight for in-product chrome.
  ui: {
    fontFamily: Type.sans500,
    fontSize: 14,
    lineHeight: 20,
    color: Color.ink,
  },
  // Smaller meta / secondary lines (timestamps, captions).
  meta: {
    fontFamily: Type.sans500,
    fontSize: 12,
    lineHeight: 16,
    color: Color.muted,
  },
  // The tracked uppercase eyebrow used above titles.
  eyebrow: {
    fontFamily: Type.sans500,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    color: Color.muted,
    textTransform: "uppercase",
  },
};

// ── Space ───────────────────────────────────────────────────────────
// 4-multiple scale. Reach for these instead of arbitrary px.
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  screen: 28, // standard horizontal page padding
} as const;

// ── Radius ──────────────────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
  xxl: 24,
  sheet: 40, // bottom-sheet top corners — signature
  pill: 999,
} as const;

// ── Shadow ──────────────────────────────────────────────────────────
// Soft, paper-feel elevations. Never harsh. Spread as a style object.
export const Shadow = {
  // For floating cards / sheets — barely there, just enough to lift.
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 32,
    elevation: 4,
  },
  // For interactive elements that need to feel grabbable.
  press: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

// ── Motion ──────────────────────────────────────────────────────────
// Durations match the website's transitions for cross-platform consistency.
export const Motion = {
  fast: 150,
  base: 220,
  slow: 320,
  cinematic: 500,
} as const;
