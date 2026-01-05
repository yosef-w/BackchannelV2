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
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AuthScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export function AuthScreen({ onComplete, onBack }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    onComplete();
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
            <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
              
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {isLogin ? "Welcome back" : "Create your account"}
                </Text>
                <Text style={styles.subtitle}>
                  {isLogin ? "Sign in to continue" : "Join the professional referral network"}
                </Text>
              </View>

              {/* Social Login - Minimal Outline Style */}
              <TouchableOpacity activeOpacity={0.7} style={styles.socialButton}>
                <FontAwesome name="linkedin-square" size={24} color="#000" />
                <Text style={styles.socialButtonText}>Continue with LinkedIn</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.line} />
              </View>

              {/* Form */}
              <View style={styles.form}>
                {!isLogin && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <User color="#AAA" size={18} style={styles.inputIcon} />
                      <TextInput
                        placeholder="Name"
                        placeholderTextColor="#BBB"
                        value={fullName}
                        onChangeText={setFullName}
                        style={styles.input}
                      />
                    </View>
                  </View>
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
                      secureTextEntry
                      style={styles.input}
                    />
                  </View>
                </View>

                {isLogin && (
                  <TouchableOpacity style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {/* Primary Action Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>
                    {isLogin ? "Sign In" : "Get Started"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Toggle Mode */}
              <TouchableOpacity
                onPress={() => setIsLogin(!isLogin)}
                style={styles.toggleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleText}>
                  {isLogin ? "New to BackChannel? " : "Already have an account? "}
                  <Text style={styles.toggleHighlight}>
                    {isLogin ? "Sign up" : "Sign in"}
                  </Text>
                </Text>
              </TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: 32,
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
    marginBottom: 24,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
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
    gap: 20,
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
    marginTop: 32,
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
});