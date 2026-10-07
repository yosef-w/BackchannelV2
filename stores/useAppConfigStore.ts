import { create } from "zustand";
import {
  type AppConfig,
  NO_RESTRICTIONS,
  fetchAppConfig,
  readCachedAppConfig,
} from "@/lib/appConfig";

interface AppConfigState {
  config: AppConfig;
  /** Wall-clock of the last successful server fetch (throttles refreshes). */
  lastFetchedAt: number | null;
  /** Hydrate from cache, then refresh from the server. Safe to call often. */
  refresh: (opts?: { force?: boolean }) => Promise<void>;
}

/** Don't hit the endpoint on every foreground — 5 minutes is plenty for a
 * kill switch and keeps a chatty AppState from becoming request spam. */
export const REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

let hydrated = false;

export const useAppConfigStore = create<AppConfigState>((set, get) => ({
  config: NO_RESTRICTIONS,
  lastFetchedAt: null,

  refresh: async ({ force = false } = {}) => {
    // First call: show the cached config immediately so a bad-connection
    // cold start still honors a min_version we've already seen.
    if (!hydrated) {
      hydrated = true;
      const cached = await readCachedAppConfig();
      set({ config: cached });
    }
    const { lastFetchedAt } = get();
    if (
      !force &&
      lastFetchedAt !== null &&
      Date.now() - lastFetchedAt < REFRESH_MIN_INTERVAL_MS
    ) {
      return;
    }
    const fresh = await fetchAppConfig();
    // null = failed/404: keep what we have (cached or none) — never
    // replace a known restriction with "no restrictions" because of a
    // flaky request.
    if (fresh) set({ config: fresh, lastFetchedAt: Date.now() });
  },
}));

/** Server-controlled boolean flag with a caller-supplied default. */
export function useRemoteFlag(name: string, defaultValue: boolean): boolean {
  return useAppConfigStore((s) => s.config.flags[name] ?? defaultValue);
}
