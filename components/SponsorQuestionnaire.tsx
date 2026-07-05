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
  UserCheck,
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
import {
  SPONSOR_PROMPT_CATEGORIES,
  SPONSOR_PROMPT_EXAMPLES,
} from "@/constants/prompts";
import { CompanyAutocomplete } from "./ui/CompanyAutocomplete";
import { PromptsIntake } from "./ui/PromptsIntake";

interface SponsorQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
  /**
   * Called when registration fails because the email is already registered.
   * Sends the user to a Sign In screen (pre-filled with what they typed)
   * instead of leaving them stranded on the last question of a 10-question
   * flow with nothing but a toast.
   */
  onEmailAlreadyRegistered: () => void;
}

// Upper bound on how long we'll block onboarding applying the photo + bio
// after registration before proceeding anyway. Uploads must never trap a new
// user on the success spinner, so we race them against this timeout.
const PROCESS_TIMEOUT_MS = 25000;

// AsyncStorage key for the in-progress sponsor questionnaire, so a killed app
// mid-signup doesn't lose their answers. Stores typed content + step only —
// never the password (security) and never the picked photo URI (temp path).
const SPONSOR_DRAFT_KEY = "onboarding_draft_sponsor_v1";

/** Resolve when `promise` settles, or reject once `ms` elapses. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

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
    subtitle:
      "Answer 2 prompts so candidates get a feel for how you work.",
  },
  {
    id: 8,
    question: "Verify your employment",
    type: "email",
    placeholder: "name@company.com",
    subtitle: "Optional — you can add and verify this later from your profile.",
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
  onEmailAlreadyRegistered,
}: SponsorQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Insights state (prompts). The prompt library + editor live in PromptsIntake.
  const [selectedInsights, setSelectedInsights] = useState<
    Array<{ question: string; answer: string }>
  >([]);

  // Photo + bio (added to the sponsor flow so their applicant-facing card
  // isn't bare). The photo URI is uploaded after registration (the upload
  // endpoint needs auth); the bio is pre-drafted client-side from the
  // company/title/tenure answers so the sponsor edits instead of starts blank.
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [bioText, setBioText] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);

  const sponsorData = useOnboardingStore((state) => state.sponsorData);
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  // ── Resumable onboarding (autosave) ──────────────────────────────────────
  // `hydratedRef` gates the save effect so it can't clobber a stored draft with
  // the initial empty state before the restore has run.
  const hydratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SPONSOR_DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.answers) setAnswers(d.answers);
          if (Array.isArray(d.selectedInsights))
            setSelectedInsights(d.selectedInsights);
          if (typeof d.bioText === "string") setBioText(d.bioText);
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
    const draft = { answers, selectedInsights, bioText, currentQuestion };
    AsyncStorage.setItem(SPONSOR_DRAFT_KEY, JSON.stringify(draft)).catch(
      () => {},
    );
  }, [answers, selectedInsights, bioText, currentQuestion]);

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

      // Clear onboarding data + the saved draft (stop autosaving first).
      clearOnboardingData();
      hydratedRef.current = false;
      AsyncStorage.removeItem(SPONSOR_DRAFT_KEY).catch(() => {});

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
          "This email is already registered — taking you to Sign In.",
          "error",
        );
        // Sponsor registration happens on the LAST question, so without this
        // the user would be stranded on a finished 10-question flow with
        // nothing but a toast and no way forward.
        onEmailAlreadyRegistered();
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
  const isEmailScreen = question.type === "email";
  const canContinue = isInsightsScreen
    ? selectedInsights.length >= 2 &&
      selectedInsights.length <= 3 &&
      selectedInsights.every((i) => i.answer.trim().length > 0)
    : isPhotoScreen
      ? !!selectedPhotoUri // Required — has a "Skip for now" escape hatch below
      : isBioScreen
        ? bioText.trim().length > 0
        : isEmailScreen
          ? true // Optional — blank is allowed; handleNext validates a typed value
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
                <PromptsIntake
                  value={selectedInsights}
                  onChange={setSelectedInsights}
                  categories={SPONSOR_PROMPT_CATEGORIES}
                  examples={SPONSOR_PROMPT_EXAMPLES}
                  min={2}
                  max={3}
                  subtitle={question.subtitle}
                />
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
                <View>
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
                  {!!question.subtitle && (
                    <Text style={styles.companyHelper}>{question.subtitle}</Text>
                  )}
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
    // #767676 is the minimum gray that passes WCAG AA contrast (4.5:1) on
    // white — #BBB (~2.3:1) failed for text conveying real progress state.
    color: "#767676",
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
