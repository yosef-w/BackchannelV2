/**
 * ApplicantCheckInModal
 * Lets an applicant report their current stage on an active referral and
 * optionally leave a note for their sponsor.
 *
 * Uses mock data — no backend integration yet.
 * Not dismissible by tapping outside; only exits via Submit.
 */

import { BlurView } from "expo-blur";
import { Check } from "lucide-react-native";
import React, { useState } from "react";
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    SlideInDown,
    SlideOutDown,
    ZoomIn,
} from "react-native-reanimated";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_REFERRAL = {
  company: "Stripe",
  role: "Senior Product Designer",
  sponsor: "Marcus Webb",
  lastUpdatedDays: 14,
  initialStageIndex: 0, // "Referred"
};

const STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
];

const STATUS_OPTIONS = [
  { label: "Still waiting to hear back", stageIndex: 0 },
  { label: "Had a recruiter screen", stageIndex: 1 },
  { label: "Talking to the hiring manager", stageIndex: 2 },
  { label: "In final rounds", stageIndex: 3 },
  { label: "Received an offer", stageIndex: 4 },
  { label: "Didn't move forward", stageIndex: -1 },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function ApplicantCheckInModal({ visible, onDismiss }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(
    MOCK_REFERRAL.initialStageIndex,
  );
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (idx: number) => {
    setSelectedStatus(idx);
    setActiveStageIndex(STATUS_OPTIONS[idx].stageIndex);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      // Reset state for next open
      setSubmitted(false);
      setSelectedStatus(null);
      setActiveStageIndex(MOCK_REFERRAL.initialStageIndex);
      setNote("");
      onDismiss();
    }, 1600);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Non-dismissible blur backdrop */}
      <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.sheetWrapper}>
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={styles.sheet}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {submitted ? (
            /* ── Success state ───────────────────────────────────────────── */
            <Animated.View
              entering={ZoomIn.duration(320)}
              style={styles.successContainer}
            >
              <View style={styles.successCircle}>
                <Check color="#FFF" size={34} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>Update Sent!</Text>
              <Text style={styles.successSubtitle}>
                {MOCK_REFERRAL.sponsor} will be notified of your progress.
              </Text>
            </Animated.View>
          ) : (
            /* ── Main content ────────────────────────────────────────────── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Referral header */}
              <View style={styles.referralHeader}>
                <View style={styles.companyPill}>
                  <Text style={styles.companyPillText}>
                    {MOCK_REFERRAL.company}
                  </Text>
                </View>
                <Text style={styles.roleText}>{MOCK_REFERRAL.role}</Text>
                <Text style={styles.metaText}>
                  via {MOCK_REFERRAL.sponsor} · Last updated{" "}
                  {MOCK_REFERRAL.lastUpdatedDays} days ago
                </Text>
              </View>

              <View style={styles.divider} />

              {/* ── Timeline ───────────────────────────────────────────────── */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>CURRENT STAGE</Text>
                <View style={styles.timeline}>
                  {STAGES.map((stage, idx) => {
                    const isInactive = activeStageIndex < 0;
                    const isCompleted = !isInactive && idx < activeStageIndex;
                    const isActive = !isInactive && idx === activeStageIndex;
                    // Connector before this item is filled when idx <= activeStageIndex
                    const connectorFilled =
                      !isInactive && idx <= activeStageIndex;

                    return (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <View
                            style={[
                              styles.tConnector,
                              connectorFilled && styles.tConnectorFilled,
                            ]}
                          />
                        )}
                        <View style={styles.tItem}>
                          <View
                            style={[
                              styles.tDot,
                              isCompleted && styles.tDotFilled,
                              isActive && styles.tDotActive,
                              !isCompleted && !isActive && styles.tDotMuted,
                            ]}
                          >
                            {isActive && <View style={styles.tDotCore} />}
                          </View>
                          <Text
                            style={[
                              styles.tLabel,
                              isActive && styles.tLabelActive,
                              !isCompleted && !isActive && styles.tLabelMuted,
                            ]}
                            numberOfLines={2}
                          >
                            {stage}
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>

              <View style={styles.divider} />

              {/* ── Status options ──────────────────────────────────────────── */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
                {STATUS_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.statusRow,
                      selectedStatus === idx && styles.statusRowSelected,
                    ]}
                    onPress={() => handleSelect(idx)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radio,
                        selectedStatus === idx && styles.radioSelected,
                      ]}
                    >
                      {selectedStatus === idx && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.statusText,
                        selectedStatus === idx && styles.statusTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Note input ──────────────────────────────────────────────── */}
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note for your sponsor (optional)"
                placeholderTextColor="#BBB"
                multiline
                value={note}
                onChangeText={setNote}
                maxLength={300}
                textAlignVertical="top"
              />

              {/* ── Submit button ────────────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  selectedStatus === null && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={selectedStatus === null}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>Submit Update</Text>
                {selectedStatus !== null && (
                  <Check color="#FFF" size={18} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
    maxHeight: "90%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Referral header ─────────────────────────────────────────────────────────
  referralHeader: {
    gap: 6,
    marginBottom: 20,
  },
  companyPill: {
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  companyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  roleText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 20,
  },

  // ── Section block ───────────────────────────────────────────────────────────
  sectionBlock: {
    gap: 16,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ── Timeline ────────────────────────────────────────────────────────────────
  timeline: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tConnector: {
    flex: 0.55,
    height: 2,
    backgroundColor: "#E5E5E5",
    alignSelf: "flex-start",
    marginTop: 6, // align with center of 14px dot
  },
  tConnectorFilled: {
    backgroundColor: "#000",
  },
  tItem: {
    flex: 1,
    alignItems: "center",
  },
  tDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  tDotFilled: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  tDotActive: {
    borderColor: "#000",
    borderWidth: 2,
    backgroundColor: "#FFF",
  },
  tDotMuted: {
    borderColor: "#E5E5E5",
    backgroundColor: "#F5F5F5",
  },
  tDotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#000",
  },
  tLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    lineHeight: 11,
  },
  tLabelActive: {
    fontWeight: "800",
    color: "#000",
  },
  tLabelMuted: {
    color: "#C8C8C8",
  },

  // ── Status options ──────────────────────────────────────────────────────────
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 8,
  },
  statusRowSelected: {
    backgroundColor: "#F5F5F5",
    borderColor: "#000",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: "#000",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#000",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
    flex: 1,
  },
  statusTextSelected: {
    fontWeight: "700",
    color: "#000",
  },

  // ── Note input ──────────────────────────────────────────────────────────────
  noteInput: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    minHeight: 80,
    marginVertical: 16,
  },

  // ── Submit button ────────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#E0E0E0",
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Success state ────────────────────────────────────────────────────────────
  successContainer: {
    alignItems: "center",
    paddingVertical: 52,
    paddingHorizontal: 20,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});
