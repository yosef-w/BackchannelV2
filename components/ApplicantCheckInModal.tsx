/**
 * ApplicantCheckInModal
 * Lets an applicant report their current stage on an active referral and
 * optionally leave a note for their sponsor.
 *
 * Wired to POST /api/referrals/<id>/checkin/ (PR #37, 2026-04-30).
 * Not dismissible by tapping outside; only exits via Submit / Close.
 */

import { BlurView } from "expo-blur";
import { Check, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
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
import {
    ApplicantCheckInStage,
    submitApplicantCheckIn,
} from "../lib/api";
import { useToastStore } from "../stores/useToastStore";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CheckInReferral {
  referralId: string;
  jobTitle: string | null;
  jobCompany: string | null;
  sponsorFirstName: string | null;
  sponsorLastName: string | null;
  status: string; // "REFERRED" | "WITHDRAWN" | ...
  createdAt: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** All referrals the applicant has — withdrawn ones are filtered out internally. */
  referrals: CheckInReferral[];
  /** Optional: surface the loading state while parent is fetching referrals. */
  loading?: boolean;
}

// ── Stage data ────────────────────────────────────────────────────────────────
// Visual timeline stages (in order). Excludes the "ended" terminal value, which
// is rendered separately as the inactive timeline state.
const TIMELINE_STAGES: ApplicantCheckInStage[] = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
];

interface StatusOption {
  label: string;
  stage: ApplicantCheckInStage;
  /** Index into TIMELINE_STAGES, or -1 to indicate the pipeline ended. */
  stageIndex: number;
}

const STATUS_OPTIONS: StatusOption[] = [
  { label: "Still waiting to hear back", stage: "Referred", stageIndex: 0 },
  { label: "Had a recruiter screen", stage: "Recruiter Screen", stageIndex: 1 },
  {
    label: "Talking to the hiring manager",
    stage: "HM Interview",
    stageIndex: 2,
  },
  { label: "In final rounds", stage: "Final Round", stageIndex: 3 },
  { label: "Received an offer", stage: "Offer", stageIndex: 4 },
  { label: "Got hired!", stage: "Hired", stageIndex: 5 },
  {
    label: "Didn't move forward",
    stage: "Didn't move forward",
    stageIndex: -1,
  },
];

const NOTE_MAX = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

