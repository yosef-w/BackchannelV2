# Backend Changes Needed

> **Database migration (PR #25, April 2026):** The backend has migrated from **Snowflake** (OLTP) to **PostgreSQL**. All SQL patches in this document use plain PostgreSQL table names and `psycopg2` cursor patterns. Snowflake is now used **only** for the Cortex AI pipeline (resume parsing, autofill). The `execute_query()` helper now wraps `psycopg2` instead of `snowflake-connector-python`, but its call signature is identical — no other call sites need changes.

---

## 6. Complete `POST /api/auth/change-email/` — Email Change with Verification

> **501 stub deployed (PR #16).** The route exists and returns HTTP 501. The full transactional email flow still needs implementing.

**Why:** Email is the user's login credential and cannot be changed via a simple profile PATCH. The edit profile modal shows email as **read-only** (lock icon). To enable email changes, the stub needs the following implementation:

1. User submits new email → `POST /api/auth/change-email/ { new_email, current_password }` (password required to confirm identity)
2. Backend sends a verification link to the **new** email address via the existing transactional email service (same SendGrid/SES integration used for password reset — PR #21)
3. User clicks link → backend updates the email on the PostgreSQL `users` table
4. Frontend's next `GET /api/profile/` returns the new email automatically

**Request body:**

```json
{ "new_email": "newemail@example.com", "current_password": "secret" }
```

**Response (200):**

```json
{ "message": "Verification email sent to newemail@example.com" }
```

**Frontend:** Once the endpoint returns 200 (not 501), replace the "Contact support" lock icon on the email field with a "Change Email" button that opens a dedicated modal.

---

## 7. Redis Caching — Remaining Gaps

The app already has Redis configured and a `cached_query` helper working correctly. The most-hit screens are partially cached. The following 5 functions still hit PostgreSQL on every call:

| File                  | Function                       | Tables JOINed | Called from                            | Priority |
| --------------------- | ------------------------------ | ------------- | -------------------------------------- | -------- |
| `queries/profiles.py` | `get_applicant_profile`        | 1             | `GET /api/profile/` (every applicant)  | 🔴 High  |
| `queries/profiles.py` | `get_sponsor_profile`          | 1             | `GET /api/profile/` (every sponsor)    | 🔴 High  |
| `queries/likes.py`    | `get_sponsor_matches`          | 4             | `GET /api/matches/sponsor/`            | 🟡 Med   |
| `queries/likes.py`    | `get_received_profile_likes`   | 3             | `GET /api/likes/profiles/received/`    | 🟡 Med   |
| `queries/likes.py`    | `get_applicants_who_liked_job` | 3             | `GET /api/jobs/<id>/likes/applicants/` | 🟢 Low   |

Already cached (confirmed): `get_liked_jobs_for_user`, `get_job_matches_for_user`, `list_conversations_for_user`, `get_user_basic`, `get_profile_data`, `get_public_profile`.

---

so outside of these, is the app fully functional and ready for production in that is everything wired up up to the backend and is every button accounted for in terms of api and flows for the user end to end. Can you check everything to verify and be thorough and think very deeply as we are close to shipping this out to the app store.

### Patch — `queries/profiles.py`

Wrap `get_applicant_profile` and `get_sponsor_profile` with `cached_query`. These fire on every `GET /api/profile/` call — the highest-frequency miss.

```python
from ..cache import cached_query, invalidate, TTL_MEDIUM

def get_applicant_profile(user_id):
    def _fetch():
        q = """
        SELECT APPLICANT_PROFILE_ID, INDUSTRY, range_miles,
               REASON, POSITIONS::TEXT, SKILLS::TEXT, RESUME_DATA::TEXT,
               "current_role", YEARS_EXPERIENCE, WORK_AUTHORIZATION,
               WILLING_TO_RELOCATE, REQUIRES_SPONSORSHIP, ACHIEVEMENTS,
               DESIRED_ROLES::TEXT, WORK_PREFERENCES::TEXT, PROFESSIONAL_EXPERIENCES::TEXT,
               EDUCATION_ENTRIES::TEXT, CERTIFICATIONS::TEXT, LANGUAGES::TEXT, INSIGHTS::TEXT,
               CREATED_AT as APPLICANT_CREATED_AT,
               UPDATED_AT as APPLICANT_UPDATED_AT
        FROM user_info.applicant_profiles
        WHERE USER_ID = %s
        """
        df = execute_query(q, (user_id,))
        if df is not None and not df.empty:
            return df.iloc[0].to_dict()
        return None
    return cached_query(f"applicant_profile:{user_id}", TTL_MEDIUM, _fetch)


def get_sponsor_profile(user_id):
    def _fetch():
        q = """
        SELECT SPONSOR_PROFILE_ID, COMPANY, JOB_TITLE, WORK_EMAIL,
               LINKED_IN, DURATION, FINANCIAL_REWARD, REFERRAL_ELIGIBLE,
               REFERRAL_EXPERIENCE, OPEN_TO_REFERRALS,
               COMPANIES_CAN_REFER_TO::TEXT, SKILLS::TEXT, INSIGHTS::TEXT,
               CREATED_AT as SPONSOR_CREATED_AT,
               UPDATED_AT as SPONSOR_UPDATED_AT
        FROM user_info.sponsor_profiles
        WHERE USER_ID = %s
        """
        df = execute_query(q, (user_id,))
        if df is not None and not df.empty:
            return df.iloc[0].to_dict()
        return None
    return cached_query(f"sponsor_profile:{user_id}", TTL_MEDIUM, _fetch)
```

Add invalidation to the existing write functions in the same file:

```python
def update_applicant_fields(user_id, set_clauses, params):
    # ... existing SQL (keep as-is) ...
    invalidate(f"applicant_profile:{user_id}", f"pub_profile:{user_id}")

def update_sponsor_fields(user_id, set_clauses, params):
    # ... existing SQL (keep as-is) ...
    invalidate(f"sponsor_profile:{user_id}", f"pub_profile:{user_id}", f"sponsor_info:{user_id}")
```

---

### Patch — `queries/likes.py`

Wrap the three remaining uncached read functions:

```python
def get_sponsor_matches(sponsor_id, limit=200):
    def _fetch():
        q = """
        SELECT
          l.LIKE_ID, l.CREATED_AT AS matched_at, l.USER_ID AS applicant_user_id,
          j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION,
          up.FIRST_NAME, up.LAST_NAME, up.PHOTO_URL, up.LOCATION AS APPLICANT_LOCATION,
          ap.SKILLS::TEXT, ap.POSITIONS::TEXT, ap.INDUSTRY, ap.RESUME_DATA::TEXT
        FROM matching.likes l
        JOIN jobs.job_postings j ON l.JOB_ID = j.JOB_ID
        LEFT JOIN user_info.user_profiles up ON up.USER_ID = l.USER_ID
        LEFT JOIN user_info.applicant_profiles ap ON ap.USER_ID = l.USER_ID
        WHERE j.SPONSOR_ID = %s AND l.STATUS = 'MATCHED'
        ORDER BY l.CREATED_AT DESC
        LIMIT %s
        """
        df = execute_query(q, (sponsor_id, limit))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"sponsor_matches:{sponsor_id}", TTL_MEDIUM, _fetch)


def get_received_profile_likes(applicant_user_id, limit=200):
    def _fetch():
        q = """
        SELECT l.LIKE_ID, l.CREATED_AT AS LIKED_AT,
               l.USER_ID AS SPONSOR_USER_ID,
               up.FIRST_NAME AS SPONSOR_FIRST_NAME,
               up.LAST_NAME  AS SPONSOR_LAST_NAME,
               up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
               sp.JOB_TITLE  AS SPONSOR_JOB_TITLE,
               sp.COMPANY    AS SPONSOR_COMPANY
        FROM matching.likes l
        JOIN user_info.user_profiles up ON up.USER_ID = l.USER_ID
        LEFT JOIN user_info.sponsor_profiles sp ON sp.USER_ID = l.USER_ID
        WHERE l.PROFILE_ID = %s AND l.STATUS = 'ACTIVE'
        ORDER BY l.CREATED_AT DESC
        LIMIT %s
        """
        df = execute_query(q, (applicant_user_id, limit))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"profile_likes:{applicant_user_id}", TTL_SHORT, _fetch)


def get_applicants_who_liked_job(job_id, limit=200):
    def _fetch():
        q = """
        SELECT l.USER_ID AS APPLICANT_USER_ID, l.CREATED_AT AS LIKED_AT, l.STATUS,
               up.FIRST_NAME, up.LAST_NAME, up.LOCATION, up.ROLE_TYPE, up.PHOTO_URL,
               ap.SKILLS::TEXT, ap.POSITIONS::TEXT, ap.INDUSTRY, ap.RESUME_DATA::TEXT
        FROM matching.likes l
        LEFT JOIN user_info.user_profiles up ON up.USER_ID = l.USER_ID
        LEFT JOIN user_info.applicant_profiles ap ON ap.USER_ID = l.USER_ID
        WHERE l.JOB_ID = %s AND l.STATUS IN ('ACTIVE','MATCHED')
        ORDER BY l.CREATED_AT DESC
        LIMIT %s
        """
        df = execute_query(q, (job_id, limit))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"job_likes:{job_id}", TTL_SHORT, _fetch)
```

Add invalidation where matches are created/changed — the service layer that calls `set_matched` should also call:

```python
invalidate(f"sponsor_matches:{sponsor_id}", f"job_matches:{applicant_user_id}", f"job_likes:{job_id}")
```

---

## 🔮 Optional — Future Enhancements

> These are **not ship blockers** — the app works without them — but they would replace placeholder UI with real user data and meaningfully improve the experience. Both require new backend endpoints.

---

### Optional A — Real Application Tracking for "My Applications" Tab

**Affects:** `components/ProfileView.tsx` — Applications tab (applicants only)

**What's showing now:**
The "My Applications" tab in the applicant's profile shows 4 hardcoded fake applications (Google, Airbnb, Notion, Stripe) with fabricated dates, statuses, and sponsor names. Every user sees the same mock data.

**What users expect:**
A live list of the jobs they've actually applied to, the current status of each application (applied → screening → interview → offer), and which sponsor referred them.

**What to build:**
A `GET /api/applications/` endpoint (noted in `BACKEND_API_CONTRACT.md` as `DOES NOT EXIST`) that returns the authenticated user's applications with:

```json
{
  "applications": [
    {
      "APPLICATION_ID": 42,
      "JOB_ID": 7,
      "JOB_TITLE": "Senior Product Manager",
      "COMPANY": "Acme Corp",
      "COMPANY_LOGO_URL": "https://...",
      "STATUS": "interview_scheduled",
      "APPLIED_DATE": "2026-01-02T14:00:00Z",
      "NEXT_ACTION": "Technical interview on Jan 8 at 2 PM",
      "SPONSOR_FIRST_NAME": "Sarah",
      "SPONSOR_LAST_NAME": "Chen",
      "SPONSOR_ROLE": "VP of Product",
      "SPONSOR_PHOTO_URL": "https://...",
      "TIMELINE": [
        { "stage": "Applied", "date": "Jan 2", "completed": true },
        {
          "stage": "Referred",
          "date": "Jan 2",
          "completed": true,
          "is_referred": true
        },
        { "stage": "Screening", "date": "Jan 3", "completed": true },
        { "stage": "Interview", "date": "Jan 8", "completed": false },
        { "stage": "Decision", "date": "TBD", "completed": false }
      ]
    }
  ],
  "total": 1
}
```

**Frontend impact:** Once this endpoint exists, `ProfileView.tsx` can replace `mockApplications` with a `useEffect` fetch, and the "My Applications" tab will show real data automatically.

---

### Optional B — Real Stats in Profile Header

**Affects:** `components/ProfileView.tsx` — stats grid (both roles)

**What's showing now:**
Every applicant sees `12 Connections / 3 Referrals / 8 Applied` and every sponsor sees `24 Network / 15 Referrals / 87% Success` — all hardcoded numbers identical for every user.

**What users expect:**
Accurate counts based on their actual activity.

**Suggested stats per role:**

_Applicant:_

- `Connections` — number of mutual matches
- `Referrals` — number of active referrals received
- `Applied` — number of job applications submitted

_Sponsor:_

- `Network` — number of mutual matches
- `Referrals` — number of referrals submitted
- `Success` — percentage of referrals that reached interview stage or beyond

**What to build:**
Add a `stats` object to `GET /api/profile/` response:

```json
"stats": {
  "connections": 8,
  "referrals": 2,
  "applied": 5
}
```

(For sponsors, `applied` becomes `success_rate` as a float 0.0–1.0.)

**Frontend impact:** `ProfileView.tsx` reads `profileData` from the store. Once `stats` is returned, replace the hardcoded `stats` array with values from `profileData.stats`.

---

### Optional C — Real Stats on Applicant Public Profile Cards

**Affects:** `components/PublicProfileView.tsx` — stats row visible to sponsors when viewing any applicant's full card

**What's showing now:**
The stats row below every applicant's name on their public profile (opened by sponsors during swiping or from the matches list) always shows:

```
Connections: 42   |   Referrals: 8   |   Response: 98%
```

These are identical hardcoded numbers for **every single applicant**. Every sponsor sees the same fake stats regardless of who the applicant is.

**What users expect:**
Accurate counts based on the applicant's actual activity on the platform.

**Suggested fields to add to `GET /api/profiles/<userId>/public/` response:**

- `CONNECTIONS` — number of mutual matches the applicant has
- `REFERRALS_RECEIVED` — number of active referrals they've received
- `RESPONSE_RATE` — percentage of messages they've replied to (float 0.0–1.0, displayed as `"XX%"`)

```json
{
  "USER_ID": 123,
  "FIRST_NAME": "...",
  "stats": {
    "CONNECTIONS": 7,
    "REFERRALS_RECEIVED": 2,
    "RESPONSE_RATE": 0.94
  }
}
```

**Frontend impact:** `PublicProfileView.tsx` receives the applicant's data as a `userData` prop. Once these fields are present on the public profile response, replace the hardcoded `stats` array with:

```tsx
const stats = [
  { label: "Connections", value: String(userData.stats?.CONNECTIONS ?? "—") },
  {
    label: "Referrals",
    value: String(userData.stats?.REFERRALS_RECEIVED ?? "—"),
  },
  {
    label: "Response",
    value:
      userData.stats?.RESPONSE_RATE != null
        ? `${Math.round(userData.stats.RESPONSE_RATE * 100)}%`
        : "—",
  },
];
```

> **Note:** This is distinct from Optional B. Optional B covers the _logged-in user's own_ stats on their own profile screen (`ProfileView.tsx`). Optional C covers the stats a _sponsor sees_ on someone else's public card (`PublicProfileView.tsx`).

---

### Optional D — Real Work Email Verification for Sponsor Onboarding

**Affects:** `components/SponsorQuestionnaire.tsx` — step 8 "Verify your employment"

**What's showing now:**
The last step of sponsor sign-up asks for a work email (e.g. `name@company.com`). When the sponsor presses "Verify & Complete", the app shows a fake "Awaiting verification..." spinner for exactly **6 seconds** then submits registration regardless — no actual email was sent, no link was clicked, nothing was verified. The "Resend" button is also fake (a `setTimeout` with no API call).

**What users expect:**
A real verification email sent to their work address, confirming they are actually employed at the company they claimed.

**What to build:**

Two new endpoints:

**1. `POST /api/auth/verify-work-email/send/`**

- Sends a verification link to the provided work email address
- Ties the pending verification to the authenticated user's session
- Response `200`: `{ "message": "Verification email sent to name@company.com" }`

**2. `POST /api/auth/verify-work-email/confirm/`** (called when user clicks the link)

- Validates the token from the email link
- Marks `sponsor_profiles.work_email_verified = true` in the DB
- Response `200`: `{ "verified": true }`

**Optionally**, `GET /api/auth/verify-work-email/status/` can be polled by the frontend to check if the user has clicked the link (enabling the "Awaiting verification..." UI to auto-advance).

**Frontend impact:** Once these endpoints exist, `SponsorQuestionnaire.tsx` can:

1. Call `POST /api/auth/verify-work-email/send/` when the sponsor presses "Verify & Complete"
2. Show the "Awaiting verification..." screen and poll `GET /api/auth/verify-work-email/status/` every few seconds
3. Auto-advance to `handleFinalSubmit()` when `verified: true` is returned
4. Wire the "Resend" button to a second call to the send endpoint

**Current state (until this is deployed):** The fake 6-second delay will be removed from `SponsorQuestionnaire.tsx` and replaced with a direct submit — the work email is still collected and stored, just not verified. The "Verify your employment" step becomes a "Confirm your work email" collection step only.

---

### Optional E — Notifications Enhancements

**Affects:** `components/NotificationsView.tsx`

**Context:** The notifications list is now fully interactive — tap-to-navigate, swipe-to-mark-read, pull-to-refresh, date grouping, ticking relative times. The items below unlock functionality the frontend cannot implement alone.

**1. `DELETE /api/notifications/<id>/` — true per-row dismiss**

- Marks a single notification as dismissed for the owning user (hard delete or soft-delete via `DISMISSED_AT`).
- Response `200`: `{ "message": "Notification deleted" }`

*Why:* Swipe currently maps to mark-as-read because there is no delete endpoint. Users expect swipe-away to mean gone.

**2. `DELETE /api/notifications/?only=read` — bulk clear read**

- Deletes/dismisses all read notifications for the authenticated user.
- Response `200`: `{ "deleted_count": N }`

*Why:* Read notifications accumulate forever today. A "Clear read" action needs this.

**3. Denormalized metadata on notification rows**

Add nullable fields to the `GET /api/notifications/` response:

- `RELATED_USER_NAME` (string)
- `RELATED_USER_PHOTO_URL` (string)
- `RELATED_JOB_TITLE` (string)
- `RELATED_JOB_COMPANY` (string)

*Why:* The frontend has `RELATED_USER_ID` / `RELATED_JOB_ID` but no display data. Without these, richer cards ("John Smith liked *Senior Engineer* at Acme") require N+1 follow-up fetches per notification.

**4. Realtime (or a cheap poll) channel**

Either:

- WebSocket `/ws/notifications/` that pushes newly-created rows, or
- `GET /api/notifications/?since=<iso_timestamp>` to return only rows created after a client-held cursor.

*Why:* The list is fetched once on mount and stale for the duration of the session. The `unread-count` poll updates the badge but not the list itself. A focused user sitting on the notifications screen never sees new rows arrive.

**5. Server-side grouping of repeat events**

Aggregate near-identical events into a single row with a count (e.g., 5 `job_like` notifications on the same job within 10 minutes → one row, `body: "5 new applicants interested"`).

*Why:* High-activity users (especially sponsors) can otherwise receive a cascade of identical rows, burying other events.

**Frontend impact (when each ships):**

1. Swap swipe-to-mark-read → swipe-to-delete; add "Clear read" button in header.
2. Render richer cards with actual names/photos/job titles instead of generic `BODY` strings.
3. Live list updates without manual pull-to-refresh.
4. Collapse grouped rows with a count badge.

**Current state:** Swipe → mark-read. All rows persist until manually marked. Cards show the generic server-provided `TITLE` / `BODY` only. Fresh rows appear only on pull-to-refresh or re-navigation.
