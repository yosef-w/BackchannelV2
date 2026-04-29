import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ApplicantQuestionnaire } from "../components/ApplicantQuestionnaire";
import { AuthScreen } from "../components/AuthScreen";
import { Onboarding } from "../components/Onboarding";
import { SponsorQuestionnaire } from "../components/SponsorQuestionnaire";
import { useOnboardingStore } from "../stores/useOnboardingStore";

type UserType = "applicant" | "sponsor";
type Step = "onboarding" | "auth" | "questionnaire";

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const userType: UserType = useMemo(() => {
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [params.mode]);

  // Keep the Zustand store in sync with the URL-param userType.
  // ModeSelection normally sets this, but navigating directly to /onboarding
  // (or a hot reload) can leave the store's userType as null — which causes
  // AuthScreen to skip saving the auth fields, sending empty data to the API.
  const setUserType = useOnboardingStore((state) => state.setUserType);
  useEffect(() => {
    setUserType(userType);
  }, [userType]);

  const [step, setStep] = useState<Step>("onboarding");
  // True once the user has advanced to the questionnaire step.
  // When they navigate back, we want to land on sign-up (not sign-in)
  // with their previously entered data still visible.
  const [hasStartedSignup, setHasStartedSignup] = useState(false);

  if (step === "onboarding") {
    return (
      <Onboarding
        onBack={() => router.replace("/choose-role" as any)}
        onComplete={() => setStep("auth")}
        userType={userType}
      />
    );
  }

  if (step === "auth") {
    return (
      <AuthScreen
        userType={userType}
        // Default to sign-in on first arrival; switch to sign-up only when
        // the user has already been to the questionnaire step and navigated back.
        initialIsLogin={!hasStartedSignup}
        onBack={() => setStep("onboarding")}
        onComplete={() => {
          setHasStartedSignup(true);
          setStep("questionnaire");
        }}
        onLoginComplete={() =>
          router.replace({ pathname: "/dashboard", params: { mode: userType } })
        }
      />
    );
  }

  const handleComplete = () => {
    router.replace({ pathname: "/dashboard", params: { mode: userType } });
  };

  if (userType === "sponsor") {
    return (
      <SponsorQuestionnaire
        onBack={() => setStep("auth")}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <ApplicantQuestionnaire
      onBack={() => setStep("auth")}
      onComplete={handleComplete}
    />
  );
}
