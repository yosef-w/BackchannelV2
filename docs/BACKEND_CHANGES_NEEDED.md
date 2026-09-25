# Backend Changes Needed

**Last updated:** 2026-09-23 (added **§Y** — real "unlimited" premium deck volume, not urgent, queued behind PREMIUM_ENABLED and server-side entitlement verification; added **§X** — two ready-to-apply fixes, written up instead of pushed as a branch: transactional-email deep-linking + résumé-parse timeout race)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§X** — two ready-to-apply fixes (🟠 medium, new, 2026-09-22), written up as full explanation + exact diff rather than pushed as a branch/PR since this is Nico's repo: transactional emails (verify/reset/welcome) link to the marketing website instead of deep-linking into the app, and a Daphne-proxy-timeout-vs-Anthropic-call race that produces false "resume couldn't be parsed" errors on requests that actually succeeded — see §X. **§W** — App Store submission alignment (🔴 high, new, 2026-09-22): the rewritten Privacy Policy/Terms going live at `backchannelapp.netlify.app` state things the backend has to keep true (résumé only after match → §V #1 is now launch-blocking), SSO-only accounts (Apple "Hide My Email") have no working path to delete their account (Apple 5.1.1(v)), and support/moderation email needs `Reply-To` + `MODERATION_ALERT_EMAIL` + Apple relay-domain registration — see §W. **§V** — security audit (🔴 high): a joint frontend+backend read-only audit ahead of App Store submission found no broken authorization or SQL injection (both clean), but the sponsor feed returns applicant phone/DOB/résumé before any match, uploaded images are public-read forever, and Django + a few libs are past their security-support window. Entirely backend-owned — see §V for the full breakdown and fix order. **§F** — feed relevance (🔴 high): signup answers barely shape what users see — the sponsored half of the applicant deck is `ORDER BY random()` and never scored, and the sponsor deck shows every applicant in the DB rather than candidates for the sponsored job (fix order in §F). **§S** — SSO (Apple + Google): **both sides are code-complete** — backend endpoints shipped on their `develop` (PR #152), frontend wired to the implemented contract behind `SSO_ENABLED = false`. What remains is config, not code: Apple/Google console credentials → backend env vars + frontend env vars, backend develop→main deploy, then flip the flag and EAS build (full checklist in §S). **§B** — confirm whether `GET /api/profile/` returns `BIO`; if not, add it (small, but it's silent user-visible data loss on re-login). **§L** — drop/ignore unused profile columns (street/ZIP/country/phone/DOB/LinkedIn — cleanup + PII minimization, low priority, coordinate timing with backend; do **not** drop `PORTFOLIO_URL`, it's still live).
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §W — App Store submission: keep the published policy true + SSO deletion + support email 🔴 High priority (new section, 2026-09-22 — for Nico)

**Status (2026-09-22):** frontend is on its final App Store readiness pass. Two things happened this week that create backend asks:

1. **The Privacy Policy and Terms were rewritten** (Bluejay Labs LLC, Texas) to describe *exactly* what the product does today, checked claim-by-claim against both repos. They're going live at `backchannelapp.netlify.app/privacy.html` and `/terms.html`, and the app now shows "By continuing, you agree to our Terms of Service and Privacy Policy" at every signup path. That turns a few current backend behaviors from "audit findings" into "statements we've publicly made to users" — those are items 1–2 below.
2. **A reviewer-style walk of every auth flow** found one flow a reviewer can't complete (item 3), and the App Store 1.2 (UGC) work on the frontend — Report/Block is now reachable from profile sheets, the job sheet, and the deck card, not just inside a thread — means reports will actually start arriving (items 4–5).

Nothing here is a redesign. Every item is a small, well-located change; file:line refs are against the backend checkout at `67ef0f9` (`fix/resume-parse-race-and-email-deep-links`).

> **Frontend side already done** (so nothing below is waiting on us): signup consent line; Report/Block entry points everywhere a person or posting is shown, all calling the existing `POST /api/reports/`; Sentry `attachScreenshot` off; Mixpanel IP-geolocation off; privacy manifest corrected; daily deck reminders made opt-out. The policy names **Anthropic as the only AI vendor** and **Resend as the email provider** — both matched what's in the repo/env as far as we could see; shout if either is wrong.

### 🔴 Must land before real applicants upload résumés (same timeline as launch)

1. **§V #1 is now a published promise, not just a finding.** The new policy says, in plain words: *"Your resume file is shared with a Sponsor once you and that Sponsor have matched."* That's what the app *displays* (the sponsor deck never renders `RESUME_DATA`, `PHONE_NUMBER`, or `DATE_OF_BIRTH`) — but `fetch_profile_pack` (`queries/profiles.py:224-231`) still puts all three into every card of `GET /api/profiles/pack/`, to any self-registered sponsor, with no work-email gate at the API layer. We can't word our way out of it (the truthful sentence would be "anyone who registers as a sponsor can pull your résumé contents before you match"). **Ask (unchanged from §V #1):** drop those three columns from the pack SELECT. `PHONE_NUMBER`/`DATE_OF_BIRTH` are never collected by the app anymore (§L), so nothing consumes them. **Acceptance:** a sponsor-token `GET /api/profiles/pack/` response contains no `RESUME_DATA`, `PHONE_NUMBER`, or `DATE_OF_BIRTH` keys; matched-profile endpoints unchanged.

2. **Two more policy statements to keep true (both already tracked, just linking them):** the policy says a Sponsor's **login email and work email are never shown to other users** → §V #9 (`sponsor_email` still returned to matched applicants by `/api/matches/`) needs to land or we soften that sentence. And the policy currently discloses, honestly, that **profile photos are on a public-link CDN** ("anyone with the exact link can view it") because of §V #2; when §V #2 ships (private + presigned), tell us and we'll tighten the wording.

### 🔴 Apple 5.1.1(v) — SSO-only accounts can't delete themselves

