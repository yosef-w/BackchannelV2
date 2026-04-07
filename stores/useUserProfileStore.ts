import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// NOTE: Profile cache is stored in AsyncStorage (not SecureStore) because
// SecureStore has a 2 KB per-value limit, which a full resume-classified
// profile easily exceeds. Auth tokens stay in SecureStore since those are
// small and genuinely secret.

export interface ProfessionalExperience {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface EducationEntry {
  id: string;
  degree: string;
  major: string;
  university: string;
  graduationYear: string;
  gpa: string;
}

export interface AutofillData {
  personal: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    portfolio: string;
    profileImage?: string; // URI or URL to profile image
    workEmail?: string; // Sponsor's corporate email (separate from login email)
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };
  professional: {
    title: string;
    company: string;
    currentRole: string;
    yearsExperience: string;
    summary: string;
    desiredSalary: string;
    availableStartDate: string;
    targetIndustry: string;
    seekingPosition: string;
    experiences: ProfessionalExperience[];
  };
  education: {
    degree: string;
    major: string;
    university: string;
    graduationYear: string;
    gpa: string;
    entries: EducationEntry[];
  };
  preferences: {
    workAuthorization: string;
    willingToRelocate: string;
    requiresSponsorship: string;
    securityClearance: string;
  };
  demographics: {
    gender: string;
    ethnicity: string;
    veteran: string;
    disability: string;
  };
  skills: string[];
  insights: Array<{ question: string; answer: string }>;
  workPreferences: string[];
  desiredRoles: string[];
  resumeUrl: string | null;
  certifications: Array<{ name: string; organization: string; year: string }>;
  languages: Array<{ language: string; proficiency: string }>;
  achievements: string;
}

interface UserProfileStore {
  data: AutofillData;
  isLoaded: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  needsSync: boolean;

  updatePersonal: (data: Partial<AutofillData["personal"]>) => Promise<void>;
  updateProfessional: (
    data: Partial<AutofillData["professional"]>,
  ) => Promise<void>;
  updateEducation: (data: Partial<AutofillData["education"]>) => Promise<void>;
  updateProfessionalExperiences: (
    experiences: ProfessionalExperience[],
  ) => Promise<void>;
  updateEducationEntries: (entries: EducationEntry[]) => Promise<void>;
  updatePreferences: (
    data: Partial<AutofillData["preferences"]>,
  ) => Promise<void>;
  updateDemographics: (
    data: Partial<AutofillData["demographics"]>,
  ) => Promise<void>;
  updateSkills: (skills: string[]) => Promise<void>;
  updateWorkPreferences: (prefs: string[]) => Promise<void>;
  updateDesiredRoles: (roles: string[]) => Promise<void>;
  updateInsights: (
    insights: Array<{ question: string; answer: string }>,
  ) => Promise<void>;
  updateResumeUrl: (url: string | null) => Promise<void>;
  updateCertifications: (
    certifications: Array<{ name: string; organization: string; year: string }>,
  ) => Promise<void>;
  updateLanguages: (
    languages: Array<{ language: string; proficiency: string }>,
  ) => Promise<void>;
  updateAchievements: (achievements: string) => Promise<void>;

  loadFromProfile: (profileData: any) => Promise<void>;
  syncToBackend: () => Promise<void>;
  fetchFromBackend: () => Promise<void>;

  workEmailVerified: boolean;
  setWorkEmailVerified: (verified: boolean) => void;

  loadFromStorage: () => Promise<void>;
  clearData: () => Promise<void>;
}

const STORAGE_KEY = "autofill_data";

