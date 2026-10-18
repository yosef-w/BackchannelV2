// ConnectorHeader — the "connector" opening (Figma iPhone 17-38/-40): the
// applicant's photo → your company's logo, joined by a hairline with an
// arrow disc, then "Amy wants *your role.*" in the brand's serif with the
// italic trail-off. It frames the card as a request aimed at the sponsor's
// seat, which is what the sponsor is actually deciding.
//
// The eyebrow only claims interest when the pack says they liked the role
// (and only claims a time when likedAgo exists); otherwise it's an honest
// "SUGGESTED FOR YOU".

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { ArrowRight } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { joinFacts } from "../dossierFacts";
import { ITALIC_ACCENT } from "./Eyebrow";
import { statsCardCells } from "./facts";
import { LogoTile } from "./LogoTile";
import { StatsCard } from "./StatsCard";
import type { ApplicantFacts, RoleContext } from "./model";

interface ConnectorHeaderProps {
  facts: ApplicantFacts;
  role: RoleContext;
  likedAgo: string | null;
}

export function ConnectorHeader({ facts, role, likedAgo }: ConnectorHeaderProps) {
  const eyebrow = facts.likedRole
    ? joinFacts(["Interested", likedAgo]).toUpperCase()
    : "SUGGESTED FOR YOU";
  const first = facts.firstName || facts.name;
  const sub = joinFacts([role.title, role.company]);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.connector}
        accessible
        accessibilityLabel={`${facts.name} to ${role.company}`}
      >
        <Avatar photoUrl={facts.photoUrl} name={facts.name} size={88} borderRadius={16} />
        <View style={styles.bridge}>
          <View style={styles.hairline} />
          <View style={styles.disc}>
            <ArrowRight size={14} color={Colors.ink} strokeWidth={2.25} />
          </View>
        </View>
        <LogoTile
          logoUrl={role.logoUrl}
          name={role.company}
          size={88}
          borderRadius={16}
          style={styles.logo}
        />
      </View>

      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.headline} accessibilityRole="header">
        {`${first} wants `}
        <Text style={styles.headlineEm}>your role.</Text>
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}

      <View style={styles.stats}>
        <StatsCard facts={facts} cells={statsCardCells(facts)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  connector: { flexDirection: "row", alignItems: "center" },
  bridge: { width: 64, height: 28, alignItems: "center", justifyContent: "center" },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderStrong,
  },
  disc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  logo: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginTop: 22,
    textAlign: "center",
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 8,
  },
  headlineEm: { fontFamily: Fonts.serifItalic, color: ITALIC_ACCENT },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.body,
    textAlign: "center",
    marginTop: 6,
  },
  stats: { alignSelf: "stretch", marginTop: 24 },
});
