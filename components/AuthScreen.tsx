import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  identifyUser,
  trackForgotPasswordRequested,
  trackLoginFailed,
  trackLoginSubmitted,
  trackLoginSucceeded,
  trackSignUpFormSubmitted,
} from "../lib/analytics/mixpanel";
import { authApi, LoginResponse } from "../lib/auth-api";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useSubscriptionStore } from "../stores/useSubscriptionStore";
import { useToastStore } from "../stores/useToastStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { Color, Radius, Space, Type } from "@/constants/theme";
import {
  Body,
  Eyebrow,
  HeroTitle,
  Meta,
  Title,
  UIText,
} from "@/components/ui/typography";

interface AuthScreenProps {
  onComplete: () => void;
  onLoginComplete?: () => void;
  onBack: () => void;
  userType?: "applicant" | "sponsor";
  /** Whether to start on the sign-in tab. Defaults to true. */
  initialIsLogin?: boolean;
}

/**
 * Sign in / sign up. The form is intentionally quiet — editorial type stack
 * at the top, paper-feel inputs with hairline borders below, ink CTA at the
 * bottom. The forgot-password modal mirrors the website's name-capture sheet:
 * centered, paper, soft shadow, dimmed backdrop.
 *
 * All auth + mutation logic is preserved verbatim from the previous design.
 */
