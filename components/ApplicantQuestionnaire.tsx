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
  Search,
  Upload,
  UserCheck,
  X,
} from "@/components/ui/icons";
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
import { GOOGLE_PLACES_API_KEY } from "@/constants/config";
import { Colors, Fonts, Type } from "@/constants/theme";
import {
  APPLICANT_PROMPT_CATEGORIES,
  APPLICANT_PROMPT_EXAMPLES,
} from "@/constants/prompts";
import { SKILLS_BY_INDUSTRY } from "@/constants/skills";
import { PlacesAutocomplete } from "./ui/PlacesAutocomplete";
import { PromptsIntake } from "./ui/PromptsIntake";
import {
  identifyUser,
  trackOnboardingCompleted,
  trackOnboardingStepViewed,
  trackResumeUploaded,
  trackSignUpFailed,
  trackSignUpSucceeded,
} from "@/lib/analytics/mixpanel";
import { HOME_INTRO_PENDING_KEY } from "./ui/HomeIntro";
import {
  classifyResume,
  updateApplicantProfile,
  updateGeneralProfile,
  uploadAndParseResume,
  uploadProfileImage,
} from "@/lib/api";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useToastStore } from "@/stores/useToastStore";
import {
  EducationEntry,
  ProfessionalExperience,
  useUserProfileStore,
} from "@/stores/useUserProfileStore";
import {
  clearOnboardingDraft,
  clearOnboardingRegistered,
  loadOnboardingDraft,
  markOnboardingRegistered,
  saveOnboardingDraft,
} from "@/utils/onboardingDraft";
import { BroadcastMoment } from "@/components/cinema/BroadcastMoment";
import { ResumeReadingFilm } from "@/components/cinema/ResumeReadingFilm";
import {
  buildReadingRows,
  type ReadingRow,
} from "@/components/cinema/resumeReadingContent";
import { Sentry } from "@/lib/sentry";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Upper bound on how long we'll block onboarding waiting for the final save
// before proceeding anyway — a new user must never be trapped on a spinner.
const RESUME_PROCESS_TIMEOUT_MS = 25000;

// How long we HOLD the user on the "building your profile" beat for the
// résumé pipeline (upload → parse → AI classify → refetch). The classify step
// is Snowflake Cortex and routinely runs 30–90s (the profile screen budgets
// 60s + 120s for the same pipeline), so this must be generous — the original
// 25s cap expired mid-classify, showed a false "couldn't parse" toast, and
// made testers re-type everything the backend then filled in anyway. Past
// this hold we release the user into the manual steps, but the pipeline keeps
// running and a late success is harvested (see handleResumeStep).
const RESUME_FOREGROUND_WAIT_MS = 75_000;

// Error-message prefix marking "the PDF had no extractable text" (scanned /
// image-only résumés) so the catch can show a more useful toast than the
// generic failure copy.
const RESUME_UNREADABLE = "resume-unreadable:";

// The post-completion Broadcast beat. The animation plays at its NATURAL
// length — BroadcastMoment's choreography is fractional, so passing less
// than 2600ms compresses every movement (the old 1900ms made "Profile
// complete." fly by half-finished). Navigation then waits a further beat
// so the moment actually lands before the dashboard's intro slides begin.
const DONE_BEAT_ANIMATION_MS = 2600;
const DONE_BEAT_MS = 3400;

// AsyncStorage key for the in-progress applicant questionnaire, so a user who
// backgrounds/kills the app mid-signup doesn't lose their answers. We store
// ONLY the typed content + step — never the password (security) and never the
// picked photo URI (a temp cache path that won't survive a relaunch).
const APPLICANT_DRAFT_KEY = "onboarding_draft_applicant_v1";

// The résumé picker only accepts PDFs (see handleFilePick) — the upload copy
// must match, otherwise a Word-résumé user thinks the picker is broken.
const RESUME_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the upload copy

/** Resolve when `promise` settles, or reject once `ms` elapses. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

interface ApplicantQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
  /**
   * Called when registration fails because the email is already registered.
   * Sends the user to a Sign In screen (pre-filled with what they typed)
   * instead of just bouncing them back to the sign-up form they were
   * rejected from — the dead end this used to be.
   */
  onEmailAlreadyRegistered: () => void;
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

