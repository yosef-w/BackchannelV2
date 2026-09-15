import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local mirror of the context-aware message `POST /api/jobs/<id>/request-sponsor/`
 * returns at request time (e.g. "5 employees notified at Stripe"). The
 * backend doesn't persist or return this on `GET /api/jobs/waitlist/mine/`,
 * so without this cache the detail a user saw once in a toast is gone the
 * moment they navigate away — the exact "request → silence" experience the
 * UX audit flagged. Same pattern (and same limitation — this device only)
 * as checkInStageCache.ts.
 */
const STORAGE_KEY = "@bc/localSponsorRequestOutcomes";

type OutcomeMap = Record<string, { message: string; requestedAt: string }>;

async function readMap(): Promise<OutcomeMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Record the outcome message for a job's sponsor request. */
export async function saveSponsorRequestOutcome(
  jobId: string,
  message: string,
): Promise<void> {
  if (!jobId || !message) return;
  try {
    const map = await readMap();
    map[jobId] = { message, requestedAt: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort — a failed cache write just means the detail won't show
    // inline later; never block the request flow over it.
  }
}

/** Read the full jobId -> outcome map (empty object on any failure). */
export async function getSponsorRequestOutcomes(): Promise<OutcomeMap> {
  return readMap();
}

/**
 * Wipe this device's cache — call on logout/account deletion. This cache is
 * keyed only by jobId, with no user-scoping of its own, so without this a
 * different account logging into the same device would see whatever the
 * previous account's own sponsor requests last recorded, rendered as if it
 * were the result of their own request.
 */
export async function clearSponsorRequestCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort — see saveSponsorRequestOutcome.
  }
}
