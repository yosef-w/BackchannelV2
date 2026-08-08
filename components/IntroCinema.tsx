// IntroCinema — the pre-signup "what is this app" screen (splash → here →
// choose-role). Instead of telling, the app demos ITSELF as a scripted,
// auto-playing film with the classic problem → turn → solution arc:
//
//   Act 0 (the problem): applications rain into an anonymous pile; a scan
//     line sweeps it and YOUR application gets auto-rejected — the broken
//     status quo (job boards, ATS screens, no human ever looking).
//   The turn: the pile sweeps away. "Your next job comes from someone
//     inside." — the thesis, in the brand serif.
//   Act 1 (the deck): a job card gets passed, the next gets connected.
//   Act 2 (the match): avatars spring together; "It's a Match".
//   Act 3 (the referral): a company tile joins, the backchannel line
//     flows, "Referred ✓" lands. Finale: "That's BackChannel." Loop.
//
// Engineering shape: ONE master clock (a 0→1 shared value on an infinite
// linear repeat) drives every element through windowed interpolations in
// UI-thread worklets — no timeout chains, and the loop restarts seamlessly
// because t=0 and t=1 render identical (empty) stages.
//
// Premium-motion layer (deliberate, per design review):
// - Expo-style bezier eases (fast start, long deceleration) instead of
//   stock cubics — the "expensive" curve Apple/Stripe pieces run on.
// - Anticipation & impact: cards wind up before flying and arc through
//   the air; stamps make their card recoil; the auto-reject shakes the
//   whole pile.
// - Idle life: a slow breathing float on staged actors so no frame is
//   ever frozen.
// - A slow per-act camera push-in (the frame itself moves).
// - A pulse ring on the avatars' contact (the Apple Pay payoff beat).
// - Captions reveal WORD BY WORD (spoken, not slabbed), exit along their
//   direction of travel, and carry typographic voices per act: cold
//   muted problem lines, the thesis in serif with the italic accent,
//   light mechanics, serif finale.

import React, { useEffect, useMemo } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Type } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

const { width: W } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// The solution acts kept their approved pacing (≈16.5s) — the problem act
// occupies the first ~30% of the reel.
const TOTAL_MS = 23500;
const STAGE_H = 320;

// Premium curves: explosive start, long luxurious deceleration for
// entrances; committed acceleration for exits. Evaluated directly in
// worklets — bezierFn's returned closure is itself a worklet (defined
// with a worklet directive inside Reanimated), so it's safe to call from
// useAnimatedStyle. Any plain JS wrapper around these is NOT (a
// non-worklet arrow here previously aborted the whole app with the
// worklet callGuard the moment this screen mounted).
const easeOut = Easing.bezierFn(0.16, 1, 0.3, 1);
const easeIn = Easing.bezierFn(0.55, 0, 0.8, 0.2);
const easeInOut = Easing.bezierFn(0.65, 0, 0.35, 1);
const backOut = Easing.bezierFn(0.34, 1.56, 0.64, 1);

/** Windowed sub-progress: 0 before `a`, 1 after `b`, linear between. */
const win = (t: number, a: number, b: number): number => {
  'worklet';
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
};

// ── Act 0 set dressing ──────────────────────────────────────────────────
// The anonymous pile: small doc cards that rain in and heap up. Fixed,
// hand-scattered positions (x/y relative to stage center, deg rotation);
// index order = fall order.
const PILE_DOCS: { x: number; y: number; r: string }[] = [
  { x: -78, y: 52, r: '-9deg' },
  { x: 44, y: 64, r: '7deg' },
  { x: -18, y: 70, r: '3deg' },
  { x: 92, y: 48, r: '-5deg' },
  { x: -110, y: 66, r: '12deg' },
  { x: 12, y: 44, r: '-14deg' },
  { x: 66, y: 72, r: '11deg' },
  { x: -52, y: 40, r: '5deg' },
  { x: 118, y: 68, r: '4deg' },
  { x: -88, y: 74, r: '-3deg' },
  { x: 28, y: 58, r: '9deg' },
  { x: -34, y: 56, r: '-7deg' },
];
const DOC_FALL_START = 0.012;
const DOC_FALL_STAGGER = 0.006;
const DOC_FALL_LEN = 0.035;

