import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export interface CardProps {
  children: ReactNode;
  /**
   * `default` — off-white surface, 1px border, 20px radius. The role-card
   * look on the website.
   * `paper` — flat paper background, used when stacked over a coloured page.
   * `surface` — strongest neutral (full-bleed grouped sections).
   */
  variant?: "default" | "paper" | "surface";
  /** Apply standard internal padding. */
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The signature card surface used across the redesign. Soft 1px border, large
 * radius, off-white background by default. Pressable when an `onPress` is
 * passed so it can stand in for the role-card style buttons.
 */
export function Card({
  children,
  variant = "default",
  padded = true,
  onPress,
  style,
}: CardProps) {
  const bg =
    variant === "paper"
      ? tokens.colors.bg
      : variant === "surface"
        ? tokens.colors.bgSurface
        : tokens.colors.bgOffWhite;

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        // Subtle scale-down on press mirrors the site's `.role-card:active`
        // transform: scale(0.98).
        style={({ pressed }) => [
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radii.l,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    overflow: "hidden",
  },
  padded: {
    paddingVertical: tokens.spacing.l,
    paddingHorizontal: tokens.spacing.l,
  },
});
