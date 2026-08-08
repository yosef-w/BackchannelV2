import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/theme";

interface JobsEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

/**
 * Empty/error state for the Job Board, matching the icon-tile pattern the
 * Matches and Inbox screens use. Doubles as the home of the full-size
 * "Create Listing" CTA — creating a listing is the primary action when
 * there's nothing to show, even though it's a compact header action
 * everywhere else.
 */
export function JobsEmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
}: JobsEmptyStateProps) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <View style={styles.iconTile}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionText && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  actionBtn: {
    marginTop: 20,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
