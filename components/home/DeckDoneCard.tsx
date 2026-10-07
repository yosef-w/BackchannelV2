import { ChevronRight, Lock } from "@/components/ui/icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import { QuietAction } from "@/components/matches/JobSheetKit";
import { HeldLikeTile } from "./HeldLikeTile";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import type { HeldLike } from "@/lib/heldLikes";
import { priceAnchor } from "@/lib/premiumPricing";
import { DAILY_LIKE_LIMITS, PREMIUM_ENABLED } from "@/constants/config";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";
import { hitSlopTo44 } from "@/lib/responsive";

interface DeckDoneCardProps {
  userType: "applicant" | "sponsor";
  deckSize: number;
  sessionLikes: number;
  sessionMatches: number;
  isPremium: boolean;
  /** Cards the like cap held back today (lib/heldLikes.ts). The free
   * face is built around them: real, specific, still-wanted. */
  heldLikes: HeldLike[];
  /** Opens the PremiumSheet; on purchase the caller sends every held like. */
  onUnlockMore: () => void;
  onReviewAgain: () => void;
  /** Optional quiet "Invite someone" action (the invite loop). Omitted → not shown. */
  onInvite?: () => void;
  /** Deep-link to the Matches tab — turns the recap numbers into doors. */
  onViewMatches: () => void;
}

const HELD_SHOWN = 3;

