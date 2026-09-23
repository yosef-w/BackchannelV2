// LikeLimitGateModal — the daily-like-cap sheet. Distinct from
// MarketplaceGateModal (which gates marketplace ACTIONS entirely for free
// users) and DeckDoneCard's gate panel (which appears once the whole deck
// is finished) — this one appears mid-deck, the moment a user tries to
// send a like past their daily allowance, so cards remain to browse/pass
// but the accept verb stops working until tomorrow (free) or is raised by
// Premium (free → Premium's higher cap).
//
// Two faces, same sheet:
// - Free, under the cap: never shown (handled entirely by the caller).
// - Free, at the cap: sells Premium's higher daily like allowance — same
//   "Unlock with Premium" RevenueCat paywall as every other gate. On a
//   completed purchase, the caller's pending like retries immediately
//   (onUnlocked), same pattern as MarketplaceGateModal.
// - Premium, at the cap: nothing to sell — just says so plainly, one
//   dismiss button. Never a dead end either way.

import { Clock, Lock } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import { DismissibleSheet } from "@/components/ui/DismissibleSheet";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { sheetColumn } from "@/lib/responsive";
import { Colors, Fonts, Radii } from "@/constants/theme";
import { DAILY_LIKE_LIMITS } from "@/constants/config";

interface LikeLimitGateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Whether the account hitting this cap is already Premium. Changes the
   * sheet from a sell to a plain notice — there's nothing to upsell someone
   * who's already bought the higher cap. Both caps themselves are read
   * directly from constants/config.ts's DAILY_LIKE_LIMITS below (not
   * passed in) so this copy can never cite a stale/mismatched number. */
  isPremium: boolean;
  userType: "applicant" | "sponsor";
  /** Runs after a successful purchase — the caller re-attempts the like
   * that triggered this gate. No-op for the already-premium face (no
   * purchase path there). */
  onUnlocked: () => void;
}

export function LikeLimitGateModal({
  visible,
  onClose,
  isPremium,
  userType,
  onUnlocked,
}: LikeLimitGateModalProps) {
  const presentPaywall = useSubscriptionStore((state) => state.presentPaywall);
  const [purchasing, setPurchasing] = useState(false);

  if (!visible) return null;

  const verb = userType === "sponsor" ? "connect" : "like";

  const handleUnlock = async () => {
    setPurchasing(true);
    try {
      const purchased = await presentPaywall("like_limit_gate");
      if (purchased) {
        onClose();
        onUnlocked();
      }
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onClose} fullSheetGesture style={styles.sheet}>
        <View style={[styles.body, sheetColumn]}>
          <ConfirmPop
            size={64}
            haptic={null}
            icon={
              isPremium ? (
                <Clock color={Colors.paper} size={24} strokeWidth={2.2} />
              ) : (
                <Lock color={Colors.paper} size={24} strokeWidth={2.2} />
              )
            }
          />

          {isPremium ? (
            <>
              <Text style={styles.eyebrow}>TODAY&apos;S LIMIT</Text>
              <Text style={styles.title}>
                That&apos;s your {DAILY_LIKE_LIMITS.premium} for{" "}
                <Text style={styles.titleAccent}>today.</Text>
              </Text>
              <Text style={styles.sub}>
                You can still browse the rest of today&apos;s deck — a fresh
                set of {verb}s opens up tomorrow.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Got it</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>MEMBERS ONLY</Text>
              <Text style={styles.title}>
                Out of {verb}s for{" "}
                <Text style={styles.titleAccent}>today.</Text>
              </Text>
              <Text style={styles.sub}>
                Free accounts get {DAILY_LIKE_LIMITS.free} a day. Premium
                raises that to {DAILY_LIKE_LIMITS.premium} — plus the full
                job marketplace.
              </Text>
              <TouchableOpacity
                style={[styles.cta, purchasing && styles.ctaDisabled]}
                onPress={handleUnlock}
                disabled={purchasing}
                activeOpacity={0.85}
              >
                {purchasing ? (
                  <ActivityIndicator color={Colors.paper} size="small" />
                ) : (
                  <Text style={styles.ctaText}>Unlock with Premium</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                activeOpacity={0.7}
              >
                <Text style={styles.later}>Maybe later</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  body: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: Colors.muted,
    marginTop: 6,
    marginBottom: 10,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  sub: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.body,
    textAlign: "center",
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  later: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
  },
});
