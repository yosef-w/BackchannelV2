/**
 * SponsorCheckInModal
 * Lets a sponsor triage their active referral pipeline — update the stage for
 * each candidate they've referred inline, then submit all changes at once.
 *
 * Uses mock data — no backend integration yet.
 * Not dismissible by tapping outside; only exits via Submit / Close.
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
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    SlideInDown,
    SlideOutDown,
    ZoomIn,
} from "react-native-reanimated";

// ── Mock data ─────────────────────────────────────────────────────────────────
interface MockReferral {
  id: number;
  name: string;
  role: string;
  company: string;
  currentStatus: string;
  lastUpdatedDays: number;
}

const MOCK_REFERRALS: MockReferral[] = [
  {
    id: 0,
    name: "Jordan Ellis",
    role: "Frontend Engineer",
    company: "Stripe",
    currentStatus: "Referred",
    lastUpdatedDays: 9,
  },
  {
    id: 1,
    name: "Priya Nair",
    role: "Data Scientist",
    company: "Notion",
    currentStatus: "Recruiter Screen",
    lastUpdatedDays: 4,
  },
  {
    id: 2,
    name: "Daniel Kim",
    role: "Product Manager",
    company: "Linear",
    currentStatus: "HM Interview",
    lastUpdatedDays: 2,
  },
];

const INITIAL_STATUSES = MOCK_REFERRALS.map((r) => r.currentStatus);

const STATUS_STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
  "No Longer Active",
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function SponsorCheckInModal({ visible, onDismiss }: Props) {
  const [statuses, setStatuses] = useState<string[]>([...INITIAL_STATUSES]);
  const [submitted, setSubmitted] = useState(false);

  const hasChanges = statuses.some((s, i) => s !== INITIAL_STATUSES[i]);

  const handleSetStatus = (referralIdx: number, status: string) => {
    setStatuses((prev) => {
      const next = [...prev];
      next[referralIdx] = status;
      return next;
    });
  };

  const handleSubmit = () => {
    if (!hasChanges) {
      onDismiss();
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setStatuses([...INITIAL_STATUSES]);
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
              <Text style={styles.successTitle}>Updates Saved!</Text>
              <Text style={styles.successSubtitle}>
                Your referral statuses have been updated.
              </Text>
            </Animated.View>
          ) : (
            /* ── Main content ────────────────────────────────────────────── */
            <>
              {/* Sheet header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Referral Pipeline</Text>
                <Text style={styles.sheetSubtitle}>
                  Update the status on your active referrals
                </Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* ── Referral cards ───────────────────────────────────── */}
                {MOCK_REFERRALS.map((referral, rIdx) => (
                  <View key={referral.id} style={styles.referralCard}>
                    {/* Card header row */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.candidateName}>
                          {referral.name}
                        </Text>
                        <Text style={styles.candidateRole}>
                          {referral.role} at {referral.company}
                        </Text>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>
                            {statuses[rIdx]}
                          </Text>
                        </View>
                        <Text style={styles.lastUpdated}>
                          {referral.lastUpdatedDays}d ago
                        </Text>
                      </View>
                    </View>

                    {/* Inline status chips */}
                    <View style={styles.chipsRow}>
                      {STATUS_STAGES.map((stage) => {
                        const isSelected = statuses[rIdx] === stage;
                        return (
                          <TouchableOpacity
                            key={stage}
                            style={[
                              styles.statusChip,
                              isSelected && styles.statusChipSelected,
                            ]}
                            onPress={() => handleSetStatus(rIdx, stage)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                isSelected && styles.statusChipTextSelected,
                              ]}
                            >
                              {stage}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* ── Submit button ─────────────────────────────────────── */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    !hasChanges && styles.submitBtnNoChanges,
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.submitBtnText,
                      !hasChanges && styles.submitBtnTextNoChanges,
                    ]}
                  >
                    {hasChanges ? "Submit Updates" : "No Changes — Close"}
                  </Text>
                  {hasChanges && (
                    <Check color="#FFF" size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </ScrollView>
            </>
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
    paddingBottom: 44,
    maxHeight: "92%",
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
    marginBottom: 20,
  },

  // ── Sheet header ────────────────────────────────────────────────────────────
  sheetHeader: {
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },

  // ── Scroll content ──────────────────────────────────────────────────────────
  scrollContent: {
    gap: 12,
    paddingBottom: 8,
  },

  // ── Referral card ───────────────────────────────────────────────────────────
  referralCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 3,
  },
  candidateRole: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  cardHeaderRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    backgroundColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  lastUpdated: {
    fontSize: 10,
    color: "#BBB",
    fontWeight: "500",
  },

  // ── Status chips ────────────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  statusChipSelected: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  statusChipTextSelected: {
    color: "#FFF",
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
    marginTop: 8,
  },
  submitBtnNoChanges: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  submitBtnTextNoChanges: {
    color: "#555",
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
