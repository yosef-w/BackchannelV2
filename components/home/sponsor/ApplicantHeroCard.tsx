// ApplicantHeroCard — the "hero" opening (Tori's Figma, "Back Channel"
// 151:11194): a full-bleed portrait with the identity and the decisive
// numbers laid over a dark bottom-up gradient, the numbers in a frosted
// grid along the photo's bottom edge.
//
// The grid once collided with HomeView's floating Pass/Connect pills (they
// are pinned to the same edge and covered its second row), and for a while
// the stats lived on paper under a shorter photo instead. They are back on
// the photo as designed; what changed is the card's HEIGHT — the composer
// (SponsorApplicantCard) now ends the whole card a clear gap above the
// pills, so nothing on it is ever covered. The one-line bio the Figma also
// puts on the photo stays in the ABOUT section below.
//
// Everything on it is optional by the DATA HONESTY RULE: no strong-match
// pill unless the fit really is strong — and no photo means an ink card
// with a serif initial, not a stock silhouette. Text is laid out bottom-up
// and allowed to wrap, so large Dynamic Type grows upward into the photo
// instead of clipping.
//
// Gradient is react-native-svg (expo-linear-gradient isn't in the binary,
// and a native dep would block OTA — runtimeVersion is fingerprint-based).

import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Check, Flag } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, hitSlopTo44 } from "@/lib/responsive";
import { joinFacts } from "../dossierFacts";
import type { ApplicantFacts, StatCell } from "./model";
import { heroPhotoPosition } from "./photoFraming";
import { HERO_MIN } from "./stageLayout";

interface ApplicantHeroCardProps {
  facts: ApplicantFacts;
  strength: "strong" | null;
  /** The decisive numbers for the frosted grid (first four are shown).
   * Omitted or empty → no grid, by the DATA HONESTY RULE. */
  stats?: StatCell[];
  /** The card's height, computed by SponsorApplicantCard from the room above
   * the floating pills (stageLayout.heroPhotoHeight). A minHeight, so large
   * Dynamic Type grows the card instead of clipping the overlay. */
  height?: number;
  /** Sits under a RoleContextRow: square top, rounded bottom. */
  joined?: boolean;
  /** Report affordance on the photo's top-right corner (scrim flag). */
  onReport?: () => void;
}

