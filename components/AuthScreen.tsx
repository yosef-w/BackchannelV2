import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
    identifyUser,
    trackForgotPasswordRequested,
    trackScreenViewed,
    trackLoginFailed,
    trackLoginSubmitted,
    trackLoginSucceeded,
    trackSignUpFormSubmitted,
} from "@/lib/analytics/mixpanel";
import { authApi, LoginResponse, SsoLoginResponse } from "@/lib/auth-api";
import { isAppleSignInSupported, isGoogleSignInSupported, SsoIdentity } from "@/lib/sso";
import { isValidEmail } from "@/lib/validation";
import { SSO_ENABLED } from "@/constants/config";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { SSOButtons } from "@/components/auth/SSOButtons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AuthScreenProps {
  onComplete: () => void;
  onLoginComplete?: () => void; // Separate handler for login to skip questionnaire
  onBack: () => void;
  /** Passed from onboarding.tsx so AuthScreen never relies solely on the Zustand store */
  userType?: "applicant" | "sponsor";
  /** Whether to start on the sign-in (true) or sign-up (false) tab. Defaults to true. */
  initialIsLogin?: boolean;
  /**
   * When this screen is reached WITHOUT a role already chosen (the splash
   * screen's direct "Sign in" link), we don't know if a "sign up" tap means
   * applicant or sponsor. Rather than guess (and risk saving their name/email
   * under the wrong onboarding slice), redirect to role selection instead of
   * flipping the tab in place. Omit this prop for the normal
   * choose-role → onboarding → auth flow, where the role is already known
   * and the in-place toggle is correct.
   */
  onRequestSignUp?: () => void;
}

