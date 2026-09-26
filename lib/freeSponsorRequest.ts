import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * "Your first sponsor request is on us" — the one marketplace action a free
 * applicant gets to take before the premium gate closes over the rest.
 *
 * Why a taste instead of a hard gate: browsing shows the marketplace's
 * value, but a sponsor request is the thing that actually *feels* like
 * something (a real person at that company hears about you). Letting the
 * first one through means the gate on the second is asking someone to
 * repeat an experience they've had, not to gamble on one they haven't.
 *
 * Source of truth is backend-first: every sponsor request also joins the
 * job's waitlist, so a non-empty GET /api/jobs/waitlist/mine/ already
 * proves the free one was used (survives reinstall/another device). This
 * local flag is the belt to that suspenders — it covers the window between
 * a successful request and the next waitlist fetch, and the case where the
 * waitlist fetch fails outright. Absent BOTH signals, the caller must treat
 * the free request as unknown (gate), never as available.
 */

const STORAGE_KEY = "@bc/freeSponsorRequestUsed";

export async function hasUsedFreeSponsorRequest(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    // Can't read → can't prove it's unused. Callers gate on true.
    return true;
  }
}

export async function markFreeSponsorRequestUsed(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
  } catch (err) {
    console.warn("[freeSponsorRequest] Failed to persist flag:", err);
  }
}
