import {
  Button,
  HeroBackdrop,
  Pill,
  Screen,
  Text,
} from "@/components/design";
import { tokens } from "@/constants/theme";
import React, { useEffect } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface SplashScreenProps {
  onGetStarted: () => void;
}

/**
 * Splash / welcome screen. Mirrors the BackChannel beta-site hero —
 * "live" pill badge, two-line serif headline (regular + italic accent),
 * body copy, and a single CTA. Editorial paper-and-ink against soft orbs.
 */
export const SplashScreen = ({ onGetStarted }: SplashScreenProps) => {
  const badgeOpacity = useSharedValue(0);
  const badgeTranslate = useSharedValue(12);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(18);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslate = useSharedValue(14);
  const ctaOpacity = useSharedValue(0);
  const ctaTranslate = useSharedValue(14);

  useEffect(() => {
    badgeOpacity.value = withTiming(1, { duration: 600 });
    badgeTranslate.value = withTiming(0, { duration: 600 });
    titleOpacity.value = withDelay(180, withTiming(1, { duration: 700 }));
    titleTranslate.value = withDelay(180, withTiming(0, { duration: 700 }));
    bodyOpacity.value = withDelay(420, withTiming(1, { duration: 600 }));
    bodyTranslate.value = withDelay(420, withTiming(0, { duration: 600 }));
    ctaOpacity.value = withDelay(620, withTiming(1, { duration: 600 }));
    ctaTranslate.value = withDelay(620, withTiming(0, { duration: 600 }));
    // Shared values are stable refs; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslate.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslate.value }],
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
        <View style={styles.centerStack}>
          <Animated.View style={badgeStyle}>
            <Pill tone="neutral" dot dotColor={tokens.colors.live} uppercase>
              Closed beta
            </Pill>
          </Animated.View>

          <Animated.View style={[styles.headline, titleStyle]}>
            <Text variant="heroSerif" align="center">
              Welcome to
            </Text>
            <Text variant="heroSerifItalic" align="center">
              BackChannel.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.bodyWrap, bodyStyle]}>
            <Text variant="bodyLarge" align="center">
              Get referred. Get hired. Get ahead. A quieter way to find your
              next role — one champion at a time.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, ctaStyle]}>
          <Button label="Get Connected" onPress={onGetStarted} block size="lg" />
          <Text variant="meta" align="center" style={styles.fineprint}>
            By continuing you agree to the closed-beta terms.
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    paddingHorizontal: tokens.layout.screenPaddingH,
    justifyContent: "space-between",
  },
  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.l,
  },
  headline: {
    alignItems: "center",
  },
  bodyWrap: {
    maxWidth: 360,
    paddingHorizontal: tokens.spacing.m,
  },
  footer: {
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  fineprint: {
    paddingHorizontal: tokens.spacing.l,
  },
});
