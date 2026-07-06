# Audit Remediation Plan — July 2026

Source: full app audit (2026-07-06). Branch: `audit-remediation-2026-07`.
Each phase is independently shippable and ordered by risk-adjusted value:
bugs first, data integrity second, feel third, structure fourth.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Correctness bugs & dead code (low risk, mechanical) ✅ DONE

Fixes the two live rendering bugs by eliminating their root cause
(duplicated transforms), plus deletions and small behavioral bugs.
Net diff: -970 lines across 18 files. Full `tsc --noEmit` + `eslint .`
clean (zero new errors/warnings).

- [x] **1.1 Shared entity transforms.** Added `types/profiles.ts`
      (`transformProfilePackRow`/`transformProfilePackRows`) and used it on
      all three HomeView load/retry/refresh paths — the "No Applicants"
      Refresh path was the confirmed live bug (raw untransformed rows →
      broken "?" cards). JobsView's error-retry now calls the existing
      `transformBrowseResponse` instead of a stale inline copy (was missing
      `cleanJobText` + hardcoded `isSponsored:false`). Also extracted
      `transformMyJobRow()` in JobsView, deduping `refreshMyJobs` /
      `initMyJobs` — found they'd *already* drifted (`initMyJobs` was
      missing `pendingApplicants`, so the "N new" badge read wrong until
      the sponsored tab was manually opened).
- [x] **1.2 Delete dead code.** Removed `PublicProfileView.tsx`,
      `useProfilesStore.ts`, the themed/icon-symbol/color-scheme scaffold
      cluster (verified closed island via grep, zero external importers),
      fake hardcoded success stories in ProfileView, vestigial
      `message`/`activeSlide`/`handleScroll` state in MessagesView, and the
      entire dead `applicationStatus` subtree in MessagesView (confirmed
      `transformConversation` never produces that field — verified before
      deleting): `getApplicationFromConversation`, the header "Status"
      button, the full Application Detail Modal, plus orphaned styles.
      Bonus find: the identical dead `getStatusLabel/DotColor/BadgeStyle/
      TextColor` quadruple existed *again*, unused, in ProfileView —
      removed there too. Net: **-970 lines**.
- [x] **1.3 Logout/delete hygiene.** `confirmLogout` now also calls
      `cancelCheckInNudges(userType)`. `handleDeleteAccount` now also
      cancels deck reminders + check-in nudges and calls `resetJobsStore()`
      + `clearOnboarding()` — full parity with logout.
- [x] **1.4 Analytics accuracy.** `handleGetSponsor` (HomeView) now tracks
      `trackSponsorRequested`/`trackJobWaitlistJoined` and sets local
      requested/waitlisted state independently per promise result, instead
      of unconditionally on both. Shows an error toast if both legs fail
      instead of a false "Request sent!" step.
- [x] **1.5 Bell badge honesty.** Removed the optimistic zero-on-tap in
      MainApp (the comment claiming NotificationsView auto-marks-read was
      false — it's a manual button). Badge now refreshes via
      `fetchUnreadCount()` when the user leaves the Notifications screen.
- [x] **1.6 Render-path logging.** Removed the unconditional per-render
      `console.log("[HomeView] Using data:", ...)` and the redundant
      full-payload `JSON.stringify(response)` dump in the sponsor
      profile-pack fetch (the two logs immediately after it already cover
      count + sample).

## Phase 2 — Data integrity (profile sync) ✅ DONE

The "I deleted it and it came back" class. Touches the store + auth-api seam.
Full `tsc --noEmit` + `eslint .` clean (154 problems vs. 155 pre-Phase-2 —
one fewer, from fixing a real missing-dependency warning; same 34
pre-existing errors untouched).

- [x] **2.1 Deletions must sync.** Redesigned `authApi.updateProfile(data,
      dirtyFields)` to take the new `dirtyFields: Set<SyncableField>` (see
      2.2) and send each dirty top-level group **in full**, including
      now-empty values, instead of guarding every subfield with `if (x)`.
      Untouched groups are omitted from the payload entirely rather than
      sent-if-truthy, so an unrelated sync can no longer blank out a field
      the user never touched.
- [x] **2.2 Dirty-field merge.** Added `dirtyFields: Set<SyncableField>` to
      `useUserProfileStore`, marked by every `updateXXX` method (via a new
      `withDirty` helper) and persisted to AsyncStorage
      (`autofill_dirty_fields`) on every change. `syncToBackend` now sends
      only dirty fields, snapshots what it sent, and — critically — only
      clears a field's dirty flag if it *still* matches the snapshot after
      the request resolves; if the user edited it again mid-flight, it
      stays dirty and goes out with the newer value on the next sync
      instead of being lost. `fetchFromBackend` now overrides its merge
      with the pre-fetch local value for any dirty field, so a fetch
      racing an in-flight edit (or one clearing a field) can't resurrect
      stale/deleted data.
- [x] **2.3 Flush on background.** Module-level `AppState` listener in
      `useUserProfileStore.ts`: any transition away from `active` calls the
      new `flushSyncNow()`, which cancels the debounce timer and syncs
      immediately if `dirtyFields` is non-empty.
- [x] **2.4 Retry on launch.** `dirtyFields`/`needsSync` are restored from
      AsyncStorage in `loadFromStorage`. `_layout.tsx`'s existing
      accessToken-gated effect now calls `flushSyncNow()` before
      `fetchFromBackend()`, so a sync interrupted by the app being killed
      retries as soon as auth is ready, and the follow-up fetch reflects
      the just-pushed edit rather than racing it.
- [x] **2.5 ProfileView hydration fix (scoped).** Investigated the full
      ~30-field mirrored-`useState` removal and found the concrete risk
      narrower than expected: `MainApp` conditionally renders
      `ProfileView` (`{activeView === "profile" && <ProfileView/>}`), so it
      unmounts/remounts on every tab switch — fresh `useState` defaults
      already coincide with the old truthy-guard's skip behavior in the
      common case, and `handleSaveField` already sets local state directly
      at edit time independent of the hydration effect. The one real,
      narrow defect — the hydration effect's truthy guards could freeze a
      field at its last non-empty value instead of ever reflecting a
      backend-confirmed clear — is fixed: the effect now mirrors
      `userProfileData` unconditionally (also fixed a genuine missing
      `pendingWorkEmail` dependency along the way). The larger "one state,
      not three" architectural cleanup (removing the mirrored fields
      entirely) is a bigger, lower-value refactor now that the actual data-
      loss bug is fixed at the store layer — deferred as optional follow-up
      rather than done here, per this plan's own note that it could be
      split out.

