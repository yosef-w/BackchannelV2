// IntroCinema — the pre-signup "what is this app" screen (splash → here →
// choose-role). Instead of telling, the app demos ITSELF: a scripted,
// auto-playing miniature of the real product loop — a job card gets
// passed, the next gets connected, a match fires, and a sponsor refers
// you — while one caption line narrates each beat. Ends on the brand
// line, then loops.
//
// Engineering shape: ONE master clock (a 0→1 shared value on an infinite
// linear repeat) drives every element through windowed interpolations in
// UI-thread worklets — no timeout chains, no JS-state choreography, and
// the loop restarts seamlessly because t=0 and t=1 render identical
// (empty) stages. Per-window easing is applied to the windowed
// sub-progress, so individual beats can spring while the clock stays
// linear. The dash-march on the referral line is the only independent
// loop (it must flow continuously, unsynced with the film).

import React, { useEffect } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Type } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

const { width: W } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

const TOTAL_MS = 14000;
const STAGE_H = 320;

/** Windowed sub-progress: 0 before `a`, 1 after `b`, linear between. */
const win = (t: number, a: number, b: number): number => {
  'worklet';
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
};

interface IntroCinemaProps {
  /** Advance the funnel (both the CTA and Skip land on role selection). */
  onContinue: () => void;
}

