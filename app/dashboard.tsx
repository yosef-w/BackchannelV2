import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { MainApp } from "../components/MainApp";
import { useAuthStore } from "../stores/useAuthStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";

type UserType = "applicant" | "sponsor";

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const profileData = useUserProfileStore((state) => state.data);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // role is set at login/registration (PR #19) and persisted to SecureStore.
  // It is the fastest and most reliable source of truth — available immediately
  // on mount, before the profile fetch completes.
  const role = useAuthStore((state) => state.role);

  const userType: UserType = useMemo(() => {
    // 1. Prefer the role stored at login time (PR #19 — fastest, no async dependency)
    if (role) {
      return role === "Sponsor" ? "sponsor" : "applicant";
    }
    // 2. Fall back to the IS_SPONSOR flag on the loaded profile
    if (profileData && "IS_SPONSOR" in profileData) {
      return profileData.IS_SPONSOR ? "sponsor" : "applicant";
    }
    // 3. Last resort: URL param set by onboarding flow
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [role, params.mode, profileData]);

  // Redirect to splash if not authenticated (e.g., after token expiry).
  // The 800 ms debounce gives any open WebView (or other component) time to
  // call its onSessionExpired / cleanup callback before navigation fires,
  // preventing a jarring mid-operation kick to the splash screen.
  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        console.log("[Dashboard] Not authenticated, redirecting to splash...");
        router.replace("/splash");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  return <MainApp userType={userType} />;
}
