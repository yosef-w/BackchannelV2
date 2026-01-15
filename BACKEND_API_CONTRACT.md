# BackChannel Backend API Contract

## Overview
This document provides a comprehensive specification of all backend requirements for the BackChannel application. It includes data models, API endpoints, authentication flows, and integration requirements to support the complete user journey for both **Applicants** (job seekers) and **Sponsors** (referrers).

---

## Table of Contents
1. [Authentication & User Management](#1-authentication--user-management)
2. [User Profiles](#2-user-profiles)
3. [Job Postings](#3-job-postings)
4. [Matches & Connections](#4-matches--connections)
5. [Messaging System](#5-messaging-system)
6. [Applications & Referrals](#6-applications--referrals)
7. [Notifications](#7-notifications)
8. [Feed/Discovery](#8-feeddiscovery)
9. [Search & Filtering](#9-search--filtering)
10. [File Management](#10-file-management)
11. [Analytics & Metrics](#11-analytics--metrics)

---

## 1. Authentication & User Management

### 1.1 Data Models

#### User
```typescript
{
  id: string (UUID)
  email: string (unique, required)
  password: string (hashed, required for email/password auth)
  fullName: string (required)
  userType: "applicant" | "sponsor" (required)
  
  // LinkedIn OAuth fields
  linkedInId?: string (unique)
  linkedInAccessToken?: string
  
  // Account Status
  isVerified: boolean (default: false)
  verificationToken?: string
  verificationTokenExpiry?: Date
  isActive: boolean (default: true)
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  onboardingCompleted: boolean (default: false)
}
```

#### Session
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id)
  token: string (JWT or session token)
  expiresAt: Date
  deviceInfo?: string
  ipAddress?: string
  createdAt: Date
}
```

### 1.2 API Endpoints

#### POST `/api/auth/register`
Create a new user account (email/password).

**Request Body:**
```json
{
  "fullName": "Alex Johnson",
  "email": "alex@email.com",
  "password": "SecurePass123!"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "alex@email.com",
    "fullName": "Alex Johnson",
    "userType": null,
    "onboardingCompleted": false,
    "createdAt": "2026-01-09T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-10T10:30:00Z"
}
```

#### POST `/api/auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "alex@email.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "user": { /* User object */ },
  "token": "jwt_token",
  "expiresAt": "2026-01-10T10:30:00Z"
}
```

#### POST `/api/auth/linkedin`
Authenticate or register via LinkedIn OAuth.

**Request Body:**
```json
{
  "code": "linkedin_authorization_code",
  "redirectUri": "app://backchannel/callback"
}
```

**Response:** `200 OK`
```json
{
  "user": { /* User object with linkedInId populated */ },
  "token": "jwt_token",
  "isNewUser": true
}
```

#### POST `/api/auth/logout`
Invalidate current session.

**Headers:** `Authorization: Bearer {token}`

**Response:** `204 No Content`

#### POST `/api/auth/forgot-password`
Request password reset.

**Request Body:**
```json
{
  "email": "alex@email.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset email sent"
}
```

#### POST `/api/auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass456!"
}
```

**Response:** `200 OK`

#### POST `/api/auth/change-password`
Change password for authenticated user.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response:** `200 OK`

---

## 2. User Profiles

### 2.1 Data Models

#### ApplicantProfile
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id, unique)
  
  // Basic Info
  phoneNumber?: string
  location?: string // "San Francisco, CA"
  bio?: string // Profile summary
  profileImageUrl?: string
  
  // Professional Info
  currentRole?: string // "Senior Software Engineer"
  seekingRole?: string // "Lead Product Manager"
  targetIndustry?: string // "Technology"
  yearsExperience?: number
  
  // Skills & Expertise
  skills: string[] // ["React", "Node.js", "Product Strategy"]
  
  // Work Preferences
  workPreferences: string[] // ["Remote", "Hybrid OK", "Startup Stage: Series A-C"]
  desiredRoles: string[] // ["Senior Product Manager", "Lead PM"]
  willingToRelocate?: boolean
  desiredSalaryMin?: number
  desiredSalaryMax?: number
  availableStartDate?: Date
  
  // Resume/Documents
  resumeUrl?: string
  portfolioUrl?: string
  linkedInUrl?: string
  websiteUrl?: string
  
  // Education
  education?: {
    degree: string // "MBA"
    major?: string // "Computer Science"
    university: string // "Stanford GSB"
    graduationYear?: string // "2020"
    gpa?: string
  }
  
  // Work Experience
  workExperience?: Array<{
    company: string
    title: string
    startDate: string // "2021-06"
    endDate?: string // "Present" or "2023-05"
    description: string
    isCurrent: boolean
  }>
  
  // Profile Insights (personality questions)
  profileInsights: Array<{
    question: string // "MY SECRET SUPERPOWER"
    answer: string // "Turning complex data into simple stories"
  }>
  
  // Metadata
  completionPercentage: number // 0-100
  createdAt: Date
  updatedAt: Date
}
```

#### SponsorProfile
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id, unique)
  
  // Basic Info
  phoneNumber?: string
  location?: string
  bio?: string
  profileImageUrl?: string
  
  // Professional Info
  currentCompany: string // "Google"
  currentRole: string // "VP of Product"
  yearsAtCompany?: string // "3-5 years"
  
  // Sponsorship Details
  isOpenToReferrals: boolean // "Yes, absolutely"
  referralHistory?: string // "Frequently" / "A few times" / "Never yet"
  companyOffersBonus?: boolean
  
  // Expertise
  expertise: string[] // ["Product Management", "Engineering Leadership"]
  companiesCanReferTo: string[] // ["Google", "Meta", "Stripe"]
  
  // Profile Insights
  profileInsights: Array<{
    question: string
    answer: string
  }>
  
  // Verification
  isVerified: boolean (default: false)
  verificationEmail?: string // "name@company.com"
  verificationStatus?: "pending" | "verified" | "rejected"
  verificationDate?: Date
  
  // Success Stories
  successfulReferrals?: number
  successRate?: number // 0-100 percentage
  
  // Metadata
  completionPercentage: number
  createdAt: Date
  updatedAt: Date
}
```

### 2.2 API Endpoints

#### POST `/api/onboarding/role`
Set user type (applicant or sponsor) during onboarding.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "userType": "applicant"
}
```

**Response:** `200 OK`
```json
{
  "userId": "uuid",
  "userType": "applicant"
}
```

#### POST `/api/onboarding/applicant`
Complete applicant questionnaire.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "targetIndustry": "Technology",
  "currentRole": "Software Engineer",
  "seekingRole": "Senior Product Lead",
  "skills": ["React", "Node.js", "Product Strategy", "Data Analytics", "UX Design"],
  "profileInsights": [
    {
      "question": "MY SECRET SUPERPOWER",
      "answer": "Turning complex data into simple, actionable stories."
    },
    {
      "question": "IF I WASN'T IN TECH",
      "answer": "I'd be a chef. Chemistry you can eat."
    }
  ],
  "resumeUrl": "https://storage.backchannel.com/resumes/abc123.pdf"
}
```

**Response:** `201 Created`
```json
{
  "profile": { /* ApplicantProfile object */ },
  "onboardingCompleted": true
}
```

#### POST `/api/onboarding/sponsor`
Complete sponsor questionnaire.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "currentCompany": "Google",
  "currentRole": "VP of Product",
  "yearsAtCompany": "3-5 years",
  "isOpenToReferrals": "Yes, absolutely",
  "referralHistory": "Frequently",
  "companyOffersBonus": true,
  "profileInsights": [
    {
      "question": "MY MENTORSHIP STYLE",
      "answer": "I believe in giving ownership and learning through doing."
    }
  ],
  "verificationEmail": "alex@google.com"
}
```

**Response:** `201 Created`
```json
{
  "profile": { /* SponsorProfile object */ },
  "onboardingCompleted": true,
  "verificationEmailSent": true
}
```

#### GET `/api/profile`
Get current user's profile.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "user": { /* User object */ },
  "profile": { /* ApplicantProfile or SponsorProfile */ },
  "stats": {
    "connections": 12,
    "referrals": 3,
    "applied": 8
  }
}
```

#### PUT `/api/profile`
Update current user's profile.

**Headers:** `Authorization: Bearer {token}`

**Request Body:** (partial update supported)
```json
{
  "bio": "Updated bio text",
  "skills": ["React", "TypeScript", "Next.js"],
  "desiredRoles": ["Senior PM", "Lead PM"]
}
```

**Response:** `200 OK`
```json
{
  "profile": { /* Updated profile object */ }
}
```

#### PUT `/api/profile/resume`
Update resume information.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "education": {
    "degree": "MBA",
    "major": "Business Administration",
    "university": "Stanford GSB",
    "graduationYear": "2020",
    "gpa": "3.9"
  },
  "workExperience": [
    {
      "company": "Spotify",
      "title": "Product Lead",
      "startDate": "2020-01",
      "endDate": "Present",
      "description": "Launched 'Discover Weekly' feature...",
      "isCurrent": true
    }
  ]
}
```

**Response:** `200 OK`

#### PUT `/api/profile/insights`
Update profile insights.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "insights": [
    {
      "question": "MY SECRET SUPERPOWER",
      "answer": "Making complex things simple"
    }
  ]
}
```

**Response:** `200 OK`

#### POST `/api/profile/verify-email`
Send verification email to sponsor's company email.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "email": "alex@google.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Verification email sent",
  "expiresAt": "2026-01-09T11:30:00Z"
}
```

#### POST `/api/profile/verify-email/confirm`
Confirm email verification.

**Request Body:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response:** `200 OK`
```json
{
  "verified": true,
  "verifiedAt": "2026-01-09T10:45:00Z"
}
```

#### GET `/api/profile/:userId`
Get another user's public profile.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "fullName": "Sarah Chen",
    "userType": "sponsor"
  },
  "profile": { /* Public profile fields only */ }
}
```

---

## 3. Job Postings

### 3.1 Data Models

#### JobPosting
```typescript
{
  id: string (UUID)
  
  // Basic Info
  title: string // "Senior Software Engineer"
  company: string // "JPMorgan Chase"
  companyLogoUrl?: string
  
  // Location & Type
  location: string // "New York, NY"
  locationType: "remote" | "hybrid" | "onsite"
  employmentType: "full-time" | "part-time" | "contract" | "internship"
  
  // Description
  description: string
  responsibilities?: string[]
  
  // Requirements
  requiredSkills: string[] // ["Java", "Spring Boot", "React"]
  preferredSkills?: string[]
  yearsExperienceMin?: number
  yearsExperienceMax?: number
  educationRequirement?: string
  
  // Compensation
  salaryMin?: number
  salaryMax?: number
  salaryDisplay?: string // "$140k - $180k"
  currency?: string // "USD"
  
  // Benefits
  benefits: string[] // ["Hybrid Work", "401k", "Health Insurance"]
  
  // External Links
  externalUrl?: string // Link to company's application portal
  
  // Status
  isActive: boolean (default: true)
  postedAt: Date
  expiresAt?: Date
  
  // Metrics
  viewCount: number (default: 0)
  applicationCount: number (default: 0)
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

#### JobSponsor
```typescript
{
  id: string (UUID)
  jobId: string (foreign key -> JobPosting.id)
  sponsorUserId: string (foreign key -> User.id)
  
  // Sponsor Details
  canRefer: boolean // Can they actually submit referral
  
  // Status
  isActive: boolean (default: true)
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### 3.2 API Endpoints

#### GET `/api/jobs`
Get list of active job postings.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `company` (string, optional)
- `location` (string, optional)
- `skills` (comma-separated string, optional)
- `employmentType` (string, optional)
- `salaryMin` (number, optional)

**Response:** `200 OK`
```json
{
  "jobs": [
    {
      "id": "uuid",
      "title": "Software Engineer",
      "company": "JPMorgan Chase",
      "location": "New York, NY",
      "employmentType": "full-time",
      "salaryDisplay": "$140k - $180k",
      "postedAt": "2026-01-07T10:00:00Z",
      "applicationCount": 24,
      "sponsorCount": 2,
      "isSponsored": false, // User has not sponsored this job
      "hasApplied": false // User has not applied
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### GET `/api/jobs/:jobId`
Get detailed job posting information.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "job": { /* Full JobPosting object */ },
  "sponsors": [
    {
      "id": "uuid",
      "name": "David Chen",
      "role": "VP of Engineering",
      "profileImageUrl": "...",
      "canRefer": true,
      "isVerified": true
    }
  ],
  "topApplicants": [ /* If user is sponsor */ 
    {
      "id": "uuid",
      "name": "Elena Torres",
      "role": "Sr ML Engineer",
      "company": "OpenAI",
      "matchScore": 98,
      "experience": "8+ Years",
      "skills": ["PyTorch", "TensorFlow", "NLP"]
    }
  ],
  "hasApplied": false,
  "isSponsored": false
}
```

#### POST `/api/jobs/:jobId/sponsor`
Sponsor a job (for sponsors to indicate they can refer for this position).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "canRefer": true
}
```

**Response:** `201 Created`
```json
{
  "jobSponsor": {
    "id": "uuid",
    "jobId": "job_uuid",
    "sponsorUserId": "user_uuid",
    "canRefer": true,
    "createdAt": "2026-01-09T10:30:00Z"
  }
}
```

#### DELETE `/api/jobs/:jobId/sponsor`
Remove sponsorship from a job.

**Headers:** `Authorization: Bearer {token}`

**Response:** `204 No Content`

#### GET `/api/jobs/:jobId/applicants`
Get applicants for a job (sponsor only).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `sortBy` (string: "matchScore" | "appliedDate", default: "matchScore")

**Response:** `200 OK`
```json
{
  "applicants": [
    {
      "id": "uuid",
      "name": "Elena Torres",
      "role": "Sr ML Engineer",
      "company": "OpenAI",
      "profileImageUrl": "...",
      "matchScore": 98,
      "experience": "8+ Years",
      "skills": ["PyTorch", "TensorFlow", "NLP"],
      "appliedAt": "2026-01-08T14:30:00Z",
      "applicationStatus": "applied" | "reviewing" | "interview_scheduled" | "offer" | "rejected",
      "insights": {
        "funFact": "Published 3 papers on transformer architectures"
      }
    }
  ],
  "pagination": { /* ... */ }
}
```

#### POST `/api/jobs/:jobId/pass`
Sponsor passes on an applicant (swipe left).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "applicantId": "uuid"
}
```

**Response:** `200 OK`

#### POST `/api/jobs/:jobId/interested`
Sponsor expresses interest in an applicant (swipe right).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "applicantId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "match": true, // If applicant also interested
  "conversation": { /* Conversation object if match */ }
}
```

---

## 4. Matches & Connections

### 4.1 Data Models

#### Connection
```typescript
{
  id: string (UUID)
  
  // Participants
  applicantId: string (foreign key -> User.id)
  sponsorId: string (foreign key -> User.id)
  
  // Connection Context
  jobId?: string (foreign key -> JobPosting.id)
  
  // Status
  status: "pending" | "connected" | "referred" | "rejected"
  initiatedBy: "applicant" | "sponsor"
  
  // Match Score
  matchScore?: number // 0-100
  
  // Timestamps
  connectedAt?: Date
  lastInteractionAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

#### ConnectionInterest
```typescript
{
  id: string (UUID)
  connectionId: string (foreign key -> Connection.id)
  userId: string (foreign key -> User.id)
  
  // Interest Type
  interestedIn: "applicant" | "sponsor"
  interest: "pass" | "interested"
  
  // Metadata
  createdAt: Date
}
```

### 4.2 API Endpoints

#### GET `/api/matches`
Get all matches/connections for current user.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (string: "pending" | "connected" | "referred", optional)
- `page` (number)
- `limit` (number)

**Response:** `200 OK`
```json
{
  "matches": [
    {
      "id": "uuid",
      "profile": {
        "id": "uuid",
        "name": "Sarah Chen",
        "role": "Senior PM",
        "company": "Google",
        "profileImageUrl": "...",
        "experience": "8+ Years",
        "skills": ["Product Vision", "Agile", "SQL"]
      },
      "status": "connected",
      "matchScore": 95,
      "jobContext": {
        "jobId": "uuid",
        "jobTitle": "Lead Product Strategist",
        "company": "Google"
      },
      "lastMessage": "I'd be happy to refer you!",
      "lastMessageAt": "2026-01-09T09:28:00Z",
      "connectedAt": "2026-01-07T10:00:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### POST `/api/matches/connect`
Initiate connection request.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "targetUserId": "uuid",
  "jobId": "uuid", // optional
  "message": "Hi! I'd love to connect about the PM role."
}
```

**Response:** `201 Created`
```json
{
  "connection": { /* Connection object */ },
  "matched": true // If other party already expressed interest
}
```

#### POST `/api/matches/:connectionId/accept`
Accept a connection request.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### POST `/api/matches/:connectionId/reject`
Reject a connection request.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### GET `/api/matches/discover`
Get discovery feed for swiping (Tinder-style matching).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `userType` (string: "applicant" | "sponsor") - What type of users to show
- `limit` (number, default: 10)

**Response:** `200 OK`
```json
{
  "profiles": [
    {
      "id": "uuid",
      "name": "Aria Nakamura",
      "role": "VP of Design",
      "company": "ZenPay",
      "location": "Tokyo, Japan",
      "profileImageUrl": "...",
      "bio": "Minimalist designer focused on financial inclusion...",
      "matchScore": 92,
      "skills": ["UI/UX", "Figma", "Design Systems"],
      "insights": {
        "funFact": "Collects vintage typewriters from the 1920s."
      },
      "prompts": [
        {
          "question": "I'M BEST KNOWN FOR",
          "answer": "Being the 'No' person in product meetings..."
        }
      ]
    }
  ]
}
```

#### POST `/api/matches/swipe`
Record swipe action in discovery feed.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "targetUserId": "uuid",
  "action": "pass" | "interested",
  "jobId": "uuid" // optional context
}
```

**Response:** `200 OK`
```json
{
  "matched": false, // true if mutual interest
  "connection": null // Connection object if matched
}
```

---

## 5. Messaging System

### 5.1 Data Models

#### Conversation
```typescript
{
  id: string (UUID)
  connectionId: string (foreign key -> Connection.id)
  
  // Participants
  participantIds: string[] // [applicantId, sponsorId]
  
  // Status
  isActive: boolean (default: true)
  isHidden: boolean (default: false)
  
  // Metadata
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

#### Message
```typescript
{
  id: string (UUID)
  conversationId: string (foreign key -> Conversation.id)
  
  // Sender
  senderId: string (foreign key -> User.id)
  
  // Content
  content: string
  messageType: "text" | "system" | "file"
  attachmentUrl?: string
  attachmentType?: string // "pdf", "image", etc.
  
  // Status
  isRead: boolean (default: false)
  readAt?: Date
  isDeleted: boolean (default: false)
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### 5.2 API Endpoints

#### GET `/api/conversations`
Get all conversations for current user.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `includeHidden` (boolean, default: false)
- `page` (number)
- `limit` (number)

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "id": "uuid",
      "otherParticipant": {
        "id": "uuid",
        "name": "Sarah Chen",
        "role": "Senior PM",
        "company": "Google",
        "profileImageUrl": "..."
      },
      "lastMessage": {
        "content": "I'd be happy to refer you!",
        "senderId": "uuid",
        "createdAt": "2026-01-09T09:28:00Z",
        "isRead": false
      },
      "unreadCount": 2,
      "jobContext": {
        "jobId": "uuid",
        "jobTitle": "Lead Product Strategist",
        "company": "Google"
      },
      "applicationStatus": "interview_scheduled",
      "createdAt": "2026-01-07T10:00:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### GET `/api/conversations/:conversationId/messages`
Get messages in a conversation.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `before` (ISO date string, optional) - Get messages before this timestamp

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "content": "Thanks for reaching out!",
      "messageType": "text",
      "isRead": true,
      "readAt": "2026-01-09T09:30:00Z",
      "createdAt": "2026-01-09T09:28:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### POST `/api/conversations/:conversationId/messages`
Send a message.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "content": "Hi! I'd love to connect about the PM role.",
  "messageType": "text",
  "attachmentUrl": "https://..." // optional
}
```

**Response:** `201 Created`
```json
{
  "message": { /* Message object */ }
}
```

#### PUT `/api/conversations/:conversationId/messages/:messageId/read`
Mark message as read.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### PUT `/api/conversations/:conversationId/read-all`
Mark all messages in conversation as read.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### PUT `/api/conversations/:conversationId/hide`
Hide a conversation.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### GET `/api/conversations/:conversationId/participant`
Get detailed info about the other participant.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "participant": {
    "id": "uuid",
    "name": "Sarah Chen",
    "role": "Senior PM",
    "company": "Google",
    "profileImageUrl": "...",
    "location": "San Francisco, CA",
    "email": "sarah.chen@gmail.com",
    "phone": "+1 (415) 555-0123",
    "linkedInUrl": "linkedin.com/in/sarahchen",
    "bio": "Product leader passionate about...",
    "skills": ["Product Vision", "Agile", "SQL"],
    "experience": "8+ Years",
    "education": "MBA, Stanford GSB"
  },
  "applicationContext": {
    "jobId": "uuid",
    "jobTitle": "Lead Product Strategist",
    "applicationStatus": "interview_scheduled",
    "appliedDate": "2026-01-02T10:00:00Z",
    "nextAction": "Interview on Jan 8 at 2pm PT"
  }
}
```

---

## 6. Applications & Referrals

### 6.1 Data Models

#### Application
```typescript
{
  id: string (UUID)
  
  // Participants
  applicantId: string (foreign key -> User.id)
  jobId: string (foreign key -> JobPosting.id)
  sponsorId?: string (foreign key -> User.id) // Sponsor who referred
  
  // Application Details
  coverLetter?: string
  resumeUrl?: string
  customAnswers?: Record<string, string> // Job-specific questions
  
  // Status
  status: "applied" | "reviewing" | "interview_scheduled" | "offer" | "rejected" | "withdrawn"
  
  // External Tracking
  externalApplicationUrl?: string // URL to company's ATS
  externalApplicationId?: string
  
  // Timeline
  appliedAt: Date
  lastStatusUpdate?: Date
  
  // Interview Details
  nextInterviewDate?: Date
  interviewNotes?: string
  
  // Offer Details
  offerAmount?: number
  offerDeadline?: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

#### ApplicationTimeline
```typescript
{
  id: string (UUID)
  applicationId: string (foreign key -> Application.id)
  
  // Stage Info
  stage: "applied" | "referred" | "screening" | "interview" | "decision"
  status: "completed" | "in_progress" | "scheduled" | "pending"
  
  // Details
  completedAt?: Date
  scheduledFor?: Date
  notes?: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

#### Referral
```typescript
{
  id: string (UUID)
  
  // Parties
  applicationId: string (foreign key -> Application.id)
  sponsorId: string (foreign key -> User.id)
  applicantId: string (foreign key -> User.id)
  jobId: string (foreign key -> JobPosting.id)
  
  // Referral Details
  referralCode?: string // Company-specific referral code
  referralNote?: string // Note from sponsor to hiring team
  
  // Status
  status: "pending" | "submitted" | "accepted" | "rejected"
  submittedAt?: Date
  
  // Outcome
  wasHired?: boolean
  bonusAmount?: number
  bonusPaidAt?: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### 6.2 API Endpoints

#### POST `/api/applications`
Submit a job application.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "jobId": "uuid",
  "sponsorId": "uuid", // optional - if applying via referral
  "coverLetter": "I am excited to apply...",
  "resumeUrl": "https://storage.backchannel.com/resumes/abc123.pdf",
  "customAnswers": {
    "question1": "Answer to custom question..."
  }
}
```

**Response:** `201 Created`
```json
{
  "application": { /* Application object */ },
  "referralCreated": true // If sponsorId was provided
}
```

#### GET `/api/applications`
Get all applications for current user.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (string, optional)
- `page` (number)
- `limit` (number)

**Response:** `200 OK`
```json
{
  "applications": [
    {
      "id": "uuid",
      "job": {
        "id": "uuid",
        "title": "Senior Product Manager",
        "company": "Google",
        "companyLogoUrl": "..."
      },
      "status": "interview_scheduled",
      "appliedAt": "2026-01-02T10:00:00Z",
      "nextAction": "Technical interview on Jan 8 at 2 PM",
      "sponsor": {
        "id": "uuid",
        "name": "Sarah Chen",
        "role": "VP of Product",
        "profileImageUrl": "..."
      },
      "timeline": [
        {
          "stage": "applied",
          "status": "completed",
          "completedAt": "2026-01-02T10:00:00Z"
        },
        {
          "stage": "referred",
          "status": "completed",
          "completedAt": "2026-01-02T10:05:00Z"
        },
        {
          "stage": "screening",
          "status": "completed",
          "completedAt": "2026-01-03T14:00:00Z"
        },
        {
          "stage": "interview",
          "status": "scheduled",
          "scheduledFor": "2026-01-08T14:00:00Z"
        }
      ]
    }
  ],
  "pagination": { /* ... */ }
}
```

#### GET `/api/applications/:applicationId`
Get detailed application information.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "application": { /* Full Application object */ },
  "job": { /* Full JobPosting object */ },
  "sponsor": { /* Sponsor profile if applicable */ },
  "timeline": [ /* Full timeline */ ]
}
```

#### PUT `/api/applications/:applicationId`
Update application (status, notes, etc.).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "status": "interview_scheduled",
  "nextInterviewDate": "2026-01-08T14:00:00Z",
  "interviewNotes": "Technical interview with team lead"
}
```

**Response:** `200 OK`

#### POST `/api/applications/:applicationId/withdraw`
Withdraw an application.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### POST `/api/referrals`
Submit a referral (sponsor referring an applicant).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "applicationId": "uuid",
  "referralNote": "This candidate has excellent product sense...",
  "referralCode": "REF-12345" // Company-specific code
}
```

**Response:** `201 Created`
```json
{
  "referral": { /* Referral object */ }
}
```

#### GET `/api/referrals`
Get all referrals (for sponsors).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (string, optional)
- `page` (number)

**Response:** `200 OK`
```json
{
  "referrals": [
    {
      "id": "uuid",
      "applicant": {
        "id": "uuid",
        "name": "Elena Torres",
        "role": "Sr ML Engineer",
        "profileImageUrl": "..."
      },
      "job": {
        "id": "uuid",
        "title": "Machine Learning Lead",
        "company": "JPMorgan Chase"
      },
      "status": "submitted",
      "submittedAt": "2026-01-02T11:00:00Z",
      "wasHired": null,
      "currentStatus": "interview_scheduled"
    }
  ],
  "pagination": { /* ... */ },
  "stats": {
    "totalReferrals": 15,
    "successfulHires": 8,
    "successRate": 53.3,
    "totalBonusEarned": 25000
  }
}
```

#### PUT `/api/referrals/:referralId`
Update referral status/outcome.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "wasHired": true,
  "bonusAmount": 5000,
  "bonusPaidAt": "2026-03-15T10:00:00Z"
}
```

**Response:** `200 OK`

---

## 7. Notifications

### 7.1 Data Models

#### Notification
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id)
  
  // Notification Details
  type: "match" | "message" | "referral" | "application_update" | "connection_request" | "interview" | "offer" | "system"
  title: string
  message: string
  
  // Associated Data
  relatedUserId?: string // Profile to link to
  relatedJobId?: string
  relatedApplicationId?: string
  relatedConversationId?: string
  relatedImageUrl?: string
  
  // Action
  actionUrl?: string // Deep link within app
  ctaText?: string // "View Profile", "Reply", etc.
  
  // Status
  isRead: boolean (default: false)
  readAt?: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

#### NotificationSettings
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id, unique)
  
  // Email Preferences
  emailNotificationsEnabled: boolean (default: true)
  emailMatches: boolean (default: true)
  emailMessages: boolean (default: true)
  emailApplicationUpdates: boolean (default: true)
  emailReferrals: boolean (default: true)
  
  // Push Preferences
  pushNotificationsEnabled: boolean (default: true)
  pushMatches: boolean (default: true)
  pushMessages: boolean (default: true)
  pushApplicationUpdates: boolean (default: true)
  pushReferrals: boolean (default: true)
  
  // Frequency
  emailDigestFrequency: "realtime" | "daily" | "weekly" | "never" (default: "daily")
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### 7.2 API Endpoints

#### GET `/api/notifications`
Get all notifications for current user.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `unreadOnly` (boolean, default: false)
- `type` (string, optional)
- `page` (number)
- `limit` (number, default: 20)

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "match",
      "title": "New Match!",
      "message": "Sarah Chen accepted your connection request",
      "relatedUserId": "uuid",
      "relatedImageUrl": "...",
      "isRead": false,
      "createdAt": "2026-01-09T09:28:00Z"
    },
    {
      "id": "uuid",
      "type": "message",
      "title": "New Message",
      "message": "Michael Rodriguez: Thanks for reaching out!",
      "relatedUserId": "uuid",
      "relatedConversationId": "uuid",
      "relatedImageUrl": "...",
      "isRead": false,
      "createdAt": "2026-01-09T08:15:00Z"
    },
    {
      "id": "uuid",
      "type": "referral",
      "title": "Referral Submitted",
      "message": "Emily Watson submitted your referral to Google",
      "relatedUserId": "uuid",
      "relatedApplicationId": "uuid",
      "relatedImageUrl": "...",
      "isRead": true,
      "readAt": "2026-01-09T07:00:00Z",
      "createdAt": "2026-01-09T06:45:00Z"
    }
  ],
  "unreadCount": 2,
  "pagination": { /* ... */ }
}
```

#### PUT `/api/notifications/:notificationId/read`
Mark notification as read.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### PUT `/api/notifications/read-all`
Mark all notifications as read.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`

