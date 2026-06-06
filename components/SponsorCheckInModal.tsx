/**
 * SponsorCheckInModal
 * Lets a sponsor triage their active referral pipeline — update the stage for
 * each candidate they've referred inline, then submit all changes at once via
 * the batch check-in endpoint.
 *
 * Wired to POST /api/referrals/checkin/batch/ (PR #37, 2026-04-30).
 * Not dismissible by tapping outside; only exits via Submit / Close.
 */

import { BlurView } from "expo-blur";
import { Check, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    trackCheckInFailed,
    trackSponsorBatchCheckInSubmitted,
} from "../lib/analytics/mixpanel";
import {
    SPONSOR_CHECKIN_STAGES,
    SponsorCheckInStage,
    submitSponsorBatchCheckIn,
} from "../lib/api";
import { useToastStore } from "../stores/useToastStore";
import { tokens } from "@/constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SponsorCheckInReferral {
  referralId: string;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
  status: string; // "REFERRED" | "WITHDRAWN" | ...
  createdAt: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** All referrals submitted by this sponsor — withdrawn ones are filtered out internally. */
  referrals: SponsorCheckInReferral[];
  /** Optional: surface the loading state while parent is fetching referrals. */
  loading?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_STAGES = SPONSOR_CHECKIN_STAGES;

/**
 * Backend caps each batch request at 50 updates. We cap at the same number.
 */
