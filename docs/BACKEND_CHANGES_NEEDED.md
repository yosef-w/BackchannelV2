# Backend Changes Needed

---

## 1. Expose `SPONSOR_USER_ID` in `GET /api/matches/`

**File:** `bc_microservices/queries/likes.py` → `get_job_matches_for_user`

**Change:** Add `j.SPONSOR_ID AS SPONSOR_USER_ID` to the SELECT.

```sql
-- Add this line to the SELECT in get_job_matches_for_user:
j.SPONSOR_ID AS SPONSOR_USER_ID,
```

**Why:** `j.SPONSOR_ID` is already used in the JOIN condition but is never returned in the response. Without it, the frontend cannot call `GET /api/profiles/<userId>/public/` to load the sponsor's bio, location, tenure, referral details, and Key Insights (Q&A from onboarding).

**Frontend requirement:** When an applicant taps a matched sponsor's profile image in `MatchesView`, the app calls `getPublicProfile(SPONSOR_USER_ID)` to populate the profile modal with:

- Bio (`BIO`)
- Location (`CITY`, `STATE`)
- Sponsor profile details (`DURATION`, `OPEN_TO_REFERRALS`, `FINANCIAL_REWARD`)
- Key Insights (`sponsor_profile.INSIGHTS` — the Q&A prompts from sign-up)

Until this is deployed, the modal shows only the basic fields already on the match card (name, job title, company, photo).

---

## 2. Add `GET /api/likes/profiles/received/` — Sponsors Who Liked the Applicant

**File:** `bc_microservices/views/views_matching.py` (new view) + `bc_microservices/urls.py` (new route)

**Change:** Create a new authenticated GET endpoint that returns a list of sponsor profile-likes directed at the currently authenticated applicant where no mutual match exists yet (i.e. one-sided sponsor interest).

**Suggested query** (`bc_microservices/queries/likes.py`):

```sql
SELECT
    pl.LIKE_ID,
    pl.LIKED_AT,
    pl.SPONSOR_USER_ID,
    pl.JOB_ID,
    u.FIRST_NAME        AS SPONSOR_FIRST_NAME,
    u.LAST_NAME         AS SPONSOR_LAST_NAME,
    u.PHOTO_URL         AS SPONSOR_PHOTO_URL,
    sp.JOB_TITLE        AS SPONSOR_JOB_TITLE,
    sp.COMPANY          AS SPONSOR_COMPANY
FROM PROFILE_LIKES pl
JOIN USERS u         ON u.USER_ID = pl.SPONSOR_USER_ID
JOIN SPONSOR_PROFILES sp ON sp.USER_ID = pl.SPONSOR_USER_ID
WHERE pl.APPLICANT_USER_ID = :applicant_user_id
  AND pl.LIKE_ID NOT IN (
      SELECT LIKE_ID FROM MATCHES
  )
ORDER BY pl.LIKED_AT DESC
```

**Expected response (200):**

```json
[
  {
    "LIKE_ID": "uuid",
    "LIKED_AT": "2026-03-01T12:00:00Z",
    "SPONSOR_USER_ID": "uuid",
    "JOB_ID": "uuid",
    "SPONSOR_FIRST_NAME": "Emily",
    "SPONSOR_LAST_NAME": "Rodriguez",
    "SPONSOR_PHOTO_URL": "https://...",
    "SPONSOR_JOB_TITLE": "VP of Engineering",
    "SPONSOR_COMPANY": "Stripe"
  }
]
```

**Why:** The "Interested in You" section in `MatchesView` surfaces sponsors who have already swiped right on an applicant but haven't yet been reciprocated. This is a high-signal, high-intent signal for the applicant — they should be prompted to view the sponsor's profile and potentially match. The frontend (`getInterestedSponsors()` in `lib/api.ts`) is already wired and ready to consume this endpoint.

**Frontend behaviour once deployed:**

