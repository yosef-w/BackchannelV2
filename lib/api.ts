import { useAuthStore } from "@/stores/useAuthStore";
import type { AutofillRequest, AutofillResponse } from "@/types/autofill";

export const API_BASE_URL = "https://oyster-app-4pg5w.ondigitalocean.app";

/**
 * 🌐 API Client with automatic auth header injection
 */
class ApiClient {
  private baseUrl: string;

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] Error from ${endpoint}:`, errorData);
      throw new Error(errorData?.detail || `API Error: ${response.status}`);
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
  return api.get<any[]>("/api/jobs/pack/");
}
