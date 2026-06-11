import { AppToast } from "@/components/ui/AppToast";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { initAnalytics, trackAppOpened } from "@/lib/analytics/mixpanel";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/**
 * Create ONE QueryClient for the entire app.
 * useRef ensures it persists across re-renders.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 1000 * 60, // 1 minute
          refetchOnWindowFocus: true,
        },
      },
    });
  }

  const loadTokens = useAuthStore((state) => state.loadTokens);
  const loadUserProfileData = useUserProfileStore(
    (state) => state.loadFromStorage,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const accessToken = useAuthStore((state) => state.accessToken);
  const initSubscriptions = useSubscriptionStore((state) => state.initialize);

  /**
   * 🔄 Load persisted auth tokens and autofill data on app startup.
   * Also boots Mixpanel and RevenueCat (when PREMIUM_ENABLED) and fires the
   * App Opened event — all are fire-and-forget and never throw into the app
   * boot path.
   */
  useEffect(() => {
    const initializeApp = async () => {
      // Kick off analytics first; it's async but we don't await it because
      // nothing downstream depends on it.
      initAnalytics().then(() => trackAppOpened());
      // Boot RevenueCat in the background. The store is a no-op when
      // PREMIUM_ENABLED = false so this is safe to call unconditionally.
      initSubscriptions();
      await loadTokens();
      await loadUserProfileData();
    };

    initializeApp();
  }, [loadTokens, loadUserProfileData, initSubscriptions]);

  /**
   * 🔄 Fetch latest profile from backend if authenticated
   */
  useEffect(() => {
    if (accessToken) {
      fetchFromBackend().catch((error) => {
        console.warn("[Layout] Failed to sync profile from backend:", error);
        // Don't show error to user - they'll just see cached data or login screen
      });
    }
  }, [accessToken, fetchFromBackend]);

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="auto" />

          {/* Main navigation stack for Backchannel */}
          <Stack initialRouteName="splash">
            <Stack.Screen name="splash" options={{ headerShown: false }} />
            <Stack.Screen name="choose-role" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="dashboard"
              options={{
                headerShown: false,
                // Prevent iOS swipe-back from ever leaving the dashboard.
                // All in-app navigation is handled by MainApp's own view state.
                gestureEnabled: false,
              }}
            />
            {/* Deep-link target for `backchannelv2://verify-email?token=…` */}
            <Stack.Screen
              name="verify-email"
              options={{ headerShown: false }}
            />
            {/* Deep-link target for `backchannelv2://reset-password?token=…` */}
            <Stack.Screen
              name="reset-password"
              options={{ headerShown: false }}
            />
          </Stack>

          {/* Global toast — overlays all screens */}
          <AppToast />
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