## Phase 3 — Perceived performance & real-time polish

- [ ] **3.1 expo-image adoption.** Swap RN `Image` → `expo-image` for
      repeated imagery (inbox/matches/notifications avatars, company logos):
      `cachePolicy="memory-disk"`, ~150ms `transition`, placeholder. (Or
      drop the dependency — decision: adopt.)
- [ ] **3.2 FlatList conversions** (priority order):
      1. Browse jobs (50 cards, staggered animations — cap delay at
         `min(index, 8) * 40`)
      2. Notifications (swipeable rows)
      3. Inbox
      4. Message thread → **inverted** FlatList; delete the three
         `setTimeout(scrollToBottom)` hacks
- [ ] **3.3 Animate only new messages.** Track message count at thread open;
      `entering` only for `index >= initialCount`, no per-index delay on
      history.
- [ ] **3.4 Chat socket reconnect.** Per-conversation WS has no retry (inbox
      WS does): apply the same exponential-backoff pattern, refetch history
      on reconnect.
- [ ] **3.5 Hydrate deck action state from backend.** Seed
      `waitlistedJobIds` / `likedIds` / `requestedSponsorJobIds` from
      `GET /api/jobs/waitlist/mine/` + `/api/likes/jobs/` on deck load so
      banners survive restarts and re-swipes don't re-prompt.
- [ ] **3.6 React Query persistence (optional but cheap).**
      `persistQueryClient` + AsyncStorage persister on
      matches/conversations/notifications keys → instant warm-open paint.

## Phase 4 — Structure & type safety (enables everything after)

- [ ] **4.1 Type the API seam.** The transforms from 1.1 take the existing
      api.ts response interfaces as input and return declared types
      (`Job`, `Match`, `Conversation`, …); views consume typed outputs and
      shed their `any`s. Incremental — do it entity by entity.
- [ ] **4.2 Carve the megafiles at natural seams** (no rewrite):
      - MessagesView → `ThreadScreen` + inbox (split already exists at the
        `if (selectedConversation)` branch ~:1281)
      - HomeView → applicant deck card + sponsor deck card components
      - MatchesView → extract the self-contained `<Modal>` blocks
- [ ] **4.3 Unify data fetching on React Query.** Migrate HomeView/JobsView
      manual fetch + race-guard + TTL code (deck cache Map, requestId refs,
      `fetchingForJobId` snapshots) to `useQuery` with `staleTime`; deletes
      ~150 lines of the trickiest concurrency logic.
- [ ] **4.4 `sponsor_request` notification type.** Add icon + deep link
      (route to Matches) in NotificationsView; currently falls to default
      bell with a dead tap.

## Phase 5 — Backend-dependent (frontend is already wired; coordinate)

Tracked here so they don't get lost; each lights up dormant frontend UI.

- [ ] **5.1 `POST /api/reports/`** — reports currently go nowhere while the
      UI confirms "Reported". Safety + App Store UGC requirement. Highest
      priority backend item.
- [ ] **5.2 `GET /api/ats/organizations/`** — enables the "did you mean"
      company-correction flow on an empty sponsor board.
- [ ] **5.3 `WORK_EMAIL_VERIFIED` on public profiles** — "Verified employee"
      trust badge renders automatically.
- [ ] **5.4 Join `LOGO_URL`** onto matches / liked-jobs / referrals /
      conversations — five screens upgrade from initials to logos.
- [ ] **5.5 `CHECKIN_STAGE` on `/api/referrals/`** (§N2) — cross-party
      pipeline timeline instead of device-local.
- [ ] **5.6 Dedicated interested-applicants endpoint** — replaces the
      N+1 (`getMyJobs` + per-job `getJobApplicantsLikes`) in MatchesView.
- [ ] **5.7 Job stats for sponsors** — surface recorded feed actions back
      ("viewed 40× this week") on SponsoredJobCard. New data product.
- [ ] **5.8 Verify EAS production env vars** — `EXPO_PUBLIC_API_BASE_URL`,
      RevenueCat keys, Places key set in EAS dashboard (eas.json production
      profile only defines Sentry vars).

---

## Suggested sequencing

| Phase | Scope | Risk | When |
|---|---|---|---|
| 1 | Bug fixes + deletions | Low | First — one PR |
| 2 | Sync integrity | Medium (touches every profile edit) | Second — own PR, test edit/clear/relaunch flows |
| 3 | Perf & polish | Low-medium | Third — can parallelize with backend Phase 5 |
| 4 | Structure/types | Medium (wide diffs, low behavior change) | Fourth — after 1-3 stabilize |
| 5 | Backend coordination | — | Start 5.1 (reports) immediately; rest opportunistic |
