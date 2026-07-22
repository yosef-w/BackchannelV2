import { create } from "zustand";

/**
 * 👤 Onboarding Flow Types
 */
export type UserType = "applicant" | "sponsor" | null;

export interface ApplicantProfileData {
  // Auth fields
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  
  // Questionnaire answers
  targetIndustry: string;
  currentRole: string;
  seekingPosition: string;
  skills: string[];
  insights: Array<{ question: string; answer: string }>;
  resumeUrl?: string;
}

export interface SponsorProfileData {
  // Auth fields
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  
  // Questionnaire answers
  company: string;
  jobTitle: string;
  yearsAtCompany: string;
  openToReferrals: string;
  pastReferrals: string;
  referralBonus: string;
  insights: Array<{ question: string; answer: string }>;
  workEmail: string;
}

/**
 * Set once AuthScreen gets a role-less (`needs_onboarding: true`) response
 * from `POST /api/auth/sso/` (docs/BACKEND_CHANGES_NEEDED.md §S) — the user
 * is already authenticated (tokens are in useAuthStore) but has no role or
 * profile yet. The questionnaires read this to call
 * `authApi.completeSsoOnboarding()` instead of `authApi.createProfile()`
 * and to skip the password field entirely. `givenName`/`familyName` are
 * Apple's one-time full-name grant (see lib/sso.ts) — captured here because
 * a second Apple sign-in will never send them again.
 */
export interface SsoSession {
  provider: "apple" | "google";
  email: string;
  givenName: string | null;
  familyName: string | null;
}

/**
 * 📝 Onboarding Store State
 */
interface OnboardingState {
  userType: UserType;
  applicantData: Partial<ApplicantProfileData>;
  sponsorData: Partial<SponsorProfileData>;
  ssoSession: SsoSession | null;

  // Actions
  setUserType: (type: UserType) => void;
  updateApplicantData: (data: Partial<ApplicantProfileData>) => void;
  updateSponsorData: (data: Partial<SponsorProfileData>) => void;
  setSsoSession: (session: SsoSession | null) => void;
  clearProfile: () => void;

  // Computed
  getCompleteProfile: () => ApplicantProfileData | SponsorProfileData | null;
}

/**
 * 🏪 Zustand Onboarding Store - Temporary signup/questionnaire data
 */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  userType: null,
  applicantData: {},
  sponsorData: {},
  ssoSession: null,

  /**
   * Set user type (applicant or sponsor)
   */
  setUserType: (type) => {
    set({ userType: type });
  },

  /**
   * Update applicant profile data (merge with existing)
   */
  updateApplicantData: (data) => {
    set((state) => ({
      applicantData: { ...state.applicantData, ...data },
    }));
  },

  /**
   * Update sponsor profile data (merge with existing)
   */
  updateSponsorData: (data) => {
    set((state) => ({
      sponsorData: { ...state.sponsorData, ...data },
    }));
  },

  /**
   * Record (or clear) the authenticated-but-role-less SSO identity for the
   * questionnaires to consume. See `SsoSession`'s doc comment.
   */
  setSsoSession: (session) => {
    set({ ssoSession: session });
  },

  /**
   * Clear all profile data
   */
  clearProfile: () => {
    set({
      userType: null,
      applicantData: {},
      sponsorData: {},
      ssoSession: null,
    });
  },

  /**
   * Get complete profile based on user type
   */
  getCompleteProfile: () => {
    const state = get();
    if (state.userType === "applicant") {
      return state.applicantData as ApplicantProfileData;
    } else if (state.userType === "sponsor") {
      return state.sponsorData as SponsorProfileData;
    }
    return null;
  },
}));