interface IntroCinemaProps {
  /** Advance the funnel (both the CTA and Skip land on role selection). */
  onContinue: () => void;
}

export function IntroCinema({ onContinue }: IntroCinemaProps) {
  const master = useSharedValue(0);
  const march = useSharedValue(0);
  // Idle life: a slow sine breath applied to staged actors (±1 → ±2px).
  const breath = useSharedValue(0);

  useEffect(() => {
    master.value = withRepeat(
      withTiming(1, { duration: TOTAL_MS, easing: Easing.linear }),
      -1,
    );
    march.value = withRepeat(
      withTiming(-240, { duration: 16000, easing: Easing.linear }),
      -1,
    );
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [master, march, breath]);

  // ── Act 0: the problem ────────────────────────────────────────────────

  // Whole-pile container: slow camera push across the act; shakes on the
  // rejection; exits downward during the turn.
  const pileGroup = useAnimatedStyle(() => {
    const t = master.value;
    const push = 1 + 0.04 * win(t, 0.0, 0.26);
    const shakeP = win(t, 0.165, 0.19);
    const shake = Math.sin(shakeP * Math.PI * 3) * 2.5 * (1 - shakeP);
    const out = easeIn(win(t, 0.26, 0.305));
    return {
      opacity: 1 - out,
      transform: [
        { translateX: shake },
        { translateY: out * 60 },
        { scale: push },
      ],
    };
  });

  // Your application — falls last, lands on top of the heap with a
  // follow-through settle.
  const yourDoc = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.085, 0.125));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ translateY: (1 - p) * -260 }],
    };
  });

  // The ATS scan line sweeping down over the heap.
  const scanLine = useAnimatedStyle(() => {
    const t = master.value;
    const sweep = easeInOut(win(t, 0.125, 0.16));
    const vis = win(t, 0.12, 0.13) * (1 - win(t, 0.155, 0.165));
    return {
      opacity: vis * 0.9,
      transform: [{ translateY: -70 + sweep * 150 }],
    };
  });

  const rejectStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.165, 0.19));
    return { opacity: p, transform: [{ scale: 0.7 + p * 0.3 }, { rotate: '-6deg' }] };
  });

  // ── Act 1: the deck ───────────────────────────────────────────────────
  // (All solution-act windows are the approved 16.5s choreography,
  // linearly remapped into [0.30, 1.0] of the longer reel.)

  const stackIn = useAnimatedStyle(() => {
    const t = master.value;
    const inP = easeOut(win(t, 0.30, 0.348));
    const push = 1 + 0.03 * win(t, 0.30, 0.58);
    return {
      opacity: inP,
      transform: [
        { translateY: (1 - inP) * 28 + (breath.value * 2 - 1) * 2 },
        { scale: push },
      ],
    };
  });

  const cardA = useAnimatedStyle(() => {
    const t = master.value;
    // Impact recoil while the Pass mark lands, wind-up lift, then an
    // arcing fly-off (parabolic rise mid-flight).
    const stampP = win(t, 0.356, 0.374);
    const recoil = Math.sin(stampP * Math.PI) * 0.015;
    const windup = easeOut(win(t, 0.368, 0.377));
    const fly = easeIn(win(t, 0.377, 0.437));
    const arc = fly * (1 - fly) * 4; // 0→1→0 parabola
    return {
      opacity: 1 - win(t, 0.423, 0.437),
      transform: [
        { translateX: -fly * (W * 0.95) },
        { translateY: -windup * 6 - arc * 34 },
        { rotate: `${-2 - fly * 17}deg` },
        { scale: 1 - recoil },
      ],
    };
  });

  const passStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.356, 0.374));
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }] };
  });

  const cardB = useAnimatedStyle(() => {
    const t = master.value;
    const promote = easeOut(win(t, 0.419, 0.451));
    const stampP = win(t, 0.447, 0.465);
    const recoil = Math.sin(stampP * Math.PI) * 0.015;
    const windup = easeOut(win(t, 0.459, 0.468));
    const fly = easeIn(win(t, 0.468, 0.528));
    const arc = fly * (1 - fly) * 4;
    return {
      opacity: 1 - win(t, 0.514, 0.528),
      transform: [
        { translateY: 8 - promote * 8 - windup * 6 - arc * 34 },
        { translateX: fly * (W * 0.95) },
        { rotate: `${3 - promote * 3 + fly * 15}deg` },
        { scale: 0.97 + promote * 0.03 - recoil },
      ],
    };
  });

  const connectStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.447, 0.465));
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }] };
  });

  const cardC = useAnimatedStyle(() => {
    const t = master.value;
    const promote = easeOut(win(t, 0.51, 0.542));
    const out = easeIn(win(t, 0.538, 0.58));
    return {
      opacity: 1 - out,
      transform: [
        { translateY: 16 - promote * 16 },
        { scale: 0.94 + promote * 0.06 - out * 0.08 },
      ],
    };
  });

  // ── Acts 2 + 3 share one "scene group" so the camera can push into the
  // whole match-and-referral tableau together. ──────────────────────────

  const sceneGroup = useAnimatedStyle(() => {
    const t = master.value;
    const push = 1 + 0.025 * win(t, 0.545, 0.95);
    const out = win(t, 0.972, 1);
    return {
      opacity: 1 - out,
      transform: [
        { translateY: (breath.value * 2 - 1) * -2 },
        { scale: push },
      ],
    };
  });

  const AV_APART = 120;
  const AV_MEET = 34; // overlap distance from center once met

  const avatarsGroup = useAnimatedStyle(() => {
    const t = master.value;
    const inP = win(t, 0.545, 0.601);
    const shift = easeInOut(win(t, 0.706, 0.755));
    return {
      opacity: inP,
      transform: [
        { translateX: -shift * 90 },
        { scale: 1 - shift * 0.22 },
      ],
    };
  });

  const avatarLeft = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.545, 0.601));
    return { transform: [{ translateX: -AV_APART + p * (AV_APART - AV_MEET) }] };
  });

  const avatarRight = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.545, 0.601));
    return { transform: [{ translateX: AV_APART - p * (AV_APART - AV_MEET) }] };
  });

  // The contact payoff: a soft ring pulses outward the moment they meet.
  const pulseRing = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.598, 0.645));
    return {
      opacity: (1 - p) * 0.5 * win(t, 0.598, 0.602),
      transform: [{ scale: 0.6 + p * 1.3 }],
    };
  });

  const matchBadge = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.601, 0.619));
    const shift = win(t, 0.706, 0.755);
    return { opacity: p * (1 - shift), transform: [{ scale: p }] };
  });

  const matchText = useAnimatedStyle(() => {
    const t = master.value;
    const inP = easeOut(win(t, 0.608, 0.655));
    const out = win(t, 0.692, 0.727);
    return {
      opacity: inP * (1 - out),
      transform: [{ translateY: (1 - inP) * 12 - out * 6 }],
    };
  });

  const companyTile = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.713, 0.762));
    return {
      opacity: p,
      transform: [{ translateX: 90 + (1 - p) * 60 }, { scale: 0.8 + p * 0.2 }],
    };
  });

  const lineStyle = useAnimatedStyle(() => {
    const t = master.value;
    const p = win(t, 0.762, 0.811);
    return { opacity: p };
  });

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: march.value,
  }));

  const referredChip = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.818, 0.85));
    return {
      opacity: p,
      transform: [{ scale: 0.7 + p * 0.3 }, { translateY: (1 - p) * 10 }],
    };
  });

  // Backchannel line geometry: from the (shifted) avatar pair to the
  // company tile, dipping gently below their shared centerline.
  const cx = W / 2;
  const cy = STAGE_H / 2;
  const lineD = `M ${cx - 52} ${cy + 6} Q ${cx} ${cy + 44} ${cx + 56} ${cy + 6}`;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header: eyebrow + Skip */}
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>HOW IT WORKS</Text>
          <TouchableOpacity
            onPress={onContinue}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── The stage ── */}
        <View style={styles.stage}>
          {/* Act 0: the pile, your application, the scan, the verdict */}
          <Animated.View style={[styles.centerSlot, pileGroup]}>
            {PILE_DOCS.map((doc, i) => (
              <PileDoc key={i} doc={doc} index={i} master={master} />
            ))}
            <Animated.View style={[styles.yourDoc, yourDoc]}>
              <View style={styles.yourDocBar} />
              <View style={[styles.yourDocLine, { width: '72%' }]} />
              <View style={[styles.yourDocLine, { width: '52%' }]} />
              <View style={[styles.yourDocLine, { width: '62%' }]} />
              <Animated.View style={[styles.rejectStamp, rejectStamp]}>
                <Text style={styles.rejectStampText}>✕ AUTO-REJECTED</Text>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.scanLine, scanLine]} />
          </Animated.View>

          {/* Act 1: the deck (C under B under A) */}
          <Animated.View style={[styles.cardSlot, stackIn]}>
            <Animated.View style={[styles.miniCard, cardC]}>
              <MiniCardContent
                monogram="N"
                title="Data Scientist"
                company="Northport · Remote"
                chips={['ML', '$165k+']}
              />
            </Animated.View>
            <Animated.View style={[styles.miniCard, cardB]}>
              <MiniCardContent
                monogram="A"
                title="Backend Engineer"
                company="Atlas Health · NYC"
                chips={['Python', '$150k+']}
              />
              <Animated.View style={[styles.connectStamp, connectStamp]}>
                <Text style={styles.connectStampText}>Connect ✓</Text>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.miniCard, cardA]}>
              <MiniCardContent
                monogram="M"
                title="Senior Product Designer"
                company="Meridian Labs · Remote"
                chips={['$130–160k', 'Design']}
              />
              <Animated.View style={[styles.passStamp, passStamp]}>
                <Text style={styles.passStampText}>✕</Text>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Acts 2+3: match & referral, under one camera */}
          <Animated.View style={[styles.centerSlot, sceneGroup]}>
            {/* Backchannel line (under the actors) */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, lineStyle]}
            >
              <Svg width="100%" height="100%">
                <AnimatedPath
                  d={lineD}
                  stroke={Colors.faint}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray="4 8"
                  fill="none"
                  animatedProps={lineProps}
                />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.centerSlot, avatarsGroup]}>
              <Animated.View style={[styles.pulseRing, pulseRing]} />
              <Animated.View style={[styles.avatar, avatarLeft]}>
                <Text style={styles.avatarInitial}>Y</Text>
              </Animated.View>
              <Animated.View style={[styles.avatar, styles.avatarSponsor, avatarRight]}>
                <Text style={styles.avatarInitial}>S</Text>
              </Animated.View>
              <Animated.View style={[styles.matchBadge, matchBadge]}>
                <Text style={styles.matchBadgeText}>✓</Text>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.matchTextWrap, matchText]}>
              <Text style={styles.matchText}>
                It’s a <Text style={styles.matchTextAccent}>Match</Text>
              </Text>
            </Animated.View>

            <Animated.View style={[styles.centerSlot, companyTile]}>
              <View style={styles.companyTile}>
                <Text style={styles.companyMonogram}>M</Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.referredChipWrap, referredChip]}>
              <View style={styles.referredChip}>
                <Text style={styles.referredChipText}>Referred ✓</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* ── Captions ──
            Word-by-word reveals with per-act typographic voices: cold
            muted problem lines, the thesis in serif + italic accent,
            light mechanics, serif finale. */}
        <View style={styles.captionArea}>
          <CinemaCaption
            master={master}
            enter={0.02}
            out={[0.135, 0.16]}
            segments={[{ text: 'Hundreds of applicants. Every posting.' }]}
            textStyle={styles.captionCold}
          />
          <CinemaCaption
            master={master}
            enter={0.165}
            out={[0.275, 0.30]}
            segments={[{ text: 'Screened out before a human sees you.' }]}
            textStyle={styles.captionCold}
          />
          <CinemaCaption
            master={master}
            enter={0.315}
            out={[0.419, 0.44]}
            segments={[
              { text: 'Your next job comes from' },
              { text: 'someone inside.', accent: true },
            ]}
            textStyle={styles.captionThesis}
            accentStyle={styles.captionThesisAccent}
          />
          <CinemaCaption
            master={master}
            enter={0.44}
            out={[0.538, 0.559]}
            segments={[{ text: 'Connect with the jobs you want.' }]}
            textStyle={styles.caption}
          />
          <CinemaCaption
            master={master}
            enter={0.566}
            out={[0.685, 0.706]}
            segments={[{ text: 'Meet your sponsor.' }]}
            textStyle={styles.caption}
          />
          <CinemaCaption
            master={master}
            enter={0.72}
            out={[0.888, 0.909]}
            segments={[{ text: 'They refer you — for real.' }]}
            textStyle={styles.caption}
          />
          <CinemaCaption
            master={master}
            enter={0.916}
            out={[0.979, 1.0]}
            segments={[
              { text: 'That’s' },
              { text: 'BackChannel.', accent: true },
            ]}
            textStyle={styles.captionFinale}
            accentStyle={styles.captionFinaleAccent}
          />
        </View>

        {/* ── CTA ── */}
        <View style={styles.footer}>
          <PressableScale
            pressedScale={0.97}
            onPress={onContinue}
            style={styles.cta}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Choose your role</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Caption engine ──────────────────────────────────────────────────────
