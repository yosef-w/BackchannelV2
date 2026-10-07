// VerdictBar — the deck's decide row as one instrument: a hairline bar
// split in two, PASS on paper at the left, the accept verb in ink at the
// right (a touch wider — it's the one that matters). Words, not icons: in
// a product about putting your name on someone, the verb is the product.
// No shadows, no floating discs — it sits on the page like the ledger.
//
// Press feel: the paper half dims to off-white, the ink half eases to 80%;
// haptics are light for pass, medium for the accept.

import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, shouldStackForFontScale } from "@/lib/responsive";

interface VerdictBarProps {
  passLabel?: string;
  acceptLabel: string;
  onPass: () => void;
  onAccept: () => void;
  passAccessibilityLabel?: string;
  acceptAccessibilityLabel?: string;
  disabled?: boolean;
}

export function VerdictBar({
  passLabel = "PASS",
  acceptLabel,
  onPass,
  onAccept,
  passAccessibilityLabel,
  acceptAccessibilityLabel,
  disabled,
}: VerdictBarProps) {
  // At the largest Dynamic Type sizes the labels can't share a row with any
  // cap that still respects the user's setting, so the halves stack.
  const stacked = shouldStackForFontScale(useWindowDimensions().fontScale);
  return (
    <View style={[styles.bar, stacked && styles.barStacked, disabled && styles.barDisabled]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPass();
        }}
        disabled={disabled}
        style={({ pressed }) => [styles.half, stacked ? styles.halfStacked : styles.halfPass, pressed && styles.halfPassPressed]}
        accessibilityRole="button"
        accessibilityLabel={passAccessibilityLabel ?? "Pass"}
      >
        <Text
          style={styles.passText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={FontScale.label}
        >
          {passLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAccept();
        }}
        disabled={disabled}
        style={({ pressed }) => [styles.half, styles.halfAccept, stacked && styles.halfStacked, pressed && styles.halfAcceptPressed]}
        accessibilityRole="button"
        accessibilityLabel={acceptAccessibilityLabel ?? acceptLabel}
      >
        <Text
          style={styles.acceptText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={FontScale.label}
        >
          {acceptLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    width: "100%",
    // Capped so it doesn't stretch full-width under HomeView's
    // left:0/right:0 wrapper on iPad — HomeView positions the wrapper,
    // this caps + centers the bar's own width inside it.
    maxWidth: 460,
    alignSelf: "center",
    minHeight: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    overflow: "hidden",
  },
  // Two 54pt rows: the pill radius would clip the corners, so square it off.
  barStacked: { flexDirection: "column", borderRadius: 16 },
  barDisabled: { opacity: 0.5 },
  half: {
    minHeight: 54,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  halfPass: { flex: 1 },
  halfStacked: { flex: 0, width: "100%" },
  halfPassPressed: { backgroundColor: Colors.surface },
  halfAccept: { flex: 1.35, backgroundColor: Colors.ink },
  halfAcceptPressed: { opacity: 0.8 },
  passText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.body,
  },
  acceptText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.paper,
  },
});
