# Backend Changes Needed

**Last updated:** 2026-05-05
**Verified against backend HEAD:** `eef69b8` (post-PR #40, 2026-05-05)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> All previously-tracked ship-blockers (Redis caching, sponsored-job insights, `create-from-url`, and profile-pack enrichment) have shipped end-to-end and been integrated on the frontend. Six items remain. §1, §5, and §6 are product-integrity / feature gaps that should land before any wider/public launch (closed beta works without them); §2–§4 are polish / cleanup.

---

## 📋 Summary

| #   | Item                                          | Priority      | Status         | Type     |
| --- | --------------------------------------------- | ------------- | -------------- | -------- |
| §1  | Real work-email verification for sponsors     | 🟡 Pre-launch | Cosmetic only  | New flow |
| §2  | Notifications enhancements (5 sub-items)      | 🟢 Polish     | Mostly working | Polish   |
| §3  | Enrich `/api/likes/jobs/` with ATS rich fields | 🟢 Polish    | Sections hidden | SQL only |
| §4  | Add `LIKES_COUNT` to `/api/jobs/mine/`         | 🟢 Cleanup    | Workaround live | SQL only |
| §5  | `POST /api/jobs/{id}/request-sponsor/` endpoint | 🟡 Pre-launch | UI shipped, no-op backend | New flow |
| §6  | `POST /api/likes/profiles/received/{like_id}/accept/` (applicant likes a sponsor back) | 🟡 Pre-launch | UI shipped, no-op backend | New flow |

**🟡 = should land before public launch** (product-integrity issue; closed beta is fine without it) **·** **🟢 = pure polish, app works without it**

---

## §1 — Real Work-Email Verification for Sponsors

**Affects:** [`components/SponsorQuestionnaire.tsx`](../components/SponsorQuestionnaire.tsx) — step 8 "Verify your employment"

### What's showing now

The last step of sponsor sign-up asks for a work email (e.g. `name@company.com`). When the sponsor presses "Verify & Complete", the app shows a fake "Awaiting verification…" spinner then submits registration regardless — no email is sent, no link is clicked, nothing is verified. The "Resend" button is also fake.

`sponsor_profiles.work_email` is collected and stored, but there is no verification of any kind. The frontend's `workEmailVerified` flag defaults to `true` if the backend doesn't return `work_email_verified` on the profile response, so **every sponsor passes the email-verification gate in `HomeView`** regardless of what they entered.

### Why this is more than cosmetic

A sponsor can claim to work at any company with any email address. For closed beta with controlled tester accounts this is acceptable. For any wider/public launch it's a real product-integrity issue — the entire premise of "BackChannel = real insider context from a real employee" rests on this signal.

### Root cause: two emails in two separate columns

We have two distinct email fields with two distinct meanings:

```
users table                       sponsor_profiles table
─────────────────                 ────────────────────────
user_id        → 1234             user_id            → 1234
email          → jane@gmail.com   work_email         → jane@stripe.com
email_verified → TRUE/FALSE       work_email_verified → (column does not exist yet)
```

- `users.email` is Jane's **login credential**. Verified by PR #38.
- `sponsor_profiles.work_email` is her **employment claim**. Currently unverified by anything.

These can be the same address or different addresses. They mean different things. PR #38's existing `users.email_verified` flag answers *"does Jane control her login mailbox?"* — it cannot also answer *"does Jane work at the company she claims?"* The two questions are independent, so we need two separate flags.

This rules out re-flipping the existing `users.email_verified` from a work-email click — that would conflate two unrelated facts and create a false integrity signal.

### Strategy: extend PR #38, don't duplicate it

The cleanest path is to *extend* the existing verification machinery rather than build a parallel one. The total work is:

- **1 new column** (`sponsor_profiles.work_email_verified`)
- **1 new endpoint** (`POST /api/auth/verify-work-email/send/`)
- **1 small modification** to the existing `POST /api/auth/verify-email/` endpoint — branch on the JWT's `purpose` claim
- **1 new email template** (or a small variant of the existing one)

Frontend reuses everything else: the [existing `/verify-email` deep-link route](../app/verify-email.tsx), the `authApi.verifyEmail()` helper, and the success/error UI. No new frontend route or API helper needed.

### What to build

#### 1. New column

```sql
ALTER TABLE user_info.sponsor_profiles
  ADD COLUMN work_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

Also expose `work_email_verified` on the existing `GET /api/profile/` response under the sponsor sub-object, so the frontend's `useUserProfileStore.fetchFromBackend()` can read the real value instead of defaulting to `true`.

#### 2. New endpoint — `POST /api/auth/verify-work-email/send/`

- **Auth:** Required (sponsor session)
- **Body:** `{ "work_email": "name@company.com" }`
- **Behavior:** Generates a JWT verification token with claims `{ user_id, work_email, purpose: "work_email_verification" }`, sends a verification email to the `work_email` address (NOT to `users.email`).
  - **Important:** the `work_email` value goes *into the token* so the verify endpoint can write the exact verified address to `sponsor_profiles.work_email`. This handles the case where the user changes the form between send and click — only the address that was actually emailed gets persisted as verified.
- **Optional defense-in-depth:** validate that `work_email`'s domain matches the sponsor's claimed `company` field (e.g. reject `name@gmail.com` if `company == "Stripe"`). Can be punted to a future iteration.
- **Rate limit:** 5 / hour per user (mirror PR #38's `resend-verification` throttle).
- **Response (200):** `{ "message": "Verification email sent to name@company.com" }`

#### 3. Extension to existing `POST /api/auth/verify-email/`

Today this endpoint unconditionally calls `users_q.set_email_verified(user_id)`. It needs to branch on the token's `purpose` claim:

```python
# Pseudocode for the verify-email service
def verify_email(token_str):
    decoded = decode_token(token_str)  # existing
    user_id = decoded.get('user_id')
    purpose = decoded.get('purpose')

    if purpose == 'email_verification':
        # EXISTING BEHAVIOR — do not change
        users_q.set_email_verified(user_id)
        return success("Email verified successfully.")

    elif purpose == 'work_email_verification':
        # NEW BRANCH
        work_email = decoded.get('work_email')
        if not work_email:
            return bad_request("Invalid token")
        sponsor_profiles_q.set_work_email_verified(user_id, work_email)
        return success("Work email verified successfully.")

    else:
        return bad_request("Invalid or expired verification token")
```

The new query helper:

```python
def set_work_email_verified(user_id, work_email):
    q = """
    UPDATE user_info.sponsor_profiles
    SET work_email = %s, work_email_verified = TRUE
    WHERE USER_ID = %s
    """
    execute_query(q, (work_email, user_id))
    invalidate(f"sponsor_profile:{user_id}", f"pub_profile:{user_id}", f"sponsor_info:{user_id}")
```

Both purposes should remain idempotent (verifying twice = success both times).

#### 4. Email template

Either:
- Add a new template `verify_work_email.html`, OR
- Add a `kind: "work_email"` flag to [`verify_email.html`](../../Backchannel-backend/BackChannel-backend/bc_microservices/templates/email/verify_email.html) and branch the body copy.

Body should reference *"verifying your employment at <company>"* instead of *"verifying your account email"*. Link still points at `{FRONTEND_URL}/verify-email?token=<JWT>` — same deep-link target, the verify endpoint will route based on `purpose`.

### Frontend impact (when shipped)

Once the backend is live, [`SponsorQuestionnaire.tsx`](../components/SponsorQuestionnaire.tsx) step 8:

1. Replaces the fake `setTimeout` spinner with a real call to `POST /api/auth/verify-work-email/send/` when the sponsor presses "Verify & Complete".
2. Shows the "Awaiting verification…" UI and polls `GET /api/profile/` every 3 seconds (no separate `/status/` endpoint needed — the profile endpoint already returns the sponsor sub-object, and `work_email_verified` will live on it).
3. Auto-advances to `handleFinalSubmit()` the moment the polled response shows `work_email_verified === true`.
4. Wires the "Resend" button to a second call to the send endpoint (the 5/hr backend throttle prevents abuse).

The [existing `app/verify-email.tsx` deep-link landing screen](../app/verify-email.tsx) handles the user clicking the link — no changes needed there. The screen already calls `authApi.verifyEmail(token)` with whatever JWT was in the URL; the backend's branched verify service routes the write to the correct column based on `purpose`.

The `workEmailVerified` flag in [`stores/useUserProfileStore.ts:225`](../stores/useUserProfileStore.ts#L225) reverts to its real-data semantics — the gate in `HomeView` then actually blocks unverified sponsors from swiping.

### Done when

- A sponsor entering a work email at step 8 receives a real verification email at that address (NOT at their login email).
- Clicking the link routes through the existing `/verify-email` endpoint, the service branches on `purpose === "work_email_verification"`, and flips `sponsor_profiles.work_email_verified` to `TRUE`.
- `GET /api/profile/` returns the new `work_email_verified` field on the sponsor sub-object.
- `users.email_verified` (PR #38's flag) is unaffected — verifying a work email does not flip the account-email flag, and vice versa.
- The questionnaire auto-advances on link click, and the `HomeView` email-verification gate actually blocks unverified sponsors.

---

## §2 — Notifications Enhancements

**Affects:** [`components/NotificationsView.tsx`](../components/NotificationsView.tsx)

### Context

The notifications list is fully interactive on the frontend — tap-to-navigate, swipe-to-mark-read, pull-to-refresh, date grouping, ticking relative times. The items below unlock functionality the frontend cannot implement alone.

### Current state

- Swipe → mark-read (because no delete endpoint exists).
- Read notifications accumulate forever (no bulk-clear).
- Cards show the generic server-provided `TITLE` / `BODY` only — no related-user names, photos, or job titles.
- Fresh rows appear only on pull-to-refresh or re-navigation. The unread-count badge polls every 60s but the list itself is stale for the duration of the session.

### What to build

#### 1. `DELETE /api/notifications/<id>/` — true per-row dismiss

- **Behavior:** Marks a single notification as dismissed for the owning user (hard delete or soft-delete via `DISMISSED_AT`).
- **Response (200):** `{ "message": "Notification deleted" }`
- **Why:** Swipe currently maps to mark-as-read because there is no delete endpoint. Users expect swipe-away to mean gone.

#### 2. `DELETE /api/notifications/?only=read` — bulk clear read

- **Behavior:** Deletes/dismisses all read notifications for the authenticated user.
- **Response (200):** `{ "deleted_count": N }`
- **Why:** Read notifications accumulate forever today. A "Clear read" header action needs this.

#### 3. Denormalized metadata on notification rows

Add four nullable fields to the existing `GET /api/notifications/` response shape:

- `RELATED_USER_NAME` (string)
- `RELATED_USER_PHOTO_URL` (string)
- `RELATED_JOB_TITLE` (string)
- `RELATED_JOB_COMPANY` (string)

**Why:** The frontend has `RELATED_USER_ID` / `RELATED_JOB_ID` but no display data. Without these, richer notification cards (e.g. *"John Smith liked **Senior Engineer** at Acme"*) require N+1 follow-up fetches per notification — bad for perf and UX.

#### 4. Realtime channel — or cheap polling alternative

Either:

- WebSocket `/ws/notifications/` that pushes newly-created rows to connected clients, **or**
- `GET /api/notifications/?since=<iso_timestamp>` to return only rows created after a client-held cursor.

**Why:** A focused user sitting on the notifications screen never sees new rows arrive. The unread-count poll updates the badge but not the list itself.

#### 5. Server-side grouping of repeat events

Aggregate near-identical events into a single row with a count (e.g., 5 `job_like` notifications on the same job within 10 minutes → one row with `body: "5 new applicants interested"`).

**Why:** High-activity users (especially sponsors) can otherwise receive a cascade of identical rows that bury other events.

### Frontend impact (when each ships)

1. Swap swipe-to-mark-read → swipe-to-delete; add a "Clear read" button in the header.
2. Render richer cards with actual names / photos / job titles instead of generic `BODY` strings.
3. Live list updates without manual pull-to-refresh.
4. Collapse grouped rows behind a count badge.

### Done when

- Swipe-to-delete actually removes the row from the user's notification list.
- A "Clear read" action removes all read notifications in one call.
- Notification cards display sender names, photos, and job context inline.
- New notifications appear on the screen without the user having to pull-to-refresh.

---

## §3 — Enrich `/api/likes/jobs/` Response with ATS Rich Fields

**Affects:** [`components/MatchesView.tsx`](../components/MatchesView.tsx) — the modal that opens when an applicant taps a card under "Liked" on the Matches screen.

### What's showing now

The liked-job modal has frontend scaffolding for a richer detail view that mirrors HomeView's expanded job card — sections for **Role Details**, **Core Responsibilities**, **Requirements Overview**, **Required Skills**, and **Highlights**. Today, all of those sections render as hidden because the backend's `GET /api/likes/jobs/` endpoint doesn't include the underlying fields. The user only sees title / company / location / salary / experience / description — same as before. Functional but information-sparse.

### Root cause

The query in [`bc_microservices/queries/likes.py:get_liked_jobs_for_user`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py#L100-L122) selects only the basic columns from `jobs.job_postings`:

```sql
SELECT l.LIKE_ID, l.CREATED_AT AS liked_at, l.NOTES, l.STATUS,
       j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION, j.REMOTE_OPTION,
       j.SALARY_MIN, j.SALARY_MAX, j.SALARY_CURRENCY, j.EXPERIENCE_LEVEL,
       j.DESCRIPTION, ...sponsor fields...
FROM matching.likes l
JOIN jobs.job_postings j ON l.JOB_ID = j.JOB_ID
...
```

The rich AI-derived fields (`core_responsibilities`, `requirements_summary`, `work_arrangement`, `skills`, `benefits`) live on `ats.silver_jobs`, not on `jobs.job_postings`. The link already exists — `jobs.job_postings.reference_job_id` points to `ats.silver_jobs.job_id` — and the same join pattern is already used in the waitlisted-jobs query at [`queries/jobs.py:329`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L329).

### What to build

Add a `LEFT JOIN` on `ats.silver_jobs` and select the rich columns:

```sql
SELECT l.LIKE_ID, l.CREATED_AT AS liked_at, l.NOTES, l.STATUS,
       j.JOB_ID, j.TITLE, j.COMPANY, j.LOCATION, j.REMOTE_OPTION,
       j.SALARY_MIN, j.SALARY_MAX, j.SALARY_CURRENCY, j.EXPERIENCE_LEVEL,
       j.DESCRIPTION,
       s.CORE_RESPONSIBILITIES,
       s.REQUIREMENTS_SUMMARY,
       s.WORK_ARRANGEMENT,
       s.SKILLS::TEXT,
       s.BENEFITS::TEXT,
       sp_up.FIRST_NAME AS SPONSOR_FIRST_NAME,
       sp_up.LAST_NAME  AS SPONSOR_LAST_NAME,
       sp_up.PHOTO_URL  AS SPONSOR_PHOTO_URL,
       sp.JOB_TITLE     AS SPONSOR_JOB_TITLE
FROM matching.likes l
JOIN jobs.job_postings j ON l.JOB_ID = j.JOB_ID
LEFT JOIN ats.silver_jobs s ON s.JOB_ID = j.REFERENCE_JOB_ID
LEFT JOIN user_info.user_profiles sp_up ON sp_up.USER_ID = j.SPONSOR_ID
LEFT JOIN user_info.sponsor_profiles sp ON sp.USER_ID = j.SPONSOR_ID
WHERE l.USER_ID = %s AND l.STATUS IN ('ACTIVE', 'MATCHED')
ORDER BY l.CREATED_AT DESC
LIMIT %s
```

Notes:

- The `LEFT JOIN` (vs. inner) is intentional — sponsored jobs created without a `reference_job_id` (manually created via `POST /api/jobs/create/`) won't have an ATS row, and we still want them returned.
- The `::TEXT` cast on JSONB columns matches the convention used in the existing pack endpoint at [`queries/jobs.py:142-143`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L142-L143). The frontend's `parseArray` helper accepts either real arrays or JSON strings, so either casting style works.
- Cache key (`liked_jobs:{user_id}`) and TTL (`TTL_SHORT`) stay the same — the ATS row for a given posting changes rarely.

### Frontend impact (when this ships)

Zero. The frontend mapping in [`MatchesView.tsx`](../components/MatchesView.tsx) already reads `CORE_RESPONSIBILITIES`, `REQUIREMENTS_SUMMARY`, `WORK_ARRANGEMENT`, `SKILLS`, and `BENEFITS` from the response with `(likedJob as any).FIELD_NAME` and parses JSON-cast arrays. The new sections will light up automatically once the response carries the data.

The optional follow-up is updating the typed shape of `getLikedJobs` in [`lib/api.ts:442-465`](../lib/api.ts#L442-L465) to include the new fields, so they're no longer accessed via `as any`. Pure cleanup, doesn't affect runtime behavior.

### Done when

- `GET /api/likes/jobs/` returns `CORE_RESPONSIBILITIES`, `REQUIREMENTS_SUMMARY`, `WORK_ARRANGEMENT`, `SKILLS`, and `BENEFITS` for each row that has a corresponding `ats.silver_jobs` entry.
- The matches modal renders the Role Details / Core Responsibilities / Requirements Overview / Required Skills / Highlights sections for sponsored ATS jobs.
- Sponsored jobs without a `reference_job_id` (manually created) still return successfully; the new fields are simply `NULL` / empty for those rows and the corresponding sections stay hidden.

---

## §4 — Add `LIKES_COUNT` to `GET /api/jobs/mine/`

**Affects:** [`components/JobsView.tsx`](../components/JobsView.tsx) — the "My Sponsored" tab on the sponsor's job board, which shows an applicant count under each job card (e.g. *"3 Applicants"*).

### What's showing now (and what we changed)

The applicant count on each sponsored-job card was hardcoded to `0` in the frontend because `GET /api/jobs/mine/` doesn't include any per-job applicant count in its response. So even when applicants had liked a sponsored job, the card said "0 Applicants".

**Frontend workaround already shipped** ([`JobsView.tsx`](../components/JobsView.tsx) — `enrichMyJobsWithApplicantCounts`): after `getMyJobs()` resolves and the cards render with `applicants: 0`, the app fans out one `GET /api/jobs/<id>/likes/applicants/` call per job (via `Promise.allSettled`) and patches each card's count back into state once the responses come in. Failures fall back silently to the existing 0 so a single failed call doesn't blank the whole list. This works today against the live backend — sponsors now see real applicant counts.

The workaround is an **N+1 problem**: a sponsor with 10 jobs makes 10 extra HTTP calls every time they open the My Sponsored tab. At closed-beta scale (probably <20 jobs per sponsor) this is negligible, but it's the wrong shape for production load and should be replaced with a proper backend fix.

### What to build

Add a correlated subquery (or a `LEFT JOIN ... GROUP BY`) to [`bc_microservices/queries/jobs.py:get_jobs_by_sponsor`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/jobs.py#L461-L478) so each row carries its current applicant count:

```sql
SELECT j.JOB_ID, j.SPONSOR_ID, j.TITLE, j.COMPANY, j.LOCATION, j.DESCRIPTION,
       j.SALARY_MIN, j.SALARY_MAX, j.SALARY_CURRENCY, j.REQUIREMENTS,
       j.EXPERIENCE_LEVEL, j.EMPLOYMENT_TYPE, j.REMOTE_OPTION,
       j.CREATED_AT, j.EXPIRES_AT, j.IS_ACTIVE, j.REFERENCE_JOB_ID,
       j.RELATIONSHIP, j.CAN_REFER, j.LOGO_URL,
       j.URL, j.DAY_TO_DAY, j.TEAM_CULTURE, j.IDEAL_CANDIDATE, j.INSIDER_INSIGHTS,
       j.KEY_SKILLS, j.BENEFITS, j.RESPONSIBILITIES, j.WORK_ARRANGEMENT,
       (SELECT COUNT(*) FROM matching.likes l
        WHERE l.JOB_ID = j.JOB_ID
          AND l.STATUS IN ('ACTIVE', 'MATCHED')) AS LIKES_COUNT,
       COUNT(*) OVER() AS _total_count
FROM jobs.job_postings j
WHERE j.SPONSOR_ID = %s
ORDER BY j.CREATED_AT DESC
LIMIT %s OFFSET %s
```

Notes:

- Counting `STATUS IN ('ACTIVE', 'MATCHED')` mirrors the filter used in [`get_liked_jobs_for_user`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py#L116) — both states represent applicants who currently care about the job. Withdrawn / unmatched likes are excluded.
- Correlated subquery is fine here because `matching.likes(JOB_ID, STATUS)` is already indexed for the existing like-count check paths. If profiling shows it slow, switch to a `LEFT JOIN matching.likes ... GROUP BY j.JOB_ID`.
- Cache key (`my_jobs:{sponsor_id}`) and TTL stay the same. The count can lag by `TTL_SHORT` — same as today's `applicants_who_liked_job` — which is acceptable.

Also update the typed response shape in [`lib/api.ts:getMyJobs`](../lib/api.ts#L326-L350) to add `LIKES_COUNT: number` to the `jobs` array element type.

### Frontend impact (when this ships)

Two small changes on our side:

1. Replace the four `applicants: 0` placeholders with `applicants: j.LIKES_COUNT ?? 0` in the `getMyJobs()` mappers.
2. Delete the `enrichMyJobsWithApplicantCounts` helper and both call sites.

That swaps an N+1 fan-out for a single-query field read.

### Done when

- `GET /api/jobs/mine/` returns a `LIKES_COUNT` integer on each job representing the count of `matching.likes` rows where `STATUS IN ('ACTIVE','MATCHED')`.
- The frontend's `enrichMyJobsWithApplicantCounts` workaround has been removed and the My Sponsored tab loads with no per-job follow-up calls.
- The number visible on each card matches the count of applicants returned by `GET /api/jobs/<id>/likes/applicants/` for that job.

---

## §5 — `POST /api/jobs/{id}/request-sponsor/` — Applicant Requests a Sponsor

**Affects:** [`components/HomeView.tsx`](../components/HomeView.tsx) — the "Get a Sponsor" modal that appears when an applicant swipes/applies to a job that has no active sponsor. [`lib/api.ts`](../lib/api.ts) — `requestSponsorForJob(jobId)`.

### Context — the feature that replaced "Apply Directly"

We removed the old "Apply Directly" flow entirely (the in-app WebView that scraped company career pages and AI-autofilled forms — `JobApplicationWebView`, `lib/webview-scripts.ts`, `types/autofill.ts`, `generateAutofillAnswers`, the `/api/v1/autofill/generate/` call, and the related Mixpanel events are all gone). In its place, the "Get a Sponsor" modal now offers two options for a sponsor-less job:

1. **Join Waitlist** — existing flow (`joinWaitlist` → `POST /api/jobs/waitlist/`); user is notified when *anyone* sponsors the job.
2. **Request a Sponsor** — *new*; the applicant proactively asks employees at the job's company to sponsor this specific role (and, implicitly, themselves).

The frontend for #2 is shipped: tapping it calls `requestSponsorForJob(jobId)` → `POST /api/jobs/{jobId}/request-sponsor/`, shows a success state ("We've let employees at {company} know…"), and marks the card with a "Sponsor requested" badge. **The call currently fails silently** because the endpoint doesn't exist — the UI treats failure as success (intent is recorded client-side for the session). So the feature *looks* done but does nothing server-side yet.

### What to build

**Endpoint:** `POST /api/jobs/{job_id}/request-sponsor/`
- **Auth:** required (applicant session)
- **Body:** none (job ID is in the path)
- **Behavior:**
  1. Look up the job (`jobs.job_postings` for an already-imported job, or resolve via `reference_job_id` → `ats.silver_jobs` for an ATS listing — the applicant deck shows both). Pull the company name / org.
  2. Find candidate sponsors: users with `IS_SPONSOR = TRUE` whose `sponsor_profiles.company` (or verified `work_email` domain, once §1 ships) matches the job's company. Optionally also notify *existing* sponsors of that company who haven't sponsored this particular job.
  3. Create a notification per candidate sponsor (`type: "sponsor_request"`, `RELATED_JOB_ID = job_id`, `RELATED_USER_ID = applicant_id`, body like *"{Applicant Name} is hoping someone at {Company} will sponsor {Job Title}"*). Reuse the existing notification table / pipeline used by waitlist + match notifications.
  4. Record the request itself (a `matching.sponsor_requests` row, or similar — `user_id`, `job_id`, `created_at`, `status`) so it can be deduped (don't re-notify on repeat taps) and so a future "my sponsor requests" fetch can hydrate the badge across sessions.
- **Rate limit:** mirror the waitlist throttle (e.g. a handful per hour per user).
- **Response (200/201):** `{ "job_id": "...", "notified_count": <int>, "message": "Request sent to N sponsors at {Company}" }`

**Edge cases:**
- Job already has an active sponsor → return 200 with `notified_count: 0` and a message like "This job already has a sponsor" (the UI shouldn't even offer the option in that case, but be defensive).
- No matching sponsors found → still 200, `notified_count: 0`. The applicant's intent is still recorded; if a matching sponsor joins later, you *could* notify them retroactively (nice-to-have, not required).
- Duplicate request (same user + job) → idempotent: don't create duplicate notifications, return the existing request's state.

### Frontend impact (when this ships)

Minimal. `requestSponsorForJob` already points at the right URL; once the endpoint returns 200 the silent-failure path stops triggering. Optional follow-ups on our side:
- Surface `notified_count` in the success copy ("We notified 3 people at {Company}…") instead of the generic message.
- Add a `GET /api/jobs/sponsor-requests/mine/` (parallel to `GET /api/jobs/waitlist/mine/`) so `requestedSponsorJobIds` can be hydrated on mount and the "Sponsor requested" badge survives app restarts. Right now it's session-only.

### Done when

- `POST /api/jobs/{id}/request-sponsor/` exists, notifies matching sponsors, and records the request idempotently.
- Sponsors of the relevant company receive a notification when an applicant requests a sponsor for one of their company's jobs.
- Repeat taps by the same applicant don't spam sponsors with duplicate notifications.

---

## §6 — `POST /api/likes/profiles/received/{like_id}/accept/` — Applicant Likes a Sponsor Back

**Affects:** [`components/MatchesView.tsx`](../components/MatchesView.tsx) — the "Interested in You" section + the sponsor-profile modal it opens. [`lib/api.ts`](../lib/api.ts) — `likeBackSponsor(likeId)`.

### Context

The Matches screen has an "Interested in You" section listing sponsors who swiped right on the applicant's profile but haven't matched yet (one-sided interest — data from `GET /api/likes/profiles/received/`). Tapping a sponsor opens a modal with their profile. That modal already had an "I'm Interested" button — but it just closed the modal and did nothing. We've now wired it to **actually like the sponsor back**, which should produce a mutual match:

- The button calls `likeBackSponsor(likeId)` → `POST /api/likes/profiles/received/{like_id}/accept/`
- On success the frontend pulls the sponsor out of "Interested in You", re-fetches matches (so they appear under "Matched Opportunities"), and shows a toast
- **The call currently fails silently** — the endpoint doesn't exist, so the button shows an error toast and the sponsor stays in the list. The wiring is shipped; the behavior isn't real yet.

### Why this needs a dedicated endpoint (not just `likeJob`)

In this app's model, applicants like *jobs* and sponsors like *applicant profiles*; a match exists when both directions point at the same job. So "the applicant likes the sponsor back" really means "the applicant likes one of that sponsor's jobs." But the `GET /api/likes/profiles/received/` payload doesn't include a job ID ([`bc_microservices/queries/likes.py:get_received_profile_likes`](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py) selects only sponsor info, no `JOB_ID`). The frontend therefore can't call `likeJob(jobId)` directly — it only has the sponsor's profile-like `LIKE_ID`. Hence an endpoint keyed on that like ID, where the **backend resolves which job to match on**.

### What to build

**Endpoint:** `POST /api/likes/profiles/received/{like_id}/accept/`
- **Auth:** required (applicant session)
- **Path param:** `like_id` — the `matching.likes` row ID of the sponsor's profile-like (the value the frontend already has from the received-likes list)
- **Behavior:**
  1. Look up the like row. Verify it's a profile-like targeting *this* applicant (`PROFILE_ID = request.user.id`) and is still `ACTIVE` — otherwise 404/409.
  2. Identify the sponsor (`USER_ID` on that row) and find the job to match on. If the profile-like stored a `JOB_ID` (or you add one), use that. Otherwise: pick the sponsor's active job that this applicant hasn't already liked (if the sponsor has multiple, the most recently posted is a reasonable default).
  3. Create the reciprocal job-like from the applicant on that job (or reuse one if it already exists), then run the existing match logic — mark both like rows `MATCHED`, open/find the conversation (same path `like_applicant_profile` uses today), and fire the match notification to both sides.
  4. Invalidate the relevant caches (`job_matches:{user_id}`, `received_likes:{user_id}`, the sponsor's `sponsor_matches:{sponsor_id}`).
- **Response (200):** `{ "matched": true, "match_id": "...", "job_id": "...", "message": "It's a match!" }`. If for some reason a match can't be formed (e.g. the sponsor has no active job), return `{ "matched": false, "message": "..." }` with 200 — the frontend handles both.

**Edge cases:**
- Like row already `MATCHED` → idempotent: return `matched: true` with the existing match info.
- Sponsor has unsponsored / deactivated all their jobs since liking → `matched: false`, friendly message; leave the like row as-is so it can match later.
- `like_id` doesn't belong to this applicant → 403/404.

### Frontend impact (when this ships)

None — `likeBackSponsor` already points at the right URL and handles both `matched: true`/`false`. Optional follow-ups:
- Include `JOB_ID` in `GET /api/likes/profiles/received/` (the cheap version of this — then the frontend could fall back to `likeJob(jobId)` if it ever needs to, and the modal could show *which* role the sponsor is interested in you for).
- Surface the matched job's title in the success toast instead of the generic "It's a match."

### Done when

- `POST /api/likes/profiles/received/{like_id}/accept/` exists, forms a mutual match (with the conversation + notifications the normal match flow produces), and is idempotent on repeat calls.
- After an applicant taps "Like … Back", that sponsor moves out of "Interested in You" and into "Matched Opportunities" on a refresh, and both parties can message each other.

---
