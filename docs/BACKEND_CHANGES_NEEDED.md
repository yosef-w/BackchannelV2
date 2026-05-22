# Backend Changes Needed

**Last updated:** 2026-05-22
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

This is the _mirror_ of what's already implemented for the jobs deck: [`services/jobs.py:get_job_pack`](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/jobs.py#L520) uses `score_job_for_user(job, profile)` to rank ATS jobs against the applicant's profile. The same scoring concept just needs to run in the opposite direction — rank applicants against a job — inside `get_profile_pack`/`fetch_profile_pack`.

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

---

## §8 — Tighten the HomeView role-switcher signal: pending-only counts + likers-first deck ordering 🟡 Feature gap

**Frontend file:** `components/HomeView.tsx` → role-switcher badge + card deck powered by `fetchProfilesPack`
**API functions:** `lib/api.ts` → `getMyJobs()` (badge source), `fetchProfilesPack(jobId)` (deck source)
**Backend files:**
- `bc_microservices/queries/jobs.py` → `get_jobs_by_sponsor` (LIKES_COUNT subquery)
- `bc_microservices/queries/profiles.py` → `fetch_profile_pack`

### Context

The HomeView role switcher shows a count badge next to each sponsored role — meant to answer "where should I work next?" Tapping a role switches the card deck to that role's profile pack.

Two issues with the current behavior that make the signal misleading:

**1. The count is too broad.** `LIKES_COUNT` ([`queries/jobs.py:473`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L473)) counts every applicant in `STATUS IN ('ACTIVE', 'MATCHED')`. So a role with 5 already-matched applicants and 0 pending shows `5` — implying activity that doesn't actually need the sponsor's attention. The count should reflect *unactioned* interest, not lifetime activity.

**2. The deck doesn't honor the badge.** When a sponsor taps a role, `fetch_profile_pack` ([`queries/profiles.py:174`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/profiles.py#L174)) returns *every* applicant in the database minus those the sponsor has already seen for that job, with no preference for applicants who liked the role. So the badge promises "12 people want you" but the deck shows them a general discovery pool — the 12 likers may not even appear in the first batch. The badge and the experience downstream are disconnected.

### What's missing

Two coordinated changes:

- **§8a:** Filter `LIKES_COUNT` to `STATUS = 'ACTIVE'` only (drop matched).
- **§8b:** Order `fetch_profile_pack` so applicants who actively liked the role come first, then the rest of the pool.

Together these make the badge a genuine "next-up" signal: tap the role and the first N cards in the deck are the people the badge counted.

### Required changes

**§8a — Update LIKES_COUNT subquery** in `get_jobs_by_sponsor` ([`queries/jobs.py:473`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L473)):

```python
# Before
(SELECT COUNT(*) FROM matching.likes l2
 WHERE l2.JOB_ID = j.JOB_ID
   AND l2.STATUS IN ('ACTIVE', 'MATCHED')) AS LIKES_COUNT,

# After — pending-only signal
(SELECT COUNT(*) FROM matching.likes l2
 WHERE l2.JOB_ID = j.JOB_ID
   AND l2.STATUS = 'ACTIVE') AS LIKES_COUNT,
```

One word change. Same column name (`LIKES_COUNT`) so no API contract drift.

