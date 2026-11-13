// JobBriefCard — applicant deck v2's card: the "role brief".
//
// The mirror of the sponsor deck's SponsorApplicantCard, so both sides of
// the app read as one: an opening card sized to the stage above the floating
// decision capsule, the same four-cell HeroLedger on paper under it, then a
// short read in the same Eyebrow voice. Where the sponsor's opening is a
// portrait (the person leads), this one leads with the ROLE: the company's
// logo as the picture, the title on a band beneath it — both in the calm
// greys, no ink slab — and the sponsor as "your way in" on paper under the
// card. A role nobody has sponsored yet keeps the same layout and says so.
//
// One gesture: scroll. The plates' slide row, tap zones and hint lines are
// gone. The scroll is a digest (your fit, what they need, the sponsor's
// words, perks); the long job description waits behind a disclosure, so
// nobody has to wade through a résumé-length page to decide.
//
// Purely presentational, like its sponsor twin: it takes JobFacts (derived
// in jobFacts.ts) and renders a plain View — HomeView owns the ScrollView,
// the gestures and the floating DecisionPills.

import { Image } from "expo-image";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { Check, ChevronDown, ChevronUp, ExternalLink, Flag } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, hitSlopTo44, shouldStackForFontScale } from "@/lib/responsive";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { extractDisplayDomain } from "../../jobs/jobTransforms";
import { Eyebrow, QUIET_FILL } from "../sponsor/Eyebrow";
import { HeroLedger } from "../sponsor/HeroLedger";
import { SPONSOR_CARD_TAIL } from "../sponsor/SponsorApplicantCard";
import {
  floatingActionsBottom,
  heroOpeningMinHeight,
  heroPhotoHeight,
  LEDGER_ESTIMATE,
  pillsReserve,
} from "../sponsor/stageLayout";
import type { JobFacts, JobPassage } from "./jobFacts";

export interface JobBriefCardProps {
  facts: JobFacts;
  /** WAITLISTED / SPONSOR REQUESTED / APPLIED — what the applicant has
   * already done with this role, or null. */
  statusLabel?: string | null;
  /** Measured height of HomeView's card stage; null until first layout. */
  stageHeight?: number | null;
  /** Opens the report sheet for the role's sponsor. */
  onReport?: () => void;
}

// ── Disclosure row ────────────────────────────────────────────────────────

