import { Button, HeroBackdrop, Screen, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
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

interface AuthScreenProps {
  onComplete: () => void;
  onLoginComplete?: () => void; // Separate handler for login to skip questionnaire
  onBack: () => void;
  /** Passed from onboarding.tsx so AuthScreen never relies solely on the Zustand store */
  userType?: "applicant" | "sponsor";
  /** Whether to start on the sign-in (true) or sign-up (false) tab. Defaults to true. */
  initialIsLogin?: boolean;
}

interface FieldProps {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  trailing?: React.ReactNode;
}

/**
 * Editorial-style auth field. Eyebrow label + off-white pill input with a
 * leading icon and optional trailing slot (used for the show/hide password
 * toggle). Tightens its border on focus, matching the website modal-input.
 */
function Field({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize = "sentences",
  trailing,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text variant="eyebrow" style={styles.fieldLabel}>
        {label}
      </Text>
      <View
        style={[
          styles.fieldRow,
          focused && { borderColor: tokens.colors.borderStrong },
        ]}
      >
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={styles.fieldInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

export function AuthScreen({
  onComplete,
  onLoginComplete,
  onBack,
  userType: propUserType,
  initialIsLogin = true,
}: AuthScreenProps) {
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const storeUserType = useOnboardingStore((state) => state.userType);
  // Prefer the prop (set from URL params by onboarding.tsx) over the store value,
  // so sign-up works correctly even if the Zustand store was reset mid-flow.
  const userType = propUserType ?? storeUserType;
  const setUserType = useOnboardingStore((state) => state.setUserType);
  const updateApplicantData = useOnboardingStore(
    (state) => state.updateApplicantData,
  );
  const updateSponsorData = useOnboardingStore(
    (state) => state.updateSponsorData,
  );
  // Pre-populate sign-up fields from the onboarding store so they survive
  // navigation back from the questionnaire step.
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

  // Silence the lint warning for setUserType which we keep imported in case a
  // future flow needs to override it from here.
  void setUserType;

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
        address: {
          city: "",
          state: "",
          street: "",
          zip: "",
          country: "",
        },
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

      if (onLoginComplete) {
        onLoginComplete();
      } else {
        onComplete();
      }
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

      if (userType === "sponsor") {
        updateSponsorData(authData);
      } else {
        updateApplicantData(authData);
      }

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
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <HeroBackdrop />

      {/* Top nav row */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          hitSlop={12}
        >
          <ArrowLeft color={tokens.colors.textMuted} size={20} />
          <Text variant="bodySmall" color={tokens.colors.textMuted}>
            Back
          </Text>
        </TouchableOpacity>
        <Text variant="eyebrow" color={tokens.colors.textFaint}>
          {isLogin ? "Sign in" : "Sign up"}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={FadeInDown.duration(500)}
            style={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text variant="eyebrow" style={styles.headerEyebrow}>
                {isLogin ? "Welcome back" : "Join the network"}
              </Text>
              {isLogin ? (
                <>
                  <Text variant="titleSerif">Sign in to</Text>
                  <Text variant="titleSerifItalic">BackChannel.</Text>
                </>
              ) : (
                <>
                  <Text variant="titleSerif">Create your</Text>
                  <Text variant="titleSerifItalic">account.</Text>
                </>
              )}
              <Text variant="body" style={styles.subtitle}>
                {isLogin
                  ? "Pick up right where you left off."
                  : "A quieter, warmer way to find your next role — one referral at a time."}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {!isLogin && (
                <>
                  <Field
                    label="First name"
                    icon={<User size={16} color={tokens.colors.textFaint} />}
                    placeholder="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                  <Field
                    label="Last name"
                    icon={<User size={16} color={tokens.colors.textFaint} />}
                    placeholder="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </>
              )}

              <Field
                label="Email"
                icon={<Mail size={16} color={tokens.colors.textFaint} />}
                placeholder="you@work.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Field
                label="Password"
                icon={<Lock size={16} color={tokens.colors.textFaint} />}
                placeholder={isLogin ? "Your password" : "8+ characters"}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                trailing={
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={tokens.colors.textFaint} />
                    ) : (
                      <Eye size={16} color={tokens.colors.textFaint} />
                    )}
                  </TouchableOpacity>
                }
              />

              {isLogin && (
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  style={styles.forgotBtn}
                >
                  <Text variant="bodySmall" color={tokens.colors.textMuted}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.submitWrap}>
                <Button
                  label={isLogin ? "Sign in" : "Get started"}
                  onPress={handleSubmit}
                  loading={loginMutation.isPending && isLogin}
                  disabled={loginMutation.isPending && isLogin}
                  block
                  size="lg"
                />
              </View>
            </View>

            {/* Toggle Mode */}
            <TouchableOpacity
              onPress={() => setIsLogin(!isLogin)}
              style={styles.toggleBtn}
              activeOpacity={0.7}
            >
              <Text variant="bodySmall" color={tokens.colors.textMuted}>
                {isLogin
                  ? "New to BackChannel? "
                  : "Already have an account? "}
                <Text
                  variant="bodySmall"
                  color={tokens.colors.text}
                  style={styles.toggleHighlight}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Rendered through React Native's <Modal> so the tinted backdrop
          covers the whole device window — including the status-bar zone
          and the home-indicator zone — instead of being clipped by the
          Screen primitive's SafeAreaView. statusBarTranslucent is needed
          on Android to let the overlay paint under the status bar. */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseForgotPasswordModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseForgotPasswordModal}
          />
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={styles.modal}
          >
            {!forgotPasswordSent ? (
              <>
                <Text variant="eyebrow" style={styles.modalEyebrow}>
                  Reset password
                </Text>
                <Text variant="titleSerif" style={styles.modalTitle}>
                  Forgot your
                </Text>
                <Text variant="titleSerifItalic" style={styles.modalTitle}>
                  password?
                </Text>
                <Text variant="bodySmall" style={styles.modalSubtitle}>
                  Drop your email and we'll send a reset link.
                </Text>

                <View style={styles.modalField}>
                  <Field
                    label="Email"
                    icon={<Mail size={16} color={tokens.colors.textFaint} />}
                    placeholder="you@work.com"
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <Button
                  label="Send reset link"
                  onPress={handleSendResetEmail}
                  loading={forgotPasswordMutation.isPending}
                  disabled={forgotPasswordMutation.isPending}
                  block
                  size="md"
                />
                <View style={styles.modalCancel}>
                  <Button
                    label="Cancel"
                    onPress={handleCloseForgotPasswordModal}
                    variant="ghost"
                    block
                    size="md"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.successIcon}>
                  <Mail size={26} color={tokens.colors.text} />
                </View>
                <Text variant="eyebrow" style={styles.modalEyebrow}>
                  Check your inbox
                </Text>
                <Text variant="titleSerif" style={styles.modalTitle}>
                  You're all
                </Text>
                <Text variant="titleSerifItalic" style={styles.modalTitle}>
                  set.
                </Text>
                <Text variant="bodySmall" style={styles.modalSubtitle}>
                  We've sent a reset link to{"\n"}
                  <Text variant="bodySmall" color={tokens.colors.text}>
                    {forgotPasswordEmail}
                  </Text>
                </Text>
                <Button
                  label="Got it"
                  onPress={handleCloseForgotPasswordModal}
                  block
                  size="md"
                />
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topNav: {
    height: 56,
    paddingHorizontal: tokens.layout.screenPaddingH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingBottom: tokens.spacing.xl,
  },
  content: {
    flex: 1,
    paddingTop: tokens.spacing.xl,
  },
  header: {
    marginBottom: tokens.spacing.xl,
  },
  headerEyebrow: {
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
    maxWidth: 360,
  },
  form: {
    gap: tokens.spacing.m,
  },
  fieldLabel: {
    marginBottom: tokens.spacing.s,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: tokens.radii.m,
    paddingHorizontal: tokens.spacing.m,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  fieldIcon: {
    marginRight: tokens.spacing.sm,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamilies.sans500,
  },
  fieldTrailing: {
    marginLeft: tokens.spacing.s,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -tokens.spacing.xs,
  },
  submitWrap: {
    marginTop: tokens.spacing.s,
  },
  toggleBtn: {
    marginTop: tokens.spacing.xl,
    alignItems: "center",
  },
  toggleHighlight: {
    fontFamily: tokens.fontFamilies.sans600,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.layout.screenPaddingH,
  },
  modal: {
    backgroundColor: tokens.colors.bg,
    borderRadius: tokens.radii.xl,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.xl,
    width: "100%",
    maxWidth: 400,
  },
  modalEyebrow: {
    marginBottom: tokens.spacing.sm,
  },
  modalTitle: {
    fontSize: 26,
    lineHeight: 30,
  },
  modalSubtitle: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.l,
  },
  modalField: {
    marginBottom: tokens.spacing.m,
  },
  modalCancel: {
    marginTop: tokens.spacing.s,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: tokens.spacing.m,
  },
});
