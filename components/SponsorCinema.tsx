// SponsorCinema — the sponsor's pre-signup film (choose-role → here →
// onboarding slides), the deliberate mirror of IntroCinema: same arc,
// same clock, same motion vocabulary, same premium finish — but this
// time the viewer is the person INSIDE, and the story is theirs:
//
//   Act 0 (the problem): cold referral asks rain into an inbox pile; one
//     lands front and center — a stranger, nothing to go on — and more
//     keep burying it. The verdict slaps on: you CAN'T vouch for someone
//     you don't know. That's the broken status quo of referring.
//   The turn: the pile sweeps away. "Someone's next job comes from you."
//     — the sponsor thesis, in the brand serif.
//   Act 1 (the deck): candidate cards — real people who want in where
//     the sponsor already is — get passed and connected.
//   Act 2 (the match): sponsor and candidate spring together.
//   Act 3 (the referral): the company tile joins, the backchannel line
//     flows, "Referred ✓" lands — the climax (a door only they could
//     open). Finale: "That's BackChannel."
//
// Engineering shape is identical to IntroCinema (see its header comment):
// one master clock from the shared cinema engine, windowed worklet
// interpolations, problem act plays once then solution acts loop,
// tap-to-advance, haptic beats, act-progress hairline.

import React, { useEffect, useRef } from 'react';
import { Dimensions, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Type } from '@/constants/theme';
import { ArrowLeft } from '@/components/ui/icons';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  ActProgress,
  backOut,
  type CinemaBeat,
  CinemaCaption,
  easeIn,
  easeInOut,
  easeOut,
  useCinemaClock,
  useCinemaHaptics,
  win,
} from '@/components/cinema/engine';
import {
  trackIntroFilmDismissed,
  trackIntroFilmViewed,
} from '@/lib/analytics/mixpanel';

const { width: W } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Same reel geometry as the applicant film — the two films are cut to the
// exact same rhythm, so the brand feels like one hand made both.
const TOTAL_MS = 23500;
const STAGE_H = 320;
const LOOP_START = 0.305;
const ACT_STARTS = [LOOP_START, 0.545, 0.706] as const;
const ACTS = [
  [0, LOOP_START],
  [LOOP_START, 0.545],
  [0.545, 0.706],
  [0.706, 1],
] as const;

// Felt beats, mirroring the applicant reel: the can't-vouch slap, the
// Connect stamp, the meeting, and — heaviest — the referral landing.
const BEATS: readonly CinemaBeat[] = [
  { at: 0.172, kind: 'impact' },
  { at: 0.452, kind: 'tick' },
  { at: 0.601, kind: 'impact' },
  { at: 0.83, kind: 'success' },
];

