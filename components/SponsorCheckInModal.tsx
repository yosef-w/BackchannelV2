/**
 * SponsorCheckInModal
 * Lets a sponsor triage their active referral pipeline — update the stage for
 * each candidate they've referred inline, then submit all changes at once via
 * the batch check-in endpoint.
 *
 * Wired to POST /api/referrals/checkin/batch/ (PR #37, 2026-04-30).
 * Not dismissible by tapping outside; only exits via Submit / Close.
 */

import { Check } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
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
import {
    getLocalCheckInTimes,
    saveLocalCheckInStages,
} from "../utils/checkInStageCache";
import { CheckInSheetShell } from "./checkin/CheckInSheetShell";

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
  /**
   * Fired right after a batch check-in successfully submits. This modal is
   * opened from a global header icon, decoupled from the Matches screen's
   * own data — without this, submitting while sitting on Matches wouldn't
   * refresh its (React Query-cached) pipeline list to show the new stages.
   */
  onSubmitted?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_STAGES = SPONSOR_CHECKIN_STAGES;

/**
 * Backend caps each batch request at 50 updates. We cap at the same number.
 */
const BATCH_LIMIT = 50;
/** Same "needs an update" window as the header badge / Matches nudge. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

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
  onSubmitted,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);
  const insets = useSafeAreaInsets();

  // Last locally-submitted check-in per referral — drives stale-first
  // sorting and the "needs update" marker below.
  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (visible) getLocalCheckInTimes().then(setCheckInTimes);
  }, [visible]);

  const needsUpdate = (r: SponsorCheckInReferral) => {
    const created = Date.parse(r.createdAt || "");
    if (isNaN(created) || created > Date.now() - STALE_MS) return false;
    const lastCheckIn = Date.parse(checkInTimes[r.referralId] || "");
    return isNaN(lastCheckIn) || lastCheckIn <= Date.now() - STALE_MS;
  };

  // Filter out withdrawn referrals — backend rejects check-ins on those.
  // The user opened this sheet because something needs attention, so
  // referrals needing an update sort first (oldest first within that).
  const activeReferrals = useMemo(
    () =>
      referrals
        .filter((r) => (r.status || "").toUpperCase() !== "WITHDRAWN")
        .sort((a, b) => {
          const staleDiff = Number(needsUpdate(b)) - Number(needsUpdate(a));
          if (staleDiff !== 0) return staleDiff;
          return (
            (Date.parse(a.createdAt || "") || 0) -
            (Date.parse(b.createdAt || "") || 0)
          );
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referrals, checkInTimes],
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
      // Mirror locally so the Matches screen's pipeline timeline reflects
      // these updates immediately — see checkInStageCache.ts for why this is
      // necessary until the backend returns stages on GET /api/referrals/.
      saveLocalCheckInStages(
        toSubmit.map((u) => ({ referralId: u.referral_id, stage: u.stage })),
      );
      onSubmitted?.();
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

  const sheetState = submitted
    ? ("success" as const)
    : loading
      ? ("loading" as const)
      : activeReferrals.length === 0
        ? ("empty" as const)
        : ("content" as const);

  return (
    <CheckInSheetShell
      visible={visible}
      onClose={handleClose}
      closeDisabled={submitting}
      state={sheetState}
      loadingText="Loading referrals…"
      emptyTitle="No active referrals"
      emptyText="You haven't submitted any referrals yet, or all of them have been withdrawn."
      successTitle="Updates Saved!"
      successSubtitle="Your referral statuses have been updated."
    >
      {/* Sheet header */}
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Referral Pipeline</Text>
        <Text style={styles.sheetSubtitle}>
          Update the status on your active referrals
        </Text>
      </View>

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
                    const stale = needsUpdate(referral);
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
                              <Text
                                style={[
                                  styles.lastUpdated,
                                  stale && styles.lastUpdatedStale,
                                ]}
                              >
                                {stale
                                  ? `needs update · ${days}d`
                                  : days === 0
                                    ? "today"
                                    : `${days}d ago`}
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
                      <ActivityIndicator color="#000" />
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
                          <Check color="#FFF" size={18} strokeWidth={2.5} />
                        )}
                      </>
                    )}
                  </TouchableOpacity>
      </ScrollView>
    </CheckInSheetShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

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
    flexGrow: 1,
    gap: 12,
    paddingBottom: 8,
  },
  mainScroll: {
    flex: 1,
  },

  // ── Referral card — system tokens (#F9F9F9/16, no shadow) ─────────────────
  referralCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 14,
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
  // "needs update · 12d" — the reason this card sorted to the top.
  lastUpdatedStale: {
    color: "#000",
    fontWeight: "800",
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

  // ── Success / Loading / Empty states ────────────────────────────────────────
});
