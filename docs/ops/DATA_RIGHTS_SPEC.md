# Data Rights: "Download My Data" (CCPA / GDPR access + portability)

**Written:** 2026-09-26. **Audience:** Nico (backend owner) plus Yosef (frontend row). Written in the style of `docs/BACKEND_CHANGES_NEEDED.md` §W/§AB so it can be pasted there as **§AC** once agreed.
**Not legal advice.** Deadlines, exemptions, and what must be included for other people's data are marked "counsel to confirm."
**Grounded in:** backend `docs/schemas/migrations/postgres/*.sql` (real column lists), `queries/purge.py` (the definitive list of every user-keyed table), `views_auth.py`/`services/auth.py` (delete flow to mirror), `settings.py` throttles, and the live Privacy Policy (`~/Desktop/BackChannel-Netlify/privacy.html`, last updated 2026-09-22).

---

## §AC — "Download my data" endpoint 🟠 Medium priority (for Nico; needed before scale, not before App Review)

**Why:** account deletion exists (`POST /api/account/delete/`); access/portability does not. The policy (Section 10, "Access") currently promises a copy **by emailing support**, and `support@backchannel.app` has **no MX today** (§W #4), so today that promise cannot be honoured at all. CCPA gives residents a right to know/access and to portability, and GDPR Articles 15 and 20 do the same for anyone in the EU/UK. Statutory response windows are roughly 45 days (CCPA, extendable once) and one month (GDPR), **counsel to confirm**; a self-serve export makes that a non-issue, and it is a support-cost saver.

### Ask

1. **Endpoints** (all authenticated, JSON):
   ```
   POST /api/account/export/          re-auth in the body, see 3 -> 202 {"request_id": "...", "status": "PENDING"}
   GET  /api/account/export/          latest request: {"request_id","status": PENDING|READY|FAILED|EXPIRED,
                                       "requested_at","ready_at","expires_at","size_bytes"}
   GET  /api/account/export/download/ status READY only -> 200 {"url": "<presigned, 10-min expiry>", "expires_at": ...}
   ```
   The zip is fetched by the app via the short-lived presigned URL returned by an **authenticated** call. **The notification email never contains a data link** (see 5).
2. **Job model:** async on the existing background `ThreadPoolExecutor` pattern (push/email/CDN cleanup already work this way, `services/notifications.py`); no Celery needed at current volume. Never build the zip inside the request: résumé binaries plus a long chat history can blow past Daphne's proxy timeout (the same failure class as §X #2). Statuses live in a new table `user_info.data_requests` (see 6). If the worker dies mid-job, a `PENDING` older than 15 minutes is reported as `FAILED` and can be re-requested without burning the rate limit.
3. **Auth / re-auth (mirrors delete):** requesting an export is an identity-proof action, so it needs more than a bearer token (a stolen phone or session must not be able to exfiltrate a résumé and message history):
   - password accounts: `{ "password": "..." }` (same check as `delete_account`);
   - SSO-only accounts (no password): the same body as the §W #3 delete flow: `{ "provider": "apple"|"google", "identity_token": "<fresh>", "refresh_token": "<current>" }`, resolving to the same `user_sso_identities` row as the caller. **Reuse the deletion verifier; do not write a second one.**
   - Throttle scope `data_export`: reuse the `account_delete` shape, `10/hour` per user/IP on **attempts** (guards password guessing), plus a business limit: **1 successful export per 24 h, max 5 per 30 days** per user (429 with a clear message and `retry_after`).
4. **Format:** one `.zip`, `backchannel-data-<user_id>-<UTC date>.zip`, containing JSON (machine readable, GDPR Art. 20 "structured, commonly used, machine-readable format") plus the user's own uploaded files:
   ```
   README.txt                    what's here, the date, what is NOT here and why (see "Exactly what stays out" below)
   account.json
   profile.json
   applicant_profile.json        (applicants)   |  sponsor_profile.json (sponsors)
   jobs_posted.json              (sponsors; includes sponsored/created jobs and their insider insights)
   likes.json   matches.json   referrals.json   referral_checkins.json
   conversations/<conversation_id>.json    one file per thread (see "Exactly what stays out" for the other party's messages)
   waitlist_and_requests.json
   notifications.json   devices.json   sso_identities.json
   reports_you_filed.json   blocks.json
   feed_activity.json            counts by day + timestamped actions on jobs (not other users' identities)
   files/resume-<name>           the original uploaded résumé file(s)
   files/photo-<name>            the profile photo
   ```
   UTF-8, ISO-8601 UTC timestamps, JSONB/VARIANT columns emitted as native JSON (not stringified). Field names = the DB column names lower-cased, so the output is diff-able against `docs/schemas`.
5. **Delivery:** in-app download after readiness, plus a **notification-only email** to the account email ("Your BackChannel data export is ready. Open BackChannel > Profile > Privacy & Security > Download my data. It's available for 7 days. If you didn't request this, change your password now and contact support@backchannel.app"). A second, immediate email on **request** ("We got a request to export your data...") is the tripwire that tells a real owner their account is being pulled. **Do not put a download link in the email:** email is not a secure channel, and Apple "Hide My Email" relay addresses (`@privaterelay.appleid.com`) do not reliably deliver until the sending domain is registered with Apple (§W #3 ops note). Also send an in-app notification row (`type` new: `data_export`), which respects `notification_preferences`.
6. **Storage and retention:**
   - Write the zip to a **private** prefix in Spaces (`exports/<user_id>/<request_id>.zip`), **never** the public-read image path (§V #2 shows public objects stay public forever). Presigned GET only, 10-minute expiry, `Content-Disposition: attachment`.
   - **Zip expires after 7 days:** a scheduled sweep (or Spaces lifecycle rule) deletes it and sets `status = EXPIRED`. It is re-generable on request.
   - `user_info.data_requests(request_id PK, user_id, status, requested_at, ready_at, expires_at, size_bytes, auth_method, requested_ip?)`: a compliance log so we can prove we responded. Keep the row **2 years** (counsel to confirm the period), pseudonymised on account deletion (null the `user_id`, keep a one-way hash) so the log does not contradict the delete promise.
   - **The account-deletion purge must remove export objects.** Add `exports/<user_id>/` to `queries/purge.py::get_user_file_paths` and `user_info.data_requests` to `PURGE_STEPS` (or the pseudonymisation step). Otherwise Policy Section 9 ("permanently delete ... from our systems") is false for the export copy.
7. **Size caps:** generation must stream tables per user with `WHERE user_id = ...` only (no full-table scans); cap message export at, say, 50k messages and files at 50 MB total (state the cap in the README; counsel to confirm truncation is acceptable) so one heavy account cannot exhaust a worker.
8. **Verification for the locked-out / deactivated:** deactivated or password-lost users cannot use the in-app row. Keep a **manual path** at `support@backchannel.app` (needs MX) where support verifies control of the account email and runs the same export by an admin script. Document it; do not add a public unauthenticated endpoint.

### Exactly what goes in (per table, real columns)

Everything keyed to `user_id` in `queries/purge.py::PURGE_STEPS` is in scope; this list is that list, minus the exclusions below.

| File | Source table (schema.table) | Fields to include |
|---|---|---|
| `account.json` | `user_info.users` | `user_id, username, email, is_active, email_verified, created_at, last_login` (**never** `password_hash`; `is_admin` only if true) |
| `profile.json` | `user_info.user_profiles` | `first_name, last_name, location, city, state, country, photo_url, bio, portfolio_url, linked_in, role_type, is_job_seeker, is_sponsor, notification_preferences, created_at, updated_at`. **Also** `phone_number, date_of_birth, street, zip, international_code` **if any legacy value is stored**. See the policy conflict below. |
| `applicant_profile.json` | `user_info.applicant_profiles` | `industry, range_miles, reason, positions, skills, resume_data, extracted_resume_text, current_role, years_experience, work_authorization, willing_to_relocate, requires_sponsorship, achievements, desired_roles, work_preferences, professional_experiences, education_entries, certifications, languages, insights, created_at, updated_at` |
| `sponsor_profile.json` | `user_info.sponsor_profiles` | `company, job_title, work_email, work_email_verified, linked_in, duration, financial_reward, referral_eligible, referral_experience, open_to_referrals, companies_can_refer_to, insights, created_at, updated_at` |
| `jobs_posted.json` | `jobs.job_postings` (`WHERE sponsor_id = user`) | all columns: `job_id, title, company, location, description, salary_min/max/currency, requirements, experience_level, employment_type, remote_option, created_at, expires_at, is_active, reference_job_id, logo_url, relationship, can_refer` + insight/enrichment columns from migrations 011/012 |
| `likes.json` | `matching.likes` (`WHERE user_id = user`) | `like_id, like_type, job_id, profile_id, status, notes, created_at`. **`profile_id` is another user's id for profile-likes: emit it only as the job context, hash or drop the counterpart id** (see exclusions). |
| `matches.json` | `matching.matches` | `match_id, job_id, status, matched_at, unmatched_at, unmatched_by (as "you"/"them")`, your role in the match; counterpart shown by display name only |
| `referrals.json` | `matching.referrals` (as sponsor or applicant) | `referral_id, job_id, status, confidence_checks, referral_note (the vouch, if you wrote it or it was written about you), created_at, updated_at`; counterpart display name only |
| `referral_checkins.json` | `matching.referral_checkins` (`submitted_by = user`, plus checkins on your referrals) | `checkin_id, referral_id, role, stage, note, created_at` |
| `conversations/*.json` | `messaging.conversations` + `messaging.messages` | conversation `conversation_id, job_id, status, created_at, updated_at`; **your** messages in full: `message_id, body, created_at`. See exclusions for the other party. |
| `waitlist_and_requests.json` | `jobs.job_waitlist`, `matching.sponsor_requests`, `jobs.unsponsor_audit` | `job_id, status, created_at`, `company, notified_count`, `reason, job_title` |
| `feed_activity.json` | `jobs.job_feed_history`, `user_info.profile_feed_history` | `action, timestamp, job_id`; for sponsors' `profile_feed_history`, only `action, job_id, timestamp` plus a per-day count. **Not** `profile_id` (an applicant's user id). |
| `notifications.json` | `user_info.notifications` | `type, title, body, is_read, created_at` and the related job id; **not** `related_user_id`'s identity |
| `devices.json` | `user_info.device_tokens` | `platform, is_active, created_at, updated_at`, token **masked** to the last 6 characters |
| `sso_identities.json` | `user_info.user_sso_identities` | `provider, provider_email, email_verified, created_at, last_login_at` (**not** `provider_subject`, **never** `provider_refresh_token`) |
| `reports_you_filed.json` | `moderation.reports` (`reporter_id = user`) | `report_id, reason, detail, created_at, status`; the reported person as display name only |
| `blocks.json` | `moderation.user_blocks` (`blocker_id = user`) | `created_at` and the blocked person's display name |
| `files/` | `files.image_uploads`, `files.document_uploads` (+ the binary from Spaces) | metadata `filename, content_type, file_size, document_type, uploaded_at`, `parsed_data`, and the **original file bytes** (résumé PDF, photo) |

### Exactly what stays out (and why)

| Excluded | Reason |
|---|---|
| `user_info.users.password_hash`, `user_info.action_tokens` (`token_hash`, `metadata`), `user_sso_identities.provider_refresh_token`, `provider_subject`, full push `device_token` | Credentials and secrets: the export is a file people forward, sync to cloud drives, and lose. |
| **Other users' personal data**: their names beyond the display name already visible in-app, emails (including the Sponsor `sponsor_email` that §V #9 shows to matched applicants; policy Section 6 says login/work email are never shown to other users), photos, résumés, phone/DOB, user ids | Exporting one user's data must not leak another's; Policy Section 6 promises sponsor emails stay private, and the résumé is shared with a sponsor **only after match**. |
| **The other party's message text** in a thread | Their words are their personal data too, and a bulk download is a different act than reading a chat in the app. **Default (conservative):** include your sent messages in full; for received messages include `created_at` and length only, plus a note in the README. **Counsel to confirm** whether GDPR "rights of others" (Art. 15(4)) requires this, or whether full-thread export is acceptable because the user already legitimately holds those messages. |
| **Reports filed against the user**, the reporter's identity, and moderation notes/resolution (`moderation.reports` where `reported_user_id = user`), `user_info.admin_audit_log` entries targeting the user | Policy Section 7: "The person you report is not told who reported them." Exporting reports-about-you would breach that and could expose a reporter to retaliation. There is a legal-exemption angle (safety, ongoing investigation) too: **counsel to confirm** what, if anything, must be disclosed to the subject. |
| Internal/derived operational data: ranking scores, cache entries, Snowflake Cortex intermediates (the app never calls autofill; §W #8) | Not stored per user; nothing to export. Re-check if that changes. |
| **Data at third parties** (Mixpanel analytics profile and events, Sentry crash events, RevenueCat, Expo, Resend logs) | Not in our DB. The README says so, and lists how to reach us for them. Mixpanel identifies by `user_id` and has deletion/export APIs; **Sentry** keys by `user.id`. A fuller programme later would call those APIs (see "Later"). |
| Job listings scraped from ATS (`ats.silver_jobs`) | Not the user's data; public third-party listings. |

### Acceptance

- `POST /api/account/export/` with a wrong password returns 401 and counts against the attempt throttle; a fresh SSO token works for a passwordless account; a second success within 24 h returns 429.
- `GET .../download/` with status `READY` returns a presigned URL that expires; the zip opens, contains every file above for that role, **contains no `password_hash`, refresh tokens, or other users' emails/ids**, and for a two-person conversation shows the caller's messages in full and the counterpart's as metadata only.
- Two users A and B, each with data: A's export contains none of B's fields other than the display name in a match/thread (assert with a test that greps the zip for B's email, user_id, phone, résumé text).
- Deleting the account removes the zip object from Spaces and the `data_requests` linkage; `GET /api/account/export/` then 401s.
- Request and completion each send exactly one email to the account email, with no download link.
- A `PENDING` job killed mid-run is reported `FAILED` and re-requestable.

### Frontend side (Yosef; not started, waits for the endpoint)

- **Row:** Profile > Privacy & Security (`components/profile/PrivacySecurityScreen.tsx`, next to Delete Account), label **"Download my data"**, subtitle "Get a copy of your profile, activity and messages (a .zip)".
- **Flow:** tap > confirm sheet explaining the contents and that other people's information is excluded > re-auth (password field, or the Apple/Google verify button reusing the `deleteAccountWithSso` pattern in `lib/auth-api.ts`) > `POST` > status view ("Preparing... we'll notify you") > when `READY`, `GET /download/` > open the share sheet on the file (expo-file-system + expo-sharing, or a `Linking` open of the presigned URL) > "Available for 7 days" and a "Request again" affordance after expiry.
- **States:** pending (poll on foreground, back-off), failed (retry), rate-limited (show the `retry_after`), expired.
- **Analytics** (new events; add to `lib/analytics/mixpanel.ts`, never include the file contents or ids of others): `Data Export Requested`, `Data Export Ready`, `Data Export Downloaded`, `Data Export Failed { reason }`.
- **Copy for the fallback** (until the endpoint ships, and for locked-out users): "Email support@backchannel.app from your account email and we'll send your data within 30 days." Only honest once MX exists.

---

## Privacy-policy sentences this feature must keep true (live policy, 2026-09-22)

Quote, then the constraint on the implementation.

1. **Section 10, Access:** *"Most of the information we hold about you is visible directly in the app, on your profile. If you'd like a copy of the information we hold about you, email us at the address in Section 15 and we'll provide it."* When this ships, **update the sentence** to point to Profile > Privacy & Security > Download my data (keep the email route as a fallback). Until then, the email route must actually work (MX).
2. **Section 10, rights:** *"...to receive your data in a portable format."* The JSON zip is the implementation of this sentence.
3. **Section 3, What we don't collect:** *"BackChannel does not ask for or collect your phone number, date of birth, street address, or postal code."* **Conflict to resolve before shipping:** the DB still has `phone_number`, `date_of_birth`, `street`, `zip`, `country` columns and legacy rows may hold values (§L). An export that includes them is an admission the sentence is false; an export that omits them is an incomplete access response. **Fix first:** run the §L cleanup (null or drop those columns) so the export truthfully has nothing to show; otherwise change the policy sentence. Do not silently filter them from the export.
4. **Section 6, sharing:** *"Your resume file is shared with a Sponsor once you and that Sponsor have matched"* and *"Your work email address and your login email are never shown to other users."* The export must never contain another user's résumé, phone, DOB, or email; and the export path must not be a new route by which a sponsor's data reaches an applicant (or vice versa). (Independent of this feature, §V #1 and #9 still contradict these two sentences.)
5. **Section 7, Reporting:** *"The person you report is not told who reported them."* Reports about the user are excluded; reports the user filed are included.
6. **Section 9, Data retention and deletion:** *"When you delete your account, we permanently delete your account record, profile, resume and extracted resume text, photos, likes, matches, conversations and messages, referrals, waitlist entries, and device tokens from our systems; remove your uploaded files from storage..."* Export zips are "uploaded files from storage" in the broad sense; they must be deleted with the account and expire on a fixed schedule; the `data_requests` log must not retain identity after deletion.
7. **Section 11, Data security:** *"storing resume files privately so they're only served to people the app is showing them to."* The export includes the résumé file: private prefix, presigned short-expiry, authenticated request only; never the public CDN path.
8. **Section 4 / Section 2 (analytics and diagnostics):** *"Analytics events do not include the contents of your messages, resume, or search terms."* New `Data Export *` events must obey this. The README must be honest that Mixpanel/Sentry hold data we do not export.
9. **Section 8 (automated decisions):** no effect, but **do not** put ranking scores or "insights" produced by internal scoring in the export as if they were a profile of the user; the export lists what the user provided and what the résumé parser extracted (which Section 2 discloses).
10. **Section 12, children:** users under 16 are not permitted; the export README should not be sent to a self-declared minor's parent without verification. (Manual path only.)

**New sentence to add when it ships (draft):** *"You can download a copy of your profile, activity and messages you sent from Profile > Privacy & Security > Download my data. The download doesn't include other people's personal information, credentials, or data that is held only by our analytics and crash-reporting providers; email us if you'd like help with those."* (Counsel to review.)

## Open questions for counsel

Response deadlines and identity-verification standard (CCPA "verifiable consumer request"); whether we must also offer a "Do Not Sell/Share" statement (policy already says we do not sell); handling of authorised-agent requests; whether reports about a user must be disclosed; whether EU/UK users trigger an Art. 27 representative requirement; retention period for `data_requests` records; scope of "rights of others" for conversation text.

## Later (not part of this ask)

Call Mixpanel's export/deletion API and Sentry's user-data API from the same worker so the zip covers vendor-held data; a "delete my analytics data" toggle; an admin script for manual (support) exports; and a DSAR log view for the team.
