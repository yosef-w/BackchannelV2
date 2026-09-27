import {
  PACKAGE_TYPE,
  type PurchasesIntroPrice,
  type PurchasesPackage,
} from "react-native-purchases";

/**
 * Everything the checkout needs to SAY about a plan, derived from the live
 * RevenueCat package so no price, period, or trial length is ever typed
 * into copy by hand. The store and the App Store product config are the
 * only sources of truth; this file just phrases them.
 */

/**
 * "$X/year, or $Y month to month" from the live offering, or null before
 * the offering has loaded (callers simply don't render the line). Annual
 * first, the plan we want them anchored on, with monthly as the escape
 * hatch.
 */
export function priceAnchor(packages: PurchasesPackage[]): string | null {
  const annual = packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
  const monthly = packages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  if (annual && monthly) {
    return `${annual.product.priceString}/year, or ${monthly.product.priceString} month to month`;
  }
  if (annual) return `${annual.product.priceString}/year`;
  if (monthly) return `${monthly.product.priceString}/month`;
  return null;
}

/** Display order: the anchor first, the escape hatch, then the one-off. */
const ORDER: readonly PACKAGE_TYPE[] = [
  PACKAGE_TYPE.ANNUAL,
  PACKAGE_TYPE.SIX_MONTH,
  PACKAGE_TYPE.THREE_MONTH,
  PACKAGE_TYPE.MONTHLY,
  PACKAGE_TYPE.WEEKLY,
  PACKAGE_TYPE.LIFETIME,
];

export function sortPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  return [...packages].sort((a, b) => {
    const ai = ORDER.indexOf(a.packageType);
    const bi = ORDER.indexOf(b.packageType);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** The plan we pre-select: annual when it exists, else the first shown. */
export function defaultPackage(
  packages: PurchasesPackage[],
): PurchasesPackage | null {
  const sorted = sortPackages(packages);
  return (
    sorted.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ?? sorted[0] ?? null
  );
}

/** "year" / "month" / "6 months" / null for a one-off. */
export function billingPeriod(pkg: PurchasesPackage): string | null {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "year";
    case PACKAGE_TYPE.SIX_MONTH:
      return "6 months";
    case PACKAGE_TYPE.THREE_MONTH:
      return "3 months";
    case PACKAGE_TYPE.MONTHLY:
      return "month";
    case PACKAGE_TYPE.WEEKLY:
      return "week";
    case PACKAGE_TYPE.LIFETIME:
      return null;
    default:
      return pkg.product.subscriptionPeriod ? "period" : null;
  }
}

export function planName(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "Annual";
    case PACKAGE_TYPE.SIX_MONTH:
      return "Six months";
    case PACKAGE_TYPE.THREE_MONTH:
      return "Three months";
    case PACKAGE_TYPE.MONTHLY:
      return "Monthly";
    case PACKAGE_TYPE.WEEKLY:
      return "Weekly";
    case PACKAGE_TYPE.LIFETIME:
      return "Lifetime";
    default:
      return pkg.product.title || "Premium";
  }
}

/** Whole-percent saving of a plan against paying monthly, or null. */
export function savingsVsMonthly(
  pkg: PurchasesPackage,
  monthly: PurchasesPackage | undefined,
): number | null {
  if (!monthly || pkg.packageType === PACKAGE_TYPE.LIFETIME) return null;
  const months =
    pkg.packageType === PACKAGE_TYPE.ANNUAL
      ? 12
      : pkg.packageType === PACKAGE_TYPE.SIX_MONTH
        ? 6
        : pkg.packageType === PACKAGE_TYPE.THREE_MONTH
          ? 3
          : 0;
  if (!months) return null;
  const full = monthly.product.price * months;
  if (full <= 0 || pkg.product.price >= full) return null;
  return Math.round((1 - pkg.product.price / full) * 100);
}

/** "7 days" / "1 month" for an intro period. */
export function introLength(intro: PurchasesIntroPrice): string {
  const n = intro.periodNumberOfUnits;
  const unit = intro.periodUnit.toLowerCase();
  const word =
    unit.startsWith("day")
      ? "day"
      : unit.startsWith("week")
        ? "week"
        : unit.startsWith("month")
          ? "month"
          : unit.startsWith("year")
            ? "year"
            : unit;
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** A free trial the user is eligible for, or null. Only a zero-price
 * intro counts; paid intro pricing is shown as the plain price. */
export function eligibleTrial(
  pkg: PurchasesPackage,
  eligible: boolean,
): PurchasesIntroPrice | null {
  const intro = pkg.product.introPrice;
  if (!eligible || !intro || intro.price > 0) return null;
  return intro;
}

/** The one-line secondary description under a plan's name. */
export function planSubline(
  pkg: PurchasesPackage,
  trial: PurchasesIntroPrice | null,
): string {
  const period = billingPeriod(pkg);
  if (!period) return "Pay once, keep it for good";
  if (trial) {
    return `Free for ${introLength(trial)}, then ${pkg.product.priceString} per ${period}`;
  }
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL && pkg.product.pricePerMonthString) {
    return `${pkg.product.pricePerMonthString} a month, billed yearly`;
  }
  return `Billed every ${period}`;
}

/** The short cadence under the price on the right: "per year", "once". */
export function cadenceLabel(pkg: PurchasesPackage): string {
  const period = billingPeriod(pkg);
  return period ? `per ${period}` : "once";
}

/** The purchase button's label. */
export function purchaseLabel(
  pkg: PurchasesPackage,
  trial: PurchasesIntroPrice | null,
): string {
  if (trial) return "Start free trial";
  if (pkg.packageType === PACKAGE_TYPE.LIFETIME) return "Get Lifetime";
  return "Start Premium";
}

/** Apple's required disclosure line: price, period, renewal. */
export function legalLine(
  pkg: PurchasesPackage,
  trial: PurchasesIntroPrice | null,
): string {
  const period = billingPeriod(pkg);
  if (!period) return "One-time purchase. No renewal, no subscription.";
  if (trial) {
    return `Free for ${introLength(trial)}, then ${pkg.product.priceString} per ${period}. Renews automatically until cancelled. Cancel anytime in your App Store settings.`;
  }
  return `${pkg.product.priceString} per ${period}. Renews automatically until cancelled. Cancel anytime in your App Store settings.`;
}
