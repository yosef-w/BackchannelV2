import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * Duplicate protection (sent-records): each scheduled nudge is recorded
 * locally as {checkpoint, firesAt} per referral. A checkpoint whose
 * recorded firesAt is in the past is treated as DELIVERED and never
 * re-fired — the referral advances to its next FUTURE checkpoint instead
 * (or goes quiet after the last one, falling back to the passive header
 * badge / Matches banner). Without this, every recompute (each app open,
 * sheet open, nudge tap) re-scheduled an unsatisfied past-due checkpoint
 * "+60s from now", re-notifying the user about the same referral until
 * they submitted a check-in.
 *
 * Tapping the notification just opens the existing check-in sheet for that
 * role — it doesn't deep-link to a specific referral, because the sheet
 * already knows how to triage everything that needs attention.
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

/** Delay before firing a past-due checkpoint discovered at recompute time
 * (first fetch after the mark, reinstall — cases where nothing was ever
 * scheduled for it). */
export const PAST_DUE_FIRE_DELAY_MS = 60 * 1000;

const NUDGE_NOTIF_ID = (role: "applicant" | "sponsor") =>
  `checkin-nudge-${role}`;

/**
 * referralId -> the checkpoint a nudge was scheduled for and the absolute
 * time it fires. firesAt <= now means it's already been delivered; firesAt
 * in the future means it's the currently-pending schedule (a recompute
 * re-anchors to it rather than resetting the countdown).
 */
export interface SentNudgeRecords {
  [referralId: string]: { checkpoint: number; firesAt: number };
}

const SENT_RECORDS_KEY = (role: "applicant" | "sponsor") =>
  `@bc/checkInNudgeSent_${role}`;

async function readSentRecords(
  role: "applicant" | "sponsor",
): Promise<SentNudgeRecords> {
  try {
    const raw = await AsyncStorage.getItem(SENT_RECORDS_KEY(role));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeSentRecords(
  role: "applicant" | "sponsor",
  records: SentNudgeRecords,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SENT_RECORDS_KEY(role), JSON.stringify(records));
  } catch {
    // Best-effort — a failed write means at worst one repeat nudge.
  }
}

interface NudgeableReferral {
  referralId: string;
  status: string;
  createdAt: string;
  jobCompany?: string | null;
}

/**
 * Earliest not-yet-satisfied cadence checkpoint for one referral, or null if
 * every checkpoint has already been covered by a local check-in.
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

/** First cadence checkpoint strictly in the future, or null past the last. */
function nextFutureCheckpoint(
  createdAtMs: number,
  now: number,
): number | null {
  for (const day of CADENCE_DAYS) {
    const checkpoint = createdAtMs + day * DAY_MS;
    if (checkpoint > now) return checkpoint;
  }
  return null;
}

export interface NudgePlan {
  /** Epoch ms the notification should fire at. */
  fireAt: number;
  title: string;
  body: string;
  /** Records to persist — pruned to current referrals, with the scheduled
   * checkpoint(s) stamped so they can't re-fire. */
  records: SentNudgeRecords;
}

/**
 * Pure planner: given the current referrals + local check-in state + the
 * sent-records, decide the single nudge to schedule (or null for none) and
 * the updated records to persist. Extracted from the scheduler so the
 * dedupe rules are unit-testable without notification/storage mocks.
 */
