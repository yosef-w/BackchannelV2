/**
 * Pill — small rounded label, the workhorse status / tag component.
 *
 * Default variant is a paper-feel soft pill (Surface + hairline border, muted
 * label) matching the website's `.eyebrow-tag` style. Status variants light
 * up only for semantic outcomes (ok/warn/block/info) — never as brand accent.
 *
 * Optional `icon` slot for a leading lucide icon. Use sparingly; the visual
 * weight should still come from the type and tracking.
 */

import { Color, Type } from "@/constants/theme";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

export type PillVariant = "default" | "ok" | "warn" | "block" | "info";
export type PillSize = "sm" | "md";

export interface PillProps {
  label: string;
  variant?: PillVariant;
  size?: PillSize;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export function Pill({
  label,
  variant = "default",
  size = "sm",
  icon,
  style,
  labelStyle,
}: PillProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  return (
    <View
      style={[
        styles.base,
        s.box,
        { backgroundColor: v.bg, borderColor: v.border },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[styles.label, s.label, { color: v.text }, labelStyle]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const VARIANT: Record<
  PillVariant,
  { bg: string; border: string; text: string }
> = {
  default: {
    bg: Color.surface,
    border: Color.border,
    text: Color.muted,
  },
  ok: {
    bg: Color.status.okBg,
    border: Color.status.okBorder,
    text: Color.status.okText,
  },
  warn: {
    bg: Color.status.warnBg,
    border: Color.status.warnBorder,
    text: Color.status.warnText,
  },
  block: {
    bg: Color.status.blockBg,
    border: Color.status.blockBorder,
    text: Color.status.blockText,
  },
  info: {
    bg: Color.status.infoBg,
    border: Color.status.infoBorder,
    text: Color.status.infoText,
  },
};

const SIZE: Record<
  PillSize,
  { box: ViewStyle; label: TextStyle }
> = {
  sm: {
    box: { paddingHorizontal: 10, paddingVertical: 3 },
    label: { fontSize: 10, letterSpacing: 0.8 },
  },
  md: {
    box: { paddingHorizontal: 12, paddingVertical: 5 },
    label: { fontSize: 11, letterSpacing: 1 },
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: { marginRight: 5 },
  label: {
    fontFamily: Type.sans600,
    textTransform: "uppercase",
  },
});
