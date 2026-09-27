# BackChannel accessibility audit (WCAG 2.2 AA + Apple HIG)

Date: 2026-09-26. Branch: feat/launch-readiness. Read-only static audit of the code (no device run). Anything marked **(verify on device)** is a claim about VoiceOver behaviour that follows from how RN maps props to UIKit but that I did not observe live.

Scope: sign-in/signup, onboarding, Home deck (HomeView, VerdictBar, plates), Matches, Inbox/Thread, Profile/Settings, sheets/modals, tab bar, toasts, OfflineBanner.

---

## 1. Executive summary

**Overall grade: C+**

The foundations are better than the label count suggests: there is a real type/color token system, `hitSlopTo44` and a `FontScale` cap policy already exist in `lib/responsive.ts`, the toast already calls `announceForAccessibility`, contrast tokens were already fixed once (muted 5.37:1), the deck is fully button-driven (no swipe-only path), reanimated 4 already defaults to `ReduceMotion.System`, and the cinema/Plan components gate on `useReducedMotion`. The tab bar, TopBar, VerdictBar, auth back/eye buttons and most close buttons are labelled correctly.

What drags the grade down are a handful of **structural** VoiceOver bugs in the most-used screens, not missing labels in general:

1. **The deck plate is one giant "Next plate" button** (`PlateViews.tsx:256-283`). It is a `Pressable` (accessible by default) with `accessibilityLabel="Next plate"`, so VoiceOver reads "Next plate, button" and never exposes the name/claim/role text inside it, or the nested "all experience" link. The core product screen is effectively unreadable to a VoiceOver user. **(verify on device)**
2. **The Inbox screen is wrapped in an accessible `Pressable`** (`MessagesView.tsx:1191`) so the conversation rows nested inside it are likely not individually focusable. Same nesting pattern in `JobCard`/`SponsoredJobCard` (More / applicants buttons inside an accessible card). **(verify on device)**
3. **Thread has no labels on Back, More, or Send** (`ThreadScreen.tsx:518, 626, 907`) and message bubbles do not say who sent them.
4. **19 bottom-sheet components are in-tree overlay Views, not RN `<Modal>`**, with no `accessibilityViewIsModal`, no escape handler, and an unlabelled full-screen backdrop button. VoiceOver can walk into the screen behind the sheet.
5. **Dynamic Type:** only 3 `maxFontSizeMultiplier` usages in the whole app, 117 fixed `height: 36-64` styles, 126 font sizes <= 11pt. The VerdictBar (the primary action) overflows at AX3 and up.
6. **OfflineBanner does not announce on iOS** (`accessibilityLiveRegion` is Android-only), and the toast's Dismiss text is 3.69:1.

### Numbers

| Metric | Count |
|---|---|
| Pressable/Touchable/Switch elements scanned (`app/`, `components/`, tests excluded) | 339 |
| ...with no `accessibilityLabel` | 260 (most have visible Text children, so VoiceOver reads the text; that is acceptable) |
| ...with no `accessibilityRole` | 257 (VoiceOver says the text but not "button") |
| Icon-only or non-text-child touchables with **no label** (real gaps) | ~45 (of which ~28 are backdrops, list in 3.1) |
| `accessibilityLabel` usages | 80 (all in 41 files) |
| `accessibilityState` / `accessibilityHint` / `accessible=` combined | 12 |
| `accessibilityViewIsModal` | 1 (AppConfigGate only) |
| `onAccessibilityEscape` / `accessibilityActions` | 0 / 2 files |
| `maxFontSizeMultiplier` | 3 (tab label, StageTrack, SponsoredJobCard) |
| `TextInput`s / with an `accessibilityLabel` | 62 / 0 |
| `<Modal>` files without `onRequestClose` | 12 (MatchesView alone has 9 Modals, 0 handlers) |
| Reanimated files using `entering=/exiting=` or springs | 54; explicit `useReducedMotion` in 5 |

### Already good (do not re-list)

- TopBar check-in and bell buttons: label, role, hint, count in label, 44x44 (`TopBar.tsx:44-79`).
- FloatingTabBar: role `tab`, label with badge count, `selected` state, capped label (`FloatingTabBar.tsx:98-129`). Missing only a tablist container and the tab-bar height/size notes below.
- VerdictBar: role and role-specific labels ("Pass on this role", "Show interest in this role"), `HomeView.tsx:2524-2531`.
- Deck report flag: 30pt with `hitSlopTo44(32,32)`, label `Report {name}` (`HomeView.tsx:2438-2444`).
- AuthScreen: back button, tab segments (role + selected), password-eye toggle, SSO buttons, "Sign up with email".
- Onboarding skip/next, ModeSelection, Cinema back/stage buttons, Profile remove-entry buttons, Profile photo, all Close (X) buttons on Home/Matches sheets (`FullBioModal`, `JobDescriptionModal`, `GetSponsorModal`, `ProfileActionSheet`, `JobSheetKit`, `PromptsIntake`), HoldToSign (has `accessibilityActions`), AlreadyLikedOverlay, Celebration modal "Continue".
- AppToast announces via `announceForAccessibility` (`AppToast.tsx:82`).
- AppConfigGate uses `accessibilityViewIsModal`.
- Text buttons with visible words (e.g. "Get Started", "Cancel", "Submit Report") already read correctly; they only lack `accessibilityRole="button"`.

---

## 2. Findings by area

### 2.1 Interactive elements without a label/role (icon-only or ambiguous)

Ordered by how often a user meets them.