3. **`/api/account/delete/` is password-gated, and passwordless accounts have no working path.** `services/auth.py:607-610`: `if not users_q.has_password(user_id): return Result.bad_request(_NO_PASSWORD_MSG)`. The app's fallback for a `has_password:false` user is "Set a password first," which emails a forgot-password link to `data.personal.email`. For an Apple **Hide My Email** user that's a `@privaterelay.appleid.com` address — Apple only forwards mail from a sender domain registered under *Certificates, IDs & Profiles → Services → Sign in with Apple for Email Communication* (with SPF/DKIM), and nothing indicates `backchannel.app` is registered, so the email is silently dropped while the UI says "Check your inbox." Apple reviewers test exactly this (Sign in with Apple + Hide My Email → delete account). **Ask:** accept a fresh identity token as the re-auth for deletion when the account has no password. Proposed contract, mirroring what `/api/auth/sso/` already verifies:
   ```
   POST /api/account/delete/
   { "provider": "apple" | "google", "identity_token": "<fresh token>", "refresh_token": "<current>" }
   ```
   Same verification path as sign-in (must resolve to the *same* `sso_identities` row as the caller's `user_id`; reject otherwise), then the existing purge. Keep the password form for password accounts. Frontend will re-run `signInWithApple()` / `signInWithGoogle()` on tap and POST the token — no other UI change. **Also (ops, not code):** register the sending domain for Apple's private relay regardless — it's what lets *verification / reset / work-email* mail reach Hide-My-Email users at all, not just deletion. Related, frontend-side: after a reset-link password set, we'll flip `hasPassword` locally so the gate doesn't reappear.

### 🟠 Support & moderation email — reports are about to start arriving

4. **`MODERATION_ALERT_EMAIL` must be set in prod.** `django_bc/settings.py:279` defaults it to `""`; `services/email.py:112-119` then *silently skips* the operator alert and files the report with only a log line. `docs/API_REFERENCE.md:2386` promises reports are acted on within 24h (and we say so in App Review notes). With the new in-app entry points, real reports will land. **Ask:** set it in the DO app env to `support@backchannel.app` (Yosef is setting up MX for the domain — it has none today). Optional hardening: log at `warning` on startup in prod when it's unset, same pattern as the `EMAIL_HOST` hard-fail.

5. **Outbound mail invites replies to a no-reply address on a domain with no MX.** `DEFAULT_FROM_EMAIL` = `BackChannel <noreply@backchannel.app>` (`settings.py:262`), and four templates end with *"reply to this email — we'd love to hear from you"*: `templates/email/welcome.html:63`, `verify_email.html:44`, `verify_work_email.html:44`, `change_email.html:47`. Replies bounce. **Ask (pick one):** (a) add `reply_to=[settings.SUPPORT_EMAIL]` to the `EmailMultiAlternatives` in `services/email.py:31` with a new `SUPPORT_EMAIL` env (default `support@backchannel.app`), or (b) change the copy to "email us at support@backchannel.app". (a) is nicer. Either way the policy, Terms, and app all point at `support@backchannel.app` now.

### 🟢 Confirmations (no code expected, just a yes/no)

6. **Account purge removes push-token rows.** `delete_account` → `purge_q.delete_rows` (`services/auth.py:632`). The app does *not* call `unregisterDevice` before delete (it can't — the token is gone after). Please confirm the purge covers `devices` (else a deleted account keeps getting pushes — 5.1.1(v)).
7. **`notification_preferences` gates push *sending*, not just the in-app feed.** The app's Notification toggles PATCH `notification_preferences`; `services/notifications.py:create_notification` is documented as the gate. Confirm a disabled type suppresses the *push*, not only the feed row — a reviewer flipping a toggle and still getting the push reads as a broken setting.
8. **Snowflake Cortex autofill (`/api/autofill/`, `services/autofill.py`, Mistral Large 2)** — the mobile app never calls it, so the policy names Anthropic as the *only* AI provider and describes Snowflake as the database host. If a feature that hits Cortex ships (browser autofill, etc.), the policy has to add it *first*. Flagging so it doesn't slip.
9. **Job-search text** — if applicant search queries (`title`/`location` params on browse) are logged or retained server-side, tell us and we'll add "search history" to the policy; today it says analytics never receives them (true on the client).

**Fix order suggestion:** 1 → 3 → 4 → 5 → 6/7 (confirm) → 2 as its own items ship.

---

## §X — Two ready-to-apply fixes, written up here instead of pushed as a branch 🟠 Medium priority (new section, 2026-09-22 — for Nico)

**Why this is here instead of a PR:** these were worked out locally against a checkout of this repo while chasing down a couple of bugs, but since this repo is Nico's, they're written up as a full explanation + exact diff instead of a branch/PR — so it's his call whether to take them as-is, adapt them, or have his own AI regenerate the same fix from this description. Nothing has been pushed anywhere; the local branch these came from has been deleted.

### 1. Transactional emails link to the marketing website instead of deep-linking into the app

**Symptom:** the verification, password-reset, email-change, and work-email-verification links (and the welcome email's "Open BackChannel" button) all point to `{FRONTEND_URL}/<path>?token=...` — the marketing website. That site has no page to hand the token off to the app, so a user tapping the link lands on the website with nothing happening. The app-side routes (`app/verify-email.tsx`, `app/reset-password.tsx`) are already fully built to handle a token arriving via deep link — they just never receive one today.

**Fix:** add an `APP_SCHEME_URL` setting (defaults to the app's real custom scheme, `backchannelv2://`, so it works with zero deployment config changes) and switch the five affected links to use it instead of `FRONTEND_URL`. `FRONTEND_URL` is untouched and still used for the actual website and the operator report-queue link.

- **`django_bc/settings.py`** — add near `FRONTEND_URL` (~line 262):
  ```python
  # Custom URL scheme for deep-linking transactional email links (email
  # verification, password reset, welcome) directly into the mobile app
  # instead of the marketing website — see the BackchannelV2 app's app.json
  # "scheme" and app/verify-email.tsx / app/reset-password.tsx, which already
  # read `?token=` off whatever URL opened them. No trailing "/" — call
  # sites append the path directly (e.g. f"{APP_SCHEME_URL}verify-email?token=...").
  APP_SCHEME_URL = os.environ.get("APP_SCHEME_URL", "backchannelv2://")
  ```
- **`bc_microservices/services/email.py`** — swap `settings.FRONTEND_URL` for `settings.APP_SCHEME_URL` (and drop the leading `/`) in: `send_password_reset_email`'s `reset_url`, `send_welcome_email`'s `frontend_url` template var, `send_verification_email`'s `verify_url`, `send_email_change_verification`'s `verify_url`, `send_work_email_verification`'s `verify_url`. Five call sites total, same one-line change each: `f"{settings.FRONTEND_URL}/verify-email?token={token}"` → `f"{settings.APP_SCHEME_URL}verify-email?token={token}"` (and equivalent for the other paths).
- **`.env.example`** — document the new var next to `FRONTEND_URL`, with a one-line comment noting the default already matches `app.json`'s scheme.

**Acceptance:** a fresh signup's verification email link opens the app (not a browser) and lands on `app/verify-email.tsx` with the token populated; same for password reset.

**Known follow-up, not part of this fix:** `backchannelv2://` is a custom scheme, not a Universal Link (`https://...`) — fine for now, but a custom scheme fails silently if the app isn't installed (no "open in App Store" fallback the way a Universal Link gets). Not urgent, just flagging for whenever there's bandwidth to move to real Universal Links.

### 2. Résumé-parse false-failure race between Daphne's proxy timeout and the Anthropic call

**Symptom:** applicants intermittently get a "resume couldn't be parsed" error, but the résumé ends up correctly parsed/classified moments later anyway — the client is told it failed for a request that actually succeeded.

**Root cause:** Daphne's `--http-timeout` was `60s` (`Dockerfile`), under the `90s` read-timeout budget for the extraction call to Anthropic (`bc_microservices/services/documents.py`) and close to the `60s` classify budget. When a call took 60–90s, Daphne severed the client's connection and reported failure at the 60s mark, while the Django view kept running in its worker thread, finished when Anthropic responded, and unconditionally wrote the successful result to Postgres anyway. Compounding it: neither Anthropic client had `max_retries` set, so the SDK's default (2 retries) retries an *entire* 60–90s call on a plain read timeout — silently tripling worst-case latency and making the race against Daphne's timeout far more likely to fire.

**Fix:**
- **`bc_microservices/services/documents.py`** — add `max_retries=0` to both `anthropic.Anthropic(...)` constructions (`_extract_text_anthropic` and `_classify_text_anthropic`), so a slow call fails fast and predictably instead of silently retrying into a proxy timeout.
- **`Dockerfile`** — raise daphne's `--http-timeout` from `60` to `150`, clearing the 90s extraction budget (now tightly bounded since retries are off) with real margin for the base64/CDN-upload/DB-write work around it.
- **`docker-compose.yml`** — pass the same `--http-timeout 150` explicitly on the local dev command, so local runs match production instead of silently falling back to Daphne's own default.

**Verification note:** wasn't able to run the Django test suite when this was worked out (no local Python env at hand). Checked `bc_microservices/tests/test_document_parsing.py` by reading it directly — it doesn't assert on the Anthropic client's constructor kwargs, so `max_retries=0` shouldn't change any existing test's expected call shape, but this should still run through CI before merging.

**Frontend companion (already shipped, no backend dependency):** the frontend's own client-side timeouts were reconciled to match, plus a "harvest" mechanism so a request that outlives whatever timeout fires still gets its result picked up instead of leaving the UI stuck on a stale error.

**Not done, flagged separately:** the backend still collapses every résumé-parse failure — a genuinely corrupt file, a rate limit, a transient 5xx — into one generic message with no way for the client to tell retryable from terminal. Left alone since it changes the response contract; worth a follow-up if it comes up again.

---

## §Y — Premium: real "unlimited" daily deck volume 🟢 Not urgent — queued for whenever PREMIUM_ENABLED flips on for real (new section, 2026-09-23 — for Nico)

**Status/context:** `PREMIUM_ENABLED` is currently `false` — the whole subscription system is dark in the shipped app, so nothing below is needed yet. A frontend-only subscription audit this week found the Premium paywall's copy promised "unlimited swiping," but the code never actually delivered it — the "unlock more cards" button just rewound the same already-loaded 10-card deck, not a bigger or fresh one. That's been fixed on our side: the paywall now promises (and actually enforces) a **higher daily LIKE cap only** — 2/day free, 5/day Premium (`constants/config.ts`'s `DAILY_LIKE_LIMITS`, plus a new `lib/dailyLikeLimit.ts` persistent counter so it can't be reset by tapping "review again"). Nothing in this fix needs anything from you — flagging this section only for the *next* step, which does.

**What's still missing, purely a future nice-to-have, not required for launch:**

1. **Real dependency first — entitlement has to be backend-verifiable before this is safe to build.** Don't build a bigger deck on top of a client-supplied "is this user premium" flag — trusting the app's own claim here would let anyone fake premium deck volume the same way §V already flagged for server-mediated actions generally. This needs RevenueCat's REST API or a webhook receiver landing first — not a new ask, this is the same "server-side receipt validation" gap §V and §W already have on file.
2. **Once that exists, the simplest version:** have `GET /api/profiles/pack/` (sponsor deck) and the applicant job-pack endpoint return a larger batch — e.g. 30 instead of 10 — for a caller the backend has independently confirmed is Premium, rather than the app needing a whole new endpoint. A paginated "give me more" follow-up call is a reasonable v2 if a flat larger pack turns out not to be enough; not necessary to start with.
3. Whatever the real ceiling ends up being, it's still bounded by the actual pool of unseen candidates for that user — "unlimited" should mean "no artificial cap, real candidates only," never literally infinite.

**Fix order:** nothing to do right now. Whenever Premium goes live for real and there's appetite to grow the deck-size promise beyond the like-cap increase (which is already live and self-contained frontend-side), come back to item 1 first.

---

## §Z — Premium: real interest counts on browse rows, for honest social proof 🟢 Not urgent — same trigger as §Y (new section, 2026-09-24 — for Nico)

**Status/context:** The marketplace premium gate (`MarketplaceGateModal`) was rebuilt this week to sell the outcome rather than the rule — it now names the role and company, plays a request → review → introduction reel, and pulls live prices from RevenueCat. One conversion lever was deliberately left out because the data doesn't exist yet: **social proof on the gate** ("4 applicants requested a sponsor here this week"). We won't fabricate that number — it goes in only when it's real.

**What's needed, one field:** `GET /api/jobs/browse/` rows (applicant callers) gain an integer `REQUEST_COUNT_7D` — distinct applicants who have hit `POST /api/jobs/<job_id>/request-sponsor/` for that job in the trailing 7 days (for sponsored rows, the equivalent from `POST /api/jobs/like/` is fine, same field name). Zero is a valid value and the app hides the line below a small threshold, so no need to null it out.

**Fix order:** nothing until PREMIUM_ENABLED is on. The app already has the surface waiting — it's a one-line copy addition on our side once the field lands.

---

## §AA — Dev (staging) database has no ATS jobs and thin seed data — the jobs board is empty on `development` builds 🟠 Medium priority (new section, 2026-09-25 — for Nico)

**Status/context:** Since the CI/CD split, the app's `development` env (`.env.development`) points at `backchannel-dev` → the `BACKCHANNEL_DEV` Postgres, while `preview`/`production` point at `oyster-app` → prod. On a dev build the applicant Jobs tab now shows "No roles available", and both decks look sparse compared to a few weeks ago (when every build hit prod).

**Verified 2026-09-25** against `https://backchannel-dev-hl72i.ondigitalocean.app` with a throwaway `inttest_*@test.backchannel.local` applicant (deleted afterwards via `/api/account/delete/`, per the DEV_ENVIRONMENT.md convention):

- `GET /api/jobs/browse/` → `total_count: 0`. The marketplace reads `ats.silver_jobs`, and that table is empty on dev.
- `GET /api/jobs/pack/` → 10 rows, so the deck's *sponsored* `job_postings` side has something; the ATS side has nothing.
- `/api/health/ready/` is fine on both environments — this is a data gap, not an outage.

**Root cause (from the backend repo):** `scripts/ats_etl.py` (RapidAPI → `ats.silver_jobs`, every 12h) and `scripts/ats_staleness_purge.py` run as DigitalOcean **scheduled jobs on the prod app only**. Nothing ever populates `BACKCHANNEL_DEV`'s ATS table. Likewise the two seed commands (`seed_demo_data`, `seed_personas` — 12 applicants / 12 sponsors / 20 jobs) don't appear to have been run against dev, so the profile and sponsored-job pools are just whatever integration tests and manual signups left behind.

**Asks, cheapest first:**

1. **One-shot backfill now:** run `python scripts/ats_etl.py --max-pages 2` with the dev `POSTGRES_URL` so the board has real listings today. (Two pages keeps the RapidAPI quota hit small.)
2. **Seed the decks:** `python manage.py seed_personas --execute` (and/or `seed_demo_data`) against dev so applicants see sponsors, sponsors see applicants, and the sponsored-job flows have real rows.
3. **Keep it from drifting again:** add the `ats_etl` scheduled job to the `backchannel-dev` DO app too, on a lighter cadence (e.g. daily, `--max-pages 2`), plus the staleness purge. If RapidAPI quota is the concern, a nightly copy of `ats.silver_jobs` from prod → dev is an acceptable alternative — that table holds no user PII.

**Why it matters now:** the marketplace premium gate (§Z and the frontend's `fix/subscription-paywall-audit` branch) can only be exercised on a board with listings. Until dev has data, testing it means running a `preview` build against **prod** — every like/sponsor request/waitlist join from that testing lands in the real database.

**Frontend side:** nothing to change. The env split itself is correct; it just exposed that dev was never given its own data.

---

## §V — Pre-production security audit: backend-owned findings 🔴 High priority (new section — separate from §S/§B/§L/§F, tracked here for Nico)

**Status (2026-09-18):** a read-only security sweep across both repos, done ahead of App Store submission. Three parallel reviews (mobile frontend, Django backend, repo/CI hygiene) traced every ID-taking endpoint, the raw-SQL query layer, auth/session handling, file storage, and dependency freshness. **Overall backend grade: B.** The important context up front, so this doesn't read as "the backend is insecure" — it isn't:

> The reviewer specifically could **not** find an authorization (IDOR) hole anywhere traced — messaging checks participation on send/history/unmatch and the WebSocket consumer re-checks on connect, referrals/check-ins verify sponsor-or-applicant, every sponsor job mutation is scoped `WHERE JOB_ID = %s AND SPONSOR_ID = %s` plus a service-layer check, and profile updates are self-only. The raw SQL in `queries/` is parameterized throughout — every dynamic fragment is a placeholder, an `int()`-cast limit, or a hardcoded column whitelist. Passwords are bcrypt-hashed with a per-password salt; action tokens (reset/verify) are opaque, single-use, and hashed at rest. This is the stuff that actually gets apps breached, and it's done right.

**What's actually wrong is over-sharing data you already hold, not broken access control.** Findings below, grouped by severity, each with file:line from the current backend checkout.

### High

1. **Sponsor feed returns applicants' phone number, DOB, and full parsed résumé before any match.** `bc_microservices/queries/profiles.py:225-231` selects `PHONE_NUMBER`, `DATE_OF_BIRTH`, and `RESUME_DATA::TEXT` into `GET /api/profiles/pack/` (`services/profiles.py:316-357`, `views_profiles.py:186-191`). Authorization on that endpoint is only "you own this job" — and anyone can self-register as a Sponsor via `/api/register-sponsor/` with no work-email verification required to post a job. That combination lets anyone page the entire applicant pool and harvest phone + DOB + résumé contents at will. **Ask:** drop those three columns from `fetch_profile_pack`; surface contact info only after a mutual match (the app already has a match state to gate on). **Update 2026-09-22 → launch-blocking:** the published Privacy Policy now states the résumé is shared only after a match — see §W #1.

2. **Uploaded images are `ACL="public-read"` with no expiry — including résumé photos.** `bc_microservices/services/storage.py:45-51` writes images public-read and returns a permanent CDN URL; documents are correctly `ACL="private"` (`:72-78`). `services/documents.py:316-325` explicitly routes "a photo of a resume" down the *image* path, so it inherits the public-read behavior. A `get_presigned_url` helper already exists (`storage.py:134`) but nothing calls it. **Ask:** make image objects private and serve all user uploads (photos included) through short-lived presigned URLs, matching what documents already do. *Can't verify from the repo:* whether the DO Spaces bucket policy also allows listing — worth a manual check in the DO console.

3. **Django and three libraries are past their security-support window.** `requirements.txt:7` pins Django `5.1.7` (5.1.x's extended support window has closed; 5.2 is current LTS). Also stale: `requests==2.32.3` (2.32.4 fixed a netrc credential-leak CVE), `urllib3==2.3.0` (2.5.0 fixed redirect-handling issues), `djangorestframework-simplejwt==5.2.2` (predates the fix for tokens-remain-valid-for-deactivated-users, CVE-2024-22513). **Ask:** bump requests/urllib3/simplejwt now — all drop-in, no code changes expected — and schedule the Django 5.2 LTS upgrade before launch. No venv is set up in the local checkout to run `pip-audit` directly; worth adding as a CI step (see the CI/process items below) rather than a one-off local run.

### Medium

4. **Admin-login throttle keys on a spoofable header and fails open.** `bc_microservices/views_admin.py:24-37` reads the first `X-Forwarded-For` entry for its 10-attempt brute-force window; an attacker can set a fresh header per request and never trip it, and a cache error disables the throttle entirely rather than blocking. The regular API throttles already do this correctly via the trusted edge-IP header (`throttles.py:52-67`). **Ask:** reuse `_RealIPMixin`'s header order in the admin view; fail closed on cache errors.

5. **Registration reveals whether an email is already registered.** `services/auth.py:127-130` returns `"Email already in use"` on conflict, while login (`:280`), forgot-password (`:300`), and resend (`:506`) are all correctly generic. Registration is throttled 10/hour/IP, which limits but doesn't eliminate email enumeration. **Ask:** return a generic "check your email" response and resolve the actual conflict server-side / over email.

6. **Django's password validators are configured but never invoked.** `settings.py:199-212` lists `CommonPasswordValidator` etc., but the custom auth path (`services/auth.py:125-126`, `constants.py:27`) only checks length ≥ 8 — `"password1"` passes today. **Ask:** call `django.contrib.auth.password_validation.validate_password` in registration, reset, and change-password.

7. **Password change doesn't invalidate other sessions; JWTs are signed with `SECRET_KEY`.** `services/auth.py:369-377` only blacklists the *presented* refresh token and clears one cache key — access tokens live 1 day (`settings.py:123`) and every other device's refresh token stays valid after a password reset, so a stolen session survives the victim "fixing" it. Separately, `SIGNING_KEY = SECRET_KEY` (`settings.py:128`) means a leaked Django secret key is full account takeover across every user, not just a Django-internal risk. **Ask:** add a `token_version` (or `password_changed_at`) claim checked in `custom_jwt.py:25` so a password change kills all outstanding tokens; move to a dedicated `JWT_SIGNING_KEY` distinct from `SECRET_KEY`.

8. **Unauthenticated, unthrottled email sender.** `views_landing.py:132-163` (`join_waitlist`) emails any submitted address with no rate limit — a script can mail-bomb third parties from your sending domain and burn deliverability/sender reputation. **Ask:** add the existing `_AnonIPThrottle` base class, same pattern already used elsewhere.

9. **Sponsor's personal login email is returned to every matched applicant.** `queries/matches.py:139` selects `u.EMAIL AS sponsor_email` into `GET /api/matches/`. Nothing in the product surfaces or needs this. **Ask:** drop the column from the query.

10. **`seed_demo_data` has no environment guard and a hardcoded password.** `management/commands/seed_demo_data.py:26` (`DEMO_PASSWORD = "DemoPass123!"`) and `handle()` (`:1107`) runs against whatever database it's pointed at, with no `--execute`/prod check — contrast `seed_personas.py` (dry-run by default, random per-account passwords via `secrets.token_urlsafe`) and `purge_users.py` (properly gated). If this was ever pointed at prod, that's ~20 accounts with a publicly-known password sitting in the production database today. **Ask:** add a guard refusing to run when the environment is prod; as a one-time check, query prod for any `@demo.backchannel.app` accounts and remove them if found.

11. **Unthrottled notification fan-out.** `views_jobs.py:446-449` (`request_sponsor`) has no throttle class and background-notifies every sponsor at a company (`services/jobs.py:1140-1180`); it's idempotent per (user, job) but not rate-limited across jobs, so iterating job IDs can spam a company's sponsors. **Ask:** add a `_UserThrottle` scope, same pattern as the other write endpoints.

12. **Chat access token accepted via WebSocket URL query string — needs a coordinated frontend change.** The consumer authenticates from `?token=`, and the app currently connects with `${WS_BASE_URL}/ws/chat/${id}/?token=${accessToken}` (frontend: `components/MessagesView.tsx:549, 728`). Full JWTs in URLs land in load-balancer/proxy access logs in ways headers don't, and a logged token is a session-takeover risk. **Ask:** support accepting the token via the `Sec-WebSocket-Protocol` header (or issue a short-lived, single-use socket ticket via a small new endpoint) so the frontend can stop putting it in the URL — this needs to ship on your side first since the frontend can't switch until the backend accepts the new mechanism.

### Low / Info

- **OpenAPI spec + Scalar docs are public** (`django_bc/urls.py:78-86, 122-123`) — not a vulnerability, but it hands anyone your full endpoint map. Consider gating behind admin auth in prod.
- **`ALLOWED_HOSTS` defaults to `localhost,127.0.0.1`** (`settings.py:46-49`) — fails safe, but confirm it's actually set in the DO app config, or every prod request 400s.
- **Emails logged at INFO** (`services/email.py:36, 74, 91, 151, 168`) — addresses land in container logs. No tokens, passwords, or message bodies were found logged anywhere.
- **Sentry `traces_sample_rate=1.0`** (`settings.py:550`) — a cost concern, not security; `send_default_pii=False` is already set correctly.
- **Legacy JWT dual-read still enabled** — `ACTION_TOKEN_DUAL_READ` defaults true (`settings.py:63-64`); the migration window this supported is long past. Flip to false and delete `_verify_email_legacy`/`_reset_password_legacy` (`services/auth.py:335, 485`).
- **Logo.dev token embedded in returned/stored URLs** (`services/logos.py:86`) — almost certainly a publishable key already (§ elsewhere in this doc discusses the same key), but worth a one-line confirmation.

### Repo / CI / process (same audit, backend-repo-owned)

- **`.github/workflows/integration.yml:15-61`** runs on `pull_request` into `main` and passes `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `TEST_BYPASS_SECRET` into a 732-line shell script checked out from the PR branch head. Fork PRs don't receive secrets (GitHub's default), so this isn't a classic pwn-request, but any same-repo branch PR — including from a compromised contributor account — executes arbitrary shell with the dev admin password in its environment. **Ask:** gate the job behind a GitHub Environment with required reviewers (or switch to `workflow_dispatch`); confirm `ADMIN_PASSWORD` is scoped to the dev deployment only (it appears to be) and rotate it periodically regardless.
- **No dependency or secret scanning configured** — no Dependabot, no CodeQL, no `pip-audit` step anywhere in CI. This is the same gap that let an old frontend API key sit unrotated in git history (see the frontend repo's own audit trail) — worth closing on both repos, not just this one. **Ask:** enable Dependabot for the `pip` and `github-actions` ecosystems on this repo; add a `pip-audit -r requirements.txt` step to `unit.yml`.
- **Dev Redis published on `0.0.0.0` with no password** — `docker-compose.yml:3-10` maps `"6379:6379"` with no `requirepass`; Docker publishes to all interfaces by default, so on a shared network anyone can reach the dev cache. Local-dev only, no prod exposure. **Ask:** bind `127.0.0.1:6379:6379` or drop the port mapping entirely (the `web` service already reaches it over the compose network).

**Ask, in leverage order:** (1) strip phone/DOB/résumé from the sponsor feed query — smallest change, largest exposure closed; (2) make image uploads private + presigned; (3) bump requests/urllib3/simplejwt now, plan the Django 5.2 move; (4) the medium hardening items (5–11) as time allows, roughly in the order listed; (5) the WebSocket token mechanism (#12) whenever it's convenient to coordinate — the frontend is already aware and waiting on this side.

**Frontend status:** the frontend-owned findings from the same audit (WebView URL whitelisting, unchecked `Linking.openURL` on other users' URLs, iOS privacy manifest, a few logging/config items) were fixed directly in the frontend repo and aren't tracked here. The only two items above that need frontend coordination are #12 (WebSocket token) and, longer-term, moving password-reset/email-verification links from the `backchannelv2://` custom scheme to real Universal Links — not urgent, noted for whenever backend has bandwidth to emit `https://` links instead.

---

## §S — SSO sign-in (Apple + Google) ✅ Both sides built — remaining: credentials/env config + deploy

**Status (2026-08-07): backend SHIPPED both endpoints** (their PR #152, `feat/sso-apple-google` → `develop`, commit `04c2bea`, with a frontend handoff at their `docs/FRONTEND_SSO_HANDOFF_2026-08-04.md`) — `POST /api/auth/sso/`, `POST /api/auth/complete-onboarding/`, migration 029 (`user_sso_identities` + nullable `password_hash`), password-gated flows returning 400 for passwordless accounts, and Apple revoke-on-delete. The frontend (branch `feature/sso-apple-google`) is wired to the **implemented** contract, verified against their actual `services/sso.py` rather than the proposal: `has_password` handling + "Set a Password" UX, Apple `authorization_code` forwarded on every sign-in, capitalized `role` values, and `register-sponsor`-matching sponsor field conversions (an earlier note here guessed those were free-text strings — wrong; booleans + `"yes"`/`"no"`, matching what `createProfile()` already sends).

**Remaining launch checklist (nothing left to code on either side):**

1. **Backend/ops:** merge `develop` → `main` and deploy — SSO is live on dev (`https://backchannel-dev-hl72i.ondigitalocean.app`, returns 503-per-provider until creds are set) but **not on production**.
2. **Admin (Apple): ✅ done (2026-08-08)** — the Sign in with Apple `.p8` key exists (key ID `96LV7XHDB4`, in the admin's local Downloads, deliver to backend via a private channel — never commit it), and `app.json` has `usesAppleSignIn: true` so EAS manages the App ID capability + entitlement at build time. Remaining is only the handoff: backend env vars `APPLE_BUNDLE_ID` + `APPLE_TEAM_ID` (`ZWFR8LC25W`) / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` — and the key trio is only for revoke-on-delete, so Apple sign-in itself can go live with just the bundle ID set.
3. **Admin (Google):** create iOS/Android/Web OAuth client IDs in Google Cloud Console. Feeds backend `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated, web ID is the token `aud`) and the frontend `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars; the iOS ID's reversed form also goes into app.json's google-signin plugin as `iosUrlScheme`.
4. **Frontend:** set the env vars from #3, then EAS build (native modules + entitlement must ship in a real build; the config plugin `plugins/withGoogleSigninModularHeaders.js` already handles the Podfile patch on every prebuild). ~~Flip `SSO_ENABLED = true`~~ — **done 2026-08-19**, committed on `main`; the next build ships with SSO buttons rendering, so sequence the backend deploy (#1) before or alongside that build.
5. **E2E test against dev first** — their handoff's §5 has the recipe; test users land in `BACKCHANNEL_DEV`, never prod.

---

## §F — Feed relevance: signup answers barely shape the decks 🔴 High priority (core product — sponsored jobs unscored, sponsor deck unscoped)

**Status (2026-09-18):** traced end-to-end against the local backend checkout after a founder question ("if someone says they want to be a software engineer, do we show them those roles?"). Short answer: only weakly, and not for the part of the product that matters. Nothing is wrong on the frontend side — it sends no filters and renders server order — so this is entirely a backend item.

**What the frontend sends:** `GET /api/jobs/pack/` with **no params** (`lib/api.ts:471`); `GET /api/profiles/pack/?job_id=<sponsored JOB_ID>` with only that one param (`lib/api.ts:808`). All personalization is expected server-side. The applicant questionnaire does collect the right inputs and persists them via `PATCH /api/profile/applicant/update/` — `positions` (the "What position are you seeking?" answer), `skills`, `industry`, `current_role`, `work_preferences`, plus `location` via `updateGeneralProfile` (`ApplicantQuestionnaire.tsx:995-1024`).

**What the backend actually does:**

1. **Applicant deck — sponsored jobs are never scored.** `services/jobs.py:551 get_job_pack` pulls two pools, both `ORDER BY random()` with no profile predicate (`queries/jobs.py:454-459` ATS, `:789-818` sponsored; the only filters are active/not-blocked/not-in-`job_feed_history`). It oversamples ~30, then **scores only `ats_raw`** (`services/jobs.py:574-584`) — `spn_raw` is truncated in random order and interleaved ~50/50 (`:589-607`). So roughly half of every deck — the sponsored jobs, i.e. the referral product — is pure random relative to what the user asked for.
2. **Applicant deck — ranking is a re-sort of a random window, not a filter.** `services/scoring.py` (skills 40 / experience 20 / role 20 / location 10 / recency 10) reads `SKILLS, YEARS_EXPERIENCE, current_role, DESIRED_ROLES, WORK_PREFERENCES, LOCATION` (`queries/profiles.py:341`) — but it can only reorder the ~30 rows `random()` happened to return. A strong-fit job outside that window never surfaces. Scoring failures fall back silently to unranked (`services/jobs.py:571-572`).
3. **Sponsor deck — not scoped to the job at all.** `queries/profiles.py:213 fetch_profile_pack` has no predicate on the sponsored job's title/skills/location or the sponsor's company; `job_id` is used only for the `matching.likes` liker flag (`:239-241`). Order is likers-first, then **primary key** (`:248`). `services/profiles.py:329-344` applies scoring only when the pool exceeds the page limit. Net: a sponsor sponsoring a PM role swipes through every applicant in the database.
4. **Browse/search/likes are unranked.** `/api/jobs/browse/` is newest-first with no profile pre-fill (`services/jobs.py:788`, `queries/jobs.py:658`); `/api/jobs/<id>/likes/applicants/` has no score, so the app's "Top Applicants" is just an unordered likes list.

**Collected but read by no feed/matching query** (distinct from §L — these should be *wired in*, not dropped): applicant `INDUSTRY`, `RANGE_MILES`, `WILLING_TO_RELOCATE`, `REQUIRES_SPONSORSHIP`, `INSIGHTS`, `RESUME_DATA`; sponsor `COMPANIES_CAN_REFER_TO`, `JOB_TITLE`, `REFERRAL_ELIGIBLE`, `OPEN_TO_REFERRALS`. `COMPANIES_CAN_REFER_TO` is the notable one — it's the field that most directly encodes which jobs a sponsor can actually refer into, and nothing reads it (`services/profiles.py:237, 318` write/display only). Sponsor `COMPANY` is the only sponsor field that shapes any query, and only for their own job-browse tab (`services/jobs.py:800`).

**Ask (in leverage order):**
1. **Score `spn_raw` too** — pass the sponsored pool through the same `services/scoring.py` path at `services/jobs.py:574-584` before interleaving. Smallest change, fixes the half of the deck that's currently random.
2. **Scope the sponsor deck to the job** — add title/skills/location predicates to `fetch_profile_pack` from `queries/jobs.py:248 get_job_scoring_criteria`, so sponsors see candidates for the role they sponsored, not the whole table. (`docs/ARCHITECTURE.md:465`'s "finite pool" note still applies — scoping shrinks the pool further, so pair with the replenishment redesign it describes.)
3. **Filter in SQL, not just re-sort in Python** — push at least skills/title predicates into the applicant pack `WHERE` (or widen the oversample) so a good fit isn't lost to the random-30 window.
4. **Emit `relevance_score` consistently.** `docs/API_REFERENCE.md:694, 708` documents a 0–1 score on pack cards; jobs never emit it (`services/jobs.py:615`) and profiles emit 0–100 (`profiles.py:337`), and `docs/FRONTEND_WIRING_GUIDE.md:643` says the opposite. Pick one contract — the app renders a "YOUR FIT — N% match" badge from `relevanceScore` (`types/jobs.ts:369`, `components/home/JobCardContent.tsx:119`), so today that badge is either absent or a client-side skill-overlap figure, not the server's ranking.

**Frontend status:** nothing to change for #1–#3 — the app renders whatever order the server returns and the "YOUR FIT" plate already computes skill overlap locally (`components/home/plates/plateContent.ts:477`). If #4 settles on the server emitting a 0–100 score for jobs, the frontend should drop the local overlap fallback and display the server value. One open question worth answering on-device before then: what the "YOUR FIT — N%" badge actually shows a user right now.

---

## §B — `GET /api/profile/` doesn't return `BIO` — bio can't round-trip 🟠 Medium priority (silent user-visible data loss)

**Status (2026-08-09):** needs a one-line confirmation against the live API, then (if confirmed) a small serializer fix.

**What the frontend observes:** `PATCH /api/profile/update/` accepts and stores `bio` (sponsor onboarding and the profile editor both save through it successfully), but the profile the app reads back via `GET /api/profile/` does not appear to include a `BIO` field — the frontend's response type declares it (`lib/auth-api.ts`) and the store maps it (`stores/useUserProfileStore.ts` → `professional.summary`), but a long-standing code comment there says the field never actually arrives, and the mapping only works today because it falls back to the locally cached value.

**User-visible consequence if confirmed:** the bio survives only in on-device AsyncStorage. Any fresh context — logout → login, reinstall, new device — shows an empty bio even though the server has one stored. The user then either re-types it or (worse) assumes the app lost their data. Photo does NOT have this problem (`PHOTO_URL` round-trips fine); bio is the only affected field found in the 2026-08-09 end-to-end profile-pipeline audit.

**Ask:**
1. Confirm whether the `GET /api/profile/` serializer includes `BIO` for both roles.
2. If missing, add it (same casing convention as the response's other columns, e.g. `PHOTO_URL`).
3. No frontend change needed afterward — the mapping (`summary: profile.BIO || existing…`) is already in place and will simply start receiving real data.

---

## §L — Unused profile fields — collected/stored but never read 🟢 Low priority (cleanup + PII minimization)

**Context (updated 2026-07-08 against the current codebase):** The onboarding/profile rework audited every field the applicant profile collects against the two things that actually consume profile data — the matching algorithm (`services/scoring.py`: skills, role, experience, location) and the sponsor-facing card (name, photo, title, bio, city/state, experience, education, certifications, languages, achievements, skills, insights, industry). Several collected fields feed neither.

**Findings — fields the product does not use:**

| Field | Backend column | Status |
|---|---|---|
| Street address | address street | **UI removal complete.** `EditProfileScreen.tsx` and `ApplicantQuestionnaire.tsx` now only collect a single "City, State" location field — confirmed no street/ZIP/country editor exists anywhere in the app. Safe to drop. |
| ZIP | `ZIP` | Same as street — UI removal complete, safe to drop. |
| Country | address country | Same as street — UI removal complete, safe to drop. |
| Phone number | `PHONE_NUMBER` | **UI removal complete.** No phone input exists anywhere in `ProfileView`, `EditProfileScreen`, or either questionnaire — confirmed via full-app search, zero hits. Not used by any feature (no call/SMS). Safe to drop. |
| Date of birth | `DATE_OF_BIRTH` | **Dead** — zero UI in the app (never collected or displayed). Column exists only. |
| LinkedIn | `LINKED_IN` | **Dead** — zero UI in the app. Column exists only. |

**Portfolio URL is NOT in this list — it's still live, do not drop `PORTFOLIO_URL`.** A candidate's portfolio link is read and displayed to sponsors in the referral flow (`components/messages/ReferralFlowModal.tsx`'s candidate review screen), and `lib/auth-api.ts` still forwards it to the backend whenever it's populated by resume-classify/ATS-autofill. An earlier version of this doc incorrectly listed it as dropped/unused — corrected here.

**Requested backend action (no rush; coordinate with the frontend cleanup):**
- The six columns above can be considered for **dropping** (or at least never requiring). This aligns with **§C** (account-deletion / PII minimization): `DATE_OF_BIRTH` in particular is sensitive PII that is collected nowhere and read nowhere, so retaining the column is pure liability.
- Do **not** drop `PORTFOLIO_URL` — see above.
- Do **not** drop anything the ATS-autofill (`services/autofill.py`) or resume-classify (`services/documents.py`) paths write to without checking those first.
- Dropping these columns is safe against the current PATCH payload — `lib/auth-api.ts → updateProfile()` no longer sends `phone_number`/`street`/`zip`/`country` at all (frontend cleanup shipped alongside this doc update), so there's nothing left going out that would clobber the columns with blanks or need accommodating.

**Frontend status:** both the UI (address editor, phone input — confirmed no editor exists anywhere in the app) and the outgoing payload for these four fields are fully removed. Nothing pending on the frontend side for this item.

---

# 🆕 New Features — Backend Support Needed

> This section tracks backend work for entirely new product features proposed during the post-launch UX audit and its 5-phase improvement plan (safety/relief → pipeline visibility → retention → match-to-referral funnel → agency/growth). **§N1** (report/block, Phase 4) and **§N2** (referral check-in stage, Phase 5) both shipped — see the backend's `KNOWN_ISSUES.md` "Recently fixed" for details. Remaining entries below are the phases that needed no backend work at all.

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

## UX Plan Phase 8 — Agency & growth

Phase 8's applicant job browse (**8.1**) is merged to main — `components/ApplicantJobsBrowseView.tsx`, reachable from the Jobs tab (no longer sponsor-only); its backend question (**§R**) shipped 2026-07-21 and is wired frontend-side. The share-a-job item (8.2) was descoped by product.

- **8.3 — Sponsor-request follow-through** — the "N employees notified" message a sponsor-request returns is never persisted server-side, so (same shape as §N2's check-in-stage gap) it's mirrored client-side (`utils/sponsorRequestCache.ts`) and shown later on the Waitlisted-job detail in `MatchesView.tsx`, plus a "Nudge again" button that re-sends the request once a waitlisted job has gone 5+ days without being picked up. This is a client-only local mirror with the same limitation as §N2 — it only reflects what THIS device requested, not a durable record. No backend ticket filed for this one since the existing `request-sponsor` endpoint already supports being called again (re-notifying), which is all "nudge again" needs.

---

*(Further entries for later UX-plan phases — agency/growth — will be appended here as those phases are implemented.)*