// Words reveal one after another (~100ms apart, each on the premium
// decel curve), and the whole line exits by continuing its upward travel
// while fading — motion has one direction, so nothing feels like it
// bounces back where it came from.

const WORD_STAGGER = 0.0045; // ≈105ms between word starts
const WORD_LEN = 0.024; // ≈565ms per word reveal

interface CaptionSegment {
  text: string;
  accent?: boolean;
}

function CinemaCaption({
  master,
  enter,
  out,
  segments,
  textStyle,
  accentStyle,
}: {
  master: SharedValue<number>;
  enter: number;
  out: [number, number];
  segments: CaptionSegment[];
  textStyle: TextStyle;
  accentStyle?: TextStyle;
}) {
  const words = useMemo(
    () =>
      segments.flatMap((seg) =>
        seg.text
          .split(' ')
          .filter(Boolean)
          .map((word) => ({ word, accent: seg.accent })),
      ),
    [segments],
  );

  const containerStyle = useAnimatedStyle(() => {
    const o = easeIn(win(master.value, out[0], out[1]));
    return { opacity: 1 - o, transform: [{ translateY: -o * 10 }] };
  });

  return (
    <Animated.View style={[styles.captionRow, containerStyle]}>
      {words.map((w, i) => (
        <CaptionWord
          key={`${w.word}-${i}`}
          master={master}
          start={enter + i * WORD_STAGGER}
          baseStyle={textStyle}
          accentStyle={w.accent ? accentStyle : undefined}
          word={w.word}
        />
      ))}
    </Animated.View>
  );
}

