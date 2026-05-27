import { useAuthStore } from "@/stores/useAuthStore";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://oyster-app-4pg5w.ondigitalocean.app";

/**
 * 🌐 API Client with automatic auth header injection
 */
class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;

  /**
   * Queue of requests that arrived while a token refresh was already in
   * progress.  Each entry holds the resolve/reject of a Promise that will be
   * settled once the single in-flight refresh completes (or fails), so every
   * waiting request is replayed with the new token rather than being dropped
   * or causing a second refresh call.
   */
  private refreshQueue: Array<{
    resolve: (newToken: string) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** Park a request until the in-progress refresh resolves. */
  private waitForRefresh(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.refreshQueue.push({ resolve, reject });
    });
  }

  /** Replay all queued requests with the freshly issued access token. */
  private drainRefreshQueue(newToken: string) {
    this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
    this.refreshQueue = [];
  }

  /** Reject all queued requests when the refresh has permanently failed. */
  private rejectRefreshQueue(err: Error) {
    this.refreshQueue.forEach(({ reject }) => reject(err));
    this.refreshQueue = [];
  }

  /**
   * Core fetch wrapper with automatic auth-header injection and transparent
   * token-refresh on 401 responses.
   *
   * Concurrency guarantee: if multiple requests receive a 401 simultaneously,
   * only the first one triggers a refresh.  The rest are queued and replayed
   * with the new token once the single refresh call resolves, so we never make
   * redundant refresh requests and no caller is silently dropped.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        ...(skipAuth
          ? { "Content-Type": "application/json" }
          : this.getAuthHeaders()),
      },
    };

    const response = await fetch(url, config);

    // ── 401 Unauthorized ─────────────────────────────────────────────────────
    if (
      response.status === 401 &&
      !skipAuth &&
      !endpoint.includes("/token/refresh/")
    ) {
      // A refresh is already in flight — queue this request and wait.
      if (this.isRefreshing) {
        const newToken = await this.waitForRefresh();
        return this.retryWithToken<T>(url, options, newToken);
      }

      // This is the first request to see the 401; it owns the refresh.
      this.isRefreshing = true;
      try {
        const refreshed = await useAuthStore.getState().refreshAccessToken();
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken!;
          this.drainRefreshQueue(newToken);
          return this.retryWithToken<T>(url, options, newToken);
        } else {
          // Both tokens are expired. clearAuth() was already called inside
          // refreshAccessToken, which will drive navigation to the login screen.
          const err = new Error("Session expired. Please log in again.");
          this.rejectRefreshQueue(err);
          throw err;
        }
      } finally {
        this.isRefreshing = false;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      let errorData: any = {};
      try {
        errorData = JSON.parse(rawText);
      } catch {}
      console.warn(
        `[API ${response.status}] ${endpoint}`,
        rawText.slice(0, 500),
      );
      const errorMessage =
        errorData?.error ||
        errorData?.detail ||
        errorData?.message ||
        `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /** Retry a request using an explicit Bearer token (called after a refresh). */
  private async retryWithToken<T>(
    url: string,
    options: RequestInit,
    token: string,
  ): Promise<T> {
    const retryConfig: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };
    const retryResponse = await fetch(url, retryConfig);
    if (!retryResponse.ok) {
      const rawText = await retryResponse.text().catch(() => "");
      let errorData: any = {};
      try {
        errorData = JSON.parse(rawText);
      } catch {}
      console.warn(
        `[API retry ${retryResponse.status}] ${url}`,
        rawText.slice(0, 500),
      );
      const errorMessage =
        errorData?.error ||
        errorData?.detail ||
        errorData?.message ||
        `API Error: ${retryResponse.status}`;
      throw new Error(errorMessage);
    }
    return retryResponse.json();
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, skipAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" }, skipAuth);
  }

  /**
   * POST request
   * Pass an AbortSignal to cancel in-flight requests (e.g. user hits Cancel).
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    skipAuth = false,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
        signal,
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
   *
   * Most DELETE endpoints take no body, but a few (e.g. unsponsor-job, which
   * captures an optional `reason` payload) accept JSON — passing `data` here
   * serializes it the same way POST/PUT/PATCH do.
   */
  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

/**
 * 📦 Export singleton instance
 */
export const api = new ApiClient(API_BASE_URL);

/**
 * 💼 Fetch Jobs Pack
 * Retrieves a curated pack of job listings
 */
export async function fetchJobsPack(): Promise<any[]> {
  const response = await api.get<{ jobs: any[]; total_count: number }>(
    "/api/jobs/pack/",
  );
  // Jobs are ranked by relevance_score (skills 40%, experience 20%, role 20%, location 10%, recency 10%)
  // New fields: relevance_score (float 0-1), REQUIREMENTS_SUMMARY (string|null), CORE_RESPONSIBILITIES (string|null)
  return response.jobs;
}

