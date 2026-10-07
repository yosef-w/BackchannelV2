// Connectivity state for the app — one hook, one wrapper around NetInfo.
//
// Same defensive-require pattern as components/ui/keyboard.tsx and
// lib/ratingPrompt.ts: a binary built before @react-native-community/netinfo
// existed gets a permanent "online" answer instead of crashing at import.
//
// "Offline" is deliberately conservative — only an explicit `false` counts.
// NetInfo reports `isInternetReachable: null` while it's still probing, and
// treating "don't know yet" as "offline" would flash a scary banner at every
// cold start.

import { useEffect, useState } from "react";

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};
type NetInfoModule = {
  addEventListener: (cb: (s: NetInfoState) => void) => () => void;
};

let NetInfo: NetInfoModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NetInfo = require("@react-native-community/netinfo").default ?? null;
} catch {
  NetInfo = null;
}

/** Pure rule, exported for tests: only an explicit "no" counts as offline. */
export function isOfflineFrom(state: NetInfoState): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/**
 * How long the connection has to stay down before we say so. A tunnel, an
 * elevator, or a Wi-Fi handoff drops the link for a second or two — a banner
 * that flickers on and off for every one of those is worse than none.
 */
export const OFFLINE_DEBOUNCE_MS = 2000;

/** True once the device has been offline for OFFLINE_DEBOUNCE_MS. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!NetInfo) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (isOfflineFrom(state)) {
        timer = setTimeout(() => setOffline(true), OFFLINE_DEBOUNCE_MS);
      } else {
        // Coming back is reported immediately — no reason to make someone
        // who's reconnected keep staring at "You're offline".
        setOffline(false);
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return offline;
}
