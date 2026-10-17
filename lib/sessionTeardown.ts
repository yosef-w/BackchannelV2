// Per-user state that lives on the DEVICE (AsyncStorage), keyed by nothing
// more specific than the role — so without this, it survives a logout and
// is inherited by whoever signs in on this phone next: the previous
// account's held likes get sent from the new account's paywall, its daily
// like cap is already spent, its "free sponsor request" is already used,
// its first-run Home intro plays, its check-in stages show, and — worst —
// its registered-but-unfinished-signup flag routes the new account into
// the old account's questionnaire on the next cold start (or makes a
// brand-new signup skip creating its account at all).
//
// One list, called from every "this session is over" path: manual logout,
// account deletion, abandoning sign-up, and the reactive session-expiry
// watcher in the tabs shell. Zustand stores and the React Query cache are
// reset by the callers (they're in-memory and some need the query client).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearDailyLikesUsed } from "@/lib/dailyLikeLimit";
import { clearFreeSponsorRequest } from "@/lib/freeSponsorRequest";
import { clearHeldLikes } from "@/lib/heldLikes";
import { HOME_INTRO_PENDING_KEY } from "@/lib/homeIntroPending";
import { clearLocalCheckInCache } from "@/utils/checkInStageCache";
import { clearOnboardingRegistered } from "@/utils/onboardingDraft";
import { clearSponsorRequestCache } from "@/utils/sponsorRequestCache";

export async function clearPerUserDeviceState(): Promise<void> {
  // Each helper swallows its own storage errors; the Promise.all here is
  // only so one slow write doesn't serialize the rest.
  await Promise.all([
    clearOnboardingRegistered(),
    AsyncStorage.removeItem(HOME_INTRO_PENDING_KEY).catch(() => {}),
    clearDailyLikesUsed(),
    clearHeldLikes(),
    clearFreeSponsorRequest(),
    clearLocalCheckInCache().catch(() => {}),
    clearSponsorRequestCache().catch(() => {}),
  ]);
}
