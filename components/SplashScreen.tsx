import {
  Button,
  HeroBackdrop,
  Screen,
  Text,
} from "@/components/design";
import { tokens } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface SplashScreenProps {
  onGetStarted: () => void;
}

// The typewriter target — the italic accent half of the headline.
const TYPED_WORD = "BackChannel.";
const TYPE_START_DELAY_MS = 700;
const TYPE_FIRST_CHAR_DELAY_MS = 220;
const TYPE_MIN_CHAR_DELAY_MS = 70;
const TYPE_RANDOM_CHAR_DELAY_MS = 35;
// Approx. total typing duration — used to schedule the CTA fade-up so it
// lands just after the typewriter resolves rather than mid-typing.
const APPROX_TYPING_MS =
  TYPE_FIRST_CHAR_DELAY_MS +
  (TYPED_WORD.length - 1) *
    (TYPE_MIN_CHAR_DELAY_MS + TYPE_RANDOM_CHAR_DELAY_MS / 2);

/**
 * Splash / welcome screen — pared back to a single editorial moment.
 *   • Pulsing "Closed Beta" dot at the top
 *   • Two-line serif headline ("Welcome to / *BackChannel.*") with the
 *     italic accent half typed character-by-character behind a blinking
 *     cursor that fades out when the word resolves
 *   • Single CTA
 * No body paragraph, no fine print — the headline carries the moment.
 * HeroBackdrop's soft orbs sit behind it all.
 */
