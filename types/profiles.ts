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
function parseJsonArray(value: unknown): any[] {
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

export interface ProfilePackRow {
  USER_ID: string;
  FIRST_NAME?: string | null;
  LAST_NAME?: string | null;
  LOCATION?: string | null;
  SKILLS?: string | string[] | null;
  POSITIONS?: string | string[] | null;
  BIO?: string | null;
  REASON?: string | null;
  INSIGHTS?: string | any[] | null;
  PHOTO_URL?: string | null;
  HAS_LIKED_JOB?: boolean;
  [key: string]: any;
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
  prompts: any[];
  image: string;
  company: string;
  [key: string]: any;
}

export function transformProfilePackRow(profile: ProfilePackRow): ProfileDeckCard {
  const skills = parseJsonArray(profile.SKILLS);
  const positions = parseJsonArray(profile.POSITIONS);
  const prompts = parseJsonArray(profile.INSIGHTS);

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
