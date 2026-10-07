import AsyncStorage from "@react-native-async-storage/async-storage";
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
 *
 * Unlike the server-driven types in NotificationsScreen (match/message/
 * referral/etc — Apple 4.5.4-compliant because each is independently
 * toggleable), these two used to be mandatory: every push-granted user got
 * them with no way to turn them off short of disabling ALL notifications
 * in iOS Settings. `getDeckRemindersEnabled`/`setDeckRemindersEnabled` below
 * make them an explicit opt-out, surfaced as one combined toggle in
 * Settings ("Daily Deck Reminders") since a user thinks of the morning
 * "it's ready" nudge and the afternoon "you haven't finished it" nudge as
 * one feature, not two independent ones. Local-only by design — this is a
 * device-scheduling preference, not profile data, so there's nothing here
 * worth syncing to the backend.
 */

// LEGACY id: earlier builds scheduled ONE repeating DAILY trigger under this
// id, which fired every morning forever, even for someone who'd stopped
// opening the app months ago. It's now only ever cancelled (migrating
// existing installs off it); see scheduleDailyDeckReminder.
const DAILY_DECK_NOTIF_ID = "daily-deck-ready";
const dailyDeckNotifId = (dayOffset: number) =>
  `${DAILY_DECK_NOTIF_ID}-${dayOffset}`;
/** How many mornings ahead the reminder is armed. Re-armed on every app
 * open, so an active user never notices the window; a user who stops
 * opening the app hears from us for one more week, then not at all. */
export const DAILY_DECK_WINDOW_DAYS = 7;
const UNFINISHED_DECK_NOTIF_ID = "unfinished-deck-reminder";
const DECK_REMINDERS_PREF_KEY = "@bc/deckRemindersEnabled";

// 9am local time — well after the midnight deck refresh, and a normal
// "check your phone" hour so it doesn't read as spammy.
const DAILY_DECK_HOUR = 9;
const DAILY_DECK_MINUTE = 0;

// How long to wait before nudging about an unfinished deck. Long enough that
// it reads as "still there if you want it" rather than nagging a few
// minutes after they got distracted.
const UNFINISHED_DECK_DELAY_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Whether the user wants the daily/unfinished-deck reminders at all.
 * Defaults to true — matches the reminders' original always-on behavior,
 * so an existing user's notifications don't silently change; they now
 * have an explicit way to turn them off in Settings instead.
 */
export async function getDeckRemindersEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DECK_REMINDERS_PREF_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

/**
 * Persist the preference and, when turning reminders OFF, cancel whatever
 * is already scheduled immediately — so the toggle takes effect right
 * away rather than only applying to the next time something would have
 * been (re)scheduled.
 */
export async function setDeckRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DECK_REMINDERS_PREF_KEY, String(enabled));
  } catch (err) {
    console.warn(
      "[localNotifications] Failed to persist deck-reminders preference:",
      err,
    );
  }
  if (!enabled) {
    await cancelDailyDeckReminder();
    await cancelUnfinishedDeckReminder();
  }
}

/**
 * The next `days` reminder fire times: 9:00 local on consecutive mornings,
 * starting today only if 9:00 hasn't passed yet. Pure, so the window rule is
 * unit-testable without touching the notification API.
 */
export function nextDeckReminderDates(
  now: Date,
  days: number = DAILY_DECK_WINDOW_DAYS,
): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(now);
  cursor.setHours(DAILY_DECK_HOUR, DAILY_DECK_MINUTE, 0, 0);
  if (cursor.getTime() <= now.getTime()) cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < days; i++) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/**
 * Arm the "your deck is ready" reminder for the next DAILY_DECK_WINDOW_DAYS
 * mornings. Idempotent — call it every time push permission is confirmed
 * granted (every app open): each call cancels and re-arms the whole window,
 * which is what keeps the window rolling for an active user.
 *
 * Deliberately NOT a repeating DAILY trigger: that fires forever, including
 * for lapsed users who then learn to swipe the notification away and turn
 * every notification off (or delete the app). A bounded window trades that
 * for silence after a week of inactivity.
 */
export async function scheduleDailyDeckReminder(
  userType: "applicant" | "sponsor",
) {
  if (!(await getDeckRemindersEnabled())) return;
  try {
    // Clear the legacy repeating trigger AND any previous window first —
    // scheduleNotificationAsync does not dedupe by id, and a stale legacy
    // trigger would keep firing alongside the new ones.
    await cancelDailyDeckReminder();

    const content = {
      title:
        userType === "sponsor"
          ? "Your applicant deck is ready"
          : "Your fresh deck is ready",
      body:
        userType === "sponsor"
          ? "New applicants matched to your roles are waiting."
          : "New roles are waiting for you today.",
      data: { type: "daily_deck_ready" },
    };
    const dates = nextDeckReminderDates(new Date());
    await Promise.all(
      dates.map((date, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: dailyDeckNotifId(i),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
          },
        }),
      ),
    );
  } catch (err) {
    console.warn(
      "[localNotifications] Failed to schedule daily deck reminder:",
      err,
    );
  }
}

/** Cancel the daily deck reminder: the whole window plus the legacy
 * repeating trigger (e.g. on logout, or when the user turns it off). */
export async function cancelDailyDeckReminder() {
  const ids = [
    DAILY_DECK_NOTIF_ID,
    ...Array.from({ length: DAILY_DECK_WINDOW_DAYS }, (_, i) =>
      dailyDeckNotifId(i),
    ),
  ];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {
        // No-op if it was never scheduled.
      }),
    ),
  );
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
  if (!(await getDeckRemindersEnabled())) return;
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
