# Dual sides: one account, a sponsor side and a job search

**Sponsors only.** Only an account that signed up as a sponsor can add a second side, and that side is always a job search. Sponsors already work somewhere and may be quietly looking; applicants are looking for work and have no employer to refer anyone into, so they never get a sponsor side.

A sponsor can also look for their own next role. One account, two sides, one side on screen at a time.

The app side is built behind `DUAL_SIDES_ENABLED` (`constants/config.ts`). **The backend side is not built.** This document is the contract the app was written against, for whoever implements it.

## Product rules

- Adding the second side is free. The job-search side has the same free limits and the same Premium offer as any applicant. One subscription covers the person, not a side.
- Each side has its own feed, matches, jobs and inbox. Nothing is merged.
- A sponsor's employer must not be able to find out they are looking. See "Privacy rules" below. These are the feature: without them, do not ship it.

## What the app does today

| Piece | Where |
|---|---|
| Vocabulary and pure helpers (`Role`, labels, which side a notification belongs to) | `lib/sides.ts` |
| The sides an account holds (`roles`) and the active one (`role`), persisted | `stores/useAuthStore.ts` |
| Every request names its side: `X-Active-Role: Applicant` or `Sponsor` | `lib/api.ts` |
| A switch: flush profile edits, flip the role, clear caches, refetch the profile | `lib/switchSide.ts` |
| Switcher pill in the top bar (only for an account with both sides) | `components/shell/TopBar.tsx` |
| Switcher sheet, the switch cover, the Account tab card | `components/sides/` |
| Add-a-side screen and route | `components/sides/AddSideScreen.tsx`, `app/add-side.tsx` |
| Optional résumé step, read after the side is added and active | `lib/newSideResume.ts` |
| A notification for the other side switches first, then routes | `app/(tabs)/_layout.tsx` |

Nearly every screen reads one `userType` from the tabs shell, derived from the auth store's active role. Switching sides changes that value and remounts the tabs (`key={userType}`), so no screen carries the other side's state across.