function CaptionWord({
  master,
  start,
  word,
  baseStyle,
  accentStyle,
}: {
  master: SharedValue<number>;
  start: number;
  word: string;
  baseStyle: TextStyle;
  accentStyle?: TextStyle;
}) {
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(master.value, start, start + WORD_LEN));
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 12 }],
    };
  });

  return (
    <Animated.Text style={[baseStyle, accentStyle, style]}>
      {word}{' '}
    </Animated.Text>
  );
}

/** One anonymous application in the pile — falls in on its index's window. */
function PileDoc({
  doc,
  index,
  master,
}: {
  doc: { x: number; y: number; r: string };
  index: number;
  master: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = master.value;
    const a = DOC_FALL_START + index * DOC_FALL_STAGGER;
    const p = easeOut(win(t, a, a + DOC_FALL_LEN));
    return {
      opacity: p * 0.9,
      transform: [
        { translateX: doc.x },
        { translateY: doc.y + (1 - p) * -260 },
        { rotate: doc.r },
      ],
    };
  });

  return (
    <Animated.View style={[styles.pileDoc, style]}>
      <View style={[styles.pileDocLine, { width: '70%' }]} />
      <View style={[styles.pileDocLine, { width: '50%' }]} />
    </Animated.View>
  );
}

function MiniCardContent({
  monogram,
  title,
  company,
  chips,
}: {
  monogram: string;
  title: string;
  company: string;
  chips: string[];
}) {
  return (
    <>
      <View style={styles.miniHeader}>
        <View style={styles.miniLogo}>
          <Text style={styles.miniMonogram}>{monogram}</Text>
        </View>
        <View style={styles.miniHeaderText}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.miniCompany} numberOfLines={1}>
            {company}
          </Text>
        </View>
      </View>
      <View style={styles.miniPillRow}>
        {chips.map((chip) => (
          <View key={chip} style={styles.miniPill}>
            <Text style={styles.miniPillText}>{chip}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  safeArea: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 18,
  },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.faint,
  },
  skipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.muted,
    padding: 4,
  },
  // ── Stage ─────────────────────────────────────────────────────────────
  stage: {
    height: STAGE_H,
    marginTop: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Act 0: the pile ───────────────────────────────────────────────────
  // Anonymous applications — small, featureless, all alike on purpose.
  pileDoc: {
    position: 'absolute',
    width: 44,
    height: 56,
    borderRadius: 7,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 7,
    gap: 4,
  },
  pileDocLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
  },
  // Yours — bigger, real enough to care about, doomed anyway.
  yourDoc: {
    position: 'absolute',
    width: 120,
    height: 130,
    marginTop: -60,
    borderRadius: 14,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  yourDocBar: {
    height: 9,
    width: '55%',
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginBottom: 2,
  },
  yourDocLine: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.surface,
  },
  scanLine: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: Colors.muted,
  },
  rejectStamp: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rejectStampText: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  // ── Solution-act props ────────────────────────────────────────────────
  // Real-contrast mini job card — this is the demo, not the splash's
  // ghost texture, so it renders at full card fidelity.
  miniCard: {
    position: 'absolute',
    width: 250,
    backgroundColor: Colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  miniLogo: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMonogram: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.body,
  },
  miniHeaderText: { flex: 1, gap: 2 },
  miniTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.ink,
  },
  miniCompany: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Colors.muted,
  },
  miniPillRow: { flexDirection: 'row', gap: 6 },
  miniPill: {
    borderRadius: 999,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniPillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10.5,
    color: Colors.body,
  },
  // Swipe stamps.
  passStamp: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  passStampText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  connectStamp: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  connectStampText: {
    color: Colors.paper,
    fontSize: 11,
    fontWeight: '700',
  },
  // Match scene.
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    position: 'absolute',
  },
  avatarSponsor: { backgroundColor: Colors.border },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.body,
  },
  // The contact payoff — an expanding, fading ring at the meet point.
  pulseRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  matchBadge: {
    position: 'absolute',
    bottom: '50%',
    marginBottom: -46,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.paper,
  },
  matchBadgeText: { color: Colors.paper, fontSize: 12, fontWeight: '800' },
  matchTextWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: 62,
    alignItems: 'center',
  },
  matchText: {
    ...Type.heading,
    color: Colors.ink,
  },
  matchTextAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // Referral scene.
  companyTile: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  companyMonogram: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.body,
  },
  referredChipWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: 58,
    alignItems: 'center',
  },
  referredChip: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  referredChipText: {
    color: Colors.paper,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // ── Captions ──────────────────────────────────────────────────────────
  captionArea: {
    height: 84,
    marginTop: 8,
    justifyContent: 'center',
  },
  captionRow: {
    position: 'absolute',
    left: 36,
    right: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  // Mechanics voice — light, warm.
  caption: {
    fontFamily: Fonts.sansLight,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.body,
  },
  // Problem voice — colder, quieter.
  captionCold: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.muted,
  },
  // The thesis — the film's most important sentence, in the brand serif.
  captionThesis: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 28,
    color: Colors.ink,
  },
  captionThesisAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  captionFinale: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 31,
    color: Colors.ink,
  },
  captionFinaleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // ── CTA ───────────────────────────────────────────────────────────────
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  cta: {
    width: '78%',
    height: 56,
    backgroundColor: Colors.ink,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
