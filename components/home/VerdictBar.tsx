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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

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
  return (
    <View style={[styles.bar, disabled && styles.barDisabled]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPass();
        }}
        disabled={disabled}
        style={({ pressed }) => [styles.half, styles.halfPass, pressed && styles.halfPassPressed]}
        accessibilityRole="button"
        accessibilityLabel={passAccessibilityLabel ?? "Pass"}
      >
        <Text style={styles.passText}>{passLabel}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAccept();
        }}
        disabled={disabled}
        style={({ pressed }) => [styles.half, styles.halfAccept, pressed && styles.halfAcceptPressed]}
        accessibilityRole="button"
        accessibilityLabel={acceptAccessibilityLabel ?? acceptLabel}
      >
        <Text style={styles.acceptText}>{acceptLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    overflow: "hidden",
  },
  barDisabled: { opacity: 0.5 },
  half: {
    alignItems: "center",
    justifyContent: "center",
  },
  halfPass: { flex: 1 },
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
