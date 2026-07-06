import React from "react";
import { StyleSheet, View } from "react-native";
import { EditorScreen } from "../profile/EditorScreen";

interface MatchListScreenProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The full (unsliced) set of OpportunityRow elements for this group. */
  children: React.ReactNode;
}

/**
 * Full-screen "See all" list for a Matches group that's over its row cap.
 * Reuses the same EditorScreen shell as the Account redesign and renders
 * the exact same rows MatchSection would, just uncapped — so tapping
 * "See all" feels like paging deeper into the same list, not a different
 * screen.
 */
export function MatchListScreen({
  visible,
  onClose,
  title,
  children,
}: MatchListScreenProps) {
  const rows = React.Children.toArray(children);
  return (
    <EditorScreen visible={visible} onClose={onClose} title={title}>
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
  group: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
});
