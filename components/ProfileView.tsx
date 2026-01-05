import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import {
  Briefcase,
  Check,
  ChevronRight,
  Edit,
  Lock,
  LogOut,
  MapPin,
  Plus,
  Target,
  Trash2,
  X
} from "lucide-react-native";
import React, { useState } from "react";
import {
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
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditInsights, setShowEditInsights] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Editable profile state
  const [name, setName] = useState("Alex Johnson");
  const [role, setRole] = useState(userType === "applicant" ? "Seeking Product Manager Roles" : "VP of Product");
  const [company, setCompany] = useState("Stripe");
  const [location, setLocation] = useState("San Francisco, CA");
  const [email, setEmail] = useState("alex.johnson@email.com");
  const [phone, setPhone] = useState("+1 (415) 555-0123");
  const [bio, setBio] = useState(
    userType === "applicant"
      ? "Passionate about AI/ML and building products that scale. Looking to join a high-growth startup where I can lead product strategy and make meaningful impact."
      : "Helping the next generation of product leaders break into tech. 10+ years at Google and Stripe, now mentoring at early-stage companies and opening doors for talented PMs."
  );
  
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

  const applicantData: ApplicantProfile = {
    name,
    role,
    location,
    bio,
    expertiseLabel: "Skills & Interests",
    expertise,
    workPreferences,
    desiredRoles,
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

  const handleSaveField = (field: string) => {
    switch (field) {
      case "name":
        setName(tempValue);
        break;
      case "role":
        setRole(tempValue);
        break;
      case "company":
        setCompany(tempValue);
        break;
      case "location":
        setLocation(tempValue);
        break;
      case "email":
        setEmail(tempValue);
        break;
      case "phone":
        setPhone(tempValue);
        break;
      case "bio":
        setBio(tempValue);
        break;
    }
    setEditingField(null);
    setTempValue("");
  };

  const handleAddTag = (type: "expertise" | "workPreferences" | "desiredRoles" | "companies") => {
    if (!newTag.trim()) return;
    
    switch (type) {
      case "expertise":
        setExpertise([...expertise, newTag.trim()]);
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

  const handleRemoveTag = (type: "expertise" | "workPreferences" | "desiredRoles" | "companies", index: number) => {
    switch (type) {
      case "expertise":
        setExpertise(expertise.filter((_, i) => i !== index));
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

  const handleAddInsight = (question: string, answer: string) => {
    if (profileInsights.length >= 3) {
      alert("You can only have up to 3 profile insights");
      return;
    }
    setProfileInsights([...profileInsights, { question, answer }]);
  };

  const handleRemoveInsight = (index: number) => {
    setProfileInsights(profileInsights.filter((_, i) => i !== index));
  };

  const handleUpdateInsight = (index: number, answer: string) => {
    const updated = [...profileInsights];
    updated[index].answer = answer;
    setProfileInsights(updated);
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

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    router.replace("/splash");
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
            source={{ uri: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=200" }}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.editFab}>
            <Edit color="#FFF" size={14} strokeWidth={2.5} />
          </TouchableOpacity>
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

      {/* Settings List */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingItem label="Edit Profile Insights" onPress={() => setShowEditInsights(true)} />
          <SettingItem label="Privacy & Security" onPress={() => setShowPrivacySecurity(true)} />
          <SettingItem label="Notifications" onPress={() => setShowNotifications(true)} />
          <SettingItem label="Log Out" color="#000" isLast onPress={handleLogout} />
        </View>
      </View>

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
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Name */}
              <View style={styles.editField}>
                <Text style={styles.fieldLabel}>NAME</Text>
                {editingField === "name" ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={tempValue}
                      onChangeText={setTempValue}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField("name")}>
                      <Check color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldDisplay} onPress={() => handleEditField("name", name)}>
                    <Text style={styles.fieldText}>{name}</Text>
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
                <Text style={styles.fieldLabel}>EMAIL</Text>
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
                <Text style={styles.fieldLabel}>PHONE</Text>
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

function SettingItem({ label, color = "#000", isLast = false, onPress }: { label: string; color?: string; isLast?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]} onPress={onPress}>
      <Text style={[styles.settingLabel, { color }]}>{label}</Text>
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
  
  // Edit Profile Styles
  editField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#999',
    marginBottom: 8,
    letterSpacing: 0.5,
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
});