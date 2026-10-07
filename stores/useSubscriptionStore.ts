/**
 * useSubscriptionStore
 *
 * Central source of truth for subscription state.  All purchase and
 * entitlement logic lives here — components only import what they need.
 *
 * Design rules:
 *  - Every public method is a no-op when PREMIUM_ENABLED = false so the flag
 *    in constants/config.ts is the only thing you ever change.
 *  - isPremium is always false when PREMIUM_ENABLED = false.
 *  - RevenueCat is never initialised when PREMIUM_ENABLED = false, so there is
 *    zero SDK overhead in development / test mode.
 *  - All methods are wrapped in try/catch — a RevenueCat error must never
 *    crash the app.
 *
 * The paywall itself is ours (components/premium/PremiumCheckout.tsx):
 * plans come from getOfferings(), the purchase goes through
 * purchasePackage(). RevenueCat's own UI is used only for the Customer
 * Center (manage / cancel), where nothing needs to be beautiful.
 */

import { Platform } from "react-native";
import Purchases, {
    CustomerInfo,
    INTRO_ELIGIBILITY_STATUS,
    LOG_LEVEL,
    PURCHASES_ERROR_CODE,
    PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { create } from "zustand";
import {
    PREMIUM_ENABLED,
    RC_ENTITLEMENT_ID,
    REVENUECAT_API_KEY_ANDROID,
    REVENUECAT_API_KEY_IOS,
} from "@/constants/config";
import { Sentry } from "@/lib/sentry";
import {
    trackPurchaseFailed,
    trackPurchasePending,
    trackPurchaseSucceeded,
    trackRestorePurchasesRequested,
} from "@/lib/analytics/mixpanel";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * What a purchase attempt came to. Callers branch on it for UI state:
 *  - purchased: entitlement active now; celebration is queued.
 *  - restored:  the store already had it (Product Already Purchased);
 *               entitlement active, no celebration — restoring isn't buying.
 *  - pending:   deferred by the store (Ask to Buy / bank approval). The
 *               customer-info listener flips isPremium when it clears.
 *  - cancelled: the user backed out of the native payment sheet.
 *  - error:     a real failure (network, store, configuration).
 */
export type PurchaseOutcome =
  | "purchased"
  | "restored"
  | "pending"
  | "cancelled"
  | "error";

export type OfferingsStatus = "idle" | "loading" | "ready" | "error";

interface SubscriptionState {
  /** True only when PREMIUM_ENABLED = true AND the user holds an active
   *  "Backchannel Pro" entitlement. Always false in free / test mode. */
  isPremium: boolean;
  /** Raw RevenueCat customer record. Null until first successful fetch. */
  customerInfo: CustomerInfo | null;
  /** Available packages from the current offering (monthly / yearly / lifetime). */
  packages: PurchasesPackage[];
  /** Where the offerings fetch stands — drives the plan picker's skeleton
   *  and its retry state. */
  offeringsStatus: OfferingsStatus;
  /** Per product id: is this user eligible for its intro offer (free
   *  trial)? Absent or false means we never promise a trial we can't give. */
  introEligibility: Record<string, boolean>;
  /** True while an async RC operation is in flight. */
  isLoading: boolean;
  /** True after configure() has been called successfully. */
  isInitialized: boolean;
  /** True right after a NEW purchase completes (not restores) — drives the
   *  one-time PremiumCelebration overlay rendered by app/_layout's host.
   *  Can only ever become true while PREMIUM_ENABLED = true. */
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
   * (Re)fetch the current offering's packages and the user's intro-offer
   * eligibility. Called by initialize(); the plan picker calls it again
   * from its retry state.
   */
  refreshOfferings: () => Promise<void>;

  /**
   * Buy a package through the native store sheet. `trigger` names the
   * surface that sold it (marketplace_gate, like_limit_gate, deck_done,
   * profile_upgrade_row) for the Purchase events.
   */
  purchasePackage: (
    pkg: PurchasesPackage,
    trigger: string,
  ) => Promise<PurchaseOutcome>;

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
  offeringsStatus: "idle",
  introEligibility: {},
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
      // renewed in the background, purchase completed on another device,
      // a pending Ask-to-Buy purchase finally approved).
      Purchases.addCustomerInfoUpdateListener((info) => {
        set({
          customerInfo: info,
          isPremium: isEntitlementActive(info),
        });
      });

      set({ isInitialized: true });

      // Fetch initial customer info and available packages.
      await get().refreshCustomerInfo();
      await get().refreshOfferings();
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

  // ── refreshOfferings ───────────────────────────────────────────────────────

  refreshOfferings: async () => {
    if (!PREMIUM_ENABLED || !get().isInitialized) return;
    set({ offeringsStatus: "loading" });
    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      set({ packages, offeringsStatus: packages.length ? "ready" : "error" });

      // Trial eligibility is iOS-only in the SDK; anywhere it can't answer,
      // nobody gets promised a trial (the picker shows the plain price).
      if (packages.length && Platform.OS === "ios") {
        try {
          const ids = packages.map((p) => p.product.identifier);
          const result =
            await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
          const eligibility: Record<string, boolean> = {};
          for (const id of ids) {
            eligibility[id] =
              result[id]?.status ===
              INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
          }
          set({ introEligibility: eligibility });
        } catch (err) {
          console.warn("[Subscription] eligibility check failed:", err);
        }
      }
    } catch (err) {
      console.warn("[Subscription] Failed to fetch offerings:", err);
      set({ offeringsStatus: "error" });
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_offerings" },
      });
    }
  },

  // ── purchasePackage ────────────────────────────────────────────────────────

  purchasePackage: async (pkg, trigger): Promise<PurchaseOutcome> => {
    if (!PREMIUM_ENABLED) return "error";
    // One purchase at a time — a double-tap must never open two native
    // payment sheets. The checkout disables itself too; this is the floor.
    if (get().isLoading) return "error";
    set({ isLoading: true });
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = isEntitlementActive(customerInfo);
      set({ customerInfo, isPremium: premium });
      if (premium) {
        // A NEW purchase gets the celebration; restores (below) do not.
        set({ celebrationPending: true });
        trackPurchaseSucceeded({
          restored: false,
          trigger,
          packageType: pkg.packageType,
        });
        return "purchased";
      }
      // The store took the money but the entitlement hasn't landed yet —
      // the update listener will flip isPremium when it does.
      trackPurchasePending({ trigger, packageType: pkg.packageType });
      return "pending";
    } catch (err) {
      const e = err as {
        code?: string;
        userCancelled?: boolean | null;
        message?: string;
      };
      if (
        e.userCancelled ||
        e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        return "cancelled";
      }
      if (e.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        trackPurchasePending({ trigger, packageType: pkg.packageType });
        return "pending";
      }
      if (e.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        // They already own it on this Apple ID — sync and treat as a restore.
        await get().refreshCustomerInfo();
        if (get().isPremium) {
          trackPurchaseSucceeded({
            restored: true,
            trigger,
            packageType: pkg.packageType,
          });
          return "restored";
        }
      }
      console.warn("[Subscription] purchasePackage failed:", err);
      trackPurchaseFailed(e.code ? `code_${e.code}` : e.message ?? "unknown");
      Sentry.captureException(err, {
        tags: { flow: "revenuecat_purchase", trigger },
      });
      return "error";
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