| Priority | File:line | Problem | Add |
|---|---|---|---|
| High | `components/messages/ThreadScreen.tsx:518` | Back arrow, no label | `accessibilityRole="button" accessibilityLabel="Back to messages"` |
| High | `ThreadScreen.tsx:626` | "..." menu button | `accessibilityRole="button" accessibilityLabel="Conversation options"` |
| High | `ThreadScreen.tsx:907` | Send (paper-plane icon); also the disabled state is only `opacity: 0.5` | `accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !messageText.trim() \|\| sendingMessage }}` |
| High | `ThreadScreen.tsx:527` | Header identity button (avatar + name) | `accessibilityRole="button" accessibilityLabel={\`View ${name}'s profile\`}` |
| High | `ThreadScreen.tsx:789-800` | Message bubbles: sender is only expressed by alignment and color; timestamp only appears after a tap | On the bubble `TouchableOpacity`: `accessible accessibilityLabel={\`${isMyMessage ? "You" : firstName}: ${message.content}, ${timeString}\`}` (compute `timeString` always). Drop the tap-to-reveal for VO or add `accessibilityActions`. |
| High | `ThreadScreen.tsx:854`, `MatchesView.tsx:1117` | Nudge/banner rows; text children are read but ChevronRight is decorative | add `accessibilityRole="button"`; icons hidden (see 2.5) |
| High | `NotificationsFeedView.tsx:425` | Back arrow | `accessibilityRole="button" accessibilityLabel="Back"` |
| High | `NotificationsFeedView.tsx:571` | Feed row (has `accessibilityActions` at :580 but no label/state for unread) | `accessibilityLabel` = title + body + time, add "unread" when unread |
| High | `ApplicantQuestionnaire.tsx:1425`, `SponsorQuestionnaire.tsx:846` | Onboarding photo circle (image or camera icon only) | `accessibilityRole="button" accessibilityLabel={selectedPhotoUri ? "Change profile photo" : "Choose profile photo"}` |
| High | `ApplicantQuestionnaire.tsx:1532`, `ProfileView.tsx:2221` | Résumé dropzone (Upload icon + text is fine, but the wrapper has no role) | `accessibilityRole="button" accessibilityLabel="Upload résumé"` |
| High | `components/profile/NotificationsScreen.tsx:78`, `ProfileView.tsx:1856` | `Switch` with the label in a sibling Text; VoiceOver reads "switch, on" with no name | `accessibilityLabel={label} accessibilityHint={description}` (NotificationsScreen) and `accessibilityLabel="I currently work here"` (ProfileView) |
| High | `profile/EditProfileScreen.tsx:313, 380` | Tag remove "x" (14pt icon) | `accessibilityRole="button" accessibilityLabel={\`Remove ${tag}\`}` |
| High | `EditProfileScreen.tsx:334, 402` | Add-tag "+" (`addTagBtn`) | `accessibilityRole="button" accessibilityLabel="Add tag"` |
| Med | `jobs/SponsorJobModal.tsx:115`, `jobs/TopApplicantsModal.tsx:67` | Close X (`jobsModalStyles.closeButton`) | `accessibilityRole="button" accessibilityLabel="Close"` |
| Med | `jobs/BrowseJobsTab.tsx:193`, `jobs/create/CreateJobUrlScreen.tsx:119` | Clear-text X | `accessibilityRole="button" accessibilityLabel="Clear search"` / `"Clear link"` |
| Med | `jobs/create/CreateJobFetchingScreen.tsx:338, 353, 365` | Back / forward / (chevrons) | `"Back"`, `"Go back in page"`, `"Go forward in page"` |
| Med | `matches/SponsorRequestModal.tsx:140` | ChevronLeft back | `accessibilityLabel="Back"` |
| Med | `jobs/SponsorInsightCards.tsx:172` | ChevronUp collapse | `accessibilityLabel={expanded ? "Collapse" : "Expand"}` + `accessibilityState={{ expanded }}` |
| Med | `HomeView.tsx:1970` | Sponsor role-switcher pill (text is read; role/hint missing) | `accessibilityRole="button" accessibilityLabel={\`Role: ${title}, ${n} waiting\`} accessibilityHint="Switch role"` |
| Med | `MatchesView.tsx:1580` | Undo (text child); role missing; the parent toast is not announced | role `button`; call `announceForAccessibility("Referral withdrawn. Undo available.")` when shown |
| Med | Backdrops: `LikeLimitGateModal.tsx:122,162`; `MarketplaceGateModal.tsx:93`; `SponsorGateModal.tsx:27`; `ProfileCompletionModal.tsx:36`; `FullBioModal.tsx:38`; `GetSponsorModal.tsx:49`; `JobDescriptionModal.tsx:43`; `JobSwitcherSheet.tsx:59`; `WorkEmailVerificationModal.tsx:160`; `PremiumSheet.tsx:54`; `ProfileActionSheet.tsx:59`; `ReportUserSheet.tsx:92`; `ThreadMenuSheet.tsx:74`; `ProfileDetailSheet.tsx:290`; `JobDetailsModal.tsx:73`; `JobMenuModal.tsx:91`; `SponsorJobModal.tsx:89`; `TopApplicantsModal.tsx:46`; `matches/{JobDetailModal:157, ReferralDetailModal:93, RolePickerModal:56, SponsorReferralDetailModal:95, SponsorRequestModal:119, SrJobDetailModal:80, WaitlistedJobModal:62, WithdrawReferralModal:39}`; `AuthScreen.tsx:818` | Full-screen `TouchableOpacity` backdrop with only a `BlurView` child: an unlabelled "button" that is a focus stop | Either `accessible={false}` (if the sheet has its own Close/Cancel) or `accessibilityRole="button" accessibilityLabel="Dismiss"`. Best: one shared `SheetBackdrop` component. |
| Med | Choice rows without role/state (see 2.5 "state") | | |
| Low | 257 text buttons without `accessibilityRole="button"` (largest clusters: `PrivacySecurityScreen` 14, `ProfileView` 15, `WorkEmailVerificationModal` 7, `CheckInStack` 7, `AuthScreen` 7, `HubRow`, `InboxList` rows) | VO reads text without "button" | Bulk-add role. Wrap in a small `<AppButton>`/`<Row>` component so it is applied once. |

### 2.2 Touch targets (< 44x44pt)

`hitSlopTo44` is used correctly on: ThreadScreen back/send/more/refer, AuthScreen segments/eye/forgot, HomeView report flag, JobsView tabs. Fine.

Flag (no hitSlop, visibly < 44 in one dimension):

