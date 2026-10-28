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

import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Flag } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { hitSlopTo44, shouldStackForFontScale } from "@/lib/responsive";
import type { SponsorCardLayout } from "@/constants/config";
import { ApplicantHeroCard } from "./ApplicantHeroCard";
import { ConnectorHeader } from "./ConnectorHeader";
import { FitHeader } from "./FitHeader";
import { FitTable } from "./FitTable";
import { HeroLedger } from "./HeroLedger";
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
import {
  floatingActionsBottom,
  heroOpeningMinHeight,
  heroPhotoHeight,
  LEDGER_ESTIMATE,
  pillsReserve,
  ROLE_ROW_ESTIMATE,
} from "./stageLayout";
import type { ApplicantFacts, FitSummary, RoleContext } from "./model";

export interface SponsorApplicantCardProps {
  facts: ApplicantFacts;
  role: RoleContext | null;
  fit: FitSummary;
  layout: SponsorCardLayout;
  /** Measured height of HomeView's card stage (the box holding the scroll
   * AND the floating pills). The hero opening sizes itself to the space
   * above the pills; null until the first layout. */
  stageHeight?: number | null;
  /** Fixes the hero photo's height instead of computing it from the stage —
   * for the profile PREVIEW, which has no floating pills or role row to
   * measure against and wants a typical sponsor-side size. */
  photoHeight?: number;
  /** Space under the last section (default: room for the floating pills). */
  tail?: number;
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
  stageHeight = null,
  photoHeight: photoHeightOverride,
  tail,
  onOpenRoleSwitcher,
  onViewProfile,
  onReport,
}: SponsorApplicantCardProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // connector/fit are framed around the sponsor's role — without one, fall
  // back to the hero, which stands on the applicant alone.
  const effective: SponsorCardLayout = role ? layout : "hero";
  // The hero opening claims exactly the stage above the floating pills:
  // the photo card gets what's left after the role row and ledger (both
  // measured), so the ledger always ends a clear gap above the pills — on
  // a phone of any size, an iPad, or at large text, where the pills stack
  // and the reserve grows. A plain number, not flex. See stageLayout.ts.
  const [roleH, setRoleH] = useState(ROLE_ROW_ESTIMATE);
  const [ledgerH, setLedgerH] = useState(LEDGER_ESTIMATE);
  const heroMinHeight = heroOpeningMinHeight(
    stageHeight,
    windowHeight,
    pillsReserve(
      floatingActionsBottom(Platform.OS),
      shouldStackForFontScale(fontScale),
    ),
  );
  const photoHeight =
    photoHeightOverride ??
    heroPhotoHeight(heroMinHeight, role ? roleH : 0, ledgerH);

  let opening: React.ReactNode;
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
          <View
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              setRoleH((prev) => (prev === h ? prev : h));
            }}
          >
            <RoleContextRow
              role={role}
              joined
              eyebrow={facts.likedRole ? "Interested in your role" : "Suggested for your role"}
              onPress={onOpenRoleSwitcher}
            />
          </View>
        ) : null}
        <ApplicantHeroCard
          facts={facts}
          height={photoHeight}
          joined={!!role}
          strength={fit.strength}
          onReport={onReport}
        />
        {/* The decisive numbers, on paper under a shorter photo card so
            HomeView's floating pills land over whitespace, never on a
            stat (they used to be a frosted grid pinned to the photo's
            bottom edge — the pills' edge too). */}
        <View
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            setLedgerH((prev) => (prev === h ? prev : h));
          }}
        >
          <HeroLedger cells={heroStats(facts)} />
        </View>
      </View>
    );
  }

  // Every layout, hero included: the bio summary used to ride on the hero's
  // photo card in place of ABOUT; with the card trimmed to the person, the
  // ABOUT section carries the bio again.
  const first = facts.firstName || facts.name;
  return (
    <View>
      {opening}
      <AboutSection firstName={first} bio={facts.bio} />
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
      <View style={[styles.tail, tail !== undefined && { height: tail }]} />
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
