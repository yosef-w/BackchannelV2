// SplashScreen — the app's front door, built to introduce what BackChannel
// IS: a person on the inside connects you to a job. The background acts
// that story out in whisper-gray: a ghost PROFILE card and ghost JOB cards
// drift slowly, a dashed "backchannel" line flows between person and job,
// and every few seconds a small "Referred ✓" chip lights up on the person
// card — the app's happy ending, on a quiet loop. The foreground keeps the
// marketing site's hero: serif two-tone headline with the typewriter, which
// after the brand name lands keeps typing the value props in rotation
// ("Get referred." → "Get hired." → "Get ahead.").

import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

const { width: W } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Typewriter choreography ─────────────────────────────────────────────
const BRAND_TEXT = 'BackChannel.';
const TYPE_START_DELAY_MS = 900;
const TYPE_INTERVAL_MS = 75;
// After the brand lands, the typewriter moves down a line and cycles the
// value props forever.
const TAGLINE_PHRASES = ['Get referred.', 'Get hired.', 'Get ahead.'];
const TAG_START_GAP_MS = 1600; // pause after brand caret settles
const TAG_TYPE_MS = 55;
const TAG_HOLD_MS = 1700;
const TAG_DELETE_MS = 30;
const TAG_GAP_MS = 400;

interface SplashScreenProps {
  onGetStarted: () => void;
  /**
   * Direct entry to sign-in, skipping role selection and the onboarding
   * slides entirely. Without this, a returning user had no way back to
   * login short of walking the full new-user funnel.
   */
  onSignIn: () => void;
}

// ── Ghost card layer ────────────────────────────────────────────────────
// Restraint rules: monochrome surface tones only (never darker, so the
// serif headline stays unchallenged), multi-second drift, slight
// rotations, pointerEvents off, everything clear of the headline's band.

interface GhostSpec {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  rotate: string;
  scale: number;
  driftY: number;
  driftX: number;
  durationMs: number;
  opacity: number;
}

// Upper-left: a job card. Upper-right: the PERSON (with the Referred ✓
// beat). Lower-left: a faint second job card behind the footer whitespace.
const JOB_CARD_A: GhostSpec = { top: 90, left: -24, rotate: '-7deg', scale: 1, driftY: -14, driftX: 6, durationMs: 11000, opacity: 0.65 };
const PERSON_CARD: GhostSpec = { top: 170, right: -44, rotate: '5deg', scale: 0.92, driftY: -10, driftX: -8, durationMs: 14000, opacity: 0.6 };
const JOB_CARD_B: GhostSpec = { bottom: 190, left: -55, rotate: '4deg', scale: 0.85, driftY: -12, driftX: 5, durationMs: 17000, opacity: 0.45 };

/** Shared drift/appear animation for any ghost card. */
function useGhostDrift(spec: GhostSpec) {
  const drift = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(500, withTiming(1, { duration: 1400 }));
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: spec.durationMs }),
        withTiming(0, { duration: spec.durationMs }),
      ),
      -1,
    );
  }, [appear, drift, spec.durationMs]);

  return useAnimatedStyle(() => ({
    opacity: appear.value * spec.opacity,
    transform: [
      { translateY: drift.value * spec.driftY },
      { translateX: drift.value * spec.driftX },
      { rotate: spec.rotate },
      { scale: spec.scale },
    ],
  }));
}

function ghostPosition(spec: GhostSpec) {
  return { top: spec.top, bottom: spec.bottom, left: spec.left, right: spec.right };
}

function GhostJobCard({ spec }: { spec: GhostSpec }) {
  const animStyle = useGhostDrift(spec);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghostCard, ghostPosition(spec), animStyle]}
    >
      <View style={styles.ghostHeader}>
        <View style={styles.ghostLogo} />
        <View style={styles.ghostHeaderText}>
          <View style={styles.ghostTitleBar} />
          <View style={styles.ghostSubBar} />
        </View>
      </View>
      <View style={styles.ghostPillRow}>
        <View style={[styles.ghostPill, { width: 58 }]} />
        <View style={[styles.ghostPill, { width: 42 }]} />
      </View>
    </Animated.View>
  );
}

