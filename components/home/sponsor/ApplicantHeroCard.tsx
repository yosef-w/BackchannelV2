// ApplicantHeroCard — the "hero" opening (Figma iPhone 17-13/-9): a
// full-bleed portrait with the identity and the decisive numbers laid over
// a dark bottom-up gradient, in a frosted stat grid.
//
// Everything on it is optional by the DATA HONESTY RULE: no strong-match
// pill unless the fit really is strong, no bio line without a bio, no grid
// without stats — and no photo means an ink card with a serif initial, not
// a stock silhouette. Text is laid out bottom-up and allowed to wrap, so
// large Dynamic Type grows upward into the photo instead of clipping.
//
// Gradient is react-native-svg (expo-linear-gradient isn't in the binary,
// and a native dep would block OTA — runtimeVersion is fingerprint-based).

import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Check, Flag } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale, hitSlopTo44 } from "@/lib/responsive";
import { joinFacts } from "../dossierFacts";
import type { ApplicantFacts, StatCell } from "./model";

const HERO_HEIGHT = 508;

interface ApplicantHeroCardProps {
  facts: ApplicantFacts;
  strength: "strong" | null;
  stats: StatCell[];
  /** Sits under a RoleContextRow: square top, rounded bottom. */
  joined?: boolean;
  /** Report affordance on the photo's top-right corner (scrim flag). */
  onReport?: () => void;
}

export function ApplicantHeroCard({
  facts,
  strength,
  stats,
  joined = false,
  onReport,
}: ApplicantHeroCardProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // minHeight, not height: at large text the overlay block may need more
  // room than the photo frame — the card grows instead of clipping.
  const minHeight = Math.min(HERO_HEIGHT, Math.round(windowHeight * 0.6));
  const photo = (facts.photoUrl || "").trim();
  const subline = joinFacts([facts.currentTitle, facts.currentCompany, facts.location]);
  const cells = stats.slice(0, 4);
  const rows = useMemo(() => {
    const out: StatCell[][] = [];
    for (let i = 0; i < cells.length; i += 2) out.push(cells.slice(i, i + 2));
    return out;
  }, [cells]);

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
      style={[styles.card, { minHeight }, joined ? styles.cardJoined : styles.cardAlone]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top center"
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

      {strength === "strong" ? (
        <View style={styles.pill}>
          <Check size={16} color={Colors.go} strokeWidth={2.5} />
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
        {facts.bioSummary ? (
          <Text style={styles.bio} numberOfLines={fontScale > 1.2 ? 3 : 2}>
            {facts.bioSummary}
          </Text>
        ) : null}

        {rows.length > 0 ? (
          <View style={styles.grid}>
            <BlurView tint="dark" intensity={25} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.gridTint]} />
            {rows.map((row, i) => (
              <View key={i} style={[styles.gridRow, i > 0 && styles.gridRowGap]}>
                {row.map((cell) => (
                  <View key={cell.label} style={styles.cell}>
                    <Text style={styles.cellLabel}>{cell.label.toUpperCase()}</Text>
                    <Text style={styles.cellValue}>{cell.value}</Text>
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
  },
  initial: {
    fontFamily: Fonts.serif,
    fontSize: 160,
    lineHeight: 180,
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
    backgroundColor: Colors.goLight,
  },
  pillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.go,
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
  bio: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
  },
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
