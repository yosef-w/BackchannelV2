// PlanReel — what changes when you join, as a three-beat reel on the
// cinema engine: the deck cards getting five stamps instead of two, the
// sponsor-request letters going out past the lock, and a marketplace
// listing whose VIEW ONLY chip becomes a button that presses itself. A
// stories-style hairline shows where you are; a tap hard-cuts to the next
// beat; captions reveal word by word. Same grammar as the intro film, so
// the paywall reads as the same hand that built the app.
//
// Paper on ink only — every premium surface mounts it in the dark pitch
// zone. Reduce Motion gets the PlanLedger (which already renders its final
// state instantly) instead of a reel that would never move.

import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import {
  ActProgress,
  backOut,
  CinemaCaption,
  easeIn,
  easeOut,
  useCinemaClock,
  useCinemaHaptics,
  win,
} from "@/components/cinema/engine";
import { Colors, Fonts } from "@/constants/theme";
import { PlanLedger } from "./PlanLedger";
import {
  ACT_STARTS,
  ACTS,
  at,
  BEAT_COUNT,
  BEATS,
  CAPTION,
  DECK,
  HEADLINES,
  LETTERS,
  LISTING,
  SUBS,
  TOTAL_MS,
} from "./planReelContent";

/** Beat-local windowed progress: 0 before `a` inside beat `b`, 1 after `c`. */
const bw = (t: number, b: number, a: number, c: number): number => {
  "worklet";
  return win((t - b / BEAT_COUNT) * BEAT_COUNT, a, c);
};

const STAGE_H = 150;
const PAPER_72 = "rgba(255,255,255,0.72)";
const PAPER_45 = "rgba(255,255,255,0.45)";

export function PlanReel({ style }: { style?: ViewStyle }) {
  const reduceMotion = useReducedMotion();
  // Hooks run unconditionally; the clock just never starts under Reduce
  // Motion (useCinemaClock checks it too), and we render the ledger instead.
  const { master, focused, advance } = useCinemaClock(TOTAL_MS, 0, ACT_STARTS);
  useCinemaHaptics(master, BEATS, focused);

  if (reduceMotion) return <PlanLedger onInk style={style} />;

  return (
    <View style={[styles.reel, style]}>
      <ActProgress master={master} acts={ACTS} onInk />
      <Pressable
        style={styles.stage}
        onPress={advance}
        accessibilityRole="button"
        accessibilityLabel="Skip to the next benefit"
      >
        <Scene master={master} beat={0}>
          <DeckBeat master={master} />
        </Scene>
        <Scene master={master} beat={1}>
          <LettersBeat master={master} />
        </Scene>
        <Scene master={master} beat={2}>
          <ListingBeat master={master} />
        </Scene>
      </Pressable>
      <View style={styles.headlineSlot}>
        {HEADLINES.map((segments, b) => (
          <CinemaCaption
            key={b}
            master={master}
            enter={at(b, CAPTION.headlineEnter)}
            out={[at(b, CAPTION.out[0]), at(b, CAPTION.out[1])]}
            segments={segments}
            textStyle={styles.headline}
            accentStyle={styles.headlineAccent}
          />
        ))}
      </View>
      <View style={styles.subSlot}>
        {SUBS.map((text, b) => (
          <CinemaCaption
            key={b}
            master={master}
            enter={at(b, CAPTION.subEnter)}
            out={[at(b, CAPTION.out[0]), at(b, CAPTION.out[1])]}
            segments={[{ text }]}
            textStyle={styles.sub}
          />
        ))}
      </View>
    </View>
  );
}

// ── Scene: one beat's stage, visible only during its third of the reel ────

function Scene({
  master,
  beat,
  children,
}: {
  master: SharedValue<number>;
  beat: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const t = master.value;
    const o = bw(t, beat, 0, 0.04) * (1 - bw(t, beat, 0.95, 1));
    return { opacity: o };
  });
  return (
    <Animated.View style={[styles.scene, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

// ── Beat 1 · the deck: five stamps, not two ───────────────────────────────

function DeckBeat({ master }: { master: SharedValue<number> }) {
  const strike = useAnimatedStyle(() => ({
    width: `${easeOut(bw(master.value, 0, DECK.strike[0], DECK.strike[1])) * 100}%`,
  }));
  const five = useAnimatedStyle(() => {
    const p = backOut(bw(master.value, 0, DECK.five[0], DECK.five[1]));
    return { opacity: Math.min(1, p * 2), transform: [{ scale: 0.6 + p * 0.4 }] };
  });
  return (
    <View style={styles.deckStage}>
      <View style={styles.deckRow}>
        {DECK.stamps.map((stampAt, i) => (
          <StampCard key={i} master={master} stampAt={stampAt} />
        ))}
      </View>
      <View style={styles.capRow}>
        <View>
          <Text style={styles.capFree}>2 A DAY, FREE</Text>
          <Animated.View style={[styles.capStrike, strike]} />
        </View>
        <Animated.Text style={[styles.capFive, five]}>5</Animated.Text>
      </View>
    </View>
  );
}

function StampCard({
  master,
  stampAt,
}: {
  master: SharedValue<number>;
  stampAt: number;
}) {
  const ink = useAnimatedStyle(() => {
    const p = backOut(bw(master.value, 0, stampAt, stampAt + 0.08));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ scale: 1.7 - p * 0.7 }, { rotate: "-8deg" }],
    };
  });
  return (
    <View style={styles.card}>
      <View style={styles.cardId} />
      <View style={[styles.cardLine, { top: 26 }]} />
      <View style={[styles.cardLine, { top: 33, right: 14 }]} />
      <Animated.View style={[styles.cardStamp, ink]}>
        <Text style={styles.cardStampMark}>✓</Text>
      </Animated.View>
    </View>
  );
}

