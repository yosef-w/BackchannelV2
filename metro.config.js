// Sentry's Metro wrapper around Expo's default config. It injects Debug IDs
// into every bundle + source map so crash stack traces can be symbolicated
// back to real file/line numbers — without it, production Sentry reports
// show minified frames like `at a (index.js:1:482913)` and are useless.
//
// The upload half of the pipeline (getting the source maps TO Sentry) is
// controlled separately: the @sentry/react-native expo plugin runs it during
// EAS builds using SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN. See
// eas.json — auto-upload stays disabled until SENTRY_AUTH_TOKEN is set as an
// EAS secret, but the Debug IDs this config injects are harmless without it
// and required once it's on.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = config;