function Disclosure({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.disclosureRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={styles.disclosureText}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          {hint && !open ? <Text style={styles.disclosureHint}>{hint}</Text> : null}
        </View>
        <Chevron size={20} color={Colors.ink} strokeWidth={2} />
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

function Passages({ items }: { items: JobPassage[] }) {
  return (
    <>
      {items.map((p) => (
        <View key={p.label} style={styles.passage}>
          <Eyebrow>{p.label}</Eyebrow>
          <Text style={styles.body}>{p.text}</Text>
        </View>
      ))}
    </>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function JobBriefCardImpl({
  facts,
  statusLabel = null,
  stageHeight = null,
  onReport,
}: JobBriefCardProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // Same stage math as the sponsor hero: the ink card gets what's left
  // above the floating capsule once the ledger is measured, so the ledger's
  // last row always ends a clear gap above the pills.
  const [ledgerH, setLedgerH] = useState(LEDGER_ESTIMATE);
  const openingMin = heroOpeningMinHeight(
    stageHeight,
    windowHeight,
    pillsReserve(floatingActionsBottom(Platform.OS), shouldStackForFontScale(fontScale)),
  );
  const [wayInH, setWayInH] = useState(WAY_IN_ESTIMATE);
  const cardHeight = heroPhotoHeight(openingMin, wayInH, facts.ledger.length ? ledgerH : 0);
  // The logo is the card's picture: as large as the panel comfortably holds.
  const logoSize = Math.max(72, Math.min(128, Math.round(cardHeight * 0.3)));

  const s = facts.sponsor;
  const wayIn = s
    ? s.canRefer
      ? `${s.firstName} can refer you`
      : `${s.firstName} put their name on this role`
    : "No sponsor yet";
  const wayInDetail = s
    ? s.detail
    : `You'll hear the moment someone at ${facts.company || "this company"} signs on.`;

  const a11y = [
    facts.title,
    facts.subline,
    statusLabel,
  ]
    .filter(Boolean)
    .join(". ");

  const sourceDomain = facts.sourceUrl ? extractDisplayDomain(facts.sourceUrl) : "";
  const moreFromSponsor = facts.moreQuotes.length > 0 || facts.insights.length > 0;

  return (
    <View>
      {/* The opening owns the whole first screen: the short read starts just
          past the fold instead of showing through under the capsule. */}
      <View style={[styles.heroWrap, stageHeight ? { minHeight: stageHeight } : null]}>
        {/* ── The card: the company on top, the role beneath ── */}
        <View
          style={[styles.card, { minHeight: cardHeight }]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={a11y}
        >
          <View style={styles.logoPanel}>
            <CompanyLogo
              logoUrl={facts.logoUrl}
              name={facts.company}
              size={logoSize}
              borderRadius={Math.round(logoSize * 0.23)}
              backgroundColor={Colors.paper}
              textColor={Colors.ink}
              initialFontSize={Math.round(logoSize * 0.5)}
            />
            {statusLabel ? (
              <View style={styles.status}>
                <Check size={12} color={Colors.paper} strokeWidth={3} />
                <Text style={styles.statusText} maxFontSizeMultiplier={FontScale.control}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.band}>
            <Text style={styles.title} numberOfLines={fontScale > 1.3 ? 4 : 3}>
              {facts.title}
            </Text>
            {facts.subline ? <Text style={styles.subline}>{facts.subline}</Text> : null}
          </View>
        </View>

        {/* ── Your way in, on paper under the card ── */}
        <View
          style={styles.wayIn}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            setWayInH((prev) => (prev === h ? prev : h));
          }}
        >
          {s ? (
            s.image ? (
              <Image
                source={{ uri: s.image }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial} maxFontSizeMultiplier={1}>
                  {s.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          ) : null}
          <View style={styles.wayInText}>
            <Text style={styles.wayInEyebrow} maxFontSizeMultiplier={FontScale.label}>
              {s ? "YOUR WAY IN" : "OPEN ROLE"}
            </Text>
            <Text style={styles.wayInTitle}>{wayIn}</Text>
            {wayInDetail ? <Text style={styles.wayInDetail}>{wayInDetail}</Text> : null}
          </View>
        </View>

        {/* ── The decisive facts, on paper (the sponsor deck's ledger) ── */}
        <View
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            setLedgerH((prev) => (prev === h ? prev : h));
          }}
        >
          <HeroLedger cells={facts.ledger} />
        </View>
      </View>

      {/* ── The short read ── */}
      {facts.brief ? (
        <View style={styles.section}>
          <Eyebrow>About the role</Eyebrow>
          <Text style={styles.briefText}>{facts.brief}</Text>
        </View>
      ) : null}

      {facts.skillsMatched.length + facts.skillsOther.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>
            {facts.skillsMatched.length > 0
              ? `Your fit · ${facts.skillsMatched.length} of ${
                  facts.skillsMatched.length + facts.skillsOther.length
                } skills`
              : "Skills they want"}
          </Eyebrow>
          <View style={styles.chips}>
            {facts.skillsMatched.map((skill) => (
              <View
                key={`m-${skill}`}
                style={[styles.chip, styles.chipMatched]}
                accessible
                accessibilityLabel={`${skill}, on your profile`}
              >
                <Check size={13} color={Colors.paper} strokeWidth={3} />
                <Text style={[styles.chipText, styles.chipTextMatched]}>{skill}</Text>
              </View>
            ))}
            {facts.skillsOther.map((skill) => (
              <View key={`o-${skill}`} style={styles.chip}>
                <Text style={styles.chipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {facts.needs.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>What they need</Eyebrow>
          <View style={styles.needs}>
            {facts.needs.map((line, i) => (
              <View key={line} style={styles.needRow}>
                <Text style={styles.needNumber} maxFontSizeMultiplier={FontScale.control}>
                  {i + 1}
                </Text>
                <Text style={styles.needText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {s && facts.quote ? (
        <View style={styles.section}>
          <Eyebrow>{`From ${s.firstName}`}</Eyebrow>
          <ExpandableText style={styles.quote} numberOfLines={5}>
            {`“${facts.quote.answer}”`}
          </ExpandableText>
          <Text style={styles.quoteAttr}>
            {[facts.quote.question, s.verified ? "Verified" : ""].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ) : null}

      {facts.perks.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>Benefits</Eyebrow>
          <Text style={[styles.body, styles.sectionBody]}>{facts.perks.join(" · ")}</Text>
        </View>
      ) : null}

      {/* ── The long read, on request ── */}
      <View style={styles.disclosures}>
        {facts.fullRead.length > 0 ? (
          <Disclosure title="Full job description">
            <Passages items={facts.fullRead} />
          </Disclosure>
        ) : null}
        {s && moreFromSponsor ? (
          <Disclosure title={`More from ${s.firstName}`} hint="More about the role">
            {facts.moreQuotes.map((q) => (
              <View key={q.question} style={styles.passage}>
                <Eyebrow>{q.question}</Eyebrow>
                <Text style={styles.body}>{q.answer}</Text>
              </View>
            ))}
            <Passages items={facts.insights} />
          </Disclosure>
        ) : null}
        {facts.companyDescription ? (
          <Disclosure title={`About ${facts.company || "the company"}`}>
            <Text style={styles.body}>{facts.companyDescription}</Text>
          </Disclosure>
        ) : null}
        {sourceDomain ? (
          <View style={styles.disclosure}>
            <Pressable
              onPress={() => openExternalUrl(facts.sourceUrl)}
              style={({ pressed }) => [styles.disclosureRow, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`Original posting on ${sourceDomain}`}
            >
              <View style={styles.disclosureText}>
                <Text style={styles.disclosureTitle}>Original posting</Text>
                <Text style={styles.disclosureHint}>{sourceDomain}</Text>
              </View>
              <ExternalLink size={18} color={Colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {onReport && s ? (
        <Pressable
          onPress={onReport}
          style={({ pressed }) => [styles.report, pressed && styles.pressed]}
          hitSlop={hitSlopTo44(110, 40)}
          accessibilityRole="button"
          accessibilityLabel={`Report ${s.name}`}
        >
          <Flag size={13} color={Colors.muted} strokeWidth={2} />
          <Text style={styles.reportText}>Report {s.firstName}</Text>
        </Pressable>
      ) : null}
      <View style={styles.tail} />
    </View>
  );
}

export const JobBriefCard = React.memo(JobBriefCardImpl);

/** First-render guess for the measured way-in row. */
const WAY_IN_ESTIMATE = 64;

const styles = StyleSheet.create({
  // Same gutters and top padding as the sponsor card's heroWrap.
  heroWrap: { paddingHorizontal: 16, paddingTop: 8 },
  pressed: { opacity: 0.6 },

  // ── The card: a logo panel over a title band, both in the calm greys ──
  card: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: QUIET_FILL,
  },
  logoPanel: {
    flexGrow: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  status: {
    position: "absolute",
    top: 14,
    left: 12,
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.ink,
  },
  statusText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.paper,
  },
  band: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 37,
    color: Colors.ink,
  },
  subline: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.body,
    marginTop: 4,
  },

  // ── Your way in ──
  wayIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 14,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.paper },
  wayInText: { flex: 1, minWidth: 0 },
  wayInEyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  wayInTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
    marginTop: 3,
  },
  wayInDetail: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 1,
  },

  // ── Short read (the sponsor card's section rhythm) ──
  section: { paddingHorizontal: 16, marginTop: 36 },
  sectionBody: { marginTop: 14 },
  briefText: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 29,
    color: Colors.ink,
    marginTop: 14,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.body,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: QUIET_FILL,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipMatched: { backgroundColor: Colors.ink },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  chipTextMatched: { color: Colors.paper },
  needs: { marginTop: 14, gap: 12 },
  needRow: { flexDirection: "row", gap: 12 },
  needNumber: {
    width: 16,
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.muted,
  },
  needText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.ink,
  },
  quote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.ink,
    marginTop: 14,
  },
  quoteAttr: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 10,
  },

  // ── Disclosures ──
  disclosures: {
    marginTop: 36,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
  },
  disclosure: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  disclosureRow: {
    minHeight: 60,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  disclosureText: { flex: 1, minWidth: 0 },
  disclosureTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  disclosureHint: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 2,
  },
  disclosureBody: { paddingBottom: 20, gap: 20 },
  passage: { gap: 8 },

  report: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 32,
    paddingVertical: 12,
    alignSelf: "center",
  },
  reportText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: "underline",
  },
  tail: { height: SPONSOR_CARD_TAIL },
});
