import { Check, ChevronRight } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface AlreadyLikedOverlayProps {
  userType: "applicant" | "sponsor";
  /** What the earlier like was for — role title + company (applicant) or the person's name (sponsor). */
  jobTitle?: string;
  company?: string;
  name?: string;
  onContinue: () => void;
}

/**
 * "Already seen" overlay — replaces the floating Pass/Connect buttons when
 * the current card is one already liked this session (almost always because
 * "Review again" replayed the deck from the top). The dimmed card
 * underneath is deliberately non-interactive so the only way forward is a
 * conscious tap on Continue — no duplicate like call, no silent no-op that
 * looks like a bug.
 */
export function AlreadyLikedOverlay({
  userType,
  jobTitle,
  company,
  name,
  onContinue,
}: AlreadyLikedOverlayProps) {
  const subtitle =
    userType === "applicant"
      ? `You showed interest in ${jobTitle || "this role"}${company ? ` at ${company}` : ""} earlier.`
      : `You already connected with ${name || "this applicant"}.`;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(200)} style={styles.card}>
        <View style={styles.iconCircle}>
          <Check color="#FFF" size={28} strokeWidth={3} />
        </View>
        <Text style={styles.title}>
          {userType === "applicant" ? "Already Interested" : "Already Connected"}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={onContinue}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to next card"
        >
          <Text style={styles.buttonText}>Continue</Text>
          <ChevronRight color="#FFF" size={18} strokeWidth={2.5} />
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
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#000",
    paddingVertical: 15,
    borderRadius: 16,
    width: "100%",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