// Resume-first flow. The resume comes FIRST: after it's parsed + AI-classified
// we skip the steps it fills (industry, current role, skills) and only ask for
// what a resume can't provide. Steps are keyed (not positional) so the list can
// shrink without breaking answer lookups. If no resume is given, every step is
// shown (the classic manual flow).
const questions = [
  {
    key: "resume",
    question: "Start with your résumé",
    type: "file",
    subtitle:
      "We'll build your profile from it automatically — or skip and fill it in yourself.",
  },
  {
    key: "industry",
    question: "What industry are you targeting?",
    type: "select",
    options: ["Technology", "Finance", "Healthcare", "Education", "Marketing"],
  },
  {
    key: "currentRole",
    question: "What role are you currently in?",
    type: "text",
    placeholder: "e.g., Software Engineer",
  },
  {
    key: "seekingPosition",
    question: "What position are you seeking?",
    type: "text",
    placeholder: "e.g., Senior Product Lead",
  },
  { key: "skills", question: "Choose up to 5 skills to highlight", type: "skills" },
  {
    key: "insights",
    question: "Add personality to your profile",
    type: "insights",
    subtitle:
      "Answer 2 prompts so sponsors get a feel for you beyond your résumé.",
  },
  {
    key: "workPreferences",
    question: "What are your work preferences?",
    type: "workPreferences",
    subtitle: "Select all that apply",
  },
  {
    key: "photo",
    question: "Add a profile photo",
    type: "photo",
    subtitle: "Sponsors see this first — a clear headshot goes a long way",
  },
  {
    key: "location",
    question: "Where are you based?",
    type: "location",
    subtitle: "Used to surface roles near you",
  },
];

// Steps the résumé classify fills, and which we therefore skip once it succeeds.
const RESUME_FILLED_KEYS = ["industry", "currentRole", "skills"];

