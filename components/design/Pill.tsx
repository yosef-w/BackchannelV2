import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text";

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  /** Render a small leading dot (used for live / status indicators). */
  dot?: boolean;
  /** Override the dot colour; defaults to the tone's foreground. */
  dotColor?: string;
  /** Uppercase the label (matches the site's role badges). */
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill / badge — used for severity tags, role labels, status indicators,
 * grouped-conversation counts, etc. Tones map 1:1 to the site's
 * `.p-block / .p-major / .p-minor / .p-cosm` colour pairings.
 */
export function Pill({
  children,
  tone = "neutral",
  dot,
  dotColor,
  uppercase = false,
  style,
}: PillProps) {
  const { bg, fg, border } = toneColors(tone);

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      {dot ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor ?? fg },
          ]}
        />
      ) : null}
      <Text
        variant="pillLabel"
        color={fg}
        style={uppercase ? styles.upper : undefined}
      >
        {children}
      </Text>
    </View>
  );
}

function toneColors(tone: PillTone) {
  switch (tone) {
    case "success":
      return {
        bg: tokens.colors.successBg,
        fg: tokens.colors.successFg,
        border: tokens.colors.successBorder,
      };
    case "warning":
      return {
        bg: tokens.colors.warningBg,
        fg: tokens.colors.warningFg,
        border: tokens.colors.warningBorder,
      };
    case "danger":
      return {
        bg: tokens.colors.dangerBg,
        fg: tokens.colors.dangerFg,
        border: tokens.colors.dangerBorder,
      };
    case "info":
      return {
        bg: tokens.colors.infoBg,
        fg: tokens.colors.infoFg,
        border: tokens.colors.infoBorder,
      };
    case "neutral":
    default:
      return {
        bg: tokens.colors.bgSurface,
        fg: tokens.colors.textMuted,
        border: tokens.colors.border,
      };
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: tokens.radii.pill,
    borderWidth: tokens.borders.hairline,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  upper: {
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
});
