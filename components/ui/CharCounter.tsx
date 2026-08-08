// CharCounter — a small "240/500" character counter that actively signals the
// limit instead of sitting there as muted gray text:
//   • neutral while there's plenty of room,
//   • amber as it approaches the cap (last 10%),
//   • red + "limit reached" once at the cap (where the input stops accepting
//     characters), so the user understands *why* typing stopped.
//
// Pair with a TextInput's `maxLength`. Right-aligned by default.

import React from "react";
import { StyleSheet, type StyleProp, Text, type TextStyle } from "react-native";
import { Colors } from "@/constants/theme";

interface CharCounterProps {
  count: number;
  max: number;
  /** Optional positioning override (alignment/margins). */
  style?: StyleProp<TextStyle>;
}

export function CharCounter({ count, max, style }: CharCounterProps) {
  const atLimit = count >= max;
  const near = !atLimit && count >= max * 0.9;
  return (
    <Text
      style={[
        styles.base,
        near && styles.near,
        atLimit && styles.atLimit,
        style,
      ]}
    >
      {count}/{max}
      {atLimit ? " · limit reached" : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-end",
    marginTop: 6,
    fontSize: 11,
    fontWeight: "500",
    color: Colors.faint,
  },
  near: { color: "#D97706" }, // amber — getting close
  atLimit: { color: Colors.danger, fontWeight: "700" }, // red — stopped accepting
});
