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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { Color, Radius, Space, Type } from "@/constants/theme";

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
            <ArrowLeft color={Color.muted} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>
            {String(currentQuestion + 1).padStart(2, "0")} /{" "}
            {String(questions.length).padStart(2, "0")}
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
                          <Sparkles size={12} color={Color.ink} />
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
                          <X size={16} color={Color.muted} />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        placeholder="Share your answer..."
                        placeholderTextColor={Color.faint}
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
                      <Plus size={18} color={Color.ink} strokeWidth={2} />
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
                            <Plus size={16} color={Color.muted} strokeWidth={2} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </Animated.View>
                  )}

                  <Text style={styles.insightsHelper}>
                    These help candidates understand your mentorship style
                    and what it's like to work with you.
                  </Text>
                </View>
              ) : question.type === "text" || question.type === "email" ? (
                <View style={styles.inputWrapper}>
                  {question.type === "email" && (
                    <Mail color={Color.muted} size={18} style={{ marginRight: 12 }} />
                  )}
                  <TextInput
                    placeholder={question.placeholder}
                    placeholderTextColor={Color.faint}
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
                        {isSelected && (
                          <Check color={Color.paper} size={18} strokeWidth={2.2} />
                        )}
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
                <ActivityIndicator color={Color.paper} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {isLastQuestion ? "Complete profile" : "Continue"}
                  </Text>
                  <ArrowRight color={Color.paper} size={18} strokeWidth={2.2} />
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
                <UserCheck color={Color.ink} size={36} strokeWidth={1.5} />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.delay(400)}
                style={styles.successTitle}
              >
                Profile complete.
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
  container: { flex: 1, backgroundColor: Color.offWhite },
  safeArea: { flex: 1 },

  // ── Top chrome ────────────────────────────────────────────────────
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Space.screen,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  iconBtn: { paddingVertical: 6, paddingRight: 6 },
  stepIndicator: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  progressBarBg: {
    height: 2,
    backgroundColor: Color.border,
    width: "100%",
  },
  progressBar: { height: "100%", backgroundColor: Color.ink },

  // ── Question hero + content ───────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Space.screen,
    paddingTop: Space.xxl,
  },
  questionText: {
    fontFamily: Type.sans400,
    fontSize: 32,
    color: Color.ink,
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: Space.xxxl,
  },

  // ── Multiple-choice options ───────────────────────────────────────
  optionsContainer: { gap: Space.md },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Space.lg,
    paddingVertical: 18,
    borderRadius: Radius.lg,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
  },
  optionCardSelected: {
    backgroundColor: Color.ink,
    borderColor: Color.ink,
  },
  optionText: {
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.1,
  },

  // ── Single-line text/email input ──────────────────────────────────
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Color.paper,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textInput: {
    flex: 1,
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    padding: 0,
  },

  // ── Insights builder ──────────────────────────────────────────────
  insightsSubtitle: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.body,
    marginBottom: Space.xl,
    lineHeight: 22,
  },
  insightCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Color.border,
  },
  insightCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Space.md,
  },
  insightQuestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    backgroundColor: Color.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.border,
  },
  insightQuestion: {
    fontFamily: Type.sans600,
    fontSize: 10,
    color: Color.muted,
    letterSpacing: 1.3,
    flex: 1,
    textTransform: "uppercase",
  },
  removeInsightBtn: { padding: 4, marginLeft: 6 },
  insightAnswerInput: {
    backgroundColor: Color.offWhite,
    borderRadius: Radius.sm,
    padding: 14,
    fontFamily: Type.sans500,
    fontSize: 14,
    color: Color.ink,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: Color.border,
  },
  charCount: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.faint,
    marginTop: 6,
    textAlign: "right",
  },
  addInsightBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.borderStrong,
    borderStyle: "dashed",
    borderRadius: Radius.lg,
    paddingVertical: 18,
    marginBottom: Space.md,
  },
  addInsightText: {
    fontFamily: Type.sans600,
    fontSize: 14,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  questionPickerContainer: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Color.border,
    maxHeight: 300,
  },
  pickerTitle: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.6,
    marginBottom: Space.md,
    textTransform: "uppercase",
  },
  questionsList: { maxHeight: 240 },
  questionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Color.surface,
  },
  questionOptionText: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.ink,
    flex: 1,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  insightsHelper: {
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.muted,
    lineHeight: 20,
    marginTop: Space.sm,
  },

  // ── Footer CTA ────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: Space.screen,
    paddingBottom: Space.xl,
    paddingTop: Space.md,
  },
  nextButton: {
    backgroundColor: Color.ink,
    paddingVertical: 16,
    borderRadius: Radius.md,
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
  nextButtonDisabled: { opacity: 0.35 },
  nextButtonText: {
    fontFamily: Type.sans500,
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  textWhite: { color: Color.paper },

  // ── Success modal ─────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.xxxl,
  },
  successIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Color.paper,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.xl,
    borderWidth: 1,
    borderColor: Color.border,
  },
  successTitle: {
    fontFamily: Type.sans400,
    fontSize: 28,
    color: Color.ink,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  successSub: {
    fontFamily: Type.sans300,
    fontSize: 15,
    color: Color.body,
    textAlign: "center",
    marginTop: Space.md,
    lineHeight: 23,
    maxWidth: 320,
  },
});
