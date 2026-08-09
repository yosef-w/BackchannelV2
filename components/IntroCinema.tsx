// IntroCinema — the applicant's pre-signup film (choose-role → here →
// sign-up; SponsorCinema is its deliberate mirror for sponsors).
// Instead of telling, the app demos ITSELF as a scripted, auto-playing
// film with the classic problem → turn → solution arc:
//
//   Act 0 (the problem): applications rain into an anonymous pile; a scan
//     line sweeps it and YOUR application gets auto-rejected — the broken
//     status quo (job boards, ATS screens, no human ever looking).
//   The turn: the pile sweeps away. "Your next job comes from someone
//     inside." — the thesis, in the brand serif.
//   Act 1 (the deck): a job card gets passed, the next gets connected.
//   Act 2 (the match): avatars spring together; "It's a Match".
//   Act 3 (the referral): a company tile joins, the backchannel line
//     flows, "Referred ✓" lands — the film's true climax (the ring, the
//     success haptic). Finale: "That's BackChannel."
//
// Engineering shape: ONE master clock (a 0→1 shared value, run by the
// shared cinema engine) drives every element through windowed
// interpolations in UI-thread worklets — no timeout chains. The problem
// act plays ONCE; every loop after the first rewinds to LOOP_START (the
// stage is empty there, so the cut is invisible) and replays only the
// solution acts — the story resolves once and stays resolved.
// Tapping the stage hard-cuts to the next act; each act crossing lands a
// haptic beat; a stories-style hairline shows reel progress.
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

// The solution acts kept their approved pacing (≈16.5s) — the problem act
// occupies the first ~30% of the reel.
const TOTAL_MS = 23500;
const STAGE_H = 320;

// After the first full play the reel rewinds here (the pile has fully
// exited, the deck hasn't entered — an empty stage, so the cut is
// invisible) and loops the solution acts only.
const LOOP_START = 0.305;
// Act starts: the turn/deck, the match, the referral. Used for
// tap-to-advance and the progress hairline (act 1 = the problem, from 0).
const ACT_STARTS = [LOOP_START, 0.545, 0.706] as const;
const ACTS = [
  [0, LOOP_START],
  [LOOP_START, 0.545],
  [0.545, 0.706],
  [0.706, 1],
] as const;

// Felt beats: the rejection slap, the Connect stamp, the avatars meeting,
// and — heaviest of all — the referral landing (the film's climax).
const BEATS: readonly CinemaBeat[] = [
  { at: 0.172, kind: 'impact' },
  { at: 0.452, kind: 'tick' },
  { at: 0.601, kind: 'impact' },
  { at: 0.83, kind: 'success' },
];

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
  /** Advance the funnel (both the CTA and Skip continue to sign-up). */
  onContinue: () => void;
  /** Escape hatch for returning users who wandered into the new-user path. */
  onSignIn: () => void;
  /** Return to role selection — for users who picked the wrong role. */
  onBack: () => void;
}

