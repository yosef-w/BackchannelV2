/**
 * Contract tests for the subscription store's documented design rules:
 *   - With PREMIUM_ENABLED=false every public method is a no-op: RevenueCat
 *     is never touched and isPremium stays false. This is what makes
 *     flipping the flag the ONLY launch step.
 *   - With PREMIUM_ENABLED=true, entitlement detection drives isPremium, a
 *     purchase maps every SDK outcome to one PurchaseOutcome, and SDK errors
 *     are swallowed rather than crashing.
 */

jest.mock("@/lib/analytics/mixpanel", () => ({
  trackPurchaseSucceeded: jest.fn(),
  trackPurchaseFailed: jest.fn(),
  trackPurchasePending: jest.fn(),
  trackRestorePurchasesRequested: jest.fn(),
}));
jest.mock("@/lib/sentry", () => ({
  Sentry: { captureException: jest.fn() },
}));

const mockPurchases = {
  setLogLevel: jest.fn(),
  configure: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getOfferings: jest.fn(),
  getCustomerInfo: jest.fn(),
  checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  purchasePackage: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  restorePurchases: jest.fn(),
};
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: mockPurchases,
  LOG_LEVEL: { DEBUG: "DEBUG" },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: "1",
    PRODUCT_ALREADY_PURCHASED_ERROR: "6",
    PAYMENT_PENDING_ERROR: "20",
  },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
  },
}));

const mockRCUI = { presentCustomerCenter: jest.fn() };
jest.mock("react-native-purchases-ui", () => ({
  __esModule: true,
  default: mockRCUI,
}));

const activeInfo = (entitlement: string) => ({
  entitlements: { active: { [entitlement]: { isActive: true } } },
});
const emptyInfo = () => ({ entitlements: { active: {} } });
const annual = {
  identifier: "$rc_annual",
  packageType: "ANNUAL",
  product: { identifier: "bc_annual", price: 59.99, priceString: "$59.99" },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PREMIUM_ENABLED = false (current shipped config)", () => {
  let useSubscriptionStore: typeof import("../useSubscriptionStore").useSubscriptionStore;
  beforeEach(() => {
    jest.resetModules();
    ({ useSubscriptionStore } = require("../useSubscriptionStore"));
  });

  it("initialize never configures RevenueCat", async () => {
    await useSubscriptionStore.getState().initialize();
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });

  it("purchasePackage is an error without touching the SDK", async () => {
    expect(
      await useSubscriptionStore.getState().purchasePackage(annual, "test"),
    ).toBe("error");
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  it("restorePurchases returns false without calling the SDK", async () => {
    expect(await useSubscriptionStore.getState().restorePurchases()).toBe(false);
    expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
  });

  it("identifyUser / refreshCustomerInfo / refreshOfferings / reset are silent no-ops", async () => {
    const s = useSubscriptionStore.getState();
    await s.identifyUser("u1");
    await s.refreshCustomerInfo();
    await s.refreshOfferings();
    await s.reset();
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
    expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    expect(mockPurchases.logOut).not.toHaveBeenCalled();
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
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [annual] },
    });
    mockPurchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      bc_annual: { status: 2, description: "eligible" },
    });
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

  it("initialize loads packages and trial eligibility", async () => {
    await store().initialize();
    expect(store().packages).toHaveLength(1);
    expect(store().offeringsStatus).toBe("ready");
    expect(store().introEligibility.bc_annual).toBe(true);
  });

  it("an empty offering reads as an error so the picker can retry", async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({ current: null });
    await store().initialize();
    expect(store().offeringsStatus).toBe("error");
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

  it("purchasePackage → purchased: premium on, celebration queued", async () => {
    await store().initialize();
    mockPurchases.purchasePackage.mockResolvedValueOnce({
      customerInfo: activeInfo("Backchannel Pro"),
    });
    expect(await store().purchasePackage(annual, "test")).toBe("purchased");
    expect(store().isPremium).toBe(true);
    expect(store().celebrationPending).toBe(true);
  });

  it("purchasePackage → cancelled: no error, no premium", async () => {
    await store().initialize();
    mockPurchases.purchasePackage.mockRejectedValueOnce({
      code: "1",
      userCancelled: true,
    });
    expect(await store().purchasePackage(annual, "test")).toBe("cancelled");
    expect(store().isPremium).toBe(false);
    expect(store().celebrationPending).toBe(false);
  });

  it("purchasePackage → pending on a deferred (Ask to Buy) purchase", async () => {
    await store().initialize();
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: "20" });
    expect(await store().purchasePackage(annual, "test")).toBe("pending");
  });

  it("purchasePackage → restored when the store already owns it", async () => {
    await store().initialize();
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: "6" });
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(
      activeInfo("Backchannel Pro"),
    );
    expect(await store().purchasePackage(annual, "test")).toBe("restored");
    expect(store().isPremium).toBe(true);
    expect(store().celebrationPending).toBe(false);
  });

  it("purchasePackage → error on anything else, never throws", async () => {
    await store().initialize();
    mockPurchases.purchasePackage.mockRejectedValueOnce({
      code: "10",
      message: "network",
    });
    expect(await store().purchasePackage(annual, "test")).toBe("error");
    expect(store().isLoading).toBe(false);
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
