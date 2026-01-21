import { useColorScheme } from '@/hooks/use-color-scheme';
import { RevenueCatProvider } from '@/providers/RevenueCatProvider';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfileStore } from '@/stores/useUserProfileStore';

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
  const loadUserProfileData = useUserProfileStore((state) => state.loadFromStorage);
  const fetchFromBackend = useUserProfileStore((state) => state.fetchFromBackend);
  const accessToken = useAuthStore((state) => state.accessToken);

  /**
   * 🔄 Load persisted auth tokens and autofill data on app startup
   */
  useEffect(() => {
    const initializeApp = async () => {
      await loadTokens();
      await loadUserProfileData();
    };
    
    initializeApp();
  }, [loadTokens, loadUserProfileData]);

  /**
   * 🔄 Fetch latest profile from backend if authenticated
   */
  useEffect(() => {
    if (accessToken) {
      fetchFromBackend().catch((error) => {
        console.warn('Failed to sync profile from backend, using cached data:', error);
      });
    }
  }, [accessToken, fetchFromBackend]);

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RevenueCatProvider>
          <StatusBar style="auto" />

          {/* Main navigation stack for BackchannelV2 */}
          <Stack initialRouteName="splash">
            <Stack.Screen
              name="splash"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="choose-role"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="dashboard"
              options={{ headerShown: false }}
            />
          </Stack>
        </RevenueCatProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
