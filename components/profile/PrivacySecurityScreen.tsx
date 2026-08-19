// Full-screen Privacy & Security editor. Change Password / Change Email /
// Delete Account are all sub-steps pushed within this same screen (via
// EditorScreen's onBack) instead of the old pattern of closing this modal
// and opening a second one on top of it.

import { ChevronRight, Lock, Mail, Trash2 } from "@/components/ui/icons";
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
  trackChangeEmailRequested,
  trackPasswordChanged,
  trackPrivacyPolicyTapped,
  trackTermsTapped,
} from "@/lib/analytics/mixpanel";
import { Sentry } from "@/lib/sentry";
import { changeEmail, changePassword } from "@/lib/api";
import { authApi } from "@/lib/auth-api";
import { isValidEmail } from "@/lib/validation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { EditorScreen } from "./EditorScreen";
import { Colors, Type } from "@/constants/theme";

const TERMS_URL = "https://backchannelapp.netlify.app/terms.html";
const PRIVACY_POLICY_URL = "https://backchannelapp.netlify.app/privacy.html";

type Step = "main" | "password" | "delete" | "email";

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
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  // True once the backend has sent the confirmation link — the email isn't
  // live yet (only the redeemed link flips it), so this swaps the form for
  // a "check your inbox" message rather than a success toast.
  const [emailRequestSent, setEmailRequestSent] = useState(false);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  // False only for a pure-SSO (Apple/Google) account. The three password-
  // gated flows on this screen (change password/email, delete) all 400
  // server-side without one, so each swaps its form for a "set a password
  // first" gate that emails the existing forgot-password link.
  const hasPassword = useAuthStore((s) => s.hasPassword);
  const accountEmail = useUserProfileStore((s) => s.data.personal.email);
  const [setupLinkSending, setSetupLinkSending] = useState(false);
  const [setupLinkSent, setSetupLinkSent] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const handleSendSetupLink = async () => {
    if (!accountEmail || setupLinkSending) return;
    setSetupLinkSending(true);
    try {
      await authApi.forgotPassword(accountEmail);
      setSetupLinkSent(true);
    } catch (err) {
      showToast(
        (err instanceof Error && err.message) ||
          "Couldn't send the setup link. Please try again.",
        "error",
      );
    } finally {
      setSetupLinkSending(false);
    }
  };

  /**
   * Shown in place of any password-gated form while the account has no
   * password (pure-SSO). Sends the existing forgot-password email, which
   * doubles as "create your first password" for a passwordless account.
   */
  const renderSetPasswordGate = (headline: string, subtitle: string) => (
    <>
      <View style={styles.deleteIconCircle}>
        <Lock color="#000" size={26} strokeWidth={2.2} />
      </View>
      {setupLinkSent ? (
        <>
          <Text style={styles.deleteHeadline}>Check your inbox</Text>
          <Text style={styles.deleteSubtitle}>
            We sent a password setup link to {accountEmail}. Open it to
            create your password, then come back here — don&apos;t forget
            the spam folder if it doesn&apos;t show up in a minute.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.deleteHeadline}>{headline}</Text>
          <Text style={styles.deleteSubtitle}>{subtitle}</Text>
          <TouchableOpacity
            style={[
              styles.updateBtn,
              (setupLinkSending || !accountEmail) && { opacity: 0.6 },
            ]}
            onPress={handleSendSetupLink}
            disabled={setupLinkSending || !accountEmail}
            activeOpacity={0.8}
          >
            {setupLinkSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.updateBtnText}>Email Me a Setup Link</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </>
  );

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

  const resetEmailFields = () => {
    setNewEmail("");
    setEmailPassword("");
    setEmailError("");
    setEmailRequestSent(false);
  };

  const handleClose = () => {
    resetPasswordFields();
    resetDeleteFields();
    resetEmailFields();
    setSetupLinkSent(false);
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
    } catch (err) {
      const msg: string = err instanceof Error ? err.message : "";
      const wrongPassword = msg.toLowerCase().includes("password");
      // A failed DELETION (not a mistyped password) is a legal/App-Store
      // promise breaking — worth a Sentry issue, not just a toast.
      if (!wrongPassword) {
        Sentry.captureException(err, { tags: { flow: "account_delete" } });
      }
      setDeleteError(
        wrongPassword
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
      trackPasswordChanged();
      resetPasswordFields();
      setStep("main");
      showToast("Password changed successfully.", "success");
    } catch (err) {
      setPasswordError(
        (err instanceof Error && err.message) ||
          "Failed to change password. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeEmail = async () => {
    setEmailError("");

    if (!newEmail.trim() || !emailPassword) {
      setEmailError("Both fields are required");
      return;
    }
    if (!isValidEmail(newEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }

    setChangingEmail(true);
    try {
      await changeEmail(newEmail.trim(), emailPassword);
      trackChangeEmailRequested();
      setEmailRequestSent(true);
    } catch (err) {
      const msg: string = err instanceof Error ? err.message : "";
      setEmailError(
        msg.toLowerCase().includes("password")
          ? "That password is incorrect. Please try again."
          : msg || "Couldn't request the email change. Please try again.",
      );
    } finally {
      setChangingEmail(false);
    }
  };

  if (step === "password") {
    if (!hasPassword) {
      return (
        <EditorScreen
          visible={visible}
          onClose={handleClose}
          onBack={() => {
            setSetupLinkSent(false);
            setStep("main");
          }}
          title="Set a Password"
        >
          {renderSetPasswordGate(
            "Set a password",
            "You signed in with Apple or Google, so this account doesn't " +
              "have a password yet. We'll email you a link to create one — " +
              "after that, both sign-in methods work.",
          )}
        </EditorScreen>
      );
    }
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
          <Lock color={Colors.faint} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor={Colors.faint}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color={Colors.faint} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={Colors.faint}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <Lock color={Colors.faint} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor={Colors.faint}
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

  if (step === "email") {
    if (!hasPassword) {
      return (
        <EditorScreen
          visible={visible}
          onClose={handleClose}
          onBack={() => {
            setSetupLinkSent(false);
            setStep("main");
          }}
          title="Change Email"
        >
          {renderSetPasswordGate(
            "Set a password first",
            "Changing your email requires confirming a password, and this " +
              "account doesn't have one yet — you signed in with Apple or " +
              "Google. We'll email you a link to create one.",
          )}
        </EditorScreen>
      );
    }
    return (
      <EditorScreen
        visible={visible}
        onClose={handleClose}
        onBack={() => {
          resetEmailFields();
          setStep("main");
        }}
        title="Change Email"
      >
        {emailRequestSent ? (
          <>
            <View style={styles.deleteIconCircle}>
              <Mail color="#000" size={26} strokeWidth={2.2} />
            </View>
            <Text style={styles.deleteHeadline}>Check your new inbox</Text>
            <Text style={styles.deleteSubtitle}>
              We sent a confirmation link to {newEmail.trim()}. Your email
              won&apos;t change until you open it and confirm — including
              your spam folder if it doesn&apos;t show up in a minute.
            </Text>
            <TouchableOpacity
              style={styles.updateBtn}
              onPress={() => {
                resetEmailFields();
                setStep("main");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.updateBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              We&apos;ll send a confirmation link to your new address — your
              email won&apos;t change until you open it.
            </Text>

            <Text style={styles.fieldLabel}>NEW EMAIL</Text>
            <View style={styles.inputWrapper}>
              <Mail color={Colors.faint} size={18} />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={Colors.faint}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock color={Colors.faint} size={18} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password to confirm"
                placeholderTextColor={Colors.faint}
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.updateBtn, changingEmail && { opacity: 0.6 }]}
              onPress={handleChangeEmail}
              disabled={changingEmail}
            >
              {changingEmail ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.updateBtnText}>Send Confirmation Link</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </EditorScreen>
    );
  }

  if (step === "delete") {
    if (!hasPassword) {
      return (
        <EditorScreen
          visible={visible}
          onClose={handleClose}
          onBack={() => {
            setSetupLinkSent(false);
            setStep("main");
          }}
          title="Delete Account"
        >
          {renderSetPasswordGate(
            "Set a password first",
            "Deleting your account requires confirming a password, and " +
              "this account doesn't have one yet — you signed in with " +
              "Apple or Google. We'll email you a link to create one; once " +
              "it's set, come back here to delete your account.",
          )}
        </EditorScreen>
      );
    }
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
          <Lock color={Colors.faint} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password to continue"
            placeholderTextColor={Colors.faint}
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
            <Text style={styles.rowLabel}>
              {hasPassword ? "Change Password" : "Set a Password"}
            </Text>
            <Text style={styles.rowDescription}>
              {hasPassword
                ? "Update your password"
                : "Create a password for your account"}
            </Text>
          </View>
          <ChevronRight color={Colors.faint} size={20} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionRow, { borderBottomWidth: 0 }]}
          onPress={() => setStep("email")}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Change Email</Text>
            <Text style={styles.rowDescription}>
              Update the email you log in with
            </Text>
          </View>
          <ChevronRight color={Colors.faint} size={20} />
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
          <ChevronRight color={Colors.faint} size={20} />
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
          <ChevronRight color={Colors.faint} size={20} />
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
        <ChevronRight color={Colors.faint} size={20} />
      </TouchableOpacity>
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
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  rowDescription: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: { fontSize: 14, fontWeight: "700", color: Colors.muted },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  deleteTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  subtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 20,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
  },
  input: { flex: 1, fontSize: 15, color: "#000" },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: "600",
    marginBottom: 16,
  },
  updateBtn: {
    backgroundColor: Colors.ink,
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
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  // Also used by the "Set a password first" gate (same modal shell) —
  // 22px, above the serif floor, same tier as the other modal titles.
  deleteHeadline: {
    ...Type.heading,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  deleteSubtitle: {
    fontSize: 14,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  deleteWarningCard: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.ink,
    marginTop: 7,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.body,
    lineHeight: 19,
    fontWeight: "600",
  },
  deleteConfirmBtn: {
    backgroundColor: Colors.ink,
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
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  deleteCancelBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
});
