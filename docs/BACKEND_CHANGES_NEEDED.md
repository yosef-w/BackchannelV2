# Backend Changes Needed

**Last updated:** 2026-05-14
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> Most previously-tracked items shipped in PRs #41–#45 and have been integrated — see [`Backchannel-backend/BackChannel-backend/docs/BACKEND_CHANGES_SHIPPED.md`](../../Backchannel-backend/BackChannel-backend/docs/BACKEND_CHANGES_SHIPPED.md). Items below stem from auditing the "request a sponsor" ↔ "sponsor accepts" loop on the Matches screen.

---

## §2 — Sponsor-request notification: applicant name is first name only 🔴 Bug

**File:** `bc_microservices/queries/notifications.py` — `list_notifications()`

### What's wrong

Line 47 of the notification query aliases only `FIRST_NAME` as `RELATED_USER_NAME`:

```sql
up.FIRST_NAME  AS RELATED_USER_NAME
```

The frontend's `SponsorRequest` modal displays `applicantName` (mapped from `RELATED_USER_NAME`) in the hero and in copy like "Jane is asking you to sponsor this role". Sponsors see only a first name.

### Fix (one line)

```sql
up.FIRST_NAME || ' ' || COALESCE(up.LAST_NAME, '') AS RELATED_USER_NAME
```

No schema change, no migration needed.

---

## §3 — Sponsor-request notification: job title and company are always NULL 🔴 Bug

**File:** `bc_microservices/queries/notifications.py` — `list_notifications()`

### What's wrong

`request_sponsor` stores the ATS silver job ID as `RELATED_JOB_ID` on the notification (the applicant is requesting sponsorship for an _unsponsored_ job, which only exists in `ats.silver_jobs`). But the notification query joins exclusively against `jobs.job_postings`:

```sql
LEFT JOIN jobs.job_postings j ON j.JOB_ID = n.RELATED_JOB_ID
```

Since the job hasn't been sponsored yet, there's no matching row in `job_postings` — so `RELATED_JOB_TITLE` and `RELATED_JOB_COMPANY` come back `NULL` for every sponsor-request notification. The frontend falls back to `"Untitled role"` and a blank company name on every sponsor request card and modal.

### Fix

Add a second join to `ats.silver_jobs` and coalesce:

```sql
LEFT JOIN jobs.job_postings j  ON j.JOB_ID  = n.RELATED_JOB_ID
LEFT JOIN ats.silver_jobs   sj ON sj.JOB_ID = n.RELATED_JOB_ID
```

Then replace the selected columns:

```sql
-- before
j.TITLE   AS RELATED_JOB_TITLE,
j.COMPANY AS RELATED_JOB_COMPANY

-- after
COALESCE(j.TITLE,        sj.TITLE)        AS RELATED_JOB_TITLE,
COALESCE(j.COMPANY,      sj.ORGANIZATION) AS RELATED_JOB_COMPANY
```

No schema change, no migration needed.

---

## §1 — Dedicated endpoint for sponsor-requests received

**🟢 Polish · Frontend already works via a workaround**

### Context

