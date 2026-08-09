// Identity-scoped onboarding draft persistence, shared by the applicant and
// sponsor questionnaires.
//
// The original draft autosave stored answers under a bare key with no owner:
// an ABANDONED signup's draft silently hydrated into the NEXT signup on the
// same device — a fresh tester saw someone else's junk pre-filled in
// "position seeking", prompt answers, and work preferences, and it read as
// the app misbehaving (it looked like bad resume auto-fill).
//
// Every draft is now an envelope stamped with the signup email captured on
// the AuthScreen (the identity of THIS signup attempt) plus a timestamp:
//   - restore only when the current signup is for the same email — a new
//     signup session with any other identity discards the old draft on
//     sight, which also purges legacy un-stamped drafts;
//   - an age backstop discards drafts older than DRAFT_MAX_AGE_MS even for
//     the same email ("resume where I left off" is a same-day affordance,
//     not an archive);
//   - drafts are never written without an email to stamp them with, so
//     anonymous junk drafts can't be created in the first place.

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Same-email drafts older than this are stale, not "interrupted". */
export const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  email: string;
  savedAt: number;
  data: T;
}

const normalizeEmail = (email: string | undefined | null): string =>
  (email ?? "").trim().toLowerCase();

/**
 * Load the draft stored under `key` IF it belongs to the signup identified
 * by `currentEmail` and isn't stale. Any other draft found under the key —
 * different email, expired, legacy un-stamped shape, corrupt JSON — is
 * deleted from storage and null is returned, so the caller starts fresh.
 */
export async function loadOnboardingDraft<T>(
  key: string,
  currentEmail: string | undefined | null,
  now: number = Date.now(),
): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  const discard = async (): Promise<null> => {
    await AsyncStorage.removeItem(key).catch(() => {});
    return null;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return discard();
  }

  const envelope = parsed as Partial<DraftEnvelope<T>> | null;
  const email = normalizeEmail(currentEmail);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    typeof envelope.email !== "string" ||
    typeof envelope.savedAt !== "number" ||
    envelope.data === undefined ||
    !email ||
    normalizeEmail(envelope.email) !== email ||
    now - envelope.savedAt > DRAFT_MAX_AGE_MS
  ) {
    return discard();
  }

  return envelope.data as T;
}

/**
 * Persist `data` under `key`, stamped with the signup email. A missing/empty
 * email skips the write entirely — an unowned draft is exactly the bug this
 * module exists to prevent.
 */
export async function saveOnboardingDraft<T>(
  key: string,
  email: string | undefined | null,
  data: T,
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const envelope: DraftEnvelope<T> = {
    email: normalized,
    savedAt: Date.now(),
    data,
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope)).catch(() => {});
}

/** Delete the draft under `key` (signup completed or explicitly reset). */
export async function clearOnboardingDraft(key: string): Promise<void> {
  await AsyncStorage.removeItem(key).catch(() => {});
}

// ── Pending registration ────────────────────────────────────────────────
// Registration (and auth tokens) are issued at the very FIRST questionnaire
// step — the résumé step — specifically so an abandoned signup still has an
// account instead of losing the lead entirely. That means a user can be
// fully "authenticated" while their profile is still mostly empty. Without
// this flag, splash.tsx's "authenticated → dashboard" redirect can't tell
// the difference and drops them on the dashboard with a permanently
// half-filled profile the moment the app restarts mid-questionnaire —
// this flag is what lets splash send them back to finish instead.

const PENDING_ROLE_KEY = "@bc/onboardingPendingRole";

/** Registration succeeded but the questionnaire isn't finished yet. */
export async function markOnboardingRegistered(
  role: "applicant" | "sponsor",
): Promise<void> {
  await AsyncStorage.setItem(PENDING_ROLE_KEY, role).catch(() => {});
}

/** The questionnaire finished (or was explicitly abandoned) — clear it. */
export async function clearOnboardingRegistered(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ROLE_KEY).catch(() => {});
}

/** Which role, if any, has a registered-but-incomplete signup pending. */
export async function getPendingOnboardingRole(): Promise<
  "applicant" | "sponsor" | null
> {
  try {
    const value = await AsyncStorage.getItem(PENDING_ROLE_KEY);
    return value === "applicant" || value === "sponsor" ? value : null;
  } catch {
    return null;
  }
}
