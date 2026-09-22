// ScreenContainer — a centered, width-capped column.
//
// On iPad every screen used to be the phone layout stretched edge to edge
// (976pt-wide buttons, ~130-character text lines on a 13"). Wrapping a
// screen's content in this — or spreading `contentColumn` / `formColumn`
// from lib/responsive into a ScrollView's contentContainerStyle — caps it
// and centers it. On phones the cap is wider than the screen, so nothing
// changes.
//
// It reads NO window size (pure max-width), so it is correct at every size
// including mid-rotation and mid-Split-View-drag.

import React from "react";
import { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import {
  contentColumn,
  formColumn,
  sheetColumn,
  wideColumn,
} from "@/lib/responsive";

const VARIANTS = {
  /** Reading/feed column — tab screens, hub, lists. */
  content: contentColumn,
  /** Form flows — auth, onboarding, questionnaires, editors. */
  form: formColumn,
  /** Dialogs and sheet bodies. */
  sheet: sheetColumn,
  /** Multi-column grids. */
  wide: wideColumn,
} as const;

interface ScreenContainerProps extends ViewProps {
  variant?: keyof typeof VARIANTS;
  style?: StyleProp<ViewStyle>;
}

export function ScreenContainer({
  variant = "content",
  style,
  children,
  ...rest
}: ScreenContainerProps) {
  return (
    <View {...rest} style={[VARIANTS[variant], style]}>
      {children}
    </View>
  );
}
