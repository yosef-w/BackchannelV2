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
  // Bumped on every run() call so an earlier, still-in-flight call's
  // outcome can tell it's been superseded by a newer one and skip updating
  // the shared status pill. Without this, two overlapping saves (e.g. two
  // fields autosaving in quick succession) could show whichever one
  // happens to SETTLE last — even if that's the one that actually failed
  // while a different, later save succeeded fine, or vice versa. This only
  // gates the shared visual status; each call's own promise still resolves
  // or rejects for its own caller regardless of generation.
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    const generation = ++generationRef.current;
    setStatus("saving");
    try {
      await fn();
      if (generation !== generationRef.current) return;
      setStatus("saved");
      clearTimer.current = setTimeout(() => {
        if (generation === generationRef.current) setStatus("idle");
      }, 1800);
    } catch (err) {
      if (generation === generationRef.current) {
        setStatus("error");
        clearTimer.current = setTimeout(() => {
          if (generation === generationRef.current) setStatus("idle");
        }, 2500);
      }
      throw err;
    }
  }, []);

  return { status, run };
}
