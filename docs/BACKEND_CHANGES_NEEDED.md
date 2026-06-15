# Backend Changes Needed

**Last updated:** 2026-06-10
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Housekeeping (2026-06-10):** all previously-tracked items have shipped and were removed from this doc — §1–§11 and the push-notification recommendation landed in PRs #54–#61 (see [`BACKEND_CHANGES_SHIPPED.md`](../../Backchannel-backend/BackChannel-backend/docs/BACKEND_CHANGES_SHIPPED.md) for the record). What remains: one **new launch-blocking item** (§A, from the 2026-06-10 pre-launch audit), the unshipped half of the unsponsor-reason work (§B, formerly §12), and the email-deployment verification checklist (now expanded to include `FRONTEND_URL`).

---

## §A — Web fallback pages for verify-email and password-reset links 🔴 Launch blocker

**Frontend files:** `app/verify-email.tsx` (existing), `app/reset-password.tsx` (new, shipped 2026-06-10 on `fix/launch-blockers`)
**Backend files:**
- `bc_microservices/templates/landing/` → new `app_link.html` template
- `bc_microservices/views_landing.py` → two new page views
- `django_bc/urls.py` → two new routes

### The problem

The transactional emails link to web URLs that don't exist anywhere:

- `services/email.py:45` → password reset: `{FRONTEND_URL}/reset-password?token=<JWT>`
- `services/email.py:77,108` → email / work-email verification: `{FRONTEND_URL}/verify-email?token=<JWT>`

Two failures compound here:

1. **No pages exist at those paths.** The Django service serves only the landing page at `/`; `/verify-email` and `/reset-password` 404. The mobile app *does* handle `backchannelv2://verify-email?token=…` and `backchannelv2://reset-password?token=…` deep links, but email clients can't open custom-scheme links directly — the emails must link to https URLs, which means something on the web has to receive the click and bounce the user into the app.
2. **`FRONTEND_URL` defaults to `http://localhost:3000`** (`settings.py:219`) and is likely unset in the deployed environment — so even the (dead) links currently point at localhost.

Net effect: **every tester who registers gets a verification email with a dead link, and anyone who forgets their password is locked out.** This is the first flow every new user hits.

### Required change

Serve two small GET pages on the existing Django service that forward the token into the app via its custom scheme (`backchannelv2`, per the app's `app.json`):

```
GET /verify-email?token=<JWT>     → bounce page → backchannelv2://verify-email?token=<JWT>
GET /reset-password?token=<JWT>   → bounce page → backchannelv2://reset-password?token=<JWT>
```

Each page should:
- Attempt an automatic redirect to the deep link (a short `setTimeout` + `window.location.href` — browsers sometimes block non-user-initiated custom-scheme navigations).
- Show a prominent **"Open in BackChannel"** button as the reliable tap-to-open path.
- Include a hint for the app-not-installed / opened-on-desktop cases ("re-open this link on your phone").
- **Strictly percent-encode the token** before interpolating it into the deep link (`urllib.parse.quote(token, safe='')`), so the resulting URL contains no characters needing HTML/JS escaping. Never reflect the raw query value into the page.

Suggested shape (paths chosen to match the email URLs exactly — note **no trailing slash**, so the existing email templates need zero changes):

```python
# views_landing.py
APP_SCHEME = 'backchannelv2'

def _app_link_page(request, app_path, title, description):
    from urllib.parse import quote
    token = request.GET.get('token', '')
    deep_link = f"{APP_SCHEME}://{app_path}?token={quote(token, safe='')}"
    return render(request, 'landing/app_link.html', {
        'title': title, 'description': description, 'deep_link': deep_link,
    })

def verify_email_page(request):
    return _app_link_page(request, 'verify-email', 'Verify your email', '…')

def reset_password_page(request):
    return _app_link_page(request, 'reset-password', 'Reset your password', '…')
```

```python
# urls.py
path('verify-email', verify_email_page, name='verify_email_page'),
path('reset-password', reset_password_page, name='reset_password_page'),
```

Plus a single shared `landing/app_link.html` template (BackChannel-branded card, auto-redirect script, open button).

### Deployment prerequisite (no code)

Set **`FRONTEND_URL`** in the deployed backend environment to the service's own public origin (e.g. `https://oyster-app-4pg5w.ondigitalocean.app`) so the emails link to these new pages. Until this is set, emails link to `localhost:3000` regardless of the code change.

### Frontend impact (when this ships)

None — both deep-link targets are already implemented and registered in the app's router:
- `backchannelv2://verify-email?token=…` → existing verify screen (calls `POST /api/auth/verify-email/`).
- `backchannelv2://reset-password?token=…` → new reset screen (calls `POST /api/reset-password/` with `{token, newPassword}`; expects the existing 15-minute token expiry and surfaces expired-token errors with a "request a new link" hint).

### Future improvement (not for this pass)

Proper universal links (iOS `associatedDomains` + AASA file, Android App Links) would open the app directly from the email with no bounce page. That requires coordinated app + infra work; the bounce page is the right v1 and remains the fallback for app-not-installed even after universal links ship.

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

1. **`FRONTEND_URL`** is set on the backend host to the service's public origin (see §A). Default is `http://localhost:3000`, which silently produces dead links in every verification and reset email.
2. **SMTP env vars are set** on the backend host: `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`. If `EMAIL_HOST` is unset, `settings.py` silently falls back to the **console email backend** — every "sent" email is merely printed to the server log; `send_mail` still reports success. This affects *all* transactional email (welcome, verification, work-email verification, password reset). Resend values, per `.env.example`:
   ```
   EMAIL_HOST=smtp.resend.com
   EMAIL_HOST_USER=resend
   EMAIL_HOST_PASSWORD=re_YourApiKeyHere
   ```
3. **The sending domain is verified in Resend.** `DEFAULT_FROM_EMAIL` defaults to `noreply@backchannel.app` — Resend rejects mail from an unverified domain.
4. **End-to-end smoke test** against the deployed backend: register → verification email arrives → link opens the §A bounce page → app opens and verifies; then forgot-password → email → reset in app → sign in with the new password. `services/email.py` logs `Email sent to <addr>` vs `Failed to send email to <addr>` to tell SMTP outcomes apart.
