// TopBar — the persistent app header (extracted from MainApp): BackChannel
// wordmark, the contextual referral check-in icon, and the notifications
// bell. Presentation-only; all counts and handlers come from the (tabs)
// layout.

import { Bell, ChevronDown, ClipboardCheck } from "@/components/ui/icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale } from "@/lib/responsive";

interface TopBarProps {
  /** Contextual — the check-in icon only renders when there are live
   * referrals to check in on (a brand-new user tapping it previously got a
   * full-screen "no active referrals" sheet). */
  activeReferralCount: number;
  /** Referrals with no update in 7+ days — shown as the icon's count pill,
   * so it reads "N things need you". */
  staleReferralCount: number;
  unreadNotificationCount: number;
  onOpenCheckIn: () => void;
  onOpenNotifications: () => void;
  /** The active side's short name ("Sponsor" / "Job search") — set only
   * for an account that holds both sides (docs/DUAL_SIDES.md). Renders the
   * switcher pill; everyone else sees the bar exactly as before. */
  sideLabel?: string | null;
  onOpenSideSwitcher?: () => void;
  /** How many things are waiting on the account's OTHER side — a dot on
   * the pill, so they aren't missed while this side is on screen. */
  otherSideWaiting?: number;
}

export function TopBar({
  activeReferralCount,
  staleReferralCount,
  unreadNotificationCount,
  onOpenCheckIn,
  onOpenNotifications,
  sideLabel,
  onOpenSideSwitcher,
  otherSideWaiting = 0,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <Text style={styles.appTitle}>
        BackChannel
        <Text style={styles.appTitlePeriod}>.</Text>
      </Text>
      <View style={[styles.topBarButtons, sideLabel ? styles.topBarButtonsTight : null]}>
        {sideLabel && onOpenSideSwitcher ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpenSideSwitcher();
            }}
            activeOpacity={0.7}
            style={styles.sidePill}
            accessibilityRole="button"
            accessibilityLabel={`Switch sides. Currently ${sideLabel}${
              otherSideWaiting > 0
                ? `. ${otherSideWaiting} waiting on your other side`
                : ""
            }`}
          >
            <Text
              style={styles.sidePillText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={FontScale.label}
            >
              {sideLabel.toUpperCase()}
            </Text>
            <ChevronDown color={Colors.ink} size={12} strokeWidth={2.4} />
            {otherSideWaiting > 0 ? <View style={styles.sidePillDot} /> : null}
          </TouchableOpacity>
        ) : null}
        {activeReferralCount > 0 && (
          <TouchableOpacity
            onPress={onOpenCheckIn}
            activeOpacity={0.7}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel={
              staleReferralCount > 0
                ? `Referral check-in, ${staleReferralCount} needing updates`
                : "Referral check-in"
            }
            accessibilityHint="Review and update the status of your referrals"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <ClipboardCheck color={Colors.ink} size={20} strokeWidth={1.5} />
            {staleReferralCount > 0 && (
              <View style={styles.headerCountPill}>
                <Text style={styles.headerCountPillText}>
                  {staleReferralCount > 9 ? "9+" : staleReferralCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Don't optimistically zero the badge here — NotificationsFeedView
            // does NOT auto-mark-all-read; the real count is refetched when
            // the user leaves the screen.
            onOpenNotifications();
          }}
          activeOpacity={0.7}
          style={styles.headerIconButton}
          accessibilityRole="button"
          accessibilityLabel={
            unreadNotificationCount > 0
              ? `Notifications, ${unreadNotificationCount} unread`
              : "Notifications"
          }
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Bell color={Colors.ink} size={22} strokeWidth={1.5} />
          {unreadNotificationCount > 0 && (
            <View style={styles.headerCountPill}>
              <Text style={styles.headerCountPillText}>
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  // The splash/hero wordmark, carried into the app chrome: DM Serif
  // Display Italic — the same glyphs the splash types out — in ink, with
  // the trailing period in muted (the site's em-accent nod). Ink rather
  // than the splash's full muted because up here it's the standing brand
  // anchor, not an accent word inside a sentence; full muted at this
  // size reads disabled.
  appTitle: {
    fontFamily: Fonts.serifItalic,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: -0.4,
  },
  appTitlePeriod: {
    color: Colors.muted,
  },
  topBarButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // The side switcher — an ink hairline (the icon buttons' are quiet grey)
  // because it's the one control here that changes what the whole app shows.
  // With the pill, the row holds the wordmark, the pill and up to two icon
  // buttons — on a 375–402pt phone that only fits with tighter gaps.
  topBarButtonsTight: { gap: 8, flexShrink: 1, marginLeft: 10 },
  sidePill: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  sidePillDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.ink,
    borderWidth: 2,
    borderColor: Colors.paper,
  },
  sidePillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.ink,
    flexShrink: 1,
  },
  // Flat letterpress buttons — paper fill with a hairline, not a gray
  // recess; the chrome stays quiet so the wordmark carries the row.
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Count pill on a header icon — says HOW MUCH is waiting, not just that
  // something is. Same black count-pill language as section headers on
  // every tab.
  headerCountPill: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.paper,
  },
  headerCountPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.paper,
  },
});
