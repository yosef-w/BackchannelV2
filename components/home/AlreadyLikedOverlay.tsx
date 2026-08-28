import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Colors, Fonts, Type } from "@/constants/theme";

interface AlreadyLikedOverlayProps {
  userType: "applicant" | "sponsor";
  /** What the earlier like was for — role title + company (applicant) or the person's name (sponsor). */
  jobTitle?: string;
  company?: string;
  name?: string;
  onContinue: () => void;
}

/**
 * "Already seen" — replaces the verdict bar when the current card is one
 * already liked this session (almost always because "Review again" replayed
 * the deck). The dimmed card beneath is non-interactive, so the only way
 * forward is a conscious tap — no duplicate like, no silent no-op.
 *
 * 2026-08 rebrand: a paper panel on a hairline, serif statement, one ink
 * pill — no shadowed card, no check-in-a-circle.
 */
export function AlreadyLikedOverlay({
  userType,
  jobTitle,
  company,
  name,
  onContinue,
}: AlreadyLikedOverlayProps) {
  const isApplicant = userType === "applicant";
  const subtitle = isApplicant
    ? `You showed interest in ${jobTitle || "this role"}${company ? ` at ${company}` : ""} earlier.`
    : `You already connected with ${name || "this applicant"}.`;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(200)} style={styles.panel}>
        <Text style={styles.eyebrow}>ALREADY SEEN</Text>
        <Text style={styles.title}>
          {isApplicant ? "You're already " : "You've already "}
          <Text style={styles.titleEm}>{isApplicant ? "interested." : "connected."}</Text>
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={styles.pill}
          onPress={onContinue}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to next card"
        >
          <Text style={styles.pillText}>CONTINUE →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 26,
  },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 10,
  },
  title: {
    ...Type.heading,
    fontSize: 24,
    lineHeight: 29,
    color: Colors.ink,
  },
  titleEm: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14.5,
    lineHeight: 21,
    color: Colors.body,
    marginTop: 10,
  },
  pill: {
    marginTop: 22,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.paper,
  },
});
