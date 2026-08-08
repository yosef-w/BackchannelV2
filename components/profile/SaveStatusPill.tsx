import { Check } from "@/components/ui/icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { SaveStatus } from "./useAutosaveStatus";
import { Colors } from "@/constants/theme";

/** Header-slot indicator for the EditorScreen shell — renders nothing at idle. */
export function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return <ActivityIndicator size="small" color={Colors.muted} />;
  }
  if (status === "error") {
    return <Text style={styles.errorText}>Couldn&apos;t save</Text>;
  }
  return (
    <View style={styles.savedRow}>
      <Check size={13} color="#0A8A3E" strokeWidth={3} />
      <Text style={styles.savedText}>Saved</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  savedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { fontSize: 12, fontWeight: "700", color: "#0A8A3E" },
  errorText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
});
