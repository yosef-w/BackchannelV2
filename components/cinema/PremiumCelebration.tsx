// PremiumCelebration — "The Two Doors": the premium-purchase moment,
// played once right after RevenueCat reports a completed purchase
// (never for restores — restoring isn't buying).
//
// The story, on one ~3.4s cinema clock: the deck sits banded like a
// stack of banknotes by an ink strap printed MEMBERS ONLY. The strap
// strains twice (soft ticks), TEARS with ragged paper edges (heavy
// impact) — and one tear reveals BOTH perks: the deck sweeps open to
// the left while the job-marketplace tile springs in on the right,
// twin chips stamping underneath (YOUR DECK / THE MARKET). The serif
// headline lands word by word — "The whole floor is yours." — signed
// "Member since today."
//
// Deliberately "quiet money": ink and paper, no confetti — a members
// club stamps your card, it doesn't throw glitter.
//
// Rendered globally (app/_layout's host) inside an RN Modal, driven by
// useSubscriptionStore.celebrationPending — which can only ever be set
// while PREMIUM_ENABLED is true, since presentPaywall() short-circuits
// otherwise. Dormant by construction when the flag is off.

import { Search } from "@/components/ui/icons";
import React, { useEffect } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Colors, Fonts } from "@/constants/theme";
import {
  backOut,
  type CinemaBeat,
  easeIn,
  easeOut,
  useCinemaHaptics,
  win,
} from "./engine";

const TOTAL_MS = 3400;

// Soft ticks as the band strains, a heavy hit as it gives way, a tick
// and a success as the two unlock chips stamp on — the films'
// anticipation-then-commit pattern.
const BEATS: readonly CinemaBeat[] = [
  { at: 0.135, kind: "tick" },
  { at: 0.24, kind: "tick" },
  { at: 0.3, kind: "heavy" },
  { at: 0.45, kind: "tick" },
  { at: 0.53, kind: "success" },
];

// Deck geometry: packed under the band → swept open toward the LEFT,
// clearing the stage's right side for the marketplace tile.
const CARDS: {
  packed: number;
  r: number;
  spread: number;
  lift: number;
  rs: number;
}[] = [
  { packed: -26, r: -4, spread: -92, lift: -26, rs: -10 },
  { packed: -13, r: 2, spread: -64, lift: -18, rs: -5 },
  { packed: 0, r: -1, spread: -36, lift: -28, rs: -2 },
  { packed: 13, r: 3, spread: -14, lift: -16, rs: 2 },
  { packed: 26, r: -2, spread: 8, lift: -24, rs: 6 },
];
const SPREAD_A = 0.33;
const SPREAD_B = 0.535;

const BAND_W = 224;
const BAND_H = 25;
const HALF_W = BAND_W / 2;

// Ragged tear edges — a zigzag on each half's inner side.
const LEFT_TEAR_PATH = `M0 0 H${HALF_W - 6} L${HALF_W} 3.1 L${HALF_W - 6} 6.2 L${HALF_W} 9.4 L${HALF_W - 6} 12.5 L${HALF_W} 15.6 L${HALF_W - 6} 18.8 L${HALF_W} 21.9 L${HALF_W - 6} 25 H0 Z`;
const RIGHT_TEAR_PATH = `M6 0 H${HALF_W} V25 H6 L0 21.9 L6 18.8 L0 15.6 L6 12.5 L0 9.4 L6 6.2 L0 3.1 Z`;

const WORDS: { word: string; accent?: boolean }[] = [
  { word: "The" },
  { word: "whole" },
  { word: "floor" },
  { word: "is" },
  { word: "yours.", accent: true },
];
const WORD_START = 0.632;
const WORD_STAGGER = 0.031;
const WORD_LEN = 0.165;

function CaptionWord({
  t,
  index,
  word,
  accent,
}: {
  t: SharedValue<number>;
  index: number;
  word: string;
  accent?: boolean;
}) {
  const start = WORD_START + index * WORD_STAGGER;
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, start, start + WORD_LEN));
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] };
  });
  return (
    <Animated.Text
      style={[styles.headline, accent && styles.headlineAccent, style]}
    >
      {word}{" "}
    </Animated.Text>
  );
}

