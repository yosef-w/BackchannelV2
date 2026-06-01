import { BlurView } from "expo-blur";
import { AlertCircle, ChevronRight } from "lucide-react-native";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { ProfileCompletenessResult } from "../utils/profileCompletion";
import { Color, Radius, Type } from "@/constants/theme";

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
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={50} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={styles.modalContent}
      >
        <View style={styles.iconContainer}>
          <AlertCircle color={Color.muted} size={28} strokeWidth={1.6} />
        </View>

        <Text style={styles.title}>
          Complete your{" "}
          <Text style={styles.titleAccent}>profile.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Your profile is {profileCompletion.percentage}% complete. Add the
          missing information to unlock autofill for job applications.
        </Text>

        <View style={styles.missingFieldsContainer}>
          <Text style={styles.missingTitle}>Missing information</Text>
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
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Complete profile</Text>
          <ChevronRight color={Color.paper} size={18} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Maybe later</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testerButton}
          onPress={onTesterMode}
          activeOpacity={0.7}
        >
          <Text style={styles.testerButtonText}>I am a tester</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Color.paper,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: 28,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: Type.sans400,
    fontSize: 26,
    color: Color.ink,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  titleAccent: {
    fontFamily: Type.serifItalic,
    color: Color.muted,
  },
  subtitle: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 380,
    alignSelf: "center",
  },
  missingFieldsContainer: {
    backgroundColor: Color.offWhite,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 24,
  },
  missingTitle: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  missingField: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  missingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Color.ink,
    marginRight: 12,
  },
  missingText: {
    fontFamily: Type.sans500,
    fontSize: 14,
    color: Color.ink,
  },
  moreFields: {
    fontFamily: Type.serifItalic,
    fontSize: 14,
    color: Color.muted,
    marginTop: 4,
    marginLeft: 17,
  },
  primaryButton: {
    backgroundColor: Color.ink,
    paddingVertical: 16,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: Type.sans500,
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: Type.sans500,
    color: Color.muted,
    fontSize: 14,
  },
  testerButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  testerButtonText: {
    fontFamily: Type.sans500,
    color: Color.faint,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
});
