import { MessageCircle } from "@/components/ui/icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Inbox loading / error / empty states, styled to match the equivalent
 * states on the Matches screen (quiet spinner, inline error text, icon-tile
 * empty state) instead of the previous ad-hoc inline blocks.
 */

export function InboxLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" color={Colors.muted} />
    </View>
  );
}

export function InboxError({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Failed to load conversations</Text>
      <Text style={styles.errorDetail}>{message}</Text>
    </View>
  );
}

export function InboxEmpty() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.iconTile}>
        <MessageCircle size={28} color="#000" strokeWidth={1.75} />
      </View>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        When you match with someone, your conversation will start here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 40, alignItems: "center" },
  errorTitle: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorDetail: {
    color: Colors.muted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  // Below the serif's ~18px floor — system font, token color only.
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
});
