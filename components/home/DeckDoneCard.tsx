import { ChevronRight, Lock, RefreshCcw } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import { DAILY_LIKE_LIMITS, PREMIUM_ENABLED } from "@/constants/config";
import { Colors, Fonts, Type } from "@/constants/theme";
import { hitSlopTo44 } from "@/lib/responsive";

interface DeckDoneCardProps {
  userType: "applicant" | "sponsor";
  deckSize: number;
  sessionLikes: number;
  sessionMatches: number;
  isPremium: boolean;
  /** True while a presentPaywall() call from this card is in flight — the
   * store itself now guards against a concurrent second call succeeding,
   * but these buttons had no disabled/loading state of their own at all,
   * so a fast double-tap could still dispatch two presentPaywall() calls
   * (the second just a no-op) with zero visual feedback either way. */
  unlocking?: boolean;
  onUnlockMore: () => void;
  onReviewAgain: () => void;
  /** Deep-link to the Matches tab — turns the recap numbers into doors. */
  onViewMatches: () => void;
}

/**
 * End-of-deck card: session recap + next actions.
 *
 * Two faces:
 * - Premium: the accomplishment card — ConfirmPop badge, "You're all
 *   caught up", recap, review again. No upsell, ever.
 * - Free: the nightly velvet rope — the same MEMBERS ONLY gate panel
 *   language as the marketplace (lock seal, "Tomorrow's deck is for
 *   members."), with "Unlock with Premium" presenting the RevenueCat
 *   paywall via onUnlockMore. A completed purchase resets the deck AND
 *   fires the global Two Doors celebration automatically.
 *
 * Either way, a fresh match outranks everything: the recap's numbers are
 * springboards, not trophies, so a session that produced matches leads
 * with "Message your new match" and the upsell steps back to a quiet
 * secondary.
 */