function DeckCard({
  t,
  card,
}: {
  t: SharedValue<number>;
  card: (typeof CARDS)[number];
}) {
  const style = useAnimatedStyle(() => {
    const tv = t.value;
    const inP = easeOut(win(tv, 0.02, 0.1));
    const p = backOut(win(tv, SPREAD_A, SPREAD_B));
    const x = card.packed + (card.spread - card.packed) * p;
    const rot = card.r + (card.rs - card.r) * p;
    return {
      opacity: inP,
      transform: [
        { translateX: x },
        { translateY: (1 - inP) * 10 + card.lift * p },
        { rotate: `${rot}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.card, style]}>
      <Text style={styles.cardMonogram}>B</Text>
    </Animated.View>
  );
}

export function PremiumCelebration({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      {/* Mount-gated so the one-shot clock starts fresh every time. */}
      {visible && <CelebrationScene onDone={onDone} />}
    </Modal>
  );
}

function CelebrationScene({ onDone }: { onDone: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: TOTAL_MS, easing: Easing.linear });
  }, [t]);
  useCinemaHaptics(t, BEATS);

  // The band strains twice (scaleX pulses) before it gives.
  const bandWrap = useAnimatedStyle(() => {
    const tv = t.value;
    const p1 = win(tv, 0.124, 0.2);
    const p2 = win(tv, 0.2, 0.287);
    const strain =
      Math.sin(p1 * Math.PI) * 0.028 + Math.sin(p2 * Math.PI) * 0.045;
    const inP = easeOut(win(tv, 0.02, 0.1));
    return { opacity: inP, transform: [{ scaleX: 1 + strain }] };
  });

  const tearLeft = useAnimatedStyle(() => {
    const p = easeIn(win(t.value, 0.294, 0.456));
    return {
      opacity: 1 - win(t.value, 0.39, 0.456),
      transform: [
        { translateX: -74 * p },
        { translateY: 64 * p },
        { rotate: `${-16 * p}deg` },
      ],
    };
  });

  const tearRight = useAnimatedStyle(() => {
    const p = easeIn(win(t.value, 0.294, 0.456));
    return {
      opacity: 1 - win(t.value, 0.39, 0.456),
      transform: [
        { translateX: 74 * p },
        { translateY: 58 * p },
        { rotate: `${14 * p}deg` },
      ],
    };
  });

  // The second door: the marketplace tile springs in on the right as
  // the deck clears left.
  const marketTile = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.456, 0.632));
    return {
      opacity: Math.min(1, p * 2),
      transform: [
        { translateY: (1 - p) * 26 },
        { scale: 0.8 + p * 0.2 },
        { rotate: `${4 - p * 2}deg` },
      ],
    };
  });

  const chipDeck = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.441, 0.588));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ scale: 0.7 + p * 0.3 }],
    };
  });

  const chipMarket = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.515, 0.662));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ scale: 0.7 + p * 0.3 }],
    };
  });

  const subtitle = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0.868, 0.985));
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  return (
    <View style={styles.screen}>
      <View style={styles.stage}>
        <View style={styles.scene}>
          <View style={styles.cardsLayer}>
            {CARDS.map((card, i) => (
              <DeckCard key={i} t={t} card={card} />
            ))}
          </View>

          {/* The MEMBERS ONLY band — two pre-split halves that render as
              one strap until the tear sends them tumbling. Each half
              clips a full-width label so the text splits mid-word, and
              carries a ragged zigzag on its torn edge. */}
          <Animated.View style={[styles.bandWrap, bandWrap]}>
            <Animated.View style={[styles.bandHalf, styles.bandLeft, tearLeft]}>
              <Svg width={HALF_W} height={BAND_H} style={StyleSheet.absoluteFill}>
                <Path d={LEFT_TEAR_PATH} fill={Colors.ink} />
              </Svg>
              <View style={[styles.bandTextClip, { left: 0 }]}>
                <Text style={styles.bandText}>MEMBERS ONLY</Text>
              </View>
            </Animated.View>
            <Animated.View
              style={[styles.bandHalf, styles.bandRight, tearRight]}
            >
              <Svg width={HALF_W} height={BAND_H} style={StyleSheet.absoluteFill}>
                <Path d={RIGHT_TEAR_PATH} fill={Colors.ink} />
              </Svg>
              <View style={[styles.bandTextClip, { left: -HALF_W }]}>
                <Text style={styles.bandText}>MEMBERS ONLY</Text>
              </View>
            </Animated.View>
          </Animated.View>

          {/* The marketplace — search field + listing skeletons, the
              middle-tab job search the purchase just unlocked. */}
          <Animated.View style={[styles.marketTile, marketTile]}>
            <View style={styles.marketSearch}>
              <Search color={Colors.muted} size={10} strokeWidth={2.6} />
              <Text style={styles.marketSearchText}>Search roles</Text>
            </View>
            <View style={[styles.marketRow, { width: "88%" }]} />
            <View style={[styles.marketRow, { width: "64%" }]} />
          </Animated.View>

          <View style={styles.chipRow}>
            <Animated.View style={[styles.chip, chipDeck]}>
              <Text style={styles.chipText}>YOUR DECK</Text>
            </Animated.View>
            <Animated.View style={[styles.chip, chipMarket]}>
              <Text style={styles.chipText}>THE MARKET</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={styles.captionZone}>
        <View style={styles.headlineRow}>
          {WORDS.map((w, i) => (
            <CaptionWord
              key={`${w.word}-${i}`}
              t={t}
              index={i}
              word={w.word}
              accent={w.accent}
            />
          ))}
        </View>
        <Animated.Text style={[styles.subtitle, subtitle]}>
          Member since today.
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Start Exploring</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.paper },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  scene: {
    width: 280,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
  },
  cardsLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "40%",
    alignItems: "center",
  },
  card: {
    position: "absolute",
    top: -39,
    width: 58,
    height: 78,
    borderRadius: 10,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  cardMonogram: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: Colors.faint,
  },
  bandWrap: {
    position: "absolute",
    top: "40%",
    marginTop: -BAND_H / 2,
    width: BAND_W,
    height: BAND_H,
    flexDirection: "row",
    zIndex: 3,
  },
  bandHalf: {
    width: HALF_W,
    height: BAND_H,
    overflow: "hidden",
  },
  bandLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  bandRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  bandTextClip: {
    position: "absolute",
    top: 0,
    width: BAND_W,
    height: BAND_H,
    alignItems: "center",
    justifyContent: "center",
  },
  bandText: {
    color: Colors.paper,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 2,
  },
  marketTile: {
    position: "absolute",
    top: "54%",
    right: 2,
    width: 118,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 10,
    zIndex: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  marketSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 7,
  },
  marketSearchText: {
    fontSize: 8.5,
    color: Colors.muted,
    fontWeight: "600",
  },
  marketRow: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    marginBottom: 5,
  },
  chipRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: Colors.paper,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  captionZone: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 28,
    minHeight: 118,
  },
  headlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 25,
    lineHeight: 32,
    color: Colors.ink,
  },
  headlineAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    color: Colors.body,
    marginTop: 10,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  cta: {
    width: "78%",
    height: 56,
    backgroundColor: Colors.ink,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
