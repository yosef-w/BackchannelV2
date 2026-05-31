/**
 * Chevron — the round disclosure button used on expandable sections
 * (matches the `.chevron` element on the tester-site checklists).
 *
 * Resting: white circle, hairline border, muted chevron-down icon.
 * Open:    ink-filled circle, white chevron rotated 180°.
 *
 * The rotation + color tween run through reanimated so it stays smooth on
 * the UI thread. Pure presentational — pass `open`; the parent owns toggle.
 */

import { Color, Motion } from "@/constants/theme";
import { ChevronDown } from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ChevronProps {
  open: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Chevron({ open, size = 28, style }: ChevronProps) {
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: Motion.base });
  }, [open, progress]);

  const animatedContainer = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Color.paper, Color.ink],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [Color.border, Color.ink],
    ),
  }));

  const animatedIcon = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 2 },
        animatedContainer,
        style,
      ]}
    >
      <Animated.View style={animatedIcon}>
        {/* Stroke color is driven by the `open` prop directly — animating
            stroke is a JS thread cost we don't need for two stable states. */}
        <ChevronDown
          size={Math.round(size * 0.42)}
          color={open ? Color.paper : Color.muted}
          strokeWidth={2.5}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
