import { useAuthStore } from "@/stores/useAuthStore";
import type { AutofillRequest, AutofillResponse } from "@/types/autofill";

export const API_BASE_URL = "https://oyster-app-4pg5w.ondigitalocean.app";

/**
 * 🌐 API Client with automatic auth header injection
 */
class ApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get auth headers with current access token
   */
  private getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().accessToken;

    console.log("[API] Auth token exists:", !!token);
    if (token) {
      console.log("[API] Token preview:", token.substring(0, 20) + "...");
    }

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Generic fetch wrapper with auth
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`[API] Requesting: ${endpoint}`);

    const config: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        ...(skipAuth
          ? { "Content-Type": "application/json" }
          : this.getAuthHeaders()),
      },
    };

    console.log(`[API] Request headers:`, config.headers);

    const response = await fetch(url, config);

    console.log(
      `[API] Response from ${endpoint}:`,
      response.status,
      response.statusText,
    );

    // Handle 401 Unauthorized - attempt token refresh
    if (
      response.status === 401 &&
      !skipAuth &&
      !endpoint.includes("/token/refresh/") &&
      !this.isRefreshing
    ) {
      console.log("[API] Received 401, attempting token refresh...");
      this.isRefreshing = true;

      try {
        const refreshSuccess = await useAuthStore
          .getState()
          .refreshAccessToken();

        if (refreshSuccess) {
          // Retry the original request with new token
          console.log("[API] Token refreshed, retrying request...");
          const retryConfig: RequestInit = {
            ...options,
            headers: {
              ...options.headers,
              ...this.getAuthHeaders(), // Get new token
            },
          };
          const retryResponse = await fetch(url, retryConfig);

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            console.error(`[API] Retry failed for ${endpoint}:`, errorData);
            const errorMessage =
              errorData?.error ||
              errorData?.detail ||
              errorData?.message ||
              `API Error: ${retryResponse.status}`;
            throw new Error(errorMessage);
          }

          return retryResponse.json();
        } else {
          // Refresh failed, user needs to re-login
          // Don't throw - let the app handle navigation silently
          console.log(
            "[API] Token refresh failed, session expired - returning empty response",
          );
          return {} as T; // Return empty object instead of throwing
        }
      } finally {
        this.isRefreshing = false;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // For authentication errors, log but don't throw to avoid error overlays
      if (
        response.status === 401 &&
        (errorData?.code === "token_not_valid" ||
          errorData?.detail?.includes("Token is invalid"))
      ) {
        console.log(
          `[API] Authentication failed for ${endpoint} - session expired`,
        );
        return {} as T; // Return empty object, let auth state handle redirect
      }

      console.error(`[API] Error from ${endpoint}:`, errorData);
      // Backend can return error in 'error' or 'detail' field
      const errorMessage =
        errorData?.error ||
        errorData?.detail ||
        errorData?.message ||
        `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, skipAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" }, skipAuth);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    skipAuth = false,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      },
      skipAuth,
    );
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

/**
 * 📦 Export singleton instance
 */
export const api = new ApiClient(API_BASE_URL);

/**
 * 🤖 AI-Powered Job Application Autofill
 * Sends form fields and user data to backend AI for intelligent filling
 */
export async function generateAutofillAnswers(
  request: AutofillRequest,
): Promise<AutofillResponse> {
  return api.post<AutofillResponse>("/api/v1/autofill/generate", request);
}

/**
 * 💼 Fetch Jobs Pack
 * Retrieves a curated pack of job listings
 */
export async function fetchJobsPack(): Promise<any[]> {
  const response = await api.get<{ jobs: any[]; total_count: number }>(
    "/api/jobs/pack/",
  );
  return response.jobs; // Extract jobs array from envelope
}

/**
 * � Browse Jobs (Sponsor)
 * Browse available ATS jobs (SILVER_JOBS) for sponsoring
 * Optional filters: title, location, remote, limit
 */
export async function browseJobs(filters?: {
  title?: string;
  location?: string;
  remote?: boolean;
  limit?: number;
}): Promise<{ jobs: any[]; total_count: number }> {
  const params = new URLSearchParams();
  if (filters?.title) params.append("title", filters.title);
  if (filters?.location) params.append("location", filters.location);
  if (filters?.remote !== undefined)
    params.append("remote", String(filters.remote));
  if (filters?.limit) params.append("limit", String(filters.limit));

  const queryString = params.toString();
  const endpoint = queryString
    ? `/api/jobs/browse/?${queryString}`
    : "/api/jobs/browse/";

  return api.get<{ jobs: any[]; total_count: number }>(endpoint);
}

/**
 * ⚡ Sponsor a Job
 * Sponsor an ATS job (creates a JOB_POSTINGS entry)
 */
export async function sponsorJob(
  jobId: string,
  data: {
    relationship?: string;
    canRefer?: boolean;
  },
): Promise<{
  job_id: string;
  title: string;
  company: string;
  message: string;
  relationship?: string;
  can_refer: boolean;
  expires_at: string;
}> {
  return api.post(`/api/jobs/${jobId}/sponsor/`, data);
}

/**
 * 👥 Fetch Profiles Pack (Sponsor)
 * Get a pack of applicant profiles for a sponsor's job
 * Required: job_id query parameter
 */
export async function fetchProfilesPack(jobId?: string): Promise<{
  profiles: any[];
  total_count: number;
}> {
  const url = jobId
    ? `/api/profiles/pack/?job_id=${jobId}`
    : `/api/profiles/pack/`;
  return api.get<{ profiles: any[]; total_count: number }>(url);
}

/**
 * 🚪 Logout
 * Invalidate current session on backend
 */
export async function logout(): Promise<void> {
  await api.post<void>("/api/logout/");
}

/**
 * ❤️ Like a Job (Applicant swipe right)
 * Record applicant's interest in a job
 */
export async function likeJob(jobId: string): Promise<{
  id: string;
  job_id: string;
  user_id: string;
  created_at: string;
  matched: boolean;
}> {
  return api.post(`/api/jobs/like/`, { job_id: jobId });
}

/**
 * 📋 Get Liked Jobs (Applicant)
 * Get list of jobs the applicant has liked
 */
export async function getLikedJobs(): Promise<
  | Array<{
      id: string;
      job_id: string;
      job_title: string;
      company: string;
      created_at: string;
    }>
  | {
      liked_jobs: Array<{
        id: string;
        job_id: string;
        job_title: string;
        company: string;
        created_at: string;
      }>;
      total_count: number;
    }
> {
  return api.get(`/api/likes/jobs/`);
}

/**
 * 💙 Get Interested Sponsors (Applicant)
 * Get sponsors who have liked this applicant's profile but have not yet matched.
 * One-sided interest from sponsor side — the applicant can "like back" to match.
 * Backend endpoint: GET /api/likes/profiles/received/
 */
export async function getInterestedSponsors(): Promise<
  Array<{
    LIKE_ID: string;
    LIKED_AT: string;
    SPONSOR_USER_ID: string;
    SPONSOR_FIRST_NAME: string;
    SPONSOR_LAST_NAME: string;
    SPONSOR_PHOTO_URL: string | null;
    SPONSOR_JOB_TITLE: string | null;
    SPONSOR_COMPANY: string | null;
    JOB_ID?: string;
  }>
> {
  return api.get("/api/likes/profiles/received/");
}

/**
 * 💙 Like a Profile (Sponsor swipe right)
 * Record sponsor's interest in an applicant profile
 */
export async function likeProfile(
  applicantUserId: string,
  jobId?: string,
): Promise<{
  id: string;
  applicant_user_id: string;
  sponsor_user_id: string;
  job_id?: string;
  created_at: string;
  matched: boolean;
}> {
  const payload: { applicant_user_id: string; job_id?: string } = {
    applicant_user_id: applicantUserId,
  };
  if (jobId) {
    payload.job_id = jobId;
  }
  return api.post(`/api/profiles/like/`, payload);
}

/**
 * 🤝 Get Matches (Applicant)
 * Get list of mutual matches for applicant
 */
export async function getMatches(): Promise<{
  job_matches?: Array<{
    id: string;
    job: {
      id: string;
      title: string;
      company: string;
      location?: string;
      salary_range?: string;
    };
    sponsor: {
      id: string;
      name: string;
      role?: string;
      company?: string;
      profile_image_url?: string;
    };
    matched_at: string;
    conversation_id?: string;
  }>;
  profile_matches?: Array<{
    id: string;
    job: {
      id: string;
      title: string;
      company: string;
      location?: string;
      salary_range?: string;
    };
    sponsor: {
      id: string;
      name: string;
      role?: string;
      company?: string;
      profile_image_url?: string;
    };
    matched_at: string;
    conversation_id?: string;
  }>;
  total_count?: number;
}> {
  return api.get(`/api/matches/`);
}

/**
 * 🤝 Get Sponsor Matches
 * Get list of mutual matches for sponsor
 */
export async function getSponsorMatches(): Promise<{
  matches: Array<{
    id: string;
    applicant: {
      id: string;
      name: string;
      current_role?: string;
      seeking_role?: string;
      profile_image_url?: string;
      skills?: string[];
    };
    job: {
      id: string;
      title: string;
      company: string;
    };
    matched_at: string;
    conversation_id?: string;
  }>;
  total_count: number;
}> {
  return api.get(`/api/matches/sponsor/`);
}

// ============================================================
// 💬 MESSAGING ENDPOINTS
// ============================================================

/**
 * 💬 Get Conversations
 * Get all conversations for current user
 *
 * Query params:
 * - includeHidden: boolean (default: false)
 * - page: number
 * - limit: number
 */
/**
 * 💬 Get Conversations
 * List all conversations for the authenticated user
 * Backend returns UPPERCASE field names from Snowflake
 */
export async function getConversations(): Promise<{
  conversations: Array<{
    CONVERSATION_ID: string;
    JOB_ID: string;
    APPLICANT_USER_ID: string;
    SPONSOR_USER_ID: string;
    STATUS: string;
    APPLICANT_HAS_UNREAD: boolean;
    SPONSOR_HAS_UNREAD: boolean;
    APPLICANT_FIRST_NAME: string;
    SPONSOR_FIRST_NAME: string;
    TITLE: string;
  }>;
}> {
  return api.get("/api/messages/conversations/");
}

/**
 * 💬 Get Conversation Messages
 * Get message history for a conversation
 * Backend returns UPPERCASE field names from Snowflake
 *
 * Query params:
 * - conversation_id: uuid (required)
 * - limit: number (optional, default 50, max 200)
 */
export async function getConversationMessages(
  conversationId: string,
  params?: {
    limit?: number;
  },
): Promise<{
  messages: Array<{
    MESSAGE_ID: string;
    CONVERSATION_ID: string;
    SENDER_ID: string;
    BODY: string;
    CREATED_AT: string;
    SENDER_FIRST_NAME: string;
    SENDER_PHOTO_URL: string | null;
  }>;
}> {
  const queryParams = new URLSearchParams();
  queryParams.append("conversation_id", conversationId);
  if (params?.limit) {
    queryParams.append("limit", String(params.limit));
  }

  return api.get(`/api/messages/history/?${queryParams.toString()}`);
}

/**
 * 💬 Send Message
 * Send a message in a conversation
 *
 * Body:
 * - conversation_id: string (required)
 * - body: string (required, 1-2000 characters)
 */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<{
  message_id: string;
}> {
  return api.post("/api/messages/send/", {
    conversation_id: conversationId,
    body,
  });
}

/**
 * 💬 Get or Create Conversation
 * Get or create a conversation between matched users
 *
 * Body:
 * - job_id: string (required)
 * - participant_user_id: string (required)
 *
 * Note: Users must be matched for the job
 */
export async function getOrCreateConversation(
  jobId: string,
  participantUserId: string,
): Promise<{
  conversation_id: string;
  job_id: string;
  applicant_user_id: string;
  sponsor_user_id: string;
  status: string;
}> {
  return api.post("/api/messages/conversations/get-or-create/", {
    job_id: jobId,
    participant_user_id: participantUserId,
  });
}

/**
 * 💬 Unmatch Users
 * Unmatch users (closes the conversation)
 *
 * Body:
 * - conversation_id: string (required)
 */
export async function unmatchConversation(conversationId: string): Promise<{
  status: string;
}> {
  return api.post("/api/messages/unmatch/", {
    conversation_id: conversationId,
  });
}

// ============================================================
// 👤 PROFILE MANAGEMENT ENDPOINTS
// ============================================================

/**
 * 👤 Get Full Profile
 * Get full profile for the authenticated user
 * Uses GET /api/profile/
 *
 * Returns UPPERCASE field names from Snowflake
 * Includes role-specific profile data
 */
export async function getProfile(): Promise<{
  USER_ID: string;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  LOCATION: string;
  PHOTO_URL: string | null;
  PHONE_NUMBER: string | null;
  ROLE_TYPE: "Applicant" | "Sponsor";
  IS_JOB_SEEKER: boolean;
  IS_SPONSOR: boolean;
  LINKED_IN: string | null;
  PORTFOLIO_URL: string | null;
  DATE_OF_BIRTH: string | null;
  applicant_profile?: {
    INDUSTRY: string;
    RANGE_MILES: number;
    REASON: string;
    POSITIONS: string[];
    SKILLS: string[];
    RESUME_DATA: any;
  };
  sponsor_profile?: {
    COMPANY: string;
    JOB_TITLE: string;
    WORK_EMAIL: string;
    DURATION: string;
    FINANCIAL_REWARD: boolean;
    REFERRAL_ELIGIBLE: boolean;
    REFERRAL_EXPERIENCE: boolean;
    OPEN_TO_REFERRALS: boolean;
  };
}> {
  return api.get("/api/profile/");
}

/**
 * 👤 Get Basic Profile
 * Get basic user info for the authenticated user
 * Uses GET /api/profile/basic/
 *
 * Returns subset of profile fields (USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PHOTO_URL)
 */
export async function getBasicProfile(): Promise<{
  USER_ID: string;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  PHOTO_URL: string | null;
}> {
  return api.get("/api/profile/basic/");
}

/**
 * 👤 Update General Profile
 * Update general profile fields (both applicant and sponsor)
 * Uses PATCH /api/profile/update/
 *
 * Supported fields:
 * - location: string
 * - photo_url: string
 * - phone_number: string
 * - first_name: string
 * - last_name: string
 * - international_code: string
 * - linked_in: string
 * - portfolio_url: string
 * - date_of_birth: string
 * - bio: string (max 2000 chars)
 * - street: string
 * - city: string
 * - state: string
 * - zip: string
 * - country: string
 */
export async function updateGeneralProfile(updates: {
  location?: string;
  photo_url?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  international_code?: string;
  linked_in?: string;
  portfolio_url?: string;
  date_of_birth?: string;
  bio?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): Promise<{
  message: string;
  updated_fields: string[];
}> {
  return api.patch("/api/profile/update/", updates);
}

/**
 * 👤 Update Applicant Profile
 * Update applicant-specific fields (includes insights, education, experience, etc.)
 * Uses PATCH /api/profile/applicant/update/
 *
 * Supported fields:
 * - industry: string
 * - range: number (alias for range_miles)
 * - range_miles: number
 * - reason: string
 * - positions: array of strings
 * - skills: array of strings
 * - resume_data: object
 * - current_role: string
 * - years_experience: string
 * - work_authorization: string
 * - willing_to_relocate: string
 * - requires_sponsorship: string
 * - achievements: string (max 2000 chars)
 * - desired_roles: array of strings
 * - work_preferences: array of strings
 * - professional_experiences: array of {jobTitle, company, startDate, endDate, current, description}
 * - education_entries: array of {degree, major, university, graduationYear, gpa}
 * - certifications: array of {name, organization, year}
 * - languages: array of {language, proficiency}
 * - insights: array of {question, answer}
 */
export async function updateApplicantProfile(updates: {
  industry?: string;
  range?: number;
  range_miles?: number;
  reason?: string;
  positions?: string[];
  skills?: string[];
  resume_data?: any;
  current_role?: string;
  years_experience?: string;
  work_authorization?: string;
  willing_to_relocate?: string;
  requires_sponsorship?: string;
  achievements?: string;
  desired_roles?: string[];
  work_preferences?: string[];
  professional_experiences?: Array<{
    jobTitle: string;
    company: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description: string;
  }>;
  education_entries?: Array<{
    degree: string;
    major?: string;
    university: string;
    graduationYear?: string;
    gpa?: string;
  }>;
  certifications?: Array<{
    name: string;
    organization: string;
    year: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency: string;
  }>;
  insights?: Array<{
    question: string;
    answer: string;
  }>;
}): Promise<{
  message: string;
  updated_fields: string[];
}> {
  return api.patch("/api/profile/applicant/update/", updates);
}

/**
 * 👤 Update Sponsor Profile
 * Update sponsor-specific fields (includes insights)
 * Uses PATCH /api/profile/sponsor/update/
 *
 * Supported fields:
 * - company: string
 * - job_title: string
 * - work_email: string
 * - linked_in: string
 * - duration: string
 * - financial_reward: boolean (accepts "yes"/"no", true/false)
 * - referral_eligible: boolean
 * - referral_experience: boolean
 * - open_to_referrals: boolean
 * - companies_can_refer_to: array of company name strings
 * - insights: array of {question, answer}
 */
export async function updateSponsorProfile(updates: {
  company?: string;
  job_title?: string;
  work_email?: string;
  linked_in?: string;
  duration?: string;
  financial_reward?: boolean;
  referral_eligible?: boolean;
  referral_experience?: boolean;
  open_to_referrals?: boolean;
  companies_can_refer_to?: string[];
  skills?: string[];
  insights?: Array<{
    question: string;
    answer: string;
  }>;
}): Promise<{
  message: string;
  updated_fields: string[];
}> {
  return api.patch("/api/profile/sponsor/update/", updates);
}

/**
 * 👤 Get Public Profile
 * View another user's public profile
 * Uses GET /api/profiles/<user_id>/public/
 *
 * Returns UPPERCASE field names from Snowflake
 * Excludes private fields (email, phone, street, zip)
 *
 * @param userId - The user ID to fetch profile for
 */
export async function getPublicProfile(userId: string): Promise<{
  USER_ID: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  ROLE_TYPE: "Applicant" | "Sponsor";
  PHOTO_URL: string | null;
  LOCATION: string | null;
  BIO: string | null;
  CITY: string | null;
  STATE: string | null;
  COUNTRY: string | null;
  LINKED_IN: string | null;
  PORTFOLIO_URL: string | null;
  applicant_profile?: {
    INDUSTRY: string;
    CURRENT_ROLE: string;
    YEARS_EXPERIENCE: string;
    SKILLS: string[];
    POSITIONS: string[];
    PROFESSIONAL_EXPERIENCES: Array<{
      jobTitle: string;
      company: string;
      startDate: string;
      endDate?: string;
      current: boolean;
      description: string;
    }>;
    EDUCATION_ENTRIES: Array<{
      degree: string;
      major?: string;
      university: string;
      graduationYear?: string;
      gpa?: string;
    }>;
    CERTIFICATIONS: Array<{
      name: string;
      organization: string;
      year: string;
    }>;
    LANGUAGES: Array<{
      language: string;
      proficiency: string;
    }>;
    INSIGHTS: Array<{
      question: string;
      answer: string;
    }>;
  };
  sponsor_profile?: {
    COMPANY: string;
    JOB_TITLE: string;
    WORK_EMAIL: string;
    DURATION: string;
    FINANCIAL_REWARD: boolean;
    REFERRAL_ELIGIBLE: boolean;
    REFERRAL_EXPERIENCE: boolean;
    OPEN_TO_REFERRALS: boolean;
    COMPANIES_CAN_REFER_TO: string[];
    INSIGHTS: Array<{
      question: string;
      answer: string;
    }>;
  };
}> {
  return api.get(`/api/profiles/${userId}/public/`);
}

// ============================================================
// 🔔 NOTIFICATION ENDPOINTS
// ============================================================

/**
 * 🔔 Get Notifications
 * List notifications for the authenticated user (newest first, paginated)
 * Backend returns UPPERCASE field names from Snowflake
 *
 * Query params:
 * - limit: number (optional, default 20)
 * - offset: number (optional, default 0)
 * - unread_only: boolean (optional, default false)
 */
export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}): Promise<{
  notifications: Array<{
    NOTIFICATION_ID: string;
    USER_ID: string;
    TYPE: "match" | "message" | "referral" | "connection" | "profile_update";
    TITLE: string;
    BODY: string;
    IS_READ: boolean;
    RELATED_USER_ID: string | null;
    RELATED_JOB_ID: string | null;
    RELATED_CONVERSATION_ID: string | null;
    CREATED_AT: string;
  }>;
  total_count: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit !== undefined) {
    queryParams.append("limit", String(params.limit));
  }
  if (params?.offset !== undefined) {
    queryParams.append("offset", String(params.offset));
  }
  if (params?.unread_only !== undefined) {
    queryParams.append("unread_only", String(params.unread_only));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/notifications/?${queryString}`
    : "/api/notifications/";

  return api.get(endpoint);
}

/**
 * 🔔 Get Unread Notification Count
 * Returns the count of unread notifications (for badge display)
 */
export async function getUnreadNotificationCount(): Promise<{
  unread_count: number;
}> {
  return api.get("/api/notifications/unread-count/");
}

/**
 * 🔔 Mark Notification as Read
 * Mark a single notification as read
 *
 * @param notificationId - The UUID of the notification to mark as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<{
  message: string;
}> {
  return api.patch(`/api/notifications/${notificationId}/read/`);
}

/**
 * 🔔 Mark All Notifications as Read
 * Mark all unread notifications as read for the authenticated user
 */
export async function markAllNotificationsAsRead(): Promise<{
  message: string;
  marked_count: number;
}> {
  return api.patch("/api/notifications/read-all/");
}
