import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistent, calendar-day-scoped counter for "likes sent today," per role.
 *
 * Deliberately NOT built on useJobsStore's `sessionLikes` — that counter is
 * in-memory only and resets to 0 on `resetNavigation()`, which fires on
 * BOTH "Review again" and a successful premium purchase (HomeView's
 * `handleUnlockMoreCards`). A cap built on `sessionLikes` would let a user
 * reset their own limit just by tapping "unlock more"/"review again"
 * repeatedly. This counter survives all of that — and an app restart — by
 * living in AsyncStorage, keyed to the actual calendar date, the same
 * "roll over at local midnight" idiom HomeView's own daily-deck-cache check
 * already uses (see the isSameDay comment there).
 *
 * `sessionLikes` still exists and still drives the end-of-deck recap
 * card's "Interest sent" number — that's a per-session stat, a different
 * concern from this file's per-day cap. Both get incremented alongside
 * each other; neither replaces the other.
 */

interface DailyLikeRecord {
  /** Calendar date this count belongs to, as YYYY-MM-DD local time. */
  date: string;
  count: number;
}

const STORAGE_KEY = (role: "applicant" | "sponsor") =>
  `@bc/dailyLikesUsed_${role}`;

function todayKey(): string {
  const now = new Date();
  // Local calendar date, not UTC — matches HomeView's isSameDay check,
  // which compares getFullYear()/getMonth()/getDate() (local).
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

async function readRecord(
  role: "applicant" | "sponsor",
): Promise<DailyLikeRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY(role));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.count === "number" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeRecord(
  role: "applicant" | "sponsor",
  record: DailyLikeRecord,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY(role), JSON.stringify(record));
  } catch (err) {
    console.warn("[dailyLikeLimit] Failed to persist like count:", err);
  }
}

/**
 * How many likes this role has already sent today. Returns 0 (not the
 * stale count) once the calendar date has rolled over — the record is
 * treated as belonging to a day that's already over.
 */
export async function getDailyLikesUsed(
  role: "applicant" | "sponsor",
): Promise<number> {
  const record = await readRecord(role);
  if (!record || record.date !== todayKey()) return 0;
  return record.count;
}

/**
 * Record one more like sent today and return the new total. Handles the
 * day-rollover itself — if the stored record is from a previous day, this
 * starts back at 1 rather than incrementing a stale count.
 */
export async function incrementDailyLikesUsed(
  role: "applicant" | "sponsor",
): Promise<number> {
  const record = await readRecord(role);
  const today = todayKey();
  const next = record && record.date === today ? record.count + 1 : 1;
  await writeRecord(role, { date: today, count: next });
  return next;
}
