import { ChevronRight } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

interface HubRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  /** Small trailing text, e.g. "Updated 2d", "2/3 answered". */
  value?: string;
  /** Black count pill — e.g. missing-field counts, badge counts. */
  badgeCount?: number;
  /** Tints label + icon red for destructive rows (e.g. Log Out). */
  destructive?: boolean;
  isLast?: boolean;
}

/**
 * The one row shape for every Profile hub group (Finish Your Profile,
 * Profile, Settings). Icon tile + label + optional value/badge + chevron —
 * same tap-target and divider language as MatchesView's OpportunityRow, so
 * the two main tabs read as one design system.
 */
export function HubRow({
  icon,
  label,
  onPress,
  value,
  badgeCount,
  destructive,
  isLast,
}: HubRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconTile, destructive && styles.iconTileDestructive]}>
        {icon}
      </View>
      <Text
        style={[styles.label, destructive && styles.labelDestructive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!!value && <Text style={styles.value}>{value}</Text>}
      {!!badgeCount && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
      {!destructive && <ChevronRight size={18} color={Colors.faint} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // 2026-08 "Two Faces" rebrand — flat hairline rows on the paper (no
  // gray tiles/recesses); every row keeps its bottom rule so the group
  // reads as a ledger.
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowDivider: {},
  iconTile: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileDestructive: {},
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink,
  },
  labelDestructive: {
    color: Colors.danger,
    fontWeight: "700",
  },
  // Serif trailing value — the site's stat-number language.
  value: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Colors.muted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: Colors.paper },
});
