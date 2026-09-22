// Full-screen Notifications editor — replaces the old small centered
// SimpleModal. Toggles are grouped (Matches & Interest / Messages /
// Referrals) with a one-line description under each label, since bare
// labels like "Someone Applied to Your Job" previously carried all the
// explanatory weight on their own.

import * as Notifications from "expo-notifications";
import React from "react";
import { Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import {
  getDeckRemindersEnabled,
  scheduleDailyDeckReminder,
  setDeckRemindersEnabled,
} from "@/lib/localNotifications";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { EditorScreen } from "./EditorScreen";
import { SaveStatusPill } from "./SaveStatusPill";
import { useAutosaveStatus } from "./useAutosaveStatus";
import { Colors } from "@/constants/theme";

const SWITCH_COLORS = {
  trackColor: { false: Colors.faint, true: Colors.ink },
  thumbColor: Colors.paper,
  ios_backgroundColor: Colors.faint,
} as const;

type NotifKey =
  | "match"
  | "message"
  | "referral"
  | "waitlist"
  | "job_like"
  | "sponsor_request";

// The deck reminders are a device-local schedule, not a backend push type
// (see lib/localNotifications.ts) — a distinct key space from NotifKey.
// AnyNotifKey lets the shared Row component render either kind; handleToggle
// below is what actually keeps their two very different persistence paths
// (backend PATCH vs. AsyncStorage) from crossing.
type LocalNotifKey = "deck_reminders";
type AnyNotifKey = NotifKey | LocalNotifKey;

interface Props {
  visible: boolean;
  onClose: () => void;
  userType: "applicant" | "sponsor";
}

// Module-level (NOT defined inside the screen component): an inline
// component is a new type every render, so React would unmount/remount
// every row — and its native Switch — on any state change, making all the
// toggles flash whenever one was touched or the save pill ticked over.
const Row = React.memo(function Row({
  notifKey,
  label,
  description,
  value,
  onToggle,
}: {
  notifKey: AnyNotifKey;
  label: string;
  description: string;
  value: boolean;
  onToggle: (key: AnyNotifKey, next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => onToggle(notifKey, v)}
        {...SWITCH_COLORS}
      />
    </View>
  );
});

export function NotificationsScreen({ visible, onClose, userType }: Props) {
  const notificationPreferences = useUserProfileStore(
    (s) => s.data.notificationPreferences || {},
  );
  const updateNotificationPreferences = useUserProfileStore(
    (s) => s.updateNotificationPreferences,
  );
  const showToast = useToastStore((s) => s.showToast);
  const { status, run } = useAutosaveStatus();

  // These toggles only control which push TYPES the backend will send —
  // they say nothing about whether the OS will actually deliver them.
  // usePushSetup.ts checks getPermissionsAsync() once, at registration
  // time, and never surfaces that status anywhere — so a user who denied
  // the permission (or later disabled it in iOS Settings) sees every
  // switch here happily "on" with zero indication that no push will ever
  // arrive regardless. Re-checked every time this screen opens, since
  // permission can change in system Settings while the app isn't running.
  const [osPermissionDenied, setOsPermissionDenied] = React.useState(false);
  React.useEffect(() => {
    if (!visible) return;
    Notifications.getPermissionsAsync()
      .then(({ status }) => setOsPermissionDenied(status !== "granted"))
      .catch(() => {});
  }, [visible]);

  // Local-only preference — see lib/localNotifications.ts. Defaults to true
  // (its own default) until the read resolves, matching the reminders'
  // original always-on behavior so the switch never flashes "off" on open.
  const [deckRemindersEnabled, setDeckRemindersEnabledState] =
    React.useState(true);
  React.useEffect(() => {
    if (!visible) return;
    getDeckRemindersEnabled().then(setDeckRemindersEnabledState);
  }, [visible]);

  // Backend gate lives in services/notifications.py:create_notification —
  // missing keys default to enabled, so `undefined` reads as `true`.
  const isEnabled = (key: AnyNotifKey) =>
    key === "deck_reminders"
      ? deckRemindersEnabled
      : notificationPreferences[key] !== false;

  // The store updates optimistically (and rolls back the key on failure),
  // so the switch stays enabled throughout — no dead time where the user
  // can't re-toggle while the request is in flight. The local deck-reminders
  // key takes a completely different path (AsyncStorage, not a backend
  // PATCH) — it can't fail the way a network request can, so it updates
  // state directly rather than routing through the save-status pill.
  const handleToggle = React.useCallback(
    (key: AnyNotifKey, next: boolean) => {
      if (key === "deck_reminders") {
        setDeckRemindersEnabledState(next);
        setDeckRemindersEnabled(next).then(() => {
          // Turning OFF cancels immediately inside setDeckRemindersEnabled.
          // Turning back ON needs its own (re-)schedule call — the daily
          // reminder otherwise only gets (re-)armed the next time push
          // registration runs, i.e. the next app launch.
          if (next) scheduleDailyDeckReminder(userType);
        });
        return;
      }
      run(async () => {
        try {
          await updateNotificationPreferences({ [key]: next });
        } catch {
          showToast(
            "Notification setting could not be saved. Please try again.",
            "error",
          );
          throw new Error("failed");
        }
      }).catch(() => {
        // Status pill + toast already reflect the failure.
      });
    },
    [run, updateNotificationPreferences, showToast, userType],
  );

  return (
    <EditorScreen
      visible={visible}
      onClose={onClose}
      title="Notifications"
      headerRight={<SaveStatusPill status={status} />}
    >
      {osPermissionDenied && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={() => Linking.openSettings()}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionBannerText}>
            Notifications are turned off for this app in your phone&apos;s
            Settings — none of these will actually arrive until you turn
            them back on.
          </Text>
          <Text style={styles.permissionBannerLink}>Open Settings →</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.groupLabel}>DECK REMINDERS</Text>
      <View style={styles.group}>
        <Row
          notifKey="deck_reminders"
          label="Daily Deck Reminders"
          description="A morning nudge when your fresh deck is ready, and an afternoon one if you haven't gone through it yet"
          value={isEnabled("deck_reminders")}
          onToggle={handleToggle}
        />
      </View>

      <Text style={styles.groupLabel}>MATCHES & INTEREST</Text>
      <View style={styles.group}>
        <Row
          notifKey="match"
          label="New Matches"
          description="When you and someone else both connect"
          value={isEnabled("match")}
          onToggle={handleToggle}
        />
        {userType === "sponsor" && (
          <Row
            notifKey="job_like"
            label="Someone Applied to Your Job"
            description="An applicant showed interest in a role you sponsor"
            value={isEnabled("job_like")}
            onToggle={handleToggle}
          />
        )}
        {userType === "sponsor" && (
          <Row
            notifKey="sponsor_request"
            label="Someone Requested Your Sponsorship"
            description="An applicant asked you to sponsor them for a role"
            value={isEnabled("sponsor_request")}
            onToggle={handleToggle}
          />
        )}
      </View>

      <Text style={styles.groupLabel}>MESSAGES</Text>
      <View style={styles.group}>
        <Row
          notifKey="message"
          label="New Messages"
          description="Someone sent you a message"
          value={isEnabled("message")}
          onToggle={handleToggle}
        />
      </View>

      {userType === "applicant" && (
        <>
          <Text style={styles.groupLabel}>REFERRALS</Text>
          <View style={styles.group}>
            <Row
              notifKey="referral"
              label="Referral Updates"
              description="A sponsor formally refers you, or updates your status"
              value={isEnabled("referral")}
              onToggle={handleToggle}
            />
            <Row
              notifKey="waitlist"
              label="Saved Job Got Sponsored"
              description="When someone connects back a wait-listed job to a sponsor"
              value={isEnabled("waitlist")}
              onToggle={handleToggle}
            />
          </View>
        </>
      )}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  permissionBanner: {
    backgroundColor: Colors.offWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
    gap: 6,
  },
  permissionBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.body,
  },
  permissionBannerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  group: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
  },
  rowDescription: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
});
