import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';

export const REVENUECAT_ENTITLEMENT_PRO = 'BackchannelV2 Pro';

// RevenueCat public SDK keys are safe to ship in the client.
// Best practice: move this into an Expo public env var (EXPO_PUBLIC_REVENUECAT_API_KEY).
export const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? 'test_IUmpJiSBlVJsJCSQGEezqLblcYJ';

let didConfigure = false;

export function configureRevenueCat(): void {
  if (!REVENUECAT_API_KEY) {
    throw new Error(
      'Missing RevenueCat API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY or update REVENUECAT_API_KEY.'
    );
  }

  if (didConfigure) return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);

  // If you end up using platform-specific keys later, split by Platform.OS here.
  // (RevenueCat projects typically provide an Apple key + a Google key.)
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    didConfigure = true;
  }
}

export function hasProEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo) return false;

  return typeof customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_PRO] !== 'undefined';
}
