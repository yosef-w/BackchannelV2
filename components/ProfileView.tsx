import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    AlertCircle,
    Bell,
    Briefcase,
    Camera,
    Check,
    CheckCircle2,
    ChevronRight,
    Edit,
    FileText,
    GraduationCap,
    ImageIcon,
    Lock,
    LogOut,
    RefreshCw,
    Sparkles,
    Star,
    Target,
    Trash2,
    Upload,
    X,
} from "@/components/ui/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    FadeInUp,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";
import { PREMIUM_ENABLED } from "../constants/config";
import {
    resetUser,
    trackAccountDeleted,
    trackLogout,
    trackProfileEditOpened,
    trackProfileFieldUpdated,
    trackProfilePhotoUploaded,
    trackResumeReuploaded,
} from "../lib/analytics/mixpanel";
import {
    classifyResume,
    getExtractedResumeText,
    logout,
    unregisterDevice,
    updateApplicantProfile,
    updateGeneralProfile,
    updateSponsorProfile,
    uploadAndParseResume,
    uploadProfileImage,
} from "../lib/api";
import { useAuthStore } from "../stores/useAuthStore";
import { useJobsStore } from "../stores/useJobsStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useSubscriptionStore } from "../stores/useSubscriptionStore";
import { useToastStore } from "../stores/useToastStore";
import {
    EducationEntry,
    ProfessionalExperience,
    useUserProfileStore,
} from "../stores/useUserProfileStore";
import {
    cancelDailyDeckReminder,
    cancelUnfinishedDeckReminder,
} from "../lib/localNotifications";
import { cancelCheckInNudges } from "../lib/checkInNudges";
import { logBreadcrumb, Sentry } from "../lib/sentry";
import { validateProfileField } from "../lib/validation";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import {
  APPLICANT_PROMPT_CATEGORIES,
  APPLICANT_PROMPT_EXAMPLES,
  SPONSOR_PROMPT_CATEGORIES,
  SPONSOR_PROMPT_EXAMPLES,
} from "../constants/prompts";
import { EditorScreen } from "./profile/EditorScreen";
import { EditProfileScreen } from "./profile/EditProfileScreen";
import { HubRow } from "./profile/HubRow";
import { HubSection } from "./profile/HubSection";
import { NotificationsScreen } from "./profile/NotificationsScreen";
import { PrivacySecurityScreen } from "./profile/PrivacySecurityScreen";
import { ProfileIdentityCard } from "./profile/ProfileIdentityCard";
import { ResumeScreen } from "./profile/ResumeScreen";
import { PromptsIntake } from "./ui/PromptsIntake";

interface ProfileViewProps {
  userType: "applicant" | "sponsor";
}

// Shared Switch coloring. Monochrome to match the app's black/white branding:
// ON = solid black track, OFF = a medium neutral gray. The previous OFF track
// (#E5E5E5) was so close to the white sheet that the white thumb vanished into
// it — especially on iOS, where the *resting* off color is driven by
// `ios_backgroundColor` (NOT `trackColor.false`), which wasn't set at all. The
// gray below frames the white thumb clearly while staying on-brand.
const SWITCH_COLORS = {
  trackColor: { false: "#B0B3BA", true: "#000" },
  thumbColor: "#FFF",
  ios_backgroundColor: "#B0B3BA",
} as const;

interface ApplicantProfile {
  name: string;
  role: string;
  location: string;
  bio: string;
  expertiseLabel: string;
  expertise: string[];
  workPreferences: string[];
  desiredRoles: string[];
  achievements: string;
}

interface SponsorProfile {
  name: string;
  role: string;
  company: string;
  location: string;
  bio: string;
  expertiseLabel: string;
  expertise: string[];
}

interface ProfileInsight {
  question: string;
  answer: string;
}

