// ControlsFade — a paper gradient behind the floating decision capsule, so
// the card's text dissolves into the page instead of colliding with the
// capsule's hairline. Purely decorative: it never takes a touch.
//
// react-native-svg for the gradient for the same reason as the hero card's
// scrim: expo-linear-gradient isn't in the binary, and a native dep would
// block OTA (runtimeVersion is fingerprint-based). HomeView renders it as
// the first child of the floating row, so it rides with the capsule — lifted
// over the tab bar at rest, dropping with it on scroll.

import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Colors } from "@/constants/theme";

export function ControlsFade() {
  return (
    <Svg
      style={styles.fade}
      width="100%"
      height="100%"
      pointerEvents="none"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="controlsFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={Colors.paper} stopOpacity={0} />
          <Stop offset="0.5" stopColor={Colors.paper} stopOpacity={0.94} />
          <Stop offset="1" stopColor={Colors.paper} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#controlsFade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Reaches above the capsule (the dissolve) and a little below it. Kept
  // short on top so it never eats the ledger's closing hairline, which sits
  // PILLS_CLEARANCE (18pt) above the capsule.
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -30,
    bottom: -24,
  },
});
