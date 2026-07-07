import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { Sentry } from "../lib/sentry";

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

/**
 * Keys mirror the backend `notif_type` values used in
 * services/notifications.py — do not rename without a backend change.
 * Missing keys default to enabled on the backend.
 */
export interface NotificationPreferences {
  match?: boolean;
  message?: boolean;
  referral?: boolean;
  waitlist?: boolean;
  job_like?: boolean;
  sponsor_request?: boolean;
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
  sponsorCompanies: string[];
  notificationPreferences: NotificationPreferences;
}

/**
 * Top-level AutofillData keys that authApi.updateProfile knows how to sync.
 * `demographics` and `resumeUrl` are intentionally excluded — there is no
 * backend field for either yet (see docs/BACKEND_CHANGES_NEEDED.md).
 */
export type SyncableField =
  | "personal"
  | "professional"
  | "education"
  | "preferences"
  | "skills"
  | "insights"
  | "workPreferences"
  | "desiredRoles"
  | "certifications"
  | "languages"
  | "achievements";

interface UserProfileStore {
  data: AutofillData;
  isLoaded: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  needsSync: boolean;
  /**
   * Top-level fields with local edits not yet confirmed synced to the
   * backend. This is the source of truth for two things:
   *   1. syncToBackend() only ever sends dirty fields, and sends them in
   *      full (including now-empty values) — so clearing a field actually
   *      clears it server-side instead of being silently dropped.
   *   2. fetchFromBackend()'s merge treats a dirty field as "local wins,
   *      don't let a fetch clobber this in-flight edit" instead of
   *      "prefer non-empty backend value" — which previously resurrected
   *      data the user had just deleted.
   * Persisted to AsyncStorage alongside `needsSync` so a sync interrupted
   * by the app being killed is retried on next launch (see loadFromStorage).
   */
  dirtyFields: Set<SyncableField>;
  /**
   * Consecutive syncToBackend() failures with nothing cleared. Persisted
   * (survives a killed/relaunched app) so a dirty field that keeps failing
   * for a non-network reason — e.g. a payload the backend always rejects —
   * doesn't stay "protected" from fetchFromBackend's merge forever. Past
   * MAX_SYNC_FAILURES_BEFORE_ABANDONING, fetchFromBackend gives up on the
   * pending local edit and lets the backend value win instead, so a stuck
   * flag can't permanently mask real server data (see fetchFromBackend).
   * Reset to 0 on every successful sync attempt, even a partial one.
   */
  syncFailureCount: number;

  updatePersonal: (data: Partial<AutofillData["personal"]>) => Promise<void>;
  /**
   * Set the signed-in account's email locally WITHOUT marking the personal
   * group dirty or queueing a sync. Login only knows the email; seeding it
   * through updatePersonal() marked `personal` dirty, and since the
   * send-in-full sync change that pushed the store's (often still-default,
   * i.e. empty) firstName/lastName/phone/address to the backend on every
   * login — permanently erasing the user's real name server-side.
   * fetchFromBackend(), which _layout.tsx fires right after login, fills in
   * the rest of the profile.
   */
  seedSessionEmail: (email: string) => Promise<void>;
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
  updateNotificationPreferences: (
    prefs: Partial<NotificationPreferences>,
  ) => Promise<void>;

  loadFromProfile: (profileData: any) => Promise<void>;
  syncToBackend: () => Promise<void>;
  /** Bypass the 2s debounce and sync immediately if there's anything dirty. */
  flushSyncNow: () => Promise<void>;
  fetchFromBackend: () => Promise<void>;

  workEmailVerified: boolean;
  setWorkEmailVerified: (verified: boolean) => void;

  // Sponsor's pending (unverified) work email — what they typed into the
  // "Update it" flow on the verification modal but haven't yet confirmed via
  // the emailed link. Persists across mount/unmount and app launches so the
  // modal always reflects the latest address the user submitted, even after
  // navigating away. Cleared once fetchFromBackend sees the backend has
  // accepted the same address as verified.
  pendingWorkEmail: string | null;
  setPendingWorkEmail: (email: string | null) => Promise<void>;

  loadFromStorage: () => Promise<void>;
  clearData: () => Promise<void>;
}

const STORAGE_KEY = "autofill_data";
const PENDING_WORK_EMAIL_KEY = "pending_work_email";
/** Persists `dirtyFields` (as a JSON array) so a sync interrupted by the app
 * being killed — the 2s debounce never fired, or fired but the request
 * hadn't completed — is retried on next launch instead of silently lost. */
