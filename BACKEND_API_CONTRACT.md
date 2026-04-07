# BackChannel API Reference

Base URL: `http://localhost:8000` (local) / `https://oyster-app-4pg5w.ondigitalocean.app` (production)

All authenticated endpoints require: `Authorization: Bearer <access_token>`

Error responses use: `{"error": "message"}`

> **Database Note (April 2026):** The backend migrated from Snowflake to **PostgreSQL** for all OLTP data (PR #25). This is fully transparent to the frontend — UPPERCASE column names, JSON string fields, and all endpoint URLs remain identical. Snowflake is retained **only** for Cortex AI (document parsing, autofill, classification). The `_parseVariant()` / `JSON.parse()` pattern still works correctly; JSONB columns are cast via `::TEXT`.

---

## 🎯 FRONTEND INTEGRATION STATUS

**Last Verified:** March 2, 2026

### ✅ Fully Wired & Verified (21 Core Endpoints)

These endpoints are implemented in [lib/api.ts](lib/api.ts) and [lib/auth-api.ts](lib/auth-api.ts) and match the backend specification exactly:

#### 🔐 Authentication (4 endpoints)

| Endpoint                 | Method | Function                         | File        | Status                                                           |
| ------------------------ | ------ | -------------------------------- | ----------- | ---------------------------------------------------------------- |
| `/api/login/`            | POST   | `authApi.login(email, password)` | auth-api.ts | ✅ Verified - Returns tokens + user info + `role` field          |
| `/api/register/`         | POST   | `authApi.register()`             | auth-api.ts | ✅ Verified - Applicant registration                             |
| `/api/register-sponsor/` | POST   | `authApi.register()`             | auth-api.ts | ✅ Verified - Sponsor registration                               |
| `/api/forgot-password/`  | POST   | `authApi.forgotPassword(email)`  | auth-api.ts | ✅ Verified - Sends reset link via email (token NOT in response) |
| `/api/token/refresh/`    | POST   | Auto in `ApiClient`              | api.ts      | ✅ Verified - Auto-refreshes on 401                              |

#### 💼 Jobs & Feed (3 endpoints)

| Endpoint                     | Method | Function                    | Status                                                                                                                               |
| ---------------------------- | ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/jobs/pack/`            | GET    | `fetchJobsPack()`           | ✅ Verified - Returns relevance-scored jobs (PR #24); new fields: `relevance_score`, `REQUIREMENTS_SUMMARY`, `CORE_RESPONSIBILITIES` |
| `/api/jobs/browse/`          | GET    | `browseJobs(filters?)`      | ✅ Verified - Sponsor browsing with filters                                                                                          |
| `/api/jobs/<jobId>/sponsor/` | POST   | `sponsorJob(jobId, data)`   | ✅ Verified - Sponsor an ATS job                                                                                                     |
| `/api/profiles/pack/`        | GET    | `fetchProfilesPack(jobId?)` | ✅ Verified - Sponsor viewing applicant profiles                                                                                     |

#### 🤝 Matching & Likes (4 endpoints)

| Endpoint                | Method | Function                               | Status                                                   |
| ----------------------- | ------ | -------------------------------------- | -------------------------------------------------------- |
| `/api/jobs/like/`       | POST   | `likeJob(jobId)`                       | ✅ Verified - Applicant likes job, may trigger match     |
| `/api/likes/jobs/`      | GET    | `getLikedJobs()`                       | ✅ Verified - View applicant's liked jobs                |
| `/api/profiles/like/`   | POST   | `likeProfile(applicantUserId, jobId?)` | ✅ Verified - Sponsor likes applicant, may trigger match |
| `/api/matches/`         | GET    | `getMatches()`                         | ✅ Verified - Get applicant's matches                    |
| `/api/matches/sponsor/` | GET    | `getSponsorMatches()`                  | ✅ Verified - Get sponsor's matches                      |

#### 💬 Messaging (5 endpoints)

| Endpoint                                     | Method | Function                                            | Status                                                                                |
| -------------------------------------------- | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/api/messages/conversations/`               | GET    | `getConversations()`                                | ✅ Verified - Returns UPPERCASE fields; supports `limit`/`offset` pagination (PR #22) |
| `/api/messages/history/`                     | GET    | `getConversationMessages(conversationId, {limit?})` | ✅ Verified - Query param: `conversation_id`, `limit` (default 50, max 200)           |
| `/api/messages/send/`                        | POST   | `sendMessage(conversationId, body)`                 | ✅ Verified - Body: `{conversation_id, body}`, Returns: `{message_id}`                |
| `/api/messages/conversations/get-or-create/` | POST   | `getOrCreateConversation(jobId, participantUserId)` | ✅ Verified - Requires match, Body: `{job_id, participant_user_id}`                   |
| `/api/messages/unmatch/`                     | POST   | `unmatchConversation(conversationId)`               | ✅ Verified - Body: `{conversation_id}`, Returns: `{status: "CLOSED"}`                |

#### 👤 Profile Management (6 endpoints)

| Endpoint                         | Method | Function                          | Status                                                                                                            |
| -------------------------------- | ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/api/profile/`                  | GET    | `getProfile()`                    | ✅ Verified - Returns full profile with UPPERCASE fields + role-specific `applicant_profile` OR `sponsor_profile` |
| `/api/profile/basic/`            | GET    | `getBasicProfile()`               | ✅ Verified - Returns subset: USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PHOTO_URL                                    |
| `/api/profile/update/`           | PATCH  | `updateGeneralProfile(updates)`   | ✅ Verified - 15 fields (location, phone_number, bio, address components, etc.)                                   |
| `/api/profile/applicant/update/` | PATCH  | `updateApplicantProfile(updates)` | ✅ Verified - 20+ fields including insights, professional_experiences, education_entries                          |
| `/api/profile/sponsor/update/`   | PATCH  | `updateSponsorProfile(updates)`   | ✅ Verified - 12 fields including insights, companies_can_refer_to, skills                                        |
| `/api/profiles/<userId>/public/` | GET    | `getPublicProfile(userId)`        | ✅ Verified - Returns public profile (excludes email, phone, street, zip)                                         |

#### 🚪 Session Management (1 endpoint)

| Endpoint       | Method | Function   | Status                        |
| -------------- | ------ | ---------- | ----------------------------- |
| `/api/logout/` | POST   | `logout()` | ✅ Verified - Session cleanup |

#### 🔔 Notifications (4 endpoints)

| Endpoint                           | Method | Function                                 | Status                                             |
| ---------------------------------- | ------ | ---------------------------------------- | -------------------------------------------------- |
| `/api/notifications/`              | GET    | `getNotifications(params?)`              | ✅ Verified - Paginated, filterable by unread_only |
| `/api/notifications/unread-count/` | GET    | `getUnreadNotificationCount()`           | ✅ Verified - Returns badge count                  |
| `/api/notifications/<id>/read/`    | PATCH  | `markNotificationAsRead(notificationId)` | ✅ Verified - Mark single notification             |
| `/api/notifications/read-all/`     | PATCH  | `markAllNotificationsAsRead()`           | ✅ Verified - Bulk mark read with count            |

### ✅ Additional Verified Endpoints (since March 2, 2026)

| Endpoint                        | Method | Function                  | Status                                                                    |
| ------------------------------- | ------ | ------------------------- | ------------------------------------------------------------------------- |
| `/api/likes/profiles/received/` | GET    | `getInterestedSponsors()` | ✅ Deployed (PR #16) — wired in MatchesView                               |
| `/api/profile/sponsor/update/`  | PATCH  | `updateSponsorProfile()`  | ✅ Now accepts `skills` array (PR #16)                                    |
| `/api/auth/change-email/`       | POST   | —                         | ✅ 501 stub deployed (PR #16) — returns 501 until verification flow built |
| `/api/jobs/<id>/unsponsor/`     | DELETE | `unsponsorJob()`          | ✅ Deployed (PR #17) — hard-deletes sponsored job, allows re-sponsoring   |

### ⚠️ Core Endpoints NOT Yet Wired (4 endpoints)

These are essential for core app functionality and should be prioritized:

#### 🤝 Referrals (4 endpoints) - **PRIORITY HIGH**

| Endpoint                        | Method | Purpose                               | Impact                 |
| ------------------------------- | ------ | ------------------------------------- | ---------------------- |
| `/api/referrals/submit/`        | POST   | Submit referral for matched applicant | Core value prop        |
| `/api/referrals/`               | GET    | List referrals (role-aware)           | Referral pipeline view |
| `/api/referrals/<id>/`          | GET    | Get referral details                  | Detailed status        |
| `/api/referrals/<id>/withdraw/` | PATCH  | Withdraw referral (sponsor only)      | Pipeline management    |

### 🔧 Key Implementation Notes

**UPPERCASE Convention:**

- PostgreSQL column names are uppercased by the connection layer (`USER_ID`, `FIRST_NAME`, `MESSAGE_ID`, etc.)
- All response types in lib/api.ts match this convention
- Components are responsible for transforming to UI-friendly names

**JSONB Fields (Arrive as JSON strings via `::TEXT` cast — use `JSON.parse()`):**

- Complex fields (SKILLS, INSIGHTS, PROFESSIONAL_EXPERIENCES) are PostgreSQL JSONB columns cast to TEXT
- May be returned as JSON strings — use `JSON.parse()` if needed
- See `_parseVariant()` helper in stores/useUserProfileStore.ts

**Field Name Convention:**

- Request bodies use **snake_case**: `phone_number`, `current_role`, `years_experience`
- Response fields use **UPPERCASE**: `PHONE_NUMBER`, `CURRENT_ROLE`, `YEARS_EXPERIENCE`

**Messaging Behavior:**

- `getConversations()` supports `limit` and `offset` query params, returns `total_count`
- `getConversationMessages()` uses query param `conversation_id` (not path param)
- `sendMessage()` returns only `{message_id}` (not full message object)
- Messages sent via HTTP are also broadcast to WebSocket connections

**Profile Behavior:**

- Three separate PATCH endpoints (general, applicant, sponsor)
- Updates return `{message, updated_fields}` not full profile
- `getProfile()` includes either `applicant_profile` OR `sponsor_profile` based on role
- Public profiles exclude: EMAIL, PHONE_NUMBER, STREET, ZIP

---

## Quick Start

1. **Register** via `POST /api/register/` (applicant) or `POST /api/register-sponsor/` (sponsor). Response includes `access_token` and `refresh_token`.
2. **Use the access token** as `Authorization: Bearer <access_token>` on all subsequent requests.
3. **Refresh tokens** via `POST /api/token/refresh/` when access tokens expire (SimpleJWT, default 24h access / 7d refresh).
4. **WebSocket connections** pass the JWT as a query parameter: `ws://<host>/ws/chat/<id>/?token=<access_token>`.

### Response Conventions

- The backend returns **UPPERCASE** column names (PostgreSQL column names are uppercased by the connection layer for backwards compatibility).
- Array/object fields stored as PostgreSQL JSONB are cast to TEXT strings in SQL queries (via `::TEXT`), so they arrive as JSON strings. Parse them client-side with `JSON.parse()`.
- Paginated list endpoints accept `limit` and `offset` query parameters and return a `total_count` field in the response.
- All UUIDs are v4 format (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`).

---

## Authentication

### POST `/api/register/`

Register a new applicant.

- **Auth**: None
- **Rate limit**: 10/hour

| Field              | Type    | Required | Notes                              |
| ------------------ | ------- | -------- | ---------------------------------- |
| email              | string  | yes      | Valid email format                 |
| password           | string  | yes      | Min 8 characters                   |
| first_name         | string  | yes      | Also accepts `firstName`           |
| last_name          | string  | yes      | Also accepts `lastName`            |
| role               | string  | yes      | Must be `"Applicant"`              |
| username           | string  | no       | Auto-derived from email if omitted |
| phone_number       | string  | no       | Also accepts `phone`               |
| international_code | string  | no       | Default: `"+1"`                    |
| dob                | string  | no       | Also accepts `dateOfBirth`         |
| location           | string  | no       |                                    |
| industry           | string  | no       |                                    |
| range              | integer | no       | Search radius in miles             |
| reason             | string  | no       |                                    |
| positions          | array   | no       | List of position strings           |
| skills             | array   | no       | List of skill strings              |

**Response (201):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "profile_id": "uuid",
  "role": "Applicant",
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "message": "Applicant registration successful"
}
```

---

### POST `/api/register-sponsor/`

Register a new sponsor.

- **Auth**: None
- **Rate limit**: 10/hour

| Field               | Type    | Required | Notes                              |
| ------------------- | ------- | -------- | ---------------------------------- |
| email               | string  | yes      | Valid email format                 |
| password            | string  | yes      | Min 8 characters                   |
| first_name          | string  | yes      |                                    |
| last_name           | string  | yes      |                                    |
| role                | string  | yes      | Must be `"Sponsor"`                |
| username            | string  | no       | Auto-derived from email if omitted |
| phone_number        | string  | no       |                                    |
| international_code  | string  | no       | Default: `"+1"`                    |
| dob                 | string  | no       |                                    |
| location            | string  | no       |                                    |
| company             | string  | no       |                                    |
| job_title           | string  | no       |                                    |
| work_email          | string  | no       |                                    |
| linked_in           | string  | no       |                                    |
| duration            | string  | no       | e.g., `"3-5 years"`                |
| financial_reward    | string  | no       | `"yes"` converts to true           |
| referral_eligible   | string  | no       | `"yes"` converts to true           |
| referral_experience | boolean | no       | Default: false                     |
| open_to_referrals   | boolean | no       | Default: true                      |

**Response (201):**

```json
{
  "user_id": "uuid",
  "username": "username",
  "profile_id": "uuid",
  "role": "Sponsor",
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "message": "Sponsor registration successful"
}
```

---

### POST `/api/login/`

Authenticate and receive JWT tokens.

- **Auth**: None
- **Rate limit**: 10/min

| Field    | Type   | Required |
| -------- | ------ | -------- |
| email    | string | yes      |
| password | string | yes      |

**Response (200):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "Applicant",
  "refresh_token": "jwt-refresh-token",
  "access_token": "jwt-access-token"
}
```

---

### POST `/api/logout/`

Log out (client should discard tokens).

- **Auth**: Required

**Response (200):** `{"message": "Logged out successfully"}`

---

### POST `/api/forgot-password/`

Request a password reset token.

- **Auth**: None
- **Rate limit**: 5/hour

| Field | Type   | Required |
| ----- | ------ | -------- |
| email | string | yes      |

**Response (200):**

```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

The reset token is **never** returned in the HTTP response. It is sent to the user's email address only. The response is identical whether or not the email exists (anti-enumeration). Token expires in 15 minutes.

---

### POST `/api/reset-password/`

Reset password with a token.

- **Auth**: None
- **Rate limit**: 5/hour

| Field       | Type   | Required | Notes                                    |
| ----------- | ------ | -------- | ---------------------------------------- |
| token       | string | yes      | From forgot-password                     |
| newPassword | string | yes      | Min 8 chars. Also accepts `new_password` |

**Response (200):** `{"message": "Password has been reset successfully."}`

---

### POST `/api/profile/change-password/`

Change password while logged in.

- **Auth**: Required

| Field        | Type   | Required | Notes                                   |
| ------------ | ------ | -------- | --------------------------------------- |
| old_password | string | yes      | Also accepts `oldPassword`              |
| new_password | string | yes      | Min 8 chars. Also accepts `newPassword` |

**Response (200):** `{"message": "Password changed successfully."}`

---

### POST `/api/profile/deactivate/`

Deactivate account.

- **Auth**: Required

**Response (200):** `{"message": "Account deactivated successfully."}`

---

### POST `/api/token/refresh/`

Refresh an expired access token (SimpleJWT).

- **Auth**: None

| Field   | Type   | Required |
| ------- | ------ | -------- |
| refresh | string | yes      |

**Response (200):** `{"access": "new-jwt-access-token"}`

---

## Profiles

### GET `/api/profile/`

Get full profile for the authenticated user.

- **Auth**: Required

**Response (200):**

```json
{
  "USER_ID": "uuid",
  "EMAIL": "string",
  "FIRST_NAME": "string",
  "LAST_NAME": "string",
  "LOCATION": "string",
  "PHOTO_URL": "string | null",
  "PHONE_NUMBER": "string | null",
  "ROLE_TYPE": "Applicant | Sponsor",
  "IS_JOB_SEEKER": true,
  "IS_SPONSOR": false,
  "LINKED_IN": "string | null",
  "PORTFOLIO_URL": "string | null",
  "DATE_OF_BIRTH": "string | null",
  "applicant_profile": {
    "INDUSTRY": "string",
    "RANGE_MILES": 0,
    "REASON": "string",
    "POSITIONS": ["string"],
    "SKILLS": ["string"],
    "RESUME_DATA": {}
  },
  "sponsor_profile": {
    "COMPANY": "string",
    "JOB_TITLE": "string",
    "WORK_EMAIL": "string",
    "DURATION": "string",
    "FINANCIAL_REWARD": true,
    "REFERRAL_ELIGIBLE": true,
    "REFERRAL_EXPERIENCE": false,
    "OPEN_TO_REFERRALS": true
  }
}
```

Note: Only one of `applicant_profile` / `sponsor_profile` is present based on role.

---

### GET `/api/profile/basic/`

Get basic user info.

- **Auth**: Required

**Response (200):** Subset of profile fields (USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PHOTO_URL).

---

### PATCH `/api/profile/update/`

Update general profile fields (both roles).

- **Auth**: Required

| Field              | Type   | Required | Notes                            |
| ------------------ | ------ | -------- | -------------------------------- |
| location           | string | no       | Display-friendly location string |
| photo_url          | string | no       |                                  |
| phone_number       | string | no       |                                  |
| first_name         | string | no       |                                  |
| last_name          | string | no       |                                  |
| international_code | string | no       |                                  |
| linked_in          | string | no       |                                  |
| portfolio_url      | string | no       |                                  |
| date_of_birth      | string | no       |                                  |
| bio                | string | no       | Max 2000 chars                   |
| street             | string | no       | Granular address component       |
| city               | string | no       | Granular address component       |
| state              | string | no       | Granular address component       |
| zip                | string | no       | Granular address component       |
| country            | string | no       | Granular address component       |

**Response (200):**

```json
{
  "message": "Profile updated successfully",
  "updated_fields": ["location", "photo_url"]
}
```

---

### PATCH `/api/profile/applicant/update/`

Update applicant-specific fields.

- **Auth**: Required

| Field                    | Type    | Required | Notes                                                                         |
| ------------------------ | ------- | -------- | ----------------------------------------------------------------------------- |
| industry                 | string  | no       |                                                                               |
| range                    | integer | no       | Alias for range_miles                                                         |
| range_miles              | integer | no       |                                                                               |
| reason                   | string  | no       |                                                                               |
| positions                | array   | no       | JSON array of strings                                                         |
| skills                   | array   | no       | JSON array of strings                                                         |
| resume_data              | object  | no       | JSON object                                                                   |
| current_role             | string  | no       | e.g. "Senior Backend Engineer"                                                |
| years_experience         | string  | no       | e.g. "5-8"                                                                    |
| work_authorization       | string  | no       | e.g. "US Citizen"                                                             |
| willing_to_relocate      | string  | no       | e.g. "Yes"                                                                    |
| requires_sponsorship     | string  | no       | e.g. "No"                                                                     |
| achievements             | string  | no       | Free text, max 2000 chars                                                     |
| desired_roles            | array   | no       | JSON array of strings                                                         |
| work_preferences         | array   | no       | JSON array of strings (e.g. ["Remote", "Hybrid"])                             |
| professional_experiences | array   | no       | JSON array of `{jobTitle, company, startDate, endDate, current, description}` |
| education_entries        | array   | no       | JSON array of `{degree, major, university, graduationYear, gpa}`              |
| certifications           | array   | no       | JSON array of `{name, organization, year}`                                    |
| languages                | array   | no       | JSON array of `{language, proficiency}`                                       |
| insights                 | array   | no       | JSON array of `{question, answer}`                                            |

**Response (200):**

```json
{
  "message": "Applicant profile updated successfully",
  "updated_fields": ["industry", "skills"]
}
```

---

### PATCH `/api/profile/sponsor/update/`

Update sponsor-specific fields.

- **Auth**: Required

| Field                  | Type   | Required | Notes                              |
| ---------------------- | ------ | -------- | ---------------------------------- |
| company                | string | no       |                                    |
| job_title              | string | no       |                                    |
| work_email             | string | no       |                                    |
| linked_in              | string | no       |                                    |
| duration               | string | no       |                                    |
| financial_reward       | bool   | no       | Accepts `"yes"/"no"`, `true/false` |
| referral_eligible      | bool   | no       |                                    |
| referral_experience    | bool   | no       |                                    |
| open_to_referrals      | bool   | no       |                                    |
| companies_can_refer_to | array  | no       | JSON array of company name strings |
| insights               | array  | no       | JSON array of `{question, answer}` |

**Response (200):**

```json
{
  "message": "Sponsor profile updated successfully",
  "updated_fields": ["company", "job_title"]
}
```

---

### GET `/api/profiles/<user_id>/public/`

Get another user's public profile. Excludes private fields (email, phone, street, zip).

- **Auth**: Required

**Response (200):**

```json
{
  "USER_ID": "uuid",
  "FIRST_NAME": "string",
  "LAST_NAME": "string",
  "ROLE_TYPE": "Applicant | Sponsor",
  "PHOTO_URL": "string | null",
  "LOCATION": "string | null",
  "BIO": "string | null",
  "CITY": "string | null",
  "STATE": "string | null",
  "COUNTRY": "string | null",
  "LINKED_IN": "string | null",
  "PORTFOLIO_URL": "string | null",
  "applicant_profile": {
    "INDUSTRY": "string",
    "CURRENT_ROLE": "string",
    "YEARS_EXPERIENCE": "string",
    "SKILLS": ["string"],
    "POSITIONS": ["string"],
    "PROFESSIONAL_EXPERIENCES": [{ "jobTitle": "...", "company": "..." }],
    "EDUCATION_ENTRIES": [{ "degree": "...", "university": "..." }],
    "CERTIFICATIONS": [{ "name": "...", "organization": "..." }],
    "LANGUAGES": [{ "language": "...", "proficiency": "..." }],
    "INSIGHTS": [{ "question": "...", "answer": "..." }]
  }
}
```

**Error (404):** User not found.

---

### GET `/api/profiles/pack/?job_id=<uuid>`

Get a pack of applicant profiles for a sponsor's job.

- **Auth**: Required
- **Query**: `job_id` (required)

**Response (200):**

```json
{
  "profiles": [
    {
      "card_index": 1,
      "total_cards": 10,
      "USER_ID": "uuid",
      "FIRST_NAME": "string",
      "LAST_NAME": "string",
      "PHOTO_URL": "string | null",
      "SKILLS": ["string"],
      "POSITIONS": ["string"],
      "INDUSTRY": "string"
    }
  ],
  "total_count": 10
}
```

---

## Jobs

### GET `/api/jobs/pack/`

Get a pack of unseen jobs for the applicant feed (ATS + sponsored mixed), ranked by relevance to the applicant's profile (PR #24).

> **Relevance scoring (PR #24):** Jobs are ranked server-side using a weighted algorithm: skills match 40%, experience level 20%, role match 20%, location 10%, recency 10%. The `relevance_score` (0.0–1.0) can optionally be displayed in job cards.

- **Auth**: Required

**Response (200):**

```json
{
  "jobs": [
    {
      "ID": "string",
      "TITLE": "string",
      "ORGANIZATION": "string",
      "DESCRIPTION_TEXT": "string",
      "DATE_POSTED": "string",
      "LOCATIONS_DERIVED": "[\"City, ST\"]",
      "EMPLOYMENT_TYPE": "string | null",
      "SALARY_RAW": "string | null",
      "REMOTE_DERIVED": false,
      "URL": "string",
      "AI_SALARY_MINVALUE": 80000.0,
      "AI_SALARY_MAXVALUE": 120000.0,
      "AI_SALARY_CURRENCY": "USD",
      "AI_EXPERIENCE_LEVEL": "string",
      "AI_WORK_ARRANGEMENT": "string",
      "AI_KEY_SKILLS": "[\"Python\",\"Django\"]",
      "AI_JOB_HIGHLIGHTS": "[]",
      "AI_JOB_SUMMARY": "string",
      "REQUIREMENTS_SUMMARY": "string | null",
      "CORE_RESPONSIBILITIES": "string | null",
      "relevance_score": 0.82,
      "card_index": 1,
      "total_cards": 10,
      "job_type": "ats | sponsored",
      "sponsor": { "...sponsor info if sponsored..." }
    }
  ],
  "total_count": 10
}
```

---

### GET `/api/ats/jobs/`

List ATS jobs with optional filters.

- **Auth**: Required
- **Query**: `title`, `location`, `remote`, `organization`, `limit` (all optional)

---

### GET `/api/ats/jobs/<int:job_id>/`

Get ATS job detail.

- **Auth**: Required

---

### GET `/api/jobs/`

List sponsored jobs with optional filters.

- **Auth**: Required
- **Query**: `title`, `location`, `remote`, `company`, `limit` (all optional)

---

### GET `/api/jobs/<str:job_id>/`

Get sponsored job detail (includes sponsor profile info).

- **Auth**: Required

---

### GET `/api/jobs/browse/`

Browse SILVER_JOBS for sponsorship (sponsor use).

- **Auth**: Required
- **Query**: `title`, `location`, `remote`, `limit` (all optional)

**Response (200):**

```json
{
  "jobs": [
    {
      "JOB_ID": "string",
      "TITLE": "string",
      "ORGANIZATION": "string",
      "FULL_LOCATION": "string",
      "DESCRIPTION_TEXT": "string",
      "EMPLOYMENT_TYPES": "string",
      "IS_REMOTE": false,
      "SALARY_ANNUAL_MIN": 100000.0,
      "SALARY_ANNUAL_MAX": 140000.0,
      "SALARY_CURRENCY": "USD",
      "EXPERIENCE_LEVEL": "string",
      "SKILLS": "string",
      "DATE_POSTED": "string"
    }
  ],
  "total_count": 20
}
```

---

### POST `/api/jobs/<str:job_id>/sponsor/`

Sponsor an ATS job (creates a JOB_POSTINGS entry).

- **Auth**: Required

| Field        | Type    | Required | Notes                    |
| ------------ | ------- | -------- | ------------------------ |
| relationship | string  | no       | e.g., `"Hiring Manager"` |
| canRefer     | boolean | no       | Also accepts `can_refer` |

**Response (201):**

```json
{
  "job_id": "uuid",
  "title": "string",
  "company": "string",
  "message": "Job successfully sponsored",
  "relationship": "string | null",
  "can_refer": true,
  "expires_at": "2026-03-27T..."
}
```

---

### POST `/api/jobs/create/`

Create a new sponsored job from scratch.

- **Auth**: Required

| Field            | Type    | Required |
| ---------------- | ------- | -------- |
| title            | string  | yes      |
| company          | string  | yes      |
| location         | string  | no       |
| description      | string  | no       |
| salary_min       | float   | no       |
| salary_max       | float   | no       |
| salary_currency  | string  | no       |
| requirements     | string  | no       |
| experience_level | string  | no       |
| employment_type  | string  | no       |
| remote_option    | boolean | no       |

**Response (201):**

```json
{
  "job_id": "uuid",
  "title": "string",
  "company": "string",
  "message": "Job created successfully",
  "expires_at": "2026-03-27T..."
}
```

---

### POST `/api/jobs/<str:job_id>/apply/`

Apply to a job (sponsored or ATS).

- **Auth**: Required

**Response (201):**

```json
{
  "application_id": "uuid",
  "job_id": "string",
  "job_title": "string",
  "company": "string",
  "matched": false,
  "message": "Application submitted successfully"
}
```

Note: For ATS jobs, creates a waitlist entry. For sponsored jobs, creates a like and may trigger a match.

---

### POST `/api/jobs/waitlist/`

Join waitlist for an ATS job.

- **Auth**: Required

| Field  | Type   | Required |
| ------ | ------ | -------- |
| job_id | string | yes      |

**Response (201):**

```json
{
  "waitlist_id": "uuid",
  "user_id": "uuid",
  "job_id": "string",
  "status": "ACTIVE",
  "message": "You have been added to the waitlist for this job."
}
```

---

## Likes & Matching

### POST `/api/jobs/like/`

Applicant likes a job. May trigger a match.

- **Auth**: Required

| Field  | Type   | Required |
| ------ | ------ | -------- |
| job_id | string | yes      |
| notes  | string | no       |

**Response (200):**

```json
{
  "like_id": "uuid",
  "matched": false,
  "message": "Job liked successfully"
}
```

---

### GET `/api/likes/jobs/`

Get all jobs liked by the authenticated applicant.

- **Auth**: Required

**Response (200):** Array of liked job objects with descriptions and sponsor info.

---

### POST `/api/profiles/like/`

Sponsor likes an applicant for a job. May trigger a match.

- **Auth**: Required

| Field             | Type   | Required |
| ----------------- | ------ | -------- |
| applicant_user_id | string | yes      |
| job_id            | string | yes      |

**Response (200):**

```json
{
  "job_id": "uuid",
  "applicant_user_id": "uuid",
  "matched": true
}
```

---

### GET `/api/jobs/<str:job_id>/likes/applicants/`

Get applicants who liked a sponsor's job (includes enriched profile fields).

- **Auth**: Required

**Response (200):**

```json
{
  "job_id": "uuid",
  "applicants": [
    {
      "LIKE_ID": "uuid",
      "USER_ID": "uuid",
      "FIRST_NAME": "string",
      "LAST_NAME": "string",
      "PHOTO_URL": "string | null",
      "SKILLS": ["string"],
      "POSITIONS": ["string"]
    }
  ]
}
```

---

### GET `/api/matches/`

Get matches for an applicant.

- **Auth**: Required

**Response (200):**

```json
{
  "job_matches": [
    {
      "LIKE_ID": "uuid",
      "JOB_ID": "uuid",
      "TITLE": "string",
      "COMPANY": "string",
      "SPONSOR_FIRST_NAME": "string",
      "SPONSOR_LAST_NAME": "string",
      "SPONSOR_JOB_TITLE": "string",
      "SPONSOR_PHOTO_URL": "string | null"
    }
  ],
  "profile_matches": []
}
```

---

### GET `/api/matches/sponsor/`

Get matches for a sponsor.

- **Auth**: Required

**Response (200):**

```json
{
  "matches": [
    {
      "LIKE_ID": "uuid",
      "JOB_ID": "uuid",
      "USER_ID": "uuid",
      "FIRST_NAME": "string",
      "LAST_NAME": "string",
      "PHOTO_URL": "string | null",
      "TITLE": "string",
      "COMPANY": "string"
    }
  ]
}
```

---

## Feed Actions

### POST `/api/jobs/feed/record/`

Record applicant's action on a job in the feed.

- **Auth**: Required

| Field  | Type   | Required | Notes                                |
| ------ | ------ | -------- | ------------------------------------ |
| job_id | number | yes      | Must be numeric ATS job ID           |
| action | string | yes      | `"viewed"`, `"passed"`, or `"liked"` |

**Response (201):** `{"message": "Recorded"}`

---

### POST `/api/profiles/feed/record/`

Record sponsor's action on an applicant profile in the feed.

- **Auth**: Required

| Field             | Type   | Required |
| ----------------- | ------ | -------- |
| job_id            | string | yes      |
| applicant_user_id | string | yes      |
| action            | string | yes      |

**Response (201):** `{"message": "Recorded"}`

---

## Messaging

### POST `/api/messages/conversations/get-or-create/`

Get or create a conversation between matched users.

- **Auth**: Required

| Field               | Type   | Required |
| ------------------- | ------ | -------- |
| job_id              | string | yes      |
| participant_user_id | string | yes      |

**Response (200):**

```json
{
  "conversation_id": "uuid",
  "job_id": "uuid",
  "applicant_user_id": "uuid",
  "sponsor_user_id": "uuid",
  "status": "ACTIVE"
}
```

Note: Users must be matched for the job.

---

### GET `/api/messages/conversations/`

List all conversations for the authenticated user. Supports pagination (PR #22).

- **Auth**: Required
- **Query**: `limit` (optional, default 20), `offset` (optional, default 0)

**Response (200):**

```json
{
  "conversations": [
    {
      "CONVERSATION_ID": "uuid",
      "JOB_ID": "uuid",
      "APPLICANT_USER_ID": "uuid",
      "SPONSOR_USER_ID": "uuid",
      "STATUS": "ACTIVE",
      "APPLICANT_HAS_UNREAD": false,
      "SPONSOR_HAS_UNREAD": true,
      "APPLICANT_FIRST_NAME": "string",
      "SPONSOR_FIRST_NAME": "string",
      "TITLE": "string"
    }
  ],
  "total_count": 42
}
```

---

### POST `/api/messages/send/`

Send a message in a conversation.

- **Auth**: Required

| Field           | Type   | Required | Notes             |
| --------------- | ------ | -------- | ----------------- |
| conversation_id | string | yes      |                   |
| body            | string | yes      | 1-2000 characters |

**Response (201):** `{"message_id": "uuid"}`

---

### GET `/api/messages/history/?conversation_id=<uuid>`

Get message history for a conversation.

- **Auth**: Required
- **Query**: `conversation_id` (required), `limit` (optional, default 50, max 200)

**Response (200):**

```json
{
  "messages": [
    {
      "MESSAGE_ID": "uuid",
      "CONVERSATION_ID": "uuid",
      "SENDER_ID": "uuid",
      "BODY": "string",
      "CREATED_AT": "timestamp",
      "SENDER_FIRST_NAME": "string",
      "SENDER_PHOTO_URL": "string | null"
    }
  ]
}
```

---

### POST `/api/messages/unmatch/`

Unmatch users (closes the conversation).

- **Auth**: Required

| Field           | Type   | Required |
| --------------- | ------ | -------- |
| conversation_id | string | yes      |

**Response (200):** `{"status": "CLOSED"}`

---

## Documents & Resume

### POST `/api/upload/image/`

Upload a profile image.

- **Auth**: Required
- **Content-Type**: `multipart/form-data`
- **Field**: `image` (file, max 10MB, jpeg/png/gif/webp)

**Response (201):**

```json
{
  "image_id": "uuid",
  "cdn_url": "https://backchannel-media.nyc3.cdn.digitaloceanspaces.com/images/profiles/<user_id>/<timestamp>_photo.jpg",
  "filename": "string",
  "file_size": 12345,
  "content_type": "image/jpeg",
  "message": "Image uploaded successfully"
}
```

> **Note:** Images are stored on DigitalOcean Spaces with `ACL: public-read`. `cdn_url` is always present and publicly reachable. Use this URL with `PATCH /api/profile/update/ { photo_url: cdn_url }` to persist it.

---

### POST `/api/upload/file/`

Upload a file (image or PDF).

- **Auth**: Required
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (file, max 10MB images / 25MB PDFs)

**Response (201):**

```json
{
  "document_id": "uuid",
  "stage_path": "string",
  "filename": "string",
  "file_size": 12345,
  "content_type": "application/pdf",
  "file_type": "pdf",
  "message": "Pdf uploaded successfully"
}
```

---

### POST `/api/upload-and-parse/`

Upload and parse a file in one step (extracts text, stores in profile).

- **Auth**: Required
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (file)

**Response (201):**

```json
{
  "document_id": "uuid",
  "stage_path": "string",
  "filename": "string",
  "file_size": 12345,
  "content_type": "application/pdf",
  "file_type": "pdf",
  "extracted_text": "string | null",
  "message": "Pdf uploaded, parsed, and stored in applicant profile successfully"
}
```

---

### POST `/api/parse/document/`

Parse a previously uploaded document.

- **Auth**: Required

| Field     | Type   | Required |
| --------- | ------ | -------- |
| file_id   | string | yes      |
| file_type | string | no       |

**Response (200):**

```json
{
  "file_id": "uuid",
  "filename": "string",
  "file_type": "document",
  "extracted_text": "string",
  "message": "Document parsed successfully and stored in applicant profile"
}
```

---

### POST `/api/resume/`

Save resume data (JSON) to applicant profile.

- **Auth**: Required

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| resume_data | object | yes      |

**Response (200):** `{"message": "Resume data saved successfully", "user_id": "uuid"}`

---

### PATCH `/api/resume/update/`

Update specific resume fields.

- **Auth**: Required
- **Body**: Any fields to merge into resume_data

**Response (200):**

```json
{
  "message": "Resume data updated successfully",
  "updated_fields": ["field1"],
  "resume_data": {}
}
```

---

### GET `/api/resume/extracted-text/`

Get extracted resume text.

- **Auth**: Required

**Response (200):**

```json
{
  "extracted_resume_text": "string | null",
  "updated_at": "timestamp | null",
  "message": "Resume text retrieved successfully"
}
```

---

## Notifications

### `GET /api/notifications/`

List notifications for the authenticated user (newest first, paginated).

**Auth:** Bearer token required

**Query Parameters:**

| Param         | Type | Default | Description                               |
| ------------- | ---- | ------- | ----------------------------------------- |
| `limit`       | int  | 20      | Page size                                 |
| `offset`      | int  | 0       | Offset for pagination                     |
| `unread_only` | bool | false   | If true, only return unread notifications |

**Response (200):**

```json
{
  "notifications": [
    {
      "NOTIFICATION_ID": "uuid",
      "USER_ID": "uuid",
      "TYPE": "match | message | referral | connection | profile_update",
      "TITLE": "string",
      "BODY": "string",
      "IS_READ": false,
      "RELATED_USER_ID": "uuid | null",
      "RELATED_JOB_ID": "uuid | null",
      "RELATED_CONVERSATION_ID": "uuid | null",
      "CREATED_AT": "2026-02-25T10:00:00"
    }
  ],
  "total_count": 1
}
```

### `GET /api/notifications/unread-count/`

Returns the unread notification count (for badge display).

**Auth:** Bearer token required

**Response (200):**

```json
{
  "unread_count": 3
}
```

### `PATCH /api/notifications/<notification_id>/read/`

Mark a single notification as read.

**Auth:** Bearer token required

**Response (200):**

```json
{
  "message": "Notification marked as read"
}
```

**Response (404):** Notification not found or not owned by user.

### `PATCH /api/notifications/read-all/`

Mark all unread notifications as read for the authenticated user.

**Auth:** Bearer token required

**Response (200):**

```json
{
  "message": "All notifications marked as read",
  "count": 5
}
```

### Notification Triggers

Notifications are automatically created by the backend when:

| Event                              | Notification Type | Recipients             |
| ---------------------------------- | ----------------- | ---------------------- |
| Mutual match (applicant ↔ sponsor) | `match`           | Both users             |
| New message sent                   | `message`         | Conversation recipient |

Additional types (`referral`, `connection`, `profile_update`) are defined in the schema but not yet wired.

### Notification Preferences

Users can control which notification types they receive by updating `notification_preferences` via `PATCH /api/profile/update/`:

```json
{
  "notification_preferences": {
    "match": true,
    "message": false,
    "referral": true,
    "connection": true,
    "profile_update": true
  }
}
```

If a type is set to `false`, no notification is created for that event. If preferences are not set, all types default to enabled.

---

## Referrals

### `POST /api/referrals/submit/`

Sponsor submits a referral for a matched applicant. Requires an existing match (both sides liked).

**Auth:** Bearer token required (sponsor role only)

**Request body:**

```json
{
  "applicant_user_id": "uuid",
  "job_id": "uuid",
  "confidence_checks": {
    "has_messaged": true,
    "feels_confident": true,
    "knows_background": true,
    "comfortable_attaching": true
  },
  "referral_note": "Strong candidate with relevant experience"
}
```

**Validation chain:**

1. Caller must have `ROLE_TYPE = 'Sponsor'` (403 otherwise)
2. A MATCHED like must exist for this sponsor/applicant/job (403 otherwise)
3. No active referral may exist for the same trio (400 otherwise)

**Response (201):**

```json
{
  "referral_id": "uuid",
  "status": "REFERRED",
  "message": "Referral submitted successfully"
}
```

Triggers a `referral` notification to the applicant.

### `GET /api/referrals/`

List referrals for the authenticated user. Role-aware: sponsors see referrals they submitted, applicants see referrals submitted for them.

**Auth:** Bearer token required

**Query Parameters:**

| Param    | Type | Default | Description           |
| -------- | ---- | ------- | --------------------- |
| `limit`  | int  | 20      | Page size             |
| `offset` | int  | 0       | Offset for pagination |

**Response (200):**

```json
{
  "referrals": [
    {
      "REFERRAL_ID": "uuid",
      "STATUS": "REFERRED",
      "JOB_TITLE": "Senior Engineer",
      "JOB_COMPANY": "Acme Corp",
      "APPLICANT_FIRST_NAME": "John",
      "CREATED_AT": "2026-02-25T10:00:00"
    }
  ],
  "total_count": 1
}
```

### `GET /api/referrals/<referral_id>/`

Get single referral detail. User must be the referring sponsor or the referred applicant.

**Auth:** Bearer token required

**Response (200):** Full referral object with sponsor name, applicant name, job title, confidence checks, and note.

**Response (404):** Referral not found or not accessible to this user.

### `PATCH /api/referrals/<referral_id>/withdraw/`

Sponsor withdraws a referral. Only the submitting sponsor can withdraw.

**Auth:** Bearer token required (submitting sponsor only)

**Response (200):**

```json
{
  "message": "Referral withdrawn",
  "status": "WITHDRAWN"
}
```

**Response (403):** Only the referring sponsor can withdraw.
**Response (400):** Referral is already withdrawn.

### Referral Statuses

Only statuses we can definitively track are used:

| Status      | Meaning                                 |
| ----------- | --------------------------------------- |
| `REFERRED`  | Sponsor submitted the referral          |
| `WITHDRAWN` | Sponsor or system withdrew the referral |

Richer statuses (Interviewing, Offered, Accepted, Rejected) will be added when ATS integration provides reliable data.

---

## Devices (Push Notifications)

### `POST /api/devices/register/`

Register a device token for push notification delivery. Call on login after obtaining push permission from the OS.

**Auth:** Required (JWT)

**Request body:**

```json
{
  "device_token": "fcm-token-from-mobile-app",
  "platform": "ios"
}
```

`platform` must be one of: `ios`, `android`, `expo`.

**Response (200):**

```json
{
  "token_id": "uuid",
  "message": "Device registered"
}
```

Idempotent: re-registering the same token re-activates it if previously deactivated.

### `POST /api/devices/unregister/`

Deactivate a device token (e.g. on logout). The token is not deleted, just marked inactive.

**Auth:** Required (JWT)

**Request body:**

```json
{
  "device_token": "fcm-token-from-mobile-app"
}
```

**Response (200):**

```json
{
  "message": "Device unregistered"
}
```

### Push Notification Payload

When a notification is created (match, message, referral), a push is sent to all active devices for that user. The push payload contains:

```json
{
  "notification": {
    "title": "New Match!",
    "body": "You matched with Emily Rodriguez for Senior Backend Engineer at Stripe"
  },
  "data": {
    "type": "match",
    "notification_id": "uuid",
    "related_user_id": "uuid",
    "related_job_id": "uuid",
    "related_conversation_id": null
  }
}
```

The `data` payload allows the mobile app to deep-link to the relevant screen when the push is tapped.

---

## WebSocket — Real-Time Chat

### `ws://<host>/ws/chat/<conversation_id>/?token=<jwt_access_token>`

Establishes a real-time WebSocket connection for a conversation. The JWT access token is passed as a query parameter since WebSocket connections cannot send custom HTTP headers.

**Server:** Daphne ASGI (same host and port as the REST API).

**Close codes:**

- `4001` — Missing or invalid JWT token
- `4003` — Authenticated user is not a participant in the conversation

**Client sends (to send a message):**

```json
{ "type": "chat.message", "body": "Hello!" }
```

**Server broadcasts (to all connected participants):**

```json
{
  "type": "chat.message",
  "message_id": "uuid",
  "sender_user_id": "uuid",
  "body": "Hello!",
  "created_at": "2026-02-25T12:00:00Z"
}
```

**Server sends (on error):**

```json
{ "type": "error", "message": "Conversation is closed" }
```

Messages sent via the HTTP REST endpoint (`POST /api/messages/send/`) are also broadcast to connected WebSocket clients on the same conversation, keeping both transports in sync.

**Production URL:** `wss://oyster-app-4pg5w.ondigitalocean.app/ws/chat/<conversation_id>/?token=<jwt>`

---

## Appendix: Frontend Questionnaire → Backend Field Mapping

### Applicant Questionnaire

| Step | Frontend Field  | Backend Registration Field | Status                                                                    |
| ---- | --------------- | -------------------------- | ------------------------------------------------------------------------- |
| -    | firstName       | `first_name` / `firstName` | Ready                                                                     |
| -    | lastName        | `last_name` / `lastName`   | Ready                                                                     |
| -    | email           | `email`                    | Ready                                                                     |
| -    | password        | `password`                 | Ready                                                                     |
| 1    | targetIndustry  | `industry`                 | Ready                                                                     |
| 2    | currentRole     | `current_role`             | Ready — Migration 003                                                     |
| 3    | seekingPosition | `positions` (array)        | Ready (store as `["Senior Product Lead"]`)                                |
| 4    | skills          | `skills` (array)           | Ready                                                                     |
| 5    | insights        | `insights` (array)         | Ready — Migration 003                                                     |
| 6    | resumeUrl       | _Not in registration_      | **Separate flow** — call `POST /api/upload-and-parse/` after registration |

### Sponsor Questionnaire

| Step | Frontend Field  | Backend Registration Field | Status                                       |
| ---- | --------------- | -------------------------- | -------------------------------------------- |
| -    | firstName       | `first_name`               | Ready                                        |
| -    | lastName        | `last_name`                | Ready                                        |
| -    | email           | `email`                    | Ready                                        |
| -    | password        | `password`                 | Ready                                        |
| 1    | company         | `company`                  | Ready                                        |
| 2    | jobTitle        | `job_title`                | Ready                                        |
| 3    | yearsAtCompany  | `duration`                 | Ready (send as `"3-5 years"`)                |
| 4    | openToReferrals | `open_to_referrals`        | Ready (convert `"Yes, absolutely"` → `true`) |
| 5    | pastReferrals   | `referral_experience`      | Ready (convert `"Frequently"` → `true`)      |
| 6    | referralBonus   | `financial_reward`         | Ready (convert `"Yes"` → `"yes"`)            |
| 7    | insights        | `insights` (array)         | Ready — Migration 003                        |
| 8    | workEmail       | `work_email`               | Ready                                        |

### All Questionnaire Gaps Closed

All registration fields are now supported by the backend, including `current_role` (Migration 003) and `insights` (Migration 003) for both roles. Resume upload uses the separate `POST /api/upload-and-parse/` flow after registration.

# Backend Architecture

**Stack:** Django REST Framework + Django Channels (WebSocket) + **PostgreSQL** (direct SQL via psycopg2, no ORM) + Snowflake (Cortex AI only — resume parsing, autofill, classification) + Redis (caching + pub/sub) + Firebase Cloud Messaging (push notifications) + Daphne (ASGI) + Docker
**Auth:** JWT via `djangorestframework-simplejwt` with custom PostgreSQL-backed user model

![Architecture Diagram](backchannel_architecture.png)

![Request Flow](backchannel_request_flow.png)

![Data Model](backchannel_data_model.png)

---

## Layered Architecture

All backend code lives in `bc_microservices/`. Requests flow through three layers:

```
HTTP Request                 WebSocket Connection
    |                              |
    v                              v
  Views (DRF)               ChatConsumer (Channels)
    |                              |
    +------------ + ---------------+
                  |
                  v
             Services       (business logic, orchestration, domain rules)
                  |
                  v
             Queries        (raw PostgreSQL SQL via psycopg2; Snowflake queries for Cortex AI only)
```

**Views** are thin — they extract parameters from the request, call a service function, and translate the `Result` into an HTTP response.

**Consumers** are the WebSocket equivalent of views — they accept connections, receive JSON messages, call the same service functions, and broadcast results to channel groups.

**Services** contain all business logic. They return `Result` objects (success/error tuples) and never touch Django request/response objects or WebSocket scopes.

**Queries** are pure data access — each function runs a single SQL statement and returns a DataFrame or scalar.

---

## Module Layout

### Views (HTTP layer)

| File                     | Domain           | Endpoints                                                                                  |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| `views_auth.py`          | Authentication   | login, register, password reset, change password, deactivate                               |
| `views_profiles.py`      | Profiles         | get/update user, applicant, sponsor profiles; profile packs                                |
| `views_jobs.py`          | Jobs             | ATS jobs, sponsored jobs, job pack, browse, sponsor, create, apply, waitlist, feed actions |
| `views_matching.py`      | Matching         | likes (job + profile), matches (applicant + sponsor), applicant likes per job              |
| `views_messaging.py`     | Messaging        | conversations, messages, history, unmatch                                                  |
| `views_documents.py`     | Documents        | image upload, file upload, parse, resume management                                        |
| `views_notifications.py` | Notifications    | list, unread count, mark read, mark all read                                               |
| `views_referrals.py`     | Referrals        | submit, list, detail, withdraw                                                             |
| `views_devices.py`       | Devices          | device token registration/unregistration for push notifications                            |
| `views_helpers.py`       | Shared utilities | `respond()` (Result→Response), `parse_pagination()`                                        |
| `views.py`               | Re-export shim   | Imports all view functions so `urls.py` has a single import source                         |

### WebSocket layer

| File           | Purpose                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `consumers.py` | `ChatConsumer` — WebSocket handler for real-time messaging (connect, send/receive, disconnect)  |
| `ws_auth.py`   | `JWTAuthMiddleware` — validates JWT from query string, attaches `BackChannelUser` to ASGI scope |
| `routing.py`   | WebSocket URL patterns (`ws/chat/<conversation_id>/`)                                           |

### Services (business logic)

| File                        | Responsibilities                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `services/auth.py`          | Password hashing, reset token generation/validation, account deactivation                                                     |
| `services/profiles.py`      | Profile field validation, update orchestration, profile pack assembly                                                         |
| `services/jobs.py`          | Job pack building (ATS + sponsored mix), browse filtering, sponsorship flow, application logic                                |
| `services/matching.py`      | Like/match detection, mutual-match checks, match listing with enrichment                                                      |
| `services/messaging.py`     | Conversation creation with match verification, message sending, unread flag management, WebSocket broadcast                   |
| `services/documents.py`     | File validation, S3/DigitalOcean Spaces upload, document parsing (Snowflake Cortex AI), resume text extraction                |
| `services/notifications.py` | Notification creation with preference gating, read/unread management                                                          |
| `services/referrals.py`     | Referral submission with match validation, role-aware listing, withdrawal                                                     |
| `services/push.py`          | FCM push notification delivery via `firebase-admin` SDK. Lazy-init, best-effort (never raises), auto-deactivates stale tokens |

### Queries (data access)

| File                       | Tables Accessed                                                       |
| -------------------------- | --------------------------------------------------------------------- |
| `queries/users.py`         | USERS                                                                 |
| `queries/profiles.py`      | USER_PROFILES, APPLICANT_PROFILES, SPONSOR_PROFILES                   |
| `queries/jobs.py`          | SILVER_JOBS (RAW_ATS), JOB_POSTINGS, JOB_FEED_HISTORY, WAITLIST       |
| `queries/likes.py`         | LIKES (job + profile)                                                 |
| `queries/messaging.py`     | CONVERSATIONS, MESSAGES                                               |
| `queries/documents.py`     | Snowflake stages (Cortex AI pipeline only — resume parsing, autofill) |
| `queries/notifications.py` | NOTIFICATIONS                                                         |
| `queries/referrals.py`     | REFERRALS                                                             |
| `queries/devices.py`       | DEVICE_TOKENS                                                         |
| `queries/shared.py`        | Common utilities (execute_query, sanitize_for_json)                   |

### Cross-cutting

| File                 | Purpose                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `cache.py`           | Redis caching helpers (`cached_query`, `invalidate`) with TTL constants                      |
| `constants.py`       | Centralised magic numbers (pagination defaults, file size limits, token expiry, rate limits) |
| `middleware.py`      | JSON error middleware (catches unhandled exceptions, returns structured JSON in production)  |
| `throttles.py`       | DRF rate limiting classes (login, registration, password reset)                              |
| `custom_jwt.py`      | JWT authentication against PostgreSQL USERS table                                            |
| `backends.py`        | Custom authentication backend for PostgreSQL                                                 |
| `serializers.py`     | DRF serializers for input validation on auth endpoints                                       |
| `pg_utils.py`        | PostgreSQL connection management via psycopg2 (replaces `snowflake_utils.py` after PR #25)   |
| `snowflake_utils.py` | **Cortex AI only** — Snowflake connection for document parsing and autofill pipeline         |
| `snowflake_user.py`  | Minimal user model for DRF compatibility (retained for backwards compat)                     |

---

## Key Design Decisions

- **No Django ORM.** All OLTP data lives in **PostgreSQL** (DigitalOcean Managed Database, PR #25). We use raw SQL via `psycopg2` with `DictCursor`. Snowflake is retained **only** for Cortex AI queries (resume parsing, autofill, classification) via `snowflake-connector-python`. Previous per-thread connection pooling overhead (3–5s TLS) is now negligible with PostgreSQL's fast connection times.
- **UPPERCASE column names.** The PostgreSQL connection layer (`pg_utils.py`) uppercases column names for full backwards compatibility with Snowflake-era frontend code. No frontend changes required.
- **JSONB columns (arrive as JSON strings).** Complex fields (SKILLS, POSITIONS, RESUME_DATA) are stored as PostgreSQL `JSONB` and cast to `TEXT` via `::TEXT` before delivery. The existing `_parseVariant()` / `JSON.parse()` pattern in the frontend stores works unchanged.
- **Redis caching (optional).** When `REDIS_URL` is set, hot-path queries are cached via `django-redis`, reducing repeated PostgreSQL query overhead to sub-millisecond. Falls back to `FileBasedCache` when Redis is unavailable. Caching is transparent at the query layer; invalidation happens in the service layer when data mutates.
- **WebSocket messaging via Django Channels.** Real-time chat uses `channels` + `channels-redis` with Daphne as the ASGI server. JWT is passed as a `?token=` query parameter since WebSocket connections cannot send custom headers. Each conversation has a Redis-backed channel group (`chat_{conversation_id}`). Messages sent via HTTP REST are also broadcast to the group, keeping both transports in sync. Falls back to `InMemoryChannelLayer` when Redis is unavailable.
- **Push notifications via FCM.** When `FIREBASE_CREDENTIALS_JSON` (or `FIREBASE_CREDENTIALS_B64`) is set, `create_notification()` also delivers a push via Firebase Cloud Messaging. The Firebase Admin SDK is lazily initialized on first use and gracefully degrades to no-op when credentials are absent. Invalid/unregistered device tokens are automatically deactivated. The mobile app registers its device token via `POST /api/devices/register/` on login.
- **DEBUG=False in production.** The JSON error middleware ensures all 500 errors return structured JSON instead of Django's HTML debug page.

---

## Testing

- **Unit tests:** `bc_microservices/tests/` — mock service-layer functions, test view responses and business logic in isolation. 222 tests across 15 test modules (includes WebSocket consumer, auth middleware, and push notification tests).
- **Integration tests:** `scripts/integration_test.sh` — builds Docker image, starts Django + PostgreSQL + Redis containers on an isolated Docker network, runs end-to-end HTTP tests with `curl` against real endpoints using real auth tokens. Includes deep pipeline tests (real PDF upload → Cortex AI parsing → DB persistence verification). Test functions are organized in `scripts/integration/` (one file per section) and sourced by the main script.
- **Coverage matrix:** `scripts/test_coverage_report.py` — unified runner that executes unit and/or integration tests and generates `docs/TEST_COVERAGE_MATRIX.md` mapping every endpoint to its test status.

For local development with Redis (optional):

```bash
docker-compose up        # starts Django + Redis
docker-compose down      # stops both
```

Run everything and generate the coverage report:

```bash
python scripts/test_coverage_report.py --all
```

Or run selectively:

```bash
python scripts/test_coverage_report.py --unit            # unit tests only
python scripts/test_coverage_report.py --integration     # integration tests only (Docker)
python scripts/test_coverage_report.py --report-only     # regenerate from cached results
```

Run specific integration test sections for fast iteration:

```bash
./scripts/integration_test.sh --section documents                       # just document pipeline
./scripts/integration_test.sh --skip-build --keep --section profiles    # reuse container
./scripts/integration_test.sh --list                                    # show all sections
```

Available sections: `health`, `auth`, `profiles`, `jobs`, `matching`, `messaging`, `notifications`, `referrals`, `documents`, `unmatch`, `infra`, `account`. Dependencies are auto-resolved (e.g., `messaging` pulls in `matching` → `jobs`; `referrals` pulls in `matching` → `jobs`).

Integration test file structure:

```
scripts/
  integration_test.sh          # orchestrator: config, arg parsing, Docker, main()
  integration/
    helpers.sh                 # shared helpers: _get, _post, assert_status, json_*, etc.
    setup.sh                   # register + login both users (runs unconditionally)
    test_health.sh             # one file per section (sourced on demand)
    test_auth.sh
    test_profiles.sh
    test_jobs.sh
    test_matching.sh
    test_messaging.sh
    test_notifications.sh
    test_referrals.sh
    test_documents.sh
    test_unmatch.sh
    test_infra.sh
    test_account.sh
```

The endpoint-to-test mapping lives in `scripts/test_endpoint_map.json`. When adding new tests, add the corresponding entry to this file so the coverage matrix stays accurate.

---

## Refactor History

This architecture was established through a systematic refactoring:

1. **Module split** — Broke a monolithic `views.py` (~2000 lines) into 8 domain-specific view modules (auth, profiles, jobs, matching, messaging, notifications, referrals, documents).
2. **Service layer** — Extracted business logic from views into `services/` package, starting with matching as a proof-of-concept, then rolling out to all 8 domains.
3. **Query layer** — Extracted all raw SQL into `queries/` package, giving each domain its own data access module.
4. **Error handling** — Added JSON error middleware and DRF throttling for production readiness.
5. **Input validation** — Added DRF serializers for auth endpoints.
6. **Housekeeping** — Extracted `views_helpers.py` (shared `respond()` + `parse_pagination()`), created `constants.py` (centralised magic numbers), eliminated raw SQL from the service layer, and split the monolithic `integration_test.sh` into sourced per-section files under `scripts/integration/`.
7. **Redis caching** — Added `django-redis` with optional `REDIS_URL` env var (falls back to FileBasedCache). Created `cache.py` with `cached_query`/`invalidate` helpers. Instrumented 8 hot-path queries with caching at the query layer and added cache invalidation at the service layer. Integration tests now spin up a Redis container alongside Django on a shared Docker network.
8. **WebSocket messaging** — Added Django Channels with `channels-redis` for real-time chat. Created `ChatConsumer`, `JWTAuthMiddleware` (query-string token auth), and `routing.py`. Replaced Gunicorn with Daphne (ASGI server) to serve both HTTP and WebSocket on the same port. HTTP `send_message` also broadcasts to the channel group so both transports stay in sync. Redis DB 1 is used for the channel layer (DB 0 for caching).
9. **Snowflake connection pooling** — Replaced per-query connection creation in `snowflake_utils.py` with thread-local pooling via `threading.local()`. Each Snowflake connection previously incurred ~4-6s of TLS handshake + authentication; now only the first query per thread pays that cost. Includes `SELECT 1` health check before reuse, transparent reconnect on `DatabaseError`, and proper cursor cleanup. Benchmarked at ~18x throughput improvement on multi-query workloads.
10. **FCM push notifications** — Added Firebase Cloud Messaging delivery to the existing notification system. When `create_notification()` fires, it now also sends a push to all registered devices for that user. New `DEVICE_TOKENS` table (Migration 006), `queries/devices.py`, `services/push.py`, and `views_devices.py` (register/unregister endpoints). Firebase SDK is lazily initialized and gracefully degrades when credentials are absent. Stale tokens are auto-deactivated on FCM rejection.
11. **Demo data seeder** — Added `python manage.py seed_demo_data` management command that populates Snowflake with rich, realistic synthetic data covering every display path: applicants (varied profile completeness), sponsors, sponsored jobs, likes, matches, conversations with message threads, and referrals. Supports `--round2` for additive second batch, `--force` for wipe-and-reseed, `--clean` for removal. All demo users namespaced by `@demo.backchannel.app`.

---

## WebSocket Protocol

**Connect:** `ws://<host>/ws/chat/<conversation_id>/?token=<jwt_access_token>`

Close codes:

- `4001` — Missing or invalid JWT token
- `4003` — User is not a participant in the conversation

**Client sends (to send a message):**

```json
{ "type": "chat.message", "body": "Hello!" }
```

**Server broadcasts (new message to all participants):**

```json
{
  "type": "chat.message",
  "message_id": "uuid",
  "sender_user_id": "uuid",
  "body": "Hello!",
  "created_at": "2026-02-25T12:00:00Z"
}
```

**Server sends (on error):**

```json
{ "type": "error", "message": "Conversation is closed" }
```

Messages sent via the HTTP REST endpoint (`POST /api/messages/send/`) are also broadcast to connected WebSocket clients on the same conversation.

---

## Roadmap

See [FRONTEND_BACKEND_GAP_AUDIT.md](FRONTEND_BACKEND_GAP_AUDIT.md) for the full screen-by-screen analysis.

### Phase 1 — Beta Launch (Feature Gaps)

| Priority | Item                                                                                                                   | Effort | Status                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| **P0**   | Rich profile schema (bio, address, work history, education, certifications, languages, achievements, work preferences) | Large  | **Done** — Migration 003 + 21 new columns across 3 tables                                |
| **P0**   | Referral submission flow                                                                                               | Medium | **Done** — Migration 005 + 4 endpoints, match validation, notification trigger, withdraw |
| **P1**   | Public profile endpoint                                                                                                | Small  | **Done** — `GET /api/profiles/<id>/public/` with privacy filtering                       |
| **P1**   | Insights storage (questionnaire personality data)                                                                      | Small  | **Done** — VARIANT column on both profile tables, wired through registration + updates   |
| **P1**   | Notifications system                                                                                                   | Medium | **Done** — Migration 004 + 4 endpoints, match/message triggers, preference gating        |

**Phase 1 is complete.** All feature gaps for beta launch have been closed.

### Phase 2 — Post-Beta (Infrastructure)

| Priority   | Item                                      | Effort       | Why                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **High**   | ~~Add Redis caching layer~~               | Small        | **Done** — `django-redis` + `cache.py` utility module. 8 hot-path queries cached (sponsor info, user basic, unread counts, job lookups, public profiles). Graceful fallback to FileBasedCache when Redis unavailable.                                                                                                                  |
| **High**   | Introduce Postgres for transactional data | Large        | Snowflake is an OLAP warehouse, not designed for the high-frequency small read/write pattern of swiping and messaging. Standard pattern: Postgres for the app (OLTP), Snowflake for analytics (OLAP). The isolated query layer makes this migration manageable.                                                                        |
| **Medium** | ~~WebSocket support for messaging~~       | Medium       | **Done** — Django Channels + `channels-redis` + Daphne ASGI server. `ChatConsumer` with JWT auth middleware, per-conversation channel groups, HTTP→WebSocket broadcast bridge. `ws/chat/<conversation_id>/?token=<jwt>`                                                                                                                |
| **Medium** | S3/R2 for file storage with CDN           | Small-Medium | Snowflake stages are meant for data loading, not general-purpose file serving. Profile images and documents at scale need a proper object store with CDN.                                                                                                                                                                              |
| **Medium** | Background job processing (Celery)        | Medium       | Resume parsing, notification dispatch, and match computation could run asynchronously instead of blocking the HTTP request.                                                                                                                                                                                                            |
| **Low**    | ~~Connection pooling for Snowflake~~      | Small        | **Done** — Thread-local connection pooling in `snowflake_utils.py`. Connections are reused within the same thread, eliminating ~4-6s of TLS handshake + Snowflake auth overhead per query. Health check before reuse with transparent reconnect on stale connections. Benchmarked at ~18x improvement on seed workload (28 min → 91s). |

### Phase 3 — Growth (Deferred)

| Item                                                                    | Notes                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Application status tracking (Applied → Referred → Interview → Decision) | Deferred until ATS integration is available; low value without real pipeline data                            |
| Email verification (sponsor)                                            | Currently faked with setTimeout                                                                              |
| LinkedIn OAuth                                                          | Alternate auth method                                                                                        |
| Chat file attachments                                                   | Nice-to-have for messaging                                                                                   |
| ~~Notification preferences storage~~                                    | **Closed** — `NOTIFICATION_PREFERENCES` VARIANT on `USER_PROFILES`, exposed via `PATCH /api/profile/update/` |
| Subscription/payment verification                                       | RevenueCat handles client-side; may need server-side receipt validation                                      |

### Architecture North Star

```
Mobile Apps (React Native)
    │
    ▼
  CDN (images, static)          WebSocket Gateway (messaging)
    │                                │
    ▼                                ▼
  Django REST API ◄──── Redis (cache + pub/sub)
    │
    ├──► Postgres (users, matches, messages, likes — OLTP)
    ├──► Snowflake (analytics, job data, feed history — OLAP)
    ├──► S3/R2 (files, images, resumes)
    └──► Celery + Redis (background jobs: parsing, notifications, matching)
```

The current architecture (Django → Snowflake for everything) is a stepping stone. The 3-layer separation and isolated query layer were designed specifically to make the transition to this target architecture incremental rather than a rewrite.

# Frontend Wiring Guide

**Target repo:** `/Users/nico_rode/Desktop/BackchannelV2-wiring` (copy of `BackchannelV2`)
**Backend:** `https://oyster-app-4pg5w.ondigitalocean.app`
**Scope:** Phase 1 (auth + profile) and Phase 2 (feed, matches, messages, notifications)

The backend is live and fully functional. The API client (`lib/api.ts`) already points at the production URL and handles Bearer token injection. All changes are frontend-only.

---

## Key Conventions

- **Backend returns UPPERCASE keys** (Snowflake column names): `USER_ID`, `FIRST_NAME`, `SKILLS`, etc.
- **VARIANT columns** (JSON) may come as strings — parse with `JSON.parse()` if needed.
- **Paginated endpoints** accept `?limit=N&offset=M` query params.
- **All UUIDs** are v4 format.
- **Auth header:** `Authorization: Bearer <access_token>` — handled automatically by `ApiClient`.

---

## Phase 1: Auth, Registration, Profile

### 1.1 Wire Registration (Applicant Questionnaire)

**File:** `components/ApplicantQuestionnaire.tsx`
**Backend:** `POST /api/register/` (no auth)

The questionnaire collects: firstName, lastName, email, password, targetIndustry, currentRole, seekingPosition, skills, insights.

Currently calls `authApi.createProfile()` which returns mock tokens. Replace with a real registration call.

**File to change:** `lib/auth-api.ts`

Replace the `createProfile` function. For applicants, call `POST /api/register/` with this field mapping:

```typescript
// In lib/auth-api.ts — replace createProfile

createProfile: async (data: CreateProfileRequest): Promise<RegisterResponse> => {
  const isApplicant = data.userType === 'applicant';
  const endpoint = isApplicant ? '/api/register/' : '/api/register-sponsor/';

  const payload: Record<string, any> = {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    password: data.password,
    role: isApplicant ? 'Applicant' : 'Sponsor',
  };

  if (isApplicant) {
    payload.industry = data.profileData?.targetIndustry || '';
    payload.current_role = data.profileData?.currentRole || '';
    payload.positions = data.profileData?.seekingPosition
      ? [data.profileData.seekingPosition] : [];
    payload.skills = data.profileData?.skills || [];
    payload.insights = data.profileData?.insights || [];
  } else {
    payload.company = data.profileData?.company || '';
    payload.job_title = data.profileData?.jobTitle || '';
    payload.duration = data.profileData?.yearsAtCompany || '';
    payload.open_to_referrals = data.profileData?.openToReferrals ?? true;
    payload.referral_experience = data.profileData?.pastReferrals ?? false;
    payload.financial_reward = data.profileData?.referralBonus === 'yes' ? 'yes' : 'no';
    payload.work_email = data.profileData?.workEmail || '';
    payload.insights = data.profileData?.insights || [];
  }

  return api.post<RegisterResponse>(endpoint, payload, true); // skipAuth = true
},
```

**Response (201):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "username": "auto-derived",
  "profile_id": "uuid",
  "role": "Applicant",
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token"
}
```

After this call succeeds, call `setAuthTokens(response.access_token, response.refresh_token)` — the questionnaire components should already do this.

---

### 1.2 Wire Profile Updates

**File:** `lib/auth-api.ts`
**Backend:** `PATCH /api/profile/update/` (auth required)

Replace the mock `updateProfile` function:

```typescript
updateProfile: async (data: UpdateProfileRequest): Promise<any> => {
  const payload: Record<string, any> = {};

  // General profile fields → PATCH /api/profile/update/
  if (data.personal?.firstName) payload.first_name = data.personal.firstName;
  if (data.personal?.lastName) payload.last_name = data.personal.lastName;
  if (data.personal?.phone) payload.phone_number = data.personal.phone;
  if (data.personal?.linkedin) payload.linked_in = data.personal.linkedin;
  if (data.personal?.portfolio) payload.portfolio_url = data.personal.portfolio;
  if (data.personal?.address?.city) payload.city = data.personal.address.city;
  if (data.personal?.address?.state) payload.state = data.personal.address.state;
  if (data.personal?.address?.street) payload.street = data.personal.address.street;
  if (data.personal?.address?.zip) payload.zip = data.personal.address.zip;
  if (data.personal?.address?.country) payload.country = data.personal.address.country;

  return api.patch('/api/profile/update/', payload);
},
```

For applicant-specific fields, add a new function:

```typescript
updateApplicantProfile: async (data: any): Promise<any> => {
  const payload: Record<string, any> = {};
  if (data.skills) payload.skills = data.skills;
  if (data.insights) payload.insights = data.insights;
  if (data.currentRole) payload.current_role = data.currentRole;
  if (data.targetIndustry) payload.industry = data.targetIndustry;
  if (data.seekingPosition) payload.positions = [data.seekingPosition];
  if (data.yearsExperience) payload.years_experience = data.yearsExperience;
  if (data.achievements) payload.achievements = data.achievements;
  if (data.professionalExperiences) payload.professional_experiences = data.professionalExperiences;
  if (data.educationEntries) payload.education_entries = data.educationEntries;
  if (data.certifications) payload.certifications = data.certifications;
  if (data.languages) payload.languages = data.languages;
  if (data.workPreferences) payload.work_preferences = data.workPreferences;
  if (data.desiredRoles) payload.desired_roles = data.desiredRoles;
  return api.patch('/api/profile/applicant/update/', payload);
},
```

For sponsor-specific fields:

```typescript
updateSponsorProfile: async (data: any): Promise<any> => {
  const payload: Record<string, any> = {};
  if (data.company) payload.company = data.company;
  if (data.jobTitle) payload.job_title = data.jobTitle;
  if (data.insights) payload.insights = data.insights;
  return api.patch('/api/profile/sponsor/update/', payload);
},
```

Then update `useUserProfileStore.syncToBackend()` to call the real functions instead of the mock.

---

### 1.3 Wire Token Refresh

**File:** `lib/api.ts`
**Backend:** `POST /api/token/refresh/` (no auth)

The `ApiClient` needs to intercept 401 responses, refresh the token, and retry. Add this to the `request` method:

```typescript
// Inside ApiClient.request(), after the initial fetch:

if (response.status === 401 && !skipAuth) {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (refreshToken) {
    try {
      const refreshResponse = await fetch(
        `${this.baseUrl}/api/token/refresh/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        },
      );

      if (refreshResponse.ok) {
        const { access } = await refreshResponse.json();
        await useAuthStore.getState().setAuthTokens(access, refreshToken);
        // Retry original request with new token
        const retryConfig = {
          ...options,
          headers: {
            ...options.headers,
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
          },
        };
        const retryResponse = await fetch(url, retryConfig);
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(
            errorData?.detail || `API Error: ${retryResponse.status}`,
          );
        }
        return retryResponse.json();
      } else {
        // Refresh failed — force logout
        await useAuthStore.getState().clearAuth();
        throw new Error("Session expired. Please log in again.");
      }
    } catch (refreshError) {
      await useAuthStore.getState().clearAuth();
      throw new Error("Session expired. Please log in again.");
    }
  }
}
```

---

### 1.4 Wire fetchFromBackend Profile Mapping

**File:** `stores/useUserProfileStore.ts`
**Function:** `fetchFromBackend` (line 479)

This is already wired to `GET /api/profile/` but the field mapping is incomplete. The backend returns nested `applicant_profile` or `sponsor_profile` objects. Update the mapping:

```typescript
// Inside fetchFromBackend, after const profile = await authApi.getProfile();
const p = profile as any;
const isApplicant = !p.IS_SPONSOR;
const appProfile = p.applicant_profile || {};
const sponProfile = p.sponsor_profile || {};

const autofillData: AutofillData = {
  personal: {
    firstName: p.FIRST_NAME || "",
    lastName: p.LAST_NAME || "",
    fullName: [p.FIRST_NAME, p.LAST_NAME].filter(Boolean).join(" "),
    email: p.EMAIL || "",
    phone: p.PHONE_NUMBER || "",
    linkedin: p.LINKED_IN || "",
    portfolio: p.PORTFOLIO_URL || "",
    profileImage: p.PHOTO_URL || undefined,
    address: {
      street: p.STREET || "",
      city: p.CITY || p.LOCATION?.split(",")[0]?.trim() || "",
      state: p.STATE || p.LOCATION?.split(",")[1]?.trim() || "",
      zip: p.ZIP || "",
      country: p.COUNTRY || "",
    },
  },
  professional: {
    title: isApplicant
      ? appProfile.CURRENT_ROLE || ""
      : sponProfile.JOB_TITLE || "",
    currentRole: appProfile.CURRENT_ROLE || "",
    yearsExperience: String(appProfile.YEARS_EXPERIENCE || ""),
    summary: appProfile.ACHIEVEMENTS || p.BIO || "",
    desiredSalary: "",
    availableStartDate: "",
    targetIndustry: appProfile.INDUSTRY || "",
    seekingPosition: Array.isArray(appProfile.POSITIONS)
      ? appProfile.POSITIONS[0] || ""
      : "",
    experiences: _parseVariant(appProfile.PROFESSIONAL_EXPERIENCES) || [],
  },
  education: {
    degree: "",
    major: "",
    university: "",
    graduationYear: "",
    gpa: "",
    entries: _parseVariant(appProfile.EDUCATION_ENTRIES) || [],
  },
  preferences: {
    workAuthorization: appProfile.WORK_AUTHORIZATION || "",
    willingToRelocate: String(appProfile.WILLING_TO_RELOCATE || ""),
    requiresSponsorship: String(appProfile.REQUIRES_SPONSORSHIP || ""),
    securityClearance: "",
  },
  demographics: { gender: "", ethnicity: "", veteran: "", disability: "" },
  skills: _parseVariant(appProfile.SKILLS) || [],
  insights:
    _parseVariant(isApplicant ? appProfile.INSIGHTS : sponProfile.INSIGHTS) ||
    [],
  resumeUrl: p.PHOTO_URL || null,
  certifications: _parseVariant(appProfile.CERTIFICATIONS) || [],
  languages: _parseVariant(appProfile.LANGUAGES) || [],
  achievements: appProfile.ACHIEVEMENTS || "",
};
```

Add this helper at the top of the file for parsing VARIANT fields:

```typescript
function _parseVariant(value: any): any {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
```

---

## Phase 2: Feed, Matches, Messages, Notifications

### 2.1 Add API Functions

**File:** `lib/api.ts`

Add these functions below the existing `fetchJobsPack`:

```typescript
// ── Feed Actions ──

export async function likeJob(jobId: string | number): Promise<any> {
  return api.post("/api/jobs/like/", { job_id: jobId });
}

export async function likeProfile(
  profileUserId: string,
  jobId: string,
): Promise<any> {
  return api.post("/api/profiles/like/", {
    applicant_user_id: profileUserId,
    job_id: jobId,
  });
}

export async function recordJobFeed(
  jobId: number,
  action: string,
): Promise<any> {
  return api.post("/api/jobs/feed/record/", { job_id: jobId, action });
}

export async function recordProfileFeed(
  profileUserId: string,
  action: string,
): Promise<any> {
  return api.post("/api/profiles/feed/record/", {
    profile_user_id: profileUserId,
    action,
  });
}

export async function fetchProfilePack(jobId?: string): Promise<any> {
  const qs = jobId ? `?job_id=${jobId}` : "";
  return api.get(`/api/profiles/pack/${qs}`);
}

// ── Matches ──

export async function fetchMatches(): Promise<any> {
  return api.get("/api/matches/");
}

export async function fetchSponsorMatches(): Promise<any> {
  return api.get("/api/matches/sponsor/");
}

export async function fetchLikedJobs(): Promise<any> {
  return api.get("/api/likes/jobs/");
}

// ── Messages ──

export async function fetchConversations(): Promise<any> {
  return api.get("/api/messages/conversations/");
}

export async function fetchMessageHistory(
  conversationId: string,
): Promise<any> {
  return api.get(`/api/messages/history/?conversation_id=${conversationId}`);
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<any> {
  return api.post("/api/messages/send/", {
    conversation_id: conversationId,
    body,
  });
}

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<any> {
  return api.post("/api/messages/conversations/get-or-create/", {
    other_user_id: otherUserId,
  });
}

export async function unmatchConversation(
  conversationId: string,
): Promise<any> {
  return api.post("/api/messages/unmatch/", {
    conversation_id: conversationId,
  });
}

// ── Notifications ──

export async function fetchNotifications(
  unreadOnly = false,
  limit = 20,
  offset = 0,
): Promise<any> {
  return api.get(
    `/api/notifications/?unread_only=${unreadOnly}&limit=${limit}&offset=${offset}`,
  );
}

export async function fetchUnreadCount(): Promise<any> {
  return api.get("/api/notifications/unread-count/");
}

export async function markNotificationRead(
  notificationId: string,
): Promise<any> {
  return api.patch(`/api/notifications/${notificationId}/read/`);
}

export async function markAllNotificationsRead(): Promise<any> {
  return api.patch("/api/notifications/read-all/");
}

// ── Referrals ──

export async function submitReferral(
  applicantUserId: string,
  jobId: string,
  note: string,
  confidenceChecks: Record<string, boolean>,
): Promise<any> {
  return api.post("/api/referrals/submit/", {
    applicant_user_id: applicantUserId,
    job_id: jobId,
    referral_note: note,
    ...confidenceChecks,
  });
}

export async function fetchReferrals(): Promise<any> {
  return api.get("/api/referrals/");
}

// ── Jobs (Sponsor) ──

export async function browseJobs(limit = 20, offset = 0): Promise<any> {
  return api.get(`/api/jobs/browse/?limit=${limit}&offset=${offset}`);
}

export async function sponsorJob(jobId: string | number): Promise<any> {
  return api.post(`/api/jobs/${jobId}/sponsor/`);
}

// ── Public Profiles ──

export async function fetchPublicProfile(userId: string): Promise<any> {
  return api.get(`/api/profiles/${userId}/public/`);
}

// ── Profile Actions ──

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<any> {
  return api.post("/api/profile/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export async function deactivateAccount(): Promise<any> {
  return api.post("/api/profile/deactivate/");
}
```

---

### 2.2 Wire HomeView (Feed)

**File:** `components/HomeView.tsx`

**Applicant feed (jobs):** Already wired via `fetchJobsPack()`.

For swipe actions, find where the right-swipe handler fires and add:

```typescript
import { likeJob, recordJobFeed } from "@/lib/api";

// On swipe right (like):
await likeJob(job.JOB_ID || job.id);
await recordJobFeed(job.JOB_ID || job.id, "liked");

// On swipe left (pass):
await recordJobFeed(job.JOB_ID || job.id, "passed");
```

**Sponsor feed (profiles):** Replace `mockProfiles` with a real fetch:

```typescript
import { fetchProfilePack, likeProfile, recordProfileFeed } from "@/lib/api";

// Replace mockProfiles usage:
const profiles = await fetchProfilePack(selectedJobId);

// On swipe right:
await likeProfile(profile.USER_ID, selectedJobId);
await recordProfileFeed(profile.USER_ID, "liked");

// On swipe left:
await recordProfileFeed(profile.USER_ID, "passed");
```

**Profile card field mapping** (backend → frontend):

| Backend Field              | Frontend Field                          |
| -------------------------- | --------------------------------------- |
| `USER_ID`                  | `id`                                    |
| `FIRST_NAME` + `LAST_NAME` | `name`                                  |
| `CURRENT_ROLE`             | `role`                                  |
| `INDUSTRY`                 | `company` (or map from sponsor profile) |
| `LOCATION`                 | `location`                              |
| `PHOTO_URL`                | `image`                                 |
| `BIO`                      | `bio`                                   |
| `YEARS_EXPERIENCE`         | `yearsExperience`                       |
| `SKILLS` (VARIANT)         | `skills[]` — may need `JSON.parse()`    |
| `INSIGHTS` (VARIANT)       | `insights` — may need `JSON.parse()`    |

---

### 2.3 Wire MatchesView

**File:** `components/MatchesView.tsx`

Replace `mockMatches` with real API calls:

```typescript
import {
  fetchMatches,
  fetchSponsorMatches,
  fetchReferrals,
  fetchLikedJobs,
} from "@/lib/api";

// Applicant:
const matchesResponse = await fetchMatches();
// Response: { matches: [...], total_count: N }

// Sponsor:
const sponsorMatchesResponse = await fetchSponsorMatches();
// Response: { matches: [...], total_count: N }

// Referral pipeline:
const referralsResponse = await fetchReferrals();
// Response: { referrals: [...], total_count: N }
```

**Match object fields** (backend returns):

| Backend Field             | Frontend Field       |
| ------------------------- | -------------------- |
| `MATCH_ID`                | `id`                 |
| `JOB_ID`                  | `jobId`              |
| `JOB_TITLE`               | `jobTitle`           |
| `COMPANY`                 | `company`            |
| `APPLICANT_USER_ID`       | `applicantId`        |
| `SPONSOR_USER_ID`         | `sponsorId`          |
| `FIRST_NAME`, `LAST_NAME` | `name` (concatenate) |
| `PHOTO_URL`               | `image`              |
| `MATCHED_AT`              | `matchedAt`          |

---

### 2.4 Wire MessagesView

**File:** `components/MessagesView.tsx`

Replace `mockConversations` and `mockMessages`:

```typescript
import {
  fetchConversations,
  fetchMessageHistory,
  sendMessage,
  getOrCreateConversation,
  unmatchConversation,
} from "@/lib/api";

// Load inbox:
const convResponse = await fetchConversations();
// Response: { conversations: [...] }

// Load chat history:
const msgResponse = await fetchMessageHistory(conversationId);
// Response: { messages: [...] }

// Send message:
await sendMessage(conversationId, messageText);
// Response (201): { message_id, conversation_id, body, sent_at }
```

**Conversation object fields:**

| Backend Field                          | Frontend Field |
| -------------------------------------- | -------------- |
| `CONVERSATION_ID`                      | `id`           |
| `APPLICANT_USER_ID`                    | `applicantId`  |
| `SPONSOR_USER_ID`                      | `sponsorId`    |
| `OTHER_FIRST_NAME` + `OTHER_LAST_NAME` | `name`         |
| `OTHER_PHOTO_URL`                      | `image`        |
| `LAST_MESSAGE_BODY`                    | `lastMessage`  |
| `LAST_MESSAGE_AT`                      | `time`         |
| `UNREAD_COUNT`                         | `unread`       |

**Message object fields:**

| Backend Field    | Frontend Field  |
| ---------------- | --------------- |
| `MESSAGE_ID`     | `id`            |
| `SENDER_USER_ID` | `senderId`      |
| `BODY`           | `body` / `text` |
| `SENT_AT`        | `timestamp`     |

#### WebSocket Integration

For real-time chat, connect to the WebSocket after opening a conversation:

```typescript
const wsUrl = `wss://oyster-app-4pg5w.ondigitalocean.app/ws/chat/${conversationId}/?token=${accessToken}`;
const ws = new WebSocket(wsUrl);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "chat.message") {
    // Append to messages list:
    // data.message_id, data.body, data.sender_user_id, data.sent_at
  }
};

// Send via WebSocket (faster than HTTP):
ws.send(
  JSON.stringify({
    type: "chat.message",
    body: messageText,
  }),
);
```

Close codes: `4001` = auth failed, `4003` = not a participant, `4004` = conversation not found.

---

### 2.5 Wire NotificationsView

**File:** `components/NotificationsView.tsx`

Replace `mockNotifications`:

```typescript
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api";

// Load notifications:
const notifResponse = await fetchNotifications(false, 20, 0);
// Response: { notifications: [...], total_count: N, unread_count: N }

// Badge count (for header):
const countResponse = await fetchUnreadCount();
// Response: { unread_count: N }

// Mark single as read:
await markNotificationRead(notificationId);

// Mark all as read:
await markAllNotificationsRead();
```

**Notification object fields:**

| Backend Field             | Frontend Field                    |
| ------------------------- | --------------------------------- |
| `NOTIFICATION_ID`         | `id`                              |
| `TYPE`                    | `type` (match, message, referral) |
| `TITLE`                   | `title`                           |
| `BODY`                    | `body` / `description`            |
| `IS_READ`                 | `read`                            |
| `CREATED_AT`              | `time`                            |
| `RELATED_USER_ID`         | `relatedUserId`                   |
| `RELATED_JOB_ID`          | `relatedJobId`                    |
| `RELATED_CONVERSATION_ID` | `relatedConversationId`           |

---

### 2.6 Wire Additional ProfileView Actions

**File:** `components/ProfileView.tsx`

```typescript
import { changePassword, deactivateAccount } from "@/lib/api";
import { authApi } from "@/lib/auth-api";

// Change password modal:
await changePassword(currentPassword, newPassword);

// Deactivate account:
await deactivateAccount();
await useAuthStore.getState().clearAuth();
// Navigate to login

// Notification preferences:
await api.patch("/api/profile/update/", {
  notification_preferences: {
    match: matchEnabled,
    message: messageEnabled,
    referral: referralEnabled,
  },
});
```

---

## Phase 2 Bonus: Jobs (Sponsor Tab)

**File:** `components/JobsView.tsx`

Replace `mockJobs` for sponsor browse:

```typescript
import { browseJobs, sponsorJob } from "@/lib/api";

// Browse ATS jobs:
const browsedJobs = await browseJobs(20, 0);
// Response: { jobs: [...], total_count: N }

// Sponsor a job:
await sponsorJob(jobId);
```

---

## Testing Checklist

### Phase 1

- [ ] Create new applicant account through questionnaire
- [ ] Create new sponsor account through questionnaire
- [ ] Login with created account
- [ ] Profile loads with real data on dashboard
- [ ] Edit profile fields and verify they persist (reload app)
- [ ] Token refresh works (wait 24h or manually expire)

### Phase 2

- [ ] Applicant sees real job cards in feed
- [ ] Sponsor sees real profile cards in feed
- [ ] Swipe right creates a like (check via `GET /api/likes/jobs/`)
- [ ] Mutual like creates a match (check Matches tab)
- [ ] Conversations appear in Messages tab after match
- [ ] Can send and receive messages in chat
- [ ] WebSocket delivers messages in real-time
- [ ] Notifications appear for matches and messages
- [ ] Unread badge count updates
- [ ] Mark notification as read works
- [ ] Referral submission from Messages works (sponsor only)

### Data Available for Testing

The backend has seeded demo data in Snowflake. You can login with any of these accounts (password for all: `DemoPass123!`):

- `sarah.chen@demo.backchannel.app` (applicant — ML engineer)
- `marcus.johnson@demo.backchannel.app` (applicant — backend eng)
- `elena.rodriguez@demo.backchannel.app` (applicant — fullstack)
- `james.wright@demo.backchannel.app` (applicant — data scientist)
- `priya.patel@demo.backchannel.app` (applicant — devops)
- `alex.kim@demo.backchannel.app` (applicant — security)
- `david.chen@demo.backchannel.app` (sponsor — Google)
- `rachel.foster@demo.backchannel.app` (sponsor — Microsoft)
- `tom.wilson@demo.backchannel.app` (sponsor — Stripe)

These accounts have pre-existing likes, matches, conversations, messages, and referrals.

# Security & Defensive Programming Audit

**Date:** 2026-02-25
**Scope:** Full backend codebase (`bc_microservices/`, `django_bc/`, `Dockerfile`, `docker-compose.yml`)
**Method:** Static analysis across five categories — error paths, resource cleanup, security scoping, performance, and library correctness.

---

## CRITICAL (7) — Fix Immediately

### C-1: Plaintext password storage and comparison

- **Files:** `queries/users.py` (lines 18-24, 93-103, 115-125), `services/auth.py` (line 50)
- **Issue:** The column is named `PASSWORD_HASH` but raw passwords are stored and compared directly via SQL `WHERE PASSWORD_HASH = %s`. No bcrypt, argon2, or pbkdf2 hashing is applied anywhere. A database breach exposes every credential in cleartext.
- **Fix:** Hash passwords with `bcrypt` on registration/change, use application-side `bcrypt.checkpw()` on login. Remove SQL-based password comparison entirely.

### C-2: Password reset token returned in HTTP response

- **Files:** `services/auth.py` (line 191)
- **Issue:** `POST /api/forgot-password/` returns the reset token directly in the JSON response body. Any attacker who knows a user's email can call this endpoint, extract the token, and call `/api/reset-password/` to take over the account without access to the user's email inbox.
- **Fix:** Send the token only via email (or SMS). Return a generic "If that email exists, a reset link has been sent" message.

### C-3: Hardcoded fallback SECRET_KEY

- **Files:** `django_bc/settings.py` (line 28)
- **Issue:** `SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-test-secret-key-change-me")`. If the env var is unset in production, the app silently uses a publicly known secret. This key signs JWTs (`SIMPLE_JWT.SIGNING_KEY` defaults to `SECRET_KEY`), so an attacker could forge arbitrary access tokens.
- **Fix:** Raise `ImproperlyConfigured` at startup when `DEBUG=False` and the env var is missing.

### C-4: Redis TLS certificate verification disabled

- **Files:** `django_bc/settings.py` (line 188)
- **Issue:** `ssl_cert_reqs = None` disables TLS certificate validation on the managed Valkey/Redis connection, making it vulnerable to man-in-the-middle attacks. The connection carries cached user data, JWT lookups, and channel-layer messages.
- **Fix:** Use `ssl_cert_reqs = "required"` with the DigitalOcean CA certificate, or at minimum `"optional"`.

### C-5: SQL injection surface in `check_exists`

- **Files:** `bc_microservices/snowflake_utils.py` (line 99)
- **Issue:** The `field` parameter is interpolated directly into SQL via f-string (`WHERE {field} = %s`). Currently only called with hardcoded `'EMAIL'` and `'USERNAME'`, but the function signature invites future misuse.
- **Fix:** Add `assert field in {'EMAIL', 'USERNAME'}` or replace with dedicated `email_exists()` / `username_exists()` functions.

### C-6: SQL injection in pack-fetch queries

- **Files:** `queries/profiles.py` (line 139), `queries/jobs.py` (lines 285, 346)
- **Issue:** Exclusion lists are built by string-interpolating IDs directly into SQL: `",".join(f"'{pid}'" for pid in seen)`. While the IDs originate from prior DB queries (not direct user input), this is second-order injection risk with no escaping. `{limit}` is also interpolated directly.
- **Fix:** Use parameterized `IN` clauses: `','.join(['%s'] * len(ids))` with a params tuple, or Snowflake's `ARRAY_CONTAINS`.

### C-7: SQL injection in document stage operations

- **Files:** `queries/documents.py` (lines 15-21, 69-77)
- **Issue:** `stage_name`, `user_dir`, `local_path`, and `stage_path` are interpolated into `PUT` and `SELECT` commands via f-strings with no sanitization. A crafted path with special characters could inject arbitrary SQL. Path traversal is also possible.
- **Fix:** Validate identifiers against `^[A-Za-z0-9_]+$` regex. Validate file paths against traversal patterns.

---

## MEDIUM (27) — Fix Before Beta

### Security

| ID  | File                 | Lines          | Issue                                                                                                                                                                  |
| --- | -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-1 | `services/auth.py`   | 61-76, 111-122 | **Role parameter is user-controlled.** Either registration endpoint can create either role. Separate endpoints are meaningless.                                        |
| M-2 | `custom_jwt.py`      | 40             | **Exception details leaked.** `f'Token validation failed: {str(e)}'` exposes Snowflake errors to clients.                                                              |
| M-3 | `views_auth.py`      | 44             | **Logout is a no-op.** Returns 200 but never blacklists the JWT. Token remains valid until expiry.                                                                     |
| M-4 | `settings.py`        | 51             | **Placeholder CORS origin.** `https://your-frontend-domain.com` — if registered by an attacker, allows cross-origin requests with credentials.                         |
| M-5 | `settings.py`        | 246            | **Throttle config is dead.** Rates are defined but `DEFAULT_THROTTLE_CLASSES` is empty. No throttling is applied by default.                                           |
| M-6 | `Dockerfile`         | —              | **Container runs as root.** No `USER` directive. Code execution → full root privileges in container.                                                                   |
| M-7 | `ws_auth.py`         | 40             | **JWT in WebSocket URL query string.** Appears in server/proxy logs and browser history.                                                                               |
| M-8 | `consumers.py`       | 62             | **No WebSocket payload size limit.** Malicious client can send multi-megabyte JSON bodies.                                                                             |
| M-9 | `views_documents.py` | 11             | **Raw query functions re-exported from view module.** `extract_text_from_document` and `update_applicant_resume_text` are importable from views with no auth wrapping. |

### Data Integrity / Race Conditions

| ID   | File                    | Lines            | Issue                                                                                                                      |
| ---- | ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| M-10 | `services/auth.py`      | 50-57            | **Non-atomic multi-table registration.** Three separate INSERTs with no transaction. Partial failure leaves orphaned rows. |
| M-11 | `services/matching.py`  | 96-99, 120-131   | **TOCTOU race in like operations.** Check-then-insert pattern allows duplicate likes under concurrency.                    |
| M-12 | `services/jobs.py`      | 367-369, 394-396 | **TOCTOU race in apply/waitlist.** Same check-then-insert pattern.                                                         |
| M-13 | `services/messaging.py` | 52-57            | **TOCTOU race in get_or_create_conversation.** Concurrent requests can create duplicate conversations.                     |

### Missing Ownership Checks (Query Layer)

| ID   | File                       | Function             | Issue                                                                |
| ---- | -------------------------- | -------------------- | -------------------------------------------------------------------- |
| M-14 | `queries/likes.py`         | `set_matched`        | Updates by `LIKE_ID` only — no user ownership filter.                |
| M-15 | `queries/messaging.py`     | `close_conversation` | Updates by `CONVERSATION_ID` only — no participant check.            |
| M-16 | `queries/referrals.py`     | `withdraw_referral`  | Updates by `REFERRAL_ID` only — no `SPONSOR_ID` filter.              |
| M-17 | `queries/notifications.py` | `mark_read`          | Updates by `NOTIFICATION_ID` only — no `USER_ID` filter.             |
| M-18 | `queries/documents.py`     | `mark_file_parsed`   | Updates by `FILE_ID` only — no `USER_ID` filter.                     |
| M-19 | `services/profiles.py`     | `get_profile_pack`   | Doesn't verify the caller (sponsor) owns the `job_id`.               |
| M-20 | `services/matching.py`     | `like_job`           | No role check — a sponsor can call the applicant-only like endpoint. |

### Observability

| ID   | File                    | Lines   | Issue                                                                                                       |
| ---- | ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| M-21 | `services/auth.py`      | 238     | `except Exception: pass` — device cleanup failure has zero logging.                                         |
| M-22 | `services/messaging.py` | 102     | `except Exception: pass` — notification failure has zero logging.                                           |
| M-23 | `services/matching.py`  | 86      | `except Exception: pass` — match notification failure has zero logging.                                     |
| M-24 | `services/referrals.py` | 50      | `except Exception: pass` — referral notification failure has zero logging.                                  |
| M-25 | `settings.py`           | 256-273 | **DEBUG-level file logging in production** with no rotation. Unbounded `debug.log` can leak sensitive data. |

### Performance

| ID   | File                 | Lines   | Issue                                                                                                                               |
| ---- | -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M-26 | `services/jobs.py`   | 200-206 | **N+1 query pattern.** `format_job_for_ui` issues a separate Snowflake query per job for sponsor info (up to 10 extra round-trips). |
| M-27 | `snowflake_utils.py` | 42-49   | **No connection timeout.** If Snowflake is unreachable, `connect()` blocks for 60-120+ seconds, tying up workers.                   |

---

## LOW (20) — Nice to Have

| ID   | File                         | Issue                                                                                                                                                            |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1  | `services/auth.py:23`        | `datetime.utcnow()` is deprecated since Python 3.12. Use `datetime.now(timezone.utc)`.                                                                           |
| L-2  | `settings.py`                | Missing production security headers: `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_CONTENT_TYPE_NOSNIFF`. |
| L-3  | `settings.py:74`             | Access token lifetime is 24 hours (industry standard: 15-60 min). Refresh token rotation is disabled.                                                            |
| L-4  | `settings.py:124`            | SQLite as Django default DB — unsuitable for multi-process Daphne deployment if any Django feature uses it.                                                      |
| L-5  | `cache.py:40`                | `cached_query` cannot cache legitimate `None`/falsy results — uses `None` as cache-miss sentinel.                                                                |
| L-6  | `snowflake_utils.py:29`      | `SELECT 1` health check on every connection reuse doubles query latency. Consider time-based staleness.                                                          |
| L-7  | `snowflake_utils.py`         | Thread-local pool has no lifecycle management. No `request_finished` signal to close connections.                                                                |
| L-8  | `custom_jwt.py:38`           | Broad `except Exception` transforms Snowflake outages into 401s instead of 503s.                                                                                 |
| L-9  | `snowflake_user.py:8-9`      | `is_active` and `is_authenticated` hardcoded to `True` — object is a snapshot, can't reflect deactivation.                                                       |
| L-10 | `consumers.py`               | No WebSocket-level rate limiting (REST endpoints have DRF throttles, WS has nothing).                                                                            |
| L-11 | `urls.py:35`                 | Django admin panel exposed in production at `/admin/`. No useful models but exposes a brute-forceable login.                                                     |
| L-12 | `urls.py:30`                 | Health check is shallow (just returns OK). Consider adding Snowflake/Redis liveness checks.                                                                      |
| L-13 | —                            | No `.dockerignore` — `.git/`, `.env`, `debug.log` copied into Docker image.                                                                                      |
| L-14 | `docker-compose.yml`         | Redis has no authentication and is bound to host port 6379.                                                                                                      |
| L-15 | `queries/referrals.py:63-77` | `LIMIT`/`OFFSET` via f-string with `int()` cast — not parameterized.                                                                                             |
| L-16 | `queries/devices.py:58`      | `deactivate_token` without `user_id` deactivates globally. Intentional for FCM rejection but worth noting.                                                       |
| L-17 | `queries/likes.py:180`       | `get_applicants_who_liked_job` has no sponsor ownership filter.                                                                                                  |
| L-18 | `services/profiles.py:179`   | `get_public_profile` accepts `requesting_user_id` but ignores it.                                                                                                |
| L-19 | `services/profiles.py:238`   | `record_job_feed` rejects UUID job IDs (sponsored jobs) — only accepts numeric ATS IDs.                                                                          |
| L-20 | `services/messaging.py:69`   | `str(body).strip()` converts `None` to the string `"None"`.                                                                                                      |

---

## Recommendations — Priority Order

1. **Hash passwords** (C-1) — highest impact, affects every user account.
2. **Remove reset token from response** (C-2) — active account takeover vector.
3. **Fail on missing SECRET_KEY** (C-3) — trivially exploitable misconfiguration.
4. **Parameterize SQL everywhere** (C-5, C-6, C-7) — eliminate all injection surfaces.
5. **Enable Redis TLS verification** (C-4) — protects cached data in transit.
6. **Add logging to all `except: pass` blocks** (M-21 through M-24) — cheapest fix, biggest observability gain.
7. **Add ownership filters to mutation queries** (M-14 through M-18) — defense in depth.
8. **Fix TOCTOU races** (M-11, M-12, M-13) — add unique constraints or `INSERT ... ON CONFLICT`.
9. **Harden production settings** (M-4, M-5, M-6, M-25, L-2) — one-time config pass.
10. **Add Snowflake connection timeout** (M-27) — prevents cascading worker exhaustion.

# Frontend ↔ Backend Gap Audit

**Date:** 2026-02-25
**Frontend:** `/Users/nico_rode/BackchannelV2` (React Native / Expo Router)
**Backend:** `/Users/nico_rode/Desktop/BackChannel` (Django REST Framework)
**Backend endpoints:** 55 REST + 1 WebSocket (from `django_bc/urls.py` and `bc_microservices/routing.py`)

---

## Navigation Architecture

**Stack:** `splash` → `choose-role` → `onboarding` → `dashboard`
**Tab nav inside dashboard:** Home (Feed) | Matches | Jobs (sponsor only) | Messages (Inbox) | Profile (Account)
**Extra views (no tab):** Notifications, PublicProfile

---

## Screen-by-Screen Analysis

### Screens with No API Needed (Pure UI) — 5 screens

| #   | Screen                  | File                                     | Notes                          |
| --- | ----------------------- | ---------------------------------------- | ------------------------------ |
| 1   | Splash Screen           | `components/SplashScreen.tsx`            | Tap "Get Connected" → navigate |
| 2   | Role Selection          | `components/ModeSelection.tsx`           | Select Applicant/Sponsor       |
| 3   | Onboarding Slides       | `components/Onboarding.tsx`              | 3 info slides                  |
| 17  | ProfileCompletionModal  | `components/ProfileCompletionModal.tsx`  | Shows missing fields           |
| 18  | ProfileCompletionBanner | `components/ProfileCompletionBanner.tsx` | Inline completion %            |

---

### Screen 4: Auth Screen (Login / Signup / Forgot Password)

**File:** `components/AuthScreen.tsx`

| Need                 | Backend Endpoint              | Wired?                                                                             |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| Login                | `POST /api/login/`            | Yes — `authApi.login()`                                                            |
| Forgot password      | `POST /api/forgot-password/`  | Yes — `authApi.forgotPassword()`                                                   |
| Register (applicant) | `POST /api/register/`         | Defined in `authApi.register()` but NOT called from UI — deferred to questionnaire |
| Register (sponsor)   | `POST /api/register-sponsor/` | Defined but NOT called from UI                                                     |
| LinkedIn OAuth       | None                          | Button exists, nothing wired anywhere                                              |

---

### Screen 5: Applicant Questionnaire (6 steps)

**File:** `components/ApplicantQuestionnaire.tsx`

| Step | Field           | Backend Registration Field    | Status                                                     |
| ---- | --------------- | ----------------------------- | ---------------------------------------------------------- |
| -    | firstName       | `first_name`                  | Ready                                                      |
| -    | lastName        | `last_name`                   | Ready                                                      |
| -    | email           | `email`                       | Ready                                                      |
| -    | password        | `password`                    | Ready                                                      |
| 1    | targetIndustry  | `industry`                    | Ready                                                      |
| 2    | currentRole     | `current_role`                | Ready — `CURRENT_ROLE VARCHAR(200)` added in Migration 003 |
| 3    | seekingPosition | `positions` (array)           | Ready                                                      |
| 4    | skills          | `skills` (array)              | Ready                                                      |
| 5    | insights        | `insights` (array)            | Ready — `INSIGHTS VARIANT` added in Migration 003          |
| 6    | resumeUrl       | `POST /api/upload-and-parse/` | Separate post-registration flow (backend ready)            |

**Note:** `authApi.createProfile()` currently returns mock tokens — does not call real API.

---

### Screen 6: Sponsor Questionnaire (8 steps)

**File:** `components/SponsorQuestionnaire.tsx`

| Step | Field           | Backend Registration Field | Status                                            |
| ---- | --------------- | -------------------------- | ------------------------------------------------- |
| -    | firstName       | `first_name`               | Ready                                             |
| -    | lastName        | `last_name`                | Ready                                             |
| -    | email           | `email`                    | Ready                                             |
| -    | password        | `password`                 | Ready                                             |
| 1    | company         | `company`                  | Ready                                             |
| 2    | jobTitle        | `job_title`                | Ready                                             |
| 3    | yearsAtCompany  | `duration`                 | Ready                                             |
| 4    | openToReferrals | `open_to_referrals`        | Ready                                             |
| 5    | pastReferrals   | `referral_experience`      | Ready                                             |
| 6    | referralBonus   | `financial_reward`         | Ready                                             |
| 7    | insights        | `insights` (array)         | Ready — `INSIGHTS VARIANT` added in Migration 003 |
| 8    | workEmail       | `work_email`               | Ready                                             |

**Additional gap:** Email verification flow (send link, check status) is simulated with `setTimeout(6000)`. No backend endpoints exist:

- `POST /api/verify/email/send/` — missing
- `GET /api/verify/email/status/` — missing

---

### Screen 7: Home View / Feed (~3900 lines)

**File:** `components/HomeView.tsx`

| Need                                        | Backend Endpoint                                                 | Status                                      |
| ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Job cards (applicant)                       | `GET /api/jobs/pack/`                                            | **Wired, working**                          |
| Profile cards (sponsor browsing applicants) | `GET /api/profiles/pack/`                                        | Backend exists, **frontend uses mock data** |
| Like a job (applicant swipe right)          | `POST /api/jobs/like/`                                           | Backend exists, **not wired**               |
| Like a profile (sponsor swipe right)        | `POST /api/profiles/like/`                                       | Backend exists, **not wired**               |
| Record feed action                          | `POST /api/jobs/feed/record/`, `POST /api/profiles/feed/record/` | Backend exists, **not wired**               |
| Filter profiles                             | N/A                                                              | Local UI filtering on loaded data           |

**Modals within HomeView:**

- Filter Modal — multi-select filters (local UI, no API)
- Profile Detail Expanded View — displays already-loaded profile data
- Job Detail Modal — displays already-loaded job data, includes description, skills, benefits, sponsor info, responsibilities, requirements, interview process
- ProfileCompletionModal — pure UI

**Profile card fields expected by frontend:**
`name, role, company, location, image, bio, yearsExperience, skills[], desiredRole, insights (funFact, mentality), prompts[{question, answer}], fullDetails (experiences[], education[], achievements, certifications[], languages[])`

---

### Screen 8: Matches View

**File:** `components/MatchesView.tsx`

| Need                         | Backend Endpoint                                                                                                        | Status                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Applicant matches (jobs)     | `GET /api/matches/`                                                                                                     | Backend exists, **frontend uses mock data**                |
| Sponsor matches (applicants) | `GET /api/matches/sponsor/`                                                                                             | Backend exists, **frontend uses mock data**                |
| Referral pipeline status     | `POST /api/referrals/submit/`, `GET /api/referrals/`, `GET /api/referrals/<id>/`, `PATCH /api/referrals/<id>/withdraw/` | Ready — Migration 005; REFERRED/WITHDRAWN statuses tracked |
| Recommended sponsors         | None                                                                                                                    | **GAP** — no sponsor recommendation endpoint               |
| Send message from modal      | `POST /api/messages/send/`                                                                                              | Backend exists                                             |
| Show interest in job         | `POST /api/jobs/like/`                                                                                                  | Backend exists                                             |

**Modals:**

- Applicant Profile Modal — 2-page swipeable (bio+skills → insights), message input with quick replies
- Job Details Modal — full job info, "Show Interest" button
- Sponsor Profile Modal — 2-page swipeable (bio → insights), message input with quick replies

---

### Screen 9: Messages View / Inbox + Chat (~large)

**File:** `components/MessagesView.tsx`

| Need                           | Backend Endpoint                        | Status                                                                          |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------- |
| List conversations             | `GET /api/messages/conversations/`      | Backend exists, **frontend uses mock data**                                     |
| Load messages                  | `GET /api/messages/history/`            | Backend exists, **frontend uses mock data**                                     |
| Send message                   | `POST /api/messages/send/`              | Backend exists, **frontend uses mock data**                                     |
| Real-time messages (WebSocket) | `ws://<host>/ws/chat/<id>/?token=<jwt>` | **Backend ready** — Django Channels; HTTP messages also broadcast to WS clients |
| Unmatch                        | `POST /api/messages/unmatch/`           | Backend exists                                                                  |
| Hide/archive conversation      | None                                    | **GAP** — no hide endpoint                                                      |
| File attachments in chat       | None                                    | **GAP** — no attachment upload for conversations                                |

**Conversation fields expected by frontend:**
`id, name, role, company, image, lastMessage, time, unread, appliedRole, experience, skills[], location, email, phone, linkedin, education, previousCompanies[], bio, workPreferences[], desiredRoles[], companiesCanReferTo[], prompts[], isHidden, applicationStatus, appliedDate, nextAction`

**Modals (3 major ones):**

1. **Profile Modal** — swipeable cards (bio → prompts), "View Full Profile" button, "Provide Referral" button

2. **Referral Vetting Flow** (3-step wizard for sponsors):
   - Step 1: Confidence Check — 4 checkboxes (has messaged, feels confident, knows background, comfortable attaching name)
   - Step 2: Review & Confirm — full candidate info card with binding referral warning
   - Step 3: Success confirmation
   - **NEEDS:** `POST /api/referrals/submit/` — **Implemented** (with match validation, confidence checks, notification trigger)

3. **Application Detail Modal** (applicant view):
   - 5-stage timeline tracker: Applied → Referred → Screening → Interview → Decision
   - Sponsor info, next steps
   - **NEEDS:** `GET /api/applications/{id}/status/` — **DOES NOT EXIST**

---

### Screen 10: Jobs View (Sponsor-only tab, ~2750 lines)

**File:** `components/JobsView.tsx`

| Need                  | Backend Endpoint               | Status             |
| --------------------- | ------------------------------ | ------------------ |
| Browse ATS jobs       | `GET /api/jobs/browse/`        | Backend exists     |
| Sponsor a job         | `POST /api/jobs/{id}/sponsor/` | Backend exists     |
| Job pack for feed     | `GET /api/jobs/pack/`          | **Wired, working** |
| Apply (opens WebView) | External URL                   | N/A                |

---

### Screen 11: Job Application WebView (AI Autofill)

**File:** `components/JobApplicationWebView.tsx`

| Need                      | Backend Endpoint                 | Status                                                                      |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Generate autofill answers | `POST /api/v1/autofill/generate` | **Wired** — uses different URL prefix (`/api/v1/`), likely separate service |

Sends `AutofillRequest` containing full user profile + scraped form fields + job context. Receives field answers with confidence scores, suggestions, cover letter draft.

---

### Screen 12: Profile View / Account (~5300 lines, 12+ modals)

**File:** `components/ProfileView.tsx`

**Working endpoints:**

| Need                    | Backend Endpoint                       | Status                                             |
| ----------------------- | -------------------------------------- | -------------------------------------------------- |
| Get profile             | `GET /api/profile/`                    | **Wired** (via `_layout.tsx fetchFromBackend`)     |
| Update general profile  | `PATCH /api/profile/update/`           | Backend exists, **frontend returns mock response** |
| Update applicant fields | `PATCH /api/profile/applicant/update/` | Backend exists                                     |
| Update sponsor fields   | `PATCH /api/profile/sponsor/update/`   | Backend exists                                     |
| Change password         | `POST /api/profile/change-password/`   | Backend exists                                     |
| Deactivate account      | `POST /api/profile/deactivate/`        | Backend exists                                     |
| Upload profile image    | `POST /api/upload/image/`              | Backend exists                                     |
| Upload/parse resume     | `POST /api/upload-and-parse/`          | Backend exists                                     |
| Logout                  | `POST /api/logout/`                    | Backend exists                                     |

**Profile fields the frontend can edit vs backend schema support:**

| Frontend Field                           | Backend Column                                                  | Status                                                          |
| ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| firstName                                | `FIRST_NAME` on `USER_PROFILES`                                 | Ready                                                           |
| lastName                                 | `LAST_NAME` on `USER_PROFILES`                                  | Ready                                                           |
| email                                    | `EMAIL` on `USERS`                                              | Ready (read-only via profile)                                   |
| phone                                    | `PHONE_NUMBER` on `USER_PROFILES`                               | Ready                                                           |
| profileImage                             | `PHOTO_URL` on `USER_PROFILES`                                  | Ready                                                           |
| linkedin                                 | `LINKED_IN` on `USER_PROFILES`                                  | Ready                                                           |
| portfolio                                | `PORTFOLIO_URL` on `USER_PROFILES`                              | Ready                                                           |
| location (single)                        | `LOCATION` on `USER_PROFILES`                                   | Ready                                                           |
| dateOfBirth                              | `DATE_OF_BIRTH` on `USER_PROFILES`                              | Ready                                                           |
| bio                                      | `BIO` on `USER_PROFILES`                                        | Ready — Migration 003                                           |
| street, city, state, zip, country        | `STREET`, `CITY`, `STATE`, `ZIP`, `COUNTRY` on `USER_PROFILES`  | Ready — Migration 003                                           |
| jobTitle (applicant context)             | `CURRENT_ROLE` on `APPLICANT_PROFILES`                          | Ready — Migration 003                                           |
| yearsExperience                          | `YEARS_EXPERIENCE` on `APPLICANT_PROFILES`                      | Ready — Migration 003                                           |
| summary                                  | `ACHIEVEMENTS` on `APPLICANT_PROFILES`                          | Ready — Migration 003                                           |
| professionalExperiences[]                | `PROFESSIONAL_EXPERIENCES` VARIANT on `APPLICANT_PROFILES`      | Ready — Migration 003                                           |
| educationEntries[]                       | `EDUCATION_ENTRIES` VARIANT on `APPLICANT_PROFILES`             | Ready — Migration 003                                           |
| certifications[]                         | `CERTIFICATIONS` VARIANT on `APPLICANT_PROFILES`                | Ready — Migration 003                                           |
| languages[]                              | `LANGUAGES` VARIANT on `APPLICANT_PROFILES`                     | Ready — Migration 003                                           |
| achievements                             | `ACHIEVEMENTS` on `APPLICANT_PROFILES`                          | Ready — Migration 003                                           |
| workPreferences[]                        | `WORK_PREFERENCES` VARIANT on `APPLICANT_PROFILES`              | Ready — Migration 003                                           |
| desiredRoles[]                           | `DESIRED_ROLES` VARIANT on `APPLICANT_PROFILES`                 | Ready — Migration 003                                           |
| workAuthorization                        | `WORK_AUTHORIZATION` on `APPLICANT_PROFILES`                    | Ready — Migration 003                                           |
| willingToRelocate                        | `WILLING_TO_RELOCATE` on `APPLICANT_PROFILES`                   | Ready — Migration 003                                           |
| requiresSponsorship                      | `REQUIRES_SPONSORSHIP` on `APPLICANT_PROFILES`                  | Ready — Migration 003                                           |
| insights / profileInsights[]             | `INSIGHTS` VARIANT on `APPLICANT_PROFILES` / `SPONSOR_PROFILES` | Ready — Migration 003                                           |
| **notification preferences** (4 toggles) | `NOTIFICATION_PREFERENCES` VARIANT on `USER_PROFILES`           | Ready — Migration 004; updated via `PATCH /api/profile/update/` |
| skills / expertise[]                     | `SKILLS` on `APPLICANT_PROFILES`                                | Ready                                                           |
| industry                                 | `INDUSTRY` on `APPLICANT_PROFILES`                              | Ready                                                           |
| positions                                | `POSITIONS` on `APPLICANT_PROFILES`                             | Ready                                                           |
| company (sponsor)                        | `COMPANY` on `SPONSOR_PROFILES`                                 | Ready                                                           |
| jobTitle (sponsor)                       | `JOB_TITLE` on `SPONSOR_PROFILES`                               | Ready                                                           |

**Modals:**

- Edit Profile Modal — full form (all fields above — backend ready)
- Edit Insights Modal — personality prompts (backend ready — `INSIGHTS` VARIANT column)
- Edit Resume Modal — upload/manage resume (backend ready)
- Account Settings Modal — display name/email, change password link
- Privacy & Security Modal — settings toggles (no backend storage)
- Notifications Settings Modal — 4 toggles (backend ready — `PATCH /api/profile/update/` with `notification_preferences`)
- Password Change Modal — current/new/confirm (backend ready)
- Logout Confirmation Modal — (backend ready)
- Image Picker Modal — take photo / choose gallery (backend ready)
- Application Detail Modal — view application details (GAP)

---

### Screen 13: Notifications View

**File:** `components/NotificationsView.tsx`

| Need                | Backend Endpoint                       | Status                                                 |
| ------------------- | -------------------------------------- | ------------------------------------------------------ |
| Fetch notifications | `GET /api/notifications/`              | **Implemented** — paginated, filterable by unread_only |
| Unread badge count  | `GET /api/notifications/unread-count/` | **Implemented**                                        |
| Mark all read       | `PATCH /api/notifications/read-all/`   | **Implemented**                                        |
| Mark single read    | `PATCH /api/notifications/<id>/read/`  | **Implemented**                                        |

**Notification types:** match, message (wired to triggers), referral, connection, profile_update (defined in schema, triggers TBD).

---

### Screen 14 & 15: Public Profile Views

**Files:** `components/ApplicantPublicProfileView.tsx`, `components/SponsorPublicProfileView.tsx`

| Need                         | Backend Endpoint                 | Status                                                                            |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| Fetch another user's profile | `GET /api/profiles/{id}/public/` | **Implemented** — returns public-safe fields (excludes email, phone, street, zip) |

**Applicant public profile displays:** avatar, name, role, company, location, bio, LinkedIn, stats (connections, referrals, response rate), skills, work preferences, desired roles

**Sponsor public profile displays:** avatar, name, role, company, location, bio, LinkedIn, stats (network, referrals, success rate), skills, "Companies I Can Refer To"

---

### Screen 16: PublicProfileView (Legacy)

**File:** `components/PublicProfileView.tsx`
Appears to be a duplicate of `ApplicantPublicProfileView.tsx`. Not imported anywhere visible.

---

### Other: Stores & State

| Store                 | File                            | Syncs to Backend?                                                              |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `useAuthStore`        | `stores/useAuthStore.ts`        | No — tokens come from backend                                                  |
| `useOnboardingStore`  | `stores/useOnboardingStore.ts`  | No — cleared after profile creation                                            |
| `useUserProfileStore` | `stores/useUserProfileStore.ts` | Yes — debounced 2s sync to `PATCH /api/profile/update/` (**currently mocked**) |
| `useJobsStore`        | `stores/useJobsStore.ts`        | No — fetched fresh from API                                                    |

### Other: RevenueCat / Subscriptions

**Files:** `lib/revenuecat.ts`, `providers/RevenueCatProvider.tsx`
Entitlement: "BackchannelV2 Pro"
May need `POST /api/subscriptions/verify/` for server-side receipt validation.

---

## Gap Summary by Priority

### P0 — Critical (Core Product Features)

| Gap                                                                                                                                                            | Why                                                                                                                       | Effort | Status                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| ~~**Rich profile schema**~~ (bio, address, experiences, education, certifications, languages, achievements, workPreferences, desiredRoles, work authorization) | Profile cards are the heart of the swipe experience.                                                                      | Large  | **Closed** — Migration 003, 21 columns, full CRUD + integration tests                                            |
| ~~**Referral submission flow**~~                                                                                                                               | The entire point of BackChannel — sponsors formally refer applicants. 3-step vetting flow in UI has zero backend support. | Medium | **Closed** — Migration 005, 4 endpoints (submit, list, detail, withdraw), match validation, notification trigger |

### P1 — High (Expected for Beta)

| Gap                                 | Why                                                                            | Effort | Status                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| ~~**Application status tracking**~~ | Users need to see where they stand (Applied → Referred → Interview → Decision) | Medium | **Deferred** — Moved to Phase 3; low value without ATS integration to provide real pipeline data |
| ~~**Public profile endpoint**~~     | Every profile tap in feed/matches/messages needs to fetch another user's data  | Small  | **Closed** — `GET /api/profiles/<id>/public/` with privacy filtering                             |
| ~~**Notifications system**~~        | Expected in any matching/messaging app                                         | Medium | **Closed** — 4 endpoints, match/message triggers, preferences, Migration 004                     |
| ~~**Insights storage**~~            | Questionnaire personality data is currently thrown away on submit              | Small  | **Closed** — VARIANT column on both profile tables, wired through registration + updates         |

### P2 — Medium (Important but Deferrable)

| Gap                                                            | Why                                                                          | Effort                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| **Email verification (sponsor)**                               | Currently faked with setTimeout                                              | Medium — email service integration |
| **Conversation hiding**                                        | UX feature for old threads                                                   | Small — boolean flag + filter      |
| **Frontend wiring** (connecting mock screens to existing APIs) | Matches, Messages, Profile updates all have backend support but aren't wired | Frontend-only work                 |

### P3 — Low (Post-Beta)

| Gap                                  | Why                                                | Effort       | Status                                                             |
| ------------------------------------ | -------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Chat file attachments                | Nice-to-have                                       | Small-Medium | Open                                                               |
| LinkedIn OAuth                       | Alternate auth method                              | Medium       | Open                                                               |
| ~~Notification preferences storage~~ | Toggles exist, no persistence                      | Small        | **Closed** — `NOTIFICATION_PREFERENCES` VARIANT on `USER_PROFILES` |
| ~~Granular address fields~~          | Street, city, state, zip, country on USER_PROFILES | Small        | **Closed** — included in Migration 003                             |
| Subscription verification            | RevenueCat handles client-side                     | Medium       | Open                                                               |

---

## APIs Currently Wired End-to-End (Frontend → Backend)

| Endpoint                    | Method | Frontend Location                                                 |
| --------------------------- | ------ | ----------------------------------------------------------------- |
| `/api/login/`               | POST   | `AuthScreen.tsx` via `authApi.login()`                            |
| `/api/forgot-password/`     | POST   | `AuthScreen.tsx` forgot password modal                            |
| `/api/profile/`             | GET    | `_layout.tsx` via `fetchFromBackend()`                            |
| `/api/jobs/pack/`           | GET    | `HomeView.tsx`, `JobsView.tsx` via `useJobsStore.fetchJobsPack()` |
| `/api/v1/autofill/generate` | POST   | `JobApplicationWebView.tsx` (may be separate service)             |

**That's 5 out of 55+ backend endpoints actually connected to the frontend.**

---

## APIs That Exist in Backend but Are NOT Wired in Frontend

These are fully functional backend endpoints the frontend could use today with zero backend changes:

- `POST /api/register/`, `POST /api/register-sponsor/`
- `POST /api/logout/`
- `PATCH /api/profile/update/`, `PATCH /api/profile/applicant/update/`, `PATCH /api/profile/sponsor/update/`
- `GET /api/profile/basic/`
- `GET /api/profiles/pack/`
- `POST /api/jobs/like/`, `GET /api/likes/jobs/`
- `POST /api/profiles/like/`
- `GET /api/matches/`, `GET /api/matches/sponsor/`
- `GET /api/jobs/browse/`, `POST /api/jobs/{id}/sponsor/`
- `POST /api/messages/conversations/get-or-create/`, `GET /api/messages/conversations/`, `POST /api/messages/send/`, `GET /api/messages/history/`, `POST /api/messages/unmatch/`
- `POST /api/jobs/feed/record/`, `POST /api/profiles/feed/record/`
- `POST /api/upload/image/`, `POST /api/upload/file/`, `POST /api/upload-and-parse/`
- `POST /api/profile/change-password/`, `POST /api/profile/deactivate/`
- `POST /api/token/refresh/`

**That's 30+ endpoints ready for the frontend to connect.**

---

## Notes on TypeScript Types vs Actual UI Rendering

The `UpdateProfileRequest` type in `lib/auth-api.ts` also defines the following fields that are **NOT rendered in any component**:

- `demographics.gender`, `demographics.ethnicity`, `demographics.veteran`, `demographics.disability`
- `professional.desiredSalary`, `professional.availableStartDate`
- `preferences.securityClearance`

These are type-level placeholders and are not gaps for beta — the UI does not collect or display them.

---

## Confidence Assessment

**What was verified:**

- All 25 component files and 6 app route files individually accounted for
- Both API client files (`lib/api.ts`, `lib/auth-api.ts`) read in full — every endpoint definition checked
- All 3 Zustand stores with potential API surface checked for hidden API calls
- No hidden `fetch()` or API calls found in providers, hooks, or utility files
- Key gaps (referral flow, application timeline, rich profile fields) confirmed via direct grep in source files

**Known unknowns:**

- The frontend engineer has unpushed local changes that could add screens, API calls, or change data flows
- Components like `HomeView.tsx` (~3900 lines) and `ProfileView.tsx` (~5300 lines) were thoroughly sampled via targeted grep but not read line-by-line in their entirety — there may be minor data needs buried deep in conditional rendering paths
- The autofill endpoint (`/api/v1/autofill/generate`) appears to be a separate service; its backend status is unknown
