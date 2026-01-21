import { BlurView } from "expo-blur";
import { AlertCircle, ChevronRight } from "lucide-react-native";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { ProfileCompletenessResult } from "../utils/profileCompletion";

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
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={styles.modalContent}
      >
        <View style={styles.iconContainer}>
          <AlertCircle color="#1E40AF" size={48} />
        </View>

        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Your profile is {profileCompletion.percentage}% complete. Add the missing
          information to unlock autofill for job applications.
        </Text>

        <View style={styles.missingFieldsContainer}>
          <Text style={styles.missingTitle}>Missing Information:</Text>
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
          <ChevronRight color="#FFF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testerButton}
          onPress={onTesterMode}
          activeOpacity={0.8}
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
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  missingFieldsContainer: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  missingTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    backgroundColor: "#1E40AF",
    marginRight: 12,
  },
  missingText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  moreFields: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    marginTop: 4,
    marginLeft: 18,
  },
  primaryButton: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#666",
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
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
