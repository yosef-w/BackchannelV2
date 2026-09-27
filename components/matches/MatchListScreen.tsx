import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EditorScreen } from "../profile/EditorScreen";
import { Colors } from "@/constants/theme";

interface MatchListScreenProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The full (unsliced) set of OpportunityRow elements for this group. */
  children: React.ReactNode;
}

/**
 * Full-screen "See all" list for a Matches group that's over its row cap.
 * Reuses the EditorScreen shell and renders the exact same rows
 * MatchSection would, just uncapped, in the same Docket dress: the
 * section's caps eyebrow with its count, then rows flat on paper between
 * hairlines, at the Matches screen's content width. Paging deeper into
 * the same list, not a different screen.
 */
export function MatchListScreen({
  visible,
  onClose,
  title,
  children,
}: MatchListScreenProps) {
  const rows = React.Children.toArray(children);
  return (
    <EditorScreen
      visible={visible}
      onClose={onClose}
      title={title}
      column="content"
    >
      <Text style={styles.eyebrow}>
        {title.toUpperCase()}
        {rows.length > 0 ? ` · ${rows.length}` : ""}
      </Text>
      <View style={styles.group}>
        {rows.map((row, i) =>
          React.isValidElement(row)
            ? React.cloneElement(row as React.ReactElement<any>, {
                isLast: i === rows.length - 1,
              })
            : row,
        )}
      </View>
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  // Mirrors MatchSection's header/group exactly so the two read as one.
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  group: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
