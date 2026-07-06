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
  ActivityIndicator,
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
import { authApi } from "../../lib/auth-api";
import { useAuthStore } from "../../stores/useAuthStore";
import { useToastStore } from "../../stores/useToastStore";
import { EditorScreen } from "./EditorScreen";

const TERMS_URL = "https://backchannelapp.netlify.app/terms.html";
const PRIVACY_POLICY_URL = "https://backchannelapp.netlify.app/privacy.html";

type Step = "main" | "password" | "delete";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called AFTER the backend confirms permanent deletion — the parent runs
   * its local teardown (analytics, notification schedules, stores, auth) and
   * navigates away. The API call itself lives here so a wrong password stays
   * an inline field error instead of tearing anything down. */
  onAccountDeleted: () => void | Promise<void>;
}

export function PrivacySecurityScreen({
  visible,
  onClose,
  onAccountDeleted,
}: Props) {
  const [step, setStep] = useState<Step>("main");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const showToast = useToastStore((s) => s.showToast);

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  };

  const resetDeleteFields = () => {
    setDeletePassword("");
    setDeleteError("");
  };

  const handleClose = () => {
    resetPasswordFields();
    resetDeleteFields();
    setStep("main");
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword || deleting) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await authApi.deleteAccount(deletePassword, refreshToken);
      // Deletion is done server-side; hand off to the parent for local
      // teardown + navigation. Don't reset `deleting` on this path — the
      // button stays in its spinner state for the beat until we route away,
      // instead of flashing back to a tappable "Delete" on a dead account.
      await onAccountDeleted();
    } catch (err: any) {
      const msg: string = err?.message || "";
      setDeleteError(
        msg.toLowerCase().includes("password")
          ? "That password is incorrect. Please try again."
          : msg || "Couldn't delete your account. Please try again.",
      );
      setDeleting(false);
    }
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

  if (step === "delete") {
    return (
      <EditorScreen
        visible={visible}
        onClose={handleClose}
        onBack={() => {
          if (deleting) return;
          resetDeleteFields();
          setStep("main");
        }}
        title="Delete Account"
      >
        <View style={styles.deleteIconCircle}>
          <Trash2 color="#000" size={26} strokeWidth={2.2} />
        </View>

        <Text style={styles.deleteHeadline}>This is permanent</Text>
        <Text style={styles.deleteSubtitle}>
          Deleting your account erases everything, right away. There is no
          grace period and no way to undo it.
        </Text>

        <View style={styles.deleteWarningCard}>
          {[
            "Your profile, photo, and resume are permanently erased",
            "All matches and conversations are deleted for good",
            "Your likes, referrals, and check-in history are removed",
          ].map((line) => (
            <View key={line} style={styles.deleteWarningRow}>
              <View style={styles.deleteWarningDot} />
              <Text style={styles.deleteWarningText}>{line}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.fieldLabel}>CONFIRM YOUR PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color="#AAA" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password to continue"
            placeholderTextColor="#BBB"
            value={deletePassword}
            onChangeText={(t) => {
              setDeletePassword(t);
              if (deleteError) setDeleteError("");
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deleting}
          />
        </View>

        {deleteError ? (
          <Text style={styles.errorText}>{deleteError}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.deleteConfirmBtn,
            (!deletePassword || deleting) && styles.deleteConfirmBtnDisabled,
          ]}
          onPress={handleConfirmDelete}
          disabled={!deletePassword || deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.deleteConfirmBtnText}>
              Permanently Delete My Account
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteCancelBtn}
          onPress={() => {
            if (deleting) return;
            resetDeleteFields();
            setStep("main");
          }}
          disabled={deleting}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteCancelBtnText}>Keep My Account</Text>
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
      <TouchableOpacity
        style={styles.deleteRow}
        onPress={() => setStep("delete")}
      >
        <Trash2 color="#000" size={18} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.deleteTitle}>Delete Account</Text>
          <Text style={styles.rowDescription}>
            Remove your account permanently
          </Text>
        </View>
        <ChevronRight color="#BBB" size={20} />
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
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  deleteTitle: { fontSize: 15, fontWeight: "700", color: "#000" },
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
  // ── Delete-account confirmation step ────────────────────────────────
  // Monochrome like the rest of the app's primary/destructive actions
  // (Unmatch, Send, etc.) — severity is carried by the copy, the warning
  // list, and the required password, not by color.
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  deleteHeadline: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  deleteSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  deleteWarningCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  deleteWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  deleteWarningDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
    marginTop: 7,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#444",
    lineHeight: 19,
    fontWeight: "600",
  },
  deleteConfirmBtn: {
    backgroundColor: "#000",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.4,
  },
  deleteConfirmBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  deleteCancelBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  deleteCancelBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
});
