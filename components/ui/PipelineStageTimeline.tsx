import React from "react";
import { StyleSheet, Text, View } from "react-native";

// Shared "on track" stage sequence — a superset of both
// APPLICANT_CHECKIN_STAGES and SPONSOR_CHECKIN_STAGES minus their
// respective terminal off-track values ("Didn't move forward" /
// "No Longer Active"), which get their own muted rendering instead of a
// dot position.
const CORE_STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
] as const;

const OFF_TRACK_VALUES = ["Didn't move forward", "No Longer Active"];

interface PipelineStageTimelineProps {
  /** The current stage, e.g. from a referral's checkInStage. Falls back to
   * "Referred" when absent — matching every referral's actual starting
   * state. */
  currentStage?: string | null;
}

/**
 * Compact horizontal stepper for a referral's pipeline stage — segments
 * fill up to the current stage, with the stage name as a label underneath.
 * Designed to sit inline on a referral list row (see MatchesView), not as
 * a full-screen visualization.
 */
export function PipelineStageTimeline({
  currentStage,
}: PipelineStageTimelineProps) {
  const stage = currentStage || "Referred";

  if (OFF_TRACK_VALUES.includes(stage)) {
    return (
      <View style={styles.offTrackRow}>
        <View style={styles.offTrackDot} />
        <Text style={styles.offTrackText}>{stage}</Text>
      </View>
    );
  }

  const currentIndex = Math.max(
    0,
    (CORE_STAGES as readonly string[]).indexOf(stage),
  );

  return (
    <View style={styles.container}>
      <View style={styles.segmentsRow}>
        {CORE_STAGES.map((s, i) => (
          <View
            key={s}
            style={[
              styles.segment,
              i <= currentIndex && styles.segmentFilled,
            ]}
          />
        ))}
      </View>
      <Text style={styles.stageLabel} numberOfLines={1}>
        {CORE_STAGES[currentIndex]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 6 },
  segmentsRow: {
    flexDirection: "row",
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#EDEDED",
  },
  segmentFilled: {
    backgroundColor: "#000",
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    marginTop: 4,
  },
  offTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  offTrackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#BBB",
  },
  offTrackText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
  },
});
