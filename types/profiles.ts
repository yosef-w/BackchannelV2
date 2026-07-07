/**
 * Profile-pack API response transform.
 *
 * Single source of truth for turning a raw GET /api/profiles/pack/ row into
 * the shape HomeView's sponsor deck renders. Previously this transform was
 * copy-pasted three times in HomeView (initial load, error-retry, and the
 * "No Applicants" Refresh action) and had drifted — the Refresh copy set
 * raw untransformed rows, rendering "?" avatars with no name/skills/prompts.
 * Every load/retry/refresh path must go through this function instead of
 * re-implementing it.
 */

/** Safely parse a field that may be a JSON string, already-parsed array, or absent. */
function parseJsonArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** One insight prompt as rendered on the applicant deck card. */
export interface ProfilePrompt {
  question?: string;
  answer?: string;
}

/**
 * The loose "who am I looking at" payload handed to the public-profile
 * overlay (MainApp → Applicant/SponsorPublicProfileView). Callers pass
 * whatever they have on hand — a conversation row (otherParticipant), a
 * deck card (USER_ID), or a minimal { userId } — and the views resolve the
 * id and seed the header from whichever fields are present, then fetch the
 * full profile themselves.
 */
export interface PublicProfileUserData {
  USER_ID?: string;
  userId?: string;
  name?: string;
  role?: string;
  company?: string;
  appliedRole?: string;
  skills?: string[] | string;
  profileImageUrl?: string;
  otherParticipant?: {
    id?: string;
    name?: string;
    role?: string;
    company?: string;
    profileImageUrl?: string;
  };
  jobContext?: {
    jobTitle?: string;
    company?: string;
  };
  // Callers pass richer objects (full conversation rows, deck cards) —
  // tolerate extra fields without another cast at every call site.
  [key: string]: unknown;
}

export interface ProfilePackRow {
  USER_ID: string;
  FIRST_NAME?: string | null;
  LAST_NAME?: string | null;
  LOCATION?: string | null;
  SKILLS?: string | string[] | null;
  POSITIONS?: string | string[] | null;
  BIO?: string | null;
  REASON?: string | null;
  INSIGHTS?: string | ProfilePrompt[] | null;
  PHOTO_URL?: string | null;
  HAS_LIKED_JOB?: boolean;
  // The pack endpoint ships more columns than the card reads; keep the row
  // open but force consumers to narrow before using extra fields.
  [key: string]: unknown;
}

/** UI-shaped applicant deck card, as HomeView's sponsor view expects. */
export interface ProfileDeckCard {
  id: string;
  USER_ID: string;
  name: string;
  location: string;
  skills: string[];
  desiredRole: string;
  bio: string;
  prompts: ProfilePrompt[];
  image: string;
  company: string;
  // Raw row fields spread through by the transform (see `...profile` below).
  [key: string]: unknown;
}

export function transformProfilePackRow(profile: ProfilePackRow): ProfileDeckCard {
  // Backend contract: SKILLS/POSITIONS are string arrays and INSIGHTS is a
  // prompt-object array (JSON-encoded or pre-parsed). The casts assert that
  // contract rather than validating each element — same runtime behavior as
  // before, now visible in the types.
  const skills = parseJsonArray(profile.SKILLS) as string[];
  const positions = parseJsonArray(profile.POSITIONS) as string[];
  const prompts = parseJsonArray(profile.INSIGHTS) as ProfilePrompt[];

  const bio: string =
    profile.BIO || profile.REASON || "Looking for new opportunities";

  return {
    ...profile, // Keep all original fields
    id: profile.USER_ID,
    name: `${profile.FIRST_NAME || ""} ${profile.LAST_NAME || ""}`.trim(),
    location: profile.LOCATION || "",
    skills,
    desiredRole: positions[0] || "Open to opportunities",
    bio,
    prompts,
    image: profile.PHOTO_URL || "",
    company: "", // Applicants don't have company
  };
}

export function transformProfilePackRows(
  profiles: ProfilePackRow[],
): ProfileDeckCard[] {
  return (profiles || []).map(transformProfilePackRow);
}
