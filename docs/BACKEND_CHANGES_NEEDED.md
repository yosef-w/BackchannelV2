# Backend Changes Needed

> **Database migration (PR #25, April 2026):** The backend has migrated from **Snowflake** (OLTP) to **PostgreSQL**. All SQL patches in this document have been updated to use plain PostgreSQL table names and `psycopg2` cursor patterns. Snowflake is now used **only** for the Cortex AI pipeline (resume parsing, autofill). The `execute_query()` helper now wraps `psycopg2` instead of `snowflake-connector-python`, but its call signature is identical — no other call sites need changes.

---

## ✅ Recently Resolved

| Item     | Description                                                      | Resolved in                                                        |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| ~~2~~    | `GET /api/likes/profiles/received/`                              | PR #16                                                             |
| ~~3~~    | `skills` field in `PATCH /api/profile/sponsor/update/`           | PR #16                                                             |
| ~~4~~    | `INSIGHTS` in `GET /api/profile/` response                       | Migration 003                                                      |
| ~~5~~    | `BIO`, `CURRENT_ROLE`, `COUNTRY` in `GET /api/profile/` response | Migration 003                                                      |
| ~~6~~    | `POST /api/auth/change-email/` stub                              | PR #16 (501 stub; full flow still needed — see updated item below) |
| ~~P2-1~~ | `DELETE /api/jobs/<id>/unsponsor/` endpoint                      | PR #17                                                             |
| ~~8~~    | Wire `unsponsorJob()` to sponsor UI                              | Done — `JobsView.tsx` `handleUnsponsor`                            |
| ~~10~~   | Read `role` from login response in auth store                    | Done — `AuthScreen.tsx` line 70, `useAuthStore`                    |
| ~~11~~   | `MessagesView` conversations pagination                          | Done — `loadMoreConversations` + Load More button                  |
| ~~12~~   | Show `relevance_score` badge on job cards                        | Done — `HomeView.tsx` `relevancePill`                              |

---

## 1. Expose `SPONSOR_USER_ID` in `GET /api/matches/`

**File:** `bc_microservices/queries/likes.py` → `get_job_matches_for_user`

**Change:** Add `j.sponsor_id AS "SPONSOR_USER_ID"` to the SELECT.

```sql
-- Add this line to the SELECT in get_job_matches_for_user:
j.sponsor_id AS "SPONSOR_USER_ID",
```

**Why:** `j.SPONSOR_ID` is already used in the JOIN condition but is never returned in the response. Without it, the frontend cannot call `GET /api/profiles/<userId>/public/` to load the sponsor's bio, location, tenure, referral details, and Key Insights (Q&A from onboarding).

**Frontend requirement:** When an applicant taps a matched sponsor's profile image in `MatchesView`, the app calls `getPublicProfile(SPONSOR_USER_ID)` to populate the profile modal with:

- Bio (`BIO`)
- Location (`CITY`, `STATE`)
- Sponsor profile details (`DURATION`, `OPEN_TO_REFERRALS`, `FINANCIAL_REWARD`)
- Key Insights (`sponsor_profile.INSIGHTS` — the Q&A prompts from sign-up)

Until this is deployed, the modal shows only the basic fields already on the match card (name, job title, company, photo).

---

## ~~2. Add `GET /api/likes/profiles/received/` — Sponsors Who Liked the Applicant~~ ✅ RESOLVED (PR #16)

> **This endpoint has been deployed.** `getInterestedSponsors()` in `lib/api.ts` is already wired and working. The "Interested in You" section in `MatchesView` is live. No backend work required.
>
> The PostgreSQL query backing this endpoint (for reference):

```sql
SELECT
    pl.like_id        AS "LIKE_ID",
    pl.liked_at       AS "LIKED_AT",
    pl.sponsor_user_id AS "SPONSOR_USER_ID",
    pl.job_id         AS "JOB_ID",
    u.first_name      AS "SPONSOR_FIRST_NAME",
    u.last_name       AS "SPONSOR_LAST_NAME",
    u.photo_url       AS "SPONSOR_PHOTO_URL",
    sp.job_title      AS "SPONSOR_JOB_TITLE",
    sp.company        AS "SPONSOR_COMPANY"
FROM profile_likes pl
JOIN users u              ON u.user_id = pl.sponsor_user_id
JOIN sponsor_profiles sp  ON sp.user_id = pl.sponsor_user_id
WHERE pl.applicant_user_id = %s
  AND pl.like_id NOT IN (SELECT like_id FROM matches)
ORDER BY pl.liked_at DESC
```

---

## ~~3. Add `skills` field to `PATCH /api/profile/sponsor/update/`~~ ✅ RESOLVED (PR #16)

> **The `skills` field is now accepted** by `PATCH /api/profile/sponsor/update/`. Sponsor expertise tags persist correctly across sessions. No backend work required.

---

## ~~4. Add `INSIGHTS` to `GET /api/profile/` response~~ ✅ RESOLVED (Migration 003)

> **`INSIGHTS` is now returned** in both `applicant_profile` and `sponsor_profile` sub-objects. `fetchFromBackend` in `useUserProfileStore.ts` reads it automatically. No backend work required.

---

## ~~5. Add `BIO`, `CURRENT_ROLE` (applicant), and address fields to `GET /api/profile/` response~~ ✅ RESOLVED (Migration 003)

> **These fields are now returned** by `GET /api/profile/`. `BIO`, `CURRENT_ROLE`, `COUNTRY` survive logout/login cycles. `fetchFromBackend` in `useUserProfileStore.ts` reads them automatically. No backend work required.

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

## 7. Add Redis Caching to `likes.py` and `messaging.py` — Performance Gap

### Root cause of latency

The backend migrated to **PostgreSQL** (PR #25), which is significantly faster than Snowflake for OLTP queries. However, the three most-called screens — **Matches**, **Messages**, and **Profile GET** — still bypass Redis entirely and hit PostgreSQL on every single request. With complex multi-table JOINs, this adds 50–200 ms of unnecessary latency per screen load. The app already has Redis configured and a `cached_query` helper that works correctly.

### What IS cached (for reference)

The following already use `cached_query` correctly: `user_basic:`, `pub_profile:`, `sponsor_info:`, `sp_job:`, `notif_count:`. These were the right calls.

### What is NOT cached (the gaps)

| File                   | Function                                                           | Tables JOINed           | Called from                            |
| ---------------------- | ------------------------------------------------------------------ | ----------------------- | -------------------------------------- |
| `queries/likes.py`     | `get_job_matches_for_user`                                         | 5                       | `GET /api/matches/` (applicant)        |
| `queries/likes.py`     | `get_liked_jobs_for_user`                                          | 4                       | `GET /api/likes/jobs/`                 |
| `queries/likes.py`     | `get_sponsor_matches`                                              | 4                       | `GET /api/matches/sponsor/`            |
| `queries/likes.py`     | `get_applicants_who_liked_job`                                     | 3                       | `GET /api/jobs/<id>/likes/applicants/` |
| `queries/messaging.py` | `list_conversations_for_user`                                      | **7 + window function** | `GET /api/messages/conversations/`     |
| `queries/messaging.py` | `get_messages`                                                     | 2                       | `GET /api/messages/history/`           |
| `queries/profile.py`   | `get_profile_data` + `get_applicant_profile`/`get_sponsor_profile` | multiple                | `GET /api/profile/`                    |

---

### Patch 1 — `queries/likes.py`

Add the import at the top of the file:

```python
from ..cache import cached_query, invalidate, TTL_SHORT, TTL_MEDIUM, TTL_LONG, TTL_VERY_LONG
```

Replace the four read functions with cached versions:

```python
def get_liked_jobs_for_user(user_id):
    def _fetch():
        q = """
        SELECT l.like_id, l.created_at AS liked_at, l.notes, l.status,
               j.job_id, j.title, j.company, j.location, j.remote_option,
               j.salary_min, j.salary_max, j.salary_currency, j.experience_level,
               j.description,
               sp_up.first_name AS "SPONSOR_FIRST_NAME",
               sp_up.last_name  AS "SPONSOR_LAST_NAME",
               sp_up.photo_url  AS "SPONSOR_PHOTO_URL",
               sp.job_title     AS "SPONSOR_JOB_TITLE"
        FROM likes l
        JOIN job_postings j        ON l.job_id = j.job_id
        LEFT JOIN user_profiles sp_up ON sp_up.user_id = j.sponsor_id
        LEFT JOIN sponsor_profiles sp ON sp.user_id = j.sponsor_id
        WHERE l.user_id = %s AND l.status IN ('ACTIVE', 'MATCHED')
        ORDER BY l.created_at DESC
        """
        with get_cursor() as cur:
            cur.execute(q, (user_id,))
            return cur.fetchall()
    return cached_query(f"liked_jobs:{user_id}", TTL_MEDIUM, _fetch)


def get_job_matches_for_user(user_id):
    def _fetch():
        q = """
        SELECT l.like_id, l.created_at AS matched_at,
               j.job_id, j.title, j.company, j.location,
               u.username  AS sponsor_username, u.email AS sponsor_email,
               sp_up.first_name AS "SPONSOR_FIRST_NAME",
               sp_up.last_name  AS "SPONSOR_LAST_NAME",
               sp_up.photo_url  AS "SPONSOR_PHOTO_URL",
               sp.job_title     AS "SPONSOR_JOB_TITLE",
               sp.company       AS "SPONSOR_COMPANY",
               j.sponsor_id     AS "SPONSOR_USER_ID"
        FROM likes l
        JOIN job_postings j        ON l.job_id = j.job_id
        JOIN users u               ON j.sponsor_id = u.user_id
        LEFT JOIN user_profiles sp_up ON sp_up.user_id = j.sponsor_id
        LEFT JOIN sponsor_profiles sp ON sp.user_id = j.sponsor_id
        WHERE l.user_id = %s AND l.status = 'MATCHED'
        ORDER BY l.created_at DESC
        """
        with get_cursor() as cur:
            cur.execute(q, (user_id,))
            return cur.fetchall()
    return cached_query(f"matches:{user_id}", TTL_MEDIUM, _fetch)


def get_sponsor_matches(sponsor_id):
    def _fetch():
        q = """
        SELECT l.like_id, l.created_at AS matched_at, l.user_id AS applicant_user_id,
               j.job_id, j.title, j.company, j.location,
               up.first_name, up.last_name, up.photo_url, up.location AS applicant_location,
               ap.skills::text, ap.positions::text, ap.industry, ap.resume_data::text
        FROM likes l
        JOIN job_postings j         ON l.job_id = j.job_id
        LEFT JOIN user_profiles up  ON up.user_id = l.user_id
        LEFT JOIN applicant_profiles ap ON ap.user_id = l.user_id
        WHERE j.sponsor_id = %s AND l.status = 'MATCHED'
        ORDER BY l.created_at DESC
        """
        with get_cursor() as cur:
            cur.execute(q, (sponsor_id,))
            return cur.fetchall()
    return cached_query(f"sponsor_matches:{sponsor_id}", TTL_MEDIUM, _fetch)


def get_applicants_who_liked_job(job_id):
    def _fetch():
        q = """
        SELECT l.user_id AS "APPLICANT_USER_ID", l.created_at AS "LIKED_AT", l.status,
               up.first_name, up.last_name, up.location, up.role_type, up.photo_url,
               ap.skills::text, ap.positions::text, ap.industry, ap.resume_data::text
        FROM likes l
        LEFT JOIN user_profiles up  ON up.user_id = l.user_id
        LEFT JOIN applicant_profiles ap ON ap.user_id = l.user_id
        WHERE l.job_id = %s AND l.status IN ('ACTIVE', 'MATCHED')
        ORDER BY l.created_at DESC
        """
        with get_cursor() as cur:
            cur.execute(q, (job_id,))
            return cur.fetchall()
    return cached_query(f"job_likes:{job_id}", TTL_SHORT, _fetch)
```

Add cache invalidation to the **write functions** in the same file:

```python
def create_job_like(user_id, job_id, notes=''):
    """Insert a new ACTIVE like for a job. Returns the new like_id."""
    like_id = str(uuid.uuid4())
    q = """..."""  # keep existing SQL
    with get_cursor() as cur:
        cur.execute(q, (like_id, user_id, job_id, notes))
    # Invalidate so the next read reflects the new like
    invalidate(f"liked_jobs:{user_id}", f"job_likes:{job_id}")
    return like_id


def set_matched(*like_ids):
    """Update one or more likes to MATCHED status."""
    q = "UPDATE likes SET status = 'MATCHED' WHERE like_id = %s"
    with get_cursor() as cur:
        for lid in like_ids:
            cur.execute(q, (lid,))
    # NOTE: The view layer that calls set_matched should also call:
    #   invalidate(f"matches:{applicant_user_id}", f"sponsor_matches:{sponsor_id}")
    # because set_matched doesn't have those IDs available here.
    # Alternatively, pass them as optional args.
```

---

### Patch 2 — `queries/messaging.py`

Add the import at the top of the file:

```python
from ..cache import cached_query, invalidate, TTL_SHORT, TTL_MEDIUM
```

Replace `list_conversations_for_user` with a cached version (TTL_SHORT because unread state changes frequently):

```python
def list_conversations_for_user(user_id):
    def _fetch():
        q = """
        SELECT
          c.conversation_id, c.job_id, c.applicant_user_id, c.sponsor_user_id, c.status,
          c.applicant_has_unread, c.sponsor_has_unread,
          j.title, j.company,
          last_msg.body AS last_body, last_msg.created_at AS last_at,
          app_up.first_name AS "APPLICANT_FIRST_NAME",
          app_up.last_name  AS "APPLICANT_LAST_NAME",
          app_up.photo_url  AS "APPLICANT_PHOTO_URL",
          ap.positions::text AS applicant_positions,
          spon_up.first_name AS "SPONSOR_FIRST_NAME",
          spon_up.last_name  AS "SPONSOR_LAST_NAME",
          spon_up.photo_url  AS "SPONSOR_PHOTO_URL",
          sp.job_title       AS "SPONSOR_JOB_TITLE",
          sp.company         AS "SPONSOR_COMPANY"
        FROM conversations c
        JOIN job_postings j ON j.job_id = c.job_id
        LEFT JOIN LATERAL (
          SELECT body, created_at
          FROM messages m
          WHERE m.conversation_id = c.conversation_id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) last_msg ON true
        LEFT JOIN user_profiles app_up    ON app_up.user_id = c.applicant_user_id
        LEFT JOIN applicant_profiles ap   ON ap.user_id = c.applicant_user_id
        LEFT JOIN user_profiles spon_up   ON spon_up.user_id = c.sponsor_user_id
        LEFT JOIN sponsor_profiles sp     ON sp.user_id = c.sponsor_user_id
        WHERE c.applicant_user_id = %s OR c.sponsor_user_id = %s
        ORDER BY last_msg.created_at DESC NULLS LAST
        """
        with get_cursor() as cur:
            cur.execute(q, (user_id, user_id))
            return cur.fetchall()
    return cached_query(f"conversations:{user_id}", TTL_SHORT, _fetch)
```

> **PostgreSQL note:** The `LATERAL` subquery replaces the Snowflake `ROW_NUMBER()` window function subquery. Both return the most recent message per conversation; `LATERAL` is idiomatic PostgreSQL and avoids materialising all messages.

Add invalidation to the write functions:

```python
def insert_message(conversation_id, sender_user_id, body):
    # ... existing insert + unread-flag SQL (keep as-is) ...

    # Invalidate conversation list cache for both participants
    detail = get_conversation_detail(conversation_id)
    if detail:
        invalidate(
            f"conversations:{detail['applicant_user_id']}",
            f"conversations:{detail['sponsor_user_id']}",
        )


def clear_unread(conversation_id, user_id):
    # ... keep existing SQL ...
    # Invalidate so the unread badge clears immediately
    invalidate(f"conversations:{user_id}")
```

---

### Patch 3 — Full Profile GET (Profile Screen, `queries/profile.py`)

The `GET /api/profile/` endpoint runs **3 sequential PostgreSQL queries** per request. Add a single cached key for the full profile data:

```python
from ..cache import cached_query, invalidate, TTL_LONG

def get_full_profile(user_id):
    """Cached wrapper that returns the merged full profile dict used by GET /api/profile/."""
    def _fetch():
        user_row     = get_user_row(user_id)          # existing function
        profile_data = get_profile_data(user_id)       # existing function
        role         = profile_data.get("role_type") if profile_data else None
        if role == "Applicant":
            role_profile = get_applicant_profile(user_id)
        else:
            role_profile = get_sponsor_profile(user_id)
        return {
            "user": user_row,
            "profile": profile_data,
            "role_profile": role_profile,
        }
    return cached_query(f"full_profile:{user_id}", TTL_LONG, _fetch)
```

Then in the view for `GET /api/profile/`, call `get_full_profile(user_id)` instead of the three separate functions.

**Invalidation** — add `full_profile:{user_id}` to the same calls that already clear `user_basic:` and `pub_profile:`:

```python
# In the profile update view (wherever invalidate_user_cache is called):
invalidate(f"user_basic:{user_id}", f"pub_profile:{user_id}", f"full_profile:{user_id}")
```

---

### Expected impact

| Screen                  | Before (uncached PostgreSQL query)           | After (Redis cache hit) |
| ----------------------- | -------------------------------------------- | ----------------------- |
| Matches screen open     | ~50–150 ms (5-table JOIN)                    | **< 5 ms**              |
| Messages inbox open     | ~80–200 ms (7-table JOIN + LATERAL subquery) | **< 5 ms**              |
| Profile screen open     | ~50–120 ms (3 sequential queries)            | **< 5 ms**              |
| Profile update (PATCH)  | unchanged — writes always go to DB           | unchanged               |
| New match / new message | unchanged — writes + invalidation            | unchanged               |

Cache misses (first load after a write or after TTL expires) still hit PostgreSQL at the same speed as today. Every subsequent request within the TTL window is served from Redis in under 5 ms.

---

# Phase 2 — New Endpoints

> Items marked ✅ have been deployed. Items without a status marker are still pending.

---

## ~~P2-1. Add `DELETE /api/jobs/<job_id>/unsponsor/`~~ ✅ RESOLVED (PR #17)

> **Deployed.** `unsponsorJob(jobId)` in `lib/api.ts` has been added and calls `DELETE /api/jobs/<id>/unsponsor/`. The endpoint is live. `handleUnsponsor` in `JobsView.tsx` calls `unsponsorJob(job.id)`, does an optimistic removal via `removeMyJob`, and re-fetches on error.

---

## ~~8. Wire `unsponsorJob()` to Sponsor UI~~ ✅ DONE

> **Completed.** `handleUnsponsor` in `components/JobsView.tsx` calls `unsponsorJob(job.id)` when a sponsor taps the remove action on a sponsored job card. The job is optimistically removed from the `useJobsStore` state immediately; if the API call fails, `refreshMyJobs` reverts the list and shows an error alert. No further work required.

---

## 9. Add `work_preferences` to `POST /api/register/` — Applicant Registration

**File:** `bc_microservices/views/views_auth.py` (or wherever the `/api/register/` handler lives)  
**Table:** `applicant_profiles` (PostgreSQL — `JSONB` column, same pattern as `skills` and `insights`)

**Change:** Accept a `work_preferences` field (array of strings) in the applicant registration endpoint, mirroring its existing support in `PATCH /api/profile/applicant/update/`.

**Why:** The sign-up questionnaire now includes a "What are your work preferences?" step (multi-select chips: Remote, Hybrid, On-site, Full-time, Part-time, Contract, etc.). The frontend submits the selection as `work_preferences` in the registration payload, but the current `/api/register/` handler ignores it. The field is then lost — it does not appear on the Profile page until the user manually edits it after sign-up.

**Expected request body field (alongside existing registration fields):**

```json
{
  "username": "...",
  "email": "...",
  "password": "...",
  "role": "Applicant",
  "industry": "Technology",
  "current_role": "Software Engineer",
  "positions": "Senior Product Lead",
  "skills": ["React", "Product Strategy"],
  "insights": [{ "question": "MY SECRET SUPERPOWER", "answer": "..." }],
  "work_preferences": ["Remote", "Hybrid", "Full-time"]
}
```

**Storage:** Save `work_preferences` to `applicant_profiles.work_preferences` (JSONB, same pattern as `skills` and `insights`).

**Frontend:** Already wired. `ApplicantQuestionnaire.tsx` includes `work_preferences` in the registration payload. `lib/auth-api.ts` passes it through as `work_preferences`. Until this is deployed, the field is silently ignored by the backend — the user must add work preferences manually via the Edit Profile modal after sign-up.

**Also needed — expose in `GET /api/profile/` response:**

Once saved, add `WORK_PREFERENCES` to the `applicant_profile` sub-object returned by `GET /api/profile/` so it survives logout/login cycles:

```json
{
  "applicant_profile": {
    "INDUSTRY": "...",
    "SKILLS": [...],
    "WORK_PREFERENCES": ["Remote", "Hybrid"]
  }
}
```

The frontend `fetchFromBackend` in `useUserProfileStore.ts` already reads `applicant_profile.WORK_PREFERENCES` and will pick this up automatically once returned.

---

## ~~10. Use `role` from Login Response in Auth Store (PR #19)~~ ✅ DONE

> **Completed.** `AuthScreen.tsx` calls `setAuthTokens(data.access_token, data.refresh_token, data.role)` — the role from the login response is persisted to `SecureStore` (key `"user_role"`) and stored in `useAuthStore.role`. `useAuthStore.loadTokens` restores it on app restart. Role determination no longer requires a subsequent `GET /api/profile/` call. No further work required.

---

## ~~11. Implement Pagination in `MessagesView` Conversations List (PR #22)~~ ✅ DONE

> **Completed.** `MessagesView.tsx` fetches `getConversations({ limit: 20, offset: 0 })` on mount, tracks `conversationsTotalCount` from `response.total_count`, and renders a "Load More Conversations" button when `conversations.length < conversationsTotalCount`. `loadMoreConversations` fetches the next page using `offset: conversations.length` and appends results. No further work required.

---

## ~~12. Display `relevance_score` in Job Cards (Optional Enhancement, PR #24)~~ ✅ DONE

> **Completed.** `HomeView.tsx` renders a `relevancePill` badge on job swipe cards whenever `currentData.relevanceScore > 0`. The badge shows `"XX% Match"` using `Math.round(relevanceScore * 100)` — displayed in green (≥ 70%) or amber (< 70%). The pill only renders when a non-zero score is present, so it degrades gracefully if the backend doesn't return one. No further work required.

---

## 🚀 Backend Handoff — Remaining Blockers

> These are the **only two items** blocking full app functionality. Both require backend-side changes; the frontend is already wired and waiting. Detailed specs appear earlier in this file at the section numbers noted below.

---

### Blocker 1 — `SPONSOR_USER_ID` missing from `GET /api/matches/`

**See full spec: §1 in this file**

**What's broken for users:**
When an applicant taps a job match and opens the "Key Insights" modal (page 2), the sponsor profile section is empty. The frontend needs the sponsor's user ID to fetch the sponsor's public profile — but the matches response doesn't include it.

**What to change:**
In the SQL query inside `get_job_matches_for_user`, add one column to the SELECT:

```sql
j.sponsor_id AS "SPONSOR_USER_ID"
```

This field already exists on the `jobs` table — it just isn't being returned. The frontend already reads `match.SPONSOR_USER_ID` and will pick it up automatically once the field is present.

**Endpoint:** `GET /api/matches/`
**Field to add:** `"SPONSOR_USER_ID": <integer>` on each match object

---

### Blocker 2 — `work_preferences` ignored by `POST /api/register/`

**See full spec: §9 in this file**

**What's broken for users:**
During onboarding, applicants select their work preferences (remote/hybrid/on-site, location, salary range, etc.). These are sent in the `work_preferences` field of the registration payload — but the backend currently ignores the field, so the preferences are silently dropped and the user's profile is incomplete after sign-up.

**What to change:**

1. In `POST /api/register/`, read `work_preferences` from the request body and save it to `applicant_profiles.work_preferences` (JSONB column — already exists on the model).
2. In `GET /api/profile/`, include the saved value as `"WORK_PREFERENCES"` in the `applicant_profile` nested object.

The frontend `fetchFromBackend` in `useUserProfileStore.ts` already reads `applicant_profile.WORK_PREFERENCES` and will display the data automatically once it's returned.

**Endpoints affected:**

- `POST /api/register/` — must persist `work_preferences`
- `GET /api/profile/` — must return `"WORK_PREFERENCES"` inside `applicant_profile`

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