export function DeckDoneCard({
  userType,
  deckSize,
  sessionLikes,
  sessionMatches,
  isPremium,
  unlocking = false,
  onUnlockMore,
  onReviewAgain,
  onViewMatches,
}: DeckDoneCardProps) {
  const deckWord = deckSize === 10 ? "ten" : String(deckSize);
  // Upsell only when premium is actually purchasable — with the flag off
  // (beta), isPremium is hardwired false and every upsell CTA would be a
  // dead button, so everyone gets the caught-up card instead. Same
  // PREMIUM_ENABLED && !isPremium guard as the marketplace gate.
  const showUpsell = PREMIUM_ENABLED && !isPremium;
  const showGatePanel = showUpsell && sessionMatches === 0;

  return (
    <Animated.View entering={FadeInUp} style={styles.card}>
      {/* Accomplishment badge (premium only — the free layout gives its
          center stage to the gate panel). Silent pop: this card also
          shows passively when returning to a finished deck, so a haptic
          here would misfire. */}
      {!showUpsell && <ConfirmPop size={64} haptic={null} />}

      {/* Context pill — makes the daily-allotment limit explicit */}
      <View style={styles.pill}>
        <Text style={styles.pillText}>
          DAILY DECK COMPLETE · {deckSize}/{deckSize}
        </Text>
      </View>

      {!showUpsell ? (
        <>
          <Text style={styles.title}>
            You&apos;re all <Text style={styles.titleAccent}>caught up</Text>
          </Text>
          <Text style={styles.sub}>
            You&apos;ve reviewed all {deckSize} cards in today&apos;s deck —
            that&apos;s your daily allotment. A fresh set unlocks tomorrow.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            That&apos;s {deckWord} for{" "}
            <Text style={styles.titleAccent}>today.</Text>
          </Text>
          <Text style={styles.sub}>
            Great session. Here&apos;s how it went:
          </Text>
        </>
      )}

      {/* Session recap — counts live in useJobsStore so they survive a tab
          switch and back mid-deck. */}
      <View style={styles.recap}>
        <View style={styles.recapCell}>
          <Text style={styles.recapValue}>{sessionLikes}</Text>
          <Text style={styles.recapLabel}>
            {userType === "applicant" ? "Interest sent" : "Connected"}
          </Text>
        </View>
        <View style={styles.recapDivider} />
        <TouchableOpacity
          style={styles.recapCell}
          onPress={sessionMatches > 0 ? onViewMatches : undefined}
          disabled={sessionMatches === 0}
          activeOpacity={0.7}
          accessibilityRole={sessionMatches > 0 ? "button" : undefined}
          accessibilityLabel={
            sessionMatches > 0
              ? `View ${sessionMatches} ${sessionMatches === 1 ? "match" : "matches"}`
              : undefined
          }
        >
          <Text style={styles.recapValue}>{sessionMatches}</Text>
          <Text style={styles.recapLabel}>Matches</Text>
          {sessionMatches > 0 && (
            <View style={styles.recapLinkRow}>
              <Text style={styles.recapLinkText}>View</Text>
              <ChevronRight color={Colors.ink} size={12} strokeWidth={2.5} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* The nightly velvet rope — same panel language as the
          marketplace gate, so the premium story reads as one system. */}
      {showGatePanel && (
        <View style={styles.gatePanel}>
          <ConfirmPop
            size={48}
            haptic={null}
            icon={<Lock color={Colors.paper} size={18} strokeWidth={2.2} />}
          />
          <Text style={styles.gateEyebrow}>MEMBERS ONLY</Text>
          <Text style={styles.gateTitle}>
            Tomorrow&apos;s deck is for{" "}
            <Text style={styles.gateTitleAccent}>members.</Text>
          </Text>
          <Text style={styles.gateSub}>
            {DAILY_LIKE_LIMITS.premium} daily likes instead of{" "}
            {DAILY_LIKE_LIMITS.free}, plus the full job marketplace.
          </Text>
        </View>
      )}

      {/* Primary CTA — a fresh match beats everything else you could do
          from here; otherwise the free user gets the unlock. */}
      {sessionMatches > 0 ? (
        <TouchableOpacity
          style={styles.primary}
          onPress={onViewMatches}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryText}>
            {sessionMatches === 1
              ? "Message your new match"
              : "Message your new matches"}
          </Text>
          <ChevronRight color={Colors.paper} size={18} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : (
        showUpsell && (
          <TouchableOpacity
            style={[styles.unlockCta, unlocking && styles.unlockCtaDisabled]}
            onPress={onUnlockMore}
            disabled={unlocking}
            activeOpacity={0.85}
          >
            <Text style={styles.unlockCtaText}>Unlock with Premium</Text>
          </TouchableOpacity>
        )
      )}

      {/* Secondary CTAs */}
      {sessionMatches > 0 && showUpsell && (
        <TouchableOpacity
          style={styles.secondary}
          onPress={onUnlockMore}
          disabled={unlocking}
          activeOpacity={0.7}
        >
          <Lock color={Colors.ink} size={15} strokeWidth={2.2} />
          <Text style={styles.secondaryText}>Unlock with Premium</Text>
        </TouchableOpacity>
      )}
      {showGatePanel ? (
        <TouchableOpacity
          onPress={onReviewAgain}
          activeOpacity={0.7}
          hitSlop={hitSlopTo44(200, 20)}
        >
          <Text style={styles.quietLink}>
            Review today&apos;s deck again
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.secondary,
            !showUpsell && sessionMatches === 0 && styles.secondaryAlone,
          ]}
          onPress={onReviewAgain}
          activeOpacity={0.7}
        >
          <RefreshCcw color={Colors.ink} size={16} strokeWidth={2.2} />
          <Text style={styles.secondaryText}>Review again</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    width: "100%",
    maxWidth: 420,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  pillText: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    color: Colors.ink,
    letterSpacing: 0.6,
  },
  title: {
    ...Type.title,
    fontSize: 26,
    lineHeight: 30,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  sub: {
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  recap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 18,
    width: "100%",
    marginBottom: 24,
  },
  recapCell: {
    flex: 1,
    alignItems: "center",
  },
  // Matches the site's .stat-num (serif for stat/count displays).
  recapValue: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.ink,
  },
  recapLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
    marginTop: 4,
  },
  recapLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },
  recapLinkText: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
    color: Colors.ink,
  },
  recapDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  // ── The nightly gate (free users, no fresh match) ─────────────────────
  gatePanel: {
    width: "100%",
    alignItems: "center",
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  gateEyebrow: {
    fontSize: 9,
    fontFamily: Fonts.sansBold,
    letterSpacing: 2.2,
    color: Colors.muted,
    marginTop: 2,
    marginBottom: 8,
  },
  gateTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 25,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 5,
  },
  gateTitleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  gateSub: {
    fontFamily: Fonts.sansLight,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.body,
    textAlign: "center",
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.ink,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
  },
  primaryText: {
    color: Colors.paper,
    fontSize: 16,
    fontFamily: Fonts.sansBold,
    letterSpacing: -0.2,
  },
  // Pill shape — the premium vocabulary's CTA (matches the marketplace
  // gate sheet), distinct from this card's older squared buttons.
  unlockCta: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockCtaDisabled: {
    opacity: 0.6,
  },
  unlockCtaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 15,
    borderRadius: 16,
    width: "100%",
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryAlone: {
    marginTop: 0,
  },
  secondaryText: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  quietLink: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
  },
});