export function AuthScreen({
  onComplete,
  onLoginComplete,
  onBack,
  userType: propUserType,
  initialIsLogin = true,
  onRequestSignUp,
}: AuthScreenProps) {
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const setHasPassword = useAuthStore((state) => state.setHasPassword);
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
  const setSsoSession = useOnboardingStore((state) => state.setSsoSession);
  // Pre-populate sign-up fields from the onboarding store so they survive
  // navigation back from the questionnaire step.
  const savedApplicantData = useOnboardingStore((state) => state.applicantData);
  const savedSponsorData = useOnboardingStore((state) => state.sponsorData);
  const savedData =
    (propUserType ?? storeUserType) === "sponsor"
      ? savedSponsorData
      : savedApplicantData;

  const [isLogin, setIsLogin] = useState(initialIsLogin);

  // Top of the funnel — without this, sessions are invisible in Mixpanel
  // until the user reaches the dashboard. Re-fires on the login<->signup
  // toggle so the two modes chart separately.
  useEffect(() => {
    trackScreenViewed(isLogin ? "auth_login" : "auth_signup");
  }, [isLogin]);
  const [firstName, setFirstName] = useState(savedData?.firstName ?? "");
  const [lastName, setLastName] = useState(savedData?.lastName ?? "");
  const [email, setEmail] = useState(savedData?.email ?? "");
  const [password, setPassword] = useState(savedData?.password ?? "");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const seedSessionEmail = useUserProfileStore(
    (state) => state.seedSessionEmail,
  );
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);
  // Gate on the feature flag AND whether either provider can actually
  // render here, so a build with SSO_ENABLED true but no supported
  // provider (e.g. Android with no Google client IDs configured yet)
  // doesn't show a divider with nothing underneath it.
  const showSso =
    SSO_ENABLED && (isAppleSignInSupported() || isGoogleSignInSupported());

  const loginMutation = useMutation<LoginResponse, Error>({
    mutationFn: async () => {
      return authApi.login(email, password);
    },
    onSuccess: async (data) => {
      // Store real tokens + role from backend (PR #19)
      await setAuthTokens(data.access_token, data.refresh_token, data.role);
      // Logging in WITH a password is proof one exists — clears a stale
      // `false` left by a previous pure-SSO session on this device.
      await setHasPassword(true);

      // Backend doesn't return profile info in login response — seed just
      // the email locally; fetchFromBackend() (fired by _layout.tsx as soon
      // as the token lands) populates the rest. This must NOT go through
      // updatePersonal(): that marks the whole `personal` group dirty and
      // the sync then pushes it IN FULL — including the store's
      // still-default empty firstName/lastName/phone/address — which
      // permanently erased users' real names on the backend on every login.
      seedSessionEmail(data.email);

      // Identify the user for the rest of their session, and stamp basic
      // profile attributes onto the People record. Other profile fields will
      // be filled in by `setUserProperties()` once the profile fetch
      // completes elsewhere — keep this lean.
      const role: "applicant" | "sponsor" =
        data.role === "Sponsor" ? "sponsor" : "applicant";
      identifyUser({
        userId: String(data.user_id),
        userType: role,
        email: data.email,
      });
      trackLoginSucceeded(role);
      // Link this backend user ID to their RevenueCat customer record so
      // purchases can be restored across devices / reinstalls.
      rcIdentifyUser(String(data.user_id));

      showToast("Welcome back!", "success");

      // Use onLoginComplete if provided (skips questionnaire), otherwise onComplete
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

  // Shared by both the sign-in and sign-up tabs, and by both entry points
  // (app/sign-in.tsx, app/onboarding.tsx) — "Continue with Apple/Google"
  // means the same thing regardless of which tab was showing when it was
  // tapped, so routing branches on the backend response, not on `isLogin`.
  const handleSsoSuccess = async (
    response: SsoLoginResponse,
    identity: SsoIdentity,
    provider: "apple" | "google",
  ) => {
    // role is null for a brand-new/role-less account — omit it so
    // setAuthTokens leaves the stored role untouched (already null there).
    await setAuthTokens(
      response.access_token,
      response.refresh_token,
      response.role ?? undefined,
    );
    // False for a pure-SSO account — drives the Privacy & Security
    // screen's "Set a Password" UX (password-gated flows 400 without one).
    await setHasPassword(response.has_password);
    seedSessionEmail(response.email);

    if (response.needs_onboarding) {
      // Authenticated but no role/profile yet. Stash the identity so the
      // questionnaire calls authApi.completeSsoOnboarding() instead of
      // createProfile() and skips the password field — then let this
      // screen's normal "proceed" routing take over: onboarding.tsx's auth
      // step goes to the questionnaire (role already known there);
      // sign-in.tsx's onComplete goes to /choose-role (role NOT known
      // there) — both are exactly "this user still needs a role."
      setSsoSession({
        provider,
        userId: String(response.user_id),
        email: identity.email ?? response.email,
        givenName: identity.givenName,
        familyName: identity.familyName,
      });
      const prefill = {
        firstName: identity.givenName ?? "",
        lastName: identity.familyName ?? "",
        email: identity.email ?? response.email,
      };
      if (userType === "sponsor") {
        updateSponsorData(prefill);
      } else {
        updateApplicantData(prefill);
      }
      onComplete();
      return;
    }

    // Existing, fully-onboarded account — same "log them straight in" path
    // as the password login mutation above.
    const role: "applicant" | "sponsor" =
      response.role === "Sponsor" ? "sponsor" : "applicant";
    identifyUser({
      userId: String(response.user_id),
      userType: role,
      email: response.email,
    });
    trackLoginSucceeded(role);
    rcIdentifyUser(String(response.user_id));
    showToast("Welcome back!", "success");
    if (onLoginComplete) {
      onLoginComplete();
    } else {
      onComplete();
    }
  };

  const forgotPasswordMutation = useMutation<{ message: string }, Error>({
    mutationFn: async () => {
      return authApi.forgotPassword(forgotPasswordEmail);
    },
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
      // Validate all registration fields before proceeding
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
      if (!isValidEmail(email)) {
        showToast("Please enter a valid email address.", "error");
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

      // Save to the correct store slice — default to applicant if userType is
      // somehow still null (belt-and-suspenders after the onboarding.tsx useEffect fix).
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
    if (!isValidEmail(forgotPasswordEmail)) {
      showToast("Please enter a valid email address.", "error");
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
        {/* Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft color="#000" size={24} />
          </TouchableOpacity>
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
              entering={FadeInDown.duration(600)}
              style={styles.content}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {isLogin ? "Welcome back" : "Create your account"}
                </Text>
                <Text style={styles.subtitle}>
                  {isLogin
                    ? "Sign in to continue"
                    : "Join the professional referral network"}
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {!isLogin && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>First Name</Text>
                      <View style={styles.inputWrapper}>
                        <User color="#AAA" size={18} style={styles.inputIcon} />
                        <TextInput
                          placeholder="First Name"
                          placeholderTextColor="#BBB"
                          value={firstName}
                          onChangeText={setFirstName}
                          autoCapitalize="words"
                          style={styles.input}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Last Name</Text>
                      <View style={styles.inputWrapper}>
                        <User color="#AAA" size={18} style={styles.inputIcon} />
                        <TextInput
                          placeholder="Last Name"
                          placeholderTextColor="#BBB"
                          value={lastName}
                          onChangeText={setLastName}
                          autoCapitalize="words"
                          style={styles.input}
                        />
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Mail color="#AAA" size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor="#BBB"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock color="#AAA" size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor="#BBB"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff color="#AAA" size={18} />
                      ) : (
                        <Eye color="#AAA" size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {isLogin && (
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    style={styles.forgotBtn}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                  disabled={loginMutation.isPending}
                  style={[
                    styles.submitButton,
                    loginMutation.isPending && { opacity: 0.7 },
                  ]}
                >
                  {loginMutation.isPending && isLogin ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isLogin ? "Sign In" : "Get Started"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {showSso && (
                <View style={styles.ssoSection}>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <SSOButtons
                    onSuccess={handleSsoSuccess}
                    // Backend SSO errors carry user-appropriate guidance in
                    // the message (e.g. 409 "log in with password instead",
                    // Apple's no-email recovery steps) — show it verbatim,
                    // fall back to a generic line for network-level throws.
                    onError={(error) =>
                      showToast(
                        error.message || "Sign-in failed. Please try again.",
                        "error",
                      )
                    }
                    disabled={loginMutation.isPending}
                  />
                </View>
              )}

              {/* Toggle Mode */}
              <TouchableOpacity
                onPress={() => {
                  if (isLogin && onRequestSignUp) {
                    // No role chosen yet (direct sign-in entry) — send them
                    // to role selection instead of guessing applicant/sponsor.
                    onRequestSignUp();
                  } else {
                    setIsLogin(!isLogin);
                  }
                }}
                style={styles.toggleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleText}>
                  {isLogin
                    ? "New to BackChannel? "
                    : "Already have an account? "}
                  <Text style={styles.toggleHighlight}>
                    {isLogin ? "Sign up" : "Sign in"}
                  </Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {showForgotPasswordModal && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleCloseForgotPasswordModal}
            />
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={styles.modalContent}
            >
              {!forgotPasswordSent ? (
                <>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter your email and we'll send you a link to reset your
                    password.
                  </Text>

                  <View style={styles.modalInputWrapper}>
                    <Mail color="#AAA" size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Email Address"
                      placeholderTextColor="#BBB"
                      value={forgotPasswordEmail}
                      onChangeText={setForgotPasswordEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleSendResetEmail}
                    disabled={forgotPasswordMutation.isPending}
                    style={[
                      styles.modalButton,
                      forgotPasswordMutation.isPending && { opacity: 0.7 },
                    ]}
                  >
                    {forgotPasswordMutation.isPending ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        Send Reset Link
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCloseForgotPasswordModal}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.successIconWrapper}>
                    <Mail color="#000" size={32} />
                  </View>
                  <Text style={styles.modalTitle}>Check Your Email</Text>
                  <Text style={styles.modalSubtitle}>
                    If an account exists for{"\n"}
                    <Text style={styles.emailHighlight}>
                      {forgotPasswordEmail}
                    </Text>
                    , we've sent a password reset link.
                  </Text>

                  <Text style={styles.modalSpamHint}>
                    Don't see it? Check your spam or junk folder — it can take a
                    minute to arrive.
                  </Text>

                  <TouchableOpacity
                    onPress={handleCloseForgotPasswordModal}
                    style={styles.modalButton}
                  >
                    <Text style={styles.modalButtonText}>Got It</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    gap: 12,
    marginBottom: 20,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  form: {
    gap: 16,
  },
  inputGroup: {},
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -8,
  },
  eyeBtn: {
    marginLeft: 8,
  },
  forgotText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#000",
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  ssoSection: {
    marginTop: 20,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EEE",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
  },
  toggleBtn: {
    marginTop: 24,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 15,
    color: "#666",
  },
  toggleHighlight: {
    color: "#000",
    fontWeight: "700",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  modalSpamHint: {
    fontSize: 12.5,
    color: "#999",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancelBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },
  successIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  emailHighlight: {
    fontWeight: "700",
    color: "#000",
  },
});
