import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef } from "react";
import { SplashScreen } from "../components/SplashScreen";
import { useAuthStore } from "@/stores/useAuthStore";
import { getPendingOnboardingRole } from "@/utils/onboardingDraft";

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
      if (isLoading || !isAuthenticated) return;
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
