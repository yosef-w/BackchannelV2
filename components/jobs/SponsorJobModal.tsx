import { X } from "@/components/ui/icons";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import type { Job } from "@/types/jobs";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { jobsModalStyles } from "./jobsModalStyles";
import { SponsorInsightCards } from "./SponsorInsightCards";
import { Colors, Type } from "@/constants/theme";

export interface SponsorFlowState {
  step: number;
  relationship: string | null;
  canRefer: boolean | null;
  isSponsoring: boolean;
  dayToDay: string;
  teamCulture: string;
  idealCandidate: string;
  insiderInsights: string;
}

interface SponsorJobModalProps {
  /** The browse job being sponsored — drives the success-step copy. */
  job: Job | null;
  flow: SponsorFlowState;
  onClose: () => void;
  onSetStep: (step: number) => void;
  onSetRelationship: (value: string) => void;
  onSetCanRefer: (value: boolean) => void;
  onSetDayToDay: (value: string) => void;
  onSetTeamCulture: (value: string) => void;
  onSetIdealCandidate: (value: string) => void;
  onSetInsiderInsights: (value: string) => void;
  onConfirm: () => void;
}

/**
 * Sponsor-an-existing-job wizard: 1) relationship + referral capability,
 * 2) insider insights (SponsorInsightCards), 3) success. Extracted from
 * JobsView; flow state stays owned by the caller and is threaded through
 * as props — same shape as the Matches SponsorRequestModal extraction.
 */
export function SponsorJobModal({
  job,
  flow,
  onClose,
  onSetStep,
  onSetRelationship,
  onSetCanRefer,
  onSetDayToDay,
  onSetTeamCulture,
  onSetIdealCandidate,
  onSetInsiderInsights,
  onConfirm,
}: SponsorJobModalProps) {
  const {
    step,
    relationship,
    canRefer,
    isSponsoring,
    dayToDay,
    teamCulture,
    idealCandidate,
    insiderInsights,
  } = flow;
  const isFormComplete = relationship !== null && canRefer !== null;

  return (
    <KeyboardAvoidingView
      style={jobsModalStyles.modalOverlay}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>
      <DismissibleSheet
        scrollDismiss
        onDismiss={onClose}
        style={[
          jobsModalStyles.modalContent,
          // Absolute px — a % maxHeight resolves against the sheet's
          // content-sized gesture-root wrapper and mis-measures.
          { maxHeight: Dimensions.get("window").height * 0.9 },
        ]}
      >
        <View style={jobsModalStyles.modalHeader}>
          <Text style={jobsModalStyles.modalMainTitle}>
            {step === 1
              ? "Confirm Sponsorship"
              : step === 2
                ? "Add Insider Insights"
                : "Sponsorship Active!"}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={jobsModalStyles.closeButton}
          >
            <X color="#000" size={24} />
          </TouchableOpacity>
        </View>
        {step === 1 ? (
          <>
            <View style={jobsModalStyles.insightsStepRow}>
              <View
                style={[
                  jobsModalStyles.stepDot,
                  jobsModalStyles.stepDotActive,
                  { width: 8 },
                ]}
              />
              <View style={jobsModalStyles.stepDot} />
              <Text style={jobsModalStyles.insightsStepLabel}>
                Step 1 of 2
              </Text>
            </View>
            <SheetScrollView>
              <Text style={jobsModalStyles.modalSubTitle}>
                Help us understand your role and referral capability
              </Text>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>
                  Your relationship to this role
                </Text>
                {["Hiring Manager", "Team Member", "Other"].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.radioOption}
                    onPress={() => onSetRelationship(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.radioLeft}>
                      <View
                        style={[
                          styles.radioCircle,
                          relationship === item && styles.radioCircleActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.radioText,
                          relationship === item && styles.radioTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>
                  Can you provide a referral?
                </Text>
                <View style={styles.sideBySide}>
                  <TouchableOpacity
                    style={styles.halfOption}
                    onPress={() => onSetCanRefer(true)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        canRefer === true && styles.radioCircleActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.radioText,
                        canRefer === true && styles.radioTextActive,
                      ]}
                    >
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.halfOption}
                    onPress={() => onSetCanRefer(false)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        canRefer === false && styles.radioCircleActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.radioText,
                        canRefer === false && styles.radioTextActive,
                      ]}
                    >
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SheetScrollView>
            <TouchableOpacity
              style={[
                jobsModalStyles.confirmBtn,
                !isFormComplete && jobsModalStyles.confirmBtnDisabled,
              ]}
              disabled={!isFormComplete}
              onPress={() => onSetStep(2)}
              activeOpacity={0.7}
            >
              <Text style={jobsModalStyles.confirmBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : step === 2 ? (
          <>
            <View style={jobsModalStyles.insightsStepRow}>
              <View
                style={[
                  jobsModalStyles.stepDot,
                  jobsModalStyles.stepDotActive,
                  { width: 8 },
                ]}
              />
              <View
                style={[
                  jobsModalStyles.stepDot,
                  jobsModalStyles.stepDotActive,
                ]}
              />
              <Text style={jobsModalStyles.insightsStepLabel}>
                Step 2 of 2
              </Text>
            </View>
            <SheetScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Text style={jobsModalStyles.modalSubTitle}>
                Share the inside story candidates can&apos;t find anywhere else.
                Every question is optional.
              </Text>

              <SponsorInsightCards
                values={{
                  dayToDay,
                  teamCulture,
                  idealCandidate,
                  insiderInsights,
                }}
                onChange={(key, text) => {
                  if (key === "dayToDay") onSetDayToDay(text);
                  else if (key === "teamCulture") onSetTeamCulture(text);
                  else if (key === "idealCandidate") onSetIdealCandidate(text);
                  else onSetInsiderInsights(text);
                }}
              />

              {/* Button sits at the end of the scroll content (not pinned)
                  so the sheet doesn't feel crowded — the sponsor scrolls
                  down to confirm once they're done. */}
              <TouchableOpacity
                style={[
                  jobsModalStyles.confirmBtn,
                  { marginTop: 24 },
                  isSponsoring && jobsModalStyles.confirmBtnDisabled,
                ]}
                disabled={isSponsoring}
                onPress={onConfirm}
                activeOpacity={0.7}
              >
                <Text style={jobsModalStyles.confirmBtnText}>
                  {isSponsoring ? "Sponsoring..." : "Confirm Sponsorship"}
                </Text>
              </TouchableOpacity>
            </SheetScrollView>
          </>
        ) : (
          <Animated.View entering={FadeIn} style={styles.successStep}>
            <ConfirmPop size={72} />
            <Text style={styles.successTitle}>Sponsorship Confirmed!</Text>
            <Text style={styles.successDesc}>
              You are now sponsoring {job?.title}. Applicants will be able to
              see your sponsorship.
            </Text>
            <TouchableOpacity
              style={jobsModalStyles.confirmBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={jobsModalStyles.confirmBtnText}>
                Back to Job Board
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  formSection: { marginBottom: 24 },
  halfOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.faint,
  },
  radioCircleActive: { borderColor: "#000", borderWidth: 6 },
  radioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  radioOption: {
    backgroundColor: Colors.offWhite,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  radioText: { fontSize: 15, color: Colors.body, fontWeight: "600" },
  radioTextActive: { color: "#000", fontWeight: "600" },
  sideBySide: { flexDirection: "row", gap: 12 },
  successDesc: {
    fontSize: 14,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  successStep: { alignItems: "center", paddingVertical: 20, width: "100%" },
  successTitle: { ...Type.heading, color: Colors.ink, marginBottom: 10 },
});
