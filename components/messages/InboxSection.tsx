import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface InboxSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  hidden?: boolean;
}

/**
 * Section shell for the Inbox — caps label + black count pill above a
 * #F9F9F9/16-radius group card, the same shell MatchSection (Matches) and
 * HubSection (Profile) use, so the Inbox reads as a sibling of the tabs
 * around it instead of the last screen on the old visual language.
 *
 * Unlike those two, rows here manage their own dividers (the accordion
 * groups render header + sub-list as one unit, so "last row" isn't a
 * simple child index) — this shell is purely the header + card chrome.
 */
export function InboxSection({
  title,
  count,
  children,
  hidden,
}: InboxSectionProps) {
  if (hidden) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {count > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  countPill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
  group: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
});
