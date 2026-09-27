# E2E testing with Maestro

Smoke flows live in `.maestro/`. They were authored statically against the
source (no simulator run yet), so expect a first-run shakedown; see
"Known flakiness" and "testID gaps". Unit tests (Jest) remain the main safety
net; these flows catch what they can't (launch, navigation, native touch
handling, modals).

## Flows

| Flow | Guards |
|---|---|
| `01_launch_and_signin.yaml` | cold launch, splash, role picker reachable, login |
| `02_deck_pass_and_like.yaml` | Pass and Interested/Connect advance the deck |
| `03_report_from_deck.yaml` | Report sheet, toast, card removed (mutates data) |
| `04_settings_and_logout.yaml` | Settings rows open, logout returns to splash |
| `05_tab_navigation.yaml` | every tab tap registers (iOS dead-tab-tap regression, f1273ef + 89f55f5) |
| `06_account_deletion_entry.yaml` | Delete Account entry exists (never deletes) |
| `subflows/login.yaml` | idempotent login used by 02-06 |

`config.yaml` orders them 01, 05, 02, 03, 04, 06 and stops on first failure
(04 logs out; 06 runs after a fresh login through the subflow).

## Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash   # or: brew install mobile-dev-inc/tap/maestro
maestro --version
```
Requires Java 17+ and Xcode with an iOS simulator.

## Run against a simulator

The app id is `com.yosefwolday.backchannelv2`. You need an installed build:

- **EAS preview build for the simulator.** `eas.json`'s `preview` profile is
  `distribution: internal` with no simulator setting, so it produces a
  device build. Either add a profile such as
  `"preview-sim": { "extends": "preview", "ios": { "simulator": true } }`
  (not added; a new EAS build costs a credit) and run
  `eas build -p ios --profile preview-sim`, then drag the `.app` onto the
  simulator; or
- **Local build:** `npx expo run:ios` (development build; points at the dev
  backend).

Then:

```bash
export TEST_EMAIL=applicant-e2e@example.com
export TEST_PASSWORD='...'
maestro test -e TEST_EMAIL=$TEST_EMAIL -e TEST_PASSWORD=$TEST_PASSWORD .maestro
# single flow:
maestro test -e TEST_EMAIL=... -e TEST_PASSWORD=... .maestro/05_tab_navigation.yaml
```

WARNING: the `preview` and `production` EAS environments point at the PROD
backend (`oyster-app`); only `development` points at `backchannel-dev`
(docs/BACKEND_CHANGES_NEEDED.md §AA). Flow 03 files a real report and 02 sends
a real like. Do not run them against prod with a real user's account; use
dedicated throwaway accounts, or a development build.

## Test accounts and env vars

| Var | Meaning |
|---|---|
| `TEST_EMAIL` | email/password login for the test account |
| `TEST_PASSWORD` | its password |

Never hardcode or commit these. Accounts needed (email+password, not SSO,
verified email, profile complete so no completeness gate interrupts the deck):

1. **Applicant** (flows are written for this role; Jobs landmark is
   "The marketplace.").
2. **Sponsor** (deck labels differ: "Pass" / "Connect with this applicant";
   the flows' deck selectors already accept both, but flow 05's Jobs landmark
   is applicant-only and would need a sponsor variant).

The dev DB is currently sparse (§AA: no ATS jobs, thin seed data). Flows 02
and 03 need at least 2 cards in the deck, so run `seed_personas --execute`
against dev first, otherwise they will hit the "caught up" state and fail at
"Report .*". The Jobs tab landmark is static, so 05 does not depend on data.
Each run of 03 permanently removes one deck card for that account; re-seed or
rotate accounts.

## CI sketch (optional, expensive)

macOS runners are billed at 10x; a simulator build plus run is 15-30 min.
Suggest `workflow_dispatch` or nightly only, never per push. Not created.

```yaml
name: e2e
on: { workflow_dispatch: {} }
jobs:
  maestro:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - run: curl -Ls "https://get.maestro.mobile.dev" | bash
      - run: echo "$HOME/.maestro/bin" >> $GITHUB_PATH
      # Build a simulator .app (EAS local build, or download a prebuilt
      # artifact to avoid a build credit each run):
      - run: npm ci
      - run: eas build -p ios --profile preview-sim --local --non-interactive --output app.tar.gz
        env: { EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }} }
      - run: |
          mkdir app && tar -xzf app.tar.gz -C app
          xcrun simctl boot "iPhone 15" || true
          xcrun simctl install booted app/*.app
      - run: maestro test .maestro --format junit --output e2e.xml
        env:
          MAESTRO_TEST_EMAIL: ${{ secrets.E2E_EMAIL }}
          MAESTRO_TEST_PASSWORD: ${{ secrets.E2E_PASSWORD }}
```
(`MAESTRO_`-prefixed shell vars are exposed to flows with the prefix
stripped, so `${TEST_EMAIL}` resolves. Confirm on your Maestro version, or pass
`-e` explicitly.) Upload `~/.maestro/tests` as an artifact on failure.

## testID gaps

Nothing in the app sets `testID`. Selectors are text or accessibilityLabel.
Where those are ambiguous or unstable, a testID should be added (not done):

| Element | Where | Problem |
|---|---|---|
| Email / Password inputs (sign-in) | `components/AuthScreen.tsx:528-529`, `:549-551` | matched by placeholder; "Password" also matches the caption (`:545`), so login uses `index: 1`. Add `testID="auth-email"` / `"auth-password"` |
| Sign In submit | `components/AuthScreen.tsx:589` | matched by text "Sign In", which also equals the tab "SIGN IN" only case-insensitively; add `testID="auth-submit"` |
| Splash "Get Connected" / "Sign in" link | `components/SplashScreen.tsx:265` and `:272` | the link has no accessibilityLabel; matched by nested-text regex |
| Role cards | `components/ModeSelection.tsx:124-131` | no accessibilityLabel, so label is the concatenated card text; `testID="role-applicant"` / `"role-sponsor"` |
| Tab bar items | `components/shell/FloatingTabBar.tsx:98-102` | label changes with badge ("Matches, 3 waiting for you"), forcing regex; add `testID={`tab-${item.name}`}` |
| Deck verdict buttons | `components/home/VerdictBar.tsx:44` and `:56` | accessibilityLabel differs by role, and the visible PASS/INTERESTED/CONNECT/WAITLIST text is not exposed on iOS; add `testID="verdict-pass"` / `"verdict-accept"` |
| Deck card identity | `components/HomeView.tsx` around the card stage (~2425) | nothing identifies the current card; "advanced" is inferred from the Report label. Add `testID` with the card's user/job id on the card container |
| Report Flag button | `components/HomeView.tsx:2444` | label includes the name; add `testID="deck-report"` |
| Report reason rows / Submit | `components/ui/ReportUserSheet.tsx:110-113` (rows), `:140-148` (submit) | text only; add `testID={`report-reason-${value}`}` and `"report-submit"` |
| Toast | toast component (store `useToastStore`) | no accessibilityRole/testID; asserted by text only. Add `testID="toast"` |
| Log Out confirm button | `components/profile/ProfileActionSheet.tsx:96-100` | title, row and button all say "Log Out"; flow 04 uses `index: 1`. Add `testID="logout-confirm"` (accept a testID prop) |
| Settings rows | `components/profile/HubRow.tsx:~40-60` | no accessibilityLabel/testID; add `testID` prop derived from label |
| Delete Account row | `components/profile/PrivacySecurityScreen.tsx:~870` | text only; add `testID="delete-account-row"` |
| Offline banner | `components/ui/OfflineBanner.tsx:26-29` | has role "alert" but no testID; not covered by any flow (would need airplane-mode toggling, unsupported by Maestro on iOS sim); add `testID="offline-banner"` |
| Onboarding / questionnaire | `components/Onboarding.tsx`, `components/ApplicantQuestionnaire.tsx`, `components/SponsorQuestionnaire.tsx` | not covered (sign-up creates accounts); no selectors audited in depth |

## Known flakiness

- **Deck cross-fade / stamp animations.** Cards fade by opacity and a
  DecisionStamp plays (STAMP_MS) after a verdict; during it the old and new
  labels can briefly coexist. The flows use `extendedWaitUntil`, not fixed
  sleeps; keep it that way. Consider a test-only reduced-motion setting.
- **Same-name consecutive cards** break the "card changed" assertion in 02/03.
- **Network / cold start.** Splash, login and deck load hit the backend;
  timeouts are 30-45s for those. Cold Render/DO backends can exceed that.
- **Interrupting modals.** Like-limit gate, profile-completeness gate, work
  email verification (sponsors), match celebration ("KEEP GOING" is handled),
  rating prompt, force-update gate (AppConfigGate) can all cover the deck.
  Use a fully completed, fresh test account.
- **iOS permission prompts.** `launchApp` denies notifications; other system
  dialogs are not handled.
- **Keyboard.** The email/password `tapOn` by placeholder can fail once
  the field has content or autofill (Passwords/strong-password suggestion)
  intercepts. Turn off simulator "AutoFill Passwords".
- **Scrolling.** Account-tab rows are below the fold; `scrollUntilVisible`
  depends on the layout height (small devices scroll more).
- **Unverified selectors.** Everything here is from reading source. In
  particular whether Maestro's iOS matcher sees the Pressable accessibility
  labels (vs. child text) and nested `<Text>` merged strings should be
  confirmed once with `maestro studio`.
