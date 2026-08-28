// Styles for the "Skim & Dive" deck (PlateDeck / PlateViews). Paper-and-
// ink only, DM Serif for anything that speaks, DM Sans for labels — the
// same vocabulary as the full read ledger and the cinema films, sized for a
// full-bleed plate ~360pt wide.

import { StyleSheet } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

/**
 * The decide band: the floating ✕/✓ sit at bottom 28 and are 64pt tall.
 * The plate row fills the whole stage (so nothing peeks up on first view),
 * but every plate composes its content above this band, and the read cue
 * lives INSIDE it — centred between the two buttons, the one strip of the
 * band that is always free.
 */
export const DECIDE_BAND = 28 + 64 + 20;
export const DECIDE_BAND_BOTTOM = 28;
export const DECIDE_BAND_HEIGHT = 64;
/** The pinned identity strip (plate two onward, and through the full read). */
export const ANCHOR_HEIGHT = 66;

export const plateStyles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  rowWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.paper,
  },

  // ── a plate ───────────────────────────────────────────────────────────
  plate: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 26,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  plateUnderAnchor: { paddingTop: ANCHOR_HEIGHT + 6 },
  plateBody: { alignItems: "center", width: "100%" },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.muted,
    textAlign: "center",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    marginTop: 18,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 14,
  },
  avatarInitial: { fontFamily: Fonts.serif, fontSize: 34, color: Colors.paper },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.4,
    color: Colors.ink,
    textAlign: "center",
  },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.body,
    marginTop: 6,
    textAlign: "center",
  },
  claim: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 31,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 12,
  },
  // The italic-muted accent inside any serif line — the app's em rule.
  accent: { fontFamily: Fonts.serifItalic, color: Colors.muted },

  statRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  stat: {
    fontFamily: Fonts.serif,
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -1,
    color: Colors.ink,
  },
  statSuffix: { fontFamily: Fonts.serifItalic, fontSize: 38, color: Colors.muted },
  statline: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 8,
  },
  rule: {
    width: 36,
    height: 1,
    backgroundColor: Colors.muted,
    opacity: 0.5,
    marginVertical: 16,
  },
  receipt: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.body,
    textAlign: "center",
    marginTop: 8,
  },
  quote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 25,
    lineHeight: 34,
    color: Colors.ink,
    textAlign: "center",
  },
  attribution: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 18,
  },
  logoWrap: { marginTop: 18, marginBottom: 14 },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.4,
    color: Colors.ink,
    textAlign: "center",
  },
  roleSub: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 25,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 12,
  },
  ledger: {
    width: "100%",
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  vouchStatement: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 31,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 14,
  },
  vouchId: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  vouchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  vouchAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  vouchAvatarInitial: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.paper },
  vouchName: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: Colors.ink },
  vouchRole: { fontFamily: Fonts.sans, fontSize: 12.5, color: Colors.body, marginTop: 2 },
  vouchQuote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 18.5,
    lineHeight: 27,
    color: Colors.ink,
    textAlign: "center",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: Colors.ink,
  },
  chipFill: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipFillText: { color: Colors.paper },
  fitLine: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 14,
  },
  // A brief — one or two sentences of prose, read left-to-right like
  // prose should be, inside the centred composition.
  brief: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 28,
    color: Colors.ink,
    textAlign: "left",
    width: "100%",
    marginTop: 16,
  },
  // In-flow under the placard's claim — the slide affordance, never
  // positioned where the chrome could cover it.
  slideHint: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 24,
  },
  // The read cue — centred in the decide band between ✕ and ✓.
  readCue: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: DECIDE_BAND_BOTTOM,
    height: DECIDE_BAND_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  readCueText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.body,
    textAlign: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // ── the anchor strip ──────────────────────────────────────────────────
  anchor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ANCHOR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 3,
  },
  anchorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: Colors.surface,
  },
  anchorAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  anchorAvatarInitial: { fontFamily: Fonts.serif, fontSize: 17, color: Colors.paper },
  anchorText: { flex: 1, minWidth: 0 },
  anchorName: { fontFamily: Fonts.serif, fontSize: 18, lineHeight: 22, color: Colors.ink },
  anchorClaim: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13.5,
    lineHeight: 17,
    color: Colors.muted,
    marginTop: 2,
  },
  anchorPos: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: Colors.muted,
  },

  // ── the dive ──────────────────────────────────────────────────────────
  readHead: {
    // Room for the pinned anchor when "READ IN FULL" scrolls straight here.
    paddingTop: ANCHOR_HEIGHT + 14,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  readEyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
  },
  readTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.3,
    color: Colors.ink,
    marginTop: 8,
  },
});
