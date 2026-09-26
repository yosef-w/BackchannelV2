// MarketplaceGateModal — the premium velvet rope on the applicant job
// marketplace. Deliberately gates ACTIONS, not the view: free
// applicants can browse and search everything (fall in love with a
// listing first), and this sheet appears only when they try to act on
// one — like a sponsored role or request a sponsor.
//
// The sheet sells the DIFFERENCE, not the rule, and then closes the sale
// in place. It's raised at peak intent (they just tapped "Get a Sponsor"
// on a real role), so the copy names that role and that company, the
// PlanLedger shows what changes as three struck-and-raised corrections,
// and PremiumCheckout puts the plans and the purchase button right
// underneath. One sheet from desire to receipt; no second paywall.
//
// On a completed purchase the caller's pending action runs immediately
// (the like/request the user was trying to do), while the global
// PremiumCelebration overlay plays on top.
//
// Only ever shown when PREMIUM_ENABLED && !isPremium (callers guard);
// with the flag off, the marketplace behaves exactly as before.

import { BlurView } from "expo-blur";
import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { PlanLedger } from "@/components/premium/PlanLedger";
import { PremiumCheckout } from "@/components/premium/PremiumCheckout";
import {
  DismissibleSheet,
  SheetScrollView,
} from "@/components/ui/DismissibleSheet";
import { sheetColumn, sheetMaxHeight } from "@/lib/responsive";
import {
  trackMarketplaceGateDismissed,
  trackMarketplaceGateShown,
} from "@/lib/analytics/mixpanel";
import { Colors, Fonts, Radii } from "@/constants/theme";

export interface GateJob {
  id: string;
  title: string;
  organization: string;
}

/** Which marketplace action raised the gate; drives the headline. */
export type MarketplaceGateIntent = "request" | "like";

interface MarketplaceGateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Runs once the entitlement is active — the action the user was
   * attempting when the gate appeared. */
  onUnlocked: () => void;
  /** Which action raised the gate. Drives the headline and the reel. */
  intent: MarketplaceGateIntent;
  /** The role the user was acting on, so the sheet can name it. */
  job: GateJob | null;
}

export function MarketplaceGateModal(props: MarketplaceGateModalProps) {
  // Mount-gated so the reel's one-shot clock and the Shown event both
  // fire fresh every time the gate is raised.
  if (!props.visible) return null;
  return <GateSheet {...props} />;
}

function GateSheet({
  onClose,
  onUnlocked,
  intent,
  job,
}: MarketplaceGateModalProps) {
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    trackMarketplaceGateShown({ intent, jobId: job?.id ?? null });
  }, [intent, job?.id]);

  const dismiss = () => {
    trackMarketplaceGateDismissed({ intent });
    onClose();
  };

  const org = job?.organization?.trim();
  const title = job?.title?.trim();

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={dismiss}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        scrollDismiss
        onDismiss={dismiss}
        style={[styles.sheet, { maxHeight: sheetMaxHeight(windowHeight) }]}
      >
        <SheetScrollView showsVerticalScrollIndicator={false}>
          {/* Upstairs, in ink: the members' side. The headline names the
              role; the ledger shows what changes, paper on ink. */}
          <View style={[styles.pitch, sheetColumn]}>
            <Text style={styles.eyebrow}>MEMBERS ONLY</Text>

            {intent === "request" ? (
              <>
                <Text style={styles.title}>
                  {org ? (
                    <>
                      Put a sponsor at{" "}
                      <Text style={styles.titleAccent}>{org}</Text> in your
                      corner.
                    </>
                  ) : (
                    <>
                      Put a sponsor{" "}
                      <Text style={styles.titleAccent}>in your corner.</Text>
                    </>
                  )}
                </Text>
                <Text style={styles.sub}>
                  {org
                    ? `Your request reaches every sponsor at ${org}. They see your profile and can put you forward directly. `
                    : "Your request reaches every sponsor at that company. They see your profile and can put you forward directly. "}
                  Members request on every role, without limits.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>
                  Let the sponsor behind this role{" "}
                  <Text style={styles.titleAccent}>know.</Text>
                </Text>
                <Text style={styles.sub}>
                  {title && org
                    ? `As a member, your interest goes straight to the sponsor backing the ${title} at ${org}. `
                    : "As a member, your interest goes straight to the sponsor backing this role. "}
                  If they&apos;re interested too, it&apos;s a match and an
                  introduction.
                </Text>
              </>
            )}

            <PlanLedger onInk style={styles.ledger} />
          </View>

          {/* Downstairs, in paper: the transaction, rising over the ink
              with its own rounded edge. The seam is the border. */}
          <View style={styles.checkout}>
            <View style={sheetColumn}>
              <PremiumCheckout
                trigger="marketplace_gate"
                onUnlocked={() => {
                  onClose();
                  // The celebration overlay (global host) is already
                  // opening on top; the intended action completes
                  // underneath it.
                  onUnlocked();
                }}
                dismissLabel="Keep browsing"
                onDismiss={dismiss}
              />
            </View>
          </View>
        </SheetScrollView>
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
    backgroundColor: Colors.ink,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
  },
  pitch: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 34,
  },
  checkout: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    marginTop: -14,
    paddingTop: 22,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: Colors.mutedOnInk,
    marginTop: 14,
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.paper,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.mutedOnInk,
  },
  sub: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  ledger: { marginTop: 22 },
});