#### GET `/api/notifications/settings`
Get notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "settings": { /* NotificationSettings object */ }
}
```

#### PUT `/api/notifications/settings`
Update notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "emailNotificationsEnabled": true,
  "emailMatches": true,
  "emailMessages": false,
  "pushNotificationsEnabled": true,
  "emailDigestFrequency": "daily"
}
```

**Response:** `200 OK`

---

## 8. Feed/Discovery

### 8.1 Data Models

#### FeedItem
```typescript
{
  id: string (UUID)
  
  // Content Type
  type: "profile" | "job" | "sponsor" | "success_story" | "recommendation"
  
  // Associated Entity
  entityId: string // Profile ID, Job ID, etc.
  entityType: "user" | "job" | "referral"
  
  // Ranking
  score: number // Relevance score for personalization
  
  // Metadata
  createdAt: Date
}
```

#### UserInteraction
```typescript
{
  id: string (UUID)
  userId: string (foreign key -> User.id)
  
  // Target
  targetId: string // Profile, Job, etc.
  targetType: "user" | "job"
  
  // Interaction
  interactionType: "view" | "like" | "pass" | "message" | "apply" | "share"
  
  // Metadata
  createdAt: Date
}
```

### 8.2 API Endpoints

#### GET `/api/feed`
Get personalized discovery feed.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `refresh` (boolean, default: false) - Get fresh feed

