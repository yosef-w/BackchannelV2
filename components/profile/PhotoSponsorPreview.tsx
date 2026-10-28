// PhotoSponsorPreview — the real hero card, built from the photo someone
// just picked, so they see how sponsors will see it BEFORE it goes anywhere.
//
// It renders the actual ApplicantHeroCard (same crop logic, same name
// overlay), not a mock-up, so it can't drift from the sponsor's screen.
// Everything but the photo and name is left empty by the DATA HONESTY RULE:
// at the onboarding photo step we don't yet know their title, company or
// city, so the subline is simply absent rather than invented.

import React, { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { ApplicantHeroCard, buildApplicantFacts } from "@/components/home/sponsor";
import { Colors, Fonts } from "@/constants/theme";
import type { ProfileDeckCard } from "@/types/profiles";

// A representative sponsor-side height: the hero's photo is ~0.74 of its
// width on a typical phone (see stageLayout.heroPhotoHeight).
const HEIGHT_RATIO = 0.74;
const MAX_WIDTH = 360;
const SIDE_GUTTER = 48;

interface PhotoSponsorPreviewProps {
  /** The picked photo (local file or CDN url). */
  uri: string;
  name: string;
  location?: string | null;
  style?: ViewStyle;
}

export function PhotoSponsorPreview({ uri, name, location, style }: PhotoSponsorPreviewProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - SIDE_GUTTER, MAX_WIDTH);
  const height = Math.round(cardWidth * HEIGHT_RATIO);

  const facts = useMemo(() => {
    const card: ProfileDeckCard = {
      id: "me",
      USER_ID: "me",
      name: name.trim(),
      location: (location ?? "").trim(),
      skills: [],
      desiredRole: "",
      bio: "",
      prompts: [],
      image: uri,
      company: "",
    };
    return buildApplicantFacts(card, null);
  }, [uri, name, location]);

  return (
    <View style={[{ width: cardWidth, alignSelf: "center" }, style]}>
      <Text style={styles.eyebrow}>HOW SPONSORS WILL SEE YOU</Text>
      <ApplicantHeroCard facts={facts} strength={null} height={height} />
      <Text style={styles.tip}>
        Face too low, or cut off? Tap Change photo and frame it again, with your
        face in the upper middle.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginBottom: 10,
  },
  tip: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.muted,
    marginTop: 10,
  },
});
