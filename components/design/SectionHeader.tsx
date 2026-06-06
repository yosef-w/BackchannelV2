import { tokens } from "@/constants/theme";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";

export interface SectionHeaderProps {
  /** Small uppercase label that appears above the title. */
  eyebrow?: string;
  /** Primary heading line (rendered in DM Serif Display regular). */
  title: string;
  /** Optional second line rendered in DM Serif Display italic, muted. The
   *  two-line "Welcome to / BackChannel." pattern from the site. */
  titleItalic?: string;
  /** Stack the eyebrow and title centred (default is left-aligned). */
  align?: "left" | "center";
  /** Heading size — `hero` is 44px, `title` is 32px. Defaults to `title`. */
  size?: "hero" | "title";
  style?: StyleProp<ViewStyle>;
}

/**
 * The signature "eyebrow + serif title (+ italic accent)" stack used across
 * the website's hero and section headers. Centralises the alignment and
 * spacing so every screen looks the same.
 */
export function SectionHeader({
  eyebrow,
  title,
  titleItalic,
  align = "left",
  size = "title",
  style,
}: SectionHeaderProps) {
  const variant = size === "hero" ? "heroSerif" : "titleSerif";
  const italicVariant = size === "hero" ? "heroSerifItalic" : "titleSerifItalic";

  return (
    <View
      style={[
        align === "center" && { alignItems: "center" },
        style,
      ]}
    >
      {eyebrow ? (
        <Text
          variant="eyebrow"
          align={align}
          style={{ marginBottom: tokens.spacing.m }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text variant={variant} align={align}>
        {title}
      </Text>
      {titleItalic ? (
        <Text variant={italicVariant} align={align}>
          {titleItalic}
        </Text>
      ) : null}
    </View>
  );
}