When an applicant taps "Get a Sponsor" on a non-sponsored job, the backend (PR #44) notifies matching sponsors via `matching.sponsor_requests` + a `sponsor_request`-type notification. On the sponsor side we now render a dedicated "Sponsor Requests" section on the Matches screen so the request is actionable in one place rather than buried in the notifications list.

### What's there today (workaround)

The frontend derives the section's data by calling `GET /api/notifications/` and filtering client-side: `TYPE === "sponsor_request" && !IS_READ`. The denormalized metadata fields from PR #43 (`RELATED_USER_NAME`, `RELATED_USER_PHOTO_URL`, `RELATED_JOB_TITLE`, `RELATED_JOB_COMPANY`, `RELATED_USER_ID`, `RELATED_JOB_ID`) give us everything we need to render the card and modal — no N+1 fetches.

### What we'd like

`GET /api/jobs/sponsor-requests/received/` — list active sponsor-requests targeting the authenticated sponsor (presumably filtered by company match, mirroring how PR #44's `find_sponsors_by_company` decides who to notify).

Response shape mirroring what the frontend already needs:

```json
{
  "requests": [
    {
      "request_id": "uuid",
      "applicant_user_id": "uuid",
      "applicant_name": "Jane Doe",
      "applicant_photo_url": "https://...",
      "job_id": "uuid",
      "job_title": "Senior Engineer",
      "job_company": "Stripe",
      "requested_at": "2026-05-14T...Z"
    }
  ],
  "total_count": 3
}
```

> **Note:** `applicant_name` should be `FIRST_NAME || ' ' || LAST_NAME` concatenated server-side (JOIN to `user_info.user_profiles`). The frontend's `SponsorRequest` interface uses a single `applicantName` string — splitting into first/last would require unnecessary client-side joining.

### Why the workaround isn't great

- **Notifications are user-deletable.** PR #43 shipped swipe-to-delete + clear-read on the notifications screen. If a sponsor deletes the notification (e.g., to clean their notification list) the request silently disappears from the Sponsor Requests section even though the underlying `matching.sponsor_requests` row is still active.
- **Filtering on `IS_READ`** is fragile — if a sponsor briefly taps the notification in the notifications screen it gets marked read and falls out of the Matches section.
- **Source of truth mismatch.** The `matching.sponsor_requests` table is the authoritative record; notifications are a delivery channel.

---

## §4 — Carry the sponsor's selected `JOB_ID` through the entire like → accept → match → refer pipeline 🟡 Feature gap

**Files:**

- `bc_microservices/queries/likes.py` — `create_profile_like()`, `get_received_profile_likes()`
- `bc_microservices/services/matching.py` — `like_applicant_profile()`, `accept_profile_like()`

### Why this matters now

Sponsors now have a **role-switcher dropdown** on HomeView. Picking a role re-fetches the profile pack with that job's ID _and_ is meant to stamp that specific role onto every subsequent action — the like, the match, the conversation, the eventual referral. The frontend already passes the `jobId` everywhere it can (`likeProfile(applicantId, jobId)`). But the backend currently drops the job context the moment the like is created, which silently breaks the end-to-end story for the **deferred-accept path** (the common case where the applicant hasn't already liked the specific job).

Concretely: a sponsor with two roles (Senior Engineer + Product Manager) picks "Senior Engineer" from the dropdown and swipes right on Jane. Today the applicant ends up matched for whatever `find_sponsors_best_job_for_applicant` resolves — frequently a _different_ role than the one the sponsor chose. The dropdown's product promise is silently broken.

### What's wrong (three places, same root cause)

#### a) `create_profile_like` doesn't accept or persist `JOB_ID`

[`queries/likes.py:44`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py#L44):

```python
def create_profile_like(sponsor_id, applicant_user_id):
    q = """
    INSERT INTO matching.likes (LIKE_ID, USER_ID, PROFILE_ID, CREATED_AT, STATUS)
    VALUES (%s, %s, %s, NOW(), 'ACTIVE')
    ...
    """
    execute_query(q, (like_id, sponsor_id, applicant_user_id))
```

Note the missing `JOB_ID` column in the `INSERT`. `matching.likes` has a `JOB_ID` column, but for profile-likes the column is left `NULL` even though `like_applicant_profile` _received_ a `job_id` from the caller. The job context is lost on row creation.

#### b) `get_received_profile_likes` doesn't surface job context

[`queries/likes.py:get_received_profile_likes()`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py): selects sponsor identity only, no `JOB_ID`, no join to `jobs.job_postings`. Result: even if (a) is fixed, the applicant's "Interested in You" cards still don't display which role the sponsor wants them for.

#### c) `accept_profile_like` ignores any stored `JOB_ID` and re-resolves

PR #45's `accept_profile_like` calls `find_sponsors_best_job_for_applicant(sponsor_id, applicant_user_id)` to pick which of the sponsor's jobs to match on. That picks the sponsor's most recently posted active job — which may not be the one the sponsor selected from the dropdown.

### Fix (three coordinated changes — all in the same PR)

#### a) Persist `JOB_ID` when the profile-like is created

```python
def create_profile_like(sponsor_id, applicant_user_id, job_id=None):
    """Atomically insert a new ACTIVE like on an applicant profile."""
    like_id = str(uuid.uuid4())
    q = """
    INSERT INTO matching.likes (LIKE_ID, USER_ID, PROFILE_ID, JOB_ID, CREATED_AT, STATUS)
    VALUES (%s, %s, %s, %s, NOW(), 'ACTIVE')
    ON CONFLICT (user_id, profile_id)
    WHERE profile_id IS NOT NULL AND status IN ('ACTIVE', 'MATCHED') DO NOTHING
    """
    execute_query(q, (like_id, sponsor_id, applicant_user_id, job_id))
    ...
```

Update the matching `ON CONFLICT` constraint scope if needed so a sponsor can like the same applicant _for a different job_ later. Whether that's desirable is a product call — happy to flesh out either direction.

Update `like_applicant_profile` ([`services/matching.py`](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/matching.py)) to pass `job_id` through:

```python
likes_q.create_profile_like(sponsor_id, applicant_user_id, job_id=job_id)
```

#### b) Surface the job context in `get_received_profile_likes`

```sql
SELECT l.LIKE_ID, l.CREATED_AT AS LIKED_AT,
       l.USER_ID AS SPONSOR_USER_ID,
       l.JOB_ID,
       up.FIRST_NAME AS SPONSOR_FIRST_NAME,
       up.LAST_NAME  AS SPONSOR_LAST_NAME,
       up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
       sp.JOB_TITLE  AS SPONSOR_JOB_TITLE,
       sp.COMPANY    AS SPONSOR_COMPANY,
       j.TITLE   AS JOB_TITLE,
       j.COMPANY AS JOB_COMPANY
FROM matching.likes l
JOIN user_info.user_profiles up ON up.USER_ID = l.USER_ID
LEFT JOIN user_info.sponsor_profiles sp ON sp.USER_ID = l.USER_ID
LEFT JOIN jobs.job_postings j ON j.JOB_ID = l.JOB_ID
WHERE l.PROFILE_ID = %s AND l.STATUS = 'ACTIVE'
```

This relies on (a) actually persisting `JOB_ID` upstream. For pre-existing profile-like rows created before (a) ships, `l.JOB_ID` will be `NULL` and the join produces `NULL` for `JOB_TITLE`/`JOB_COMPANY` — frontend hides the role line in that case. No backfill required.

#### c) Honor the stored `JOB_ID` in `accept_profile_like`

```python
def accept_profile_like(applicant_user_id, like_id):
    profile_like = likes_q.get_profile_like_by_id(like_id)
    # ... ownership + status validation ...

    sponsor_id = profile_like['USER_ID']
    # Prefer the job the sponsor originally selected (carried on the like row
    # from (a) above). Fall back to the current heuristic only for legacy
    # rows that pre-date the (a) change.
    job_id = profile_like.get('JOB_ID') or likes_q.find_sponsors_best_job_for_applicant(
        sponsor_id, applicant_user_id,
    )
    if not job_id:
        return Result.success({"matched": False, "message": "..."})
    # ... rest of the existing match-creation flow unchanged ...
```

### Downstream — what this unlocks for the rest of the flow

Once (a)/(b)/(c) ship together, the role context flows through cleanly:

1. **Applicant's "Interested in You" cards/modal** → display "Wants you for **Senior Engineer · Stripe**" via the new `JOB_TITLE`/`JOB_COMPANY` fields. The frontend is pre-wired for this (typed shape already in place — see [`getInterestedSponsors`](../lib/api.ts) response).
2. **Applicant's "Like Back" toast** → already echoes the backend's `message`, which `accept_profile_like` already constructs with the matched job's title ("It's a match! You've been connected for Senior Engineer"). After (c), that title is the role the sponsor actually selected — not a re-resolved guess.
3. **Conversation & messaging** → the match row carries the correct `JOB_ID`; conversations are scoped to that job; the messaging UI's job header (and any "what role are we matched on?" surface) shows the right role from day one.
4. **Referral submission** → when the sponsor later refers the applicant from the messages thread, the referral is filed for the correct job. Without this fix, the sponsor might be referring Jane for "Product Manager" even though they were reviewing the SWE deck when they liked her.
5. **MatchesView "Matched Opportunities"** card (applicant side) — already shows job title for matches; will now reflect the role the sponsor originally chose.

### Frontend impact (when this ships)

Almost nothing on our side — the wiring is already there or queued:

- `getInterestedSponsors` response type already pre-declares `JOB_ID?`, `JOB_TITLE?`, `JOB_COMPANY?` (added in anticipation of this).
- `InterestedSponsor` interface in `MatchesView` gains `jobTitle` / `jobCompany` via the existing mapping (small additive change).
- Render a single-line label on the "Interested in You" card + the sponsor-profile modal: _"Wants you for **Senior Engineer · Stripe**"_. ~10 lines of JSX, no layout overhaul.

That's the entirety of the follow-up work post-backend.

---

## §5 — Rank `fetch_profile_pack` by relevance to the selected job 🟡 Feature gap

**File:** `bc_microservices/queries/profiles.py` — `fetch_profile_pack()`
**Related service:** `bc_microservices/services/profiles.py` — `get_profile_pack()`

### Why this matters now

Sponsors now have a **role-switcher dropdown** on HomeView. Picking a role re-fetches the profile pack with that job's ID (already wired) and stamps the chosen job onto every match the sponsor creates from that deck (also wired). The whole point of the role-switcher is: _"show me applicants relevant to **this** specific role, not just any unseen applicant."_

The backend currently delivers the second half (per-job tracking + correct match attribution) but not the first half (relevance filtering). So switching from "Product Manager" to "Senior Engineer" gives you a _different_ deck of 10 (thanks to per-job seen-tracking) but the same generic _population_ — neither deck is biased toward PMs or SWEs respectively. Result: sponsors end up sending SWE-job likes to candidates who don't fit the SWE role.

### What's wrong

`fetch_profile_pack` ([`queries/profiles.py:174`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/profiles.py#L174)) takes a `job_id` parameter but only uses it for the "seen" filter — never to filter or rank candidates:

```python
def fetch_profile_pack(sponsor_id, job_id, limit=DEFAULT_PROFILE_PACK_LIMIT):
    """Fetch applicant profiles the sponsor hasn't seen for this job."""
    seen = get_seen_profile_ids(sponsor_id, job_id)

    q = """
    SELECT ap.APPLICANT_PROFILE_ID, ap.USER_ID, ap.PROFILE_ID, ap.INDUSTRY,
           ap.RANGE_MILES, ap.REASON, ap.POSITIONS::TEXT, ap.SKILLS::TEXT, …
    FROM user_info.applicant_profiles ap
    JOIN user_info.user_profiles up ON ap.PROFILE_ID = up.PROFILE_ID
    """
    # ↑ no WHERE on job criteria — just LIMIT 10
```

### Fix

This is the _mirror_ of what's already implemented for the jobs deck: [`services/jobs.py:get_job_pack`](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/jobs.py#L519) uses `score_job_for_user(job, profile)` to rank ATS jobs against the applicant's profile. The same scoring concept just needs to run in the opposite direction — rank applicants against a job — inside `get_profile_pack`/`fetch_profile_pack`.

Concretely:

1. Inside `get_profile_pack(sponsor_id, job_id)`, before calling `fetch_profile_pack`, load the job's relevance criteria — pull `TITLE`, `KEY_SKILLS`, `EXPERIENCE_LEVEL`, `LOCATION`, etc. from `jobs.job_postings` (and `ats.silver_jobs` via `REFERENCE_JOB_ID` if you want to fall back to ATS-enriched fields).
2. Have `fetch_profile_pack` _over-sample_ (e.g. fetch 50 unseen profiles) and pass them through a Python-side `score_profile_for_job(profile, job)` ranking function, mirroring how `get_job_pack` over-samples and ranks ATS jobs.
3. Return the top `limit` (10) scored profiles, highest score first.
4. Optionally surface the score as `relevance_score` on the pack response (parallel to how `get_job_pack` already does — frontend can render an "AI Match %" pill on profile cards, same component already in use on job cards).

The scoring heuristic doesn't need to be sophisticated for v1 — even simple weighting (skill overlap 40 %, role/title match 30 %, location proximity 15 %, experience-level alignment 15 %) would be a meaningful improvement over the current "random unseen 10." The existing `score_job_for_user` is the reference implementation for both the structure and the weights.

### Edge cases

- **Job has no skills / very sparse criteria**: scoring degrades to "any unseen applicant" — same as today, no regression.
- **Sponsor pool of applicants smaller than 10**: just return what exists, sorted by relevance.
- **Manually-created sponsored jobs** (no `REFERENCE_JOB_ID` → no ATS enrichment): use whatever criteria the sponsor entered on the job-create form (title at minimum). If even that's missing, fall back to unranked.

### Frontend impact (when this ships)

- None required — `fetchProfilesPack(jobId)` already passes the job, and the response shape can remain identical. Profiles just arrive ranked.
- Optional polish: if you add `relevance_score` to the profile pack response, the frontend can render an "AI Match %" pill on each card (the same pattern HomeView already uses for the applicant-side job deck via `relevancePill`).

---

## §6 — `GET /api/jobs/silver/<job_id>/` — Full role detail for sponsor review 🟡 Feature gap

**Frontend file:** `components/MatchesView.tsx` → `openSrJobDetail()`
**API function:** `lib/api.ts` → `getJobDetail(jobId)`

### Context

When a sponsor opens a sponsor-request notification on the Matches screen, they see a card showing the job title and company ("Wants Sponsorship For"). Before a sponsor commits to backing a candidate, they need to actually understand the role — description, skills required, experience level, location, salary range, etc.

The frontend has been wired for this: the job card in step 1 of the sponsor-request modal is now **tappable** (with a chevron + "Tap to review this role" hint). Tapping it calls `getJobDetail(jobId)` → `GET /api/jobs/silver/<job_id>/` and opens a full-detail sheet overlaid on top of the sponsor-request modal. The sponsor can read the full JD, then swipe back to the request and hit "Sponsor & Connect".

### What's missing

The `GET /api/jobs/silver/<job_id>/` endpoint does not exist yet. The call will 404 until the backend adds it. The frontend handles this gracefully — it shows an "AlertTriangle + Could not load role details" error state inside the sheet so the sponsor isn't blocked from continuing.

### Required endpoint

```
GET /api/jobs/silver/<job_id>/
Authentication: Bearer token required
```

**Response body** — mirror the existing `GET /api/jobs/browse/` item shape (the frontend already knows how to consume `BrowseJobResponse`):

```json
{
  "JOB_ID": "uuid",
  "TITLE": "Senior Software Engineer",
  "ORGANIZATION": "Stripe",
  "FULL_LOCATION": "San Francisco, CA",
  "IS_REMOTE": false,
  "EMPLOYMENT_TYPES": "Full-time",
  "SALARY_ANNUAL_MIN": 160000,
  "SALARY_ANNUAL_MAX": 220000,
  "SALARY_CURRENCY": "USD",
  "EXPERIENCE_LEVEL": "Senior",
  "SKILLS": "[\"Python\", \"Distributed Systems\", \"Go\"]",
  "DESCRIPTION_TEXT": "We are looking for…",
  "DATE_POSTED": "2026-04-01"
}
```

**Implementation:** A single `SELECT … FROM ats.silver_jobs WHERE JOB_ID = %s` query on the authenticated user's behalf. No ownership check is needed — any authenticated sponsor can view an ATS job's details (they're public-facing roles). Return 404 if the `JOB_ID` doesn't exist.

### Why silver_jobs only?

Sponsor-request notifications always carry a `RELATED_JOB_ID` that points to `ats.silver_jobs` (the applicant requested sponsorship for an _un-sponsored_ job from the ATS feed). By the time a job is sponsored it exists in `jobs.job_postings` and the full flow changes. A single silver-jobs lookup is sufficient here; no need for a dual-table resolution.

### Frontend impact (when this ships)

The frontend is fully wired — no changes required on our side when this endpoint is added. `getJobDetail(jobId)` will start resolving instead of 404-ing and the detail sheet will populate automatically.