| File:line | Size | Fix |
|---|---|---|
| `EditProfileScreen.tsx:334, 402` (`addTagBtn`, "+" 18pt icon) | ~32pt | `hitSlop={hitSlopTo44(32,32)}` |
| `EditProfileScreen.tsx:313, 380` (x, 14pt) | has hitSlop but check the value: 14pt icon needs >= 15 per side | `hitSlopTo44(22,22)` |
| `HomeView.tsx:1970` role pill: paddingVertical 9 + 13pt text = ~38pt tall, hitSlop 8 = 54 | OK | none |
| `ProfileView.tsx:1057, 1241, 1726, 1965` Trash (`padding:4`, 18pt icon = 26pt) has hitSlop; verify it is >= 9/side | | `hitSlopTo44(26,26)` |
| `AppToast.tsx:169` Dismiss (`padding 4/8` + 12pt text = ~28pt) has 10pt slop = 48 | OK | none |
| `MatchesView.tsx:1580` Undo (has hitSlop 10) | ~30 + 20 | OK |
| `ThreadScreen.tsx:527` header identity, `InboxList` rows, `ThreadScreen.tsx:707` starter chips | rows tall enough; chips ~34pt | `hitSlop={{top:6,bottom:6,left:0,right:0}}` on chips |
| `SponsorInsightCards.tsx:212` (`siChip`), `JobSheetKit.tsx:554` (ticket row), `RolePickerModal.tsx:148` (`rolePickerMsgBtn`, 16pt icon, no hitSlop) | small | add `hitSlopTo44(w,h)` |
| `FloatingTabBar.tsx:90` tab: 50pt tall, width content-driven (~60+) | OK | none |
| `StatusChip`, `HubRow` badge, count pills | not interactive | n/a |
| `CreateJobFetchingScreen.tsx:338-365` (`rawViewNavBtn`) has slop | OK once labelled | |

### 2.3 Dynamic Type

Baseline: RN scales `Text`/`TextInput` by default on iOS (`allowFontScaling` true, no cap), and `lineHeight` scales with it, so body copy generally follows the OS. The risk is everything inside a fixed height or width. `lib/responsive.ts` already defines the policy (`FontScale.chrome = 1.2`, `control = 1.35`, `label = 1.5`) but only 3 call sites use it.

Approximate iOS content-size multipliers for 15pt body: xxxLarge 1.35, AX1 1.64, AX2 1.95, AX3 2.35, AX4 2.76, AX5 3.12.

Specific clip/overflow risks, with fixes:

| Where | Problem | Fix |
|---|---|---|
| `VerdictBar.tsx:73` `height: 54`, 12pt bold caps, `letterSpacing: 1.8`, `overflow:hidden`, no cap, no `numberOfLines` | "INTERESTED" is ~100pt at 1x; the accept half is ~198pt on a 393pt phone. At AX3 (2.35x) it is ~210pt: it wraps mid-word into 2 lines (2 x 34 = 68 > 54) and the ink half clips it. This is the primary action. | (a) `height: 54` -> `minHeight: 54`; (b) `maxFontSizeMultiplier={FontScale.label}` (1.5) on both Texts; (c) `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}` as a backstop; (d) when `useWindowDimensions().fontScale > 1.5` stack the two halves as a column (`flexDirection: "column"`, each `minHeight: 54`, radius 16). |
| `FloatingTabBar.tsx:43, 350, 371` `BAR_HEIGHT = 62`, tab `height: 50`, label 8.5pt capped at 1.2 (=10.2pt max) | Won't clip, but 8.5pt base is the smallest text on the busiest chrome and stays < 11pt even when the user asked for larger. HIG suggests the large-content-viewer for tab bars. | Base label 10pt, cap `FontScale.chrome` -> 1.3; `capsule.height`/`tab.height` -> `BAR_HEIGHT + Math.round((fontScale - 1) * 10)` clamped at +16 using `useWindowDimensions().fontScale`; `minHeight` rather than `height` on `tab`. Consider `accessibilityShowsLargeContentViewer` through a tiny native wrapper (Tier C). |
| `FloatingTabBar.tsx:379-398` badge `height: 17`, 10pt text, uncapped; same in `TopBar.tsx:137-155` (`headerCountPill` 17pt), `HubRow.tsx:108` (20pt), `HomeView` `roleSwitcherBadge` | Digits taller than the pill at AX sizes | `minHeight` instead of `height`; add `maxFontSizeMultiplier={FontScale.chrome}` on the badge Text. |
| `AuthScreen.tsx:1057 (56), 1135 (60), 1155 (50), 1216/1226 (56)`; `ReportUserSheet.tsx:222,236 (54)`; `AlreadyLikedOverlay.tsx:101 (54)`; `MatchCelebrationModal.tsx:372,388`; `DeckDoneCard.tsx:481 (52)`; `PromptsIntake.tsx:491,501 (48), 585 (56)`; `Onboarding.tsx:670 (60)`; `ThreadScreen.tsx:492 (54)`; input wrappers `height: 56` | Fixed-height inputs and pill buttons: a wrapping label clips, a scaled input value clips vertically | Swap `height: N` for `minHeight: N` (keep `paddingVertical: 14` and `borderRadius` as-is; for `borderRadius: N/2` pills use `borderRadius: 16-20` or keep the pill radius since a tall pill still looks fine). For `TextInput`s, remove the wrapper's fixed height and give the input `minHeight: 56`. There are 117 fixed `height: 36-64` style lines app-wide; the ones on buttons/inputs/chips are the ones to convert (roughly 60). |
| `HomeView.tsx` header, deck counter (`progressCurrent` 20pt serif, `progressTotal` 13pt, `progressDotsRow`) | Header is content-driven (height animates only while collapsing, `HomeView.tsx:1839`); counter grows and pushes the role pill. No clip. | Cap counter at `FontScale.control` for tidiness; group as one accessible element (see 2.5). |
| `PlateViews.tsx:96-195` `numberOfLines` 1-7 on plate copy, `height` fixed by the deck stage | Plate bodies truncate with ellipsis at large sizes and the Read link is the only route to full text; fine for a summary card, but VoiceOver still reads the full string. | Keep, but raise `numberOfLines` for AX sizes: `numberOfLines={fontScale > 1.5 ? undefined : N}`, and make the plate ScrollView-able (or rely on the "Read" section). |
| `OfflineBanner.tsx:47` 12.5pt, `AppToast.tsx:163` `numberOfLines={3}` | Banner wraps to 3-5 lines at AX and overlays TopBar (bell) since it is `position:absolute` at zIndex 90; toast truncates at line 3 | Toast: remove `numberOfLines` or set to 6; Banner: cap 1.3 and/or push content down by measuring height (or render inline above the safe area). |
| `StatusChip.tsx:51` (10pt), `JobsView.tsx:1330` tab 11pt/800, `InboxList` micro-labels, 126 fontSize <= 11 across 30+ files (ProfileView 14, both Cinemas 10 each, Onboarding 8) | Tiny at base; scales OK if not in a fixed box | Raise the floor to 11 for text that carries meaning; keep uppercase micro-caps at 11 and cap at `control`. |

