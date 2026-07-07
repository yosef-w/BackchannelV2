// jest-expo is Expo's official preset for SDK 54 — it wires up the Babel/
// Metro-compatible transforms so imports of react-native / expo-* modules
// work inside tests without custom transformIgnorePatterns fiddling.
//
// Tests live in __tests__/ folders next to the code they cover (or any
// *.test.ts file). Current coverage is the pure-logic layer (transforms,
// validators, formatters); component/render tests would need
// @testing-library/react-native added later.
module.exports = {
  preset: "jest-expo",
  // Honor the tsconfig "@/*" path alias inside tests.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  // Keep test discovery out of build artifacts and the repo's docs.
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/.expo/"],
};
