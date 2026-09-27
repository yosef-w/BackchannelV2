// PremiumSheet — the standalone premium surface, for entry points that
// have no specific card to talk about: the Profile tab's upgrade row and
// the end-of-deck card. Same shell as the two gates (dark blur, paper
// sheet, MEMBERS ONLY); the hero is the held cards when there are any,
// otherwise the PlanLedger (what changes, as three struck-and-raised
// corrections), then PremiumCheckout.
//
// Rendered inside its own RN Modal so it stacks above whatever screen
// opened it. Applicants only, like everything premium.

import { BlurView } from "expo-blur";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { HeldLikeTile } from "@/components/home/HeldLikeTile";
import { DismissibleSheet, SheetScrollView } from "@/components/ui/DismissibleSheet";
import { PlanLedger } from "./PlanLedger";
import { PremiumCheckout } from "./PremiumCheckout";
import type { HeldLike } from "@/lib/heldLikes";
import { sheetColumn, sheetMaxHeight } from "@/lib/responsive";
import { DAILY_LIKE_LIMITS } from "@/constants/config";
import { Colors, Fonts, Radii } from "@/constants/theme";

interface PremiumSheetProps {
  visible: boolean;
  trigger: "profile_upgrade_row" | "deck_done";
  /** Cards the like cap held today, when the caller has them. */
  heldLikes?: HeldLike[];
  onClose: () => void;
  /** Entitlement is active. The caller sends anything it was holding. */
  onUnlocked: (outcome: "purchased" | "restored") => void;
}

const HELD_SHOWN = 3;

export function PremiumSheet({
  visible,
  trigger,
  heldLikes = [],
  onClose,
  onUnlocked,
}: PremiumSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const heldCount = heldLikes.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <DismissibleSheet
          scrollDismiss
          onDismiss={onClose}
          style={[styles.sheet, { maxHeight: sheetMaxHeight(windowHeight) }]}
        >
          <SheetScrollView showsVerticalScrollIndicator={false}>
            {/* Upstairs, in ink: the members' side. */}
            <View style={[styles.pitch, sheetColumn]}>
              <Text style={styles.eyebrow}>MEMBERS ONLY</Text>

              {heldCount > 0 ? (
                <>
                  <Text style={styles.title}>
                    {heldCount === 1
                      ? "One you wanted is still "
                      : `${heldCount} you wanted are still `}
                    <Text style={styles.titleAccent}>waiting.</Text>
                  </Text>
                  <Text style={styles.sub}>
                    Members express interest in {DAILY_LIKE_LIMITS.premium} roles
                    a day. Everything held today goes out the moment you join.
                  </Text>
                  <View style={styles.heldPanel}>
                    {heldLikes.slice(0, HELD_SHOWN).map((item, i) => (
                      <View
                        key={item.id}
                        style={[styles.heldRow, i > 0 && styles.heldRowBorder]}
                      >
                        <HeldLikeTile item={item} size={40} compact />
                      </View>
                    ))}
                    {heldCount > HELD_SHOWN && (
                      <Text style={styles.heldMore}>
                        + {heldCount - HELD_SHOWN} more
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.title}>
                    What changes when you{" "}
                    <Text style={styles.titleAccent}>join.</Text>
                  </Text>
                  <PlanLedger onInk style={styles.ledger} />
                </>
              )}
            </View>

            {/* Downstairs, in paper: the transaction. */}
            <View style={styles.checkout}>
              <View style={sheetColumn}>
                <PremiumCheckout
                  trigger={trigger}
                  onUnlocked={(outcome) => {
                    onClose();
                    onUnlocked(outcome);
                  }}
                  dismissLabel="Not now"
                  onDismiss={onClose}
                />
              </View>
            </View>
          </SheetScrollView>
        </DismissibleSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
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
    fontSize: 26,
    lineHeight: 32,
    color: Colors.paper,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  titleAccent: { fontFamily: Fonts.serifItalic, color: Colors.mutedOnInk },
  sub: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  ledger: { marginTop: 12 },
  heldPanel: {
    alignSelf: "stretch",
    backgroundColor: Colors.paper,
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
  },
  heldRow: { paddingVertical: 10 },
  heldRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  heldMore: {
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.muted,
    paddingVertical: 8,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
