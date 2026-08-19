import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef } from "react";
import { SplashScreen } from "../components/SplashScreen";
import { useAuthStore } from "@/stores/useAuthStore";
import { getPendingOnboardingRole } from "@/utils/onboardingDraft";

// One auto-route decision per app LAUNCH (module-level so it survives
// splash unmount/remount). The focus effect below exists to catch the
// cold-start case — restore tokens, then forward a returning or
// mid-onboarding user off the splash. Without this latch it also fired
// every time the user deliberately backed INTO splash: the funnel's
// back-button fallbacks replace() to /splash with no stack, splash
// gained focus, saw "authenticated + onboarding unfinished", and
// instantly bounced them forward to /onboarding again — an inescapable
// résumé-screen ⇄ role-picker loop for anyone whose account was
// registered mid-questionnaire, with splash unreachable. The latch is
// set on the first definitive evaluation (auth finished loading) OR on
// splash's first focus loss, whichever comes first — so the redirect
// can only ever happen while splash has been continuously focused since
// launch.
let autoRouteDecided = false;

export default function SplashRoute() {
  // Tokens are loaded (and silently refreshed if stale) by RootLayout on
  // startup. Once that finishes, send returning users straight to the
  // dashboard instead of making them tap through onboarding and re-login.
  // dashboard.tsx derives the role from the persisted auth store, so no
  // mode param is needed here.
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Guards the async redirect against firing after splash loses focus
  // (the getPendingOnboardingRole read yields; a navigation can land in
  // that gap) or double-firing across focus changes.
  const redirectingRef = useRef(false);

  // useFocusEffect, NOT useEffect: splash stays mounted UNDER the whole
  // pushed signup funnel (choose-role → film → sign-up are push()ed so
  // swipe-back works). With a plain effect, the moment the questionnaire
  // registered the account mid-flow (auth flips true), this buried screen
  // redirected — and router.replace() acts on the FOCUSED screen, so it
  // yanked the questionnaire out from under the user and dropped them on
  // the dashboard with a half-filled profile. Focus-gating means this
  // only runs when splash is actually the screen being looked at: cold
  // start, or the user backing all the way out.
  useFocusEffect(
    useCallback(() => {
      redirectingRef.current = false;
      // Backed-into splash (or any focus after the launch window): show
      // the screen, never auto-forward. See autoRouteDecided above.
      if (autoRouteDecided) return;
      if (isLoading) return;
      // Auth state is definitive — this launch's one routing decision
      // happens now, redirect or not.
      autoRouteDecided = true;
      if (!isAuthenticated) return;
      (async () => {
        // Authenticated ≠ done signing up: the applicant questionnaire
        // registers the account at its FIRST step, well before the rest
        // of the profile is collected, so someone whose app restarted
        // mid-questionnaire is already "authenticated" here. Sending
        // them straight to the dashboard would silently strand them with
        // a permanently half-filled profile and no way back to the
        // remaining questions. Route them back to finish instead — see
        // markOnboardingRegistered for where this flag is set/cleared.
        const pendingRole = await getPendingOnboardingRole();
        if (redirectingRef.current) return;
        redirectingRef.current = true;
        if (pendingRole) {
          router.replace({
            pathname: "/onboarding",
            params: { mode: pendingRole, resume: "1" },
          });
        } else {
          router.replace("/dashboard");
        }
      })();
      return () => {
        // Focus lost — anything still in flight must not navigate.
        redirectingRef.current = true;
        // The cold-start window is over the moment splash first loses
        // focus, even if auth was still loading when the user moved on
        // (e.g. a fast "Get Started" tap) — otherwise a later back-into-
        // splash would evaluate as if it were the launch focus.
        autoRouteDecided = true;
      };
    }, [isLoading, isAuthenticated]),
  );

  return (
    <SplashScreen
      // Role selection comes first now — the intro films are role-tailored
      // and play right after the user picks a side. Pushed (not replaced)
      // so iOS swipe-back returns here rather than exiting.
      onGetStarted={() => router.push("/choose-role")}
      onSignIn={() => router.push("/sign-in")}
    />
  );
}
