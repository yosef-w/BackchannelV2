/**
 * useSubscriptionStore
 *
 * Central source of truth for subscription state.  All paywall and entitlement
 * logic lives here — components only import what they need.
 *
 * Design rules:
 *  - Every public method is a no-op when PREMIUM_ENABLED = false so the flag
 *    in constants/config.ts is the only thing you ever change.
 *  - isPremium is always false when PREMIUM_ENABLED = false.
 *  - RevenueCat is never initialised when PREMIUM_ENABLED = false, so there is
 *    zero SDK overhead in development / test mode.
 *  - All methods are wrapped in try/catch — a RevenueCat error must never
 *    crash the app.
 */

import { Platform } from "react-native";
import Purchases, {
    CustomerInfo,
    LOG_LEVEL,
    PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { create } from "zustand";
import {
    PREMIUM_ENABLED,
    RC_ENTITLEMENT_ID,
    REVENUECAT_API_KEY_ANDROID,
    REVENUECAT_API_KEY_IOS,
} from "../constants/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionState {
  /** True only when PREMIUM_ENABLED = true AND the user holds an active
   *  "Backchannel Pro" entitlement. Always false in free / test mode. */
  isPremium: boolean;
  /** Raw RevenueCat customer record. Null until first successful fetch. */
  customerInfo: CustomerInfo | null;
  /** Available packages from the current offering (monthly / yearly / lifetime). */
  packages: PurchasesPackage[];
  /** True while an async RC operation is in flight. */
  isLoading: boolean;
  /** True after configure() has been called successfully. */
  isInitialized: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Configure the RevenueCat SDK and subscribe to customer-info updates.
   * Call once on app start (before the user logs in).  Idempotent — safe to
   * call multiple times.
   */
  initialize: () => Promise<void>;

  /**
   * Associate the RC anonymous ID with your backend user ID.
   * Call immediately after a successful login or sign-up so purchases can be
   * restored across devices.
   */
  identifyUser: (userId: string) => Promise<void>;

  /**
   * Fetch the latest customer info from RevenueCat and update isPremium.
   */
  refreshCustomerInfo: () => Promise<void>;

  /**
   * Present the RevenueCat paywall for the current offering.
   * Returns true if the user purchased or restored, false otherwise.
   */
  presentPaywall: () => Promise<boolean>;

  /**
   * Open the RevenueCat Customer Center (subscription management / support).
   */
  presentCustomerCenter: () => Promise<void>;

  /**
   * Restore purchases from the App Store / Play Store.
   * Returns true if at least one entitlement became active after restoring.
   */
  restorePurchases: () => Promise<boolean>;

  /**
   * Log the user out of RevenueCat (revert to anonymous ID).
   * Call on app logout alongside your own clearAuth().
   */
  reset: () => Promise<void>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function isEntitlementActive(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return typeof info.entitlements.active[RC_ENTITLEMENT_ID] !== "undefined";
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  customerInfo: null,
  packages: [],
  isLoading: false,
  isInitialized: false,

  // ── initialize ─────────────────────────────────────────────────────────────

  initialize: async () => {
    if (!PREMIUM_ENABLED) return;
    if (get().isInitialized) return;

    try {
      // Only enable verbose logging in development builds.
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      const apiKey =
        Platform.OS === "ios"
          ? REVENUECAT_API_KEY_IOS
          : REVENUECAT_API_KEY_ANDROID;

      Purchases.configure({ apiKey });

      // Subscribe to real-time customer info updates (e.g. subscription
      // renewed in the background, purchase completed on another device).
      Purchases.addCustomerInfoUpdateListener((info) => {
        set({
          customerInfo: info,
          isPremium: isEntitlementActive(info),
        });
      });

      set({ isInitialized: true });

      // Fetch initial customer info and available packages.
      await get().refreshCustomerInfo();

      try {
        const offerings = await Purchases.getOfferings();
        const current = offerings.current;
        if (current) {
          set({ packages: current.availablePackages });
        }
      } catch (err) {
        console.warn("[Subscription] Failed to fetch offerings:", err);
      }
    } catch (err) {
      console.warn("[Subscription] initialize failed:", err);
    }
  },

  // ── identifyUser ───────────────────────────────────────────────────────────

  identifyUser: async (userId: string) => {
    if (!PREMIUM_ENABLED || !get().isInitialized) return;
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      set({
        customerInfo,
        isPremium: isEntitlementActive(customerInfo),
      });
    } catch (err) {
      console.warn("[Subscription] identifyUser failed:", err);
    }
  },

  // ── refreshCustomerInfo ────────────────────────────────────────────────────

  refreshCustomerInfo: async () => {
    if (!PREMIUM_ENABLED || !get().isInitialized) return;
    try {
      set({ isLoading: true });
      const info = await Purchases.getCustomerInfo();
      set({
        customerInfo: info,
        isPremium: isEntitlementActive(info),
      });
    } catch (err) {
      console.warn("[Subscription] refreshCustomerInfo failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── presentPaywall ─────────────────────────────────────────────────────────

  presentPaywall: async (): Promise<boolean> => {
    if (!PREMIUM_ENABLED) return false;
    try {
      const result = await RevenueCatUI.presentPaywall();
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          // Refresh so isPremium updates immediately after purchase.
          await get().refreshCustomerInfo();
          return true;
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
        default:
          return false;
      }
    } catch (err) {
      console.warn("[Subscription] presentPaywall failed:", err);
      return false;
    }
  },

  // ── presentCustomerCenter ──────────────────────────────────────────────────

  presentCustomerCenter: async (): Promise<void> => {
    if (!PREMIUM_ENABLED) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (err) {
      console.warn("[Subscription] presentCustomerCenter failed:", err);
    }
  },

  // ── restorePurchases ───────────────────────────────────────────────────────

  restorePurchases: async (): Promise<boolean> => {
    if (!PREMIUM_ENABLED) return false;
    try {
      set({ isLoading: true });
      const info = await Purchases.restorePurchases();
      const nowPremium = isEntitlementActive(info);
      set({ customerInfo: info, isPremium: nowPremium });
      return nowPremium;
    } catch (err) {
      console.warn("[Subscription] restorePurchases failed:", err);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── reset ──────────────────────────────────────────────────────────────────

  reset: async (): Promise<void> => {
    if (!PREMIUM_ENABLED || !get().isInitialized) return;
    try {
      await Purchases.logOut();
    } catch (err) {
      // logOut() throws when the user is already anonymous — safe to ignore.
      console.warn("[Subscription] reset failed (may be anonymous):", err);
    } finally {
      set({ isPremium: false, customerInfo: null });
    }
  },
}));
