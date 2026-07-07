import { router } from "expo-router";
import React, { useEffect } from "react";
import { SplashScreen } from "../components/SplashScreen";
import { useAuthStore } from "../stores/useAuthStore";

export default function SplashRoute() {
  // Tokens are loaded (and silently refreshed if stale) by RootLayout on
  // startup. Once that finishes, send returning users straight to the
  // dashboard instead of making them tap through onboarding and re-login.
  // dashboard.tsx derives the role from the persisted auth store, so no
  // mode param is needed here.
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated]);

  return (
    <SplashScreen
      onGetStarted={() => router.replace("/choose-role")}
      onSignIn={() => router.push("/sign-in")}
    />
  );
}
