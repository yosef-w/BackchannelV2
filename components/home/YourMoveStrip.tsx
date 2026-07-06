import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Heart } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { interestedSponsorsQuery } from "../matches/matchesQueries";

interface YourMoveStripProps {
  userType: "applicant" | "sponsor";
  onPress: () => void;
}

/**
 * Slim "sponsors are interested in you" teaser between the deck header and
 * the card — the swipe-app "likes you" pattern, pointing at Matches' Your
 * Move group. Subscribes to the same React Query cache entry MatchesView
 * already populates (see matchesQueries.ts), so on the deck's hot path this
 * usually costs zero network: the strip just reads whatever Matches last
 * fetched, refreshing quietly in the background.
 *
 * Renders nothing for sponsors, while loading, on error, or when nobody's
 * interested — no noise for new users.
 */
export function YourMoveStrip({ userType, onPress }: YourMoveStripProps) {
  const { data: interestedSponsors = [] } = useQuery(
    interestedSponsorsQuery(userType),
  );

  if (userType !== "applicant" || interestedSponsors.length === 0) {
    return null;
  }

  const count = interestedSponsors.length;
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <TouchableOpacity
        style={styles.strip}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${count} sponsor${count === 1 ? "" : "s"} interested in you — view in Matches`}
      >
        <Heart color="#DC2626" size={14} strokeWidth={2.5} />
        <Text style={styles.text} numberOfLines={1}>
          {count === 1
            ? "1 sponsor is interested in you"
            : `${count} sponsors are interested in you`}
        </Text>
        <ChevronRight color="#999" size={16} strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9F9F9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
});
