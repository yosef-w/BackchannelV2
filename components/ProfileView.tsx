import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    AlertCircle,
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
    MapPin,
    Plus,
    RefreshCw,
    Target,
    Trash2,
    Upload,
    X,
    Zap
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
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
import { CITY_NAMES_ONLY, COUNTRIES, US_STATES } from "../constants/locations";
import { ALL_SKILLS } from "../constants/skills";
import {
    changePassword,
    classifyResume,
    deactivateAccount,
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
import {
    EducationEntry,
    ProfessionalExperience,
    useUserProfileStore,
} from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import { AutocompleteInput } from "./ui/AutocompleteInput";

interface ProfileViewProps {
  userType: "applicant" | "sponsor";
}

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
  companiesCanReferTo: string[];
  successStories: { name: string; result: string }[];
}

interface ProfileInsight {
  question: string;
  answer: string;
}

const AVAILABLE_QUESTIONS = [
  "MY SECRET SUPERPOWER",
  "I'M BEST KNOWN FOR",
  "IF I WASN'T IN TECH",
  "MY FAVORITE BRAINSTORMING FUEL",
  "WHAT I LOOK FOR IN TALENT",
  "ONE THING THAT SURPRISED ME",
  "THE PROJECT I'M MOST PROUD OF",
  "MY DESIGN PHILOSOPHY",
  "MY MENTORSHIP STYLE",
  "WHY I SPONSOR",
  "WHAT ENERGIZES ME",
  "MY UNPOPULAR OPINION",
  "THE BEST ADVICE I'VE RECEIVED",
  "HOW I RECHARGE",
  "WHAT I'M LEARNING RIGHT NOW",
];

