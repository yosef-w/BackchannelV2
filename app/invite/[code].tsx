/**
 * /invite/<code>
 *
 * Landing route for an invite link (https://…/invite/<code>, opened as a
 * universal link, or backchannelv2://invite/<code>). It does exactly one
 * thing: remember who invited this install, then get out of the way and let
 * the normal app entry decide where the person belongs (sign-in, onboarding,
 * or home). No UI of its own — a spinner-free instant redirect.
 *
 * Invalid codes are ignored, never stored (lib/referrer.ts validates), and
 * the redirect happens regardless, so a mangled link can't strand anyone.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { trackInviteOpened } from "@/lib/analytics/mixpanel";
import { isValidReferrerCode, setPendingReferrer } from "@/lib/referrer";

export default function InviteRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isValidReferrerCode(code)) {
        const stored = await setPendingReferrer(code);
        if (stored) trackInviteOpened({ referrerId: code });
      }
      if (cancelled) return;
      // Opened while the app is already running, this screen sits on top
      // of whatever the user was looking at — return there. replace("/")
      // used to leave a signed-in user staring at the marketing splash
      // (index → splash, whose cold-start routing had already latched) on
      // top of their own tabs. Cold-start: no history, so splash it is.
      if (router.canGoBack()) router.back();
      else router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return null;
}