**Recommended global approach** (fits how `constants/theme.ts` defines `Type.*`):

1. `defaultProps` is not an option: React 19.1 (package.json) removed `defaultProps` on function components and RN 0.81 `Text` is one; monkey-patching `Text.render` is fragile. Use a wrapper.
2. Add `components/ui/AppText.tsx`: `<AppText variant="body" scale="body|control|chrome">` that spreads `Type[variant]` and sets `maxFontSizeMultiplier` from a single map (`body: undefined`, `label: 1.5`, `control: 1.35`, `chrome: 1.2`). Body/reading copy never capped (that is what Dynamic Type is for); anything inside a fixed pill/badge/tab gets `chrome`/`control`.
3. Add a small `useTypeScale()` hook returning `useWindowDimensions().fontScale` and a `scaled(px, max)` helper for the few places that need geometry to follow text (tab bar height, badge minHeight, VerdictBar stack switch).
4. Migrate incrementally: 110 files import `Text` from `react-native`; migrate chrome first (`FloatingTabBar`, `VerdictBar`, `TopBar`, `StatusChip`, count pills, `HubRow`, buttons) and add an ESLint `no-restricted-imports` rule for `Text` only in new code.
5. Also add `allowFontScaling` policy to `TextInput` via the same wrapper (62 inputs; they scale by default but the fixed-height wrappers clip).

### 2.4 Color contrast (actual tokens, computed)

Relative-luminance formula, tokens from `constants/theme.ts`.

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| ink #0A0A0A | paper #FFF | 19.80 | pass |
| body #4A4A44 | paper / offWhite / surface / border | 8.92 / 8.54 / 8.17 / 7.26 | pass |
| muted #6B6B64 | paper | 5.37 | pass |
| muted | offWhite / surface | 5.14 / 4.91 | pass |
| muted | border #E8E8E4 | 4.37 | fail normal text (rare pairing; watch for chips using `border` fill) |
| **muted #6B6B64 | ink #0A0A0A | 3.69** | **fail** normal text: AppToast "Dismiss" (`AppToast.tsx:222`, 12pt semibold) |
| mutedOnInk #888880 | ink | 5.54 | pass |
| **faint #8A8A82 | paper** | **3.48** | **fail text**, pass UI (3:1) |
| **faint | offWhite / surface** | **3.33 / 3.18** | **fail text**; UI passes 3:1 |
| faint | ink | 5.69 | pass (cinema screens use it on ink) |
| paper | ink | 19.80 | pass |
| body | ink | 2.22 | fail (never used that way found) |
| danger #C81E1E | paper / surface / dangerLight | 5.74 / 5.25 / 5.24 | pass |
| paper | danger (destructive button) | 5.74 | pass |
| warning #B45309 | paper / surface | 5.02 / 4.60 | pass |
| border #E8E8E4 | paper / offWhite | 1.23 / 1.18 | fail non-text 3:1 (input boundary, 1.4.11) |
| borderStrong #D0D0CA | paper / offWhite | 1.55 / 1.48 | fail non-text 3:1 |
| paper text on ink at opacity 0.5 (disabled bars) | | 3.69 | disabled controls are exempt from 1.4.3 |
| body over the glass tab bar (white 64% wash) on white / mid-grey / near-black content | | 8.92 / 5.84 / **3.71** | worst case (black content scrolled under the bar) fails; on iOS the blur (intensity 38) softens this, still raise the wash to 0.78 |
| white flag icon on `rgba(10,10,10,0.4)` scrim | over white / light grey / mid grey | **2.71 / 2.93** / 7.94 | icon (UI 3:1): fails over light plates (`HomeView.tsx:2765`) |

Where it bites: `Colors.faint` is used as **text** color in about 57 style entries (`color: Colors.faint`, e.g. `NotificationsFeedView.tsx:840,851`, `MessagesView.tsx:1327,1377`, `JobsView.tsx:1344` tab counts, `ModeSelection.tsx:226,267`, `ApplicantPublicProfileView.tsx:484,536,559`, `SponsorPublicProfileView.tsx:349,388,499`, `ApplicantQuestionnaire.tsx:1889,1930,2027,2111`, `ProfileView.tsx:3193`, `PromptsIntake.tsx:467,579`, `SponsorQuestionnaire.tsx:1296`, `Onboarding.tsx:904,949`) and as **placeholder** color in 36 of 57 `TextInput`s (`placeholderTextColor={Colors.faint}`, e.g. every AuthScreen field). The theme file's own comment says never do this. (The cinema/splash uses on ink are fine at 5.69.)

Minimal token tweaks:
- Placeholders: replace `placeholderTextColor={Colors.faint}` with `Colors.muted` (5.14 on offWhite, 5.37 on paper). 36 one-line edits, no token change. (A dedicated `placeholder: "#6E6E68"` gives 4.91 on offWhite if you want it lighter than muted.)
- Text using `faint` on paper/offWhite/surface: change to `Colors.muted`. Leave `faint` for icons/dividers/disabled only.
- `AppToast.tsx:222` dismissText color: `Colors.muted` -> `Colors.mutedOnInk` (3.69 -> 5.54).
- Input boundary: `Colors.border` on inputs is 1.2:1. Either give inputs `borderColor: Colors.borderStrong` darkened to `#8C8C84` (3.39 on paper, 3.24 on offWhite) for **focused/filled** inputs, or accept that the offWhite fill + label satisfies it (WCAG 1.4.11 is debatable for text fields with visible labels; Apple reviewers rarely flag it). Tier C.
- Tab bar wash: `rgba(255,255,255,0.64)` -> `0.78` (`FloatingTabBar.tsx:323`).
- Report flag scrim: `rgba(10,10,10,0.4)` -> `0.55` (`HomeView.tsx:2765`), 4.4+ over white.

