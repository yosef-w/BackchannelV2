# Launch-Week Incident Plan

**Written:** 2026-09-26. Two-person team. Grounded in `docs/CI_CD_PIPELINE.md`, `docs/BACKEND_CHANGES_NEEDED.md` (§AB, §W, §V), `lib/sentry.ts`, `lib/appConfig.ts`, and the backend's `django_bc/urls.py`, `settings.py`, `services/push.py`, `docs/DEV_ENVIRONMENT.md`.
Backend is owned by Nico (read-only for us); frontend/EAS/ops is Yosef. **Not legal advice** where marked "counsel to confirm."

---

## 0. What exists vs. what this plan assumes you will set up

| Lever | Status today |
|---|---|
| OTA rollback (`eas update:republish`, `roll-back-to-embedded`) | **Exists** (CI_CD_PIPELINE.md). **Caveat:** OTA reaches only builds on the fingerprint runtime (build #31+). Older builds cannot be rolled back this way; they cannot be OTA'd at all. |
| Production OTA approval gate | **Exists.** Nothing goes to `production` without a human approving in Actions. This is the main defence against a bad OTA. |
| Remote config (`GET /api/app-config/`: `min_version`, `maintenance_message`, `flags`) | **Frontend built and fail-open; backend endpoint does not exist yet** (§AB #1, currently 404). Until Nico ships it, **there is no server-side kill switch, no forced update, no maintenance screen.** Treat every "flip the switch" step below as unavailable until you confirm `curl <API host>/api/app-config/` returns 200. `useRemoteFlag` is wired, but **nothing reads any flag yet**, so even after the endpoint ships, flags do nothing until specific features are wired to them. Only `min_version` and `maintenance_message` are functional. |
| App Store phased release pause | **Exists** in App Store Connect, only if you released with "Release update over 7-day period." Confirm that setting when you submit; it cannot be turned on after release. |
| DO App Platform rollback | Exists in the DO dashboard (app `oyster-app`, Activity/Deployments, roll back to a previous deployment; **confirm the exact control the first time, not during an incident**). Backend deploys from `main`. Owned by Nico. |
| Sentry (frontend) | Initialised in `lib/sentry.ts` (`enabled: !__DEV__`, environment from `EXPO_PUBLIC_APP_ENV`, `tracesSampleRate 0.2`, 5xx grouped by `api-5xx` fingerprint + `api.endpoint` tag, `user_type` tag). **No alert rules are documented as created**; `docs/SENTRY_SETUP.md` only says "email me on any new issue." Create the rules in section 5. |
| Sentry (backend) | Only if `SENTRY_DSN` is set in the prod env (optional in `settings.py`; unconfirmed). `traces_sample_rate=1.0` in settings will burn quota under load. Ask Nico to confirm the DSN is set and to lower traces sampling. |
| Uptime monitor | **None documented.** Set up in section 5. |
| Status page | **None.** Use the template in section 6; the interim channel is an App Store "What's New"/TestFlight note, social account, and (once wired) the in-app `maintenance_message`. |
| Global push kill switch | **None.** `services/push.py` sends via the Expo Push API (`exp.host`) on a thread pool; there is no on/off env flag. The only levers: revoke/disable the Expo access, stop the caller, or deactivate device tokens (SQL). See "Push storm" below. |
| Second person with prod access | **Unknown.** Both of you need: EAS/Expo, App Store Connect, Sentry, Mixpanel, GitHub admin, DO dashboard (Nico), Resend, Netlify. Fill in the table in section 2 today. |

---

## 1. Severity levels

| Sev | Definition | Examples | Response | Comms |
|---|---|---|---|---|
| **SEV1** | Everyone (or the security of user data) is affected; app unusable or data at risk | Backend down; crash-on-launch; login broken for all; data leak; push storm to all users | Drop everything. Ack within **10 min**, mitigation within **30 min** | Status update every 30 min until mitigated; user-facing note within 1 hour |
| **SEV2** | A core flow is broken for a large group, workaround exists | Matching/likes failing; messages delayed; SSO for one provider down; a bad OTA on one screen | Ack within **30 min**, mitigation within **4 hours** | Update every 2 hours; note if users notice |
| **SEV3** | Minor/partial, cosmetic, or a small group | One screen glitch, slow endpoint, single-user bug | Next business day | None, log it |
| **SEC** | Suspected data exposure or account compromise (may overlap SEV1) | Public link leak, credential leak, unauthorised access | Treated as SEV1 **plus** legal path (section 4.6) | Counsel before external comms |

Classify **up** when unsure; downgrade after 30 minutes of evidence.

---

## 2. Who does what (2 people)

Fill in names and contacts and put this in a phone note both of you have.

| Role | Primary | Backup | Owns |
|---|---|---|---|
| **Incident commander (IC)** | Yosef | Nico | Decides severity; runs the checklist; writes the timeline; owns comms; the only person who says "resolved" |
| **Backend/infra responder** | Nico | Yosef (read-only, so escalate) | DO dashboard/logs, deploys and rollbacks, DB, env vars (`MODERATION_ALERT_EMAIL`, `APP_MIN_VERSION`, `APP_MAINTENANCE_MESSAGE` once §AB lands), Sentry backend |
| **Client responder** | Yosef | none | EAS Update/rollbacks, builds/tags, App Store Connect (phased release, expedited review), Sentry (mobile) |
| **Comms** | Yosef | Nico | Status text, App Store notes, support inbox, users |

Rules:
- One person is IC at a time. The IC does **not** also debug; if you are the only one awake, say "IC + responder" out loud and prioritise stopping the bleeding over understanding it.
- Ping channel: phone call first (SEV1), then text. Agree today on a shared chat thread named **#incident**.
- Launch week coverage: agree who is reachable when; one of you carries the phone with Sentry, uptime alerts, and the moderation inbox routed to it. **Do not both be offline at once** in the first 72 hours after release.
- Every incident gets a timeline in a shared doc (timestamps, actions, who). Section 7 is the post-mortem template.
- **Do not push to `main` or push a `v*` tag as a "fix attempt" without deciding it deliberately.** A tag = a real EAS build and a real TestFlight submission (cost + testers see it); a push to `main` queues a production OTA behind the approval gate. Approving that gate under stress is the riskiest click you have.

---

## 3. The levers, exactly

### 3.1 OTA (JS-only) problems

```
eas update:list --branch production                 # find last-known-good group id (check timestamps + message)
eas update:republish --group <group-id>             # republish the previous good update to the SAME channel (fastest targeted fix)
eas update:roll-back-to-embedded --branch production   # NUCLEAR: every device on this channel goes back to the JS embedded in its binary
```
- Add `--branch preview` for the beta channel. You must be logged in (`eas whoami`) with the Expo account, or use the `EXPO_TOKEN` robot.
- Devices apply an OTA **on the second launch** (`checkAutomatically: ON_LOAD` downloads on launch 1, applies on launch 2). **A rollback takes two app opens to reach a user**; brief users accordingly and do not expect the crash rate to drop instantly.
- **Crash-on-launch caveat:** if the bad update crashes before the update check runs, the device may never fetch the rollback. expo-updates has a built-in crash-loop recovery (it falls back to the previous update/embedded bundle after repeated launch failures), but **do not rely on it: test it once on a TestFlight device before launch.** If it does not recover, the only fix is a new native build + `min_version` (needs §AB).
- Only builds on the fingerprint runtime (#31+) are affected by, or reachable by, OTA.
- If the bad change is **native** (not OTA), there is no OTA fix. Options: pull/replace via App Store Connect (expedited review request), and `min_version` after a fixed build ships.

### 3.2 App Store release problems

- **Pause phased release:** App Store Connect > App > (version) > Phased Release for Automatic Updates > **Pause**. Pausing stops new automatic updates going out (up to 30 days); users who already got the update keep it, and anyone who manually updates or is a first-time downloader still gets the current version. Also consider **removing the app from sale** for a genuine data/safety emergency (counsel/founders decision).
- **Expedited review:** App Store Connect > Contact Us > "Request an Expedited App Review" for a critical fix.
- **TestFlight-only builds:** expire the build in TestFlight to stop testers installing it.
- Confirm phased release is switched on at submission (see section 0).

### 3.3 Remote config kill switch / forced update / maintenance (after §AB #1 ships)

Endpoint contract (from `docs/BACKEND_CHANGES_NEEDED.md` §AB #1 and `lib/appConfig.ts`):
```
GET /api/app-config/   (unauthenticated; must not touch DB or auth)
200 { "min_version": "1.0.0", "maintenance_message": null, "flags": {} }
```
- `maintenance_message`: any non-empty string replaces the whole app with that message. Backed by env `APP_MAINTENANCE_MESSAGE` (proposed) editable in the DO dashboard **without a deploy** (a settings change still restarts the app; expect a minute or two).
- `min_version`: builds with `app.json` `version` lower than this get a blocking "Update required" screen linking to the App Store. Compared numerically against `app.json`'s **version**, not the build number. Use it **only after** a fixed build is live in the App Store, or you strand everyone on an update screen with nothing to update to.
- `flags`: nothing reads a flag today. To make this a real kill switch for a risky feature (e.g. sponsor deck, resume upload, premium), the frontend must gate that feature with `useRemoteFlag("<name>", true)` **before** you need it. Ask: which 3 features would you want to switch off in an incident? Wire those before launch.
- **Fail-open by design:** the app treats 404/timeout/garbage as "no restrictions", and caches the last good response on the device. So: (a) the switch cannot itself lock people out, and (b) **it does not work when the backend is totally down** (you cannot flip a switch on a dead server; the client keeps its last cached config). For a total outage, the only user-facing comms are outside the app.
- Throttling: clients check at boot and each foreground, at most once per 5 min, and the response is cached 60s server-side. Expect a switch to take effect within ~5 to 6 minutes.
- **Test it in preview/dev first** (dev backend: `https://backchannel-dev-hl72i.ondigitalocean.app`): set `maintenance_message`, background/foreground the app, confirm the screen, then clear it.

### 3.4 Backend (owned by Nico)

- Prod app: DO App Platform `oyster-app` (`https://oyster-app-4pg5w.ondigitalocean.app`), deploys from `main`. Logs in the DO dashboard. Dev/staging: `backchannel-dev` from `develop`.
- Roll back a bad backend deploy through the DO dashboard's previous deployment. Nico confirms the exact control and does one dry run on dev before launch. A DB migration that already ran is **not** undone by a code rollback.
- Known failure mode: a deploy that times out connecting to Postgres, because the DO egress IPs are not in the Snowflake network allowlist (`DEV_ENVIRONMENT.md`, "Dedicated egress IPs"). Prod uses shared egress; if prod suddenly cannot reach the DB after an infra change, check the allowlist first.
- Redis (Valkey) failure degrades caching, WebSocket channel layer and rate limiting (`/api/health/ready/` reports `redis`). WebSocket message rate limiting **fails closed** (`rate_limit.py`): a Redis outage makes chat sending rate-limited for everyone.
- DB is Snowflake-managed Postgres (a single provider); Snowflake/DO outages are outside our control: comms only.

### 3.5 Sentry

Use it for: which release/OTA group, which screen (breadcrumb `Screen: X`), `user_type` tag, `environment`. Filter `environment:production`. 5xx API failures are grouped as one issue per `method + endpoint` (`api-5xx` fingerprint), so an outage shows up as a handful of issues with huge counts, not thousands of issues.

---

## 4. First 15 minutes, by scenario

Universal first 3 minutes for **every** incident: (1) IC named, (2) open the #incident thread and start the timeline, (3) classify severity, (4) **stop making things worse**: freeze deploys (do not approve any pending production OTA; note the time of the last approved OTA, last backend deploy, last build).

### 4.1 Backend down / unreachable

Signals: uptime monitor red, spike of `API 5xx`/network errors in Sentry, `API Error` events in Mixpanel, "cannot connect" reports.
1. **0 to 3 min:** `curl -i https://oyster-app-4pg5w.ondigitalocean.app/api/health/` (shallow; static `{"status":"ok"}`, no DB). Then `.../api/health/ready/` (DB + Redis; returns **503** `degraded` with the failing component named).
   - Shallow fails: app process/DO issue. Shallow ok but ready 503: database or Redis.
2. **3 to 8 min (Nico):** DO dashboard: latest deployment status, runtime logs, recent deploys. **If a deploy happened in the last hour, roll it back first, diagnose after.** Check DO status page, Snowflake status, Redis (Valkey) cluster.
3. **8 to 12 min:** if the cause is the DB allowlist/egress, or a provider outage, you cannot fix it: switch to comms. If `/api/app-config/` is live and served without the DB, set `maintenance_message` (only helps clients that can still reach that one endpoint; if the whole app is down, skip).
4. **12 to 15 min:** status post (section 6), tell App Review contact only if a review is in flight.
5. Do **not** ship an OTA to "fix" a backend outage.

### 4.2 Bad OTA update (screen broken, feature broken, wrong behaviour)

Signals: Sentry new issue tagged with an OTA update id shortly after a workflow run; users report a broken screen; no native release happened.
1. **0 to 3 min:** Actions tab: which OTA workflow ran last, what commit? `eas update:list --branch production` to get the group ids.
2. **3 to 6 min:** **Pause the pipeline**: reject any waiting production approvals.
3. **6 to 10 min:** `eas update:republish --group <last-good-group-id>` (targeted). If you cannot identify a good group or the last N updates are all suspect, use `eas update:roll-back-to-embedded --branch production`.
4. **10 to 15 min:** confirm from the `eas update:list` output that the rollback group is at the top of the channel; watch Sentry for the issue rate falling over the next hours (remember the two-open lag). Revert the bad commit on `develop`/`main` via a normal hotfix branch **and back-merge `main` into `develop`** (CI_CD_PIPELINE.md, Hotfixing) so the bug is not re-promoted.
5. Note: if `develop` published a bad OTA to `preview`, the same commands with `--branch preview`.

### 4.3 Crash-on-launch spike

Signals: Sentry crash-free sessions drops, many `fatal` events in the first seconds, "app opens then closes" reports, App Store reviews.
1. **0 to 3 min:** Is it one version? Sentry: group by `release`/`dist`/OTA update id, OS version, device. Did it start right after an OTA (section 4.2) or a new build (release)?
2. **If OTA-correlated:** run the 4.2 rollback immediately. Crash loops that occur before the update check may prevent devices from receiving the rollback; see 3.1 caveat.
3. **If it correlates with a new native build (new tag/TestFlight/App Store release):** **pause the phased release** (3.2). Then fix forward: expedited review request + hotfix build; once the fixed build is live, set `min_version` above the bad version (needs §AB) so anyone stuck is pushed to update.
4. **If it correlates with a backend change or a bad response shape** (e.g. `null` where the app expects a field): check Sentry stack for a JSON/undefined error; ask Nico to roll back the backend; the client is not fail-safe against every malformed response.
5. **If it correlates with a maintenance/remote-config value** (a bad `flags` payload or `min_version`): clear it (parse is defensive, so unlikely).
6. Communicate: TestFlight/App Store note, status post.

### 4.4 Auth broken (login/signup/SSO/verify/reset)

Signals: `Login Failed` / `Sign Up Failed` / `SSO Failed` spike in Mixpanel, `API 5xx` on `/api/login/`, `/api/register/`, `/api/auth/sso/`, support mail.
1. **0 to 3 min:** Test yourself: email login, Apple SSO, Google SSO, forgot-password. Note which path is broken (isolates provider vs. backend vs. client).
2. Email/password only: backend or DB (4.1); a Redis/rate-limit failure can also block (login throttle is 10/min per IP; **a shared NAT or a bug can lock out many users behind one IP**; register 10/hour in prod, `password_reset` 5/hour).
3. **SSO only:** Apple/Google side. Check the credentials/env config (§S: Apple/Google console credentials → backend env vars, key rotation/expiry, `aud` client ids list), provider status pages, and `SSO_ENABLED`. **The SSO client secret for Sign in with Apple expires** (max 6 months): make a calendar entry.
4. Email verify / password reset links: known weakness: transactional emails currently link to the marketing site (§X #1 / §AB #2); a wrong `FRONTEND_URL` or missing universal-link build breaks verify/reset. Resend outages or sending-domain issues stop these emails entirely; check Resend's dashboard.
5. If token validation fails for everyone at once: check for a changed `SECRET_KEY`/JWT signing key on the last deploy (invalidates every session, forcing re-login); roll back the deploy.
6. Comms if more than 15 minutes.

### 4.5 Push notification storm (spam or wrong pushes to many users)

Signals: users complain of repeated pushes, Expo push dashboard/quota spike, notification rows growing abnormally, "notification tapped" anomalies.
1. **Identify the source (3 min):** server pushes (`services/notifications.py::create_notification` -> Expo) vs. **local** notifications (device-scheduled: daily deck reminder `daily-deck-ready`, `unfinished-deck-reminder`, per-role `checkin-nudge-<role>`). Server pushes carry `data.type` in {`match`,`message`,`referral`,`waitlist`,`job_like`,`profile_like`,`sponsor_request`}. Local ones have `data.type` `daily_deck_ready` / `unfinished_deck` (and the check-in nudge).
2. **Server storm (Nico):** find the loop (e.g. a retry loop in matching/messaging/check-ins), roll back the deploy or hotfix. Stopping delivery immediately: there is no kill switch; the fastest options are (a) roll back the backend deploy, (b) rotate/disable the Expo push access/credentials for the project (`exp.host` rejects sends), (c) as a last resort `UPDATE user_info.device_tokens SET is_active = FALSE` (destroys the delivery list: users must reopen the app to re-register their token; only for a true emergency, **record the count first**). Ask Nico to add a `PUSH_ENABLED` env kill switch (see gaps).
3. **Local-notification storm (client bug):** these are scheduled on device, so you **cannot recall them remotely**. Fix via OTA (the app cancels/reschedules on next launch), publish a `min_version` if needed. Note the check-in nudge has sent-records dedupe by design; the deck reminders are idempotent by identifier.
4. Comms: apologise, tell users how to silence (Settings > Notifications toggles; Daily Deck Reminders toggle).
5. Apple 4.5.4: pushes must not be required or promotional without opt-in; a storm of promotional content risks review issues too.

### 4.6 Data leak suspicion

Signals: a user says they can see someone else's data; an unexpected public URL; credentials/secrets in a repo or log; unusual DB access; Sentry event containing PII; a security researcher's email.
1. **0 to 5 min: contain, don't investigate destructively.** IC declares SEC. Do **not** delete logs, rows, or objects. If a credential is exposed (in the repo, in a screenshot, in Sentry): **rotate it now** (DO env, Spaces key, Resend key, JWT secret, DB password, `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`), then investigate. If an endpoint is leaking: Nico disables it (deploy a 404/403 or roll back).
2. **5 to 10 min:** capture facts: what data, how many users, since when, who could see it, is it still exposed. Preserve screenshots/logs to a private folder.
3. **10 to 15 min:** **contact counsel.** Do not email affected users, post publicly, or talk to press before counsel weighs in.
4. Known exposure surfaces to check first (from §V, still open unless shipped): sponsor pack `GET /api/profiles/pack/` returns `RESUME_DATA`, `PHONE_NUMBER`, `DATE_OF_BIRTH` to any sponsor (§V #1, §W #1); uploaded images are public-read forever, so photo links leak by URL (§V #2); `sponsor_email` returned to matched applicants (§V #9). Note that the **Privacy Policy makes promises about these** (résumé shared only after match; login/work email never shown), so a leak may also be a misrepresentation issue.
5. **Breach notification:** US state breach-notification laws (all 50 states, plus DC and territories) impose deadlines and content rules that vary by state, some as short as 30 to 45 days from discovery (and some require regulator/attorney-general notice above a user-count threshold); GDPR (if any EU users: the app is available worldwide) has a **72-hour** supervisory-authority clock from awareness; California and Texas have their own rules (Texas: Bluejay Labs is in Austin). **Counsel to confirm which laws apply, the definition of "personal information" for our data, the exact deadlines, and required content/recipients.** Start the clock from *discovery*, and write down the discovery timestamp.
6. Apple: for a major issue affecting user data, consider whether App Review/Apple needs a heads-up (counsel/founder call).
7. Follow with a post-mortem (section 7) and fix the root cause before restoring the feature.

---

## 5. Monitoring to set up before launch

### 5.1 Uptime monitors (real endpoints)

Use UptimeRobot / Better Stack / Checkly (any external checker; not on DO itself). Check every 1 minute if the plan allows, otherwise 5. Alert to **both** phones (push/SMS, not only email).

| Monitor | URL | Expect | Purpose |
|---|---|---|---|
| **API shallow** | `GET https://oyster-app-4pg5w.ondigitalocean.app/api/health/` | 200, body contains `"status":"ok"` | Process is alive (DO uses this same path for its own check). No DB. |
| **API deep** | `GET .../api/health/ready/` | 200 and `"status":"ok"` (**503 means degraded**: DB or Redis) | Database + Redis round trip. Alert on 2 consecutive failures. **Note:** on failure the body returns the raw exception string (first 200 chars) in `checks`, and the endpoint is public: ask Nico to redact it (info-leak, §V-style). |
| **Remote config** (after §AB) | `GET .../api/app-config/` | 200, valid JSON, `maintenance_message` is null | The break-glass endpoint itself; also alert if `maintenance_message` is unexpectedly non-null. |
| **Auth path smoke** | Synthetic `POST .../api/login/` with a dedicated monitor account (or a keyword monitor on a cheap authed GET) | 200 | Catches "health ok but login broken" (Redis/JWT/DB-specific). Use a dedicated low-privilege test user; do not use a real user; respect the 10/min login throttle. |
| **Landing/legal site** | `GET https://backchannelapp.netlify.app/privacy.html` and `/terms.html` | 200 | App Review and the in-app links depend on them. |
| **Universal link** | `GET https://backchannelapp.netlify.app/.well-known/apple-app-site-association` | 200, `application/json` | Email verify/reset deep links (§AB #2). |
| **WebSocket** (optional) | connect to the chat WS URL with a test token | handshake success | Realtime chat; not covered by HTTP checks. |
| **Domain/TLS expiry** | the API host and site domains | >14 days | Cheap insurance. |
| **Cron heartbeat** | ETL runs every 12h; staleness purge daily (`scripts/ats_etl.py`, `ats_staleness_purge.py` on DO scheduled jobs) | heartbeat ping each run | Stale/empty job decks. Needs Nico to add a curl at the end of each script. |

Also subscribe to status pages: DigitalOcean, Snowflake, Expo/EAS, Apple developer system status, Resend, Sentry, Mixpanel.

### 5.2 Sentry alert rules to create (suggestions; tune after week 1 data)

Project = the mobile app, `environment:production`. Notify both founders (mobile push + email).

| # | Rule | Condition (suggested) | Action |
|---|---|---|---|
| 1 | **New issue in production** | A new issue is created (`environment:production`), any level `error`/`fatal` | Email both. Keep during launch week (noisy is fine at low volume). |
| 2 | **Crash-free sessions drop** | Crash-free session rate < **99.0%** over 1h (release health; auto session tracking is on by default in `@sentry/react-native`, verify in the Sentry release page) | Page (SEV1 candidate). |
| 3 | **Crash spike** | Count of `fatal`/unhandled events > **20 in 10 minutes**, or > **5 events from one release within 5 minutes** | Page. |
| 4 | **Regression** | An issue marked resolved reappears | Email. |
| 5 | **API 5xx surge** | Issues titled `API 5xx: <METHOD> <endpoint>` (fingerprint `api-5xx`) event count > **30 in 5 minutes** (any endpoint) | Page. Distinguish outage vs. one bad endpoint by grouping. |
| 6 | **Auth endpoint failing** | Same rule filtered to `api.endpoint` in `/api/login/`, `/api/register/`, `/api/register-sponsor/`, `/api/auth/sso/`, `/api/token/refresh/`: > **10 in 5 minutes** | Page. |
| 7 | **Report endpoint failing** | `api.endpoint:/api/reports/`: **any** event | Email + phone push. Failure means users **cannot report**, breaking the App Store 1.2 promise (see MODERATION_RUNBOOK). |
| 8 | **Upload/resume failing** | `api.endpoint` in `/api/upload/*`, `/api/upload-and-parse/`, `/api/resume/*`, `/api/parse/document/`: > **5 in 15 min** | Email (resume parse timeout race is known, §X #2). |
| 9 | **Affected users** | One issue affecting > **10 unique users in 1 hour** | Email. |
| 10 | **Slow launch** | p75 app-start / transaction duration above threshold (tracesSampleRate is 0.2, so only after the data exists) | Email, informational. |
| 11 | **Quota** | Sentry spend/quota at 80% | Email (backend `traces_sample_rate=1.0` can blow through the quota at real traffic). |

Backend Sentry (if `SENTRY_DSN` is set): same rules 1, 3, and an alert on `OperationalError` (DB) count > 5 in 5 minutes; and an alert on any unhandled exception in the moderation/report path.

### 5.3 Mixpanel signals worth a threshold (secondary, they lag)

`API Error` (endpoint, status_or_reason) spike; `Login Failed` / `Sign Up Failed` / `SSO Failed` ratio to `... Submitted` above 20%; `User Reported` count (moderation load); drop in `App Opened` vs same hour yesterday by more than 40%.

---

## 6. Status-comms template

Channels (pick in order of reach): (1) in-app `maintenance_message` (when §AB is live and the backend is reachable), (2) a pinned post on the company account, (3) `https://backchannelapp.netlify.app` banner (Netlify, quick deploy), (4) direct email to beta testers (Resend or BCC from support), (5) App Store/TestFlight release notes. Keep it short, factual, no blame, no speculation about cause or data unless confirmed.

**Initial (within 30 min for SEV1):**
> **We're aware of an issue affecting {what users experience: e.g. "signing in" / "the whole app"}.** Since about {time, timezone}, some people {symptom}. We are working on it now and will update by {time, timezone, within 30 to 60 min}. Your data is {not affected / we are still checking}. (Say "not affected" only when confirmed.)

**Update:**
> **Update {time}:** {what we found in plain words}. {What we did / what is next}. Next update by {time}.

**Resolved:**
> **Resolved {time}:** {feature} is working again. The issue lasted about {duration}. {Anything users should do, e.g. "force-close and reopen the app twice to receive the fix"}. We're sorry for the trouble; we'll share what happened and what we're changing.

**In-app maintenance message (<= 140 chars):**
> BackChannel is briefly down for maintenance. Your matches and messages are safe. Please try again in a few minutes.

**Data incident (only after counsel approves):**
> We are writing to tell you about a security incident affecting some BackChannel accounts. What happened: {}. What information was involved: {}. What we are doing: {}. What you can do: {}. Contact: support@backchannel.app. (Counsel to confirm required content and delivery per state law.)

**Support inbox reality:** `support@backchannel.app` has no MX today (§W #4). During an incident, mail to it bounces; fix MX before launch or list a working contact.

---

## 7. Post-mortem template (blameless; write within 3 business days for SEV1/SEC, 7 for SEV2)

```
# Post-mortem: {title}
Date/time (UTC): start ... detected ... mitigated ... resolved ...
Severity: SEV_ / SEC        Incident commander: ...        Author: ...

## Summary (3 sentences)
What broke, who was affected, how long.

## Impact
- Users affected (count / % of DAU, source: Sentry / Mixpanel / DB query)
- Which flows, which app versions / OTA groups, which platforms
- Data affected? (Y/N; if Y: what, how many, legal notified when)
- Support contacts / App Store reviews / reports created

## Timeline (UTC)
hh:mm  event, who did what, evidence link
...

## Detection
How did we find out (alert / user / us)? Time from start to detection. Should an alert have caught it earlier?

## Root cause
Technical cause and the contributing conditions (why our safety nets did not stop it: approval gate, fingerprint, tests, review).

## What went well / what went badly / where we got lucky

## Mitigation and resolution
What stopped the impact. What permanently fixes it.

## Action items
| # | Action | Type (prevent / detect / mitigate) | Owner | Due | Ticket |
Include: alert to add, runbook step to fix, test to add, docs to correct.

## Lessons
```
Review action items at the next weekly review; an incident is not closed while its owner-less actions are open.

---

## 8. Pre-launch drills and gaps to close (ranked by effort)

**Do before launch (hours, no code):**
1. Fill the roles table and both founders' access (EAS, App Store Connect, DO, Sentry, GitHub admin, Resend, Netlify, Mixpanel, DB read access). Nico can be reached at all times in the first 72 hours.
2. Create the uptime monitors and Sentry rules (section 5). Route them to both phones. Trigger a test alert on each.
3. Run a rollback drill on the **preview** channel: publish a deliberately broken OTA on `develop`, roll back with `eas update:republish`, and time it, including the two-launch lag.
4. Test expo-updates crash-loop recovery on a TestFlight device (a deliberately crashing OTA on `preview`).
5. Confirm **phased release** is enabled at submission.
6. Do a DO rollback dry run on `backchannel-dev` (Nico).
7. Set `MODERATION_ALERT_EMAIL`, get MX for `backchannel.app`, and make sure alerts reach a phone (§W #4 to #5).
8. Save every command in this doc into a private note both of you can open on a phone.

**Small backend/frontend asks (hours to a day):**
9. Ship §AB #1 `/api/app-config/` (dependency-free). **Until it ships, sections 3.3 and the maintenance steps are aspirational.** Confirm the frontend maintenance/update screens actually render by pointing a dev build at a stubbed endpoint.
10. Wire 2 to 3 real feature flags into `useRemoteFlag` (e.g. resume upload/parsing, sponsor request/premium gate, messaging send) so a flag is a real kill switch.
11. A `PUSH_ENABLED` env kill switch in `services/push.py::send_push`.
12. Redact exception text in `/api/health/ready/`.
13. Lower backend Sentry `traces_sample_rate` from 1.0; confirm `SENTRY_DSN` is set in prod.
14. Add session/release health and a release/dist tag per OTA group to Sentry so a crash maps to an OTA update id (`updateId` from expo-updates as a tag).

**Larger:**
15. A real status page (Instatus/Better Stack) on `status.backchannel.app`.
16. Staging OTA gating: publish to `preview` first and require N hours of clean Sentry before approving `production` (a process rule now, a workflow rule later).
17. Break-glass account access documentation and a secrets-rotation runbook (JWT secret, DB password, Spaces, Resend, Expo, Apple/Google keys, with expiry dates in a shared calendar).