const BATCH_LIMIT = 50;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Helpers ───────────────────────────────────────────────────────────────────
function applicantName(r: SponsorCheckInReferral): string {
  const first = r.applicantFirstName || "";
  const last = r.applicantLastName || "";
  const full = `${first} ${last}`.trim();
  return full || "Applicant";
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

/**
 * Map the (uppercase) referral.status from listReferrals into the closest
 * sponsor check-in stage. Used as the initial value before the sponsor picks
 * an update.
 */
function initialStageFor(r: SponsorCheckInReferral): SponsorCheckInStage {
  const s = (r.status || "").toUpperCase();
  if (s === "REFERRED" || s === "ACTIVE") return "Referred";
  // Backend stores referrals in REFERRED/WITHDRAWN at row level; per-stage state
  // lives in matching.referral_checkins. We default to "Referred" here and let
  // the sponsor pick the latest known stage.
  return "Referred";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SponsorCheckInModal({
  visible,
  onDismiss,
  referrals,
  loading = false,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);
  const insets = useSafeAreaInsets();

  // Filter out withdrawn referrals — backend rejects check-ins on those.
  const activeReferrals = useMemo(
    () =>
      referrals.filter((r) => (r.status || "").toUpperCase() !== "WITHDRAWN"),
    [referrals],
  );

  // Map of referralId → currently selected stage. Initialised when the modal
  // becomes visible or when the referral list changes underneath.
  const [stageById, setStageById] = useState<
    Record<string, SponsorCheckInStage>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // (Re-)initialise the stage map whenever the modal opens or referrals change.
  useEffect(() => {
    if (!visible) return;
    const next: Record<string, SponsorCheckInStage> = {};
    for (const r of activeReferrals) {
      next[r.referralId] = initialStageFor(r);
    }
    setStageById(next);
    setSubmitted(false);
  }, [visible, activeReferrals]);

  /**
   * "Changed" = stage now differs from the initial value when the modal
   * opened. We compute initial values inline rather than tracking a separate
   * baseline state, since the baseline is deterministic from the referral row.
   */
  const changedUpdates = useMemo(() => {
    return activeReferrals
      .map((r) => {
        const initial = initialStageFor(r);
        const current = stageById[r.referralId];
        if (!current || current === initial) return null;
        return { referral_id: r.referralId, stage: current };
      })
      .filter(
        (u): u is { referral_id: string; stage: SponsorCheckInStage } =>
          u !== null,
      );
  }, [activeReferrals, stageById]);

  const hasChanges = changedUpdates.length > 0;

  const handleSetStatus = (referralId: string, stage: SponsorCheckInStage) => {
    setStageById((prev) => ({ ...prev, [referralId]: stage }));
  };

  const handleClose = () => {
    if (submitting) return;
    onDismiss();
  };

  const handleSubmit = async () => {
    if (!hasChanges) {
      onDismiss();
      return;
    }

    // Backend rejects > 50 updates per call. Slice to the limit and surface a
    // toast if any changes were dropped.
    const toSubmit = changedUpdates.slice(0, BATCH_LIMIT);
    const dropped = changedUpdates.length - toSubmit.length;

    try {
      setSubmitting(true);
      await submitSponsorBatchCheckIn(toSubmit);
      trackSponsorBatchCheckInSubmitted({ updateCount: toSubmit.length });
      if (dropped > 0) {
        showToast(
          `Updated ${toSubmit.length} referrals; ${dropped} more will need a second pass.`,
          "success",
        );
      }
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onDismiss();
      }, 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trackCheckInFailed({ role: "sponsor", reason: msg || "unknown" });
      showToast(msg || "Failed to save updates. Try again.", "error");
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
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(24, insets.bottom + 16),
              height:
                Platform.OS === "ios"
                  ? SCREEN_HEIGHT * 0.94
                  : SCREEN_HEIGHT * 0.92,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={submitting}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X color={tokens.colors.textBody} size={20} strokeWidth={2} />
          </TouchableOpacity>

          {submitted ? (
            /* ── Success state ───────────────────────────────────────────── */
            <Animated.View
              entering={ZoomIn.duration(320)}
              style={styles.successContainer}
            >
              <View style={styles.successCircle}>
                <Check color={tokens.colors.brandText} size={34} strokeWidth={3} />
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

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={tokens.colors.text} />
                  <Text style={styles.emptyText}>Loading referrals…</Text>
                </View>
              ) : activeReferrals.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No active referrals</Text>
                  <Text style={styles.emptyText}>
                    You haven&apos;t submitted any referrals yet, or all of them
                    have been withdrawn.
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
                <ScrollView
                  style={styles.mainScroll}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(40, insets.bottom + 24) },
                  ]}
                >
                  {/* ── Referral cards ───────────────────────────────────── */}
                  {activeReferrals.map((referral) => {
                    const currentStage =
                      stageById[referral.referralId] ??
                      initialStageFor(referral);
                    const days = daysSince(referral.createdAt);
                    return (
                      <View
                        key={referral.referralId}
                        style={styles.referralCard}
                      >
                        {/* Card header row */}
                        <View style={styles.cardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.candidateName}>
                              {applicantName(referral)}
                            </Text>
                            <Text style={styles.candidateRole}>
                              {referral.jobTitle || "Role"}
                              {referral.jobCompany
                                ? ` at ${referral.jobCompany}`
                                : ""}
                            </Text>
                          </View>
                          <View style={styles.cardHeaderRight}>
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusBadgeText}>
                                {currentStage}
                              </Text>
                            </View>
                            {days !== null && (
                              <Text style={styles.lastUpdated}>
                                {days === 0 ? "today" : `${days}d ago`}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Inline status chips */}
                        <View style={styles.chipsRow}>
                          {STATUS_STAGES.map((stage) => {
                            const isSelected = currentStage === stage;
                            return (
                              <TouchableOpacity
                                key={stage}
                                style={[
                                  styles.statusChip,
                                  isSelected && styles.statusChipSelected,
                                ]}
                                onPress={() =>
                                  handleSetStatus(referral.referralId, stage)
                                }
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
                    );
                  })}

                  {/* ── Submit button ─────────────────────────────────────── */}
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      !hasChanges && styles.submitBtnNoChanges,
                      submitting && styles.submitBtnNoChanges,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color={tokens.colors.text} />
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.submitBtnText,
                            !hasChanges && styles.submitBtnTextNoChanges,
                          ]}
                        >
                          {hasChanges
                            ? `Submit ${changedUpdates.length} Update${changedUpdates.length === 1 ? "" : "s"}`
                            : "No Changes — Close"}
                        </Text>
                        {hasChanges && (
                          <Check color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
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
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 12,
    paddingHorizontal: 28,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
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

  // ── Sheet header ────────────────────────────────────────────────────────────
  sheetHeader: {
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    fontWeight: "500",
  },

  // ── Scroll content ──────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 8,
  },
  mainScroll: {
    flex: 1,
  },

  // ── Referral card ───────────────────────────────────────────────────────────
  referralCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
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
    color: tokens.colors.text,
    marginBottom: 3,
  },
  candidateRole: {
    fontSize: 12,
    color: tokens.colors.textBody,
    fontWeight: "500",
  },
  cardHeaderRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.brandText,
    letterSpacing: 0.3,
  },
  lastUpdated: {
    fontSize: 10,
    color: tokens.colors.textFaint,
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
    backgroundColor: tokens.colors.bg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  statusChipSelected: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  statusChipTextSelected: {
    color: tokens.colors.brandText,
  },

  // ── Submit button ────────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: tokens.colors.brand,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  submitBtnNoChanges: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  submitBtnText: {
    color: tokens.colors.brandText,
    fontSize: 16,
    fontWeight: "700",
  },
  submitBtnTextNoChanges: {
    color: tokens.colors.textBody,
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
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: tokens.colors.textBody,
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
    color: tokens.colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyDismissBtn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: tokens.colors.brand,
  },
  emptyDismissBtnText: {
    color: tokens.colors.brandText,
    fontSize: 14,
    fontWeight: "700",
  },
});
