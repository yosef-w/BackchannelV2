/**
 * SponsorCheckInModal — the sponsor's referral triage, rebuilt on the
 * CheckInStack card engine (one candidate per card, tappable StageTrack,
 * Skip, recap) in place of the old inline-chips batch list.
 *
 * Accumulate mode: answers collect across cards and submit ONCE from the
 * recap via the existing batch endpoint (POST /api/referrals/checkin/batch/,
 * 50-update cap). Behavioral improvement over the old sheet: every explicit
 * answer is submitted — including "Referred" ("still in pipeline, no
 * movement") — where the old sheet only sent stages that *changed* from the
 * default, meaning a no-movement confirmation never refreshed the stale
 * tracking. Skipped cards send nothing, exactly as before.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  trackCheckInFailed,
  trackSponsorBatchCheckInSubmitted,
} from "@/lib/analytics/mixpanel";
import {
  SPONSOR_CHECKIN_STAGES,
  SponsorCheckInStage,
  submitSponsorBatchCheckIn,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import {
  getLocalCheckInTimes,
  saveLocalCheckInStages,
} from "@/utils/checkInStageCache";
import { CheckInSheetShell } from "./CheckInSheetShell";
import { CheckInStack, type StackCardItem } from "./CheckInStack";
import { daysSince, isStale, sortStaleFirst } from "./checkInSession";

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

/** Pipeline stages (in order); "No Longer Active" is the terminal exit. */
const TIMELINE_STAGES: SponsorCheckInStage[] = SPONSOR_CHECKIN_STAGES.filter(
  (s) => s !== "No Longer Active",
);
const TERMINAL_STAGE: SponsorCheckInStage = "No Longer Active";

/** Backend caps each batch request at 50 updates. We cap at the same number. */
const BATCH_LIMIT = 50;

function applicantName(r: SponsorCheckInReferral): string {
  const full = `${r.applicantFirstName || ""} ${r.applicantLastName || ""}`.trim();
  return full || "Applicant";
}

export function SponsorCheckInModal({
  visible,
  onDismiss,
  referrals,
  loading = false,
  onSubmitted,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);

  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (visible) getLocalCheckInTimes().then(setCheckInTimes);
  }, [visible]);

  // Session identity: remount the stack (fresh session state) each open.
  const [sessionKey, setSessionKey] = useState(0);
  useEffect(() => {
    if (visible) setSessionKey((k) => k + 1);
  }, [visible]);

  const items: StackCardItem[] = useMemo(() => {
    const active = referrals.filter(
      (r) => (r.status || "").toUpperCase() !== "WITHDRAWN",
    );
    return sortStaleFirst(active, checkInTimes).map((r) => {
      const d = daysSince(r.createdAt);
      const when =
        d === null
          ? ""
          : d === 0
            ? " · referred today"
            : ` · referred ${d} day${d === 1 ? "" : "s"} ago`;
      const role = r.jobTitle || "Role";
      const at = r.jobCompany ? ` at ${r.jobCompany}` : "";
      return {
        id: r.referralId,
        heading: applicantName(r),
        subheading: `${role}${at}`,
        meta: `You referred them${when}`,
        stale: isStale(r, checkInTimes),
      };
    });
  }, [referrals, checkInTimes]);

  const sheetState = loading
    ? ("loading" as const)
    : items.length === 0
      ? ("empty" as const)
      : ("content" as const);

  return (
    <CheckInSheetShell
      visible={visible}
      onClose={onDismiss}
      state={sheetState}
      heightFraction={0.78}
      loadingText="Loading your referrals…"
      emptyTitle="No active referrals"
      emptyText="You haven't referred anyone yet. Once you submit a referral, you can track and update its progress here."
      // Success frame unused — the stack's recap is the session exit.
      successTitle=""
      successSubtitle=""
    >
      <CheckInStack
        key={sessionKey}
        items={items}
        stages={TIMELINE_STAGES}
        terminalLabel={TERMINAL_STAGE}
        recapSubtitle={(n) =>
          n === 1
            ? "1 pipeline update ready to send."
            : `${n} pipeline updates ready to send.`
        }
        finalizeLabel={(n) =>
          n === 1 ? "Send 1 update" : `Send ${n} updates`
        }
        onFinalize={async (updates) => {
          // Backend rejects > 50 updates per call. Slice to the limit and
          // surface a toast if any changes were dropped (they'll be stale
          // again next pass).
          const mapped = updates.map((u) => ({
            referral_id: u.id,
            stage: u.terminal
              ? TERMINAL_STAGE
              : TIMELINE_STAGES[u.stageIndex],
          }));
          const toSubmit = mapped.slice(0, BATCH_LIMIT);
          const dropped = mapped.length - toSubmit.length;

          try {
            await submitSponsorBatchCheckIn(toSubmit);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            trackCheckInFailed({ role: "sponsor", reason: msg || "unknown" });
            showToast(msg || "Failed to save updates. Try again.", "error");
            throw err; // stay on the recap so nothing is lost
          }
          trackSponsorBatchCheckInSubmitted({ updateCount: toSubmit.length });
          // Mirror locally so the Matches screen's pipeline timeline reflects
          // these updates immediately — see checkInStageCache.ts for why this
          // is necessary until the backend returns stages on GET /api/referrals/.
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
        }}
        onDone={onDismiss}
      />
    </CheckInSheetShell>
  );
}
