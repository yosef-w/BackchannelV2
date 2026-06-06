import { Button, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { BlurView } from "expo-blur";
import { AlertCircle } from "lucide-react-native";
import React from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { ProfileCompletenessResult } from "../utils/profileCompletion";

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  onGoToProfile: () => void;
  onTesterMode: () => void;
  profileCompletion: ProfileCompletenessResult;
}

/**
 * Bottom-sheet style modal that nudges the user to finish their profile.
 * Editorial: eyebrow + two-line serif title, paper-on-blur background,
 * primary / ghost / tertiary CTA stack.
 */
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
        style={styles.modal}
      >
        <View style={styles.handle} />

        <View style={styles.iconCircle}>
          <AlertCircle
            color={tokens.colors.text}
            size={26}
            strokeWidth={1.6}
          />
        </View>

        <Text
          variant="eyebrow"
          align="center"
          style={styles.eyebrow}
        >
          Almost there
        </Text>
        <Text variant="titleSerif" align="center" style={styles.titleLine}>
          Finish your
        </Text>
        <Text variant="titleSerifItalic" align="center" style={styles.titleLine}>
          profile.
        </Text>
        <Text
          variant="bodyLarge"
          align="center"
          style={styles.subtitle}
        >
          You're {profileCompletion.percentage}% complete. Fill in the rest
          to unlock autofill and stronger matches.
        </Text>

        <View style={styles.missingCard}>
          <Text variant="eyebrow" style={styles.missingEyebrow}>
            Missing
          </Text>
          {profileCompletion.missingFields.slice(0, 5).map((field, index) => (
            <View key={index} style={styles.missingRow}>
              <View style={styles.missingDot} />
              <Text variant="body" color={tokens.colors.text}>
                {field.label}
              </Text>
            </View>
          ))}
          {profileCompletion.missingFields.length > 5 ? (
            <Text
              variant="bodySmall"
              color={tokens.colors.textMuted}
              italic
              style={styles.moreText}
            >
              +{profileCompletion.missingFields.length - 5} more fields
            </Text>
          ) : null}
        </View>

        <View style={styles.ctaStack}>
          <Button
            label="Complete profile"
            onPress={onGoToProfile}
            block
            size="lg"
          />
          <Button
            label="Maybe later"
            onPress={onClose}
            variant="ghost"
            block
            size="md"
          />
        </View>

        <TouchableOpacity
          onPress={onTesterMode}
          style={styles.testerBtn}
          activeOpacity={0.7}
          hitSlop={6}
        >
          <Text variant="eyebrow" color={tokens.colors.textFaint}>
            I am a tester
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: tokens.spacing.l,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xxl,
    borderTopWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.border,
    marginBottom: tokens.spacing.m,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: tokens.spacing.m,
  },
  eyebrow: {
    marginBottom: tokens.spacing.s,
  },
  titleLine: {
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.l,
    maxWidth: 400,
    alignSelf: "center",
  },
  missingCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.l,
    padding: tokens.spacing.m,
    marginBottom: tokens.spacing.l,
  },
  missingEyebrow: {
    marginBottom: tokens.spacing.sm,
  },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.s,
  },
  missingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.textMuted,
    marginRight: tokens.spacing.sm,
  },
  moreText: {
    marginTop: tokens.spacing.xs,
    marginLeft: tokens.spacing.sm + 4,
  },
  ctaStack: {
    gap: tokens.spacing.s,
  },
  testerBtn: {
    alignSelf: "center",
    marginTop: tokens.spacing.s,
    paddingVertical: tokens.spacing.s,
  },
});
