import * as Notifications from "expo-notifications";

/**
 * Retention reminders scheduled entirely on-device via expo-notifications'
 * LOCAL scheduling API — no backend push infrastructure required. The app
 * already manufactures a daily reason to open it (a fresh 10-card deck at
 * midnight local time — see HomeView's isSameDay cache check) but never
 * told anyone; these two reminders just say so.
 *
 * Both are best-effort: every call is wrapped so a scheduling failure (e.g.
 * permission revoked, OS quirk) never throws into a caller's flow.
 */

const DAILY_DECK_NOTIF_ID = "daily-deck-ready";
const UNFINISHED_DECK_NOTIF_ID = "unfinished-deck-reminder";

// 9am local time — well after the midnight deck refresh, and a normal
// "check your phone" hour so it doesn't read as spammy.
const DAILY_DECK_HOUR = 9;
const DAILY_DECK_MINUTE = 0;

// How long to wait before nudging about an unfinished deck. Long enough that
// it reads as "still there if you want it" rather than nagging a few
// minutes after they got distracted.
const UNFINISHED_DECK_DELAY_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Schedule (or reschedule, if the role-specific copy changed) the daily
 * "your deck is ready" local notification. Idempotent — safe to call every
 * time push permission is confirmed granted (e.g. on every app open).
 */
export async function scheduleDailyDeckReminder(
  userType: "applicant" | "sponsor",
) {
  try {
    // Cancel any existing schedule first so re-calling this (e.g. after a
    // role change) doesn't stack duplicate daily notifications under the
    // same identifier — scheduleNotificationAsync does not dedupe by id.
    await Notifications.cancelScheduledNotificationAsync(
      DAILY_DECK_NOTIF_ID,
    ).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_DECK_NOTIF_ID,
      content: {
        title:
          userType === "sponsor"
            ? "Your applicant deck is ready"
            : "Your fresh deck is ready",
        body:
          userType === "sponsor"
            ? "New applicants matched to your roles are waiting."
            : "10 new roles are waiting for you today.",
        data: { type: "daily_deck_ready" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_DECK_HOUR,
        minute: DAILY_DECK_MINUTE,
      },
    });
  } catch (err) {
    console.warn(
      "[localNotifications] Failed to schedule daily deck reminder:",
      err,
    );
  }
}

/** Cancel the daily deck reminder (e.g. on logout). */
export async function cancelDailyDeckReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      DAILY_DECK_NOTIF_ID,
    );
  } catch {
    // No-op if it was never scheduled.
  }
}

/**
 * Schedule a one-time nudge for later today if the user leaves with an
 * unfinished deck. Call when the app backgrounds; call
 * cancelUnfinishedDeckReminder() when the deck is completed or a fresh one
 * loads, so a finished deck never gets a stale "you have cards left" nudge.
 */
export async function scheduleUnfinishedDeckReminder(
  cardsRemaining: number,
  userType: "applicant" | "sponsor",
) {
  if (cardsRemaining <= 0) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(
      UNFINISHED_DECK_NOTIF_ID,
    ).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: UNFINISHED_DECK_NOTIF_ID,
      content: {
        title: "Pick up where you left off",
        body:
          userType === "sponsor"
            ? `${cardsRemaining} applicant${cardsRemaining === 1 ? "" : "s"} left in today's deck.`
            : `${cardsRemaining} role${cardsRemaining === 1 ? "" : "s"} left in today's deck.`,
        data: { type: "unfinished_deck" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: UNFINISHED_DECK_DELAY_SECONDS,
        repeats: false,
      },
    });
  } catch (err) {
    console.warn(
      "[localNotifications] Failed to schedule unfinished-deck reminder:",
      err,
    );
  }
}

/** Cancel the unfinished-deck nudge (deck finished, or a fresh one loaded). */
export async function cancelUnfinishedDeckReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      UNFINISHED_DECK_NOTIF_ID,
    );
  } catch {
    // No-op if it was never scheduled.
  }
}
