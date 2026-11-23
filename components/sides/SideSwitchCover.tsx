// SideSwitchCover — the one-beat cover while the app changes sides
// (docs/DUAL_SIDES.md). The switch clears every list and remounts the tabs;
// without a cover that's a flicker of emptied screens. With it, the change
// reads as deliberate: a line that says where you're going, then the new
// side, loaded. Fades — no slide, no spring.

import React from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Colors, Fonts, Type } from "@/constants/theme";
import { sideLabel, type Role } from "@/lib/sides";

export function SideSwitchCover({ to }: { to: Role | null }) {
  if (!to) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      style={styles.cover}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Switching to ${sideLabel(to)}`}
    >
      <Text style={styles.eyebrow}>SWITCHING TO</Text>
      <Text style={styles.title}>
        {sideLabel(to)}
        <Text style={styles.period}>.</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 10,
  },
  title: { ...Type.title, fontFamily: Fonts.serifItalic, color: Colors.ink },
  period: { color: Colors.muted },
});
