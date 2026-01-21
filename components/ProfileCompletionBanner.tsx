import { AlertCircle, ChevronRight, X } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

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
        <AlertCircle color="#F59E0B" size={24} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <View style={styles.percentageBadge}>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Add missing info to unlock autofill for job applications
        </Text>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.completeButtonText}>Complete Now</Text>
          <ChevronRight color="#000" size={18} />
        </TouchableOpacity>
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X color="#999" size={20} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
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
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    flex: 1,
  },
  percentageBadge: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
  },
  subtitle: {
    fontSize: 13,
    color: "#78716C",
    lineHeight: 18,
    marginBottom: 12,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  closeButton: {
    padding: 4,
    alignSelf: "flex-start",
  },
});