function sponsorName(r: CheckInReferral): string {
  const first = r.sponsorFirstName || "";
  const last = r.sponsorLastName || "";
  const full = `${first} ${last}`.trim();
  return full || "your sponsor";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ApplicantCheckInModal({
  visible,
  onDismiss,
  referrals,
  loading = false,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);

  // Active = not withdrawn. Backend rejects check-ins on withdrawn referrals.
  const activeReferrals = useMemo(
    () =>
      referrals.filter(
        (r) => (r.status || "").toUpperCase() !== "WITHDRAWN",
      ),
    [referrals],
  );

  const [activeReferralId, setActiveReferralId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const currentReferral = useMemo(() => {
    if (!activeReferralId) return null;
    return activeReferrals.find((r) => r.referralId === activeReferralId) ?? null;
  }, [activeReferralId, activeReferrals]);

  const activeStageIndex =
    selectedStatus !== null ? STATUS_OPTIONS[selectedStatus].stageIndex : 0;

  // Default the active referral to the first one whenever the modal opens or
  // the referral set changes.
  useEffect(() => {
    if (!visible) return;
    if (activeReferrals.length === 0) {
      setActiveReferralId(null);
      return;
    }
    if (
      !activeReferralId ||
      !activeReferrals.find((r) => r.referralId === activeReferralId)
    ) {
      setActiveReferralId(activeReferrals[0].referralId);
    }
  }, [visible, activeReferrals, activeReferralId]);

  // Reset transient state whenever the modal opens or the active referral changes
  useEffect(() => {
    if (!visible) return;
    setSelectedStatus(null);
    setNote("");
    setSubmitted(false);
  }, [visible, activeReferralId]);

  const handleSelect = (idx: number) => {
    setSelectedStatus(idx);
  };

  const handleClose = () => {
    if (submitting) return;
    onDismiss();
  };

  const handleSubmit = async () => {
    if (!currentReferral || selectedStatus === null) return;
    const opt = STATUS_OPTIONS[selectedStatus];
    try {
      setSubmitting(true);
      await submitApplicantCheckIn(currentReferral.referralId, opt.stage, note);
      setSubmitted(true);
      // Auto-dismiss after the success animation plays
      setTimeout(() => {
        setSubmitted(false);
        onDismiss();
      }, 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg || "Failed to submit check-in. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
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

          {/* Close button (always visible — modal is otherwise non-dismissible) */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={submitting}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X color="#666" size={20} strokeWidth={2} />
          </TouchableOpacity>

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
                {currentReferral
                  ? `${sponsorName(currentReferral)} will be notified of your progress.`
                  : "Your sponsor will be notified."}
              </Text>
            </Animated.View>
          ) : loading ? (
            /* ── Loading ─────────────────────────────────────────────────── */
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#000" />
              <Text style={styles.emptyText}>Loading your referrals…</Text>
            </View>
          ) : activeReferrals.length === 0 ? (
            /* ── Empty state ─────────────────────────────────────────────── */
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No active referrals</Text>
              <Text style={styles.emptyText}>
                You don&apos;t have any active referrals to update right now.
                Once a sponsor refers you, your pipeline will show up here.
              </Text>
              <TouchableOpacity
                style={styles.emptyDismissBtn}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyDismissBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Main content ────────────────────────────────────────────── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Referral picker (only shown when 2+ active referrals) */}
              {activeReferrals.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerRow}
                >
                  {activeReferrals.map((r) => {
                    const isActive = r.referralId === activeReferralId;
                    return (
                      <TouchableOpacity
                        key={r.referralId}
                        style={[
                          styles.pickerPill,
                          isActive && styles.pickerPillActive,
                        ]}
                        onPress={() => setActiveReferralId(r.referralId)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pickerPillText,
                            isActive && styles.pickerPillTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {r.jobCompany || "Referral"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Referral header */}
              {currentReferral && (
                <View style={styles.referralHeader}>
                  <View style={styles.companyPill}>
                    <Text style={styles.companyPillText}>
                      {currentReferral.jobCompany || "Company"}
                    </Text>
                  </View>
                  <Text style={styles.roleText}>
                    {currentReferral.jobTitle || "Referred role"}
                  </Text>
                  <Text style={styles.metaText}>
                    via {sponsorName(currentReferral)}
                    {(() => {
                      const d = daysSince(currentReferral.createdAt);
                      return d === null
                        ? ""
                        : ` · Referred ${d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`}`;
                    })()}
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* ── Timeline ───────────────────────────────────────────────── */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>CURRENT STAGE</Text>
                <View style={styles.timeline}>
                  {TIMELINE_STAGES.map((stage, idx) => {
                    const isInactive = activeStageIndex < 0;
                    const isCompleted = !isInactive && idx < activeStageIndex;
                    const isActive = !isInactive && idx === activeStageIndex;
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
                maxLength={NOTE_MAX}
                textAlignVertical="top"
              />

              {/* ── Submit button ────────────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (selectedStatus === null || submitting) &&
                    styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={selectedStatus === null || submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Submit Update</Text>
                    {selectedStatus !== null && (
                      <Check color="#FFF" size={18} strokeWidth={2.5} />
                    )}
                  </>
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
  closeButton: {
    position: "absolute",
    top: 16,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Picker (multi-referral) ────────────────────────────────────────────────
  pickerRow: {
    gap: 8,
    paddingBottom: 16,
  },
  pickerPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FAFAFA",
    maxWidth: 180,
  },
  pickerPillActive: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  pickerPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
  },
  pickerPillTextActive: {
    color: "#FFF",
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
    marginTop: 6,
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

  // ── Success / Loading / Empty states ────────────────────────────────────────
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
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 12,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyDismissBtn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: "#000",
  },
  emptyDismissBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
