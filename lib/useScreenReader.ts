// Whether a screen reader (VoiceOver / TalkBack) is running, kept live.
//
// Used to gate behavior that only makes sense for (or only hurts) screen-
// reader users: controls that are visually hidden but focusable, and timers
// that would dismiss UI before a slow swipe-through can reach it (WCAG 2.2.1).
// Defensive around AccessibilityInfo so it's a permanent `false` in jest and
// on any platform where the API is missing.

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    try {
      AccessibilityInfo.isScreenReaderEnabled?.()
        ?.then((v) => {
          if (mounted) setEnabled(!!v);
        })
        .catch(() => {});
      const sub = AccessibilityInfo.addEventListener?.(
        "screenReaderChanged",
        (v: boolean) => setEnabled(!!v),
      );
      return () => {
        mounted = false;
        sub?.remove?.();
      };
    } catch {
      return () => {
        mounted = false;
      };
    }
  }, []);
  return enabled;
}

/** One-shot read for non-render code (timers, handlers). */
export async function isScreenReaderOn(): Promise<boolean> {
  try {
    return !!(await AccessibilityInfo.isScreenReaderEnabled());
  } catch {
    return false;
  }
}
