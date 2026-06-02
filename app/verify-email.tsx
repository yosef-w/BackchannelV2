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
import { Check, Mail, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    trackResendVerificationRequested,
    trackVerifyEmailFailed,
    trackVerifyEmailOpened,
    trackVerifyEmailSucceeded,
} from "../lib/analytics/mixpanel";
import { authApi } from "../lib/auth-api";
import { Color, Radius, Type } from "@/constants/theme";

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
      setResendSent(true);
    } catch (err) {
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
    router.replace("/dashboard" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Color.ink} />
            <Text style={styles.loadingText}>Verifying your email…</Text>
          </View>
        )}

        {(status === "success" || status === "alreadyVerified") && (
          <View style={styles.center}>
            <View style={styles.iconCircle}>
              <Check color={Color.paper} size={28} strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>
              {status === "success" ? (
                <>
                  Email <Text style={styles.titleAccent}>verified.</Text>
                </>
              ) : (
                <>
                  Already <Text style={styles.titleAccent}>verified.</Text>
                </>
              )}
            </Text>
            <Text style={styles.subtitle}>
              {status === "success"
                ? "Thanks for confirming. You're all set."
                : "Your email was already verified — nothing else to do."}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "error" && (
          <View style={styles.center}>
            <View style={styles.iconCircleError}>
              <X color={Color.paper} size={28} strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>
              Verification <Text style={styles.titleAccent}>failed.</Text>
            </Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>

            {resendSent ? (
              <View style={styles.resendSent}>
                <Mail color={Color.ink} size={18} strokeWidth={1.8} />
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
                  placeholderTextColor={Color.faint}
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
                  activeOpacity={0.85}
                >
                  {resending ? (
                    <ActivityIndicator color={Color.paper} />
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
  container: { flex: 1, backgroundColor: Color.offWhite },
  content: { flex: 1, paddingHorizontal: 28, paddingVertical: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.body,
    marginTop: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Color.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircleError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Color.status.blockText,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: Type.sans400,
    fontSize: 30,
    color: Color.ink,
    textAlign: "center",
    letterSpacing: -0.6,
  },
  titleAccent: {
    fontFamily: Type.serifItalic,
    color: Color.muted,
  },
  subtitle: {
    fontFamily: Type.sans300,
    fontSize: 15,
    color: Color.body,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 12,
    maxWidth: 380,
  },
  primaryButton: {
    backgroundColor: Color.ink,
    paddingVertical: 16,
    borderRadius: Radius.md,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: Color.borderStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontFamily: Type.sans500,
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontFamily: Type.sans500,
    color: Color.muted,
    fontSize: 14,
  },
  resendBlock: {
    width: "100%",
    gap: 10,
    marginTop: 16,
    maxWidth: 380,
  },
  resendLabel: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  input: {
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
  },
  resendSent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    maxWidth: 380,
  },
  resendSentText: {
    flex: 1,
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.body,
    lineHeight: 19,
  },
});
