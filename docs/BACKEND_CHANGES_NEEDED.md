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
