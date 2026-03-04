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

  const userType: UserType = useMemo(() => {
    // First try to get from profile data (IS_SPONSOR field)
    if (profileData && "IS_SPONSOR" in profileData) {
      return profileData.IS_SPONSOR ? "sponsor" : "applicant";
    }
    // Fallback to URL param
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [params.mode, profileData]);

  // Redirect to splash if not authenticated (e.g., after token expiry)
  useEffect(() => {
    if (!isAuthenticated) {
      console.log("[Dashboard] Not authenticated, redirecting to splash...");
      router.replace("/splash");
    }
  }, [isAuthenticated, router]);

  return <MainApp userType={userType} />;
}
