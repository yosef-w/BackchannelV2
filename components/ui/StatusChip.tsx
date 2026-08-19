import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

export type StatusTone = "active" | "waiting" | "muted";

const TONE_STYLES: Record<StatusTone, { dot: string; text: string }> = {
  // Something moved forward / needs no further waiting — e.g. "Referred",
  // "Matched", "Now Sponsored".
  active: { dot: Colors.ink, text: Colors.ink },
  // Sitting in a queue, nothing to do but wait — "Pending", "Waitlisted".
  waiting: { dot: Colors.muted, text: Colors.muted },
  // Terminal / de-emphasized — "Withdrawn", "Didn't move forward".
  muted: { dot: Colors.faint, text: Colors.faint },
};

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  /** Swap the plain dot for a custom icon (e.g. a checkmark for "Matched"). */
  icon?: React.ReactNode;
}

/**
 * Passive/waiting state at a glance — Docket rebrand: a flat caps
 * micro-status (dot + tracked caps text), no chip box. Filled pills are
 * reserved for the row's single action.
 */
export function StatusChip({ label, tone = "waiting", icon }: StatusChipProps) {
  const t = TONE_STYLES[tone];
  return (
    <View style={styles.chip}>
      {icon ?? <View style={[styles.dot, { backgroundColor: t.dot }]} />}
      <Text style={[styles.label, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
