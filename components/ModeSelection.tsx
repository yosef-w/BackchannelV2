import {
  Divider,
  HeroBackdrop,
  Pill,
  Screen,
  Text,
} from "@/components/design";
import { tokens } from "@/constants/theme";
import { ArrowLeft, ArrowUpRight } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { trackSignUpRoleSelected } from "../lib/analytics/mixpanel";
import { useOnboardingStore } from "../stores/useOnboardingStore";

interface ModeSelectionProps {
  onSelect: (mode: "applicant" | "sponsor") => void;
  onBack: () => void;
}

interface RoleCardProps {
  eyebrow: string;
  title: string;
  titleItalic: string;
  description: string;
  cta: string;
  selected: boolean;
  onPress: () => void;
  delay?: number;
}

function RoleCard({
  eyebrow,
  title,
  titleItalic,
  description,
  cta,
  selected,
  onPress,
  delay = 0,
}: RoleCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          selected && styles.cardSelected,
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 },
        ]}
      >
        <Text
          variant="eyebrow"
          color={
            selected ? tokens.colors.textOnInk : tokens.colors.textFaint
          }
        >
          {eyebrow}
        </Text>

        <View style={styles.cardTitleStack}>
          <Text
            variant="titleSerif"
            color={selected ? tokens.colors.textOnInk : tokens.colors.text}
            style={styles.cardTitleSize}
          >
            {title}
          </Text>
          <Text
            variant="titleSerifItalic"
            color={
              selected ? tokens.colors.textOnInk : tokens.colors.textMuted
            }
            style={styles.cardTitleSize}
          >
            {titleItalic}
          </Text>
        </View>

        <Text
          variant="bodySmall"
          color={selected ? tokens.colors.textOnInk : tokens.colors.textBody}
          style={styles.cardDesc}
        >
          {description}
        </Text>

        <View style={styles.ctaRow}>
          <Text
            variant="buttonGhost"
            color={selected ? tokens.colors.textOnInk : tokens.colors.text}
          >
            {cta}
          </Text>
          <ArrowUpRight
            size={16}
            strokeWidth={2.2}
            color={selected ? tokens.colors.textOnInk : tokens.colors.text}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ModeSelection({ onSelect, onBack }: ModeSelectionProps) {
  const [selected, setSelected] = useState<"applicant" | "sponsor" | null>(
    null,
  );
  const setUserType = useOnboardingStore((state) => state.setUserType);

  const handleSelect = (mode: "applicant" | "sponsor") => {
    setSelected(mode);
    setUserType(mode);
    trackSignUpRoleSelected(mode);
    // Brief delay so the card's selected state is visible before navigating.
    setTimeout(() => onSelect(mode), 200);
  };

  return (
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <HeroBackdrop />

      {/* Top nav row — back chevron + wordmark + closed-beta tag */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={12}
          style={styles.navBack}
        >
          <ArrowLeft size={18} color={tokens.colors.textMuted} />
          <Text variant="bodySmall" color={tokens.colors.textMuted}>
            Back
          </Text>
        </TouchableOpacity>
        <View style={styles.navRight}>
          <Text variant="eyebrow" color={tokens.colors.textFaint}>
            Closed Beta
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Animated.View entering={FadeInUp.duration(500)} style={styles.hero}>
          <View style={styles.heroBadge}>
            <Pill tone="neutral" dot dotColor={tokens.colors.live} uppercase>
              You're in — limited testers only
            </Pill>
          </View>
          <Text variant="titleSerif" align="center" style={styles.heroTitle}>
            How will you use
          </Text>
          <Text
            variant="titleSerifItalic"
            align="center"
            style={styles.heroTitle}
          >
            BackChannel?
          </Text>
          <Text
            variant="bodyLarge"
            align="center"
            style={styles.heroBody}
          >
            Pick the one that matches your real life. You can switch later
            from Settings.
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          <RoleCard
            eyebrow="I'm looking for a job"
            title="I'm an"
            titleItalic="Applicant"
            description="You want someone on the inside to champion your application. Browse jobs, connect with sponsors, and skip the black hole of sending résumés into the void."
            cta="Continue as Applicant"
            selected={selected === "applicant"}
            onPress={() => handleSelect("applicant")}
            delay={120}
          />
          <RoleCard
            eyebrow="I work at a company"
            title="I'm a"
            titleItalic="Sponsor"
            description="You refer talented people to open roles at your company. Browse applicant profiles, match with candidates you'd vouch for, and make introductions that matter."
            cta="Continue as Sponsor"
            selected={selected === "sponsor"}
            onPress={() => handleSelect("sponsor")}
            delay={240}
          />
        </View>

        <Animated.View entering={FadeInUp.delay(360).duration(500)}>
          <Divider label="Not sure? Pick the one that matches your real life." />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  navRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.layout.screenPaddingH,
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
  },
  navBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navRight: {},
  body: {
    flex: 1,
  },
  // ScrollView contentContainerStyle — pads + gaps go here rather than on
  // the outer style so the scroll-bounce surface fills the screen and
  // shorter content still hugs the top.
  bodyContent: {
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.l,
  },
  hero: {
    alignItems: "center",
    gap: tokens.spacing.s,
  },
  heroBadge: {
    marginBottom: tokens.spacing.s,
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 40,
  },
  heroBody: {
    maxWidth: 340,
    marginTop: tokens.spacing.sm,
  },
  cards: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.l,
  },
  card: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.l,
    paddingVertical: tokens.spacing.l,
    paddingHorizontal: tokens.spacing.l,
  },
  cardSelected: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  cardTitleStack: {
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.s,
  },
  cardTitleSize: {
    fontSize: 24,
    lineHeight: 28,
  },
  cardDesc: {
    marginBottom: tokens.spacing.ml,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});

