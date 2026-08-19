// Graceful wrapper around react-native-keyboard-controller.
//
// The library ships NATIVE code, so it only exists in binaries built after
// it was added (pod install + full rebuild). Importing it directly from an
// older dev-client build — or any binary without the module — THROWS at
// module-evaluation time and takes the whole app down with "doesn't seem
// to be linked". That's a terrible failure mode for what is, at its core,
// a keyboard-scrolling nicety.
//
// This wrapper require()s it inside a try/catch and degrades when absent:
//   - KeyboardProvider        → renders children as-is (no-op passthrough)
//   - KeyboardAwareScrollView → the app's previous behavior: a plain
//     ScrollView inside a KeyboardAvoidingView (resizes for the keyboard,
//     but doesn't chase the focused input)
// New builds get the premium auto-scroll; stale builds keep working with
// yesterday's behavior instead of crashing.

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from "react-native";

type ProviderProps = { children: React.ReactNode };

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  /** Gap kept between the keyboard and the focused input (native impl only). */
  bottomOffset?: number;
  children?: React.ReactNode;
};

let NativeProvider: React.ComponentType<ProviderProps> | null = null;
let NativeAwareScrollView: React.ComponentType<KeyboardAwareScrollViewProps> | null =
  null;

try {
  // require (not import) so the native-module-missing throw is catchable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kc = require("react-native-keyboard-controller");
  NativeProvider = kc.KeyboardProvider;
  NativeAwareScrollView = kc.KeyboardAwareScrollView;
} catch {
  console.warn(
    "[keyboard] react-native-keyboard-controller native module not in this " +
      "binary — using the KeyboardAvoidingView fallback. Rebuild the dev " +
      "client to get keyboard-aware scrolling.",
  );
}

export function KeyboardProvider({ children }: ProviderProps) {
  if (NativeProvider) return <NativeProvider>{children}</NativeProvider>;
  return <>{children}</>;
}

export function KeyboardAwareScrollView({
  bottomOffset,
  ...rest
}: KeyboardAwareScrollViewProps) {
  if (NativeAwareScrollView) {
    return <NativeAwareScrollView bottomOffset={bottomOffset} {...rest} />;
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView {...rest} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
