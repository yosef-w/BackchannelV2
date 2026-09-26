// LikeLimitGateModal — the daily-like-cap sheet. Distinct from
// MarketplaceGateModal (which gates marketplace ACTIONS entirely for free
// users) and DeckDoneCard (which appears once the whole deck is finished)
// — this one appears mid-deck, the moment a user tries to express
// interest past their daily allowance, so cards remain to browse/pass
// but the accept verb stops working until tomorrow (free) or is raised by
// Premium (free → Premium's higher cap).
//
// This is the deck's peak-intent moment: they just swiped right on a
// specific role at a specific company. So the sheet is built around THAT
// card — it shows it, shows what changes (PlanLedger), and the card is
// HELD rather than dropped: "Keep going" parks it
// (lib/heldLikes.ts), and a purchase, closed right here through
// PremiumCheckout, sends it plus everything else held today (onUnlocked).
//
// Applicants only — sponsors are never capped (constants/config.ts), so
// this sheet never opens for them.
//
// Faces:
// - Free, at the cap, room to hold: the sell above.
// - Free, at the cap, held queue full (everything Premium could still send
//   today is already held): same sell, honest copy.
// - Premium, at the cap: nothing to sell — just says so, one dismiss.

import { Clock } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import { PlanLedger } from "@/components/premium/PlanLedger";
import { PremiumCheckout } from "@/components/premium/PremiumCheckout";
import {
  DismissibleSheet,
  SheetScrollView,
} from "@/components/ui/DismissibleSheet";
import { HeldLikeTile } from "./HeldLikeTile";
import type { HeldLike } from "@/lib/heldLikes";
import { sheetColumn, sheetMaxHeight } from "@/lib/responsive";
import {
  trackLikeLimitGateDismissed,
  trackLikeLimitGateShown,
} from "@/lib/analytics/mixpanel";
import { Colors, Fonts, Radii } from "@/constants/theme";
import { DAILY_LIKE_LIMITS } from "@/constants/config";

interface LikeLimitGateModalProps {
  visible: boolean;
  /** Backdrop / drag dismiss — closes and leaves the card on screen. */
  onClose: () => void;
  /** Whether the account hitting this cap is already Premium. Changes the
   * sheet from a sell to a plain notice — there's nothing to upsell someone
   * who's already bought the higher cap. Both caps themselves are read
   * directly from constants/config.ts's DAILY_LIKE_LIMITS below (not
   * passed in) so this copy can never cite a stale/mismatched number. */
  isPremium: boolean;
  userType: "applicant" | "sponsor";
  /** The card whose like was just refused — what the sheet is about. */
  card: HeldLike | null;
  /** Everything held today, this card included once the caller holds it. */
  held: HeldLike[];
  /** True when the held queue already holds as many as Premium could send
   * before midnight — this card can't be promised "goes now". */
  heldFull: boolean;
  /** Runs once the entitlement is active — the caller sends this like and
   * every held one. No-op for the already-premium face. */
  onUnlocked: () => void;
  /** "Keep going" — close AND advance past the card (no Pass is recorded;
   * the card is held, not rejected). */
  onHold: () => void;
}

export function LikeLimitGateModal(props: LikeLimitGateModalProps) {
  // Mount-gated: the reel's clock and the Shown event restart per raise.
  if (!props.visible) return null;
  return <GateSheet {...props} />;
}