// ── Act 0 set dressing ──────────────────────────────────────────────────
// The inbox pile: cold referral requests (chat-bubble cards) that rain in
// and heap up. Same scatter/fall choreography as the applicant's résumé
// pile — a different pile, the same suffocation.
const REQUEST_BUBBLES: { x: number; y: number; r: string }[] = [
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
const BUBBLE_FALL_START = 0.012;
const BUBBLE_FALL_STAGGER = 0.006;
const BUBBLE_FALL_LEN = 0.035;

// While the focused ask sits center-stage, more keep landing ON it — the
// volume is the point. These fall late, during the would-be reading beat.
const BURY_BUBBLES: { x: number; y: number; r: string; at: number }[] = [
  { x: -46, y: -26, r: '-8deg', at: 0.128 },
  { x: 40, y: -4, r: '6deg', at: 0.14 },
  { x: -8, y: 14, r: '-3deg', at: 0.152 },
];

interface SponsorCinemaProps {
  /** Advance the funnel (both the CTA and Skip land on the slides). */
  onContinue: () => void;
  /** Escape hatch for returning users who wandered into the new-user path. */
  onSignIn: () => void;
  /** Return to role selection — for users who picked the wrong role. */
  onBack: () => void;
}

export function SponsorCinema({
  onContinue,
  onSignIn,
  onBack,
}: SponsorCinemaProps) {
  const { master, breath, march, advance } = useCinemaClock(
    TOTAL_MS,
    LOOP_START,
    ACT_STARTS,
  );
  useCinemaHaptics(master, BEATS);

  // Watch-time analytics: one dismissal event, whichever exit is taken.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    trackIntroFilmViewed('sponsor');
  }, []);
  const dismiss = (action: 'skip' | 'cta' | 'sign_in' | 'back') => {
    const watchMs = Date.now() - mountedAt.current;
    trackIntroFilmDismissed({
      role: 'sponsor',
      action,
      watchSeconds: Math.round(watchMs / 1000),
      completedFirstPlay: watchMs >= TOTAL_MS,
    });
    if (action === 'sign_in') onSignIn();
    else if (action === 'back') onBack();
    else onContinue();
  };

  // ── Act 0: the problem ────────────────────────────────────────────────

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

  // The focused cold ask — falls last, lands front and center.
  const yourAsk = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.085, 0.125));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ translateY: (1 - p) * -260 }],
    };
  });

  const requestChip = useAnimatedStyle(() => {
    const t = master.value;
    const inP = easeOut(win(t, 0.112, 0.128));
    const out = win(t, 0.162, 0.172);
    return {
      opacity: inP * (1 - out),
      transform: [{ translateY: (1 - inP) * 6 }],
    };
  });

  const vouchStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = backOut(win(t, 0.165, 0.19));
    return { opacity: p, transform: [{ scale: 0.7 + p * 0.3 }, { rotate: '-6deg' }] };
  });

  // ── Act 1: the deck ───────────────────────────────────────────────────
  // Identical choreography to the applicant reel; the props are people.

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
    const stampP = win(t, 0.356, 0.374);
    const recoil = Math.sin(stampP * Math.PI) * 0.015;
    const windup = easeOut(win(t, 0.368, 0.377));
    const fly = easeIn(win(t, 0.377, 0.437));
    const arc = fly * (1 - fly) * 4;
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

  // ── Acts 2 + 3: match & referral under one camera ─────────────────────

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
  const AV_MEET = 34;

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

  // Quieter than the referral's ring — the energy must peak at the climax.
  const pulseRing = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.598, 0.645));
    return {
      opacity: (1 - p) * 0.32 * win(t, 0.598, 0.602),
      transform: [{ scale: 0.6 + p * 1.0 }],
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

  // The climax ring — the referral is the door only the sponsor can open.
  const referralRing = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.828, 0.905));
    return {
      opacity: (1 - p) * 0.6 * win(t, 0.828, 0.834),
      transform: [{ scale: 0.45 + p * 1.75 }],
    };
  });

  const cx = W / 2;
  const cy = STAGE_H / 2;
  const lineD = `M ${cx - 52} ${cy + 6} Q ${cx} ${cy + 44} ${cx + 56} ${cy + 6}`;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header: back (wrong role? escape hatch) + eyebrow + Skip */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <TouchableOpacity
              onPress={() => dismiss('back')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back to role selection"
            >
              <ArrowLeft color={Colors.muted} size={22} />
            </TouchableOpacity>
            <Text style={styles.eyebrow}>HOW IT WORKS</Text>
          </View>
          <TouchableOpacity
            onPress={() => dismiss('skip')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Reel progress: one hairline segment per act. */}
        <ActProgress master={master} acts={ACTS} />

        {/* ── The stage ── (tap = hard-cut to the next act) */}
        <Pressable
          style={styles.stage}
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel="Skip to next scene"
        >
          {/* Act 0: the inbox pile, the cold ask, the verdict */}
          <Animated.View style={[styles.centerSlot, pileGroup]}>
            {REQUEST_BUBBLES.map((bubble, i) => (
              <RequestBubble key={i} bubble={bubble} index={i} master={master} />
            ))}
            <Animated.View style={[styles.yourAsk, yourAsk]}>
              {/* A real message, not a skeleton: sender you don't know,
                  the ask you can't act on. */}
              <View style={styles.askHeader}>
                <View style={styles.askAvatar} />
                <View style={styles.askHeaderText}>
                  <Text style={styles.askSender}>Unknown sender</Text>
                  <Text style={styles.askMeta}>2nd degree · just now</Text>
                </View>
              </View>
              <Text style={styles.askBody}>
                “Hi! We haven’t met, but could you refer me for a role at
                your company?”
              </Text>
              <Animated.View style={[styles.vouchStamp, vouchStamp]}>
                <Text style={styles.vouchStampText}>✕ CAN’T VOUCH</Text>
              </Animated.View>
            </Animated.View>
            {/* More keep landing on top of the one you're reading. */}
            {BURY_BUBBLES.map((bubble, i) => (
              <BuryBubble key={i} bubble={bubble} master={master} />
            ))}
            {/* What's happening, labeled — floats above the inbox. */}
            <Animated.View style={[styles.requestChip, requestChip]}>
              <Text style={styles.requestChipText}>REQUESTS · 47 THIS WEEK</Text>
            </Animated.View>
          </Animated.View>

          {/* Act 1: the deck of candidates (C under B under A) */}
          <Animated.View style={[styles.cardSlot, stackIn]}>
            <Animated.View style={[styles.miniCard, cardC]}>
              <MiniPersonContent
                monogram="S"
                name="Sana Iqbal"
                detail="Data Scientist · Northport"
                chips={['ML', '5 yrs']}
              />
            </Animated.View>
            <Animated.View style={[styles.miniCard, cardB]}>
              <MiniPersonContent
                monogram="D"
                name="Devon Park"
                detail="Backend Engineer · Atlas Health"
                chips={['Python', '4 yrs']}
              />
              <Animated.View style={[styles.connectStamp, connectStamp]}>
                <Text style={styles.connectStampText}>Connect ✓</Text>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.miniCard, cardA]}>
              <MiniPersonContent
                monogram="M"
                name="Maya Chen"
                detail="Product Designer · Meridian Labs"
                chips={['Figma', '6 yrs']}
              />
              <Animated.View style={[styles.passStamp, passStamp]}>
                <Text style={styles.passStampText}>✕</Text>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Acts 2+3: match & referral, under one camera */}
          <Animated.View style={[styles.centerSlot, sceneGroup]}>
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
              {/* You — the sponsor — on the left, in the darker tone. */}
              <Animated.View style={[styles.avatar, styles.avatarYou, avatarLeft]}>
                <Text style={styles.avatarInitial}>Y</Text>
              </Animated.View>
              <Animated.View style={[styles.avatar, avatarRight]}>
                <Text style={styles.avatarInitial}>D</Text>
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
                <Text style={styles.companyMonogram}>A</Text>
              </View>
            </Animated.View>
            <View style={styles.referredChipWrap} pointerEvents="none">
              <Animated.View style={[styles.referralRing, referralRing]} />
              <Animated.View style={referredChip}>
                <View style={styles.referredChip}>
                  <Text style={styles.referredChipText}>Referred ✓</Text>
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </Pressable>

        {/* ── Captions ── mirrored voices: cold problem lines, the sponsor
            thesis in serif + italic accent, light mechanics, serif finale. */}
        <View style={styles.captionArea}>
          <CinemaCaption
            master={master}
            enter={0.02}
            out={[0.135, 0.16]}
            segments={[{ text: 'The old way of referring is broken.' }]}
            textStyle={styles.captionCold}
          />
          <CinemaCaption
            master={master}
            enter={0.165}
            out={[0.275, 0.30]}
            segments={[
              { text: 'Cold asks from strangers you can’t vouch for.' },
            ]}
            textStyle={styles.captionCold}
          />
          <CinemaCaption
            master={master}
            enter={0.315}
            out={[0.419, 0.44]}
            segments={[
              { text: 'Someone’s next job comes from' },
              { text: 'you.', accent: true },
            ]}
            textStyle={styles.captionThesis}
            accentStyle={styles.captionThesisAccent}
          />
          <CinemaCaption
            master={master}
            enter={0.44}
            out={[0.538, 0.559]}
            segments={[{ text: 'Connect with talent worth your name.' }]}
            textStyle={styles.caption}
          />
          <CinemaCaption
            master={master}
            enter={0.566}
            out={[0.685, 0.706]}
            segments={[{ text: 'Meet your candidate.' }]}
            textStyle={styles.caption}
          />
          <CinemaCaption
            master={master}
            enter={0.72}
            out={[0.888, 0.909]}
            segments={[{ text: 'A door only you can open.' }]}
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
            onPress={() => dismiss('cta')}
            style={styles.cta}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Be someone’s way in</Text>
          </PressableScale>
          <TouchableOpacity
            onPress={() => dismiss('sign_in')}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** One cold referral request in the pile — falls in on its index's window. */
