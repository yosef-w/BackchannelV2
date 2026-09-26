// PlanLedger — what changes when you join, as three corrections on a
// receipt. One column: the free value appears, a strike draws through
// it, and the member value stamps in beside it on the cinema engine's
// backOut, row by row. Docket hairlines, serif figures, no grid.
//
// The facts are honest to the product: free users already SEE sponsored
// roles in the marketplace; membership is about acting on them.

import React, { useEffect } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { backOut, easeOut, win } from "@/components/cinema/engine";
import { DAILY_LIKE_LIMITS } from "@/constants/config";
import { Colors, Fonts } from "@/constants/theme";

interface Row {
  key: string;
  from: string;
  to: string;
  /** Figures set in serif; words in sans. */
  numeric: boolean;
}

const ROWS: Row[] = [
  {
    key: "Interest, per day",
    from: String(DAILY_LIKE_LIMITS.free),
    to: String(DAILY_LIKE_LIMITS.premium),
    numeric: true,
  },
  { key: "Sponsor requests", from: "1", to: "Unlimited", numeric: false },
  { key: "Marketplace roles", from: "View", to: "View and act", numeric: false },
];

const ROW_MS = 720;
const STAGGER_MS = 140;

export function PlanLedger({
  style,
  onInk = false,
}: {
  style?: ViewStyle;
  /** Paper-on-ink palette for the gates' dark pitch zone. */
  onInk?: boolean;
}) {
  return (
    <View style={[styles.ledger, onInk && styles.ledgerInk, style]}>
      {ROWS.map((row, i) => (
        <LedgerRow key={row.key} row={row} index={i} onInk={onInk} />
      ))}
    </View>
  );
}

function LedgerRow({
  row,
  index,
  onInk,
}: {
  row: Row;
  index: number;
  onInk: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(
      160 + index * STAGGER_MS,
      withTiming(1, { duration: ROW_MS, easing: Easing.linear }),
    );
  }, [t, index, reduceMotion]);

  // Beats on one row clock: the row fades up, the old value shows, the
  // strike draws through it, then the new value lands.
  const rowStyle = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0, 0.3));
    return { opacity: p, transform: [{ translateY: (1 - p) * 6 }] };
  });
  const strike = useAnimatedStyle(() => ({
    width: `${easeOut(win(t.value, 0.34, 0.6)) * 100}%`,
  }));
  const fromStyle = useAnimatedStyle(() => ({
    opacity: 1 - win(t.value, 0.6, 0.9) * 0.45,
  }));
  const toStyle = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.62, 1));
    return { opacity: Math.min(1, p * 2), transform: [{ scale: 0.86 + p * 0.14 }] };
  });

  const fromNumeric = /^\d+$/.test(row.from);
  const toNumeric = /^\d+$/.test(row.to);

  return (
    <Animated.View style={[styles.row, onInk && styles.rowInk, rowStyle]}>
      <Text style={[styles.key, onInk && styles.keyInk]}>{row.key}</Text>
      <View style={styles.values}>
        <Animated.View style={[styles.fromWrap, fromStyle]}>
          <Text
            style={[
              fromNumeric ? styles.fromFigure : styles.fromWord,
              onInk && styles.fromInk,
            ]}
          >
            {row.from}
          </Text>
          <Animated.View
            style={[styles.strike, onInk && styles.strikeInk, strike]}
          />
        </Animated.View>
        <Text style={[styles.arrow, onInk && styles.arrowInk]}>→</Text>
        <Animated.Text
          style={[
            toNumeric ? styles.toFigure : styles.toWord,
            onInk && styles.toInk,
            toStyle,
          ]}
        >
          {row.to}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ledger: {
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  key: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14.5,
    color: Colors.ink,
    flexShrink: 1,
  },
  values: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 9,
    flexShrink: 0,
  },
  fromWrap: { position: "relative", justifyContent: "center" },
  fromFigure: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: Colors.faint,
  },
  fromWord: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.faint,
  },
  strike: {
    position: "absolute",
    left: -1,
    top: "52%",
    height: 1.5,
    backgroundColor: Colors.ink,
    opacity: 0.55,
  },
  arrow: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.faint,
  },
  toFigure: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  toWord: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.ink,
  },
  // ── Paper on ink ─────────────────────────────────────────────────────
  ledgerInk: { borderTopColor: "rgba(255,255,255,0.22)" },
  rowInk: { borderBottomColor: "rgba(255,255,255,0.12)" },
  keyInk: { color: "rgba(255,255,255,0.92)" },
  fromInk: { color: "rgba(255,255,255,0.45)" },
  strikeInk: { backgroundColor: Colors.paper, opacity: 0.5 },
  arrowInk: { color: "rgba(255,255,255,0.4)" },
  toInk: { color: Colors.paper },
});