function GateSheet({
  onClose,
  isPremium,
  userType,
  card,
  held,
  heldFull,
  onUnlocked,
  onHold,
}: LikeLimitGateModalProps) {
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (isPremium) return;
    trackLikeLimitGateShown({
      role: userType,
      heldCount: held.length,
      heldFull,
    });
  }, [isPremium, userType, held.length, heldFull]);

  const others = held.filter((h) => h.id !== card?.id);

  const dismiss = () => {
    if (!isPremium) {
      trackLikeLimitGateDismissed({ role: userType, held: !heldFull });
    }
    onClose();
  };

  const hold = () => {
    trackLikeLimitGateDismissed({ role: userType, held: !heldFull });
    onHold();
  };

  if (isPremium) {
    return (
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>
        <DismissibleSheet onDismiss={dismiss} fullSheetGesture style={styles.sheet}>
          <View style={[styles.body, sheetColumn, styles.scroll]}>
            <ConfirmPop
              size={64}
              haptic={null}
              icon={<Clock color={Colors.paper} size={24} strokeWidth={2.2} />}
            />
            <Text style={styles.eyebrow}>TODAY&apos;S LIMIT</Text>
            <Text style={styles.title}>
              You&apos;ve used today&apos;s{" "}
              <Text style={styles.titleAccent}>
                {DAILY_LIKE_LIMITS.premium}.
              </Text>
            </Text>
            <Text style={styles.sub}>
              You can still browse the rest of today&apos;s roles.{" "}
              {DAILY_LIKE_LIMITS.premium} more open up tomorrow.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={dismiss}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </DismissibleSheet>
      </View>
    );
  }

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
        style={[styles.sheet, styles.sheetInk, { maxHeight: sheetMaxHeight(windowHeight) }]}
      >
        <SheetScrollView showsVerticalScrollIndicator={false}>
          {/* Upstairs, in ink: the members' side. The held card sits on a
              paper chip; the ledger shows what changes, paper on ink. */}
          <View style={[styles.pitch, sheetColumn]}>
            {card && (
              <View style={styles.cardChip}>
                <HeldLikeTile item={card} />
                <View style={styles.heldBadge}>
                  <Text style={styles.heldBadgeText}>
                    {heldFull ? "WANTED" : "HELD"}
                  </Text>
                </View>
              </View>
            )}

            <Text style={[styles.eyebrow, styles.eyebrowInk]}>MEMBERS ONLY</Text>

            {heldFull ? (
              <Text style={[styles.title, styles.titleInk]}>
                {held.length} you wanted are{" "}
                <Text style={[styles.titleAccent, styles.titleAccentInk]}>
                  waiting.
                </Text>
              </Text>
            ) : (
              <Text style={[styles.title, styles.titleInk]}>
                You&apos;ve used today&apos;s{" "}
                <Text style={[styles.titleAccent, styles.titleAccentInk]}>
                  {DAILY_LIKE_LIMITS.free}.
                </Text>
              </Text>
            )}

            <Text style={[styles.sub, styles.subInk]}>
              {heldFull
                ? "That's everything Premium can send before midnight. Unlock and they go out today."
                : `Free accounts can express interest in ${DAILY_LIKE_LIMITS.free} roles a day.${card ? " This one is held for you." : ""} Members get ${DAILY_LIKE_LIMITS.premium}.`}
            </Text>

            <PlanLedger onInk style={styles.ledger} />

            {others.length > 0 && !heldFull && (
              <Text style={styles.others}>
                Also held today:{" "}
                <Text style={styles.othersStrong}>
                  {others.map((h) => h.sub).join(", ")}
                </Text>
              </Text>
            )}
          </View>

          {/* Downstairs, in paper: the transaction, rising over the ink
              with its own rounded edge. */}
          <View style={styles.checkout}>
            <View style={sheetColumn}>
              <PremiumCheckout
                trigger="like_limit_gate"
                onUnlocked={() => {
                  onClose();
                  onUnlocked();
                }}
                dismissLabel="Keep going"
                onDismiss={hold}
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
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
  },
  sheetInk: { backgroundColor: Colors.ink },
  scroll: { paddingHorizontal: 28, paddingBottom: 40 },
  body: {
    alignItems: "center",
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
  cardChip: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    padding: 12,
    paddingRight: 14,
    borderRadius: Radii.lg,
    backgroundColor: Colors.paper,
  },
  heldBadge: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  heldBadgeText: {
    color: Colors.paper,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: Colors.muted,
    marginTop: 18,
    marginBottom: 10,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
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
    paddingHorizontal: 6,
  },
  ledger: { marginTop: 20, marginBottom: 18 },
  others: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.mutedOnInk,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  othersStrong: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
  },
  // ── Paper on ink (the free face's pitch zone) ────────────────────────
  eyebrowInk: { color: Colors.mutedOnInk },
  titleInk: { color: Colors.paper },
  titleAccentInk: { color: Colors.mutedOnInk },
  subInk: { color: "rgba(255,255,255,0.72)" },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
});
