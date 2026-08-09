/**
 * /intro — the pre-signup product film, played right AFTER role selection
 * so each audience gets its own cut: IntroCinema for applicants,
 * SponsorCinema for sponsors (deliberate mirrors — same arc, same feel).
 * Both Skip and the CTA continue to the role's onboarding slides; the
 * sign-in link rescues returning users who wandered into the new-user
 * path. Watching once sets a seen-flag so choose-role routes straight to
 * the slides on later passes. iOS swipe-back returns to role selection
 * (pushed, not replaced).
 */

import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { IntroCinema } from "../components/IntroCinema";
import { SponsorCinema } from "../components/SponsorCinema";
import { markIntroFilmSeen } from "@/lib/introFilmSeen";

export default function IntroRoute() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const role = params.mode === "sponsor" ? "sponsor" : "applicant";

  const continueToSlides = () => {
    markIntroFilmSeen(role); // fire-and-forget
    router.push({ pathname: "/onboarding", params: { mode: role } });
  };
  const signIn = () => router.push("/sign-in");
  // Wrong role? Back returns to role selection (the normal history), with
  // a replace() fallback for deep links / hot reloads that have no stack.
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/choose-role");

  if (role === "sponsor") {
    return (
      <SponsorCinema
        onContinue={continueToSlides}
        onSignIn={signIn}
        onBack={back}
      />
    );
  }
  return (
    <IntroCinema
      onContinue={continueToSlides}
      onSignIn={signIn}
      onBack={back}
    />
  );
}
