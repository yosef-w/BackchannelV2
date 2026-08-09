/**
 * /reset-password
 *
 * Completes the forgot-password flow. The backend emails a link to
 * `{FRONTEND_URL}/reset-password?token=<JWT>` (15-minute expiry); that page
 * deep-links here. The user picks a new password and we call
 * POST /api/reset-password/ with the token.
 *
 * Deep-link entry points:
 *   - backchannelv2://reset-password?token=<JWT>
 *   - https://<universal-link>/reset-password?token=  (if/when app links ship)
 *
 * The endpoint is auth-free — the JWT in the body carries identity. An
 * expired or reused token returns an error; the recovery path is requesting
 * a fresh email from the Sign In screen's "Forgot password?" flow.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Lock, X } from "@/components/ui/icons";
import { BroadcastMoment } from "@/components/cinema/BroadcastMoment";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    trackResetPasswordFailed,
    trackResetPasswordOpened,
    trackResetPasswordSucceeded,
} from "@/lib/analytics/mixpanel";
import { authApi } from "@/lib/auth-api";
import { Colors, Type } from "@/constants/theme";

type Status = "form" | "missingToken" | "success";

const MIN_PASSWORD_LENGTH = 8; // mirrors backend MIN_PASSWORD_LENGTH

export default function ResetPasswordRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [status, setStatus] = useState<Status>("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hasToken = typeof token === "string" && token.length > 0;
    trackResetPasswordOpened({ hasToken });
    if (!hasToken) {
      setStatus("missingToken");
      trackResetPasswordFailed("missing_token");
    }
  }, [token]);

  const handleSubmit = async () => {
    setErrorMessage("");
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(String(token), newPassword);
      setStatus("success");
      trackResetPasswordSucceeded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // The most common failure is an expired token (15-minute lifetime).
      const expired =
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("invalid");
      setErrorMessage(
        expired
          ? "This reset link has expired or was already used. Request a new one from the Sign In screen."
          : msg || "Couldn't reset your password. Please try again.",
      );
      trackResetPasswordFailed(msg || "unknown");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToSignIn = () => {
    // Straight to sign-in, not the splash screen — a user who just reset
    // their password shouldn't have to walk role-selection + onboarding
    // slides again to log back in.
    router.replace("/sign-in");
  };

  const canSubmit =
    newPassword.length > 0 && confirmPassword.length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          {status === "form" && (
            <View style={styles.center}>
              <View style={styles.iconCircle}>
                <Lock color="#FFF" size={32} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>Choose a new password</Text>
              <Text style={styles.subtitle}>
                Enter a new password for your account. It must be at least{" "}
                {MIN_PASSWORD_LENGTH} characters.
              </Text>

              <View style={styles.formBlock}>
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={Colors.faint}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.faint}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />

                {errorMessage !== "" && (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !canSubmit && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Reset Password
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {status === "missingToken" && (
            <View style={styles.center}>
              <View style={styles.iconCircleError}>
                <X color="#FFF" size={36} strokeWidth={3} />
              </View>
              <Text style={styles.title}>Link not valid</Text>
              <Text style={styles.subtitle}>
                This reset link is missing its token. Please open the link
                directly from your email, or request a new one from the Sign
                In screen.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGoToSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Back to app</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "success" && (
            <View style={styles.broadcastFill}>
              {/* Milestone confirmation on the shared Broadcast. */}
              <BroadcastMoment
                words={[
                  { word: "Password" },
                  { word: "updated.", accent: true },
                ]}
                subtitle="Your password has been reset. Sign in with your new password to continue."
              />
              <TouchableOpacity
                style={[styles.primaryButton, styles.broadcastCta]}
                onPress={handleGoToSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Go to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, paddingVertical: 32 },
  // Full-bleed container for BroadcastMoment (it manages its own
  // centering) with the CTA beneath its caption zone.
  broadcastFill: { flex: 1, alignItems: "stretch" },
  broadcastCta: { alignSelf: "center", marginBottom: 8 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircleError: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    ...Type.title,
    fontSize: 26,
    lineHeight: 30,
    color: Colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  formBlock: {
    width: "100%",
    gap: 10,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: "#000",
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: "#000",
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    minWidth: 180,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.faint,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