function RequestBubble({
  bubble,
  index,
  master,
}: {
  bubble: { x: number; y: number; r: string };
  index: number;
  master: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = master.value;
    const a = BUBBLE_FALL_START + index * BUBBLE_FALL_STAGGER;
    const p = easeOut(win(t, a, a + BUBBLE_FALL_LEN));
    return {
      opacity: p * 0.9,
      transform: [
        { translateX: bubble.x },
        { translateY: bubble.y + (1 - p) * -260 },
        { rotate: bubble.r },
      ],
    };
  });

  return (
    <Animated.View style={[styles.requestBubble, style]}>
      <View style={styles.requestBubbleHeader}>
        <View style={styles.requestBubbleAvatar} />
        <View style={[styles.requestBubbleLine, { flex: 1 }]} />
      </View>
      <View style={[styles.requestBubbleLine, { width: '72%' }]} />
    </Animated.View>
  );
}

/** A late request that lands ON the one being read — the volume beat. */
function BuryBubble({
  bubble,
  master,
}: {
  bubble: { x: number; y: number; r: string; at: number };
  master: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, bubble.at, bubble.at + 0.03));
    return {
      opacity: p,
      transform: [
        { translateX: bubble.x },
        { translateY: bubble.y - 44 + (1 - p) * -220 },
        { rotate: bubble.r },
      ],
    };
  });

  return (
    <Animated.View style={[styles.requestBubble, style]}>
      <View style={styles.requestBubbleHeader}>
        <View style={styles.requestBubbleAvatar} />
        <View style={[styles.requestBubbleLine, { flex: 1 }]} />
      </View>
      <View style={[styles.requestBubbleLine, { width: '72%' }]} />
    </Animated.View>
  );
}

