// jest-expo is Expo's official preset (SDK 57) — it wires up the Babel/
// Metro-compatible transforms so imports of react-native / expo-* modules
// work inside tests without custom transformIgnorePatterns fiddling.
//
// Tests live in __tests__/ folders next to the code they cover (or any
// *.test.ts file). Pure-logic tests plus a handful of component smoke tests
// via @testing-library/react-native.
const preset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  // Reanimated 4 runs on react-native-worklets, whose resolver keeps Jest off
  // the `.native` entry points (they need the real worklets runtime).
  resolver: "react-native-worklets/jest/resolver",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // @sentry/* ships untranspiled ESM; jest-expo's list only covers
  // @sentry/react-native, so widen it to the whole scope.
  transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
    pattern.replace("@sentry/react-native", "@sentry"),
  ),
  // Honor the tsconfig "@/*" path alias inside tests.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  // Keep test discovery out of build artifacts and the repo's docs.
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/.expo/"],
};