export function IntroCinema({ onContinue }: IntroCinemaProps) {
  const master = useSharedValue(0);
  const march = useSharedValue(0);

  useEffect(() => {
    master.value = withRepeat(
      withTiming(1, { duration: TOTAL_MS, easing: Easing.linear }),
      -1,
    );
    march.value = withRepeat(
      withTiming(-240, { duration: 16000, easing: Easing.linear }),
      -1,
    );
  }, [master, march]);

  // ── Scene 1: the deck ─────────────────────────────────────────────────
  // Three stacked job cards settle in; the top one flies off LEFT with a
  // Pass mark, the next flies off RIGHT with a Connect pill.

  const stackIn = useAnimatedStyle(() => {
    const t = master.value;
    const inP = Easing.out(Easing.cubic)(win(t, 0.0, 0.06));
    return { opacity: inP, transform: [{ translateY: (1 - inP) * 24 }] };
  });

  const cardA = useAnimatedStyle(() => {
    const t = master.value;
    const fly = Easing.in(Easing.cubic)(win(t, 0.11, 0.19));
    return {
      opacity: 1 - win(t, 0.17, 0.19),
      transform: [
        { translateX: -fly * (W * 0.9) },
        { rotate: `${-2 - fly * 16}deg` },
      ],
    };
  });

  const passStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.6))(win(t, 0.08, 0.105));
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }] };
  });

  const cardB = useAnimatedStyle(() => {
    const t = master.value;
    const promote = win(t, 0.17, 0.21);
    const fly = Easing.in(Easing.cubic)(win(t, 0.24, 0.32));
    return {
      opacity: 1 - win(t, 0.30, 0.32),
      transform: [
        { translateY: 8 - promote * 8 },
        { translateX: fly * (W * 0.9) },
        { rotate: `${3 - promote * 3 + fly * 14}deg` },
        { scale: 0.97 + promote * 0.03 },
      ],
    };
  });

  const connectStamp = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.6))(win(t, 0.21, 0.235));
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }] };
  });

  const cardC = useAnimatedStyle(() => {
    const t = master.value;
    const promote = win(t, 0.30, 0.34);
    // The whole remaining stack hands the stage to the match scene.
    const out = win(t, 0.34, 0.40);
    return {
      opacity: 1 - out,
      transform: [
        { translateY: 16 - promote * 16 },
        { scale: 0.94 + promote * 0.06 - out * 0.08 },
      ],
    };
  });

  // ── Scene 2: the match ────────────────────────────────────────────────
  // Two avatars spring together center-stage; "It's a Match" pops.

  const AV_APART = 120;
  const AV_MEET = 34; // overlap distance from center once met

  const avatarsGroup = useAnimatedStyle(() => {
    const t = master.value;
    const inP = win(t, 0.35, 0.43);
    // Scene 3 handoff: the pair shifts left + shrinks to make room for
    // the company tile.
    const shift = Easing.inOut(Easing.cubic)(win(t, 0.58, 0.65));
    const out = win(t, 0.96, 1);
    return {
      opacity: inP * (1 - out),
      transform: [
        { translateX: -shift * 90 },
        { scale: 1 - shift * 0.22 },
      ],
    };
  });

  const avatarLeft = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.4))(win(t, 0.35, 0.43));
    return { transform: [{ translateX: -AV_APART + p * (AV_APART - AV_MEET) }] };
  });

  const avatarRight = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.4))(win(t, 0.35, 0.43));
    return { transform: [{ translateX: AV_APART - p * (AV_APART - AV_MEET) }] };
  });

  const matchBadge = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(2))(win(t, 0.43, 0.455));
    const shift = win(t, 0.58, 0.65);
    return { opacity: p * (1 - shift), transform: [{ scale: p }] };
  });

  const matchText = useAnimatedStyle(() => {
    const t = master.value;
    const inP = Easing.out(Easing.cubic)(win(t, 0.44, 0.50));
    const out = win(t, 0.56, 0.61);
    return {
      opacity: inP * (1 - out),
      transform: [{ translateY: (1 - inP) * 10 }],
    };
  });

  // ── Scene 3: the referral ─────────────────────────────────────────────
  // A company tile joins, the backchannel line flows sponsor → company,
  // and "Referred ✓" lands.

  const companyTile = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.4))(win(t, 0.59, 0.66));
    const out = win(t, 0.96, 1);
    return {
      opacity: p * (1 - out),
      transform: [{ translateX: 90 + (1 - p) * 60 }, { scale: 0.8 + p * 0.2 }],
    };
  });

  const lineStyle = useAnimatedStyle(() => {
    const t = master.value;
    const p = win(t, 0.66, 0.73);
    const out = win(t, 0.96, 1);
    return { opacity: p * (1 - out) };
  });

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: march.value,
  }));

  const referredChip = useAnimatedStyle(() => {
    const t = master.value;
    const p = Easing.out(Easing.back(1.8))(win(t, 0.74, 0.78));
    const out = win(t, 0.96, 1);
    return {
      opacity: p * (1 - out),
      transform: [{ scale: 0.7 + p * 0.3 }, { translateY: (1 - p) * 8 }],
    };
  });

  // ── Captions ──────────────────────────────────────────────────────────

  // Custom hook (called unconditionally, fixed count/order per render) —
  // each caption fades up in its own master-clock window.
  const useCaptionStyle = (a: number, b: number, outA: number, outB: number) =>
    useAnimatedStyle(() => {
      const t = master.value;
      const inP = Easing.out(Easing.cubic)(win(t, a, b));
      const out = win(t, outA, outB);
      return {
        opacity: inP * (1 - out),
        transform: [{ translateY: (1 - inP) * 8 }],
      };
    });

  const caption1 = useCaptionStyle(0.03, 0.08, 0.17, 0.20);
  const caption2 = useCaptionStyle(0.20, 0.25, 0.34, 0.37);
  const caption3 = useCaptionStyle(0.38, 0.43, 0.55, 0.58);
  const caption4 = useCaptionStyle(0.60, 0.65, 0.84, 0.87);
  const caption5 = useCaptionStyle(0.88, 0.92, 0.97, 1.0);

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
          {/* Scene 3: backchannel line (under everything else) */}
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

          {/* Scene 1: the deck (C under B under A) */}
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

          {/* Scene 2: the match */}
          <Animated.View style={[styles.centerSlot, avatarsGroup]}>
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

          {/* Scene 3: the company + the referral */}
          <Animated.View style={[styles.centerSlot, companyTile]}>
            <View style={styles.companyTile}>
              <Text style={styles.companyMonogram}>M</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.referredChip, referredChip]}>
            <Text style={styles.referredChipText}>Referred ✓</Text>
          </Animated.View>
        </View>

        {/* ── Captions ── */}
        <View style={styles.captionArea}>
          <Animated.Text style={[styles.caption, caption1]}>
            Every day, a fresh deck of jobs.
          </Animated.Text>
          <Animated.Text style={[styles.caption, caption2]}>
            Pass — or Connect with the ones you want.
          </Animated.Text>
          <Animated.Text style={[styles.caption, caption3]}>
            Match with someone on the inside.
          </Animated.Text>
          <Animated.Text style={[styles.caption, caption4]}>
            They vouch for you. Referred — for real.
          </Animated.Text>
          <Animated.Text style={[styles.caption, styles.captionFinale, caption5]}>
            That’s <Text style={styles.captionFinaleAccent}>BackChannel.</Text>
          </Animated.Text>
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
  referredChip: {
    position: 'absolute',
    top: '50%',
    marginTop: 58,
    alignSelf: 'center',
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
    height: 64,
    marginTop: 8,
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    left: 40,
    right: 40,
    textAlign: 'center',
    fontFamily: Fonts.sansLight,
    fontSize: 17,
    lineHeight: 25,
    color: Colors.body,
  },
  captionFinale: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
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