const DIRTY_FIELDS_KEY = "autofill_dirty_fields";
/** Persists `syncFailureCount` so a run of failures survives a killed app
 * instead of resetting to 0 on relaunch and never reaching the threshold. */
const SYNC_FAILURE_COUNT_KEY = "autofill_sync_failure_count";
/** After this many consecutive failed sync attempts, fetchFromBackend stops
 * protecting the dirty local value and lets the backend win instead — see
 * the `syncFailureCount` doc comment above for why this exists. Chosen to
 * be well past what network flakiness alone would produce (every attempt
 * is either a 2s-debounced edit, an app-foreground flush, or a launch
 * retry — a handful of consecutive failures across those is a strong
 * signal of a real, non-transient problem, not a bad connection). */
const MAX_SYNC_FAILURES_BEFORE_ABANDONING = 5;

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
  sponsorCompanies: [],
  notificationPreferences: {},
};

/** Returns a new Set with `field` added — never mutates `prev` in place. */
function withDirty(
  prev: Set<SyncableField>,
  field: SyncableField,
): Set<SyncableField> {
  const next = new Set(prev);
  next.add(field);
  return next;
}

/** Persist the current dirty-fields set so it survives a killed app. */
async function persistDirtyFields(fields: Set<SyncableField>) {
  try {
    await AsyncStorage.setItem(
      DIRTY_FIELDS_KEY,
      JSON.stringify(Array.from(fields)),
    );
  } catch (error) {
    console.warn("Failed to persist dirty fields:", error);
  }
}

/** Persist the current sync-failure count so a run of failures survives a
 * killed app instead of resetting to 0 on relaunch. */
