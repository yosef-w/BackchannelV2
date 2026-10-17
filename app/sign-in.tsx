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
      // A real back() (not replace()) so the platform's native "pop"
      // animation plays — replace() always animates like a forward push,
      // which read as moving forward even though this is a back button.
      // The replace() fallback only covers deep links with no history.
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/splash")
      }
      // dismissAll() first: this screen may sit under choose-role/intro if
      // the user reached it via the pre-signup film's "sign in" escape
      // hatch (they're pushed, not replaced, so swipe-back works). A plain
      // replace() here only swaps sign-in for dashboard — it leaves intro's
      // cinema film mounted underneath, and its master clock loops forever
      // (withRepeat(-1)) firing haptic beats every ~16s with nothing on
      // screen to explain them. dismissAll() collapses the whole stack back
      // to its root before we land on dashboard, so nothing pre-auth stays
      // alive in the background.
      onLoginComplete={() => {
        router.dismissAll();
        router.replace("/dashboard");
      }}
      // Both exits lead to role selection: a brand-new SSO account
      // (onComplete — needs_onboarding, role unknown here) and a "Sign up"
      // tap. dismissTo(), not replace(): from the film's sign-in link the
      // stack is [splash, choose-role, intro, sign-in], and replace() made
      // it [splash, choose-role, intro, choose-role] — a second role picker
      // whose back button reopened the film. dismissTo() pops back to the
      // existing /choose-role (and pushes one when the user came straight
      // from splash, where it isn't in the stack).
      onComplete={() => router.dismissTo("/choose-role")}
      onRequestSignUp={() => router.dismissTo("/choose-role")}
    />
  );
}