export function ProfileView({ userType }: ProfileViewProps) {
  const router = useRouter();

  // Store access - must come before any useMemo that depends on it
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const deviceToken = useAuthStore((state) => state.deviceToken);
  const clearUserProfileData = useUserProfileStore((state) => state.clearData);
  const userProfileData = useUserProfileStore((state) => state.data);
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
  const [showPasswordChange, setShowPasswordChange] = useState(false);
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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Editable profile state
  const [name, setName] = useState("Alex Johnson");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState(
    userType === "applicant"
      ? "Seeking Product Manager Roles"
      : "VP of Product",
  );
  const [company, setCompany] = useState("Stripe");
  const [location, setLocation] = useState("San Francisco, CA");
  const [email, setEmail] = useState("alex.johnson@email.com");
  const [phone, setPhone] = useState("+1 (415) 555-0123");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bio, setBio] = useState(
    userType === "applicant"
      ? "Passionate about AI/ML and building products that scale. Looking to join a high-growth startup where I can lead product strategy and make meaningful impact."
      : "Helping the next generation of product leaders break into tech. 10+ years at Google and Stripe, now mentoring at early-stage companies and opening doors for talented PMs.",
  );

  // Additional details (optional)
  const [achievements, setAchievements] = useState(
    "Forbes 30 Under 30 (Consumer Tech). 2 Patents in Recommendation Systems. Speaker at SXSW 2023 on 'The Future of Audio'.",
  );
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

  // Personal information fields (for edit profile modal)
  const [portfolio, setPortfolio] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  // Editable tags state
  const [expertise, setExpertise] = useState(
    userType === "applicant"
      ? [
          "React",
          "Product Strategy",
          "FinTech",
          "Early Stage Startups",
          "Data Analytics",
          "UX Design",
        ]
      : [
          "Product Management",
          "Engineering Leadership",
          "Career Growth",
          "Interview Prep",
          "Product Strategy",
          "Team Building",
        ],
  );
  const [workPreferences, setWorkPreferences] = useState<string[]>([]);
  const [desiredRoles, setDesiredRoles] = useState<string[]>([]);
  const [companiesCanReferTo, setCompaniesCanReferTo] = useState([
    "Stripe",
    "Google",
    "Meta",
    "Airbnb",
    "Notion",
    "Figma",
  ]);

  // Profile insights state
  const [profileInsights, setProfileInsights] = useState<ProfileInsight[]>([
    {
      question: "MY SECRET SUPERPOWER",
      answer: "Turning complex data into simple, actionable stories.",
    },
    {
      question: "IF I WASN'T IN TECH",
      answer: "I'd be a chef. Chemistry you can eat.",
    },
  ]);

  // Temp states for editing
  const [tempValue, setTempValue] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newRoleTag, setNewRoleTag] = useState("");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [referralUpdates, setReferralUpdates] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);

  // Profile completeness check - recalculate when userProfileData changes
  const profileCompletion = useMemo(() => {
    if (!userProfileData || !userProfileData.personal) {
      return { isComplete: false, percentage: 0, missingFields: [] };
    }
    return checkProfileCompleteness(userProfileData);
  }, [userProfileData]);

  const hasIncompleteProfile = profileCompletion.percentage < 90;

  useEffect(() => {
    // Update profile display when user profile data changes
    if (
      userProfileData.personal.email ||
      userProfileData.personal.firstName ||
      userProfileData.personal.fullName
    ) {
      setFirstName(userProfileData.personal.firstName);
      setLastName(userProfileData.personal.lastName);
      setName(
        userProfileData.personal.fullName ||
          `${userProfileData.personal.firstName} ${userProfileData.personal.lastName}`.trim(),
      );
      setEmail(userProfileData.personal.email);
      setPhone(userProfileData.personal.phone);
      setProfileImage(userProfileData.personal.profileImage || null);
      setPortfolio(userProfileData.personal.portfolio);
      setStreet(userProfileData.personal.address.street);
      setCity(userProfileData.personal.address.city);
      setState(userProfileData.personal.address.state);
      setZip(userProfileData.personal.address.zip);
      setCountry(userProfileData.personal.address.country);
      setLocation(
        `${userProfileData.personal.address.city}${userProfileData.personal.address.state ? ", " + userProfileData.personal.address.state : ""}`,
      );
    }
    if (userProfileData.professional.title) {
      setRole(userProfileData.professional.title);
      setJobTitle(userProfileData.professional.title);
    }
    if (userProfileData.professional.company) {
      setCompany(userProfileData.professional.company);
    }
    if (userProfileData.professional.summary) {
      setBio(userProfileData.professional.summary);
      setSummary(userProfileData.professional.summary);
    }
    if (userProfileData.professional.yearsExperience) {
      setYearsExperience(userProfileData.professional.yearsExperience);
    }
    if (
      userProfileData.professional.experiences &&
      userProfileData.professional.experiences.length > 0
    ) {
      setProfessionalExperiences(userProfileData.professional.experiences);
    }
    if (userProfileData.education.degree) {
      setDegree(userProfileData.education.degree);
    }
    if (userProfileData.education.major) {
      setMajor(userProfileData.education.major);
    }
    if (userProfileData.education.university) {
      setUniversity(userProfileData.education.university);
    }
    if (userProfileData.education.graduationYear) {
      setGraduationYear(userProfileData.education.graduationYear);
    }
    if (userProfileData.education.gpa) {
      setGpa(userProfileData.education.gpa);
    }
    if (
      userProfileData.education.entries &&
      userProfileData.education.entries.length > 0
    ) {
      setEducationEntries(userProfileData.education.entries);
    }
    if (userProfileData.preferences.workAuthorization) {
      setWorkAuthorization(userProfileData.preferences.workAuthorization);
    }
    if (userProfileData.preferences.willingToRelocate) {
      setWillingToRelocate(userProfileData.preferences.willingToRelocate);
    }
    if (userProfileData.preferences.requiresSponsorship) {
      setRequiresSponsorship(userProfileData.preferences.requiresSponsorship);
    }
    if (userProfileData.skills.length > 0) {
      setExpertise(userProfileData.skills);
    }
    if (userProfileData.insights.length > 0) {
      setProfileInsights(userProfileData.insights);
    }
    // Load work preferences from store
    if (
      userProfileData.workPreferences &&
      userProfileData.workPreferences.length > 0
    ) {
      setWorkPreferences(userProfileData.workPreferences);
    }
    // Load desired roles from store — prefer explicit desiredRoles, fall back to seekingPosition
    if (
      userProfileData.desiredRoles &&
      userProfileData.desiredRoles.length > 0
    ) {
      setDesiredRoles(userProfileData.desiredRoles);
    } else if (userProfileData.professional.seekingPosition) {
      setDesiredRoles([userProfileData.professional.seekingPosition]);
    }
    // Load additional details if they exist in the store
    if (
      userProfileData.certifications &&
      userProfileData.certifications.length > 0
    ) {
      setCertifications(userProfileData.certifications);
    }
    if (userProfileData.languages && userProfileData.languages.length > 0) {
      setLanguages(userProfileData.languages);
    }
    if (userProfileData.achievements) {
      setAchievements(userProfileData.achievements);
    }
  }, [userProfileData]);

  // Auto-save certifications when they change
  useEffect(() => {
    if (
      certifications.length > 0 ||
      (userProfileData.certifications?.length ?? 0) > 0
    ) {
      updateCertifications(certifications);
    }
  }, [certifications]);

  // Auto-save languages when they change
  useEffect(() => {
    if (languages.length > 0 || (userProfileData.languages?.length ?? 0) > 0) {
      updateLanguages(languages);
    }
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
        if (r.updated_at) setResumeLastUpdated(r.updated_at);
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

  const getStatusLabel = (status: string) => {
    const labels = {
      applied: "Applied",
      reviewing: "Under Review",
      interview_scheduled: "Interview",
      offer: "Offer",
      rejected: "Closed",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusDotColor = (status: string) => {
    const colors = {
      applied: { backgroundColor: "#3B82F6" },
      reviewing: { backgroundColor: "#F59E0B" },
      interview_scheduled: { backgroundColor: "#10B981" },
      offer: { backgroundColor: "#8B5CF6" },
      rejected: { backgroundColor: "#EF4444" },
    };
    return colors[status as keyof typeof colors] || { backgroundColor: "#999" };
  };

  const getStatusBadgeStyle = (status: string) => {
    const styles = {
      applied: { backgroundColor: "#F9F9F9", borderColor: "#E5E5E5" },
      reviewing: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
      interview_scheduled: {
        backgroundColor: "#D1FAE5",
        borderColor: "#A7F3D0",
      },
      offer: { backgroundColor: "#EDE9FE", borderColor: "#DDD6FE" },
      rejected: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
    };
    return (
      styles[status as keyof typeof styles] || {
        backgroundColor: "#F5F5F5",
        borderColor: "#E5E5E5",
      }
    );
  };

  const getStatusTextColor = (status: string) => {
    const colors = {
      applied: { color: "#000" },
      reviewing: { color: "#B45309" },
      interview_scheduled: { color: "#047857" },
      offer: { color: "#6D28D9" },
      rejected: { color: "#B91C1C" },
    };
    return colors[status as keyof typeof colors] || { color: "#666" };
  };

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
    companiesCanReferTo,
    successStories: [
      { name: "Sarah M.", result: "Landed PM role at Meta" },
      { name: "David K.", result: "Senior Engineer at Google" },
      { name: "Lisa P.", result: "Design Lead at Airbnb" },
    ],
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

  const handleSaveField = async (field: string) => {
    try {
      switch (field) {
        case "firstName":
          setFirstName(tempValue);
          setName(`${tempValue} ${lastName}`.trim());
          await updatePersonal({
            firstName: tempValue,
            fullName: `${tempValue} ${lastName}`.trim(),
          });
          await updateGeneralProfile({ first_name: tempValue });
          break;
        case "lastName":
          setLastName(tempValue);
          setName(`${firstName} ${tempValue}`.trim());
          await updatePersonal({
            lastName: tempValue,
            fullName: `${firstName} ${tempValue}`.trim(),
          });
          await updateGeneralProfile({ last_name: tempValue });
          break;
        case "role":
          setRole(tempValue);
          await updateProfessional({ title: tempValue });
          if (userType === "applicant") {
            await updateApplicantProfile({ current_role: tempValue });
          } else {
            await updateSponsorProfile({ job_title: tempValue });
          }
          break;
        case "company":
          setCompany(tempValue);
          await updateProfessional({ company: tempValue });
          if (userType === "sponsor") {
            await updateSponsorProfile({ company: tempValue });
          }
          break;
        // email is read-only — changes require a dedicated change-email flow with verification
        case "phone":
          setPhone(tempValue);
          await updatePersonal({ phone: tempValue });
          // API call for phone
          await updateGeneralProfile({ phone_number: tempValue });
          break;
        case "bio":
          setBio(tempValue);
          await updateProfessional({ summary: tempValue });
          // API call for bio
          await updateGeneralProfile({ bio: tempValue });
          break;
        case "achievements":
          setAchievements(tempValue);
          await updateAchievements(tempValue);
          if (userType === "applicant") {
            await updateApplicantProfile({ achievements: tempValue });
          }
          break;
        case "jobTitle":
          setJobTitle(tempValue);
          await updateProfessional({ title: tempValue });
          if (userType === "applicant") {
            await updateApplicantProfile({ current_role: tempValue });
          } else {
            await updateSponsorProfile({ job_title: tempValue });
          }
          break;
        case "yearsExperience":
          setYearsExperience(tempValue);
          await updateProfessional({ yearsExperience: tempValue });
          // API call for years of experience - applicant only
          if (userType === "applicant") {
            await updateApplicantProfile({ years_experience: tempValue });
          }
          break;
        case "summary":
          setSummary(tempValue);
          await updateProfessional({ summary: tempValue });
          // API call for summary/bio
          await updateGeneralProfile({ bio: tempValue });
          break;
        case "degree":
          setDegree(tempValue);
          await updateEducation({ degree: tempValue });
          break;
        case "major":
          setMajor(tempValue);
          await updateEducation({ major: tempValue });
          break;
        case "university":
          setUniversity(tempValue);
          await updateEducation({ university: tempValue });
          break;
        case "graduationYear":
          setGraduationYear(tempValue);
          await updateEducation({ graduationYear: tempValue });
          break;
        case "gpa":
          setGpa(tempValue);
          await updateEducation({ gpa: tempValue });
          break;
        case "workAuthorization":
          setWorkAuthorization(tempValue);
          await updatePreferences({ workAuthorization: tempValue });
          if (userType === "applicant") {
            await updateApplicantProfile({ work_authorization: tempValue });
          }
          break;
        case "willingToRelocate":
          setWillingToRelocate(tempValue);
          await updatePreferences({ willingToRelocate: tempValue });
          if (userType === "applicant") {
            await updateApplicantProfile({ willing_to_relocate: tempValue });
          }
          break;
        case "requiresSponsorship":
          setRequiresSponsorship(tempValue);
          await updatePreferences({ requiresSponsorship: tempValue });
          if (userType === "applicant") {
            await updateApplicantProfile({ requires_sponsorship: tempValue });
          }
          break;
        case "portfolio":
          setPortfolio(tempValue);
          await updatePersonal({ portfolio: tempValue });
          await updateGeneralProfile({ portfolio_url: tempValue });
          break;
        case "street":
          setStreet(tempValue);
          await updatePersonal({
            address: { ...userProfileData.personal.address, street: tempValue },
          });
          await updateGeneralProfile({ street: tempValue });
          break;
        case "city":
          setCity(tempValue);
          await updatePersonal({
            address: { ...userProfileData.personal.address, city: tempValue },
          });
          await updateGeneralProfile({ city: tempValue });
          break;
        case "state":
          setState(tempValue);
          await updatePersonal({
            address: { ...userProfileData.personal.address, state: tempValue },
          });
          await updateGeneralProfile({ state: tempValue });
          break;
        case "zip":
          setZip(tempValue);
          await updatePersonal({
            address: { ...userProfileData.personal.address, zip: tempValue },
          });
          await updateGeneralProfile({ zip: tempValue });
          break;
        case "country":
          setCountry(tempValue);
          await updatePersonal({
            address: {
              ...userProfileData.personal.address,
              country: tempValue,
            },
          });
          await updateGeneralProfile({ country: tempValue });
          break;
      }
      setEditingField(null);
      setTempValue("");
    } catch (error) {
      console.error("Failed to save field:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleAddTag = async (
    type: "expertise" | "workPreferences" | "desiredRoles" | "companies",
    skillValue?: string,
  ) => {
    const valueToAdd = skillValue || newTag.trim();
    if (!valueToAdd) return;

    switch (type) {
      case "expertise":
        if (expertise.length >= 5) {
          alert("You can only add up to 5 skills");
          return;
        }
        if (expertise.includes(valueToAdd)) {
          alert("This skill is already added");
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
          alert("You can only add up to 3 desired roles");
          return;
        }
        if (desiredRoles.includes(valueToAdd)) {
          alert("This role is already added");
          setNewTag("");
          setNewRoleTag("");
          return;
        }
        const newDesiredRoles = [...desiredRoles, valueToAdd];
        setDesiredRoles(newDesiredRoles);
        await updateDesiredRolesStore(newDesiredRoles);
        setNewRoleTag("");
        if (userType === "applicant") {
          await updateApplicantProfile({ desired_roles: newDesiredRoles });
        }
        break;
      }
      case "companies": {
        const newCompanies = [...companiesCanReferTo, valueToAdd];
        setCompaniesCanReferTo(newCompanies);
        if (userType === "sponsor") {
          await updateSponsorProfile({ companies_can_refer_to: newCompanies });
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
    type: "expertise" | "workPreferences" | "desiredRoles" | "companies",
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
      case "companies": {
        const updatedCompanies = companiesCanReferTo.filter(
          (_, i) => i !== index,
        );
        setCompaniesCanReferTo(updatedCompanies);
        if (userType === "sponsor") {
          await updateSponsorProfile({
            companies_can_refer_to: updatedCompanies,
          });
        }
        break;
      }
    }
  };

  const handleAddInsight = async (question: string, answer: string) => {
    try {
      if (profileInsights.length >= 3) {
        alert("You can only have up to 3 profile insights");
        return;
      }
      const newInsights = [...profileInsights, { question, answer }];
      setProfileInsights(newInsights);
      await updateInsights(newInsights);
      // API call to sync with backend - role specific
      if (userType === "applicant") {
        await updateApplicantProfile({ insights: newInsights });
      } else {
        await updateSponsorProfile({ insights: newInsights });
      }
    } catch (error) {
      console.error("Failed to add insight:", error);
      alert("Failed to save insight. Please try again.");
    }
  };

  const handleRemoveInsight = async (index: number) => {
    try {
      const updatedInsights = profileInsights.filter((_, i) => i !== index);
      setProfileInsights(updatedInsights);
      await updateInsights(updatedInsights);
      // API call to sync with backend - role specific
      if (userType === "applicant") {
        await updateApplicantProfile({ insights: updatedInsights });
      } else {
        await updateSponsorProfile({ insights: updatedInsights });
      }
    } catch (error) {
      console.error("Failed to remove insight:", error);
      alert("Failed to remove insight. Please try again.");
    }
  };

  const handleUpdateInsight = async (index: number, answer: string) => {
    try {
      const updated = profileInsights.map((insight, i) =>
        i === index ? { ...insight, answer } : insight,
      );
      setProfileInsights(updated);
      await updateInsights(updated);
      // API call to sync with backend - role specific
      if (userType === "applicant") {
        await updateApplicantProfile({ insights: updated });
      } else {
        await updateSponsorProfile({ insights: updated });
      }
    } catch (error) {
      console.error("Failed to update insight:", error);
      alert("Failed to save insight. Please try again.");
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
      console.error("Failed to add experience:", error);
      alert("Failed to add experience. Please try again.");
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
      console.error("Failed to update experience:", error);
      alert("Failed to save experience. Please try again.");
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
      console.error("Failed to delete experience:", error);
      alert("Failed to delete experience. Please try again.");
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
      console.error("Failed to add education:", error);
      alert("Failed to add education. Please try again.");
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
      console.error("Failed to update education:", error);
      alert("Failed to save education. Please try again.");
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
      console.error("Failed to delete education:", error);
      alert("Failed to delete education. Please try again.");
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
        Alert.alert(
          "Required Fields Missing",
          "Please fill in Certification Name, Organization, and Year before saving.",
          [{ text: "OK" }],
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
                  isNameMissing && { borderColor: "#FCA5A5", borderWidth: 2 },
                ]}
                value={cert.name}
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
                  isOrgMissing && { borderColor: "#FCA5A5", borderWidth: 2 },
                ]}
                value={cert.organization}
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
                  isYearMissing && { borderColor: "#FCA5A5", borderWidth: 2 },
                ]}
                value={cert.year}
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
        Alert.alert(
          "Required Fields Missing",
          "Please fill in Language and Proficiency Level before saving.",
          [{ text: "OK" }],
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={lang.language}
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={lang.proficiency}
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

  const handlePasswordChange = async () => {
    setPasswordError("");

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      Alert.alert("Success", "Password changed successfully.");
    } catch (err: any) {
      setPasswordError(
        err?.message || "Failed to change password. Please try again.",
      );
    }
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

  const pickImage = async () => {
    const hasPermission = await requestPermissions("gallery");
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions("camera");
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
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
    } catch (err) {
      console.error("[ProfileImage] ❌ Failed to upload profile photo:", err);
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
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
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

      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/pdf",
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

      // The backend returns HTTP 201 even when Snowflake Cortex fails to extract
      // text (extracted_text will be null). Catch this here so we show a clear
      // error rather than a confusing "no resume text" message from classifyResume.
      if (!parseResult.extracted_text) {
        console.error(
          "[Resume] ❌ Text extraction failed — extracted_text is null. parsing_error:",
          parseResult.parsing_error,
        );
        throw new Error(
          "Resume uploaded but text extraction failed. Please try a PDF with selectable (non-scanned) text.",
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
          stored.professional.experiences.map((e: any, i: number) => ({
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
          stored.education.entries.map((e: any, i: number) => ({
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
    } catch (err: any) {
      stopElapsedTimer();
      setResumeElapsedSecs(0);
      abortControllerRef.current = null;

      // User pressed Cancel — abort silently, return to idle
      if (err?.name === "AbortError") {
        console.log("[Resume] ℹ️ Upload cancelled by user.");
        setResumeUploadStep("idle");
        return;
      }

      console.error(
        "[Resume] ❌ Resume upload pipeline failed:",
        err?.message,
        err,
      );
      setResumeUploadStep("error");
      setResumeUploadError(err?.message || "Upload failed. Please try again.");
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
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
    router.replace("/splash");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setShowPrivacySecurity(false);
            // Deactivate push token so no further notifications reach this device
            if (deviceToken) {
              try {
                await unregisterDevice(deviceToken);
              } catch (err) {
                console.warn(
                  "[ProfileView] Failed to unregister device token before delete:",
                  err,
                );
              }
            }
            try {
              await deactivateAccount();
            } catch (err) {
              console.warn(
                "[ProfileView] Deactivate account call failed:",
                err,
              );
              // Non-fatal — clear local state regardless
            }
            await clearAuth();
            await clearUserProfileData();
            router.replace("/splash");
          },
        },
      ],
    );
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
        Alert.alert(
          "Required Fields Missing",
          "Please fill in Job Title, Company, and Start Date before saving.",
          [{ text: "OK" }],
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={experience.jobTitle}
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={experience.company}
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={experience.startDate}
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
                trackColor={{ false: "#E5E5E5", true: "#000" }}
                thumbColor="#FFF"
              />
              <Text style={styles.checkboxLabel}>I currently work here</Text>
            </View>

            {!experience.current && (
              <View style={styles.entryFieldRow}>
                <Text style={styles.entryFieldLabel}>END DATE</Text>
                <TextInput
                  style={styles.entryFieldInput}
                  value={experience.endDate}
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
        Alert.alert(
          "Required Fields Missing",
          "Please fill in Degree, University, and Graduation Year before saving.",
          [{ text: "OK" }],
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
                  isDegreeMissing && { borderColor: "#FCA5A5", borderWidth: 2 },
                ]}
                value={education.degree}
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={education.university}
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
                    borderColor: "#FCA5A5",
                    borderWidth: 2,
                  },
                ]}
                value={education.graduationYear}
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrapper}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              {getUserInitials() ? (
                <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Camera color="#999" size={32} strokeWidth={1.5} />
                  <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.editFab,
              isFieldMissing("profileImage") && styles.editFabHighlight,
            ]}
            onPress={() => setShowImagePickerModal(true)}
          >
            <Edit color="#FFF" size={14} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{profileData.name}</Text>

        <View style={styles.infoRow}>
          <Briefcase color="#000" size={14} strokeWidth={2} />
          <Text style={styles.infoText}>
            {userType === "sponsor"
              ? `${sponsorData.role} @ ${sponsorData.company}`
              : applicantData.role}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MapPin color="#BBB" size={14} strokeWidth={2} />
          <Text style={styles.locationText}>{profileData.location}</Text>
        </View>

        <Text style={styles.bio}>{profileData.bio}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.blackBtn}
            onPress={() => setShowEditProfile(true)}
          >
            <Edit color="#FFF" size={16} />
            <Text style={styles.blackBtnText}>Edit Profile</Text>
            {personalMissingCount > 0 && (
              <View style={styles.buttonBadge}>
                <Text style={styles.buttonBadgeText}>
                  {personalMissingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Content */}
      <>
        {/* Expertise Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{profileData.expertiseLabel}</Text>
          <View style={styles.tagCloud}>
            {profileData.expertise.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Applicant-Specific Sections */}
        {userType === "applicant" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Work Preferences</Text>
              <View style={styles.tagCloud}>
                {applicantData.workPreferences.map((pref) => (
                  <View key={pref} style={styles.preferenceTag}>
                    <Text style={styles.preferenceText}>{pref}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Desired Roles</Text>
              <View style={styles.tagCloud}>
                {applicantData.desiredRoles.map((role) => (
                  <View key={role} style={styles.roleTag}>
                    <Target size={14} color="#FFF" strokeWidth={2.5} />
                    <Text style={styles.roleTagText}>{role}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Sponsor-Specific Sections */}
        {userType === "sponsor" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Companies I Can Refer To</Text>
              <View style={styles.tagCloud}>
                {sponsorData.companiesCanReferTo.map((company) => (
                  <View key={company} style={styles.companyTag}>
                    <Text style={styles.companyText}>{company}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </>

      {/* Resume Upload Section — Applicant Only */}
      {userType === "applicant" && (
        <View style={styles.resumeSection}>
          {/* Header */}
          <View style={styles.resumeSectionHeader}>
            <View style={styles.resumeHeaderLeft}>
              <FileText size={20} color="#000" strokeWidth={2} />
              <Text style={styles.resumeSectionTitle}>Resume</Text>
            </View>
            <View style={styles.aiBadge}>
              <Zap size={12} color="#FFF" fill="#FFF" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>

          <Text style={styles.resumeSectionSubtitle}>
            Upload your resume and AI will auto-fill your profile
          </Text>

          {/* Status line: show when already uploaded and idle */}
          {resumeLastUpdated && resumeUploadStep === "idle" && (
            <View style={styles.resumeStatusRow}>
              <CheckCircle2 size={14} color="#16A34A" strokeWidth={2.5} />
              <Text style={styles.resumeStatusText}>
                Last uploaded {formatRelativeTime(resumeLastUpdated)}
              </Text>
            </View>
          )}

          {/* Idle state — upload button */}
          {resumeUploadStep === "idle" && (
            <TouchableOpacity
              style={styles.resumeUploadBtn}
              onPress={handleResumeUpload}
              activeOpacity={0.75}
            >
              <Upload size={18} color="#FFF" strokeWidth={2} />
              <Text style={styles.resumeUploadBtnText}>
                {resumeLastUpdated ? "Re-upload Resume" : "Upload Resume"}
              </Text>
            </TouchableOpacity>
          )}

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
                <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.5} />
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
              <AlertCircle size={18} color="#DC2626" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeErrorTitle}>Upload Failed</Text>
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

          {/* Divider + manual edit link */}
          <View style={styles.resumeDivider} />
          <TouchableOpacity
            style={styles.resumeManualLink}
            onPress={() => setShowEditResume(true)}
          >
            <Edit size={14} color="#666" strokeWidth={2} />
            <Text style={styles.resumeManualLinkText}>
              Edit resume details manually
            </Text>
            <ChevronRight size={14} color="#BBB" />
          </TouchableOpacity>
        </View>
      )}

      {/* Settings List */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingItem
            label="Edit Profile Insights"
            onPress={() => setShowEditInsights(true)}
          />
          {userType === "applicant" && (
            <SettingItem
              label="Edit Resume Information"
              badgeCount={professionalMissingCount}
              onPress={() => setShowEditResume(true)}
            />
          )}
          <SettingItem
            label="Privacy & Security"
            onPress={() => setShowPrivacySecurity(true)}
          />
          <SettingItem
            label="Notifications"
            onPress={() => setShowNotifications(true)}
          />
          <SettingItem
            label="Log Out"
            color="#000"
            isLast
            onPress={handleLogout}
          />
        </View>
      </View>

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

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditProfile} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEditProfile(false)}
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
            style={styles.modalContent}
            pointerEvents="auto"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            {personalMissingCount > 0 && (
              <View style={styles.modalProgressContainer}>
                <Text style={styles.modalProgressText}>
                  {personalMissingCount} field
                  {personalMissingCount !== 1 ? "s" : ""} remaining
                </Text>
                <View style={styles.modalProgressBar}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width: `${Math.max(0, 100 - (personalMissingCount / 15) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
              keyboardShouldPersistTaps="always"
            >
              {/* Basic Information Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>BASIC INFORMATION</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* First Name */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>FIRST NAME</Text>
                  {isFieldMissing("firstName") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "firstName" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("firstName")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("firstName", firstName)}
                  >
                    <Text style={styles.fieldText}>
                      {firstName || "Not set"}
                    </Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Last Name */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>LAST NAME</Text>
                  {isFieldMissing("lastName") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "lastName" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("lastName")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("lastName", lastName)}
                  >
                    <Text style={styles.fieldText}>
                      {lastName || "Not set"}
                    </Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Role */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>ROLE</Text>
                  {isFieldMissing("role") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "role" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("role")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("role", role)}
                  >
                    <Text style={styles.fieldText}>{role}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Company (Sponsors only) */}
              {userType === "sponsor" && (
                <View style={styles.editField}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>COMPANY</Text>
                    {!company && <Text style={styles.requiredStar}>*</Text>}
                  </View>
                  {editingField === "company" ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.fieldInput}
                        value={tempValue}
                        onChangeText={setTempValue}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => handleSaveField("company")}
                      >
                        <Check color="#FFF" size={18} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.fieldDisplay}
                      onPress={() => handleEditField("company", company)}
                    >
                      <Text style={styles.fieldText}>{company}</Text>
                      <Edit color="#666" size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Email — read-only (tied to auth account, requires dedicated change-email flow) */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>EMAIL</Text>
                </View>
                <View style={[styles.fieldDisplay, { opacity: 0.6 }]}>
                  <Text style={styles.fieldText}>{email}</Text>
                  <Lock color="#999" size={16} />
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#999",
                    marginTop: 4,
                    fontStyle: "italic",
                  }}
                >
                  Email cannot be changed here. Contact support to update your
                  email.
                </Text>
              </View>

              {/* Phone */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>PHONE</Text>
                  {isFieldMissing("phone") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "phone" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="phone-pad"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("phone")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("phone", phone)}
                  >
                    <Text style={styles.fieldText}>{phone}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Bio */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>BIO</Text>
                  {isFieldMissing("bio") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "bio" ? (
                  <View style={styles.editColumn}>
                    <TextInput
                      style={[styles.fieldInput, styles.bioInput]}
                      value={tempValue}
                      onChangeText={setTempValue}
                      multiline
                      numberOfLines={4}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { alignSelf: "flex-end", marginTop: 8 },
                      ]}
                      onPress={() => handleSaveField("bio")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("bio", bio)}
                  >
                    <Text style={styles.fieldText}>{bio}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Contact & Links Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>CONTACT & LINKS</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Portfolio */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>PORTFOLIO URL</Text>
                  {isFieldMissing("portfolio") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "portfolio" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="https://yourportfolio.com"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("portfolio")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("portfolio", portfolio)}
                  >
                    <Text style={styles.fieldText}>
                      {portfolio || "Not set"}
                    </Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Address Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>ADDRESS</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Street */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>STREET ADDRESS</Text>
                  {isFieldMissing("street") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "street" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("street")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("street", street)}
                  >
                    <Text style={styles.fieldText}>{street || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* City */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>CITY</Text>
                  {isFieldMissing("city") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "city" ? (
                  <View style={styles.editRow}>
                    <AutocompleteInput
                      value={tempValue}
                      onChangeText={setTempValue}
                      onSelect={(selectedCity) => {
                        setTempValue(selectedCity);
                      }}
                      suggestions={CITY_NAMES_ONLY}
                      placeholder="e.g., San Francisco"
                      autoFocus
                      style={styles.fieldInput}
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("city")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("city", city)}
                  >
                    <Text style={styles.fieldText}>{city || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* State */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>STATE</Text>
                  {isFieldMissing("state") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "state" ? (
                  <View style={styles.editRow}>
                    <AutocompleteInput
                      value={tempValue}
                      onChangeText={setTempValue}
                      onSelect={(selectedState) => {
                        setTempValue(selectedState);
                      }}
                      suggestions={US_STATES}
                      placeholder="e.g., California"
                      autoFocus
                      style={styles.fieldInput}
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("state")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("state", state)}
                  >
                    <Text style={styles.fieldText}>{state || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Zip */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>ZIP CODE</Text>
                  {isFieldMissing("zip") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "zip" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="numeric"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("zip")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("zip", zip)}
                  >
                    <Text style={styles.fieldText}>{zip || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Country */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>COUNTRY</Text>
                  {isFieldMissing("country") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {editingField === "country" ? (
                  <View style={styles.editRow}>
                    <AutocompleteInput
                      value={tempValue}
                      onChangeText={setTempValue}
                      onSelect={(selectedCountry) => {
                        setTempValue(selectedCountry);
                      }}
                      suggestions={COUNTRIES}
                      placeholder="e.g., United States"
                      autoFocus
                      style={styles.fieldInput}
                    />
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSaveField("country")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() => handleEditField("country", country)}
                  >
                    <Text style={styles.fieldText}>{country || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Expertise Tags */}
              <View style={styles.editField}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>
                    {userType === "applicant"
                      ? "SKILLS & INTERESTS (Max 5)"
                      : "I CAN HELP WITH (Max 5)"}
                  </Text>
                  {isFieldMissing("skills") && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                <View style={styles.tagsContainer}>
                  {expertise.map((tag, index) => (
                    <View key={index} style={styles.editableTag}>
                      <Text style={styles.editableTagText}>{tag}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveTag("expertise", index)}
                      >
                        <X color="#000" size={14} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                {expertise.length < 5 && (
                  <View style={styles.addTagRow}>
                    <AutocompleteInput
                      value={newTag}
                      onChangeText={setNewTag}
                      onSelect={(selectedSkill) => {
                        handleAddTag("expertise", selectedSkill);
                      }}
                      suggestions={ALL_SKILLS}
                      placeholder="Add new..."
                      style={styles.tagInput}
                    />
                    <TouchableOpacity
                      style={styles.addTagBtn}
                      onPress={() => handleAddTag("expertise")}
                    >
                      <Plus color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Applicant-specific fields */}
              {userType === "applicant" && (
                <>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>WORK PREFERENCES</Text>
                    <View style={styles.workPreferenceOptions}>
                      {["Remote", "Hybrid", "On-site"].map((preference) => (
                        <TouchableOpacity
                          key={preference}
                          style={[
                            styles.workPreferenceOption,
                            workPreferences.includes(preference) &&
                              styles.workPreferenceOptionSelected,
                          ]}
                          onPress={() => handleToggleWorkPreference(preference)}
                        >
                          <View
                            style={[
                              styles.workPreferenceCheckbox,
                              workPreferences.includes(preference) &&
                                styles.workPreferenceCheckboxSelected,
                            ]}
                          >
                            {workPreferences.includes(preference) && (
                              <Check color="#FFF" size={16} strokeWidth={3} />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.workPreferenceText,
                              workPreferences.includes(preference) &&
                                styles.workPreferenceTextSelected,
                            ]}
                          >
                            {preference}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>DESIRED ROLES (Max 3)</Text>
                    <View style={styles.tagsContainer}>
                      {desiredRoles.map((tag, index) => (
                        <View key={index} style={styles.editableTag}>
                          <Text style={styles.editableTagText}>{tag}</Text>
                          <TouchableOpacity
                            onPress={() =>
                              handleRemoveTag("desiredRoles", index)
                            }
                          >
                            <X color="#000" size={14} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    {desiredRoles.length < 3 && (
                      <View style={styles.addTagRow}>
                        <TextInput
                          style={styles.tagInput}
                          placeholder="Add role..."
                          value={newRoleTag}
                          onChangeText={setNewRoleTag}
                          onSubmitEditing={() =>
                            handleAddTag("desiredRoles", newRoleTag)
                          }
                        />
                        <TouchableOpacity
                          style={styles.addTagBtn}
                          onPress={() =>
                            handleAddTag("desiredRoles", newRoleTag)
                          }
                        >
                          <Plus color="#FFF" size={18} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Sponsor-specific fields */}
              {userType === "sponsor" && (
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>
                    COMPANIES I CAN REFER TO
                  </Text>
                  <View style={styles.tagsContainer}>
                    {companiesCanReferTo.map((tag, index) => (
                      <View key={index} style={styles.editableTag}>
                        <Text style={styles.editableTagText}>{tag}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveTag("companies", index)}
                        >
                          <X color="#000" size={14} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.addTagRow}>
                    <TextInput
                      style={styles.tagInput}
                      placeholder="Add company..."
                      value={newTag}
                      onChangeText={setNewTag}
                      onSubmitEditing={() => handleAddTag("companies")}
                    />
                    <TouchableOpacity
                      style={styles.addTagBtn}
                      onPress={() => handleAddTag("companies")}
                    >
                      <Plus color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT INSIGHTS MODAL */}
      <EditInsightsModal
        visible={showEditInsights}
        onClose={() => setShowEditInsights(false)}
        insights={profileInsights}
        onAddInsight={handleAddInsight}
        onRemoveInsight={handleRemoveInsight}
        onUpdateInsight={handleUpdateInsight}
      />

      {/* EDIT RESUME MODAL */}
      <Modal visible={showEditResume} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEditResume(false)}
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
            style={styles.modalContent}
            pointerEvents="auto"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Resume Information</Text>
              <TouchableOpacity onPress={() => setShowEditResume(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            {professionalMissingCount > 0 && (
              <View style={styles.modalProgressContainer}>
                <Text style={styles.modalProgressText}>
                  {professionalMissingCount} field
                  {professionalMissingCount !== 1 ? "s" : ""} remaining
                </Text>
                <View style={styles.modalProgressBar}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width: `${Math.max(0, 100 - (professionalMissingCount / 9) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {/* Professional Experience Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>
                  PROFESSIONAL EXPERIENCE
                </Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {professionalExperiences.length === 0 && (
                <View style={styles.emptyStateCard}>
                  <Briefcase size={32} color="#999" />
                  <Text style={styles.emptyStateText}>
                    No work experience added yet.{"\n"}
                    Add your professional experience here.
                  </Text>
                </View>
              )}

              {professionalExperiences.map((exp, idx) => {
                const card = renderExperienceCard(exp);
                if (!card) return null;
                return React.cloneElement(card, {
                  key: exp.id || `exp-${idx}`,
                });
              })}

              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={handleAddExperience}
              >
                <Plus color="#000" size={18} />
                <Text style={styles.addItemText}>Add Work Experience</Text>
              </TouchableOpacity>

              {/* Education Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>EDUCATION</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {educationEntries.length === 0 && (
                <View style={styles.emptyStateCard}>
                  <GraduationCap size={32} color="#999" />
                  <Text style={styles.emptyStateText}>
                    No education added yet.{"\n"}
                    Add your degrees and schools here.
                  </Text>
                </View>
              )}

              {educationEntries.map((entry, idx) => {
                const card = renderEducationCard(entry);
                if (!card) return null;
                return React.cloneElement(card, {
                  key: entry.id || `edu-${idx}`,
                });
              })}

              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={handleAddEducation}
              >
                <Plus color="#000" size={18} />
                <Text style={styles.addItemText}>Add Education</Text>
              </TouchableOpacity>

              {/* Additional Details Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>ADDITIONAL DETAILS</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Certifications & Licenses */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>CERTIFICATIONS & LICENSES</Text>
                {certifications.map((cert, index) =>
                  renderCertificationCard(cert, index),
                )}
                <TouchableOpacity
                  style={styles.addItemBtn}
                  onPress={handleAddCertification}
                >
                  <Plus color="#000" size={18} />
                  <Text style={styles.addItemText}>Add Certification</Text>
                </TouchableOpacity>
              </View>

              {/* Languages */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>LANGUAGES</Text>
                {languages.map((lang, index) =>
                  renderLanguageCard(lang, index),
                )}
                <TouchableOpacity
                  style={styles.addItemBtn}
                  onPress={handleAddLanguage}
                >
                  <Plus color="#000" size={18} />
                  <Text style={styles.addItemText}>Add Language</Text>
                </TouchableOpacity>
              </View>

              {/* Achievements */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>ACHIEVEMENTS & AWARDS</Text>
                {editingField === "achievements" ? (
                  <View style={styles.editColumn}>
                    <TextInput
                      style={[styles.fieldInput, styles.bioInput]}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="Notable achievements, awards, publications, speaking engagements..."
                      multiline
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { alignSelf: "flex-end", marginTop: 8 },
                      ]}
                      onPress={() => handleSaveField("achievements")}
                    >
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.fieldDisplay}
                    onPress={() =>
                      handleEditField("achievements", achievements)
                    }
                  >
                    <Text style={styles.fieldText}>
                      {achievements || "Not set"}
                    </Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PRIVACY & SECURITY MODAL */}
      <SimpleModal
        visible={showPrivacySecurity}
        onClose={() => setShowPrivacySecurity(false)}
        title="Privacy & Security"
      >
        {/* Profile Visibility */}
        <View style={styles.privacySection}>
          <View style={styles.privacyRow}>
            <View style={styles.privacyContent}>
              <Text style={styles.privacyLabel}>Profile Visibility</Text>
              <Text style={styles.privacyDescription}>
                Who can see your profile
              </Text>
            </View>
            <Text style={styles.privacyValue}>Public</Text>
          </View>
        </View>

        {/* Change Password */}
        <TouchableOpacity
          style={styles.privacyActionCard}
          onPress={() => {
            setShowPrivacySecurity(false);
            setTimeout(() => setShowPasswordChange(true), 300);
          }}
        >
          <View style={styles.privacyIconContainer}>
            <Lock color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.privacyActionTitle}>Change Password</Text>
            <Text style={styles.privacyActionSubtitle}>
              Update your password
            </Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Terms & Conditions */}
        <TouchableOpacity
          style={styles.privacyActionCard}
          onPress={() =>
            Linking.openURL(
              "https://gist.github.com/yosef-w/af2a50954afcbdf0fbcb27ed60de34dd",
            )
          }
        >
          <View style={styles.privacyIconContainer}>
            <Briefcase color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.privacyActionTitle}>Terms & Conditions</Text>
            <Text style={styles.privacyActionSubtitle}>
              Read our terms of service
            </Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.privacyActionCard}
          onPress={() =>
            Linking.openURL(
              "https://gist.github.com/yosef-w/a93c7ed52e361528a99d084223e5cfcb",
            )
          }
        >
          <View style={styles.privacyIconContainer}>
            <Lock color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.privacyActionTitle}>Privacy Policy</Text>
            <Text style={styles.privacyActionSubtitle}>
              How we handle your data
            </Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteActionCard}
          onPress={handleDeleteAccount}
        >
          <View style={styles.privacyIconContainer}>
            <Trash2 color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.deleteActionTitle}>Delete Account</Text>
            <Text style={styles.privacyActionSubtitle}>
              Permanently delete your account and data
            </Text>
          </View>
          <ChevronRight color="#666" size={20} />
        </TouchableOpacity>
      </SimpleModal>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={showPasswordChange} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowPasswordChange(false)}
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
            style={styles.modalContent}
            pointerEvents="auto"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordChange(false);
                  setPasswordError("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose a strong password with at least 8 characters
            </Text>

            <View style={{ gap: 20 }}>
              {/* Current Password */}
              <View>
                <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
                <View style={styles.passwordInputWrapper}>
                  <Lock color="#AAA" size={18} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter current password"
                    placeholderTextColor="#BBB"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* New Password */}
              <View>
                <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                <View style={styles.passwordInputWrapper}>
                  <Lock color="#AAA" size={18} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#BBB"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View>
                <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
                <View style={styles.passwordInputWrapper}>
                  <Lock color="#AAA" size={18} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#BBB"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Error Message */}
              {passwordError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              ) : null}

              {/* Update Password Button */}
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
                onPress={handlePasswordChange}
              >
                <Text style={styles.blackBtnText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* NOTIFICATIONS MODAL */}
      <SimpleModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        title="Notifications"
      >
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Email Notifications</Text>
          <Switch
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            trackColor={{ false: "#E5E5E5", true: "#000" }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Push Notifications</Text>
          <Switch
            value={pushNotifications}
            onValueChange={setPushNotifications}
            trackColor={{ false: "#E5E5E5", true: "#000" }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Referral Updates</Text>
          <Switch
            value={referralUpdates}
            onValueChange={setReferralUpdates}
            trackColor={{ false: "#E5E5E5", true: "#000" }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>New Messages</Text>
          <Switch
            value={messageNotifications}
            onValueChange={setMessageNotifications}
            trackColor={{ false: "#E5E5E5", true: "#000" }}
            thumbColor="#FFF"
          />
        </View>
      </SimpleModal>
    </ScrollView>
  );
}

function SettingItem({
  label,
  color = "#000",
  isLast = false,
  showNotificationDot = false,
  badgeCount,
  onPress,
}: {
  label: string;
  color?: string;
  isLast?: boolean;
  showNotificationDot?: boolean;
  badgeCount?: number;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[styles.settingLabel, { color }]}>{label}</Text>
        {typeof badgeCount === "number" && badgeCount > 0 && (
          <View style={styles.settingBadge}>
            <Text style={styles.settingBadgeText}>{badgeCount}</Text>
          </View>
        )}
      </View>
      <ChevronRight color="#BBB" size={18} />
    </TouchableOpacity>
  );
}

// Edit Insights Modal Component
function EditInsightsModal({
  visible,
  onClose,
  insights,
  onAddInsight,
  onRemoveInsight,
  onUpdateInsight,
}: {
  visible: boolean;
  onClose: () => void;
  insights: ProfileInsight[];
  onAddInsight: (question: string, answer: string) => void;
  onRemoveInsight: (index: number) => void;
  onUpdateInsight: (index: number, answer: string) => void;
}) {
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(
    null,
  );
  const [newAnswer, setNewAnswer] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");

  const handleSelectQuestion = (question: string) => {
    setSelectedQuestion(question);
    setShowQuestionPicker(false);
    setNewAnswer("");
  };

  const handleSaveNew = () => {
    if (selectedQuestion && newAnswer.trim()) {
      onAddInsight(selectedQuestion, newAnswer.trim());
      setSelectedQuestion("");
      setNewAnswer("");
    }
  };

  const handleUpdateExisting = (index: number) => {
    if (newAnswer.trim()) {
      onUpdateInsight(index, newAnswer.trim());
      setEditingInsightIndex(null);
      setNewAnswer("");
    }
  };

  const usedQuestions = insights.map((i) => i.question);
  const availableQuestions = AVAILABLE_QUESTIONS.filter(
    (q) => !usedQuestions.includes(q),
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
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
          style={styles.modalContent}
          pointerEvents="auto"
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile Insights</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Add up to 3 fun facts or prompts to showcase your personality
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.modalScroll}
            keyboardShouldPersistTaps="always"
          >
            {/* Existing Insights */}
            {insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightCardHeader}>
                  <Text style={styles.insightQuestion}>{insight.question}</Text>
                  <TouchableOpacity onPress={() => onRemoveInsight(index)}>
                    <Trash2 color="#FF3B30" size={18} />
                  </TouchableOpacity>
                </View>

                {editingInsightIndex === index ? (
                  <View>
                    <TextInput
                      style={styles.insightInput}
                      value={newAnswer}
                      onChangeText={setNewAnswer}
                      placeholder="Your answer..."
                      multiline
                      numberOfLines={3}
                      autoFocus
                    />
                    <View style={styles.insightActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setEditingInsightIndex(null);
                          setNewAnswer("");
                        }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveInsightBtn}
                        onPress={() => handleUpdateExisting(index)}
                      >
                        <Text style={styles.saveInsightBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingInsightIndex(index);
                      setNewAnswer(insight.answer);
                    }}
                  >
                    <Text style={styles.insightAnswer}>{insight.answer}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Add New Insight */}
            {insights.length < 3 && (
              <View style={styles.addInsightSection}>
                {!selectedQuestion ? (
                  <TouchableOpacity
                    style={styles.selectQuestionBtn}
                    onPress={() => setShowQuestionPicker(!showQuestionPicker)}
                  >
                    <Plus color="#000" size={20} />
                    <Text style={styles.selectQuestionText}>
                      Select a Question
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.newInsightCard}>
                    <View style={styles.insightCardHeader}>
                      <Text style={styles.insightQuestion}>
                        {selectedQuestion}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedQuestion("");
                          setNewAnswer("");
                        }}
                      >
                        <X color="#666" size={18} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.insightInput}
                      value={newAnswer}
                      onChangeText={setNewAnswer}
                      placeholder="Your answer..."
                      multiline
                      numberOfLines={3}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.saveInsightBtn,
                        { alignSelf: "flex-end", marginTop: 12 },
                      ]}
                      onPress={handleSaveNew}
                    >
                      <Text style={styles.saveInsightBtnText}>Add Insight</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Question Picker */}
                {showQuestionPicker && (
                  <View style={styles.questionPicker}>
                    {availableQuestions.map((question) => (
                      <TouchableOpacity
                        key={question}
                        style={styles.questionOption}
                        onPress={() => handleSelectQuestion(question)}
                      >
                        <Text style={styles.questionOptionText}>
                          {question}
                        </Text>
                        <ChevronRight color="#666" size={18} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Simple Modal Component
function SimpleModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
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
          style={styles.modalContent}
          pointerEvents="auto"
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.modalScroll}
            keyboardShouldPersistTaps="always"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
  profileHeader: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatarWrapper: {
    marginBottom: 20,
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E5E5",
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  avatarPlaceholderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editFab: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#000",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  editFabHighlight: {
    backgroundColor: "#000",
  },
  profileImageIndicator: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#F9F9F9",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  locationText: {
    fontSize: 14,
    color: "#BBB",
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#BBB",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#EEE",
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  // Applicant-Specific Styles
  preferenceTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#000",
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
  roleTagText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },

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

  settingsSection: {
    marginTop: 8,
  },
  settingsGroup: {
    backgroundColor: "#F9F9F9",
    borderRadius: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
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
  buttonBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#000",
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  buttonBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
  settingBadge: {
    backgroundColor: "#000",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  settingBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },

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
    color: "#EF4444",
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  requiredStar: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EF4444",
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

  // Insights Modal Styles
  insightCard: {
    backgroundColor: "#F9F9F9",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  insightCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  insightQuestion: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
    flex: 1,
  },
  insightAnswer: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    fontStyle: "italic",
  },
  insightInput: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    fontSize: 15,
    color: "#000",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    minHeight: 80,
    textAlignVertical: "top",
  },
  insightActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  saveInsightBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  saveInsightBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  addInsightSection: {
    marginTop: 8,
  },
  selectQuestionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
  },
  selectQuestionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  newInsightCard: {
    backgroundColor: "#F9F9F9",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  questionPicker: {
    marginTop: 12,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
  questionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  questionOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    flex: 1,
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
  deleteActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 2,
    borderColor: "#333",
  },
  deleteActionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 2,
    letterSpacing: 0.5,
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
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFE5E5",
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
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
    backgroundColor: "#FFF9E6",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
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
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
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
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  resumeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  resumeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resumeSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aiBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  resumeSectionSubtitle: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginBottom: 16,
    lineHeight: 18,
  },
  resumeStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  resumeStatusText: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "700",
  },
  resumeUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 14,
  },
  resumeUploadBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
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
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
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
    color: "#15803D",
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
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  resumeFieldPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
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
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    padding: 14,
  },
  resumeErrorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 2,
  },
  resumeErrorSub: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  resumeRetryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resumeRetryText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  resumeDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 14,
  },
  resumeManualLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resumeManualLinkText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
});
