/**
 * Contract tests for the ApiClient core in lib/api.ts — the shared network
 * path every REST call rides through. These pin down the behaviors that are
 * expensive to discover broken in production:
 *   1. auth header injection (and skipAuth)
 *   2. single-flight token refresh: N concurrent 401s → exactly one refresh,
 *      every caller replayed with the new token
 *   3. refresh failure: every queued caller rejects (no hangs), session-
 *      expired error surfaces
 *   4. observability scrubbing: query strings (which can carry tokens) never
 *      reach Mixpanel/Sentry; 5xx goes to Sentry, 4xx does not
 *   5. error classification: server-provided message > generic fallback;
 *      network vs aborted failures are labeled distinctly
 *   6. multipart uploads ride the same pipeline (no JSON Content-Type, but
 *      full 401 refresh-and-retry)
 */

jest.mock("@/lib/analytics/mixpanel", () => ({
  trackApiError: jest.fn(),
}));
jest.mock("@/lib/sentry", () => ({
  logBreadcrumb: jest.fn(),
  captureApiServerError: jest.fn(),
}));

// Mutable fake auth state the client reads via useAuthStore.getState().
const mockAuthState = {
  accessToken: "old-token" as string | null,
  refreshToken: "refresh-1" as string | null,
  refreshAccessToken: jest.fn<Promise<boolean>, []>(),
  clearAuth: jest.fn(),
};
jest.mock("@/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { trackApiError } from "@/lib/analytics/mixpanel";
import { captureApiServerError, logBreadcrumb } from "@/lib/sentry";
import { api } from "../api";

const mockTrackApiError = trackApiError as jest.Mock;
const mockCaptureServerError = captureApiServerError as jest.Mock;
const mockLogBreadcrumb = logBreadcrumb as jest.Mock;

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

/** Minimal Response stand-in matching what request()/retryWithToken() read. */
function res(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res_, rej) => {
    resolve = res_;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let all currently-settled promise chains run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.accessToken = "old-token";
  mockAuthState.refreshToken = "refresh-1";
});

describe("auth header injection", () => {
  it("attaches Bearer token and JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { ok: true }));
    await api.get("/api/thing/");
    const [, config] = fetchMock.mock.calls[0];
    expect(config.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer old-token",
    });
  });

  it("omits Authorization when there is no token", async () => {
    mockAuthState.accessToken = null;
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await api.get("/api/thing/");
    const [, config] = fetchMock.mock.calls[0];
    expect(config.headers).not.toHaveProperty("Authorization");
  });

  it("skipAuth sends JSON content type but no Authorization", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await api.post("/api/login/", { a: 1 }, true);
    const [, config] = fetchMock.mock.calls[0];
    expect(config.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(config.headers).not.toHaveProperty("Authorization");
  });
});

