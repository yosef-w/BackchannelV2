import { router } from "expo-router";
import React, { useEffect } from "react";
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

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    (async () => {
      // Authenticated ≠ done signing up: the applicant questionnaire
      // registers the account at its FIRST step, well before the rest of
      // the profile is collected, so someone whose app restarted
      // mid-questionnaire is already "authenticated" here. Sending them
      // straight to the dashboard would silently strand them with a
      // permanently half-filled profile and no way back to the remaining
      // questions. Route them back to finish instead — see
      // markOnboardingRegistered for where this flag is set/cleared.
      const pendingRole = await getPendingOnboardingRole();
      if (pendingRole) {
        router.replace({
          pathname: "/onboarding",
          params: { mode: pendingRole, resume: "1" },
        });
      } else {
        router.replace("/dashboard");
      }
    })();
  }, [isLoading, isAuthenticated]);

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
