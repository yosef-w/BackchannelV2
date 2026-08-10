import { Award } from "@/components/ui/icons";
import type { Job } from "@/types/jobs";
import React from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { JobsEmptyState } from "./JobsEmptyState";
import { SponsoredJobCard } from "./SponsoredJobCard";
import { Colors } from "@/constants/theme";

interface SponsoredJobsTabProps {
  myJobs: Job[];
  isLoading: boolean;
  onBrowse: () => void;
  onPressJob: (job: Job) => void;
  onMenuJob: (job: Job) => void;
  onApplicantPress: (job: Job) => void;
}

/**
 * My Sponsored tab body — the sponsor's active listings with applicant
 * counts, or a loading / empty state. Extracted from JobsView.
 */
export function SponsoredJobsTab({
  myJobs,
  isLoading,
  onBrowse,
  onPressJob,
  onMenuJob,
  onApplicantPress,
}: SponsoredJobsTabProps) {
  if (isLoading && myJobs.length === 0) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="small" color={Colors.muted} />
        <Text style={styles.loadingText}>Loading your sponsored jobs...</Text>
      </Animated.View>
    );
  }
  if (myJobs.length === 0) {
    return (
      <JobsEmptyState
        icon={<Award size={28} color="#000" strokeWidth={2} />}
        title="Nothing sponsored yet"
        description="Sponsor a listing to unlock applicant profiles and get featured."
        actionText="Browse Jobs"
        onAction={onBrowse}
      />
    );
  }
  return (
    <>
      {/* The book's size, stated — same caps count line as Browse, and it
          gives the first card air below the tabs' rule. */}
      <Text style={styles.countLine} numberOfLines={1}>
        {myJobs.length} CARRYING YOUR NAME
      </Text>
      {myJobs.map((job, index) => (
        <Animated.View
          key={job.id}
          entering={FadeInUp.delay(250 + Math.min(index, 8) * 40).duration(
            300,
          )}
        >
          <SponsoredJobCard
            job={job}
            onPress={() => onPressJob(job)}
            onMenu={() => onMenuJob(job)}
            onApplicantPress={() => onApplicantPress(job)}
          />
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  countLine: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2,
    color: Colors.muted,
    marginTop: 20,
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: "600",
  },
});
