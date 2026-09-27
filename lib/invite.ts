// Invite loop — the app's only built-in growth mechanic.
//
// A two-sided referral marketplace grows by each side pulling in the other:
// applicants know people who work at places they want to join (future
// sponsors), and sponsors know colleagues (more sponsors → denser decks).
// This builds the link + role-aware message and hands it to the system share
// sheet. The link is a universal link (see BackChannel-Netlify
// .well-known/apple-app-site-association): with the app installed it opens
// straight to /invite/<code>; without it, the visitor lands on the site's
// install page.
//
// The code is the inviter's user id, so inviting requires being signed in
// and attribution can be traced back to a real account in Mixpanel.

import { Share } from "react-native";
import { APP_STORE_URL } from "@/constants/config";
import { trackInviteShared } from "@/lib/analytics/mixpanel";
import { isValidReferrerCode } from "@/lib/referrer";

export const INVITE_BASE_URL = "https://backchannelapp.netlify.app/invite";

export type InviteRole = "applicant" | "sponsor";
export type InviteSource = "settings" | "deck_done";

/** Pure (exported for tests). Returns null for an unusable user id. */
export function buildInviteUrl(userId: string | null | undefined): string | null {
  if (!isValidReferrerCode(userId)) return null;
  return `${INVITE_BASE_URL}/${userId}`;
}

/**
 * Applicants pitch it as "vouch for people like me"; sponsors pitch it as
 * "help good people get hired where you work". Plain, first-person, no hype:
 * this is a message someone sends to a friend under their own name.
 */
export function buildInviteMessage(role: InviteRole, url: string): string {
  return role === "sponsor"
    ? `I'm a sponsor on BackChannel, where employees refer strong candidates into open roles at their company. If you'd like to do the same at yours, join here: ${url}`
    : `I'm using BackChannel to get referred into jobs by people who work there. If you're at a company worth applying to, you can vouch for people like me. Join here: ${url}`;
}

/**
 * Open the share sheet. Resolves true when the user actually shared
 * (iOS reports dismissal separately), false on cancel or when there's no
 * account id to attribute the invite to.
 */
export async function shareInvite(
  role: InviteRole,
  userId: string | null | undefined,
  source: InviteSource,
): Promise<boolean> {
  const url = buildInviteUrl(userId);
  if (!url) return false;
  try {
    const result = await Share.share({
      message: buildInviteMessage(role, url),
      // Android share-sheet title (iOS ignores it); the message carries the copy.
      title: "Join me on BackChannel",
    });
    const shared = result.action === Share.sharedAction;
    if (shared) trackInviteShared({ role, source });
    return shared;
  } catch {
    return false;
  }
}

/** Where an invite recipient without the app is sent if the link fails. */
export const INSTALL_URL = APP_STORE_URL;