async function persistSyncFailureCount(count: number) {
  try {
    await AsyncStorage.setItem(SYNC_FAILURE_COUNT_KEY, String(count));
  } catch (error) {
    console.warn("Failed to persist sync failure count:", error);
  }
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  data: defaultData,
  isLoaded: false,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  needsSync: false,
  dirtyFields: new Set<SyncableField>(),
  syncFailureCount: 0,
  workEmailVerified: false,
  setWorkEmailVerified: (verified) => set({ workEmailVerified: verified }),

  pendingWorkEmail: null,
  setPendingWorkEmail: async (email) => {
    set({ pendingWorkEmail: email });
    try {
      if (email) {
        await AsyncStorage.setItem(PENDING_WORK_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(PENDING_WORK_EMAIL_KEY);
      }
    } catch (error) {
      console.warn("Failed to persist pending work email:", error);
    }
  },

  updatePersonal: async (updates) => {
    const newData = { ...get().data };
    newData.personal = { ...newData.personal, ...updates };

    if (updates.firstName || updates.lastName) {
      newData.personal.fullName =
        `${newData.personal.firstName} ${newData.personal.lastName}`.trim();
    }

    const dirtyFields = withDirty(get().dirtyFields, "personal");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }

    queueSync();
  },

  seedSessionEmail: async (email) => {
    const newData = { ...get().data };
    newData.personal = { ...newData.personal, email };
    // Deliberately NOT marked dirty and no queueSync() — this is session
    // bookkeeping, not a user edit; see the interface doc comment.
    set({ data: newData });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }
  },

  updateProfessional: async (updates) => {
    const newData = { ...get().data };
    newData.professional = { ...newData.professional, ...updates };
    const dirtyFields = withDirty(get().dirtyFields, "professional");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "education");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    // Nested under `professional` — authApi.updateProfile syncs experiences
    // as part of the same rolePayload group, so mark the parent dirty.
    const dirtyFields = withDirty(get().dirtyFields, "professional");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "education");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "preferences");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "skills");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "workPreferences");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "desiredRoles");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "insights");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "certifications");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "languages");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

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
    const dirtyFields = withDirty(get().dirtyFields, "achievements");
    set({ data: newData, needsSync: true, dirtyFields });
    persistDirtyFields(dirtyFields);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn("Failed to save achievements data:", error);
    }

    queueSync();
  },

  updateNotificationPreferences: async (updates) => {
    const prev = get().data.notificationPreferences || {};
    const merged: NotificationPreferences = { ...prev, ...updates };

    // Optimistic local update
    const newData = { ...get().data, notificationPreferences: merged };
    set({ data: newData });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.warn(
        "Failed to persist notification preferences locally:",
        error,
      );
    }

    // Direct, targeted PATCH — do NOT go through the full-profile sync queue.
    try {
      const { updateUserProfile } = await import("../lib/api");
      await updateUserProfile({ notification_preferences: merged });
    } catch (error) {
      console.warn("Failed to save notification preferences:", error);
      // Roll back on failure so the UI doesn't show a state the backend
      // didn't accept.
      const rolledBack = { ...get().data, notificationPreferences: prev };
      set({ data: rolledBack });
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rolledBack));
      } catch {}
      throw error;
    }
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
      sponsorCompanies: profileData.sponsorCompanies || [],
      notificationPreferences: profileData.notificationPreferences || {},
    };

    set({ data: autofillData, isLoaded: true });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(autofillData));
    } catch (error) {
      console.warn("Failed to save autofill data:", error);
    }
  },

  syncToBackend: async () => {
    const { isSyncing, dirtyFields } = get();

    if (isSyncing || dirtyFields.size === 0) return;

    // Snapshot exactly what we're about to send. Only dirty fields are
    // included, and they're sent in full (including now-empty arrays/
    // strings) — this is what makes a cleared field actually clear
    // server-side instead of being silently dropped by a truthy guard.
    const fieldsToSync = new Set(dirtyFields);
    const dataSnapshot = get().data;

    set({ isSyncing: true });

    try {
      const { authApi } = await import("../lib/auth-api");
      await authApi.updateProfile(dataSnapshot, fieldsToSync);

      // Only clear a field's dirty flag if it still holds the exact value
      // we just sent — if the user edited it again while this request was
      // in flight, markDirty already re-added it (or it was never removed),
      // and it'll go out on the next sync with the newer value instead of
      // being lost.
      const current = get().data;
      const remainingDirty = new Set(
        [...get().dirtyFields].filter(
          (field) =>
            !fieldsToSync.has(field) ||
            JSON.stringify((current as any)[field]) !==
              JSON.stringify((dataSnapshot as any)[field]),
        ),
      );
      set({
        lastSyncedAt: new Date(),
        syncError: null,
        dirtyFields: remainingDirty,
        needsSync: remainingDirty.size > 0,
        syncFailureCount: 0,
      });
      persistDirtyFields(remainingDirty);
      persistSyncFailureCount(0);
    } catch (error: any) {
      console.warn("Failed to sync profile to backend:", error);

      if (
        error.message?.includes("network") ||
        error.message?.includes("offline")
      ) {
        // A connectivity gap isn't evidence of a stuck/broken sync — leave
        // syncFailureCount untouched so an extended period offline can't by
        // itself trip the abandon-local-edits threshold below and risk
        // discarding a real pending edit the moment the network returns.
        set({ syncError: "offline", needsSync: true });
      } else {
        // A non-network failure (e.g. the backend rejecting the payload)
        // means retrying won't help on its own — count it, so a run of
        // these eventually trips fetchFromBackend's abandon-stuck-dirty-
        // fields safety net instead of masking real backend data forever.
        const syncFailureCount = get().syncFailureCount + 1;
        set({ syncError: error.message || "Sync failed", syncFailureCount });
        persistSyncFailureCount(syncFailureCount);
        // Data-loss adjacent (the blank-name incident came from this exact
        // path) — report which field GROUPS failed, never their values.
        try {
          Sentry.captureException(error, {
            tags: { flow: "profile_sync" },
            extra: {
              dirty_fields: [...fieldsToSync],
              consecutive_failures: syncFailureCount,
            },
          });
        } catch {
          // Observability never blocks the sync path.
        }
      }
      // dirtyFields is left untouched on failure — nothing was confirmed
      // synced, so the next debounced/flushed attempt retries all of it.
    } finally {
      set({ isSyncing: false });
    }
  },

  flushSyncNow: async () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    if (get().dirtyFields.size > 0) {
      await get().syncToBackend();
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

      const backendInsights: Array<{ question: string; answer: string }> =
        parseVariant(
          (profile as any).applicant_profile?.INSIGHTS ||
            (profile as any).sponsor_profile?.INSIGHTS,
        );
      const mergedInsights =
        backendInsights.length > 0 ? backendInsights : existing.insights;

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
        // Experiences saved through the app already have startDate/endDate/current
        // as direct fields.  AI-classified experiences use a combined "dates" string
        // like "2022 – Present".  Prefer direct fields; fall back to parsing "dates".
        let startDate: string = raw.startDate || "";
        let endDate: string = raw.endDate || "";
        let isCurrent: boolean = raw.current ?? false;

        if (!startDate && raw.dates) {
          const datesStr: string = raw.dates;
          const parts = datesStr.split(/\s*[\u2013\u2014-]\s*/); // en-dash, em-dash, or hyphen
          startDate = parts[0]?.trim() || "";
          const endRaw = parts[1]?.trim() || "";
          isCurrent = /present/i.test(endRaw);
          endDate = isCurrent ? "" : endRaw;
        }

        return {
          id: raw.id || `exp-${idx}`,
          jobTitle: raw.jobTitle || raw.title || "", // backend sends "title"
          company: raw.company || "",
          startDate,
          endDate,
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
        sponsorCompanies: (() => {
          const fromBackend = parseVariant(
            (profile as any).sponsor_profile?.COMPANIES_CAN_REFER_TO,
          );
          if (fromBackend.length > 0) return fromBackend;
          if (existing.sponsorCompanies.length > 0)
            return existing.sponsorCompanies;
          // Seed with their own company if COMPANIES_CAN_REFER_TO is null
          const ownCompany = (profile as any).sponsor_profile?.COMPANY;
          return ownCompany ? [ownCompany] : [];
        })(),
        notificationPreferences: (() => {
          // Backend parses JSON in services/profiles.py:34 but may still return
          // a string in older responses — accept both shapes.
          const raw = (profile as any).NOTIFICATION_PREFERENCES;
          if (!raw) return existing.notificationPreferences || {};
          if (typeof raw === "string") {
            try {
              return JSON.parse(raw);
            } catch {
              return existing.notificationPreferences || {};
            }
          }
          return raw;
        })(),
      };

      // Local edits still pending sync must win over whatever the backend
      // just returned — otherwise a fetch racing an in-flight (or not-yet-
      // debounced) edit would overwrite it with stale server state, and a
      // fetch racing a field the user just CLEARED would resurrect the old
      // value the moment the backend caught up (the merge logic above
      // already prefers non-empty backend data, which is exactly backwards
      // for a field mid-deletion). Fields with no pending edit are left as
      // the normal backend-preferred merge computed above.
      //
      // Fail-safe: if syncToBackend has failed MAX_SYNC_FAILURES_BEFORE_-
      // ABANDONING times in a row for a non-network reason, that "local
      // wins" protection is abandoned instead — a dirty flag stuck because
      // the backend keeps rejecting the payload (not just a bad
      // connection) would otherwise mask real backend data (e.g. a
      // correctly-set name) forever, since it never clears on its own.
      // Past the threshold, this fetch is treated as the authority and the
      // stuck flags are dropped so future edits aren't shadowed either.
      const syncFailureCount = get().syncFailureCount;
      const abandoningStuckEdits =
        syncFailureCount >= MAX_SYNC_FAILURES_BEFORE_ABANDONING;
      const dirtyFields = abandoningStuckEdits
        ? new Set<SyncableField>()
        : get().dirtyFields;
      if (abandoningStuckEdits && get().dirtyFields.size > 0) {
        console.warn(
          `[useUserProfileStore] Sync has failed ${syncFailureCount} times in a row — abandoning ${get().dirtyFields.size} stuck dirty field(s) so the backend's data isn't masked forever.`,
        );
        set({ dirtyFields: new Set<SyncableField>(), syncFailureCount: 0 });
        persistDirtyFields(new Set<SyncableField>());
        persistSyncFailureCount(0);
      }
      if (dirtyFields.has("personal")) autofillData.personal = existing.personal;
      if (dirtyFields.has("professional"))
        autofillData.professional = existing.professional;
      if (dirtyFields.has("education")) autofillData.education = existing.education;
      if (dirtyFields.has("skills")) autofillData.skills = existing.skills;
      if (dirtyFields.has("insights")) autofillData.insights = existing.insights;
      if (dirtyFields.has("workPreferences"))
        autofillData.workPreferences = existing.workPreferences;
      if (dirtyFields.has("desiredRoles"))
        autofillData.desiredRoles = existing.desiredRoles;
      if (dirtyFields.has("certifications"))
        autofillData.certifications = existing.certifications;
      if (dirtyFields.has("languages")) autofillData.languages = existing.languages;
      if (dirtyFields.has("achievements"))
        autofillData.achievements = existing.achievements;

      set({ data: autofillData, isLoaded: true, lastSyncedAt: new Date() });

      // Update work email verification status. Backend now ships this field
      // (PR #42 — `sponsor_profiles.work_email_verified`), so read it
      // verbatim — strictly `=== true` to avoid passing unverified sponsors
      // through. Applicants don't have a sponsor_profile, so the value is
      // undefined for them; defaulting to false there is harmless because
      // the HomeView gate only checks this flag for sponsors.
      const workEmailVerifiedRaw = (profile as any).sponsor_profile
        ?.WORK_EMAIL_VERIFIED;
      const isVerified = workEmailVerifiedRaw === true;
      set({ workEmailVerified: isVerified });

      // Clear pendingWorkEmail only when the backend has confirmed the same
      // address — otherwise keep it so the modal continues to reflect the
      // user's last submitted address. If the user updated to "B" but the
      // backend still shows verified "A", we should keep "B" pending.
      const backendWorkEmail =
        ((profile as any).sponsor_profile?.WORK_EMAIL as string | undefined) ||
        "";
      const { pendingWorkEmail } = get();
      if (
        pendingWorkEmail &&
        isVerified &&
        backendWorkEmail.toLowerCase() === pendingWorkEmail.toLowerCase()
      ) {
        set({ pendingWorkEmail: null });
        try {
          await AsyncStorage.removeItem(PENDING_WORK_EMAIL_KEY);
        } catch (error) {
          console.warn("Failed to clear pending work email:", error);
        }
      }

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
      const [stored, storedPending, storedDirty, storedFailureCount] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(PENDING_WORK_EMAIL_KEY),
          AsyncStorage.getItem(DIRTY_FIELDS_KEY),
          AsyncStorage.getItem(SYNC_FAILURE_COUNT_KEY),
        ]);
      const patch: Partial<{
        data: AutofillData;
        isLoaded: boolean;
        pendingWorkEmail: string | null;
        dirtyFields: Set<SyncableField>;
        needsSync: boolean;
        syncFailureCount: number;
      }> = {};
      if (stored) {
        patch.data = JSON.parse(stored);
        patch.isLoaded = true;
      }
      if (storedPending) {
        patch.pendingWorkEmail = storedPending;
      }
      // A non-empty dirty-fields set here means the app was killed before a
      // debounced sync fired (or while one was in flight) — retry it once
      // auth is ready rather than losing the edit silently. See _layout.tsx,
      // which calls flushSyncNow() once accessToken is available.
      if (storedDirty) {
        try {
          const fields: SyncableField[] = JSON.parse(storedDirty);
          if (Array.isArray(fields) && fields.length > 0) {
            patch.dirtyFields = new Set(fields);
            patch.needsSync = true;
          }
        } catch {
          // Malformed — ignore, nothing to retry.
        }
      }
      // Restored so a run of non-network sync failures across app restarts
      // still reaches MAX_SYNC_FAILURES_BEFORE_ABANDONING instead of
      // resetting to 0 on every relaunch and never tripping the safety net.
      if (storedFailureCount) {
        const count = Number(storedFailureCount);
        if (Number.isFinite(count) && count > 0) {
          patch.syncFailureCount = count;
        }
      }
      if (Object.keys(patch).length > 0) {
        set(patch);
      }
    } catch (error) {
      console.warn("Failed to load autofill data:", error);
    }
  },

  clearData: async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY),
        AsyncStorage.removeItem(PENDING_WORK_EMAIL_KEY),
        AsyncStorage.removeItem(DIRTY_FIELDS_KEY),
        AsyncStorage.removeItem(SYNC_FAILURE_COUNT_KEY),
      ]);
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
      dirtyFields: new Set<SyncableField>(),
      syncFailureCount: 0,
      workEmailVerified: false,
      pendingWorkEmail: null,
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

// Flush any pending debounced sync the instant the app leaves the
// foreground. Without this, an edit made just before backgrounding (e.g.
// the user edits a field then immediately swipes the app away) sat in the
// 2s debounce window and was lost — the local cache showed the edit, but
// the backend never heard about it, and nothing retried since `needsSync`
// wasn't persisted (see loadFromStorage for the launch-time counterpart).
AppState.addEventListener("change", (status) => {
  if (status !== "active") {
    useUserProfileStore.getState().flushSyncNow();
  }
});
