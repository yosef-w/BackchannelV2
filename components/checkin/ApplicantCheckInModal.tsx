/**
 * ApplicantCheckInModal — the applicant's referral check-in, rebuilt on the
 * CheckInStack card engine (one referral per card, tappable StageTrack,
 * Skip, recap exit) in place of the old timeline-display + radio-list form.
 *
 * This file is now a thin role config: it maps referrals into stack cards
 * (stale-first) and wires the per-card submit to the SAME pipeline as
 * before — submitApplicantCheckIn per referral (the sponsor is notified per
 * update), Mixpanel tracking, the local stage/time mirror, and the
 * onSubmitted cache invalidation.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  trackApplicantCheckInSubmitted,
  trackCheckInFailed,
} from "@/lib/analytics/mixpanel";
import {
  ApplicantCheckInStage,
  submitApplicantCheckIn,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import {
  getLocalCheckInTimes,
  saveLocalCheckInStage,
} from "@/utils/checkInStageCache";
import { CheckInSheetShell } from "./CheckInSheetShell";
import { CheckInStack, type StackCardItem } from "./CheckInStack";
import { daysSince, isStale, sortStaleFirst } from "./checkInSession";

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

/** Visual pipeline stages (in order). The terminal "Didn't move forward"
 * is the StageTrack's separate exit affordance, not a node. */
const TIMELINE_STAGES: ApplicantCheckInStage[] = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
];

const TERMINAL_STAGE: ApplicantCheckInStage = "Didn't move forward";

function sponsorName(r: CheckInReferral): string {
  const full = `${r.sponsorFirstName || ""} ${r.sponsorLastName || ""}`.trim();
  return full || "your sponsor";
}

export function ApplicantCheckInModal({
  visible,
  onDismiss,
  referrals,
  loading = false,
  onSubmitted,
}: Props) {
  const showToast = useToastStore((s) => s.showToast);

  // Last locally-submitted check-in per referral — drives stale-first
  // ordering and the per-card "needs an update" tag.
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
      return {
        id: r.referralId,
        heading: r.jobCompany || "Company",
        subheading: r.jobTitle || "Referred role",
        meta: `via ${sponsorName(r)}${when}`,
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
      emptyText="You don't have any active referrals to update right now. Once a sponsor refers you, your pipeline will show up here."
      // Success frame unused — the stack's recap is the session exit.
      successTitle=""
      successSubtitle=""
    >
      <CheckInStack
        key={sessionKey}
        items={items}
        stages={TIMELINE_STAGES}
        terminalLabel={TERMINAL_STAGE}
        noteEnabled
        notePlaceholder="Add a note for your sponsor (optional)"
        recapSubtitle={(n) =>
          n === 1
            ? "Your sponsor will be notified of your progress."
            : `${n} updates sent — your sponsors will be notified.`
        }
        onSubmitCard={async (item, selection) => {
          const stage: ApplicantCheckInStage = selection.terminal
            ? TERMINAL_STAGE
            : TIMELINE_STAGES[selection.stageIndex];
          try {
            await submitApplicantCheckIn(item.id, stage, selection.note);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            trackCheckInFailed({ role: "applicant", reason: msg || "unknown" });
            showToast(msg || "Failed to submit check-in. Try again.", "error");
            throw err; // keep the card open
          }
          trackApplicantCheckInSubmitted({
            referralId: item.id,
            stage,
            hasNote: selection.note.length > 0,
          });
          // Mirror locally so the Matches screen's pipeline timeline reflects
          // this update immediately — see checkInStageCache.ts for why this
          // is necessary until the backend returns stages on GET /api/referrals/.
          saveLocalCheckInStage(item.id, stage);
          onSubmitted?.();
        }}
        onDone={onDismiss}
      />
    </CheckInSheetShell>
  );
}
