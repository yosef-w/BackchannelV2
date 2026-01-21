import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

/**
 * 🔑 Secure token storage keys
 */
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * 🛡️ Auth state interface
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuthTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

/**
 * 🔐 Zustand auth store with SecureStore persistence
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Save tokens to Zustand + SecureStore
   */
  setAuthTokens: async (accessToken: string, refreshToken: string) => {
    try {
      // Persist to SecureStore
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);

      // Update Zustand state
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });
    } catch (error) {
      // Fail gracefully - update state even if persistence fails
      console.warn("Failed to persist tokens to SecureStore:", error);
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });
    }
  },

  /**
   * Clear all auth data
   */
  clearAuth: async () => {
    try {
      // Remove from SecureStore
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to clear tokens from SecureStore:", error);
    }

    // Always clear Zustand state
    set({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  /**
   * Load tokens from SecureStore on app startup
   */
  loadTokens: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      ]);

      if (accessToken && refreshToken) {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.warn("Failed to load tokens from SecureStore:", error);
      // Fail gracefully - set state to logged out
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
