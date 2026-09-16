import { AlertCircle, Check } from "@/components/ui/icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { SaveStatus } from "./useAutosaveStatus";
import { Colors } from "@/constants/theme";

/**
 * Header-slot indicator for the EditorScreen shell — renders nothing at
 * idle. Deliberately flat (no chip/pill background) rather than a filled
 * badge: matches StatusChip's house rule that passive status stays flat
 * text/icon and filled pills are reserved for a row's actionable button.
 * The name is historical (kept for the two call sites' import), not a
 * design requirement to render an actual pill shape.
 *
 * All three states share one row shape (icon + label, same size/weight)
 * so the indicator doesn't shift weight as it transitions between them.
 */
export function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.row}>
        <ActivityIndicator size="small" color={Colors.muted} />
        <Text style={[styles.label, { color: Colors.muted }]}>Saving…</Text>
      </Animated.View>
    );
  }
  if (status === "error") {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.row}>
        <AlertCircle size={13} color={Colors.danger} strokeWidth={2.5} />
        <Text style={[styles.label, { color: Colors.danger }]}>
          Couldn&apos;t save
        </Text>
      </Animated.View>
    );
  }
  return (
    // Soft entrance instead of a hard cut, and ink rather than the green
    // it used to be — the palette is deliberately achromatic and this was
    // the only green in the app.
    <Animated.View entering={FadeIn.duration(200)} style={styles.row}>
      <Check size={13} color={Colors.ink} strokeWidth={3} />
      <Text style={[styles.label, { color: Colors.ink }]}>Saved</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontSize: 12, fontWeight: "700" },
});
