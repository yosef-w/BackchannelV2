import {
  identifyUser,
  trackOnboardingCompleted,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "@/lib/analytics/mixpanel";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  Plus,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { tokens } from "@/constants/theme";

interface SponsorQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
}

const AVAILABLE_QUESTIONS = [
  "MY SECRET SUPERPOWER",
  "I'M BEST KNOWN FOR",
  "IF I WASN'T IN TECH",
  "MY FAVORITE BRAINSTORMING FUEL",
  "WHAT I LOOK FOR IN TALENT",
  "ONE THING THAT SURPRISED ME",
  "THE PROJECT I'M MOST PROUD OF",
  "MY MENTORSHIP STYLE",
  "WHY I SPONSOR",
  "WHAT ENERGIZES ME",
  "MY UNPOPULAR OPINION",
  "THE BEST ADVICE I'VE RECEIVED",
  "HOW I RECHARGE",
  "WHAT I'M LEARNING RIGHT NOW",
  "MY LEADERSHIP PHILOSOPHY",
];

const questions = [
  {
    id: 1,
    question: "Which company do you currently work at?",
    type: "text",
    placeholder: "e.g., Google, Stripe, Goldman Sachs",
  },
  {
    id: 2,
    question: "What is your current job title?",
    type: "text",
    placeholder: "e.g., Senior Software Engineer",
  },
  {
    id: 3,
    question: "How long have you worked there?",
    type: "select",
    options: ["< 1 year", "1-3 years", "3-5 years", "5+ years"],
  },
  {
    id: 4,
    question: "Are you open to referring qualified candidates?",
    type: "select",
    options: ["Yes, absolutely", "Case by case basis", "Not at this time"],
  },
  {
    id: 5,
    question: "Have you given professional referrals in the past?",
    type: "select",
    options: ["Frequently", "A few times", "Not yet"],
  },
  {
    id: 6,
    question: "Does your company offer a bonus for successful referrals?",
    type: "select",
    options: ["Yes", "No", "I'm not sure"],
  },
  {
    id: 7,
    question: "Share your professional personality",
    type: "insights",
    subtitle: "Pick 2-3 questions to help candidates know what you're about",
  },
  {
    id: 8,
    question: "Verify your employment",
    type: "email",
    placeholder: "name@company.com",
  },
];

