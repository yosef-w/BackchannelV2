// Remote app config — the "break glass" channel.
//
// OTA updates (EAS Update) can ship JS fixes, but they can't (a) tell an old
// native build "you're too old to talk to this backend", or (b) turn a
// misbehaving feature off in the seconds after you notice it. This does
// both, from the server, without a release:
//   - min_version:     builds below this see a blocking "please update" screen
//   - maintenance:     a message shown instead of the app during an incident
//   - flags:           named booleans (kill switches / gradual rollouts)
//
// FAIL-OPEN is the whole design. This endpoint being missing (it doesn't
// exist on the backend until docs/BACKEND_CHANGES_NEEDED.md §AB lands),
// slow, or returning garbage must NEVER lock a user out of the app — so every
// failure path resolves to "no restrictions". The last good response is
// cached, so a bad-connection cold start still honors a previously-seen
// min_version instead of forgetting it.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { API_BASE_URL } from "@/constants/config";

export interface AppConfig {
  /** Builds with a version below this are blocked behind an update screen. */
  minVersion: string | null;
  /** Non-null → show this instead of the app (incident / maintenance). */
  maintenanceMessage: string | null;
  /** Server-controlled feature flags. Absent key → caller's default. */
  flags: Record<string, boolean>;
}

export const NO_RESTRICTIONS: AppConfig = {
  minVersion: null,
  maintenanceMessage: null,
  flags: {},
};

const CACHE_KEY = "@bc/appConfigCache";
const FETCH_TIMEOUT_MS = 5000;

/**
 * Compare dotted numeric versions ("1.2.10" > "1.2.9"). Missing segments
 * count as 0, and any non-numeric segment is treated as 0 — a malformed
 * server value must degrade to "not older", never throw.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** True when `current` is strictly older than a non-empty `minVersion`. */
export function isUpdateRequired(
  current: string,
  minVersion: string | null,
): boolean {
  if (!minVersion) return false;
  return compareVersions(current, minVersion) < 0;
}

/**
 * Coerce an untrusted server payload into an AppConfig. Anything that isn't
 * exactly the expected shape is dropped rather than trusted.
 */
export function parseAppConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== "object") return NO_RESTRICTIONS;
  const r = raw as Record<string, unknown>;
  const flags: Record<string, boolean> = {};
  if (r.flags && typeof r.flags === "object") {
    for (const [k, v] of Object.entries(r.flags as Record<string, unknown>)) {
      if (typeof v === "boolean") flags[k] = v;
    }
  }
  return {
    minVersion:
      typeof r.min_version === "string" && r.min_version.trim()
        ? r.min_version.trim()
        : null,
    maintenanceMessage:
      typeof r.maintenance_message === "string" && r.maintenance_message.trim()
        ? r.maintenance_message.trim()
        : null,
    flags,
  };
}

/** The running build's marketing version (app.json "version"). */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

export async function readCachedAppConfig(): Promise<AppConfig> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? parseAppConfig(JSON.parse(raw)) : NO_RESTRICTIONS;
  } catch {
    return NO_RESTRICTIONS;
  }
}

/**
 * Fetch fresh config. Resolves to `null` (NOT a restriction) on any failure
 * so the caller keeps whatever it already had.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/api/app-config/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null; // 404 until the backend ships it — expected
    const json = await res.json();
    // Cache the RAW payload so parse rules can evolve without a migration.
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json)).catch(() => {});
    return parseAppConfig(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