function MiniPersonContent({
  monogram,
  name,
  detail,
  chips,
}: {
  monogram: string;
  name: string;
  detail: string;
  chips: string[];
}) {
  return (
    <>
      <View style={styles.miniHeader}>
        {/* Round avatar — a person, not a company tile. */}
        <View style={styles.miniAvatar}>
          <Text style={styles.miniMonogram}>{monogram}</Text>
        </View>
        <View style={styles.miniHeaderText}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.miniCompany} numberOfLines={1}>
            {detail}
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
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  // ── Act 0: the inbox pile ─────────────────────────────────────────────
  // Cold asks as small speech-bubble cards: an identity dot you don't
  // recognize and lines you'll never get to read.
  requestBubble: {
    position: 'absolute',
    width: 54,
    height: 42,
    borderRadius: 10,
    borderBottomLeftRadius: 3,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  requestBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestBubbleAvatar: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.border,
  },
  requestBubbleLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
  },
  // The focused ask — a real message from nobody you know.
  yourAsk: {
    position: 'absolute',
    width: 168,
    marginTop: -58,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  askAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  askHeaderText: { flex: 1, gap: 1 },
  askSender: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10.5,
    color: Colors.ink,
  },
  askMeta: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    color: Colors.faint,
  },
  askBody: {
    fontFamily: Fonts.sans,
    fontSize: 9.5,
    lineHeight: 14,
    color: Colors.body,
  },
  // "REQUESTS · 47 THIS WEEK" — floats above the inbox.
  requestChip: {
    position: 'absolute',
    marginTop: -168,
    alignSelf: 'center',
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: Colors.muted,
  },
  vouchStamp: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vouchStampText: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  // ── Solution-act props ────────────────────────────────────────────────
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
  miniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  avatarYou: { backgroundColor: Colors.border },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.body,
  },
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
  referralRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: Colors.muted,
    top: -41, // centered on the chip row
  },
  // ── Captions ──────────────────────────────────────────────────────────
  captionArea: {
    height: 84,
    marginTop: 8,
    justifyContent: 'center',
  },
  caption: {
    fontFamily: Fonts.sansLight,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.body,
  },
  captionCold: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.muted,
  },
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
    paddingBottom: 30,
    gap: 16,
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
  signInText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
  },
  signInLink: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.ink,
  },
});
