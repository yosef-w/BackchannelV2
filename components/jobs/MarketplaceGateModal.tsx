// MarketplaceGateModal — the premium velvet rope on the applicant job
// marketplace. Deliberately gates ACTIONS, not the view: free
// applicants can browse and search everything (fall in love with a
// listing first), and this sheet appears only when they try to act on
// one — like a sponsored role or request a sponsor.
//
// "Unlock with Premium" presents the standard RevenueCat paywall. On a
// completed purchase the caller's pending action runs immediately (the
// like/request the user was trying to do), while the global
// PremiumCelebration overlay plays on top — buy, get the moment, and
// the thing you wanted has already happened underneath it.
//
// Only ever shown when PREMIUM_ENABLED && !isPremium (callers guard);
// with the flag off, the marketplace behaves exactly as before.

import { Lock } from "@/components/ui/icons";
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
import { Colors, Fonts } from "@/constants/theme";

interface MarketplaceGateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Runs after a successful purchase — the action the user was
   * attempting when the gate appeared. */
  onUnlocked: () => void;
}

export function MarketplaceGateModal({
  visible,
  onClose,
  onUnlocked,
}: MarketplaceGateModalProps) {
  const presentPaywall = useSubscriptionStore((state) => state.presentPaywall);
  const [purchasing, setPurchasing] = useState(false);

  if (!visible) return null;

  const handleUnlock = async () => {
    setPurchasing(true);
    try {
      const purchased = await presentPaywall();
      if (purchased) {
        onClose();
        // The celebration overlay (global host) is already opening on
        // top; the intended action completes underneath it.
        onUnlocked();
      }
      // Cancelled/failed: stay on the gate — they can retry or bail.
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
        <View style={styles.body}>
          {/* Silent pop — a gate isn't a success. */}
          <ConfirmPop
            size={64}
            haptic={null}
            icon={<Lock color="#FFF" size={24} strokeWidth={2.2} />}
          />
          <Text style={styles.eyebrow}>MEMBERS ONLY</Text>
          <Text style={styles.title}>
            The marketplace is for{" "}
            <Text style={styles.titleAccent}>members.</Text>
          </Text>
          <Text style={styles.sub}>
            Keep searching every open role for free — liking and sponsor
            requests here are part of BackChannel Premium, along with an
            unlimited daily deck.
          </Text>

          <TouchableOpacity
            style={[styles.cta, purchasing && styles.ctaDisabled]}
            onPress={handleUnlock}
            disabled={purchasing}
            activeOpacity={0.85}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFF" size="small" />
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
