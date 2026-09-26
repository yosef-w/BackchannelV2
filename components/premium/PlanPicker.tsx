// PlanPicker — the plan rows inside our checkout. Live packages from the
// RevenueCat offering, phrased by lib/premiumPricing.ts, so a price or a
// trial length is never hand-typed. Annual leads and carries the SAVE
// chip; selection is an ink ring that eases in with a stamped check, on
// the cinema engine's backOut curve, one light haptic tick. Quiet money.
//
// Three states, one shape: skeleton rows while the offering loads, the
// rows themselves, or a single retry line if the store couldn't answer.

import { Check } from "@/components/ui/icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { PACKAGE_TYPE, type PurchasesPackage } from "react-native-purchases";
import { backOut } from "@/components/cinema/engine";
import { Colors, Fonts, Radii } from "@/constants/theme";
import {
  cadenceLabel,
  eligibleTrial,
  introLength,
  planName,
  planSubline,
  savingsVsMonthly,
  sortPackages,
} from "@/lib/premiumPricing";
import type { OfferingsStatus } from "@/stores/useSubscriptionStore";

interface PlanPickerProps {
  packages: PurchasesPackage[];
  status: OfferingsStatus;
  introEligibility: Record<string, boolean>;
  selectedId: string | null;
  onSelect: (pkg: PurchasesPackage) => void;
  onRetry: () => void;
  disabled?: boolean;
}

export function PlanPicker({
  packages,
  status,
  introEligibility,
  selectedId,
  onSelect,
  onRetry,
  disabled = false,
}: PlanPickerProps) {
  if (status === "error" || (status === "ready" && packages.length === 0)) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>Plans aren&apos;t loading right now.</Text>
        <Pressable onPress={onRetry} hitSlop={12} accessibilityRole="button">
          <Text style={styles.stateLink}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (packages.length === 0) {
    return (
      <View style={styles.list}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  const sorted = sortPackages(packages);
  const monthly = sorted.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {sorted.map((pkg) => (
        <PlanRow
          key={pkg.identifier}
          pkg={pkg}
          selected={pkg.identifier === selectedId}
          savings={savingsVsMonthly(pkg, monthly)}
          trialEligible={introEligibility[pkg.product.identifier] === true}
          onPress={() => onSelect(pkg)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

function PlanRow({
  pkg,
  selected,
  savings,
  trialEligible,
  onPress,
  disabled,
}: {
  pkg: PurchasesPackage;
  selected: boolean;
  savings: number | null;
  trialEligible: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    sel.value = reduceMotion
      ? selected
        ? 1
        : 0
      : withTiming(selected ? 1 : 0, {
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
  }, [selected, sel, reduceMotion]);

  // The selected plan is the only loud thing: the others step back to
  // 62% and drop their chips, so one row carries the price and the
  // saving. While a purchase is in flight the selected row stays lit
  // and the rest recede further, so the sheet reads "held", not "loading".
  const ring = useAnimatedStyle(() => ({
    opacity: disabled ? 0.45 + sel.value * 0.55 : 0.62 + sel.value * 0.38,
    borderColor: interpolateColor(sel.value, [0, 1], [Colors.border, Colors.ink]),
    backgroundColor: interpolateColor(
      sel.value,
      [0, 1],
      [Colors.paper, Colors.offWhite],
    ),
  }));
  const check = useAnimatedStyle(() => {
    const p = backOut(sel.value);
    return { opacity: Math.min(1, sel.value * 2), transform: [{ scale: p }] };
  });
  const dot = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      sel.value,
      [0, 1],
      [Colors.borderStrong, Colors.ink],
    ),
    backgroundColor: interpolateColor(sel.value, [0, 1], [Colors.paper, Colors.ink]),
  }));

  const trial = eligibleTrial(pkg, trialEligible);
  const name = planName(pkg);
  const chip = trial
    ? `${introLength(trial).toUpperCase()} FREE`
    : savings
      ? `SAVE ${savings}%`
      : null;

  return (
    <Pressable
      onPress={() => {
        if (disabled || selected) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${name}, ${pkg.product.priceString} ${cadenceLabel(pkg)}`}
      style={({ pressed }) => [pressed && !selected && styles.pressed]}
    >
      <Animated.View style={[styles.row, ring]}>
        <Animated.View style={[styles.dot, dot]}>
          <Animated.View style={check}>
            <Check color={Colors.paper} size={12} strokeWidth={3} />
          </Animated.View>
        </Animated.View>

        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            {chip && selected && (
              <Animated.View
                entering={FadeIn.duration(220)}
                style={[styles.chip, trial && styles.chipTrial]}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </Animated.View>
            )}
          </View>
          <Text style={styles.sub} numberOfLines={2}>
            {planSubline(pkg, trial)}
          </Text>
        </View>

        <View style={styles.priceCol}>
          <Text style={styles.price}>{pkg.product.priceString}</Text>
          <Text style={styles.cadence}>{cadenceLabel(pkg)}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function SkeletonRow() {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[styles.row, styles.skeleton, style]}>
      <View style={[styles.dot, { borderColor: Colors.border }]} />
      <View style={styles.text}>
        <View style={[styles.bone, { width: "38%" }]} />
        <View style={[styles.bone, styles.boneThin, { width: "62%" }]} />
      </View>
      <View style={[styles.bone, { width: 64 }]} />
    </Animated.View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  list: { alignSelf: "stretch", gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  pressed: { transform: [{ scale: 0.99 }] },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15.5,
    color: Colors.ink,
    letterSpacing: -0.1,
  },
  chip: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipTrial: { backgroundColor: Colors.warning },
  chipText: {
    color: Colors.paper,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  sub: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.muted,
  },
  priceCol: { alignItems: "flex-end", gap: 1 },
  price: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  cadence: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.muted,
  },
  skeleton: { borderColor: Colors.border },
  bone: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  boneThin: { height: 9 },
  stateBox: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 6,
    paddingVertical: 22,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
  },
  stateText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.body },
  stateLink: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.ink },
});
