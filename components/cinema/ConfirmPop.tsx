// ConfirmPop — the app's mid-size confirmation: an ink circle that
// arrives with the cinema engine's backOut overshoot while a single
// pulse ring fires outward, optionally landing a haptic. The compact
// sibling of BroadcastMoment, for confirmations INSIDE modals, sheets,
// and flow steps ("Request sent!", "Sponsorship confirmed", deck done)
// where a full-screen moment would be oversized but a static check
// undersells the action.
//
// Mount it when the success state appears — the ~900ms one-shot clock
// starts on mount. Pass haptic={null} for passive/re-entrant contexts
// (states a user can revisit) where a buzz would misfire.

import { Check } from "@/components/ui/icons";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";
import {
  backOut,
  type CinemaBeat,
  type CinemaBeatKind,
  easeOut,
  useCinemaHaptics,
  win,
} from "./engine";

const POP_MS = 900;

interface ConfirmPopProps {
  /** Diameter of the ink circle. Default 64. */
  size?: number;
  /** Beat kind fired as the circle lands; null for silent. Default "success". */
  haptic?: CinemaBeatKind | null;
  /** Replace the default check glyph (must render white-on-ink). */
  icon?: React.ReactNode;
}

export function ConfirmPop({
  size = 64,
  haptic = "success",
  icon,
}: ConfirmPopProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: POP_MS, easing: Easing.linear });
  }, [t]);
  const beats = useMemo<readonly CinemaBeat[]>(
    () => (haptic ? [{ at: 0.12, kind: haptic }] : []),
    [haptic],
  );
  useCinemaHaptics(t, beats);

  const circle = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.05, 0.55));
    return { opacity: Math.min(1, p * 2), transform: [{ scale: p }] };
  });
  const ring = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0.3, 1));
    return {
      opacity: (1 - p) * 0.45 * win(t.value, 0.3, 0.34),
      transform: [{ scale: 0.7 + p * 1.15 }],
    };
  });

  // The wrapper is sized to the ring's full expansion so the pop never
  // shifts surrounding layout mid-animation.
  const wrap = size * 1.5;
  return (
    <View
      style={[styles.wrap, { width: wrap, height: wrap }]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.ring,
          { width: wrap, height: wrap, borderRadius: wrap / 2 },
          ring,
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          circle,
        ]}
      >
        {icon ?? (
          <Check color="#FFF" size={Math.round(size * 0.45)} strokeWidth={3} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  circle: {
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
