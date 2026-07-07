import { Lock, X } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface SponsorGateModalProps {
  onSponsorNow: () => void;
  onClose: () => void;
}

/**
 * "Sponsor to View" gate — shown when a non-sponsor taps the applicant list
 * on a job they haven't sponsored. Extracted from JobsView.
 */
export function SponsorGateModal({
  onSponsorNow,
  onClose,
}: SponsorGateModalProps) {
  return (
    <View style={styles.gateModalOverlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.gateModalContent}
      >
        <TouchableOpacity style={styles.gateCloseBtn} onPress={onClose}>
          <X color="#666" size={20} />
        </TouchableOpacity>

        <View style={styles.gateIconContainer}>
          <Lock size={32} color="#000" />
        </View>
        <Text style={styles.gateTitle}>Sponsor to View</Text>
        <Text style={styles.gateDesc}>
          You must be a sponsor of this job listing to view the full applicant
          list.
        </Text>

        <View style={styles.gateActions}>
          <TouchableOpacity
            style={styles.gateBtnPrimary}
            onPress={onSponsorNow}
          >
            <Text style={styles.gateBtnPrimaryText}>Sponsor Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateBtnSecondary}
            onPress={onClose}
          >
            <Text style={styles.gateBtnSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  gateModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  gateModalContent: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  gateCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  gateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  gateDesc: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  gateActions: { width: "100%", gap: 12 },
  gateBtnPrimary: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
  },
  gateBtnPrimaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  gateBtnSecondary: { paddingVertical: 12, alignItems: "center" },
  gateBtnSecondaryText: { color: "#666", fontSize: 15, fontWeight: "600" },
});
