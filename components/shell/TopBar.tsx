// TopBar — the persistent app header (extracted from MainApp): BackChannel
// wordmark, the contextual referral check-in icon, and the notifications
// bell. Presentation-only; all counts and handlers come from the (tabs)
// layout.

import { Bell, ClipboardCheck } from "@/components/ui/icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

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
}

export function TopBar({
  activeReferralCount,
  staleReferralCount,
  unreadNotificationCount,
  onOpenCheckIn,
  onOpenNotifications,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <Text style={styles.appTitle}>BackChannel</Text>
      <View style={styles.topBarButtons}>
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
            <ClipboardCheck color="#000" size={20} strokeWidth={1.5} />
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
            // Don't optimistically zero the badge here — NotificationsView
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
          <Bell color="#000" size={22} strokeWidth={1.5} />
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
  // Matches the site's .nav-wordmark exactly: small, uppercase, wide
  // positive tracking — a persistent utility mark, not a headline (that's
  // what the marketing hero's big serif treatment is for).
  appTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.ink,
    letterSpacing: 2.2, // ~0.12em at this size
    textTransform: "uppercase",
  },
  topBarButtons: {
    flexDirection: "row",
    gap: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.offWhite,
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
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  headerCountPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
  },
});
