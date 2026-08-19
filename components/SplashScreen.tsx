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
// "Living product tease" (Hinge-style): real-looking job cards drift
// almost imperceptibly behind the headline — showing what the app IS
// before sign-up without competing with the type. The content is REAL
// (plausible titles, companies, chips) rather than skeleton bars, but set
// entirely in muted/faint grays: from a distance it's texture, and only
// when the eye lands on a card does it resolve into an actual job.
// Restraint rules: no motion beyond the one slow drift per card, no color
// darker than Colors.muted, pointerEvents off, and everything stays clear
// of the headline's center band.

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
  // Content — invented-but-plausible (no real company names on a
  // marketing surface).
  monogram: string;
  title: string;
  company: string;
  chips: string[];
  /** Shown on the most visible card only — the product's differentiator,
   * whispered: a tiny avatar + "N sponsors inside" row. */
  sponsorsNote?: string;
}

const GHOST_CARDS: GhostCardSpec[] = [
  // Upper-left, most visible — carries the sponsors note.
  {
    top: 90, left: -24, rotate: '-7deg', scale: 1,
    driftY: -14, driftX: 6, durationMs: 11000, opacity: 0.8,
    monogram: 'M', title: 'Senior Product Designer',
    company: 'Meridian Labs · Remote', chips: ['$130–160k', 'Design'],
    sponsorsNote: '3 sponsors inside',
  },
  // Upper-right, peeking off the edge.
  {
    top: 170, right: -70, rotate: '5deg', scale: 0.92,
    driftY: -10, driftX: -8, durationMs: 14000, opacity: 0.65,
    monogram: 'A', title: 'Backend Engineer',
    company: 'Atlas Health · NYC', chips: ['Python', '$150k+'],
  },
  // (A third, lower-left card was tried and cut — the footer's
  // whitespace reads better clean, and two cards keep the tease in one
  // glance-zone at the top.)
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
        <View style={styles.ghostLogo}>
          <Text style={styles.ghostMonogram}>{spec.monogram}</Text>
        </View>
        <View style={styles.ghostHeaderText}>
          <Text style={styles.ghostTitle} numberOfLines={1}>
            {spec.title}
          </Text>
          <Text style={styles.ghostCompany} numberOfLines={1}>
            {spec.company}
          </Text>
        </View>
      </View>
      <View style={styles.ghostPillRow}>
        {spec.chips.map((chip) => (
          <View key={chip} style={styles.ghostPill}>
            <Text style={styles.ghostPillText}>{chip}</Text>
          </View>
        ))}
      </View>
      {spec.sponsorsNote && (
        <View style={styles.ghostSponsorRow}>
          <View style={styles.ghostSponsorAvatar} />
          <Text style={styles.ghostSponsorText}>{spec.sponsorsNote}</Text>
        </View>
      )}
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
    marginBottom: 12,
  },
  ghostLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Serif monogram in the logo tile — reads as a company mark.
  ghostMonogram: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: Colors.muted,
  },
  ghostHeaderText: { flex: 1, gap: 2 },
  // Real content, but never darker than muted — texture from afar,
  // legible up close.
  ghostTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.muted,
  },
  ghostCompany: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.faint,
  },
  ghostPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ghostPill: {
    borderRadius: 999,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ghostPillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: Colors.muted,
  },
  // The whispered differentiator: tiny avatar dot + "N sponsors inside".
  ghostSponsorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  ghostSponsorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghostSponsorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10.5,
    color: Colors.muted,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    // Nudge the brand block below true center — optically it sat high
    // against the CTA-weighted bottom. (Static transform here, not on
    // brandWrapper, whose animated style would override it.)
    transform: [{ translateY: 24 }],
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