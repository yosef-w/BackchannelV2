/**
 * 🛡️ Sentry crash reporting
 *
 * Mirrors the Mixpanel pattern in lib/analytics/mixpanel.ts: the DSN comes
 * from an env var and the whole module no-ops gracefully when it's missing,
 * so dev environments and CI never need a Sentry account to run the app.
 *
 * Set EXPO_PUBLIC_SENTRY_DSN in .env.development / .env.test /
 * .env.production (and in the EAS production env) once the Sentry project
 * exists. Source-map upload for readable JS stack traces additionally needs
 * SENTRY_ORG, SENTRY_PROJECT and SENTRY_AUTH_TOKEN set at build time (EAS
 * secrets) — crashes are still captured without them, just less readable.
 */

import * as Sentry from "@sentry/react-native";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/**
 * Initialize Sentry. Call once at app entry (module scope of the root
 * layout), before any UI mounts, so startup crashes are captured too.
 * Safe to call with no DSN configured — it simply doesn't init.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.log("[Sentry] No DSN configured — crash reporting disabled");
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // Dev crashes show up in Metro with full stacks already; only report
    // from real builds so the dashboard stays signal, not noise.
    enabled: !__DEV__,
    // Resumes, photos and emails flow through this app — never attach
    // request bodies / user IP automatically.
    sendDefaultPii: false,
    // Light performance sampling — enough to spot slow screens during the
    // beta without burning quota.
    tracesSampleRate: 0.2,
  });
}

/**
 * Wrap the root component so Sentry instruments the app shell (error
 * boundary at the root + native-screen touch tracking). Identity-safe when
 * the DSN is missing: Sentry.wrap on an uninitialized SDK is a no-op shell.
 */
export const sentryWrap = Sentry.wrap;

/** Re-export for manual capture sites (e.g. catch blocks worth reporting). */
export { Sentry };