/** The person card — avatar skeleton plus the periodic "Referred ✓" beat. */
function GhostPersonCard({ spec }: { spec: GhostSpec }) {
  const animStyle = useGhostDrift(spec);
  const chip = useSharedValue(0);

  useEffect(() => {
    // Every ~9.5s: pop in, hold, fade, rest. Encoded as one repeating
    // sequence (holds are just timings to the same value).
    chip.value = withDelay(
      3200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.5)) }),
          withTiming(1, { duration: 2400 }),
          withTiming(0, { duration: 550 }),
          withTiming(0, { duration: 6200 }),
        ),
        -1,
      ),
    );
  }, [chip]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: chip.value,
    transform: [{ scale: 0.85 + chip.value * 0.15 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghostCard, ghostPosition(spec), animStyle]}
    >
      <View style={styles.ghostHeader}>
        <View style={styles.ghostAvatar} />
        <View style={styles.ghostHeaderText}>
          <View style={styles.ghostTitleBar} />
          <View style={styles.ghostSubBar} />
        </View>
      </View>
      <View style={styles.ghostPillRow}>
        <View style={[styles.ghostPill, { width: 46 }]} />
        <View style={[styles.ghostPill, { width: 62 }]} />
      </View>
      <Animated.View style={[styles.referredChip, chipStyle]}>
        <Text style={styles.referredChipText}>Referred ✓</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** The backchannel itself: a dashed line flowing from the person card to
 * the job card — the connection the app exists to make, drawn as a quiet
 * current running behind the headline. */
function BackchannelLine() {
  const appear = useSharedValue(0);
  const march = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(1400, withTiming(1, { duration: 1600 }));
    // Dash cycle is 12 (4 on, 8 off); march in multiples of it so the
    // loop restart is seamless. Slow, constant flow.
    march.value = withRepeat(
      withTiming(-240, { duration: 16000, easing: Easing.linear }),
      -1,
    );
  }, [appear, march]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: march.value,
  }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
  }));

  // Person card sits upper-right (~W-120, 260 at its lower-left corner);
  // job card upper-left (right edge ~170, 165). The curve dips gently
  // toward the middle but stays above the headline band.
  const d = `M ${W - 118} 262 Q ${W * 0.52} 345 165 178`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, containerStyle]}
    >
      <Svg width="100%" height="100%">
        <AnimatedPath
          d={d}
          stroke={Colors.faint}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="4 8"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
    </Animated.View>
  );
}

