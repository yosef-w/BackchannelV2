// lib/sso.ts — native SSO provider calls (Apple, Google), guarded.
//
// Why guarded: expo-apple-authentication and @react-native-google-signin/
// google-signin are NATIVE modules. Installing the npm package doesn't put
// them in a running binary — that only happens on the next native build
// (EAS build / expo prebuild). A top-level `import` of either would throw
// "Cannot find native module" and crash EVERY screen that transitively
// imports this file on any binary built before that rebuild lands (the
// exact failure JobSheetKit.tsx hit with expo-clipboard — see its history).
// Both are required lazily inside try/catch and degrade to "unsupported"
// rather than crash.
//
// Callers should not need to know any of this: isAppleSignInSupported() /
// isGoogleSignInSupported() answer "can I show this button", and
// signInWithApple() / signInWithGoogle() answer "get me a verifiable
// identity token" — both return `null` on a normal user-initiated cancel
// (never throw for that), so callers only need to handle "got a token",
// "user cancelled" (null), or a thrown error for anything else.

import { Platform } from "react-native";
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/constants/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppleAuthentication: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AppleAuthentication = require("expo-apple-authentication");
} catch {
  AppleAuthentication = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GoogleSignin: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch {
  GoogleSignin = null;
}

/** The shape both provider calls resolve to — enough to hit the SSO
 * endpoint and, for a brand-new user, pre-fill the questionnaire. */
export interface SsoIdentity {
  identityToken: string;
  /** Apple only (null for Google). The backend wants this on EVERY Apple
   * sign-in, not just the first: it exchanges it for a refresh token so it
   * can honor Apple's mandated token revoke when the user later deletes
   * their account (FRONTEND_SSO_HANDOFF_2026-08-04.md §1.2). */
  authorizationCode: string | null;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
}

// ── Apple ──────────────────────────────────────────────────────────────

/** Sync, cheap check for whether the Apple button should render at all —
 * platform + native module presence. Does NOT call the async device-
 * capability check; AppleAuthenticationButton already no-ops internally
 * when the device itself doesn't support it (rare: some iPads/regions). */
export function isAppleSignInSupported(): boolean {
  return Platform.OS === "ios" && AppleAuthentication !== null;
}

/**
 * Runs the native Apple sign-in sheet. Resolves `null` on a user-initiated
 * cancel (Apple's SDK throws `ERR_REQUEST_CANCELED` for this — converted
 * here so callers don't need to match error codes for the common case).
 * Any other failure (misconfigured capability, network) rethrows.
 *
 * `fullName` is populated ONLY on this user's first-ever authorization
 * with this app, per Apple's design — callers must use it immediately
 * (the backend exchange, and pre-filling the questionnaire) because a
 * second sign-in will come back with `givenName`/`familyName` both null.
 */
export async function signInWithApple(): Promise<SsoIdentity | null> {
  if (!isAppleSignInSupported()) {
    throw new Error("Sign in with Apple is not available on this device.");
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      // Per Apple's docs this shouldn't happen for a successful sign-in,
      // but the type is nullable — fail loudly rather than send a blank
      // token to the backend.
      throw new Error("Apple sign-in did not return an identity token.");
    }
    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode ?? null,
      email: credential.email ?? null,
      givenName: credential.fullName?.givenName ?? null,
      familyName: credential.fullName?.familyName ?? null,
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (err as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return null;
    }
    throw err;
  }
}

// ── Google ────────────────────────────────────────────────────────────

let googleConfigured = false;

/** Sync check for whether the Google button should render — native module
 * present AND real client IDs configured (both empty strings by default;
 * see constants/config.ts). Configuring GoogleSignin with empty strings
 * would fail confusingly deep inside the native SDK, so this doubles as
 * the gate for whether it's even safe to call configure(). */
export function isGoogleSignInSupported(): boolean {
  return (
    GoogleSignin !== null &&
    !!GOOGLE_WEB_CLIENT_ID &&
    (Platform.OS !== "ios" || !!GOOGLE_IOS_CLIENT_ID)
  );
}

/** Idempotent — configure() is cheap and safe to call more than once, but
 * there's no reason to. */
function ensureGoogleConfigured() {
  if (googleConfigured || !isGoogleSignInSupported()) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });
  googleConfigured = true;
}

/**
 * Runs the native Google sign-in flow. Resolves `null` on a user-
 * initiated cancel (Google's SDK returns `{ type: 'cancelled' }` rather
 * than throwing — normalized here to match signInWithApple()'s contract).
 * Any other failure (Play Services missing/outdated, network) rethrows.
 */
export async function signInWithGoogle(): Promise<SsoIdentity | null> {
  if (!isGoogleSignInSupported()) {
    throw new Error("Google Sign-In is not configured.");
  }
  ensureGoogleConfigured();
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const response = await GoogleSignin.signIn();
  if (response.type === "cancelled") {
    return null;
  }
  const { data } = response;
  if (!data.idToken) {
    throw new Error("Google sign-in did not return an identity token.");
  }
  return {
    identityToken: data.idToken,
    authorizationCode: null, // Apple-only concept — see SsoIdentity
    email: data.user.email ?? null,
    givenName: data.user.givenName ?? null,
    familyName: data.user.familyName ?? null,
  };
}
