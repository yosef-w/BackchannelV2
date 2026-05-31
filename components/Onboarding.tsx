import { ArrowLeft, ArrowRight } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Color, Radius, Space, Type } from "@/constants/theme";
import { Body, Eyebrow, HeroTitle, UIText } from "@/components/ui/typography";

interface OnboardingProps {
  onComplete: () => void;
  onBack: () => void;
  userType: "applicant" | "sponsor";
}

/**
 * Each slide is a single editorial moment — eyebrow, a HeroTitle with the
 * signature italic accent, and a body line. No iconography; the type does
 * the work. Two-thumb-friendly: dots + a wide ink CTA at the bottom.
 *
 * Title content was rewritten in this redesign so each slide naturally
 * carries a serif accent word that lands the rhythm.
 */

type Slide = { lead: string; accent: string; body: string };

const applicantSlides: Slide[] = [
  {
    lead: "Insiders who can",
    accent: "refer you.",
    body: "Build real relationships with the people inside the companies you actually want to work at.",
  },
  {
    lead: "Skip the resume",
    accent: "black hole.",
    body: "Land in front of hiring managers through a real employee referral — not a cold ATS submission.",
  },
  {
    lead: "Get interviews",
    accent: "faster.",
    body: "Referred candidates are far more likely to get the call back, the interview, and the offer.",
  },
];

const sponsorSlides: Slide[] = [
  {
    lead: "Open doors for",
    accent: "great people.",
    body: "Use your position to help thoughtful candidates break into the company you already love working at.",
  },
  {
    lead: "Shape your",
    accent: "future team.",
    body: "Strengthen your organization by referring peers who align with the bar you've helped set.",
  },
  {
    lead: "Grow your",
    accent: "network.",
    body: "Build lasting relationships with top talent and quiet influence across the industry.",
  },
];

export function Onboarding({ onComplete, onBack, userType }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = userType === "applicant" ? applicantSlides : sponsorSlides;
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  const nextSlide = () => {
    if (!isLast) setCurrentSlide(currentSlide + 1);
    else onComplete();
  };
  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    else onBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Nav row */}
        <View style={styles.nav}>
          <Pressable
            onPress={prevSlide}
            hitSlop={12}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          >
            <ArrowLeft color={Color.muted} size={20} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={onComplete}
            hitSlop={12}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <UIText style={styles.skipText}>Skip</UIText>
          </Pressable>
        </View>

        {/* Slide body */}
        <View style={styles.content}>
          <Animated.View
            key={currentSlide}
            entering={FadeInDown.duration(420)}
            exiting={FadeOut.duration(200)}
            style={styles.slide}
          >
            <Eyebrow
              label={`${String(currentSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`}
            />
            <View style={styles.titleWrap}>
              <HeroTitle lead={slide.lead} accent={slide.accent} size="md" />
            </View>
            <Body style={styles.body}>{slide.body}</Body>
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentSlide ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={nextSlide}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}
          >
            <UIText style={styles.ctaText}>
              {isLast ? "Get started" : "Continue"}
            </UIText>
            <ArrowRight color={Color.paper} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Color.offWhite },
  safeArea: { flex: 1 },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.screen,
    paddingTop: Space.md,
  },
  navBtn: { paddingVertical: 6, paddingRight: 6 },
  skipText: { fontSize: 14, color: Color.muted, fontFamily: Type.sans500 },
  pressed: { opacity: 0.6 },

  content: {
    flex: 1,
    paddingHorizontal: Space.screen,
    justifyContent: "center",
  },
  slide: { gap: Space.lg },
  titleWrap: { marginTop: 4 },
  body: { maxWidth: 380, marginTop: 4 },

  footer: {
    paddingHorizontal: Space.screen,
    paddingBottom: Space.xxl,
    gap: Space.lg,
  },
  dotsRow: { flexDirection: "row", gap: 6 },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 24, backgroundColor: Color.ink },
  dotInactive: { width: 8, backgroundColor: Color.border },

  cta: {
    backgroundColor: Color.ink,
    borderRadius: Radius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  ctaPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  ctaText: {
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
});
