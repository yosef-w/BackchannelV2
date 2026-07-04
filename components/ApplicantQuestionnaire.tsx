import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
  useAnimatedStyle,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { GOOGLE_PLACES_API_KEY } from "../constants/config";
import { SKILLS_BY_INDUSTRY } from "../constants/skills";
import { PlacesAutocomplete } from "./ui/PlacesAutocomplete";
import {
  identifyUser,
  trackOnboardingCompleted,
  trackResumeUploaded,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "../lib/analytics/mixpanel";
import { HOME_INTRO_PENDING_KEY } from "./ui/HomeIntro";
import {
  classifyResume,
  updateGeneralProfile,
  uploadAndParseResume,
  uploadProfileImage,
} from "../lib/api";
import { authApi } from "../lib/auth-api";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useSubscriptionStore } from "../stores/useSubscriptionStore";
import { useToastStore } from "../stores/useToastStore";
import {
  EducationEntry,
  ProfessionalExperience,
  useUserProfileStore,
} from "../stores/useUserProfileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Upper bound on how long we'll block onboarding waiting for the resume to be
// parsed + AI-classified before proceeding anyway. The classify step is an AI
// call and can occasionally be slow; a new user must never be trapped on a
// spinner, so we race it against this timeout and finish gracefully either way.
const RESUME_PROCESS_TIMEOUT_MS = 25000;

// AsyncStorage key for the in-progress applicant questionnaire, so a user who
// backgrounds/kills the app mid-signup doesn't lose their answers. We store
// ONLY the typed content + step — never the password (security) and never the
// picked photo URI (a temp cache path that won't survive a relaunch).
const APPLICANT_DRAFT_KEY = "onboarding_draft_applicant_v1";

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

