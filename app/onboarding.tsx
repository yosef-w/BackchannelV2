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
  // Normally the auth step defaults to sign-up (this route is the new-user
  // path). But if registration later fails because the email is already
  // registered — discovered mid-questionnaire, since account creation
  // happens on the questionnaire's first step — we send the user back here
  // pre-set to Sign In instead of dropping them back on the sign-up form
  // they just got rejected from.
  const [authInitialIsLogin, setAuthInitialIsLogin] = useState(false);

  const goToSignInRecovery = () => {
    setAuthInitialIsLogin(true);
    setStep("auth");
  };

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
        // This route is only reached via the new-user path (choose-role →
        // onboarding slides → "Get Started"), so default to sign-up. A user
        // who already has an account can still tap "Sign in" on this screen,
        // or use the splash screen's direct sign-in link to skip this flow
        // entirely.
        initialIsLogin={authInitialIsLogin}
        onBack={() => {
          setAuthInitialIsLogin(false);
          setStep("onboarding");
        }}
        onComplete={() => setStep("questionnaire")}
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
        onEmailAlreadyRegistered={goToSignInRecovery}
      />
    );
  }

  return (
    <ApplicantQuestionnaire
      onBack={() => setStep("auth")}
      onComplete={handleComplete}
      onEmailAlreadyRegistered={goToSignInRecovery}
    />
  );
}