### 2.5 VoiceOver flow

**Deck (button-driven: confirmed).** No swipe gesture triggers decisions; PASS/INTERESTED are buttons in `VerdictBar`, plates advance via tap-zone or horizontal scroll, and there is a "Back to the plates" button (`PlateDeck.tsx:411`). Good. Issues:

- Plate content hidden behind `accessibilityLabel="Next plate"` (`PlateViews.tsx:256-267`) and the nested `Pressable` "read" link (`:272-278`) is inside an accessible parent, so it is not separately focusable. Fix: outer `Pressable` gets `accessible={false}` (drop the label), so the eyebrow/name/claim Texts and the read link are individually focusable; add a VO-only control so plates can still advance:
  ```tsx
  const [sr, setSr] = useState(false);
  useEffect(() => { AccessibilityInfo.isScreenReaderEnabled().then(setSr);
    const s = AccessibilityInfo.addEventListener("screenReaderChanged", setSr); return () => s.remove(); }, []);
  ...
  {sr && <Pressable accessibilityRole="button" accessibilityLabel={`Next plate, ${index+1} of ${count}`}
     onPress={() => onTapZone("forward")} />}
  ```
  Also set `accessibilityLabel` on the avatar `Image` in `PlateViews.tsx:49` as `Photo of ${name}` (or `accessible={false}` since the name is adjacent).
- Deck counter (`HomeView.tsx:1912-1917`): "3" and "/10" read as two separate elements, dots are silent, and when `!deckIsActive` it is only `opacity: 0` (still read). Wrap: `accessible accessibilityRole="progressbar" accessibilityLabel={\`Card ${n} of ${total}\`}` on `progressHeaderContainer`, `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"` when hidden.
- Celebration modal (`HomeView.tsx:1495,2547`): "Interest Sent!" modal auto-dismisses after 1.8s and blocks the screen. WCAG 2.2.1 (timing adjustable). Fix: when a screen reader is on, skip the modal and `announceForAccessibility("Interest sent")`, or wait for Continue.
- `MatchCelebrationModal` avatars (two photos) have no labels; the modal is a real `<Modal>` so focus containment is OK. Add `accessibilityLabel` to the title group ("It's a match with {name}").
- Tab bar slides off-screen on scroll (`navTranslateY`) but stays in the accessibility tree. **(verify on device)**: if VO focuses it while hidden, it is announced but invisible; consider `importantForAccessibility` toggle when `navTranslateY > 40`.

**Nested accessible elements (the biggest class).** `Pressable`/`TouchableOpacity` are `accessible` by default, and iOS hides children of an accessible parent. Locations: `MessagesView.tsx:1191` (background Pressable wrapping the whole inbox: set `accessible={false}`), `JobCard.tsx:40` with nested More (`:61`) and applicant button (`:100`), `SponsoredJobCard.tsx:40/77`, `AppToast.tsx:157` (`accessible` container with a nested Dismiss). For cards, keep the card accessible and expose the inner actions with `accessibilityActions={[{name:"more",label:"More options"}]}` + `onAccessibilityAction`, as `NotificationsFeedView.tsx:580` already does.

**Sheets/modals.**
- Only 12 of the sheet hosts are RN `<Modal>` (iOS VoiceOver auto-confines to those). 19 files (list in 2.1 backdrops: all the `matches/*Modal`, `jobs/*Modal`, `LikeLimitGateModal`, `GetSponsorModal`, `WorkEmailVerificationModal`, `ThreadMenuSheet`, etc.) render `<View style={styles.overlay}>` in the tree. Put `accessibilityViewIsModal` on the overlay wrapper (the one already used in `AppConfigGate.tsx:44` is the pattern) and `onAccessibilityEscape={dismiss}` (two-finger scrub). Best done once by making a shared `SheetOverlay` that wraps the backdrop + `DismissibleSheet`.
- `DismissibleSheet.tsx:218-222`: the drag handle is a plain `View`; swipe-to-dismiss is a pure gesture. Escape route exists on most sheets (X or Cancel) but confirm each one: gate sheets rely on "Keep going"/"Got it" (`PremiumCheckout.tsx:211`, `LikeLimitGateModal.tsx:147`), which is fine. Add to `DismissibleSheet`: `accessibilityActions={[{name:"escape"}]}`-style support by exposing `onAccessibilityEscape`, and make the handle `accessible accessibilityRole="button" accessibilityLabel="Close sheet"` (fires `onDismiss`) so VO users always have one, even on sheets without a visible X.
- 12 `<Modal>` files lack `onRequestClose` (`MatchesView.tsx` x9, `ThreadScreen.tsx` x2, `ProfileDetailSheet`, `ReportUserSheet`, `JobSwitcherSheet`, `ProfileActionSheet`, `MatchCelebrationModal`, `HomeIntro`, `ProfileCompletionModal`, `PremiumCelebration`, `DismissibleSheet`). Add `onRequestClose={onClose}`; on iOS this is also what wires the VoiceOver escape gesture on a native modal **(verify on device)**.
- Focus on open: nothing moves VoiceOver focus to a sheet's title. Add `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(titleRef))` in an effect on the two paywall gates and ReportUserSheet (Tier B).

**Announcements.**
- `AppToast`: already announces. Issues: (1) message has no variant ("Couldn't save" vs "Saved"): prefix `"Error: "` / `"Success: "` for the announcement only; (2) the toast is 3.5s (`AUTO_DISMISS_MS`) — extend to ~8s when `isScreenReaderEnabled`; (3) Dismiss button unreachable (nested in accessible container, see above): make the container `accessible={false}` with the Text as `accessibilityRole="alert"` and keep the Dismiss button focusable; (4) `announceForAccessibility` may be interrupted by the focus change when the toast appears above a sheet; acceptable.
- `OfflineBanner.tsx:28-29`: `accessibilityLiveRegion="polite"` is **Android-only**; on iOS nothing is spoken when it appears. Fix:
  ```tsx
  useEffect(() => {
    if (offline) AccessibilityInfo.announceForAccessibility("You're offline. Some things won't load or save.");
  }, [offline]);
  ```
  and announce "Back online" on recovery (needs a `wasOffline` ref). Also `pointerEvents="none"` is fine for touch; it does not hide the banner from VoiceOver.
