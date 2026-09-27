// PremiumCheckout — the buying half of every premium surface. Drops in
// under a gate's context (the held card, the reel) and replaces what used
// to be a hand-off to RevenueCat's template: plan rows, one purchase
// button, Apple's required disclosure, and the Terms / Privacy / Restore
// row. One sheet from desire to receipt.
//
// Owns the purchase flow's UI states — idle, purchasing, pending (Ask to
// Buy), error — and reports the outcome up. The celebration and whatever
// the caller was holding (a like, a sponsor request) happen in the caller.

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { PurchasesPackage } from "react-native-purchases";
import { PlanPicker } from "./PlanPicker";
import {
  type PurchaseOutcome,
  useSubscriptionStore,
} from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { openExternalUrl } from "@/lib/openExternalUrl";
import {
  defaultPackage,
  eligibleTrial,
  legalLine,
  purchaseLabel,
} from "@/lib/premiumPricing";
import { trackPaywallShown, trackPlanSelected } from "@/lib/analytics/mixpanel";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/constants/config";
import { Colors, Fonts } from "@/constants/theme";

interface PremiumCheckoutProps {
  /** Which surface is selling: marketplace_gate, like_limit_gate,
   * deck_done, profile_upgrade_row. Carried on every event. */
  trigger: string;
  /** Entitlement is active (bought now, or restored). */
  onUnlocked: (outcome: "purchased" | "restored") => void;
  /** The quiet exit under the legal row: "Keep browsing", "Not now". */
  dismissLabel: string;
  onDismiss: () => void;
}

type Phase = "idle" | "purchasing" | "pending" | "error";

export function PremiumCheckout({
  trigger,
  onUnlocked,
  dismissLabel,
  onDismiss,
}: PremiumCheckoutProps) {
  const packages = useSubscriptionStore((s) => s.packages);
  const status = useSubscriptionStore((s) => s.offeringsStatus);
  const introEligibility = useSubscriptionStore((s) => s.introEligibility);
  const purchasePackage = useSubscriptionStore((s) => s.purchasePackage);
  const refreshOfferings = useSubscriptionStore((s) => s.refreshOfferings);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const showToast = useToastStore((s) => s.showToast);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    trackPaywallShown({ trigger });
  }, [trigger]);

  // Pre-select the anchor plan as soon as the offering lands (and if the
  // offering refreshes and the old selection is gone, fall back again).
  useEffect(() => {
    if (packages.length === 0) return;
    if (selectedId && packages.some((p) => p.identifier === selectedId)) return;
    setSelectedId(defaultPackage(packages)?.identifier ?? null);
  }, [packages, selectedId]);

  const selected = useMemo(
    () => packages.find((p) => p.identifier === selectedId) ?? null,
    [packages, selectedId],
  );
  const trial = selected
    ? eligibleTrial(selected, introEligibility[selected.product.identifier] === true)
    : null;

  const busy = phase === "purchasing" || restoring;

  const handleSelect = (pkg: PurchasesPackage) => {
    setSelectedId(pkg.identifier);
    if (phase === "error") setPhase("idle");
    trackPlanSelected({ trigger, packageType: pkg.packageType });
  };

  const handlePurchase = async () => {
    if (!selected || busy) return;
    setPhase("purchasing");
    const outcome: PurchaseOutcome = await purchasePackage(selected, trigger);
    switch (outcome) {
      case "purchased":
      case "restored":
        setPhase("idle");
        onUnlocked(outcome);
        return;
      case "pending":
        setPhase("pending");
        return;
      case "cancelled":
        setPhase("idle");
        return;
      default:
        setPhase("error");
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        onUnlocked("restored");
      } else {
        showToast("No previous purchase found for this Apple ID.", "info");
      }
    } finally {
      setRestoring(false);
    }
  };

  const label = selected ? purchaseLabel(selected, trial) : "Start Premium";

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>

      <PlanPicker
        packages={packages}
        status={status}
        introEligibility={introEligibility}
        selectedId={selectedId}
        onSelect={handleSelect}
        onRetry={refreshOfferings}
        disabled={busy}
      />

      <TouchableOpacity
        style={[styles.cta, (busy || !selected) && styles.ctaDisabled]}
        onPress={handlePurchase}
        disabled={busy || !selected}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {phase === "purchasing" ? (
          <ActivityIndicator color={Colors.paper} size="small" />
        ) : (
          // Keyed so a plan change crossfades the label instead of snapping.
          <Animated.Text
            key={label}
            entering={FadeIn.duration(160)}
            style={styles.ctaText}
          >
            {label}
          </Animated.Text>
        )}
      </TouchableOpacity>

      {phase === "pending" && (
        <Animated.Text entering={FadeIn.duration(200)} style={styles.status}>
          Waiting for approval. Premium unlocks the moment the purchase is
          confirmed.
        </Animated.Text>
      )}
      {phase === "error" && (
        <Animated.Text
          entering={FadeIn.duration(200)}
          style={[styles.status, styles.statusError]}
        >
          The purchase didn&apos;t go through. Check your connection and try
          again.
        </Animated.Text>
      )}

      {selected && (
        <Text style={styles.legal}>{legalLine(selected, trial)}</Text>
      )}

      <View style={styles.links}>
        <Pressable onPress={() => openExternalUrl(TERMS_URL)} hitSlop={10}>
          <Text style={styles.link}>Terms</Text>
        </Pressable>
        <Text style={styles.linkDot}>·</Text>
        <Pressable onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} hitSlop={10}>
          <Text style={styles.link}>Privacy</Text>
        </Pressable>
        <Text style={styles.linkDot}>·</Text>
        <Pressable onPress={handleRestore} hitSlop={10} disabled={busy}>
          {restoring ? (
            <ActivityIndicator color={Colors.muted} size="small" />
          ) : (
            <Text style={styles.link}>Restore Purchases</Text>
          )}
        </Pressable>
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        activeOpacity={0.7}
        disabled={phase === "purchasing"}
      >
        <Text style={styles.later}>{dismissLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center" },
  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: Colors.muted,
    marginBottom: 10,
  },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  status: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.body,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  statusError: { color: Colors.danger },
  legal: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 6,
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    minHeight: 20,
  },
  link: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.muted,
  },
  linkDot: { color: Colors.faint, fontSize: 12 },
  later: {
    marginTop: 16,
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
  },
});