export function SponsorQuestionnaire({
  onComplete,
  onBack,
}: SponsorQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Insights state
  const [selectedInsights, setSelectedInsights] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const cardYPositions = useRef<number[]>([]);

  const sponsorData = useOnboardingStore((state) => state.sponsorData);
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      console.log("[SponsorQuestionnaire] Starting registration...");
      return authApi.createProfile({
        userType: "sponsor",
        firstName: sponsorData.firstName || "",
        lastName: sponsorData.lastName || "",
        email: sponsorData.email || "",
        password: sponsorData.password || "",
        profileData: {
          company: answers[0],
          jobTitle: answers[1],
          yearsAtCompany: answers[2],
          openToReferrals: answers[3],
          pastReferrals: answers[4],
          referralBonus: answers[5],
          insights: selectedInsights,
          workEmail: answers[7],
        },
      });
    },
    onSuccess: async (data) => {
      console.log("[SponsorQuestionnaire] Registration successful:", data);

      // Save auth tokens
      await setAuthTokens(data.access_token, data.refresh_token, "Sponsor");

      // Identify the new sponsor for the rest of their session and stamp
      // basic profile attributes onto Mixpanel's People record. The work
      // email is collected here but `work_email_verified` is currently a
      // cosmetic flag (see BACKEND_CHANGES_NEEDED.md §1).
      identifyUser({
        userId: String(data.user_id),
        userType: "sponsor",
        email: sponsorData.email ?? null,
        firstName: sponsorData.firstName ?? null,
        lastName: sponsorData.lastName ?? null,
        company: answers[0] ?? null,
        jobTitle: answers[1] ?? null,
        workEmailVerified: false,
      });
      trackSignUpSucceeded("sponsor");
      trackOnboardingCompleted("sponsor");
      // Link this backend user ID to their RevenueCat customer record.
      rcIdentifyUser(String(data.user_id));

      // Load profile data into local store
      await loadFromProfile({
        firstName: sponsorData.firstName,
        lastName: sponsorData.lastName,
        email: sponsorData.email,
        profileData: {
          company: answers[0],
          jobTitle: answers[1],
          yearsAtCompany: answers[2],
          openToReferrals: answers[3],
          pastReferrals: answers[4],
          referralBonus: answers[5],
          insights: selectedInsights,
          workEmail: answers[7],
        },
      });

      // Clear onboarding data
      clearOnboardingData();

      // Show success modal
      setShowSuccess(true);

      // Fire-and-forget the work-email verification send (PR #42). The
      // backend hands out a JWT scoped to `purpose: "work_email_verification"`
      // and emails it to the work email the sponsor just provided. Sponsors
      // are gated out of the swipe deck in HomeView until they click it.
      // Failures here aren't blocking — they can re-trigger via Profile.
      if (answers[7]) {
        authApi
          .sendWorkEmailVerification(String(answers[7]))
          .catch((err) =>
            console.warn(
              "[SponsorQuestionnaire] Failed to send work-email verification:",
              err,
            ),
          );
      }

      // Navigate to dashboard after 2.2 seconds
      setTimeout(() => {
        setIsSubmitting(false);
        onComplete();
        // Delay toast until after the navigation transition finishes. Two
        // emails are now in flight: the login-email verification (PR #38)
        // and the work-email verification we just kicked off (PR #42).
        setTimeout(() => {
          showToast(
            "Welcome! Check your inbox — we sent two verification emails (login + work).",
            "success",
          );
        }, 500);
      }, 2200);
    },
    onError: (error: Error) => {
      console.warn("[SponsorQuestionnaire] Registration failed:", error);
      setIsSubmitting(false);
      trackSignUpFailed("sponsor", error.message || "unknown");

      // Handle specific error cases
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("email already in use") ||
        errorMessage.includes("already exists")
      ) {
        showToast(
          "This email is already registered. Please use a different email or sign in.",
          "error",
        );
      } else if (errorMessage.includes("password")) {
        showToast(`Password requirements not met. ${error.message}`, "error");
      } else {
        showToast(`Registration failed: ${error.message}`, "error");
      }
    },
  });

  const handleFinalSubmit = () => {
    Keyboard.dismiss();
    setIsSubmitting(true);
    createProfileMutation.mutate();
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
    else onBack();
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isInsightsScreen = question.type === "insights";
  const canContinue = isInsightsScreen
    ? selectedInsights.length >= 2 &&
      selectedInsights.length <= 3 &&
      selectedInsights.every((i) => i.answer.trim().length > 0)
    : answers[currentQuestion] && answers[currentQuestion].length > 0;

  const progressBarStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 400 }),
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={handleBack}
            disabled={isSubmitting}
            style={styles.iconBtn}
          >
            <ArrowLeft color={tokens.colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>
            {currentQuestion + 1} of {questions.length}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBar, progressBarStyle]} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              key={currentQuestion}
              layout={Layout.springify()}
              entering={FadeInDown.duration(500)}
            >
              <Text style={styles.questionText}>{question.question}</Text>

              {question.type === "insights" ? (
                <View>
                  {question.subtitle && (
                    <Text style={styles.insightsSubtitle}>
                      {question.subtitle}
                    </Text>
                  )}

                  {/* Display selected insights */}
                  {selectedInsights.map((insight, index) => (
                    <Animated.View
                      key={index}
                      entering={FadeInDown.delay(index * 100)}
                      style={styles.insightCard}
                      onLayout={(e) => {
                        cardYPositions.current[index] = e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={styles.insightCardHeader}>
                        <View style={styles.insightQuestionBadge}>
                          <Sparkles size={12} color={tokens.colors.text} />
                          <Text style={styles.insightQuestion}>
                            {insight.question}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedInsights(
                              selectedInsights.filter((_, i) => i !== index),
                            );
                          }}
                          style={styles.removeInsightBtn}
                        >
                          <X size={16} color={tokens.colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        placeholder="Share your answer..."
                        placeholderTextColor={tokens.colors.textFaint}
                        value={insight.answer}
                        onFocus={() => {
                          const y = cardYPositions.current[index];
                          if (y !== undefined) {
                            scrollViewRef.current?.scrollTo({
                              y,
                              animated: true,
                            });
                          }
                        }}
                        onChangeText={(text) => {
                          if (text.includes("\n")) {
                            Keyboard.dismiss();
                            text = text.replace(/\n/g, "");
                          }
                          const updated = [...selectedInsights];
                          updated[index].answer = text;
                          setSelectedInsights(updated);
                        }}
                        multiline
                        returnKeyType="default"
                        style={styles.insightAnswerInput}
                        maxLength={200}
                      />
                      <Text style={styles.charCount}>
                        {insight.answer.length}/200
                      </Text>
                    </Animated.View>
                  ))}

                  {/* Add new insight button */}
                  {selectedInsights.length < 3 && (
                    <TouchableOpacity
                      onPress={() => setShowQuestionPicker(!showQuestionPicker)}
                      style={styles.addInsightBtn}
                    >
                      <Plus size={20} color={tokens.colors.text} />
                      <Text style={styles.addInsightText}>
                        {selectedInsights.length === 0
                          ? "Choose your first question"
                          : `Add question (${selectedInsights.length}/3)`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Question picker */}
                  {showQuestionPicker && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.questionPickerContainer}
                    >
                      <Text style={styles.pickerTitle}>Choose a question</Text>
                      <ScrollView
                        style={styles.questionsList}
                        nestedScrollEnabled
                      >
                        {AVAILABLE_QUESTIONS.filter(
                          (q) =>
                            !selectedInsights.some(
                              (insight) => insight.question === q,
                            ),
                        ).map((q) => (
                          <TouchableOpacity
                            key={q}
                            onPress={() => {
                              setSelectedInsights([
                                ...selectedInsights,
                                { question: q, answer: "" },
                              ]);
                              setShowQuestionPicker(false);
                            }}
                            style={styles.questionOption}
                          >
                            <Text style={styles.questionOptionText}>{q}</Text>
                            <Plus size={18} color={tokens.colors.text} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </Animated.View>
                  )}

                  <Text style={styles.insightsHelper}>
                    💡 These help candidates understand your mentorship style
                    and what it's like to work with you
                  </Text>
                </View>
              ) : question.type === "text" || question.type === "email" ? (
                <View style={styles.inputWrapper}>
                  {question.type === "email" && (
                    <Mail color={tokens.colors.textFaint} size={20} style={{ marginRight: 12 }} />
                  )}
                  <TextInput
                    placeholder={question.placeholder}
                    placeholderTextColor={tokens.colors.textFaint}
                    value={answers[currentQuestion] || ""}
                    onChangeText={(v) =>
                      setAnswers({ ...answers, [currentQuestion]: v })
                    }
                    style={styles.textInput}
                    autoFocus
                    keyboardType={
                      question.type === "email" ? "email-address" : "default"
                    }
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={styles.optionsContainer}>
                  {question.options?.map((option) => {
                    const isSelected = answers[currentQuestion] === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() =>
                          setAnswers({
                            ...answers,
                            [currentQuestion]: option,
                          })
                        }
                        style={[
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.textWhite,
                          ]}
                        >
                          {option}
                        </Text>
                        {isSelected && <Check color={tokens.colors.brandText} size={20} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!canContinue || isSubmitting}
              style={[
                styles.nextButton,
                (!canContinue || isSubmitting) && styles.nextButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={tokens.colors.brandText} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {isLastQuestion ? "Complete Profile" : "Continue"}
                  </Text>
                  <ArrowRight color={tokens.colors.brandText} size={20} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {showSuccess && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill}>
            <View style={styles.successContainer}>
              <Animated.View
                entering={ZoomIn.delay(200).duration(600)}
                style={styles.successIconBox}
              >
                <UserCheck color={tokens.colors.text} size={48} />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.delay(400)}
                style={styles.successTitle}
              >
                Profile Complete
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(600)}
                style={styles.successSub}
              >
                Your sponsor account is ready. Welcome to the network.
              </Animated.Text>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  safeArea: { flex: 1 },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { padding: 8 },
  stepIndicator: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  progressBarBg: { height: 2, backgroundColor: tokens.colors.border, width: "100%" },
  progressBar: { height: "100%", backgroundColor: tokens.colors.brand },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40 },
  questionText: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 34,
    lineHeight: 40,
    color: tokens.colors.text,
    letterSpacing: -0.6,
    marginBottom: 40,
  },
  optionsContainer: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  optionCardSelected: { backgroundColor: tokens.colors.brand, borderColor: tokens.colors.brand },
  optionText: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 16,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: tokens.radii.m,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  textInput: {
    flex: 1,
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 16,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },

  // Insights styles
  insightsSubtitle: {
    fontFamily: tokens.fontFamilies.sans300,
    fontSize: 16,
    color: tokens.colors.textBody,
    marginBottom: 32,
    lineHeight: 26,
  },
  insightCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  insightCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  insightQuestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  insightQuestion: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    flex: 1,
  },
  removeInsightBtn: { padding: 4 },
  insightAnswerInput: {
    backgroundColor: tokens.colors.bg,
    borderRadius: tokens.radii.m,
    padding: 16,
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 15,
    color: tokens.colors.text,
    minHeight: 100,
    lineHeight: 22,
    textAlignVertical: "top",
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  charCount: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 8,
    textAlign: "right",
  },
  addInsightBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: tokens.radii.l,
    padding: 20,
    marginBottom: 16,
  },
  addInsightText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 14,
    color: tokens.colors.text,
    letterSpacing: -0.1,
  },
  questionPickerContainer: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    maxHeight: 300,
  },
  pickerTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  questionsList: { maxHeight: 240 },
  questionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
  },
  questionOptionText: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 14,
    color: tokens.colors.text,
    flex: 1,
    letterSpacing: -0.1,
  },
  insightsHelper: {
    fontFamily: tokens.fontFamilies.sans400Italic,
    fontSize: 14,
    color: tokens.colors.textMuted,
    lineHeight: 20,
    marginTop: 8,
  },

  footer: { paddingHorizontal: 28, paddingBottom: 30, paddingTop: 20 },
  nextButton: {
    backgroundColor: tokens.colors.brand,
    height: 56,
    borderRadius: tokens.radii.m,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  nextButtonDisabled: { opacity: 0.3 },
  nextButtonText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.brandText,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  textWhite: { color: tokens.colors.brandText },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: tokens.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  successTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 30,
    lineHeight: 34,
    color: tokens.colors.text,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  successSub: {
    fontFamily: tokens.fontFamilies.sans300,
    fontSize: 16,
    color: tokens.colors.textBody,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 26,
  },
});
