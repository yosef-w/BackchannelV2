// HeldLikeTile — one held card as a row: square identity tile (company
// logo for a job, photo for an applicant), title, and a caps sub-line.
// Shared by the like-cap gate (the card just held) and the end-of-deck
// card (everything held today) so "the thing you wanted" looks the same
// wherever it reappears.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Colors, Fonts, Radii } from "@/constants/theme";
import type { HeldLike } from "@/lib/heldLikes";

export function HeldLikeTile({
  item,
  size = 44,
  compact = false,
}: {
  item: HeldLike;
  size?: number;
  /** Tighter type for a stacked list. */
  compact?: boolean;
}) {
  return (
    <View style={styles.row}>
      {item.kind === "job" ? (
        <CompanyLogo
          logoUrl={item.image}
          name={item.sub}
          size={size}
          borderRadius={Radii.md}
        />
      ) : (
        <Avatar
          photoUrl={item.image}
          name={item.title}
          size={size}
          borderRadius={Radii.md}
        />
      )}
      <View style={styles.text}>
        <Text
          style={[styles.title, compact && styles.titleCompact]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.sub.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.ink,
    letterSpacing: -0.1,
  },
  titleCompact: { fontSize: 14 },
  sub: {
    marginTop: 3,
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.muted,
  },
});
