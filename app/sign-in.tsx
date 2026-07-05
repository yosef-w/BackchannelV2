/**
 * /sign-in
 *
 * Direct entry point for returning users, reachable from the splash screen's
 * "Already have an account? Sign in" link. Skips role selection and the
 * onboarding slides entirely — those only make sense for someone who doesn't
 * have an account yet.
 *
 * No role is known here, so this screen never allows sign-up in place: a tap
 * on "Sign up" sends the user to the normal choose-role flow instead of
 * guessing applicant vs. sponsor (see AuthScreen's onRequestSignUp prop).
 */

import { router } from "expo-router";
import React from "react";
import { AuthScreen } from "../components/AuthScreen";

export default function SignInScreen() {
  return (
    <AuthScreen
      initialIsLogin
      onBack={() => router.replace("/splash" as any)}
      onLoginComplete={() => router.replace("/dashboard" as any)}
      // Defensive fallback only — onRequestSignUp intercepts every "Sign up"
      // tap while isLogin is true, so the signup submit path below should
      // never actually run from this screen.
      onComplete={() => router.replace("/choose-role" as any)}
      onRequestSignUp={() => router.replace("/choose-role" as any)}
    />
  );
}
