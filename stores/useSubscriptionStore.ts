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
} from "@/constants/config";
import { Sentry } from "@/lib/sentry";
import {
    trackPaywallShown,
    trackPurchaseFailed,
    trackPurchaseSucceeded,
    trackRestorePurchasesRequested,
} from "@/lib/analytics/mixpanel";

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
  /** True right after a NEW purchase completes (not restores) — drives the
   *  one-time PremiumCelebration overlay rendered by app/_layout's host.
   *  Can only ever become true while PREMIUM_ENABLED = true, since
   *  presentPaywall() short-circuits otherwise. */
  celebrationPending: boolean;

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
   * `trigger` identifies which entry point opened it (deck-done, profile
   * upgrade row, marketplace gate, …) for the Paywall Shown event — see
   * mixpanel.ts's Subscription section.
   */
  presentPaywall: (trigger: string) => Promise<boolean>;

  /**
   * Open the RevenueCat Customer Center (subscription management / support).
   */
  presentCustomerCenter: () => Promise<void>;

  /** Dismiss the post-purchase celebration overlay. */
  dismissCelebration: () => void;

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
  celebrationPending: false,

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
      // If RC never configures, isPremium stays false and every entitlement
      // check silently behaves as "not premium" — indistinguishable from a
      // real free user with nothing in the logs to explain why (console.warn
      // is stripped in release builds — see babel.config.js).
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_initialize" },
      });
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
      // A failed logIn() leaves this device's RC identity un-linked to the
      // backend account — purchases made here won't restore on a reinstall
      // or another device. Worth knowing about even though the local
      // customerInfo from initialize() still works for this session.
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_identify" },
      });
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

  presentPaywall: async (trigger: string): Promise<boolean> => {
    if (!PREMIUM_ENABLED) return false;
    // Guard lives here instead of in each caller so every entry point gets
    // it for free — MarketplaceGateModal already had its own local
    // `purchasing` state to prevent a double-tap presenting the native
    // paywall UI twice concurrently, but HomeView's deck-done "Unlock with
    // Premium" CTA and ProfileView's "Upgrade to Pro" row both called this
    // directly with no such guard of their own. isLoading is already
    // documented as "true while an async RC operation is in flight" — this
    // was the one RC operation that didn't actually set it.
    if (get().isLoading) return false;
    set({ isLoading: true });
    trackPaywallShown({ trigger });
    try {
      const result = await RevenueCatUI.presentPaywall();
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
          // Refresh so isPremium updates immediately after purchase.
          await get().refreshCustomerInfo();
          // A NEW purchase gets the celebration; a restore (below) does
          // not — restoring isn't buying.
          set({ celebrationPending: true });
          trackPurchaseSucceeded({ restored: false });
          return true;
        case PAYWALL_RESULT.RESTORED:
          await get().refreshCustomerInfo();
          trackPurchaseSucceeded({ restored: true });
          return true;
        case PAYWALL_RESULT.ERROR:
          // A real presentation/processing failure, distinct from the
          // user simply closing the sheet (CANCELLED, below) — that
          // distinction is exactly what was missing before this event.
          trackPurchaseFailed("presentation_error");
          return false;
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.CANCELLED:
        default:
          return false;
      }
    } catch (err) {
      console.warn("[Subscription] presentPaywall failed:", err);
      trackPurchaseFailed(err instanceof Error ? err.message : "unknown");
      // Returns false identically to a plain user cancel (PAYWALL_RESULT
      // .CANCELLED, above) — without this, a real SDK/network failure here
      // is completely indistinguishable from someone just closing the
      // sheet, in the one place in the app where that ambiguity costs
      // actual revenue.
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_present_paywall" },
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // ── presentCustomerCenter ──────────────────────────────────────────────────

  dismissCelebration: () => set({ celebrationPending: false }),

  presentCustomerCenter: async (): Promise<void> => {
    if (!PREMIUM_ENABLED) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (err) {
      console.warn("[Subscription] presentCustomerCenter failed:", err);
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_customer_center" },
      });
    }
  },

  // ── restorePurchases ───────────────────────────────────────────────────────

  restorePurchases: async (): Promise<boolean> => {
    if (!PREMIUM_ENABLED) return false;
    trackRestorePurchasesRequested();
    try {
      set({ isLoading: true });
      const info = await Purchases.restorePurchases();
      const nowPremium = isEntitlementActive(info);
      set({ customerInfo: info, isPremium: nowPremium });
      // A false return here just means "nothing to restore" (no prior
      // purchase found), which is an expected outcome, not a failure — only
      // a thrown error below counts as Purchase Failed.
      if (nowPremium) trackPurchaseSucceeded({ restored: true });
      return nowPremium;
    } catch (err) {
      console.warn("[Subscription] restorePurchases failed:", err);
      trackPurchaseFailed(err instanceof Error ? err.message : "unknown");
      // A user who paid on another device/reinstall and taps "Restore"
      // expecting it to just work — a failure here with nothing but a
      // stripped console.warn means they'd have no way to tell us why it
      // didn't, and we'd have no way to know it happened.
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_restore_purchases" },
      });
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
