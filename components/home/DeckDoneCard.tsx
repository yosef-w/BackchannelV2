import {
  Check,
  ChevronRight,
  RefreshCcw,
  Sparkles,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface DeckDoneCardProps {
  userType: "applicant" | "sponsor";
  deckSize: number;
  sessionLikes: number;
  sessionMatches: number;
  isPremium: boolean;
  onUnlockMore: () => void;
  onReviewAgain: () => void;
  /** Deep-link to the Matches tab — turns the recap numbers into doors. */
  onViewMatches: () => void;
}

/**
 * End-of-deck card: accomplishment badge, session recap, and next actions.
 * The recap's numbers are springboards, not trophies — finishing the deck
 * with a match means the best next action is to go message them, so the
 * matches cell (and a "View matches" row when the session produced any)
 * deep-links straight to the Matches tab instead of dead-ending here.
 */
export function DeckDoneCard({
  userType,
  deckSize,
  sessionLikes,
  sessionMatches,
  isPremium,
  onUnlockMore,
  onReviewAgain,
  onViewMatches,
}: DeckDoneCardProps) {
  return (
    <Animated.View entering={FadeInUp} style={styles.card}>
      {/* Accomplishment badge */}
      <View style={styles.badge}>
        <Check color="#FFF" size={30} strokeWidth={3} />
      </View>

      {/* Context pill — makes the daily-allotment limit explicit */}
      <View style={styles.pill}>
        <Sparkles color="#000" size={12} strokeWidth={2.5} />
        <Text style={styles.pillText}>
          DAILY DECK COMPLETE · {deckSize}/{deckSize}
        </Text>
      </View>

      <Text style={styles.title}>You&apos;re all caught up</Text>
      <Text style={styles.sub}>
        You&apos;ve reviewed all {deckSize} cards in today&apos;s deck —
        that&apos;s your daily allotment. A fresh set unlocks tomorrow.
      </Text>

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
        >
          <Text style={styles.recapValue}>{sessionMatches}</Text>
          <Text style={styles.recapLabel}>Matches</Text>
          {sessionMatches > 0 && (
            <View style={styles.recapLinkRow}>
              <Text style={styles.recapLinkText}>View</Text>
              <ChevronRight color="#000" size={12} strokeWidth={2.5} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Primary CTA — a fresh match beats everything else you could do
          from here; otherwise premium upsell (hidden for premium users). */}
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
          <ChevronRight color="#FFF" size={18} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : (
        !isPremium && (
          <TouchableOpacity
            style={styles.primary}
            onPress={onUnlockMore}
            activeOpacity={0.85}
          >
            <Sparkles color="#FFF" size={18} strokeWidth={2.5} />
            <Text style={styles.primaryText}>Unlock more cards</Text>
          </TouchableOpacity>
        )
      )}

      {/* Secondary CTAs */}
      {sessionMatches > 0 && !isPremium && (
        <TouchableOpacity
          style={styles.secondary}
          onPress={onUnlockMore}
          activeOpacity={0.7}
        >
          <Sparkles color="#000" size={16} strokeWidth={2.2} />
          <Text style={styles.secondaryText}>Unlock more cards</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.secondary,
          isPremium && sessionMatches === 0 && styles.secondaryAlone,
        ]}
        onPress={onReviewAgain}
        activeOpacity={0.7}
      >
        <RefreshCcw color="#000" size={16} strokeWidth={2.2} />
        <Text style={styles.secondaryText}>Review again</Text>
      </TouchableOpacity>
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
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  recap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 18,
    width: "100%",
    marginBottom: 24,
  },
  recapCell: {
    flex: 1,
    alignItems: "center",
  },
  recapValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  recapLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
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
    fontWeight: "800",
    color: "#000",
  },
  recapDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E5E5",
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
  },
  primaryText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
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
    borderColor: "#E6E6E6",
  },
  secondaryAlone: {
    marginTop: 0,
  },
  secondaryText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700",
  },
});
