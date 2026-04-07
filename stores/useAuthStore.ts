import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ROLE_KEY = "user_role";

/**
 * Base URL used for direct token refresh calls.
 * Defined here to avoid a circular dependency: useAuthStore → authApi → api → useAuthStore.
 */
const API_BASE_URL = "https://oyster-app-4pg5w.ondigitalocean.app";

/**
 * Decode the `exp` claim from a JWT without any external library.
 * Returns null when the token has no expiry or is malformed.
 */
function getTokenExpiry(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(base64));
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns true when the access token has expired or will expire within 30 seconds.
 * The 30-second buffer allows proactive refresh before the first API call fails.
 */
function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return false; // no expiry claim → treat as permanently valid
  return Date.now() >= (exp - 30) * 1000;
}

/**
 * 🛡️ Auth state interface
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** Role returned by the login endpoint (PR #19). Null until first login. */
  role: "Applicant" | "Sponsor" | null;
  /**
   * Expo push token registered with the backend for this device.
   * Set after a successful registerDevice() call; cleared on logout.
   * Not persisted to SecureStore — re-registered on every app launch.
   */
  deviceToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  /**
   * Persist tokens and optionally the user role.
   * Pass `role` at login/registration; omit it during silent token refreshes
   * so the stored role is preserved.
   */
  setAuthTokens: (
    accessToken: string,
    refreshToken: string,
    role?: "Applicant" | "Sponsor",
  ) => Promise<void>;
  /** Store the Expo push token after a successful registerDevice() call. */
  setDeviceToken: (token: string | null) => void;
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
  role: null,
  deviceToken: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Persist tokens (and optionally role) to SecureStore and update Zustand state.
   * When called during a silent token refresh, `role` is omitted so the existing
   * stored role is not overwritten.
   */
  setAuthTokens: async (
    accessToken: string,
    refreshToken: string,
    role?: "Applicant" | "Sponsor",
  ) => {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      if (role !== undefined) {
        await SecureStore.setItemAsync(ROLE_KEY, role);
      }
    } catch (error) {
      // Fail gracefully — state is always updated even if persistence fails.
      console.warn("[Auth] Failed to persist tokens:", error);
    }
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
      ...(role !== undefined ? { role } : {}),
    });
  },

  /** Update the stored Expo push token (called after registerDevice succeeds). */
  setDeviceToken: (token: string | null) => {
    set({ deviceToken: token });
  },

  /**
   * Clear all auth data from SecureStore and Zustand.
   */
  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(ROLE_KEY);
    } catch (error) {
      console.warn("[Auth] Failed to clear tokens:", error);
    }
    set({
      accessToken: null,
      refreshToken: null,
      role: null,
      deviceToken: null,
      isAuthenticated: false,
    });
  },

  /**
   * Load persisted tokens on app startup.
   *
   * If the stored access token has expired (or will expire within 30 s) the
   * store silently attempts a refresh *before* marking the user as
   * authenticated.  This means the very first API call after startup always
   * has a valid token and never triggers a reactive 401 flow.
   */
  loadTokens: async () => {
    try {
      const [accessToken, refreshToken, storedRole] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(ROLE_KEY),
      ]);

      // Validate the stored role string against the union type.
      const role: "Applicant" | "Sponsor" | null =
        storedRole === "Applicant" || storedRole === "Sponsor"
          ? storedRole
          : null;

      if (!accessToken || !refreshToken) {
        set({
          accessToken: null,
          refreshToken: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      if (isTokenExpired(accessToken)) {
        // Stage the refresh token + role so refreshAccessToken() can read them.
        set({ refreshToken, role });
        const refreshed = await useAuthStore.getState().refreshAccessToken();
        if (!refreshed) {
          // Both tokens are expired — the user must log in again.
          set({
            accessToken: null,
            refreshToken: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }
        // setAuthTokens was already called inside refreshAccessToken; role already in state.
        set({ isLoading: false });
        return;
      }

      set({
        accessToken,
        refreshToken,
        role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.warn("[Auth] Failed to load tokens:", error);
      set({
        accessToken: null,
        refreshToken: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * Silently refresh the access token using the stored refresh token.
   *
   * Uses a plain fetch() call directly against the API so we avoid a circular
   * dependency (useAuthStore → authApi → ApiClient → useAuthStore).
   *
   * Returns true on success; returns false and clears auth if the session has
   * fully expired.
   */
  refreshAccessToken: async () => {
    const { refreshToken } = useAuthStore.getState();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        await useAuthStore.getState().clearAuth();
        return false;
      }

      const data = await response.json();
      if (!data?.access) {
        await useAuthStore.getState().clearAuth();
        return false;
      }

      // Backend only returns a new access token — reuse the existing refresh token.
      await useAuthStore.getState().setAuthTokens(data.access, refreshToken);
      return true;
    } catch (error) {
      console.warn("[Auth] Token refresh failed:", error);
      await useAuthStore.getState().clearAuth();
      return false;
    }
  },
}));
