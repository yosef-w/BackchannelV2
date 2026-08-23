import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
// Wrapper, NOT the library directly — falls back to the previous
// KeyboardAvoidingView+ScrollView behavior on binaries built before the
// native module existed instead of crashing at import.
import { KeyboardAwareScrollView } from "@/components/ui/keyboard";
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
import { Colors, Fonts, Type } from "@/constants/theme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { SSOButtons } from "@/components/auth/SSOButtons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";

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
  // Drives the focused-input visual affordance below — no field name here
  // ever collides with another, so a single tracker covers the main form
  // and the forgot-password modal's email field alike.
  const [focusedField, setFocusedField] = useState<
    "firstName" | "lastName" | "email" | "password" | "forgotEmail" | null
  >(null);
  const clearFocus = (field: string) =>
    setFocusedField((f) => (f === field ? null : f));
  const seedSessionEmail = useUserProfileStore(
    (state) => state.seedSessionEmail,
  );
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);
  // Gate on the feature flag AND whether either provider can actually
  // render here, so a build with SSO_ENABLED true but no supported
  // provider (e.g. Android with no Google client IDs configured yet)
  // doesn't show a picker with nothing but an email button on it.
  const showSso =
    SSO_ENABLED && (isAppleSignInSupported() || isGoogleSignInSupported());

  // "The Front Door": when SSO is available this screen opens as a method
  // picker — Apple / Google / email as three equal pills — and the typed
  // form becomes its own step (the SSO-first pattern used by Notion/
  // Airbnb). This also gives Apple's button the top-of-screen prominence
  // App Store guideline 4.8 asks for. When SSO isn't available (flag off,
  // Expo Go, unsupported platform) a picker would be a pointless extra
  // tap, so the screen opens directly on the form — exactly the pre-SSO
  // behavior.
  const [view, setView] = useState<"picker" | "form">(
    showSso ? "picker" : "form",
  );

  const handleScreenBack = () => {
    if (!isLogin && showSso && view === "form") {
      // The sign-up email form is a sub-step of the picker — back returns
      // there rather than leaving the screen. (Sign-in has no sub-step:
      // its form is inline, so back always exits.)
      setView("picker");
      return;
    }
    onBack();
  };

  // AJ "The Switch": the mode lives in the segmented tabs (NEW HERE ·
  // SIGN IN) at the top — the single visible source of truth — instead of
  // a one-word text link at the bottom.
  const handlePressNewHere = () => {
    if (!isLogin) return;
    if (onRequestSignUp) {
      // No role chosen yet (direct sign-in entry) — send them to role
      // selection instead of guessing applicant/sponsor.
      onRequestSignUp();
      return;
    }
    setIsLogin(false);
    setView(showSso ? "picker" : "form");
  };

  const handlePressSignIn = () => {
    if (isLogin) return;
    setIsLogin(true);
  };

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
      // Show the modal's own "Check Your Email" state — previously this
      // ALSO closed the modal on the next line, which made that state
      // unreachable dead UI and left only a toast. The in-modal state
      // carries the address + spam hint, so no toast needed on top.
      setForgotPasswordSent(true);
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
            onPress={handleScreenBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft color="#000" size={24} />
          </TouchableOpacity>
        </View>

        {/* Auto-scrolls whichever field is focused (and the submit button
            below it) above the keyboard as you type — plain ScrollView +
            KeyboardAvoidingView only resize the available space, they
            don't know to chase a specific focused input. */}
        <KeyboardAwareScrollView
          style={styles.keyboardView}
          bottomOffset={24}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
            {/* ── Mode switch — NEW HERE · SIGN IN. The rebrand's
                underline tabs, the single visible source of truth for
                the mode (replaces the buried one-word text link). ── */}
            <View style={styles.segRow}>
              <TouchableOpacity
                onPress={handlePressNewHere}
                style={styles.segBtn}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: !isLogin }}
              >
                <Text
                  style={[styles.segText, !isLogin && styles.segTextActive]}
                >
                  NEW HERE
                </Text>
                {!isLogin && <View style={styles.segUnderline} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePressSignIn}
                style={styles.segBtn}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isLogin }}
              >
                <Text style={[styles.segText, isLogin && styles.segTextActive]}>
                  SIGN IN
                </Text>
                {isLogin && <View style={styles.segUnderline} />}
              </TouchableOpacity>
            </View>

            {isLogin ? (
              /* ── Sign in — the shortcut. Compact header, email +
                 password already open (returning users skip a tap), SSO
                 demoted below the divider. Distinct silhouette from the
                 sign-up pitch on purpose. ── */
              <Animated.View
                key="signin"
                entering={FadeInDown.duration(350)}
                style={styles.modeContent}
              >
                <Text style={styles.welcomeEyebrow}>WELCOME BACK</Text>
                <Text style={styles.titleCompact}>
                  Good to see <Text style={styles.titleAccent}>you.</Text>
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <FocusRing active={focusedField === "email"} />
                      <Mail color={Colors.faint} size={18} style={styles.inputIcon} />
                      <TextInput
                        placeholder="Email"
                        placeholderTextColor={Colors.faint}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => clearFocus("email")}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <FocusRing active={focusedField === "password"} />
                      <Lock color={Colors.faint} size={18} style={styles.inputIcon} />
                      <TextInput
                        placeholder="Password"
                        placeholderTextColor={Colors.faint}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => clearFocus("password")}
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
                          <EyeOff color={Colors.faint} size={18} />
                        ) : (
                          <Eye color={Colors.faint} size={18} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    style={styles.forgotBtn}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                    disabled={loginMutation.isPending}
                    style={[
                      styles.submitButton,
                      loginMutation.isPending && { opacity: 0.7 },
                    ]}
                  >
                    {loginMutation.isPending ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {showSso && (
                  <>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <SSOButtons
                      onSuccess={handleSsoSuccess}
                      onError={(error) =>
                        showToast(
                          error.message || "Sign-in failed. Please try again.",
                          "error",
                        )
                      }
                    />
                  </>
                )}
              </Animated.View>
            ) : view === "picker" && showSso ? (
              /* ── New here — the pitch. Tall serif headline, the
                 one-liner, SSO-first (Apple keeps its guideline-4.8
                 prominence on the screen new users see), email one tap
                 away. ── */
              <Animated.View
                key="signup-picker"
                entering={FadeInDown.duration(350)}
                style={[styles.modeContent, styles.pickerCentered]}
              >
                <View style={styles.header}>
                  <Text style={styles.title}>
                    Create your <Text style={styles.titleAccent}>account.</Text>
                  </Text>
                  <Text style={styles.subtitle}>
                    {userType === "sponsor"
                      ? "Help great people get in — and get rewarded for it."
                      : "Your next job comes from someone already inside."}
                  </Text>
                </View>

                <Animated.View entering={FadeInDown.duration(600).delay(80)}>
                  <SSOButtons
                    onSuccess={handleSsoSuccess}
                    // Backend SSO errors carry user-appropriate guidance
                    // in the message (e.g. 409 "log in with password
                    // instead", Apple no-email recovery steps) — show it
                    // verbatim, generic line for network-level throws.
                    onError={(error) =>
                      showToast(
                        error.message || "Sign-in failed. Please try again.",
                        "error",
                      )
                    }
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(600).delay(160)}>
                  <PressableScale
                    pressedScale={0.97}
                    style={styles.emailButton}
                    onPress={() => setView("form")}
                    accessibilityRole="button"
                    accessibilityLabel="Sign up with email"
                  >
                    <Mail color={Colors.ink} size={18} />
                    <Text style={styles.emailButtonText}>
                      Sign up with email
                    </Text>
                  </PressableScale>
                </Animated.View>
              </Animated.View>
            ) : (
            /* ── Sign up with email — the typed step behind the picker,
               on the same rule-line letterpress fields as sign-in. The
               segments stay visible above, so no bottom toggle link. ── */
            <Animated.View
              key="signup-form"
              entering={FadeInDown.duration(350)}
              style={styles.modeContent}
            >
              <View style={styles.header}>
                <Text style={styles.title}>
                  Create your <Text style={styles.titleAccent}>account.</Text>
                </Text>
                <Text style={styles.subtitle}>
                  {userType === "sponsor"
                    ? "Help great people get in — and get rewarded for it."
                    : "Your next job comes from someone already inside."}
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>First Name</Text>
                  <View style={styles.inputWrapper}>
                    <FocusRing active={focusedField === "firstName"} />
                    <User color={Colors.faint} size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="First Name"
                      placeholderTextColor={Colors.faint}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField("firstName")}
                      onBlur={() => clearFocus("firstName")}
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Last Name</Text>
                  <View style={styles.inputWrapper}>
                    <FocusRing active={focusedField === "lastName"} />
                    <User color={Colors.faint} size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Last Name"
                      placeholderTextColor={Colors.faint}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField("lastName")}
                      onBlur={() => clearFocus("lastName")}
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <FocusRing active={focusedField === "email"} />
                    <Mail color={Colors.faint} size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor={Colors.faint}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => clearFocus("email")}
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <FocusRing active={focusedField === "password"} />
                    <Lock color={Colors.faint} size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor={Colors.faint}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => clearFocus("password")}
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
                        <EyeOff color={Colors.faint} size={18} />
                      ) : (
                        <Eye color={Colors.faint} size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>Get Started</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
            )}
        </KeyboardAwareScrollView>

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
                    Enter your email and we&apos;ll send you a link to reset your
                    password.
                  </Text>

                  <View style={styles.modalInputWrapper}>
                    <FocusRing active={focusedField === "forgotEmail"} />
                    <Mail color={Colors.faint} size={18} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Email Address"
                      placeholderTextColor={Colors.faint}
                      value={forgotPasswordEmail}
                      onChangeText={setForgotPasswordEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedField("forgotEmail")}
                      onBlur={() => clearFocus("forgotEmail")}
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
                  <View style={styles.successPopWrap}>
                    <ConfirmPop
                      size={64}
                      icon={<Mail color="#FFF" size={26} />}
                    />
                  </View>
                  <Text style={styles.modalTitle}>Check Your Email</Text>
                  <Text style={styles.modalSubtitle}>
                    If an account exists for{"\n"}
                    <Text style={styles.emailHighlight}>
                      {forgotPasswordEmail}
                    </Text>
                    , we&apos;ve sent a password reset link.
                  </Text>

                  <Text style={styles.modalSpamHint}>
                    Don&apos;t see it? Check your spam or junk folder — it can take a
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

