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

## Phase 3 — Perceived performance & real-time polish ✅ MOSTLY DONE

Full `tsc --noEmit` + `eslint .` clean — 154 problems, identical to the
Phase 2 baseline (zero net-new). No dependency changes (verified via
`git status` on package.json/package-lock.json).

- [x] **3.4 Chat socket reconnect.** Rewrote the per-conversation WS effect
      with the same cancelled/attempt/exponential-backoff pattern the inbox
      socket already used. On a reconnect (not the first connect) it now
      pulls the latest history and merges it in via a new shared
      `mergeIncomingMessage()` helper (extracted from the live
      `chat.message` handler, which now uses it too) rather than a
      destructive full replace — protects an optimistic send still in
      flight from being wiped if the catch-up fetch lands in that window.
- [x] **3.5 Hydrate deck action state from backend.** Added an
      applicant-only mount effect in HomeView seeding `waitlistedJobIds`,
      `requestedSponsorJobIds` (both from `getWaitlistedJobs()` — the
      backend doesn't distinguish the two, and `handleGetSponsor` always
      sets them together anyway) and `likedIds`/`appliedJobIds` (from
      `getLikedJobs()`, which only ever contains sponsored jobs the
      applicant already liked, since unsponsored jobs are intercepted into
      the Get-a-Sponsor flow before reaching `likeJob`). Banners and
      re-swipe guards now survive a restart.
