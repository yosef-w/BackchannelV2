// Eyebrow — the sponsor deck's one section-label voice (Tori's Figma):
// DM Sans 12, ~2pt tracking, uppercase, muted. Every section in the card
// opens with one, so it lives here instead of being re-declared per file.
// Also carries the two deck-local neutrals the Figma uses that the theme
// doesn't name (timeline dot/line grey, chip fill) so they're declared once.

import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

/** Figma's timeline dot grey — decorative only (non-text). */
export const TIMELINE_DOT = "#D9D9D4";
/** Figma's timeline line + skill-chip fill. */
export const QUIET_FILL = "#EDEDEA";
/** The brand's italic trail-off accent ("wants *your role.*") on paper. */
export const ITALIC_ACCENT = Colors.muted;

interface EyebrowProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function Eyebrow({ children, style }: EyebrowProps) {
  return (
    <Text style={[styles.eyebrow, style]} accessibilityRole="header">
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    color: Colors.muted,
  },
});
