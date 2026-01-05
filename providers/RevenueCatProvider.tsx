import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Constants from 'expo-constants';
import Purchases, {
    type CustomerInfo,
    type PurchasesOffering,
    type PurchasesOfferings,
    type PurchasesPackage,
} from 'react-native-purchases';
import PurchasesUI from 'react-native-purchases-ui';

import { configureRevenueCat, hasProEntitlement, REVENUECAT_ENTITLEMENT_PRO } from '@/lib/revenuecat';

export type RevenueCatPlanId = 'monthly' | 'yearly' | 'lifetime';

type RevenueCatState = {
  isConfigured: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  currentOffering: PurchasesOffering | null;
  isPro: boolean;
  lastError: Error | null;

  refresh: () => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo | null>;

  presentProPaywall: () => Promise<void>;
  presentCustomerCenter: () => Promise<void>;

  purchasePlan: (planId: RevenueCatPlanId) => Promise<CustomerInfo | null>;
};

const RevenueCatContext = createContext<RevenueCatState | null>(null);

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown error');
}

function isExpoGo(): boolean {
  // In Expo Go, RevenueCat runs in Preview API mode: purchases/paywalls are not presented.
  // Constants.appOwnership is the most reliable signal across Expo SDK versions.
  return (Constants as any)?.appOwnership === 'expo';
}

function findPlanPackage(offering: PurchasesOffering | null, planId: RevenueCatPlanId): PurchasesPackage | null {
  if (!offering) return null;

  const normalized = planId.toLowerCase();

  const fromIdentifier = offering.availablePackages.find((p) =>
    p.identifier?.toLowerCase?.() === normalized
  );
  if (fromIdentifier) return fromIdentifier;

  const byType = offering.availablePackages.find((p) => {
    const packageType = String((p as any).packageType ?? '').toLowerCase();
    if (normalized === 'monthly') return packageType.includes('month');
    if (normalized === 'yearly') return packageType.includes('year');
    if (normalized === 'lifetime') return packageType.includes('lifetime');
    return false;
  });

  return byType ?? null;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLastError(null);
      const [freshCustomerInfo, freshOfferings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(freshCustomerInfo);
      setOfferings(freshOfferings);
    } catch (e) {
      const err = normalizeError(e);
      setLastError(err);
      throw err;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        configureRevenueCat();
        if (!isMounted) return;
        setIsConfigured(true);

        await refresh();

        const listener = (info: CustomerInfo) => {
          setCustomerInfo(info);
        };

        Purchases.addCustomerInfoUpdateListener(listener);

        return () => {
          Purchases.removeCustomerInfoUpdateListener(listener);
        };
      } catch (e) {
        if (!isMounted) return;
        setLastError(normalizeError(e));
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refresh]);

  const currentOffering = offerings?.current ?? null;
  const isPro = hasProEntitlement(customerInfo);

  const restorePurchases = useCallback(async () => {
    try {
      setLastError(null);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (e) {
      const err = normalizeError(e);
      setLastError(err);
      throw err;
    }
  }, []);

  const presentProPaywall = useCallback(async () => {
    try {
      setLastError(null);

      if (isExpoGo()) {
        throw new Error(
          'RevenueCat Paywalls cannot be presented in Expo Go (Preview API mode). Use an EAS Development Build (expo-dev-client) to test paywalls and purchases.'
        );
      }

      await PurchasesUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        offering: currentOffering ?? undefined,
        displayCloseButton: true,
      });

      await refresh();
    } catch (e) {
      const err = normalizeError(e);
      setLastError(err);
      throw err;
    }
  }, [currentOffering, refresh]);

  const presentCustomerCenter = useCallback(async () => {
    try {
      setLastError(null);

      if (isExpoGo()) {
        throw new Error(
          'RevenueCat Customer Center cannot be presented in Expo Go (Preview API mode). Use an EAS Development Build (expo-dev-client) to test Customer Center.'
        );
      }

      await PurchasesUI.presentCustomerCenter();
      await refresh();
    } catch (e) {
      const err = normalizeError(e);
      setLastError(err);
      throw err;
    }
  }, [refresh]);

  const purchasePlan = useCallback(
    async (planId: RevenueCatPlanId) => {
      try {
        setLastError(null);

        const planPackage = findPlanPackage(currentOffering, planId);
        if (!planPackage) {
          throw new Error(
            `No package found for plan "${planId}" in current Offering. Configure an Offering in RevenueCat with packages for monthly/yearly/lifetime.`
          );
        }

        const { customerInfo: updatedCustomerInfo } = await Purchases.purchasePackage(planPackage);
        setCustomerInfo(updatedCustomerInfo);
        return updatedCustomerInfo;
      } catch (e) {
        const err = normalizeError(e);
        setLastError(err);
        throw err;
      }
    },
    [currentOffering]
  );

  const value = useMemo<RevenueCatState>(
    () => ({
      isConfigured,
      isLoading,
      customerInfo,
      offerings,
      currentOffering,
      isPro,
      lastError,
      refresh,
      restorePurchases,
      presentProPaywall,
      presentCustomerCenter,
      purchasePlan,
    }),
    [
      isConfigured,
      isLoading,
      customerInfo,
      offerings,
      currentOffering,
      isPro,
      lastError,
      refresh,
      restorePurchases,
      presentProPaywall,
      presentCustomerCenter,
      purchasePlan,
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatState {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used within RevenueCatProvider');
  }
  return ctx;
}
