// PremiumCelebration — "The Gate / Currency Band": the premium-purchase
// moment, played once right after RevenueCat reports a completed
// purchase (never for restores — restoring isn't buying).
//
// The story, on one ~2.9s cinema clock: the daily deck sits banded like
// a stack of banknotes by an ink currency strap printed DAILY LIMIT ·
// 10. The strap strains twice against the cards (anticipation, soft
// ticks), then TEARS — ragged paper edges, both halves tumbling away
// (heavy impact) — and the deck springs open (backOut). A DECK UNLOCKED
// chip stamps on (success), the serif headline lands word by word ("No
// more waiting for tomorrow."), and the subtitle signs it: "Member
// since today."
//
// Deliberately "quiet money": ink and paper, no confetti — a members
// club stamps your card, it doesn't throw glitter.
//
// Rendered globally (app/_layout's host) inside an RN Modal, driven by
// useSubscriptionStore.celebrationPending — which can only ever be set
// while PREMIUM_ENABLED is true, since presentPaywall() short-circuits
// otherwise. Dormant by construction when the flag is off.

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

const TOTAL_MS = 2900;

// Soft ticks as the band strains, a heavy hit as it gives way, success
// as the chip lands — the films' anticipation-then-commit pattern.
const BEATS: readonly CinemaBeat[] = [
  { at: 0.16, kind: "tick" },
  { at: 0.26, kind: "tick" },
  { at: 0.35, kind: "heavy" },
  { at: 0.56, kind: "success" },
];

// Deck geometry: packed positions under the band → sprung-open spread.
const CARDS: {
  packed: number;
  r: number;
  spread: number;
  lift: number;
  rs: number;
}[] = [
  { packed: -26, r: -4, spread: -84, lift: -6, rs: -9 },
  { packed: -13, r: 2, spread: -42, lift: 2, rs: -4 },
  { packed: 0, r: -1, spread: 0, lift: -8, rs: 0 },
  { packed: 13, r: 3, spread: 42, lift: 3, rs: 4 },
  { packed: 26, r: -2, spread: 84, lift: -5, rs: 9 },
];
const SPREAD_A = 0.385;
const SPREAD_B = 0.625;

const BAND_W = 236;
const BAND_H = 26;
const HALF_W = BAND_W / 2;

// Ragged tear edges — a zigzag on each half's inner side. Points
// alternate 6px in/out across the band's height.
const LEFT_TEAR_PATH = `M0 0 H${HALF_W - 6} L${HALF_W} 3.25 L${HALF_W - 6} 6.5 L${HALF_W} 9.75 L${HALF_W - 6} 13 L${HALF_W} 16.25 L${HALF_W - 6} 19.5 L${HALF_W} 22.75 L${HALF_W - 6} 26 H0 Z`;
const RIGHT_TEAR_PATH = `M6 0 H${HALF_W} V26 H6 L0 22.75 L6 19.5 L0 16.25 L6 13 L0 9.75 L6 6.5 L0 3.25 Z`;

// Headline words — the films' caption rhythm rescaled to this clock.
const WORDS: { word: string; accent?: boolean }[] = [
  { word: "No" },
  { word: "more" },
  { word: "waiting" },
  { word: "for" },
  { word: "tomorrow.", accent: true },
];
const WORD_START = 0.56;
const WORD_STAGGER = 0.036;
const WORD_LEN = 0.19;

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
    const inP = easeOut(win(tv, 0.02, 0.12));
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
    const p1 = win(tv, 0.145, 0.24);
    const p2 = win(tv, 0.24, 0.335);
    const strain =
      Math.sin(p1 * Math.PI) * 0.028 + Math.sin(p2 * Math.PI) * 0.045;
    const inP = easeOut(win(tv, 0.02, 0.12));
    return { opacity: inP, transform: [{ scaleX: 1 + strain }] };
  });

  const tearLeft = useAnimatedStyle(() => {
    const p = easeIn(win(t.value, 0.345, 0.535));
    return {
      opacity: 1 - win(t.value, 0.46, 0.535),
      transform: [
        { translateX: -74 * p },
        { translateY: 64 * p },
        { rotate: `${-16 * p}deg` },
      ],
    };
  });

  const tearRight = useAnimatedStyle(() => {
    const p = easeIn(win(t.value, 0.345, 0.535));
    return {
      opacity: 1 - win(t.value, 0.46, 0.535),
      transform: [
        { translateX: 74 * p },
        { translateY: 58 * p },
        { rotate: `${14 * p}deg` },
      ],
    };
  });

  const chip = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.545, 0.72));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ scale: 0.7 + p * 0.3 }],
    };
  });

  const subtitle = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0.845, 0.99));
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

          {/* The currency band — two pre-split halves that render as one
              strap until the tear sends them tumbling. Each half clips a
              full-width label so the text splits mid-word, and carries a
              ragged zigzag on its torn edge. */}
          <Animated.View style={[styles.bandWrap, bandWrap]}>
            <Animated.View style={[styles.bandHalf, styles.bandLeft, tearLeft]}>
              <Svg width={HALF_W} height={BAND_H} style={StyleSheet.absoluteFill}>
                <Path d={LEFT_TEAR_PATH} fill={Colors.ink} />
              </Svg>
              <View style={[styles.bandTextClip, { left: 0 }]}>
                <Text style={styles.bandText}>DAILY LIMIT · 10</Text>
              </View>
            </Animated.View>
            <Animated.View
              style={[styles.bandHalf, styles.bandRight, tearRight]}
            >
              <Svg width={HALF_W} height={BAND_H} style={StyleSheet.absoluteFill}>
                <Path d={RIGHT_TEAR_PATH} fill={Colors.ink} />
              </Svg>
              <View style={[styles.bandTextClip, { left: -HALF_W }]}>
                <Text style={styles.bandText}>DAILY LIMIT · 10</Text>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.chip, chip]}>
            <Text style={styles.chipText}>DECK UNLOCKED</Text>
          </Animated.View>
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
          <Text style={styles.ctaText}>Keep Swiping</Text>
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
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  cardsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: 62,
    height: 84,
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
    fontSize: 18,
    color: Colors.faint,
  },
  bandWrap: {
    position: "absolute",
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
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
  },
  chip: {
    position: "absolute",
    bottom: 0,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  chipText: {
    color: Colors.paper,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
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
