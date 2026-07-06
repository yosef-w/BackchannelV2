import * as Notifications from "expo-notifications";

/**
 * Per-referral check-in nudges, scheduled entirely on-device.
 *
 * Design constraint this exists to satisfy: a user can rack up many
 * referrals in a short window (multiple in one day, or spread across a
 * week), each on its own 3-day/weekly cadence. Scheduling one notification
 * PER referral per checkpoint would storm the user with pushes as volume
 * grows. Instead there is exactly one pending notification per role
 * ("applicant" / "sponsor") at any time — whichever checkpoint comes soonest
 * across all of that role's referrals — and its body is computed from how
 * many referrals share that checkpoint. Recompute + reschedule (cancel old,
 * schedule new, same idiom as lib/localNotifications.ts) any time referral
 * data changes: on fetch, and after a check-in is submitted.
 *
 * Tapping the notification just opens the existing check-in sheet for that
 * role (see MainApp's handlePushResponse) — it doesn't deep-link to a
 * specific referral, because the sheet already knows how to triage
 * everything that needs attention (needs-update sorting, batch queue).
 */

// Days after a referral's creation to check in: frequent early (while the
// pipeline is most likely to move), then weekly. After the last checkpoint,
// a referral goes quiet on notifications and falls back to the passive
// header badge / Matches nudge banner instead of repeat pushes.
const CADENCE_DAYS = [3, 7, 14, 21, 28, 35];

const DAY_MS = 24 * 60 * 60 * 1000;

// Must match PipelineStageTimeline.tsx's OFF_TRACK_VALUES and the terminal
// check used at MatchesView.tsx's staleReferrals filter — submitting one of
// these is the opt-out ("no longer in this job flow") that stops nudges.
const TERMINAL_STAGES = ["Didn't move forward", "No Longer Active"];

const NUDGE_NOTIF_ID = (role: "applicant" | "sponsor") =>
  `checkin-nudge-${role}`;

interface NudgeableReferral {
  referralId: string;
  status: string;
  createdAt: string;
  jobCompany?: string | null;
}

/**
 * Earliest not-yet-satisfied cadence checkpoint for one referral, or null if
 * every checkpoint has already been covered by a local check-in (or the
 * referral hasn't hit its first checkpoint's *creation* baseline at all,
 * which can't happen since createdAt is always in the past).
 */
function nextPendingCheckpoint(
  createdAtMs: number,
  lastCheckInMs: number | null,
): number | null {
  for (const day of CADENCE_DAYS) {
    const checkpoint = createdAtMs + day * DAY_MS;
    const satisfied = lastCheckInMs !== null && lastCheckInMs >= checkpoint;
    if (!satisfied) return checkpoint;
  }
  return null;
}

export async function scheduleCheckInNudges(
  role: "applicant" | "sponsor",
  referrals: NudgeableReferral[],
  checkInTimes: Record<string, string>,
  checkInStages: Record<string, string>,
) {
  try {
    const notifId = NUDGE_NOTIF_ID(role);
    await Notifications.cancelScheduledNotificationAsync(notifId).catch(
      () => {},
    );

    const now = Date.now();
    const pending: { referralId: string; company: string; at: number }[] = [];

    for (const r of referrals) {
      if ((r.status || "").toUpperCase() !== "REFERRED") continue;
      if (TERMINAL_STAGES.includes(checkInStages[r.referralId])) continue;

      const createdAtMs = Date.parse(r.createdAt || "");
      if (isNaN(createdAtMs)) continue;

      const lastCheckInMs = checkInTimes[r.referralId]
        ? Date.parse(checkInTimes[r.referralId])
        : null;

      const checkpoint = nextPendingCheckpoint(
        createdAtMs,
        isNaN(lastCheckInMs as number) ? null : lastCheckInMs,
      );
      if (checkpoint === null) continue;

      pending.push({
        referralId: r.referralId,
        company: r.jobCompany || "a referral",
        at: checkpoint,
      });
    }

    if (pending.length === 0) return;

    pending.sort((a, b) => a.at - b.at);
    const soonest = pending[0].at;

    // Group everything due the same calendar day as the soonest checkpoint —
    // that's what the notification body describes, since they'll all show up
    // together in the sheet whenever the user opens it that day.
    const soonestDay = new Date(soonest).toDateString();
    const sameDayCount = pending.filter(
      (p) => new Date(p.at).toDateString() === soonestDay,
    ).length;

    // A checkpoint already in the past (app was closed when it hit) still
    // needs to notify — fire shortly after this recompute rather than
    // silently skipping it.
    const delaySeconds = Math.max(60, Math.round((soonest - now) / 1000));

    await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title:
          sameDayCount === 1
            ? `${pending[0].company} — time for a check-in`
            : `${sameDayCount} referrals need a check-in update`,
        body:
          role === "sponsor"
            ? "See where they're at in the pipeline."
            : "Let us know where things stand.",
        data: { type: "checkin_nudge", role },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
      },
    });
  } catch (err) {
    console.warn(
      "[checkInNudges] Failed to schedule check-in nudge:",
      err,
    );
  }
}

export async function cancelCheckInNudges(role: "applicant" | "sponsor") {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      NUDGE_NOTIF_ID(role),
    );
  } catch {
    // No-op if it was never scheduled.
  }
}