- [x] **3.1 expo-image adoption.** Converted the shared `Avatar` and
      `CompanyLogo` components (used broadly by Inbox, Matches, Jobs,
      ProfileDetailSheet) plus NotificationsView's row avatar to
      `expo-image` with `cachePolicy="memory-disk"` + 150ms `transition`.
      Scoped to shared/repeated-list components rather than every one-off
      raw `<Image>` in the app (profile-photo pickers, full-bleed hero
      photos, etc. have a different caching profile and much lower
      list-reuse benefit — touching all ~12 files with raw `Image` usage
      wasn't worth the added review surface for this pass).
- [x] **3.3 Animate only new messages.** Added `initialMessageCountRef`,
      reset on every conversation switch and set once history loads;
      `entering` is now `undefined` (no animation) for any message with
      `index < initialCount`, and a plain `FadeInUp.duration(220)` — no
      per-index delay — for anything at or past it. A 100-message history
      now appears instantly instead of cascading in over ~5 seconds.
- [x] **3.2 FlatList conversions — partial**, prioritized by risk/value
      given every list beyond Notifications turned out to be embedded in a
      more complex multi-section/multi-tab container than expected:
      - **Notifications**: full conversion to `SectionList` (real
        virtualization) — it was already a clean, isolated list with a
        genuine header/empty/error/loading split, so the swap was
        low-risk. Sections reshaped to `{title, data}` directly; loading/
        error/empty states moved into `ListHeaderComponent`/an emptied
        `sections` prop.
      - **Browse jobs & Inbox**: capped the stagger delay
        (`Math.min(index, 8) * 40/50`) instead of the full ScrollView→
        FlatList swap. Both turned out to be one list embedded inside a
        larger single-ScrollView screen (JobsView's two tabs share one
        scroll container with a search bar, did-you-mean card, and
        load-more pagination all interleaved; Inbox has three sections
        plus a tap-outside-to-collapse overlay) — restructuring the outer
        container to introduce `FlatList`/`SectionList` there is a
        meaningfully bigger, riskier change than Notifications was, and
        one I can't visually verify without a device. The capped delay
        fixes the actual complained-about symptom (a multi-second
        cascading fade for a full page of cards) without that risk. Full
        virtualization of these two is a reasonable follow-up.
      - **Message thread → inverted FlatList**: evaluated and **deferred**.
        This is the highest blast-radius item in the phase — it touches
        keyboard-avoidance, scroll-anchoring, day-header/clustering logic
        (which key off chronological prev/next and would need re-deriving
        against a reversed array), and the just-added 3.3 animation-index
        logic, all at once, in the app's core real-time messaging surface.
        3.3 already fixes the worst perceptible symptom (the cascading
        fade for long history) without touching any of that. The
        mechanical inverted-list rewrite itself — deleting the
        `setTimeout(scrollToBottom)` calls, reversing data order — is real
        follow-up work, but doing it blind (no simulator/device access
        here) risks breaking the core chat experience in ways that
        wouldn't surface until a human tester hits them.
- [ ] **3.6 React Query persistence — deferred, real blocker found.**
      `@tanstack/react-query-persist-client` (and its
      `query-async-storage-persister` companion) has a peer-dependency
      requirement of `@tanstack/react-query@^5.101.2`; the app has
      `^5.90.18` pinned. Installing it as-is would force npm to resolve a
      core react-query upgrade as a side effect — an app-wide dependency
      bump touching every `useQuery`/`useMutation` call site (JobsView,
      MatchesView, MessagesView, NotificationsView) that I have no way to
      verify without running the app. This turned out not to be the
      "cheap, optional" add-on it looked like on paper. To pick this up:
      bump `@tanstack/react-query` to `^5.101.2`+ deliberately first (its
      own changeset, tested independently), then add persistence as a
      second, isolated step.

## Phase 4 — Structure & type safety ✅ MOSTLY DONE

Full `tsc --noEmit` + `eslint .` clean — 152 problems (down from the 154
Phase-2/3 baseline; zero net-new).

- [x] **4.4 `sponsor_request` notification type.** Added `BellRing` to
      `NOTIFICATION_ICON` and a `sponsor_request` case (routes to Matches,
      same as match/referral — that's where `getSponsorRequests()` rows
      surface) in `handleNotificationPress`'s switch.
- [x] **4.1 Type the API seam — incremental, two entities done.**
      - Extracted `MyJobRow` (named interface) from `getMyJobs()`'s inline
        return type in `lib/api.ts`; `transformMyJobRow` in JobsView now
        takes it instead of `any`.
      - Extracted `ConversationRow` from `getConversations()`'s inline
        return type; added a properly-typed `Conversation` output interface
        in MessagesView; `transformConversation` now takes `ConversationRow`
        and returns `Conversation`, and the `conversations` state/query/ref
        were widened from `any[]` to `Conversation[]` throughout the file
        (the full seam, not just the transform).
      - **Typing this surfaced two real, previously-invisible bugs:**
        `isHidden` was read (to bucket the "Hidden (30+ days inactive)"
        inbox section) but never actually *set* by `transformConversation`
        — that section was permanently empty. Now computed from `LAST_AT`
        against a 30-day threshold. Separately, the transform was reading
        `c.SKILLS`/`c.YEARS_EXPERIENCE` — fields `GET /api/messages/
        conversations/` never returns — always silently falling through to
        empty defaults; removed the dead reads.
      - (`Job`/`transformJobApiResponse` and `transformBrowseResponse`/
        `transformProfilePackRow` were already properly typed from earlier
        phases.) Further incremental target: MatchesView's `Match`/
        `Referral` transforms still lean on `any` casts + UPPERCASE/
        lowercase fallback chains for the dual applicant/sponsor API
        shapes — more effort per the "incremental" framing, left for a
        follow-up pass.
- [x] **4.2 Carve the megafiles at natural seams — partial.**
      - Extracted `WithdrawReferralModal` from MatchesView into
        `components/matches/WithdrawReferralModal.tsx` — genuinely
        self-contained (referral/name/processing-state/two callbacks in,
        no shared animation or lazy-fetch state), the same shape as the
        already-separate `ApplicantCheckInModal`/`ProfileCompletionModal`.
        Verified via `matches.find(...)` name resolution moved to the
        caller so the modal doesn't need the whole `matches` array.
      - **MessagesView → ThreadScreen/Inbox split, and HomeView →
        applicant/sponsor deck card split: evaluated and deferred.**
        Checked how entangled the "natural seam" actually is before
        attempting either: MessagesView has 29 top-level `useState` hooks,
        HomeView has 31 — in both files the vast majority of that state
        (plus refs, animated shared values, and handlers) is read on
        *both* sides of the seam (e.g. MessagesView's `conversations`/
        `setConversations`/`currentUserId`/the per-conversation WebSocket
        effect are all needed inside the thread-view branch too; HomeView's
        `swipeOpacity`/`matchRingScale`/scroll-handler shared values and
        `fullProfileCache`/`sponsorProfileCache` lazy-fetch state span both
        the applicant and sponsor card renders). A real split means
        prop-drilling 15-25+ pieces of state/handlers per file — mechanical,
        but with a large enough surface that a wiring mistake (a stale
        closure, a missed setter) could silently break the core swipe/chat
        experience in a way I can't catch without a device. Same risk
        category as the inverted-FlatList item already deferred in Phase 3
        — for the same file, in fact. The `WithdrawReferralModal` extraction
        above demonstrates the pattern works cleanly where the seam is
        actually self-contained; the other two aren't, yet.
- [x] **4.3 Unify data fetching on React Query — evaluated, deferred.**
      Read through HomeView's manual fetch/cache code before deciding: the
      per-role deck cache (`Map<jobId, {profiles, index, progress,
      fetchedAt}>`) plus `requestId`/`fetchingForJobId` race-guards exist
      specifically to let a sponsor switch roles and land back on the exact
      card they left, without a re-fetch or a progress-bar reset — a
      behavior `useQuery`'s `staleTime`/cache model doesn't map onto 1:1
      (it caches *responses*, not *scroll position within a response*).
      Migrating this without reintroducing the exact "switching roles
      resets my progress" bug the current code was written to fix requires
      either a custom `queryFn` that also restores position (defeating the
      simplification) or accepting a behavior regression — not a safe
      trade to make blind. Deferred alongside the same file's other
      deferred items (3.2d, 4.2's HomeView split) for the same reason: high
      value, but the current manual code is *correct* today, and this is
      the kind of migration that wants a human clicking through role
      switches on a device before merging.

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