/**
 * End-of-deck card: session recap + next actions.
 *
 * Two faces:
 * - Premium: the accomplishment card — ConfirmPop badge, "You're all
 *   caught up", recap, review again. No upsell, ever.
 * - Free: the ledger. Leads with what the cap held back — "3 you wanted
 *   are still waiting" over the actual cards — and a single "Send them"
 *   CTA that opens the RevenueCat paywall; a purchase sends them all
 *   (HomeView) while the Two Doors celebration plays on top. With
 *   nothing held it falls back to a quiet, honest members panel: what
 *   Premium actually delivers today is the higher daily like cap (see
 *   docs/BACKEND_CHANGES_NEEDED.md §Y — never promise a bigger deck).
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
  heldLikes,
  onUnlockMore,
  onReviewAgain,
  onInvite,
  onViewMatches,
}: DeckDoneCardProps) {
  const packages = useSubscriptionStore((state) => state.packages);
  const anchor = useMemo(() => priceAnchor(packages), [packages]);

  const deckWord = deckSize === 10 ? "ten" : String(deckSize);
  // Upsell only when premium is actually purchasable — with the flag off
  // (beta), isPremium is hardwired false and every upsell CTA would be a
  // dead button, so everyone gets the caught-up card instead. Applicants
  // only: sponsors are never capped and are never asked to subscribe.
  const showUpsell =
    PREMIUM_ENABLED && !isPremium && userType === "applicant";
  const held = showUpsell ? heldLikes : [];
  const heldCount = held.length;
  const showGatePanel = showUpsell && sessionMatches === 0 && heldCount === 0;
  const isSponsor = userType === "sponsor";
  const sentLabel = isSponsor ? "Connected" : "Interest sent";
  const noun = isSponsor ? "candidates" : "roles";
  const wanted = sessionLikes + heldCount;

  return (
    <Animated.View entering={FadeInUp} style={styles.card}>
      {/* Accomplishment badge (premium only — the free layout gives its
          center stage to the held cards). Silent pop: this card also
          shows passively when returning to a finished deck, so a haptic
          here would misfire. */}
      {!showUpsell && <ConfirmPop size={64} haptic={null} />}

      {/* Context pill — makes the daily-allotment limit explicit */}
      <View style={styles.pill}>
        <Text style={styles.pillText}>
          TODAY&apos;S {noun.toUpperCase()} · {deckSize} OF {deckSize}
        </Text>
      </View>

      {!showUpsell ? (
        <>
          <Text style={styles.title}>
            You&apos;re all <Text style={styles.titleAccent}>caught up.</Text>
          </Text>
          <Text style={styles.sub}>
            You&apos;ve reviewed all {deckSize} of today&apos;s {noun}. A fresh
            set arrives tomorrow.
          </Text>
        </>
      ) : heldCount > 0 ? (
        <>
          <Text style={styles.title}>
            {heldCount === 1
              ? "One you wanted is still "
              : `${heldCount} you wanted are still `}
            <Text style={styles.titleAccent}>waiting.</Text>
          </Text>
          <Text style={styles.sub}>
            You reviewed {deckSize}, wanted {wanted}, and could express
            interest in {sessionLikes}. Members get {DAILY_LIKE_LIMITS.premium}{" "}
            a day.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            That&apos;s today&apos;s{" "}
            <Text style={styles.titleAccent}>{deckWord}.</Text>
          </Text>
          <Text style={styles.sub}>Here&apos;s how it went.</Text>
        </>
      )}

      {/* Session recap — counts live in useJobsStore so they survive a tab
          switch and back mid-deck. The free face adds the held column so
          the ledger reads sent / waiting / matched at a glance. */}
      <View style={styles.recap}>
        <View style={styles.recapCell}>
          <Text style={styles.recapValue}>{sessionLikes}</Text>
          <Text style={styles.recapLabel}>{sentLabel}</Text>
        </View>
        {showUpsell && (
          <>
            <View style={styles.recapDivider} />
            <View style={styles.recapCell}>
              <Text
                style={[
                  styles.recapValue,
                  heldCount === 0 && styles.recapValueQuiet,
                ]}
              >
                {heldCount}
              </Text>
              <Text style={styles.recapLabel}>Waiting</Text>
            </View>
          </>
        )}
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

      {/* The held cards — the specific things they wanted, by name. */}
      {heldCount > 0 && (
        <View style={styles.heldPanel}>
          <View style={styles.heldHeader}>
            <Text style={styles.heldEyebrow}>HELD FOR YOU</Text>
            <View style={styles.heldBadge}>
              <Lock color={Colors.paper} size={9} strokeWidth={2.6} />
              <Text style={styles.heldBadgeText}>MEMBERS</Text>
            </View>
          </View>
          {held.slice(0, HELD_SHOWN).map((item, i) => (
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
      )}

      {/* The nightly members panel — only when there's nothing more
          specific to say. Sells the cap Premium actually raises. */}
      {showGatePanel && (
        <View style={styles.gatePanel}>
          <ConfirmPop
            size={48}
            haptic={null}
            icon={<Lock color={Colors.paper} size={18} strokeWidth={2.2} />}
          />
          <Text style={styles.gateEyebrow}>MEMBERS ONLY</Text>
          <Text style={styles.gateTitle}>
            {DAILY_LIKE_LIMITS.premium} a day, as a{" "}
            <Text style={styles.gateTitleAccent}>member.</Text>
          </Text>
          <Text style={styles.gateSub}>
            Free accounts can express interest in {DAILY_LIKE_LIMITS.free}{" "}
            roles a day. Members get {DAILY_LIKE_LIMITS.premium}, plus the
            full job marketplace.
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
            style={styles.unlockCta}
            onPress={onUnlockMore}
            activeOpacity={0.85}
          >
            <Text style={styles.unlockCtaText}>Unlock Premium</Text>
          </TouchableOpacity>
        )
      )}

      {/* Secondary CTAs — quiet text, never a second filled/boxed button. */}
      {sessionMatches > 0 && showUpsell && (
        <QuietAction label="Unlock Premium" onPress={onUnlockMore} />
      )}

      {showUpsell && anchor && (
        <Text style={styles.anchor}>{anchor}</Text>
      )}

      {showUpsell ? (
        <TouchableOpacity
          onPress={onReviewAgain}
          activeOpacity={0.7}
          hitSlop={hitSlopTo44(200, 20)}
        >
          <Text style={styles.quietLink}>
            Review today&apos;s {noun} again
          </Text>
        </TouchableOpacity>
      ) : (
        <QuietAction label="Review again" onPress={onReviewAgain} />
      )}

      {/* The end of a deck is a good moment to bring someone in: they just
          got value and the next card isn't until tomorrow. */}
      {onInvite && (
        <QuietAction
          label={userType === "sponsor" ? "Invite a colleague" : "Invite someone"}
          onPress={onInvite}
        />
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
    marginBottom: 24,
  },
  // Flat between hairlines, not a tinted recessed box.
  recap: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 18,
    width: "100%",
    marginBottom: 16,
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
  recapValueQuiet: { color: Colors.faint },
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
  // ── Held cards (free users, cap hit) ─────────────────────────────────
  heldPanel: {
    width: "100%",
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.xl,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 20,
  },
  heldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heldEyebrow: {
    fontSize: 9,
    fontFamily: Fonts.sansBold,
    letterSpacing: 2.2,
    color: Colors.muted,
  },
  heldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heldBadgeText: {
    color: Colors.paper,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heldRow: {
    paddingVertical: 10,
  },
  heldRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  heldMore: {
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.muted,
    paddingVertical: 8,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // ── The nightly gate (free users, nothing held, no fresh match) ───────
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
    borderRadius: 999,
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
  unlockCtaText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  anchor: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
  quietLink: {
    marginTop: 16,
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
    textAlign: "center",
  },
});
