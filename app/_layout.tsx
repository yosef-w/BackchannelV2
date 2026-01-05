import { useColorScheme } from '@/hooks/use-color-scheme';
import { RevenueCatProvider } from '@/providers/RevenueCatProvider';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
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
  );
}
