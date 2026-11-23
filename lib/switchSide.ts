// switchSide — everything a change of side involves (docs/DUAL_SIDES.md).
//
// The whole app shows one side at a time, and nearly all of it keys off the
// single `userType` the tabs shell derives from the auth store's active
// role. So a switch is: flip that role, and make sure nothing from the old
// side survives into the new one. In order:
//
//   1. Refuse when it can't finish cleanly — offline (the new side would
//      load as a wall of errors), or profile edits that won't sync (they
//      would be lost, or worse, land on the other side's profile).
//   2. Push unsynced profile edits while requests still carry the OLD
//      side's X-Active-Role.
//   3. In ONE tick: cancel and drop the React Query cache (matches, threads
//      and counts are all per-side) and the jobs store (today's deck, the
//      sponsor's roles), then flip the active role — so no
//      request can be issued between the two with the old header and
//      cached under a key the new side reads.
//   4. Reset the profile store and refetch it for the new side.
//
// The tabs shell keys its navigator on the side, so every screen remounts
// with fresh local state; per-device caches are already keyed by role.
//
// `switchingTo` drives the shell's brief cover, so the swap reads as one
// deliberate beat instead of a flicker of emptied lists.

import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { trackSideSwitched } from "@/lib/analytics/mixpanel";
import { isOfflineNow } from "@/lib/network";
import { roleToUserType, sideLabel, type Role } from "@/lib/sides";
import { useAuthStore } from "@/stores/useAuthStore";
import { useJobsStore } from "@/stores/useJobsStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

interface SideSwitchState {
  /** The side being switched to, while a switch is in flight. */
  switchingTo: Role | null;
  /**
   * True once the backend has shown it understands dual sides (its profile
   * response carries a ROLES list). The "add a side" invitation only
   * appears then — a backend that predates the feature would just reject
   * the request, and an offer that can't be taken up shouldn't be made.
   */
  serverSupportsSides: boolean;
}

export const useSideSwitchStore = create<SideSwitchState>(() => ({
  switchingTo: null,
  serverSupportsSides: false,
}));

/** Long enough to read the cover's one line; short enough not to feel slow. */
const MIN_COVER_MS = 650;

export type SideSwitchSource = "switcher" | "account" | "notification" | "added";

/**
 * Make `role` the active side. Resolves true once the new side's profile
 * has loaded (or failed to — the screens own their error states). Resolves
 * false, with nothing changed, when the account doesn't hold that side,
 * it's already active, a switch is already running, or step 1 refused (a
 * toast says why).
 */
export async function switchSide(
  role: Role,
  queryClient: QueryClient,
  source: SideSwitchSource = "switcher",
): Promise<boolean> {
  const auth = useAuthStore.getState();
  if (auth.role === role || !auth.roles.includes(role)) return false;
  if (useSideSwitchStore.getState().switchingTo) return false;
  const toast = useToastStore.getState().showToast;

  // 1 — before the cover goes up, so a refusal doesn't flash it.
  if (await isOfflineNow()) {
    toast(`You're offline. Connect to switch to ${sideLabel(role)}.`, "error");
    return false;
  }

  useSideSwitchStore.setState({ switchingTo: role });
  const started = Date.now();
  try {
    // 2
    await useUserProfileStore
      .getState()
      .flushSyncNow()
      .catch(() => {});
    if (useUserProfileStore.getState().dirtyFields.size > 0) {
      toast(
        "Your latest profile changes haven't saved yet. Try switching again in a moment.",
        "error",
      );
      return false;
    }

    // 3 — nothing awaited between the clear and the flip.
    queryClient.cancelQueries().catch(() => {});
    queryClient.clear();
    // The deck, the sponsor's roles and the active role are all per side.
    useJobsStore.getState().reset();
    // updateProfile() routes its PATCH by this store's userType, which is
    // otherwise only set when a profile fetch succeeds — set it with the
    // flip so an edit made after a FAILED fetch can't go to the old side.
    useOnboardingStore.getState().setUserType(roleToUserType(role));
    await auth.switchRole(role);
    trackSideSwitched({ to: roleToUserType(role), source });

    // 4
    await useUserProfileStore.getState().clearData();
    await useUserProfileStore
      .getState()
      .fetchFromBackend()
      .catch(() => {});
    const remaining = MIN_COVER_MS - (Date.now() - started);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    return true;
  } finally {
    useSideSwitchStore.setState({ switchingTo: null });
  }
}
