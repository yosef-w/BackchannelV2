import { api } from "./api";

/**
 * 🔐 Authentication API Response Types
 */
export interface LoginResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  role: "Applicant" | "Sponsor";
}

export interface RegisterResponse {
  user_id: string;
  profile_id: string;
  email: string;
  username: string;
  access_token: string;
  refresh_token: string;
  role: "Applicant" | "Sponsor";
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
    const username = email.split("@")[0];
    return api.post<RegisterResponse>(
      "/api/register/",
      {
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        role: "Applicant",
      },
      true,
    );
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
    const username = email.split("@")[0];
    return api.post<RegisterResponse>(
      "/api/register-sponsor/",
      {
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        role: "Sponsor",
      },
      true,
    );
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
          work_preferences: data.profileData?.workPreferences || [],
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
   * Verify a user's email using the JWT token from the verification email link.
   * Idempotent — verifying twice returns success both times.
   * No auth header required (the token in the body carries identity).
   * PR #38 (2026-04-30).
   */
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>(
      "/api/auth/verify-email/",
      { token },
      true,
    );
  },

  /**
   * Re-send the verification email. Always returns 200 regardless of whether
   * the email exists or is already verified (anti-enumeration). Rate-limited
   * to 5 requests/hour per IP.
   * PR #38 (2026-04-30).
   */
  resendVerificationEmail: async (
    email: string,
  ): Promise<{ message: string }> => {
    return api.post<{ message: string }>(
      "/api/auth/resend-verification/",
      { email },
      true,
    );
  },

  /**
   * Send a work-email verification link to a sponsor's claimed company email.
   * Distinct from the login-email verification — this proves "Jane actually
   * works at Stripe" by emailing the address she claims. The verify-email
   * endpoint then branches on the JWT's `purpose` claim to flip
   * `sponsor_profiles.work_email_verified`.
   *
   * Auth: required (sponsor session). Rate-limited 5/hour per user.
   * PR #42.
   */
  sendWorkEmailVerification: async (
    workEmail: string,
  ): Promise<{ message: string }> => {
    return api.post<{ message: string }>(
      "/api/auth/verify-work-email/send/",
      { work_email: workEmail },
    );
  },
  /**
   * Persist a sponsor's work email to `sponsor_profiles.work_email` and mark
   * `work_email_verified = FALSE` server-side. Separate from the
   * verification-link send because the send endpoint only embeds the email
   * in a JWT — the DB column itself isn't written until the user clicks the
   * verification link. Call this in tandem with `sendWorkEmailVerification`
   * when the user updates their work email from the verification modal so
   * the backend reflects the new address immediately (unverified), and on
   * link-click it gets re-saved as verified.
   *
   * Backend: PATCH /api/profile/sponsor/update/ (accepts `work_email`).
   */
  updateWorkEmail: async (
    workEmail: string,
  ): Promise<{ message: string; updated_fields: string[] }> => {
    return api.patch<{ message: string; updated_fields: string[] }>(
      "/api/profile/sponsor/update/",
      { work_email: workEmail },
    );
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
   * Routes to the correct backend endpoint(s) based on user role:
   *   - PATCH /api/profile/update/            → general fields (name, phone, bio, address…)
   *   - PATCH /api/profile/applicant/update/  → applicant-specific fields
   *   - PATCH /api/profile/sponsor/update/    → sponsor-specific fields
   */
  updateProfile: async (data: any): Promise<{ message: string }> => {
    // ── 1. Build the general-user-profile payload ─────────────────────────
    const basePayload: Record<string, any> = {};
    if (data.personal?.firstName)
      basePayload.first_name = data.personal.firstName;
    if (data.personal?.lastName) basePayload.last_name = data.personal.lastName;
    if (data.personal?.phone) basePayload.phone_number = data.personal.phone;
    if (data.personal?.portfolio)
      basePayload.portfolio_url = data.personal.portfolio;
    if (data.personal?.address?.street)
      basePayload.street = data.personal.address.street;
    if (data.personal?.address?.city)
      basePayload.city = data.personal.address.city;
    if (data.personal?.address?.state)
      basePayload.state = data.personal.address.state;
    if (data.personal?.address?.zip)
      basePayload.zip = data.personal.address.zip;
    if (data.personal?.address?.country)
      basePayload.country = data.personal.address.country;
    if (data.professional?.summary) basePayload.bio = data.professional.summary;

    // ── 2. Determine user type from the onboarding store ─────────────────
    const { useOnboardingStore } = await import("../stores/useOnboardingStore");
    const userType = useOnboardingStore.getState().userType; // "applicant" | "sponsor" | null

    // ── 3. Build the role-specific payload ────────────────────────────────
    const rolePayload: Record<string, any> = {};

    if (userType === "sponsor") {
      if (data.professional?.company)
        rolePayload.company = data.professional.company;
      if (data.professional?.title)
        rolePayload.job_title = data.professional.title;
      if (data.insights?.length) rolePayload.insights = data.insights;
    } else {
      // Default to applicant
      if (data.skills?.length) rolePayload.skills = data.skills;
      if (data.insights?.length) rolePayload.insights = data.insights;
      if (data.professional?.currentRole)
        rolePayload.current_role = data.professional.currentRole;
      if (data.professional?.targetIndustry)
        rolePayload.industry = data.professional.targetIndustry;
      if (data.professional?.seekingPosition)
        rolePayload.positions = [data.professional.seekingPosition];
      if (data.professional?.yearsExperience)
        rolePayload.years_experience = data.professional.yearsExperience;
      if (data.achievements) rolePayload.achievements = data.achievements;
      if (data.professional?.experiences?.length)
        rolePayload.professional_experiences = data.professional.experiences;
      if (data.education?.entries?.length)
        rolePayload.education_entries = data.education.entries;
      if (data.certifications?.length)
        rolePayload.certifications = data.certifications;
      if (data.languages?.length) rolePayload.languages = data.languages;
      if (data.preferences?.workAuthorization)
        rolePayload.work_authorization = data.preferences.workAuthorization;
      if (data.preferences?.willingToRelocate)
        rolePayload.willing_to_relocate = data.preferences.willingToRelocate;
      if (data.preferences?.requiresSponsorship)
        rolePayload.requires_sponsorship = data.preferences.requiresSponsorship;
      if (data.workPreferences?.length)
        rolePayload.work_preferences = data.workPreferences;
      if (data.desiredRoles?.length)
        rolePayload.desired_roles = data.desiredRoles;
    }

    // ── 4. Fire the PATCH requests in parallel ────────────────────────────
    const calls: Promise<any>[] = [];
    if (Object.keys(basePayload).length > 0) {
      calls.push(api.patch("/api/profile/update/", basePayload));
    }
    if (Object.keys(rolePayload).length > 0) {
      const roleEndpoint =
        userType === "sponsor"
          ? "/api/profile/sponsor/update/"
          : "/api/profile/applicant/update/";
      calls.push(api.patch(roleEndpoint, rolePayload));
    }
    if (calls.length > 0) {
      await Promise.all(calls);
    }

    return { message: "Profile updated successfully" };
  },
};