- Inbox: no announcement when a new message arrives in an open Thread; add `announceForAccessibility(\`${name}: ${content}\`)` for incoming messages (Tier B).

**Forms.**
- 62 `TextInput`s, 0 `accessibilityLabel`. iOS VoiceOver reads a single-line field's placeholder as its label, so single-line fields are usable while empty, but the label disappears once text is entered, and multiline inputs (`ReportUserSheet.tsx:129`, `ThreadScreen`) may not expose the placeholder at all **(verify on device)**. Fix: add `accessibilityLabel` to every input that only has a placeholder (AuthScreen lines 528, 549, 706, 726, 746, 767, 838; all questionnaire/EditProfile/Prompts inputs). Where a visible `<Text style={styles.label}>` exists, use `accessibilityLabelledBy` (Android) and copy the string for iOS.
- Errors: every AuthScreen validation error is a toast only (`AuthScreen.tsx:366-390, 425-429`), never attached to the field. VO users hear the announcement once. Add `accessibilityHint="At least 8 characters"` to the new-password fields, and for validation failures also move focus to the offending field (`ref.focus()`; iOS reads it).
- Password rule ("8 characters") is not stated anywhere visible until it fails.

**Images/decoration.**
- 58 image-ish elements (`Image`, `Avatar`, `CompanyLogo`, `ConvAvatar`); none carry labels. RN `Image` is not accessible by default on iOS, so they are silent, which is fine when a name sits next to them (inbox rows, cards). Cases where the image is the only content: onboarding photo circle (labelled per 2.1), profile photo (already labelled), TopApplicants/Applicant rows (name is Text so fine).
- Decorative icons that VoiceOver may announce inside labelled elements: Lucide icons render SVGs; on iOS `react-native-svg` views are not accessible by default, so this is low risk. Pass `accessibilityElementsHidden importantForAccessibility="no"` only on icons inside elements that override the label (already handled by the label).
- The dark blur backdrops and `ConfirmPop` (`HomeView.tsx:2561`) are decorative: mark `accessibilityElementsHidden`.

