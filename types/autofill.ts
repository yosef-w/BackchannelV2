/**
 * Type definitions for AI-powered autofill API
 */

// ============ REQUEST TYPES ============

export interface FormField {
  id: string; // Unique identifier for re-injection
  fieldType:
    | "text"
    | "textarea"
    | "select"
    | "radio"
    | "checkbox"
    | "date"
    | "file"
    | "email"
    | "tel"
    | "number"
    | "url";
  label: string; // The visible label/question text
  name?: string; // HTML name attribute
  placeholder?: string;
  required: boolean;
  currentValue?: string; // Any pre-filled value
  options?: string[]; // For select/radio/checkbox fields
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  htmlSelector?: string; // CSS selector or XPath for re-injection
  context?: string; // Additional context (e.g., help text, section name)
}

export interface JobContext {
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription?: string; // If available
  department?: string;
  location?: string;
  employmentType?: string; // Full-time, Part-time, Contract, etc.
}

export interface ApplicationMetadata {
  appVersion: string;
  timestamp: string;
  userId: string;
  sessionId?: string;
}

export interface UserData {
  personal: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    linkedin?: string;
    portfolio?: string;
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
    desiredSalary?: string;
    availableStartDate?: string;
    targetIndustry?: string;
    experiences: Array<{
      jobTitle: string;
      company: string;
      startDate: string;
      endDate: string;
      current: boolean;
      description: string;
    }>;
  };
  education: {
    degree: string;
    major: string;
    university: string;
    graduationYear: string;
    gpa?: string;
    entries: Array<{
      degree: string;
      major: string;
      university: string;
      graduationYear: string;
      gpa?: string;
    }>;
  };
  preferences: {
    workAuthorization: string;
    willingToRelocate: string;
    requiresSponsorship: string;
    securityClearance?: string;
  };
  demographics?: {
    gender?: string;
    ethnicity?: string;
    veteran?: string;
    disability?: string;
  };
  skills: string[];
  certifications: Array<{
    name: string;
    organization: string;
    year: string;
  }>;
  languages: Array<{
    language: string;
    proficiency: string;
  }>;
  achievements?: string;
  resumeText?: string; // Parsed resume content for AI context
}

export interface AutofillRequest {
  userData: UserData;
  formFields: FormField[];
  jobContext: JobContext;
  metadata: ApplicationMetadata;
}

// ============ RESPONSE TYPES ============

export interface FieldAnswer {
  fieldId: string; // Matches formFields[].id from request
  value: string | string[]; // Single value or array for checkboxes
  confidence: number; // 0-1, how confident the AI is
  reasoning?: string; // Optional: why this answer was chosen
}

export interface UnfilledField {
  fieldId: string;
  reason: string; // Why it couldn't be filled
}

export interface AutofillSuggestions {
  coverLetterDraft?: string;
  tailoredSummary?: string; // Job-specific summary
  skillsToHighlight?: string[];
}

export interface AutofillResponseMetadata {
  processingTime: number; // milliseconds
  aiModel: string;
  timestamp: string;
}

export interface AutofillResponse {
  success: boolean;
  fieldAnswers: FieldAnswer[];
  unfilledFields?: UnfilledField[];
  suggestions?: AutofillSuggestions;
  metadata: AutofillResponseMetadata;
}

// ============ WEBVIEW MESSAGE TYPES ============

export interface WebViewMessage {
  type: "FORM_FIELDS_SCRAPED" | "AUTOFILL_COMPLETE" | "AUTOFILL_ERROR";
  data: any;
}

export interface ScrapedFormData {
  fields: FormField[];
  formCount: number;
  pageTitle: string;
}
