import { AlertCircle, ChevronRight, X } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Color, Radius, Type } from "@/constants/theme";

interface ProfileCompletionBannerProps {
  percentage: number;
  onPress: () => void;
  onDismiss?: () => void;
}

export function ProfileCompletionBanner({
  percentage,
  onPress,
  onDismiss,
}: ProfileCompletionBannerProps) {
  if (percentage >= 90) return null;

  return (
    <Animated.View entering={FadeInDown.delay(300)} style={styles.banner}>
      <View style={styles.iconContainer}>
        <AlertCircle color={Color.muted} size={20} strokeWidth={1.6} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Complete your profile</Text>
          <View style={styles.percentageBadge}>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Add missing info to unlock autofill for job applications.
        </Text>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.completeButtonText}>Complete now</Text>
          <ChevronRight color={Color.ink} size={16} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X color={Color.muted} size={18} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Color.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontFamily: Type.sans600,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.2,
    flex: 1,
  },
  percentageBadge: {
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 8,
  },
  percentageText: {
    fontFamily: Type.sans600,
    fontSize: 11,
    color: Color.body,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.body,
    lineHeight: 19,
    marginBottom: 10,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  completeButtonText: {
    fontFamily: Type.sans600,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  closeButton: {
    padding: 4,
    alignSelf: "flex-start",
  },
});
