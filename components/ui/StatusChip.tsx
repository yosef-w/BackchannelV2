import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

export type StatusTone = "active" | "waiting" | "muted";

const TONE_STYLES: Record<
  StatusTone,
  { bg: string; border: string; dot: string; text: string }
> = {
  // Something moved forward / needs no further waiting — e.g. "Referred",
  // "Matched", "Now Sponsored". Bold black dot + text, same pattern the
  // old referral badge used ("referralBadgeReferred").
  active: { bg: Colors.surface, border: Colors.border, dot: "#000", text: "#000" },
  // Sitting in a queue, nothing to do but wait — "Pending", "Waitlisted".
  waiting: { bg: Colors.border, border: Colors.border, dot: Colors.muted, text: Colors.body },
  // Terminal / de-emphasized — "Withdrawn", "Didn't move forward".
  muted: { bg: Colors.surface, border: Colors.border, dot: Colors.faint, text: Colors.muted },
};

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  /** Swap the plain dot for a custom icon (e.g. a checkmark for "Matched"). */
  icon?: React.ReactNode;
}

/** Small pill used on Matches rows to show passive/waiting state at a glance. */
export function StatusChip({ label, tone = "waiting", icon }: StatusChipProps) {
  const t = TONE_STYLES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: "700" },
});
