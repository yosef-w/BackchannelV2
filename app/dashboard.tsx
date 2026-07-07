import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

const VALID_TABS = ["home", "matches", "jobs", "messages", "profile"] as const;
type TabName = (typeof VALID_TABS)[number];

/**
 * Legacy entry point — the authenticated shell now lives at /(tabs)/*.
 *
 * Every pre-existing navigation target ("/dashboard", "/dashboard?tab=jobs",
 * "/dashboard?mode=sponsor") from splash / sign-in / onboarding /
 * verify-email keeps working through this redirect, so external references
 * and muscle memory don't break. Auth gating lives in the (tabs) layout.
 */
export default function DashboardRedirect() {
  const params = useLocalSearchParams<{ mode?: string; tab?: string }>();

  const tab: TabName = VALID_TABS.includes(params.tab as TabName)
    ? (params.tab as TabName)
    : "home";

  return (
    <Redirect
      href={{
        pathname: `/(tabs)/${tab}`,
        params: params.mode ? { mode: params.mode } : {},
      }}
    />
  );
}
