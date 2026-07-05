# Backend Changes Needed

**Last updated:** 2026-07-04
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§E** — 500 crash on `POST /api/profiles/like/` (sponsor "like back" / connect — blocks matching for some accounts, high priority); **§H** — password-reset email not arriving (likely SMTP env + case-sensitive email lookup, high priority); **§G** — ATS organizations search endpoint (powers company autocomplete + "did you mean", medium priority); **§I** — reject sponsor company changes after work-email verification (server-side trust lock, medium priority); **§C** — account deletion must erase user data (App Store blocker, top priority); **§J** — self-like not rejected server-side (sponsor sees themselves in "Interested in Your Jobs", medium priority); **§K** — unsponsor doesn't invalidate the affected applicants' caches (phantom match for ~15s on the applicant's Matches screen, medium priority); **§D** — notify the applicant when a sponsor likes their profile (low priority, UX freshness); **§F** — larger daily deck for premium users (low priority, monetization); **§B** — act on the captured unsponsor reason (low priority); **§L** — drop/ignore unused profile columns (portfolio, DOB, LinkedIn, unused address/phone — cleanup + PII minimization, low priority); the **email deployment checklist** at the bottom (env config, not code — incl. **#4 deliverability / emails landing in spam**, needs SPF/DKIM/DMARC); and **`change_email`** (still returns 501 — the app hides the change-email UI until it ships; re-enable on the app side then).
>
> **New feature requests (see the "🆕 New Features" section near the end):** **§N1** — report/block a user (App Store requirement, top priority, UX plan Phase 4); **§N2** — `/api/referrals/` doesn't return the current pipeline check-in stage, blocking real cross-party pipeline visibility (medium priority, UX plan Phase 5).
>
> Shipped items have been removed to keep this lean — the verify-email / reset-password web pages (PR #67, shipped as server-rendered web pages) and §1–§11 + push (PRs #54–#61). See the backend's [`BACKEND_CHANGES_SHIPPED.md`](../../Backchannel-backend/BackChannel-backend/docs/BACKEND_CHANGES_SHIPPED.md) for the record.

---

## §E — `POST /api/profiles/like/` returns 500 for some accounts (blocks sponsor "like back" / matching) 🔴 High priority

**Symptom (observed in TestFlight, 2026-06-23):** A sponsor taps a profile under **"Interested in Your Jobs"** and tries to connect/like back. The request fails with HTTP 500; the app now surfaces it verbatim as *"Couldn't connect right now: Internal server error."* It reproduces for one tester's account but **not** for another on the **same backend + same DB**, so it's a **data-specific** crash, not environment/build.

**Important:** the failing account is a **brand-new sponsor account**, so the crash is *not* explained by that sponsor's own prior like history (see the de-prioritized hypothesis below). The trigger is more likely the **specific applicant or job** in the attempt — e.g. an applicant with an incomplete profile row / null fields read by the match/conversation/notify step, or a job created via the sponsor-from-Browse/ATS path that left a field null. The unguarded `create_profile_like` insert is still worth confirming, but the mutual-match path (a real match fires because the applicant already liked the job) is now the more probable location.

**First step — read the traceback.** The production middleware masks the real error (`middleware.py:42` → `"Internal server error"` when `DEBUG=False`). The actual stack trace is in **backend Sentry** (and/or DigitalOcean runtime logs) for `POST /api/profiles/like/`. That names the exact line; the analysis below is a code-read hypothesis to check against it.

**Backend files:**
- `bc_microservices/views_matching.py` → `like_applicant_profile` ([line 142](../../Backchannel-backend/BackChannel-backend/bc_microservices/views_matching.py#L142))
- `bc_microservices/services/matching.py` → `like_applicant_profile` ([line 158](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/matching.py#L158))
- `bc_microservices/queries/likes.py` → `create_profile_like` ([line 44](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/likes.py#L44)) — **prime suspect**

### Leading hypothesis

The match-creation block in the service is wrapped in `try/except` (a failure there sets `matched=False` and returns 200, so it can't produce the 500). The unguarded work that runs *before* it is the suspect — most likely `create_profile_like`'s upsert:

```sql
INSERT INTO matching.likes (LIKE_ID, USER_ID, PROFILE_ID, JOB_ID, CREATED_AT, STATUS)
VALUES (%s, %s, %s, %s, NOW(), 'ACTIVE')
ON CONFLICT (user_id, profile_id)
WHERE profile_id IS NOT NULL AND status IN ('ACTIVE', 'MATCHED')
DO UPDATE SET JOB_ID = COALESCE(EXCLUDED.JOB_ID, matching.likes.JOB_ID)
```

The `ON CONFLICT` only catches conflicts among rows that are currently **ACTIVE/MATCHED**. If the sponsor already has a **non-active** like row for that applicant (e.g. a prior `PASSED`/`WITHDRAWN`), the re-insert can violate a *broader* unique constraint on `(user_id, profile_id)` that this partial clause doesn't cover → unhandled `UniqueViolation` → 500. An account with no prior like row for that applicant never hits it — which matches "works for me, not for the tester."

### Suggested fix (pending the traceback)

- Confirm which unique index/constraint exists on `matching.likes (user_id, profile_id)`. If there's a **full** unique constraint alongside (or instead of) the partial one, align the `ON CONFLICT` target with the actual constraint so all prior-row states are handled (e.g. conflict on the real constraint and `DO UPDATE SET STATUS='ACTIVE', JOB_ID=COALESCE(...)`), or pre-delete/transition any stale non-active row before insert.
- Whatever the root cause, `like_applicant_profile` should not let a DB exception escape as a raw 500 — wrap the insert so a re-like is idempotent and returns a clean result.

### Acceptance test

With a sponsor account that has previously **passed on** (or withdrawn interest in) a given applicant, have that applicant like the sponsor's active job, then from the sponsor's "Interested in Your Jobs" tap connect/like back. It should create the match (or return a clean, non-500 result) instead of erroring.

### Frontend status (updated 2026-07-01)

Fixed: `components/HomeView.tsx` → `handleSwipe` now sets `apiError = true` on any non-404 catch and shows "Couldn't connect right now. Please try again." **without** advancing the card — so the user is never shown a false "Request Sent!" when the API call failed. Previously, a 500 fell through to `setShowCelebration(true)`, which looked like success. The card is now held in place so the user can retry the swipe once the backend is fixed.

---

## §C — "Delete Account" must actually delete / anonymize the user's data 🔴 App Store blocker

**Backend files:**
- `bc_microservices/queries/users.py` → `deactivate_user()` ([line 191](../../Backchannel-backend/BackChannel-backend/bc_microservices/queries/users.py#L191))
- `bc_microservices/services/auth.py` → `deactivate_account()` (the cascade that calls it)

**Frontend (no change needed):** `components/ProfileView.tsx` → `handleDeleteAccount` already presents this as a permanent **deletion** ("This will permanently delete your account and all your data. This action cannot be undone.") and calls `POST /api/profile/deactivate/`. The copy is correct and should **stay** — the backend needs to match it.

### What's wrong

The user-facing "Delete Account" flow promises permanent deletion of all data, but the backend only does a soft deactivation. `deactivate_account()` runs a cascade (closes conversations, withdraws likes/referrals, cancels waitlist, deactivates jobs and device tokens) — good — but the actual user record is only flagged:

```python
def deactivate_user(user_id):
    """Set IS_ACTIVE = FALSE for user_id."""
    q = "UPDATE user_info.users SET IS_ACTIVE = FALSE WHERE USER_ID = %s"
    execute_query(q, (user_id,))
```

So after a user "deletes" their account, **all their PII remains in the database** — name, email, phone, date of birth, location/address, profile photo, and their **uploaded resume (file + extracted text + AI-classified data)**. Nothing is erased.

### Why this is a launch blocker (not a nice-to-have)

1. **Apple App Store rejection — Guideline 5.1.1(v).** Apps that let users create an account **must** let them initiate **deletion** of the account and its data. Apple's guideline explicitly states that **merely deactivating or disabling an account does not satisfy this requirement**. A reviewer who exercises "Delete Account" (or reads that it's a deactivation) can reject the submission. This is one of the more commonly enforced rejection reasons.
2. **The app makes a promise the backend breaks.** Users are told their data is permanently deleted; it isn't. That's a misrepresentation, and the retained data includes **resumes** (employment history, education) and **date of birth** — sensitive categories.
3. **GDPR / CCPA "right to erasure."** Retaining identifiable personal data after a user requests deletion is a legal-compliance exposure, independent of Apple.

### Required change

On account deletion, **actually remove the user's personal data** — either approach is acceptable:

- **Hard delete:** delete the `user_info.users` row (and the applicant/sponsor profile rows, resume blobs, and the stored profile photo / resume file in DigitalOcean Spaces) within the existing transaction.
- **Anonymize (tombstone):** if rows must be retained for referential integrity (e.g., referrals/messages reference the user id), **scrub the PII in place** — null/blank `FIRST_NAME`, `LAST_NAME`, `PHONE_NUMBER`, `DATE_OF_BIRTH`, `LOCATION`/address fields, `PORTFOLIO_URL`, `BIO`; delete `RESUME_DATA` + extracted text; delete the photo/resume objects from Spaces; and set `EMAIL`/`USERNAME` to a non-reversible tombstone such as `deleted-<user_id>@deleted.invalid`. Keep only the non-identifying foreign-key skeleton.

Anonymize is usually the pragmatic choice given the referral/message foreign keys. Whichever path: the **resume file + photo in object storage must be deleted too** (not just the DB rows), and the operation should stay inside the existing all-or-nothing transaction.

### Acceptance test

Create an account, upload a resume + photo, then delete the account. Confirm: (a) the email can be re-registered as if new, (b) the user's name/email/phone/DOB/resume no longer appear in any DB query or API response, and (c) the resume + photo objects are gone from DigitalOcean Spaces.

---

## §D — Notify the applicant when a sponsor likes their profile 🟡 (UX freshness)

**Backend files:**
- `bc_microservices/services/matching.py` → `like_applicant_profile()` ([line 158](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/matching.py#L158)) and the existing `notify_sponsor_of_like()` ([line 90](../../Backchannel-backend/BackChannel-backend/bc_microservices/services/matching.py#L90)) as the mirror template.

### What's missing

When a sponsor likes an applicant's profile, the applicant should appear under the applicant's **"Interested in You"** section (`/api/likes/profiles/received/`). Today `like_applicant_profile` only sends a notification when the like results in a **mutual match** (`notify_match`). A **one-sided** profile like sends the applicant **no notification and no push at all** — so nothing tells their app to refresh, and the new admirer doesn't appear until the app is re-foregrounded or the user pulls to refresh.

This is the inverse of the already-shipped `notify_sponsor_of_like` (applicant likes a job → sponsor is notified with `notif_type='job_like'`). The applicant-facing direction was never wired.

### Required change

Add a best-effort `notify_applicant_of_like(applicant_user_id, sponsor_id, job_id)` (mirroring `notify_sponsor_of_like`) and call it from `like_applicant_profile` on the **non-match** path — i.e. after `create_profile_like`, when `matched` is false. Suggested `notif_type='profile_like'`, title e.g. "Someone's interested in you", body naming the sponsor's company/role if available. Must never raise (wrap like the existing notifiers).

### Frontend impact

The app is already prepared for this:
- The bell badge and the "Interested in You" list will pick it up on the next fetch.
- `components/MainApp.tsx` already invalidates the Matches screen's cached lists on incoming `match` / `referral` / `job_like` / `waitlist` pushes — **add `'profile_like'` to that list** once the backend ships it, so the new like appears live without a manual refresh. (Until then, focus-refetch + pull-to-refresh cover it.)

### Acceptance test

From device A (sponsor), like an applicant's profile for a job the applicant has **not** liked (so no match). On device B (that applicant), with the app already foregrounded on another tab: a push/notification arrives, the bell badge increments, and the sponsor appears under "Interested in You" without manually refreshing.

---

## §G — ATS organizations search endpoint (company autocomplete + "did you mean") 🟡 (data quality)

**Why:** A sponsor's jobs board is filtered by matching their **free-text** company (from `sponsor_profiles.COMPANY`, set at signup) against `ats.silver_jobs.ORGANIZATION` using `UPPER(ORGANIZATION) ILIKE '%' || UPPER(company) || '%'` (`queries/jobs.py:493`, with legal-suffix normalization in `services/jobs.py:_normalize_company`). That handles casing and suffixes, but **not** misspellings, spacing/word-boundary differences ("JP Morgan" vs "JPMorgan Chase"), aliases (Facebook vs Meta), or over-matching short names — and on a mismatch the sponsor just sees an **empty board with no explanation**.

The frontend now fixes this from both ends, but needs one read-only endpoint to do it:
- **Company autocomplete at signup** (`components/ui/CompanyAutocomplete.tsx`) so the stored company is an *exact* ATS organization string (mismatch can't happen).
- **"Did you mean…"** suggestions when the board is empty (`components/JobsView.tsx`) — one tap re-saves the corrected company and reloads.

### Required endpoint

```
GET /api/ats/organizations/?q=<text>&limit=<n>   (auth required; sponsor)
→ 200 { "organizations": [
        { "organization": "Google", "job_count": 42, "logo_url": "https://…" },
        { "organization": "Google Cloud", "job_count": 8, "logo_url": null }
      ] }
```

- Distinct `ORGANIZATION` values from `ats.silver_jobs WHERE is_active = TRUE`, with the **active job count** per org and the org logo (`ORGANIZATION_LOGO`) when available.
- **Matching must serve two needs:**
  1. **Typeahead** — substring/prefix (`ILIKE '%' || q || '%'`) for as-you-type autocomplete.
  2. **Fuzzy "did you mean"** — so a *misspelled* stored company ("Gogle") still surfaces "Google". Use **`pg_trgm` similarity** (`similarity(ORGANIZATION, q) > ~0.3`), ordered by similarity desc, then `job_count` desc. Requires `CREATE EXTENSION pg_trgm;` and ideally a GIN trigram index on `ORGANIZATION` for speed.
- Combine both (substring OR trigram-similar), de-duplicate by `ORGANIZATION`, cap at `limit` (frontend asks for 6–8).

### Frontend status

Shipped and live behind a graceful fallback: `lib/api.ts → searchAtsOrganizations()` returns `null` on 404/error, so until this endpoint exists the company field is plain free-text and the empty board shows the normal empty state — **nothing breaks**. The autocomplete and "did you mean" light up automatically once the endpoint is deployed.

### Optional follow-up (stronger guarantee)

Consider normalizing/validating `sponsor_profiles.COMPANY` against this canonical list on write (or storing a chosen org id), so the browse filter can match on an exact key rather than `ILIKE`.

---

## §H — Password-reset email not arriving 🔴 (transactional email)

**Symptom (reported 2026-06-24):** A tester used "Forgot password?" and never received the reset email. The UI shows success because the endpoint intentionally returns a generic *"If an account exists, a link has been sent"* (anti-enumeration), so the failure is invisible from the app.

**Code is correctly wired — this is config + one latent bug, not missing code.** Path: `AuthScreen` → `POST /api/forgot-password/` → `services/auth.py:generate_reset_token` → `services/email.py:send_password_reset_email` → `send_mail(fail_silently=False)` on a background thread.

### What to check, in order

1. **SMTP / Resend env on the deployed host (most likely).** In production (`DEBUG=False`), `settings.py:206-211` always uses the SMTP backend and falls back to `EMAIL_HOST="localhost"` when `EMAIL_HOST` is unset — so sends hit `localhost:587`, fail, and get logged as *"Failed to send email to &lt;addr&gt;"*. This breaks **all** transactional email (welcome, verify, reset). Confirm these are set on the backend host:
   ```
   EMAIL_HOST=smtp.resend.com
   EMAIL_HOST_USER=resend
   EMAIL_HOST_PASSWORD=<resend_api_key>
   DEFAULT_FROM_EMAIL=BackChannel <noreply@your-verified-domain>
   FRONTEND_URL=<backend's own public origin>   # also makes the reset link valid
   ```
   …and the sending domain must be **verified in Resend** (otherwise Resend rejects the send → same "Failed to send" log).

2. **Case-sensitive email lookup (real code bug).** `queries/users.py:find_user_by_email` does `WHERE EMAIL = %s` (exact case), and email is **never lowercased** on register (`services/auth.py:register_applicant:86`). If the tester registered as `Tester@Gmail.com` and typed `tester@gmail.com`, no user is found, no email is sent, and the generic success is still returned. (This also breaks **login** under a casing mismatch.) **Fix:** normalize email to lowercase on store and on every lookup (register, login, forgot-password, `email_exists`).

3. **Spam / Resend dashboard** — if logs show *"Email sent to &lt;addr&gt;"*, it really sent; check spam and Resend for a bounce.

### How to tell which one (one log read)

Watch the deployed logs during a reset attempt:
- *"Sending password-reset email for user &lt;id&gt;"* then *"Failed to send email to &lt;addr&gt;"* → **#1** (SMTP/Resend config or unverified domain).
- **No** *"Sending password-reset email"* line at all → **#2** (user not found: casing / wrong email / never registered).
- *"Email sent to &lt;addr&gt;"* → it sent; check spam (**#3**).

### Frontend status

No change needed — `authApi.forgotPassword` / the reset screen (`app/reset-password.tsx`) are wired correctly and work as soon as the backend actually delivers the email.

---

## §I — Lock a sponsor's company server-side once their work email is verified 🟡 (trust integrity)

**Why:** The work-email verification proves a sponsor works at a given company; the **Company** field is what that verification vouches for. If a verified sponsor can change their company, they keep the verified badge while displaying an employer their verified email doesn't back (verify `name@google.com`, then switch company to "Stripe"). The app now **locks the Company field in the UI once `work_email_verified` is true** (`components/ProfileView.tsx` — read-only + lock icon, plus a guard on the save handler), but that's client-side only.

**Required change:** In the sponsor-profile update path (`services/profiles.py` → `update_sponsor_profile`, backing `PATCH /api/profile/sponsor/update/`), **reject (or ignore) a `company` change when `work_email_verified` is TRUE** for that user. Return a clear error (e.g. 409 / 400 "Company is locked to your verified work email") so the client can surface it. Changing the **work email** itself already correctly resets `work_email_verified = FALSE` — so the intended way to change company remains: update the work email → re-verify → company editable again.

**Notes / edge cases:**
- Scope strictly to sponsors; applicant company is not a trust signal and stays editable.
- Allow company edits freely while `work_email_verified` is FALSE (so a typo can be fixed before verifying).
- Optional stronger version: validate that the company aligns with the verified work-email domain (domain → org), rather than trusting free text. Out of scope for the basic lock.

**Frontend status:** Already enforced in `ProfileView` (field is read-only + a save guard) once `workEmailVerified` is true; this ticket is the server-side counterpart so the rule can't be bypassed by calling the API directly.

---

## §F — Larger daily deck (card allotment) for premium users 🟡 (monetization)

**Context:** The Home feed serves a fixed daily deck of **`DECK_SIZE = 10`** cards (`components/HomeView.tsx`), cached per day and rolling over at midnight. The new end-of-deck screen ("You're all caught up") now shows an **"Unlock more cards"** button that opens the existing RevenueCat paywall (`useSubscriptionStore.presentPaywall`, same one ProfileView uses for "Upgrade to Pro").

**What's missing (backend):** there is currently **no larger/unlimited allotment** for users who purchase premium — the deck endpoint caps everyone at the same daily set. So today, after a successful purchase, the app can only `resetNavigation()` (replay the same 10), which isn't real added value.

**Required change (when monetization is turned on):**
- Have the deck/feed endpoint return a larger (or unlimited) daily set for entitled/premium users — i.e. read the user's entitlement and raise the cap server-side.
- Expose the per-user cap (or "has more") so the app can fetch the next batch after purchase instead of replaying.

**Frontend status:** the paywall button is wired and the upsell only shows to non-premium users (`!isPremium`). Once the backend serves more cards to premium accounts, swap the post-purchase `resetNavigation()` for a real "fetch next batch". Gated behind `PREMIUM_ENABLED` (`constants/config.ts`), which is **false** today, so the button is inert until premium is switched on.

---

## §B — Act on the captured unsponsor reason to prune stale ATS listings 🟡 (formerly §12, capture half shipped in #58)

> **Status (verified 2026-05-28):** the *capture* half shipped — `unsponsor_job` accepts a `reason` in the request body and writes an audit row via `insert_unsponsor_audit`. The frontend merges its optional free-text detail into the reason string client-side (`"other: <detail>"`), so no separate `reason_detail` handling is needed. What has **not** shipped is acting on the signal:

**Backend files:**
- `bc_microservices/services/jobs.py` → `unsponsor_job` (the `revert_waitlist_to_active` call, ~line 897)
- `bc_microservices/queries/jobs.py` → new `deactivate_silver_job` helper

### What's missing

`posting_expired` and `role_filled` are **job-health signals** — they mean the underlying ATS listing is dead and should stop being surfaced to *everyone*. Today the service ignores the reason after persisting it:

1. **`revert_waitlist_to_active(ref_id)` runs unconditionally.** When the reason says the job is dead, reactivating its waitlist re-surfaces a stale listing to other sponsors. Guard it:

   ```python
   job_is_dead = reason in ('posting_expired', 'role_filled')
   if ref_id and not job_is_dead:
       jobs_q.revert_waitlist_to_active(ref_id)
   ```

2. **No `deactivate_silver_job(ref_id)`.** For `posting_expired`, also pull the listing from Browse for everyone:

   ```python
   if ref_id and reason == 'posting_expired':
       jobs_q.deactivate_silver_job(ref_id)
   # UPDATE ats.silver_jobs SET is_active = FALSE WHERE JOB_ID = %s
   ```

### Notes / decisions for the backend

- The hard prune is scoped to `posting_expired` only — "filled" is a strong signal but slightly less certain than "the posting is gone." Both skip the waitlist revert. Extending the prune to `role_filled` is a one-line change; backend team's call.
- **One sponsor's word vs. the shared feed** — a single sponsor saying "expired" deactivates the listing for everyone. For a closed beta that's fine and desirable (fast cleanup). At scale, consider a threshold (N reports, or trusted sponsors only) before pruning.
- Unknown/missing `reason` must keep being tolerated — unsponsoring must never fail because of a bad reason string.

### Frontend impact

None — the reason step and the `unsponsorJob(jobId, reason, reasonDetail)` call already ship the data. This is purely a backend behavior change.

---

# ⚠️ Verify — Deployment environment checklist (email + links)

> **These are deployment / environment checks, not code changes.** The code paths are complete; whether the flows work in production depends on env configuration that can't be confirmed from source.

1. **`FRONTEND_URL`** is set on the backend host to the service's **own public origin** (the backend serves the verify-email / reset-password web pages). Default is `http://localhost:3000`, which silently produces dead links in every verification and reset email.
2. **SMTP env vars are set** on the backend host: `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`. If `EMAIL_HOST` is unset, `settings.py` silently falls back to the **console email backend** — every "sent" email is merely printed to the server log; `send_mail` still reports success. This affects *all* transactional email (welcome, verification, work-email verification, password reset). Resend values, per `.env.example`:
   ```
   EMAIL_HOST=smtp.resend.com
   EMAIL_HOST_USER=resend
   EMAIL_HOST_PASSWORD=re_YourApiKeyHere
   ```
3. **The sending domain is verified in Resend.** `DEFAULT_FROM_EMAIL` defaults to `noreply@backchannel.app` — Resend rejects mail from an unverified domain.
4. **Email deliverability — emails landing in spam (observed 2026-06-24).** 🔴

   **Context / the issue we're solving:** Testers report the **work-email verification** email (and likely the others) arriving in the **spam/junk folder** rather than the inbox. This is a *deliverability* problem, separate from "no email at all" (§H): the mail is being sent and accepted, but receiving providers (Gmail, Outlook, etc.) are scoring it as untrusted and filing it as spam. Sponsors who don't think to check spam never verify, which **soft-blocks them from swiping** (the work-email gate in `HomeView`), so this directly costs activated sponsors.

   **Frontend mitigation already shipped (band-aid, not a fix):** the verification modal and the onboarding/resend confirmations now tell users to "check your spam or junk folder." This reduces drop-off but does **not** fix the root cause.

   **Root cause is almost always missing/incorrect domain authentication.** Mailbox providers spam-file mail whose sending domain isn't authenticated. To fix, on the **sending domain used in `DEFAULT_FROM_EMAIL`**:
   - **SPF** — publish a TXT record authorizing Resend to send for the domain.
   - **DKIM** — add the CNAME/TXT keys Resend provides so messages are cryptographically signed.
   - **DMARC** — publish a `_dmarc` TXT policy (start `p=none` for monitoring, tighten later).
   - Resend's domain dashboard lists the exact records and shows green once they propagate. Don't send from a free-mailbox domain (e.g. `@gmail.com`) or an unverified domain — both tank deliverability.
   - Secondary factors worth checking: a real, branded **From** name/address (not `noreply@` on an unknown domain if avoidable), a working **reply-to**, and avoiding spammy subject lines. Warm-up/volume matters less at current scale.

   **How to verify:** after DNS is set, use Resend's domain status (all green) and a tool like **mail-tester.com** — send a verification email to its address and aim for ~10/10. Re-test in a real Gmail and Outlook account to confirm it lands in the inbox.

5. **End-to-end smoke test** against the deployed backend: register → verification email arrives → link opens the backend's web verify page and confirms; then forgot-password → email → reset on the web reset page → sign in with the new password. `services/email.py` logs `Email sent to <addr>` vs `Failed to send email to <addr>` to tell SMTP outcomes apart.

---

## §J — Sponsor sees themselves in "Interested in Your Jobs" (self-like not rejected server-side) 🟡 Medium priority

**Symptom (observed in beta, 2026-07-01):** A sponsor who just completed signup opens the Matches screen and sees their **own profile** listed under "Interested in Your Jobs." A user should never appear in their own matches list.

**Frontend workaround shipped (2026-07-01):** The `interestedApplicants` query in `MatchesView.tsx` now derives the current user's ID from `activeJobs[0].SPONSOR_ID` (all of the sponsor's jobs share the same `SPONSOR_ID`) and skips any `APPLICANT_USER_ID` that matches. This prevents the self-entry from rendering even when the backend returns it.

**Backend root causes — two places to fix:**

**1. `like_job` does not reject self-likes** (`services/matching.py`, line 131):
```python
def like_job(user_id, job_id, notes=''):
    job = jobs_q.job_exists_active(job_id)
    ...
    like_id = likes_q.create_job_like(user_id, job_id, notes)  # no self-check
```
Add before the insert:
```python
if str(job.get('SPONSOR_ID', '')) == str(user_id):
    return Result.bad_request("You cannot like your own job")
```

**2. `get_applicants_who_liked_job` does not exclude the job owner** (`queries/likes.py`, line 244):
```sql
WHERE l.JOB_ID = %s AND l.STATUS IN ('ACTIVE','MATCHED')
-- missing: AND l.USER_ID != <sponsor_id>
```
The calling service (`get_job_applicants` in `services/matching.py`, line 226) already has the `sponsor_id`. Pass it to the query and add `AND l.USER_ID != %s` to the WHERE clause.

**Files:**
- `bc_microservices/services/matching.py` → `like_job` (line 131), `get_job_applicants` (line 226)
- `bc_microservices/queries/likes.py` → `get_applicants_who_liked_job` (line 244)

---

## §K — Unsponsoring a job leaves stale matches/likes in the *affected applicants'* caches 🟡 Medium priority

**Symptom (found in code audit, 2026-07-01):** When a sponsor unsponsors a job, the applicants who had **matched** with (or liked) that job can still see the now-dead match/job on **their own** Matches screen for up to ~15s, and a tap can open a conversation that was just closed. The DB is correct (likes → `WITHDRAWN`, `job_postings` row deleted, conversations closed); the problem is purely a **cache-invalidation gap**.

**Root cause** (`services/jobs.py` → `unsponsor_job`, line 902): the post-transaction `invalidate(...)` clears the *sponsor's* view and the job-scoped keys —
```python
invalidate(
    f"job_active:{job_id}", f"sp_job:{job_id}",
    f"job_owner:{job_id}:{sponsor_id}", f"job_owner_any:{job_id}:{sponsor_id}",
    f"job_likes:{job_id}", f"sponsor_matches:{sponsor_id}",
    f"job_score_criteria:{job_id}",
)
```
…but it never invalidates the **per-applicant** keys for the users whose likes were just withdrawn:
- `job_matches:{applicant_id}` — the applicant's "Matched Opportunities" list (still shows the dead match)
- `liked_jobs:{applicant_id}` — the applicant's liked/applied list (still shows the job)
- `received_likes:{applicant_id}` — if the sponsor had also profile-liked them

All three use `TTL_SHORT = 15s`, so the stale window is ≤15s — but within it, a pull-to-refresh on the applicant's device still returns the phantom entry from Redis (the cache holds the fully-computed rows, so the deleted `job_postings` JOIN doesn't save us).

**Suggested fix:** collect the affected applicant IDs **before** withdrawing, then invalidate their keys after the transaction. `withdraw_likes_for_job` already runs inside the transaction, so capture the ids first:
```python
# before the transaction (or as the first step inside it)
affected = likes_q.get_user_ids_with_active_or_matched_likes_for_job(job_id)  # new helper
...
# after the transaction, alongside the existing invalidate(...)
for uid in affected:
    invalidate(f"job_matches:{uid}", f"liked_jobs:{uid}", f"received_likes:{uid}")
```
(`withdraw_likes_for_job` in `queries/likes.py:288` currently only invalidates `job_likes:{job_id}` — the per-user keys must be cleared by the caller since it doesn't know the user set.)

**Acceptance test:** Applicant A matches with sponsor S's job. S unsponsors it. Within 5s, A pulls to refresh their Matches screen → the match is gone immediately (not after a 15s wait), and the applicant's liked-jobs list no longer shows it.

**Frontend status:** The sponsor's own device is already handled — `JobsView.tsx → handleUnsponsor` invalidates the local `["matchesScreen"]` React Query cache on success. The applicant's device has **no live signal** at all (no push is sent on unsponsor), so it relies on focus-refetch / pull-to-refresh; once this backend cache gap is closed, that refresh returns clean data immediately. (Optional future enhancement: send a lightweight push to affected applicants on unsponsor so their screen updates without a manual refresh — not required for correctness.)

---

## §L — Unused profile fields — collected/stored but never read (onboarding rework, Phase 4) 🟢 Low priority (cleanup + PII minimization)

**Context (2026-07-01):** The onboarding/profile rework audited every field the applicant profile collects against the two things that actually consume profile data — the matching algorithm (`services/scoring.py`: skills, role, experience, location) and the sponsor-facing card (name, photo, title, bio, city/state, experience, education, certifications, languages, achievements, skills, insights, industry). Several collected fields feed neither.

**Findings — fields the product does not use:**

| Field | Backend column | Status |
|---|---|---|
| Portfolio URL | `user_profiles.PORTFOLIO_URL` | **Frontend UI removed** (ProfileView, Phase 4). Not scored, not shown on the card. Column now unwritten by the app. |
| Street address | address street | Not scored, not displayed (only city/state feed `LOCATION`). Frontend UI removal pending (coupled to the combined address editor — deferred until the onboarding branch is tested). |
| ZIP | `ZIP` | Same — unused, UI removal pending. |
| Country | address country | Same — unused, UI removal pending. |
| Phone number | `PHONE_NUMBER` | Collected historically; **no longer gated** (Phase 1) and not used by any feature (no call/SMS). UI still present. Product decision to keep for future contact/verification vs. drop. |
| Date of birth | `DATE_OF_BIRTH` | **Dead** — zero UI in the app (never collected or displayed). Column exists only. |
| LinkedIn | `LINKED_IN` | **Dead** — zero UI in the app. Column exists only. |

**Requested backend action (no rush; coordinate with the frontend cleanup):**
- These columns can be considered for **dropping** (or at least never requiring). This aligns with **§C** (account-deletion / PII minimization): `DATE_OF_BIRTH` in particular is sensitive PII that is collected nowhere and read nowhere, so retaining the column is pure liability.
- Do **not** drop anything the ATS-autofill (`services/autofill.py`) or resume-classify (`services/documents.py`) paths write to without checking those first.
- No endpoint contract changes are required for the frontend — `updateGeneralProfile` simply stops sending `portfolio_url` (and, once the UI is removed, `street`/`zip`/`country`). The fields remaining in the PATCH schema are harmless if unused.

**Frontend status:** Phase 4 removed the Portfolio field UI. The address street/ZIP/country fields and the (unused) phone field are documented here for a follow-up pass — deliberately deferred rather than ripped out of the tightly-coupled address editor before the onboarding branch has been run on-device.

---

# 🆕 New Features — Backend Support Needed

> This section is separate from the bug-fix tickets above (§B–§L). Those track things the backend already contracts for but doesn't do correctly; **this section tracks backend work for entirely new product features** proposed during the post-launch UX audit and its 5-phase improvement plan (safety/relief → pipeline visibility → retention → match-to-referral funnel → agency/growth). Entries are numbered **§N1, §N2, …** — independent of the §B–§L lettering above — and appended here as each phase is actually built, not speculatively written in advance.
>
> Note: "Phase 4" here refers to the UX improvement plan's **Phase 4 — Safety & Instant Relief**, unrelated to the onboarding-rework "Phase 4" referenced in §L above. Sorry for the overloaded term — two different efforts used the same phase-numbering habit.

## §N1 — Report a user / block a user (UX Plan Phase 4) 🔴 App Store requirement

**Why:** The app has messaging and user-generated content (bios, prompts, messages) but currently only offers **Unmatch** — no way to report abusive behavior or block a user from re-matching. Apple App Store Review Guideline 1.2 requires apps with user-generated content and person-to-person communication to provide (a) a mechanism to report objectionable content/users and (b) the ability to block abusive users. This is expected to gate submission review.

**Frontend status (shipped 2026-07-04):** The thread "..." menu (`components/MessagesView.tsx`) is now a two-step sheet — Report / Unmatch / Cancel, then a reason picker (harassment, spam, inappropriate, fake profile, other) with an optional detail field. Reporting always closes the conversation via the already-shipped `unmatchConversation` endpoint regardless of whether `/api/reports/` exists yet, so the user-visible safety outcome works today; the report call itself (`reportUser()` in `lib/api.ts`) is best-effort and logs a warning on failure rather than blocking the close. **Not yet built:** a report affordance on the public profile view (pre-match) — scoped out for now since reporting typically applies to people you've actually matched/communicated with.

### Requested backend support

```
POST /api/reports/                      (auth required)
  body: {
    reported_user_id: string,
    reason: string,            // enum: "harassment" | "spam" | "inappropriate" | "fake_profile" | "other"
    detail?: string,           // free text, optional
    conversation_id?: string,  // context, if reported from a thread
  }
→ 200 { message: string }
```

- Insert an audit row (new table, e.g. `moderation.reports`) capturing reporter, reported user, reason, detail, timestamp, and conversation context if present. No automated action required initially — manual review is acceptable for a closed beta.
- **Blocking**: reporting a user should also insert/flip a block relationship (or reuse/extend the existing unmatch mechanism) so:
  - Existing conversations between the two users close (mirroring what `unmatchConversation` already does).
  - Neither user can be shown to the other in future decks/matches (extend the like/match query exclusions the same way self-likes are excluded in §J).
- A **separate, lighter "Block" action** (no report reason required) may also be wanted so a user can silently block without filing a report — same backend relationship, just skip the reason/detail fields. Product call on whether both actions ship together or Report implies Block only.

### Acceptance test

User A reports/blocks User B from a conversation. B disappears from A's Matches/deck immediately (and vice versa), any open conversation between them closes, and the report row is queryable for manual review.

---

## §N2 — `GET /api/referrals/` doesn't return the current pipeline stage (UX Plan Phase 5) 🟡 Medium priority

**Why:** Referral check-ins are write-only today. `POST /api/referrals/<id>/checkin/` (applicant) and `POST /api/referrals/checkin/batch/` (sponsor) record a stage update (per `SponsorCheckInModal.tsx`'s own comment: *"Backend stores referrals in REFERRED/WITHDRAWN at row level; per-stage state lives in `matching.referral_checkins`"*), but `GET /api/referrals/` never reads that table back — it only ever returns the row-level `REFERRED`/`WITHDRAWN` status. So there is currently no way for a sponsor to see what stage an applicant self-reported, or vice versa.

This blocked building real "Your Pipeline" visibility, one of the highest-value items from the UX audit (referral status was found to be the app's most differentiated data and its most buried UI — previously visible only inside the check-in modals, never inline).

**Frontend status (shipped 2026-07-04, partial):** Added a visual pipeline stage timeline (`components/ui/PipelineStageTimeline.tsx`) inline on both the sponsor's "Active Pipeline" and the applicant's "Referrals Received" cards in `MatchesView.tsx`. Since the backend doesn't return the real stage, it's currently backed by a **client-side local mirror** (`utils/checkInStageCache.ts`) that remembers what stage *this device* most recently submitted, written by both check-in modals on successful submit. **This only reflects the submitting user's own last update — it does NOT show the other party's reported stage**, which is the actual point of a shared pipeline view. The Referral type's new `checkInStage` field already prefers a backend value (`CHECKIN_STAGE`/`checkin_stage`) over the local cache, so real data lights this up automatically the moment it ships — no frontend change needed.

### Requested backend change

Have `GET /api/referrals/` join the latest row from `matching.referral_checkins` per referral (ordered by created_at desc, limit 1) and include it in the response, e.g.:

```
{
  ...existing referral fields,
  "CHECKIN_STAGE": "Recruiter Screen",   // latest stage from referral_checkins, or null if none yet
  "CHECKIN_UPDATED_AT": "2026-07-03T18:22:00Z"
}
```

### Acceptance test

Applicant submits a check-in moving a referral to "HM Interview". Sponsor (on a different device/account) refreshes their Matches screen — the pipeline timeline for that referral now shows "HM Interview" as the current stage, without the sponsor having submitted anything themselves.

---

## UX Plan Phase 6 — Retention: no backend work needed

The original 5-phase plan assumed Phase 6 (daily-deck reminder, referral check-in nudges, unfinished-deck reminder) would need backend-scheduled push (cron + push payloads). On implementation, all three turned out to be fully solvable **client-side**, so there's no backend ticket here:

- **Daily deck reminder** — scheduled as an on-device **local** notification (`expo-notifications`' `DAILY` trigger type, not a server push) for 9am local time, right after push permission is confirmed granted. See `lib/localNotifications.ts`. The app already caches the applicant/sponsor deck per calendar day (`HomeView.tsx`'s `isSameDay` check), so a fixed local time is a safe bet that a fresh deck exists by then — no server round-trip needed to know that.
- **Unfinished-deck reminder** — a one-time local notification scheduled when the app backgrounds with cards still left in today's deck (`MainApp.tsx`'s `AppState` listener), canceled the moment the app returns to the foreground.
- **Referral check-in nudge** — an in-app banner on the Matches screen (not a push at all) surfacing referrals stuck at "Referred" for 7+ days, computed entirely from the already-fetched referrals list. See the `staleReferrals` memo in `MatchesView.tsx`.

Worth revisiting if a *server-triggered* push turns out to be wanted later (e.g. to reach users who've disabled the app's local-notification permission specifically but still have push enabled some other way — an edge case, since both share the same OS permission today).

---

## UX Plan Phase 7 — Match-to-referral funnel: no backend work needed (one design constraint discovered)

All three Phase 7 items (conversation starters, in-thread referral prompt, sponsor cold-start fix) shipped client-only. One real constraint surfaced while building the cold-start fix, worth recording:

- **Conversation starters** and **in-thread referral prompt** are pure client logic — templated openers built from data already on the conversation object (`MessagesView.tsx`'s `getConversationStarters`), and a message-count-based nudge toward the existing Refer button (`sponsorReferralPromptEligible`). No new endpoints.
- **Sponsor cold-start fix** — originally planned to show "We found N open roles at {company}" **during** the company question, mid-questionnaire. That's not possible with the current auth model: `GET /api/jobs/browse/` and `GET /api/ats/organizations/` (§G) both require auth, and a sponsor isn't registered until the *last* question of the questionnaire — there's no token yet, and no saved `sponsor_profiles.COMPANY` for the browse endpoint's server-side filter to key off of. Moved the role-picker to run **immediately after registration** instead (`SponsorQuestionnaire.tsx`, right after `setAuthTokens`), which is the earliest point it's actually possible — the practical outcome (exit onboarding with a live deck) is unchanged.
- The role-picker's `sponsorJob()` call uses a simplified insights payload (`insiderInsights` only, one optional text field) rather than the full 4-field wizard (`dayToDay`/`teamCulture`/`idealCandidate`/`insiderInsights`) the Jobs tab's sponsor flow collects. This is a **known quality tradeoff**, not a backend gap — sponsors can enrich the role's insights later from the Jobs tab. Flagging in case product wants the onboarding version to collect the same depth (would mean porting more of `JobsView.tsx`'s sponsor-flow UI into onboarding).

---

*(Further entries for later UX-plan phases — agency/growth — will be appended here as those phases are implemented.)*