export const SplashScreen = ({ onGetStarted, onSignIn }: SplashScreenProps) => {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.98);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(15);
  const cursorOpacity = useSharedValue(0);
  const tagCursorOpacity = useSharedValue(0);

  const [typedCount, setTypedCount] = useState(0);
  const typingDone = typedCount >= BRAND_TEXT.length;

  // Tagline rotor state machine: phases run typing → hold → deleting →
  // (next phrase) forever, one self-cancelling timeout per tick.
  const [rotorOn, setRotorOn] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [tagLen, setTagLen] = useState(0);
  const [tagPhase, setTagPhase] = useState<'typing' | 'holding' | 'deleting'>(
    'typing',
  );

  useEffect(() => {
    // Smooth, elegant entrance
    titleOpacity.value = withTiming(1, { duration: 1500 });
    titleScale.value = withTiming(1, { duration: 1500 });

    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    buttonTranslateY.value = withDelay(1000, withTiming(0, { duration: 800 }));
  }, [buttonOpacity, buttonTranslateY, titleOpacity, titleScale]);

  // Brand typewriter. Interval-driven so a returning user being
  // auto-routed away (splash.tsx redirects once auth loads) just unmounts
  // and cleans up mid-word.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setTypedCount((n) => {
          if (n >= BRAND_TEXT.length) {
            if (interval) clearInterval(interval);
            return n;
          }
          return n + 1;
        });
      }, TYPE_INTERVAL_MS);
    }, TYPE_START_DELAY_MS);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Brand caret: appears with typing, blinks twice once the word lands,
  // then fades for good — the rotor's caret takes over below.
  useEffect(() => {
    if (!typingDone) {
      cursorOpacity.value = withDelay(
        TYPE_START_DELAY_MS - 200,
        withTiming(1, { duration: 150 }),
      );
      return;
    }
    cursorOpacity.value = withSequence(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        2,
      ),
      withTiming(0, { duration: 300 }),
    );
  }, [typingDone, cursorOpacity]);

  // Hand off to the tagline rotor after the brand caret settles.
  useEffect(() => {
    if (!typingDone) return;
    const t = setTimeout(() => setRotorOn(true), TAG_START_GAP_MS);
    return () => clearTimeout(t);
  }, [typingDone]);

  // Rotor caret blinks continuously while the rotor runs.
  useEffect(() => {
    if (!rotorOn) return;
    tagCursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420 }),
        withTiming(0, { duration: 420 }),
      ),
      -1,
    );
  }, [rotorOn, tagCursorOpacity]);

  // Rotor state machine tick.
  useEffect(() => {
    if (!rotorOn) return;
    const phrase = TAGLINE_PHRASES[phraseIdx];
    let delay: number;
    let next: () => void;

    if (tagPhase === 'typing') {
      if (tagLen < phrase.length) {
        delay = TAG_TYPE_MS;
        next = () => setTagLen(tagLen + 1);
      } else {
        delay = TAG_HOLD_MS;
        next = () => setTagPhase('deleting');
      }
    } else if (tagPhase === 'deleting') {
      if (tagLen > 0) {
        delay = TAG_DELETE_MS;
        next = () => setTagLen(tagLen - 1);
      } else {
        delay = TAG_GAP_MS;
        next = () => {
          setPhraseIdx((phraseIdx + 1) % TAGLINE_PHRASES.length);
          setTagPhase('typing');
        };
      }
    } else {
      return;
    }

    const t = setTimeout(next, delay);
    return () => clearTimeout(t);
  }, [rotorOn, tagPhase, tagLen, phraseIdx]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const tagCursorStyle = useAnimatedStyle(() => ({
    opacity: tagCursorOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Ghost story layer: person + jobs + the backchannel between them. */}
      <GhostJobCard spec={JOB_CARD_A} />
      <GhostPersonCard spec={PERSON_CARD} />
      <GhostJobCard spec={JOB_CARD_B} />
      <BackchannelLine />

      <View style={styles.centerContent}>
        <Animated.View style={[styles.brandWrapper, titleStyle]}>
          {/* Matches the marketing site's hero exactly (index.html):
              "Welcome to" in plain serif ink, the brand name itself as
              the italic muted-gray accent — the site's own convention
              for the highlighted word in a headline. */}
          <Text style={styles.brandName}>
            Welcome to{"\n"}
            <Text style={styles.brandSerif}>
              {BRAND_TEXT.slice(0, typedCount)}
            </Text>
            {/* Thin caret bar, matching the site's .cursor (3px × 0.85em)
                — an inline View inside Text baseline-aligns with the
                glyphs, unlike a block character which reads too heavy. */}
            <Animated.View style={[styles.cursor, cursorStyle]} />
          </Text>

          {/* Value-prop rotor — the typewriter's second act. Fixed height
              so the layout never jumps as phrases type/delete. */}
          <View style={styles.taglineRow}>
            <Text style={styles.tagline}>
              {rotorOn ? TAGLINE_PHRASES[phraseIdx].slice(0, tagLen) : ' '}
            </Text>
            {rotorOn && (
              <Animated.View style={[styles.tagCursor, tagCursorStyle]} />
            )}
          </View>
        </Animated.View>
      </View>

      <SafeAreaView style={styles.footer}>
        <Animated.View style={[styles.buttonContainer, buttonStyle]}>
          <PressableScale
            pressedScale={0.97}
            onPress={onGetStarted}
            style={styles.button}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Get Connected</Text>
          </PressableScale>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onSignIn}
            style={styles.signInLink}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.signInLinkText}>
              Already have an account?{" "}
              <Text style={styles.signInLinkHighlight}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  // ── Ghost card skeleton ──────────────────────────────────────────────
  // Whisper-gray abstraction of the app's real cards. All surface/border
  // tones — never darker — so the serif headline stays unchallenged.
  ghostCard: {
    position: 'absolute',
    width: 210,
    backgroundColor: Colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  ghostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  ghostLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  // Person variant: a round avatar instead of the square logo tile.
  ghostAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
  },
  ghostHeaderText: { flex: 1, gap: 7 },
  ghostTitleBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surface,
    width: '85%',
  },
  ghostSubBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    width: '55%',
  },
  ghostPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ghostPill: {
    height: 18,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  // The story beat: reads through the parent card's ghost opacity, so
  // ink-on-paper here lands as a soft, not shouty, wink of life.
  referredChip: {
    position: 'absolute',
    bottom: -10,
    right: 14,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  referredChipText: {
    color: Colors.paper,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // ── Foreground ───────────────────────────────────────────────────────
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  brandWrapper: {
    alignItems: 'center',
  },
  // "Welcome to" — matches the site's .hero-title (serif, ink, tight
  // line-height, negative tracking).
  brandName: {
    fontFamily: Fonts.serif,
    fontSize: 42,
    lineHeight: 46,
    color: Colors.ink,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  // "BackChannel." — the italic muted-gray accent, matching the site's
  // .hero-title em rule exactly (color: var(--muted), font-style: italic).
  brandSerif: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // Typewriter caret — the site's .cursor: a thin muted bar (~3px wide,
  // 0.85em tall), not a block glyph.
  cursor: {
    width: 3,
    height: 30,
    borderRadius: 1.5,
    backgroundColor: Colors.muted,
    marginLeft: 3,
  },
  // Rotor line — fixed height so typing/deleting never shifts layout.
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    marginTop: 20,
  },
  tagline: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.body,
    textAlign: 'center',
  },
  tagCursor: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: Colors.muted,
    marginLeft: 2,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  // Matches the site's primary-button convention (ink background, paper
  // text — .submit-btn/.modal-btn-primary/.export-btn all share this).
  button: {
    width: '65%',
    height: 56,
    backgroundColor: Colors.ink,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInLink: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 44,
  },
  signInLinkText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
  },
  signInLinkHighlight: {
    fontFamily: Fonts.sansBold,
    color: Colors.ink,
  },
  buttonText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
