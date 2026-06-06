import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type SpacingKey = keyof typeof tokens.spacing;

export interface StackProps {
  children: ReactNode;
  /** Vertical (VStack) or horizontal (HStack) layout. */
  direction?: "vertical" | "horizontal";
  /** Gap between children. Either a spacing-token key or a raw pixel number. */
  gap?: SpacingKey | number;
  /** Cross-axis alignment. */
  align?: "stretch" | "start" | "center" | "end";
  /** Main-axis alignment. */
  justify?: "start" | "center" | "end" | "between" | "around";
  /** Allow children to wrap (horizontal only — useful for pill rows). */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Layout primitive. Replaces the recurring `<View style={{ flexDirection, gap }}>`
 * pattern so screens stay short and consistent.
 */
export function Stack({
  children,
  direction = "vertical",
  gap = "m",
  align,
  justify,
  wrap,
  style,
}: StackProps) {
  const gapValue =
    typeof gap === "number" ? gap : tokens.spacing[gap];

  return (
    <View
      style={[
        {
          flexDirection: direction === "vertical" ? "column" : "row",
          gap: gapValue,
          alignItems: alignmentToFlex(align),
          justifyContent: justifyToFlex(justify),
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Convenience aliases
export const VStack = (props: Omit<StackProps, "direction">) => (
  <Stack direction="vertical" {...props} />
);
export const HStack = (props: Omit<StackProps, "direction">) => (
  <Stack direction="horizontal" {...props} />
);

function alignmentToFlex(a?: StackProps["align"]) {
  switch (a) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "stretch":
      return "stretch";
    default:
      return undefined;
  }
}

function justifyToFlex(j?: StackProps["justify"]) {
  switch (j) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "between":
      return "space-between";
    case "around":
      return "space-around";
    default:
      return undefined;
  }
}
