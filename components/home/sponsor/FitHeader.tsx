// FitHeader — the "fit" opening's identity block (Figma iPhone 17-39): a
// compact ID row with a "View profile" pill, then "Wants your *Role.*" and
// the fit headline ("Four of five line up with what you posted.").
//
// The Figma's pill says "View resume", but it opens the in-app full
// profile, not a PDF — so it says "View profile". The headline sentence is
// omitted when facts.ts has too few comparable rows to make the claim.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale } from "@/lib/responsive";
import { ITALIC_ACCENT } from "./Eyebrow";
import type { ApplicantFacts, FitSummary, RoleContext } from "./model";

interface FitHeaderProps {
  facts: ApplicantFacts;
  role: RoleContext;
  fit: FitSummary;
  onViewProfile?: () => void;
}

export function FitHeader({ facts, role, fit, onViewProfile }: FitHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.idRow}>
        <Avatar photoUrl={facts.photoUrl} name={facts.name} size={62} borderRadius={31} />
        <View style={styles.idText}>
          <Text style={styles.name}>{facts.name}</Text>
          {facts.currentTitle ? <Text style={styles.meta}>{facts.currentTitle}</Text> : null}
          {facts.currentCompany ? <Text style={styles.meta}>{facts.currentCompany}</Text> : null}
        </View>
        {onViewProfile ? (
          <Pressable
            onPress={onViewProfile}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`View ${facts.firstName || facts.name}'s full profile`}
          >
            <Text style={styles.pillText} maxFontSizeMultiplier={FontScale.control}>
              View profile
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.headline} accessibilityRole="header">
        {"Wants your "}
        <Text style={styles.headlineEm}>{`${role.title}.`}</Text>
      </Text>
      {fit.headline ? <Text style={styles.sub}>{fit.headline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16 },
  idRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  idText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.ink,
  },
  meta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
  },
  pill: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  pressed: { opacity: 0.7 },
  pillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.ink,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: Colors.ink,
    marginTop: 20,
  },
  headlineEm: { fontFamily: Fonts.serifItalic, color: ITALIC_ACCENT },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.body,
    marginTop: 8,
  },
});
