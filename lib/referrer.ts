// Who invited this install? Captured when a universal/deep link like
// https://…/invite/<code> opens the app, held until signup completes so the
// "Sign Up Succeeded" analytics event can carry `referred_by`.
//
// Deliberately its own tiny module (no analytics import) so
// lib/analytics/mixpanel.ts can read it without a circular dependency.
//
// Attribution here is analytics-only: there's no backend field for it yet
// (docs/BACKEND_CHANGES_NEEDED.md §AC asks for one). That's still enough to
// answer the question that matters pre-launch — "is the invite loop
// producing signups, and from whom?" — straight from Mixpanel.
//
// First-touch wins: an install that was invited by A and later taps a link
// from B keeps A, so a referral can't be quietly reassigned.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@bc/pendingReferrer";

/** Codes are user ids in URLs. Anything else is rejected, never stored. */
export function isValidReferrerCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(code);
}

/** Remember who invited this install. Returns true if it was stored. */
export async function setPendingReferrer(code: unknown): Promise<boolean> {
  if (!isValidReferrerCode(code)) return false;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return false; // first touch wins
    await AsyncStorage.setItem(KEY, code);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingReferrer(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}
