import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';

interface SplashScreenProps {
  onGetStarted: () => void;
  /**
   * Direct entry to sign-in, skipping role selection and the onboarding
   * slides entirely. Without this, a returning user had no way back to
   * login short of walking the full new-user funnel.
   */
  onSignIn: () => void;
}

export const SplashScreen = ({ onGetStarted, onSignIn }: SplashScreenProps) => {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.98);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(15);

  useEffect(() => {
    // Smooth, elegant entrance
    titleOpacity.value = withTiming(1, { duration: 1500 });
    titleScale.value = withTiming(1, { duration: 1500 });
    
    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    buttonTranslateY.value = withDelay(1000, withTiming(0, { duration: 800 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.centerContent}>
        <Animated.View style={[styles.brandWrapper, titleStyle]}>
          {/* Matches the marketing site's hero exactly (index.html):
              "Welcome to" in plain serif ink, the brand name itself as
              the italic muted-gray accent — the site's own convention
              for the highlighted word in a headline. */}
          <Text style={styles.brandName}>
            Welcome to{"\n"}
            <Text style={styles.brandSerif}>BackChannel.</Text>
          </Text>

          <Text style={styles.tagline}>
            Get referred. Get hired. Get ahead.
          </Text>
        </Animated.View>
      </View>

      <SafeAreaView style={styles.footer}>
        <Animated.View style={[styles.buttonContainer, buttonStyle]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onGetStarted}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Connected</Text>
          </TouchableOpacity>
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