**Response:** `200 OK`
```json
{
  "feed": [
    {
      "id": "uuid",
      "type": "profile",
      "score": 95,
      "profile": {
        "id": "uuid",
        "name": "Aria Nakamura",
        "role": "VP of Design",
        "company": "ZenPay",
        "location": "Tokyo, Japan",
        "profileImageUrl": "...",
        "bio": "Minimalist designer...",
        "matchScore": 92,
        "skills": ["UI/UX", "Figma"],
        "insights": { /* ... */ },
        "prompts": [ /* ... */ ]
      }
    },
    {
      "id": "uuid",
      "type": "job",
      "score": 88,
      "job": { /* Job object */ },
      "sponsorCount": 3,
      "hasApplied": false
    }
  ],
  "pagination": { /* ... */ }
}
```

#### POST `/api/feed/interaction`
Record user interaction for recommendation algorithm.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "targetId": "uuid",
  "targetType": "user",
  "interactionType": "view"
}
```

**Response:** `201 Created`

---

## 9. Search & Filtering

### 9.1 API Endpoints

#### GET `/api/search/users`
Search for users (applicants or sponsors).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `q` (string) - Search query
- `userType` (string: "applicant" | "sponsor")
- `skills` (comma-separated)
- `location` (string)
- `company` (string)
- `minExperience` (number)
- `page` (number)
- `limit` (number)

**Response:** `200 OK`
```json
{
  "users": [ /* Array of user profiles */ ],
  "pagination": { /* ... */ }
}
```

#### GET `/api/search/jobs`
Search for jobs.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `q` (string) - Search query
- `company` (string)
- `location` (string)
- `skills` (comma-separated)
- `employmentType` (string)
- `salaryMin` (number)
- `salaryMax` (number)
- `hasSponsors` (boolean) - Only jobs with active sponsors
- `page` (number)
- `limit` (number)

**Response:** `200 OK`
```json
{
  "jobs": [ /* Array of jobs */ ],
  "pagination": { /* ... */ }
}
```

#### GET `/api/search/suggestions`
Get search suggestions/autocomplete.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `q` (string) - Partial search query
- `type` (string: "skills" | "companies" | "roles")

**Response:** `200 OK`
```json
{
  "suggestions": [
    "React",
    "React Native",
    "Redux"
  ]
}
```

---

## 10. File Management

### 10.1 API Endpoints

#### POST `/api/files/upload`
Upload a file (resume, cover letter, profile image).

**Headers:** `Authorization: Bearer {token}`

**Request:** `multipart/form-data`
- `file` (File)
- `type` (string: "resume" | "profile_image" | "attachment")
- `fileName` (string)

**Response:** `201 Created`
```json
{
  "fileUrl": "https://storage.backchannel.com/files/abc123.pdf",
  "fileId": "uuid",
  "fileType": "resume",
  "fileName": "Alex_Johnson_Resume.pdf",
  "fileSize": 245678,
  "uploadedAt": "2026-01-09T10:30:00Z"
}
```

#### DELETE `/api/files/:fileId`
Delete a file.

**Headers:** `Authorization: Bearer {token}`

**Response:** `204 No Content`

#### GET `/api/files/:fileId`
Get file metadata (not the file itself - returns signed URL).

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "fileUrl": "https://storage.backchannel.com/files/abc123.pdf?signature=...",
  "fileId": "uuid",
  "fileName": "Alex_Johnson_Resume.pdf",
  "fileType": "resume",
  "expiresAt": "2026-01-09T11:30:00Z"
}
```

