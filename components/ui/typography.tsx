/**
 * Typography primitives — the editorial voice of the app.
 *
 * Import these instead of writing `<Text style={{ fontFamily: ... }}>` ad hoc.
 * The signature pattern is the italicized serif accent inside a sans title
 * (`<HeroTitle lead="Welcome to" accent="BackChannel." />`), modeled on the
 * tester-site landing page.
 *
 * Every variant is theme-driven — change a token in constants/theme.ts and
 * every screen updates.
 */

import { Color, Text as TextTokens, Type } from "@/constants/theme";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

// ── Eyebrow ─────────────────────────────────────────────────────────
// Small tracked uppercase label above a heading. Optional inline tag pill —
// e.g. "APPLICANT BETA  [Testing Guide]" — matches the website pattern.
export interface EyebrowProps extends Omit<ViewProps, "children"> {
  label: string;
  tag?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export function Eyebrow({ label, tag, style, labelStyle, ...rest }: EyebrowProps) {
  return (
    <View style={[styles.eyebrowRow, style]} {...rest}>
      <Text style={[TextTokens.eyebrow, labelStyle]}>{label}</Text>
      {tag ? (
        <View style={styles.eyebrowTag}>
          <Text style={styles.eyebrowTagText}>{tag}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── HeroTitle ───────────────────────────────────────────────────────
// Large display title. The `accent` prop renders as italic serif on its own
// line — the editorial moment ("Welcome to\nBackChannel.").
//
// Three usage shapes:
//   <HeroTitle lead="Welcome to" accent="BackChannel." />   // both lines
//   <HeroTitle accent="BackChannel." />                     // accent only
//   <HeroTitle lead="Final thoughts." />                    // no italic
//
// `size` lets a screen scale it down without forking the component.
export interface HeroTitleProps extends Omit<TextProps, "children"> {
  lead?: string;
  accent?: string;
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
  style?: StyleProp<TextStyle>;
}

const HERO_SIZES = {
  sm: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  md: { fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  lg: { fontSize: 52, lineHeight: 56, letterSpacing: -1 },
} as const;

export function HeroTitle({
  lead,
  accent,
  size = "lg",
  align = "left",
  style,
  ...rest
}: HeroTitleProps) {
  const sizeStyle = HERO_SIZES[size];
  const inkStyle: TextStyle = {
    fontFamily: Type.sans400,
    color: Color.ink,
    textAlign: align,
    ...sizeStyle,
  };
  const accentStyle: TextStyle = {
    fontFamily: Type.serifItalic,
    color: Color.muted,
    ...sizeStyle,
  };
  return (
    <Text style={[inkStyle, style]} {...rest}>
      {lead ? lead : null}
      {lead && accent ? "\n" : null}
      {accent ? <Text style={accentStyle}>{accent}</Text> : null}
    </Text>
  );
}

// ── Title ───────────────────────────────────────────────────────────
// Section-level heading, smaller than HeroTitle. Used for sheet titles,
// modal headers, "Final thoughts.", etc.
export interface TitleProps extends Omit<TextProps, "children"> {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function Title({ children, style, ...rest }: TitleProps) {
  return (
    <Text style={[TextTokens.title, style]} {...rest}>
      {children}
    </Text>
  );
}

// ── Body ────────────────────────────────────────────────────────────
// Default body copy — DM Sans 300, the website's signature light weight.
export interface BodyProps extends Omit<TextProps, "children"> {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function Body({ children, style, ...rest }: BodyProps) {
  return (
    <Text style={[TextTokens.body, style]} {...rest}>
      {children}
    </Text>
  );
}

// ── UI ──────────────────────────────────────────────────────────────
// Default UI text — DM Sans 500. Use for buttons, controls, list rows.
export interface UIProps extends Omit<TextProps, "children"> {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function UIText({ children, style, ...rest }: UIProps) {
  return (
    <Text style={[TextTokens.ui, style]} {...rest}>
      {children}
    </Text>
  );
}

// ── Meta ────────────────────────────────────────────────────────────
// Captions, timestamps, secondary metadata — muted, smaller.
export interface MetaProps extends Omit<TextProps, "children"> {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function Meta({ children, style, ...rest }: MetaProps) {
  return (
    <Text style={[TextTokens.meta, style]} {...rest}>
      {children}
    </Text>
  );
}

// ── styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrowTag: {
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  eyebrowTagText: {
    fontFamily: Type.sans600,
    fontSize: 10,
    letterSpacing: 1.3,
    color: Color.muted,
    textTransform: "uppercase",
  },
});
