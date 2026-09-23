import { BlurView } from "expo-blur";
import {  ChevronRight } from "@/components/ui/icons";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DismissibleSheet } from "@/components/ui/DismissibleSheet";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { ProfileCompletenessResult } from "@/utils/profileCompletion";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  onGoToProfile: () => void;
  onTesterMode: () => void;
  profileCompletion: ProfileCompletenessResult;
}

export function ProfileCompletionModal({
  visible,
  onClose,
  onGoToProfile,
  onTesterMode,
  profileCompletion,
}: ProfileCompletionModalProps) {
  if (!profileCompletion) return null;
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </TouchableOpacity>

        <DismissibleSheet
          scrollDismiss
          onDismiss={onClose}
          style={styles.modalContent}
        >
        <ScreenContainer variant="sheet">
        <Text style={styles.eyebrow}>BEFORE YOU DECIDE</Text>
        <Text style={styles.title}>
          Finish your <Text style={styles.titleEm}>profile.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Your profile is {profileCompletion.percentage}% complete. Add the missing
          information to unlock autofill for job applications.
        </Text>

        <View style={styles.missingFieldsContainer}>
          <Text style={styles.missingTitle}>STILL MISSING</Text>
          {profileCompletion.missingFields.slice(0, 5).map((field, index) => (
            <View key={index} style={styles.missingField}>
              <View style={styles.missingDot} />
              <Text style={styles.missingText}>{field.label}</Text>
            </View>
          ))}
          {profileCompletion.missingFields.length > 5 && (
            <Text style={styles.moreFields}>
              +{profileCompletion.missingFields.length - 5} more fields
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onGoToProfile}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Complete Profile</Text>
          <ChevronRight color={Colors.paper} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </TouchableOpacity>

        {/* Dev-only bypass for internal testing — never shown in a production
            build. Gating a trust/integrity control behind a public button was
            the actual bug; __DEV__ is stripped from release bundles. */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.testerButton}
            onPress={onTesterMode}
            activeOpacity={0.8}
          >
            <Text style={styles.testerButtonText}>I am a tester (dev only)</Text>
          </TouchableOpacity>
        )}
        </ScreenContainer>
        </DismissibleSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 12,
  },
  titleEm: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  title: {
    ...Type.heading,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  missingFieldsContainer: {
    marginTop: 18,
    marginBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  missingTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.muted,
    marginBottom: 8,
  },
  missingField: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  missingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.body,
    marginRight: 12,
  },
  missingText: {
    fontSize: 15,
    color: Colors.body,
    fontWeight: "500",
  },
  moreFields: {
    fontSize: 14,
    color: Colors.muted,
    fontStyle: "italic",
    marginTop: 4,
    marginLeft: 18,
  },
  primaryButton: {
    backgroundColor: Colors.ink,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: Colors.paper,
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Colors.body,
    fontSize: 16,
    fontWeight: "600",
  },
  testerButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  testerButtonText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
