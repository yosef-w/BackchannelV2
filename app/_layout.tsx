import { AppToast } from "@/components/ui/AppToast";
import {
    initAnalytics,
    setUserProperties,
    trackAppOpened,
} from "@/lib/analytics/mixpanel";
import { initSentry, sentryWrap } from "@/lib/sentry";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import {
    focusManager,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
// Imported from each weight's own subpath, NOT the package's barrel index
// — the barrel unconditionally `require()`s every weight (100–900, each
// with an italic), so importing from it bundles ~1MB of fonts this app
// never uses. Subpath imports pull in only the five weights below.
import { DMSans_300Light } from "@expo-google-fonts/dm-sans/300Light";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display/400Regular";
import { DMSerifDisplay_400Regular_Italic } from "@expo-google-fonts/dm-serif-display/400Regular_Italic";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Initialize crash reporting at module scope — before any UI mounts — so
// even crashes during the very first render are captured. No-ops when
// EXPO_PUBLIC_SENTRY_DSN is unset (see lib/sentry.ts).
initSentry();

// Hold the native launch screen up until the design-system fonts
// (constants/theme.ts's Fonts.serif/.sans) are loaded — without this, RN
// briefly renders headlines in the platform default font, then swaps to
// the serif once loading finishes (a visible flash-of-unstyled-text on
// every cold start). Paired with the hideAsync() call below. Failing to
// call this before it auto-hides would just mean losing the hold — never
// a crash — so this is safe even if it somehow runs twice.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Create ONE QueryClient for the entire app.
 * useRef ensures it persists across re-renders.
 */
function RootLayout() {
  // Keys here MUST match constants/theme.ts's Fonts values exactly — that
  // file documents which weight is for what, this just supplies the bytes.
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    // Release the native launch screen once fonts resolve either way — a
    // font-load failure (fontError) must not strand the user on the
    // launch screen forever; RN falls back to the platform default font
    // in that case, which is a visual regression, not a broken app.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

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

  // React Query's `refetchOnWindowFocus` relies on browser focus events, which
  // don't exist in React Native — so without this bridge the setting is a
  // silent no-op and lists (matches, "interested in you", etc.) never refresh
  // when the app returns to the foreground. Wire focusManager to AppState so
  // every query re-validates on foreground, the way it would on the web.
  useEffect(() => {
    const onAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === "active");
    };
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  const loadTokens = useAuthStore((state) => state.loadTokens);
  const loadUserProfileData = useUserProfileStore(
    (state) => state.loadFromStorage,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const flushSyncNow = useUserProfileStore((state) => state.flushSyncNow);
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
   * 🔄 Push any pending local edits, then fetch latest profile from
   * backend, once authenticated.
   *
   * flushSyncNow() runs first — if the app was killed with dirty fields
   * still pending (the 2s debounce never fired, or the request was in
   * flight), loadFromStorage() restored `needsSync`/`dirtyFields` from
   * AsyncStorage on startup, and this is what actually retries pushing
   * them instead of leaving the edit stuck on-device forever. Flushing
   * before fetching means the subsequent pull already reflects the
   * just-pushed edit rather than racing it.
   */
  useEffect(() => {
    if (accessToken) {
      flushSyncNow()
        .catch((error) => {
          console.warn("[Layout] Failed to flush pending profile sync:", error);
        })
        .finally(() => {
          fetchFromBackend()
            .then(() => {
              // Enrich the Mixpanel People record from the freshly-fetched
              // profile. Login only knows the email (identifyUser at the
              // AuthScreen is deliberately lean); without this, accounts
              // that log in — rather than sign up — show up in Mixpanel
              // with no name/company/verification state, which makes the
              // People view useless for matching testers to behavior.
              const { data, workEmailVerified } =
                useUserProfileStore.getState();
              setUserProperties({
                firstName: data.personal.firstName || undefined,
                lastName: data.personal.lastName || undefined,
                email: data.personal.email || undefined,
                company: data.professional.company || undefined,
                jobTitle: data.professional.title || undefined,
                location: data.personal.address.city || undefined,
                currentRole: data.professional.currentRole || undefined,
                workEmailVerified,
              });
            })
            .catch((error) => {
              console.warn(
                "[Layout] Failed to sync profile from backend:",
                error,
              );
              // Don't show error to user - they'll just see cached data or login screen
            });
        });
    }
  }, [accessToken, fetchFromBackend, flushSyncNow]);

  // Nothing renders until fonts resolve — the native launch screen (held
  // open above) covers this gap, so there's no visible blank frame. Safe
  // to early-return here: every hook above runs unconditionally regardless
  // of this branch, so hook order never changes between renders.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {/* Every screen in this app hardcodes a white background and
          dark-content status bar — there's no dark-mode styling anywhere
          (the scaffold's ThemedText/ThemedView/useColorScheme were removed
          as dead code — see docs/AUDIT_REMEDIATION_PLAN.md Phase 1).
          Following the system color scheme here previously left dark-mode
          users with mismatched nav chrome and, via StatusBar style="auto",
          a light status bar rendered on a white background. Pin to light
          until the app actually supports dark mode end-to-end. */}
      <ThemeProvider value={DefaultTheme}>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="dark" />

          {/* Main navigation stack for BackChannel */}
          <Stack initialRouteName="splash">
            <Stack.Screen name="splash" options={{ headerShown: false }} />
            <Stack.Screen name="choose-role" options={{ headerShown: false }} />
            {/* Role-tailored product films — splash → choose-role → intro
                (IntroCinema or SponsorCinema by ?mode=) → onboarding. */}
            <Stack.Screen name="intro" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            {/* Direct sign-in entry for returning users — skips role
                selection and the onboarding slides. */}
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            {/* Legacy alias — redirects into the (tabs) shell, preserving
                ?tab= / ?mode= params from older navigation call sites. */}
            <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
                // Prevent iOS swipe-back from ever leaving the authenticated
                // shell — tab switching happens inside the Tabs navigator.
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

// Sentry's root wrapper adds the top-level error boundary + touch/navigation
// instrumentation. Harmless no-op shell when the DSN isn't configured.
export default sentryWrap(RootLayout);
