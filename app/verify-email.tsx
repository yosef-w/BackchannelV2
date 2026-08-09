/**
 * /verify-email
 *
 * Handles the deep link from the verification email sent by the backend after
 * registration (PR #38). Reads `?token=<JWT>` from the URL, calls
 * POST /api/auth/verify-email/, and renders a result screen.
 *
 * Deep-link entry points:
 *   - backchannelv2://verify-email?token=<JWT>      (custom scheme; works in dev/standalone)
 *   - https://<universal-link>/verify-email?token=  (if/when we add Apple/Android app links)
 *
 * The endpoint is auth-free (the JWT in the body carries identity) and
 * idempotent — verifying twice both succeed.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail, X } from "@/components/ui/icons";
import { BroadcastMoment } from "@/components/cinema/BroadcastMoment";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    trackResendVerificationRequested,
    trackVerifyEmailFailed,
    trackVerifyEmailOpened,
    trackVerifyEmailSucceeded,
} from "@/lib/analytics/mixpanel";
import { authApi } from "@/lib/auth-api";
import { Colors, Type } from "@/constants/theme";

type Status = "loading" | "success" | "alreadyVerified" | "error";

export default function VerifyEmailRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Resend state — used when verification fails (e.g. expired token)
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const verify = async () => {
      trackVerifyEmailOpened({
        hasToken: typeof token === "string" && token.length > 0,
      });
      if (!token || typeof token !== "string") {
        setStatus("error");
        setErrorMessage(
          "This verification link is missing its token. Please open the link directly from your email.",
        );
        trackVerifyEmailFailed("missing_token");
        return;
      }

      try {
        const res = await authApi.verifyEmail(token);
        // Backend uses two distinct messages — both are 200 OK.
        const alreadyVerified =
          typeof res.message === "string" &&
          res.message.toLowerCase().includes("already");
        if (alreadyVerified) {
          setStatus("alreadyVerified");
        } else {
          setStatus("success");
        }
        trackVerifyEmailSucceeded({ alreadyVerified });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setErrorMessage(
          msg || "We couldn't verify this link. It may have expired.",
        );
        trackVerifyEmailFailed(msg || "unknown");
      }
    };

    verify();
  }, [token]);

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email) return;
    trackResendVerificationRequested({ source: "verify_email_screen" });
    try {
      setResending(true);
      await authApi.resendVerificationEmail(email);
      // Endpoint always returns 200 (anti-enumeration), so we always show the
      // same success state regardless of whether the email actually exists.
      setResendSent(true);
    } catch (err) {
      // 429 = rate-limited; surface it so the user knows to back off.
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        msg.includes("429") || msg.toLowerCase().includes("rate")
          ? "Too many attempts. Please try again in a few minutes."
          : "Couldn't send the verification email. Try again later.",
      );
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Verifying your email…</Text>
          </View>
        )}

        {(status === "success" || status === "alreadyVerified") && (
          <View style={styles.broadcastFill}>
            {/* Milestone confirmation on the shared Broadcast — freshly
                verified gets the full moment; "already verified" is old
                news, so its beat plays silently (no haptics). */}
            <BroadcastMoment
              haptics={status === "success"}
              words={
                status === "success"
                  ? [{ word: "Email" }, { word: "verified.", accent: true }]
                  : [{ word: "Already" }, { word: "verified.", accent: true }]
              }
              subtitle={
                status === "success"
                  ? "Thanks for confirming. You're all set."
                  : "Your email was already verified — nothing else to do."
              }
            />
            <TouchableOpacity
              style={[styles.primaryButton, styles.broadcastCta]}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "error" && (
          <View style={styles.center}>
            <View style={styles.iconCircleError}>
              <X color="#FFF" size={36} strokeWidth={3} />
            </View>
            <Text style={styles.title}>Verification failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>

            {resendSent ? (
              <View style={styles.resendSent}>
                <Mail color="#000" size={20} strokeWidth={2} />
                <Text style={styles.resendSentText}>
                  If an account exists for that address, a new verification
                  email is on its way.
                </Text>
              </View>
            ) : (
              <View style={styles.resendBlock}>
                <Text style={styles.resendLabel}>
                  Send a new verification email
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.faint}
                  value={resendEmail}
                  onChangeText={setResendEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!resendEmail.trim() || resending) &&
                      styles.primaryButtonDisabled,
                  ]}
                  onPress={handleResend}
                  disabled={!resendEmail.trim() || resending}
                  activeOpacity={0.8}
                >
                  {resending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Resend</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Back to app</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  content: { flex: 1, paddingHorizontal: 28, paddingVertical: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  // Full-bleed container for BroadcastMoment (it manages its own
  // centering) with the Continue button beneath its caption zone.
  broadcastFill: {
    flex: 1,
    alignItems: "stretch",
  },
  broadcastCta: { alignSelf: "center", marginBottom: 8 },
  loadingText: { fontSize: 14, color: Colors.body, marginTop: 12 },
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
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  secondaryButtonText: {
    color: Colors.body,
    fontSize: 14,
    fontWeight: "600",
  },
  resendBlock: {
    width: "100%",
    gap: 10,
    marginTop: 16,
  },
  resendLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.body,
    textAlign: "center",
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: "#000",
  },
  resendSent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  resendSentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.body,
    lineHeight: 18,
  },
});
