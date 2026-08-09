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
      // A real back() (not replace()) so the platform's native "pop"
      // animation plays — replace() always animates like a forward push,
      // which read as moving forward even though this is a back button.
      // The replace() fallback only covers deep links with no history.
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/splash")
      }
      onSelect={handleSelect}
    />
  );
}