export function ApplicantQuestionnaire({
  onComplete,
  onBack,
  onEmailAlreadyRegistered,
}: ApplicantQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // True once the résumé has been parsed + classified — hides the steps it fills.
  const [resumeFilled, setResumeFilled] = useState(false);
  // Guards against double-registration (registration now fires at the résumé
  // step). Seeded from the global auth state, not just `false` — a user
  // resuming an interrupted signup (see markOnboardingRegistered) is
  // ALREADY authenticated when this component (re)mounts, and re-running
  // registration for them would either 401 or hit "email already
  // registered". isAuthenticated is read once at mount here deliberately;
  // see its declaration below.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const registeredRef = useRef(isAuthenticated);
  // Closes the late-résumé harvest window: once the final save starts (or the
  // component unmounts) a slow classify landing in the background must no
  // longer flip resumeFilled — the data still lands server-side either way.
  const resumeHarvestClosedRef = useRef(false);
  useEffect(
    () => () => {
      resumeHarvestClosedRef.current = true;
    },
    [],
  );
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
  // The post-completion Broadcast beat — separate from showSuccess, which
  // doubles as a network-bound loading overlay.
  const [showDoneBeat, setShowDoneBeat] = useState(false);
  // Distinguishes the two loading beats behind the success overlay: the résumé
  // parse (after step 1) vs. the final save (last step).
  const [finalizing, setFinalizing] = useState(false);
  // "The Reading" — the résumé-parse film (ResumeReadingFilm) that replaces
  // the blur/spinner overlay for the résumé beat. Null when not playing;
  // resumeText arrives when the parse lands, resolved+rows when the classify
  // and refetch complete. filmDoneRef resolves handleResumeStep's wait once
  // the film's confirmation beat finishes.
  const [film, setFilm] = useState<null | {
    resumeText: string | null;
    resolved: boolean;
    rows: ReadingRow[];
  }>(null);
  const filmDoneRef = useRef<(() => void) | null>(null);
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

  // Insights state (prompts). The prompt library + editor live in PromptsIntake.
  const [selectedInsights, setSelectedInsights] = useState<
    Array<{ question: string; answer: string }>
  >([]);

  const scrollViewRef = useRef<ScrollView>(null);

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
  // Set by AuthScreen when this account was created via "Continue with
  // Apple/Google" and is still role-less — routes the résumé step's
  // account-creation call to completeSsoOnboarding() instead of
  // createProfile(), since this user already has tokens and no password.
  const ssoSession = useOnboardingStore((state) => state.ssoSession);
  const setAuthTokens = useAuthStore((state) => state.setAuthTokens);
  const clearOnboardingData = useOnboardingStore((state) => state.clearProfile);
  const loadFromProfile = useUserProfileStore((state) => state.loadFromProfile);
  // useOnboardingStore is in-memory only — a resumed session (app restarted
  // mid-questionnaire, see markOnboardingRegistered) mounts with
  // applicantData.email empty. useUserProfileStore IS persisted to
  // AsyncStorage and gets seeded with the email the moment registration
  // succeeds (loadFromProfile, below), so it survives the restart — falling
  // back to it is what lets a resumed session find its own saved draft.
  const persistedEmail = useUserProfileStore((state) => state.data.personal.email);
  const identityEmail = applicantData.email || persistedEmail;
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const showToast = useToastStore((state) => state.showToast);
  const rcIdentifyUser = useSubscriptionStore((state) => state.identifyUser);

  // Final exit from onboarding → dashboard, from handleFinalize for every
  // path (the résumé review happens mid-flow now, after the parse film).
  // Plays the Broadcast beat (the signup's one true celebration — the
  // loading overlay above it is a spinner, not a confirmation) and then
  // finishes for real after the beat completes.
  const completeOnboarding = () => {
    setShowSuccess(false);
    setShowReview(false);
    setIsSubmitting(false);
    setShowDoneBeat(true);
    setTimeout(finishOnboardingNow, DONE_BEAT_MS);
  };

  const finishOnboardingNow = () => {
    // Onboarding finished — stop autosaving, discard the draft, clear the
    // in-memory onboarding data (auth basics no longer needed).
    hydratedRef.current = false;
    clearOnboardingDraft(APPLICANT_DRAFT_KEY);
    clearOnboardingRegistered();
    clearOnboardingData();
    trackOnboardingCompleted("applicant");
    // Captured before onComplete()/clearOnboardingData() run, since
    // ssoSession is about to be cleared from the store.
    const wasSso = !!ssoSession;
    onComplete();
    // Backend sends a verification email automatically on register (PR #38)
    // — not applicable to SSO signups: there's no register call, and the
    // provider already verified the email.
    setTimeout(() => {
      showToast(
        wasSso
          ? "Welcome! Your profile is ready."
          : "Welcome! We sent a verification email — check your inbox and spam folder.",
        "success",
      );
    }, 500);
  };

  // Review dismissal — the next question is already on stage underneath,
  // so closing the sheet drops the user straight into the remaining steps.
  const handleReviewConfirm = () => {
    setShowReview(false);
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
  //
  // Drafts are identity-scoped (utils/onboardingDraft.ts): stamped with the
  // signup email and only restored for the SAME email. A new signup session
  // with a different identity discards any old draft instead of hydrating
  // it — previously an abandoned signup's junk answers leaked into the next
  // signup on the same device and looked like broken resume auto-fill.
  // Uses `identityEmail` (not applicantData.email directly) so this still
  // resolves after an app restart mid-questionnaire, when the in-memory
  // onboarding store has reset but the persisted profile store hasn't.
  const hydratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await loadOnboardingDraft<{
          answers?: typeof answers;
          selectedSkills?: string[];
          selectedInsights?: typeof selectedInsights;
          selectedWorkPreferences?: string[];
          locationText?: string;
        }>(APPLICANT_DRAFT_KEY, identityEmail);
        if (d) {
          if (d.answers) setAnswers(d.answers);
          if (Array.isArray(d.selectedSkills)) setSelectedSkills(d.selectedSkills);
          if (Array.isArray(d.selectedInsights))
            setSelectedInsights(d.selectedInsights);
          if (Array.isArray(d.selectedWorkPreferences))
            setSelectedWorkPreferences(d.selectedWorkPreferences);
          if (typeof d.locationText === "string") setLocationText(d.locationText);
          // Intentionally NOT restoring the step index: registration happens on
          // the first (résumé) step, so we must always re-enter there. Restoring
          // a later step would skip registration and 401 the final save.
        }
      } catch {
        // Ignore a corrupt/absent draft — just start fresh.
      } finally {
        hydratedRef.current = true;
      }
    })();
    // Depends on identityEmail rather than running once: for a brand-new
    // signup it's stable from the first render (no extra runs), but for a
    // resumed session it can start empty and resolve a beat later once the
    // persisted profile store finishes loading — this re-attempts the load
    // once that happens instead of missing the draft.
  }, [identityEmail]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveOnboardingDraft(APPLICANT_DRAFT_KEY, identityEmail, {
      answers,
      selectedSkills,
      selectedInsights,
      selectedWorkPreferences,
      locationText,
    });
  }, [
    answers,
    selectedSkills,
    selectedInsights,
    selectedWorkPreferences,
    locationText,
    identityEmail,
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
      // Resume-first: register with auth-only data. The résumé classify + a
      // final PATCH (handleFinalize) fill the profile fields afterward.
      return authApi.createProfile({
        userType: "applicant",
        firstName: applicantData.firstName || "",
        lastName: applicantData.lastName || "",
        email: applicantData.email || "",
        password: applicantData.password || "",
        profileData: {
          targetIndustry: undefined,
          currentRole: undefined,
          seekingPosition: undefined,
          skills: [],
          insights: [],
          workPreferences: [],
          resumeUrl: undefined,
        },
      });
    },
    onSuccess: async (data) => {
      console.log("[ApplicantQuestionnaire] Registration successful:", data);

      // The user is about to become authenticated with a still-mostly-empty
      // profile — flag that BEFORE flipping auth state, and await it, so
      // anything that reacts to isAuthenticated (splash's cold-start
      // redirect) is guaranteed to see the flag and route an interrupted
      // signup back here instead of the dashboard. Cleared in
      // completeOnboarding.
      await markOnboardingRegistered("applicant");
      // Save auth tokens so the subsequent authed calls (classify, PATCH,
      // image upload) work.
      await setAuthTokens(data.access_token, data.refresh_token, "Applicant");

      identifyUser({
        userId: String(data.user_id),
        userType: "applicant",
        email: applicantData.email ?? null,
        firstName: applicantData.firstName ?? null,
        lastName: applicantData.lastName ?? null,
        currentRole: answers["currentRole"] ?? null,
      });
      trackSignUpSucceeded("applicant");
      // Show the first-run Home intro once on their first Home view.
      AsyncStorage.setItem(HOME_INTRO_PENDING_KEY, "1").catch(() => {});
      rcIdentifyUser(String(data.user_id));

      // Seed the local store with the basics; the résumé classify + final PATCH
      // populate the rest.
      await loadFromProfile({
        firstName: applicantData.firstName,
        lastName: applicantData.lastName,
        email: applicantData.email,
        profileData: {
          targetIndustry: undefined,
          currentRole: undefined,
          seekingPosition: undefined,
          skills: [],
          insights: [],
          workPreferences: [],
          resumeUrl: undefined,
        },
      });
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

  // SSO counterpart to createProfileMutation above — fires at the same point
  // (the résumé step) for a user who already authenticated via "Continue
  // with Apple/Google" and just needs a role + profile row attached. Sent
  // empty/placeholder like createProfileMutation's payload: the résumé
  // classify + handleFinalize's PATCH (via updateApplicantProfile) fill in
  // the real data afterward, identically for both signup paths.
  const completeSsoOnboardingMutation = useMutation({
    mutationFn: async () => {
      return authApi.completeSsoOnboarding({
        // Capitalized per the backend's validation — it rejects anything
        // but exactly 'Applicant'/'Sponsor'.
        role: "Applicant",
        // The SSO exchange usually stored the name already, but Apple only
        // sends it once ever — forward anything the flow captured so a
        // questionnaire-entered name isn't lost.
        ...(applicantData.firstName?.trim()
          ? { first_name: applicantData.firstName.trim() }
          : {}),
        ...(applicantData.lastName?.trim()
          ? { last_name: applicantData.lastName.trim() }
          : {}),
        skills: [],
        insights: [],
        work_preferences: [],
      });
    },
    onSuccess: async () => {
      // Guarded by handleResumeStep only ever calling this mutation when
      // ssoSession is set — but narrow the type here rather than assert.
      if (!ssoSession) return;
      // This SSO user is authenticated with a still-mostly-empty profile —
      // flag it (awaited, durably) so splash's cold-start redirect routes
      // an interrupted signup back here instead of the dashboard. Cleared
      // in completeOnboarding.
      await markOnboardingRegistered("applicant");

      identifyUser({
        userId: ssoSession.userId,
        userType: "applicant",
        email: applicantData.email ?? null,
        firstName: applicantData.firstName ?? null,
        lastName: applicantData.lastName ?? null,
        currentRole: answers["currentRole"] ?? null,
      });
      trackSignUpSucceeded("applicant");
      AsyncStorage.setItem(HOME_INTRO_PENDING_KEY, "1").catch(() => {});
      rcIdentifyUser(ssoSession.userId);

      await loadFromProfile({
        firstName: applicantData.firstName,
        lastName: applicantData.lastName,
        email: applicantData.email,
        profileData: {
          targetIndustry: undefined,
          currentRole: undefined,
          seekingPosition: undefined,
          skills: [],
          insights: [],
          workPreferences: [],
          resumeUrl: undefined,
        },
      });
    },
    onError: (error: Error) => {
      console.warn(
        "[ApplicantQuestionnaire] SSO onboarding completion failed:",
        error,
      );
      setIsSubmitting(false);
      trackSignUpFailed("applicant", error.message || "unknown");
      showToast(`Couldn't finish setting up your account: ${error.message}`, "error");
    },
  });

  const filteredSkills = useMemo(() => {
    const selectedIndustry = answers["industry"] || "Other";
    const industrySkills =
      SKILLS_BY_INDUSTRY[selectedIndustry] || SKILLS_BY_INDUSTRY.Other;
    return industrySkills
      .filter((skill) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => a.localeCompare(b));
  }, [searchQuery, answers]);

  // Résumé step: register once (auth-only), then parse + AI-classify the résumé
  // if one was provided, then advance. On success we set resumeFilled so the
  // steps it covers (industry/role/skills) are skipped.
  const handleResumeStep = async () => {
    setIsSubmitting(true);
    if (!registeredRef.current) {
      try {
        if (ssoSession) {
          // Already authenticated — attach the role instead of registering.
          await completeSsoOnboardingMutation.mutateAsync();
        } else {
          await createProfileMutation.mutateAsync();
        }
        registeredRef.current = true;
      } catch (err) {
        setIsSubmitting(false);
        // "Already registered" only means something for the password path
        // (createProfile creating a brand-new account); an SSO user hitting
        // an error here is already authenticated as themselves, so there's
        // no "sign in instead" recovery to offer — onError already showed
        // a toast for that case.
        if (ssoSession) return;
        // If the failure is an already-registered email, send them straight
        // to Sign In (pre-filled with what they typed) instead of dropping
        // them back on the sign-up form they were just rejected from.
        // onError already surfaced the "email already registered" toast,
        // which stays visible through the transition.
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (
          msg.includes("already in use") ||
          msg.includes("already exists") ||
          msg.includes("already registered")
        ) {
          onEmailAlreadyRegistered();
        }
        return;
      }
    }
    if (selectedFileAsset) {
      // Roll film — "The Reading" plays over the whole parse + classify wait.
      setFilm({ resumeText: null, resolved: false, rows: [] });
      const form = new FormData();
      // POST /api/upload-and-parse/ expects field name "file".
      form.append("file", {
        uri: selectedFileAsset.uri,
        name: selectedFileAsset.name,
        type: selectedFileAsset.mimeType,
        // RN FormData file descriptor — cast required (web-typed lib.dom).
      } as any);
      trackResumeUploaded({
        source: "questionnaire",
        fileSizeBytes: selectedFileAsset.size,
      });

      // The whole pipeline as ONE promise: the foreground timeout below stops
      // the WAITING, never the work — the requests keep running so a slow
      // classify can still be harvested after we release the user.
      const pipeline = (async () => {
        const parsed = await uploadAndParseResume(form);
        // The backend returns 201 even when text extraction fails (scanned/
        // image-only PDFs) — extracted_text is null. Don't classify nothing.
        if (!parsed.extracted_text) {
          throw new Error(
            `${RESUME_UNREADABLE}${parsed.parsing_error ?? "no extracted text"}`,
          );
        }
        // Hand the parsed text to the film — the drift scene shows the
        // user's own lines while the classify runs.
        const text = parsed.extracted_text;
        setFilm((s) => (s ? { ...s, resumeText: text } : s));
        await classifyResume();
        await fetchFromBackend();
      })();

      try {
        await withTimeout(pipeline, RESUME_FOREGROUND_WAIT_MS);
        // Real values for the film's build scene — the same derivations the
        // deck card ledger uses, from the freshly-refetched profile.
        const d = useUserProfileStore.getState().data;
        const rows = buildReadingRows({
          experiences: d.professional.experiences,
          skills: d.skills,
          achievements: d.achievements,
          currentRole: d.professional.currentRole,
          industry: d.professional.targetIndustry,
        });
        // Let the film land its ending: the beat on stage finishes its
        // read, then the build + confirmation scenes play out before we
        // advance to the next question.
        await new Promise<void>((resolve) => {
          filmDoneRef.current = resolve;
          setFilm((s) => (s ? { ...s, resolved: true, rows } : s));
        });
        setResumeFilled(true);
        // The film's "Here's what we found" hands directly into the review
        // sheet: show everything the résumé filled, then the CTA continues
        // into the remaining questions (the parts a résumé can't answer).
        const experiences = (d.professional.experiences || []).filter(
          (e) => e.jobTitle?.trim() || e.company?.trim(),
        );
        const education = (d.education.entries || []).filter(
          (e) => e.degree?.trim() || e.university?.trim(),
        );
        const skills = d.skills || [];
        if (experiences.length || education.length || skills.length) {
          setReviewData({ experiences, education, skills });
          setShowReview(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message === "timeout") {
          // Still working server-side. Release the user into the manual steps
          // and quietly harvest the result if it lands before the final save —
          // resumeFilled flipping mid-flow collapses the industry/role/skills
          // steps (the safeIndex guard handles the list shrinking).
          showToast(
            "Your résumé is taking a moment — keep going and we'll fill in what we can.",
            "info",
          );
          pipeline
            .then(() => {
              if (resumeHarvestClosedRef.current) return;
              setResumeFilled(true);
              showToast(
                "Résumé read — we've filled in your experience and skills.",
                "success",
              );
            })
            .catch((lateErr) => {
              console.warn(
                "[Questionnaire] Résumé background processing failed:",
                lateErr,
              );
              Sentry.captureException(lateErr, {
                tags: { flow: "onboarding_resume", stage: "background" },
              });
            });
        } else {
          console.warn("[Questionnaire] Résumé processing failed:", err);
          // Onboarding's centerpiece — failures should page the dashboard,
          // not just toast (mirrors useResumePipeline).
          Sentry.captureException(err, { tags: { flow: "onboarding_resume" } });
          showToast(
            message.startsWith(RESUME_UNREADABLE)
              ? "We couldn't read your résumé — it may be a scanned image. You can fill those details in yourself."
              : "We couldn't read your résumé automatically — you can fill those details in yourself.",
            "info",
          );
          // resumeFilled stays false → the manual industry/role/skills steps show.
        }
      } finally {
        filmDoneRef.current = null;
        setFilm(null);
      }
    }
    setIsSubmitting(false);
    setCurrentQuestion((q) => q + 1);
  };

  // Final step: persist everything collected after registration, then show the
  // résumé review (if we classified one) or finish.
  const handleFinalize = async () => {
    // The last step is a text input (location), so the keyboard is typically
    // open when "Create Profile" is tapped. Drop it before the transition —
    // otherwise it lingers over the review screen, which has no input to
    // give it focus and no obvious way to dismiss it.
    Keyboard.dismiss();
    // The final save is starting — a late résumé harvest flipping the step
    // list or toasting over the review screen from here on would be wrong.
    resumeHarvestClosedRef.current = true;
    setIsSubmitting(true);
    setFinalizing(true);
    setShowSuccess(true);
    try {
      await withTimeout(
        (async () => {
          const patch: Parameters<typeof updateApplicantProfile>[0] = {
            positions: answers["seekingPosition"]
              ? [answers["seekingPosition"]]
              : [],
            insights: selectedInsights,
            work_preferences: selectedWorkPreferences,
          };
          // Industry/role/skills are filled by the résumé classify when present;
          // only send them from the manual steps when there was no résumé.
          if (!resumeFilled) {
            if (answers["industry"]) patch.industry = answers["industry"];
            if (answers["currentRole"])
              patch.current_role = answers["currentRole"];
            patch.skills = selectedSkills;
          }
          await updateApplicantProfile(patch);

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
          await fetchFromBackend();
        })(),
        RESUME_PROCESS_TIMEOUT_MS,
      );
    } catch (err) {
      console.warn("[Questionnaire] Finalize failed:", err);
    }

    // The résumé review now plays right after the parse film (see
    // handleResumeStep) — the finale is the same for everyone: the
    // Broadcast beat, then the dashboard.
    completeOnboarding();
  };

  const handleNext = () => {
    if (question.type === "file") {
      handleResumeStep();
    } else if (isLastQuestion) {
      handleFinalize();
    } else {
      setCurrentQuestion((q) => q + 1);
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
        if (asset.size && asset.size > RESUME_MAX_SIZE_BYTES) {
          showToast(
            "That résumé is over 10 MB — please upload a smaller file.",
            "error",
          );
          return;
        }
        setSelectedFileAsset({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType || "application/pdf",
          size: asset.size || 0,
        });
        setSelectedFile(asset.name);
      }
    } catch (error) {
      console.warn(error);
    }
  };

  // The steps actually shown: once the résumé is classified, drop the ones it
  // filled so the user only answers what's left.
  const activeQuestions = useMemo(
    () =>
      resumeFilled
        ? questions.filter((q) => !RESUME_FILLED_KEYS.includes(q.key))
        : questions,
    [resumeFilled],
  );
  // Guard the index against the list shrinking under us (e.g. resumeFilled flips).
  const safeIndex = Math.min(currentQuestion, activeQuestions.length - 1);
  const question = activeQuestions[safeIndex];

  // Onboarding funnel — one event per step the user actually SEES, named by
  // the question key ("resume", "skills", "photo", …) so Mixpanel's funnel
  // view shows exactly where signups stall. Step completion is implied by
  // the next step's view (plus trackOnboardingCompleted at the end), so
  // there's no separate completed event to keep in sync.
  useEffect(() => {
    trackOnboardingStepViewed({
      role: "applicant",
      stepIndex: safeIndex,
      stepName: question?.key,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex]);
  const progress = ((safeIndex + 1) / activeQuestions.length) * 100;
  const isLastQuestion = safeIndex === activeQuestions.length - 1;
  const isResumeScreen = question.type === "file";

  // UPDATED LOGIC: Allow 1-5 skills, require text input, and require 2-3 insights
  const isSkillsScreen = question.type === "skills";
  const isTextScreen = question.type === "text";
  const isInsightsScreen = question.type === "insights";
  const isWorkPreferencesScreen = question.type === "workPreferences";
  const isPhotoScreen = question.type === "photo";
  const isLocationScreen = question.type === "location";
  const canContinue = isResumeScreen
    ? true // Résumé is optional — can upload or skip
    : isSkillsScreen
    ? selectedSkills.length > 0 && selectedSkills.length <= 5
    : isTextScreen
      ? answers[question.key]?.trim().length > 0
      : isInsightsScreen
        ? selectedInsights.length >= 2 &&
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
            {safeIndex + 1} of {activeQuestions.length}
            {safeIndex === 0 ? " · about 2 min" : ""}
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

                {(isResumeScreen || isPhotoScreen || isLocationScreen) &&
                  question.subtitle && (
                    <Text style={styles.stepSubtitle}>{question.subtitle}</Text>
                  )}

                {question.type === "select" && (
                  <View style={styles.optionsContainer}>
                    {question.options?.map((option) => {
                      const isSelected = answers[question.key] === option;
                      const isEnabled = option === "Technology";
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() =>
                            isEnabled &&
                            setAnswers({
                              ...answers,
                              [question.key]: option,
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
                              color={isEnabled ? Colors.faint : Colors.border}
                              size={18}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.comingSoonNote}>
                      We&apos;re starting with tech — other industries are coming
                      soon.
                    </Text>
                  </View>
                )}

                {question.type === "text" && (
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder={question.placeholder}
                      placeholderTextColor={Colors.faint}
                      value={answers[question.key] || ""}
                      onChangeText={(v) =>
                        setAnswers({ ...answers, [question.key]: v })
                      }
                      style={styles.textInput}
                      autoCapitalize="words"
                      // After the résumé film, the flow advances to this
                      // question UNDER the review sheet — autofocusing then
                      // summons the keyboard over the overlay. Focus only
                      // when this screen is actually the one being looked at.
                      autoFocus={!showReview}
                    />
                  </View>
                )}

                {question.type === "skills" && (
                  <View>
                    <View style={styles.searchWrapper}>
                      <Search
                        color={Colors.faint}
                        size={20}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        placeholder="Search skills..."
                        placeholderTextColor={Colors.faint}
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
                  <PromptsIntake
                    value={selectedInsights}
                    onChange={setSelectedInsights}
                    categories={APPLICANT_PROMPT_CATEGORIES}
                    examples={APPLICANT_PROMPT_EXAMPLES}
                    min={2}
                    max={3}
                    subtitle={question.subtitle}
                  />
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
                        <MapPin color={Colors.faint} size={20} />
                        <TextInput
                          placeholder="e.g., San Francisco, CA"
                          placeholderTextColor={Colors.faint}
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
                          PDF only · Max 10 MB
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
                            }}
                            activeOpacity={0.7}
                          >
                            <X size={16} color={Colors.body} strokeWidth={2.5} />
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
                    {isResumeScreen && !selectedFileAsset
                      ? "Skip for now"
                      : isLastQuestion
                        ? "Complete Profile"
                        : "Continue"}
                  </Text>
                  <ArrowRight color="#FFF" size={20} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* The Reading — full-screen résumé-parse film (replaces the old
          blur/spinner overlay for the résumé beat). */}
      {film && (
        <ResumeReadingFilm
          resumeText={film.resumeText}
          resolved={film.resolved}
          rows={film.rows}
          onComplete={() => filmDoneRef.current?.()}
        />
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
                {finalizing ? "Finishing up" : "Creating your profile"}
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(600)}
                style={styles.successSub}
              >
                {finalizing
                  ? "Putting the finishing touches on your profile…"
                  : "We're using your résumé to set things up — this'll just take a moment."}
              </Animated.Text>
              <Animated.View
                entering={FadeIn.delay(800)}
                style={styles.successSpinner}
              >
                <ActivityIndicator color="#000" />
              </Animated.View>
            </View>
          </BlurView>
        </Animated.View>
      )}

      {showReview && reviewData && (
        <Animated.View
          entering={FadeIn}
          style={[StyleSheet.absoluteFill, styles.reviewRoot]}
        >
          <SafeAreaView style={styles.reviewSafeArea}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewEyebrow}>FROM YOUR RÉSUMÉ</Text>
              <Text style={styles.reviewTitle}>
                Here&apos;s what we{" "}
                <Text style={styles.reviewTitleAccent}>found.</Text>
              </Text>
              <Text style={styles.reviewSub}>
                Your profile is built. A few questions remain — the parts a
                résumé can&apos;t answer.
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
                    <View key={exp.id || `exp-${i}`} style={styles.reviewRow}>
                      <Text style={styles.reviewRowTitle} numberOfLines={1}>
                        {exp.jobTitle || "Role"}
                      </Text>
                      <Text style={styles.reviewRowSub} numberOfLines={1}>
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
                    <View key={edu.id || `edu-${i}`} style={styles.reviewRow}>
                      <Text style={styles.reviewRowTitle} numberOfLines={1}>
                        {[edu.degree, edu.major].filter(Boolean).join(", ") ||
                          edu.university ||
                          "Education"}
                      </Text>
                      <Text style={styles.reviewRowSub} numberOfLines={1}>
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
                  Looks right — keep going
                </Text>
                <ArrowRight color={Colors.paper} size={18} />
              </TouchableOpacity>
              <Text style={styles.reviewFootnote}>
                You can fine-tune every detail later in your profile.
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* Last sibling so it covers both the questionnaire and the review
          screen. The Broadcast at signup scale — plays its full natural
          choreography, and completeOnboarding's navigation timer holds a
          beat longer so the moment lands before the dashboard intro. */}
      {showDoneBeat && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill}>
            <View style={styles.doneBeatContainer}>
              <BroadcastMoment
                durationMs={DONE_BEAT_ANIMATION_MS}
                icon={<UserCheck color="#FFF" size={38} />}
                words={[
                  { word: "Profile" },
                  { word: "complete.", accent: true },
                ]}
                subtitle="Sponsors can find you now."
              />
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
    // #767676 is the minimum gray that passes WCAG AA contrast (4.5:1) on
    // white — #BBB (~2.3:1) failed for text conveying real progress state.
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressBarBg: { height: 2, backgroundColor: Colors.border, width: "100%" },
  progressBar: { height: "100%", backgroundColor: Colors.ink },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40 },
  content: { flex: 1 },
  questionText: {
    ...Type.title,
    color: Colors.ink,
    marginBottom: 40,
  },
  // Matches the site's .hero-body treatment.
  stepSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    color: Colors.body,
    lineHeight: 22,
    marginTop: -28,
    marginBottom: 32,
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
  optionCardDisabled: { backgroundColor: Colors.offWhite, borderColor: Colors.border },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  optionTextDisabled: { color: Colors.borderStrong },
  comingSoonNote: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.faint,
    textAlign: "center",
    lineHeight: 18,
  },
  inputWrapper: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 64,
    justifyContent: "center",
  },
  textInput: { fontSize: 18, color: "#000", fontWeight: "500" },
  fileContainer: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.borderStrong,
    borderRadius: 20,
    paddingVertical: 44,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.offWhite,
  },
  fileUploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.border,
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
  fileSubtitle: { fontSize: 13, color: Colors.faint, textAlign: "center" },
  fileConfirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.offWhite,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.ink,
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
  fileConfirmMeta: { fontSize: 13, color: Colors.muted, fontWeight: "500" },
  fileRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  fileReadyText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#000" },
  fileChangeLink: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.body,
    textDecorationLine: "underline",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.border,
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
  // Softer than the CTA buttons' pure black — a selection shouldn't
  // compete with the primary action for visual weight.
  skillItemSelected: { backgroundColor: Colors.body },
  skillText: { fontSize: 14, fontWeight: "600", color: "#000" },
  selectionCount: {
    marginTop: 24,
    fontSize: 14,
    color: Colors.faint,
    fontWeight: "600",
    textAlign: "center",
  },
  insightsSubtitle: {
    fontSize: 16,
    color: Colors.body,
    marginBottom: 32,
    lineHeight: 24,
  },
  footer: { paddingHorizontal: 28, paddingBottom: 30, paddingTop: 20 },
  nextButton: {
    backgroundColor: Colors.ink,
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
  // Full-bleed container for BroadcastMoment (which manages its own
  // centering) — no alignItems here or the stage would shrink-wrap.
  doneBeatContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 40,
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
  successSub: {
    fontFamily: Fonts.sansLight,
    fontSize: 16,
    color: Colors.body,
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
  photoPickText: { fontSize: 16, fontWeight: "700", color: "#000" },
  photoSkipBtn: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 16 },
  photoSkipText: { fontSize: 14, fontWeight: "600", color: Colors.faint },
  inputContainer: { paddingTop: 8 },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "#FFF",
  },
  locationInput: {
    flex: 1,
    fontSize: 18,
    color: "#000",
    // Single-line input alignment hardening: Android adds default vertical
    // padding and font ascent padding that sit placeholder text below
    // center (tester-reported on the signup city search); these pin it.
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingVertical: 14,
  },

  // ── Résumé review sheet (plays right after the parse film) ──────────────
  // Solid paper page — the film's stage, carried forward. No blur (the
  // questionnaire ghosting through read as murky shadows), no boxed cards:
  // flat rows on hairlines, serif titles, one filled pill.
  reviewRoot: {
    backgroundColor: Colors.paper,
    zIndex: 30,
  },
  reviewSafeArea: { flex: 1 },
  reviewHeader: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewEyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 14,
  },
  reviewTitle: {
    ...Type.title,
    color: Colors.ink,
  },
  reviewTitleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  reviewSub: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    color: Colors.body,
    lineHeight: 22,
    marginTop: 10,
  },
  reviewScroll: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
  },
  reviewSection: { marginBottom: 30 },
  reviewSectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 11.5,
    color: Colors.muted,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  reviewRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewRowTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: Colors.ink,
  },
  reviewRowSub: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    color: Colors.body,
    marginTop: 3,
  },
  reviewChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12,
  },
  reviewChip: {
    backgroundColor: Colors.paper,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13.5,
    color: Colors.ink,
  },
  reviewFooter: {
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reviewPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.ink,
    height: 54,
    borderRadius: 27,
  },
  reviewPrimaryText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15.5,
    color: Colors.paper,
  },
  reviewFootnote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13.5,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
});
