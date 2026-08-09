import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

interface HubSectionProps {
  title: string;
  subtitle?: string;
  /** Black count pill next to the title — omit for groups that don't need one (Profile, Settings). */
  count?: number;
  children: React.ReactNode;
  hidden?: boolean;
}

/**
 * Group container for the Profile hub — 2026-08 "Two Faces" rebrand:
 * the gray recessed box is gone; rows sit flat on the paper between
 * hairlines (the deck cards' section language), under the same caps
 * section label.
 */
export function HubSection({
  title,
  subtitle,
  count,
  children,
  hidden,
}: HubSectionProps) {
  if (hidden) return null;

  const rows = React.Children.toArray(children);
  const lastIndex = rows.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!!count && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.group}>
        {rows.map((row, i) =>
          React.isValidElement(row)
            ? React.cloneElement(row as React.ReactElement<any>, {
                isLast: i === lastIndex,
              })
            : row,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  countPill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "800", color: Colors.paper },
  subtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  // Flat hairline group — rows carry their own dividers; the top rule
  // closes the set against the section label.
  group: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
