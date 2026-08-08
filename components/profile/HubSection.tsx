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
 * Group container for the Profile hub — same #F9F9F9/16-radius/hairline-
 * divider shell as MatchSection (Matches redesign) and the Phase 9 Account
 * editors, so all three surfaces read as one design system instead of
 * three different ones bolted together over time.
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
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
  subtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  group: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
});
