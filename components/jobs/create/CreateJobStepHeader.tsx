import { ChevronLeft, X } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

interface CreateJobStepHeaderProps {
  title: string;
  /** 1-indexed current step and total step count — omit to hide the dots
   * (the URL entry screen has no meaningful "step 1 of N" framing yet). */
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  onClose: () => void;
}

/**
 * Shared header for every Create Job screen — back chevron (when a
 * previous step exists), title, close X, and a step-dot progress row.
 * Mirrors EditorScreen's header chrome so the flow reads as part of the
 * same "pushed full-screen editor" family as Account settings.
 */
export function CreateJobStepHeader({
  title,
  step,
  totalSteps,
  onBack,
  onClose,
}: CreateJobStepHeaderProps) {
  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerBtn, !onBack && styles.headerBtnHidden]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={!onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          {onBack && <ChevronLeft color={Colors.ink} size={24} strokeWidth={2.2} />}
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X color={Colors.ink} size={22} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {!!step && !!totalSteps && (
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < step && styles.dotActive,
                i === step - 1 && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnHidden: { opacity: 0 },
  // Serif — screen titles are headline-tier in the rebrand.
  title: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: { backgroundColor: Colors.ink },
  dotCurrent: { width: 22 },
});