// Per-prompt example answers, shown as the input placeholder so the box is
// never blank — a concrete starting point cuts the "what do I write?" friction.
// (These are examples, not pre-filled text, so nobody submits the sample.)
const INSIGHT_EXAMPLES: Record<string, string> = {
  "MY SECRET SUPERPOWER": "e.g., Turning fuzzy ideas into a shippable plan",
  "I'M BEST KNOWN FOR": "e.g., Being the calm one when a launch is on fire",
  "IF I WASN'T IN TECH": "e.g., I'd be running a small coffee roastery",
  "MY FAVORITE BRAINSTORMING FUEL": "e.g., A whiteboard and way too much coffee",
  "WHAT I LOOK FOR IN A TEAM": "e.g., People who disagree kindly and ship fast",
  "ONE THING THAT SURPRISED ME": "e.g., How much of the job is good writing",
  "THE PROJECT I'M MOST PROUD OF": "e.g., Rebuilt onboarding, cut drop-off 40%",
  "MY DESIGN PHILOSOPHY": "e.g., Make the right thing the easy thing",
  "WHAT ENERGIZES ME": "e.g., Untangling a messy problem into something simple",
  "MY UNPOPULAR OPINION": "e.g., Most meetings should have been a doc",
  "THE BEST ADVICE I'VE RECEIVED": "e.g., Strong opinions, loosely held",
  "HOW I RECHARGE": "e.g., A long trail run with no podcast",
  "WHAT I'M LEARNING RIGHT NOW": "e.g., Getting fluent with Rust on weekends",
  "MY WORK STYLE": "e.g., Deep-focus mornings, collaborative afternoons",
  "WHY I CHOSE THIS CAREER": "e.g., I like building things people actually use",
};

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
    subtitle: "Answer at least one prompt — add up to 3 if you're inspired",
  },
  {
    id: 6,
    question: "What are your work preferences?",
    type: "workPreferences",
    subtitle: "Select all that apply",
  },
  {
    id: 7,
    question: "Add a profile photo",
    type: "photo",
    subtitle: "Sponsors see this first — a clear headshot goes a long way",
  },
  {
    id: 8,
    question: "Where are you based?",
    type: "location",
    subtitle: "Used to surface roles near you",
  },
  { id: 9, question: "Upload your professional resume", type: "file" },
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
  // Phase 2 — resume review. After the resume is parsed + AI-classified we show
  // the user what we extracted (a confirmation moment) instead of filling the
  // profile invisibly. Null until we have something worth reviewing.
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState<{
    experiences: ProfessionalExperience[];
    education: EducationEntry[];
    skills: string[];
  } | null>(null);
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

  // Phase 3 — photo + location collected in onboarding so applicants land at
  // the swipe gate already complete (both are required by the gate but neither
  // signup nor the resume reliably provides them). The photo URI is uploaded
  // after registration (the upload endpoint needs auth), the same deferral
  // pattern the resume uses.
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("");
  // Falls back to a plain text field if Google Places isn't configured/available
  // or the user chooses to type it in manually.
  const [locationManual, setLocationManual] = useState(false);

  const applicantData = useOnboardingStore((state) => state.applicantData);
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  // Final exit from onboarding → dashboard. Shared by the no-resume path, the
  // resume-processing fallbacks, and the review screen's confirm button.
  const completeOnboarding = () => {
    // Onboarding finished — stop autosaving and discard the saved draft.
    hydratedRef.current = false;
    AsyncStorage.removeItem(APPLICANT_DRAFT_KEY).catch(() => {});
    setIsSubmitting(false);
    onComplete();
    // Backend sends a verification email automatically on register (PR #38).
    // Verification isn't enforced — we just surface it, after the transition.
    setTimeout(() => {
      showToast(
        "Welcome! We sent a verification email — check your inbox and spam folder.",
        "success",
      );
    }, 500);
  };

  const handleReviewConfirm = () => {
    setShowReview(false);
    completeOnboarding();
  };

  // Pick a profile photo from the library. Kept local (URI only) until after
  // registration, when it's uploaded — the upload endpoint requires auth.
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

  // Initials for the photo-step placeholder — a friendlier default than a bare
  // camera icon, built from the name captured on the auth screen.
  const initials =
    `${applicantData.firstName?.[0] ?? ""}${applicantData.lastName?.[0] ?? ""}`
      .toUpperCase()
      .trim();

  // ── Resumable onboarding (autosave) ──────────────────────────────────────
  // `hydrated` gates the save effect so it can't clobber a stored draft with
  // the initial empty state before the restore has run.
  const hydratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APPLICANT_DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.answers) setAnswers(d.answers);
          if (Array.isArray(d.selectedSkills)) setSelectedSkills(d.selectedSkills);
          if (Array.isArray(d.selectedInsights))
            setSelectedInsights(d.selectedInsights);
          if (Array.isArray(d.selectedWorkPreferences))
            setSelectedWorkPreferences(d.selectedWorkPreferences);
          if (typeof d.locationText === "string") setLocationText(d.locationText);
          if (typeof d.currentQuestion === "number")
            setCurrentQuestion(d.currentQuestion);
        }
      } catch {
        // Ignore a corrupt/absent draft — just start fresh.
      } finally {
        hydratedRef.current = true;
      }
    })();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const draft = {
      answers,
      selectedSkills,
      selectedInsights,
      selectedWorkPreferences,
      locationText,
      currentQuestion,
    };
    AsyncStorage.setItem(APPLICANT_DRAFT_KEY, JSON.stringify(draft)).catch(
      () => {},
    );
  }, [
    answers,
    selectedSkills,
    selectedInsights,
    selectedWorkPreferences,
    locationText,
    currentQuestion,
  ]);

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
      // Show the first-run Home intro once on their first Home view.
      AsyncStorage.setItem(HOME_INTRO_PENDING_KEY, "1").catch(() => {});
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

      // Show the "Profile Created" screen right away. It doubles as the loading
      // beat while we read the resume, so the AI latency is masked behind a
      // moment the user already expects.
      setShowSuccess(true);

      // Apply the photo + location captured during onboarding (both required
      // gate fields). The photo upload endpoint needs auth, so it runs here
      // after registration — the same deferral the resume uses. Best-effort and
      // bounded: a failure/timeout must never trap the user; they can re-add in
      // their profile. The subsequent fetchFromBackend pulls these into the
      // local store so the swipe gate sees a complete profile.
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
            if (locationText.trim()) {
              await updateGeneralProfile({ location: locationText.trim() });
            }
          })(),
          RESUME_PROCESS_TIMEOUT_MS,
        );
      } catch (err) {
        console.warn("[Questionnaire] Photo/location save failed:", err);
      }

      if (selectedFileAsset) {
        // Parse + AI-classify the resume, then SHOW the user what we extracted
        // (Phase 2) instead of filling their profile invisibly. Bounded by a
        // timeout so a slow classify never traps them on the spinner.
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
        try {
          await withTimeout(
            uploadAndParseResume(form)
              .then(() => classifyResume())
              .then(() => fetchFromBackend()),
            RESUME_PROCESS_TIMEOUT_MS,
          );

          // Read the freshly classified profile from the store.
          const data = useUserProfileStore.getState().data;
          const experiences = (data.professional.experiences || []).filter(
            (e) => e.jobTitle?.trim() || e.company?.trim(),
          );
          const education = (data.education.entries || []).filter(
            (e) => e.degree?.trim() || e.university?.trim(),
          );
          const skills = data.skills || [];

          if (experiences.length || education.length || skills.length) {
            // Hand off to the review screen; onboarding finishes when the user
            // confirms there (see handleReviewConfirm).
            setReviewData({ experiences, education, skills });
            setShowSuccess(false);
            setShowReview(true);
            setIsSubmitting(false);
            return;
          }
          // Nothing usable came back (e.g. an image-only/unparseable resume) —
          // just continue; they can add details in their profile.
        } catch (err) {
          console.warn("[Questionnaire] Resume processing failed:", err);
          showToast(
            "We couldn't read your resume automatically — you can add your details in your profile.",
            "info",
          );
        }
        completeOnboarding();
      } else {
        // No resume uploaded — still refresh so the photo/location we just
        // saved land in the local store for the swipe gate, then continue.
        try {
          await fetchFromBackend();
        } catch (err) {
          console.warn("[Questionnaire] Post-signup profile refresh failed:", err);
        }
        completeOnboarding();
      }
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
        type: ["application/pdf"],
        copyToCacheDirectory: true,
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
  const isPhotoScreen = question.type === "photo";
  const isLocationScreen = question.type === "location";
  const canContinue = isSkillsScreen
    ? selectedSkills.length > 0 && selectedSkills.length <= 5
    : isTextScreen
      ? answers[currentQuestion]?.trim().length > 0
      : isInsightsScreen
        ? // Lowered from 2 to 1 — writing multiple answers is the heaviest
          // step in signup; one is enough to add personality, more is optional.
          selectedInsights.length >= 1 &&
          selectedInsights.length <= 3 &&
          selectedInsights.every((i) => i.answer.trim().length > 0)
        : isWorkPreferencesScreen
          ? true // Optional — no minimum required
          : isPhotoScreen
            ? !!selectedPhotoUri // Required — photo is a gate field
            : isLocationScreen
              ? locationText.trim().length > 0 // Required — gate field
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
                            <Check color="#FFF" size={20} />
                          ) : (
                            <ChevronRight
                              color={isEnabled ? "#CCC" : "#E0E0E0"}
                              size={18}
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
                      placeholderTextColor="#BBB"
                      value={answers[currentQuestion] || ""}
                      onChangeText={(v) =>
                        setAnswers({ ...answers, [currentQuestion]: v })
                      }
                      style={styles.textInput}
                      autoCapitalize="words"
                      autoFocus
                    />
                  </View>
                )}

                {question.type === "skills" && (
                  <View>
                    <View style={styles.searchWrapper}>
                      <Search
                        color="#AAA"
                        size={20}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        placeholder="Search skills..."
                        placeholderTextColor="#BBB"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
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
                        onPress={() =>
                          setShowQuestionPicker(!showQuestionPicker)
                        }
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
                              <Plus size={18} color="#000" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </Animated.View>
                    )}

                    <Text style={styles.insightsHelper}>
                      💡 These help sponsors get to know the real you beyond
                      your resume
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

                {question.type === "photo" && (
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
                        // Friendlier default than a bare icon — their initials.
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
                    {/* Escape hatch so a denied photo-library permission can't
                        trap the user. The swipe gate still requires a photo, so
                        skippers are simply prompted again there. */}
                    {!selectedPhotoUri && (
                      <TouchableOpacity
                        onPress={handleNext}
                        style={styles.photoSkipBtn}
                      >
                        <Text style={styles.photoSkipText}>Skip for now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {question.type === "location" && (
                  <View style={styles.inputContainer}>
                    {GOOGLE_PLACES_API_KEY && !locationManual ? (
                      // Google Places (city mode) so the stored location is a
                      // standardized "City, State" — no "SF" vs "San Francisco"
                      // vs "San Fran" fragmentation across the matching data.
                      <PlacesAutocomplete
                        mode="city"
                        autoFocus
                        placeholder="e.g., San Francisco"
                        initialValue={locationText}
                        inputStyle={styles.locationInput}
                        onSelect={(addr) => {
                          const combined = [addr.city, addr.state]
                            .filter(Boolean)
                            .join(", ");
                          setLocationText(combined || addr.city);
                        }}
                        onError={(m) => showToast(m, "error")}
                        onSwitchToManual={() => setLocationManual(true)}
                      />
                    ) : (
                      <View style={styles.locationInputWrap}>
                        <MapPin color="#BBB" size={20} />
                        <TextInput
                          placeholder="e.g., San Francisco, CA"
                          placeholderTextColor="#BBB"
                          value={locationText}
                          onChangeText={setLocationText}
                          autoCapitalize="words"
                          autoFocus
                          style={styles.locationInput}
                          returnKeyType="done"
                          onSubmitEditing={() => canContinue && handleNext()}
                        />
                      </View>
                    )}
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
                          <Upload color="#000" size={28} strokeWidth={2} />
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
                              color="#FFF"
                              size={26}
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
                            <X size={16} color="#666" strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.fileReadyRow}>
                          <View style={styles.fileReadyCheck}>
                            <Check size={12} color="#FFF" strokeWidth={3} />
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
                Profile Created
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(600)}
                style={styles.successSub}
              >
                {selectedFileAsset
                  ? "Building your profile from your resume…"
                  : "Welcome to BackChannel"}
              </Animated.Text>
              {selectedFileAsset && (
                <Animated.View
                  entering={FadeIn.delay(800)}
                  style={styles.successSpinner}
                >
                  <ActivityIndicator color="#000" />
                </Animated.View>
              )}
            </View>
          </BlurView>
        </Animated.View>
      )}

      {showReview && reviewData && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill}>
            <SafeAreaView style={styles.reviewSafeArea}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewBadge}>
                  <Sparkles color="#000" size={22} />
                </View>
                <Text style={styles.reviewTitle}>Here&apos;s what we found</Text>
                <Text style={styles.reviewSub}>
                  We built your profile straight from your resume. Give it a
                  quick look — you can fine-tune anything later.
                </Text>
              </View>

              <ScrollView
                contentContainerStyle={styles.reviewScroll}
                showsVerticalScrollIndicator={false}
              >
                {reviewData.experiences.length > 0 && (
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionLabel}>
                      WORK EXPERIENCE · {reviewData.experiences.length}
                    </Text>
                    {reviewData.experiences.map((exp, i) => (
                      <View key={exp.id || `exp-${i}`} style={styles.reviewCard}>
                        <Text style={styles.reviewCardTitle}>
                          {exp.jobTitle || "Role"}
                        </Text>
                        <Text style={styles.reviewCardSub}>
                          {[
                            exp.company,
                            [
                              exp.startDate,
                              exp.current ? "Present" : exp.endDate,
                            ]
                              .filter(Boolean)
                              .join(" – "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {reviewData.education.length > 0 && (
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionLabel}>
                      EDUCATION · {reviewData.education.length}
                    </Text>
                    {reviewData.education.map((edu, i) => (
                      <View key={edu.id || `edu-${i}`} style={styles.reviewCard}>
                        <Text style={styles.reviewCardTitle}>
                          {[edu.degree, edu.major].filter(Boolean).join(", ") ||
                            edu.university ||
                            "Education"}
                        </Text>
                        <Text style={styles.reviewCardSub}>
                          {[edu.university, edu.graduationYear]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {reviewData.skills.length > 0 && (
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionLabel}>
                      SKILLS · {reviewData.skills.length}
                    </Text>
                    <View style={styles.reviewChips}>
                      {reviewData.skills.map((skill, i) => (
                        <View key={`skill-${i}`} style={styles.reviewChip}>
                          <Text style={styles.reviewChipText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.reviewFooter}>
                <TouchableOpacity
                  style={styles.reviewPrimaryBtn}
                  onPress={handleReviewConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reviewPrimaryText}>
                    Looks good — start swiping
                  </Text>
                  <ArrowRight color="#FFF" size={20} />
                </TouchableOpacity>
                <Text style={styles.reviewFootnote}>
                  You can edit every detail anytime in your profile.
                </Text>
              </View>
            </SafeAreaView>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
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
  content: { flex: 1 },
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
  optionCardDisabled: { backgroundColor: "#FAFAFA", borderColor: "#F0F0F0" },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  optionTextDisabled: { color: "#C8C8C8" },
  comingSoonNote: {
    marginTop: 12,
    fontSize: 13,
    color: "#AAAAAA",
    textAlign: "center",
    lineHeight: 18,
  },
  inputWrapper: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    height: 64,
    justifyContent: "center",
  },
  textInput: { fontSize: 18, color: "#000", fontWeight: "500" },
  fileContainer: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#DDD",
    borderRadius: 20,
    paddingVertical: 44,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  fileUploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  fileTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 6,
    textAlign: "center",
  },
  fileSubtitle: { fontSize: 13, color: "#AAA", textAlign: "center" },
  fileConfirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F9F9F9",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  fileIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fileConfirmInfo: { flex: 1, gap: 4 },
  fileConfirmName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    lineHeight: 20,
  },
  fileConfirmMeta: { fontSize: 13, color: "#999", fontWeight: "500" },
  fileRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFEFEF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fileReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 2,
  },
  fileReadyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  fileReadyText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#000" },
  fileChangeLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textDecorationLine: "underline",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 24,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#000", fontWeight: "500" },
  skillsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 4,
  },
  skillItemSelected: { backgroundColor: "#000" },
  skillText: { fontSize: 14, fontWeight: "600", color: "#000" },
  selectionCount: {
    marginTop: 24,
    fontSize: 14,
    color: "#BBB",
    fontWeight: "600",
    textAlign: "center",
  },
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
  textBold: { fontWeight: "700" },
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
  successSpinner: { marginTop: 24 },

  // ── Phase 3 photo + location steps ───────────────────────────────────────
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
  inputContainer: { paddingTop: 8 },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "#FFF",
  },
  locationInput: {
    flex: 1,
    fontSize: 18,
    color: "#000",
    paddingVertical: 14,
  },

  // ── Phase 2 resume-review screen ─────────────────────────────────────────
  reviewSafeArea: { flex: 1 },
  reviewHeader: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  reviewBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  reviewSub: {
    fontSize: 15,
    color: "#666",
    lineHeight: 21,
    marginTop: 10,
  },
  reviewScroll: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  reviewSection: { marginBottom: 28 },
  reviewSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 16,
    marginBottom: 10,
  },
  reviewCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  reviewCardSub: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  reviewChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reviewChip: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  reviewFooter: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  reviewPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 18,
  },
  reviewPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  reviewFootnote: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 12,
  },
});
