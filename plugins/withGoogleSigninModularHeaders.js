const { withPodfile } = require("@expo/config-plugins");

// @react-native-google-signin/google-signin pulls in GoogleUtilities,
// RecaptchaInterop, and AppCheckCore transitively — none of them define
// Swift modules by default. This project links pods as static libraries
// (the Expo/RN default, no use_frameworks!), and CocoaPods refuses to
// build a Swift pod as a static library without modules, e.g.:
//   "The following Swift pods cannot yet be integrated as static
//   libraries: The Swift pod `AppCheckCore` depends upon `GoogleUtilities`
//   and `RecaptchaInterop`, which do not define modules."
// Discovered running a local dev build for SSO (docs/BACKEND_CHANGES_NEEDED.md
// §S) — without this, `pod install` hard-fails the moment google-signin's
// pod is present, for every prebuild (including EAS Build, which always
// prebuilds from scratch — a manual edit to ios/Podfile does NOT survive
// that). This plugin re-applies the fix on every prebuild instead.
const MODULAR_HEADER_PODS = ["GoogleUtilities", "RecaptchaInterop", "AppCheckCore"];

module.exports = function withGoogleSigninModularHeaders(config) {
  return withPodfile(config, (config) => {
    const { contents } = config.modResults;

    const alreadyApplied = MODULAR_HEADER_PODS.every((pod) =>
      contents.includes(`pod '${pod}', :modular_headers => true`),
    );
    if (alreadyApplied) {
      return config;
    }

    const anchor = "use_expo_modules!";
    const anchorIndex = contents.indexOf(anchor);
    if (anchorIndex === -1) {
      console.warn(
        "[withGoogleSigninModularHeaders] Couldn't find 'use_expo_modules!' in the " +
          "generated Podfile — skipping the modular_headers patch. `pod install` will " +
          "likely fail on GoogleUtilities/RecaptchaInterop/AppCheckCore. See " +
          "docs/BACKEND_CHANGES_NEEDED.md §S.",
      );
      return config;
    }

    const lineEnd = contents.indexOf("\n", anchorIndex);
    const insertAt = lineEnd === -1 ? contents.length : lineEnd + 1;
    const insertion = MODULAR_HEADER_PODS.map(
      (pod) => `  pod '${pod}', :modular_headers => true`,
    ).join("\n");

    config.modResults.contents =
      contents.slice(0, insertAt) + insertion + "\n" + contents.slice(insertAt);

    return config;
  });
};
