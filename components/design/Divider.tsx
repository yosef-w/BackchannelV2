import { tokens } from "@/constants/theme";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text";

export interface DividerProps {
  /** Optional centred label (matches the site's "or" divider). */
  label?: string;
  /** Horizontal margin override; defaults to 0. */
  marginH?: number;
  /** Vertical margin override; defaults to spacing.l. */
  marginV?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hairline divider. Renders a plain rule by default, or a labelled divider
 * (line — text — line) matching the website's `.or-divider`.
 */
export function Divider({
  label,
  marginH = 0,
  marginV = tokens.spacing.l,
  style,
}: DividerProps) {
  if (label) {
    return (
      <View
        style={[
          styles.labelRow,
          { marginVertical: marginV, marginHorizontal: marginH },
          style,
        ]}
      >
        <View style={styles.line} />
        <Text variant="meta" color={tokens.colors.textFaint}>
          {label}
        </Text>
        <View style={styles.line} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.rule,
        { marginVertical: marginV, marginHorizontal: marginH },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border,
  },
});
