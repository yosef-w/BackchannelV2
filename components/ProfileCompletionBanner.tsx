import { Card, Pill, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { AlertCircle, ChevronRight, X } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ProfileCompletionBannerProps {
  percentage: number;
  onPress: () => void;
  onDismiss?: () => void;
}

/**
 * Inline banner shown above HomeView / ProfileView while the user's
 * profile is below the completion threshold. Editorial: eyebrow + serif
 * micro-title, percent in a Pill, CTA on a hairline border.
 */
export function ProfileCompletionBanner({
  percentage,
  onPress,
  onDismiss,
}: ProfileCompletionBannerProps) {
  if (percentage >= 90) return null;

  const tone = percentage >= 60 ? "info" : "warning";

  return (
    <Animated.View entering={FadeInDown.delay(300)} style={styles.wrap}>
      <Card variant="default" padded={false}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <AlertCircle
              color={tokens.colors.textBody}
              size={18}
              strokeWidth={1.8}
            />
          </View>

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text variant="eyebrow">Complete your profile</Text>
              <Pill tone={tone}>{percentage}%</Pill>
            </View>
            <Text
              variant="bodySmall"
              color={tokens.colors.textBody}
              style={styles.subtitle}
            >
              Add the missing pieces — sponsors weigh complete profiles
              more heavily and you'll unlock autofill across the app.
            </Text>
            <TouchableOpacity
              onPress={onPress}
              style={styles.cta}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Text variant="buttonGhost" color={tokens.colors.text}>
                Complete now
              </Text>
              <ChevronRight
                color={tokens.colors.text}
                size={14}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>

          {onDismiss ? (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss}
              hitSlop={10}
            >
              <X color={tokens.colors.textMuted} size={18} strokeWidth={1.8} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: tokens.layout.screenPaddingH,
    marginBottom: tokens.spacing.m,
  },
  row: {
    flexDirection: "row",
    padding: tokens.spacing.m,
    gap: tokens.spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.s,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: tokens.spacing.s,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  closeBtn: {
    padding: 2,
    alignSelf: "flex-start",
  },
});
