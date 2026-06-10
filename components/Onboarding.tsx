import { Button, HeroBackdrop, Screen, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import {
    ArrowLeft,
    Building2,
    HandHeart,
    Network,
    Rocket,
    TrendingUp,
    UserCheck,
} from "lucide-react-native";
import React, { useState } from "react";
import {
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInRight, FadeOut } from "react-native-reanimated";

interface OnboardingProps {
  onComplete: () => void;
  onBack: () => void;
  userType: "applicant" | "sponsor";
}

type Slide = {
  Icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  eyebrow: string;
  title: string;
  titleItalic: string;
  description: string;
};

const applicantSlides: Slide[] = [
  {
    Icon: UserCheck,
    eyebrow: "Insiders, not algorithms",
    title: "Support",
    titleItalic: "on the inside.",
    description:
      "Connect with people who actually work at your dream companies — and would vouch for you.",
  },
  {
    Icon: Rocket,
    eyebrow: "Skip the black hole",
    title: "Resumes that",
    titleItalic: "get read.",
    description:
      "Get your application directly in front of hiring managers through warm employee referrals.",
  },
  {
    Icon: TrendingUp,
    eyebrow: "Faster than cold apply",
    title: "Interviews,",
    titleItalic: "sooner.",
    description:
      "Referred candidates are significantly more likely to get interviews and offers. Stack the deck.",
  },
];

const sponsorSlides: Slide[] = [
  {
    Icon: HandHeart,
    eyebrow: "Use your seat at the table",
    title: "Open doors",
    titleItalic: "for the right people.",
    description:
      "Help talented candidates break into great companies — including the one you already work at.",
  },
  {
    Icon: Building2,
    eyebrow: "Shape your future team",
    title: "Hire peers",
    titleItalic: "you respect.",
    description:
      "Strengthen your organization by referring people who align with your team's standards.",
  },
  {
    Icon: Network,
    eyebrow: "Compounds over time",
    title: "Grow a network",
    titleItalic: "that lasts.",
    description:
      "Build lasting relationships with top talent and expand your influence across the industry.",
  },
];

export function Onboarding({ onComplete, onBack, userType }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = userType === "applicant" ? applicantSlides : sponsorSlides;

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    } else {
      onBack();
    }
  };

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return (
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <HeroBackdrop />

      {/* Top nav row */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={prevSlide} style={styles.navBtn} hitSlop={12}>
          <ArrowLeft size={18} color={tokens.colors.textMuted} />
          <Text variant="bodySmall" color={tokens.colors.textMuted}>
            Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onComplete} hitSlop={12}>
          <Text variant="bodySmall" color={tokens.colors.textMuted}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View
          key={currentSlide}
          entering={FadeInRight.duration(420)}
          exiting={FadeOut.duration(180)}
          style={styles.slideWrapper}
        >
          <View style={styles.iconCircle}>
            <slide.Icon color={tokens.colors.text} size={28} strokeWidth={1.6} />
          </View>

          <Text variant="eyebrow" style={styles.slideEyebrow}>
            {slide.eyebrow}
          </Text>
          <Text variant="titleSerif" style={styles.slideTitle}>
            {slide.title}
          </Text>
          <Text variant="titleSerifItalic" style={styles.slideTitle}>
            {slide.titleItalic}
          </Text>
          <Text variant="bodyLarge" style={styles.slideDesc}>
            {slide.description}
          </Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <Button
          label={isLast ? "Get started" : "Continue"}
          onPress={nextSlide}
          block
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topNav: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.layout.screenPaddingH,
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.layout.screenPaddingH,
  },
  slideWrapper: {
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing.l,
  },
  slideEyebrow: {
    marginBottom: tokens.spacing.sm,
  },
  slideTitle: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  slideDesc: {
    marginTop: tokens.spacing.m,
    maxWidth: 420,
  },
  footer: {
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.l,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 28,
    backgroundColor: tokens.colors.text,
  },
  dotInactive: {
    width: 8,
    backgroundColor: tokens.colors.border,
  },
});
