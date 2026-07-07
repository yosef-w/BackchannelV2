import { router } from "expo-router";
import React from "react";
import { ModeSelection } from "../components/ModeSelection";

export default function ChooseRoleScreen() {
  return (
    <ModeSelection
      onBack={() => router.replace("/splash")}
      onSelect={(mode) =>
        router.replace({ pathname: "/onboarding", params: { mode } })
      }
    />
  );
}
