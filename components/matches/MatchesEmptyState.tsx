import { Sparkles } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface MatchesEmptyStateProps {
  userType: "applicant" | "sponsor";
  /** Optional — e.g. jump to the daily deck / Jobs tab. Omitted when the caller has no navigation hook wired up yet. */
  actionLabel?: string;
  onPressAction?: () => void;
}

/**
 * The single empty state shown when every Matches group is empty — replaces
 * the old layout's problem of a brand-new user seeing five separate empty
 * sections stacked on top of each other before they've done anything.
 */
export function MatchesEmptyState({
  userType,
  actionLabel,
  onPressAction,
}: MatchesEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Sparkles size={28} color="#000" strokeWidth={1.75} />
      </View>
      <Text style={styles.title}>Nothing here yet</Text>
      <Text style={styles.subtitle}>
        {userType === "applicant"
          ? "Your matches, referrals, and sponsor interest will show up here as you connect with jobs."
          : "Applicant matches, sponsor requests, and your referral pipeline will show up here as they come in."}
      </Text>
      {!!actionLabel && !!onPressAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onPressAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#000", marginBottom: 6 },
  subtitle: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 19,
  },
  actionBtn: {
    marginTop: 20,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
