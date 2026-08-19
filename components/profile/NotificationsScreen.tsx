// Full-screen Notifications editor — replaces the old small centered
// SimpleModal. Toggles are grouped (Matches & Interest / Messages /
// Referrals) with a one-line description under each label, since bare
// labels like "Someone Applied to Your Job" previously carried all the
// explanatory weight on their own.

import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { EditorScreen } from "./EditorScreen";
import { SaveStatusPill } from "./SaveStatusPill";
import { useAutosaveStatus } from "./useAutosaveStatus";
import { Colors } from "@/constants/theme";

const SWITCH_COLORS = {
  trackColor: { false: Colors.faint, true: "#000" },
  thumbColor: "#FFF",
  ios_backgroundColor: Colors.faint,
} as const;

type NotifKey =
  | "match"
  | "message"
  | "referral"
  | "waitlist"
  | "job_like"
  | "sponsor_request";

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
  notifKey: NotifKey;
  label: string;
  description: string;
  value: boolean;
  onToggle: (key: NotifKey, next: boolean) => void;
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

  // Backend gate lives in services/notifications.py:create_notification —
  // missing keys default to enabled, so `undefined` reads as `true`.
  const isEnabled = (key: NotifKey) => notificationPreferences[key] !== false;

  // The store updates optimistically (and rolls back the key on failure),
  // so the switch stays enabled throughout — no dead time where the user
  // can't re-toggle while the request is in flight.
  const handleToggle = React.useCallback(
    (key: NotifKey, next: boolean) => {
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
    [run, updateNotificationPreferences, showToast],
  );

  return (
    <EditorScreen
      visible={visible}
      onClose={onClose}
      title="Notifications"
      headerRight={<SaveStatusPill status={status} />}
    >
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
