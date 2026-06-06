/**
 * /verify-email
 *
 * Handles the deep link from the verification email sent by the backend after
 * registration. Reads `?token=<JWT>` from the URL, calls
 * POST /api/auth/verify-email/, and renders a result screen.
 *
 * Deep-link entry points:
 *   - backchannelv2://verify-email?token=<JWT>
 *   - https://<universal-link>/verify-email?token=
 *
 * The endpoint is auth-free (the JWT in the body carries identity) and
 * idempotent — verifying twice both succeed.
 */

import {
    Button,
    HeroBackdrop,
    Screen,
    Text,
} from "@/components/design";
import { tokens } from "@/constants/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Mail, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import {
    trackResendVerificationRequested,
    trackVerifyEmailFailed,
    trackVerifyEmailOpened,
    trackVerifyEmailSucceeded,
} from "../lib/analytics/mixpanel";
import { authApi } from "../lib/auth-api";

type Status = "loading" | "success" | "alreadyVerified" | "error";

export default function VerifyEmailRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

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
          "This verification link is missing its token. Please open it directly from your email.",
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

  const handleContinue = () => router.replace("/dashboard" as any);

  return (
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <HeroBackdrop />
      <View style={styles.content}>
        {status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={tokens.colors.text} />
            <Text variant="body" color={tokens.colors.textMuted}>
              Verifying your email…
            </Text>
          </View>
        )}

        {(status === "success" || status === "alreadyVerified") && (
          <View style={styles.center}>
            <View style={styles.iconCircle}>
              <Check color={tokens.colors.brandText} size={28} strokeWidth={2.4} />
            </View>
            <Text variant="eyebrow">
              {status === "success" ? "Verified" : "Already verified"}
            </Text>
            <View style={styles.titleStack}>
              <Text variant="titleSerif" align="center">
                You're all
              </Text>
              <Text variant="titleSerifItalic" align="center">
                set.
              </Text>
            </View>
            <Text
              variant="bodyLarge"
              align="center"
              style={styles.subtitle}
            >
              {status === "success"
                ? "Thanks for confirming your email. Welcome to BackChannel."
                : "Your email was already verified — nothing else to do here."}
            </Text>
            <View style={styles.ctaWrap}>
              <Button label="Continue" onPress={handleContinue} block size="lg" />
            </View>
          </View>
        )}

        {status === "error" && (
          <View style={styles.center}>
            <View style={styles.iconCircleError}>
              <X color={tokens.colors.dangerFg} size={26} strokeWidth={2.4} />
            </View>
            <Text variant="eyebrow" color={tokens.colors.dangerFg}>
              Verification failed
            </Text>
            <View style={styles.titleStack}>
              <Text variant="titleSerif" align="center">
                That link
              </Text>
              <Text variant="titleSerifItalic" align="center">
                didn't work.
              </Text>
            </View>
            <Text
              variant="bodySmall"
              align="center"
              color={tokens.colors.textBody}
              style={styles.subtitle}
            >
              {errorMessage}
            </Text>

            {resendSent ? (
              <View style={styles.resendSent}>
                <Mail color={tokens.colors.text} size={18} strokeWidth={1.8} />
                <Text
                  variant="bodySmall"
                  color={tokens.colors.textBody}
                  style={styles.resendSentText}
                >
                  If an account exists for that address, a new verification
                  email is on its way.
                </Text>
              </View>
            ) : (
              <View style={styles.resendBlock}>
                <Text variant="eyebrow" align="center">
                  Send a new link
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@work.com"
                  placeholderTextColor={tokens.colors.textFaint}
                  value={resendEmail}
                  onChangeText={setResendEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button
                  label="Resend"
                  onPress={handleResend}
                  loading={resending}
                  disabled={!resendEmail.trim() || resending}
                  block
                  size="md"
                />
              </View>
            )}

            <View style={styles.secondaryWrap}>
              <Button
                label="Back to app"
                onPress={handleContinue}
                variant="ghost"
                block
                size="md"
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingVertical: tokens.spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.m,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing.s,
  },
  iconCircleError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.dangerBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing.s,
  },
  titleStack: {
    alignItems: "center",
  },
  subtitle: {
    maxWidth: 360,
  },
  ctaWrap: {
    width: "100%",
    paddingHorizontal: tokens.spacing.xl,
    marginTop: tokens.spacing.m,
  },
  resendBlock: {
    width: "100%",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.l,
  },
  input: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.m,
    paddingHorizontal: tokens.spacing.m,
    height: 50,
    fontSize: 15,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamilies.sans500,
  },
  resendSent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.m,
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.l,
  },
  resendSentText: {
    flex: 1,
  },
  secondaryWrap: {
    width: "100%",
    paddingHorizontal: tokens.spacing.xl,
    marginTop: tokens.spacing.xs,
  },
});
