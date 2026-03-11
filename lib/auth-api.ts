import { api } from "./api";

/**
 * 🔐 Authentication API Response Types
 */
export interface LoginResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  username: string;
  access_token: string;
  refresh_token: string;
}

export interface CreateProfileRequest {
  userType: "applicant" | "sponsor";
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  profileData: any;
}

export interface UpdateProfileRequest {
  personal?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    portfolio?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
  };
  professional?: {
    title?: string;
    currentRole?: string;
    yearsExperience?: string;
    summary?: string;
    desiredSalary?: string;
    availableStartDate?: string;
    targetIndustry?: string;
    seekingPosition?: string;
  };
  education?: {
    degree?: string;
    major?: string;
    university?: string;
    graduationYear?: string;
    gpa?: string;
  };
  preferences?: {
    workAuthorization?: string;
    willingToRelocate?: string;
    requiresSponsorship?: string;
    securityClearance?: string;
  };
  demographics?: {
    gender?: string;
    ethnicity?: string;
    veteran?: string;
    disability?: string;
  };
  skills?: string[];
  insights?: Array<{ question: string; answer: string }>;
  resumeUrl?: string | null;
}

export interface ProfileResponse {
  id: string;
  userType: "applicant" | "sponsor";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
  address?: any;
  professional?: any;
  education?: any;
  preferences?: any;
  demographics?: any;
  skills?: string[];
  insights?: Array<{ question: string; answer: string }>;
  resumeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 🔐 Authentication API Calls
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>(
      "/api/login/",
      { email, password },
      true,
    ); // Skip auth header
    return response;
  },

  /**
   * Register new applicant (used during questionnaire)
   */
  register: async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<RegisterResponse> => {
    return api.post<RegisterResponse>(
      "/api/register/",
      {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      },
      true,
    ); // Skip auth header for registration
  },

  /**
   * Register new sponsor
   */
  registerSponsor: async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<RegisterResponse> => {
    return api.post<RegisterResponse>(
      "/api/register-sponsor/",
      {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      },
      true,
    ); // Skip auth header for registration
  },

  /**
   * Create complete user profile with onboarding data
   * Maps frontend questionnaire data to backend registration endpoints
   */
  createProfile: async (
    data: CreateProfileRequest,
  ): Promise<RegisterResponse> => {
    // Derive username from email (take part before @)
    const username = data.email.split("@")[0];

    const basePayload = {
      username,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password: data.password,
    };

    if (data.userType === "applicant") {
      // Call applicant registration endpoint
      return api.post<RegisterResponse>(
        "/api/register/",
        {
          ...basePayload,
          role: "Applicant",
          industry: data.profileData?.targetIndustry,
          current_role: data.profileData?.currentRole,
          positions: data.profileData?.seekingPosition
            ? [data.profileData.seekingPosition]
            : [],
          skills: data.profileData?.skills || [],
          insights: data.profileData?.insights || [],
        },
        true,
      );
    } else {
      // Call sponsor registration endpoint
      return api.post<RegisterResponse>(
        "/api/register-sponsor/",
        {
          ...basePayload,
          role: "Sponsor",
          company: data.profileData?.company,
          job_title: data.profileData?.jobTitle,
          duration: data.profileData?.yearsAtCompany,
          open_to_referrals:
            data.profileData?.openToReferrals === "Yes, absolutely",
          referral_experience: data.profileData?.pastReferrals === "Frequently",
          financial_reward:
            data.profileData?.referralBonus === "Yes" ? "yes" : "no",
          insights: data.profileData?.insights || [],
          work_email: data.profileData?.workEmail,
        },
        true,
      );
    }
  },

  /**
   * Logout current session
   */
  logout: async (): Promise<void> => {
    return api.post<void>("/api/logout/");
  },

  /**
   * Refresh access token using refresh token
   */
  refreshToken: async (refreshToken: string): Promise<{ access: string }> => {
    return api.post<{ access: string }>(
      "/api/token/refresh/",
      {
        refresh: refreshToken,
      },
      true,
    ); // Skip auth header for token refresh
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>("/api/forgot-password/", { email });
  },

  /**
   * Reset password with token
   */
  resetPassword: async (
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> => {
    return api.post<{ message: string }>("/api/reset-password/", {
      token,
      newPassword,
    });
  },
  /**
   * Fetch current user's profile
   * Backend endpoint: GET /api/profile/
   */
  getProfile: async (): Promise<ProfileResponse> => {
    const response = await api.get<ProfileResponse>("/api/profile/");
    return response;
  },

  /**
   * Update user profile (partial update)
   * Backend endpoints:
   * - PATCH /api/profile/update/ (basic fields)
   * - PATCH /api/profile/applicant/update/ (applicant-specific)
   * - PATCH /api/profile/sponsor/update/ (sponsor-specific)
   *
   * For now, skip API call since backend isn't ready
   */
  updateProfile: async (
    data: UpdateProfileRequest,
  ): Promise<ProfileResponse> => {
    // Return mock response matching ProfileResponse interface
    return {
      id: "mock-user-id",
      userType: "applicant",
      firstName: data.personal?.firstName || "",
      lastName: data.personal?.lastName || "",
      email: data.personal?.email || "",
      phone: data.personal?.phone,
      linkedin: data.personal?.linkedin,
      portfolio: data.personal?.portfolio,
      address: data.personal?.address,
      professional: data.professional,
      education: data.education,
      preferences: data.preferences,
      demographics: data.demographics,
      skills: data.skills,
      insights: data.insights,
      resumeUrl: data.resumeUrl || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};