// ── Beat 2 · the letters: every sponsor, not one ──────────────────────────

function LettersBeat({ master }: { master: SharedValue<number> }) {
  const lock = useAnimatedStyle(() => {
    const t = master.value;
    const o =
      bw(t, 1, LETTERS.lockIn[0], LETTERS.lockIn[1]) *
      (1 - bw(t, 1, LETTERS.lockOut[0], LETTERS.lockOut[1]));
    return { opacity: o };
  });
  const shackle = useAnimatedStyle(() => {
    const p = backOut(bw(master.value, 1, LETTERS.lockOpen[0], LETTERS.lockOpen[1]));
    return { transform: [{ translateY: -5 * p }, { rotate: `${-14 * p}deg` }] };
  });
  return (
    <View style={styles.lettersStage}>
      <View style={styles.lettersColumn}>
        <Letter master={master} from={LETTERS.first[0]} to={LETTERS.first[1]} onUs />
        {[0, 1, 2].map((i) => (
          <Letter
            key={i}
            master={master}
            from={LETTERS.rest[0] + i * LETTERS.restStagger}
            to={LETTERS.rest[1] + i * LETTERS.restStagger}
          />
        ))}
      </View>
      <Animated.View style={[styles.lock, lock]}>
        <Svg width={18} height={20} viewBox="0 0 18 20" fill="none">
          <Rect x={2} y={8} width={14} height={10} rx={2} stroke={Colors.paper} strokeWidth={1.6} />
        </Svg>
        <Animated.View style={[styles.shackle, shackle]}>
          <Svg width={18} height={20} viewBox="0 0 18 20" fill="none">
            <Path d="M4 8V6a5 5 0 0 1 10 0v2" stroke={Colors.paper} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={styles.sponsor}>
        <View style={styles.sponsorAvatar}>
          <Text style={styles.sponsorInitial}>S</Text>
        </View>
        <Text style={styles.sponsorLabel}>SPONSOR</Text>
      </View>
    </View>
  );
}

function Letter({
  master,
  from,
  to,
  onUs = false,
}: {
  master: SharedValue<number>;
  from: number;
  to: number;
  onUs?: boolean;
}) {
  const fly = useAnimatedStyle(() => {
    const p = easeIn(bw(master.value, 1, from, to));
    return {
      transform: [{ translateX: p * 150 }],
      opacity: 1 - bw(master.value, 1, to - 0.03, to),
    };
  });
  return (
    <Animated.View style={[styles.letter, fly]}>
      <View style={styles.letterId} />
      <View style={styles.letterLine} />
      {onUs && <Text style={styles.letterTag}>ON US</Text>}
    </Animated.View>
  );
}

// ── Beat 3 · the listing: act on roles, don't just look ───────────────────

