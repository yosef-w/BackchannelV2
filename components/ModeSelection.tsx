// ModeSelection — role choice, rebuilt to the marketing site's editorial
// card language (index.html's .role-card): each card reads top-to-bottom
// like a small cover — uppercase eyebrow label, serif title with the
// site's italic muted accent on the role word, a real description, and a
// "Continue as X →" CTA line. Replaces the previous icon-circle utility
// rows, which read as settings-menu chrome rather than a brand moment on
// what is one of the first screens every new user sees. Cards stagger in
// and shrink slightly on press (PressableScale), both per the site.

import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  trackScreenViewed,
  trackSignUpRoleSelected,
} from "@/lib/analytics/mixpanel";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { Colors, Fonts, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";

interface ModeSelectionProps {
  onSelect: (mode: "applicant" | "sponsor") => void;
  onBack: () => void;
}

const ROLES = [
  {
    mode: "applicant" as const,
    eyebrow: "I'M LOOKING FOR A JOB",
    titlePlain: "I'm an ",
    titleAccent: "Applicant",
    description:
      "You want someone on the inside to champion your application. Browse jobs, connect with sponsors, and skip the resume black hole.",
    cta: "Continue as Applicant",
  },
  {
    mode: "sponsor" as const,
    eyebrow: "I WORK AT A COMPANY",
    titlePlain: "I'm a ",
    titleAccent: "Sponsor",
    description:
      "You refer talented people to open roles at your company. Match with candidates you'd vouch for, and make introductions that matter.",
    cta: "Continue as Sponsor",
  },
];

export function ModeSelection({ onSelect, onBack }: ModeSelectionProps) {
  useEffect(() => {
    trackScreenViewed("mode_selection");
  }, []);

  const [selected, setSelected] = useState<"applicant" | "sponsor" | null>(
    null,
  );
  const setUserType = useOnboardingStore((state) => state.setUserType);

  const handleSelect = (mode: "applicant" | "sponsor") => {
    setSelected(mode);
    setUserType(mode);
    trackSignUpRoleSelected(mode);
    // Brief beat so the selected border registers before navigating.
    setTimeout(() => onSelect(mode), 200);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color="#000" size={24} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Animated.View
            entering={FadeInDown.duration(500)}
            style={styles.header}
          >
            <Text style={styles.title}>
              How will you use{"\n"}
              <Text style={styles.titleAccent}>BackChannel?</Text>
            </Text>
            <Text style={styles.subtitle}>
              Pick the one that matches your real life.
            </Text>
          </Animated.View>

          <View style={styles.cardsContainer}>
            {ROLES.map((role, i) => (
              <Animated.View
                key={role.mode}
                entering={FadeInDown.delay(120 + i * 120).duration(500)}
              >
                <PressableScale
                  onPress={() => handleSelect(role.mode)}
                  style={[
                    styles.card,
                    selected === role.mode && styles.cardSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === role.mode }}
                >
                  <Text style={styles.cardEyebrow}>{role.eyebrow}</Text>
                  <Text style={styles.cardTitle}>
                    {role.titlePlain}
                    <Text style={styles.cardTitleAccent}>
                      {role.titleAccent}
                    </Text>
                  </Text>
                  <Text style={styles.cardDescription}>{role.description}</Text>
                  <View style={styles.cardCtaRow}>
                    <Text style={styles.cardCta}>{role.cta}</Text>
                    <ArrowRight color={Colors.ink} size={15} strokeWidth={2.4} />
                  </View>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Branding Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>BackChannel</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    padding: 20,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  header: {
    marginBottom: 36,
  },
  title: {
    ...Type.display,
    color: Colors.ink,
  },
  // The site's .hero-title em rule — the accent word is italic + muted.
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 17,
    lineHeight: 25,
    color: Colors.body,
    marginTop: 12,
  },
  cardsContainer: {
    gap: 14,
  },
  // The site's .role-card: off-white, hairline border, generous radius,
  // left-aligned editorial column.
  card: {
    backgroundColor: Colors.offWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  cardSelected: {
    borderColor: Colors.ink,
  },
  // .role-label — tiny uppercase eyebrow.
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.faint,
    marginBottom: 6,
  },
  // .role-title — serif with italic muted accent on the role word.
  cardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 29,
    color: Colors.ink,
    marginBottom: 10,
  },
  cardTitleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // .role-desc
  cardDescription: {
    fontSize: 13,
    color: Colors.body,
    lineHeight: 20,
    marginBottom: 20,
  },
  // .role-cta — "Continue as X" + arrow.
  cardCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardCta: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.1,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 24,
  },
  // Matches the site's faint/label token.
  footerText: {
    fontSize: 11,
    color: Colors.faint,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
