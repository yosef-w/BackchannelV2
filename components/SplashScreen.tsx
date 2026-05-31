import React, { useEffect } from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Color, Motion, Radius, Space } from "@/constants/theme";
import {
  Body,
  Eyebrow,
  HeroTitle,
  UIText,
} from "@/components/ui/typography";
import { ArrowRight } from "lucide-react-native";

interface SplashScreenProps {
  onGetStarted: () => void;
}

/**
 * The first frame of the brand. Paper-feel surface, a single editorial
 * moment ("Welcome to *BackChannel.*"), then a quiet ink CTA. The italic
 * serif accent is what sets the tone for everything that follows.
 *
 * Entrance: a slow staggered fade-up that lets the wordmark land before
 * the body and button arrive — the same rhythm the tester site uses.
 */
export const SplashScreen = ({ onGetStarted }: SplashScreenProps) => {
  // Shared values per row so each can land on its own beat.
  const eyebrow = useSharedValue(0);
  const title = useSharedValue(0);
  const body = useSharedValue(0);
  const cta = useSharedValue(0);

  useEffect(() => {
    eyebrow.value = withDelay(120, withTiming(1, { duration: 500 }));
    title.value = withDelay(280, withTiming(1, { duration: 700 }));
    body.value = withDelay(680, withTiming(1, { duration: 500 }));
    cta.value = withDelay(960, withTiming(1, { duration: 500 }));
  }, []);

  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: eyebrow.value,
    transform: [{ translateY: (1 - eyebrow.value) * 8 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 14 }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: body.value,
    transform: [{ translateY: (1 - body.value) * 10 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.value,
    transform: [{ translateY: (1 - cta.value) * 12 }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Top eyebrow — tiny tracked label that anchors the brand at the top */}
        <Animated.View style={[styles.top, eyebrowStyle]}>
          <Eyebrow label="BackChannel" tag="Closed Beta" />
        </Animated.View>

        {/* Center stack — the editorial moment */}
        <View style={styles.center}>
          <Animated.View style={titleStyle}>
            <HeroTitle lead="Welcome to" accent="BackChannel." size="lg" />
          </Animated.View>

          <Animated.View style={[styles.bodyWrap, bodyStyle]}>
            <Body>Get referred. Get hired. Get ahead.</Body>
          </Animated.View>
        </View>

        {/* Bottom CTA */}
        <Animated.View style={[styles.bottom, ctaStyle]}>
          <Pressable
            onPress={onGetStarted}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <UIText style={styles.buttonText}>Get started</UIText>
            <ArrowRight color={Color.paper} size={18} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.bottomEyebrowWrap}>
            <Eyebrow label="A new way to get hired" />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Color.offWhite },
  safeArea: { flex: 1, paddingHorizontal: Space.screen },
  top: {
    paddingTop: Space.lg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    gap: Space.xl,
  },
  bodyWrap: {
    maxWidth: 320,
  },
  bottom: {
    paddingBottom: Space.xxl,
    gap: Space.lg,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.ink,
    borderRadius: Radius.md,
    paddingVertical: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  buttonText: {
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  bottomEyebrowWrap: {
    alignSelf: "center",
  },
});
