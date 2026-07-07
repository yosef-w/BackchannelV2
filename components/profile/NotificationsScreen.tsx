// Full-screen Notifications editor — replaces the old small centered
// SimpleModal. Toggles are grouped (Matches & Interest / Messages /
// Referrals) with a one-line description under each label, since bare
// labels like "Someone Applied to Your Job" previously carried all the
// explanatory weight on their own.

import React, { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { EditorScreen } from "./EditorScreen";
import { SaveStatusPill } from "./SaveStatusPill";
import { useAutosaveStatus } from "./useAutosaveStatus";

const SWITCH_COLORS = {
  trackColor: { false: "#B0B3BA", true: "#000" },
  thumbColor: "#FFF",
  ios_backgroundColor: "#B0B3BA",
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

export function NotificationsScreen({ visible, onClose, userType }: Props) {
  const notificationPreferences = useUserProfileStore(
    (s) => s.data.notificationPreferences || {},
  );
  const updateNotificationPreferences = useUserProfileStore(
    (s) => s.updateNotificationPreferences,
  );
  const showToast = useToastStore((s) => s.showToast);
  const { status, run } = useAutosaveStatus();
  const [savingKey, setSavingKey] = useState<NotifKey | null>(null);

  // Backend gate lives in services/notifications.py:create_notification —
  // missing keys default to enabled, so `undefined` reads as `true`.
  const isEnabled = (key: NotifKey) => notificationPreferences[key] !== false;

  const handleToggle = (key: NotifKey, next: boolean) => {
    setSavingKey(key);
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
    }).finally(() => setSavingKey(null));
  };

  const Row = ({
    notifKey,
    label,
    description,
  }: {
    notifKey: NotifKey;
    label: string;
    description: string;
  }) => (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={isEnabled(notifKey)}
        onValueChange={(v) => handleToggle(notifKey, v)}
        disabled={savingKey === notifKey}
        {...SWITCH_COLORS}
      />
    </View>
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
        />
        {userType === "sponsor" && (
          <Row
            notifKey="job_like"
            label="Someone Applied to Your Job"
            description="An applicant showed interest in a role you sponsor"
          />
        )}
        {userType === "sponsor" && (
          <Row
            notifKey="sponsor_request"
            label="Someone Requested Your Sponsorship"
            description="An applicant asked you to sponsor them for a role"
          />
        )}
      </View>

      <Text style={styles.groupLabel}>MESSAGES</Text>
      <View style={styles.group}>
        <Row
          notifKey="message"
          label="New Messages"
          description="Someone sent you a message"
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
            />
            <Row
              notifKey="waitlist"
              label="Saved Job Got Sponsored"
              description="When someone connects back a wait-listed job to a sponsor"
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
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  group: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 28,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  rowDescription: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
    lineHeight: 16,
  },
});
