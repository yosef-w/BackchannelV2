// StatsCard — the connector layout's identity + numbers card (Figma
// iPhone 17-38): name, current seat, a hairline, then a 2-column grid of
// the stats we actually have. No stats → no divider or grid (DATA HONESTY
// RULE); the identity lines still render.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { joinFacts } from "../dossierFacts";
import type { ApplicantFacts, StatCell } from "./model";

interface StatsCardProps {
  facts: ApplicantFacts;
  cells: StatCell[];
}

export function StatsCard({ facts, cells }: StatsCardProps) {
  const sub = joinFacts([facts.currentTitle, facts.currentCompany, facts.location]);
  const shown = cells.slice(0, 4);
  const rows: StatCell[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[facts.name, sub, ...shown.map((c) => `${c.label}: ${c.value}`)]
        .filter(Boolean)
        .join(". ")}
    >
      <Text style={styles.name}>{facts.name}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {rows.length > 0 ? (
        <>
          <View style={styles.divider} />
          {rows.map((row, i) => (
            <View key={i} style={[styles.row, i > 0 && styles.rowGap]}>
              {row.map((cell) => (
                <View key={cell.label} style={styles.cell}>
                  <Text style={styles.value}>{cell.value}</Text>
                  <Text style={styles.label}>{cell.label.toUpperCase()}</Text>
                </View>
              ))}
              {row.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
  },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.ink,
  },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  row: { flexDirection: "row", gap: 14 },
  rowGap: { marginTop: 22 },
  cell: { flex: 1, minWidth: 0 },
  value: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.ink,
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginTop: 4,
  },
});