export function planCheckInNudge(
  role: "applicant" | "sponsor",
  referrals: NudgeableReferral[],
  checkInTimes: Record<string, string>,
  checkInStages: Record<string, string>,
  sentRecords: SentNudgeRecords,
  now: number = Date.now(),
): NudgePlan | null {
  const pending: {
    referralId: string;
    company: string;
    /** The cadence checkpoint this entry represents (grouping/copy). */
    at: number;
    /** When the notification should actually fire. */
    fireAt: number;
    pastDue: boolean;
  }[] = [];

  for (const r of referrals) {
    if ((r.status || "").toUpperCase() !== "REFERRED") continue;
    if (TERMINAL_STAGES.includes(checkInStages[r.referralId])) continue;

    const createdAtMs = Date.parse(r.createdAt || "");
    if (isNaN(createdAtMs)) continue;

    const lastCheckInRaw = checkInTimes[r.referralId]
      ? Date.parse(checkInTimes[r.referralId])
      : null;
    const lastCheckInMs =
      lastCheckInRaw !== null && !isNaN(lastCheckInRaw) ? lastCheckInRaw : null;

    let checkpoint = nextPendingCheckpoint(createdAtMs, lastCheckInMs);
    if (checkpoint === null) continue;

    let fireAt: number;
    let pastDue = false;

    if (checkpoint > now) {
      // Future checkpoint — fires at its absolute time. Recomputes converge
      // on the same instant, so cancel+reschedule can't drift or duplicate.
      fireAt = checkpoint;
    } else {
      pastDue = true;
      const rec = sentRecords[r.referralId];
      // A record covers its checkpoint AND everything before it: without a
      // check-in, nextPendingCheckpoint keeps returning day-3 forever, but
      // once the day-7 nudge has been delivered the day-3 one is implicitly
      // covered too — only a strictly LATER checkpoint is new.
      if (rec && rec.checkpoint >= checkpoint) {
        if (rec.firesAt > now) {
          // Still pending (this recompute's cancel may have just killed the
          // scheduled one) — re-anchor to the ORIGINAL fire time so the
          // countdown doesn't reset on every recompute.
          fireAt = rec.firesAt;
        } else {
          // Already delivered for this checkpoint — never repeat it. Move
          // on to the referral's next future checkpoint, if any.
          const next = nextFutureCheckpoint(createdAtMs, now);
          if (next === null) continue;
          checkpoint = next;
          fireAt = next;
          pastDue = false;
        }
      } else {
        // Newly-discovered past-due checkpoint (first fetch after the mark,
        // reinstall, …) — fire once, shortly after this recompute.
        fireAt = now + PAST_DUE_FIRE_DELAY_MS;
      }
    }

    pending.push({
      referralId: r.referralId,
      company: r.jobCompany || "a referral",
      at: checkpoint,
      fireAt,
      pastDue,
    });
  }

  // Prune records to referrals still in play so storage can't grow forever.
  const records: SentNudgeRecords = {};
  for (const p of pending) {
    const rec = sentRecords[p.referralId];
    if (rec) records[p.referralId] = rec;
  }

  if (pending.length === 0) {
    return null;
  }

  pending.sort((a, b) => a.fireAt - b.fireAt);
  const soonest = pending[0];

  // Group everything whose checkpoint lands the same calendar day as the
  // soonest — that's what the notification body describes, since they'll
  // all show up together in the sheet whenever the user opens it that day.
  const soonestDay = new Date(soonest.at).toDateString();
  const group = pending.filter(
    (p) => new Date(p.at).toDateString() === soonestDay,
  );

  // Stamp what this notification covers so it can never re-fire:
  //  - the scheduled (soonest) entry itself — future checkpoints included,
  //    since once its absolute time passes the OS has fired it;
  //  - every past-due member of the group — the aggregated copy ("N
  //    referrals need an update") covers them, so they must not each
  //    re-fire on the next recompute.
  for (const p of group) {
    if (p !== soonest && !p.pastDue) continue;
    records[p.referralId] = { checkpoint: p.at, firesAt: soonest.fireAt };
  }

  return {
    fireAt: soonest.fireAt,
    title:
      group.length === 1
        ? `${soonest.company} — time for a check-in`
        : `${group.length} referrals need a check-in update`,
    body:
      role === "sponsor"
        ? "See where they're at in the pipeline."
        : "Let us know where things stand.",
    records,
  };
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
    const sentRecords = await readSentRecords(role);
    const plan = planCheckInNudge(
      role,
      referrals,
      checkInTimes,
      checkInStages,
      sentRecords,
      now,
    );

    if (!plan) {
      // Nothing to nudge about — persist the pruned (empty) record map so
      // stale entries don't linger. Anything that later becomes past-due
      // fires once via the newly-discovered path.
      await writeSentRecords(role, {});
      return;
    }

    await writeSentRecords(role, plan.records);

    const delaySeconds = Math.max(1, Math.round((plan.fireAt - now) / 1000));

    await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: plan.title,
        body: plan.body,
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