The "add a side" invitation only appears once the profile response includes a `ROLES` list (the app's signal that the backend supports this), or in a development build (`DUAL_SIDES_PREVIEW`). Against today's backend, a release build shows nothing new.

### Development preview

In a development build, when `POST /api/profile/roles/` fails, the app keeps the second side on the device anyway so the flow can be reviewed. The other side then talks to a backend that still sees one role, so its lists will be empty or show errors. That is expected and is not what production will look like.

## Backend contract

What in the current backend assumes one role, and the short version of this contract for Nico, is in [`BACKEND_CHANGES_NEEDED.md` §AF](BACKEND_CHANGES_NEEDED.md). Checked against the backend's `origin/develop` on 2026-11-22: **none of this is built yet.**


### 1. An account can hold both profiles

Today a user has one role, set once. `applicant_profiles` and `sponsor_profiles` are already separate tables, so the change is to allow a user a row in each.

- `GET /api/profile/` adds `ROLES: ["Sponsor", "Applicant"]` (every side the user holds). It keeps `IS_SPONSOR` for older app versions, and returns both `applicant_profile` and `sponsor_profile` when both exist.
- Login and SSO responses keep `role` (the side to open on; the app treats it as the active side) and may add `roles` with the same meaning as `ROLES`.

### 2. A sponsor adds a job search

`POST /api/profile/roles/` (authenticated)

The body is the `Applicant` shape of `POST /api/auth/complete-onboarding/`:

```json
{ "role": "Applicant", "first_name": "…", "last_name": "…", "current_role": "…",
  "positions": ["…"], "work_preferences": ["Remote"], "skills": [], "insights": [] }
```

Returns `201 { "role": "Applicant", "roles": ["Sponsor", "Applicant"], "profile_id": "…" }`.

- `403` if the caller is not a sponsor, or asks for `"role": "Sponsor"`. Applicants never get a second side.
- `400` if the user already holds that side.
- It should be safe to retry: a second identical call after a lost response should return the same success, not an error.
- No new tokens are needed.

### 3. Every request says which side it is for

The app sends `X-Active-Role: Applicant | Sponsor` on every authenticated request. Anywhere the server currently works out the role from the user, it should use this header when the user holds both sides, and reject (`403`) a side the user does not hold. With one side, ignore the header and behave as today.

This is the largest change. It touches at least: the profile read and updates, the job and applicant feeds, likes and waitlists, matches and interested lists, conversations and messages, notifications and the unread count, referrals and check-ins, sponsor requests.

Conversations, matches, referrals and notifications each belong to the side the user held when they were created. A thread where the user is the sponsor must never appear in their job-search inbox.

Three exceptions, each of which matters:

- **`GET /api/profile/` must never fail because of the header.** It is how the app learns which sides the account really holds. If the phone's idea is stale (a side removed on another device) and the profile read itself returned `403`, the app could never correct itself. Ignore an invalid `X-Active-Role` there and return the true `ROLES`.
- **Token refresh, logout and device registration** are per user, not per side.
- **WebSockets cannot send the header.** The per-conversation chat socket should authorise by conversation participant, whichever side that is. The per-user inbox socket may deliver updates for both sides; the app refetches its (side-scoped) list for any conversation it does not recognise, so nothing leaks into the wrong inbox.

### 4. Privacy rules (enforced on the server)

1. A user's job-search profile is never shown to sponsors at their own employer. Match on the sponsor side's company **and** on the verified work-email domain, since a company name can be typed differently.
2. A user never sees roles at their own employer in the job-search feed, and cannot like, waitlist or request a sponsor for them.
3. A user can never match with, message or refer themselves.
4. Nothing in a sponsor's public profile, cards or messages reveals that they also hold a job-search side, and the reverse.
5. If the sponsor side's work email is not verified yet, rule 1 still applies using the typed company.

### 5. Push notifications carry the side

Add `role` (`"applicant"` or `"sponsor"`) to every push payload. The app switches to that side before opening the match or thread. Without it the app can only tell for the types that go to one side (`job_like`, `sponsor_request`, `profile_like`, `waitlist`).

The unread-count and badge endpoints should count the active side only.

### 6. What's waiting on each side

`GET /api/profile/roles/summary/` (authenticated)

The app is built to use this. It feeds the counts in the switcher sheet and a dot on the top-bar pill, so someone on their job search knows three applicants are waiting on their sponsor side.

Unlike every other read, this one is **not** scoped to `X-Active-Role`: it returns every side the user holds.

```json
{
  "sides": {
    "Sponsor":   { "new_interest": 3, "new_matches": 0, "unread_messages": 2, "referral_updates": 1 },
    "Applicant": { "new_interest": 1, "new_matches": 1, "unread_messages": 0, "referral_updates": 0 }
  }
}
```

| Count | Sponsor side | Job-search side |
|---|---|---|
| `new_interest` | Applicants who liked one of your roles and are waiting on you | Sponsors who liked you and are waiting on you |
| `new_matches` | Mutual matches you have not opened | Same |
| `unread_messages` | Unread messages in threads where you are the sponsor | Unread messages in threads where you are the applicant |
| `referral_updates` | Referrals due a status update | Referrals with a new status |

These should be the same numbers the Matches and Inbox tab badges show for that side, so the switcher never disagrees with the tab it leads to.

- Every count is optional; the app treats a missing one as zero and shows nothing for a side with no counts.
- The app calls it when the switcher opens and about once a minute while the app is on screen, so it should be cheap.
- A user with one side never calls it.

### 7. Public profiles, bio and the new side's starting data

- **Public profiles show one side** — the one the viewer relates to — and the cache key includes the side.
- **Bio is per side** for a two-sided user (`applicant_profile.BIO`, `sponsor_profile.BIO`, accepted on each side's PATCH). `classify_resume` writes its bio to the applicant side only. The app already sends and reads it this way for a two-sided account. Name, photo, location, phone, LinkedIn and portfolio stay shared.
- **Seed the job-search side** from the sponsor side on creation: `CURRENT_ROLE` from `JOB_TITLE`, and one current experience entry from `JOB_TITLE` + `COMPANY`. Résumé, skills, education and prompts start empty; the app's profile-completion prompt asks for them before the first like.

### 8. Deleting

Account deletion keeps deleting the whole account and both profiles. Removing only one side is not built in the app and can come later.

## Scenarios the app handles

| Scenario | What happens |
|---|---|
| Sign in to a two-sided account | Opens on the `role` the login returns. The second side is known from `roles` in the login response if sent, else after the first profile read. |
| Close and reopen the app | Reopens on the side last used. |
| A side is added on another device | The switcher appears after the next profile read. |
| A side is removed elsewhere while it is active | The next profile read drops it, the app falls back to the remaining side, clears its lists and returns to the feed. |
| Switch while offline | Refused with a message; nothing changes. |
| Switch with unsaved profile edits | They are saved first. If they cannot be, the switch is refused so the edits are not lost or written to the other side. |
| Switch fails halfway (profile read errors) | The side has changed; screens show their own error and retry states. Profile edits still go to the new side. |
| Requests in flight during a switch | Cancelled or discarded; lists are cleared in the same instant the side changes. |
| Notification for the other side | The app switches, then opens it. If the switch is refused, it stays put. |
| "Add a side" response is lost, user retries | The app re-reads the profile first and treats "already has it" as success. |
| "Add a side" succeeds but the switch is refused | The side is added; a message points to the switcher. |
| Sign out, then a different account signs in on the same phone | The sides start again from that login's role; nothing carries over. |
| Backend does not support dual sides | No invitation, no switcher. The header is sent and ignored. |

## Needs testing once the backend exists

These cannot be checked against today's backend:

- A real add, end to end, for both directions.
- Both sides loading their own feed, matches and inbox after a switch.
- The privacy rules, with two test accounts at the same company.
- A push notification arriving for the side that is not on screen.
- The waiting counts matching the tab badges.

## Not done in the app yet

- Removing one side.
- The analytics `user_type` on the person's profile is not updated on a switch; `Side Switched` and `Side Added` events are tracked.
- Completing the new side's profile uses the Account tab's existing rows (résumé, prompts, work-email verification). There is no guided tour after adding a side.