describe("single-flight token refresh", () => {
  it("three concurrent 401s trigger exactly one refresh; all replay with the new token", async () => {
    const initial = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    let call = 0;
    fetchMock.mockImplementation(() => {
      const i = call++;
      if (i < 3) return initial[i].promise;
      return Promise.resolve(res(200, { ok: true }));
    });

    const refresh = deferred<boolean>();
    mockAuthState.refreshAccessToken.mockReturnValue(refresh.promise);

    const p1 = api.get<{ ok: boolean }>("/api/a/");
    const p2 = api.get<{ ok: boolean }>("/api/b/");
    const p3 = api.get<{ ok: boolean }>("/api/c/");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // First request 401s and takes ownership of the refresh...
    initial[0].resolve(res(401, { detail: "expired" }));
    await flush();
    expect(mockAuthState.refreshAccessToken).toHaveBeenCalledTimes(1);

    // ...the other two 401 while the refresh is in flight and must queue.
    initial[1].resolve(res(401, { detail: "expired" }));
    initial[2].resolve(res(401, { detail: "expired" }));
    await flush();
    expect(mockAuthState.refreshAccessToken).toHaveBeenCalledTimes(1);

    // Refresh lands: state gets the new token, queue drains, all replay.
    mockAuthState.accessToken = "new-token";
    refresh.resolve(true);
    const results = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(mockAuthState.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(6); // 3 originals + 3 retries
    for (const [, config] of fetchMock.mock.calls.slice(3)) {
      expect(config.headers).toMatchObject({
        Authorization: "Bearer new-token",
      });
    }
  });

  it("failed refresh rejects the owner AND every queued caller (no hangs, no retries)", async () => {
    const initial = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    let call = 0;
    fetchMock.mockImplementation(() => {
      const i = call++;
      if (i < 3) return initial[i].promise;
      return Promise.resolve(res(200, {}));
    });

    const refresh = deferred<boolean>();
    mockAuthState.refreshAccessToken.mockReturnValue(refresh.promise);

    const p1 = api.get("/api/a/");
    const p2 = api.get("/api/b/");
    const p3 = api.get("/api/c/");
    await flush();
    initial[0].resolve(res(401, {}));
    await flush();
    initial[1].resolve(res(401, {}));
    initial[2].resolve(res(401, {}));
    await flush();

    refresh.resolve(false); // both tokens dead
    const results = await Promise.allSettled([p1, p2, p3]);

    for (const r of results) {
      expect(r.status).toBe("rejected");
      expect((r as PromiseRejectedResult).reason.message).toBe(
        "Session expired. Please log in again.",
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(3); // no retries after failed refresh
  });

  it("a second 401 burst after a completed refresh triggers a fresh refresh (state not stuck)", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValueOnce(res(200, { ok: 1 }))
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValueOnce(res(200, { ok: 2 }));
    mockAuthState.refreshAccessToken.mockImplementation(async () => {
      mockAuthState.accessToken = "new-token";
      return true;
    });

    await expect(api.get("/api/a/")).resolves.toEqual({ ok: 1 });
    await expect(api.get("/api/b/")).resolves.toEqual({ ok: 2 });
    expect(mockAuthState.refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it("does NOT attempt refresh for skipAuth requests", async () => {
    fetchMock.mockResolvedValueOnce(res(401, { detail: "bad creds" }));
    await expect(api.post("/api/login/", {}, true)).rejects.toThrow(
      "bad creds",
    );
    expect(mockAuthState.refreshAccessToken).not.toHaveBeenCalled();
  });
});

describe("failure reporting + scrubbing", () => {
  it("scrubs query strings (which can carry tokens) before reporting", async () => {
    fetchMock.mockResolvedValueOnce(res(500, { error: "boom" }));
    await expect(api.get("/api/thing/?token=secret123")).rejects.toThrow(
      "boom",
    );

    expect(mockTrackApiError).toHaveBeenCalledWith({
      endpoint: "/api/thing/",
      statusOrReason: "500",
    });
    // The secret must not appear in ANY observability payload.
    const allArgs = JSON.stringify([
      mockTrackApiError.mock.calls,
      mockCaptureServerError.mock.calls,
      mockLogBreadcrumb.mock.calls,
    ]);
    expect(allArgs).not.toContain("secret123");
  });

  it("5xx reaches Sentry, 4xx does not", async () => {
    fetchMock.mockResolvedValueOnce(res(500, { error: "server down" }));
    await expect(api.get("/api/a/")).rejects.toThrow("server down");
    expect(mockCaptureServerError).toHaveBeenCalledTimes(1);

    mockCaptureServerError.mockClear();
    fetchMock.mockResolvedValueOnce(res(400, { error: "bad input" }));
    await expect(api.get("/api/b/")).rejects.toThrow("bad input");
    expect(mockCaptureServerError).not.toHaveBeenCalled();
    expect(mockTrackApiError).toHaveBeenCalledWith({
      endpoint: "/api/b/",
      statusOrReason: "400",
    });
  });

  it("network failure is labeled 'network' and rethrown", async () => {
    const netErr = new TypeError("Network request failed");
    fetchMock.mockRejectedValueOnce(netErr);
    await expect(api.get("/api/a/")).rejects.toBe(netErr);
    expect(mockTrackApiError).toHaveBeenCalledWith({
      endpoint: "/api/a/",
      statusOrReason: "network",
    });
    expect(mockCaptureServerError).not.toHaveBeenCalled();
  });

  it("aborted requests are labeled 'aborted', not 'network'", async () => {
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortErr);
    await expect(api.get("/api/a/")).rejects.toBe(abortErr);
    expect(mockTrackApiError).toHaveBeenCalledWith({
      endpoint: "/api/a/",
      statusOrReason: "aborted",
    });
  });

  it("prefers server error/detail/message fields over the generic fallback", async () => {
    fetchMock.mockResolvedValueOnce(res(422, { detail: "salary is required" }));
    await expect(api.post("/api/jobs/", {})).rejects.toThrow(
      "salary is required",
    );

    fetchMock.mockResolvedValueOnce(res(418, {}));
    await expect(api.get("/api/teapot/")).rejects.toThrow("API Error: 418");
  });
});

describe("multipart uploads", () => {
  it("sends FormData with auth but WITHOUT a JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { cdn_url: "x" }));
    const form = new FormData();
    await api.postMultipart("/api/upload/image/", form);

    const [, config] = fetchMock.mock.calls[0];
    expect(config.body).toBe(form);
    expect(config.headers).toMatchObject({
      Authorization: "Bearer old-token",
    });
    expect(config.headers).not.toHaveProperty("Content-Type");
  });

  it("participates in 401 refresh-and-retry (the old raw-fetch path did not)", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValueOnce(res(200, { cdn_url: "https://cdn/x.jpg" }));
    mockAuthState.refreshAccessToken.mockImplementation(async () => {
      mockAuthState.accessToken = "new-token";
      return true;
    });

    const form = new FormData();
    await expect(api.postMultipart("/api/upload/image/", form)).resolves.toEqual({
      cdn_url: "https://cdn/x.jpg",
    });

    const [, retryConfig] = fetchMock.mock.calls[1];
    expect(retryConfig.body).toBe(form);
    expect(retryConfig.headers).toMatchObject({
      Authorization: "Bearer new-token",
    });
    expect(retryConfig.headers).not.toHaveProperty("Content-Type");
  });
});
