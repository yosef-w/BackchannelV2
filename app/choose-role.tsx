import { router } from "expo-router";
import React from "react";
import { ModeSelection } from "../components/ModeSelection";
import { hasSeenIntroFilm } from "@/lib/introFilmSeen";

export default function ChooseRoleScreen() {
  // First pass plays the role's intro film; a user who has already watched
  // it goes straight to sign-up. Pushed (not replaced) so iOS swipe-back
  // from the film/sign-up returns to role selection.
  const handleSelect = async (mode: "applicant" | "sponsor") => {
    const seen = await hasSeenIntroFilm(mode);
    router.push({
      pathname: seen ? "/onboarding" : "/intro",
      params: { mode },
    });
  };

  return (
    <ModeSelection
      onBack={() => router.replace("/splash")}
      onSelect={handleSelect}
    />
  );
}
