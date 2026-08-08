import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

// The site's hero typewriter (index.html): "BackChannel." types itself out
// with a blinking cursor that fades once typing settles.
const BRAND_TEXT = 'BackChannel.';
const TYPE_START_DELAY_MS = 900;
const TYPE_INTERVAL_MS = 75;

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
// "Living product tease" (Hinge-style): abstracted, whisper-gray job-card
// skeletons drift almost imperceptibly behind the headline — showing what
// the app IS before sign-up without competing with the type. Restraint
// rules: monochrome surface tones only, slow multi-second drift, slight
// rotations, pointerEvents off, and everything stays clear of the
// headline's center band.

interface GhostCardSpec {
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

const GHOST_CARDS: GhostCardSpec[] = [
  // Upper-left, mostly on-screen.
  { top: 90, left: -24, rotate: '-7deg', scale: 1, driftY: -14, driftX: 6, durationMs: 11000, opacity: 0.65 },
  // Upper-right, peeking off the edge.
  { top: 170, right: -70, rotate: '5deg', scale: 0.92, driftY: -10, driftX: -8, durationMs: 14000, opacity: 0.55 },
  // Low-left, behind the footer's whitespace, faintest.
  { bottom: 190, left: -55, rotate: '4deg', scale: 0.85, driftY: -12, driftX: 5, durationMs: 17000, opacity: 0.45 },
];

function GhostCard({ spec }: { spec: GhostCardSpec }) {
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

  const animStyle = useAnimatedStyle(() => ({
    opacity: appear.value * spec.opacity,
    transform: [
      { translateY: drift.value * spec.driftY },
      { translateX: drift.value * spec.driftX },
      { rotate: spec.rotate },
      { scale: spec.scale },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ghostCard,
        {
          top: spec.top,
          bottom: spec.bottom,
          left: spec.left,
          right: spec.right,
        },
        animStyle,
      ]}
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

export const SplashScreen = ({ onGetStarted, onSignIn }: SplashScreenProps) => {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.98);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(15);
  const cursorOpacity = useSharedValue(0);

  const [typedCount, setTypedCount] = useState(0);
  const typingDone = typedCount >= BRAND_TEXT.length;

  useEffect(() => {
    // Smooth, elegant entrance
    titleOpacity.value = withTiming(1, { duration: 1500 });
    titleScale.value = withTiming(1, { duration: 1500 });

    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    buttonTranslateY.value = withDelay(1000, withTiming(0, { duration: 800 }));
  }, [buttonOpacity, buttonTranslateY, titleOpacity, titleScale]);

  // Typewriter: after a beat, type the brand name character by character.
  // Interval-driven so a returning user being auto-routed away (splash.tsx
  // redirects once auth loads) just unmounts and cleans up mid-word.
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

  // Cursor: appears with typing, blinks a few times after the word lands,
  // then fades out for good — same choreography as the site's hero.
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
        3,
      ),
      withTiming(0, { duration: 300 }),
    );
  }, [typingDone, cursorOpacity]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Ghost job cards drifting behind everything. */}
      {GHOST_CARDS.map((spec, i) => (
        <GhostCard key={i} spec={spec} />
      ))}

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

          <Text style={styles.tagline}>
            Get referred. Get hired. Get ahead.
          </Text>
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
  // Whisper-gray abstraction of the app's real job cards: logo tile, two
  // text bars, two chips. All surface/border tones — never darker — so
  // the serif headline stays unchallenged.
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
  // Matches the site's .hero-body (light weight, body-gray, relaxed
  // line-height).
  tagline: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.body,
    textAlign: 'center',
    marginTop: 20,
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