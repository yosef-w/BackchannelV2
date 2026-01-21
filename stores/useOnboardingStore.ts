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
 * 📝 Onboarding Store State
 */
interface OnboardingState {
  userType: UserType;
  applicantData: Partial<ApplicantProfileData>;
  sponsorData: Partial<SponsorProfileData>;

  // Actions
  setUserType: (type: UserType) => void;
  updateApplicantData: (data: Partial<ApplicantProfileData>) => void;
  updateSponsorData: (data: Partial<SponsorProfileData>) => void;
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
   * Clear all profile data
   */
  clearProfile: () => {
    set({
      userType: null,
      applicantData: {},
      sponsorData: {},
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
