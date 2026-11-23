// sides — the vocabulary for "one account, two sides" (docs/DUAL_SIDES.md).
//
// An account can hold a sponsor side, a job-search (applicant) side, or
// both. The wire format and the auth store call these ROLES ("Applicant" /
// "Sponsor", capitalized — what the backend sends); the UI's `userType` is
// the lowercase form. Everything that converts between them, names a side
// for a person, or decides what the account may do next lives here, pure,
// so the screens stay presentational.

export type Role = "Applicant" | "Sponsor";
export type UserType = "applicant" | "sponsor";

export const ALL_ROLES: readonly Role[] = ["Sponsor", "Applicant"];

export function roleToUserType(role: Role): UserType {
  return role === "Sponsor" ? "sponsor" : "applicant";
}

export function userTypeToRole(userType: UserType): Role {
  return userType === "sponsor" ? "Sponsor" : "Applicant";
}

export function otherRole(role: Role): Role {
  return role === "Sponsor" ? "Applicant" : "Sponsor";
}

export function isRole(value: unknown): value is Role {
  return value === "Applicant" || value === "Sponsor";
}

/**
 * Normalize whatever the backend (or storage) hands back into a clean,
 * de-duplicated list in a stable order. Accepts either casing so a
 * lowercase `roles` array from a future endpoint still parses.
 */
export function parseRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<Role>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const lower = item.trim().toLowerCase();
    if (lower === "sponsor") seen.add("Sponsor");
    else if (lower === "applicant") seen.add("Applicant");
  }
  return ALL_ROLES.filter((r) => seen.has(r));
}

/** Short name for a side, as a person would say it. */
export function sideLabel(role: Role): string {
  return role === "Sponsor" ? "Sponsor" : "Job search";
}

/** The side as a full row title: "Sponsor at Meridian Health". */
export function sideTitle(role: Role, company?: string | null): string {
  if (role === "Applicant") return "Job search";
  const c = (company || "").trim();
  return c ? `Sponsor at ${c}` : "Sponsor";
}

/** One line on what a side is for — under its title in the switcher. */
export function sideSummary(role: Role): string {
  return role === "Sponsor"
    ? "Refer people into roles at your company"
    : "Find your own next role";
}

/**
 * The side this account could still add, or null.
 *
 * Only a sponsor can add a side, and only a job search. A sponsor already
 * works somewhere and may be quietly looking; an applicant is looking for
 * work and has no company to refer anyone into, so a sponsor side would
 * have nothing to stand on (it needs a verified work email at a current
 * employer). The backend enforces the same rule.
 */
export function addableRole(roles: readonly Role[]): "Applicant" | null {
  return roles.includes("Sponsor") && !roles.includes("Applicant")
    ? "Applicant"
    : null;
}

export function holdsBoth(roles: readonly Role[]): boolean {
  return roles.includes("Sponsor") && roles.includes("Applicant");
}

/**
 * Which side a push notification belongs to. A `role` in the payload wins
 * (the dual-sides backend sends it); otherwise the notification types that
 * only ever go to one side decide; null when it can't be told — the caller
 * then leaves the active side alone.
 */
export function roleForNotification(data: unknown): Role | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const explicit = parseRoles([d.role ?? d.recipient_role]);
  if (explicit.length === 1) return explicit[0];
  switch (d.type) {
    // An applicant acted on a sponsor's role.
    case "job_like":
    case "sponsor_request":
      return "Sponsor";
    // A sponsor acted on an applicant.
    case "profile_like":
    case "waitlist":
      return "Applicant";
    default:
      return null;
  }
}

// ── What's waiting on each side ─────────────────────────────────────────────

/**
 * What needs the person's attention on one side — from
 * `GET /api/profile/roles/summary/` (docs/DUAL_SIDES.md). Every count is
 * optional on the wire; a missing one is zero.
 */
export interface SideSummary {
  /** People waiting on your move: applicants interested in your roles
   * (sponsor side) or sponsors interested in you (job search). */
  newInterest: number;
  /** Mutual matches you haven't opened yet. */
  newMatches: number;
  unreadMessages: number;
  /** Referrals that need a status update or have a new one. */
  referralUpdates: number;
}

export type SidesSummary = Partial<Record<Role, SideSummary>>;

function count(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Parse the summary response tolerantly: `{ sides: { Sponsor: {...},
 * applicant: {...} } }`, either casing for the side keys, snake_case counts.
 * Anything unrecognizable yields an empty summary — the switcher then just
 * shows no counts.
 */
export function parseSidesSummary(raw: unknown): SidesSummary {
  const sides =
    raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).sides ?? raw)
      : null;
  if (!sides || typeof sides !== "object") return {};
  const out: SidesSummary = {};
  for (const [key, value] of Object.entries(sides as Record<string, unknown>)) {
    const [role] = parseRoles([key]);
    if (!role || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    out[role] = {
      newInterest: count(v.new_interest),
      newMatches: count(v.new_matches),
      unreadMessages: count(v.unread_messages),
      referralUpdates: count(v.referral_updates),
    };
  }
  return out;
}

/** How many things are waiting on a side, for its count badge. */
export function waitingTotal(summary: SideSummary | null | undefined): number {
  if (!summary) return 0;
  return (
    summary.newInterest +
    summary.newMatches +
    summary.unreadMessages +
    summary.referralUpdates
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One line on what's waiting — "3 new applicants · 2 unread messages" — or
 * null when nothing is (the row then falls back to what the side is for).
 * At most two parts, most actionable first, so it never wraps to a list.
 */
export function waitingLine(
  role: Role,
  summary: SideSummary | null | undefined,
): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.newInterest > 0) {
    parts.push(
      role === "Sponsor"
        ? plural(summary.newInterest, "new applicant", "new applicants")
        : plural(summary.newInterest, "sponsor interested", "sponsors interested"),
    );
  }
  if (summary.newMatches > 0) {
    parts.push(plural(summary.newMatches, "new match", "new matches"));
  }
  if (summary.unreadMessages > 0) {
    parts.push(plural(summary.unreadMessages, "unread message", "unread messages"));
  }
  if (summary.referralUpdates > 0) {
    parts.push(plural(summary.referralUpdates, "referral update", "referral updates"));
  }
  return parts.length ? parts.slice(0, 2).join(" · ") : null;
}
