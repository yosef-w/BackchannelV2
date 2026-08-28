// DecisionStamp — the commit beat. When the accept verb is pressed, the
// plate takes a letterpress impression — CONNECTED / INTERESTED, slightly
// rotated, landing with a heavy haptic — and then the card lifts away
// (HomeView's existing cross-fade). Once per card, ~350ms of theater at
// the one moment that matters: putting your name on it, made literal.

import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors, Fonts } from "@/constants/theme";
import { backOut } from "@/components/cinema/engine";

export const STAMP_MS = 340;

export function DecisionStamp({ label }: { label: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    t.value = withTiming(1, { duration: STAMP_MS, easing: Easing.linear });
  }, [t]);

  const style = useAnimatedStyle(() => {
    const p = backOut(t.value);
    return {
      opacity: Math.min(1, p * 2) * 0.92,
      transform: [{ rotate: "-8deg" }, { scale: 1.7 - 0.7 * p }],
    };
  });

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View style={[styles.stamp, style]}>
        <View style={styles.inner} />
        <Text style={styles.text}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
    zIndex: 6,
  },
  stamp: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 2.5,
    borderColor: Colors.ink,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  inner: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: 5,
    opacity: 0.5,
  },
  text: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    letterSpacing: 1,
    color: Colors.ink,
  },
});