function ListingBeat({ master }: { master: SharedValue<number> }) {
  const chip = useAnimatedStyle(() => {
    const p = bw(master.value, 2, LISTING.chipOut[0], LISTING.chipOut[1]);
    return { opacity: 1 - p, transform: [{ scale: 1 - 0.2 * p }] };
  });
  const pill = useAnimatedStyle(() => {
    const t = master.value;
    const inP = backOut(bw(t, 2, LISTING.pillIn[0], LISTING.pillIn[1]));
    // A press: down for the first half of the window, back up for the second.
    const half = (LISTING.press[0] + LISTING.press[1]) / 2;
    const press =
      bw(t, 2, LISTING.press[0], half) * (1 - bw(t, 2, half, LISTING.press[1]));
    return {
      opacity: Math.min(1, inP * 2),
      transform: [{ scale: (0.8 + inP * 0.2) * (1 - 0.06 * press) }],
    };
  });
  const label = useAnimatedStyle(() => ({
    opacity: 1 - bw(master.value, 2, LISTING.labelOut[0], LISTING.labelOut[1]),
  }));
  const tick = useAnimatedStyle(() => {
    const p = backOut(bw(master.value, 2, LISTING.tick[0], LISTING.tick[1]));
    return { opacity: Math.min(1, p * 2), transform: [{ scale: 0.5 + p * 0.5 }] };
  });
  return (
    <View style={styles.listingStage}>
      <View style={styles.listing}>
        <View style={styles.listingTop}>
          <Text style={styles.listingRole}>Product Designer</Text>
          <Text style={styles.listingSalary}>$150k</Text>
        </View>
        <Text style={styles.listingMeta}>
          Northwind · Remote · <Text style={styles.listingSponsored}>Sponsored</Text>
        </Text>
        <View style={styles.listingRule} />
        <View style={styles.listingAction}>
          <Text style={styles.listingVouch}>{"A SPONSOR'S NAME IS ON THIS"}</Text>
          <View style={styles.actionSlot}>
            <Animated.View style={[styles.chip, chip]}>
              <Text style={styles.chipText}>VIEW ONLY</Text>
            </Animated.View>
            <Animated.View style={[styles.pill, pill]}>
              <Animated.Text style={[styles.pillText, label]}>Express interest</Animated.Text>
              <Animated.Text style={[styles.pillTick, tick]}>✓</Animated.Text>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reel: { alignSelf: "stretch" },
  stage: { height: STAGE_H, marginTop: 10 },
  scene: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  headlineSlot: { height: 58, marginTop: 6 },
  subSlot: { height: 44, marginTop: 2 },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    lineHeight: 28,
    color: Colors.paper,
  },
  headlineAccent: { fontFamily: Fonts.serifItalic, color: Colors.mutedOnInk },
  sub: {
    fontFamily: Fonts.sansLight,
    fontSize: 13.5,
    lineHeight: 19,
    color: PAPER_72,
  },

  // Beat 1
  deckStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  deckRow: { flexDirection: "row", gap: 9, alignItems: "flex-end" },
  card: {
    width: 46,
    height: 62,
    borderRadius: 6,
    backgroundColor: Colors.paper,
    overflow: "hidden",
  },
  cardId: { position: "absolute", left: 7, top: 7, width: 12, height: 12, backgroundColor: Colors.ink },
  cardLine: { position: "absolute", left: 7, right: 7, height: 3, backgroundColor: Colors.border },
  cardStamp: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStampMark: { fontFamily: Fonts.serif, fontSize: 30, color: Colors.ink },
  capRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    gap: 10,
  },
  capFree: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: PAPER_45,
  },
  capStrike: {
    position: "absolute",
    left: -1,
    top: "52%",
    height: 1.5,
    backgroundColor: Colors.paper,
    opacity: 0.6,
  },
  capFive: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.paper },

  // Beat 2
  lettersStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  lettersColumn: { width: 150, gap: 7 },
  letter: {
    height: 26,
    borderRadius: 5,
    backgroundColor: Colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
  },
  letterId: { width: 10, height: 10, backgroundColor: Colors.ink },
  letterLine: { flex: 1, height: 3, backgroundColor: Colors.border },
  letterTag: { fontFamily: Fonts.sansBold, fontSize: 8, letterSpacing: 1, color: Colors.ink },
  lock: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -12,
    marginTop: 4,
  },
  shackle: { position: "absolute" },
  sponsor: { position: "absolute", right: 18, alignItems: "center", gap: 6 },
  sponsorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorInitial: { fontFamily: Fonts.serif, fontSize: 17, color: Colors.ink },
  sponsorLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.55)",
  },

  // Beat 3
  listingStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  listing: {
    width: 290,
    backgroundColor: Colors.paper,
    borderRadius: 10,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  listingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  listingRole: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: Colors.ink },
  listingSalary: { fontFamily: Fonts.serif, fontSize: 15, color: Colors.ink },
  listingMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.muted },
  listingSponsored: { fontFamily: Fonts.sansSemiBold, color: Colors.ink },
  listingRule: { height: 1, backgroundColor: Colors.border, marginTop: 2 },
  listingAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 34 },
  listingVouch: {
    fontFamily: Fonts.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: Colors.faint,
    flexShrink: 1,
  },
  actionSlot: { width: 118, height: 34 },
  chip: {
    position: "absolute",
    right: 0,
    top: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    justifyContent: "center",
  },
  chipText: { fontFamily: Fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: Colors.faint },
  pill: {
    position: "absolute",
    right: 0,
    top: 0,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: Colors.paper },
  pillTick: { position: "absolute", fontFamily: Fonts.serif, fontSize: 18, color: Colors.paper },
});