export function ProfileView({ userType }: ProfileViewProps) {
  const router = useRouter();

  // Store access - must come before any useMemo that depends on it
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const resetJobsStore = useJobsStore((state) => state.reset);
  const clearOnboarding = useOnboardingStore((state) => state.clearProfile);
  const deviceToken = useAuthStore((state) => state.deviceToken);
  const clearUserProfileData = useUserProfileStore((state) => state.clearData);
  const pendingWorkEmail = useUserProfileStore(
    (state) => state.pendingWorkEmail,
  );
  const rcReset = useSubscriptionStore((state) => state.reset);
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const presentPaywall = useSubscriptionStore((state) => state.presentPaywall);
  const presentCustomerCenter = useSubscriptionStore(
    (state) => state.presentCustomerCenter,
  );
  const userProfileData = useUserProfileStore((state) => state.data);
  // Once a sponsor's work email is verified, their Company is locked — they've
  // vouched for that employer, so they can't silently swap it while keeping
  // verified status (mirrors the work-email lock).
  const workEmailVerified = useUserProfileStore(
    (state) => state.workEmailVerified,
  );
  const updatePersonal = useUserProfileStore((state) => state.updatePersonal);
  const updateProfessional = useUserProfileStore(
    (state) => state.updateProfessional,
  );
  const updateEducation = useUserProfileStore((state) => state.updateEducation);
  const updatePreferences = useUserProfileStore(
    (state) => state.updatePreferences,
  );
  const updateSkills = useUserProfileStore((state) => state.updateSkills);
  const updateWorkPreferencesStore = useUserProfileStore(
    (state) => state.updateWorkPreferences,
  );
  const updateDesiredRolesStore = useUserProfileStore(
    (state) => state.updateDesiredRoles,
  );
  const updateInsights = useUserProfileStore((state) => state.updateInsights);
  const updateCertifications = useUserProfileStore(
    (state) => state.updateCertifications,
  );
  const updateLanguages = useUserProfileStore((state) => state.updateLanguages);
  const updateAchievements = useUserProfileStore(
    (state) => state.updateAchievements,
  );
  const updateProfessionalExperiences = useUserProfileStore(
    (state) => state.updateProfessionalExperiences,
  );
  const updateEducationEntries = useUserProfileStore(
    (state) => state.updateEducationEntries,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditInsights, setShowEditInsights] = useState(false);
  const [showEditResume, setShowEditResume] = useState(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Resume upload state
  const [resumeUploadStep, setResumeUploadStep] = useState<
    "idle" | "uploading" | "analyzing" | "done" | "error"
  >("idle");
  const [resumeFieldsUpdated, setResumeFieldsUpdated] = useState<string[]>([]);
  const [resumeLastUpdated, setResumeLastUpdated] = useState<string | null>(
    null,
  );
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(
    null,
  );
  const [resumeElapsedSecs, setResumeElapsedSecs] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Editable profile state
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bio, setBio] = useState("");

  // Additional details (optional)
  const [achievements, setAchievements] = useState("");
  const [certifications, setCertifications] = useState<
    Array<{ name: string; organization: string; year: string }>
  >([]);
  const [languages, setLanguages] = useState<
    Array<{ language: string; proficiency: string }>
  >([]);

  // Professional fields (required for profile completion)
  const [jobTitle, setJobTitle] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [summary, setSummary] = useState("");

  // Education fields (required for profile completion)
  const [degree, setDegree] = useState("");
  const [major, setMajor] = useState("");
  const [university, setUniversity] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [gpa, setGpa] = useState("");

  // Multiple entries for professional experience and education
  const [professionalExperiences, setProfessionalExperiences] = useState<
    ProfessionalExperience[]
  >([]);
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>(
    [],
  );
  const [expandedExperience, setExpandedExperience] = useState<string | null>(
    null,
  );
  const [expandedEducation, setExpandedEducation] = useState<string | null>(
    null,
  );
  const [expandedCertification, setExpandedCertification] = useState<
    number | null
  >(null);
  const [expandedLanguage, setExpandedLanguage] = useState<number | null>(null);
  const [editingExperience, setEditingExperience] = useState<string | null>(
    null,
  );
  const [editingEducation, setEditingEducation] = useState<string | null>(null);

  // Work preferences (required for profile completion)
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [willingToRelocate, setWillingToRelocate] = useState("");
  const [requiresSponsorship, setRequiresSponsorship] = useState("");

  // Personal information fields (for edit profile modal). Only city/state
  // feed the "location" the app actually reads — see handleSaveLocation.
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Editable tags state
  const [expertise, setExpertise] = useState<string[]>([]);
  const [workPreferences, setWorkPreferences] = useState<string[]>([]);
  const [desiredRoles, setDesiredRoles] = useState<string[]>([]);

  // Profile insights state
  const [profileInsights, setProfileInsights] = useState<ProfileInsight[]>([]);

  // Temp states for editing
  const [tempValue, setTempValue] = useState("");
  const [newTag, setNewTag] = useState("");

  const showToast = useToastStore((state) => state.showToast);

  // Profile completeness check - recalculate when userProfileData changes
  const profileCompletion = useMemo(() => {
    if (!userProfileData || !userProfileData.personal) {
      return { isComplete: false, percentage: 0, missingFields: [] };
    }
    const result = checkProfileCompleteness(userProfileData, userType);
    return result;
  }, [userProfileData, userType]);

  // Mirror the swipe gate: incomplete = any required field still missing
  // (not a percentage threshold), so the banner/prompts and the gate agree.
  const hasIncompleteProfile = !profileCompletion.isComplete;

  useEffect(() => {
    // Mirror the store faithfully on every change — no truthy guards. The
    // previous version only called a setter when the store's value was
    // non-empty, which meant a field the user had just cleared (via
    // handleSaveField elsewhere, or a background sync catching up) could
    // never actually display as cleared: the local state just kept
    // whatever it last held. Store-side data integrity (deletions
    // reaching the backend, and a pending local edit not being clobbered
    // by an in-flight fetch) is handled in useUserProfileStore's dirty-
    // field tracking — this effect's only job is to reflect the store,
    // not to second-guess it.
    setFirstName(userProfileData.personal.firstName);
    setLastName(userProfileData.personal.lastName);
    setName(
      userProfileData.personal.fullName ||
        `${userProfileData.personal.firstName} ${userProfileData.personal.lastName}`.trim(),
    );
    setEmail(userProfileData.personal.email);
    // Prefer pendingWorkEmail (set when sponsor edits in the verification
    // modal) so the display stays current even before backend confirmation.
    setWorkEmail(userProfileData.personal.workEmail || pendingWorkEmail || "");
    setProfileImage(userProfileData.personal.profileImage || null);
    setCity(userProfileData.personal.address.city);
    setState(userProfileData.personal.address.state);
    setLocation(
      `${userProfileData.personal.address.city}${userProfileData.personal.address.state ? ", " + userProfileData.personal.address.state : ""}`,
    );

    setRole(userProfileData.professional.title);
    setJobTitle(userProfileData.professional.title);
    setCompany(userProfileData.professional.company);
    setBio(userProfileData.professional.summary);
    setSummary(userProfileData.professional.summary);
    setYearsExperience(userProfileData.professional.yearsExperience);
    setProfessionalExperiences(userProfileData.professional.experiences || []);

    setDegree(userProfileData.education.degree);
    setMajor(userProfileData.education.major);
    setUniversity(userProfileData.education.university);
    setGraduationYear(userProfileData.education.graduationYear);
    setGpa(userProfileData.education.gpa);
    setEducationEntries(userProfileData.education.entries || []);

    setWorkAuthorization(userProfileData.preferences.workAuthorization);
    setWillingToRelocate(userProfileData.preferences.willingToRelocate);
    setRequiresSponsorship(userProfileData.preferences.requiresSponsorship);

    setExpertise(userProfileData.skills);
    setProfileInsights(userProfileData.insights);
    setWorkPreferences(userProfileData.workPreferences || []);

    // desiredRoles falls back to seekingPosition only when genuinely
    // empty — a derivation between two backend-sourced values, not a
    // "prefer local over backend" guard, so it's kept as-is.
    setDesiredRoles(
      userProfileData.desiredRoles && userProfileData.desiredRoles.length > 0
        ? userProfileData.desiredRoles
        : userProfileData.professional.seekingPosition
          ? [userProfileData.professional.seekingPosition]
          : [],
    );

    setCertifications(userProfileData.certifications || []);
    setLanguages(userProfileData.languages || []);
    setAchievements(userProfileData.achievements);
  }, [userProfileData, pendingWorkEmail]);

  // Auto-save certifications when they change. Guarded against the store's
  // own value (not just emptiness) — updateCertifications() always writes a
  // new `data` object regardless of content, and the mirror-the-store effect
  // above calls setCertifications() on every `data` change (a new array
  // reference even when unchanged). Without this comparison, that pair
  // ping-pongs forever: store change -> setCertifications -> this effect
  // fires -> updateCertifications -> new store object -> repeat, hitting
  // React's "Maximum update depth exceeded" guard.
  useEffect(() => {
    if (JSON.stringify(certifications) === JSON.stringify(userProfileData.certifications ?? [])) {
      return;
    }
    updateCertifications(certifications);
  }, [certifications]);

  // Auto-save languages when they change — see the certifications effect
  // above for why this needs to compare against the store's current value
  // rather than just checking length.
  useEffect(() => {
    if (JSON.stringify(languages) === JSON.stringify(userProfileData.languages ?? [])) {
      return;
    }
    updateLanguages(languages);
  }, [languages]);

  // Load existing resume status on mount (applicant only)
  useEffect(() => {
    if (userType !== "applicant") return;
    console.log(
      "[Resume] 🔍 Fetching existing resume status (GET /api/resume/extracted-text/)...",
    );
    getExtractedResumeText()
      .then((r) => {
        console.log(
          "[Resume] ✅ Resume status response:",
          JSON.stringify(r, null, 2),
        );
        if (r.extracted_resume_text && r.updated_at)
          setResumeLastUpdated(r.updated_at);
        if (!r.extracted_resume_text) {
          console.log(
            "[Resume] ℹ️ No resume text on file yet — user hasn't uploaded a resume.",
          );
        } else {
          console.log(
            "[Resume] ℹ️ Existing resume text length:",
            r.extracted_resume_text.length,
            "chars. Last updated:",
            r.updated_at,
          );
        }
      })
      .catch((err) => {
        console.warn("[Resume] ⚠️ Could not fetch resume status:", err);
      });
  }, [userType]);

  const applicantData: ApplicantProfile = {
    name,
    role,
    location: `${city}${state ? ", " + state : ""}`,
    bio,
    expertiseLabel: "Skills & Interests",
    expertise,
    workPreferences,
    desiredRoles,
    achievements,
  };

  const sponsorData: SponsorProfile = {
    name,
    role,
    company,
    location: `${city}${state ? ", " + state : ""}`,
    bio,
    expertiseLabel: "I Can Help With",
    expertise,
  };

  const profileData = userType === "applicant" ? applicantData : sponsorData;

  const getUserInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (name) {
      const nameParts = name.trim().split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return null;
  };

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  // `valueOverride` lets autosave-on-blur screens (e.g. EditProfileScreen)
  // pass the field's current text directly, since they don't go through the
  // tap-to-edit `editingField`/`tempValue` flow the older modals used.
  const handleSaveField = async (field: string, valueOverride?: string) => {
    trackProfileFieldUpdated({ field });
    const rawValue = valueOverride !== undefined ? valueOverride : tempValue;
    // Validate + clean before persisting. Rejects clearly-bad input (a phone
    // that isn't a phone, a malformed link, an impossible year/GPA) with a
    // toast, and trims/collapses/caps everything else so a single field can't
    // break the UI or the DB. `valueToSave` replaces the raw tempValue below.
    const { ok, cleaned, error } = validateProfileField(field, rawValue);
    if (!ok) {
      showToast(error || "Please check this field and try again.", "error");
      return;
    }
    const valueToSave = cleaned;
    try {
      switch (field) {
        case "firstName":
          setFirstName(valueToSave);
          setName(`${valueToSave} ${lastName}`.trim());
          await updatePersonal({
            firstName: valueToSave,
            fullName: `${valueToSave} ${lastName}`.trim(),
          });
          await updateGeneralProfile({ first_name: valueToSave });
          break;
        case "lastName":
          setLastName(valueToSave);
          setName(`${firstName} ${valueToSave}`.trim());
          await updatePersonal({
            lastName: valueToSave,
            fullName: `${firstName} ${valueToSave}`.trim(),
          });
          await updateGeneralProfile({ last_name: valueToSave });
          break;
        case "role":
          setRole(valueToSave);
          await updateProfessional({ title: valueToSave });
          if (userType === "applicant") {
            await updateApplicantProfile({ current_role: valueToSave });
          } else {
            await updateSponsorProfile({ job_title: valueToSave });
          }
          break;
        case "company":
          // A verified sponsor's company is locked — the verified work email
          // vouches for it. Guard here too in case this is ever triggered
          // outside the (now hidden) inline editor.
          if (userType === "sponsor" && workEmailVerified) {
            setEditingField(null);
            setTempValue("");
            return;
          }
          setCompany(valueToSave);
          await updateProfessional({ company: valueToSave });
          if (userType === "sponsor") {
            await updateSponsorProfile({ company: valueToSave });
          }
          break;
        // email is read-only — changes require a dedicated change-email flow with verification
        case "bio":
          setBio(valueToSave);
          await updateProfessional({ summary: valueToSave });
          // API call for bio
          await updateGeneralProfile({ bio: valueToSave });
          break;
        case "achievements":
          setAchievements(valueToSave);
          await updateAchievements(valueToSave);
          if (userType === "applicant") {
            await updateApplicantProfile({ achievements: valueToSave });
          }
          break;
        case "jobTitle":
          setJobTitle(valueToSave);
          await updateProfessional({ title: valueToSave });
          if (userType === "applicant") {
            await updateApplicantProfile({ current_role: valueToSave });
          } else {
            await updateSponsorProfile({ job_title: valueToSave });
          }
          break;
        case "yearsExperience":
          setYearsExperience(valueToSave);
          await updateProfessional({ yearsExperience: valueToSave });
          // API call for years of experience - applicant only
          if (userType === "applicant") {
            await updateApplicantProfile({ years_experience: valueToSave });
          }
          break;
        case "summary":
          setSummary(valueToSave);
          await updateProfessional({ summary: valueToSave });
          // API call for summary/bio
          await updateGeneralProfile({ bio: valueToSave });
          break;
        case "degree":
          setDegree(valueToSave);
          await updateEducation({ degree: valueToSave });
          break;
        case "major":
          setMajor(valueToSave);
          await updateEducation({ major: valueToSave });
          break;
        case "university":
          setUniversity(valueToSave);
          await updateEducation({ university: valueToSave });
          break;
        case "graduationYear":
          setGraduationYear(valueToSave);
          await updateEducation({ graduationYear: valueToSave });
          break;
        case "gpa":
          setGpa(valueToSave);
          await updateEducation({ gpa: valueToSave });
          break;
        case "workAuthorization":
          setWorkAuthorization(valueToSave);
          await updatePreferences({ workAuthorization: valueToSave });
          if (userType === "applicant") {
            await updateApplicantProfile({ work_authorization: valueToSave });
          }
          break;
        case "willingToRelocate":
          setWillingToRelocate(valueToSave);
          await updatePreferences({ willingToRelocate: valueToSave });
          if (userType === "applicant") {
            await updateApplicantProfile({ willing_to_relocate: valueToSave });
          }
          break;
        case "requiresSponsorship":
          setRequiresSponsorship(valueToSave);
          await updatePreferences({ requiresSponsorship: valueToSave });
          if (userType === "applicant") {
            await updateApplicantProfile({ requires_sponsorship: valueToSave });
          }
          break;
        // city/state are saved as a combined "location" string —
        // see handleSaveLocation, used by EditProfileScreen's Location field.
        case "workEmail":
          // workEmail is now read-only in the editor — managed via onboarding.
          break;
      }
      setEditingField(null);
      setTempValue("");
      showToast("Profile updated.", "success");
    } catch (error) {
      console.warn("Failed to save field:", error);
      showToast("Failed to save changes. Please try again.", "error");
    }
  };

  // Location is a single "City, State" string, matching onboarding
  // (ApplicantQuestionnaire) exactly — the product only ever reads city for
  // matching/display (see utils/profileCompletion.ts), so there's no
  // separate street/zip/country to save here.
  const handleSaveLocation = async (value: string) => {
    const trimmed = value.trim();
    const [cityPart, statePart] = trimmed.split(",").map((s) => s.trim());
    try {
      setCity(cityPart || "");
      setState(statePart || "");
      setLocation(trimmed);
      await updateGeneralProfile({ location: trimmed });
      showToast("Profile updated.", "success");
    } catch (error) {
      console.warn("Failed to save location:", error);
      showToast("Failed to save changes. Please try again.", "error");
    }
  };

  const handleAddTag = async (
    type: "expertise" | "workPreferences" | "desiredRoles",
    skillValue?: string,
  ) => {
    const valueToAdd = skillValue || newTag.trim();
    if (!valueToAdd) return;

    switch (type) {
      case "expertise":
        if (expertise.length >= 5) {
          showToast("You can add a maximum of 5 skills.", "info");
          return;
        }
        if (expertise.includes(valueToAdd)) {
          showToast("That skill has already been added.", "info");
          setNewTag("");
          return;
        }
        const newExpertise = [...expertise, valueToAdd];
        setExpertise(newExpertise);
        await updateSkills(newExpertise);
        if (userType === "applicant") {
          await updateApplicantProfile({ skills: newExpertise });
        } else {
          await updateSponsorProfile({ skills: newExpertise });
        }
        break;
      case "workPreferences": {
        const newWorkPreferences = [...workPreferences, valueToAdd];
        setWorkPreferences(newWorkPreferences);
        await updateWorkPreferencesStore(newWorkPreferences);
        if (userType === "applicant") {
          await updateApplicantProfile({
            work_preferences: newWorkPreferences,
          });
        }
        break;
      }
      case "desiredRoles": {
        if (desiredRoles.length >= 3) {
          showToast("You can add a maximum of 3 desired roles.", "info");
          return;
        }
        if (desiredRoles.includes(valueToAdd)) {
          showToast("That role has already been added.", "info");
          setNewTag("");
          return;
        }
        const newDesiredRoles = [...desiredRoles, valueToAdd];
        setDesiredRoles(newDesiredRoles);
        await updateDesiredRolesStore(newDesiredRoles);
        if (userType === "applicant") {
          await updateApplicantProfile({ desired_roles: newDesiredRoles });
        }
        break;
      }
    }
    setNewTag("");
  };

  const handleToggleWorkPreference = async (preference: string) => {
    const updated = workPreferences.includes(preference)
      ? workPreferences.filter((p) => p !== preference)
      : [...workPreferences, preference];
    setWorkPreferences(updated);
    await updateWorkPreferencesStore(updated);
    if (userType === "applicant") {
      await updateApplicantProfile({ work_preferences: updated });
    }
  };

  const handleRemoveTag = async (
    type: "expertise" | "workPreferences" | "desiredRoles",
    index: number,
  ) => {
    switch (type) {
      case "expertise": {
        const updatedExpertise = expertise.filter((_, i) => i !== index);
        setExpertise(updatedExpertise);
        await updateSkills(updatedExpertise);
        if (userType === "applicant") {
          await updateApplicantProfile({ skills: updatedExpertise });
        } else {
          await updateSponsorProfile({ skills: updatedExpertise });
        }
        break;
      }
      case "workPreferences": {
        const updatedWorkPrefs = workPreferences.filter((_, i) => i !== index);
        setWorkPreferences(updatedWorkPrefs);
        await updateWorkPreferencesStore(updatedWorkPrefs);
        if (userType === "applicant") {
          await updateApplicantProfile({ work_preferences: updatedWorkPrefs });
        }
        break;
      }
      case "desiredRoles": {
        const updatedRoles = desiredRoles.filter((_, i) => i !== index);
        setDesiredRoles(updatedRoles);
        await updateDesiredRolesStore(updatedRoles);
        if (userType === "applicant") {
          await updateApplicantProfile({ desired_roles: updatedRoles });
        }
        break;
      }
    }
  };

  // Single source of truth for the prompts editor — PromptsIntake hands back
  // the full array; we persist it (locally + backend, role-specific). Optimistic
  // local update; revert on failure.
  const handleInsightsChange = async (next: ProfileInsight[]) => {
    const prev = profileInsights;
    setProfileInsights(next);
    try {
      await updateInsights(next);
      if (userType === "applicant") {
        await updateApplicantProfile({ insights: next });
      } else {
        await updateSponsorProfile({ insights: next });
      }
    } catch (error) {
      console.warn("Failed to save insights:", error);
      setProfileInsights(prev);
      showToast("Failed to save. Please try again.", "error");
    }
  };

  // Handlers for Professional Experiences
  const handleAddExperience = async () => {
    try {
      const newExperience: ProfessionalExperience = {
        id: Date.now().toString(),
        jobTitle: "",
        company: "",
        startDate: "",
        endDate: "",
        current: false,
        description: "",
      };
      const updated = [...professionalExperiences, newExperience];
      setProfessionalExperiences(updated);
      setExpandedExperience(newExperience.id);
      setEditingExperience(newExperience.id);
      await updateProfessionalExperiences(updated);
    } catch (error) {
      console.warn("Failed to add experience:", error);
      showToast("Failed to add experience. Please try again.", "error");
    }
  };

  const handleUpdateExperience = async (
    id: string,
    updates: Partial<ProfessionalExperience>,
  ) => {
    try {
      const updated = professionalExperiences.map((exp) =>
        exp.id === id ? { ...exp, ...updates } : exp,
      );
      setProfessionalExperiences(updated);
      await updateProfessionalExperiences(updated);

      // API call to sync with backend - applicant only
      if (userType === "applicant") {
        const professional_experiences = updated.map((exp) => ({
          jobTitle: exp.jobTitle,
          company: exp.company,
          startDate: exp.startDate,
          endDate: exp.current ? undefined : exp.endDate || undefined,
          description: exp.description || "",
          current: exp.current,
        }));
        await updateApplicantProfile({ professional_experiences });
      }
    } catch (error) {
      console.warn("Failed to update experience:", error);
      showToast("Failed to save experience. Please try again.", "error");
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      const updated = professionalExperiences.filter((exp) => exp.id !== id);
      setProfessionalExperiences(updated);
      await updateProfessionalExperiences(updated);

      // API call to sync with backend - applicant only
      if (userType === "applicant") {
        const professional_experiences = updated.map((exp) => ({
          jobTitle: exp.jobTitle,
          company: exp.company,
          startDate: exp.startDate,
          endDate: exp.current ? undefined : exp.endDate || undefined,
          description: exp.description || "",
          current: exp.current,
        }));
        await updateApplicantProfile({ professional_experiences });
      }
    } catch (error) {
      console.warn("Failed to delete experience:", error);
      showToast("Failed to delete experience. Please try again.", "error");
    }
  };

  // Handlers for Education Entries
  const handleAddEducation = async () => {
    try {
      const newEducation: EducationEntry = {
        id: Date.now().toString(),
        degree: "",
        major: "",
        university: "",
        graduationYear: "",
        gpa: "",
      };
      const updated = [...educationEntries, newEducation];
      setEducationEntries(updated);
      setExpandedEducation(newEducation.id);
      setEditingEducation(newEducation.id);
      await updateEducationEntries(updated);
    } catch (error) {
      console.warn("Failed to add education:", error);
      showToast("Failed to add education. Please try again.", "error");
    }
  };

  const handleUpdateEducation = async (
    id: string,
    updates: Partial<EducationEntry>,
  ) => {
    try {
      const updated = educationEntries.map((edu) =>
        edu.id === id ? { ...edu, ...updates } : edu,
      );
      setEducationEntries(updated);
      await updateEducationEntries(updated);

      // API call to sync with backend - applicant only
      if (userType === "applicant") {
        const education_entries = updated.map((edu) => ({
          degree: edu.degree,
          major: edu.major,
          university: edu.university,
          graduationYear: edu.graduationYear,
          gpa: edu.gpa,
        }));
        await updateApplicantProfile({ education_entries });
      }
    } catch (error) {
      console.warn("Failed to update education:", error);
      showToast("Failed to save education. Please try again.", "error");
    }
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      const updated = educationEntries.filter((edu) => edu.id !== id);
      setEducationEntries(updated);
      await updateEducationEntries(updated);

      // API call to sync with backend - applicant only
      if (userType === "applicant") {
        const education_entries = updated.map((edu) => ({
          degree: edu.degree,
          major: edu.major,
          university: edu.university,
          graduationYear: edu.graduationYear,
          gpa: edu.gpa,
        }));
        await updateApplicantProfile({ education_entries });
      }
    } catch (error) {
      console.warn("Failed to delete education:", error);
      showToast("Failed to delete education. Please try again.", "error");
    }
  };

  // Handlers for Certifications
  const handleAddCertification = () => {
    const newCert = { name: "", organization: "", year: "" };
    const updated = [...certifications, newCert];
    setCertifications(updated);
    setExpandedCertification(updated.length - 1);
  };

  const handleUpdateCertification = (
    index: number,
    updates: Partial<{ name: string; organization: string; year: string }>,
  ) => {
    const updated = certifications.map((cert, i) =>
      i === index ? { ...cert, ...updates } : cert,
    );
    setCertifications(updated);
  };

  const handleDeleteCertification = (index: number) => {
    const updated = certifications.filter((_, i) => i !== index);
    setCertifications(updated);
    if (expandedCertification === index) {
      setExpandedCertification(null);
    }
  };

  // Handlers for Languages
  const handleAddLanguage = () => {
    const newLang = { language: "", proficiency: "" };
    const updated = [...languages, newLang];
    setLanguages(updated);
    setExpandedLanguage(updated.length - 1);
  };

  const handleUpdateLanguage = (
    index: number,
    updates: Partial<{ language: string; proficiency: string }>,
  ) => {
    const updated = languages.map((lang, i) =>
      i === index ? { ...lang, ...updates } : lang,
    );
    setLanguages(updated);
  };

  const handleDeleteLanguage = (index: number) => {
    const updated = languages.filter((_, i) => i !== index);
    setLanguages(updated);
    if (expandedLanguage === index) {
      setExpandedLanguage(null);
    }
  };

  // Render Certification Card
  const renderCertificationCard = (
    cert: { name: string; organization: string; year: string },
    index: number,
  ) => {
    const isExpanded = expandedCertification === index;

    // Validation for required fields
    const isNameMissing = !cert.name?.trim();
    const isOrgMissing = !cert.organization?.trim();
    const isYearMissing = !cert.year?.trim();
    const hasRequiredFields = !isNameMissing && !isOrgMissing && !isYearMissing;

    const handleSaveCertification = async () => {
      if (!hasRequiredFields) {
        showToast(
          "Please fill in Certification Name, Organization, and Year before saving.",
          "error",
        );
        return;
      }
      setExpandedCertification(null);
      await updateCertifications(certifications);
      if (userType === "applicant") {
        await updateApplicantProfile({ certifications });
      }
    };

    return (
      <View key={index} style={styles.entryCard}>
        <TouchableOpacity
          style={styles.entryCardHeader}
          onPress={() => setExpandedCertification(isExpanded ? null : index)}
          activeOpacity={0.7}
        >
          <View style={styles.entryCardTitle}>
            <Text style={styles.entryCardMainText}>
              {cert.name || "New Certification"}
            </Text>
            <Text style={styles.entryCardSubText}>
              {cert.organization || "Organization"}
              {cert.year && ` • ${cert.year}`}
            </Text>
          </View>
          <View style={styles.entryCardActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteCertification(index);
              }}
              style={{ padding: 4 }}
            >
              <Trash2 size={18} color="#666" />
            </TouchableOpacity>
            <ChevronRight
              color="#666"
              size={20}
              style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.entryCardContent}>
            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>CERTIFICATION NAME</Text>
                {isNameMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isNameMissing && { borderColor: "#FECACA", borderWidth: 2 },
                ]}
                value={cert.name}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateCertification(index, { name: text })
                }
                placeholder="e.g., AWS Solutions Architect"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>ORGANIZATION</Text>
                {isOrgMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isOrgMissing && { borderColor: "#FECACA", borderWidth: 2 },
                ]}
                value={cert.organization}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateCertification(index, { organization: text })
                }
                placeholder="e.g., Amazon Web Services"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>YEAR OBTAINED</Text>
                {isYearMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isYearMissing && { borderColor: "#FECACA", borderWidth: 2 },
                ]}
                value={cert.year}
                autoCapitalize="none"
                onChangeText={(text) =>
                  handleUpdateCertification(index, { year: text })
                }
                placeholder="e.g., 2023"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.blackBtn,
                {
                  width: "100%",
                  justifyContent: "center",
                  borderWidth: 0,
                  marginTop: 8,
                },
              ]}
              onPress={handleSaveCertification}
            >
              <Check color="#FFF" size={18} />
              <Text style={styles.blackBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render Language Card
  const renderLanguageCard = (
    lang: { language: string; proficiency: string },
    index: number,
  ) => {
    const isExpanded = expandedLanguage === index;

    // Validation for required fields
    const isLanguageMissing = !lang.language?.trim();
    const isProficiencyMissing = !lang.proficiency?.trim();
    const hasRequiredFields = !isLanguageMissing && !isProficiencyMissing;

    const handleSaveLanguage = async () => {
      if (!hasRequiredFields) {
        showToast(
          "Please fill in Language and Proficiency Level before saving.",
          "error",
        );
        return;
      }
      setExpandedLanguage(null);
      await updateLanguages(languages);
      if (userType === "applicant") {
        await updateApplicantProfile({ languages });
      }
    };

    return (
      <View key={index} style={styles.entryCard}>
        <TouchableOpacity
          style={styles.entryCardHeader}
          onPress={() => setExpandedLanguage(isExpanded ? null : index)}
          activeOpacity={0.7}
        >
          <View style={styles.entryCardTitle}>
            <Text style={styles.entryCardMainText}>
              {lang.language || "New Language"}
            </Text>
            <Text style={styles.entryCardSubText}>
              {lang.proficiency || "Proficiency Level"}
            </Text>
          </View>
          <View style={styles.entryCardActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteLanguage(index);
              }}
              style={{ padding: 4 }}
            >
              <Trash2 size={18} color="#666" />
            </TouchableOpacity>
            <ChevronRight
              color="#666"
              size={20}
              style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.entryCardContent}>
            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>LANGUAGE</Text>
                {isLanguageMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isLanguageMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={lang.language}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateLanguage(index, { language: text })
                }
                placeholder="e.g., Spanish"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>PROFICIENCY LEVEL</Text>
                {isProficiencyMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isProficiencyMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={lang.proficiency}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateLanguage(index, { proficiency: text })
                }
                placeholder="e.g., Native, Fluent, Conversational"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.blackBtn,
                {
                  width: "100%",
                  justifyContent: "center",
                  borderWidth: 0,
                  marginTop: 8,
                },
              ]}
              onPress={handleSaveLanguage}
            >
              <Check color="#FFF" size={18} />
              <Text style={styles.blackBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Image picker functions
  const requestPermissions = async (type: "camera" | "gallery") => {
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take photos.",
        );
        return false;
      }
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Gallery permission is needed to select photos.",
        );
        return false;
      }
    }
    return true;
  };

  // Single entry point for opening the photo picker (used by both the avatar
  // and the FAB). Breadcrumbs the tap plus whether any OTHER modal is already
  // presented — that's the iOS "two modals at once" race that can silently
  // swallow the picker's presentation. If a tester reports the picker not
  // opening, this trail shows whether a stale modal was up at the time.
  const openImagePicker = () => {
    const otherModalOpen =
      showEditProfile ||
      showEditResume ||
      showLogoutModal ||
      showEditInsights ||
      showPrivacySecurity ||
      showNotifications;
    logBreadcrumb("profile_photo: open picker tapped", {
      hasPhoto: !!profileImage,
      pickerAlreadyOpen: showImagePickerModal,
      otherModalOpen,
    });
    setShowImagePickerModal(true);
  };

  const pickImage = async () => {
    logBreadcrumb("profile_photo: pick from library");
    const hasPermission = await requestPermissions("gallery");
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      trackProfilePhotoUploaded({ source: "library" });
      handleImageSelected(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    logBreadcrumb("profile_photo: take photo (camera)");
    const hasPermission = await requestPermissions("camera");
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      trackProfilePhotoUploaded({ source: "camera" });
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handleImageSelected = async (uri: string) => {
    // Show local preview immediately so the UI feels responsive
    setProfileImage(uri);
    updatePersonal({ profileImage: uri });
    setShowImagePickerModal(false);
    try {
      console.log("[ProfileImage] 📤 Starting upload — local URI:", uri);
      const form = new FormData();
      form.append("image", {
        uri,
        name: "photo.jpg",
        type: "image/jpeg",
        // RN's FormData accepts {uri,name,type} file descriptors but the
        // web-typed lib.dom signature doesn't know that — cast required.
      } as any);
      // POST /api/upload/image/ → DigitalOcean Spaces CDN, always returns cdn_url
      const uploadResult = await uploadProfileImage(form);
      console.log(
        "[ProfileImage] ✅ Upload success — full response:",
        JSON.stringify(uploadResult, null, 2),
      );
      const { cdn_url } = uploadResult;
      // Persist CDN URL to the DB and replace local preview with the permanent URL
      const patchResult = await updateGeneralProfile({ photo_url: cdn_url });
      console.log(
        "[ProfileImage] ✅ Profile PATCH success — updated_fields:",
        patchResult.updated_fields,
        "cdn_url saved:",
        cdn_url,
      );
      updatePersonal({ profileImage: cdn_url });
      setProfileImage(cdn_url);
      showToast("Profile photo updated.", "success");
    } catch (err) {
      console.warn("[ProfileImage] ❌ Failed to upload profile photo:", err);
      Sentry.captureException(err, {
        tags: { feature: "profile_photo_upload" },
      });
      showToast("Failed to upload photo. Please try again.", "error");
    }
  };

  // ── Resume helpers ──────────────────────────────────────────────────────────

  /** Stop the elapsed-seconds ticker and clean up the ref. */
  const stopElapsedTimer = () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  /** Cancel an in-progress resume upload/classify and return to idle. */
  const cancelResumeUpload = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopElapsedTimer();
    setResumeElapsedSecs(0);
    setResumeUploadStep("idle");
  };

  const formatRelativeTime = (isoString: string): string => {
    // Normalize to UTC: backends often omit the timezone suffix, causing JS to
    // parse as local time and producing negative diffs for users behind UTC.
    const t = isoString.trim();
    const normalized =
      /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t)
        ? isoString
        : `${isoString}Z`;
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    // Guard against clock skew / future timestamps.
    if (diffMs < 0) return "just now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFieldName = (field: string): string =>
    field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleResumeUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        console.log("[Resume] ℹ️ File picker cancelled or no file selected.");
        return;
      }

      const file = result.assets[0];
      console.log("[Resume] 📄 File selected:", {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        uri: file.uri,
      });

      // Fresh abort controller for this upload session
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start elapsed-seconds ticker
      setResumeElapsedSecs(0);
      elapsedTimerRef.current = setInterval(() => {
        setResumeElapsedSecs((s) => s + 1);
      }, 1000);

      // Wraps any promise with a hard timeout so the UI never spins forever.
      const withTimeout = <T,>(
        promise: Promise<T>,
        ms: number,
        label: string,
      ): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `${label} is taking too long (>${ms / 1000}s). The server may be busy — please try again.`,
                  ),
                ),
              ms,
            ),
          ),
        ]);

      setResumeUploadStep("uploading");
      setResumeUploadError(null);
      trackResumeReuploaded();

      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/pdf",
        // RN FormData file descriptor — see the image upload above.
      } as any);
      console.log("[Resume] 📤 Uploading to POST /api/upload-and-parse/ ...");
      // 60s timeout for upload + Snowflake text extraction
      const parseResult = await withTimeout(
        uploadAndParseResume(form, controller.signal),
        60_000,
        "Resume upload",
      );
      console.log("[Resume] ✅ Upload+parse response:", {
        message: parseResult.message,
        parsing_error: parseResult.parsing_error,
        extracted_text_length: parseResult.extracted_text?.length ?? 0,
        extracted_text_preview: parseResult.extracted_text?.slice(0, 200),
      });

      // The backend returns HTTP 201 even when text extraction fails
      // (extracted_text will be null). Use parsing_error to surface a relevant
      // message: transient service errors → "try again"; format errors → PDF hint.
      if (!parseResult.extracted_text) {
        const serverMsg: string | undefined =
          parseResult.parsing_error ?? undefined;
        console.warn(
          "[Resume] ❌ Text extraction failed — extracted_text is null. parsing_error:",
          serverMsg,
        );
        const isServiceError =
          serverMsg?.includes("please try again") ||
          serverMsg?.includes("unavailable") ||
          serverMsg?.includes("configured");
        throw new Error(
          isServiceError
            ? `Resume uploaded but text could not be read — ${serverMsg}`
            : "Resume uploaded but text extraction failed. Please try a PDF with selectable (non-scanned) text.",
        );
      }

      setResumeUploadStep("analyzing");
      console.log("[Resume] 🤖 Calling POST /api/resume/classify/ ...");
      // 120s timeout for AI classification (Snowflake Cortex can be slow)
      const classifyResult = await withTimeout(
        classifyResume(controller.signal),
        120_000,
        "AI analysis",
      );
      console.log("[Resume] ✅ Classify response:", {
        message: classifyResult.message,
        applicant_fields_updated: classifyResult.applicant_fields_updated,
        user_fields_updated: classifyResult.user_fields_updated,
        classified_data: classifyResult.classified_data,
      });

      stopElapsedTimer();
      setResumeElapsedSecs(0);
      abortControllerRef.current = null;

      const allUpdated = [
        ...(classifyResult.applicant_fields_updated || []),
        ...(classifyResult.user_fields_updated || []),
      ];
      console.log("[Resume] ✅ Total fields populated by AI:", allUpdated);
      setResumeFieldsUpdated(allUpdated);
      setResumeUploadStep("done");
      setResumeLastUpdated(new Date().toISOString());

      // Refresh the store so AI-updated fields appear immediately
      console.log(
        "[Resume] 🔄 Refreshing profile from backend to reflect AI-updated fields...",
      );
      await fetchFromBackend();
      console.log("[Resume] ✅ Profile refresh complete.");

      // ── DISPLAY STATE SNAPSHOT ───────────────────────────────────────────
      // What the UI will actually render after the refresh
      const { data: stored } = useUserProfileStore.getState();
      console.log("[Resume] 🖥️ DISPLAY STATE — what the UI will show:");
      console.log(
        "[Resume]   👤 Identity:",
        JSON.stringify(
          {
            firstName: stored.personal.firstName,
            lastName: stored.personal.lastName,
            email: stored.personal.email,
            phone: stored.personal.phone,
            portfolio: stored.personal.portfolio,
            profileImage: stored.personal.profileImage,
            city: stored.personal.address?.city,
            state: stored.personal.address?.state,
          },
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   💼 Professional summary:",
        JSON.stringify(
          {
            currentRole: stored.professional.currentRole,
            title: stored.professional.title,
            yearsExperience: stored.professional.yearsExperience,
            targetIndustry: stored.professional.targetIndustry,
            bio: stored.professional.summary,
            achievements: stored.achievements,
          },
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🏢 Work experiences (" +
          stored.professional.experiences.length +
          " entries):",
        JSON.stringify(
          stored.professional.experiences.map((e, i) => ({
            "#": i + 1,
            jobTitle: e.jobTitle,
            company: e.company,
            startDate: e.startDate,
            endDate: e.endDate,
            current: e.current,
            description:
              e.description?.slice(0, 80) +
              (e.description?.length > 80 ? "..." : ""),
          })),
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🎓 Education entries (" +
          stored.education.entries.length +
          " entries):",
        JSON.stringify(
          stored.education.entries.map((e, i) => ({
            "#": i + 1,
            degree: e.degree,
            major: e.major,
            university: e.university,
            graduationYear: e.graduationYear,
            gpa: e.gpa,
          })),
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🛠️ Skills (" + stored.skills.length + " items):",
        stored.skills,
      );
      console.log(
        "[Resume]   📜 Certifications (" +
          stored.certifications.length +
          " entries):",
        JSON.stringify(stored.certifications, null, 2),
      );
      console.log(
        "[Resume]   🗣️ Languages (" + stored.languages.length + " entries):",
        JSON.stringify(stored.languages, null, 2),
      );
      // ─────────────────────────────────────────────────────────────────────
    } catch (err) {
      stopElapsedTimer();
      setResumeElapsedSecs(0);
      abortControllerRef.current = null;
      const errName = err instanceof Error ? err.name : "";
      const errMessage = err instanceof Error ? err.message : "";

      // User pressed Cancel — abort silently, return to idle
      if (errName === "AbortError") {
        console.log("[Resume] ℹ️ Upload cancelled by user.");
        setResumeUploadStep("idle");
        return;
      }

      console.warn(
        "[Resume] ❌ Resume upload pipeline failed:",
        errMessage,
        err,
      );
      // The résumé pipeline (upload → parse → AI classify → refetch) is the
      // applicant onboarding centerpiece and has the most moving parts —
      // failures here should page the dashboard, not just show a toast.
      Sentry.captureException(err, { tags: { flow: "resume_upload" } });
      setResumeUploadStep("error");
      setResumeUploadError(errMessage || "Upload failed. Please try again.");
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    trackLogout();
    // Reset Mixpanel identity so subsequent events on this device aren't
    // attributed to the previous user.
    resetUser();
    // Log out of RevenueCat so the device reverts to an anonymous RC customer.
    rcReset();
    // Deactivate push token on the backend so no more notifications are
    // delivered to this device after logout.
    if (deviceToken) {
      try {
        await unregisterDevice(deviceToken);
      } catch (err) {
        console.warn("[ProfileView] Failed to unregister device token:", err);
        // Non-fatal — proceed with logout regardless.
      }
    }
    // Cancel the locally-scheduled "your deck is ready" / unfinished-deck
    // reminders too — those are on-device schedules, not backend push, so
    // unregistering the device token alone wouldn't stop them. Same for the
    // referral check-in nudge — without this, a logged-out device (or the
    // next user who logs into it) could still get "check in on your
    // referral" notifications scheduled under the previous session.
    cancelDailyDeckReminder();
    cancelUnfinishedDeckReminder();
    cancelCheckInNudges(userType);
    try {
      // Call backend logout to invalidate session
      await logout();
    } catch (error) {
      console.warn("[ProfileView] Backend logout failed:", error);
      // Continue with local logout even if backend call fails
    }
    // Clear local auth state and user data
    await clearAuth();
    await clearUserProfileData();
    // Reset all user-specific store state so the next login starts fresh.
    // Without this, card index, job lists, and onboarding data from the
    // previous session bleed into the new user's experience.
    resetJobsStore();
    clearOnboarding();
    router.replace("/splash");
  };

  // Runs AFTER PrivacySecurityScreen's delete step has confirmed the
  // password and the backend has permanently purged the account (POST
  // /api/account/delete/ — the real deletion Apple 5.1.1(v) requires, not
  // the old reversible deactivate). Everything here is local teardown; the
  // server side — including the device-token rows and CDN files — is
  // already gone, so no unregisterDevice call is needed (and it would fail
  // against a purged account anyway).
  const handleAccountDeleted = async () => {
    setShowPrivacySecurity(false);
    // Cancel every on-device schedule the same way logout does — without
    // this, re-registering on this device inherits the deleted account's
    // deck reminders and check-in nudges.
    cancelDailyDeckReminder();
    cancelUnfinishedDeckReminder();
    cancelCheckInNudges(userType);
    trackAccountDeleted();
    resetUser();
    rcReset();
    await clearAuth();
    await clearUserProfileData();
    // Parity with logout — reset jobs store + onboarding data so a
    // re-registration on this device doesn't inherit deck state
    // (card index, session likes/matches) from the deleted account.
    resetJobsStore();
    clearOnboarding();
    router.replace("/splash");
  };

  // Helper to count missing fields by category
  const getMissingFieldsCount = (category: "personal" | "professional") => {
    if (!profileCompletion) return 0;
    return profileCompletion.missingFields.filter((f) => {
      if (category === "personal") {
        return f.category === "Personal Information";
      } else {
        return f.category !== "Personal Information";
      }
    }).length;
  };

  const personalMissingCount = getMissingFieldsCount("personal");
  const professionalMissingCount = getMissingFieldsCount("professional");

  // Helper to check if a specific field is missing
  const isFieldMissing = (fieldKey: string) => {
    if (!profileCompletion) return false;
    return profileCompletion.missingFields.some((f) => f.field === fieldKey);
  };

  // Render Professional Experience Entry Card
  const renderExperienceCard = (experience: ProfessionalExperience) => {
    const isExpanded = expandedExperience === experience.id;
    const isEditing = editingExperience === experience.id;

    // Validation for required fields
    const isJobTitleMissing = !experience.jobTitle?.trim();
    const isCompanyMissing = !experience.company?.trim();
    const isStartDateMissing = !experience.startDate?.trim();
    const hasRequiredFields =
      !isJobTitleMissing && !isCompanyMissing && !isStartDateMissing;

    const handleSaveExperience = () => {
      if (!hasRequiredFields) {
        showToast(
          "Please fill in Job Title, Company, and Start Date before saving.",
          "error",
        );
        return;
      }
      setExpandedExperience(null);
    };

    return (
      <View key={experience.id} style={styles.entryCard}>
        <TouchableOpacity
          style={styles.entryCardHeader}
          onPress={() =>
            setExpandedExperience(isExpanded ? null : experience.id)
          }
          activeOpacity={0.7}
        >
          <View style={styles.entryCardTitle}>
            <Text style={styles.entryCardMainText}>
              {experience.jobTitle || "New Position"}
            </Text>
            <Text style={styles.entryCardSubText}>
              {experience.company || "Company Name"}
              {experience.startDate && ` • ${experience.startDate}`}
              {experience.current && " - Present"}
              {!experience.current &&
                experience.endDate &&
                ` - ${experience.endDate}`}
            </Text>
          </View>
          <View style={styles.entryCardActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteExperience(experience.id);
              }}
              style={{ padding: 4 }}
            >
              <Trash2 size={18} color="#666" />
            </TouchableOpacity>
            <ChevronRight
              color="#666"
              size={20}
              style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.entryCardContent}>
            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>JOB TITLE</Text>
                {isJobTitleMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isJobTitleMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={experience.jobTitle}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateExperience(experience.id, { jobTitle: text })
                }
                placeholder="e.g., Senior Product Manager"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>COMPANY</Text>
                {isCompanyMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isCompanyMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={experience.company}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateExperience(experience.id, { company: text })
                }
                placeholder="e.g., Google"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>START DATE</Text>
                {isStartDateMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isStartDateMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={experience.startDate}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateExperience(experience.id, { startDate: text })
                }
                placeholder="e.g., Jan 2022"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.checkboxRow}>
              <Switch
                value={experience.current}
                onValueChange={(value) =>
                  handleUpdateExperience(experience.id, {
                    current: value,
                    endDate: value ? "" : experience.endDate,
                  })
                }
                {...SWITCH_COLORS}
              />
              <Text style={styles.checkboxLabel}>I currently work here</Text>
            </View>

            {!experience.current && (
              <View style={styles.entryFieldRow}>
                <Text style={styles.entryFieldLabel}>END DATE</Text>
                <TextInput
                  style={styles.entryFieldInput}
                  value={experience.endDate}
                  autoCapitalize="words"
                  onChangeText={(text) =>
                    handleUpdateExperience(experience.id, { endDate: text })
                  }
                  placeholder="e.g., Dec 2024"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            <View style={styles.entryFieldRow}>
              <Text style={styles.entryFieldLabel}>JOB DESCRIPTION</Text>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  { minHeight: 100, textAlignVertical: "top" },
                ]}
                value={experience.description}
                autoCapitalize="sentences"
                onChangeText={(text) =>
                  handleUpdateExperience(experience.id, { description: text })
                }
                placeholder="Describe your responsibilities and achievements..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.blackBtn,
                {
                  width: "100%",
                  justifyContent: "center",
                  borderWidth: 0,
                  marginTop: 8,
                },
              ]}
              onPress={handleSaveExperience}
            >
              <Check color="#FFF" size={18} />
              <Text style={styles.blackBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render Education Entry Card
  const renderEducationCard = (education: EducationEntry) => {
    const isExpanded = expandedEducation === education.id;

    // Validation for required fields
    const isDegreeMissing = !education.degree?.trim();
    const isUniversityMissing = !education.university?.trim();
    const isGradYearMissing = !education.graduationYear?.trim();
    const hasRequiredFields =
      !isDegreeMissing && !isUniversityMissing && !isGradYearMissing;

    const handleSaveEducation = () => {
      if (!hasRequiredFields) {
        showToast(
          "Please fill in Degree, University, and Graduation Year before saving.",
          "error",
        );
        return;
      }
      setExpandedEducation(null);
    };

    return (
      <View key={education.id} style={styles.entryCard}>
        <TouchableOpacity
          style={styles.entryCardHeader}
          onPress={() => setExpandedEducation(isExpanded ? null : education.id)}
          activeOpacity={0.7}
        >
          <View style={styles.entryCardTitle}>
            <Text style={styles.entryCardMainText}>
              {education.degree || "New Degree"}
            </Text>
            <Text style={styles.entryCardSubText}>
              {education.university || "University Name"}
              {education.major && ` • ${education.major}`}
              {education.graduationYear && ` • ${education.graduationYear}`}
            </Text>
          </View>
          <View style={styles.entryCardActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteEducation(education.id);
              }}
              style={{ padding: 4 }}
            >
              <Trash2 size={18} color="#666" />
            </TouchableOpacity>
            <ChevronRight
              color="#666"
              size={20}
              style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.entryCardContent}>
            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>DEGREE</Text>
                {isDegreeMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isDegreeMissing && { borderColor: "#FECACA", borderWidth: 2 },
                ]}
                value={education.degree}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateEducation(education.id, { degree: text })
                }
                placeholder="e.g., Bachelor of Science, MBA"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <Text style={styles.entryFieldLabel}>MAJOR / FIELD OF STUDY</Text>
              <TextInput
                style={styles.entryFieldInput}
                value={education.major}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateEducation(education.id, { major: text })
                }
                placeholder="e.g., Computer Science"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>UNIVERSITY</Text>
                {isUniversityMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isUniversityMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={education.university}
                autoCapitalize="words"
                onChangeText={(text) =>
                  handleUpdateEducation(education.id, { university: text })
                }
                placeholder="e.g., Stanford University"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={styles.entryFieldLabel}>GRADUATION YEAR</Text>
                {isGradYearMissing && (
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    *REQUIRED
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.entryFieldInput,
                  isGradYearMissing && {
                    borderColor: "#FECACA",
                    borderWidth: 2,
                  },
                ]}
                value={education.graduationYear}
                autoCapitalize="none"
                onChangeText={(text) =>
                  handleUpdateEducation(education.id, { graduationYear: text })
                }
                placeholder="e.g., 2020"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.entryFieldRow}>
              <Text style={styles.entryFieldLabel}>GPA (OPTIONAL)</Text>
              <TextInput
                style={styles.entryFieldInput}
                value={education.gpa}
                autoCapitalize="none"
                onChangeText={(text) =>
                  handleUpdateEducation(education.id, { gpa: text })
                }
                placeholder="e.g., 3.9"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.blackBtn,
                {
                  width: "100%",
                  justifyContent: "center",
                  borderWidth: 0,
                  marginTop: 8,
                },
              ]}
              onPress={handleSaveEducation}
            >
              <Check color="#FFF" size={18} />
              <Text style={styles.blackBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // "Finish Your Profile" coaching rows — one per item profileCompletion
  // flags as missing, each deep-linking to the exact screen that fixes it,
  // plus a prompts nudge (not part of the official completion calculation,
  // since PromptsIntake enforces its own 2-minimum, but still worth
  // surfacing here). The ring on the identity card shows the official
  // percentage; this list shows the "why".
  const FINISH_PROFILE_ICON: Record<string, React.ReactNode> = {
    profileImage: <Camera color="#000" size={16} strokeWidth={2} />,
    skills: <Target color="#000" size={16} strokeWidth={2} />,
    experiences: <Briefcase color="#000" size={16} strokeWidth={2} />,
    entries: <GraduationCap color="#000" size={16} strokeWidth={2} />,
  };
  const FINISH_PROFILE_TARGET: Record<string, () => void> = {
    profileImage: openImagePicker,
    experiences: () => setShowEditResume(true),
    entries: () => setShowEditResume(true),
  };
  const finishProfileRows = profileCompletion.missingFields.map((f) => ({
    key: f.field,
    icon: FINISH_PROFILE_ICON[f.field] || (
      <Edit color="#000" size={16} strokeWidth={2} />
    ),
    label:
      f.label === "Photo"
        ? "Add a profile photo"
        : `Add your ${f.label.toLowerCase()}`,
    onPress: FINISH_PROFILE_TARGET[f.field] || (() => setShowEditProfile(true)),
  }));
  if (profileInsights.length < 2) {
    finishProfileRows.push({
      key: "prompts",
      icon: <Sparkles color="#000" size={16} strokeWidth={2} />,
      label:
        profileInsights.length === 0
          ? "Answer 2 profile prompts"
          : "Answer 1 more profile prompt",
      onPress: () => setShowEditInsights(true),
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      <ProfileIdentityCard
        profileImage={profileImage}
        initials={getUserInitials()}
        name={profileData.name}
        roleLine={
          userType === "sponsor"
            ? `${sponsorData.role} @ ${sponsorData.company}`
            : applicantData.role
        }
        location={profileData.location}
        bio={profileData.bio}
        completionPercentage={profileCompletion.percentage}
        personalMissingCount={personalMissingCount}
        onOpenImagePicker={openImagePicker}
        onEditProfile={() => {
          trackProfileEditOpened({ section: "personal" });
          setShowEditProfile(true);
        }}
        photoMissing={isFieldMissing("profileImage")}
      />

      <HubSection
        title="Finish Your Profile"
        count={finishProfileRows.length}
        hidden={finishProfileRows.length === 0}
      >
        {finishProfileRows.map((row) => (
          <HubRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            onPress={row.onPress}
          />
        ))}
      </HubSection>

      {/* Resume Upload Section — Applicant Only */}
      {userType === "applicant" && (
        <View style={styles.resumeSection}>
          <Text style={styles.resumeSectionLabel}>RÉSUMÉ</Text>

          {/* Idle — document card (on file) or dropzone (none) */}
          {resumeUploadStep === "idle" &&
            (resumeLastUpdated ? (
              <>
                <View style={styles.docCard}>
                  <View style={styles.docGlyph}>
                    <FileText size={22} color="#000" strokeWidth={1.75} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>Your résumé</Text>
                    <Text style={styles.docMeta}>
                      Updated {formatRelativeTime(resumeLastUpdated)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.docCaption}>
                  AI keeps your profile in sync with your résumé.
                </Text>
                <View style={styles.docActions}>
                  <TouchableOpacity
                    style={styles.docReplaceBtn}
                    onPress={handleResumeUpload}
                    activeOpacity={0.75}
                  >
                    <Upload size={15} color="#000" strokeWidth={2} />
                    <Text style={styles.docReplaceText}>Replace</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.docEditLink}
                    onPress={() => {
                      trackProfileEditOpened({ section: "resume" });
                      setShowEditResume(true);
                    }}
                  >
                    <Text style={styles.docEditText}>Edit details</Text>
                    <ChevronRight size={14} color="#BBB" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dropzone}
                  onPress={handleResumeUpload}
                  activeOpacity={0.75}
                >
                  <View style={styles.dropzoneIcon}>
                    <Upload size={24} color="#000" strokeWidth={2} />
                  </View>
                  <Text style={styles.dropzoneTitle}>Upload your résumé</Text>
                  <Text style={styles.dropzoneSub}>
                    AI auto-fills your profile · PDF
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.docManualLink}
                  onPress={() => {
                    trackProfileEditOpened({ section: "resume" });
                    setShowEditResume(true);
                  }}
                >
                  <Text style={styles.docEditText}>
                    Or enter details manually
                  </Text>
                </TouchableOpacity>
              </>
            ))}

          {/* Uploading state */}
          {resumeUploadStep === "uploading" && (
            <View style={styles.resumeProgressCard}>
              <View style={styles.resumeProgressRow}>
                <ActivityIndicator color="#000" size="small" />
                <View style={styles.resumeProgressTextCol}>
                  <Text style={styles.resumeProgressTitle}>
                    Uploading your resume...
                  </Text>
                  <Text style={styles.resumeProgressSub}>
                    {resumeElapsedSecs < 6
                      ? "Reading your file..."
                      : resumeElapsedSecs < 20
                        ? "Extracting text..."
                        : "Taking a bit longer than usual..."}
                  </Text>
                </View>
                <Text style={styles.resumeElapsedText}>
                  {resumeElapsedSecs}s
                </Text>
              </View>
              <TouchableOpacity
                style={styles.resumeCancelBtn}
                onPress={cancelResumeUpload}
                activeOpacity={0.7}
              >
                <X size={12} color="#666" strokeWidth={2.5} />
                <Text style={styles.resumeCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Analyzing state */}
          {resumeUploadStep === "analyzing" && (
            <View style={styles.resumeProgressCard}>
              <View style={styles.resumeProgressRow}>
                <ActivityIndicator color="#000" size="small" />
                <View style={styles.resumeProgressTextCol}>
                  <Text style={styles.resumeProgressTitle}>
                    AI is analyzing your resume...
                  </Text>
                  <Text style={styles.resumeProgressSub}>
                    {resumeElapsedSecs < 10
                      ? "Auto-filling your profile..."
                      : resumeElapsedSecs < 30
                        ? "Classifying your experience..."
                        : resumeElapsedSecs < 60
                          ? "Almost done..."
                          : "Hang tight, deep analysis takes a moment..."}
                  </Text>
                </View>
                <Text style={styles.resumeElapsedText}>
                  {resumeElapsedSecs}s
                </Text>
              </View>
              <TouchableOpacity
                style={styles.resumeCancelBtn}
                onPress={cancelResumeUpload}
                activeOpacity={0.7}
              >
                <X size={12} color="#666" strokeWidth={2.5} />
                <Text style={styles.resumeCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Done state */}
          {resumeUploadStep === "done" && (
            <Animated.View
              entering={FadeInUp.duration(400)}
              style={styles.resumeSuccessCard}
            >
              <View style={styles.resumeSuccessHeader}>
                <CheckCircle2 size={20} color="#000" strokeWidth={2.5} />
                <Text style={styles.resumeSuccessTitle}>Profile Updated!</Text>
              </View>
              {resumeFieldsUpdated.length > 0 && (
                <>
                  <Text style={styles.resumeSuccessSubtitle}>
                    AI filled in {resumeFieldsUpdated.length} field
                    {resumeFieldsUpdated.length !== 1 ? "s" : ""}:
                  </Text>
                  <View style={styles.resumeUpdatedFields}>
                    {resumeFieldsUpdated.map((field) => (
                      <View key={field} style={styles.resumeFieldPill}>
                        <Text style={styles.resumeFieldPillText}>
                          {formatFieldName(field)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity
                style={styles.resumeUploadAgainBtn}
                onPress={() => setResumeUploadStep("idle")}
              >
                <RefreshCw size={14} color="#666" strokeWidth={2} />
                <Text style={styles.resumeUploadAgainText}>Upload again</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Error state */}
          {resumeUploadStep === "error" && (
            <View style={styles.resumeErrorCard}>
              <AlertCircle size={18} color="#000" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeErrorTitle}>Upload failed</Text>
                <Text style={styles.resumeErrorSub}>{resumeUploadError}</Text>
              </View>
              <TouchableOpacity
                style={styles.resumeRetryBtn}
                onPress={() => setResumeUploadStep("idle")}
              >
                <Text style={styles.resumeRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <HubSection title="Profile">
        <HubRow
          icon={<Sparkles color="#000" size={16} strokeWidth={2} />}
          label="Profile Prompts"
          value={`${profileInsights.length}/3`}
          onPress={() => {
            trackProfileEditOpened({ section: "insights" });
            setShowEditInsights(true);
          }}
        />
        {userType === "applicant" && (
          <HubRow
            icon={<FileText color="#000" size={16} strokeWidth={2} />}
            label="Edit Resume Information"
            badgeCount={professionalMissingCount}
            onPress={() => {
              trackProfileEditOpened({ section: "resume" });
              setShowEditResume(true);
            }}
          />
        )}
      </HubSection>

      <HubSection title="Settings">
        <HubRow
          icon={<Bell color="#000" size={16} strokeWidth={2} />}
          label="Notifications"
          onPress={() => setShowNotifications(true)}
        />
        <HubRow
          icon={<Lock color="#000" size={16} strokeWidth={2} />}
          label="Privacy & Security"
          onPress={() => setShowPrivacySecurity(true)}
        />
        {PREMIUM_ENABLED && (
          <HubRow
            icon={<Star color="#000" size={16} strokeWidth={2} />}
            label={isPremium ? "Manage Subscription" : "Upgrade to Pro"}
            onPress={async () => {
              if (isPremium) {
                await presentCustomerCenter();
              } else {
                await presentPaywall();
              }
            }}
          />
        )}
      </HubSection>

      <TouchableOpacity
        style={styles.logOutRow}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <LogOut color="#000" size={16} strokeWidth={2} />
        <Text style={styles.logOutText}>Log Out</Text>
      </TouchableOpacity>

      {/* IMAGE PICKER MODAL */}
      <Modal visible={showImagePickerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowImagePickerModal(false)}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.modalContent, { paddingBottom: 50 }]}
            pointerEvents="auto"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowImagePickerModal(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose how you'd like to add your profile photo
            </Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.blackBtn,
                  { width: "100%", justifyContent: "center", borderWidth: 0 },
                ]}
                onPress={takePhoto}
              >
                <Camera color="#FFF" size={18} />
                <Text style={styles.blackBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.whiteBtn,
                  { width: "100%", justifyContent: "center" },
                ]}
                onPress={pickImage}
              >
                <ImageIcon color="#000" size={18} />
                <Text style={styles.whiteBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowLogoutModal(false)}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[styles.modalContent, { paddingBottom: 50 }]}
            pointerEvents="auto"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Out</Text>
              <TouchableOpacity onPress={() => setShowLogoutModal(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Are you sure you want to log out? You'll need to sign in again to
              access your account.
            </Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.blackBtn,
                  { width: "100%", justifyContent: "center", borderWidth: 0 },
                ]}
                onPress={confirmLogout}
              >
                <LogOut color="#FFF" size={18} />
                <Text style={styles.blackBtnText}>Log Out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.whiteBtn,
                  { width: "100%", justifyContent: "center" },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.whiteBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* EDIT PROFILE SCREEN */}
      <EditProfileScreen
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        userType={userType}
        isFieldMissing={isFieldMissing}
        personalMissingCount={personalMissingCount}
        missingFieldLabels={
          profileCompletion.missingFields
            .filter((f) => f.category === "Personal Information")
            .map((f) => f.label)
        }
        firstName={firstName}
        lastName={lastName}
        role={role}
        company={company}
        workEmailVerified={workEmailVerified}
        email={email}
        workEmail={workEmail}
        bio={bio}
        location={location}
        expertise={expertise}
        workPreferences={workPreferences}
        desiredRoles={desiredRoles}
        onSaveField={handleSaveField}
        onSaveLocation={handleSaveLocation}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onToggleWorkPreference={handleToggleWorkPreference}
      />

      {/* EDIT INSIGHTS MODAL */}
      <EditInsightsModal
        visible={showEditInsights}
        onClose={() => setShowEditInsights(false)}
        insights={profileInsights}
        onChange={handleInsightsChange}
        userType={userType}
      />

      {/* EDIT RESUME SCREEN */}
      <ResumeScreen
        visible={showEditResume}
        onClose={() => setShowEditResume(false)}
        professionalMissingCount={professionalMissingCount}
        missingFieldLabels={
          profileCompletion.missingFields
            .filter((f) => f.category !== "Personal Information")
            .map((f) => f.label)
        }
        professionalExperiences={professionalExperiences}
        educationEntries={educationEntries}
        certifications={certifications}
        languages={languages}
        achievements={achievements}
        editingField={editingField}
        tempValue={tempValue}
        setTempValue={setTempValue}
        handleEditField={handleEditField}
        handleSaveField={handleSaveField}
        renderExperienceCard={renderExperienceCard}
        renderEducationCard={renderEducationCard}
        renderCertificationCard={renderCertificationCard}
        renderLanguageCard={renderLanguageCard}
        handleAddExperience={handleAddExperience}
        handleAddEducation={handleAddEducation}
        handleAddCertification={handleAddCertification}
        handleAddLanguage={handleAddLanguage}
      />

      {/* PRIVACY & SECURITY SCREEN */}
      <PrivacySecurityScreen
        visible={showPrivacySecurity}
        onClose={() => setShowPrivacySecurity(false)}
        onAccountDeleted={handleAccountDeleted}
      />

      {/* NOTIFICATIONS SCREEN */}
      <NotificationsScreen
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        userType={userType}
      />

    </ScrollView>
  );
}

// Edit Insights Modal Component
function EditInsightsModal({
  visible,
  onClose,
  insights,
  onChange,
  userType,
}: {
  visible: boolean;
  onClose: () => void;
  insights: ProfileInsight[];
  onChange: (next: ProfileInsight[]) => void;
  userType: "applicant" | "sponsor";
}) {
  const categories =
    userType === "applicant"
      ? APPLICANT_PROMPT_CATEGORIES
      : SPONSOR_PROMPT_CATEGORIES;
  const examples =
    userType === "applicant"
      ? APPLICANT_PROMPT_EXAMPLES
      : SPONSOR_PROMPT_EXAMPLES;

  return (
    <EditorScreen visible={visible} onClose={onClose} title="Profile Prompts">
      <PromptsIntake
        value={insights}
        onChange={onChange}
        categories={categories}
        examples={examples}
        min={2}
        max={3}
        subtitle="Pick prompts that show your personality — edit or swap anytime."
      />
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 140,
  },
  blackBtn: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  blackBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#EEE",
  },
  whiteBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#F9F9F9",
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#BBB",
    marginTop: 4,
    letterSpacing: 1,
  },

  // Applicant-Specific Styles

  // Sponsor-Specific Styles
  companyTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  companyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },

  logOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#000",
    paddingVertical: 14,
    marginBottom: 24,
  },
  logOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
  },
  insightsEditorSafe: { flex: 1, backgroundColor: "#FFF" },
  insightsEditorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  insightsEditorScroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalScroll: {
    maxHeight: 500,
  },

  // Progress Indicator Styles
  modalProgressContainer: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalProgressText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalProgressBar: {
    height: 4,
    backgroundColor: "#E5E5E5",
    borderRadius: 2,
    overflow: "hidden",
  },
  modalProgressFill: {
    height: "100%",
    backgroundColor: "#000",
    borderRadius: 2,
  },

  // Badge Styles

  // Edit Profile Styles
  editField: {
    marginBottom: 24,
    position: "relative",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#999",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  fieldLabelIncomplete: {
    color: "#DC2626",
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  requiredStar: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DC2626",
    lineHeight: 16,
  },
  fieldDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  fieldText: {
    fontSize: 15,
    color: "#000",
    flex: 1,
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  editColumn: {
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    color: "#000",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: "#000",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    marginTop: 32,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5E5",
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1.2,
    paddingHorizontal: 16,
  },

  // Tags Editing
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  editableTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  editableTagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  addTagRow: {
    flexDirection: "row",
    gap: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  addTagBtn: {
    backgroundColor: "#000",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Settings Modal Styles
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  settingRowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  settingRowValue: {
    fontSize: 15,
    color: "#666",
  },
  privacySection: {
    marginBottom: 24,
  },
  privacyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  privacyContent: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 13,
    color: "#666",
  },
  privacyValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  privacyActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  privacyActionContent: {
    flex: 1,
  },
  privacyActionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  privacyActionSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  legalLastUpdated: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
    fontStyle: "italic",
  },
  legalIntro: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    marginBottom: 20,
  },
  legalSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  legalSubSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginTop: 10,
    marginBottom: 4,
  },
  legalBody: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    marginBottom: 4,
  },
  legalBullet: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    paddingLeft: 4,
    marginBottom: 3,
  },
  legalContact: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginTop: 4,
  },
  // Delete-account card — same shape as the sibling privacy cards but a
  // tick darker on the background so it visually pulls forward from the
  // row above. (The confirmation safety net now lives in
  // PrivacySecurityScreen's password-confirmed delete step.)
  deleteActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBEBEB",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#DEDEDE",
  },
  deleteActionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },

  // Tab Navigation
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: "#FFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#999",
  },
  tabTextActive: {
    color: "#000",
  },

  // Applications Section
  applicationsContainer: {
    marginBottom: 32,
  },
  applicationsTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  applicationsSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  applicationCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  appCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  appCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appJobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  appCompany: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeBlack: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusBadgeBlackText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  timelineContainer: {
    marginBottom: 20,
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E5E5",
    borderWidth: 2,
    borderColor: "#FFF",
    marginTop: 4,
  },
  timelineDotCompleted: {
    backgroundColor: "#000",
  },
  timelineDotReferred: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineDotReferredCompleted: {
    backgroundColor: "#000",
    borderWidth: 3,
    borderColor: "#F9F9F9",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  timelineLine: {
    position: "absolute",
    left: 5,
    top: 18,
    width: 2,
    height: 24,
    backgroundColor: "#E5E5E5",
  },
  timelineContent: {
    marginLeft: 12,
    marginBottom: 12,
  },
  timelineStage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
  },
  timelineStageCompleted: {
    color: "#000",
  },
  timelineStageReferred: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timelineDate: {
    fontSize: 12,
    color: "#BBB",
    marginTop: 2,
  },
  appCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  sponsorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
  },
  sponsorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sponsorLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1,
  },
  sponsorName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },

  // Application Detail Modal
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    zIndex: 10,
  },
  appDetailHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  appDetailLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#F9F9F9",
    marginBottom: 16,
  },
  appDetailTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
  },
  appDetailCompany: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 28,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  timelineDetailContainer: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
  },
  timelineDetailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  timelineDetailLeft: {
    alignItems: "center",
    marginRight: 16,
  },
  timelineDetailDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E5E5",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  timelineDetailDotCompleted: {
    backgroundColor: "#000",
  },
  timelineDetailDotReferred: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  timelineDetailDotReferredCompleted: {
    backgroundColor: "#000",
    borderWidth: 4,
    borderColor: "#F9F9F9",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  timelineDetailLine: {
    width: 2,
    height: 32,
    backgroundColor: "#E5E5E5",
    marginTop: 4,
  },
  timelineDetailLineCompleted: {
    backgroundColor: "#BBB",
  },
  timelineDetailRight: {
    flex: 1,
    paddingTop: 2,
  },
  timelineDetailStage: {
    fontSize: 15,
    fontWeight: "700",
    color: "#999",
    marginBottom: 2,
  },
  timelineDetailStageCompleted: {
    color: "#000",
  },
  timelineDetailStageReferred: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timelineDetailDate: {
    fontSize: 13,
    color: "#BBB",
    fontWeight: "600",
  },
  sponsorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 16,
  },
  sponsorDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
  },
  sponsorDetailInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sponsorDetailName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  sponsorDetailRole: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  nextActionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F4F4F5",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  nextActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  messageBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Certifications & Languages Styles
  certificationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  certificationName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  certificationOrg: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9F9F9",
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
  },
  addItemText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },

  // Experience & Education Entry Card Styles
  entryCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 16,
    overflow: "hidden",
  },
  entryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFF",
  },
  entryCardTitle: {
    flex: 1,
    gap: 4,
  },
  entryCardMainText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  entryCardSubText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  entryCardActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  entryCardContent: {
    padding: 16,
    paddingTop: 8,
    gap: 16,
  },
  entryFieldRow: {
    gap: 6,
  },
  entryFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  entryFieldInput: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    color: "#000",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  entryFieldDisplay: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  entryFieldText: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  entryFieldPlaceholder: {
    fontSize: 14,
    color: "#999",
  },
  entrySaveBtn: {
    backgroundColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  entrySaveBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  entryDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  entryDeleteBtnText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyStateCard: {
    backgroundColor: "#F9F9F9",
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  workPreferenceOptions: {
    gap: 8,
    marginTop: 8,
  },
  workPreferenceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  workPreferenceOptionSelected: {
    backgroundColor: "#F9F9F9",
    borderColor: "#000",
  },
  workPreferenceCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#CCC",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  workPreferenceCheckboxSelected: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  workPreferenceText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    flex: 1,
  },
  workPreferenceTextSelected: {
    color: "#000",
    fontWeight: "700",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  // ── Resume Upload Section ─────────────────────────────────────────────────
  resumeSection: {
    marginBottom: 24,
  },
  // ── Résumé — document card (Route A) ─────────────────────────────────────
  resumeSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 16,
  },
  docGlyph: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: { flex: 1, gap: 3 },
  docTitle: { fontSize: 16, fontWeight: "700", color: "#000" },
  docMeta: { fontSize: 13, color: "#999", fontWeight: "500" },
  docCaption: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginTop: 12,
  },
  docActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  docReplaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  docReplaceText: { fontSize: 14, fontWeight: "700", color: "#000" },
  docEditLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: "auto",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  docEditText: { fontSize: 14, fontWeight: "600", color: "#666" },
  docManualLink: { alignSelf: "center", marginTop: 16, paddingVertical: 6 },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#DDD",
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  dropzoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  dropzoneTitle: { fontSize: 16, fontWeight: "700", color: "#000" },
  dropzoneSub: { fontSize: 13, color: "#999", marginTop: 6 },
  resumeProgressCard: {
    flexDirection: "column",
    gap: 12,
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  resumeProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  resumeProgressTextCol: {
    flex: 1,
    gap: 4,
  },
  resumeProgressTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  resumeProgressSub: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  resumeElapsedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#BBB",
    minWidth: 28,
    textAlign: "right",
  },
  resumeCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
    backgroundColor: "#FFF",
  },
  resumeCancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  resumeSuccessCard: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  resumeSuccessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resumeSuccessTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  resumeSuccessSubtitle: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  resumeUpdatedFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  resumeFieldPill: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  resumeFieldPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  resumeUploadAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingTop: 4,
  },
  resumeUploadAgainText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  resumeErrorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    padding: 14,
  },
  resumeErrorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  resumeErrorSub: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  resumeRetryBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resumeRetryText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
