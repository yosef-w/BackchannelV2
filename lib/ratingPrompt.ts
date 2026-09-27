// Ask for an App Store rating — at a moment the user just got value, and
// rarely enough that it never reads as nagging.
//
// iOS itself caps SKStoreReviewController to 3 system prompts per 365 days
// and silently ignores the rest, so calling it too often doesn't just annoy
// people — it burns the quota on a bad moment and the good ones get
// swallowed. This module spends that quota deliberately:
//   - only after a "happy" event (a first match, a confirmed referral),
//     never after an error or a gate,
//   - at most once per MIN_DAYS_BETWEEN_PROMPTS,
//   - at most MAX_LIFETIME_PROMPTS times ever,
//   - never in the first MIN_DAYS_SINCE_INSTALL days (an account that's a
//     day old hasn't formed an opinion worth a public star rating).
//
// Wrapped like components/ui/keyboard.tsx: the native module is require()d
// inside try/catch so a binary built before expo-store-review was added
// degrades to a no-op instead of crashing at import.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type RatingMoment = "first_match" | "referral_confirmed" | "match";

const STATE_KEY = "@bc/ratingPromptState";
const FIRST_SEEN_KEY = "@bc/ratingFirstSeenAt";

export const MIN_DAYS_BETWEEN_PROMPTS = 120;
export const MAX_LIFETIME_PROMPTS = 3;
export const MIN_DAYS_SINCE_INSTALL = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

interface RatingState {
  lastPromptedAt: number | null;
  promptCount: number;
}

let StoreReview: {
  isAvailableAsync: () => Promise<boolean>;
  requestReview: () => Promise<void>;
} | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  StoreReview = require("expo-store-review");
} catch {
  StoreReview = null;
}

async function readState(): Promise<RatingState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return { lastPromptedAt: null, promptCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      lastPromptedAt:
        typeof parsed.lastPromptedAt === "number" ? parsed.lastPromptedAt : null,
      promptCount: typeof parsed.promptCount === "number" ? parsed.promptCount : 0,
    };
  } catch {
    return { lastPromptedAt: null, promptCount: 0 };
  }
}

/** Stamp the first time this install saw the app (idempotent). Call at boot. */
export async function recordFirstSeen(now = Date.now()): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(FIRST_SEEN_KEY);
    if (!existing) await AsyncStorage.setItem(FIRST_SEEN_KEY, String(now));
  } catch {
    // Best-effort — worst case the install-age gate below reads "unknown"
    // and errs on the side of not asking.
  }
}

/**
 * Pure eligibility rule, split out so it's unit-testable without touching
 * storage or the native module.
 */
export function shouldPromptForRating(
  state: RatingState,
  firstSeenAt: number | null,
  now: number,
): boolean {
  if (firstSeenAt === null) return false; // unknown age → don't ask
  if (now - firstSeenAt < MIN_DAYS_SINCE_INSTALL * DAY_MS) return false;
  if (state.promptCount >= MAX_LIFETIME_PROMPTS) return false;
  if (
    state.lastPromptedAt !== null &&
    now - state.lastPromptedAt < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS
  ) {
    return false;
  }
  return true;
}

/**
 * Ask for a rating if (and only if) this is an appropriate moment. Always
 * safe to call — every failure path resolves quietly. Returns whether the
 * system prompt was requested.
 */
export async function maybeRequestReview(
  _moment: RatingMoment,
  now = Date.now(),
): Promise<boolean> {
  if (!StoreReview) return false;
  try {
    const [state, firstSeenRaw] = await Promise.all([
      readState(),
      AsyncStorage.getItem(FIRST_SEEN_KEY),
    ]);
    const firstSeenAt = firstSeenRaw ? Number(firstSeenRaw) : null;
    if (!shouldPromptForRating(state, firstSeenAt, now)) return false;
    if (!(await StoreReview.isAvailableAsync())) return false;

    // Record BEFORE asking: iOS gives no signal for whether the user rated,
    // dismissed, or the OS suppressed it, so we count the attempt itself.
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        lastPromptedAt: now,
        promptCount: state.promptCount + 1,
      }),
    );
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
