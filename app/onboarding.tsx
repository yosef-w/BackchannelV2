import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ApplicantQuestionnaire } from "../components/ApplicantQuestionnaire";
import { AuthScreen } from "../components/AuthScreen";
import { Onboarding } from "../components/Onboarding";
import { SponsorQuestionnaire } from "../components/SponsorQuestionnaire";

type UserType = "applicant" | "sponsor";
type Step = "onboarding" | "auth" | "questionnaire";

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const userType: UserType = useMemo(() => {
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [params.mode]);

  const [step, setStep] = useState<Step>("onboarding");

  if (step === "onboarding") {
    return (
      <Onboarding
        onBack={() => router.back()}
        onComplete={() => setStep("auth")}
        userType={userType}
      />
    );
  }

  if (step === "auth") {
    return (
      <AuthScreen
        onBack={() => setStep("onboarding")}
        onComplete={() => setStep("questionnaire")}
        onLoginComplete={() => router.replace({ pathname: "/dashboard", params: { mode: userType } })}
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
