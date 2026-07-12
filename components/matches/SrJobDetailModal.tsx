import { AlertTriangle, ChevronLeft } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import {
    EnrichmentSkeleton,
    FooterButton,
    JobSheetHero,
    ReadMoreText,
    SheetFooter,
    SkeletonHero,
    StatRail,
} from "./JobSheetKit";
import { parseSkillsField } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

import type { SilverJobDetail } from "@/lib/api";

interface SrJobDetailModalProps {
  visible: boolean;
  loading: boolean;
  error: string | null;
  /** The prefetched/fetched silver job, or null before it loads. */
  detail: SilverJobDetail | null;
  onBack: () => void;
}

/**
 * Full role detail for the job a sponsor-request references — reached by
 * tapping "Tap to review this role" on the sponsor-request overview step.
 * JobSheetKit layout, but a DRILL-IN, not a destination: the viewer is the
 * would-be insider themself, so there's no insider card, and the pinned
 * action is the way back to the request.
 */
export function SrJobDetailModal({
  visible: _visible,
  loading,
  error,
  detail,
  onBack,
}: SrJobDetailModalProps) {
  const stats: { label: string; value: string }[] = [];
  if (detail) {
    if (detail.SALARY_ANNUAL_MIN && detail.SALARY_ANNUAL_MAX) {
      stats.push({
        label: "Salary",
        value:
          `$${Math.round(detail.SALARY_ANNUAL_MIN / 1000)}k – $${Math.round(detail.SALARY_ANNUAL_MAX / 1000)}k` +
          (detail.SALARY_CURRENCY && detail.SALARY_CURRENCY !== "USD"
            ? ` ${detail.SALARY_CURRENCY}`
            : ""),
      });
    }
    if (detail.EXPERIENCE_LEVEL)
      stats.push({ label: "Experience", value: detail.EXPERIENCE_LEVEL });
    if (detail.EMPLOYMENT_TYPES)
      stats.push({ label: "Type", value: detail.EMPLOYMENT_TYPES });
  }
  const skills = detail ? parseSkillsField(detail.SKILLS) : [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onBack}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onBack} style={modalStyles.modalContent}>
        {/* Header row — drill-in affordance back to the request. */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color="#000" />
          <Text style={styles.backText}>Back to Request</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={{ paddingBottom: 8 }}>
            <SkeletonHero />
            <View style={{ height: 20 }} />
            <EnrichmentSkeleton />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertTriangle size={32} color="#DC2626" />
            <Text style={styles.errorTitle}>Could not load role details</Text>
            <Text style={styles.errorSub}>{error}</Text>
          </View>
        ) : detail ? (
          <>
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <JobSheetHero
                logoUrl={
                  detail.organization_logo ||
                  detail.ORGANIZATION_LOGO ||
                  undefined
                }
                logoName={detail.ORGANIZATION}
                title={detail.TITLE || "Open Role"}
                company={detail.ORGANIZATION}
                location={detail.FULL_LOCATION || undefined}
                remote={!!detail.IS_REMOTE}
              />
              <View style={{ height: 12 }} />

              <StatRail stats={stats} />

              {/* Skills */}
              {skills.length > 0 && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>Skills</Text>
                  <View style={modalStyles.skillsRow}>
                    {skills.map((skill: string, idx: number) => (
                      <View key={idx} style={modalStyles.skillBadge}>
                        <Text style={modalStyles.skillBadgeText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Description — silver descriptions run LONG; collapse. */}
              {!!detail.DESCRIPTION_TEXT && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>
                    About the Role
                  </Text>
                  <ReadMoreText text={detail.DESCRIPTION_TEXT} />
                </View>
              )}
            </ScrollView>

            <SheetFooter>
              <FooterButton
                label="Back to Request"
                icon={<ChevronLeft size={18} color="#FFF" strokeWidth={2.5} />}
                onPress={onBack}
              />
            </SheetFooter>
          </>
        ) : null}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned footer; scrolls the overflow.
  scroll: { flexShrink: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 18,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
    marginTop: 12,
    textAlign: "center",
  },
  errorSub: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 19,
  },
});
