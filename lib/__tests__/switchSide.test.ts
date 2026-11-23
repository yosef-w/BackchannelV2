import type { QueryClient } from "@tanstack/react-query";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));
jest.mock("@/lib/analytics/mixpanel", () => ({ trackSideSwitched: jest.fn() }));

let mockOffline = false;
jest.mock("@/lib/network", () => ({ isOfflineNow: jest.fn(async () => mockOffline) }));
const mockToasts: string[] = [];
jest.mock("@/stores/useToastStore", () => ({
  useToastStore: { getState: () => ({ showToast: (m: string) => mockToasts.push(m) }) },
}));
const mockSetUserType = jest.fn();
jest.mock("@/stores/useOnboardingStore", () => ({
  useOnboardingStore: { getState: () => ({ setUserType: mockSetUserType }) },
}));

const mockCalls: string[] = [];
let mockDirty = new Set<string>();
jest.mock("@/stores/useUserProfileStore", () => ({
  useUserProfileStore: {
    getState: () => ({
      dirtyFields: mockDirty,
      flushSyncNow: jest.fn(async () => {
        // Edits must be pushed while the OLD side is still active.
        const { useAuthStore } = jest.requireActual("@/stores/useAuthStore");
        mockCalls.push(`flush:${useAuthStore.getState().role}`);
      }),
      clearData: jest.fn(async () => {
        mockCalls.push("clear");
      }),
      fetchFromBackend: jest.fn(async () => {
        const { useAuthStore } = jest.requireActual("@/stores/useAuthStore");
        mockCalls.push(`fetch:${useAuthStore.getState().role}`);
      }),
    }),
  },
}));

import { switchSide, useSideSwitchStore } from "../switchSide";
import { useAuthStore } from "@/stores/useAuthStore";

const queryClient = {
  cancelQueries: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => {
    // The cache must be dropped BEFORE the side flips.
    mockCalls.push(`queries:${useAuthStore.getState().role}`);
  }),
} as unknown as QueryClient;

beforeEach(() => {
  mockCalls.length = 0;
  mockToasts.length = 0;
  mockOffline = false;
  mockDirty = new Set();
  mockSetUserType.mockClear();
  useAuthStore.setState({ role: "Sponsor", roles: ["Sponsor", "Applicant"] });
  useSideSwitchStore.setState({ switchingTo: null });
});

describe("switchSide", () => {
  it("flushes on the old side, then flips, clears and refetches on the new one", async () => {
    await expect(switchSide("Applicant", queryClient)).resolves.toBe(true);
    expect(mockCalls).toEqual([
      "flush:Sponsor",
      "queries:Sponsor",
      "clear",
      "fetch:Applicant",
    ]);
    expect(useAuthStore.getState().role).toBe("Applicant");
    // Profile edits route by this — it must follow the flip even if the
    // profile fetch were to fail.
    expect(mockSetUserType).toHaveBeenCalledWith("applicant");
    expect(useSideSwitchStore.getState().switchingTo).toBeNull();
  });

  it("does nothing for the active side or a side the account doesn't hold", async () => {
    await expect(switchSide("Sponsor", queryClient)).resolves.toBe(false);
    useAuthStore.setState({ roles: ["Sponsor"] });
    await expect(switchSide("Applicant", queryClient)).resolves.toBe(false);
    expect(mockCalls).toEqual([]);
    expect(useAuthStore.getState().role).toBe("Sponsor");
  });

  it("keeps the active side when the server's list still contains it", async () => {
    await useAuthStore.getState().setRoles(["Applicant", "Sponsor"]);
    expect(useAuthStore.getState().role).toBe("Sponsor");
    await useAuthStore.getState().setRoles(["Applicant"]);
    expect(useAuthStore.getState().role).toBe("Applicant");
  });

  it("refuses offline, changing nothing and saying why", async () => {
    mockOffline = true;
    await expect(switchSide("Applicant", queryClient)).resolves.toBe(false);
    expect(mockCalls).toEqual([]);
    expect(useAuthStore.getState().role).toBe("Sponsor");
    expect(mockToasts[0]).toMatch(/offline/i);
  });

  it("refuses while profile edits can't be saved, so they aren't lost", async () => {
    mockDirty = new Set(["personal"]);
    await expect(switchSide("Applicant", queryClient)).resolves.toBe(false);
    expect(mockCalls).toEqual(["flush:Sponsor"]);
    expect(useAuthStore.getState().role).toBe("Sponsor");
    expect(useSideSwitchStore.getState().switchingTo).toBeNull();
    expect(mockToasts[0]).toMatch(/haven't saved/i);
  });

  it("starts a new session with only the role it logged in as", async () => {
    await useAuthStore.getState().setAuthTokens("a", "r", "Applicant");
    expect(useAuthStore.getState().roles).toEqual(["Applicant"]);
    // A token refresh passes no role and must not touch the sides.
    await useAuthStore.getState().setRoles(["Sponsor", "Applicant"]);
    await useAuthStore.getState().setAuthTokens("a2", "r2");
    expect(useAuthStore.getState().roles).toEqual(["Sponsor", "Applicant"]);
  });
});
