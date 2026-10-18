// PhotoFramingGuide — a small pictogram + one sentence that tells someone,
// BEFORE they crop, how their profile photo will be shown to sponsors.
//
// The iOS picker's crop is always a square, and the sponsor's card shows the
// middle of that square in a wide frame with the name across the bottom
// third (see components/home/sponsor/photoFraming.ts). Nothing used to say
// so, so people framed a photo for the square and were surprised by the
// card. The diagram is deliberately literal: the square they crop, the
// window sponsors actually see (trimmed top and bottom), where a face should
// sit, and the name band that covers the bottom.
//
// Static and dependency-free (Views only). Applicants only — sponsors'
// photos aren't shown in this card.

import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

const SQUARE = 96;
// The wide card shows ~75% of the square's height, centred.
const WINDOW_H = Math.round(SQUARE * 0.75);
const WINDOW_TOP = Math.round((SQUARE - WINDOW_H) / 2);

export const PHOTO_GUIDE_TEXT =
  "Frame a square with your face in the upper middle. Sponsors see the middle of it in a wide card, with your name along the bottom.";

export function PhotoFramingGuide({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={`How sponsors see your photo. ${PHOTO_GUIDE_TEXT}`}
    >
      <View style={styles.square} importantForAccessibility="no-hide-descendants">
        <View style={styles.window}>
          <View style={styles.face} />
          <View style={styles.nameBand}>
            <View style={styles.nameBar} />
          </View>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>HOW SPONSORS SEE YOUR PHOTO</Text>
        <Text style={styles.body}>{PHOTO_GUIDE_TEXT}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  // The square the person crops. Its trimmed top and bottom are the lighter
  // surface; the darker window is what sponsors see.
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  window: {
    position: "absolute",
    top: WINDOW_TOP,
    left: 0,
    right: 0,
    height: WINDOW_H,
    backgroundColor: Colors.borderStrong,
    overflow: "hidden",
    alignItems: "center",
  },
  // Where a face should land: upper middle, clear of the name band.
  face: {
    marginTop: 8,
    width: 28,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.paper,
  },
  nameBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: Math.round(WINDOW_H * 0.3),
    backgroundColor: "rgba(10,10,10,0.82)",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  nameBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.paper,
  },
  copy: { flex: 1, gap: 6 },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.body,
  },
});
