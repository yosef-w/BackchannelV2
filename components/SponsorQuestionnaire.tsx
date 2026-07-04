import {
  identifyUser,
  trackOnboardingCompleted,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "@/lib/analytics/mixpanel";
import { authApi } from "@/lib/auth-api";
import { updateGeneralProfile, uploadProfileImage } from "@/lib/api";
import { isValidEmail } from "@/lib/validation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { HOME_INTRO_PENDING_KEY } from "@/components/ui/HomeIntro";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Mail,
  Plus,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { CompanyAutocomplete } from "./ui/CompanyAutocomplete";

interface SponsorQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
}

// Upper bound on how long we'll block onboarding applying the photo + bio
// after registration before proceeding anyway. Uploads must never trap a new
// user on the success spinner, so we race them against this timeout.
const PROCESS_TIMEOUT_MS = 25000;

/** Resolve when `promise` settles, or reject once `ms` elapses. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
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

// Per-prompt example answers, shown as the input placeholder so the box is
// never blank — a concrete starting point cuts the "what do I write?" friction.
// (Examples, not pre-filled text, so nobody submits the sample.)
const INSIGHT_EXAMPLES: Record<string, string> = {
  "MY SECRET SUPERPOWER": "e.g., Spotting talent others overlook",
  "I'M BEST KNOWN FOR": "e.g., Opening doors for people early in their careers",
  "IF I WASN'T IN TECH": "e.g., I'd be coaching a college debate team",
  "MY FAVORITE BRAINSTORMING FUEL": "e.g., A long walk and a good question",
  "WHAT I LOOK FOR IN TALENT": "e.g., Curiosity and follow-through over pedigree",
  "ONE THING THAT SURPRISED ME": "e.g., The best hires rarely look best on paper",
  "THE PROJECT I'M MOST PROUD OF": "e.g., Mentored 5 juniors into senior roles",
  "MY MENTORSHIP STYLE": "e.g., Ask more than I tell, then get out of the way",
  "WHY I SPONSOR": "e.g., Someone took a chance on me — paying it forward",
  "WHAT ENERGIZES ME": "e.g., Watching someone level up faster than they expected",
  "MY UNPOPULAR OPINION": "e.g., Culture fit is overrated; culture add isn't",
  "THE BEST ADVICE I'VE RECEIVED": "e.g., Hire for slope, not intercept",
  "HOW I RECHARGE": "e.g., Weekends fully offline with family",
  "WHAT I'M LEARNING RIGHT NOW": "e.g., How to give feedback that actually lands",
  "MY LEADERSHIP PHILOSOPHY": "e.g., Set the bar, then clear the obstacles",
};

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
    subtitle: "Answer at least one — add up to 3 to help candidates know you",
  },
  {
    id: 8,
    question: "Verify your employment",
    type: "email",
    placeholder: "name@company.com",
  },
  {
    id: 9,
    question: "Add a profile photo",
    type: "photo",
    subtitle: "Candidates see this on your profile — a clear headshot builds trust",
  },
  {
    id: 10,
    question: "Write a short bio",
    type: "bio",
    subtitle: "We drafted one from your answers — edit it to sound like you",
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

  // Photo + bio (added to the sponsor flow so their applicant-facing card
  // isn't bare). The photo URI is uploaded after registration (the upload
  // endpoint needs auth); the bio is pre-drafted client-side from the
  // company/title/tenure answers so the sponsor edits instead of starts blank.
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [bioText, setBioText] = useState("");

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
      // Show the first-run Home intro once on their first Home view.
      AsyncStorage.setItem(HOME_INTRO_PENDING_KEY, "1").catch(() => {});
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

      // Apply the photo + bio captured during onboarding so the sponsor's
      // applicant-facing card isn't bare. Photo upload needs auth, so it runs
      // here after registration. Best-effort and bounded — a failure/timeout
      // must never trap the user; they can re-add these in their profile.
      try {
        await withTimeout(
          (async () => {
            if (selectedPhotoUri) {
              const photoForm = new FormData();
              photoForm.append("image", {
                uri: selectedPhotoUri,
                name: "photo.jpg",
                type: "image/jpeg",
              } as any);
              const { cdn_url } = await uploadProfileImage(photoForm);
              if (cdn_url) await updateGeneralProfile({ photo_url: cdn_url });
            }
            if (bioText.trim()) {
              await updateGeneralProfile({ bio: bioText.trim() });
            }
          })(),
          PROCESS_TIMEOUT_MS,
        );
      } catch (err) {
        console.warn("[SponsorQuestionnaire] Photo/bio save failed:", err);
      }

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
            "Welcome! We sent two verification emails (login + work) — check your inbox and spam folder.",
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

  // Compose a first-draft bio from what the sponsor already told us, so the
  // bio step starts populated instead of blank (the "no-resume" analog of the
  // applicant's resume autofill). Fully editable afterwards.
  const buildDraftBio = () => {
    const company = (answers[0] || "").trim();
    const title = (answers[1] || "").trim();
    const tenure = (answers[2] || "").trim();
    const openToRefer = (answers[3] || "").toLowerCase();
    const parts: string[] = [];
    if (title && company) parts.push(`${title} at ${company}.`);
    else if (company) parts.push(`Works at ${company}.`);
    else if (title) parts.push(`${title}.`);
    if (tenure) parts.push(`${tenure} at the company.`);
    if (openToRefer.includes("yes") || openToRefer.includes("absolut"))
      parts.push("Open to referring qualified candidates.");
    else if (openToRefer.includes("case"))
      parts.push("Open to referrals on a case-by-case basis.");
    return parts.join(" ");
  };

  // Pre-fill the bio the first time the sponsor lands on the bio step (only if
  // they haven't typed anything), so they see an editable draft, not a blank box.
  useEffect(() => {
    if (question.type === "bio" && !bioText.trim()) {
      setBioText(buildDraftBio());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  // Pick a profile photo. Kept local (URI) until after registration, when it's
  // uploaded — the upload endpoint requires auth.
  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(
        "Photo access is off — enable it in Settings to add a photo.",
        "info",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedPhotoUri(result.assets[0].uri);
    }
  };

  // Capture a photo with the camera (alternative to the library).
  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showToast(
        "Camera access is off — enable it in Settings to take a photo.",
        "info",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedPhotoUri(result.assets[0].uri);
    }
  };

  // Initials for the photo-step placeholder — a friendlier default than an icon.
  const initials =
    `${sponsorData.firstName?.[0] ?? ""}${sponsorData.lastName?.[0] ?? ""}`
      .toUpperCase()
      .trim();

  const handleNext = () => {
    // Validate the work-email step before advancing. Blank is allowed (they
    // can verify later via the in-app gate), but a typed value must be a real
    // email so the verification send doesn't silently fail.
    const current = questions[currentQuestion];
    if (current.type === "email") {
      const val = (answers[currentQuestion] || "").trim();
      if (val && !isValidEmail(val)) {
        showToast(
          "Enter a valid work email, or leave it blank to verify later.",
          "error",
        );
        return;
      }
    }
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
  const isPhotoScreen = question.type === "photo";
  const isBioScreen = question.type === "bio";
  const canContinue = isInsightsScreen
    ? // One prompt is enough — writing several is the heaviest signup step.
      selectedInsights.length >= 1 &&
      selectedInsights.length <= 3 &&
      selectedInsights.every((i) => i.answer.trim().length > 0)
    : isPhotoScreen
      ? !!selectedPhotoUri // Required — has a "Skip for now" escape hatch below
      : isBioScreen
        ? bioText.trim().length > 0
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
            <ArrowLeft color="#000" size={24} />
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>
            {currentQuestion + 1} of {questions.length}
            {currentQuestion === 0 ? " · about 2 min" : ""}
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
                          <Sparkles size={12} color="#000" />
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
                          <X size={16} color="#999" />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        placeholder={
                          INSIGHT_EXAMPLES[insight.question] ||
                          "Share your answer..."
                        }
                        placeholderTextColor="#BBB"
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
                        autoCapitalize="sentences"
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
                      <Plus size={20} color="#000" />
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
                            <Plus size={18} color="#000" />
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
              ) : currentQuestion === 0 ? (
                // Company question — autocomplete against real ATS
                // organizations so the stored company matches the job-browse
                // filter exactly (prevents misspelling / naming mismatches).
                // Free text is still allowed for companies not yet in the ATS.
                <View>
                  <CompanyAutocomplete
                    value={answers[currentQuestion] || ""}
                    onChangeText={(v) =>
                      setAnswers({ ...answers, [currentQuestion]: v })
                    }
                    onSelectOrganization={(org) =>
                      setAnswers({ ...answers, [currentQuestion]: org })
                    }
                    placeholder={question.placeholder}
                    autoFocus
                    inputWrapperStyle={styles.inputWrapper}
                    inputStyle={styles.textInput}
                  />
                  <Text style={styles.companyHelper}>
                    Pick your company from the list so we can match you to the
                    right job listings.
                  </Text>
                </View>
              ) : question.type === "photo" ? (
                <View style={styles.photoStep}>
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    activeOpacity={0.8}
                    style={styles.photoCircle}
                  >
                    {selectedPhotoUri ? (
                      <Image
                        source={{ uri: selectedPhotoUri }}
                        style={styles.photoImage}
                      />
                    ) : initials ? (
                      <Text style={styles.photoInitials}>{initials}</Text>
                    ) : (
                      <Camera color="#BBB" size={40} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.photoBtnRow}>
                    <TouchableOpacity
                      onPress={handlePickPhoto}
                      style={styles.photoPickBtn}
                    >
                      <Text style={styles.photoPickText}>
                        {selectedPhotoUri ? "Change photo" : "Choose photo"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleTakePhoto}
                      style={styles.photoPickBtn}
                    >
                      <Text style={styles.photoPickText}>Take photo</Text>
                    </TouchableOpacity>
                  </View>
                  {!selectedPhotoUri && (
                    <TouchableOpacity
                      onPress={handleNext}
                      style={styles.photoSkipBtn}
                    >
                      <Text style={styles.photoSkipText}>Skip for now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : question.type === "bio" ? (
                <View style={styles.bioWrapper}>
                  <TextInput
                    placeholder="A sentence or two about you"
                    placeholderTextColor="#BBB"
                    value={bioText}
                    onChangeText={setBioText}
                    style={styles.bioInput}
                    multiline
                    autoFocus
                    maxLength={300}
                  />
                </View>
              ) : question.type === "text" || question.type === "email" ? (
                <View style={styles.inputWrapper}>
                  {question.type === "email" && (
                    <Mail color="#AAA" size={20} style={{ marginRight: 12 }} />
                  )}
                  <TextInput
                    placeholder={question.placeholder}
                    placeholderTextColor="#BBB"
                    value={answers[currentQuestion] || ""}
                    onChangeText={(v) =>
                      setAnswers({ ...answers, [currentQuestion]: v })
                    }
                    style={styles.textInput}
                    autoFocus
                    keyboardType={
                      question.type === "email" ? "email-address" : "default"
                    }
                    autoCapitalize={
                      question.type === "email" ? "none" : "words"
                    }
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
                        {isSelected && <Check color="#FFF" size={20} />}
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
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {isLastQuestion ? "Complete Profile" : "Continue"}
                  </Text>
                  <ArrowRight color="#FFF" size={20} />
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
                <UserCheck color="#000" size={48} />
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
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
    fontSize: 14,
    fontWeight: "600",
    color: "#BBB",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressBarBg: { height: 2, backgroundColor: "#F0F0F0", width: "100%" },
  progressBar: { height: "100%", backgroundColor: "#000" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40 },
  questionText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 40,
  },
  optionsContainer: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  optionCardSelected: { backgroundColor: "#000", borderColor: "#000" },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    height: 64,
  },
  textInput: { flex: 1, fontSize: 18, color: "#000", fontWeight: "500" },
  companyHelper: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 4,
  },

  // Insights styles
  insightsSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    lineHeight: 24,
  },
  insightCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
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
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  insightQuestion: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
    flex: 1,
  },
  removeInsightBtn: { padding: 4 },
  insightAnswerInput: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#000",
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    fontWeight: "500",
  },
  charCount: { fontSize: 12, color: "#999", marginTop: 8, textAlign: "right" },
  addInsightBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#000",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  addInsightText: { fontSize: 15, fontWeight: "700", color: "#000" },
  questionPickerContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    maxHeight: 300,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  questionsList: { maxHeight: 240 },
  questionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  questionOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    flex: 1,
    letterSpacing: 0.3,
  },
  insightsHelper: {
    fontSize: 14,
    color: "#999",
    lineHeight: 20,
    marginTop: 8,
    fontStyle: "italic",
  },

  footer: { paddingHorizontal: 28, paddingBottom: 30, paddingTop: 20 },
  nextButton: {
    backgroundColor: "#000",
    height: 60,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  nextButtonDisabled: { opacity: 0.3 },
  nextButtonText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  textWhite: { color: "#FFF" },
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
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
  },
  successSub: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },

  // ── Photo + bio steps ────────────────────────────────────────────────────
  photoStep: { alignItems: "center", paddingTop: 8 },
  photoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  photoInitials: { fontSize: 52, fontWeight: "800", color: "#999" },
  photoBtnRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  photoPickBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  photoPickText: { fontSize: 16, fontWeight: "700", color: "#000" },
  photoSkipBtn: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 16 },
  photoSkipText: { fontSize: 14, fontWeight: "600", color: "#AAA" },
  bioWrapper: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bioInput: {
    fontSize: 18,
    color: "#000",
    fontWeight: "500",
    minHeight: 120,
    textAlignVertical: "top",
  },
});
