import { tokens } from "@/constants/theme";
import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  /**
   * `paper` (default) — pure white, the editorial base for hero / detail screens.
   * `offWhite` — slightly warm grey, used for index / list / settings screens.
   * `surface` — strongest neutral, used for full-bleed grouped lists.
   */
  background?: "paper" | "offWhite" | "surface";
  /** Adds the standard horizontal page gutter. */
  padded?: boolean;
  /** Disables the safe-area inset on a specific edge (e.g. bottom when the
   *  screen has its own action bar that already insets). */
  edges?: ("top" | "right" | "bottom" | "left")[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Page-level wrapper. Handles safe-area insets, background colour and the
 * default horizontal gutter so every screen starts from the same baseline.
 */
export function Screen({
  children,
  background = "paper",
  padded = false,
  edges = ["top", "right", "bottom", "left"],
  style,
}: ScreenProps) {
  const bg =
    background === "paper"
      ? tokens.colors.bg
      : background === "offWhite"
        ? tokens.colors.bgOffWhite
        : tokens.colors.bgSurface;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: bg }, style]}
    >
      <View
        style={[
          styles.inner,
          padded && {
            paddingHorizontal: tokens.layout.screenPaddingH,
          },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
});
