import { Award } from "@/components/ui/icons";
import type { Job } from "@/types/jobs";
import React, { useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ScreenContainer } from "../ui/ScreenContainer";
import { JobsEmptyState } from "./JobsEmptyState";
import { SponsoredJobCard } from "./SponsoredJobCard";
import { gridItemWidth, useResponsive } from "@/lib/responsive";
import { Colors } from "@/constants/theme";

// Horizontal gap between grid cells — vertical rhythm already comes from
// SponsoredJobCard's own `marginBottom`.
const GRID_GAP = 12;

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
  const { columns } = useResponsive();
  const [gridWidth, setGridWidth] = useState(0);
  const cardWidth =
    gridWidth > 0 ? gridItemWidth(gridWidth, columns, GRID_GAP) : undefined;

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
        icon={<Award size={28} color={Colors.ink} strokeWidth={2} />}
        title="Nothing sponsored yet"
        description="Sponsor a listing to unlock applicant profiles and get featured."
        actionText="Browse Jobs"
        onAction={onBrowse}
      />
    );
  }
  return (
    <ScreenContainer variant="wide">
      {/* The book's size, stated — same caps count line as Browse, and it
          gives the first card air below the tabs' rule. */}
      <Text style={styles.countLine} numberOfLines={1}>
        {myJobs.length} CARRYING YOUR NAME
      </Text>
      <View
        style={styles.grid}
        onLayout={(e: LayoutChangeEvent) =>
          setGridWidth(e.nativeEvent.layout.width)
        }
      >
        {myJobs.map((job, index) => (
          <Animated.View
            key={job.id}
            style={cardWidth ? { width: cardWidth } : styles.fullWidthItem}
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
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GRID_GAP,
  },
  fullWidthItem: { width: "100%" },
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