export function AuthScreen({
  onComplete,
  onLoginComplete,
  onBack,
  userType: propUserType,
  initialIsLogin = true,
}: AuthScreenProps) {
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const storeUserType = useOnboardingStore((state) => state.userType);
  const userType = propUserType ?? storeUserType;
  const updateApplicantData = useOnboardingStore(
    (state) => state.updateApplicantData,
  );
  const updateSponsorData = useOnboardingStore(
    (state) => state.updateSponsorData,
  );
  const savedApplicantData = useOnboardingStore((state) => state.applicantData);
  const savedSponsorData = useOnboardingStore((state) => state.sponsorData);
  const savedData =
    (propUserType ?? storeUserType) === "sponsor"
      ? savedSponsorData
      : savedApplicantData;

  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [firstName, setFirstName] = useState(savedData?.firstName ?? "");
  const [lastName, setLastName] = useState(savedData?.lastName ?? "");
  const [email, setEmail] = useState(savedData?.email ?? "");
  const [password, setPassword] = useState(savedData?.password ?? "");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const updatePersonal = useUserProfileStore((state) => state.updatePersonal);
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  const loginMutation = useMutation<LoginResponse, Error>({
    mutationFn: async () => authApi.login(email, password),
    onSuccess: async (data) => {
      await setAuthTokens(data.access_token, data.refresh_token, data.role);
      updatePersonal({
        email: data.email,
        firstName: "",
        lastName: "",
        fullName: "",
        phone: "",
        address: { city: "", state: "", street: "", zip: "", country: "" },
      });
      const role: "applicant" | "sponsor" =
        data.role === "Sponsor" ? "sponsor" : "applicant";
      identifyUser({
        userId: String(data.user_id),
        userType: role,
        email: data.email,
      });
      trackLoginSucceeded(role);
      rcIdentifyUser(String(data.user_id));
      showToast("Welcome back!", "success");
      if (onLoginComplete) onLoginComplete();
      else onComplete();
    },
    onError: (error) => {
      trackLoginFailed(error.message || "unknown");
      showToast(
        error.message || "Login failed. Check your email and password.",
        "error",
      );
    },
  });

  const forgotPasswordMutation = useMutation<{ message: string }, Error>({
    mutationFn: async () => authApi.forgotPassword(forgotPasswordEmail),
    onSuccess: () => {
      setForgotPasswordSent(true);
      showToast("Password reset email sent. Check your inbox.", "success");
      handleCloseForgotPasswordModal();
    },
    onError: (error) => {
      showToast(
        error.message || "Failed to send reset email. Try again.",
        "error",
      );
    },
  });

  const handleSubmit = () => {
    if (isLogin) {
      if (!email || !password) {
        showToast("Please enter your email and password.", "error");
        return;
      }
      trackLoginSubmitted();
      loginMutation.mutate();
    } else {
      if (!firstName.trim()) {
        showToast("Please enter your first name.", "error");
        return;
      }
      if (!lastName.trim()) {
        showToast("Please enter your last name.", "error");
        return;
      }
      if (!email.trim()) {
        showToast("Please enter your email address.", "error");
        return;
      }
      if (!password || password.length < 8) {
        showToast("Password must be at least 8 characters.", "error");
        return;
      }

      const authData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      };

      if (userType === "sponsor") updateSponsorData(authData);
      else updateApplicantData(authData);

      trackSignUpFormSubmitted(
        userType === "sponsor" ? "sponsor" : "applicant",
      );
      onComplete();
    }
  };

  const handleForgotPassword = () => {
    trackForgotPasswordRequested();
    setShowForgotPasswordModal(true);
    setForgotPasswordSent(false);
    setForgotPasswordEmail("");
  };

  const handleSendResetEmail = () => {
    if (!forgotPasswordEmail) {
      showToast("Please enter your email address.", "error");
      return;
    }
    forgotPasswordMutation.mutate();
  };

  const handleCloseForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordSent(false);
    setForgotPasswordEmail("");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Nav row */}
        <View style={styles.nav}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft color={Color.muted} size={20} strokeWidth={2} />
            <UIText style={styles.backText}>Back</UIText>
          </Pressable>
          <Eyebrow label={isLogin ? "Sign in" : "Sign up"} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kbView}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.duration(450)}>
              {/* Hero */}
              <View style={styles.hero}>
                {isLogin ? (
                  <HeroTitle lead="Welcome" accent="back." size="md" />
                ) : (
                  <HeroTitle lead="Create your" accent="account." size="md" />
                )}
                <Body style={styles.heroBody}>
                  {isLogin
                    ? "Sign in to continue where you left off."
                    : "Join the network of people who get hired through someone they know."}
                </Body>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {!isLogin && (
                  <>
                    <Field
                      label="First name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                    />
                    <Field
                      label="Last name"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      autoComplete="family-name"
                    />
                  </>
                )}
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  trailing={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                      {showPassword ? (
                        <EyeOff color={Color.muted} size={18} />
                      ) : (
                        <Eye color={Color.muted} size={18} />
                      )}
                    </Pressable>
                  }
                />

                {isLogin && (
                  <Pressable
                    onPress={handleForgotPassword}
                    style={({ pressed }) => [
                      styles.forgotBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Meta style={styles.forgotText}>Forgot password?</Meta>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={loginMutation.isPending}
                  style={({ pressed }) => [
                    styles.cta,
                    pressed && styles.ctaPressed,
                    loginMutation.isPending && styles.ctaDisabled,
                  ]}
                >
                  {loginMutation.isPending && isLogin ? (
                    <ActivityIndicator color={Color.paper} />
                  ) : (
                    <>
                      <UIText style={styles.ctaText}>
                        {isLogin ? "Sign in" : "Continue"}
                      </UIText>
                      <ArrowRight
                        color={Color.paper}
                        size={18}
                        strokeWidth={2.2}
                      />
                    </>
                  )}
                </Pressable>
              </View>

              {/* Mode toggle */}
              <Pressable
                onPress={() => setIsLogin(!isLogin)}
                style={({ pressed }) => [
                  styles.toggleRow,
                  pressed && styles.pressed,
                ]}
              >
                <Body style={styles.toggleText}>
                  {isLogin
                    ? "New to BackChannel? "
                    : "Already have an account? "}
                  <Text style={styles.toggleHighlight}>
                    {isLogin ? "Sign up" : "Sign in"}
                  </Text>
                </Body>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Forgot-password modal */}
        {showForgotPasswordModal && (
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleCloseForgotPasswordModal}
            />
            <Animated.View
              entering={FadeInDown.duration(280)}
              style={styles.modalSheet}
            >
              {!forgotPasswordSent ? (
                <>
                  <Eyebrow label="Reset password" />
                  <View style={{ marginTop: 12 }}>
                    <Title>Forgot it? No problem.</Title>
                  </View>
                  <Body style={styles.modalBody}>
                    Enter your email and we'll send you a link to reset it.
                  </Body>

                  <View style={{ marginTop: 4 }}>
                    <Field
                      label="Email"
                      value={forgotPasswordEmail}
                      onChangeText={setForgotPasswordEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={handleCloseForgotPasswordModal}
                      style={({ pressed }) => [
                        styles.modalCancel,
                        pressed && styles.pressed,
                      ]}
                    >
                      <UIText style={styles.modalCancelText}>Cancel</UIText>
                    </Pressable>
                    <Pressable
                      onPress={handleSendResetEmail}
                      disabled={forgotPasswordMutation.isPending}
                      style={({ pressed }) => [
                        styles.modalPrimary,
                        pressed && styles.ctaPressed,
                        forgotPasswordMutation.isPending && styles.ctaDisabled,
                      ]}
                    >
                      {forgotPasswordMutation.isPending ? (
                        <ActivityIndicator color={Color.paper} />
                      ) : (
                        <UIText style={styles.ctaText}>Send link</UIText>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.successCircle}>
                    <CheckCircle2 color={Color.ink} size={28} strokeWidth={1.5} />
                  </View>
                  <Title style={{ textAlign: "center" }}>Check your inbox.</Title>
                  <Body style={[styles.modalBody, { textAlign: "center" }]}>
                    We sent a reset link to{" "}
                    <Text style={styles.emailHighlight}>
                      {forgotPasswordEmail}
                    </Text>
                    .
                  </Body>
                  <Pressable
                    onPress={handleCloseForgotPasswordModal}
                    style={({ pressed }) => [
                      styles.modalPrimary,
                      { marginTop: Space.lg },
                      pressed && styles.ctaPressed,
                    ]}
                  >
                    <UIText style={styles.ctaText}>Got it</UIText>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Field ───────────────────────────────────────────────────────────
// Editorial input — tiny tracked uppercase label above, a clean DM-Sans 500
// input with a hairline border. Inspired directly by the website's modal
// input pattern.
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  trailing?: React.ReactNode;
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize,
  autoComplete,
  trailing,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Eyebrow label={label} labelStyle={styles.fieldLabel} />
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          placeholderTextColor={Color.faint}
          style={styles.input}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Color.offWhite },
  safeArea: { flex: 1 },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.screen,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 13, color: Color.muted, fontFamily: Type.sans500 },
  pressed: { opacity: 0.6 },

  kbView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Space.screen,
    paddingTop: Space.lg,
    paddingBottom: Space.xxl,
  },

  hero: { gap: Space.md, marginBottom: Space.xl },
  heroBody: { maxWidth: 380 },

  form: { gap: Space.lg },

  field: { gap: Space.sm },
  fieldLabel: { letterSpacing: 1.4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    padding: 0,
  },
  trailing: { marginLeft: 10 },

  forgotBtn: { alignSelf: "flex-end", marginTop: -4 },
  forgotText: { color: Color.muted, textTransform: "none", letterSpacing: 0 },

  cta: {
    marginTop: Space.sm,
    backgroundColor: Color.ink,
    borderRadius: Radius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  ctaPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },

  toggleRow: { marginTop: Space.xxl, alignItems: "center" },
  toggleText: { fontSize: 14, color: Color.muted },
  toggleHighlight: {
    color: Color.ink,
    fontFamily: Type.sans600,
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Space.xl,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.xxl,
    padding: Space.xl,
    gap: Space.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  modalBody: { fontSize: 14, lineHeight: 22 },
  modalActions: {
    flexDirection: "row",
    gap: Space.sm,
    marginTop: Space.md,
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: Color.ink,
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalCancel: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
  },
  modalCancelText: { color: Color.muted, fontSize: 14 },

  successCircle: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.sm,
  },
  emailHighlight: {
    fontFamily: Type.sans600,
    color: Color.ink,
  },
});
