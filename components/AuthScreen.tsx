import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ArrowLeft, Lock, Mail, User } from "lucide-react-native";
import React, { useState } from "react";
import {
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
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { authApi, LoginResponse } from "../lib/auth-api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AuthScreenProps {
  onComplete: () => void;
  onLoginComplete?: () => void; // Separate handler for login to skip questionnaire
  onBack: () => void;
}

export function AuthScreen({ onComplete, onLoginComplete, onBack }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const userType = useOnboardingStore((state) => state.userType);
  const setUserType = useOnboardingStore((state) => state.setUserType);
  const updateApplicantData = useOnboardingStore((state) => state.updateApplicantData);
  const updateSponsorData = useOnboardingStore((state) => state.updateSponsorData);
  const updatePersonal = useUserProfileStore((state) => state.updatePersonal);

  const loginMutation = useMutation<LoginResponse, Error>({
    mutationFn: async () => {
      return authApi.login(email, password);
    },
    onSuccess: async (data) => {
      // Store real tokens from backend
      await setAuthTokens(data.access_token, data.refresh_token);
      
      // Backend doesn't return profile info in login response
      // Just store the email, profile data will be loaded from cache or fetched later
      updatePersonal({
        email: data.email,
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '',
        address: {
          city: '',
          state: '',
          street: '',
          zip: '',
          country: '',
        },
      });
      
      // Use onLoginComplete if provided (skips questionnaire), otherwise onComplete
      if (onLoginComplete) {
        onLoginComplete();
      } else {
        onComplete();
      }
    },
    onError: (error) => {
      Alert.alert("Login Failed", error.message);
    },
  });

  const forgotPasswordMutation = useMutation<{ message: string }, Error>({
    mutationFn: async () => {
      return authApi.forgotPassword(forgotPasswordEmail);
    },
    onSuccess: () => {
      setForgotPasswordSent(true);
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleSubmit = () => {
    if (isLogin) {
      if (!email || !password) {
        Alert.alert("Missing Fields", "Please enter email and password.");
        return;
      }
      loginMutation.mutate();
    } else {
      const authData = { firstName, lastName, email, password };
      
      if (userType === "applicant") {
        updateApplicantData(authData);
      } else if (userType === "sponsor") {
        updateSponsorData(authData);
      }
      
      onComplete();
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
    setForgotPasswordSent(false);
    setForgotPasswordEmail("");
  };

  const handleSendResetEmail = () => {
    if (!forgotPasswordEmail) {
      Alert.alert("Missing Email", "Please enter your email address.");
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
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

              {/* Social Login */}
              <TouchableOpacity activeOpacity={0.7} style={styles.socialButton}>
                <FontAwesome
                  name="linkedin-square"
                  size={24}
                  color="#000"
                />
                <Text style={styles.socialButtonText}>
                  Continue with LinkedIn
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.line} />
              </View>

              {/* Form */}
              <View style={styles.form}>
                {!isLogin && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>First Name</Text>
                      <View style={styles.inputWrapper}>
                        <User
                          color="#AAA"
                          size={18}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="First Name"
                          placeholderTextColor="#BBB"
                          value={firstName}
                          onChangeText={setFirstName}
                          style={styles.input}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Last Name</Text>
                      <View style={styles.inputWrapper}>
                        <User
                          color="#AAA"
                          size={18}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="Last Name"
                          placeholderTextColor="#BBB"
                          value={lastName}
                          onChangeText={setLastName}
                          style={styles.input}
                        />
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Mail
                      color="#AAA"
                      size={18}
                      style={styles.inputIcon}
                    />
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
                    <Lock
                      color="#AAA"
                      size={18}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor="#BBB"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      style={styles.input}
                    />
                  </View>
                </View>

                {isLogin && (
                  <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>
                      Forgot password?
                    </Text>
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

              {/* Toggle Mode */}
              <TouchableOpacity
                onPress={() => setIsLogin(!isLogin)}
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
                    Enter your email and we'll send you a link to reset your password.
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
                      forgotPasswordMutation.isPending && { opacity: 0.7 }
                    ]}
                  >
                    {forgotPasswordMutation.isPending ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalButtonText}>Send Reset Link</Text>
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
                    We've sent a password reset link to{"\n"}
                    <Text style={styles.emailHighlight}>{forgotPasswordEmail}</Text>
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: "#BBB",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
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