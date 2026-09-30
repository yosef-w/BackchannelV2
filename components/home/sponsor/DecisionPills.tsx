// DecisionPills — the sponsor deck v2 decide row (Figma): two floating
// pills, ink "✕ Pass" and go-green "Connect ✓" (a touch wider — it's the
// one that matters). Same contract as VerdictBar so HomeView can swap one
// for the other behind SPONSOR_DECK_V2.
//
// Kept from VerdictBar: light haptic on pass, medium on accept; labels
// capped at FontScale.label; and at the largest Dynamic Type sizes the
// pills stack vertically instead of truncating. Pills are minHeight, not
// height, so capped text can still never clip.

import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Check, X } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, shouldStackForFontScale } from "@/lib/responsive";

interface DecisionPillsProps {
  passLabel?: string;
  acceptLabel: string;
  onPass: () => void;
  onAccept: () => void;
  passAccessibilityLabel?: string;
  acceptAccessibilityLabel?: string;
  disabled?: boolean;
}

export function DecisionPills({
  passLabel = "Pass",
  acceptLabel,
  onPass,
  onAccept,
  passAccessibilityLabel,
  acceptAccessibilityLabel,
  disabled,
}: DecisionPillsProps) {
  const stacked = shouldStackForFontScale(useWindowDimensions().fontScale);
  return (
    <View style={[styles.bar, stacked && styles.barStacked, disabled && styles.disabled]}>
      <PressableScale
        pressedScale={0.97}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPass();
        }}
        disabled={disabled}
        style={[styles.pill, styles.pass, stacked ? styles.pillStacked : styles.passFlex]}
        accessibilityRole="button"
        accessibilityLabel={passAccessibilityLabel ?? passLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <X size={18} color={Colors.paper} strokeWidth={2.25} />
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={FontScale.label}>
          {passLabel}
        </Text>
      </PressableScale>
      <PressableScale
        pressedScale={0.97}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAccept();
        }}
        disabled={disabled}
        style={[styles.pill, styles.accept, stacked ? styles.pillStacked : styles.acceptFlex]}
        accessibilityRole="button"
        accessibilityLabel={acceptAccessibilityLabel ?? acceptLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={FontScale.label}>
          {acceptLabel}
        </Text>
        <Check size={18} color={Colors.paper} strokeWidth={2.25} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
    // Figma content width; HomeView positions the wrapper, this caps it.
    maxWidth: 370,
    alignSelf: "center",
  },
  barStacked: { flexDirection: "column", gap: 8 },
  disabled: { opacity: 0.5 },
  pill: {
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // Soft float shadow — they sit over scrolling content.
    shadowColor: Colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pillStacked: { width: "100%" },
  pass: { backgroundColor: Colors.ink },
  passFlex: { flex: 1 },
  accept: { backgroundColor: Colors.go },
  acceptFlex: { flex: 1.15 },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 18,
    color: Colors.paper,
    flexShrink: 1,
  },
});