export function ApplicantHeroCard({
  facts,
  strength,
  stats,
  height = HERO_MIN,
  joined = false,
  onReport,
}: ApplicantHeroCardProps) {
  const { fontScale } = useWindowDimensions();
  const photo = (facts.photoUrl || "").trim();
  // Framing: where to crop the photo so the face stays above the name
  // overlay (photoFraming.ts). The card's width and the photo's real size
  // (known once it loads) feed it; until then it assumes the square every
  // upload is cropped to. Keyed to the url so a stale size never frames the
  // next applicant's photo.
  const [cardW, setCardW] = useState(0);
  const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null);
  const known = natural && natural.url === photo ? natural : null;
  const position = heroPhotoPosition({
    imgW: known?.w ?? 1,
    imgH: known?.h ?? 1,
    boxW: cardW || 370,
    boxH: height,
  });
  const subline = joinFacts([facts.currentTitle, facts.currentCompany, facts.location]);

  const cells = (stats ?? []).slice(0, 4);
  const rows: StatCell[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  const a11y = [
    facts.name,
    subline,
    strength === "strong" ? "Strong match" : null,
    ...cells.map((c) => `${c.label}: ${c.value}`),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      style={[styles.card, { minHeight: height }, joined ? styles.cardJoined : styles.cardAlone]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setCardW((prev) => (prev === w ? prev : w));
      }}
    >
      {/* Keyed on the card's height: the card settles into its real height
          a few frames after it first mounts (estimate → measured stage →
          measured role row and ledger), and the native image and gradient
          views kept the frame they were first drawn at — a black band above
          the photo and a gradient that stopped short, washing out the name.
          Remounting them when the height changes redraws both at the final
          size. It only happens while the deck is settling or on rotation. */}
      <View
        key={Math.round(height)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={position}
            onLoad={(e) =>
              setNatural({ url: photo, w: e.source.width, h: e.source.height })
            }
            cachePolicy="memory-disk"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.initialWrap} pointerEvents="none">
            <Text style={styles.initial} maxFontSizeMultiplier={1}>
              {(facts.firstName || facts.name || "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Svg
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
              {/* Starts at 20% (not the Figma's ~35%) so a name that wraps
                  upward at large text sizes still sits on enough dark for
                  AA contrast, even over a bright photo. */}
              <Stop offset="0.2" stopColor={Colors.ink} stopOpacity={0} />
              <Stop offset="0.55" stopColor={Colors.ink} stopOpacity={0.45} />
              <Stop offset="1" stopColor={Colors.ink} stopOpacity={0.85} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
        </Svg>
      </View>

      {strength === "strong" ? (
        <View style={styles.pill}>
          <Check size={16} color={Colors.ink} strokeWidth={2.5} />
          <Text style={styles.pillText} maxFontSizeMultiplier={FontScale.control}>
            STRONG MATCH
          </Text>
        </View>
      ) : null}

      {onReport ? (
        <Pressable
          onPress={onReport}
          style={({ pressed }) => [styles.flag, pressed && styles.flagPressed]}
          hitSlop={hitSlopTo44(30, 30)}
          accessibilityRole="button"
          accessibilityLabel={`Report ${facts.name || "this applicant"}`}
        >
          <Flag size={14} color={Colors.paper} strokeWidth={2.25} />
        </Pressable>
      ) : null}

      <View style={styles.bottom}>
        <Text style={styles.name} numberOfLines={fontScale > 1.3 ? 3 : 2}>
          {facts.name}
        </Text>
        {subline ? <Text style={styles.subline}>{subline}</Text> : null}

        {rows.length > 0 ? (
          <View style={styles.grid}>
            <BlurView tint="dark" intensity={25} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.gridTint]} />
            {rows.map((row, i) => (
              <View key={i} style={[styles.gridRow, i > 0 && styles.gridRowGap]}>
                {row.map((cell) => (
                  <View key={cell.label} style={styles.cell}>
                    <Text style={styles.cellLabel} numberOfLines={1}>
                      {cell.label.toUpperCase()}
                    </Text>
                    <Text style={styles.cellValue} numberOfLines={2}>
                      {cell.value}
                    </Text>
                  </View>
                ))}
                {row.length === 1 ? <View style={styles.cell} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same dark scrim circle HomeView's floating report flag uses, so it
  // reads on any photo.
  flag: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(10,10,10,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  flagPressed: { opacity: 0.7 },
  card: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: Colors.ink,
    justifyContent: "flex-end",
  },
  cardAlone: { borderRadius: 24 },
  cardJoined: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  initialWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 70,
  },
  initial: {
    fontFamily: Fonts.serif,
    fontSize: 120,
    lineHeight: 136,
    color: Colors.mutedOnInk,
  },
  pill: {
    position: "absolute",
    top: 14,
    left: 11,
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.paper,
  },
  pillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.ink,
  },
  bottom: {
    // Leaves room for the badge at the top when the text grows.
    marginTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.paper,
  },
  subline: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.paper,
    marginTop: 4,
  },
  // The frosted stat grid (Figma "Overlay+Border+OverlayBlur").
  grid: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
    padding: 17,
  },
  gridTint: { backgroundColor: "rgba(255,255,255,0.10)" },
  gridRow: { flexDirection: "row", gap: 14 },
  gridRowGap: { marginTop: 14 },
  cell: { flex: 1, minWidth: 0 },
  cellLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.7)",
  },
  cellValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.paper,
    marginTop: 3,
  },
});