**§8b — Order `fetch_profile_pack` to surface active likers first** ([`queries/profiles.py:174`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/profiles.py#L174)):

```python
def fetch_profile_pack(sponsor_id, job_id, limit=DEFAULT_PROFILE_PACK_LIMIT):
    """Fetch applicant profiles the sponsor hasn't seen for this job.
    Applicants who actively liked this specific job are surfaced first
    (high-conviction matches), then the broader discovery pool fills
    out the rest of the pack."""
    seen = get_seen_profile_ids(sponsor_id, job_id)

    q = """
    SELECT ap.APPLICANT_PROFILE_ID, ap.USER_ID, ap.PROFILE_ID, ap.INDUSTRY,
           ap.RANGE_MILES, ap.REASON, ap.POSITIONS::TEXT, ap.SKILLS::TEXT, ap.RESUME_DATA::TEXT,
           ap.INSIGHTS::TEXT,
           up.FIRST_NAME, up.LAST_NAME, up.LOCATION, up.PHOTO_URL,
           up.PHONE_NUMBER, up.DATE_OF_BIRTH, up.ROLE_TYPE, up.INTERNATIONAL_CODE,
           up.BIO,
           -- 1 if this applicant actively liked the role, else 0. Used for
           -- ORDER BY so likers float to the top of the pack.
           CASE WHEN EXISTS (
             SELECT 1 FROM matching.likes l
             WHERE l.USER_ID = ap.USER_ID
               AND l.JOB_ID = %s
               AND l.STATUS = 'ACTIVE'
           ) THEN 1 ELSE 0 END AS LIKED_THIS_JOB
    FROM user_info.applicant_profiles ap
    JOIN user_info.user_profiles up ON ap.PROFILE_ID = up.PROFILE_ID
    """
    params = [job_id]
    if seen:
        placeholders = ",".join(["%s"] * len(seen))
        q += f" WHERE ap.USER_ID NOT IN ({placeholders})"
        params.extend(list(seen))
    # Likers first (LIKED_THIS_JOB DESC), then arbitrary stable order
    # within each bucket.
    q += " ORDER BY LIKED_THIS_JOB DESC, ap.PROFILE_ID LIMIT %s"
    params.append(int(limit))

    df = execute_query(q, tuple(params))
    return df.to_dict('records') if df is not None and not df.empty else []
```

Notes:
- The new `LIKED_THIS_JOB` column is **for ordering only** — frontend doesn't need it. The frontend already handles each card the same way regardless of how it was ranked.
- Could go further and `ORDER BY` by like recency (`l.CREATED_AT DESC` for likers) as a v2; for v1, "likers first, then rest" is the meaningful signal.

### Why both changes together

Either one alone is misleading:

| Scenario | Just §8a (count fix) | Just §8b (order fix) | §8a + §8b together |
|---|---|---|---|
| Sponsor sees badge `12` and taps in | First 12 cards are random — badge promised something the deck didn't deliver | Badge counts already-matched too — number is bigger than the actual "next-up" pool | First 12 cards ARE the 12 likers. Badge is honest. ✅ |

Shipping both at once preserves the coherent UX. Splitting them creates a window where the badge and deck disagree.

### Frontend impact (when this ships)

No frontend changes required. The role-switcher badge displays `job.likesCount` verbatim — it'll automatically reflect the new pending-only number. The card deck consumes the profile-pack response in order — it'll automatically render likers first.

Once both ship: the muted-zero badge variant (already wired in [HomeView.tsx](components/HomeView.tsx) — gray pill when count is 0) will become more honest too. A role with 5 active matches + 0 pending will correctly show `0` (muted), signaling "no new decisions waiting" instead of falsely implying activity.

---

## §9 — Expose the sponsor's verified status on the public profile 🟢 Small add

**Frontend file:** `components/HomeView.tsx` → "Meet your sponsor" back face on applicant job cards
**API function:** `lib/api.ts` → `getPublicProfile(userId)`
**Backend files:**
- `bc_microservices/queries/profiles.py` → `get_public_profile`
- `bc_microservices/services/profiles.py` → `get_public_profile` (variant parsing — not affected)

### Context

The applicant job card's back face was redesigned into a "Meet your sponsor" panel — sponsor identity, a trust strip, and a couple of the sponsor's own Q&A insights. One of the trust signals is a **"Verified employee"** badge, shown when the sponsor has verified their work email (`sponsor_profiles.WORK_EMAIL_VERIFIED`).

The frontend fetches the sponsor via `getPublicProfile(sponsorUserId)` and is already wired to render the badge — it reads `WORK_EMAIL_VERIFIED` (top-level or under `sponsor_profile`) and shows the badge when it's `true`.

### What's missing

`get_public_profile` ([`queries/profiles.py:218`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/profiles.py#L218)) doesn't select `WORK_EMAIL_VERIFIED`. The sponsor branch currently selects:

```sql
SELECT COMPANY, JOB_TITLE, LINKED_IN, DURATION,
       COMPANIES_CAN_REFER_TO::TEXT, SKILLS::TEXT, INSIGHTS::TEXT
FROM user_info.sponsor_profiles
WHERE USER_ID = %s
```

So the verified badge stays hidden — no data to drive it.

### Required change

Add `WORK_EMAIL_VERIFIED` to the sponsor-branch SELECT:

```sql
SELECT COMPANY, JOB_TITLE, LINKED_IN, DURATION, WORK_EMAIL_VERIFIED,
       COMPANIES_CAN_REFER_TO::TEXT, SKILLS::TEXT, INSIGHTS::TEXT
FROM user_info.sponsor_profiles
WHERE USER_ID = %s
```

It lands in the response under `sponsor_profile.WORK_EMAIL_VERIFIED` as a boolean. No service-layer change needed (it's a scalar, not a variant/JSON column).

### Privacy note

`WORK_EMAIL_VERIFIED` is a boolean — it does not leak the work email itself. Safe for a public-profile payload. The actual `WORK_EMAIL` value is correctly already excluded.

### Frontend impact (when this ships)

None. The "Meet your sponsor" panel already reads `WORK_EMAIL_VERIFIED` defensively (both top-level and nested under `sponsor_profile`) and renders the green "Verified employee" badge when it's `true`. The moment the column is in the response, the badge lights up.

---

## §10 — Include `user_id` in the job's `sponsor` object 🔴 Bug — blocks "Meet your sponsor"

**Frontend file:** `components/HomeView.tsx` → "Meet your sponsor" back face
**Frontend type:** `types/jobs.ts` → `JobApiSponsor.user_id` (already declared, already consumed)
**Backend file:** `bc_microservices/queries/jobs.py` → `get_sponsor_info`

### What's wrong

The job-pack payload's `sponsor` object is built by `get_sponsor_info(sponsor_id)` ([`queries/jobs.py:77`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L77)). It returns:

```python
return {
    'name': ...,
    'first_name': ...,
    'last_name': ...,
    'job_title': ...,
    'photo_url': ...,
    'years_at_company': ...,
    'duration': ...,
    'can_provide_direct_referral': ...,
}
```

There is **no `user_id`** — even though the function receives `sponsor_id` as its argument.

The frontend's "Meet your sponsor" back face needs the sponsor's user id to call `getPublicProfile(sponsorUserId)` and load the sponsor's bio, Q&A insights, and verified status. `transformJobApiResponse` already maps `userId: apiJob.sponsor.user_id` and the `JobApiSponsor` type already declares `user_id` — so the frontend is fully wired and just receives `undefined`.

**Symptom:** The sponsor's Q&A insights never render on the back of any sponsored job card. Confirmed with the demo sponsor "Emily Rodriguez", who has two valid insight Q&A in `seed_demo_data.py` and in `sponsor_profiles.INSIGHTS` — the data is correct end-to-end on the backend; it simply can't be fetched because the frontend never gets her `user_id`.

### Fix (one line)

In `get_sponsor_info`'s returned dict, add the id it already has in scope:

```python
return {
    'user_id': sponsor_id,
    'name': f"{d.get('FIRST_NAME', '')} {d.get('LAST_NAME', '')}".strip(),
    'first_name': d.get('FIRST_NAME'),
    ...
}
```

No schema change, no migration. The `sponsor_info:{sponsor_id}` cache key may need a bump/clear so cached entries pick up the new field.

### Frontend impact (when this ships)

None. The "Meet your sponsor" panel, the sponsor-profile fetch (`fetchSponsorProfileFor`), and the `JobApiSponsor.user_id` type are all already in place. The moment `user_id` is in the payload, the sponsor's Q&A insights (and, with §9, the verified badge) populate automatically.

---

## §11 — Real-time inbox: a per-user WebSocket so the conversation list updates live 🟡 Feature gap

**Frontend file:** `components/MessagesView.tsx` → conversation-list (inbox) screen
**Backend files:**
- `bc_microservices/consumers.py` → new `InboxConsumer`
- `bc_microservices/routing.py` → new `ws/inbox/` route
- `bc_microservices/services/messaging.py` → `send_message` broadcast extension

### Context

The Messages screen has two surfaces: the **inbox** (list of conversations, each row showing a last-message preview) and the **thread** (one open conversation).

The thread is already real-time — `ChatConsumer` joins `chat_{conversation_id}` and `send_message` broadcasts every message into that group, so an open thread updates live.

The **inbox is not.** `GET /api/messages/conversations/` is fetched once when the screen mounts; nothing updates the list afterward. The `ChatConsumer` is scoped to a single conversation, so while a user sits on the inbox (no thread open) there is no live channel at all. A new message — even one the user just sent and backed out of — doesn't appear in the row preview until the list is refetched (today that only happens on a full screen remount, i.e. a tab switch).

The frontend has been patched to mirror messages into the list while a thread is open, and to refetch the list when backing out of a thread. That covers the common path. The one case it cannot cover frontend-only: **a message arriving in a conversation while the user is idle on the inbox with no thread open** — there is simply no socket listening. That is what this section adds.

### Why this is a small change

All the hard infrastructure already exists and is proven in production:

- **Django Channels + a Redis channel layer** — already running (`ChatConsumer`).
- **JWT WebSocket auth** — `JWTAuthMiddleware` ([`ws_auth.py`](../../Backchannel-backend/BackChannel-backend/bc_microservices/ws_auth.py)) reads `?token=<jwt>` off the query string for **any** WebSocket path and attaches `scope["user"]`. A new route needs zero auth work.
- **A broadcast hook on every message** — `send_message` already calls `_broadcast_to_group()` after persisting, for both REST- and WebSocket-sent messages.

The new consumer is the same pattern as `ChatConsumer`, just scoped to a **user** (`inbox_{user_id}`) instead of a conversation. No new dependencies, no schema change, no migration, no infra change (same ASGI app, same Redis).

### Required changes

#### 1. New `InboxConsumer` — `bc_microservices/consumers.py`

```python
def _inbox_group_name(user_id):
    return f"inbox_{user_id}"


class InboxConsumer(AsyncJsonWebsocketConsumer):
    """Per-user WebSocket scoped to the authenticated user's whole inbox.

    Unlike ChatConsumer (one conversation), this joins a single user-scoped
    group (``inbox_{user_id}``) and receives a lightweight ``inbox.update``
    event whenever ANY of that user's conversations gets a new message.
    Powers the live conversation-list previews on MessagesView. The socket
    is push-only — clients never send on it.
    """

    async def connect(self):
        user = self.scope.get("user")
        if user is None:
            await self.close(code=4001)
            return

        self.group_name = _inbox_group_name(user.id)
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                "channel_layer.group_add failed for %s", self.group_name
            )
            await self.close(code=4500)
            return
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(
                    self.group_name, self.channel_name
                )
            except Exception:
                import logging
                logging.getLogger(__name__).exception(
                    "channel_layer.group_discard failed for %s", self.group_name
                )

    async def inbox_update(self, event):
        """Handler for ``inbox.update`` events from the channel layer."""
        await self.send_json({
            "type": "inbox.update",
            "conversation_id": event["conversation_id"],
            "message_id": event["message_id"],
            "sender_user_id": event["sender_user_id"],
            "body": event["body"],
            "created_at": event["created_at"],
        })
```

Note: no participant check is needed — a user only ever joins **their own** group, derived from the authenticated `scope["user"]`. (Channels maps the event `type` `"inbox.update"` to the `inbox_update` method automatically.)

#### 2. New route — `bc_microservices/routing.py`

```python
websocket_urlpatterns = [
    re_path(
        r"ws/chat/(?P<conversation_id>[0-9a-f\-]+)/$",
        consumers.ChatConsumer.as_asgi(),
    ),
    re_path(r"ws/inbox/$", consumers.InboxConsumer.as_asgi()),  # NEW
]
```

No `asgi.py` change — `JWTAuthMiddleware` already wraps the whole `URLRouter`.

#### 3. Broadcast `inbox.update` on send — `bc_microservices/services/messaging.py`

`send_message` already loads `conv = msg_q.get_conversation_detail(conversation_id)` (which returns `APPLICANT_USER_ID` and `SPONSOR_USER_ID`) and already calls `_broadcast_to_group(...)`. Add one sibling call right after it:

```python
    _broadcast_to_group(conversation_id, message_id, user_id, body)
    _broadcast_to_inboxes(conversation_id, conv, message_id, user_id, body)  # NEW
```

And add the helper, mirroring `_broadcast_to_group`:

```python
def _broadcast_to_inboxes(conversation_id, conv, message_id, sender_user_id, body):
    """Push an inbox.update event to BOTH participants' inbox groups.

    Broadcasting to the sender too is intentional and harmless — it keeps
    multi-device sessions in sync; the frontend applies the update
    idempotently.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        layer = get_channel_layer()
        if layer is None:
            return
        payload = {
            "type": "inbox.update",
            "conversation_id": str(conversation_id),
            "message_id": str(message_id),
            "sender_user_id": str(sender_user_id),
            "body": body,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        for uid in (conv["APPLICANT_USER_ID"], conv["SPONSOR_USER_ID"]):
            async_to_sync(layer.group_send)(f"inbox_{uid}", payload)
    except Exception:
        logger.debug("Inbox broadcast failed", exc_info=True)
```

### Event payload (server → client)

```json
{
  "type": "inbox.update",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "sender_user_id": "uuid",
  "body": "the message text",
  "created_at": "2026-05-21T18:42:03.119Z"
}
```

This is deliberately minimal. The frontend already holds each conversation in its list, so it only needs the preview text + timestamp + who sent it. **Unread state is computed client-side** — the frontend flags a row unread only when `sender_user_id` isn't the current user *and* that thread isn't currently open — so the payload carries no per-recipient unread field. If `conversation_id` isn't in the client's list yet (a brand-new match's first message), the frontend refetches `GET /api/messages/conversations/` to pick up the new row.

### Notes / edge cases

- **Closed conversations** — `send_message` already rejects sends on `CLOSED` threads before the broadcast, so no `inbox.update` ever fires for one. No special handling needed.
- **Timestamp consistency (optional polish)** — `_broadcast_to_group` and `_broadcast_to_inboxes` each generate their own `datetime.now()`, so the `chat.message` and `inbox.update` events for the same message carry timestamps a few ms apart. Harmless (it only feeds a relative "2m ago" label). If you want them identical, generate the timestamp once in `send_message` and pass it into both helpers — or, better, have `insert_message` return the real DB `CREATED_AT` and broadcast that.
- **Token rotation** — same as the chat socket: the connection stays valid once authenticated; on reconnect the client re-reads the current access token.

### Frontend impact

Already done — no further frontend work when this ships. `MessagesView` opens `wss://.../ws/inbox/?token=<jwt>` while the Messages tab is mounted, applies `inbox.update` events to the conversation list, and reconnects with backoff. Until this backend lands, the socket simply fails to connect and retries quietly in the background — the inbox still works via the existing on-mount fetch, the in-thread mirroring, and the refetch-on-return fallback. Shipping the backend turns the idle-inbox case from "updates on next refetch" into "updates instantly."

---

## §12 — Capture an unsponsor reason and act on it to prune stale ATS listings 🟡 Feature gap

**Frontend file:** `components/JobsView.tsx` → job-card "⋯" menu → "Unsponsor Job" → reason step
**API function:** `lib/api.ts` → `unsponsorJob(jobId, reason?, reasonDetail?)`
**Backend files:**
- `bc_microservices/views_jobs.py` → `unsponsor_job` view ([line 363](../../Backchannel-backend/BackChannel-backend/bc_microservices/views_jobs.py#L363))
- `bc_microservices/services/jobs.py` → `unsponsor_job` service ([line 849](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/jobs.py#L849))
- `bc_microservices/queries/jobs.py` → silver-jobs flagging helper (new)

### Context

When a sponsor unsponsors a job from the job-card "⋯" menu, the modal now has a second step: **"Why are you unsponsoring?"** — a single-select list. The frontend sends the choice on the existing unsponsor call as query params:

```
DELETE /api/jobs/<job_id>/unsponsor/?reason=<value>&reason_detail=<text>
```

- `reason` — one of: `role_filled`, `posting_expired`, `cannot_refer`, `poor_applicant_fit`, `wrong_role`, `other`.
- `reason_detail` — optional free text (URL-encoded), used mainly when `reason = other`.
- Both are **optional** — the job-detail screen's "Remove Sponsorship" button and any older client still call unsponsor with no params, and that must keep working.

The point of collecting this: two reasons are **job-health signals**, not just sponsor preferences — `posting_expired` and `role_filled` mean the underlying ATS listing is dead and should stop being surfaced to *everyone*, not just removed from this one sponsor's list.

### What's wrong / missing

1. The view ([`unsponsor_job`](../../Backchannel-backend/BackChannel-backend/bc_microservices/views_jobs.py#L363)) is `request=None` and ignores `request.query_params` entirely — `reason` is dropped on the floor.
2. The service `unsponsor_job(sponsor_id, job_id)` has no `reason` parameter and nowhere to record it.
3. **The bigger issue** — the service calls `revert_waitlist_to_active(ref_id)` **unconditionally** ([services/jobs.py:865](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/jobs.py#L865)). That puts the ATS listing back into circulation. For `posting_expired` / `role_filled` that's exactly backwards: the job is dead, and reactivating its waitlist re-surfaces a stale listing to other sponsors.

### Required changes

#### 1. View — read the query params

```python
@api_view(['DELETE'])
@permission_classes([IsSponsor])
def unsponsor_job(request, job_id):
    reason = request.query_params.get('reason')
    reason_detail = request.query_params.get('reason_detail')
    return _respond(
        jobs_svc.unsponsor_job(request.user.id, job_id, reason, reason_detail)
    )
```

#### 2. Service — accept, validate, persist the reason

```python
ALLOWED_UNSPONSOR_REASONS = {
    'role_filled', 'posting_expired', 'cannot_refer',
    'poor_applicant_fit', 'wrong_role', 'other',
}

def unsponsor_job(sponsor_id, job_id, reason=None, reason_detail=None):
    ...
    # Normalize an unknown / missing reason to 'other' rather than rejecting —
    # never block an unsponsor on a bad reason string.
    if reason not in ALLOWED_UNSPONSOR_REASONS:
        reason = 'other' if reason else None

    with transaction():
        likes_q.withdraw_likes_for_job(job_id)
        msg_q.close_conversations_for_job(job_id)
        ref_id = jobs_q.delete_sponsored_job(job_id, sponsor_id)

        # The job is dead at the source — don't recirculate it.
        job_is_dead = reason in ('posting_expired', 'role_filled')
        if ref_id and not job_is_dead:
            jobs_q.revert_waitlist_to_active(ref_id)
        if ref_id and reason == 'posting_expired':
            # Stop surfacing the expired listing in Browse for everyone.
            jobs_q.deactivate_silver_job(ref_id)

        if reason:
            jobs_q.record_unsponsor_event(
                sponsor_id, job_id, ref_id, reason, reason_detail,
            )
```

#### 3. Query layer

- **`record_unsponsor_event(sponsor_id, job_id, ref_job_id, reason, reason_detail)`** — `delete_sponsored_job` hard-deletes the `job_postings` row, so the reason can't live on the job. A small audit table is the clean home:

  ```sql
  CREATE TABLE jobs.unsponsor_events (
      EVENT_ID       UUID PRIMARY KEY,
      SPONSOR_ID     ...  NOT NULL,
      JOB_ID         ...  NOT NULL,   -- the (now-deleted) job_postings id
      REF_JOB_ID     ...,             -- ats.silver_jobs id, when known
      REASON         TEXT NOT NULL,
      REASON_DETAIL  TEXT,
      CREATED_AT     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

  This also gives you the analytics to see which reasons dominate.

- **`deactivate_silver_job(ref_id)`** — `UPDATE ats.silver_jobs SET is_active = FALSE WHERE JOB_ID = %s`. (Mirror of whatever browse already uses — `browse_silver_jobs` filters on `is_active = TRUE`, so flipping this flag prunes the listing from Browse with no delete.)

### Notes / decisions for the backend

- **`role_filled` pruning** — I've scoped the hard prune (`deactivate_silver_job`) to `posting_expired` only, since "filled" is a strong signal but slightly less certain than "the posting is gone." Both skip `revert_waitlist_to_active`. If you'd rather also deactivate the silver job on `role_filled`, that's a one-line change — your call.
- **One sponsor's word vs. the shared feed** — a single sponsor saying "expired" deactivates the listing for everyone. For a closed beta that's fine and desirable (fast cleanup). At scale you may want a threshold (N reports, or only trusted sponsors) before pruning — worth revisiting then, not now.
- Unknown/missing `reason` is normalized, never rejected — unsponsoring must never fail because of a bad reason string.

### Frontend impact

None remaining — the reason step, the 6 options, and the `unsponsorJob(jobId, reason, reasonDetail)` call are all already shipped. The params are sent now; the backend can ignore them until this lands, and the unsponsor itself keeps working in the meantime.

---

# 🧭 Recommendation — Push notification delivery

> **This is a recommendation, not a change order.** The frontend team surfaced a gap in how message push notifications are delivered and is proposing an approach. Unlike the §-items above, the final architecture call here belongs to the backend team — this section lays out the problem and the options so that decision can be made with full context.

### The problem

Sending a message already triggers the push path: `send_message` → `create_notification(notif_type='message', ...)` → `push_svc.send_push(...)` on a background thread. The code path exists and fires on every message (REST **and** WebSocket sends).

But it almost certainly doesn't *deliver*, because of a **token-format mismatch**:

- The **frontend** registers an **Expo push token** (`ExponentPushToken[...]`) — it calls `Notifications.getExpoPushTokenAsync()` ([components/MainApp.tsx](../components/MainApp.tsx)).
- The **backend** ([`services/push.py`](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/push.py)) delivers via **raw Firebase Cloud Messaging** (`firebase-admin` → `messaging.send()`), which requires a **native FCM registration token**.

An Expo token is not an FCM token. `messaging.send()` rejects it as `InvalidArgumentError`, and the backend's own error handler then **deactivates that token** — so the device silently loses its registration on top of never getting the push.

Two further conditions gate delivery regardless: `send_push` no-ops unless `FIREBASE_CREDENTIALS_*` is set, and a recipient who disabled the `message` notification type is (correctly) skipped.

### The two ways to fix it

**Option A — backend sends via the Expo Push Service.** Rewrite `send_push` to POST tokens to `https://exp.host/--/api/v2/push/send` instead of calling `firebase-admin`. Expo relays on to APNs + FCM.

**Option B — frontend switches to native FCM tokens.** Frontend calls `getDevicePushTokenAsync()` instead, keeping `firebase-admin` on the backend. Despite sounding like "just a frontend change," it isn't: Android needs `google-services.json` wired into the native build, and **iOS is a blocker** — `getDevicePushTokenAsync()` returns an APNs token there, not an FCM token, so `firebase-admin` still can't consume it without adding the Firebase client SDK (`@react-native-firebase/messaging`) — a new native dependency + `GoogleService-Info.plist` + an APNs key uploaded to the Firebase console. It spreads across frontend code, native build config, and Firebase setup.

### Our recommendation: Option A

This app is an Expo app (`expo-dev-client`, EAS `projectId`). The Expo Push Service is the idiomatic, production-grade pairing for that stack — free, unlimited, and used by apps well past this app's scale. Why we'd recommend it:

- **Contained** — one function in one file (~40–60 lines), no frontend change, no schema change, no migration. It *removes* the `firebase-admin` dependency rather than adding one.
- **Uniform** — one code path covers iOS + Android; Expo holds the APNs/FCM credentials.
- **Right-sized for prod & scale** — handles batching (100 tokens/request) and scales well past launch. The current `firebase-admin` setup is effectively a half-finished native approach grafted onto an Expo frontend; Option A makes the backend match the stack the app is actually built on.

If the backend team has a specific reason to standardize on raw FCM (e.g. existing Firebase-centric infrastructure), Option B is legitimate — it's just a larger, multi-surface effort, not a frontend tweak. That trade-off is the backend team's to weigh.

### What Option A would involve (for effort estimation)

Rewrite [`services/push.py`](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/push.py) → `send_push`:

```python
import requests

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_push(user_id, title, body, data=None):
    """Send a push to all of a user's active devices via the Expo Push Service."""
    from ..queries import devices as devices_q
    tokens = [t["DEVICE_TOKEN"] for t in devices_q.get_active_tokens(user_id)]
    if not tokens:
        return

    clean_data = {k: str(v) for k, v in (data or {}).items() if v is not None}
    messages = [
        {"to": tok, "title": title, "body": body,
         "data": clean_data, "sound": "default"}
        for tok in tokens
    ]
    # Expo accepts up to 100 messages per request.
    for i in range(0, len(messages), 100):
        batch = messages[i:i + 100]
        try:
            resp = requests.post(EXPO_PUSH_URL, json=batch, timeout=10)
            tickets = resp.json().get("data", [])
            for msg, ticket in zip(batch, tickets):
                if (ticket.get("status") == "error"
                        and ticket.get("details", {}).get("error")
                        == "DeviceNotRegistered"):
                    devices_q.deactivate_token(msg["to"])
        except Exception:
            logger.exception("Expo push failed for user %s", user_id)
```

- The `register_device` endpoint, the `devices` table, the `_push_executor` background dispatch, and the `create_notification` call site all stay exactly as they are.
- `firebase-admin` and the `FIREBASE_CREDENTIALS_*` env vars can be dropped.
- **Optional hardening (recommended for prod, not required for v1):** Expo returns *tickets* immediately and *receipts* a few seconds later — polling the receipts endpoint (`/--/api/v2/push/getReceipts`) is how you catch delivery failures and `DeviceNotRegistered` cases that only surface post-send. Worth a follow-up; not a launch blocker.

### Production prerequisite (true for either option)

Push in production needs the **APNs key + FCM credentials** registered so the relay can reach Apple/Google. With Option A that's a one-time upload to **EAS credentials** (`eas credentials`) — the standard home for an Expo app's push credentials.

### Frontend impact

None for Option A — the frontend already registers Expo push tokens, which is exactly what the Expo Push Service consumes. Message push notifications start working the moment the backend switches.

---

# ⚠️ Verify — Confirm work-email verification emails actually send

> **This is a deployment / environment check, not a code change.** The work-email verification flow (PR #42) is fully implemented and correct in code — there is nothing to build. This item exists because whether the emails *actually reach sponsors* depends on environment configuration that can't be confirmed from the source.

### Context

When a sponsor signs up, the frontend calls `POST /api/auth/verify-work-email/send/`; the backend mints a purpose-scoped JWT and emails a verification link to the claimed work address. The code path is complete: route → `auth_svc.send_work_email_verification` → `email_svc.send_work_email_verification` → Django `send_mail`.

### Why this needs a manual check

Django's email layer **degrades silently**. In [`django_bc/settings.py`](../../Backchannel-backend/BackChannel-backend/django_bc/settings.py#L206):

```python
_email_host = os.environ.get("EMAIL_HOST", "")
if not _email_host ...:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
```

If `EMAIL_HOST` is **not set in the deployed environment**, Django falls back to the *console backend* — every "verification email" is merely printed to the server log and **never delivered**. There's no error and no exception; `send_mail` reports success. The same applies to *all* transactional email (welcome, password reset, login verification) — they all share `services/email.py`.

### What to confirm in the deployed environment

1. **SMTP env vars are set** on the backend host (DigitalOcean): `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`. Resend values, per `.env.example`:
   ```
   EMAIL_HOST=smtp.resend.com
   EMAIL_HOST_USER=resend
   EMAIL_HOST_PASSWORD=re_YourApiKeyHere
   ```
2. **The sending domain is verified in Resend.** `DEFAULT_FROM_EMAIL` defaults to `noreply@backchannel.app` — Resend rejects mail from a domain that isn't verified in its dashboard. Confirm the from-address domain is verified.
3. **End-to-end smoke test.** Run a real sponsor signup against the deployed backend and confirm the work-email verification message lands in an inbox. The logs tell the two outcomes apart — `services/email.py` logs `Email sent to <addr>` on success and `Failed to send email to <addr>` on SMTP failure.

### Not a code issue

To be explicit: there is no backend application code to change here. If verification emails aren't arriving, the cause is the `EMAIL_*` environment variables or Resend domain verification — not the codebase.
