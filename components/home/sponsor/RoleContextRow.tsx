// RoleContextRow — "which of my roles is this person for?" answered before
// anything else on the card (Figma iPhone 17-13). A surface-tinted row with
// the company logo, the eyebrow ("INTERESTED IN YOUR ROLE"), the role title
// and its one-line subline; tapping it opens the role switcher.
//
// In the hero layout it sits flush on top of the photo card — top corners
// rounded, bottom square — so the two read as one card (`joined`). Height is
// a MIN height: at large Dynamic Type the title/subline keep one line each
// but the row grows rather than clipping.

import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { roleSubline } from "./facts";
import { LogoTile } from "./LogoTile";
import type { RoleContext } from "./model";

interface RoleContextRowProps {
  role: RoleContext;
  eyebrow: string;
  onPress?: () => void;
  /** Flush on top of the hero photo card (top radius only). Default true. */
  joined?: boolean;
}

export function RoleContextRow({ role, eyebrow, onPress, joined = true }: RoleContextRowProps) {
  const subline = roleSubline(role);
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        joined ? styles.rowJoined : styles.rowAlone,
        pressed && styles.pressed,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={[eyebrow, role.title, subline].filter(Boolean).join(", ")}
      accessibilityHint={onPress ? "Switch which of your roles you're reviewing for" : undefined}
    >
      <LogoTile
          logoUrl={role.logoUrl}
          name={role.company}
          size={50}
          borderRadius={10}
          style={styles.logo}
        />
      <View style={styles.text}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow.toUpperCase()}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {role.title}
        </Text>
        {subline ? (
          <Text style={styles.subline} numberOfLines={1}>
            {subline}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={16} color={Colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 93,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  rowJoined: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  rowAlone: { borderRadius: 20 },
  pressed: { opacity: 0.7 },
  logo: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  title: {
    fontFamily: Fonts.sansMedium,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.ink,
    marginTop: 3,
  },
  subline: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.muted,
    marginTop: 2,
  },
});
