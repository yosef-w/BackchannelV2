import { MessageCircle } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Inbox loading / error / empty states, styled to match the equivalent
 * states on the Matches screen (quiet spinner, inline error text, icon-tile
 * empty state) instead of the previous ad-hoc inline blocks.
 */

export function InboxLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" color="#999" />
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
    color: "#999",
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
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 19,
  },
});
