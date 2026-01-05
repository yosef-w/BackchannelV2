import { router } from "expo-router";
import React from "react";
import { ModeSelection } from "../components/ModeSelection";

export default function ChooseRoleScreen() {
  return (
    <ModeSelection
      onBack={() => router.replace("/splash" as any)}
      onSelect={(mode) =>
        router.push({ pathname: "/onboarding" as any, params: { mode } })
      }
      onSkipToDashboard={() =>
        router.replace({ pathname: "/dashboard" as any, params: { mode: "sponsor" } })
      }
      onSkipToApplicantDashboard={() =>
        router.replace({ pathname: "/dashboard" as any, params: { mode: "applicant" } })
      }
    />
  );
}
