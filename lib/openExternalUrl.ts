// openExternalUrl — the one place in the app that should call Linking.openURL
// on a URL that ISN'T something the user typed into this app's own
// URL-editing fields (those already go through lib/validation.ts's
// isValidUrl/normalizeUrl at entry). A job posting's source URL, another
// user's portfolio link, or anything else pulled from the backend/ATS data
// is untrusted — it was never validated at entry, so a `javascript:`,
// `intent://`, `tel:`, or other non-http(s) scheme could reach Linking.openURL
// unfiltered and fire silently. This is the single guard for that.

import { Linking } from "react-native";

/** Open a URL, but only if it's http(s). Silently ignores everything else. */
export function openExternalUrl(url: string | null | undefined): void {
  if (!url) return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;
  Linking.openURL(trimmed).catch(() => {});
}
