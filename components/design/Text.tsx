import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

// All canonical text roles in the redesign. Each maps to an entry in
// `tokens.typography`. Adding a new variant means adding a key here AND in
// theme.ts — keep them in lock-step.
export type TextVariant =
  | "heroSerif"
  | "heroSerifItalic"
  | "titleSerif"
  | "titleSerifItalic"
  | "sectionTitle"
  | "cardTitle"
  | "bodyLarge"
  | "body"
  | "bodySmall"
  | "bodyMuted"
  | "eyebrow"
  | "pillLabel"
  | "buttonPrimary"
  | "buttonGhost"
  | "meta";

export interface TextProps extends Omit<RNTextProps, "style"> {
  variant?: TextVariant;
  /** Optional colour override. Wins over the variant's default. */
  color?: string;
  /** Right-aligns the text. */
  align?: "left" | "center" | "right";
  /** Italicises a sans variant. No-op for serif italic variants. */
  italic?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/**
 * Canonical text component for the redesign. Use this everywhere instead of
 * raw `<Text>` so font-family, size, line-height and colour stay consistent
 * with the design tokens. Variants line up with the roles used on the
 * BackChannel beta site (heroSerif, eyebrow, body, etc.).
 */
export function Text({
  variant = "body",
  color,
  align,
  italic,
  style,
  ...rest
}: TextProps) {
  const base = tokens.typography[variant];

  // For sans variants, swap the family to its italic sibling when italic is
  // requested. Serif italic is already its own variant, so this is a no-op.
  const italicMap: Record<string, string> = {
    [tokens.fontFamilies.sans300]: tokens.fontFamilies.sans300Italic,
    [tokens.fontFamilies.sans400]: tokens.fontFamilies.sans400Italic,
    [tokens.fontFamilies.sans500]: tokens.fontFamilies.sans500Italic,
    [tokens.fontFamilies.sans600]: tokens.fontFamilies.sans600Italic,
    [tokens.fontFamilies.serif]: tokens.fontFamilies.serifItalic,
  };
  const fontFamily = italic
    ? (italicMap[base.fontFamily] ?? base.fontFamily)
    : base.fontFamily;

  return (
    <RNText
      style={[
        base as TextStyle,
        { fontFamily } as TextStyle,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

// Convenience exports for the most common roles so screens can `import { Eyebrow, Body } from "@/components/design/Text"`.
export const Eyebrow = (props: Omit<TextProps, "variant">) => (
  <Text variant="eyebrow" {...props} />
);
export const Body = (props: Omit<TextProps, "variant">) => (
  <Text variant="body" {...props} />
);
export const Meta = (props: Omit<TextProps, "variant">) => (
  <Text variant="meta" {...props} />
);

// Re-export StyleSheet for screens that just want a quick base
export const baseTextStyles = StyleSheet.create({
  sans: { fontFamily: tokens.fontFamilies.sans400 },
  serif: { fontFamily: tokens.fontFamilies.serif },
});
