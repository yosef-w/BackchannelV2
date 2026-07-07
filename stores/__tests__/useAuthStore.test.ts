/**
 * Contract tests for the auth store — token persistence, cold-start
 * hydration, and the silent-refresh path the ApiClient depends on:
 *   1. setAuthTokens persists to SecureStore; role is preserved when omitted
 *      (silent refreshes must not wipe the stored role)
 *   2. clearAuth wipes both storage and state
 *   3. loadTokens: absent → unauthenticated; valid → authenticated;
 *      expired-but-refreshable → refreshed before isAuthenticated flips
 *   4. refreshAccessToken: success reuses the refresh token; any failure
 *      (HTTP, malformed body, network) clears auth and returns false
 */

jest.mock("expo-secure-store", () => {
  const mockStorage = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mockStorage.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => mockStorage.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      mockStorage.delete(k);
    }),
    __storage: mockStorage,
  };
});

import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../useAuthStore";

const secureStorage = (SecureStore as unknown as { __storage: Map<string, string> })
  .__storage;

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

/** Build a syntactically valid JWT whose exp claim is `inSeconds` from now. */
function makeJwt(inSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + inSeconds }),
  ).toString("base64");
  return `header.${payload}.sig`;
}

const store = () => useAuthStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  secureStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    role: null,
    deviceToken: null,
    isAuthenticated: false,
    isLoading: true,
  });
});

describe("setAuthTokens", () => {
  it("persists tokens + role and flips isAuthenticated", async () => {
    await store().setAuthTokens("acc-1", "ref-1", "Applicant");
    expect(secureStorage.get("access_token")).toBe("acc-1");
    expect(secureStorage.get("refresh_token")).toBe("ref-1");
    expect(secureStorage.get("user_role")).toBe("Applicant");
    expect(store().isAuthenticated).toBe(true);
    expect(store().role).toBe("Applicant");
  });

  it("preserves the stored role when called without one (silent refresh)", async () => {
    await store().setAuthTokens("acc-1", "ref-1", "Sponsor");
    await store().setAuthTokens("acc-2", "ref-1"); // refresh: no role arg
    expect(store().role).toBe("Sponsor");
    expect(secureStorage.get("user_role")).toBe("Sponsor");
    expect(store().accessToken).toBe("acc-2");
  });
});

describe("clearAuth", () => {
  it("wipes SecureStore and resets state", async () => {
    await store().setAuthTokens("acc-1", "ref-1", "Applicant");
    store().setDeviceToken("push-token");
    await store().clearAuth();

    expect(secureStorage.size).toBe(0);
    expect(store()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      role: null,
      deviceToken: null,
      isAuthenticated: false,
    });
  });
});

describe("loadTokens (cold start)", () => {
  it("lands unauthenticated with isLoading=false when nothing is stored", async () => {
    await store().loadTokens();
    expect(store().isAuthenticated).toBe(false);
    expect(store().isLoading).toBe(false);
  });

  it("hydrates a valid (unexpired) session without any network call", async () => {
    secureStorage.set("access_token", makeJwt(3600));
    secureStorage.set("refresh_token", "ref-1");
    secureStorage.set("user_role", "Applicant");

    await store().loadTokens();

    expect(store().isAuthenticated).toBe(true);
    expect(store().role).toBe("Applicant");
    expect(store().isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently refreshes an expired access token BEFORE marking authenticated", async () => {
    secureStorage.set("access_token", makeJwt(-60)); // already expired
    secureStorage.set("refresh_token", "ref-1");
    secureStorage.set("user_role", "Sponsor");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: "fresh-access" }),
    });

    await store().loadTokens();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, config] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/token/refresh/");
    expect(JSON.parse(config.body)).toEqual({ refresh: "ref-1" });
    expect(store().accessToken).toBe("fresh-access");
    expect(store().isAuthenticated).toBe(true);
    expect(store().role).toBe("Sponsor");
    expect(store().isLoading).toBe(false);
  });

  it("lands unauthenticated when the expired token cannot be refreshed", async () => {
    secureStorage.set("access_token", makeJwt(-60));
    secureStorage.set("refresh_token", "ref-dead");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    await store().loadTokens();

    expect(store().isAuthenticated).toBe(false);
    expect(store().accessToken).toBeNull();
    expect(store().isLoading).toBe(false);
  });

  it("ignores an invalid stored role string", async () => {
    secureStorage.set("access_token", makeJwt(3600));
    secureStorage.set("refresh_token", "ref-1");
    secureStorage.set("user_role", "Admin"); // not in the union
    await store().loadTokens();
    expect(store().role).toBeNull();
    expect(store().isAuthenticated).toBe(true);
  });
});

describe("refreshAccessToken", () => {
  it("returns false immediately when there is no refresh token", async () => {
    expect(await store().refreshAccessToken()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the new access token and REUSES the existing refresh token", async () => {
    useAuthStore.setState({ refreshToken: "ref-1" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: "fresh-access" }),
    });

    expect(await store().refreshAccessToken()).toBe(true);
    expect(store().accessToken).toBe("fresh-access");
    expect(store().refreshToken).toBe("ref-1");
    expect(secureStorage.get("refresh_token")).toBe("ref-1");
  });

  it("clears auth and returns false on an HTTP failure", async () => {
    useAuthStore.setState({ refreshToken: "ref-dead", accessToken: "old" });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    expect(await store().refreshAccessToken()).toBe(false);
    expect(store().accessToken).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it("clears auth and returns false when the body has no access token", async () => {
    useAuthStore.setState({ refreshToken: "ref-1" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    expect(await store().refreshAccessToken()).toBe(false);
    expect(store().isAuthenticated).toBe(false);
  });

  it("clears auth and returns false on a network error", async () => {
    useAuthStore.setState({ refreshToken: "ref-1", accessToken: "old" });
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));

    expect(await store().refreshAccessToken()).toBe(false);
    expect(store().accessToken).toBeNull();
  });
});