/**
 * The focused-input affordance, as an absolutely-positioned overlay whose
 * opacity toggles — deliberately NOT a conditional style on the input's
 * wrapper View. Under the New Architecture, mutating a TextInput
 * ancestor's shadow/elevation styles on focus makes Fabric recreate the
 * native view, which fires onBlur immediately after onFocus — the
 * keyboard flashes up and instantly dismisses
 * (facebook/react-native#45798). A sibling overlay isn't in the input's
 * ancestor chain, so toggling it leaves focus untouched.
 */
function FocusRing({ active }: { active: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.focusRing, active && styles.focusRingActive]}
    />
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
  header: {
    marginBottom: 24,
  },
  title: {
    ...Type.title,
    color: Colors.ink,
  },
  // The site's .hero-title em rule — italic muted accent word.
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // Matches the site's .hero-body treatment (light weight, body-gray).
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.body,
    marginTop: 8,
  },
  // ── AJ "The Switch" — segments, mode content, rule-line fields ──────
  segRow: {
    flexDirection: "row",
    gap: 26,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 10,
  },
  segBtn: {
    paddingBottom: 12,
  },
  segText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.muted,
  },
  segTextActive: {
    color: Colors.ink,
  },
  segUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    backgroundColor: Colors.ink,
  },
  modeContent: {
    flex: 1,
    paddingTop: 28,
  },
  // NEW HERE picker only — vertically centered like the pre-segment
  // screen, so the three pills sit mid-screen rather than hugging the top.
  pickerCentered: {
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 60,
  },
  welcomeEyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.2,
    color: Colors.muted,
  },
  titleCompact: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: Colors.ink,
    marginTop: 10,
    marginBottom: 20,
  },
  // The previous boxed-input language, kept deliberately — the user
  // preferred it, and it matches the questionnaire's fields.
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
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.muted,
  },
  // The "you are here" affordance the PM flagged as missing — rendered by
  // FocusRing as an overlay (see its comment for why it must not be a
  // conditional style on the wrapper). Sized -1 to sit exactly over the
  // wrapper's own 1px hairline border; same 16px radius as both wrappers.
  // No shadow: shadow/elevation on focus is precisely the Fabric trigger
  // this replaces, and the ink ring alone reads clearly.
  focusRing: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    opacity: 0,
  },
  focusRingActive: { opacity: 1 },
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
    color: Colors.body,
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: Colors.ink,
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
  // "Sign up/in with email" — third pill on the method picker. Same
  // 50pt pill as the SSO buttons (they read as three equal options), with
  // the app's standard hairline border treatment.
  emailButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
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
    ...Type.heading,
    color: Colors.ink,
    marginBottom: 12,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    color: Colors.body,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  modalSpamHint: {
    fontSize: 12.5,
    color: Colors.muted,
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
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: Colors.ink,
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
    color: Colors.body,
    fontWeight: "600",
  },
  successPopWrap: {
    alignSelf: "center",
    marginBottom: 10,
  },
  emailHighlight: {
    fontWeight: "700",
    color: "#000",
  },
});
