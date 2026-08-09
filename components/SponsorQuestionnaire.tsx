import {
  identifyUser,
  trackOnboardingCompleted,
  trackOnboardingStepViewed,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "@/lib/analytics/mixpanel";
import { authApi } from "@/lib/auth-api";
import {
  browseJobs,
  sponsorJob,
  updateGeneralProfile,
  uploadProfileImage,
} from "@/lib/api";
import { isValidEmail } from "@/lib/validation";
import { Colors, Fonts, Type } from "@/constants/theme";
import type { BrowseJobResponse } from "@/types/jobs";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "@/utils/onboardingDraft";
import { HOME_INTRO_PENDING_KEY } from "@/components/ui/HomeIntro";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  ChevronRight,
  Mail,
  UserCheck,
} from "@/components/ui/icons";
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

  // ── Sponsor cold-start fix ────────────────────────────────────────────────
  // A brand-new sponsor otherwise exits onboarding onto an empty "Build your
  // deck" quest with zero applicants until they separately go find and
  // sponsor a role in the Jobs tab. This can only happen AFTER registration
  // (not earlier in the flow, e.g. right after the company question) because
  // /api/jobs/browse/ requires auth and filters server-side by the sponsor's
  // now-saved COMPANY profile field — neither exists yet mid-questionnaire.
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [rolePickerStep, setRolePickerStep] = useState<"pick" | "details">(
    "pick",
  );
  const [roleOptions, setRoleOptions] = useState<BrowseJobResponse[]>([]);
  const [selectedRole, setSelectedRole] = useState<BrowseJobResponse | null>(
    null,
  );
  const [roleCanRefer, setRoleCanRefer] = useState<boolean | null>(null);
  const [roleInsiderNote, setRoleInsiderNote] = useState("");
  const [isSponsoringRole, setIsSponsoringRole] = useState(false);

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
  // Set by AuthScreen when this account was created via "Continue with
  // Apple/Google" and is still role-less — routes final submission to
  // completeSsoOnboarding() instead of createProfile(), since this user
  // already has tokens and no password.
  const ssoSession = useOnboardingStore((state) => state.ssoSession);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  // ── Resumable onboarding (autosave) ──────────────────────────────────────
  // `hydratedRef` gates the save effect so it can't clobber a stored draft with
  // the initial empty state before the restore has run.
  //
  // Drafts are identity-scoped (utils/onboardingDraft.ts): stamped with the
  // signup email from the AuthScreen and only restored for the SAME email —
  // an abandoned signup's draft no longer leaks into the next signup on
  // this device.
  const hydratedRef = useRef(false);
  // finishOnboarding() can run much later than afterAccountReady() — after
  // the cold-start role-picker interaction — by which point
  // clearOnboardingData() has already wiped ssoSession from the store and
  // this component has re-rendered with it null. A ref survives that gap;
  // a plain closure over the hook value would not.
  const wasSsoRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await loadOnboardingDraft<{
          answers?: typeof answers;
          selectedInsights?: typeof selectedInsights;
          bioText?: string;
          currentQuestion?: number;
        }>(SPONSOR_DRAFT_KEY, sponsorData.email);
        if (d) {
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
    // Run once on mount (the signup email is fixed before this screen mounts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveOnboardingDraft(SPONSOR_DRAFT_KEY, sponsorData.email, {
      answers,
      selectedInsights,
      bioText,
      currentQuestion,
    });
  }, [answers, selectedInsights, bioText, currentQuestion, sponsorData.email]);

  // Shared by createProfileMutation and completeSsoOnboardingMutation below
  // — everything downstream of "the account now has a role + profile row"
  // is identical regardless of which endpoint created it.
  const afterAccountReady = async (userId: string) => {
    wasSsoRef.current = !!ssoSession;

    // Identify the new sponsor for the rest of their session and stamp
    // basic profile attributes onto Mixpanel's People record. The work
    // email is collected here but `work_email_verified` is currently a
    // cosmetic flag (see BACKEND_CHANGES_NEEDED.md §1).
    identifyUser({
      userId,
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
    rcIdentifyUser(userId);

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
    clearOnboardingDraft(SPONSOR_DRAFT_KEY);

    // Sponsor cold-start fix — now that registration + auth are done, the
    // company-scoped browse endpoint actually works. If there are open
    // roles, offer to sponsor one right now instead of dropping the
    // sponsor onto an empty "Build your deck" quest. finishOnboarding()
    // (the rest of the pre-existing success flow) runs once this either
    // completes or is skipped, from the role-picker overlay's handlers.
    try {
      const response = await browseJobs({ limit: 10 });
      const jobs = response.jobs || [];
      if (jobs.length > 0) {
        setRoleOptions(jobs);
        setRolePickerStep("pick");
        setShowRolePicker(true);
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.warn(
        "[SponsorQuestionnaire] Failed to fetch roles for cold-start picker:",
        err,
      );
    }

    finishOnboarding();
  };

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

      await afterAccountReady(String(data.user_id));
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

  // SSO counterpart to createProfileMutation — fires for a user who already
  // authenticated via "Continue with Apple/Google" and just needs a role +
  // profile row attached. Sends the full questionnaire payload in one shot,
  // same as createProfile() does here (unlike the applicant flow, sponsor
  // registration was always a single end-of-flow call, not resume-first).
  const completeSsoOnboardingMutation = useMutation({
    mutationFn: async () => {
      return authApi.completeSsoOnboarding({
        // Capitalized per the backend's validation — it rejects anything
        // but exactly 'Applicant'/'Sponsor'.
        role: "Sponsor",
        // The SSO exchange usually stored the name already, but Apple only
        // sends it once ever — forward anything the flow captured.
        ...(sponsorData.firstName?.trim()
          ? { first_name: sponsorData.firstName.trim() }
          : {}),
        ...(sponsorData.lastName?.trim()
          ? { last_name: sponsorData.lastName.trim() }
          : {}),
        company: answers[0],
        job_title: answers[1],
        duration: answers[2],
        // Same select-answer → wire-format conversions createProfile()
        // applies for /api/register-sponsor/ — the backend treats this
        // endpoint's fields identically (booleans; financial_reward is the
        // literal string "yes"/"no", compared == 'yes' server-side).
        open_to_referrals: answers[3] === "Yes, absolutely",
        referral_experience: answers[4] === "Frequently",
        financial_reward: answers[5] === "Yes" ? "yes" : "no",
        insights: selectedInsights,
        work_email: answers[7],
      });
    },
    onSuccess: async () => {
      if (!ssoSession) return;
      await afterAccountReady(ssoSession.userId);
    },
    onError: (error: Error) => {
      console.warn(
        "[SponsorQuestionnaire] SSO onboarding completion failed:",
        error,
      );
      setIsSubmitting(false);
      trackSignUpFailed("sponsor", error.message || "unknown");
      showToast(`Couldn't finish setting up your account: ${error.message}`, "error");
    },
  });

  const handleFinalSubmit = () => {
    Keyboard.dismiss();
    setIsSubmitting(true);
    if (ssoSession) {
      completeSsoOnboardingMutation.mutate();
    } else {
      createProfileMutation.mutate();
    }
  };

  // The success animation + best-effort photo/bio save + work-email
  // verification send + delayed navigation. Previously ran unconditionally
  // right after registration; now called either immediately (no open roles
  // to offer) or after the role-picker overlay finishes/is skipped.
  const finishOnboarding = () => {
    setShowSuccess(true);

    // Apply the photo + bio captured during onboarding so the sponsor's
    // applicant-facing card isn't bare. Photo upload needs auth, so it runs
    // here after registration. Best-effort, IN THE BACKGROUND — nothing
    // downstream reads its result, and awaiting it before the navigation
    // timer used to hold new sponsors on the non-dismissible success screen
    // for up to 25s on a slow upload. If it fails, they can re-add both in
    // their profile.
    (async () => {
      try {
        await withTimeout(
          (async () => {
            // Each save also mirrors into the profile store. The store's
            // only fetch this session ran at registration — BEFORE these
            // values existed — and nothing refetches until the next app
            // launch, so without the mirror the profile view showed no
            // photo/bio all session. Worse: with the store's summary left
            // empty, editing ANY professional field later made the
            // autosave sync push bio:"" over the bio saved here,
            // silently erasing it server-side.
            if (selectedPhotoUri) {
              const photoForm = new FormData();
              photoForm.append("image", {
                uri: selectedPhotoUri,
                name: "photo.jpg",
                type: "image/jpeg",
                // RN FormData file descriptor — the web-typed lib.dom
                // signature doesn't know this shape; cast required.
              } as any);
              const { cdn_url } = await uploadProfileImage(photoForm);
              if (cdn_url) {
                await updateGeneralProfile({ photo_url: cdn_url });
                await useUserProfileStore
                  .getState()
                  .updatePersonal({ profileImage: cdn_url });
              }
            }
            if (bioText.trim()) {
              await updateGeneralProfile({ bio: bioText.trim() });
              await useUserProfileStore
                .getState()
                .updateProfessional({ summary: bioText.trim() });
            }
          })(),
          PROCESS_TIMEOUT_MS,
        );
      } catch (err) {
        console.warn("[SponsorQuestionnaire] Photo/bio save failed:", err);
      }
    })();

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

    // Navigate after a fixed, predictable 2.2s celebratory beat — the
    // success screen is a moment, not a loading state.
    setTimeout(() => {
      setIsSubmitting(false);
      onComplete();
      // Delay toast until after the navigation transition finishes. For a
      // password signup, two emails are in flight: the login-email
      // verification (PR #38) and the work-email one we just kicked off
      // (PR #42). An SSO signup only ever triggers the work-email one — the
      // provider already verified the login email.
      setTimeout(() => {
        showToast(
          wasSsoRef.current
            ? "Welcome! We sent a work email verification link — check your inbox and spam folder."
            : "Welcome! We sent two verification emails (login + work) — check your inbox and spam folder.",
          "success",
        );
      }, 500);
    }, 2200);
  };

  // ── Sponsor cold-start role picker handlers ─────────────────────────────
  const handleSkipRolePicker = () => {
    setShowRolePicker(false);
    finishOnboarding();
  };

  const handleSelectRole = (role: BrowseJobResponse) => {
    setSelectedRole(role);
    setRoleCanRefer(null);
    setRoleInsiderNote("");
    setRolePickerStep("details");
  };

  const handleSponsorSelectedRole = async () => {
    if (!selectedRole) return;
    setIsSponsoringRole(true);
    try {
      await sponsorJob(selectedRole.JOB_ID, {
        relationship: "Employee",
        canRefer: roleCanRefer ?? true,
        insights: roleInsiderNote.trim()
          ? { insiderInsights: roleInsiderNote.trim() }
          : undefined,
      });
      showToast(
        `You're sponsoring ${selectedRole.TITLE || "this role"} — your deck will have applicants waiting.`,
        "success",
      );
    } catch (err) {
      // Never trap onboarding on this — it's a bonus, not a requirement.
      // They can sponsor a role from the Jobs tab any time.
      console.warn("[SponsorQuestionnaire] Failed to sponsor role:", err);
      showToast(
        "Couldn't sponsor that role right now — you can do it from the Jobs tab.",
        "info",
      );
    } finally {
      setIsSponsoringRole(false);
      setShowRolePicker(false);
      finishOnboarding();
    }
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

  // Onboarding funnel — one event per step the sponsor actually SEES (the
  // applicant questionnaire mirrors this), named by the question's `type`
  // plus the index since sponsor questions carry no key ("3_select" is the
  // tenure picker, "8_email" the work-email step, etc. — the id→meaning
  // table lives in the `questions` array above). Step completion is implied
  // by the next step's view + trackOnboardingCompleted at the end.
  useEffect(() => {
    trackOnboardingStepViewed({
      role: "sponsor",
      stepIndex: currentQuestion,
      stepName: `${question.id}_${question.type}`,
    });
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
                      <Camera color={Colors.faint} size={40} />
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
                    placeholderTextColor={Colors.faint}
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
                      <Mail color={Colors.faint} size={20} style={{ marginRight: 12 }} />
                    )}
                    <TextInput
                      placeholder={question.placeholder}
                      placeholderTextColor={Colors.faint}
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

      {/* Sponsor cold-start role picker — see the state block + handlers
          above for why this can only run after registration. */}
      {showRolePicker && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill}>
            <SafeAreaView style={styles.rolePickerSafeArea}>
              {rolePickerStep === "pick" ? (
                <>
                  <View style={styles.rolePickerHeader}>
                    <View style={styles.rolePickerBadge}>
                      <Briefcase color="#000" size={22} />
                    </View>
                    <Text style={styles.rolePickerTitle}>
                      We found {roleOptions.length} open role
                      {roleOptions.length === 1 ? "" : "s"} at {answers[0]}
                    </Text>
                    <Text style={styles.rolePickerSub}>
                      Sponsor one now and land on a live deck of matched
                      applicants instead of an empty one.
                    </Text>
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.rolePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {roleOptions.map((role) => (
                      <TouchableOpacity
                        key={role.JOB_ID}
                        style={styles.rolePickerRow}
                        onPress={() => handleSelectRole(role)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.rolePickerRowTitle}
                            numberOfLines={1}
                          >
                            {role.TITLE || "Open role"}
                          </Text>
                          {!!role.FULL_LOCATION && (
                            <Text
                              style={styles.rolePickerRowSub}
                              numberOfLines={1}
                            >
                              {role.FULL_LOCATION}
                            </Text>
                          )}
                        </View>
                        <ChevronRight size={18} color={Colors.faint} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.rolePickerFooter}>
                    <TouchableOpacity
                      onPress={handleSkipRolePicker}
                      style={styles.rolePickerSkipBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rolePickerSkipText}>
                        Skip for now
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.rolePickerHeader}>
                    <Text style={styles.rolePickerTitle}>
                      {selectedRole?.TITLE || "This role"}
                    </Text>
                    <Text style={styles.rolePickerSub}>
                      Two quick questions, then it is set.
                    </Text>
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.rolePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.rolePickerQuestionLabel}>
                      Can you refer people into this role?
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {[true, false].map((val) => (
                        <TouchableOpacity
                          key={String(val)}
                          style={[
                            styles.rolePickerChoiceBtn,
                            roleCanRefer === val &&
                              styles.rolePickerChoiceBtnSelected,
                          ]}
                          onPress={() => setRoleCanRefer(val)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.rolePickerChoiceText,
                              roleCanRefer === val &&
                                styles.rolePickerChoiceTextSelected,
                            ]}
                          >
                            {val ? "Yes" : "Not directly"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text
                      style={[
                        styles.rolePickerQuestionLabel,
                        { marginTop: 24 },
                      ]}
                    >
                      Anything applicants should know? (optional)
                    </Text>
                    <TextInput
                      style={styles.rolePickerNoteInput}
                      placeholder="e.g. what the team is like, what we look for..."
                      placeholderTextColor={Colors.faint}
                      value={roleInsiderNote}
                      onChangeText={setRoleInsiderNote}
                      multiline
                      maxLength={500}
                    />
                  </ScrollView>

                  <View style={styles.rolePickerFooter}>
                    <TouchableOpacity
                      onPress={() => setRolePickerStep("pick")}
                      style={styles.rolePickerBackBtn}
                      activeOpacity={0.7}
                      disabled={isSponsoringRole}
                    >
                      <Text style={styles.rolePickerBackText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSponsorSelectedRole}
                      style={[
                        styles.rolePickerSponsorBtn,
                        (isSponsoringRole || roleCanRefer === null) && {
                          opacity: 0.5,
                        },
                      ]}
                      activeOpacity={0.8}
                      disabled={isSponsoringRole || roleCanRefer === null}
                    >
                      {isSponsoringRole ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.rolePickerSponsorText}>
                          Sponsor this role
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </SafeAreaView>
          </BlurView>
        </Animated.View>
      )}

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
                Profile <Text style={styles.successTitleAccent}>Complete</Text>
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
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressBarBg: { height: 2, backgroundColor: Colors.border, width: "100%" },
  progressBar: { height: "100%", backgroundColor: "#000" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40 },
  questionText: {
    ...Type.title,
    color: Colors.ink,
    marginBottom: 40,
  },
  optionsContainer: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Softer than the CTA buttons' pure black — a selection shouldn't
  // compete with the primary action for visual weight.
  optionCardSelected: { backgroundColor: Colors.body, borderColor: Colors.body },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 64,
  },
  textInput: { flex: 1, fontSize: 18, color: "#000", fontWeight: "500" },
  companyHelper: {
    fontSize: 13,
    color: Colors.muted,
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
    ...Type.title,
    color: Colors.ink,
    textAlign: "center",
  },
  successTitleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  successSub: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    color: Colors.body,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  photoInitials: { fontSize: 52, fontWeight: "800", color: Colors.muted },
  photoBtnRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  photoPickBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  photoPickText: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  photoSkipBtn: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 16 },
  photoSkipText: { fontSize: 14, fontWeight: "600", color: Colors.faint },
  bioWrapper: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bioInput: {
    fontSize: 18,
    color: Colors.ink,
    fontWeight: "500",
    minHeight: 120,
    textAlignVertical: "top",
  },

  // ── Sponsor cold-start role picker ──────────────────────────────────────
  rolePickerSafeArea: { flex: 1 },
  rolePickerHeader: { paddingHorizontal: 28, paddingTop: 16 },
  rolePickerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  rolePickerTitle: {
    ...Type.heading,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ink,
  },
  rolePickerSub: {
    fontSize: 14,
    color: Colors.body,
    lineHeight: 20,
    marginTop: 8,
  },
  rolePickerScroll: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  rolePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  rolePickerRowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  rolePickerRowSub: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  rolePickerFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 8,
  },
  rolePickerSkipBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  rolePickerSkipText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.muted,
  },
  // Matches the pill shape (radius = height/2) every other CTA in the
  // sign-up flow uses — both were squared off (radius 18) before.
  rolePickerBackBtn: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rolePickerBackText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  rolePickerSponsorBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  rolePickerSponsorText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  rolePickerQuestionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 10,
  },
  rolePickerChoiceBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  // Softer than the CTA buttons' pure black — a selection shouldn't
  // compete with the primary action for visual weight.
  rolePickerChoiceBtnSelected: {
    backgroundColor: Colors.body,
    borderColor: Colors.body,
  },
  rolePickerChoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  rolePickerChoiceTextSelected: {
    color: "#FFF",
  },
  rolePickerNoteInput: {
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#000",
    minHeight: 90,
    textAlignVertical: "top",
  },
});