---

## 11. Analytics & Metrics

### 11.1 API Endpoints

#### GET `/api/analytics/profile`
Get profile analytics for current user.

**Headers:** `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "profileViews": {
    "total": 245,
    "last7Days": 32,
    "last30Days": 128
  },
  "connectionRate": {
    "sent": 45,
    "accepted": 32,
    "rate": 71.1
  },
  "applicationStats": {
    "total": 12,
    "inProgress": 5,
    "interviews": 2,
    "offers": 1,
    "responseRate": 83.3
  },
  "referralStats": { // For sponsors
    "totalGiven": 15,
    "hired": 8,
    "successRate": 53.3,
    "bonusEarned": 25000
  }
}
```

#### GET `/api/analytics/activity`
Get activity timeline for current user.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `days` (number, default: 30)

**Response:** `200 OK`
```json
{
  "activity": [
    {
      "date": "2026-01-09",
      "profileViews": 12,
      "messages": 5,
      "connections": 2,
      "applications": 1
    },
    {
      "date": "2026-01-08",
      "profileViews": 8,
      "messages": 3,
      "connections": 1,
      "applications": 0
    }
  ]
}
```

---

## Additional Technical Requirements

### Authentication
- All protected endpoints require `Authorization: Bearer {token}` header
- JWT tokens should expire after 24 hours
- Implement refresh token mechanism for seamless re-authentication
- Support OAuth 2.0 for LinkedIn integration