- `MatchesView` fetches this list on mount (applicant view only).

---

## 3. Add `skills` field to `PATCH /api/profile/sponsor/update/`

**File:** `bc_microservices/views/views_profile.py` → sponsor profile update handler
**Table:** `SPONSOR_PROFILES` (or wherever sponsor skills are stored)

**Change:** Accept a `skills` field (array of strings) in the sponsor profile update endpoint, mirroring the existing `skills` field in `PATCH /api/profile/applicant/update/`.

**Why:** The "I Can Help With" section on the sponsor's edit profile screen allows them to add/remove skill/expertise tags. These are saved locally and sent to the backend via `updateSponsorProfile({ skills })`. Without this field being accepted, sponsor expertise tags are lost on the next app launch.

**Expected request body field:**

```json
{ "skills": ["Fundraising", "B2B Sales", "Product Strategy"] }
```

**Frontend:** Already wired. `handleAddTag("expertise")` and `handleRemoveTag("expertise")` in `ProfileView.tsx` call `updateSponsorProfile({ skills })` for sponsor users.

---

## 4. Add `INSIGHTS` to `GET /api/profile/` response

**File:** `bc_microservices/views/views_profiles.py` → handler for `GET /api/profile/`

**Change:** Include the user's insights array in the response, nested under the role-specific sub-object (`applicant_profile` or `sponsor_profile`).

**Why:** `GET /api/profile/` currently returns `applicant_profile` and `sponsor_profile` sub-objects but omits `INSIGHTS` from both. On every login, the frontend calls this endpoint and rebuilds local state from the response. Because INSIGHTS is missing, any insights the user saved (via `PATCH /api/profile/applicant/update/` or `PATCH /api/profile/sponsor/update/`) are invisible after a logout/login cycle.

