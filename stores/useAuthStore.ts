import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ROLE_KEY = "user_role";
const HAS_PASSWORD_KEY = "has_password";

/**
 * Base URL used for direct token refresh calls.
 * Defined here (reading the same env var lib/api.ts does, rather than
 * importing it) to avoid a circular dependency: useAuthStore → authApi → api
 * → useAuthStore. Must stay in sync with EXPO_PUBLIC_API_BASE_URL so a
 * staging/dev build's token refresh doesn't silently hit production.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://oyster-app-4pg5w.ondigitalocean.app";

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
   * Whether this account has a password set. False only for a pure-SSO
   * account (backend's `has_password` on the SSO response) — drives the
   * Privacy & Security screen's "Set a Password" UX, since the password-
   * gated flows there (change password/email, delete account) return 400
   * for a passwordless account. Defaults true: every non-SSO path
   * (password login, registration) implies one, and treating an unknown as
   * "has one" degrades to the backend's own guidance message rather than
   * hiding a working flow.
   */
  hasPassword: boolean;
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
  /** Persist the has-password flag (SSO sign-in responses carry it). */
  setHasPassword: (hasPassword: boolean) => Promise<void>;
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
  hasPassword: true,
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

  /**
   * Persist whether the account has a password. Set false from an SSO
   * response's `has_password`; set true on any password login (self-
   * evident) and on the next SSO sign-in after the user sets one via the
   * forgot-password flow.
   */
  setHasPassword: async (hasPassword: boolean) => {
    try {
      await SecureStore.setItemAsync(
        HAS_PASSWORD_KEY,
        hasPassword ? "true" : "false",
      );
    } catch (error) {
      console.warn("[Auth] Failed to persist has_password:", error);
    }
    set({ hasPassword });
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
      await SecureStore.deleteItemAsync(HAS_PASSWORD_KEY);
    } catch (error) {
      console.warn("[Auth] Failed to clear tokens:", error);
    }
    set({
      accessToken: null,
      refreshToken: null,
      role: null,
      hasPassword: true,
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
      const [accessToken, refreshToken, storedRole, storedHasPassword] =
        await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
          SecureStore.getItemAsync(ROLE_KEY),
          SecureStore.getItemAsync(HAS_PASSWORD_KEY),
        ]);

      // Validate the stored role string against the union type.
      const role: "Applicant" | "Sponsor" | null =
        storedRole === "Applicant" || storedRole === "Sponsor"
          ? storedRole
          : null;
      // Only an explicit stored "false" means passwordless — absent (every
      // pre-SSO install) defaults to true, matching the field's contract.
      const hasPassword = storedHasPassword !== "false";

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
        set({ refreshToken, role, hasPassword });
        const refreshed = await useAuthStore.getState().refreshAccessToken();
        if (!refreshed) {
          // refreshAccessToken() only calls clearAuth() (which nulls
          // refreshToken) on a genuine 401/403 rejection — a transient
          // failure (network blip, 5xx, malformed 200) deliberately leaves
          // the staged tokens untouched. Use that to tell the two apart
          // here too, the same distinction lib/api.ts's callers already
          // make, instead of treating every `false` as proof both tokens
          // are dead.
          if (!useAuthStore.getState().refreshToken) {
            // Genuinely expired — clearAuth() already reset everything.
            set({ isLoading: false });
            return;
          }
          // Transient — don't force a real, still-logged-in user back to
          // the login screen over a network blip at cold start. Stay
          // optimistically authenticated with the (expired) access token;
          // the first real API call's own reactive-401 refresh handles it
          // properly once the network is back.
          set({ accessToken, isAuthenticated: true, isLoading: false });
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
        hasPassword,
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
   * Returns true on success; returns false otherwise. Auth is only actually
   * cleared when the refresh token itself is genuinely rejected (401/403) —
   * a real expiry. Everything else (a network blip, a timeout, a 5xx from
   * the refresh endpoint, a malformed-but-200 response) fails just this one
   * attempt and leaves the stored tokens intact, so a request that happened
   * to need a refresh during a bad connection doesn't force-log-out a user
   * who's still genuinely authenticated — the previous version treated ANY
   * failure here, including a plain fetch() throw from being offline, as
   * full session expiry.
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
        if (response.status === 401 || response.status === 403) {
          // The refresh token itself was rejected — a real expiry.
          await useAuthStore.getState().clearAuth();
        } else {
          console.warn(
            `[Auth] Token refresh got a transient error (${response.status}) — leaving the session intact for a later retry.`,
          );
        }
        return false;
      }

      const data = await response.json();
      if (!data?.access) {
        // A 2xx with a missing field reads as a backend hiccup, not proof
        // the session is invalid (a genuinely rejected refresh token comes
        // back as 401/403, not 200) — don't clear auth over it.
        console.warn(
          "[Auth] Token refresh returned 200 with no access token — leaving the session intact for a later retry.",
        );
        return false;
      }

      // Backend only returns a new access token — reuse the existing refresh token.
      await useAuthStore.getState().setAuthTokens(data.access, refreshToken);
      return true;
    } catch (error) {
      // fetch() itself threw — offline, DNS, timeout, TLS blip. Not
      // evidence the session is invalid; leave auth intact.
      console.warn(
        "[Auth] Token refresh request failed (network) — leaving the session intact for a later retry:",
        error,
      );
      return false;
    }
  },
}));