/**
 * � Browse Jobs (Sponsor)
 * Browse available ATS jobs (SILVER_JOBS) for sponsoring
 * Optional filters: title, location, remote, limit, company.
 *
 * `company` lets a sponsor browse roles at any company in their
 * `COMPANIES_CAN_REFER_TO` list (not just their own employer). Once
 * BACKEND_CHANGES_NEEDED.md §6 ships, the backend will validate the
 * requested company is in the sponsor's refer-list before filtering. Until
 * then the parameter is silently ignored and the backend falls back to
 * `sponsor_profiles.COMPANY` — sending it is harmless.
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
 * 🔍 Get Job Detail (Silver Job)
 * Retrieves full details for a single ATS/silver job by ID.
 * Used by the sponsor-request flow so a sponsor can review the role
 * before agreeing to sponsor.
 * Uses GET /api/jobs/silver/<job_id>/
 */
export async function getJobDetail(jobId: string): Promise<any> {
  return api.get<any>(`/api/jobs/silver/${jobId}/`);
}

/**
 * ⚡ Sponsor a Job
 * Sponsor an ATS job (creates a JOB_POSTINGS entry)
 *
 * Body:
 * - relationship: string (e.g. "Hiring Manager", "Recruiter")
 * - canRefer: boolean
 * - insights: { dayToDay, teamCulture, idealCandidate, insiderInsights }
 */
