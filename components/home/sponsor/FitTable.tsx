// FitTable — applicant vs. your role, row by row (Figma iPhone 17-39). The
// sponsor's real question is "does this person line up with what I
// posted?", so each row puts their value beside the role's with a single
// status mark: ✓ match (go green), ↗ stretch (amber), nothing for a gap.
//
// facts.ts only emits rows where BOTH sides have data (DATA HONESTY RULE),
// so the table simply disappears when there's nothing comparable. Each row
// is one accessibility element read as a sentence.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, TrendingUp } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import type { FitRow, FitStatus, FitSummary } from "./model";

interface FitTableProps {
  fit: FitSummary;
  firstName: string;
}

const STATUS_WORD: Record<FitStatus, string> = {
  match: "matches",
  stretch: "a stretch",
  gap: "doesn't match",
};

function StatusMark({ status }: { status: FitStatus }) {
  if (status === "match") return <Check size={20} color={Colors.go} strokeWidth={2.25} />;
  if (status === "stretch") return <TrendingUp size={16} color={Colors.warning} strokeWidth={2.25} />;
  return null;
}

function Row({ row, firstName }: { row: FitRow; firstName: string }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${row.label}: ${firstName} ${row.applicantValue}, your role ${row.roleValue}, ${STATUS_WORD[row.status]}`}
    >
      <Text style={[styles.labelCol, styles.label]}>{row.label}</Text>
      <Text style={[styles.valueCol, styles.applicant]}>{row.applicantValue}</Text>
      <Text style={[styles.valueCol, styles.role]}>{row.roleValue}</Text>
      <View style={styles.statusCol}>
        <StatusMark status={row.status} />
      </View>
    </View>
  );
}

export function FitTable({ fit, firstName }: FitTableProps) {
  if (fit.rows.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.header} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.labelCol} />
        <Text style={[styles.valueCol, styles.colHead]}>{firstName.toUpperCase()}</Text>
        <Text style={[styles.valueCol, styles.colHead]}>YOUR ROLE</Text>
        <View style={styles.statusCol} />
      </View>
      {fit.rows.map((row) => (
        <Row key={row.key} row={row} firstName={firstName} />
      ))}
      <View style={styles.bottomRule} />
      {fit.stretchNote ? <Text style={styles.stretchNote}>{fit.stretchNote.toUpperCase()}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 24 },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingBottom: 10 },
  colHead: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    minHeight: 48,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  // 92 / 114 / 114 / 20 at 370pt — fixed label/status columns, flexible
  // value columns so narrow screens and large text wrap instead of clipping.
  labelCol: { width: 92 },
  valueCol: { flex: 1, minWidth: 0 },
  statusCol: { width: 20, alignItems: "center", paddingTop: 1 },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.muted,
  },
  applicant: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.ink,
  },
  role: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.body,
  },
  bottomRule: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  stretchNote: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.5,
    color: Colors.warning,
    marginTop: 16,
  },
});
