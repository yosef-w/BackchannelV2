# Backend Changes Needed

**Last updated:** 2026-06-18
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§C** — account deletion must erase user data (App Store blocker, top priority); **§B** — act on the captured unsponsor reason (low priority); the **email deployment checklist** at the bottom (env config, not code); and **`change_email`** (still returns 501 — the app hides the change-email UI until it ships; re-enable on the app side then).
>
> Shipped items have been removed to keep this lean — the verify-email / reset-password web pages (PR #67, shipped as server-rendered web pages) and §1–§11 + push (PRs #54–#61). See the backend's [`BACKEND_CHANGES_SHIPPED.md`](../../Backchannel-backend/BackChannel-backend/docs/BACKEND_CHANGES_SHIPPED.md) for the record.

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
4. **End-to-end smoke test** against the deployed backend: register → verification email arrives → link opens the backend's web verify page and confirms; then forgot-password → email → reset on the web reset page → sign in with the new password. `services/email.py` logs `Email sent to <addr>` vs `Failed to send email to <addr>` to tell SMTP outcomes apart.
