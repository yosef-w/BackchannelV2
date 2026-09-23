/**
 * Renders in place of the entire app when a render-time exception escapes a
 * screen — see app/_layout.tsx, where this is passed as SentryErrorBoundary's
 * `fallback`. Without this, a JS crash previously had no recovery path: the
 * error was reported to Sentry, then the app hard-exited to the home screen
 * with nothing the user could do about it (see lib/sentry.ts's SentryErrorBoundary
 * doc comment for why Sentry.wrap alone doesn't provide this).
 *
 * `resetError` re-renders the crashed subtree from scratch — it does not
 * reset navigation or app state, so a crash caused by corrupt persisted
 * state could recur immediately. That's an acceptable tradeoff here: it's
 * still strictly better than the app being unusable until force-quit, and
 * matches what Sentry's own ErrorBoundary is designed to do.
 */

import { Colors, Radii, Spacing, Type } from "@/constants/theme";
import { RefreshCw } from "@/components/ui/icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formColumn } from "@/lib/responsive";

export function AppErrorFallback({
  resetError,
}: {
  resetError: () => void;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.headline}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. We&apos;ve been notified — try
          picking up where you left off.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={resetError}
          activeOpacity={0.8}
        >
          <RefreshCw color={Colors.paper} size={17} strokeWidth={2.2} />
          <Text style={styles.buttonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
  content: {
    ...formColumn,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
  },
  headline: {
    ...Type.heading,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 28,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.ink,
    borderRadius: Radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: { color: Colors.paper, fontSize: 15, fontWeight: "800" },
});
