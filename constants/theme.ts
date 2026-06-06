import { Platform } from "react-native";

// ─── Legacy exports (kept for backwards compatibility) ────────────────────────
// These are used by `components/themed-text.tsx`, `components/themed-view.tsx`,
// and `components/ui/collapsible.tsx`. Do not remove until those consumers are
// migrated to the new `tokens` design system below.

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── New design system tokens ────────────────────────────────────────────────
// Ported from the BackChannel beta-tester site. Single source of truth for
// the redesign. Import from screens via `import { tokens } from "@/constants/theme"`.

// Color palette ----------------------------------------------------------------

export const palette = {
  // Neutrals — the editorial paper-and-ink ladder
  ink: "#0a0a0a",
  paper: "#ffffff",
  offWhite: "#fafaf8",
  surface: "#f5f5f2",
  border: "#e8e8e4",
  borderStrong: "#d0d0ca",
  body: "#4a4a44",
  muted: "#888880",
  faint: "#b8b8b0",

  // Status / accent (used by pills and toasts). Each has a soft bg, a strong
  // text colour, and a matching border so they read flat on paper.
  successBg: "#f0fdf4",
  successFg: "#15803d",
  successBorder: "#bbf7d0",

  warningBg: "#fffbeb",
  warningFg: "#92400e",
  warningBorder: "#fde68a",

  dangerBg: "#fef2f2",
  dangerFg: "#b91c1c",
  dangerBorder: "#fecaca",

  infoBg: "#eff6ff",
  infoFg: "#1d4ed8",
  infoBorder: "#bfdbfe",

  // Pulse dot used on "live / in beta" indicators
  live: "#22c55e",
} as const;

// Semantic colour aliases ------------------------------------------------------
// Screens should generally use these instead of palette tokens directly, so we
// can swap the underlying values without grepping the codebase.

export const colors = {
  text: palette.ink,
  textBody: palette.body,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textOnInk: palette.paper,

  bg: palette.paper,
  bgOffWhite: palette.offWhite,
  bgSurface: palette.surface,

  border: palette.border,
  borderStrong: palette.borderStrong,

  brand: palette.ink,
  brandText: palette.paper,

  // Semantic status (use for pills, toasts, banners)
  successBg: palette.successBg,
  successFg: palette.successFg,
  successBorder: palette.successBorder,

  warningBg: palette.warningBg,
  warningFg: palette.warningFg,
  warningBorder: palette.warningBorder,

  dangerBg: palette.dangerBg,
  dangerFg: palette.dangerFg,
  dangerBorder: palette.dangerBorder,

  infoBg: palette.infoBg,
  infoFg: palette.infoFg,
  infoBorder: palette.infoBorder,

  live: palette.live,
} as const;

// Typography -------------------------------------------------------------------
// Font family strings line up 1:1 with the postscript names exported by the
// @expo-google-fonts packages. Loaded once in app/_layout.tsx.

export const fontFamilies = {
  // DM Sans weights
  sans300: "DMSans_300Light",
  sans300Italic: "DMSans_300Light_Italic",
  sans400: "DMSans_400Regular",
  sans400Italic: "DMSans_400Regular_Italic",
  sans500: "DMSans_500Medium",
  sans500Italic: "DMSans_500Medium_Italic",
  sans600: "DMSans_600SemiBold",
  sans600Italic: "DMSans_600SemiBold_Italic",

  // DM Serif Display only ships regular + italic
  serif: "DMSerifDisplay_400Regular",
  serifItalic: "DMSerifDisplay_400Regular_Italic",
} as const;

// Curated text styles ----------------------------------------------------------
// Each entry is a complete set of style props you can spread onto a Text. The
// names mirror the roles used on the site (eyebrow / hero / body / muted etc.)
// so the screens read close to the HTML.

export const typography = {
  // Editorial serif headings — the signature look. Italic variant is used for
  // the muted "accent" half of a two-line headline.
  heroSerif: {
    fontFamily: fontFamilies.serif,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.9,
    color: colors.text,
  },
  heroSerifItalic: {
    fontFamily: fontFamilies.serifItalic,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.9,
    color: colors.textMuted,
  },
  titleSerif: {
    fontFamily: fontFamilies.serif,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.text,
  },
  titleSerifItalic: {
    fontFamily: fontFamilies.serifItalic,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.textMuted,
  },

  // Sans display — used for section titles, card titles, list rows etc.
  sectionTitle: {
    fontFamily: fontFamilies.sans600,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.text,
  },
  cardTitle: {
    fontFamily: fontFamilies.sans600,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: colors.text,
  },

  // Body text — DM Sans 300 for the airy intro paragraphs, 400 for general
  // copy. Match the website's hero-body vs. role-desc distinction.
  bodyLarge: {
    fontFamily: fontFamilies.sans300,
    fontSize: 17,
    lineHeight: 28,
    color: colors.textBody,
  },
  body: {
    fontFamily: fontFamilies.sans400,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textBody,
  },
  bodySmall: {
    fontFamily: fontFamilies.sans400,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textBody,
  },
  bodyMuted: {
    fontFamily: fontFamilies.sans400,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },

  // Eyebrow — the uppercase 11px label that introduces sections on the site.
  eyebrow: {
    fontFamily: fontFamilies.sans500,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    color: colors.textMuted,
  },

  // Pill text — small 10/11px label inside pills, badges, status chips
  pillLabel: {
    fontFamily: fontFamilies.sans600,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
  },

  // Button label
  buttonPrimary: {
    fontFamily: fontFamilies.sans600,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.15,
    color: colors.brandText,
  },
  buttonGhost: {
    fontFamily: fontFamilies.sans500,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.1,
    color: colors.textMuted,
  },

  // Faint metadata — timestamps, counts, "Coming soon"
  meta: {
    fontFamily: fontFamilies.sans400,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textFaint,
  },
} as const;

// Spacing scale ---------------------------------------------------------------
// 4px grid, names match common shorthand. Use these instead of magic numbers
// so vertical rhythm stays consistent across screens.

export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  sm: 12,
  m: 16,
  ml: 20,
  l: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
  hero: 72,
} as const;

// Radii -----------------------------------------------------------------------

export const radii = {
  none: 0,
  xs: 5,
  s: 10,
  m: 12,
  ml: 14,
  l: 20,
  xl: 24,
  pill: 999,
} as const;

// Borders ---------------------------------------------------------------------

export const borders = {
  hairline: 1,
  strong: 1.5,
} as const;

// Layout constants ------------------------------------------------------------

export const layout = {
  // Matches the hero / main content max-width on the site
  contentMaxWidth: 660,
  screenPaddingH: 20,
  screenPaddingHTablet: 40,
} as const;

// Animation timing ------------------------------------------------------------

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  hero: 600,
} as const;

// Master export ---------------------------------------------------------------

export const tokens = {
  palette,
  colors,
  fontFamilies,
  typography,
  spacing,
  radii,
  borders,
  layout,
  motion,
} as const;

export type Tokens = typeof tokens;