The frontend has a short-term workaround (preserving the locally cached value when the backend doesn't return insights), but this breaks if the user logs in on a new device or clears app storage.

**Expected change to response shape:**

```json
{
  "applicant_profile": {
    "INDUSTRY": "...",
    "SKILLS": [...],
    "INSIGHTS": [{ "question": "...", "answer": "..." }]
  }
}
```

```json
{
  "sponsor_profile": {
    "COMPANY": "...",
    "JOB_TITLE": "...",
    "INSIGHTS": [{ "question": "...", "answer": "..." }]
  }
}
```

**Frontend:** `fetchFromBackend` in `stores/useUserProfileStore.ts` already reads `(profile as any).applicant_profile?.INSIGHTS` and `(profile as any).sponsor_profile?.INSIGHTS` — it will pick this up automatically once the backend returns the field.

- Each result is displayed as a tappable card in the **"Interested in You"** section.
- Tapping opens a full profile modal that also calls `GET /api/profiles/<SPONSOR_USER_ID>/public/` to show bio, referral capabilities, and Key Insights.
- Until the endpoint is live the section silently shows an empty state (no error banner).

---

## 5. Add `BIO`, `CURRENT_ROLE` (applicant), and address fields to `GET /api/profile/` response

**File:** `bc_microservices/views/views_profiles.py` → handler for `GET /api/profile/`

**Change:** Include the following fields in the top-level response object:

| Field     | Source          | Currently missing?                                   |
| --------- | --------------- | ---------------------------------------------------- |
| `BIO`     | `USERS.BIO`     | ✅ Missing                                           |
| `STREET`  | `USERS.STREET`  | ✅ Missing (intentionally private — skip if desired) |
| `ZIP`     | `USERS.ZIP`     | ✅ Missing (intentionally private — skip if desired) |
| `COUNTRY` | `USERS.COUNTRY` | ✅ Missing                                           |

And inside `applicant_profile`:

| Field          | Source                            | Currently missing? |
| -------------- | --------------------------------- | ------------------ |
| `CURRENT_ROLE` | `APPLICANT_PROFILES.CURRENT_ROLE` | ✅ Missing         |

**Why:** After a user logs out and logs back in, `clearData()` wipes the local SecureStore cache. On the next login, `GET /api/profile/` is the only source of truth. Fields not returned here are lost. Specifically:

- `BIO` — user edits bio via `PATCH /api/profile/update/ { bio }`, but it's never returned by GET so it always reverts to blank after logout.
- `CURRENT_ROLE` (applicant) — user edits their role via `PATCH /api/profile/applicant/update/ { current_role }`, but it's not in the GET response, so it reverts after logout.
- Address fields — `street`, `zip`, `country` are accepted by PATCH but not returned by GET.

**Note:** `COMPANY` and `JOB_TITLE` for sponsors ARE already in the `sponsor_profile` sub-object — the frontend reads them correctly. No change needed there.

**Frontend:** `fetchFromBackend` in `stores/useUserProfileStore.ts` already has the reading logic for all these fields with fallback patterns — it will pick them up automatically once the backend returns them.

---

## 6. Add `POST /api/auth/change-email/` — Email Change with Verification

**Why:** Email is the user's login credential and cannot be changed via a simple profile PATCH. The edit profile modal now shows email as **read-only** (lock icon) because `PATCH /api/profile/update/` does not (and should not) accept an `email` field.

To enable email changes, a dedicated flow is needed:

1. User submits new email → `POST /api/auth/change-email/ { new_email, current_password }` (password required to confirm identity)
2. Backend sends a verification link to the **new** email address
3. User clicks link → backend updates the email on the auth account
4. Frontend's next `GET /api/profile/` returns the new email automatically

**Suggested endpoint:** `POST /api/auth/change-email/`

**Request body:**

```json
{ "new_email": "newemail@example.com", "current_password": "secret" }
```

**Response (200):**

```json
{ "message": "Verification email sent to newemail@example.com" }
```

**Frontend:** The email field is currently locked with a "Contact support" note. Once this endpoint exists, replace that with a "Change Email" button that opens a dedicated modal with the above flow.

---

## 7. Add Redis Caching to `likes.py` and `messaging.py` — Critical Performance Gap

### Root cause of latency

The backend uses **Snowflake** as the database — a cloud data warehouse that has inherently higher per-query latency than a local Postgres instance (typically 100–500 ms per round-trip). The app already has Redis configured and a `cached_query` helper that works correctly. However, the three most-called screens — **Matches**, **Messages**, and **Profile GET** — bypass Redis entirely and hit Snowflake on every single request.

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
        SELECT l.LIKE_ID, l.CREATED_AT AS liked_at, l.NOTES, l.STATUS,
               j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION, j.REMOTE_OPTION,
               j.SALARY_MIN, j.SALARY_MAX, j.SALARY_CURRENCY, j.EXPERIENCE_LEVEL,
               j.DESCRIPTION,
               sp_up.FIRST_NAME AS SPONSOR_FIRST_NAME,
               sp_up.LAST_NAME  AS SPONSOR_LAST_NAME,
               sp_up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
               sp.JOB_TITLE     AS SPONSOR_JOB_TITLE
        FROM BACKCHANNEL_DEV.MATCHING.LIKES l
        JOIN BACKCHANNEL_DEV.JOBS.JOB_POSTINGS j ON l.JOB_ID = j.JOB_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES sp_up ON sp_up.USER_ID = j.SPONSOR_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.SPONSOR_PROFILES sp ON sp.USER_ID = j.SPONSOR_ID
        WHERE l.USER_ID = %s AND l.STATUS IN ('ACTIVE', 'MATCHED')
        ORDER BY l.CREATED_AT DESC
        """
        df = execute_query(q, (user_id,))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"liked_jobs:{user_id}", TTL_MEDIUM, _fetch)


def get_job_matches_for_user(user_id):
    def _fetch():
        q = """
        SELECT l.LIKE_ID, l.CREATED_AT AS matched_at,
               j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION,
               u.USERNAME  AS sponsor_username, u.EMAIL AS sponsor_email,
               sp_up.FIRST_NAME AS SPONSOR_FIRST_NAME,
               sp_up.LAST_NAME  AS SPONSOR_LAST_NAME,
               sp_up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
               sp.JOB_TITLE     AS SPONSOR_JOB_TITLE,
               sp.COMPANY       AS SPONSOR_COMPANY
        FROM BACKCHANNEL_DEV.MATCHING.LIKES l
        JOIN BACKCHANNEL_DEV.JOBS.JOB_POSTINGS j ON l.JOB_ID = j.JOB_ID
        JOIN BACKCHANNEL_DEV.USER_INFORMATION.USERS u ON j.SPONSOR_ID = u.USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES sp_up ON sp_up.USER_ID = j.SPONSOR_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.SPONSOR_PROFILES sp ON sp.USER_ID = j.SPONSOR_ID
        WHERE l.USER_ID = %s AND l.STATUS = 'MATCHED'
        ORDER BY l.CREATED_AT DESC
        """
        df = execute_query(q, (user_id,))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"matches:{user_id}", TTL_MEDIUM, _fetch)


def get_sponsor_matches(sponsor_id):
    def _fetch():
        q = """
        SELECT l.LIKE_ID, l.CREATED_AT AS matched_at, l.USER_ID AS applicant_user_id,
               j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION,
               up.FIRST_NAME, up.LAST_NAME, up.PHOTO_URL, up.LOCATION AS APPLICANT_LOCATION,
               ap.SKILLS, ap.POSITIONS, ap.INDUSTRY, ap.RESUME_DATA
        FROM BACKCHANNEL_DEV.MATCHING.LIKES l
        JOIN BACKCHANNEL_DEV.JOBS.JOB_POSTINGS j ON l.JOB_ID = j.JOB_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES up ON up.USER_ID = l.USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.APPLICANT_PROFILES ap ON ap.USER_ID = l.USER_ID
        WHERE j.SPONSOR_ID = %s AND l.STATUS = 'MATCHED'
        ORDER BY l.CREATED_AT DESC
        """
        df = execute_query(q, (sponsor_id,))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"sponsor_matches:{sponsor_id}", TTL_MEDIUM, _fetch)


def get_applicants_who_liked_job(job_id):
    def _fetch():
        q = """
        SELECT l.USER_ID AS APPLICANT_USER_ID, l.CREATED_AT AS LIKED_AT, l.STATUS,
               up.FIRST_NAME, up.LAST_NAME, up.LOCATION, up.ROLE_TYPE, up.PHOTO_URL,
               ap.SKILLS, ap.POSITIONS, ap.INDUSTRY, ap.RESUME_DATA
        FROM BACKCHANNEL_DEV.MATCHING.LIKES l
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES up ON up.USER_ID = l.USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.APPLICANT_PROFILES ap ON ap.USER_ID = l.USER_ID
        WHERE l.JOB_ID = %s AND l.STATUS IN ('ACTIVE','MATCHED')
        ORDER BY l.CREATED_AT DESC
        """
        df = execute_query(q, (job_id,))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"job_likes:{job_id}", TTL_SHORT, _fetch)
```

Add cache invalidation to the **write functions** in the same file:

```python
def create_job_like(user_id, job_id, notes=''):
    """Insert a new ACTIVE like for a job. Returns the new like_id."""
    like_id = str(uuid.uuid4())
    q = """..."""  # keep existing SQL
    execute_query(q, (like_id, user_id, job_id, notes))
    # Invalidate so the next read reflects the new like
    invalidate(f"liked_jobs:{user_id}", f"job_likes:{job_id}")
    return like_id


def set_matched(*like_ids):
    """Update one or more likes to MATCHED status."""
    q = "UPDATE BACKCHANNEL_DEV.MATCHING.LIKES SET STATUS = 'MATCHED' WHERE LIKE_ID = %s"
    for lid in like_ids:
        execute_query(q, (lid,))
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
          c.CONVERSATION_ID, c.JOB_ID, c.APPLICANT_USER_ID, c.SPONSOR_USER_ID, c.STATUS,
          c.APPLICANT_HAS_UNREAD, c.SPONSOR_HAS_UNREAD,
          j.TITLE, j.COMPANY,
          last_msg.BODY AS LAST_BODY, last_msg.CREATED_AT AS LAST_AT,
          app_up.FIRST_NAME AS APPLICANT_FIRST_NAME,
          app_up.LAST_NAME  AS APPLICANT_LAST_NAME,
          app_up.PHOTO_URL  AS APPLICANT_PHOTO_URL,
          ap.POSITIONS       AS APPLICANT_POSITIONS,
          spon_up.FIRST_NAME AS SPONSOR_FIRST_NAME,
          spon_up.LAST_NAME  AS SPONSOR_LAST_NAME,
          spon_up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
          sp.JOB_TITLE       AS SPONSOR_JOB_TITLE,
          sp.COMPANY         AS SPONSOR_COMPANY
        FROM BACKCHANNEL_DEV.MESSAGING.CONVERSATIONS c
        JOIN BACKCHANNEL_DEV.JOBS.JOB_POSTINGS j ON j.JOB_ID = c.JOB_ID
        LEFT JOIN (
          SELECT CONVERSATION_ID, BODY, CREATED_AT,
                 ROW_NUMBER() OVER (PARTITION BY CONVERSATION_ID ORDER BY CREATED_AT DESC) AS rn
          FROM BACKCHANNEL_DEV.MESSAGING.MESSAGES
        ) last_msg ON last_msg.CONVERSATION_ID = c.CONVERSATION_ID AND last_msg.rn = 1
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES app_up ON app_up.USER_ID = c.APPLICANT_USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.APPLICANT_PROFILES ap ON ap.USER_ID = c.APPLICANT_USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.USER_PROFILES spon_up ON spon_up.USER_ID = c.SPONSOR_USER_ID
        LEFT JOIN BACKCHANNEL_DEV.USER_INFORMATION.SPONSOR_PROFILES sp ON sp.USER_ID = c.SPONSOR_USER_ID
        WHERE c.APPLICANT_USER_ID = %s OR c.SPONSOR_USER_ID = %s
        ORDER BY last_msg.CREATED_AT DESC NULLS LAST
        """
        df = execute_query(q, (user_id, user_id))
        return df.to_dict('records') if df is not None and not df.empty else []
    return cached_query(f"conversations:{user_id}", TTL_SHORT, _fetch)
```

Add invalidation to the write functions. The `insert_message` and `clear_unread` functions need the other participant's ID. The cleanest approach is to call `get_conversation_detail` (which is already there) to look up both participants, then invalidate both:

```python
def insert_message(conversation_id, sender_user_id, body):
    # ... existing insert + unread-flag SQL (keep as-is) ...

    # Invalidate conversation list cache for both participants
    detail = get_conversation_detail(conversation_id)
    if detail:
        invalidate(
            f"conversations:{detail['APPLICANT_USER_ID']}",
            f"conversations:{detail['SPONSOR_USER_ID']}",
        )


def clear_unread(conversation_id, user_id):
    execute_query("""...""", (user_id, user_id, conversation_id))  # keep existing SQL
    # Invalidate so the unread badge clears immediately
    invalidate(f"conversations:{user_id}")
```

---

### Patch 3 — Full Profile GET (Profile Screen, `queries/profile.py`)

The `GET /api/profile/` endpoint runs **3 sequential Snowflake queries** per request. Add a single cached key for the full profile data:

```python
from ..cache import cached_query, invalidate, TTL_LONG

def get_full_profile(user_id):
    """Cached wrapper that returns the merged full profile dict used by GET /api/profile/."""
    def _fetch():
        user_row     = get_user_row(user_id)          # existing function
        profile_data = get_profile_data(user_id)       # existing function
        role         = profile_data.get("ROLE_TYPE") if profile_data else None
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

**Invalidation** — already handled: both `invalidate_user_cache` calls in the existing profile update views already clear `user_basic:` and `pub_profile:`. Add `full_profile:{user_id}` to those same invalidation calls:

```python
# In the profile update view (wherever invalidate_user_cache is called):
invalidate(f"user_basic:{user_id}", f"pub_profile:{user_id}", f"full_profile:{user_id}")
```

---

### Expected impact

| Screen                  | Before (every load hits Snowflake)     | After (Redis cache hit) |
| ----------------------- | -------------------------------------- | ----------------------- |
| Matches screen open     | ~300–600 ms (5-table JOIN)             | **< 5 ms**              |
| Messages inbox open     | ~500–900 ms (7-table JOIN + window fn) | **< 5 ms**              |
| Profile screen open     | ~300–500 ms (3 sequential queries)     | **< 5 ms**              |
| Profile update (PATCH)  | unchanged — writes always go to DB     | unchanged               |
| New match / new message | unchanged — writes + invalidation      | unchanged               |

Cache misses (first load after a write or after TTL expires) still hit Snowflake at the same speed as today. Every subsequent request within the TTL window is served from Redis in under 5 ms.

---

---

# Phase 2 — New Endpoints

> The items below are **net-new backend work** not yet present anywhere in the codebase. Each entry includes the full contract the frontend will consume so it can be implemented and tested independently.

---

## P2-1. Add `DELETE /api/jobs/<job_id>/unsponsor/` — Permanently Remove a Sponsored Job

### Context

`POST /api/jobs/<job_id>/deactivate/` already exists and sets `IS_ACTIVE = FALSE`, but it has two problems for the "unsponsor" use-case:

1. The job row is **never deleted**, so `check_already_sponsored` (which has no `IS_ACTIVE` filter) will permanently block the sponsor from re-sponsoring the same ATS listing — even after they "removed" it.
2. The job still appears in `GET /api/jobs/mine/` because `get_jobs_by_sponsor` also has no `IS_ACTIVE` filter.

A dedicated unsponsor endpoint should **hard-delete** the `JOB_POSTINGS` row (or soft-delete with a new `IS_UNSPONSORED` flag if hard-delete is undesirable for audit purposes), so the sponsor can freely re-sponsor the listing later.

### Endpoint

```
DELETE /api/jobs/<str:job_id>/unsponsor/
```

- **Auth:** Bearer token required (sponsor only)
- **URL param:** `job_id` — the `JOB_POSTINGS` UUID (returned as `job_id` when sponsoring, or as `JOB_ID` in `GET /api/jobs/mine/`)
- **Body:** none

### Response

**200 — success:**

```json
{
  "job_id": "uuid",
  "message": "Job successfully unsponsored"
}
```

**404 — not found or not owned by caller:**

```json
{ "detail": "Job not found or you do not own it" }
```

**400 — job has active applicant matches (optional guard — see notes):**

```json
{
  "detail": "Cannot unsponsor a job with active matches. Deactivate it instead."
}
```

### Suggested implementation

**`bc_microservices/queries/jobs.py`** — add:

```python
def delete_sponsored_job(job_id, sponsor_id):
    """Hard-delete a sponsored job owned by this sponsor.
    Only callable if the caller owns the row."""
    q = """
    DELETE FROM BACKCHANNEL_DEV.JOBS.JOB_POSTINGS
    WHERE JOB_ID = %s AND SPONSOR_ID = %s
    """
    execute_query(q, (job_id, sponsor_id))
```

**`bc_microservices/services/jobs.py`** — add:

```python
def unsponsor_job(sponsor_id, job_id):
    """Permanently remove a sponsored job owned by the sponsor."""
    if not jobs_q.is_job_owned_by_sponsor(job_id, sponsor_id):
        return Result.not_found("Job not found or you do not own it")

    # Optional: block if active matches exist to protect applicant conversations
    # active_matches = likes_q.count_active_likes_for_job(job_id)
    # if active_matches > 0:
    #     return Result.bad_request("Cannot unsponsor a job with active matches. Deactivate it instead.")

    jobs_q.delete_sponsored_job(job_id, sponsor_id)
    invalidate(
        f"job_active:{job_id}",
        f"sp_job:{job_id}",
        f"job_owner:{job_id}:{sponsor_id}",
        f"sponsor_matches:{sponsor_id}",
    )
    return Result.success({"job_id": job_id, "message": "Job successfully unsponsored"})
```

**`bc_microservices/views_jobs.py`** — add:

```python
@extend_schema(
    summary="Unsponsor (permanently remove) a sponsored job",
    tags=["Jobs"],
    parameters=[
        OpenApiParameter(
            name="job_id", type=str, required=True,
            location=OpenApiParameter.PATH,
            description="JOB_POSTINGS UUID to remove"
        ),
    ],
    request=None,
    responses={
        200: inline_serializer(
            name="UnsponsorJobResponse",
            fields={
                "job_id": serializers.CharField(),
                "message": serializers.CharField(),
            },
        ),
        404: OpenApiResponse(description="Job not found or not owned by caller"),
    },
)
@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def unsponsor_job(request, job_id):
    return _respond(jobs_svc.unsponsor_job(request.user.id, job_id))
```

**`django_bc/urls.py`** — add the route **before** the catch-all `<str:job_id>/` pattern:

```python
path('api/jobs/<str:job_id>/unsponsor/', unsponsor_job, name='unsponsor_job'),
```

**`bc_microservices/views.py`** — add to imports:

```python
from .views_jobs import (
    ...
    unsponsor_job,
)
```

### Important notes for implementation

- **Route ordering matters:** In `urls.py`, `unsponsor/` must be declared **before** `<str:job_id>/` (the generic sponsored job detail), otherwise Django will route `DELETE /api/jobs/<id>/unsponsor/` to `get_sponsored_job_detail` instead.
- **`check_already_sponsored` fix:** After the hard-delete, `check_already_sponsored` will correctly return `None` for that `(silver_job_id, sponsor_id)` pair, allowing the sponsor to re-sponsor the same listing in the future.
- **Cascade consideration:** If `JOB_POSTINGS` rows are referenced by `LIKES`, `CONVERSATIONS`, or `JOB_WAITLIST` with foreign keys, decide whether to cascade-delete those child rows or block the delete. The deactivate endpoint today does not deal with this, so a consistent policy should be chosen (recommend cascade on `JOB_WAITLIST`, block if active `LIKES/CONVERSATIONS` exist).
- **`get_jobs_by_sponsor` after deletion:** Once the row is hard-deleted, `GET /api/jobs/mine/` will naturally no longer return it — no query change needed.

### Frontend

`lib/api.ts` will need a new `unsponsorJob` function (not yet present):

```typescript
export async function unsponsorJob(jobId: string): Promise<any> {
  return api.delete(`/api/jobs/${jobId}/unsponsor/`);
}
```

This will be wired to a "Remove" / "Unsponsor" action in the **My Sponsored** tab's job card menu once the endpoint is live.

---

## 9. Add `work_preferences` to `POST /api/register/` — Applicant Registration

**File:** `bc_microservices/views/views_auth.py` (or wherever the `/api/register/` handler lives)
**Table:** `APPLICANT_PROFILES`

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

**Storage:** Save `work_preferences` to `APPLICANT_PROFILES.WORK_PREFERENCES` (VARIANT column, same pattern as `SKILLS` and `INSIGHTS`).

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
