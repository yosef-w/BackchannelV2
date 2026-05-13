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
export const PREMIUM_ENABLED = true;

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
