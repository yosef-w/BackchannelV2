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

// EXPO_PUBLIC_APP_ENV is set per EAS environment (development/preview/
// production — see eas.json and `eas env:list`) so a TestFlight/internal
// build reports as "preview", not "production". Preview builds DO ship
// with a DSN (see eas env:list --environment preview), so without this the
// beta's crash noise would land in the same charts as real App Store
// users. __DEV__ remains the fallback for local runs with no env set.
const SENTRY_ENVIRONMENT =
  process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? "development" : "production");

// Matches "word@word.tld" case-insensitively — good enough to redact an
// email address caught up in a raw backend error string; not a validator.
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/gi;

/**
 * Redact anything email-shaped out of a string before it's attached to a
 * Sentry event. `captureApiServerError` below attaches the backend's raw
 * 5xx response text verbatim — most of those are generic ("Internal Server
 * Error"), but a validation error can legitimately echo back the email the
 * request was for.
 */
export function redactPii(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]");
}

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
    environment: SENTRY_ENVIRONMENT,
    // Resumes, photos and emails flow through this app — never attach
    // request bodies / user IP automatically.
    sendDefaultPii: false,
    // Light performance sampling — enough to spot slow screens during the
    // beta without burning quota.
    tracesSampleRate: 0.2,
    // A screenshot of the screen at the moment of an unhandled error —
    // no more sensitive than what the user already sees rendered, and
    // often the fastest way to tell "which screen, what state" without
    // guessing from a stack trace alone.
    attachScreenshot: true,
  });
}

/**
 * Attach the logged-in account to subsequent crash reports so a Sentry
 * issue can be matched to the tester who hit it (and to their Mixpanel
 * profile via the same id). Deliberately id-only — no email/name — in
 * keeping with sendDefaultPii: false. Called from identifyUser() in
 * lib/analytics/mixpanel.ts so Sentry and Mixpanel identity can never
 * drift apart.
 *
 * `userType` is set as a tag (not part of the user object) so issues can
 * be filtered Applicant vs Sponsor — the app's primary axis — directly in
 * Sentry's issue list, without opening each event.
 */
export function setSentryUser(
  userId: string,
  userType?: "applicant" | "sponsor" | "unknown",
): void {
  Sentry.setUser({ id: userId });
  if (userType) {
    Sentry.setTag("user_type", userType);
  }
}

/** Detach identity on logout / account deletion (paired with resetUser()). */
export function clearSentryUser(): void {
  Sentry.setUser(null);
  Sentry.setTag("user_type", undefined);
}

/**
 * Report a server-side API failure (5xx) as a Sentry event. Grouped by
 * method+endpoint via an explicit fingerprint so "POST /api/messages/send
 * is 500ing" shows as ONE issue with a counter, not hundreds of scattered
 * events. Endpoint must already be scrubbed of query strings (tokens!).
 */
export function captureApiServerError(
  method: string,
  endpoint: string,
  status: number,
  serverMessage?: string,
): void {
  Sentry.withScope((scope) => {
    scope.setTag("api.endpoint", endpoint);
    scope.setTag("api.status", String(status));
    scope.setFingerprint(["api-5xx", method, endpoint]);
    if (serverMessage) {
      scope.setExtra("server_message", redactPii(serverMessage));
    }
    Sentry.captureMessage(`API ${status}: ${method} ${endpoint}`, "error");
  });
}

/**
 * Wrap the root component with Sentry's touch-event boundary + profiler
 * (records tap breadcrumbs and a root render profile). This does NOT add
 * an error boundary — Sentry.wrap only adds those two — so a render
 * exception still propagates past it. `SentryErrorBoundary` below is what
 * actually catches one; wrap <Stack> in app/_layout.tsx with it. Identity-
 * safe when the DSN is missing: Sentry.wrap on an uninitialized SDK is a
 * no-op shell.
 */
export const sentryWrap = Sentry.wrap;

/**
 * Catches a render-time exception that would otherwise hard-crash the app
 * to the home screen with no recovery path, reports it, and shows a plain
 * "Something went wrong" screen with a Reload button. Wrap <Stack> in
 * app/_layout.tsx with this — not the whole tree, so the fallback still
 * renders inside GestureHandlerRootView/KeyboardProvider/ThemeProvider.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Drop a breadcrumb onto the Sentry timeline. Breadcrumbs are attached to the
 * next captured event, so they're how you reconstruct "what led up to this".
 * No-ops safely when Sentry isn't initialized (no DSN / dev).
 */
export function logBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  category = "ui",
): void {
  Sentry.addBreadcrumb({ message, data, category, level: "info" });
}

/** Re-export for manual capture sites (e.g. catch blocks worth reporting). */
export { Sentry };
