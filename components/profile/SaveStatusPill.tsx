import { Check } from "@/components/ui/icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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
    // Soft entrance instead of a hard cut, and ink rather than the green
    // it used to be — the palette is deliberately achromatic and this was
    // the only green in the app.
    <Animated.View entering={FadeIn.duration(200)} style={styles.savedRow}>
      <Check size={13} color={Colors.ink} strokeWidth={3} />
      <Text style={styles.savedText}>Saved</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  savedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  errorText: { fontSize: 11, fontWeight: "700", color: Colors.danger },
});
