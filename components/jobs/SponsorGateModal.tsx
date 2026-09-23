import { Lock } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DismissibleSheet } from "@/components/ui/DismissibleSheet";
import { sheetColumn } from "@/lib/responsive";
import { Colors, Radii, Type } from "@/constants/theme";

interface SponsorGateModalProps {
  onSponsorNow: () => void;
  onClose: () => void;
}

/**
 * "Sponsor to View" gate — shown when a non-sponsor taps the applicant list
 * on a job they haven't sponsored. Extracted from JobsView. Rebuilt on the
 * same bottom-sheet + dark blur@60 shell as MarketplaceGateModal so the
 * app's two "velvet rope" gates read as one family instead of one being a
 * sheet and the other a centered, drop-shadowed dialog.
 */
export function SponsorGateModal({
  onSponsorNow,
  onClose,
}: SponsorGateModalProps) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onClose} fullSheetGesture style={styles.sheet}>
        <View style={[styles.body, sheetColumn]}>
          <View style={styles.iconContainer}>
            <Lock size={28} color={Colors.ink} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Sponsor to View</Text>
          <Text style={styles.sub}>
            You must be a sponsor of this job listing to view the full
            applicant list.
          </Text>

          <TouchableOpacity
            style={styles.cta}
            onPress={onSponsorNow}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Sponsor Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={styles.later}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  body: { alignItems: "center" },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  title: {
    ...Type.heading,
    color: Colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.body,
    textAlign: "center",
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: Colors.paper,
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  later: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
  },
});
