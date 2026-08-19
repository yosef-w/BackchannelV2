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
