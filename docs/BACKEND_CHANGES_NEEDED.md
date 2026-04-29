# Backend Changes Needed

**Last updated:** 2026-04-27
**Verified against backend HEAD:** `125b425` (PR #36, 2026-04-22)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Database migration (PR #25, April 2026):** The backend has migrated from **Snowflake** (OLTP) to **PostgreSQL**. All SQL patches in this document use plain PostgreSQL table names and `psycopg2` cursor patterns. Snowflake is now used **only** for the Cortex AI pipeline (resume parsing, autofill). The `execute_query()` helper now wraps `psycopg2` instead of `snowflake-connector-python`, but its call signature is identical — no other call sites need changes.

---

## 📋 Summary

| #     | Item                                          | Priority    | Status      | Type        |
| ----- | --------------------------------------------- | ----------- | ----------- | ----------- |
| §1    | `POST /api/auth/change-email/` implementation | 🟡 Medium   | 501 stub    | New flow    |
| §2    | Redis caching — 5 uncached read functions     | 🔴 High     | Uncached    | Performance |
| §3    | `POST /api/jobs/create-from-url/`             | 🔴 High     | Missing     | New endpoint |
| §4.1  | Insights columns in sponsored read path       | 🔴 High     | Not in SELECT | Bug-ish    |
| §4.2  | Accept insights on `sponsor_job` endpoint     | 🔴 High     | Missing fields | Endpoint extension |
| Opt A | Real work-email verification for sponsors     | 🟢 Optional | Fake delay  | New flow    |
| Opt B | Notifications enhancements (5 sub-items)      | 🟢 Optional | Mostly working | Polish   |
| Opt C | Enrich `/api/profiles/pack/` with bio/insights | 🟢 Optional | Workaround in place | Optimization |

**🔴 = ship blockers** (frontend already calls these or expects this data) **·** **🟡 = unblocks UI we've gated** **·** **🟢 = polish, app works without them**

---

## §1 — Complete `POST /api/auth/change-email/`

**Status:** 501 stub deployed (PR #16). Verified at [views_auth.py:242-250](../../Backchannel-backend/BackChannel-backend/bc_microservices/views_auth.py#L242) — still returning HTTP 501 as of HEAD.

**Why we need it:** Email is the user's login credential and cannot be changed via a simple profile PATCH. The Edit Profile modal currently shows email as **read-only** with a lock icon. Until this endpoint returns 200, the frontend cannot expose a "Change Email" button.

### Flow

1. User submits new email + current password → `POST /api/auth/change-email/`
2. Backend sends a verification link to the **new** email via the existing transactional email service (same SendGrid/SES integration used for password reset, PR #21)
3. User clicks link → backend updates the email column on the PostgreSQL `users` table
4. Frontend's next `GET /api/profile/` automatically returns the new email — no special handling needed

### Request

```json
POST /api/auth/change-email/
{
  "new_email": "newemail@example.com",
  "current_password": "secret"
}
```

### Response (200)

```json
{ "message": "Verification email sent to newemail@example.com" }
```

### Done when

- Endpoint returns 200 (not 501) for a valid request
- Verification email actually sends
- Click-through link updates `users.email` in Postgres

### Frontend follow-up (already scoped)

Replace the lock icon on the email field in the Edit Profile modal with a "Change Email" button that opens a dedicated modal calling this endpoint.

---

## §2 — Redis Caching Gaps

**Status:** Redis is configured and the `cached_query` helper works correctly. The 6 highest-traffic reads are already cached. **5 functions still hit Postgres on every call.**

> **Why this matters:** Pure speed/cost — the app works without these caches, but every uncached call is a Postgres round-trip (~50–200ms). At scale these become the bottleneck and inflate the database bill.

| File                  | Function                       | Joins | Called from                            | Priority |
| --------------------- | ------------------------------ | ----- | -------------------------------------- | -------- |
| `queries/profiles.py` | `get_applicant_profile`        | 1     | `GET /api/profile/` (every applicant)  | 🔴 High  |
| `queries/profiles.py` | `get_sponsor_profile`          | 1     | `GET /api/profile/` (every sponsor)    | 🔴 High  |
| `queries/likes.py`    | `get_sponsor_matches`          | 4     | `GET /api/matches/sponsor/`            | 🟡 Med   |
| `queries/likes.py`    | `get_received_profile_likes`   | 3     | `GET /api/likes/profiles/received/`    | 🟡 Med   |
| `queries/likes.py`    | `get_applicants_who_liked_job` | 3     | `GET /api/jobs/<id>/likes/applicants/` | 🟢 Low   |

**Already cached** (confirmed): `get_liked_jobs_for_user`, `get_job_matches_for_user`, `list_conversations_for_user`, `get_user_basic`, `get_profile_data`, `get_public_profile`.

### Patch — `queries/profiles.py`

Wrap with `cached_query`. These fire on **every** `GET /api/profile/` call.

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

**Invalidation** (add to existing write functions in same file):

```python
def update_applicant_fields(user_id, set_clauses, params):
    # ... existing SQL (keep as-is) ...
    invalidate(f"applicant_profile:{user_id}", f"pub_profile:{user_id}")

def update_sponsor_fields(user_id, set_clauses, params):
    # ... existing SQL (keep as-is) ...
    invalidate(f"sponsor_profile:{user_id}", f"pub_profile:{user_id}", f"sponsor_info:{user_id}")
```

### Patch — `queries/likes.py`

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

**Invalidation** — wherever matches are created/changed, the service layer that calls `set_matched` should also call:

```python
invalidate(f"sponsor_matches:{sponsor_id}", f"job_matches:{applicant_user_id}", f"job_likes:{job_id}")
```

### Done when

- All 5 functions wrap their SELECT in `cached_query(...)`
- Profile/match/like writes call `invalidate(...)` for the corresponding keys
- Manual test: edit profile → next `GET /api/profile/` reflects the change without staleness

---

## §3 — `POST /api/jobs/create-from-url/`

**Status:** Frontend ready, endpoint missing. `lib/api.ts` exports `createJobFromUrl()` and `components/JobsView.tsx` calls it from the redesigned create-listing flow.

**Why:** The legacy create-listing flow asked sponsors to manually fill in title / company / location / employment type / experience / skills / requirements across six form steps. Sponsors abandoned it. The new flow is three steps:

1. Sponsor pastes a job posting URL (LinkedIn, Greenhouse, Lever, Workday, etc.).
2. App opens an in-app `react-native-webview`, lets the sponsor confirm it's the right page, then injects a scraping script that extracts:
   - **`structured`** (preferred) — JSON-LD `JobPosting` schema, falling back to `og:`/`<meta name>` tags
   - **`rawText`** — `document.body.innerText`, capped client-side at 60 KB
3. Sponsor adds optional BackChannel insights and taps "Create Job".

### Request

```json
POST /api/jobs/create-from-url/
{
  "url": "https://jobs.acme.com/role/12345",
  "structured": {
    "title": "Senior Software Engineer",
    "company": "Acme",
    "location": "New York, NY, US",
    "description": "...",
    "employmentType": "FULL_TIME",
    "salary": "150000 - 200000 USD",
    "datePosted": "2026-04-15"
  },
  "rawText": "Senior Software Engineer\nAcme\nNew York...",
  "insights": {
    "dayToDay": "...",
    "teamCulture": "...",
    "idealCandidate": "...",
    "insiderInsights": ""
  }
}
```

`structured` may be `null` (or any field within may be `null`). `rawText` is always present.

### Response (200) — same shape as existing `POST /api/jobs/create/`

```json
{
  "job_id": "j_01HX...",
  "title": "Senior Software Engineer",
  "company": "Acme",
  "message": "Job created",
  "expires_at": "2026-05-25T00:00:00Z"
}
```

### What the backend needs to do

1. **Prefer `structured` when present** — map directly into `job_postings` columns (`title`, `company`, `location`, `description`, `employment_type`, salary parsing into `salary_min` / `salary_max` / `salary_currency`).
2. **Fall back to LLM extraction** when `structured` is `null` or partial — run Cortex on Snowflake (same pipeline as resume parsing) over `rawText` to fill missing columns.
3. **Store the four `insights.*` fields** on the job row. Recommendation: a single `insights` JSONB column matching the applicant `INSIGHTS` shape, OR four nullable text columns (`day_to_day`, `team_culture`, `ideal_candidate`, `insider_insights`). Pick whichever lines up with §4.1.
4. **Persist `url`** as the canonical application link.
5. **Return the same response shape** as `POST /api/jobs/create/` so the frontend's `refreshMyJobs()` flow works without changes.

### Done when

- Endpoint accepts the request shape above
- Job row created with title/company/location/salary correctly populated from `structured` (verify with a real LinkedIn URL)
- Insights persist and are retrievable
- Frontend's "Create Listing → Paste URL" flow end-to-end produces a live job

---

## §4 — Sponsored Job Back-Card: Surface Insights and Referral Note

**Status:** Critical UX hole. Sponsors fill out insights expecting them to be visible; applicants need them to decide whether to apply. **None of it reaches the UI today.**

**Frontend touchpoints:** `components/HomeView.tsx` (back-of-card sponsored branch, [HomeView.tsx:2627-2710](../components/HomeView.tsx#L2627-L2710)), `lib/api.ts`, `types/jobs.ts`.

### §4.1 — Add insights to the sponsored read path

The four insights fields stored by the create-from-url flow (§3) are not currently selected by `fetch_sponsored_pack` or returned by `format_job_for_frontend_api`. **Even after §3 lands, the applicant deck would still render no insights.**

#### Required changes

1. **Extend `fetch_sponsored_pack`** ([queries/jobs.py:520-540](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L520)) — add the four insights columns (or `insights::jsonb`) to the SELECT list. Currently:
   ```python
   cols = """JOB_ID, SPONSOR_ID, TITLE, COMPANY, LOCATION, DESCRIPTION,
             SALARY_MIN, SALARY_MAX, SALARY_CURRENCY, REQUIREMENTS,
             EXPERIENCE_LEVEL, EMPLOYMENT_TYPE, REMOTE_OPTION,
             CREATED_AT, EXPIRES_AT, IS_ACTIVE, REFERENCE_JOB_ID"""
   ```
   Needs `DAY_TO_DAY, TEAM_CULTURE, IDEAL_CANDIDATE, INSIDER_INSIGHTS` (or `INSIGHTS::TEXT` if JSONB).

2. **Extend `get_sponsored_job_detail`** ([queries/jobs.py:229-236](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L229)) — same SELECT change.

3. **Update `format_job_for_frontend_api`** ([services/jobs.py:111-145](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/jobs.py#L111)) to include them in the response under an `insights` key:

   ```json
   "insights": {
     "dayToDay": "...",
     "teamCulture": "...",
     "idealCandidate": "...",
     "insiderInsights": "..."
   }
   ```

   Empty/null fields can be omitted or returned as empty strings — the frontend will hide sections with no content.

4. **Sponsor sub-object contract — keep lowercase keys.** The current `sponsor` payload from `get_sponsor_info` uses lowercase keys (`first_name`, `job_title`, `photo_url`, `duration`, `years_at_company`, `can_provide_direct_referral`), inconsistent with the rest of `JobApiResponse` which is UPPERCASE. Frontend types in [types/jobs.ts:6-17](../types/jobs.ts#L6-L17) now match the lowercase shape. **Do not "normalize" sponsor to UPPERCASE without updating the frontend type in lockstep.**

#### Done when

`GET /api/jobs/pack/` returns `insights` on every sponsored job row, and the four sub-fields contain whatever was saved by the sponsor.

---

### §4.2 — Accept insights on `sponsor_job` (sponsoring an existing ATS job)

When a sponsor sponsors an existing `SILVER_JOBS` row from the browse feed, the current `sponsor_job` endpoint accepts only `relationship` and `canRefer`. **The frontend now sends a 3-step flow** — relationship → insights → confirm — and includes the four insights fields in the payload.

#### Frontend status

✅ **Shipped 2026-04-27** — `JobsView.tsx` sponsor confirm modal is now 3 steps (form → insights → success). `sponsorJob()` in `lib/api.ts:284` sends the `insights` object.

#### Required changes

1. **Accept the new fields** on `POST /api/jobs/<silver_job_id>/sponsor/`:
   ```json
   {
     "relationship": "current_employee",
     "canRefer": true,
     "insights": {
       "dayToDay": "...",
       "teamCulture": "...",
       "idealCandidate": "...",
       "insiderInsights": ""
     }
   }
   ```
2. **Persist insights** to the same `job_postings` columns/JSONB used by §3.

#### Done when

Sponsoring an ATS job from the browse feed creates a `JOB_POSTINGS` row with all four insights fields populated. The applicant-facing back card then renders them via §4.1.

---

### Combined impact of §4.1 + §4.2 + §3

Every sponsored back card — whether the job was created via `create-from-url` or by sponsoring an existing ATS job — will render:

- Sponsor name, photo, role, years at company
- Can-refer badge
- Four insights sections (Day-to-Day, Team Culture, Ideal Candidate, Insider Insights)

This replaces the current empty/blank state.

---

## 🔮 Optional — Not Ship Blockers

> The app works without these. They replace placeholder UI with real data and meaningfully improve the experience, but are not required for launch.

---

### Optional A — Real Work Email Verification for Sponsor Onboarding

**Affects:** `components/SponsorQuestionnaire.tsx` — step 8 "Verify your employment"

**What's showing now:** The last step of sponsor sign-up asks for a work email (e.g. `name@company.com`). When the sponsor presses "Verify & Complete", the app shows a fake "Awaiting verification..." spinner for exactly **6 seconds** then submits registration regardless — no actual email was sent, no link was clicked, nothing was verified. The "Resend" button is also fake (a `setTimeout` with no API call).

**What users expect:** A real verification email sent to their work address, confirming they are actually employed at the company they claimed.

#### Endpoints needed

**1. `POST /api/auth/verify-work-email/send/`**

- Sends a verification link to the provided work email address
- Ties the pending verification to the authenticated user's session
- `200 → { "message": "Verification email sent to name@company.com" }`

**2. `POST /api/auth/verify-work-email/confirm/`** (called when user clicks the link)

- Validates the token from the email link
- Marks `sponsor_profiles.work_email_verified = true` in the DB
- `200 → { "verified": true }`

**3. `GET /api/auth/verify-work-email/status/`** *(optional — enables auto-advance UI)*

- Polled by the frontend to check if the user has clicked the link

#### Frontend impact

Once the endpoints exist, `SponsorQuestionnaire.tsx` can:

1. Call `POST /api/auth/verify-work-email/send/` when the sponsor presses "Verify & Complete"
2. Show "Awaiting verification..." and poll `GET /api/auth/verify-work-email/status/` every few seconds
3. Auto-advance to `handleFinalSubmit()` when `verified: true` is returned
4. Wire the "Resend" button to a second call to the send endpoint

**Current state until shipped:** The fake 6-second delay will be removed and replaced with a direct submit — work email is still collected and stored, just not verified. The "Verify your employment" step becomes a "Confirm your work email" collection step only.

---

### Optional B — Notifications Enhancements

**Affects:** `components/NotificationsView.tsx`

**Context:** The notifications list is now fully interactive — tap-to-navigate, swipe-to-mark-read, pull-to-refresh, date grouping, ticking relative times. The items below unlock functionality the frontend cannot implement alone.

#### 1. `DELETE /api/notifications/<id>/` — true per-row dismiss

- Marks a single notification as dismissed for the owning user (hard delete or soft-delete via `DISMISSED_AT`)
- `200 → { "message": "Notification deleted" }`

*Why:* Swipe currently maps to mark-as-read because there is no delete endpoint. Users expect swipe-away to mean gone.

#### 2. `DELETE /api/notifications/?only=read` — bulk clear read

- Deletes/dismisses all read notifications for the authenticated user
- `200 → { "deleted_count": N }`

*Why:* Read notifications accumulate forever today. A "Clear read" action needs this.

#### 3. Denormalized metadata on notification rows

Add nullable fields to the `GET /api/notifications/` response:

- `RELATED_USER_NAME` (string)
- `RELATED_USER_PHOTO_URL` (string)
- `RELATED_JOB_TITLE` (string)
- `RELATED_JOB_COMPANY` (string)

*Why:* The frontend has `RELATED_USER_ID` / `RELATED_JOB_ID` but no display data. Without these, richer cards ("John Smith liked *Senior Engineer* at Acme") require N+1 follow-up fetches per notification.

#### 4. Realtime (or a cheap poll) channel

Either:

- WebSocket `/ws/notifications/` that pushes newly-created rows, or
- `GET /api/notifications/?since=<iso_timestamp>` to return only rows created after a client-held cursor

*Why:* The list is fetched once on mount and stale for the duration of the session. The `unread-count` poll updates the badge but not the list itself. A focused user sitting on the notifications screen never sees new rows arrive.

#### 5. Server-side grouping of repeat events

Aggregate near-identical events into a single row with a count (e.g., 5 `job_like` notifications on the same job within 10 minutes → one row, `body: "5 new applicants interested"`).

*Why:* High-activity users (especially sponsors) can otherwise receive a cascade of identical rows, burying other events.

#### Frontend impact (when each ships)

1. Swap swipe-to-mark-read → swipe-to-delete; add "Clear read" button in header
2. Render richer cards with actual names/photos/job titles instead of generic `BODY` strings
3. Live list updates without manual pull-to-refresh
4. Collapse grouped rows with a count badge

**Current state:** Swipe → mark-read. All rows persist until manually marked. Cards show the generic server-provided `TITLE` / `BODY` only. Fresh rows appear only on pull-to-refresh or re-navigation.

---

### Optional C — Enrich `/api/profiles/pack/` with Bio + Insights

**Affects:** `components/HomeView.tsx` — sponsor swipe deck

**What's showing now:** The sponsor's swipe deck calls `fetch_profile_pack` ([queries/profiles.py:156](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/profiles.py#L156)), which returns a deliberately minimal projection: `USER_ID`, `FIRST_NAME`, `LAST_NAME`, `LOCATION`, `PHOTO_URL`, `REASON`, `POSITIONS`, `SKILLS`. It **omits** `applicant_profile.INSIGHTS` and the base `BIO`.

When a sponsor flips an applicant card to view the back (insights/prompts), the panel is blank. The front-of-card "About" also falls back to the much shorter `REASON` field instead of the user's actual `BIO`.

**Frontend workaround in place:** `HomeView.tsx` eager-fetches `GET /profiles/<USER_ID>/public/` for each card the sponsor lands on, caches the response keyed by `USER_ID` in `fullProfileCache`, and renders cached `INSIGHTS` + `BIO` when available. This works but doubles network round-trips per swipe and adds a brief loading state on the back of the card.

#### What to build

Extend `fetch_profile_pack`'s SELECT list to include:

```sql
ap.INSIGHTS::TEXT,
up.BIO
```

…and return them on each pack row. Schema for `INSIGHTS` is already established as `[{"question": "...", "answer": "..."}]`.

#### Done when

`fetch_profile_pack` returns `INSIGHTS` + `BIO` per row, and the per-card lazy `getPublicProfile` call in `HomeView.tsx` (plus the `fullProfileCache` state) can be deleted — the swipe deck renders insights and full bio on first paint with zero extra requests.

---

## 📝 Changelog

| Date       | Change                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-04-27 | Audited against backend HEAD `125b425`. Verified company-filter for browse feed shipped (PR #36) — removed from doc. Reformatted with summary table, status badges, and "done when" criteria per item. |
| 2026-04-27 | Added §4.3 (insights on `sponsor_job`). Frontend 3-step flow shipped same day. |
| 2026-04-27 | Removed three Optionals (applications, profile stats, public profile stats) per scope decision. Renumbered surviving optionals to A, B, C. |
| 2026-04-28 | Removed per-job referral note entirely (was old §4.2). Renumbered §4.3 → §4.2. The post-match referrals system in `MatchesView.tsx` / `lib/api.ts` is unaffected — that's a separate feature. |
