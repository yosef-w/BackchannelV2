// ─── API ──────────────────────────────────────────────────────────────────────
//
// Single source of truth for the backend host — both lib/api.ts (REST + WS)
// and stores/useAuthStore.ts (its own direct token-refresh fetch) import
// this instead of each hardcoding the same fallback. They used to define it
// independently specifically to avoid a circular import (useAuthStore →
// lib/api.ts → useAuthStore), which is why this constant lives in this
// file — a leaf module with no imports of its own, safely importable from
// both sides of that cycle. Set per environment via EXPO_PUBLIC_API_BASE_URL
// (see .env.example / eas.json's per-environment config); the fallback
// below is production and only applies if that's ever unset.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://oyster-app-4pg5w.ondigitalocean.app";

// ─── App Feature Flags ────────────────────────────────────────────────────────
//
// Flip these booleans to enable / disable features globally.
// When a flag is false the app behaves exactly as it does today.
// When a flag is true the corresponding feature activates on every screen that
// checks it — no other code changes needed.

/**
 * PREMIUM_ENABLED
 *
 * false (default) — subscriptions are disabled. The app runs in free / test
 *   mode: no paywalls, no premium gates, no subscription prompts. This is the
 *   behaviour during development and internal testing.
 *
 * true — subscriptions are active. Paywalls, premium-user checks, and any
 *   gated features will be enforced. Set to true when you are ready to test
 *   or ship paid subscriptions.
 */
export const PREMIUM_ENABLED = false;

/**
 * SSO_ENABLED — Sign in with Apple / Google (docs/BACKEND_CHANGES_NEEDED.md §S)
 *
 * false (default) — the SSO buttons never render, regardless of platform or
 *   whether Google client IDs are configured below. This stays false until
 *   ALL THREE are true: (1) the backend's POST /api/auth/sso/ AND
 *   POST /api/auth/complete-onboarding/ are live, (2) real Apple/Google
 *   console credentials are configured (see GOOGLE_IOS_CLIENT_ID etc. below,
 *   and the "Sign in with Apple" capability on the App ID in the Apple
 *   Developer portal), and (3) a native build that includes
 *   expo-apple-authentication / @react-native-google-signin/google-signin
 *   has actually shipped (installing the packages alone doesn't link them
 *   into a running binary — same class of gap as the expo-clipboard native-
 *   module lesson).
 *
 * true — the buttons appear on the sign-in and sign-up screens (Apple only
 *   on iOS; Google on both platforms once its client IDs are non-empty).
 */
export const SSO_ENABLED = true;

/**
 * PLATES_ENABLED — the "Skim & Dive" home deck (components/home/plates).
 * true: each deck entry renders as a slide-through row of full-bleed plates
 * (one idea each) above the full dossier, with the deck gauge ticking the
 * current card's segment per plate. false: the previous single-scroll card.
 */
export const PLATES_ENABLED = true;

// ─── RevenueCat ───────────────────────────────────────────────────────────────
//
// API keys are loaded from env vars so they are never committed to git.
// Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
// in your .env.development / .env.test / .env.production files.
//
// The entitlement name must match exactly what you created in the RevenueCat
// dashboard. Products: monthly, yearly, lifetime.

export const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

export const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

/** The entitlement ID as configured in the RevenueCat dashboard. */
export const RC_ENTITLEMENT_ID = "Backchannel Pro";

// ─── Deck & Like Limits ────────────────────────────────────────────────────
//
// Daily caps on outbound likes ("Interested"/"Connect"), per subscription
// tier — shared by both the applicant and sponsor decks (one entitlement,
// one set of numbers). Centralized here so tuning either cap later is a
// one-line change: nothing else in the app hardcodes these numbers, and the
// paywall/gate copy that mentions them (MarketplaceGateModal, DeckDoneCard)
// reads straight from this object too, so the copy can't silently drift out
// of sync with the actual enforcement again (see docs/BACKEND_CHANGES_
// NEEDED.md §Y — that's exactly what happened with the old "unlimited deck"
// claim, which the enforcement never actually delivered).
//
// The daily *card count* (10, see HomeView's DECK_SIZE) is NOT part of this
// object — it's currently the same for free and premium, since a genuinely
// larger/unlimited card volume for premium needs backend support that
// doesn't exist yet (§Y). This object only controls how many of those cards
// a user is allowed to swipe right on per day.
export const DAILY_LIKE_LIMITS = {
  free: 2,
  premium: 5,
} as const;

/** The daily like cap for a given entitlement state. */
export function getDailyLikeCap(isPremium: boolean): number {
  return isPremium ? DAILY_LIKE_LIMITS.premium : DAILY_LIKE_LIMITS.free;
}

// ─── Google Places ────────────────────────────────────────────────────────────
//
// API key for Google Places Autocomplete, used by the profile editor's address
// field. Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env.* files. The key
// should be restricted in GCP by API (Places API) and by app (bundle ID /
// package + SHA-1) so a leak cannot be abused.

export const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

// ─── Google Sign-In (SSO) ───────────────────────────────────────────────────
//
// OAuth 2.0 client IDs from a Google Cloud Console project (console.cloud.
// google.com → APIs & Services → Credentials). Three SEPARATE client IDs are
// needed — Google issues one per platform, they are not interchangeable:
//   - iOS client ID: type "iOS", bundle ID must match app.json's
//     ios.bundleIdentifier exactly.
//   - Web client ID: type "Web application". Required even though this is a
//     native app — @react-native-google-signin/google-signin uses it as the
//     `webClientId` to obtain a verifiable ID token (the "audience" the
//     backend checks against per docs/SSO_PROPOSAL.md §4). No client secret
//     needed on this side; the secret stays server-side if the backend ever
//     needs offline access.
//   - Android client ID: type "Android", needs the release keystore's SHA-1
//     fingerprint registered against the package name.
//
// Getting the iOS client ID also gives you the "reversed client ID"
// (com.googleusercontent.apps.<id>) that app.json's google-signin plugin
// needs as `iosUrlScheme` — see the plugin entry in app.json for why that's
// left unconfigured until this exists (a placeholder value would either
// throw at prebuild or silently misconfigure the native URL scheme).
//
// Leave any of these empty during development — SSO_ENABLED above gates the
// UI regardless, and lib/sso.ts checks these before calling GoogleSignin.configure().

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

// ─── Legal ──────────────────────────────────────────────────────────────────
// Single source of truth — was duplicated as local constants in
// PrivacySecurityScreen.tsx; AuthScreen's signup consent line reads the same
// two URLs, so they moved here rather than being copied a second time.

export const TERMS_URL = "https://backchannelapp.netlify.app/terms.html";
export const PRIVACY_POLICY_URL =
  "https://backchannelapp.netlify.app/privacy.html";