export const SplashScreen = ({ onGetStarted }: SplashScreenProps) => {
  const [typed, setTyped] = useState("");

  const badgeOpacity = useSharedValue(0);
  const badgeTranslate = useSharedValue(8);
  const dotPulse = useSharedValue(0);
  const welcomeOpacity = useSharedValue(0);
  const welcomeTranslate = useSharedValue(18);
  const cursorOpacity = useSharedValue(1);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslate = useSharedValue(12);
  const ctaOpacity = useSharedValue(0);
  const ctaTranslate = useSharedValue(14);

  useEffect(() => {
    // 1. Closed-beta badge fades in first.
    badgeOpacity.value = withTiming(1, { duration: 500 });
    badgeTranslate.value = withTiming(0, { duration: 500 });

    // 2. Live-dot halo — continuous scaling ripple, mirrors the website's
    //    box-shadow pulse keyframe. Driven by a 0→1 oscillator that the
    //    animated style maps to scale + opacity.
    dotPulse.value = withDelay(
      1200,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );

    // 3. "Welcome to" headline fades up.
    welcomeOpacity.value = withDelay(220, withTiming(1, { duration: 650 }));
    welcomeTranslate.value = withDelay(220, withTiming(0, { duration: 650 }));

    // 4. Cursor blink — ~8 full cycles then fade to invisible. Each cycle
    //    fades to 0 then snaps back to 1; over 8 cycles that's ~3s of blink
    //    before the final 400 ms fade out.
    cursorOpacity.value = withDelay(
      TYPE_START_DELAY_MS,
      withSequence(
        withRepeat(
          withSequence(
            withTiming(0, { duration: 380, easing: Easing.linear }),
            withTiming(1, { duration: 0 }),
          ),
          8,
          false,
        ),
        withTiming(0, { duration: 400 }),
      ),
    );

    // 5. Typewriter — character-by-character with a small random jitter so
    //    it reads as typing, not as a uniform stream.
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const type = () => {
      if (i <= TYPED_WORD.length) {
        setTyped(TYPED_WORD.slice(0, i));
        i++;
        const delay =
          i === 1
            ? TYPE_FIRST_CHAR_DELAY_MS
            : TYPE_MIN_CHAR_DELAY_MS +
              Math.random() * TYPE_RANDOM_CHAR_DELAY_MS;
        timer = setTimeout(type, delay);
      }
    };
    timer = setTimeout(type, TYPE_START_DELAY_MS);

    // 6. Tagline + CTA fade up just after the typewriter resolves. The
    //    tagline arrives a beat before the button so the eye lands on
    //    the copy first.
    const taglineDelay = TYPE_START_DELAY_MS + APPROX_TYPING_MS + 240;
    taglineOpacity.value = withDelay(
      taglineDelay,
      withTiming(1, { duration: 550 }),
    );
    taglineTranslate.value = withDelay(
      taglineDelay,
      withTiming(0, { duration: 550 }),
    );
    const ctaDelay = taglineDelay + 180;
    ctaOpacity.value = withDelay(ctaDelay, withTiming(1, { duration: 550 }));
    ctaTranslate.value = withDelay(ctaDelay, withTiming(0, { duration: 550 }));

    return () => {
      if (timer) clearTimeout(timer);
    };
    // Shared values are stable refs; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslate.value }],
  }));
  const dotHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - dotPulse.value),
    transform: [{ scale: 1 + dotPulse.value * 2.6 }],
  }));
  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: welcomeOpacity.value,
    transform: [{ translateY: welcomeTranslate.value }],
  }));
  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslate.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslate.value }],
  }));

  return (
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <HeroBackdrop />

      <View style={styles.frame}>
        <Animated.View style={[styles.badgeRow, badgeStyle]}>
          <View style={styles.badge}>
            <View style={styles.dotWrap}>
              <Animated.View style={[styles.dotHalo, dotHaloStyle]} />
              <View style={styles.dotCore} />
            </View>
            <Text variant="pillLabel" style={styles.badgeLabel}>
              Closed Beta
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.headline, welcomeStyle]}>
          <Text variant="heroSerif" align="center" style={styles.headlineText}>
            Welcome to
          </Text>
          <View style={styles.typeRow}>
            <Text variant="heroSerifItalic" style={styles.typedText}>
              {typed}
            </Text>
            <Animated.View style={[styles.cursor, cursorStyle]} />
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Animated.View style={taglineStyle}>
            <Text variant="bodyLarge" align="center" style={styles.tagline}>
              Get referred. Get hired. Get ahead.
            </Text>
          </Animated.View>
          <Animated.View style={ctaStyle}>
            <Button
              label="Get started"
              onPress={onGetStarted}
              block
              size="lg"
            />
          </Animated.View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingTop: tokens.spacing.xxxl,
    paddingBottom: tokens.spacing.xxl,
    justifyContent: "space-between",
  },
  badgeRow: {
    alignItems: "center",
  },
  // Inline closed-beta badge — rendered manually rather than via <Pill> so
  // we can layer the animated halo behind the dot core.
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: tokens.radii.pill,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.bg,
  },
  dotWrap: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  dotHalo: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.live,
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.live,
  },
  badgeLabel: {
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  headline: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // Extra horizontal room so the heroSerif's trailing glyph (the "o"
    // in "to", the "." in "BackChannel.") isn't clipped by iOS's text
    // measurement under heavy negative letter-spacing.
    paddingHorizontal: tokens.spacing.m,
  },
  // Stretch the centred headline text across the full available width so
  // textAlign:center has room to breathe and the trailing character has
  // pixels to render its full glyph.
  headlineText: {
    alignSelf: "stretch",
  },
  // Typewriter line — italic serif Text + an inline blinking cursor View.
  // Centred horizontally so as the text grows both edges expand outward
  // and the cursor stays pinned to the trailing character.
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // Reserve the full heroSerifItalic line-height so the row doesn't
    // collapse before any characters have been typed.
    minHeight: 48,
  },
  // The typewriter text intentionally shrink-wraps to its current
  // character count so the cursor sits flush against the trailing
  // glyph. paddingRight gives the trailing italic serif a few pixels
  // of room so it isn't clipped by iOS text measurement.
  typedText: {
    paddingRight: 2,
  },
  cursor: {
    width: 3,
    height: 34,
    backgroundColor: tokens.colors.textMuted,
    marginLeft: 3,
    marginBottom: 4,
    borderRadius: 1,
  },
  footer: {
    gap: tokens.spacing.m,
  },
  // Brand tagline above the CTA — the one line we kept from the original
  // body paragraph, scaled down so it reads as a quiet caption beneath
  // the typewriter rather than a competing block of copy.
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: tokens.spacing.m,
  },
});