export async function sponsorJob(
  jobId: string,
  data: {
    relationship?: string;
    canRefer?: boolean;
    insights?: {
      dayToDay?: string;
      teamCulture?: string;
      idealCandidate?: string;
      insiderInsights?: string;
    };
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
 * 📋 Get My Jobs (Sponsor)
 * Return all jobs owned by the authenticated sponsor (active and inactive)
 * Uses GET /api/jobs/mine/
 */
export async function getMyJobs(): Promise<{
  jobs: Array<{
    JOB_ID: string;
    SPONSOR_ID: string;
    TITLE: string;
    COMPANY: string;
    LOCATION: string;
    DESCRIPTION: string;
    SALARY_MIN: number | null;
    SALARY_MAX: number | null;
    SALARY_CURRENCY: string | null;
    REQUIREMENTS: string;
    EXPERIENCE_LEVEL: string | null;
    EMPLOYMENT_TYPE: string | null;
    REMOTE_OPTION: boolean;
    CREATED_AT: string;
    EXPIRES_AT: string;
    IS_ACTIVE: boolean;
    RELATIONSHIP: string | null;
    CAN_REFER: boolean;
    LOGO_URL: string | null;
    LIKES_COUNT: number; // applicants who have liked this job (ACTIVE | MATCHED)
    // PR #56 — pending-only "needs your attention" count. Use this (not the
    // broader LIKES_COUNT) for the HomeView role-switcher badge so the
    // number reflects unactioned interest, not lifetime activity.
    PENDING_LIKES_COUNT: number;
    REFERENCE_JOB_ID?: string | null;
  }>;
  total_count: number;
}> {
  return api.get("/api/jobs/mine/");
}

// ============================================================
// ⏳ WAITLIST ENDPOINTS
// ============================================================

/**
 * ⏳ Join Job Waitlist
 * Add the authenticated user to the waitlist for an ATS job
 * Uses POST /api/jobs/waitlist/
 *
 * When a sponsor eventually sponsors that job, waitlisted users are
 * automatically notified and is_now_sponsored / sponsored_job_id will be
 * populated in GET /api/jobs/waitlist/mine/
 */
export async function joinWaitlist(jobId: string): Promise<{
  waitlist_id: string;
  user_id: string;
  job_id: string;
  status: "ACTIVE";
  message: string;
}> {
  return api.post("/api/jobs/waitlist/", { job_id: jobId });
}

/**
 * ⏳ Get Waitlisted Jobs
 * Return all jobs the authenticated user has waitlisted, with live sponsorship
 * status. If is_now_sponsored is true the job has been picked up by a sponsor
 * and sponsored_job_id holds the new sponsored job UUID to deep-link into.
 * Uses GET /api/jobs/waitlist/mine/
 */
export async function getWaitlistedJobs(): Promise<{
  jobs: Array<{
    waitlist_id: string;
    job_id: string;
    status: string;
    waitlisted_at: string;
    title: string;
    organization: string;
    location: string;
    employment_type: string | null;
    is_remote: boolean;
    experience_level: string | null;
    is_now_sponsored: boolean;
    sponsored_job_id: string | null;
    /**
     * Optional pass-through for the PR #62 logo pipeline — backend doesn't
     * currently SELECT this on the waitlist query, but typing it as
     * optional lets the UI light up automatically once it does.
     */
    organization_logo?: string | null;
  }>;
  total_count: number;
}> {
  return api.get("/api/jobs/waitlist/mine/");
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
  like_id: string;
  matched: boolean;
  message: string;
}> {
  return api.post(`/api/jobs/like/`, { job_id: jobId });
}

/**
 * 📋 Get Liked Jobs (Applicant)
 * Get list of jobs the applicant has liked
 */
export async function getLikedJobs(): Promise<
  Array<{
    LIKE_ID: string;
    liked_at: string;
    NOTES: string | null;
    STATUS: string;
    JOB_ID: string;
    TITLE: string;
    COMPANY: string;
    LOCATION: string | null;
    REMOTE_OPTION: boolean;
    SALARY_MIN: number | null;
    SALARY_MAX: number | null;
    SALARY_CURRENCY: string | null;
    EXPERIENCE_LEVEL: string | null;
    DESCRIPTION: string | null;
    // ATS-enriched fields (PR #41). KEY_SKILLS/BENEFITS arrive as JSON strings
    // when sourced from silver_jobs (JSONB::TEXT cast); already-arrays otherwise.
    KEY_SKILLS: string | string[] | null;
    BENEFITS: string | string[] | null;
    RESPONSIBILITIES: string | null;
    WORK_ARRANGEMENT: string | null;
    SPONSOR_FIRST_NAME: string | null;
    SPONSOR_LAST_NAME: string | null;
    SPONSOR_PHOTO_URL: string | null;
    SPONSOR_JOB_TITLE: string | null;
  }>
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
    // JOB_ID is the role the sponsor liked the applicant FOR (sponsors can
    // toggle which sponsored role the deck represents via the job-switcher
    // on HomeView). JOB_TITLE/JOB_COMPANY arrive once BACKEND_CHANGES_NEEDED.md
    // §4 ships — until then they may be missing.
    JOB_ID?: string;
    JOB_TITLE?: string | null;
    JOB_COMPANY?: string | null;
  }>
> {
  return api.get("/api/likes/profiles/received/");
}

/**
 * 💚 Like Back an Interested Sponsor (Applicant)
 * The applicant accepts a sponsor's one-sided interest, which creates a
 * mutual match (the backend resolves which of the sponsor's jobs to match on).
 * Backend endpoint: POST /api/likes/profiles/received/<like_id>/accept/ (PR #45)
 *
 * On `matched: true`, `message` is a context-aware string like
 * "It's a match! You've been connected for Senior Engineer" — surface it to
 * the user verbatim instead of constructing one client-side.
 */
export async function likeBackSponsor(likeId: string): Promise<{
  matched: boolean;
  like_id?: string;
  job_id?: string;
  message: string;
}> {
  return api.post(`/api/likes/profiles/received/${likeId}/accept/`);
}

/**
 * 💙 Like a Profile (Sponsor swipe right)
 * Record sponsor's interest in an applicant profile
 */
export async function likeProfile(
  applicantUserId: string,
  jobId?: string,
): Promise<{
  like_id: string;
  matched: boolean;
  message: string;
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
 * Get list of mutual matches for applicant.
 * Backend returns flat UPPERCASE fields (PostgreSQL, PR #25).
 * SPONSOR_USER_ID is present as of April 2026 — used to fetch the sponsor's
 * public profile for the Key Insights modal in MatchesView.
 */
export async function getMatches(): Promise<{
  job_matches?: Array<{
    LIKE_ID: string;
    matched_at: string;
    JOB_ID: string;
    TITLE: string;
    COMPANY: string;
    LOCATION: string | null;
    SPONSOR_USER_ID: string; // sponsor's user_id — used by getPublicProfile()
    SPONSOR_FIRST_NAME: string | null;
    SPONSOR_LAST_NAME: string | null;
    SPONSOR_PHOTO_URL: string | null;
    SPONSOR_JOB_TITLE: string | null;
    SPONSOR_COMPANY: string | null;
    sponsor_username?: string;
    sponsor_email?: string;
  }>;
  profile_matches?: Array<{
    LIKE_ID: string;
    matched_at: string;
    JOB_ID: string;
    TITLE: string;
    COMPANY: string;
    LOCATION: string | null;
    SPONSOR_USER_ID: string;
    SPONSOR_FIRST_NAME: string | null;
    SPONSOR_LAST_NAME: string | null;
    SPONSOR_PHOTO_URL: string | null;
    SPONSOR_JOB_TITLE: string | null;
    SPONSOR_COMPANY: string | null;
    sponsor_username?: string;
    sponsor_email?: string;
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
    LIKE_ID: string;
    matched_at: string;
    applicant_user_id: string;
    JOB_ID: string;
    TITLE: string;
    COMPANY: string;
    LOCATION: string | null;
    FIRST_NAME: string | null;
    LAST_NAME: string | null;
    PHOTO_URL: string | null;
    APPLICANT_LOCATION: string | null;
    SKILLS: string | null;
    POSITIONS: string | null;
    INDUSTRY: string | null;
    RESUME_DATA: string | null;
  }>;
}> {
  return api.get(`/api/matches/sponsor/`);
}

// ============================================================
// 💬 MESSAGING ENDPOINTS
// ============================================================

/**
 * 💬 Get Conversations
 * List all conversations for the authenticated user.
 * Backend returns UPPERCASE field names (PostgreSQL, PR #25).
 * Supports pagination (PR #22): limit (default 20) and offset (default 0).
 */
export async function getConversations(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: Array<{
    CONVERSATION_ID: string;
    JOB_ID: string;
    APPLICANT_USER_ID: string;
    SPONSOR_USER_ID: string;
    STATUS: string;
    APPLICANT_HAS_UNREAD: boolean;
    SPONSOR_HAS_UNREAD: boolean;
    APPLICANT_FIRST_NAME: string;
    APPLICANT_LAST_NAME: string;
    SPONSOR_FIRST_NAME: string;
    SPONSOR_LAST_NAME: string;
    TITLE: string;
    // Enriched fields from server-side JOIN (last message + participant details)
    LAST_BODY: string | null;
    LAST_AT: string | null;
    SPONSOR_PHOTO_URL: string | null;
    APPLICANT_PHOTO_URL: string | null;
    SPONSOR_JOB_TITLE: string | null;
    SPONSOR_COMPANY: string | null;
    COMPANY: string | null;
    APPLICANT_POSITIONS: string | null; // JSON-encoded string array
  }>;
  total_count: number;
  limit?: number;
  offset?: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params?.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  const qs = queryParams.toString();
  return api.get(`/api/messages/conversations/${qs ? `?${qs}` : ""}`);
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
    SENDER_USER_ID: string;
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
  USERNAME: string;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  ROLE_TYPE: string;
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
  /** ISO 8601 timestamp — server returns only rows created strictly after this. */
  since?: string;
}): Promise<{
  notifications: Array<{
    NOTIFICATION_ID: string;
    USER_ID: string;
    TYPE:
      | "match"
      | "message"
      | "referral"
      | "job_like"
      | "waitlist"
      | "sponsor_request"
      | "connection"
      | "profile_update"
      | string;
    TITLE: string;
    BODY: string;
    IS_READ: boolean;
    RELATED_USER_ID: string | null;
    RELATED_JOB_ID: string | null;
    RELATED_CONVERSATION_ID: string | null;
    CREATED_AT: string;
    // Denormalized metadata from PR #43 — backend resolves these via LEFT JOIN
    // so we don't need N+1 lookups to render richer notification cards.
    RELATED_USER_NAME: string | null;
    RELATED_USER_PHOTO_URL: string | null;
    RELATED_JOB_TITLE: string | null;
    RELATED_JOB_COMPANY: string | null;
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
  if (params?.since !== undefined) {
    queryParams.append("since", params.since);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/notifications/?${queryString}`
    : "/api/notifications/";

  return api.get(endpoint);
}

/**
 * 🔔 Delete a Notification (PR #43)
 * Hard-deletes a single notification owned by the authenticated user.
 */
export async function deleteNotification(notificationId: string): Promise<{
  message: string;
}> {
  return api.delete(`/api/notifications/${notificationId}/`);
}

/**
 * 🔔 Clear Read Notifications (PR #43)
 * Bulk-delete all the authenticated user's already-read notifications.
 * Requires `?only=read` — backend returns 400 without it.
 */
export async function clearReadNotifications(): Promise<{
  deleted_count: number;
}> {
  return api.delete("/api/notifications/clear/?only=read");
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

// ============================================================
// 📄 RESUME ENDPOINTS
// ============================================================

/**
 * 📄 Save Resume JSON
 * Persist a structured resume data object for the authenticated user.
 * Uses POST /api/resume/
 *
 * This does NOT extract or classify — it just stores the JSON blob.
 * Call uploadAndParseResume to extract text, then classifyResume to
 * populate the applicant profile fields automatically.
 */
export async function addResume(resumeData: object): Promise<{
  message: string;
}> {
  return api.post("/api/resume/", { resume_data: resumeData });
}

/**
 * 📄 Update Resume Fields
 * Merge partial fields into the stored resume_data object.
 * Uses PATCH /api/resume/update/
 */
export async function updateResumeField(data: object): Promise<{
  message: string;
  updated_fields: string[];
  resume_data: any;
}> {
  return api.patch("/api/resume/update/", data);
}

/**
 * 📄 Get Extracted Resume Text
 * Return the raw text extracted from the user's last uploaded resume file.
 * Uses GET /api/resume/extracted-text/
 */
export async function getExtractedResumeText(): Promise<{
  extracted_resume_text: string | null;
  updated_at: string | null;
  message: string;
}> {
  return api.get("/api/resume/extracted-text/");
}

/**
 * 📄 Classify Resume into Profile Fields
 * Ask the AI to read the stored extracted resume text and auto-populate
 * applicant profile fields (skills, positions, experience, education, etc.).
 * Uses POST /api/resume/classify/
 *
 * Call this after uploadAndParseResume so extracted text is already stored.
 */
export async function classifyResume(signal?: AbortSignal): Promise<{
  classified_data: any;
  applicant_fields_updated: string[];
  user_fields_updated: string[];
  message: string;
}> {
  return api.post("/api/resume/classify/", undefined, false, signal);
}

// ============================================================
// 📁 FILE & IMAGE UPLOAD ENDPOINTS
// ============================================================

/**
 * 🖼️ Upload Profile Image
 * Upload a profile photo to DigitalOcean Spaces CDN.
 * Uses POST /api/upload/image/ (multipart, field name: "image")
 *
 * After a successful upload, call updateGeneralProfile({ photo_url: cdn_url })
 * to persist the new URL on the user's profile.
 *
 * Usage:
 *   const form = new FormData();
 *   form.append("image", { uri, name: "photo.jpg", type: "image/jpeg" } as any);
 *   const { cdn_url } = await uploadProfileImage(form);
 *   await updateGeneralProfile({ photo_url: cdn_url });
 */
export async function uploadProfileImage(formData: FormData): Promise<{
  image_id: string;
  cdn_url: string; // always returned — DigitalOcean Spaces public CDN URL
  filename: string;
  file_size: number;
  content_type: string;
  message: string;
}> {
  // Multipart upload — must NOT send Content-Type: application/json,
  // so we bypass the ApiClient and call fetch directly.
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/api/upload/image/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error ||
        errorData?.detail ||
        `Image upload failed: ${response.status}`,
    );
  }
  return response.json();
}

/**
 * 📄 Upload & Parse Resume File
 * Upload a resume file (PDF/DOCX), extract its text, and store it in one step.
 * Uses POST /api/upload-and-parse/ (multipart, field name: "file")
 *
 * After this succeeds, call classifyResume() to auto-populate applicant
 * profile fields from the extracted text.
 *
 * Usage:
 *   const form = new FormData();
 *   form.append("file", { uri, name: "resume.pdf", type: "application/pdf" } as any);
 *   await uploadAndParseResume(form);
 *   await classifyResume();
 */
export async function uploadAndParseResume(
  formData: FormData,
  signal?: AbortSignal,
): Promise<{
  message: string;
  extracted_text: string | null; // null when Snowflake Cortex fails to parse
  parsing_error?: string | null; // present on parse failure
}> {
  // Multipart upload — must NOT send Content-Type: application/json.
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/api/upload-and-parse/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    signal,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error ||
        errorData?.detail ||
        `Resume upload failed: ${response.status}`,
    );
  }
  return response.json();
}

// ============================================================
// 🔐 AUTH — ACCOUNT MANAGEMENT
// ============================================================

/**
 * 🔐 Change Email
 * Request an email address change for the authenticated user.
 * Uses POST /api/auth/change-email/
 *
 * Backend requires both new_email and password for security.
 * Returns 501 until the backend verification flow is implemented.
 */
export async function changeEmail(
  newEmail: string,
  password: string,
): Promise<{ message: string }> {
  return api.post("/api/auth/change-email/", {
    new_email: newEmail,
    password,
  });
}

/**
 * 🔐 Change Password
 * Change password for the authenticated user.
 * Uses POST /api/profile/change-password/
 *
 * Backend accepts both old_password/new_password (snake_case)
 * and oldPassword/newPassword (camelCase).
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return api.post("/api/profile/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

/**
 * 🔐 Deactivate Account
 * Permanently deactivate the authenticated user's account.
 * Uses POST /api/profile/deactivate/
 */
export async function deactivateAccount(): Promise<{ message: string }> {
  return api.post("/api/profile/deactivate/");
}

// ============================================================
// 📊 FEED TRACKING ENDPOINTS
// ============================================================

/**
 * 📊 Record Job Feed Action
 * Track that the user saw / liked / passed on a job card.
 * Uses POST /api/jobs/feed/record/
 *
 * @param jobId  - ID of the job card that was acted on
 * @param action - "liked" | "passed" | "viewed"
 */
export async function recordJobFeedAction(
  jobId: string,
  action: string,
): Promise<{ message: string }> {
  return api.post("/api/jobs/feed/record/", { job_id: jobId, action });
}

/**
 * 📊 Record Profile Feed Action
 * Track that the sponsor saw / liked / passed on a profile card.
 * Uses POST /api/profiles/feed/record/
 *
 * @param jobId           - Sponsor's active job context
 * @param applicantUserId - Profile that was acted on
 * @param action          - "liked" | "passed" | "viewed"
 */
export async function recordProfileFeedAction(
  jobId: string,
  applicantUserId: string,
  action: string,
): Promise<{ message: string }> {
  return api.post("/api/profiles/feed/record/", {
    job_id: jobId,
    applicant_user_id: applicantUserId,
    action,
  });
}

// ============================================================
// 💼 JOB MANAGEMENT
// ============================================================

/**
 * 💼 Apply to a Job (Applicant)
 * Submit an application for a sponsored job.
 * Uses POST /api/jobs/<job_id>/apply/
 */
export async function applyToJob(jobId: string): Promise<{
  application_id: string;
  job_id: string;
  job_title: string;
  company: string;
  matched: boolean;
  message: string;
}> {
  return api.post(`/api/jobs/${jobId}/apply/`);
}

/**
 * 📥 Get Sponsor Requests (Sponsor) — PR #57
 * List active sponsor-requests targeting the authenticated sponsor. Source of
 * truth is `matching.sponsor_requests`, not notifications — survives the
 * sponsor deleting or marking-read the request's notification on the
 * Notifications screen. Use this instead of filtering /api/notifications/.
 *
 * Uses GET /api/jobs/sponsor-requests/
 */
export async function getSponsorRequests(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  requests: Array<{
    REQUEST_ID: string;
    APPLICANT_USER_ID: string;
    JOB_ID: string;
    COMPANY: string;
    STATUS: string;
    CREATED_AT: string;
    FIRST_NAME: string | null;
    LAST_NAME: string | null;
    PHOTO_URL: string | null;
    JOB_TITLE: string | null;
    JOB_COMPANY: string | null;
  }>;
  total_count: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params?.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  const qs = queryParams.toString();
  return api.get(
    qs ? `/api/jobs/sponsor-requests/?${qs}` : "/api/jobs/sponsor-requests/",
  );
}

/**
 * 📣 Request a Sponsor for a Job (Applicant)
 * Notifies sponsors at the job's company and asks them to sponsor this
 * role. Idempotent — repeat requests for the same (user, job) are deduped
 * server-side and return notified_count: 0.
 *
 * Uses POST /api/jobs/<job_id>/request-sponsor/ (PR #44).
 *
 * The `message` is context-aware (count of sponsors notified, "already has
 * a sponsor", "no sponsors at company yet", duplicate request, etc.) —
 * surface it to the user verbatim.
 */
export async function requestSponsorForJob(jobId: string): Promise<{
  job_id: string;
  notified_count: number;
  message: string;
}> {
  return api.post(`/api/jobs/${jobId}/request-sponsor/`);
}

/**
 * 💼 Create Job (Sponsor)
 * Create a new sponsored job posting.
 * Uses POST /api/jobs/create/
 */
export async function createJob(data: {
  title: string;
  company: string;
  location?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  requirements?: string;
  experience_level?: string;
  employment_type?: string;
  remote_option?: boolean;
  relationship?: string;
  can_refer?: boolean;
}): Promise<{
  job_id: string;
  title: string;
  company: string;
  message: string;
  expires_at: string;
}> {
  return api.post("/api/jobs/create/", data);
}

/**
 * 💼 Create Job From URL (Sponsor)
 * Submit a job-posting URL with scraped content + sponsor's BackChannel insights.
 * Backend resolves the URL into a structured posting, then creates the sponsored job.
 *
 * Backend behavior (PR #40, 2026-05-05):
 *  - When `structured` is present (with at least `title` + `company`), backend
 *    maps fields directly → response `source === "structured"`.
 *  - Otherwise it falls back to Anthropic Claude over `rawText` to extract
 *    fields → response `source === "llm"`. The LLM path is throttled to
 *    10 requests/hour per user; expect HTTP 429 once exceeded.
 *
 * Uses POST /api/jobs/create-from-url/
 */
export async function createJobFromUrl(data: {
  url: string;
  structured: Record<string, string | null> | null;
  rawText: string;
  insights: {
    dayToDay: string;
    teamCulture: string;
    idealCandidate: string;
    insiderInsights: string;
  };
}): Promise<{
  job_id: string;
  title: string;
  company: string;
  /** The job listing URL the backend persisted as the canonical apply link. */
  url: string;
  /**
   * How the backend filled in the job's structured fields:
   *  - "structured": JSON-LD / og: tags from the scraped page were sufficient.
   *  - "llm": Anthropic Claude extracted fields from `rawText`. Worth surfacing
   *    a "review before publishing" hint to the sponsor when source === "llm",
   *    since LLM extraction is fuzzier than JSON-LD.
   */
  source: "structured" | "llm";
  message: string;
  expires_at: string;
}> {
  return api.post("/api/jobs/create-from-url/", data);
}

/**
 * 💼 Update Job (Sponsor)
 * Edit a sponsored job posting the authenticated sponsor owns.
 * Uses PATCH /api/jobs/<job_id>/edit/
 */
export async function updateJob(
  jobId: string,
  data: {
    title?: string;
    company?: string;
    location?: string;
    description?: string;
    salary_min?: number;
    salary_max?: number;
    requirements?: string;
    experience_level?: string;
    employment_type?: string;
    remote_option?: boolean;
    /**
     * PR #62 — sponsor-overridable company logo URL. Must be a valid
     * http/https URL, max 2000 chars. Backend returns 400 on invalid URL.
     * Pass an empty string to clear the override (falls back to the
     * auto-resolved Logo.dev URL).
     */
    logo_url?: string;
  },
): Promise<{ message: string; updated_fields: string[] }> {
  return api.patch(`/api/jobs/${jobId}/edit/`, data);
}

/**
 * 💼 Deactivate Job (Sponsor)
 * Deactivate a sponsored job posting (hides it from the applicant feed).
 * Uses POST /api/jobs/<job_id>/deactivate/
 */
export async function deactivateJob(jobId: string): Promise<{
  message: string;
}> {
  return api.post(`/api/jobs/${jobId}/deactivate/`);
}

/**
 * 🗑️ Unsponsor Job (Sponsor)
 * Permanently removes a sponsored job posting (hard delete).
 * Unlike deactivateJob (soft-delete), unsponsor allows re-sponsoring the same ATS listing later.
 * Uses DELETE /api/jobs/<job_id>/unsponsor/
 *
 * `reason` is sent as a JSON body field per PR #58 — backend reads
 * `request.data.get('reason')` (max 500 chars, truncated server-side) and
 * persists it to `jobs.unsponsor_audit`. When the caller's UI also collected
 * free-text detail (the "other" path), we concatenate it onto the reason so
 * the analytics row still bucket-sorts on the categorical prefix while
 * keeping the user's note. Both args are optional; callers that omit them
 * (e.g. the job-detail screen's "Remove Sponsorship" button) still work.
 */
export async function unsponsorJob(
  jobId: string,
  reason?: string,
  reasonDetail?: string,
): Promise<{
  message: string;
}> {
  let finalReason = reason;
  if (reason === "other" && reasonDetail && reasonDetail.trim()) {
    finalReason = `other: ${reasonDetail.trim()}`.slice(0, 500);
  }
  return api.delete(
    `/api/jobs/${jobId}/unsponsor/`,
    finalReason ? { reason: finalReason } : undefined,
  );
}

/**
 * 👥 Get Applicants Who Liked a Job (Sponsor)
 * Returns all applicant profiles who liked a specific sponsored job.
 * Uses GET /api/jobs/<job_id>/likes/applicants/
 *
 * Field shape matches the SQL in
 * bc_microservices/queries/likes.py:get_applicants_who_liked_job —
 * APPLICANT_USER_ID is the user id (aliased from `l.USER_ID`), and
 * SKILLS / POSITIONS / RESUME_DATA come back as JSON-encoded TEXT strings,
 * so the caller has to parse them defensively.
 */
export async function getJobApplicantsLikes(jobId: string): Promise<{
  job_id: string;
  applicants: Array<{
    APPLICANT_USER_ID: string;
    LIKED_AT: string;
    STATUS: "ACTIVE" | "MATCHED";
    FIRST_NAME: string | null;
    LAST_NAME: string | null;
    LOCATION: string | null;
    ROLE_TYPE: string | null;
    PHOTO_URL: string | null;
    SKILLS: string | null;
    POSITIONS: string | null;
    INDUSTRY: string | null;
    RESUME_DATA: string | null;
  }>;
}> {
  return api.get(`/api/jobs/${jobId}/likes/applicants/`);
}

// ============================================================
// 🔔 DEVICE TOKEN ENDPOINTS (Push Notifications)
// ============================================================

/**
 * 🔔 Register Device Token
 * Register a push notification device token for the authenticated user.
 * Uses POST /api/devices/register/
 *
 * @param token    - Expo / APNs / FCM push token
 * @param platform - "ios" | "android" | "web"
 */
export async function registerDevice(
  deviceToken: string,
  platform: "ios" | "android" | "expo",
): Promise<{ token_id: string; message: string }> {
  return api.post("/api/devices/register/", {
    device_token: deviceToken,
    platform,
  });
}

/**
 * 🔔 Unregister Device Token
 * Deactivate a push notification device token (on logout / app uninstall).
 * Uses POST /api/devices/unregister/ — token is marked inactive, not deleted.
 */
export async function unregisterDevice(
  deviceToken: string,
): Promise<{ message: string }> {
  return api.post("/api/devices/unregister/", { device_token: deviceToken });
}

// ============================================================
// 🤝 REFERRAL ENDPOINTS
// ============================================================

/**
 * 🤝 Submit Referral (Sponsor)
 * Sponsor submits a referral for an applicant they matched with.
 * Uses POST /api/referrals/submit/
 */
export async function submitReferral(data: {
  applicant_user_id: string;
  job_id: string;
  confidence_checks?: Record<string, boolean>;
  referral_note?: string;
}): Promise<{
  referral_id: string;
  status: string;
  message: string;
}> {
  return api.post("/api/referrals/submit/", data);
}

/**
 * 🤝 List Referrals
 * Get all referrals for the authenticated user.
 * Uses GET /api/referrals/
 */
export async function listReferrals(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  referrals: Array<{
    REFERRAL_ID: string;
    JOB_ID: string;
    APPLICANT_USER_ID: string;
    SPONSOR_USER_ID: string;
    STATUS: string;
    CONFIDENCE_CHECKS: Record<string, boolean> | null;
    REFERRAL_NOTE: string | null;
    CREATED_AT: string;
    UPDATED_AT: string;
    SPONSOR_FIRST_NAME: string | null;
    SPONSOR_LAST_NAME: string | null;
    SPONSOR_PHOTO_URL: string | null;
    APPLICANT_FIRST_NAME: string | null;
    APPLICANT_LAST_NAME: string | null;
    APPLICANT_PHOTO_URL: string | null;
    JOB_TITLE: string | null;
    JOB_COMPANY: string | null;
  }>;
  total_count: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit !== undefined)
    queryParams.append("limit", String(params.limit));
  if (params?.offset !== undefined)
    queryParams.append("offset", String(params.offset));
  const qs = queryParams.toString();
  return api.get(qs ? `/api/referrals/?${qs}` : "/api/referrals/");
}

/**
 * 🤝 Get Referral Detail
 * Get full details for a single referral by ID.
 * Uses GET /api/referrals/<referral_id>/
 */
export async function getReferralDetail(referralId: string): Promise<{
  REFERRAL_ID: string;
  JOB_ID: string;
  APPLICANT_USER_ID: string;
  SPONSOR_USER_ID: string;
  STATUS: string;
  CONFIDENCE_CHECKS: Record<string, boolean> | null;
  REFERRAL_NOTE: string | null;
  CREATED_AT: string;
  UPDATED_AT: string;
  SPONSOR_FIRST_NAME: string | null;
  SPONSOR_LAST_NAME: string | null;
  APPLICANT_FIRST_NAME: string | null;
  APPLICANT_LAST_NAME: string | null;
  JOB_TITLE: string | null;
  JOB_COMPANY: string | null;
}> {
  return api.get(`/api/referrals/${referralId}/`);
}

/**
 * 🤝 Withdraw Referral (Sponsor)
 * Withdraw a previously submitted referral.
 * Uses PATCH /api/referrals/<referral_id>/withdraw/
 * (NOT DELETE — the API contract specifies PATCH for this endpoint)
 */
export async function withdrawReferral(referralId: string): Promise<{
  message: string;
  status: string;
}> {
  return api.patch(`/api/referrals/${referralId}/withdraw/`);
}

/**
 * Backend referral pipeline stage enums (PR #37).
 * The applicant and sponsor sides share the first 6 stages but diverge on the
 * "ended" terminal value — applicants send "Didn't move forward", sponsors send
 * "No Longer Active". Sending the wrong one for the role yields a 400.
 */
export const APPLICANT_CHECKIN_STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
  "Didn't move forward",
] as const;
export type ApplicantCheckInStage = (typeof APPLICANT_CHECKIN_STAGES)[number];

export const SPONSOR_CHECKIN_STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
  "No Longer Active",
] as const;
export type SponsorCheckInStage = (typeof SPONSOR_CHECKIN_STAGES)[number];

/**
 * 📍 Submit Referral Check-In (Applicant)
 * Records a new pipeline stage update for a referral the user is the applicant on.
 * Note is optional, max 500 chars.
 * Uses POST /api/referrals/<referral_id>/checkin/
 */
export async function submitApplicantCheckIn(
  referralId: string,
  stage: ApplicantCheckInStage,
  note?: string,
): Promise<{
  checkin_id: string;
  stage: string;
  message: string;
}> {
  const body: { stage: string; note?: string } = { stage };
  if (note && note.trim()) body.note = note.trim().slice(0, 500);
  return api.post(`/api/referrals/${referralId}/checkin/`, body);
}

/**
 * 📍 Batch Submit Referral Check-Ins (Sponsor)
 * Sponsor updates pipeline stages on multiple referrals at once. Max 50/request.
 * Uses POST /api/referrals/checkin/batch/
 */
export async function submitSponsorBatchCheckIn(
  updates: Array<{ referral_id: string; stage: SponsorCheckInStage }>,
): Promise<{
  checkin_ids: string[];
  count: number;
  message: string;
}> {
  return api.post(`/api/referrals/checkin/batch/`, { updates });
}

/**
 * 📜 Check-In History (Applicant or Sponsor)
 * Returns the full immutable check-in timeline for a referral.
 * Uses GET /api/referrals/<referral_id>/checkins/
 */
export async function getCheckInHistory(referralId: string): Promise<{
  checkins: Array<{
    CHECKIN_ID: string;
    REFERRAL_ID: string;
    SUBMITTED_BY: string;
    ROLE: "Applicant" | "Sponsor";
    STAGE: string;
    NOTE: string | null;
    CREATED_AT: string;
  }>;
}> {
  return api.get(`/api/referrals/${referralId}/checkins/`);
}

/**
 * 👤 Update User Profile (General Fields)
 * PATCH /api/profile/update/
 * Accepted fields: first_name, last_name, phone_number, portfolio_url,
 *                  bio, street, city, state, zip, country, location, photo_url,
 *                  date_of_birth, international_code, notification_preferences
 */
export async function updateUserProfile(data: Record<string, any>): Promise<{
  message: string;
  updated_fields: string[];
}> {
  return api.patch("/api/profile/update/", data);
}
