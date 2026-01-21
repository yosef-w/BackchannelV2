import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import {
    AlertCircle,
    Briefcase,
    Camera,
    Check,
    ChevronRight,
    Clock,
    Edit,
    ImageIcon,
    Lock,
    LogOut,
    MapPin,
    MessageCircle,
    Plus,
    Target,
    Trash2,
    X
} from "lucide-react-native";
import React, { useState, useEffect, useMemo } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
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
import Animated, { FadeInUp, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useAuthStore } from "../stores/useAuthStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";

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
  const clearUserProfileData = useUserProfileStore((state) => state.clearData);
  const userProfileData = useUserProfileStore((state) => state.data);
  const updatePersonal = useUserProfileStore((state) => state.updatePersonal);
  const updateProfessional = useUserProfileStore((state) => state.updateProfessional);
  const updateEducation = useUserProfileStore((state) => state.updateEducation);
  const updatePreferences = useUserProfileStore((state) => state.updatePreferences);
  const updateSkills = useUserProfileStore((state) => state.updateSkills);
  const updateInsights = useUserProfileStore((state) => state.updateInsights);
  const updateCertifications = useUserProfileStore((state) => state.updateCertifications);
  const updateLanguages = useUserProfileStore((state) => state.updateLanguages);
  const updateAchievements = useUserProfileStore((state) => state.updateAchievements);
  
  const [activeTab, setActiveTab] = useState<"profile" | "applications">("profile");
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditInsights, setShowEditInsights] = useState(false);
  const [showEditResume, setShowEditResume] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Editable profile state
  const [name, setName] = useState("Alex Johnson");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState(userType === "applicant" ? "Seeking Product Manager Roles" : "VP of Product");
  const [company, setCompany] = useState("Stripe");
  const [location, setLocation] = useState("San Francisco, CA");
  const [email, setEmail] = useState("alex.johnson@email.com");
  const [phone, setPhone] = useState("+1 (415) 555-0123");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bio, setBio] = useState(
    userType === "applicant"
      ? "Passionate about AI/ML and building products that scale. Looking to join a high-growth startup where I can lead product strategy and make meaningful impact."
      : "Helping the next generation of product leaders break into tech. 10+ years at Google and Stripe, now mentoring at early-stage companies and opening doors for talented PMs."
  );

  // Additional details (optional)
  const [achievements, setAchievements] = useState("Forbes 30 Under 30 (Consumer Tech). 2 Patents in Recommendation Systems. Speaker at SXSW 2023 on 'The Future of Audio'.");
  const [certifications, setCertifications] = useState<Array<{ name: string; organization: string; year: string }>>([]);
  const [languages, setLanguages] = useState<Array<{ language: string; proficiency: string }>>([]);
  
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
  
  // Work preferences (required for profile completion)
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [willingToRelocate, setWillingToRelocate] = useState("");
  const [requiresSponsorship, setRequiresSponsorship] = useState("");
  
  // Personal information fields (for edit profile modal)
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  
  // Editable tags state
  const [expertise, setExpertise] = useState(
    userType === "applicant"
      ? ["React", "Product Strategy", "FinTech", "Early Stage Startups", "Data Analytics", "UX Design"]
      : ["Product Management", "Engineering Leadership", "Career Growth", "Interview Prep", "Product Strategy", "Team Building"]
  );
  const [workPreferences, setWorkPreferences] = useState(["Remote", "Hybrid OK", "Open-site", "Startup Stage: Series A-C"]);
  const [desiredRoles, setDesiredRoles] = useState(["Senior Product Manager", "Lead Product Manager", "Director of Product"]);
  const [companiesCanReferTo, setCompaniesCanReferTo] = useState(["Stripe", "Google", "Meta", "Airbnb", "Notion", "Figma"]);
  
  // Profile insights state
  const [profileInsights, setProfileInsights] = useState<ProfileInsight[]>([
    { question: "MY SECRET SUPERPOWER", answer: "Turning complex data into simple, actionable stories." },
    { question: "IF I WASN'T IN TECH", answer: "I'd be a chef. Chemistry you can eat." },
  ]);
  
  // Temp states for editing
  const [tempValue, setTempValue] = useState("");
  const [newTag, setNewTag] = useState("");
  
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
    if (userProfileData.personal.email || userProfileData.personal.firstName || userProfileData.personal.fullName) {
      setFirstName(userProfileData.personal.firstName);
      setLastName(userProfileData.personal.lastName);
      setName(userProfileData.personal.fullName || `${userProfileData.personal.firstName} ${userProfileData.personal.lastName}`.trim());
      setEmail(userProfileData.personal.email);
      setPhone(userProfileData.personal.phone);
      setProfileImage(userProfileData.personal.profileImage || null);
      setLinkedin(userProfileData.personal.linkedin);
      setPortfolio(userProfileData.personal.portfolio);
      setStreet(userProfileData.personal.address.street);
      setCity(userProfileData.personal.address.city);
      setState(userProfileData.personal.address.state);
      setZip(userProfileData.personal.address.zip);
      setCountry(userProfileData.personal.address.country);
      setLocation(`${userProfileData.personal.address.city}${userProfileData.personal.address.state ? ', ' + userProfileData.personal.address.state : ''}`);
    }
    if (userProfileData.professional.title) {
      setRole(userProfileData.professional.title);
      setJobTitle(userProfileData.professional.title);
    }
    if (userProfileData.professional.summary) {
      setBio(userProfileData.professional.summary);
      setSummary(userProfileData.professional.summary);
    }
    if (userProfileData.professional.yearsExperience) {
      setYearsExperience(userProfileData.professional.yearsExperience);
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
    // Load additional details if they exist in the store
    if (userProfileData.certifications && userProfileData.certifications.length > 0) {
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
    if (certifications.length > 0 || (userProfileData.certifications?.length ?? 0) > 0) {
      updateCertifications(certifications);
    }
  }, [certifications]);

  // Auto-save languages when they change
  useEffect(() => {
    if (languages.length > 0 || (userProfileData.languages?.length ?? 0) > 0) {
      updateLanguages(languages);
    }
  }, [languages]);

  const stats = userType === "applicant"
    ? [
        { label: "Connections", value: "12" },
        { label: "Referrals", value: "3" },
        { label: "Applied", value: "8" },
      ]
    : [
        { label: "Network", value: "24" },
        { label: "Referrals", value: "15" },
        { label: "Success", value: "87%" },
      ];

  const mockApplications = [
    {
      id: 1,
      jobTitle: "Senior Product Manager",
      company: "Google",
      companyLogo: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=200",
      status: "interview_scheduled" as const,
      appliedDate: "Jan 2, 2026",
      nextAction: "Technical interview on Jan 8 at 2 PM",
      sponsorName: "Sarah Chen",
      sponsorRole: "VP of Product",
      sponsorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
      timeline: [
        { stage: "Applied", date: "Jan 2", completed: true },
        { stage: "Referred", date: "Jan 2", completed: true, isReferred: true },
        { stage: "Screening", date: "Jan 3", completed: true },
        { stage: "Interview", date: "Jan 8", completed: false },
        { stage: "Decision", date: "TBD", completed: false }
      ]
    },
    {
      id: 2,
      jobTitle: "Lead Product Designer",
      company: "Airbnb",
      companyLogo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200",
      status: "reviewing" as const,
      appliedDate: "Jan 3, 2026",
      nextAction: "Application under review by hiring team",
      sponsorName: "Michael Rodriguez",
      sponsorRole: "Design Director",
      sponsorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
      timeline: [
        { stage: "Applied", date: "Jan 3", completed: true },
        { stage: "Referred", date: "Jan 3", completed: true, isReferred: true },
        { stage: "Screening", date: "Pending", completed: false },
        { stage: "Interview", date: "TBD", completed: false },
        { stage: "Decision", date: "TBD", completed: false }
      ]
    },
    {
      id: 3,
      jobTitle: "Product Marketing Manager",
      company: "Notion",
      companyLogo: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=200",
      status: "applied" as const,
      appliedDate: "Jan 4, 2026",
      nextAction: "Waiting for referral confirmation",
      sponsorName: "Emily Watson",
      sponsorRole: "Head of Marketing",
      sponsorImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
      timeline: [
        { stage: "Applied", date: "Jan 4", completed: true },
        { stage: "Referred", date: "Pending", completed: false, isReferred: true },
        { stage: "Screening", date: "Pending", completed: false },
        { stage: "Interview", date: "TBD", completed: false },
        { stage: "Decision", date: "TBD", completed: false }
      ]
    },
    {
      id: 4,
      jobTitle: "VP of Product",
      company: "Stripe",
      companyLogo: "https://images.unsplash.com/photo-1599658880436-c61792e70672?w=200",
      status: "offer" as const,
      appliedDate: "Dec 28, 2025",
      nextAction: "Offer received - respond by Jan 10",
      sponsorName: "David Park",
      sponsorRole: "Chief Product Officer",
      sponsorImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200",
      timeline: [
        { stage: "Applied", date: "Dec 28", completed: true },
        { stage: "Referred", date: "Dec 28", completed: true, isReferred: true },
        { stage: "Screening", date: "Dec 29", completed: true },
        { stage: "Interview", date: "Dec 30", completed: true },
        { stage: "Decision", date: "Jan 2", completed: true }
      ]
    }
  ];

  const getStatusLabel = (status: string) => {
    const labels = {
      applied: "Applied",
      reviewing: "Under Review",
      interview_scheduled: "Interview",
      offer: "Offer",
      rejected: "Closed"
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusDotColor = (status: string) => {
    const colors = {
      applied: { backgroundColor: "#3B82F6" },
      reviewing: { backgroundColor: "#F59E0B" },
      interview_scheduled: { backgroundColor: "#10B981" },
      offer: { backgroundColor: "#8B5CF6" },
      rejected: { backgroundColor: "#EF4444" }
    };
    return colors[status as keyof typeof colors] || { backgroundColor: "#999" };
  };

  const getStatusBadgeStyle = (status: string) => {
    const styles = {
      applied: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
      reviewing: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
      interview_scheduled: { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" },
      offer: { backgroundColor: "#EDE9FE", borderColor: "#DDD6FE" },
      rejected: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }
    };
    return styles[status as keyof typeof styles] || { backgroundColor: "#F5F5F5", borderColor: "#E5E5E5" };
  };

  const getStatusTextColor = (status: string) => {
    const colors = {
      applied: { color: "#1E40AF" },
      reviewing: { color: "#B45309" },
      interview_scheduled: { color: "#047857" },
      offer: { color: "#6D28D9" },
      rejected: { color: "#B91C1C" }
    };
    return colors[status as keyof typeof colors] || { color: "#666" };
  };

  const applicantData: ApplicantProfile = {
    name,
    role,
    location,
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
    location,
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

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveField = async (field: string) => {
    switch (field) {
      case "firstName":
        setFirstName(tempValue);
        setName(`${tempValue} ${lastName}`.trim());
        await updatePersonal({
          firstName: tempValue,
          fullName: `${tempValue} ${lastName}`.trim(),
        });
        break;
      case "lastName":
        setLastName(tempValue);
        setName(`${firstName} ${tempValue}`.trim());
        await updatePersonal({
          lastName: tempValue,
          fullName: `${firstName} ${tempValue}`.trim(),
        });
        break;
      case "role":
        setRole(tempValue);
        await updateProfessional({ title: tempValue });
        break;
      case "company":
        setCompany(tempValue);
        break;
      case "location":
        setLocation(tempValue);
        const [city, state] = tempValue.split(', ');
        await updatePersonal({
          address: {
            ...userProfileData.personal.address,
            city: city || tempValue,
            state: state || '',
          },
        });
        break;
      case "email":
        setEmail(tempValue);
        await updatePersonal({ email: tempValue });
        break;
      case "phone":
        setPhone(tempValue);
        await updatePersonal({ phone: tempValue });
        break;
      case "bio":
        setBio(tempValue);
        await updateProfessional({ summary: tempValue });
        break;
      case "experience":
        setExperience(tempValue);
        break;
      case "education":
        setEducation(tempValue);
        break;
      case "achievements":
        setAchievements(tempValue);
        await updateAchievements(tempValue);
        break;
      case "jobTitle":
        setJobTitle(tempValue);
        await updateProfessional({ title: tempValue });
        break;
      case "yearsExperience":
        setYearsExperience(tempValue);
        await updateProfessional({ yearsExperience: tempValue });
        break;
      case "summary":
        setSummary(tempValue);
        await updateProfessional({ summary: tempValue });
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
        break;
      case "willingToRelocate":
        setWillingToRelocate(tempValue);
        await updatePreferences({ willingToRelocate: tempValue });
        break;
      case "requiresSponsorship":
        setRequiresSponsorship(tempValue);
        await updatePreferences({ requiresSponsorship: tempValue });
        break;
      case "linkedin":
        setLinkedin(tempValue);
        await updatePersonal({ linkedin: tempValue });
        break;
      case "portfolio":
        setPortfolio(tempValue);
        await updatePersonal({ portfolio: tempValue });
        break;
      case "street":
        setStreet(tempValue);
        await updatePersonal({
          address: { ...userProfileData.personal.address, street: tempValue },
        });
        break;
      case "city":
        setCity(tempValue);
        await updatePersonal({
          address: { ...userProfileData.personal.address, city: tempValue },
        });
        break;
      case "state":
        setState(tempValue);
        await updatePersonal({
          address: { ...userProfileData.personal.address, state: tempValue },
        });
        break;
      case "zip":
        setZip(tempValue);
        await updatePersonal({
          address: { ...userProfileData.personal.address, zip: tempValue },
        });
        break;
      case "country":
        setCountry(tempValue);
        await updatePersonal({
          address: { ...userProfileData.personal.address, country: tempValue },
        });
        break;
    }
    setEditingField(null);
    setTempValue("");
  };

  const handleAddTag = async (type: "expertise" | "workPreferences" | "desiredRoles" | "companies") => {
    if (!newTag.trim()) return;
    
    switch (type) {
      case "expertise":
        const newExpertise = [...expertise, newTag.trim()];
        setExpertise(newExpertise);
        await updateSkills(newExpertise);
        break;
      case "workPreferences":
        setWorkPreferences([...workPreferences, newTag.trim()]);
        break;
      case "desiredRoles":
        setDesiredRoles([...desiredRoles, newTag.trim()]);
        break;
      case "companies":
        setCompaniesCanReferTo([...companiesCanReferTo, newTag.trim()]);
        break;
    }
    setNewTag("");
  };

  const handleRemoveTag = async (type: "expertise" | "workPreferences" | "desiredRoles" | "companies", index: number) => {
    switch (type) {
      case "expertise":
        const updatedExpertise = expertise.filter((_, i) => i !== index);
        setExpertise(updatedExpertise);
        await updateSkills(updatedExpertise);
        break;
      case "workPreferences":
        setWorkPreferences(workPreferences.filter((_, i) => i !== index));
        break;
      case "desiredRoles":
        setDesiredRoles(desiredRoles.filter((_, i) => i !== index));
        break;
      case "companies":
        setCompaniesCanReferTo(companiesCanReferTo.filter((_, i) => i !== index));
        break;
    }
  };

  const handleAddInsight = async (question: string, answer: string) => {
    if (profileInsights.length >= 3) {
      alert("You can only have up to 3 profile insights");
      return;
    }
    const newInsights = [...profileInsights, { question, answer }];
    setProfileInsights(newInsights);
    await updateInsights(newInsights);
  };

  const handleRemoveInsight = async (index: number) => {
    const updatedInsights = profileInsights.filter((_, i) => i !== index);
    setProfileInsights(updatedInsights);
    await updateInsights(updatedInsights);
  };

  const handleUpdateInsight = async (index: number, answer: string) => {
    const updated = [...profileInsights];
    updated[index].answer = answer;
    setProfileInsights(updated);
    await updateInsights(updated);
  };

  const handlePasswordChange = () => {
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
    
    // Success - In real app, this would call an API
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordChange(false);
    // Show success message or toast
  };

  // Image picker functions
  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is needed to select photos.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions('gallery');
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
    const hasPermission = await requestPermissions('camera');
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

  const handleImageSelected = (uri: string) => {
    setProfileImage(uri);
    updatePersonal({ profileImage: uri });
    setShowImagePickerModal(false);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await clearAuth();
    await clearUserProfileData();
    router.replace("/splash");
  };

  // Helper to count missing fields by category
  const getMissingFieldsCount = (category: 'personal' | 'professional') => {
    if (!profileCompletion) return 0;
    return profileCompletion.missingFields.filter(f => {
      if (category === 'personal') {
        return f.category === 'Personal Information';
      } else {
        return f.category !== 'Personal Information';
      }
    }).length;
  };

  const personalMissingCount = getMissingFieldsCount('personal');
  const professionalMissingCount = getMissingFieldsCount('professional');

  // Helper to check if a specific field is missing
  const isFieldMissing = (fieldKey: string) => {
    if (!profileCompletion) return false;
    return profileCompletion.missingFields.some(f => f.field === fieldKey);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: profileImage || "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=200" }}
            style={styles.avatar}
          />
          <TouchableOpacity 
            style={[styles.editFab, isFieldMissing('profileImage') && styles.editFabHighlight]} 
            onPress={() => setShowImagePickerModal(true)}
          >
            <Edit color="#FFF" size={14} strokeWidth={2.5} />
          </TouchableOpacity>
          {isFieldMissing('profileImage') && (
            <View style={styles.profileImageIndicator}>
              <AlertCircle color="#1E40AF" size={20} />
            </View>
          )}
        </View>

        <Text style={styles.name}>{profileData.name}</Text>
        
        <View style={styles.infoRow}>
          <Briefcase color="#000" size={14} strokeWidth={2} />
          <Text style={styles.infoText}>
            {userType === "sponsor"
              ? `${sponsorData.role} @ ${sponsorData.company}`
              : applicantData.role
            }
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MapPin color="#BBB" size={14} strokeWidth={2} />
          <Text style={styles.locationText}>{profileData.location}</Text>
        </View>

        <Text style={styles.bio}>{profileData.bio}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.blackBtn} onPress={() => setShowEditProfile(true)}>
            <Edit color="#FFF" size={16} />
            <Text style={styles.blackBtnText}>Edit Profile</Text>
            {personalMissingCount > 0 && (
              <View style={styles.buttonBadge}>
                <Text style={styles.buttonBadgeText}>{personalMissingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.whiteBtn}>
            <FontAwesome name="linkedin-square" size={20} color="#000" />
            <Text style={styles.whiteBtnText}>LinkedIn</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <Animated.View
            key={stat.label}
            entering={FadeInUp.delay(index * 100).duration(400)}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Tab Navigation (Applicants Only) */}
      {userType === "applicant" && (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === "profile" && styles.tabActive]} 
            onPress={() => setActiveTab("profile")}
          >
            <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === "applications" && styles.tabActive]} 
            onPress={() => setActiveTab("applications")}
          >
            <Text style={[styles.tabText, activeTab === "applications" && styles.tabTextActive]}>Applications</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile Content */}
      {activeTab === "profile" && (
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
        </>
      )}

      {/* Applications Content */}
      {activeTab === "applications" && userType === "applicant" && (
        <View style={styles.applicationsContainer}>
          <Text style={styles.applicationsTitle}>My Applications</Text>
          <Text style={styles.applicationsSubtitle}>{mockApplications.length} active applications</Text>
          
          {mockApplications.map((app, index) => (
            <Animated.View key={app.id} entering={FadeInUp.delay(index * 100)}>
              <TouchableOpacity 
                style={styles.applicationCard} 
                onPress={() => {
                  setSelectedApplication(app);
                  setShowApplicationDetail(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.appCardHeader}>
                  <Image source={{ uri: app.companyLogo }} style={styles.companyLogo} />
                  <View style={styles.appCardInfo}>
                    <Text style={styles.appJobTitle}>{app.jobTitle}</Text>
                    <Text style={styles.appCompany}>{app.company}</Text>
                  </View>
                  <View style={styles.statusBadgeBlack}>
                    <Text style={styles.statusBadgeBlackText}>{getStatusLabel(app.status)}</Text>
                  </View>
                </View>

                <View style={styles.timelineContainer}>
                  {app.timeline.map((stage, idx) => (
                    <View key={idx} style={styles.timelineItem}>
                      <View style={[
                        styles.timelineDot, 
                        stage.completed && styles.timelineDotCompleted,
                        stage.isReferred && styles.timelineDotReferred,
                        stage.isReferred && stage.completed && styles.timelineDotReferredCompleted
                      ]} />
                      {idx < app.timeline.length - 1 && <View style={styles.timelineLine} />}
                      <View style={styles.timelineContent}>
                        <Text style={[
                          styles.timelineStage, 
                          stage.completed && styles.timelineStageCompleted,
                          stage.isReferred && stage.completed && styles.timelineStageReferred
                        ]}>{stage.stage}</Text>
                        <Text style={styles.timelineDate}>{stage.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.appCardFooter}>
                  <Image source={{ uri: app.sponsorImage }} style={styles.sponsorAvatar} />
                  <View style={styles.sponsorInfo}>
                    <Text style={styles.sponsorLabel}>SPONSORED BY</Text>
                    <Text style={styles.sponsorName}>{app.sponsorName}</Text>
                  </View>
                  <ChevronRight color="#BBB" size={18} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      )}

      {activeTab === "profile" && (
        <>
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
      )}

      {/* Settings List */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingItem label="Edit Profile Insights" onPress={() => setShowEditInsights(true)} />
          {userType === "applicant" && (
            <SettingItem 
              label="Edit Resume Information" 
              badgeCount={professionalMissingCount}
              onPress={() => setShowEditResume(true)} 
            />
          )}
          <SettingItem label="Privacy & Security" onPress={() => setShowPrivacySecurity(true)} />
          <SettingItem label="Notifications" onPress={() => setShowNotifications(true)} />
          <SettingItem label="Log Out" color="#000" isLast onPress={handleLogout} />
        </View>
      </View>

      {/* IMAGE PICKER MODAL */}
      <Modal visible={showImagePickerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowImagePickerModal(false)}>
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.modalContent, { paddingBottom: 50 }]}>
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
                style={[styles.blackBtn, { width: '100%', justifyContent: 'center', borderWidth: 0 }]} 
                onPress={takePhoto}
              >
                <Camera color="#FFF" size={18} />
                <Text style={styles.blackBtnText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.whiteBtn, { width: '100%', justifyContent: 'center' }]} 
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
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowLogoutModal(false)}>
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.modalContent, { paddingBottom: 50 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Out</Text>
              <TouchableOpacity onPress={() => setShowLogoutModal(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              <TouchableOpacity 
                style={[styles.blackBtn, { width: '100%', justifyContent: 'center', borderWidth: 0 }]} 
                onPress={confirmLogout}
              >
                <LogOut color="#FFF" size={18} />
                <Text style={styles.blackBtnText}>Log Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.whiteBtn, { width: '100%', justifyContent: 'center' }]} 
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.whiteBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* APPLICATION DETAIL MODAL */}
      {selectedApplication && (
        <Modal visible={showApplicationDetail} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={() => {
                setShowApplicationDetail(false);
                setTimeout(() => setSelectedApplication(null), 300);
              }}
            >
              <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
            </TouchableOpacity>
            
            <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <TouchableOpacity 
                style={styles.modalCloseBtn} 
                onPress={() => {
                  setShowApplicationDetail(false);
                  setTimeout(() => setSelectedApplication(null), 300);
                }}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
              
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <View style={styles.appDetailHeader}>
                  <Image source={{ uri: selectedApplication.companyLogo }} style={styles.appDetailLogo} />
                  <Text style={styles.appDetailTitle}>{selectedApplication.jobTitle}</Text>
                  <Text style={styles.appDetailCompany}>{selectedApplication.company}</Text>
                  <View style={styles.statusBadgeBlack}>
                    <Text style={styles.statusBadgeBlackText}>
                      {getStatusLabel(selectedApplication.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>APPLICATION TIMELINE</Text>
                  <View style={styles.timelineDetailContainer}>
                    {selectedApplication.timeline.map((stage: any, idx: number) => (
                      <View key={idx} style={styles.timelineDetailItem}>
                        <View style={styles.timelineDetailLeft}>
                          <View style={[
                            styles.timelineDetailDot, 
                            stage.completed && styles.timelineDetailDotCompleted,
                            stage.isReferred && styles.timelineDetailDotReferred,
                            stage.isReferred && stage.completed && styles.timelineDetailDotReferredCompleted
                          ]} />
                          {idx < selectedApplication.timeline.length - 1 && (
                            <View style={[
                              styles.timelineDetailLine,
                              stage.completed && selectedApplication.timeline[idx + 1].completed && styles.timelineDetailLineCompleted
                            ]} />
                          )}
                        </View>
                        <View style={styles.timelineDetailRight}>
                          <Text style={[
                            styles.timelineDetailStage, 
                            stage.completed && styles.timelineDetailStageCompleted,
                            stage.isReferred && stage.completed && styles.timelineDetailStageReferred
                          ]}>
                            {stage.stage}
                          </Text>
                          <Text style={styles.timelineDetailDate}>{stage.date}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>SPONSOR</Text>
                  <View style={styles.sponsorCard}>
                    <Image source={{ uri: selectedApplication.sponsorImage }} style={styles.sponsorDetailAvatar} />
                    <View style={styles.sponsorDetailInfo}>
                      <Text style={styles.sponsorDetailName}>{selectedApplication.sponsorName}</Text>
                      <Text style={styles.sponsorDetailRole}>{selectedApplication.sponsorRole} @ {selectedApplication.company}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>NEXT STEPS</Text>
                  <View style={styles.nextActionCard}>
                    <Clock size={20} color="#000" />
                    <Text style={styles.nextActionText}>{selectedApplication.nextAction}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.messageBtn} activeOpacity={0.7}>
                  <MessageCircle color="#FFF" size={20} />
                  <Text style={styles.messageBtnText}>Message {selectedApplication.sponsorName}</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditProfile} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEditProfile(false)}>
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            {personalMissingCount > 0 && (
              <View style={styles.modalProgressContainer}>
                <Text style={styles.modalProgressText}>
                  {personalMissingCount} field{personalMissingCount !== 1 ? 's' : ''} remaining
                </Text>
                <View style={styles.modalProgressBar}>
                  <View style={[styles.modalProgressFill, { 
                    width: `${Math.max(0, 100 - (personalMissingCount / 9 * 100))}%` 
                  }]} />
                </View>
              </View>
            )}
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Basic Information Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>BASIC INFORMATION</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* First Name */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('firstName') && styles.fieldLabelIncomplete]}>FIRST NAME</Text>
                {editingField === "firstName" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("firstName")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("firstName", firstName)}>
                    <Text style={styles.fieldText}>{firstName || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Last Name */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('lastName') && styles.fieldLabelIncomplete]}>LAST NAME</Text>
                {editingField === "lastName" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("lastName")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("lastName", lastName)}>
                    <Text style={styles.fieldText}>{lastName || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Role */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>ROLE</Text>
                {editingField === "role" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("role")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("role", role)}>
                    <Text style={styles.fieldText}>{role}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Company (Sponsors only) */}
              {userType === "sponsor" && (
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>COMPANY</Text>
                  {editingField === "company" ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.fieldInput}
                        value={tempValue}
                        onChangeText={setTempValue}
                        autoFocus
                      />
                      <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("company")}>
                        <Check color="#FFF" size={18} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("company", company)}>
                      <Text style={styles.fieldText}>{company}</Text>
                      <Edit color="#666" size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Location */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>LOCATION</Text>
                {editingField === "location" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("location")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("location", location)}>
                    <Text style={styles.fieldText}>{location}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Email */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('email') && styles.fieldLabelIncomplete]}>EMAIL</Text>
                {editingField === "email" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("email")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("email", email)}>
                    <Text style={styles.fieldText}>{email}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Phone */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('phone') && styles.fieldLabelIncomplete]}>PHONE</Text>
                {editingField === "phone" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="phone-pad"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("phone")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("phone", phone)}>
                    <Text style={styles.fieldText}>{phone}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Bio */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>BIO</Text>
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
                    <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => handleSaveField("bio")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("bio", bio)}>
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

              {/* LinkedIn */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('linkedin') && styles.fieldLabelIncomplete]}>LINKEDIN PROFILE</Text>
                {editingField === "linkedin" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="https://linkedin.com/in/username"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("linkedin")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("linkedin", linkedin)}>
                    <Text style={styles.fieldText}>{linkedin || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Portfolio */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('portfolio') && styles.fieldLabelIncomplete]}>PORTFOLIO URL</Text>
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
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("portfolio")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("portfolio", portfolio)}>
                    <Text style={styles.fieldText}>{portfolio || "Not set"}</Text>
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
                <Text style={[styles.fieldLabel, isFieldMissing('street') && styles.fieldLabelIncomplete]}>STREET ADDRESS</Text>
                {editingField === "street" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("street")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("street", street)}>
                    <Text style={styles.fieldText}>{street || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* City */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('city') && styles.fieldLabelIncomplete]}>CITY</Text>
                {editingField === "city" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("city")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("city", city)}>
                    <Text style={styles.fieldText}>{city || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* State */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('state') && styles.fieldLabelIncomplete]}>STATE</Text>
                {editingField === "state" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("state")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("state", state)}>
                    <Text style={styles.fieldText}>{state || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Zip */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('zip') && styles.fieldLabelIncomplete]}>ZIP CODE</Text>
                {editingField === "zip" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="numeric"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("zip")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("zip", zip)}>
                    <Text style={styles.fieldText}>{zip || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Country */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('country') && styles.fieldLabelIncomplete]}>COUNTRY</Text>
                {editingField === "country" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("country")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("country", country)}>
                    <Text style={styles.fieldText}>{country || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Expertise Tags */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>{userType === "applicant" ? "SKILLS & INTERESTS" : "I CAN HELP WITH"}</Text>
                <View style={styles.tagsContainer}>
                  {expertise.map((tag, index) => (
                    <View key={index} style={styles.editableTag}>
                      <Text style={styles.editableTagText}>{tag}</Text>
                      <TouchableOpacity onPress={() => handleRemoveTag("expertise", index)}>
                        <X color="#000" size={14} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addTagRow}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Add new..."
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={() => handleAddTag("expertise")}
                  />
                  <TouchableOpacity style={styles.addTagBtn} onPress={() => handleAddTag("expertise")}>
                    <Plus color="#FFF" size={18} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Applicant-specific fields */}
              {userType === "applicant" && (
                <>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>WORK PREFERENCES</Text>
                    <View style={styles.tagsContainer}>
                      {workPreferences.map((tag, index) => (
                        <View key={index} style={styles.editableTag}>
                          <Text style={styles.editableTagText}>{tag}</Text>
                          <TouchableOpacity onPress={() => handleRemoveTag("workPreferences", index)}>
                            <X color="#000" size={14} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={styles.addTagRow}>
                      <TextInput
                        style={styles.tagInput}
                        placeholder="Add preference..."
                        value={newTag}
                        onChangeText={setNewTag}
                        onSubmitEditing={() => handleAddTag("workPreferences")}
                      />
                      <TouchableOpacity style={styles.addTagBtn} onPress={() => handleAddTag("workPreferences")}>
                        <Plus color="#FFF" size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>DESIRED ROLES</Text>
                    <View style={styles.tagsContainer}>
                      {desiredRoles.map((tag, index) => (
                        <View key={index} style={styles.editableTag}>
                          <Text style={styles.editableTagText}>{tag}</Text>
                          <TouchableOpacity onPress={() => handleRemoveTag("desiredRoles", index)}>
                            <X color="#000" size={14} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={styles.addTagRow}>
                      <TextInput
                        style={styles.tagInput}
                        placeholder="Add role..."
                        value={newTag}
                        onChangeText={setNewTag}
                        onSubmitEditing={() => handleAddTag("desiredRoles")}
                      />
                      <TouchableOpacity style={styles.addTagBtn} onPress={() => handleAddTag("desiredRoles")}>
                        <Plus color="#FFF" size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Sponsor-specific fields */}
              {userType === "sponsor" && (
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>COMPANIES I CAN REFER TO</Text>
                  <View style={styles.tagsContainer}>
                    {companiesCanReferTo.map((tag, index) => (
                      <View key={index} style={styles.editableTag}>
                        <Text style={styles.editableTagText}>{tag}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTag("companies", index)}>
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
                    <TouchableOpacity style={styles.addTagBtn} onPress={() => handleAddTag("companies")}>
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEditResume(false)}>
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Resume Information</Text>
              <TouchableOpacity onPress={() => setShowEditResume(false)}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            {professionalMissingCount > 0 && (
              <View style={styles.modalProgressContainer}>
                <Text style={styles.modalProgressText}>
                  {professionalMissingCount} field{professionalMissingCount !== 1 ? 's' : ''} remaining
                </Text>
                <View style={styles.modalProgressBar}>
                  <View style={[styles.modalProgressFill, { 
                    width: `${Math.max(0, 100 - (professionalMissingCount / 9 * 100))}%` 
                  }]} />
                </View>
              </View>
            )}
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              
              {/* Professional Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>PROFESSIONAL INFORMATION</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Job Title */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('title') && styles.fieldLabelIncomplete]}>CURRENT JOB TITLE</Text>
                {editingField === "jobTitle" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Senior Product Manager"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("jobTitle")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("jobTitle", jobTitle)}>
                    <Text style={styles.fieldText}>{jobTitle || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Years of Experience */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('yearsExperience') && styles.fieldLabelIncomplete]}>YEARS OF EXPERIENCE</Text>
                {editingField === "yearsExperience" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., 5-7 years"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("yearsExperience")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("yearsExperience", yearsExperience)}>
                    <Text style={styles.fieldText}>{yearsExperience || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Professional Summary */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('summary') && styles.fieldLabelIncomplete]}>PROFESSIONAL SUMMARY</Text>
                {editingField === "summary" ? (
                  <View style={styles.editColumn}>
                    <TextInput
                      style={[styles.fieldInput, styles.bioInput]}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="Brief overview of your professional background"
                      multiline
                      numberOfLines={4}
                      autoFocus
                    />
                    <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => handleSaveField("summary")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("summary", summary)}>
                    <Text style={styles.fieldText}>{summary || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Education Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>EDUCATION</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Degree */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('degree') && styles.fieldLabelIncomplete]}>DEGREE</Text>
                {editingField === "degree" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Bachelor of Science, MBA"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("degree")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("degree", degree)}>
                    <Text style={styles.fieldText}>{degree || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Major */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>MAJOR / FIELD OF STUDY</Text>
                {editingField === "major" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Computer Science, Business Administration"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("major")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("major", major)}>
                    <Text style={styles.fieldText}>{major || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* University */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>UNIVERSITY</Text>
                {editingField === "university" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Stanford University"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("university")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("university", university)}>
                    <Text style={styles.fieldText}>{university || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Graduation Year */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>GRADUATION YEAR</Text>
                {editingField === "graduationYear" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., 2020"
                      keyboardType="numeric"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("graduationYear")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("graduationYear", graduationYear)}>
                    <Text style={styles.fieldText}>{graduationYear || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* GPA (Optional) */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>GPA (OPTIONAL)</Text>
                {editingField === "gpa" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., 3.9"
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("gpa")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("gpa", gpa)}>
                    <Text style={styles.fieldText}>{gpa || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Work Preferences Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>WORK PREFERENCES</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Work Authorization */}
              <View style={styles.editField}>
                <Text style={[styles.fieldLabel, isFieldMissing('workAuthorization') && styles.fieldLabelIncomplete]}>WORK AUTHORIZATION</Text>
                {editingField === "workAuthorization" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., US Citizen, Green Card, H1B"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("workAuthorization")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("workAuthorization", workAuthorization)}>
                    <Text style={styles.fieldText}>{workAuthorization || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Willing to Relocate */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>WILLING TO RELOCATE?</Text>
                {editingField === "willingToRelocate" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Yes, No, For the right opportunity"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("willingToRelocate")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("willingToRelocate", willingToRelocate)}>
                    <Text style={styles.fieldText}>{willingToRelocate || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Requires Sponsorship */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>REQUIRES VISA SPONSORSHIP?</Text>
                {editingField === "requiresSponsorship" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      placeholder="e.g., Yes, No, In the future"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("requiresSponsorship")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("requiresSponsorship", requiresSponsorship)}>
                    <Text style={styles.fieldText}>{requiresSponsorship || "Not set"}</Text>
                    <Edit color="#666" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Additional Details Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <Text style={styles.sectionHeaderText}>ADDITIONAL DETAILS</Text>
                <View style={styles.sectionHeaderLine} />
              </View>

              {/* Certifications & Licenses */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>CERTIFICATIONS & LICENSES</Text>
                {certifications.length > 0 && (
                  <View style={{ gap: 12, marginBottom: 12 }}>
                    {certifications.map((cert, index) => (
                      <View key={index} style={styles.certificationCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certificationName}>{cert.name}</Text>
                          <Text style={styles.certificationOrg}>{cert.organization} • {cert.year}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                          setCertifications(certifications.filter((_, i) => i !== index));
                        }}>
                          <Trash2 color="#EF4444" size={18} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.addItemBtn} 
                  onPress={() => {
                    // Simple prompt-based add for now
                    Alert.prompt(
                      'Add Certification',
                      'Enter certification name, organization, and year (comma separated)',
                      (text) => {
                        const parts = text.split(',').map(p => p.trim());
                        if (parts.length === 3) {
                          setCertifications([...certifications, { 
                            name: parts[0], 
                            organization: parts[1], 
                            year: parts[2] 
                          }]);
                        }
                      }
                    );
                  }}
                >
                  <Plus color="#000" size={18} />
                  <Text style={styles.addItemText}>Add Certification</Text>
                </TouchableOpacity>
              </View>

              {/* Languages */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>LANGUAGES</Text>
                {languages.length > 0 && (
                  <View style={{ gap: 12, marginBottom: 12 }}>
                    {languages.map((lang, index) => (
                      <View key={index} style={styles.certificationCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certificationName}>{lang.language}</Text>
                          <Text style={styles.certificationOrg}>{lang.proficiency}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                          setLanguages(languages.filter((_, i) => i !== index));
                        }}>
                          <Trash2 color="#EF4444" size={18} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.addItemBtn} 
                  onPress={() => {
                    Alert.prompt(
                      'Add Language',
                      'Enter language and proficiency level (comma separated)\nExample: Spanish, Fluent',
                      (text) => {
                        const parts = text.split(',').map(p => p.trim());
                        if (parts.length === 2) {
                          setLanguages([...languages, { 
                            language: parts[0], 
                            proficiency: parts[1] 
                          }]);
                        }
                      }
                    );
                  }}
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
                    <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => handleSaveField("achievements")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("achievements", achievements)}>
                    <Text style={styles.fieldText}>{achievements || "Not set"}</Text>
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
              <Text style={styles.privacyDescription}>Who can see your profile</Text>
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
            <Text style={styles.privacyActionSubtitle}>Update your password</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Terms & Conditions */}
        <TouchableOpacity style={styles.privacyActionCard}>
          <View style={styles.privacyIconContainer}>
            <Briefcase color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.privacyActionTitle}>Terms & Conditions</Text>
            <Text style={styles.privacyActionSubtitle}>Read our terms of service</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity style={styles.privacyActionCard}>
          <View style={styles.privacyIconContainer}>
            <Lock color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.privacyActionTitle}>Privacy Policy</Text>
            <Text style={styles.privacyActionSubtitle}>How we handle your data</Text>
          </View>
          <ChevronRight color="#BBB" size={20} />
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteActionCard}>
          <View style={styles.privacyIconContainer}>
            <Trash2 color="#000" size={18} />
          </View>
          <View style={styles.privacyActionContent}>
            <Text style={styles.deleteActionTitle}>Delete Account</Text>
            <Text style={styles.privacyActionSubtitle}>Permanently delete your account and data</Text>
          </View>
          <ChevronRight color="#666" size={20} />
        </TouchableOpacity>
      </SimpleModal>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={showPasswordChange} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPasswordChange(false)}>
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => {
                setShowPasswordChange(false);
                setPasswordError("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}>
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
                style={[styles.blackBtn, { width: '100%', justifyContent: 'center', borderWidth: 0, marginTop: 8 }]}
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
            trackColor={{ false: '#E5E5E5', true: '#000' }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Push Notifications</Text>
          <Switch 
            value={pushNotifications} 
            onValueChange={setPushNotifications}
            trackColor={{ false: '#E5E5E5', true: '#000' }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Referral Updates</Text>
          <Switch 
            value={referralUpdates} 
            onValueChange={setReferralUpdates}
            trackColor={{ false: '#E5E5E5', true: '#000' }}
            thumbColor="#FFF"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>New Messages</Text>
          <Switch 
            value={messageNotifications} 
            onValueChange={setMessageNotifications}
            trackColor={{ false: '#E5E5E5', true: '#000' }}
            thumbColor="#FFF"
          />
        </View>
      </SimpleModal>
    </ScrollView>
  );
}

function SettingItem({ label, color = "#000", isLast = false, showNotificationDot = false, badgeCount, onPress }: { 
  label: string; 
  color?: string; 
  isLast?: boolean; 
  showNotificationDot?: boolean;
  badgeCount?: number;
  onPress?: () => void 
}) {
  return (
    <TouchableOpacity style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.settingLabel, { color }]}>{label}</Text>
        {typeof badgeCount === 'number' && badgeCount > 0 && (
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
  onUpdateInsight 
}: {
  visible: boolean;
  onClose: () => void;
  insights: ProfileInsight[];
  onAddInsight: (question: string, answer: string) => void;
  onRemoveInsight: (index: number) => void;
  onUpdateInsight: (index: number, answer: string) => void;
}) {
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(null);
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

  const usedQuestions = insights.map(i => i.question);
  const availableQuestions = AVAILABLE_QUESTIONS.filter(q => !usedQuestions.includes(q));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>
        
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile Insights</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Add up to 3 fun facts or prompts to showcase your personality</Text>
          
          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
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
                    <Text style={styles.selectQuestionText}>Select a Question</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.newInsightCard}>
                    <View style={styles.insightCardHeader}>
                      <Text style={styles.insightQuestion}>{selectedQuestion}</Text>
                      <TouchableOpacity onPress={() => {
                        setSelectedQuestion("");
                        setNewAnswer("");
                      }}>
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
                      style={[styles.saveInsightBtn, { alignSelf: 'flex-end', marginTop: 12 }]} 
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
                        <Text style={styles.questionOptionText}>{question}</Text>
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
  children 
}: { 
  visible: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>
        
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
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
    backgroundColor: "#1E40AF",
  },
  profileImageIndicator: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#BFDBFE",
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
    position: 'relative',
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
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
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
        shadowColor: '#000',
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
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
  },
  companyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalScroll: {
    maxHeight: 500,
  },
  
  // Progress Indicator Styles
  modalProgressContainer: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalProgressBar: {
    height: 4,
    backgroundColor: '#BFDBFE',
    borderRadius: 2,
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  
  // Badge Styles
  buttonBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1E40AF',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  buttonBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  settingBadge: {
    backgroundColor: '#1E40AF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  settingBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  
  // Edit Profile Styles
  editField: {
    marginBottom: 24,
    position: 'relative',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#999',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  fieldLabelIncomplete: {
    color: '#FFFFFF',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  fieldDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  fieldText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  editColumn: {
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#000',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    marginTop: 32,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E40AF',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
  },
  
  // Tags Editing
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  editableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  editableTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  addTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  addTagBtn: {
    backgroundColor: '#000',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Insights Modal Styles
  insightCard: {
    backgroundColor: '#F9F9F9',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  insightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightQuestion: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
    flex: 1,
  },
  insightAnswer: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  insightInput: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  insightActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  saveInsightBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  saveInsightBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  addInsightSection: {
    marginTop: 8,
  },
  selectQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  selectQuestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  newInsightCard: {
    backgroundColor: '#F9F9F9',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  questionPicker: {
    marginTop: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  questionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  questionOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  
  // Settings Modal Styles
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  settingRowValue: {
    fontSize: 15,
    color: '#666',
  },
  privacySection: {
    marginBottom: 24,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  privacyContent: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 13,
    color: '#666',
  },
  privacyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  privacyActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  privacyActionContent: {
    flex: 1,
  },
  privacyActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  privacyActionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  deleteActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 2,
    borderColor: '#333',
  },
  deleteActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  
  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    fontWeight: '700',
    color: '#999',
  },
  tabTextActive: {
    color: '#000',
  },
  
  // Applications Section
  applicationsContainer: {
    marginBottom: 32,
  },
  applicationsTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  applicationsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  applicationCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  appCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  appCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appJobTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginBottom: 2,
  },
  appCompany: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeBlack: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusBadgeBlackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  timelineContainer: {
    marginBottom: 20,
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
    borderWidth: 2,
    borderColor: '#FFF',
    marginTop: 4,
  },
  timelineDotCompleted: {
    backgroundColor: '#000',
  },
  timelineDotReferred: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineDotReferredCompleted: {
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#F9F9F9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    position: 'absolute',
    left: 5,
    top: 18,
    width: 2,
    height: 24,
    backgroundColor: '#E5E5E5',
  },
  timelineContent: {
    marginLeft: 12,
    marginBottom: 12,
  },
  timelineStage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  timelineStageCompleted: {
    color: '#000',
  },
  timelineStageReferred: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timelineDate: {
    fontSize: 12,
    color: '#BBB',
    marginTop: 2,
  },
  appCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  sponsorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
  },
  sponsorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sponsorLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#BBB',
    letterSpacing: 1,
  },
  sponsorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  
  // Application Detail Modal
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#EEE',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 10,
  },
  appDetailHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appDetailLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#F9F9F9',
    marginBottom: 16,
  },
  appDetailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  appDetailCompany: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 28,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#BBB',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  timelineDetailContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
  },
  timelineDetailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  timelineDetailLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDetailDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E5E5',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  timelineDetailDotCompleted: {
    backgroundColor: '#000',
  },
  timelineDetailDotReferred: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  timelineDetailDotReferredCompleted: {
    backgroundColor: '#000',
    borderWidth: 4,
    borderColor: '#F9F9F9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    backgroundColor: '#E5E5E5',
    marginTop: 4,
  },
  timelineDetailLineCompleted: {
    backgroundColor: '#BBB',
  },
  timelineDetailRight: {
    flex: 1,
    paddingTop: 2,
  },
  timelineDetailStage: {
    fontSize: 15,
    fontWeight: '700',
    color: '#999',
    marginBottom: 2,
  },
  timelineDetailStageCompleted: {
    color: '#000',
  },
  timelineDetailStageReferred: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timelineDetailDate: {
    fontSize: 13,
    color: '#BBB',
    fontWeight: '600',
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
  },
  sponsorDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
  },
  sponsorDetailInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sponsorDetailName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginBottom: 2,
  },
  sponsorDetailRole: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  nextActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  nextActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  messageBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Certifications & Languages Styles
  certificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  certificationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  certificationOrg: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9F9F9',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});