const defaultData: AutofillData = {
  personal: {
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    portfolio: "",
    workEmail: "",
    address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    },
  },
  professional: {
    title: "",
    company: "",
    currentRole: "",
    yearsExperience: "",
    summary: "",
    desiredSalary: "",
    availableStartDate: "",
    targetIndustry: "",
    seekingPosition: "",
    experiences: [],
  },
  education: {
    degree: "",
    major: "",
    university: "",
    graduationYear: "",
    gpa: "",
    entries: [],
  },
  preferences: {
    workAuthorization: "",
    willingToRelocate: "",
    requiresSponsorship: "",
    securityClearance: "",
  },
  demographics: {
    gender: "",
    ethnicity: "",
    veteran: "",
    disability: "",
  },
  skills: [],
  insights: [],
  workPreferences: [],
  desiredRoles: [],
  resumeUrl: null,
  certifications: [],
  languages: [],
  achievements: "",
};

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  data: defaultData,
  isLoaded: false,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  needsSync: false,
  workEmailVerified: false,
  setWorkEmailVerified: (verified) => set({ workEmailVerified: verified }),

  updatePersonal: async (updates) => {
    const newData = { ...get().data };
    newData.personal = { ...newData.personal, ...updates };

    if (updates.firstName || updates.lastName) {
      newData.personal.fullName =
        `${newData.personal.firstName} ${newData.personal.lastName}`.trim();
    }

    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateProfessional: async (updates) => {
    const newData = { ...get().data };
    newData.professional = { ...newData.professional, ...updates };
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateEducation: async (updates) => {
    const newData = { ...get().data };
    newData.education = { ...newData.education, ...updates };
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateProfessionalExperiences: async (experiences) => {
    const newData = { ...get().data };
    newData.professional.experiences = experiences;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateEducationEntries: async (entries) => {
    const newData = { ...get().data };
    newData.education.entries = entries;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updatePreferences: async (updates) => {
    const newData = { ...get().data };
    newData.preferences = { ...newData.preferences, ...updates };
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateDemographics: async (updates) => {
    const newData = { ...get().data };
    newData.demographics = { ...newData.demographics, ...updates };
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateSkills: async (skills) => {
    const newData = { ...get().data };
    newData.skills = skills;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateWorkPreferences: async (prefs) => {
    const newData = { ...get().data };
    newData.workPreferences = prefs;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save work preferences data:", error);
    }

    queueSync();
  },

  updateDesiredRoles: async (roles) => {
    const newData = { ...get().data };
    newData.desiredRoles = roles;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save desired roles data:", error);
    }

    queueSync();
  },

  updateInsights: async (insights) => {
    const newData = { ...get().data };
    newData.insights = insights;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateResumeUrl: async (url) => {
    const newData = { ...get().data };
    newData.resumeUrl = url;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateCertifications: async (certifications) => {
    const newData = { ...get().data };
    newData.certifications = certifications;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save certifications data:", error);
    }

    queueSync();
  },

  updateLanguages: async (languages) => {
    const newData = { ...get().data };
    newData.languages = languages;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save languages data:", error);
    }

    queueSync();
  },

  updateAchievements: async (achievements) => {
    const newData = { ...get().data };
    newData.achievements = achievements;
    set({ data: newData, needsSync: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save achievements data:", error);
    }

    queueSync();
  },

  loadFromProfile: async (profileData) => {
    const autofillData: AutofillData = {
      personal: {
        firstName: profileData.firstName || "",
        lastName: profileData.lastName || "",
        fullName:
          `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim(),
        email: profileData.email || "",
        phone: profileData.phone || "",
        portfolio: profileData.portfolio || "",
        workEmail: profileData.profileData?.workEmail || "",
        address: {
          street: profileData.address?.street || "",
          city: profileData.address?.city || "",
          state: profileData.address?.state || "",
          zip: profileData.address?.zip || "",
          country: profileData.address?.country || "USA",
        },
      },
      professional: {
        title:
          profileData.jobTitle ||
          profileData.profileData?.seekingPosition ||
          "",
        company: profileData.company || profileData.profileData?.company || "",
        currentRole: profileData.profileData?.currentRole || "",
        yearsExperience: profileData.yearsExperience || "",
        summary: profileData.bio || "",
        desiredSalary: profileData.desiredSalary || "",
        availableStartDate: profileData.availableStartDate || "",
        targetIndustry: profileData.profileData?.targetIndustry || "",
        seekingPosition: profileData.profileData?.seekingPosition || "",
        experiences: profileData.experiences || [],
      },
      education: {
        degree: profileData.education?.degree || "",
        major: profileData.education?.major || "",
        university: profileData.education?.university || "",
        graduationYear: profileData.education?.graduationYear || "",
        gpa: profileData.education?.gpa || "",
        entries: profileData.education?.entries || [],
      },
      preferences: {
        workAuthorization:
          profileData.workAuthorization || "Authorized to work in US",
        willingToRelocate: profileData.willingToRelocate || "Yes",
        requiresSponsorship: profileData.requiresSponsorship || "No",
        securityClearance: profileData.securityClearance || "None",
      },
      demographics: {
        gender: profileData.demographics?.gender || "",
        ethnicity: profileData.demographics?.ethnicity || "",
        veteran: profileData.demographics?.veteran || "",
        disability: profileData.demographics?.disability || "",
      },
      skills: profileData.profileData?.skills || [],
      insights: profileData.profileData?.insights || [],
      workPreferences: profileData.profileData?.workPreferences || [],
      desiredRoles: profileData.profileData?.seekingPosition
        ? [profileData.profileData.seekingPosition]
        : profileData.profileData?.desiredRoles || [],
      resumeUrl: profileData.profileData?.resumeUrl || null,
      certifications: profileData.certifications || [],
      languages: profileData.languages || [],
      achievements: profileData.achievements || "",
    };

    set({ data: autofillData, isLoaded: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(autofillData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }
  },

  syncToBackend: async () => {
    const { data, isSyncing } = get();

    if (isSyncing) return;

    set({ isSyncing: true });

    try {
      const { authApi } = await import("../lib/auth-api");
      await authApi.updateProfile(data);
      set({ lastSyncedAt: new Date(), syncError: null, needsSync: false });
    } catch (error: any) {
      console.error("Failed to sync profile to backend:", error);

      if (
        error.message?.includes("network") ||
        error.message?.includes("offline")
      ) {
        set({ syncError: "offline", needsSync: true });
      } else {
        set({ syncError: error.message || "Sync failed" });
      }
    } finally {
      set({ isSyncing: false });
    }
  },

  fetchFromBackend: async () => {
    try {
      const { authApi } = await import("../lib/auth-api");
      const { useOnboardingStore } = await import("./useOnboardingStore");
      const profile = await authApi.getProfile();

      // Set user type based on backend flags
      const userType = (profile as any).IS_SPONSOR ? "sponsor" : "applicant";
      useOnboardingStore.getState().setUserType(userType);

      // Preserve all locally-stored data so fields not returned by the backend
      // (insights, skills, address details, portfolio, etc.) are not wiped.
      const existing = get().data;

      // Helper: parse PostgreSQL JSONB columns that may arrive as JSON strings
      // (pg_utils.py casts JSONB → TEXT for backwards compatibility — PR #25)
      const parseVariant = (v: any): any[] => {
        if (!v) return [];
        if (typeof v === "string") {
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return Array.isArray(v) ? v : [];
      };

      // Skills: prefer backend value if present, fall back to local
      const backendSkills: string[] = parseVariant(
        (profile as any).applicant_profile?.SKILLS ||
          (profile as any).sponsor_profile?.SKILLS,
      );
      const mergedSkills =
        backendSkills.length > 0 ? backendSkills : existing.skills;

      // Insights: GET /api/profile/ does not return INSIGHTS yet (backend gap —
      // see BACKEND_CHANGES_NEEDED.md #4). Preserve local value until the backend
      // starts returning this field.
      const backendInsights: Array<{ question: string; answer: string }> =
        parseVariant(
          (profile as any).applicant_profile?.INSIGHTS ||
            (profile as any).sponsor_profile?.INSIGHTS,
        );
      const mergedInsights =
        backendInsights.length > 0 ? backendInsights : existing.insights;

      // Resume-derived fields: GET /api/profile/ may return these once the backend
      // is updated to expose them (VARIANT columns on APPLICANT_PROFILES).
      // Defensively map them so they populate automatically once available.
      // ── RAW API RESPONSE DIAGNOSTIC ──────────────────────────────────────
      console.log(
        "[StoreSync] 📡 Raw GET /api/profile/ applicant_profile fields:",
        JSON.stringify(
          {
            CURRENT_ROLE: (profile as any).applicant_profile?.CURRENT_ROLE,
            YEARS_EXPERIENCE: (profile as any).applicant_profile
              ?.YEARS_EXPERIENCE,
            INDUSTRY: (profile as any).applicant_profile?.INDUSTRY,
            SKILLS: (profile as any).applicant_profile?.SKILLS,
            PROFESSIONAL_EXPERIENCES: (profile as any).applicant_profile
              ?.PROFESSIONAL_EXPERIENCES,
            EDUCATION_ENTRIES: (profile as any).applicant_profile
              ?.EDUCATION_ENTRIES,
            CERTIFICATIONS: (profile as any).applicant_profile?.CERTIFICATIONS,
            LANGUAGES: (profile as any).applicant_profile?.LANGUAGES,
            ACHIEVEMENTS: (profile as any).applicant_profile?.ACHIEVEMENTS,
          },
          null,
          2,
        ),
      );
      console.log(
        "[StoreSync] 📡 Raw GET /api/profile/ user fields:",
        JSON.stringify(
          {
            FIRST_NAME: (profile as any).FIRST_NAME,
            LAST_NAME: (profile as any).LAST_NAME,
            BIO: (profile as any).BIO,
            PHOTO_URL: (profile as any).PHOTO_URL,
            PORTFOLIO_URL: (profile as any).PORTFOLIO_URL,
            PHONE_NUMBER: (profile as any).PHONE_NUMBER,
            LOCATION: (profile as any).LOCATION,
          },
          null,
          2,
        ),
      );
      // ─────────────────────────────────────────────────────────────────────

      const backendExperiences = parseVariant(
        (profile as any).applicant_profile?.PROFESSIONAL_EXPERIENCES,
      );
      const backendEducationEntries = parseVariant(
        (profile as any).applicant_profile?.EDUCATION_ENTRIES,
      );
      const backendCertifications = parseVariant(
        (profile as any).applicant_profile?.CERTIFICATIONS,
      );
      const backendLanguages = parseVariant(
        (profile as any).applicant_profile?.LANGUAGES,
      );
      const backendAchievements: string =
        (profile as any).applicant_profile?.ACHIEVEMENTS ||
        (profile as any).ACHIEVEMENTS ||
        "";

      // ── FIELD RESOLUTION DIAGNOSTIC ──────────────────────────────────────
      console.log(
        "[StoreSync] 🔀 Field resolution (backend vs fallback):",
        JSON.stringify(
          {
            experiences: {
              source:
                backendExperiences.length > 0 ? "BACKEND" : "LOCAL_FALLBACK",
              count:
                backendExperiences.length > 0
                  ? backendExperiences.length
                  : existing.professional.experiences.length,
              value:
                backendExperiences.length > 0
                  ? backendExperiences
                  : existing.professional.experiences,
            },
            education: {
              source:
                backendEducationEntries.length > 0
                  ? "BACKEND"
                  : "LOCAL_FALLBACK",
              count:
                backendEducationEntries.length > 0
                  ? backendEducationEntries.length
                  : existing.education.entries.length,
              value:
                backendEducationEntries.length > 0
                  ? backendEducationEntries
                  : existing.education.entries,
            },
            certifications: {
              source:
                backendCertifications.length > 0 ? "BACKEND" : "LOCAL_FALLBACK",
              count:
                backendCertifications.length > 0
                  ? backendCertifications.length
                  : existing.certifications.length,
              value:
                backendCertifications.length > 0
                  ? backendCertifications
                  : existing.certifications,
            },
            languages: {
              source:
                backendLanguages.length > 0 ? "BACKEND" : "LOCAL_FALLBACK",
              count:
                backendLanguages.length > 0
                  ? backendLanguages.length
                  : existing.languages.length,
              value:
                backendLanguages.length > 0
                  ? backendLanguages
                  : existing.languages,
            },
            skills: {
              source: backendSkills.length > 0 ? "BACKEND" : "LOCAL_FALLBACK",
              count: (backendSkills.length > 0
                ? backendSkills
                : existing.skills
              ).length,
            },
            achievements: {
              source: backendAchievements ? "BACKEND" : "LOCAL_FALLBACK",
              value: backendAchievements || existing.achievements,
            },
          },
          null,
          2,
        ),
      );
      // ─────────────────────────────────────────────────────────────────────

      // ── FIELD SHAPE NORMALIZERS ───────────────────────────────────────────
      // The AI classify endpoint stores experiences/education with different
      // key names than our ProfessionalExperience / EducationEntry interfaces.
      // Map them here so the edit modals and autofill always see the right keys.

      /**
       * Backend shape: { title, company, dates, description }
       * Our interface:  { id, jobTitle, company, startDate, endDate, current, description }
       * "dates" is a combined string like "2022 – Present" or "2019 – 2022".
       */
      const mapExperience = (raw: any, idx: number) => {
        const datesStr: string = raw.dates || "";
        const parts = datesStr.split(/\s*[\u2013\u2014-]\s*/); // en-dash, em-dash, or hyphen
        const startDate = parts[0]?.trim() || "";
        const endRaw = parts[1]?.trim() || "";
        const isCurrent = /present/i.test(endRaw);
        return {
          id: raw.id || `exp-${idx}`,
          jobTitle: raw.jobTitle || raw.title || "", // backend sends "title"
          company: raw.company || "",
          startDate,
          endDate: isCurrent ? "" : endRaw,
          current: isCurrent,
          description: raw.description || "",
        };
      };

      /**
       * Backend shape: { degree, school, year }
       * Our interface:  { id, degree, major, university, graduationYear, gpa }
       */
      const mapEducation = (raw: any, idx: number) => ({
        id: raw.id || `edu-${idx}`,
        degree: raw.degree || "",
        major: raw.major || "",
        university: raw.university || raw.school || "", // backend sends "school"
        graduationYear: raw.graduationYear || raw.year || "", // backend sends "year"
        gpa: raw.gpa || "",
      });
      // ─────────────────────────────────────────────────────────────────────

      const autofillData: AutofillData = {
        personal: {
          firstName: (profile as any).FIRST_NAME || existing.personal.firstName,
          lastName: (profile as any).LAST_NAME || existing.personal.lastName,
          fullName:
            (profile as any).FIRST_NAME && (profile as any).LAST_NAME
              ? `${(profile as any).FIRST_NAME} ${(profile as any).LAST_NAME}`
              : existing.personal.fullName,
          email: (profile as any).EMAIL || existing.personal.email,
          phone: (profile as any).PHONE_NUMBER || existing.personal.phone,
          portfolio:
            (profile as any).PORTFOLIO_URL || existing.personal.portfolio,
          profileImage:
            (profile as any).PHOTO_URL || existing.personal.profileImage,
          workEmail:
            (profile as any).sponsor_profile?.WORK_EMAIL ||
            existing.personal.workEmail ||
            "",
          address: {
            street:
              (profile as any).STREET ||
              existing.personal.address?.street ||
              "",
            city:
              (profile as any).LOCATION?.split(",")[0]?.trim() ||
              existing.personal.address?.city ||
              "",
            state:
              (profile as any).LOCATION?.split(",")[1]?.trim() ||
              existing.personal.address?.state ||
              "",
            zip: (profile as any).ZIP || existing.personal.address?.zip || "",
            country:
              (profile as any).COUNTRY ||
              existing.personal.address?.country ||
              "",
          },
        },
        professional: {
          // Use the actual job title fields — ROLE_TYPE is "Applicant"/"Sponsor" enum, not a title
          title:
            userType === "sponsor"
              ? (profile as any).sponsor_profile?.JOB_TITLE ||
                existing.professional.title
              : (profile as any).applicant_profile?.CURRENT_ROLE ||
                existing.professional.title,
          // Company is returned in sponsor_profile.COMPANY
          company:
            (profile as any).sponsor_profile?.COMPANY ||
            existing.professional.company ||
            "",
          currentRole:
            (profile as any).applicant_profile?.CURRENT_ROLE ||
            existing.professional.currentRole,
          yearsExperience:
            (profile as any).applicant_profile?.YEARS_EXPERIENCE ||
            existing.professional.yearsExperience,
          // BIO is saved via PATCH but not yet returned by GET /api/profile/.
          // Falls back to existing local value; will auto-populate once backend
          // starts returning the field (BACKEND_CHANGES_NEEDED.md #5).
          summary: (profile as any).BIO || existing.professional.summary,
          desiredSalary: existing.professional.desiredSalary,
          availableStartDate: existing.professional.availableStartDate,
          targetIndustry:
            (profile as any).applicant_profile?.INDUSTRY ||
            existing.professional.targetIndustry,
          seekingPosition: existing.professional.seekingPosition,
          experiences:
            backendExperiences.length > 0
              ? backendExperiences.map(mapExperience)
              : existing.professional.experiences,
        },
        education: {
          ...existing.education,
          entries:
            backendEducationEntries.length > 0
              ? backendEducationEntries.map(mapEducation)
              : existing.education.entries,
        },
        preferences: existing.preferences,
        demographics: existing.demographics,
        skills: mergedSkills,
        insights: mergedInsights,
        workPreferences:
          parseVariant((profile as any).applicant_profile?.WORK_PREFERENCES)
            .length > 0
            ? parseVariant((profile as any).applicant_profile?.WORK_PREFERENCES)
            : existing.workPreferences || [],
        desiredRoles:
          parseVariant((profile as any).applicant_profile?.DESIRED_ROLES)
            .length > 0
            ? parseVariant((profile as any).applicant_profile?.DESIRED_ROLES)
            : existing.desiredRoles || [],
        // resumeUrl is not returned by GET /api/profile/ — preserve local value
        resumeUrl: existing.resumeUrl,
        certifications:
          backendCertifications.length > 0
            ? backendCertifications
            : existing.certifications,
        languages:
          backendLanguages.length > 0 ? backendLanguages : existing.languages,
        achievements: backendAchievements || existing.achievements,
      };

      set({ data: autofillData, isLoaded: true, lastSyncedAt: new Date() });

      // Update work email verification status.
      // Defaults to true when WORK_EMAIL_VERIFIED is not yet returned by the backend
      // (will enforce correctly once Optional D is deployed).
      const workEmailVerifiedRaw = (profile as any).sponsor_profile
        ?.WORK_EMAIL_VERIFIED;
      set({ workEmailVerified: workEmailVerifiedRaw === false ? false : true });

      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(autofillData));
      } catch (error) {
        console.warn("Failed to save fetched profile locally:", error);
      }
    } catch (error) {
      // Silently handle errors when backend is disabled - just use cached data
      console.log("Using locally cached profile data");
    }
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({ data, isLoaded: true });
      }
    } catch (error) {
      console.warn("Failed to load autofill data:", error);
    }
  },

  clearData: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear autofill data:", error);
    }

    set({
      data: defaultData,
      isLoaded: false,
      isSyncing: false,
      lastSyncedAt: null,
      syncError: null,
      needsSync: false,
      workEmailVerified: false,
    });
  },
}));

/**
 * Debounced sync helper
 * Waits 2 seconds after last edit before syncing to backend
 */
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

const queueSync = () => {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    await useUserProfileStore.getState().syncToBackend();
  }, 2000);
};
