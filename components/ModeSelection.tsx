import React, { useState } from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, ArrowUpRight } from "lucide-react-native";
import { trackSignUpRoleSelected } from "../lib/analytics/mixpanel";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { Color, Radius, Space, Type } from "@/constants/theme";
import { Body, Eyebrow, HeroTitle, UIText } from "@/components/ui/typography";

interface ModeSelectionProps {
  onSelect: (mode: "applicant" | "sponsor") => void;
  onBack: () => void;
}

/**
 * Mobile translation of the tester-site landing — same shape, vertical
 * stack instead of two-column. Each role card carries the editorial
 * pattern: a tiny eyebrow, a "I'm a/an *Role*" title with the italic
 * serif accent, a calm explanation, and a soft CTA line.
 */
export function ModeSelection({ onSelect, onBack }: ModeSelectionProps) {
  const [selected, setSelected] = useState<"applicant" | "sponsor" | null>(
    null,
  );
  const setUserType = useOnboardingStore((state) => state.setUserType);

  const handleSelect = (mode: "applicant" | "sponsor") => {
    setSelected(mode);
    setUserType(mode);
    trackSignUpRoleSelected(mode);
    // Brief visual confirmation before advancing — matches the website's
    // soft delay after picking a role.
    setTimeout(() => onSelect(mode), 220);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Nav row — back arrow + wordmark eyebrow on the right */}
        <View style={styles.nav}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft color={Color.muted} size={20} strokeWidth={2} />
            <UIText style={styles.backText}>Back</UIText>
          </Pressable>
          <Eyebrow label="BackChannel" tag="Closed Beta" />
        </View>

        <View style={styles.content}>
          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <HeroTitle lead="Pick your" accent="role." size="md" />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120).duration(500)}
            style={styles.heroBody}
          >
            <Body>
              Use BackChannel like you would for real. Pick the role that
              matches your actual life — you can always switch later.
            </Body>
          </Animated.View>

          {/* Role cards */}
          <View style={styles.cards}>
            <Animated.View entering={FadeInDown.delay(220).duration(500)}>
              <RoleCard
                eyebrow="I'm looking for a job"
                lead="I'm an"
                accent="Applicant."
                description="You want someone on the inside to champion your application. Browse jobs, connect with sponsors, and skip the resume black hole."
                cta="Start as an Applicant"
                selected={selected === "applicant"}
                onPress={() => handleSelect("applicant")}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(320).duration(500)}>
              <RoleCard
                eyebrow="I work at a company"
                lead="I'm a"
                accent="Sponsor."
                description="You refer talented people to open roles at your company. Browse profiles, match with candidates you'd vouch for, and make introductions that matter."
                cta="Start as a Sponsor"
                selected={selected === "sponsor"}
                onPress={() => handleSelect("sponsor")}
              />
            </Animated.View>
          </View>
        </View>

        {/* Footer hint */}
        <Animated.View
          entering={FadeInDown.delay(440).duration(500)}
          style={styles.footer}
        >
          <Body style={styles.footerText}>
            Not sure? Pick the one that matches your real life.
          </Body>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

interface RoleCardProps {
  eyebrow: string;
  lead: string;
  accent: string;
  description: string;
  cta: string;
  selected: boolean;
  onPress: () => void;
}

function RoleCard({
  eyebrow,
  lead,
  accent,
  description,
  cta,
  selected,
  onPress,
}: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <Eyebrow label={eyebrow} />
      <View style={styles.cardTitleWrap}>
        <HeroTitle lead={lead} accent={accent} size="sm" />
      </View>
      <Body style={styles.cardBody}>{description}</Body>
      <View style={styles.cardCta}>
        <UIText style={styles.cardCtaText}>{cta}</UIText>
        <ArrowUpRight color={Color.ink} size={16} strokeWidth={2} />
      </View>
    </Pressable>
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
    paddingBottom: Space.sm,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 13, color: Color.muted, fontFamily: Type.sans500 },
  pressed: { opacity: 0.6 },

  content: {
    flex: 1,
    paddingHorizontal: Space.screen,
    paddingTop: Space.xl,
    gap: Space.xl,
  },
  heroBody: {
    maxWidth: 380,
  },
  cards: {
    gap: Space.md,
    marginTop: Space.sm,
  },
  card: {
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.xl,
    padding: Space.xl,
    gap: Space.sm,
  },
  cardSelected: {
    borderColor: Color.borderStrong,
    backgroundColor: Color.paper,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    borderColor: Color.borderStrong,
  },
  cardTitleWrap: {
    marginTop: 2,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Space.md,
  },
  cardCtaText: {
    fontSize: 13,
    color: Color.ink,
    fontFamily: Type.sans600,
    letterSpacing: -0.1,
  },

  footer: {
    paddingHorizontal: Space.screen,
    paddingVertical: Space.lg,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: Color.faint,
    textAlign: "center",
  },
});