export function IntroCinema({ onContinue, onSignIn, onBack }: IntroCinemaProps) {
  const { master, breath, march, advance } = useCinemaClock(
    TOTAL_MS,
    LOOP_START,
    ACT_STARTS,
  );
  useCinemaHaptics(master, BEATS);

  // Watch-time analytics: one dismissal event, whichever exit is taken.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    trackIntroFilmViewed('applicant');
  }, []);
  const dismiss = (action: 'skip' | 'cta' | 'sign_in' | 'back') => {
    const watchMs = Date.now() - mountedAt.current;
    trackIntroFilmDismissed({
      role: 'applicant',
      action,
      watchSeconds: Math.round(watchMs / 1000),
      completedFirstPlay: watchMs >= TOTAL_MS,
    });
    if (action === 'sign_in') onSignIn();
    else if (action === 'back') onBack();
    else onContinue();
  };

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

  // The AI screen: corner brackets lock onto the résumé, a soft band
  // sweeps down INSIDE the document (clipped by the card), and a labeled
  // chip explains what's happening — then the verdict slaps on.
  const scanBrackets = useAnimatedStyle(() => {
    const t = master.value;
    const inP = easeOut(win(t, 0.112, 0.124));
    const out = win(t, 0.163, 0.172);
    return { opacity: inP * (1 - out) };
  });

  const scanBand = useAnimatedStyle(() => {
    const t = master.value;
    const sweep = easeInOut(win(t, 0.125, 0.162));
    const vis = win(t, 0.122, 0.13) * (1 - win(t, 0.158, 0.166));
    return {
      opacity: vis,
      transform: [{ translateY: -34 + sweep * 158 }],
    };
  });

  const aiChip = useAnimatedStyle(() => {
    const t = master.value;
    const inP = easeOut(win(t, 0.112, 0.128));
    const out = win(t, 0.162, 0.172);
    return {
      opacity: inP * (1 - out),
      transform: [{ translateY: (1 - inP) * 6 }],
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
  // Deliberately quieter than the referral's ring — the match is a step,
  // the referral is the destination, and the film's energy must peak there.
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

  // The film's climax ring: bigger, brighter, and slower than the match's
  // pulse — "Referred ✓" is the whole promise of the product, so it lands
  // with the loudest payoff of the reel (paired with the success haptic).
  const referralRing = useAnimatedStyle(() => {
    const t = master.value;
    const p = easeOut(win(t, 0.828, 0.905));
    return {
      opacity: (1 - p) * 0.6 * win(t, 0.828, 0.834),
      transform: [{ scale: 0.45 + p * 1.75 }],
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
          {/* Act 0: the pile, your résumé, the AI screen, the verdict */}
          <Animated.View style={[styles.centerSlot, pileGroup]}>
            {PILE_DOCS.map((doc, i) => (
              <PileDoc key={i} doc={doc} index={i} master={master} />
            ))}
            <Animated.View style={[styles.yourDoc, yourDoc]}>
              {/* A real document, not a skeleton: header identity row +
                  micro-typography sections. */}
              <View style={styles.resumeHeader}>
                <View style={styles.resumeAvatar} />
                <View style={styles.resumeHeaderText}>
                  <Text style={styles.resumeName}>Your résumé</Text>
                  <Text style={styles.resumeMeta}>PDF · 2 pages</Text>
                </View>
              </View>
              <Text style={styles.resumeSection}>EXPERIENCE</Text>
              <View style={[styles.resumeLine, { width: '86%' }]} />
              <View style={[styles.resumeLine, { width: '68%' }]} />
              <Text style={styles.resumeSection}>SKILLS</Text>
              <View style={[styles.resumeLine, { width: '58%' }]} />
              {/* The scan band sweeps inside the card (clipped). */}
              <Animated.View style={[styles.scanBand, scanBand]}>
                <View style={styles.scanBandEdge} />
              </Animated.View>
              {/* Scanner lock-on brackets. */}
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, scanBrackets]}
              >
                <View style={[styles.bracket, styles.bracketTL]} />
                <View style={[styles.bracket, styles.bracketTR]} />
                <View style={[styles.bracket, styles.bracketBL]} />
                <View style={[styles.bracket, styles.bracketBR]} />
              </Animated.View>
              <Animated.View style={[styles.rejectStamp, rejectStamp]}>
                <Text style={styles.rejectStampText}>✕ AUTO-REJECTED</Text>
              </Animated.View>
            </Animated.View>
            {/* What's happening, labeled — floats above the document. */}
            <Animated.View style={[styles.aiChip, aiChip]}>
              <Text style={styles.aiChipText}>AI SCREENING</Text>
            </Animated.View>
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

        {/* ── Captions ──
            Word-by-word reveals with per-act typographic voices: cold
            muted problem lines, the thesis in serif + italic accent,
            light mechanics, serif finale. */}
        <View style={styles.captionArea}>
          <CinemaCaption
            master={master}
            enter={0.02}
            out={[0.135, 0.16]}
            segments={[{ text: 'The old way of applying is broken.' }]}
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
            segments={[{ text: 'A real referral, from a real person.' }]}
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
            <Text style={styles.ctaText}>Find your way in</Text>
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
      <View style={styles.pileDocHeader}>
        <View style={styles.pileDocAvatar} />
        <View style={[styles.pileDocLine, { flex: 1 }]} />
      </View>
      <View style={[styles.pileDocLine, { width: '78%' }]} />
      <View style={[styles.pileDocLine, { width: '55%' }]} />
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
  // ── Act 0: the pile ───────────────────────────────────────────────────
  // Other people's résumés — small but real: an identity dot and text
  // lines, on true paper with a whisper of shadow.
  pileDoc: {
    position: 'absolute',
    width: 48,
    height: 58,
    borderRadius: 8,
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
  pileDocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pileDocAvatar: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.border,
  },
  pileDocLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
  },
  // Yours — a real document with a name on it, doomed anyway.
  yourDoc: {
    position: 'absolute',
    width: 138,
    height: 148,
    marginTop: -62,
    borderRadius: 14,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 14,
    overflow: 'hidden', // clips the scan band to the page
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  resumeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resumeHeaderText: { flex: 1, gap: 1 },
  resumeName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10.5,
    color: Colors.ink,
  },
  resumeMeta: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    color: Colors.faint,
  },
  // Micro-typography section labels — real document anatomy.
  resumeSection: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 6.5,
    letterSpacing: 0.8,
    color: Colors.faint,
    marginTop: 6,
    marginBottom: 4,
  },
  resumeLine: {
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  // The scan band: a soft tinted region with a reading edge, swept
  // through the page interior.
  scanBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 30,
    backgroundColor: 'rgba(10, 10, 10, 0.045)',
    justifyContent: 'flex-end',
  },
  scanBandEdge: {
    height: 1.5,
    backgroundColor: Colors.muted,
    opacity: 0.7,
  },
  // Scanner lock-on brackets at the page corners.
  bracket: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderColor: Colors.muted,
  },
  bracketTL: { top: 5, left: 5, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 },
  bracketTR: { top: 5, right: 5, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 },
  bracketBL: { bottom: 5, left: 5, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 },
  bracketBR: { bottom: 5, right: 5, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 },
  // "AI SCREENING" — floats above the document while the band sweeps.
  aiChip: {
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
  aiChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: Colors.muted,
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
  // The climax ring — expands out from behind the Referred chip.
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
