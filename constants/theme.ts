/**
 * ─── Design tokens ──────────────────────────────────────────────────────
 *
 * The single source of truth for the app's typography, color, radius, and
 * spacing scale. Change a value here and every screen importing it picks
 * it up — no more hunting through 96 files of hardcoded StyleSheets.
 *
 * Typography pairing: DM Serif Display (headlines, brand moments) + DM
 * Sans (everything else) — the same pair used on the marketing/testing
 * pages (backchannelapp.netlify.app), chosen specifically to read as
 * deliberately designed rather than a generic system-font/Inter default.
 * DM Serif Display only ships as a single 400 weight (regular + italic —
 * it has no bold), which is the intended look: headlines get ELEGANT, not
 * heavy. Never use it below ~18px; it was drawn for display sizes and
 * gets muddy small — use Fonts.sans there instead.
 *
 * The app is pinned to light mode only (see app/_layout.tsx's ThemeProvider
 * comment) — Colors is a flat palette, not a light/dark pair.
 *
 * Fonts must be loaded before these family names resolve to anything —
 * see the useFonts() call in app/_layout.tsx. Until that resolves, RN
 * silently falls back to the platform default rather than erroring, so a
 * missing font shows as "looks like before" rather than a crash.
 */

/** Font families. Load these exact names via useFonts() before using them. */
export const Fonts = {
  /** Headlines and brand moments ONLY — see file header. No bold variant. */
  serif: "DMSerifDisplay_400Regular",
  /** The italic accent style used throughout the marketing pages for a
   * highlighted word inside a headline (e.g. "Welcome to *BackChannel*"). */
  serifItalic: "DMSerifDisplay_400Regular_Italic",
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansSemiBold: "DMSans_600SemiBold",
  sansBold: "DMSans_700Bold",
} as const;

/**
 * Named palette, mapped from the app's existing hardcoded grays (so
 * adopting these tokens in a screen is a same-color swap, not a redesign)
 * plus the warmer near-black/off-white the marketing pages use instead of
 * pure #000/#FFF.
 */
export const Colors = {
  ink: "#0A0A0A", // primary text/icons — was "#000"
  paper: "#FFFFFF", // primary background — was "#FFF"
  offWhite: "#FAFAF8", // input fills, subtle recessed surfaces — was "#F9F9F9"
  surface: "#F5F5F2", // cards, chips — was "#F0F0F0"/"#F5F5F5"
  border: "#E8E8E4", // hairlines — was "#EEE"/"#F0F0F0"
  borderStrong: "#D0D0CA", // focused/emphasized borders — was "#CCC"
  body: "#4A4A44", // secondary body copy — was "#666"
  muted: "#888880", // tertiary text, captions, italic accents — was "#999"
  faint: "#B8B8B0", // placeholders, disabled — was "#BBB"/"#AAA"
  danger: "#DC2626", // errors — unchanged, already the app's only red
} as const;

/** Border radii — the app's existing pill/card language, named. */
export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Spacing scale, 4px base — use for padding/gap/margin. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/**
 * Ready-made text styles combining family/size/weight/spacing so screens
 * spread these into a StyleSheet entry instead of re-declaring the
 * font trio every time:
 *
 *   title: { ...Type.display, color: Colors.ink }
 *
 * Sizes are fixed (RN has no viewport-relative clamp()) chosen to match
 * the mobile-width floor of the marketing pages' clamp() values.
 */
export const Type = {
  /** Biggest brand moments — splash wordmark, "Welcome to BackChannel". */
  display: {
    fontFamily: Fonts.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  /** Screen-level headlines — "Create your account", questionnaire questions. */
  title: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  /** Section/card headlines, modal titles. */
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** Standard body copy. */
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 21,
  },
  /** Captions, meta text, timestamps. */
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Form field labels, eyebrow text — pair with letterSpacing/uppercase
   * at the call site since usage varies (some are uppercase, some aren't). */
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
} as const;