**Unread / selected state conveyed only visually.**
- `InboxList.tsx:127, 204, 250, 294`: unread = 7px dot (`MarginDot`) plus bold text. VO says nothing. Add `accessibilityLabel={\`${name}, ${context}, ${preview}${unread ? ", unread" : ""}\`}` on the row.
- Choice rows with only a fill/checkmark change and no state: `ReportUserSheet.tsx:110-124`, `ThreadMenuSheet.tsx:139`, `ApplicantQuestionnaire.tsx:1255, 1339, 1389`, `JobMenuModal.tsx:190`, `SponsorJobModal.tsx:146,176,196`, `SponsorRequestModal.tsx:228,263`, `JobSwitcherSheet.tsx:85`, `SponsorInsightCards.tsx:212`. Add `accessibilityRole="radio"` (single-select) or `"checkbox"` (multi-select) and `accessibilityState={{ selected }}` / `{{ checked }}` (the pattern in `JobSheetKit.tsx:844`).
- Disabled controls are opacity only: `VerdictBar.tsx:35,80`, `ReportUserSheet.tsx:140`, `ThreadScreen.tsx` send, `PremiumCheckout`. Pass `accessibilityState={{ disabled: true }}` (VerdictBar's `disabled` prop already disables the Pressable, which RN maps for you; the others use `disabled=` too: good, but confirm `accessibilityState` is derived).
- Tab bars: `FloatingTabBar` and the segmented `tab` roles (`AuthScreen`, `JobsView`, `ProfileView`) have no `tablist` container; wrap in `accessibilityRole="tablist"`.

### 2.6 Reduce Motion

- **Reanimated 4.1 default**: every `withTiming/withSpring/withSequence/withRepeat` and every layout animation (`entering=`, `exiting=`: FadeInUp, FadeInDown, ZoomIn, SlideInDown, etc.) defaults to `ReduceMotion.System` (confirmed in `node_modules/react-native-reanimated/src/layoutReanimation/animationBuilder/BaseAnimationBuilder.ts:15`). With Reduce Motion on, they jump to the end state. So the 54 animation files are covered by default; no app code uses core `Animated` or `LayoutAnimation`.
- **Explicitly gated**: `IntroCinema.tsx:140-171` and `SponsorCinema.tsx:129-159` (skip the reel), `cinema/engine.tsx:87`, `PlanLedger.tsx:71`, `PlanPicker.tsx:113`.
- **Not governed by the OS setting** (JS timers / time-based sequences, so they still run "as a timeline" even though transitions snap):
  1. `SplashScreen.tsx:160-178` typewriter (`setInterval`): still types; harmless but is motion. Skip typing when `useReducedMotion()`.
  2. `HomeView.tsx:1495,1328` celebration/stamp `setTimeout` sequence (1.8s modal) — timing, see 2.5.
  3. `PlateDeck.tsx:183-187` "swipe teaching nudge" (`withDelay/withSequence/withSpring`, snaps under System) — fine.
  4. Infinite pulses (`SkeletonCard.tsx:21`, `HomeView.tsx:562` livePulse, `Onboarding.tsx:146` breath, `ApplicantJobsBrowseView.tsx:417`, `ResumeReadingFilm.tsx:151,157`, `SplashScreen.tsx:90,205`): under System Reduce Motion these resolve immediately, so OK.
  5. `FloatingTabBar` indicator spring (`:224`) and `expo-image` `transition={150}` (`PlateViews.tsx:54`): tiny; indicator snaps under System.
  6. `Modal animationType="fade"|"slide"`: OS handles.
- Highest-impact to gate explicitly: (1) `Splash` typewriter, (2) `HomeView` celebration timing, (3) `MatchCelebrationModal` `ZoomIn.springify()` + staggered `FadeInDown.delay()` chain (`:104-124`; snaps under System but the delays remain: add `.reduceMotion(ReduceMotion.Always)` is not needed, but remove `delay()` when `useReducedMotion()`), (4) `PremiumCelebration`/`ConfirmPop` haptics-plus-scale.

### 2.7 Color-only state

| Where | Signal | Fix |
|---|---|---|
| Inbox unread (`InboxList.tsx:127`) | dot + bold | VO label "unread" (above) |
| Selected choice rows/chips (ReportUserSheet, questionnaires, menus) | ink fill vs offWhite | has a Check icon in some (ReportUserSheet), not all; add role/state |
| Tab bar active (`FloatingTabBar.tsx:106,122`) | ink vs body plus weight and well | OK; `selected` state present |
| Auth/Jobs/Profile segment tabs | color + 2pt underline | OK |
| Deck progress dots | ink vs `border` (1.23:1) | counter text carries it; give dots a `borderStrong`-level unfilled color or rely on counter |
| Toasts | success/error/info differ by icon only (all ink background) | OK for color-blind; add variant word to the VO announcement |
| CharCounter warning/danger (`CharCounter.tsx`) | color | append "x characters left" text (it likely already shows the number) |
| Send disabled | opacity | `accessibilityState.disabled` |

---

## 3. Prioritized fix list

Effort: S = under 30 min / a few lines, M = a few hours / one component or ~10 files, L = a day or more.

### Tier A: do before App Review (12 items)

| # | File:line | Fix | Effort |
|---|---|---|---|
| A1 | `components/home/plates/PlateViews.tsx:256-283` | Outer `Pressable`: add `accessible={false}`, remove `accessibilityLabel="Next plate"`; add screen-reader-only "Next plate, N of M" button; label the avatar Image. Unblocks the whole deck for VoiceOver. | M |
| A2 | `components/MessagesView.tsx:1191` | Background `Pressable`: `accessible={false}` (rows become reachable). Same audit of `JobCard.tsx:40`, `SponsoredJobCard.tsx:40` (use `accessibilityActions` for More/applicants). | S |
| A3 | `components/messages/ThreadScreen.tsx:518, 626, 907, 527` | Labels/roles as in 2.1; add `accessibilityState.disabled` on Send. | S |
| A4 | `ThreadScreen.tsx:789-800` | Bubble `accessibilityLabel` with sender + time; always compute time string. | S |
| A5 | `components/ui/AppToast.tsx:157-159, 171, 222` | Container `accessible={false}`; message Text `accessibilityRole="alert"`; Dismiss stays focusable with role/label; dismiss color -> `Colors.mutedOnInk`; announce with variant prefix; extend timer to 8s when screen reader is on. | S |
| A6 | `components/ui/OfflineBanner.tsx:28` | Add `announceForAccessibility` on offline and on recovery (2.5). | S |
| A7 | `components/ui/DismissibleSheet.tsx:218-222` | Handle becomes `accessible accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onDismiss}`; accept `onAccessibilityEscape`. | S |
| A8 | 19 in-tree overlay sheets (list in 2.5) | Create shared `SheetOverlay` (backdrop `accessible={false}` + `accessibilityViewIsModal` + `onAccessibilityEscape`) and adopt it, starting with `LikeLimitGateModal.tsx:121,161`, `MarketplaceGateModal.tsx:93`, `AuthScreen.tsx:813-818`, `WorkEmailVerificationModal`, `ThreadMenuSheet`, `GetSponsorModal`. | M |
| A9 | `components/home/VerdictBar.tsx:73, 89-100` | `height:54` -> `minHeight:54`; `maxFontSizeMultiplier={FontScale.label}`; `numberOfLines={1} adjustsFontSizeToFit`; stack vertically above `fontScale 1.5`. | M |
| A10 | Icon-only unlabelled buttons in 2.1 (High rows): `NotificationsFeedView:425`, questionnaire photo (`ApplicantQuestionnaire:1425`, `SponsorQuestionnaire:846`), `EditProfileScreen:313/334/380/402`, `Switch`es (`NotificationsScreen:78`, `ProfileView:1856`), `SponsorJobModal:115`, `TopApplicantsModal:67` | Add label/role as tabled. | S |
| A11 | Placeholder contrast: 36 `placeholderTextColor={Colors.faint}` (AuthScreen 528-846 etc.) and `AppToast.tsx:222` | `Colors.faint` -> `Colors.muted` for placeholders. | S |
| A12 | `components/HomeView.tsx:1495, 2540-2570` | Skip/extend the 1.8s "Interest Sent!" auto-dismiss when a screen reader is enabled; announce "Interest sent". | S |

### Tier B: before public launch (12 items)

| # | File:line | Fix | Effort |
|---|---|---|---|
| B1 | Global | Add `components/ui/AppText.tsx` + `useTypeScale()` with the `FontScale` policy; migrate chrome components first (tab bar, TopBar, StatusChip, badges, HubRow, buttons). | L |
| B2 | 117 fixed-height styles (buttons/inputs): `AuthScreen.tsx:1057,1135,1155,1216,1226`, `ReportUserSheet.tsx:222,236`, `AlreadyLikedOverlay.tsx:101`, `MatchCelebrationModal.tsx:372,388`, `DeckDoneCard.tsx:481`, `PromptsIntake.tsx:491,501,585`, `Onboarding.tsx:670`, `ThreadScreen.tsx:492` | `height` -> `minHeight`. | M |
| B3 | Count pills: `FloatingTabBar.tsx:379-398`, `TopBar.tsx:137-155`, `HubRow.tsx:108`, HomeView role badge | `minHeight` + `maxFontSizeMultiplier={FontScale.chrome}`. | S |
| B4 | `FloatingTabBar.tsx:43, 350-378` | Scale bar height with `fontScale`; base label 10pt; cap 1.3; wash 0.78; wrap in `tablist`. | M |
| B5 | Deck counter `HomeView.tsx:1912` | Single accessible progressbar element; hide when inactive. | S |
| B6 | Choice rows/chips (2.5 list) | Role radio/checkbox + `accessibilityState`. | M |
| B7 | `InboxList.tsx:204,250,294` | Row `accessibilityLabel` incl. "unread" and context; role button. | S |
| B8 | All 62 `TextInput`s | `accessibilityLabel` (+ hint on password fields); focus first invalid field on validation failure. | M |
| B9 | 12 `<Modal>`s without `onRequestClose` | Add `onRequestClose` (incl. 9 in `MatchesView.tsx`). | S |
| B10 | Faint-as-text: ~57 `color: Colors.faint` (list in 2.4) except those on ink | -> `Colors.muted`. | M |
| B11 | Splash typewriter `SplashScreen.tsx:160-178` and `MatchCelebrationModal.tsx:104-124` delays | Respect `useReducedMotion()`. | S |
| B12 | Focus management on sheet open (paywall gates, ReportUserSheet, Match modal) + announce incoming Thread messages | `AccessibilityInfo.setAccessibilityFocus`, `announceForAccessibility`. | M |

### Tier C: polish (8 items)

| # | Fix | Effort |
|---|---|---|
| C1 | Bulk `accessibilityRole="button"` on the ~250 text buttons (via a shared `<AppButton>`/`<Row>` wrapper) | L |
| C2 | Raise sub-11pt text floor (126 sites); ProfileView, both Cinemas and Onboarding first | M |
| C3 | Input border contrast: `#8C8C84` for filled/focused input borders (3.39:1) | S |
| C4 | Report flag scrim 0.4 -> 0.55 (`HomeView.tsx:2765`) | S |
| C5 | `accessibilityShowsLargeContentViewer` for tab bar via a small native wrapper | M |
| C6 | Hide the off-screen tab bar from VO when `navTranslateY` is large | S |
| C7 | Deck dots: darker unfilled dot color; `numberOfLines` relaxations on plates at AX sizes | S |
| C8 | ESLint rules: restrict `Text` imports outside `AppText` in new code; a lint check for `TouchableOpacity`/`Pressable` without role/label | M |

Counts: **Tier A 12, Tier B 12, Tier C 8** (32 items total).

---

## 4. On-device test checklist

Run on a real iPhone (and one iPad), release-like build. Log each as pass/fail with a screenshot.

**VoiceOver (Settings > Accessibility > VoiceOver)**
- [ ] Sign-in: swipe through every element in order (logo, tabs, fields, eye toggle, Forgot, submit, SSO). Each says a name and a role; the fields say what they are after typing.
- [ ] Trigger a wrong password: the error is spoken once without moving focus away.
- [ ] Forgot-password overlay open: swiping cannot reach the sign-in form behind it; two-finger scrub (escape) closes it.
- [ ] Onboarding/questionnaire: photo picker announces "Choose profile photo"; chips announce selected/not selected.
- [ ] Home deck: swipe right through a card. Name, role, claim, chips are each readable (not just "Next plate"); the "all experience" link is reachable; you can advance plates; counter reads "Card 3 of 10"; PASS and INTERESTED work with double-tap; Report is reachable.
- [ ] "Interest sent" is announced and you are not locked behind a 1.8s auto-closing modal.
- [ ] Matches: each row reads person/role/status; check-in banner has a button role.
- [ ] Inbox: rows are individually focusable (A2), unread is spoken; open Thread: Back, Options, Send are named; each bubble says who sent it and when; receive a message and hear it.
- [ ] Profile/Settings: every HubRow says "button"; switches in Notifications have names and hints; Delete/Log out are clearly named.
- [ ] Any bottom sheet (LikeLimit, Marketplace gate, Report, Job detail): focus lands in the sheet, background is not reachable, escape gesture dismisses, a Close button exists.
- [ ] Toast: perform an action that shows a toast; it is announced with "Error"/"Success"; Dismiss is reachable.
- [ ] Turn Airplane Mode on/off: "You're offline" and "Back online" are announced.
- [ ] Tab bar: each tab says its name, "selected", and the badge count.
- [ ] Rotor > Headings/Containers sanity check on each tab.

**Larger Text (Settings > Accessibility > Display & Text Size > Larger Text, drag to AX3, then AX5; also test with the slider in Control Center)**
- [ ] VerdictBar shows full "INTERESTED"/"CONNECT"/"WAITLIST" (no mid-word wrap, no clipping) at AX3 and AX5.
- [ ] Tab bar labels legible, capsule grows or stays intact, badges not clipped.
- [ ] Auth: fields and the submit button do not clip text; scroll works with the keyboard up.
- [ ] Deck header counter and role pill do not overlap; plate copy readable or reachable via Read.
- [ ] Toast text not cut at 3 lines; OfflineBanner does not hide the bell.
- [ ] Inbox rows, Thread bubbles, Profile hub rows, Settings switches all wrap rather than truncate essential info.
- [ ] Sheets: buttons remain fully visible and scrollable; the Close button stays on screen.

**Reduce Motion (Settings > Accessibility > Motion)**
- [ ] Launch cold: the splash typewriter and the intro/sponsor cinema do not autoplay (cinema should skip straight past).
- [ ] Deck decisions, match celebration, plan picker, tab indicator: no springs/zooms; content simply appears.
- [ ] No infinite pulses remain (skeleton, live dot, onboarding breathing).

**Increase Contrast / Bold Text / Smart Invert / Differentiate Without Color**
- [ ] Increase Contrast: placeholders, muted timestamps, and tab labels remain readable; hairline borders visible.
- [ ] Bold Text: no clipped labels; DM Sans/DM Serif still render (custom fonts ignore Bold Text; verify layout, not glyph weight).
- [ ] Smart Invert: photos are not inverted (RN images are not marked as media by default; check that avatars, company logos and plates images look normal; if not, add `accessibilityIgnoresInvertColors` on `Image`).
- [ ] Differentiate Without Color: unread, selected, and disabled states are still distinguishable.
- [ ] Button Shapes: text-only buttons ("Forgot password?", "Undo", "Dismiss") remain identifiable.
- [ ] Voice Control: say "Show numbers"; every actionable element gets a number (icon-only buttons without labels will not be named when you say "Tap Send").
- [ ] Switch Control / Full Keyboard Access on iPad: Tab order moves through fields and buttons in visual order; Escape closes sheets.

---

### Assumptions and limits

- Static analysis only; nothing was run. VoiceOver behaviour on nested accessible elements (A1, A2), on placeholders for multiline inputs, and on the RN `Modal` escape gesture is stated from how React Native maps props to UIKit and should be confirmed by the checklist above.
- Counts come from regex/parse scans over `app/` and `components/` (excluding `__tests__` and `node_modules`); a few `Pressable`s that receive their label through a spread prop would appear as unlabelled in the scan.
- `Colors.faint` on ink (cinema/splash) is 5.69:1 and passes; the ~57 usages counted include some of those, so the fail set is a subset (roughly two thirds).
