# Backend Changes Needed

**Last updated:** 2026-10-16 (second reconciliation, against backend PRs #167–#200 + `docs/FRONTEND_HANDOFF_2026-10-16_PRELAUNCH.md`, all live in prod: §X #2, §Y #1, §AB #1, §F #1/#2/#4, §V #3/#4/#6/#7/#8/#9/#10/#11/#12 and the CI items are DONE and removed; our answers to Nico's open questions are in the block below)

**Earlier:** 2026-10-15 (reconciled against Nico's 2026-10-13 batch, backend PRs #157–#165, verified live in production: §W #1/#3/#5/#6/#7, §AD #1/#3/#4/#5a/#5c/#7, §V #1, §B and §S are DONE and removed; §W #2 folded into §V #2/#9; what's left in §W/§AD is ops config + the smaller items)

**Previous update:** 2026-09-27 (added **§AE** — pulled the `backchannel.it.com` universal-link checklist and the support-email domain decision out into their own section addressed to Nico specifically, so they don't get missed; added **§Y** — real "unlimited" premium deck volume, not urgent, queued behind PREMIUM_ENABLED and server-side entitlement verification; added **§X** — two ready-to-apply fixes, written up instead of pushed as a branch: transactional-email deep-linking + résumé-parse timeout race)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items (2026-10-16):** **Ops, launch-blocking** — `MODERATION_ALERT_EMAIL` and `REVENUECAT_WEBHOOK_SECRET` in the DO prod env (§W #4, §Y #1), MX/SPF/DKIM on the support domain (§AE #2, Yosef), confirm prod `FRONTEND_URL` (§AB #2). **§AE #1** AASA on `backchannel.it.com`. **§V** — only #2 (profile photos still public; résumé photos done) and #5 (answered below: keep as-is) remain, plus the Low/Info list. **§F #3** SQL-side filtering + flipping `FEED_SCOPE_SPONSOR_DECK` in prod. **§AD** #1/#2/#3/#4/#5/#6. **§X #1 / §AB #2** are the same ops item. **§Y #2/#3, §Z, §AC, §AA, §L** post-launch.
>
> **Answers to the questions in your 2026-10-16 handoff (so you're unblocked):**
> 1. **§V #5 registration enumeration — keep as-is for launch.** The explicit "email already in use" is better UX for a cold-start product, registration is already throttled 10/h/IP, and App Review doesn't require the generic response. Revisit post-launch.
> 2. **`viewed`-on-top-card — handled on our side.** The app no longer writes `viewed` to the feed history when a card merely becomes current; pass/like/waitlist each record their own action at swipe time, so an unswiped card comes back next open. Nothing to change on the backend; the 14-day decay stays.
> 3. **Password-validator error copy — accepted as-is**; the app shows `error` verbatim.
> 4. **Change-password tokens, WebSocket subprotocol, rotated refresh token — all done in the app** (branch `fix/refresh-rotation-and-asks-cleanup`, ships in 1.0.2). `?token=` can be removed once that build is the floor; we'll tell you.
> 5. **RevenueCat webhook — created 2026-10-16** (RevenueCat integration `whintgr7b322042ad`, URL `https://oyster-app-4pg5w.ondigitalocean.app/api/webhooks/revenuecat/`, all environments/events). Yosef will send you the Authorization value privately; set it as `REVENUECAT_WEBHOOK_SECRET` in the DO prod env, then "Send test event" in the RevenueCat dashboard should return 200.
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §W — App Store submission: what's still open after the 2026-10-13 batch 🟠 Ops + confirmations (section trimmed 2026-10-15)

**Done and live in prod (removed from this list):** #1 pre-match PII stripped from `GET /api/profiles/pack/` (backend #157, SQL-inspection + response tests); #3 SSO step-up re-auth on `POST /api/account/delete/` accepting `{provider, identity_token, refresh_token?}` exactly as the app sends it (#158; 403 if the token belongs to another account, 503 if the provider is down); #5 `Reply-To: SUPPORT_EMAIL` on every outbound mail (#159, env `SUPPORT_EMAIL`, default `support@backchannel.it.com`); #6 purge covers `user_info.device_tokens`; #7 notification prefs gate the push, not just the feed row. #2 is now tracked only under §V #2 / #9.

### 🟠 Ops (no code)

4. **`MODERATION_ALERT_EMAIL` must be set in the DO prod env.** The code side is done (#159: richer alerts, correct `queue_url`, and a prod-only startup warning when it's unset) — but the warning is all that happens until the variable exists. Set it to `support@backchannel.it.com` once that address receives mail (§AE #2).

### 🟢 Confirmations (no code expected, just a yes/no)

8. **Snowflake Cortex autofill (`/api/autofill/`, `services/autofill.py`, Mistral Large 2)** — the mobile app never calls it, so the policy names Anthropic as the *only* AI provider and describes Snowflake as the database host. If a feature that hits Cortex ships (browser autofill, etc.), the policy has to add it *first*. Flagging so it doesn't slip.
9. **Job-search text** — if applicant search queries (`title`/`location` params on browse) are logged or retained server-side, tell us and we'll add "search history" to the policy; today it says analytics never receives them (true on the client).

---

## §X — Transactional-email links 🟠 Ops only now (section trimmed 2026-10-16)

**Done:** #2 résumé-parse false-failure race (backend #187: `max_retries=0`, per-stage budgets under DO's 100 s edge timeout; the app's parse timeout is 150 s so it never aborts first).

### 1. Email links are `FRONTEND_URL`-driven — the only thing left is the env value

The verify/reset links are built as `<FRONTEND_URL>/verify-email?token=…` and `/reset-password?token=…`. Nothing to code; set prod `FRONTEND_URL` to the https host the app's universal links trust (see §AB #2 for which host and the ordering constraint). The original `APP_SCHEME_URL` proposal is withdrawn in favour of https links.

---

## §Y — Premium: entitlement record ✅ #1 done; deck volume 🟢 post-launch (updated 2026-10-16)

**Done 2026-10-16 (backend #189, #190):** `POST /api/webhooks/revenuecat/` (Authorization header must equal `REVENUECAT_WEBHOOK_SECRET`; deliberately 404 while unset because DO's edge rewrites origin 5xx), migration 031 `billing_subscriptions`, and `IS_PREMIUM` / `PREMIUM_EXPIRES_AT` on `GET /api/profile/`. **Remaining is ops:** Yosef creates the webhook in RevenueCat and hands you the secret (see the answers block at the top). The daily like-cap stays client-side for v1 as agreed; #2/#3 below are the post-launch follow-ups that gate on `IS_PREMIUM`.

**Original context (2026-09-23):** A frontend-only subscription audit this week found the Premium paywall's copy promised "unlimited swiping," but the code never actually delivered it — the "unlock more cards" button just rewound the same already-loaded 10-card deck, not a bigger or fresh one. That's been fixed on our side: the paywall now promises (and actually enforces) a **higher daily LIKE cap only** — 2/day free, 5/day Premium (`constants/config.ts`'s `DAILY_LIKE_LIMITS`, plus a new `lib/dailyLikeLimit.ts` persistent counter so it can't be reset by tapping "review again"). Nothing in this fix needs anything from you — flagging this section only for the *next* step, which does.

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

## §AB — Launch-readiness: ✅ remote config done; https email links = ops (updated 2026-10-16)

Two small backend asks that unlock things the frontend has already built (branch `feat/launch-readiness`). Neither blocks App Review; both are the difference between "we can react to a bad launch" and "we can't."

### 1. ~~`GET /api/app-config/`~~ — **done 2026-10-16** (backend #186/#188; live in prod, `{"min_version": null, "maintenance_message": null, "flags": {}}`, env `APP_MIN_VERSION` / `APP_MAINTENANCE_MESSAGE` / `APP_FLAGS`, `Cache-Control: max-age=60`). The app's `lib/appConfig.ts` already consumes it.

### 2. Transactional-email links: use `https://` (supersedes §X #1's `backchannelv2://` default)

The frontend now supports **universal links** (site PR: `BackChannel-Netlify` #2 serves `apple-app-site-association` + a fallback page; app: `associatedDomains` in `app.json`). That changes the best fix for §X #1:

- **Use `https://backchannelapp.netlify.app/verify-email?token=…` and `/reset-password?token=…`** — i.e. keep the original `{FRONTEND_URL}/<path>?token=…` pattern, just make sure `FRONTEND_URL` points at that site. With the app installed, iOS opens the link *directly in the app* (route `app/verify-email.tsx`); without it (or on a laptop) the visitor lands on a real page with an App Store button instead of a dead end. The original bug was the marketing site having no page at those paths — that page now exists.
- Why this beats the custom scheme `backchannelv2://` from §X #1: a custom scheme does **nothing** when the app isn't installed and Gmail/Outlook/many webviews refuse to open non-http links at all (a link that silently does nothing). `https` links work everywhere and degrade gracefully.
- **Ordering:** don't switch emails until (a) the Netlify PR is merged and (b) an app build containing `associatedDomains` is on users' phones — before that, an `https` link would open the fallback page rather than the app. Until then §X #1's custom-scheme change is still a strict improvement over today.
- **Which domain?** We're launching on the Netlify host (works today, `FRONTEND_URL` should point there for now). `backchannel.it.com` — the site Nico runs — is the intended long-term home for these links, but it needs three things added first. **See §AE below: that's the checklist for Nico specifically, so it doesn't get missed inside this email-routing note.** The app already trusts both hosts (no rebuild needed to switch once §AE is done).
- If the site later moves again (e.g. to `backchannel.app`), change `FRONTEND_URL` and tell us: the app's `associatedDomains` and the new site's AASA file both need the new host, and — unlike swapping between the two hosts already trusted — that one needs a rebuild.

---

## §AC — Invite loop: accept a `referred_by` on signup 🟢 Low priority, nice-to-have (new section, 2026-09-26 — for Nico)

**Context:** the app now has an invite loop (Settings > "Invite Someone" / "Invite a Colleague", plus a quiet link on the end-of-deck card). It shares `https://backchannelapp.netlify.app/invite/<inviter user_id>`; opening that link stores the inviter id on the recipient's device (first touch wins), and the app's **Mixpanel** `Sign Up Succeeded` event carries it as `referred_by`. So attribution and funnel analysis already work **with no backend change**.

**What the backend could add later (only if you want referral *features*, not just analytics):** accept an optional `referred_by` (string user_id) on the register endpoints (`register-applicant`, `register-sponsor`, and the SSO `complete-onboarding`) and persist it on the user row. That would enable server-side rewards/credit ("you invited 3 people"), fraud/self-referral checks, and reporting without depending on Mixpanel. Validate it exists and isn't the new user's own id; silently ignore it otherwise (never fail a signup over it). The frontend will send it once the field exists.

**Fix order:** nothing to do for launch.

---

## §AD — Moderation & account-safety gaps 🟠 Medium (section trimmed 2026-10-15; was 🔴)

**Done and live in prod (removed):** #1 alert email now carries reporter/reported names, detail, and conversation id, with `queue_url` built from the API host (#159, new `API_BASE_URL` setting); #3 report evidence is snapshotted (≤200 messages of the reported conversation) and `moderation.reports` survives account purge (#165, migration 030) — the Privacy Policy §7 sentence is now true; #4 reporting withdraws active referrals between the pair (#164); #5a token refresh rejects deactivated accounts (#162, `ActiveUserTokenRefreshView`); #5c SSO login already checked `is_active`; #7 `/api/health/ready/` no longer echoes exception text (#160).

1. **Moderation tooling is JSON-only.** `GET /admin/api/reports/` (rows now include `EVIDENCE`) + a resolve endpoint exist, but there's no HTML reports page (resolving needs a devtools `fetch` with a CSRF header) and `django.contrib.admin` isn't installed. There is deactivate/reactivate, but no *ban*: a deactivated user can re-register with a new email (trivial with Apple Hide My Email). **Ask (minimal):** a simple HTML reports queue with a "resolve + deactivate" button; consider blocking re-registration by SSO subject / device.
2. **Open chat sockets aren't force-closed on deactivation.** Mostly mitigated 2026-10-16: sends from a deactivated account now 403 even over an open socket, and deactivation bumps `token_version` so any reconnect fails. Left: actively closing the open socket. Low priority.
3. **CSAM / NCMEC.** No automated image scanning, photos are public-read on the CDN (§V #2), and no login IPs are stored (little to include in a report). Counsel should confirm the reporting duty, process, and evidence-preservation period **before launch**.
4. **No global push kill switch** and no documented Sentry alert rules / uptime monitors (see `docs/ops/INCIDENT_PLAN.md` for suggested ones).
5. **Data export vs. Privacy Policy (`docs/ops/DATA_RIGHTS_SPEC.md`):** Policy §3 says we don't collect phone/DOB/street/postal code, but those columns still exist (§L). An honest "download my data" export would contradict the policy, so land the §L cleanup first.
6. **Lifecycle messaging (`docs/ops/LIFECYCLE_MESSAGING.md`) needs backend that doesn't exist:** a scheduler, `last_active_at`, and a user timezone (`last_login` is not "last active"), plus a new `reminders` notification type with its own toggle and an unsubscribe endpoint. The Privacy Policy discloses only transactional email; lifecycle email needs a policy update first. Not launch-blocking.

**Fix order:** 1 → 2 → 3 (counsel, in parallel) → rest.

---

## §AE — For Nico: what `backchannel.it.com` needs before we can point the app at it, + the support email 🟠 Medium priority (new section, 2026-09-27 — for Nico specifically)

Pulling this out on its own so it doesn't get lost inside §AB's email-routing note. This is about **your site** (`backchannel.it.com`, DigitalOcean + Cloudflare) and **the support inbox** — two things only you can act on.

### 1. `backchannel.it.com` needs to serve universal-link files before we switch to it

**Context:** email links (verify email, reset password) are moving from a dead-end website link to "universal links" — regular `https://` links that open directly in the app when it's installed, and fall back to a normal web page when it isn't. This fixes a real bug: those links currently go nowhere useful. We're launching on a temporary Netlify host (already built and live) precisely so this isn't blocking launch — but `backchannel.it.com` is the real, permanent home for them, since it's the actual BackChannel domain. **The app already trusts both hosts today, so switching later needs zero app rebuild — just these three things on your side:**

1. **Serve `/.well-known/apple-app-site-association`** — a small JSON file (contents below) at exactly that path. Must return **HTTP 200**, `Content-Type: application/json`, **no redirects** (Apple's fetcher won't follow one). It has no file extension on purpose; that's normal.
   This is copied verbatim from what's already live and working at `backchannelapp.netlify.app` (verified via `curl` just now), so it's proven correct, not just written from spec:
   ```json
   {
     "applinks": {
       "details": [
         {
           "appIDs": ["ZWFR8LC25W.com.yosefwolday.backchannelv2"],
           "components": [
             { "/": "/verify-email", "comment": "Email verification + work-email verification + email change" },
             { "/": "/reset-password", "comment": "Password reset" },
             { "/": "/job/*", "comment": "Shared job links (invite loop)" },
             { "/": "/invite/*", "comment": "Invite links (invite loop)" }
           ]
         }
       ]
     },
     "webcredentials": { "apps": ["ZWFR8LC25W.com.yosefwolday.backchannelv2"] }
   }
   ```
   The `comment` keys are just documentation for anyone reading the file later; Apple ignores them.
2. **Make sure Cloudflare doesn't intercept that path.** Bot Fight Mode, "Under Attack" mode, or a WAF rule can serve Apple's verification fetcher a challenge page or a 403 instead of the JSON above — which silently breaks the whole feature with no visible error on our side. Add an explicit WAF/firewall skip rule for `/.well-known/*`.
3. **Add a real page at those four paths** (`/verify-email`, `/reset-password`, `/job/*`, `/invite/*`) for people who don't have the app installed yet — right now there's nothing there. It just needs: an "Open in the App Store" link, and ideally a hand-off to `backchannelv2://` + the same path/query for anyone who *does* have the app but arrived some other way (e.g. pasted the link on desktop, then opens it on their phone). We already built exactly this page for the Netlify host (`BackChannel-Netlify` repo, `open.html`) if you want to reuse/adapt it rather than build from scratch.

**How to verify it's working, once done:**
```
curl -sI https://backchannel.it.com/.well-known/apple-app-site-association
# expect: HTTP/2 200, content-type: application/json, no "location:" header
```
Then tell us — we'll flip `FRONTEND_URL` (and confirm on our side with a real device) rather than you needing to touch the app at all.

**Not urgent for launch** — the Netlify host covers this until you're ready.

### 2. Support email — `support@backchannel.it.com` currently bounces

Every "contact us" surface in the app and on both websites (the in-app Help & Feedback button, the App Store review notes, the Privacy Policy, the moderation-report acknowledgment) points at `support@backchannel.it.com`. **That domain has no MX record**, so mail sent to it is undeliverable today — silently, from the sender's point of view (no bounce notice most of the time, it just vanishes).

**This is separate from, and in addition to, the `MODERATION_ALERT_EMAIL` gap in §AD #1** (that one is about *us* getting notified when a report comes in; this one is about *users* being able to reach us at all, e.g. "I paid and lost Premium access," account issues, or general questions).

**Ask:** pick which domain support mail should actually live on — `backchannel.app`, `backchannel.it.com`, or something else — and get an MX record pointed at a real inbox (Google Workspace, a forwarding rule, whatever's simplest). Once that's decided, tell us if the address itself needs to change from `support@backchannel.it.com` — it's a single constant (`constants/config.ts`'s `SUPPORT_EMAIL`) on our side, a one-line change.

**Heads-up (2026-10-05):** a Google Workspace account for `backchannel.app` already exists, half set up, under Yosef's login (domain not yet verified, no MX added). If you go with `backchannel.app`, finish *that* account rather than starting a new signup — Google otherwise blocks with "this domain is already in use." Yosef can add you as an admin. Also, while you're in DNS: `backchannel.app` has **no SPF or DKIM either**, so whatever domain `DEFAULT_FROM_EMAIL` uses in prod needs the SMTP provider's (Resend's) SPF/DKIM records and a `_dmarc` TXT, or verification/reset mail will keep drifting into spam.

**This blocks launch** in the sense that App Review may test the support contact, and it's a bad first impression for a real user's first support request to vanish into the void.

---

## §V — Pre-production security audit: what's left 🟢 Low (section trimmed 2026-10-16; was 🔴)

**Done and live in prod** (backend PRs #167–#175, #196, #197, #199; removed from this list): #1 pre-match PII; #3 dependency bumps incl. Django 5.2 LTS, `pip-audit` enforcing in CI; #4 admin throttle on trusted-edge IP, fails closed; #6 Django password validators at register/reset/change; #7 server-side session revocation via `users.token_version` (migration 032) + dedicated `JWT_SIGNING_KEY`; #8 waitlist throttle 10/h/IP; #9 `sponsor_email` dropped from `/api/matches/`; #10 `seed_demo_data` refuses on prod, hardcoded password removed; #11 request-sponsor throttle 20/h/user; #12 WebSocket JWT via `Sec-WebSocket-Protocol` (app switched); CI gating, Dependabot, loopback-only compose Redis. The reviewer's original framing still holds: no IDOR, parameterized SQL, bcrypt — the audit was about over-sharing, and that's now closed.

### Still open

2. **Profile photos are still `ACL="public-read"` with permanent CDN URLs.** Résumé photos moved to private + 1-hour presigned URLs (#175); ordinary profile photos didn't. The Privacy Policy currently discloses the public-link CDN honestly, so this is not launch-blocking; when it ships, tell us and we tighten the policy wording. *Can't verify from the repo:* whether the DO Spaces bucket allows listing — worth a manual check.

5. **Registration enumeration — decision: keep as-is for launch** (see the answers block at the top). Revisit post-launch; if we switch to the generic response, we'll coordinate the signup copy first.

### Low / Info (unchanged)

- **OpenAPI spec + Scalar docs are public** (`django_bc/urls.py`) — consider gating behind admin auth in prod.
- **`ALLOWED_HOSTS` defaults to `localhost,127.0.0.1`** — fails safe; confirm it's set in the DO app config.
- **Emails logged at INFO** — addresses land in container logs; no secrets found logged.
- **Sentry `traces_sample_rate=1.0`** — cost, not security.
- **Legacy JWT dual-read still enabled** — `ACTION_TOKEN_DUAL_READ` defaults true; the migration window is long past. Flip to false and delete the `_legacy` readers.
- **Logo.dev token embedded in returned/stored URLs** — almost certainly a publishable key; worth a one-line confirmation.
- **`?token=` WebSocket fallback** — remove once app build 1.0.2 is the floor (we'll say when).

---

## §F — Feed relevance: ✅ scoring + scoping shipped; one SQL item + a flag flip left (updated 2026-10-16)

**Status (2026-09-18):** traced end-to-end against the local backend checkout after a founder question ("if someone says they want to be a software engineer, do we show them those roles?"). Short answer: only weakly, and not for the part of the product that matters. Nothing is wrong on the frontend side — it sends no filters and renders server order — so this is entirely a backend item.

**What the frontend sends:** `GET /api/jobs/pack/` with **no params** (`lib/api.ts:471`); `GET /api/profiles/pack/?job_id=<sponsored JOB_ID>` with only that one param (`lib/api.ts:808`). All personalization is expected server-side. The applicant questionnaire does collect the right inputs and persists them via `PATCH /api/profile/applicant/update/` — `positions` (the "What position are you seeking?" answer), `skills`, `industry`, `current_role`, `work_preferences`, plus `location` via `updateGeneralProfile` (`ApplicantQuestionnaire.tsx:995-1024`).

**What the backend actually does:**

1. **Applicant deck — sponsored jobs are never scored.** `services/jobs.py:551 get_job_pack` pulls two pools, both `ORDER BY random()` with no profile predicate (`queries/jobs.py:454-459` ATS, `:789-818` sponsored; the only filters are active/not-blocked/not-in-`job_feed_history`). It oversamples ~30, then **scores only `ats_raw`** (`services/jobs.py:574-584`) — `spn_raw` is truncated in random order and interleaved ~50/50 (`:589-607`). So roughly half of every deck — the sponsored jobs, i.e. the referral product — is pure random relative to what the user asked for.
2. **Applicant deck — ranking is a re-sort of a random window, not a filter.** `services/scoring.py` (skills 40 / experience 20 / role 20 / location 10 / recency 10) reads `SKILLS, YEARS_EXPERIENCE, current_role, DESIRED_ROLES, WORK_PREFERENCES, LOCATION` (`queries/profiles.py:341`) — but it can only reorder the ~30 rows `random()` happened to return. A strong-fit job outside that window never surfaces. Scoring failures fall back silently to unranked (`services/jobs.py:571-572`).
3. **Sponsor deck — not scoped to the job at all.** `queries/profiles.py:213 fetch_profile_pack` has no predicate on the sponsored job's title/skills/location or the sponsor's company; `job_id` is used only for the `matching.likes` liker flag (`:239-241`). Order is likers-first, then **primary key** (`:248`). `services/profiles.py:329-344` applies scoring only when the pool exceeds the page limit. Net: a sponsor sponsoring a PM role swipes through every applicant in the database.
4. **Browse/search/likes are unranked.** `/api/jobs/browse/` is newest-first with no profile pre-fill (`services/jobs.py:788`, `queries/jobs.py:658`); `/api/jobs/<id>/likes/applicants/` has no score, so the app's "Top Applicants" is just an unordered likes list.

**Collected but read by no feed/matching query** (distinct from §L — these should be *wired in*, not dropped): applicant `INDUSTRY`, `RANGE_MILES`, `WILLING_TO_RELOCATE`, `REQUIRES_SPONSORSHIP`, `INSIGHTS`, `RESUME_DATA`; sponsor `COMPANIES_CAN_REFER_TO`, `JOB_TITLE`, `REFERRAL_ELIGIBLE`, `OPEN_TO_REFERRALS`. `COMPANIES_CAN_REFER_TO` is the notable one — it's the field that most directly encodes which jobs a sponsor can actually refer into, and nothing reads it (`services/profiles.py:237, 318` write/display only). Sponsor `COMPANY` is the only sponsor field that shapes any query, and only for their own job-browse tab (`services/jobs.py:800`).

**Ask (in leverage order):**
**Done 2026-10-16:** #1 sponsored jobs ranked by the same scorer (backend #194); #4 `relevance_score` (0–100 float) on every job card when the applicant has a profile, omitted otherwise — the app already renders it; #2 sponsor-deck scoping to the job (backend #195) behind `FEED_SCOPE_SPONSOR_DECK`, **currently OFF in prod**.

**Left:**
1. **Flip `FEED_SCOPE_SPONSOR_DECK` on in prod** once you're comfortable with it on dev (no response-shape change; the deck tops up from the unfiltered pool so it's never empty).
2. **Filter in SQL, not just re-sort in Python** (original #3) — push at least skills/title predicates into the applicant job-pack query so the candidate window isn't a random slice. Post-launch.

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
