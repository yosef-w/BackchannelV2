import { useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
  useAnimatedStyle,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { Color, Radius, Space, Type } from "@/constants/theme";
import { SKILLS_BY_INDUSTRY } from "../constants/skills";
import {
  identifyUser,
  trackOnboardingCompleted,
  trackResumeUploaded,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "../lib/analytics/mixpanel";
import { classifyResume, uploadAndParseResume } from "../lib/api";
import { authApi } from "../lib/auth-api";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useSubscriptionStore } from "../stores/useSubscriptionStore";
import { useToastStore } from "../stores/useToastStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AVAILABLE_QUESTIONS = [
  "MY SECRET SUPERPOWER",
  "I'M BEST KNOWN FOR",
  "IF I WASN'T IN TECH",
  "MY FAVORITE BRAINSTORMING FUEL",
  "WHAT I LOOK FOR IN A TEAM",
  "ONE THING THAT SURPRISED ME",
  "THE PROJECT I'M MOST PROUD OF",
  "MY DESIGN PHILOSOPHY",
  "WHAT ENERGIZES ME",
  "MY UNPOPULAR OPINION",
  "THE BEST ADVICE I'VE RECEIVED",
  "HOW I RECHARGE",
  "WHAT I'M LEARNING RIGHT NOW",
  "MY WORK STYLE",
  "WHY I CHOSE THIS CAREER",
];

interface ApplicantQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
}

const WORK_PREFERENCE_OPTIONS = [
  "Remote",
  "Hybrid",
  "On-site",
  "Full-time",
  "Part-time",
  "Contract",
  "Open to Relocation",
  "Startup Stage",
  "Enterprise",
  "Series A–C",
];

const questions = [
  {
    id: 1,
    question: "What industry are you targeting?",
    type: "select",
    options: ["Technology", "Finance", "Healthcare", "Education", "Marketing"],
  },
  {
    id: 2,
    question: "What role are you currently in?",
    type: "text",
    placeholder: "e.g., Software Engineer",
  },
  {
    id: 3,
    question: "What position are you seeking?",
    type: "text",
    placeholder: "e.g., Senior Product Lead",
  },
  { id: 4, question: "Choose up to 5 skills to highlight", type: "skills" },
  {
    id: 5,
    question: "Add personality to your profile",
    type: "insights",
    subtitle: "Pick 2-3 questions and share what makes you unique",
  },
  {
    id: 6,
    question: "What are your work preferences?",
    type: "workPreferences",
    subtitle: "Select all that apply",
  },
  { id: 7, question: "Upload your professional resume", type: "file" },
];

