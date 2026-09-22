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
  /** The marketing pages' body-copy weight (hero-body, final-sub, etc.). */
  sansLight: "DMSans_300Light",
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
  // Tertiary TEXT: captions, timestamps, placeholders, italic accents.
  // Contrast (WCAG 1.4.3, needs 4.5:1): 5.37 on white, 4.91 on `surface`.
  // Was #888880 = 3.57:1 on white — failed on 312 usages. NEVER put this on
  // a dark (ink) surface — 3.69:1 there; use `mutedOnInk` instead.
  muted: "#6B6B64",
  // Text/icons on INK (dark) surfaces — toasts, ink pills. 5.54:1 on ink.
  // (The previous `muted` value, kept for exactly this role.)
  mutedOnInk: "#888880",
  // NON-TEXT only: disabled controls, decorative icons, quiet dividers. It
  // clears 3:1 on white (3.48) but NOT 4.5:1, so it must never carry
  // meaningful text or a placeholder — use `muted` for those. Was #B8B8B0 =
  // 2.00:1, which failed even the non-text 3:1 bar.
  faint: "#8A8A82",
  // Errors. Darkened from #DC2626 (4.42:1 on `surface`, 4.41 on dangerLight —
  // both under 4.5) to 5.25 / 5.24; white-on-danger buttons rise 4.83 → 5.74.
  danger: "#C81E1E",
  dangerLight: "#FEF2F2", // error/destructive tint fill (badges, warning cards) — was ad hoc "#FEF2F2"/"#FECACA" scattered across jobs/matches/profile
  warning: "#B45309", // in-progress/near-limit indicators (e.g. char counters) — was ad hoc "#D97706"
} as const;

/**
 * Border radii — the app's existing pill/card language, named.
 * `xl` (20) doubles as the standard bottom-sheet top-corner radius — every
 * sheet/modal should use it rather than inventing its own (audit found 14,
 * 24, 28, 32, and 40 all in use for the same role before this was fixed).
 */
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

/**
 * Spread into every single-line TextInput's style. Android reserves extra
 * vertical space for font ascent/descent by default (`includeFontPadding`)
 * and has no built-in vertical centering without `textAlignVertical` —
 * without both, a single-line input in a height-constrained box renders its
 * text/placeholder pushed down, clipping at the bottom in tight cases. Both
 * properties are Android-only and harmless no-ops on iOS, so this is safe
 * to apply unconditionally rather than platform-branching at each call site.
 *
 * This was independently discovered and fixed the same way in ~7 different
 * screens before being pulled out here (see PromptsIntake.tsx's and
 * ApplicantJobsBrowseView.tsx's searchInput for two of the original finds) —
 * new single-line inputs should spread this instead of re-deriving it.
 *
 * Deliberately doesn't set `paddingVertical` — some inputs are centered by
 * an owning wrapper's fixed height (set `paddingVertical: 0` on the input
 * in that case) and others own their own vertical padding directly; this
 * fix is correct either way, so it stays out of callers' padding decisions.
 * NOT for multiline inputs — those want `textAlignVertical: "top"` instead,
 * which this would override.
 */
export const AndroidInputFix = {
  textAlignVertical: "center" as const,
  includeFontPadding: false,
};
