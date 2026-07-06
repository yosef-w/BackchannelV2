// Full-screen Privacy & Security editor. Change Password is a sub-step
// pushed within this same screen (via EditorScreen's onBack) instead of the
// old pattern of closing this modal and opening a second one on top of it.
//
// Change Email is intentionally not surfaced here — the backend endpoint
// still returns 501, and the old modal for it was already unreachable
// (nothing called setShowEmailChange). Once that ships, add it as a second
// sub-step alongside "password".

import { ChevronRight, Lock, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  trackPrivacyPolicyTapped,
  trackTermsTapped,
} from "../../lib/analytics/mixpanel";
import { changePassword } from "../../lib/api";
import { useToastStore } from "../../stores/useToastStore";
import { EditorScreen } from "./EditorScreen";

const TERMS_URL = "https://backchannelapp.netlify.app/terms.html";
const PRIVACY_POLICY_URL = "https://backchannelapp.netlify.app/privacy.html";

type Step = "main" | "password";

interface Props {
  visible: boolean;
  onClose: () => void;
  onDeleteAccount: () => void;
}

export function PrivacySecurityScreen({
  visible,
  onClose,
  onDeleteAccount,
}: Props) {
  const [step, setStep] = useState<Step>("main");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [updating, setUpdating] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  };

  const handleClose = () => {
    resetPasswordFields();
    setStep("main");
    onClose();
  };

  const handlePasswordChange = async () => {
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setUpdating(true);
    try {
      await changePassword(currentPassword, newPassword);
      resetPasswordFields();
      setStep("main");
      showToast("Password changed successfully.", "success");
    } catch (err: any) {
      setPasswordError(
        err?.message || "Failed to change password. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  };

  if (step === "password") {
    return (
      <EditorScreen
        visible={visible}
        onClose={handleClose}
        onBack={() => {
          resetPasswordFields();
          setStep("main");
        }}
        title="Change Password"
      >
        <Text style={styles.subtitle}>
          Choose a strong password with at least 8 characters
        </Text>

        <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color="#AAA" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor="#BBB"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color="#AAA" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor="#BBB"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color="#AAA" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor="#BBB"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {passwordError ? (
          <Text style={styles.errorText}>{passwordError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.updateBtn, updating && { opacity: 0.6 }]}
          onPress={handlePasswordChange}
          disabled={updating}
        >
          <Text style={styles.updateBtnText}>
            {updating ? "Updating…" : "Update Password"}
          </Text>
        </TouchableOpacity>
      </EditorScreen>
    );
  }

  return (
    <EditorScreen visible={visible} onClose={handleClose} title="Privacy & Security">
      <Text style={styles.groupLabel}>PROFILE</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Profile Visibility</Text>
            <Text style={styles.rowDescription}>Who can see your profile</Text>
          </View>
          <Text style={styles.rowValue}>Public</Text>
        </View>
      </View>

      <Text style={styles.groupLabel}>SECURITY</Text>
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setStep("password")}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Change Password</Text>
            <Text style={styles.rowDescription}>Update your password</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>
      </View>

      <Text style={styles.groupLabel}>LEGAL</Text>
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            trackTermsTapped();
            Linking.openURL(TERMS_URL).catch(() => {});
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Terms of Service</Text>
            <Text style={styles.rowDescription}>Read our terms of service</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionRow, { borderBottomWidth: 0 }]}
          onPress={() => {
            trackPrivacyPolicyTapped();
            Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowDescription}>How we handle your data</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>
      </View>

      <Text style={styles.groupLabel}>ACCOUNT REMOVAL</Text>
      <TouchableOpacity style={styles.deleteRow} onPress={onDeleteAccount}>
        <Trash2 color="#DC2626" size={18} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.deleteTitle}>Delete Account</Text>
          <Text style={styles.rowDescription}>
            Remove your account permanently
          </Text>
        </View>
      </TouchableOpacity>
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
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rowLabel: { fontSize: 15, fontWeight: "700", color: "#000" },
  rowDescription: { fontSize: 12, color: "#999", marginTop: 2, lineHeight: 16 },
  rowValue: { fontSize: 14, fontWeight: "700", color: "#999" },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  deleteTitle: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
  subtitle: { fontSize: 13, color: "#999", marginBottom: 20, lineHeight: 18 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
  },
  input: { flex: 1, fontSize: 15, color: "#000" },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
    marginBottom: 16,
  },
  updateBtn: {
    backgroundColor: "#000",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  updateBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
