import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

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
  refreshAccessToken: () => Promise<boolean>;
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
      console.log("[Auth] Saving tokens to SecureStore...");
      console.log(
        "[Auth] Access token preview:",
        accessToken.substring(0, 20) + "...",
      );
      // Persist to SecureStore
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);

      // Update Zustand state
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });
      console.log("[Auth] Tokens saved successfully");
    } catch (error) {
      // Fail gracefully - update state even if persistence fails
      console.warn("[Auth] Failed to persist tokens to SecureStore:", error);
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
      console.log("[Auth] Loading tokens from SecureStore...");
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      ]);

      if (accessToken && refreshToken) {
        console.log("[Auth] Tokens found, setting authenticated state");
        console.log(
          "[Auth] Access token preview:",
          accessToken.substring(0, 20) + "...",
        );
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        console.log("[Auth] No tokens found in SecureStore");
        set({
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.warn("[Auth] Failed to load tokens from SecureStore:", error);
      // Fail gracefully - set state to logged out
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * Refresh the access token using the refresh token
   * Returns true if successful, false if refresh fails (user needs to re-login)
   */
  refreshAccessToken: async () => {
    const currentRefreshToken = useAuthStore.getState().refreshToken;

    if (!currentRefreshToken) {
      console.warn("[Auth] No refresh token available");
      return false;
    }

    try {
      console.log("[Auth] Refreshing access token...");
      const { authApi } = await import("@/lib/auth-api");
      const response = await authApi.refreshToken(currentRefreshToken);

      // Check if response has valid tokens
      if (!response || !response.access) {
        console.error("[Auth] Invalid refresh response - missing tokens");
        await useAuthStore.getState().clearAuth();
        return false;
      }

      // Backend only returns a new access token — keep the existing refresh token
      await useAuthStore
        .getState()
        .setAuthTokens(response.access, currentRefreshToken);

      console.log("[Auth] Token refresh successful");
      return true;
    } catch (error) {
      console.error("[Auth] Token refresh failed:", error);
      // Clear auth state on refresh failure - silently log user out
      console.log("[Auth] Clearing expired tokens...");
      await useAuthStore.getState().clearAuth();
      return false;
    }
  },
}));
