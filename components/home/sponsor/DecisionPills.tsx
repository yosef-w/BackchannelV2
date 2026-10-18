// DecisionPills — the sponsor deck's decide control, as one letterpress
// instrument: a paper capsule with a hairline in ink, "✕ PASS" on paper and
// "CONNECT ✓" as the single ink-filled half. It replaced Tori's two solid
// pills (ink Pass + go-green Connect): two identical filled shapes broke
// the house rule of one filled pill per surface, the green was the only
// colour in the app that wasn't ink or paper, and Connect — the action that
// actually opens a conversation — looked as casual as Pass. Same family as
// the old VerdictBar (spaced caps, hairline instrument), so it reads as
// BackChannel rather than a stock dating-app row.
//
// Same contract as VerdictBar so HomeView swaps one for the other behind
// SPONSOR_DECK_V2. Kept: light haptic on pass, medium on accept; labels
// capped at FontScale.label; and at the largest Dynamic Type sizes the two
// segments stack inside the capsule instead of truncating. Segments are
// minHeight, not height, so capped text can still never clip.
//
// No drop shadow (house rule: shadows retired). It floats over scrolling
// content, so HomeView puts a ControlsFade behind it — text dissolves into
// paper instead of colliding with the hairline.

import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Check, X } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, shouldStackForFontScale } from "@/lib/responsive";
import { SEGMENT_MIN_HEIGHT, SEGMENT_STACK_GAP } from "./stageLayout";

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
    <View
      style={[styles.capsule, stacked && styles.capsuleStacked, disabled && styles.disabled]}
    >
      <PressableScale
        pressedScale={0.97}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPass();
        }}
        disabled={disabled}
        style={[styles.segment, stacked ? styles.segmentStacked : styles.passFlex]}
        accessibilityRole="button"
        accessibilityLabel={passAccessibilityLabel ?? passLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <X size={15} color={Colors.ink} strokeWidth={2.3} />
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={FontScale.label}>
          {passLabel.toUpperCase()}
        </Text>
      </PressableScale>
      <PressableScale
        pressedScale={0.97}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAccept();
        }}
        disabled={disabled}
        style={[
          styles.segment,
          styles.accept,
          stacked ? styles.segmentStacked : styles.acceptFlex,
        ]}
        accessibilityRole="button"
        accessibilityLabel={acceptAccessibilityLabel ?? acceptLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          style={[styles.label, styles.labelAccept]}
          numberOfLines={1}
          maxFontSizeMultiplier={FontScale.label}
        >
          {acceptLabel.toUpperCase()}
        </Text>
        <Check size={16} color={Colors.paper} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  // 4pt padding + 1pt hairline each side = stageLayout's CAPSULE_CHROME.
  capsule: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
    // Figma content width; HomeView positions the wrapper, this caps it.
    maxWidth: 370,
    alignSelf: "center",
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: 32,
    backgroundColor: Colors.paper,
  },
  capsuleStacked: { flexDirection: "column", gap: SEGMENT_STACK_GAP },
  disabled: { opacity: 0.5 },
  segment: {
    minHeight: SEGMENT_MIN_HEIGHT,
    borderRadius: 28,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  segmentStacked: { width: "100%" },
  passFlex: { flex: 1 },
  accept: { backgroundColor: Colors.ink },
  acceptFlex: { flex: 1.4 },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: Colors.ink,
    flexShrink: 1,
  },
  labelAccept: { color: Colors.paper },
});
