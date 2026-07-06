/**
 * ApplicantCheckInModal
 * Lets an applicant report their current stage on an active referral and
 * optionally leave a note for their sponsor.
 *
 * Wired to POST /api/referrals/<id>/checkin/ (PR #37, 2026-04-30).
 * Not dismissible by tapping outside; only exits via Submit / Close.
 */

import { Check } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    trackApplicantCheckInSubmitted,
    trackCheckInFailed,
} from "../lib/analytics/mixpanel";
import { ApplicantCheckInStage, submitApplicantCheckIn } from "../lib/api";
import { useToastStore } from "../stores/useToastStore";
import {
    getLocalCheckInTimes,
    saveLocalCheckInStage,
} from "../utils/checkInStageCache";
import { CheckInSheetShell } from "./checkin/CheckInSheetShell";

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
  /**
   * Fired right after a check-in successfully submits. This modal is opened
   * from a global header icon, decoupled from the Matches screen's own data
   * — without this, submitting a check-in while sitting on Matches wouldn't
   * refresh its (React Query-cached) pipeline list to show the new stage.
   */
  onSubmitted?: () => void;
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
/** Same "needs an update" window as the header badge / Matches nudge. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

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
  onSubmitted,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);
  const insets = useSafeAreaInsets();

  // Last locally-submitted check-in per referral — drives stale-first
  // ordering so the referral most in need of an update is the default
  // selection when the sheet opens.
  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (visible) getLocalCheckInTimes().then(setCheckInTimes);
  }, [visible]);

  const needsUpdate = (r: CheckInReferral) => {
    const created = Date.parse(r.createdAt || "");
    if (isNaN(created) || created > Date.now() - STALE_MS) return false;
    const lastCheckIn = Date.parse(checkInTimes[r.referralId] || "");
    return isNaN(lastCheckIn) || lastCheckIn <= Date.now() - STALE_MS;
  };

  // Active = not withdrawn. Backend rejects check-ins on withdrawn referrals.
  // Stale-first: the first (default-selected) referral is the one most in
  // need of an update, oldest first within that.
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

  const [activeReferralId, setActiveReferralId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Guided run-through session state: which referrals got an update since
  // the sheet opened, and how many were sent (for the final success frame).
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [sessionSentCount, setSessionSentCount] = useState(0);

  // Fresh session each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setUpdatedIds(new Set());
      setSessionSentCount(0);
    }
  }, [visible]);

  const fallbackReferral = activeReferrals[0] ?? null;

  const currentReferral = useMemo(() => {
    if (!activeReferralId) return fallbackReferral;
    return (
      activeReferrals.find((r) => r.referralId === activeReferralId) ??
      fallbackReferral
    );
  }, [activeReferralId, activeReferrals, fallbackReferral]);

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

  // Debug: inspect the exact referral payload and selected referral rendered
  // by this modal.
  useEffect(() => {
    if (!visible || !__DEV__) return;
    const filteredOutReferrals = referrals.filter(
      (r) => (r.status || "").toUpperCase() === "WITHDRAWN",
    );
    console.log("[ApplicantCheckInModal] referral debug", {
      totalReferrals: referrals.length,
      activeReferralsCount: activeReferrals.length,
      filteredOutCount: filteredOutReferrals.length,
      allStatuses: referrals.map((r) => ({
        referralId: r.referralId,
        status: r.status,
      })),
      activeReferralId,
      currentReferral,
      activeReferralSummaries: activeReferrals.map((r) => ({
        referralId: r.referralId,
        status: r.status,
        jobTitle: r.jobTitle,
        jobCompany: r.jobCompany,
        sponsorFirstName: r.sponsorFirstName,
        sponsorLastName: r.sponsorLastName,
      })),
      filteredOutSummaries: filteredOutReferrals.map((r) => ({
        referralId: r.referralId,
        status: r.status,
        jobTitle: r.jobTitle,
        jobCompany: r.jobCompany,
      })),
    });
  }, [
    visible,
    referrals.length,
    activeReferrals,
    activeReferralId,
    currentReferral,
  ]);

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
      trackApplicantCheckInSubmitted({
        referralId: currentReferral.referralId,
        stage: opt.stage,
        hasNote: note.trim().length > 0,
      });
      // Mirror locally so the Matches screen's pipeline timeline reflects
      // this update immediately — see checkInStageCache.ts for why this is
      // necessary until the backend returns stages on GET /api/referrals/.
      saveLocalCheckInStage(currentReferral.referralId, opt.stage);
      onSubmitted?.();

      // Guided run-through: with more referrals still un-updated this
      // session, advance to the next one instead of closing — an applicant
      // with 4 referrals previously had to reopen the sheet 4 times. The
      // sheet only closes (via the success frame) after the last one.
      const nextUpdated = new Set(updatedIds).add(currentReferral.referralId);
      setUpdatedIds(nextUpdated);
      const nextReferral = activeReferrals.find(
        (r) => !nextUpdated.has(r.referralId),
      );
      if (nextReferral) {
        showToast(
          `Update sent · ${activeReferrals.length - nextUpdated.size} more to go`,
          "success",
        );
        // The reset-on-referral-change effect clears status/note for the
        // next one.
        setActiveReferralId(nextReferral.referralId);
      } else {
        setSessionSentCount(nextUpdated.size);
        setSubmitted(true);
        // Auto-dismiss after the success animation plays
        setTimeout(() => {
          setSubmitted(false);
          onDismiss();
        }, 1600);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trackCheckInFailed({ role: "applicant", reason: msg || "unknown" });
      showToast(msg || "Failed to submit check-in. Try again.", "error");
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
      state={sheetState}
      loadingText="Loading your referrals…"
      emptyTitle="No active referrals"
      emptyText="You don't have any active referrals to update right now. Once a sponsor refers you, your pipeline will show up here."
      successTitle={sessionSentCount > 1 ? "All caught up!" : "Update Sent!"}
      successSubtitle={
        sessionSentCount > 1
          ? `${sessionSentCount} updates sent — your sponsors will be notified.`
          : currentReferral
            ? `${sponsorName(currentReferral)} will be notified of your progress.`
            : "Your sponsor will be notified."
      }
    >
      <ScrollView
              style={styles.mainScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(40, insets.bottom + 24) },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {/* Guided-session progress + referral picker (2+ referrals).
                  Pills tick off as updates are sent this session; still
                  tappable to jump around. */}
              {activeReferrals.length > 1 && (
                <>
                  <Text style={styles.progressText}>
                    Updating{" "}
                    {Math.min(updatedIds.size + 1, activeReferrals.length)} of{" "}
                    {activeReferrals.length}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pickerRow}
                  >
                    {activeReferrals.map((r) => {
                      const isActive = r.referralId === activeReferralId;
                      const isDone = updatedIds.has(r.referralId);
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
                          {isDone && (
                            <Check
                              color={isActive ? "#FFF" : "#000"}
                              size={12}
                              strokeWidth={3}
                            />
                          )}
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
                </>
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
                autoCapitalize="sentences"
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
    </CheckInSheetShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  mainScroll: {
    flex: 1,
  },

  // ── Picker (multi-referral) ────────────────────────────────────────────────
  // "Updating 2 of 4" — the guided session's position indicator.
  progressText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  pickerRow: {
    gap: 8,
    paddingBottom: 16,
  },
  pickerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    backgroundColor: "#F9F9F9",
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
});
