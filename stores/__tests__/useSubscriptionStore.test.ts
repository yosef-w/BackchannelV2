/**
 * Contract tests for the subscription store's documented design rules:
 *   - With PREMIUM_ENABLED=false (the current shipped config) every public
 *     method is a no-op: RevenueCat is never touched and isPremium stays
 *     false. This is what makes flipping the flag the ONLY launch step.
 *   - With PREMIUM_ENABLED=true, entitlement detection drives isPremium and
 *     SDK errors are swallowed rather than crashing.
 */

const mockPurchases = {
  setLogLevel: jest.fn(),
  configure: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getOfferings: jest.fn(),
  getCustomerInfo: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  restorePurchases: jest.fn(),
};
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: mockPurchases,
  LOG_LEVEL: { DEBUG: "DEBUG" },
}));

const mockRCUI = {
  presentPaywall: jest.fn(),
  presentCustomerCenter: jest.fn(),
};
jest.mock("react-native-purchases-ui", () => ({
  __esModule: true,
  default: mockRCUI,
  PAYWALL_RESULT: {
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
  },
}));

const activeInfo = (entitlement: string) => ({
  entitlements: { active: { [entitlement]: { isActive: true } } },
});
const emptyInfo = () => ({ entitlements: { active: {} } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PREMIUM_ENABLED = false (current shipped config)", () => {
  // constants/config.ts currently exports PREMIUM_ENABLED = false, so the
  // real module is used unmocked. If this suite starts failing because the
  // flag flipped, that's the launch event — move these expectations to the
  // flag-on suite.
  const { useSubscriptionStore } = require("../useSubscriptionStore");
  const store = () => useSubscriptionStore.getState();

  it("initialize never configures RevenueCat", async () => {
    await store().initialize();
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(store().isInitialized).toBe(false);
  });

  it("presentPaywall returns false without presenting", async () => {
    expect(await store().presentPaywall()).toBe(false);
    expect(mockRCUI.presentPaywall).not.toHaveBeenCalled();
  });

  it("restorePurchases returns false without calling the SDK", async () => {
    expect(await store().restorePurchases()).toBe(false);
    expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
  });

  it("identifyUser / refreshCustomerInfo / reset are silent no-ops", async () => {
    await store().identifyUser("user-1");
    await store().refreshCustomerInfo();
    await store().reset();
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
    expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(mockPurchases.logOut).not.toHaveBeenCalled();
    expect(store().isPremium).toBe(false);
  });
});

describe("PREMIUM_ENABLED = true", () => {
  let useSubscriptionStore: typeof import("../useSubscriptionStore").useSubscriptionStore;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("@/constants/config", () => ({
      PREMIUM_ENABLED: true,
      RC_ENTITLEMENT_ID: "Backchannel Pro",
      REVENUECAT_API_KEY_IOS: "ios-key",
      REVENUECAT_API_KEY_ANDROID: "android-key",
    }));
    mockPurchases.getCustomerInfo.mockResolvedValue(emptyInfo());
    mockPurchases.getOfferings.mockResolvedValue({ current: null });
    ({ useSubscriptionStore } = require("../useSubscriptionStore"));
  });

  const store = () => useSubscriptionStore.getState();

  it("initialize configures once and is idempotent", async () => {
    await store().initialize();
    await store().initialize();
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(store().isInitialized).toBe(true);
  });

  it("a configure error is swallowed (app must not crash)", async () => {
    mockPurchases.configure.mockImplementationOnce(() => {
      throw new Error("native module missing");
    });
    await expect(store().initialize()).resolves.toBeUndefined();
    expect(store().isInitialized).toBe(false);
  });

  it("refreshCustomerInfo flips isPremium on an active entitlement", async () => {
    await store().initialize();
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(
      activeInfo("Backchannel Pro"),
    );
    await store().refreshCustomerInfo();
    expect(store().isPremium).toBe(true);
  });

  it("a different entitlement name does NOT grant premium", async () => {
    await store().initialize();
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(
      activeInfo("Some Other Product"),
    );
    await store().refreshCustomerInfo();
    expect(store().isPremium).toBe(false);
  });

  it("presentPaywall returns true and refreshes after a purchase", async () => {
    await store().initialize();
    mockRCUI.presentPaywall.mockResolvedValueOnce("PURCHASED");
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(
      activeInfo("Backchannel Pro"),
    );
    expect(await store().presentPaywall()).toBe(true);
    expect(store().isPremium).toBe(true);
  });

  it("presentPaywall returns false on cancel", async () => {
    mockRCUI.presentPaywall.mockResolvedValueOnce("CANCELLED");
    expect(await store().presentPaywall()).toBe(false);
  });

  it("reset logs out and clears premium even when logOut throws (anonymous)", async () => {
    await store().initialize();
    useSubscriptionStore.setState({ isPremium: true });
    mockPurchases.logOut.mockRejectedValueOnce(new Error("already anonymous"));
    await store().reset();
    expect(store().isPremium).toBe(false);
    expect(store().customerInfo).toBeNull();
  });
});
