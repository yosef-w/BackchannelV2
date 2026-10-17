import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { ApplicantQuestionnaire } from "../components/ApplicantQuestionnaire";
import { AuthScreen } from "../components/AuthScreen";
import { SponsorQuestionnaire } from "../components/SponsorQuestionnaire";
import { resetUser } from "@/lib/analytics/mixpanel";
import { logout } from "@/lib/api";
import { clearPerUserDeviceState } from "@/lib/sessionTeardown";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import {
  clearOnboardingDraft,
  getPendingOnboardingRole,
} from "@/utils/onboardingDraft";

type UserType = "applicant" | "sponsor";
type Step = "auth" | "questionnaire";

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string; resume?: string }>();
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
  // identity (useOnboardingStore.ssoSession) — showing them a sign-up form
  // again would be a confusing detour after they already completed the
  // "sign up" gesture. A password-signup user is never both of these at
  // once: setAuthTokens for that path doesn't fire until registration
  // succeeds inside the questionnaire itself, well after this component's
  // initial render, so this can't misfire for them.
  //
  // The `resume=1` param covers a second, non-SSO way to already be
  // authenticated here: the applicant questionnaire registers the account
  // at its FIRST step (résumé), before the rest of the profile is filled
  // out — so an app restart between that step and "Complete Profile"
  // leaves someone authenticated with a half-finished profile. splash.tsx
  // detects that (see utils/onboardingDraft's markOnboardingRegistered)
  // and routes here with resume=1 instead of sending them to the
  // dashboard. ApplicantQuestionnaire's own registeredRef (seeded from
  // isAuthenticated + ssoSession, then corrected against the durable
  // markOnboardingRegistered flag on mount) skips re-registration for them.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const ssoSession = useOnboardingStore((state) => state.ssoSession);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const clearUserProfileData = useUserProfileStore((state) => state.clearData);
  const rcReset = useSubscriptionStore((state) => state.reset);
  const skipToQuestionnaire =
    isAuthenticated && (!!ssoSession || params.resume === "1");

  const [step, setStep] = useState<Step>(
    skipToQuestionnaire ? "questionnaire" : "auth",
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

  if (step === "auth") {
    return (
      <AuthScreen
        userType={userType}
        // This route is only reached via the new-user path (choose-role →
        // the role's film → "Find your way in"), so default to sign-up. A
        // user who already has an account can still tap "Sign in" on this
        // screen, or use the splash screen's direct sign-in link (or the
        // film's own sign-in link) to skip this flow entirely.
        initialIsLogin={authInitialIsLogin}
        onBack={() => {
          setAuthInitialIsLogin(false);
          // No earlier step on this route anymore — return into the route
          // history (the role's film). The replace() fallback covers deep
          // links / hot reloads with no stack.
          if (router.canGoBack()) router.back();
          else router.replace("/choose-role");
        }}
        onComplete={() => setStep("questionnaire")}
        // dismissAll() first — see handleComplete's comment below. This
        // route is only reached via choose-role → the role's film, both
        // still sitting under us in the stack (pushed, not replaced, so
        // the funnel's swipe-back works); a plain replace() would leave
        // them mounted, and the film's looping clock keeps firing haptic
        // beats from a screen nobody can see.
        onLoginComplete={() => {
          router.dismissAll();
          router.replace({ pathname: "/dashboard", params: { mode: userType } });
        }}
      />
    );
  }

  const handleComplete = () => {
    // dismissAll() before landing on dashboard: this route is only reached
    // via choose-role → the role's film (see the comment above this
    // component), both pushed — not replaced — onto the stack so swipe-back
    // works through the funnel. A plain replace() here only swaps THIS
    // screen for dashboard; choose-role and the film stay mounted
    // underneath, and the film's master clock (withRepeat(-1)) loops
    // forever, firing haptic beats every ~16s from a screen that's no
    // longer visible. dismissAll() collapses the whole pre-auth stack back
    // to its root first, so nothing from the funnel survives into the
    // authenticated app.
    router.dismissAll();
    router.replace({ pathname: "/dashboard", params: { mode: userType } });
  };

  // Backing out of the questionnaire's FIRST step. The route underneath us
  // is usually the role's pre-signup film (choose-role → /intro → here,
  // all pushed), and a plain back() used to land there: it assumed
  // /choose-role was directly beneath, true only for the sign-in.tsx SSO
  // handoff on a second pass (film already seen). Three cases, checked in
  // this order:
  //
  //  1. Registered with a role (markOnboardingRegistered is set the moment
  //     the first step creates/attaches the account — password AND SSO
  //     paths): the whole pre-signup funnel beneath us, this route's own
  //     sign-up form included, is for people without an account, so there
  //     is nowhere to go "back" to. The only honest exit is signing out —
  //     confirmed, since a stray tap must not throw someone out mid-form.
  //     (The password path used to drop these users back on the sign-up
  //     form while still logged in, from where "Sign in" as a different
  //     account left this account's pending-signup flag behind.)
  //
  //  2. Authenticated via SSO but the role is NOT attached yet (the first
  //     step hasn't run): role selection is still a meaningful place to
  //     go, since picking the other role is still possible. dismissTo()
  //     pops everything above /choose-role, film included, with the native
  //     pop animation (and pushes it on a deep link / hot reload).
  //
  //  3. Not authenticated: back to this route's own auth step.
  const handleQuestionnaireBack = async () => {
    const registeredRole = isAuthenticated
      ? await getPendingOnboardingRole()
      : null;
    if (!registeredRole) {
      if (skipToQuestionnaire) router.dismissTo("/choose-role");
      else setStep("auth");
      return;
    }
    Alert.alert(
      "Leave sign-up?",
      "Your account is saved. You can finish the rest of your profile any time from the Profile tab after signing in.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: signOutOfOnboarding },
      ],
    );
  };

  // A trimmed-down version of ProfileView's logout — nothing beyond
  // registration has happened yet, so there are no reminders or caches to
  // tear down, but the same identity resets apply.
  const signOutOfOnboarding = async () => {
    try {
      await logout();
    } catch {
      // Best effort — local sign-out proceeds regardless.
    }
    // Device-level per-user state — above all the pending-signup flag,
    // which is per device, not per account: left set, the next account to
    // sign in on this phone would be routed into THIS user's unfinished
    // questionnaire on its next cold start. See sessionTeardown.
    await clearPerUserDeviceState();
    await clearOnboardingDraft(
      userType === "sponsor"
        ? "onboarding_draft_sponsor_v1"
        : "onboarding_draft_applicant_v1",
    );
    clearOnboardingData(); // drops ssoSession + prefill
    // The résumé step may already have filled the profile store (skills,
    // experience) — the next account on this phone must not inherit it.
    await clearUserProfileData();
    resetUser();
    rcReset();
    await clearAuth();
    router.dismissAll();
    router.replace("/splash");
  };

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
