// Pure session logic for the check-in stack — ordering, progress
// bookkeeping, and the recap summary. Extracted from the UI so the rules
// both role sheets share are unit-testable without render or storage mocks.

/** Same "needs an update" window as the header badge / Matches nudge. */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SortableReferral {
  referralId: string;
  createdAt: string;
}

/** Whole days since an ISO timestamp, or null when unparseable. */
export function daysSince(iso: string, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / (24 * 60 * 60 * 1000)));
}

/**
 * A referral "needs an update" when it's 7+ days old AND this device hasn't
 * submitted a check-in for it within the last 7 days — identical rule to
 * the header badge and the Matches nudge banner, so every surface agrees.
 */
export function isStale(
  referral: SortableReferral,
  checkInTimes: Record<string, string>,
  now: number = Date.now(),
): boolean {
  const created = Date.parse(referral.createdAt || "");
  if (isNaN(created) || created > now - STALE_MS) return false;
  const lastCheckIn = Date.parse(checkInTimes[referral.referralId] || "");
  return isNaN(lastCheckIn) || lastCheckIn <= now - STALE_MS;
}

/**
 * Session order: referrals needing an update first (oldest first within
 * each group) — the user opened this sheet because something needs
 * attention, so that something leads.
 */
export function sortStaleFirst<T extends SortableReferral>(
  referrals: T[],
  checkInTimes: Record<string, string>,
  now: number = Date.now(),
): T[] {
  return [...referrals].sort((a, b) => {
    const staleDiff =
      Number(isStale(b, checkInTimes, now)) -
      Number(isStale(a, checkInTimes, now));
    if (staleDiff !== 0) return staleDiff;
    return (
      (Date.parse(a.createdAt || "") || 0) -
      (Date.parse(b.createdAt || "") || 0)
    );
  });
}

export type CardResult =
  | { kind: "updated"; stageIndex: number; terminal: boolean }
  | { kind: "skipped" };

export type SessionResults = Record<string, CardResult | undefined>;

/**
 * The next card index without a result, searching forward from `after`
 * (exclusive) and wrapping to the start — so skipped cards come back around
 * at the end of the pass. Null when every card has been handled.
 */
export function nextPendingIndex(
  ids: string[],
  results: SessionResults,
  after: number,
): number | null {
  const n = ids.length;
  for (let step = 1; step <= n; step++) {
    const idx = (after + step) % n;
    if (!results[ids[idx]]) return idx;
  }
  return null;
}

export interface SessionSummary {
  updated: number;
  skipped: number;
  total: number;
}

export function summarize(
  ids: string[],
  results: SessionResults,
): SessionSummary {
  let updated = 0;
  let skipped = 0;
  for (const id of ids) {
    const r = results[id];
    if (r?.kind === "updated") updated++;
    else if (r?.kind === "skipped") skipped++;
  }
  return { updated, skipped, total: ids.length };
}