### Rate Limiting
- Implement rate limiting per user:
  - Authentication endpoints: 5 requests per minute
  - General API: 100 requests per minute
  - File uploads: 10 uploads per hour

### Pagination
Standard pagination response format:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Handling
Standard error response format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    },
    "timestamp": "2026-01-09T10:30:00Z"
  }
}
```

Common HTTP status codes:
- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `204 No Content` - Successful request with no response body
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Real-time Features (WebSocket/Push)
Consider implementing WebSocket connections for:
- Real-time messaging
- Live notification updates
- Match notifications
- Application status updates

Suggested WebSocket events:
- `message:new` - New message received
- `notification:new` - New notification
- `match:new` - New match/connection
- `application:status_changed` - Application status update

### Data Privacy & Security
- Encrypt sensitive data (passwords, tokens) at rest
- Use HTTPS for all API communication
- Implement GDPR-compliant data export/deletion
- Log all authentication attempts
- Implement 2FA (future consideration)

### Search & Recommendation Algorithm
- Implement full-text search using Elasticsearch or similar
- Build recommendation engine based on:
  - Skills matching
  - Location preferences
  - Experience level
  - User interactions (likes, passes)
  - Success rate of previous matches

### Email Integration
Required email templates:
- Welcome email (post-registration)
- Email verification
- Password reset
- Application submitted confirmation
- New match notification
- New message notification
- Interview reminder
- Application status update
- Referral submitted confirmation
- Weekly digest (optional)

### External Integrations
- **LinkedIn OAuth**: For authentication and profile import
- **ATS Integration** (future): Workday, Greenhouse, Lever integration for direct application submission
- **Payment Processing** (future): Stripe for premium features or referral bonuses
- **Email Service**: SendGrid, AWS SES, or similar
- **Storage**: AWS S3, Google Cloud Storage for file uploads
- **Analytics**: Mixpanel, Amplitude for product analytics

---

## Summary of Key User Flows

### Applicant Journey
1. **Sign Up** → Email/LinkedIn auth → `POST /api/auth/register` or `/api/auth/linkedin`
2. **Choose Role** → Select "applicant" → `POST /api/onboarding/role`
3. **Complete Questionnaire** → Fill profile → `POST /api/onboarding/applicant`
4. **Browse Jobs** → View available positions → `GET /api/jobs`
5. **Connect with Sponsors** → Swipe/match → `POST /api/matches/swipe`
6. **Message Sponsors** → Chat → `POST /api/conversations/:id/messages`
7. **Apply to Jobs** → Submit application → `POST /api/applications`
8. **Track Applications** → View status → `GET /api/applications`
9. **Receive Updates** → Get notifications → `GET /api/notifications`

### Sponsor Journey
1. **Sign Up** → Email/LinkedIn auth → `POST /api/auth/register`
2. **Choose Role** → Select "sponsor" → `POST /api/onboarding/role`
3. **Complete Questionnaire** → Fill profile + verify email → `POST /api/onboarding/sponsor`
4. **Browse Applicants** → View candidates → `GET /api/feed`
5. **Sponsor Jobs** → Add jobs they can refer for → `POST /api/jobs/:id/sponsor`
6. **Review Applicants** → Swipe on candidates → `POST /api/jobs/:id/interested`
7. **Message Applicants** → Chat → `POST /api/conversations/:id/messages`
8. **Submit Referrals** → Refer candidates → `POST /api/referrals`
9. **Track Referrals** → View outcomes → `GET /api/referrals`

---

## Notes for Backend Developer

### Priority Implementation Order
1. **Phase 1 (MVP)**:
   - Authentication & user management
   - User profiles (applicant & sponsor)
   - Basic matching/connections
   - Messaging system
   - Job postings

2. **Phase 2**:
   - Applications & referrals
   - Notifications
   - File uploads
   - Search & filtering

3. **Phase 3**:
   - Discovery feed algorithm
   - Analytics
   - Real-time features (WebSocket)
   - External integrations

### Testing Considerations
- Create seed data for all user types
- Test OAuth flow with LinkedIn sandbox
- Load testing for matching algorithm
- Security testing for authentication
- Email template testing

### Performance Optimization
- Index database tables on: `userId`, `jobId`, `status`, `createdAt`
- Cache frequently accessed data (job listings, user profiles)
- Implement lazy loading for feeds
- Optimize image storage with CDN

---

This contract should provide your backend partner with everything needed to build a robust API for BackChannel. Feel free to share this document and iterate on it as needed!
