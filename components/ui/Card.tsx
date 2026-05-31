/**
 * Card — the soft paper-feel container used everywhere from list rows to
 * full-screen sheets.
 *
 * Default: off-white fill, beige hairline border, generous radius. Optional
 * `elevated` lifts it with a soft shadow for interactive / floating uses
 * (the role-picker cards on the website's landing). Optional `onPress` makes
 * it a tappable surface with a subtle scale-down on press.
 */

import { Color, Radius, Shadow, Space } from "@/constants/theme";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

export interface CardProps {
  children: React.ReactNode;
  /** Lift with a soft shadow (use for interactive / floating cards). */
  elevated?: boolean;
  /** Make the whole card tappable. */
  onPress?: () => void;
  /** Override padding. Default `Space.lg` (20). */
  padding?: number;
  /** Override radius. Default `Radius.xl` (20). */
  radius?: number;
  /** Override background. Default `Color.offWhite`. */
  background?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  elevated = false,
  onPress,
  padding = Space.lg,
  radius = Radius.xl,
  background = Color.offWhite,
  style,
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor: background,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: Color.border,
    padding,
  };
  const combined = [base, elevated && Shadow.soft, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [combined, pressed && styles.pressed]}
        android_ripple={{ color: "transparent" }}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={combined}>{children}</View>;
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    borderColor: Color.borderStrong,
  },
});
