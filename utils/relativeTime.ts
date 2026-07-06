// Shared "time ago" formatter — originally local to MatchesView, pulled out
// so the new Matches row components (and anything else) can use the same
// wording instead of re-implementing date math.

export function getRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const now = new Date();
  // Backends often return ISO strings without a timezone suffix (e.g.
  // "2026-05-15T14:30:00"). Without a marker JS parses them as *local* time,
  // which makes the diff negative for users behind UTC and produces nonsense
  // like "-1d ago". Append 'Z' to force UTC interpretation when no offset is
  // present.
  const hasTimezone =
    /Z$/i.test(dateStr.trim()) || /[+-]\d{2}:?\d{2}$/.test(dateStr.trim());
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  // Guard against minor clock skew or future timestamps — anything within the
  // same day should just read "Today" rather than a negative value.
  if (diffMs < 0) return "Today";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}
