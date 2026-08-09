import { ChevronRight } from "@/components/ui/icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

interface InboxSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  hidden?: boolean;
  /**
   * Collapsed-by-default sections (Past Connections, Hidden) render just a
   * tappable summary header — the WhatsApp "Archived" pattern — so dead
   * threads don't push the inbox down. Active stays always-expanded.
   */
  collapsible?: boolean;
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
  collapsible,
}: InboxSectionProps) {
  const [collapsed, setCollapsed] = useState(!!collapsible);

  if (hidden) return null;

  return (
    <View style={[styles.container, collapsible && styles.containerDrawer]}>
      {collapsible ? (
        /* Collapsed sections read as quiet hairline rows with a serif
           count — the Docket's "archived drawer". */
        <TouchableOpacity
          style={styles.collapsedRow}
          onPress={() => setCollapsed((c) => !c)}
          activeOpacity={0.7}
        >
          <Text style={styles.title}>{title}</Text>
          <View style={{ flex: 1 }} />
          {count > 0 && <Text style={styles.collapsedCount}>{count}</Text>}
          <ChevronRight
            size={16}
            color={Colors.faint}
            style={!collapsed && { transform: [{ rotate: "90deg" }] }}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.header}>
          <Text style={styles.title}>
            {title}
            {count > 0 ? ` · ${count}` : ""}
          </Text>
        </View>
      )}
      {!collapsed && <View style={styles.group}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Active gets clear air before the archived drawers; the drawers
  // themselves stack flush so their top rules read as one ruled block.
  container: { marginBottom: 34 },
  containerDrawer: { marginBottom: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 15,
  },
  collapsedCount: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Colors.faint,
  },
  // Flat hairline group — the Docket rebrand: rows sit on the paper
  // between rules, no recessed box.
  group: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 8,
  },
});
