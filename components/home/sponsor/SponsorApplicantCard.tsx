// SponsorApplicantCard — sponsor deck v2's card, composed from Tori's
// "Home & Matches" Figma. One of three openings leads (SPONSOR_CARD_LAYOUT):
//   hero      — role row joined onto a full-bleed photo card
//   connector — applicant → your company, "Amy wants *your role.*", stats
//   fit       — identity row, "Wants your *Role.*", the fit table
// and the same record follows in every layout (about, experience,
// education, achievements, skills, prompts).
//
// Purely presentational: it takes the normalized ApplicantFacts /
// RoleContext / FitSummary (derived in facts.ts) and renders a plain View
// — HomeView owns the ScrollView, gestures and the floating DecisionPills.
// The 140pt tail spacer keeps those pills off the last section.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Flag } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { hitSlopTo44 } from "@/lib/responsive";
import type { SponsorCardLayout } from "@/constants/config";
import { ApplicantHeroCard } from "./ApplicantHeroCard";
import { ConnectorHeader } from "./ConnectorHeader";
import { FitHeader } from "./FitHeader";
import { FitTable } from "./FitTable";
import { heroStats, relativeAgo } from "./facts";
import {
  AboutSection,
  AchievementsSection,
  EducationSection,
  ExperienceSection,
  MoreAboutSection,
  SkillsSection,
} from "./ProfileSections";
import { RoleContextRow } from "./RoleContextRow";
import type { ApplicantFacts, FitSummary, RoleContext } from "./model";

export interface SponsorApplicantCardProps {
  facts: ApplicantFacts;
  role: RoleContext | null;
  fit: FitSummary;
  layout: SponsorCardLayout;
  onOpenRoleSwitcher?: () => void;
  onViewProfile?: () => void;
  /** Opens the report sheet. Rendered as a quiet "Report <name>" link at
   * the end of every layout — the one report affordance that never
   * collides with the opening (HomeView's floating flag skips "fit"). */
  onReport?: () => void;
}

/** Space reserved under the last section for the floating decision pills. */
export const SPONSOR_CARD_TAIL = 140;

function SponsorApplicantCardImpl({
  facts,
  role,
  fit,
  layout,
  onOpenRoleSwitcher,
  onViewProfile,
  onReport,
}: SponsorApplicantCardProps) {
  // connector/fit are framed around the sponsor's role — without one, fall
  // back to the hero, which stands on the applicant alone.
  const effective: SponsorCardLayout = role ? layout : "hero";

  let opening: React.ReactNode;
  let showAbout = true;
  if (effective === "connector" && role) {
    opening = (
      <ConnectorHeader
        facts={facts}
        role={role}
        likedAgo={facts.likedAt ? relativeAgo(facts.likedAt) : null}
      />
    );
  } else if (effective === "fit" && role) {
    opening = (
      <>
        <FitHeader facts={facts} role={role} fit={fit} onViewProfile={onViewProfile} />
        <FitTable fit={fit} firstName={facts.firstName || facts.name} />
      </>
    );
  } else {
    opening = (
      <View style={styles.heroWrap}>
        {role ? (
          <RoleContextRow
            role={role}
            joined
            eyebrow={facts.likedRole ? "Interested in your role" : "Suggested for your role"}
            onPress={onOpenRoleSwitcher}
          />
        ) : null}
        <ApplicantHeroCard
          facts={facts}
          joined={!!role}
          strength={fit.strength}
          stats={heroStats(facts)}
          onReport={onReport}
        />
      </View>
    );
    // Tori's Proposal 1 goes straight from the photo card to EXPERIENCE:
    // the card's bio summary is the "about", and "cut anything that
    // doesn't help them decide" is the brief. The full bio stays one tap
    // away in the public profile.
    showAbout = false;
  }

  const first = facts.firstName || facts.name;
  return (
    <View>
      {opening}
      {showAbout ? <AboutSection firstName={first} bio={facts.bio} /> : null}
      <ExperienceSection groups={facts.experienceGroups} />
      <EducationSection items={facts.education} />
      <AchievementsSection items={facts.achievements} />
      <SkillsSection skills={facts.skills} />
      <MoreAboutSection firstName={first} prompts={facts.prompts} />
      {onReport ? (
        <Pressable
          onPress={onReport}
          style={({ pressed }) => [styles.report, pressed && styles.reportPressed]}
          hitSlop={hitSlopTo44(110, 40)}
          accessibilityRole="button"
          accessibilityLabel={`Report ${facts.name || "this applicant"}`}
        >
          <Flag size={13} color={Colors.muted} strokeWidth={2} />
          <Text style={styles.reportText}>Report {first}</Text>
        </Pressable>
      ) : null}
      <View style={styles.tail} />
    </View>
  );
}

export const SponsorApplicantCard = React.memo(SponsorApplicantCardImpl);

const styles = StyleSheet.create({
  heroWrap: { paddingHorizontal: 16, paddingTop: 8 },
  tail: { height: SPONSOR_CARD_TAIL },
  report: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 32,
    paddingVertical: 12,
    alignSelf: "center",
  },
  reportPressed: { opacity: 0.6 },
  reportText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: "underline",
  },
});