export function ApplicantQuestionnaire({
  onComplete,
  onBack,
}: ApplicantQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<{
    name: string;
    uri: string;
    mimeType: string;
    size: number;
  } | null>(null);

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Insights state
  const [selectedInsights, setSelectedInsights] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(
    null,
  );
  const [tempAnswer, setTempAnswer] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);
  const cardYPositions = useRef<number[]>([]);

  // Work preferences state
  const [selectedWorkPreferences, setSelectedWorkPreferences] = useState<
    string[]
  >([]);

  const applicantData = useOnboardingStore((state) => state.applicantData);
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      // Pre-flight guard — catch missing auth data before hitting the network.
      // This should never fire after the AuthScreen validation fix, but acts as
      // a safety net in case of unexpected state loss.
      if (
        !applicantData.firstName?.trim() ||
        !applicantData.lastName?.trim() ||
        !applicantData.email?.trim() ||
        !applicantData.password
      ) {
        throw new Error(
          "Account details are missing. Please go back to the sign-up step and re-enter your name, email, and password.",
        );
      }
      console.log("[ApplicantQuestionnaire] Starting registration...");
      return authApi.createProfile({
        userType: "applicant",
        firstName: applicantData.firstName || "",
        lastName: applicantData.lastName || "",
        email: applicantData.email || "",
        password: applicantData.password || "",
        profileData: {
          targetIndustry: answers[0],
          currentRole: answers[1],
          seekingPosition: answers[2],
          skills: selectedSkills,
          insights: selectedInsights,
          workPreferences: selectedWorkPreferences,
          resumeUrl: undefined, // Uploaded separately after account creation via API
        },
      });
    },
    onSuccess: async (data) => {
      console.log("[ApplicantQuestionnaire] Registration successful:", data);

      // Save auth tokens
      await setAuthTokens(data.access_token, data.refresh_token, "Applicant");

      // Identify the new user for the rest of their session and stamp basic
      // profile attributes onto Mixpanel's People record.
      identifyUser({
        userId: String(data.user_id),
        userType: "applicant",
        email: applicantData.email ?? null,
        firstName: applicantData.firstName ?? null,
        lastName: applicantData.lastName ?? null,
        currentRole: answers[1] ?? null,
      });
      trackSignUpSucceeded("applicant");
      trackOnboardingCompleted("applicant");
      // Link this backend user ID to their RevenueCat customer record.
      rcIdentifyUser(String(data.user_id));

      // Load profile data into local store
      await loadFromProfile({
        firstName: applicantData.firstName,
        lastName: applicantData.lastName,
        email: applicantData.email,
        profileData: {
          targetIndustry: answers[0],
          currentRole: answers[1],
          seekingPosition: answers[2],
          skills: selectedSkills,
          insights: selectedInsights,
          workPreferences: selectedWorkPreferences,
          resumeUrl: undefined, // Uploaded separately
        },
      });

      // Clear onboarding data
      clearOnboardingData();

      // Fire resume upload in the background — don't block the success flow
      if (selectedFileAsset) {
        const form = new FormData();
        // Backend endpoint POST /api/upload-and-parse/ expects field name "file"
        // (same as ProfileView's upload flow — NOT "resume")
        form.append("file", {
          uri: selectedFileAsset.uri,
          name: selectedFileAsset.name,
          type: selectedFileAsset.mimeType,
        } as any);
        trackResumeUploaded({
          source: "questionnaire",
          fileSizeBytes: selectedFileAsset.size,
        });
        uploadAndParseResume(form)
          .then(() => classifyResume())
          .then(() => {
            // Refresh the store so AI-populated fields (experiences, education,
            // skills, etc.) are available in "Edit Resume Information" without
            // requiring the user to re-open the app.
            return fetchFromBackend();
          })
          .catch((err) =>
            console.warn(
              "[Questionnaire] Background resume upload failed:",
              err,
            ),
          );
      }

      // Show success modal
      setShowSuccess(true);

      // Navigate to dashboard after 2.2 seconds
      setTimeout(() => {
        setIsSubmitting(false);
        onComplete();
        // Delay toast until after the navigation transition finishes.
        // Backend now sends a verification email automatically on register
        // (PR #38, 2026-04-30). Verification is not enforced — we just
        // surface it so users know to check their inbox.
        setTimeout(() => {
          showToast(
            "Welcome! We sent a verification email — check your inbox.",
            "success",
          );
        }, 500);
      }, 2200);
    },
    onError: (error: Error) => {
      console.warn("[ApplicantQuestionnaire] Registration failed:", error);
      setIsSubmitting(false);
      trackSignUpFailed("applicant", error.message || "unknown");

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

  const filteredSkills = useMemo(() => {
    const selectedIndustry = answers[0] || "Other";
    const industrySkills =
      SKILLS_BY_INDUSTRY[selectedIndustry] || SKILLS_BY_INDUSTRY.Other;
    return industrySkills
      .filter((skill) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => a.localeCompare(b));
  }, [searchQuery, answers]);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    // Trigger the mutation which calls the real API
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

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else if (selectedSkills.length < 5) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType || "application/pdf",
          size: asset.size || 0,
        });
        setSelectedFile(asset.name);
        setAnswers({ ...answers, [currentQuestion]: asset.uri });
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;

  // UPDATED LOGIC: Allow 1-5 skills, require text input, and require 2-3 insights
  const isSkillsScreen = question.type === "skills";
  const isTextScreen = question.type === "text";
  const isInsightsScreen = question.type === "insights";
  const isWorkPreferencesScreen = question.type === "workPreferences";
  const canContinue = isSkillsScreen
    ? selectedSkills.length > 0 && selectedSkills.length <= 5
    : isTextScreen
      ? answers[currentQuestion]?.trim().length > 0
      : isInsightsScreen
        ? selectedInsights.length >= 2 &&
          selectedInsights.length <= 3 &&
          selectedInsights.every((i) => i.answer.trim().length > 0)
        : isWorkPreferencesScreen
          ? true // Optional — no minimum required
          : true;

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
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Animated.View
                key={currentQuestion}
                entering={FadeInDown.duration(500)}
              >
                <Text style={styles.questionText}>{question.question}</Text>

                {question.type === "select" && (
                  <View style={styles.optionsContainer}>
                    {question.options?.map((option) => {
                      const isSelected = answers[currentQuestion] === option;
                      const isEnabled = option === "Technology";
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() =>
                            isEnabled &&
                            setAnswers({
                              ...answers,
                              [currentQuestion]: option,
                            })
                          }
                          activeOpacity={isEnabled ? 0.7 : 1}
                          style={[
                            styles.optionCard,
                            isSelected && styles.optionCardSelected,
                            !isEnabled && styles.optionCardDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.textWhite,
                              !isEnabled && styles.optionTextDisabled,
                            ]}
                          >
                            {option}
                          </Text>
                          {isSelected ? (
                            <Check color={Color.paper} size={18} strokeWidth={2.2} />
                          ) : (
                            <ChevronRight
                              color={isEnabled ? Color.muted : Color.faint}
                              size={16}
                              strokeWidth={2}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.comingSoonNote}>
                      We're starting with tech — other industries are coming
                      soon.
                    </Text>
                  </View>
                )}

                {question.type === "text" && (
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder={question.placeholder}
                      placeholderTextColor={Color.faint}
                      value={answers[currentQuestion] || ""}
                      onChangeText={(v) =>
                        setAnswers({ ...answers, [currentQuestion]: v })
                      }
                      style={styles.textInput}
                      autoFocus
                    />
                  </View>
                )}

                {question.type === "skills" && (
                  <View>
                    <View style={styles.searchWrapper}>
                      <Search
                        color={Color.muted}
                        size={18}
                        strokeWidth={2}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        placeholder="Search skills..."
                        placeholderTextColor={Color.faint}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                      />
                    </View>
                    <View style={styles.skillsGrid}>
                      {filteredSkills.map((skill) => {
                        const isSelected = selectedSkills.includes(skill);
                        return (
                          <TouchableOpacity
                            key={skill}
                            onPress={() => toggleSkill(skill)}
                            style={[
                              styles.skillItem,
                              isSelected && styles.skillItemSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.skillText,
                                isSelected && styles.textWhite,
                              ]}
                            >
                              {skill}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.selectionCount}>
                      {selectedSkills.length} of 5 selected
                    </Text>
                  </View>
                )}

                {question.type === "insights" && (
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
                          cardYPositions.current[index] =
                            e.nativeEvent.layout.y;
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
                            // Multiline TextInputs treat Return as a newline by
                            // default. Treat it as "done" instead: dismiss the
                            // keyboard and drop the newline char from the value.
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
                        onPress={() =>
                          setShowQuestionPicker(!showQuestionPicker)
                        }
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
                        <Text style={styles.pickerTitle}>
                          Choose a question
                        </Text>
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
                              <Plus
                                size={16}
                                color={Color.muted}
                                strokeWidth={2}
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </Animated.View>
                    )}

                    <Text style={styles.insightsHelper}>
                      These help sponsors get to know the real you beyond
                      your resume.
                    </Text>
                  </View>
                )}

                {question.type === "workPreferences" && (
                  <View>
                    {question.subtitle && (
                      <Text style={styles.insightsSubtitle}>
                        {question.subtitle}
                      </Text>
                    )}
                    <View style={styles.skillsGrid}>
                      {WORK_PREFERENCE_OPTIONS.map((option) => {
                        const isSelected =
                          selectedWorkPreferences.includes(option);
                        return (
                          <TouchableOpacity
                            key={option}
                            onPress={() => {
                              setSelectedWorkPreferences(
                                isSelected
                                  ? selectedWorkPreferences.filter(
                                      (p) => p !== option,
                                    )
                                  : [...selectedWorkPreferences, option],
                              );
                            }}
                            style={[
                              styles.skillItem,
                              isSelected && styles.skillItemSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.skillText,
                                isSelected && styles.textWhite,
                              ]}
                            >
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.selectionCount}>
                      {selectedWorkPreferences.length} selected
                    </Text>
                  </View>
                )}

                {question.type === "file" && (
                  <>
                    {!selectedFileAsset ? (
                      <TouchableOpacity
                        onPress={handleFilePick}
                        style={styles.fileContainer}
                        activeOpacity={0.75}
                      >
                        <View style={styles.fileUploadIconWrap}>
                          <Upload color={Color.ink} size={26} strokeWidth={1.6} />
                        </View>
                        <Text style={styles.fileTitle}>
                          Tap to upload your resume
                        </Text>
                        <Text style={styles.fileSubtitle}>
                          PDF or Word · Max 10 MB
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Animated.View entering={FadeInDown.duration(400)}>
                        <View style={styles.fileConfirmCard}>
                          <View style={styles.fileIconCircle}>
                            <FileText
                              color={Color.paper}
                              size={22}
                              strokeWidth={1.5}
                            />
                          </View>
                          <View style={styles.fileConfirmInfo}>
                            <Text
                              style={styles.fileConfirmName}
                              numberOfLines={2}
                              ellipsizeMode="middle"
                            >
                              {selectedFileAsset.name}
                            </Text>
                            <Text style={styles.fileConfirmMeta}>
                              {selectedFileAsset.size > 0
                                ? (selectedFileAsset.size < 1024 * 1024
                                    ? `${(selectedFileAsset.size / 1024).toFixed(0)} KB`
                                    : `${(selectedFileAsset.size / (1024 * 1024)).toFixed(1)} MB`) +
                                  " · "
                                : ""}
                              {selectedFileAsset.mimeType?.includes("pdf")
                                ? "PDF"
                                : "Word Document"}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.fileRemoveBtn}
                            onPress={() => {
                              setSelectedFileAsset(null);
                              setSelectedFile(null);
                              setAnswers({
                                ...answers,
                                [currentQuestion]: undefined,
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <X size={14} color={Color.muted} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.fileReadyRow}>
                          <View style={styles.fileReadyCheck}>
                            <Check size={11} color={Color.paper} strokeWidth={3} />
                          </View>
                          <Text style={styles.fileReadyText}>
                            Ready to submit
                          </Text>
                          <TouchableOpacity
                            onPress={handleFilePick}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.fileChangeLink}>
                              Change file
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    )}
                  </>
                )}
              </Animated.View>
            </View>
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
                You're in.
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(600)}
                style={styles.successSub}
              >
                Welcome to BackChannel.
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
  keyboardView: { flex: 1 },

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
  content: { flex: 1 },
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
  optionCardDisabled: {
    backgroundColor: Color.surface,
    borderColor: Color.border,
  },
  optionText: {
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  optionTextDisabled: { color: Color.faint },
  comingSoonNote: {
    marginTop: Space.md,
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.muted,
    textAlign: "center",
    lineHeight: 19,
  },

  // ── Single-line text input ────────────────────────────────────────
  inputWrapper: {
    backgroundColor: Color.paper,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "center",
  },
  textInput: {
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    padding: 0,
  },

  // ── Resume upload ─────────────────────────────────────────────────
  fileContainer: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Color.borderStrong,
    borderRadius: Radius.xl,
    paddingVertical: Space.xxxl,
    paddingHorizontal: Space.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.paper,
  },
  fileUploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.md,
  },
  fileTitle: {
    fontFamily: Type.sans600,
    fontSize: 15,
    color: Color.ink,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  fileSubtitle: {
    fontFamily: Type.sans400,
    fontSize: 13,
    color: Color.muted,
    textAlign: "center",
  },
  fileConfirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Color.border,
  },
  fileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Color.ink,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fileConfirmInfo: { flex: 1, gap: 2 },
  fileConfirmName: {
    fontFamily: Type.sans600,
    fontSize: 14,
    color: Color.ink,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  fileConfirmMeta: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.muted,
  },
  fileRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fileReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
    paddingHorizontal: 2,
  },
  fileReadyCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Color.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  fileReadyText: {
    flex: 1,
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.ink,
  },
  fileChangeLink: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
    textDecorationLine: "underline",
  },

  // ── Skills search + grid ──────────────────────────────────────────
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Color.paper,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Color.border,
    marginBottom: Space.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: Type.sans500,
    fontSize: 15,
    color: Color.ink,
    padding: 0,
  },
  skillsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.borderStrong,
    marginBottom: 4,
  },
  skillItemSelected: {
    backgroundColor: Color.ink,
    borderColor: Color.ink,
  },
  skillText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  selectionCount: {
    marginTop: Space.xl,
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
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
  textBold: { fontFamily: Type.sans600 },

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
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.xl,
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
