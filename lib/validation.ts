// Shared input validation + cleaning for user-entered profile data.
//
// Two jobs:
//   1. Validate — reject clearly-bad input (a phone that isn't a phone, a
//      malformed URL, an impossible year/GPA) before it's saved.
//   2. Clean — trim, collapse runaway whitespace, and cap length so a single
//      field can't blow up the layout or the database.
//
// Keep validators pragmatic, not pedantic: the goal is to stop garbage and
// UI-breaking input, not to perfectly enforce every RFC.

// Per-field character caps. Generous enough for real input, bounded enough
// that no single field can wreck a card or a row.
export const FIELD_LIMITS = {
  name: 60,
  role: 100,
  company: 100,
  phone: 25,
  email: 254,
  bio: 1000,
  achievements: 1000,
  url: 300,
  location: 80,
  degree: 120,
  major: 120,
  university: 150,
  year: 4,
  gpa: 5,
  generic: 500,
} as const;

/** Trim, collapse all whitespace runs to single spaces, and cap length. */
export function cleanText(
  input: string,
  maxLen: number = FIELD_LIMITS.generic,
): string {
  if (!input) return "";
  return input.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/**
 * Clean a multiline field (bio, achievements): preserve intentional line
 * breaks but normalize CRLF, collapse horizontal whitespace, cap consecutive
 * blank lines at one, and cap total length.
 */
export function cleanMultiline(
  input: string,
  maxLen: number = FIELD_LIMITS.bio,
): string {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

const DIGIT_RE = /\d/g;

/** A plausible phone number: only phone characters, 7–15 digits. */
export function isValidPhone(input: string): boolean {
  if (!input) return false;
  if (/[^\d\s+().-]/.test(input)) return false; // letters / junk → invalid
  const digits = (input.match(DIGIT_RE) || []).length;
  return digits >= 7 && digits <= 15;
}

/** Pragmatic email check (not full RFC 5322). */
export function isValidEmail(input: string): boolean {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Accepts "site.com", "www.site.com/x", or "https://site.com". */
export function isValidUrl(input: string): boolean {
  if (!input) return false;
  return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(input.trim());
}

/** Prepend https:// when no protocol is present so the link opens. */
export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** A 4-digit year within a sane range (1950 … 10 years out). */
export function isValidYear(input: string): boolean {
  const v = input.trim();
  if (!/^\d{4}$/.test(v)) return false;
  const y = parseInt(v, 10);
  return y >= 1950 && y <= new Date().getFullYear() + 10;
}

/** GPA between 0 and 5 with up to two decimals (covers 4.0 and 5.0 scales). */
export function isValidGpa(input: string): boolean {
  const v = input.trim();
  if (!/^\d(\.\d{1,2})?$/.test(v)) return false;
  const g = parseFloat(v);
  return g >= 0 && g <= 5;
}

export interface FieldValidationResult {
  ok: boolean;
  /** Cleaned value to persist when `ok` is true. */
  cleaned: string;
  /** User-facing message when `ok` is false. */
  error?: string;
}

/**
 * Central validator/cleaner for an editable profile field, keyed by the same
 * field names ProfileView's handleSaveField switch uses. Empty values are
 * always allowed (fields are optional) — we only reject non-empty garbage.
 */
export function validateProfileField(
  field: string,
  raw: string,
): FieldValidationResult {
  const value = raw ?? "";
  switch (field) {
    case "phone": {
      const cleaned = cleanText(value, FIELD_LIMITS.phone);
      if (cleaned && !isValidPhone(cleaned))
        return {
          ok: false,
          cleaned,
          error: "Enter a valid phone number (7–15 digits).",
        };
      return { ok: true, cleaned };
    }
    case "portfolio": {
      const cleaned = cleanText(value, FIELD_LIMITS.url);
      if (cleaned && !isValidUrl(cleaned))
        return {
          ok: false,
          cleaned,
          error: "Enter a valid link, e.g. yoursite.com.",
        };
      return { ok: true, cleaned: cleaned ? normalizeUrl(cleaned) : "" };
    }
    case "graduationYear": {
      const cleaned = cleanText(value, FIELD_LIMITS.year);
      if (cleaned && !isValidYear(cleaned))
        return { ok: false, cleaned, error: "Enter a valid 4-digit year." };
      return { ok: true, cleaned };
    }
    case "gpa": {
      const cleaned = cleanText(value, FIELD_LIMITS.gpa);
      if (cleaned && !isValidGpa(cleaned))
        return {
          ok: false,
          cleaned,
          error: "Enter a GPA between 0 and 5 (e.g. 3.8).",
        };
      return { ok: true, cleaned };
    }
    case "firstName":
    case "lastName":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.name) };
    case "role":
    case "jobTitle":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.role) };
    case "company":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.company) };
    case "bio":
    case "summary":
      return { ok: true, cleaned: cleanMultiline(value, FIELD_LIMITS.bio) };
    case "achievements":
      return {
        ok: true,
        cleaned: cleanMultiline(value, FIELD_LIMITS.achievements),
      };
    case "degree":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.degree) };
    case "major":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.major) };
    case "university":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.university) };
    case "street":
    case "city":
    case "state":
    case "country":
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.location) };
    default:
      return { ok: true, cleaned: cleanText(value, FIELD_LIMITS.generic) };
  }
}
