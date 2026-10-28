// HeroLedger — the hero opening's decisive numbers, as a Docket ledger on
// paper directly under the photo card: two columns, hairline rows, caps
// keys over values (serif for figures, like PlanLedger and the Matches
// StatStrip). They used to live INSIDE the photo card as a frosted grid
// pinned to its bottom edge — which is exactly where HomeView's floating
// Pass/Connect pills are pinned too, so on a phone the pills covered the
// second row of stats. Moving them onto paper below a shorter photo puts
// the pills over whitespace instead, and the stats in the house style.
//
// DATA HONESTY RULE as before: no cells → nothing renders, no placeholder.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import type { StatCell } from "./model";

interface HeroLedgerProps {
  cells: StatCell[];
}

export function HeroLedger({ cells }: HeroLedgerProps) {
  const shown = cells.slice(0, 4);
  if (shown.length === 0) return null;
  const rows: StatCell[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));

  return (
    <View
      style={styles.ledger}
      accessible
      accessibilityLabel={shown.map((c) => `${c.label}: ${c.value}`).join(". ")}
    >
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((cell, j) => {
            const figure = /^\d/.test(cell.value.trim());
            return (
              <View key={cell.label} style={[styles.cell, j > 0 && styles.cellRule]}>
                <Text style={styles.label}>{cell.label.toUpperCase()}</Text>
                {/* Figures stay on one line; words may wrap to two ("Hybrid /
                    Remote / On-site") rather than truncate — the card
                    measures the ledger, so the photo gives the room. */}
                <Text
                  style={figure ? styles.figure : styles.word}
                  numberOfLines={figure ? 1 : 2}
                >
                  {cell.value}
                </Text>
              </View>
            );
          })}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ledger: {
    marginTop: 14,
    marginHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingRight: 10,
  },
  cellRule: {
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  figure: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.ink,
    marginTop: 3,
  },
  word: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
    marginTop: 5,
  },
});
