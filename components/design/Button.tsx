import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "ghost" | "outline";
export type ButtonSize = "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing icon (typically an arrow ↗ for CTAs) */
  trailing?: ReactNode;
  /** Leading icon. */
  leading?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Make the button stretch to fill its parent. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Three flavours of button used throughout the redesign:
 *   primary — solid ink background, paper text (the main CTA)
 *   outline — paper background, ink border (secondary actions like Cancel)
 *   ghost   — transparent, muted text (tertiary, e.g. inline "Skip")
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  trailing,
  leading,
  disabled,
  loading,
  block,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles(size),
        variantStyles(variant),
        block && styles.block,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? tokens.colors.brandText : tokens.colors.text}
        />
      ) : (
        <View style={styles.row}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <Text
            variant={variant === "primary" ? "buttonPrimary" : "buttonGhost"}
            color={variantLabelColor(variant)}
          >
            {label}
          </Text>
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

function variantStyles(v: ButtonVariant): ViewStyle {
  switch (v) {
    case "primary":
      return {
        backgroundColor: tokens.colors.brand,
        borderWidth: 0,
      };
    case "outline":
      return {
        backgroundColor: tokens.colors.bg,
        borderWidth: tokens.borders.hairline,
        borderColor: tokens.colors.border,
      };
    case "ghost":
    default:
      return {
        backgroundColor: "transparent",
      };
  }
}

function variantLabelColor(v: ButtonVariant): string {
  switch (v) {
    case "primary":
      return tokens.colors.brandText;
    case "outline":
      return tokens.colors.text;
    case "ghost":
    default:
      return tokens.colors.textMuted;
  }
}

function sizeStyles(s: ButtonSize): ViewStyle {
  switch (s) {
    case "lg":
      return { paddingVertical: 16, paddingHorizontal: 24 };
    case "md":
    default:
      return { paddingVertical: 13, paddingHorizontal: 20 };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radii.m,
    alignItems: "center",
    justifyContent: "center",
  },
  block: { width: "100%" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leading: { marginRight: 2 },
  trailing: { marginLeft: 2 },
});
