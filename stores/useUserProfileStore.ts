import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

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
    linkedin: string;
    portfolio: string;
    profileImage?: string; // URI or URL to profile image
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
    linkedin: "",
    portfolio: "",
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

  updatePersonal: async (updates) => {
    const newData = { ...get().data };
    newData.personal = { ...newData.personal, ...updates };

    if (updates.firstName || updates.lastName) {
      newData.personal.fullName =
        `${newData.personal.firstName} ${newData.personal.lastName}`.trim();
    }

    set({ data: newData, needsSync: true });

    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  updateInsights: async (insights) => {
    const newData = { ...get().data };
    newData.insights = insights;
    set({ data: newData, needsSync: true });

    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newData));
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
        linkedin: profileData.linkedin || "",
        portfolio: profileData.portfolio || "",
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
        currentRole: profileData.profileData?.currentRole || "",
        yearsExperience: profileData.yearsExperience || "",
        summary:
          profileData.bio ||
          profileData.profileData?.insights?.[0]?.answer ||
          "",
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
      resumeUrl: profileData.profileData?.resumeUrl || null,
      certifications: profileData.certifications || [],
      languages: profileData.languages || [],
      achievements: profileData.achievements || "",
    };

    set({ data: autofillData, isLoaded: true });

    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(autofillData));
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

      const autofillData: AutofillData = {
        personal: {
          firstName: (profile as any).FIRST_NAME || "",
          lastName: (profile as any).LAST_NAME || "",
          fullName:
            (profile as any).FIRST_NAME && (profile as any).LAST_NAME
              ? `${(profile as any).FIRST_NAME} ${(profile as any).LAST_NAME}`
              : "",
          email: (profile as any).EMAIL || "",
          phone: (profile as any).PHONE_NUMBER || "",
          linkedin: "",
          portfolio: "",
          address: {
            street: "",
            city: (profile as any).LOCATION?.split(",")[0]?.trim() || "",
            state: (profile as any).LOCATION?.split(",")[1]?.trim() || "",
            zip: "",
            country: "",
          },
        },
        professional: {
          title: (profile as any).ROLE_TYPE || "",
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
        resumeUrl: (profile as any).PHOTO_URL || null,
        certifications: [],
        languages: [],
        achievements: "",
      };

      set({ data: autofillData, isLoaded: true, lastSyncedAt: new Date() });

      try {
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify(autofillData),
        );
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
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
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
      await SecureStore.deleteItemAsync(STORAGE_KEY);
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
