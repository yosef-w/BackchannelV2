import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ApplicantQuestionnaire } from "../components/ApplicantQuestionnaire";
import { AuthScreen } from "../components/AuthScreen";
import { Onboarding } from "../components/Onboarding";
import { SponsorQuestionnaire } from "../components/SponsorQuestionnaire";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";

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

  // True for a user who authenticated via SSO on a DIFFERENT screen
  // (app/sign-in.tsx's "Continue with Apple/Google", role unknown there)
  // and got routed to /choose-role -> here still needing a role. They
  // already have tokens (useAuthStore.isAuthenticated) and a pending
  // identity (useOnboardingStore.ssoSession) — showing them the intro
  // slides and a sign-up form again would be a confusing detour after
  // they already completed the "sign up" gesture. A password-signup user
  // is never both of these at once: setAuthTokens for that path doesn't
  // fire until registration succeeds inside the questionnaire itself, well
  // after this component's initial render, so this can't misfire for them.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const ssoSession = useOnboardingStore((state) => state.ssoSession);
  const skipToQuestionnaire = isAuthenticated && !!ssoSession;

  const [step, setStep] = useState<Step>(
    skipToQuestionnaire ? "questionnaire" : "onboarding",
  );
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
        onBack={() => router.replace("/choose-role")}
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

  // Once authenticated via SSO there's no auth step to go back to (see
  // skipToQuestionnaire above — this covers both the cross-screen shortcut
  // and a normal in-place SSO signup on this screen's own auth step, which
  // also leaves the user authenticated with a pending ssoSession). Send
  // them to role selection instead of a nonexistent password form.
  const handleQuestionnaireBack = () =>
    skipToQuestionnaire ? router.replace("/choose-role") : setStep("auth");

  if (userType === "sponsor") {
    return (
      <SponsorQuestionnaire
        onBack={handleQuestionnaireBack}
        onComplete={handleComplete}
        onEmailAlreadyRegistered={goToSignInRecovery}
      />
    );
  }

  return (
    <ApplicantQuestionnaire
      onBack={handleQuestionnaireBack}
      onComplete={handleComplete}
      onEmailAlreadyRegistered={goToSignInRecovery}
    />
  );
}
