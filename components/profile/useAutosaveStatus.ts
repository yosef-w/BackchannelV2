// Shared autosave status for the profile editor screens. Wraps a save call
// with "saving" / "saved" / "error" states and auto-clears back to idle a
// couple seconds after a successful save, so the header's SaveStatusPill
// (see below) reads like a quiet confirmation rather than a persistent
// banner.

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus("saving");
    try {
      await fn();
      setStatus("saved");
      clearTimer.current = setTimeout(() => setStatus("idle"), 1800);
    } catch (err) {
      setStatus("error");
      clearTimer.current = setTimeout(() => setStatus("idle"), 2500);
      throw err;
    }
  }, []);

  return { status, run };
}
