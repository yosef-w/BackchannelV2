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
    const response = await api.post<LoginResponse>("/api/login/", { email, password }, true); // Skip auth header
    return response;
  },

  /**
   * Register new user account
   */
  register: async (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ): Promise<RegisterResponse> => {
    return api.post<RegisterResponse>("/api/register/", {
      firstName,
      lastName,
      email,
      password,
    });
  },

  /**
   * Create complete user profile with onboarding data
   * For now, skip API call and return mock tokens since backend isn't ready
   */
  createProfile: async (data: CreateProfileRequest): Promise<RegisterResponse> => {
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      user_type: data.userType,
    };
  },

  /**
   * Logout current session
   */
  logout: async (): Promise<void> => {
    return api.post<void>("/api/logout/");
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
    newPassword: string
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
  updateProfile: async (data: UpdateProfileRequest): Promise<ProfileResponse> => {
    // Return mock response matching actual backend structure
    return {
      USER_ID: 'mock-user-id',
      USERNAME: 'user',
      EMAIL: data.personal?.email || '',
      IS_ACTIVE: true,
      CREATED_AT: new Date().toISOString(),
      LAST_LOGIN: null,
      PROFILE_ID: 'mock-profile-id',
      LOCATION: null,
      IS_JOB_SEEKER: true,
      IS_SPONSOR: false,
      PHOTO_URL: null,
      PHONE_NUMBER: data.personal?.phone || null,
      FIRST_NAME: data.personal?.firstName || null,
      LAST_NAME: data.personal?.lastName || null,
      DATE_OF_BIRTH: null,
      ROLE_TYPE: null,
      INTERNATIONAL_CODE: null,
      PROFILE_CREATED_AT: new Date().toISOString(),
      PROFILE_UPDATED_AT: new Date().toISOString(),
    };
  },
};
