# Screenshot Plan and App Preview

Sizes: iPhone 6.9" (1320 x 2868) and iPad 13" (2064 x 2752). The app sets `supportsTablet: true`, so iPad screenshots are required. Capture from the real app in a simulator on each device class, not from a mockup, so nothing is shown that the app doesn't do. Premium is on in v1, but keep pricing, plans, and limits out of the screenshots anyway: prices change and Apple requires the screenshots to match the current price, which is easy to get wrong. Show the free experience.

Style: light "ink and paper" UI is the brand, so let the app be the visual. Captions in DM Serif Display, ink on paper, top third of the frame, with one word in italic (the app's existing `serifItalic` accent), max 6 words each. Keep one consistent frame treatment across all shots.

## Seed data (one shared script, reused for all screenshots and the video)

Use invented people and companies only. No real logos, no real people, no real company names that imply an endorsement. Use plausible fictional employers (for example "Halcyon Freight", "Northwind Labs" style names) and stock or illustrated portraits you have rights to.

- Applicant account "Maya" (fictional): résumé parsed, photo, 3-line bio, skills, target role in product design.
- Sponsor account "Daniel" (fictional): work email verified, employer fictional, 2 open roles.
- A deck of 10 jobs, first card with a strong logo, title, compensation range, and location; the second and third plates populated.
- A deck of applicants for the sponsor side, first card with a real-looking bio (the "in brief" plate only shows a bio if real, per `docs/PLATES_DECK.md`).
- One match (Maya and Daniel), one message thread with 4 to 5 short realistic messages.
- One referral in flight with a check-in at a mid-pipeline stage.
- Matches tab populated: 2 interested, 1 waitlisted, 1 matched, 1 referred.
- Time of day set to 9:41, full battery, full signal, no notification banners.

## Storyboard (7 screens)

Order rationale: the first three appear in search results and decide the tap, so they must explain the product's premise (a person on the inside), the applicant's first action, and the payoff (a conversation). Sponsor-side and trust screens follow for people who scroll.

| # | Screen to capture | Component / route | Seed state | Caption (max 6 words) | Why here |
|---|---|---|---|---|---|
| 1 | The Feed, applicant view, first job card at the plate view with the VerdictBar showing PASS / INTERESTED | `app/(tabs)/home.tsx` > `components/HomeView.tsx`, `components/home/plates/`, `VerdictBar.tsx` | Maya, first card with logo, title, comp, location, deck gauge at 1 of 10 | "Skip the résumé black hole." | Leads with the pain, and shows the core swipe. Verify wording doesn't over-promise; alt: "Jobs worth asking someone about." |
| 2 | Match moment | `components/home/MatchCelebrationModal.tsx` | Maya and Daniel matched on the fictional role | "An insider says yes." | The payoff of the whole loop. Placed second so the story reads: browse, then it works. |
| 3 | Inbox thread | `app/(tabs)/messages.tsx` > `components/messages/ThreadScreen.tsx` (with `ThreadContextStrip.tsx`) | 4 to 5 messages; the context strip shows the role | "Talk to someone who works there." | Third-slot value is the human conversation, the promise that differs from job boards. |
| 4 | The Signing, the vouch or signature act | `components/messages/ReferralSigningScreen.tsx` | Sponsor side, mid-vouch statement, or the dark signature screen | "Vouch for people worth vouching for." | The most distinctive screen in the app: the single dark screen stands out in a strip of light ones. |
| 5 | Sponsor feed, applicant plate | `HomeView.tsx` with the sponsor role, `ApplicantProfileCard.tsx`, VerdictBar showing CONNECT | Daniel, fictional applicant with real bio | "Meet candidates before the ATS does." | Shows the second side of the marketplace. **[CONFIRM]** the claim is fair; safer: "See the person, not the pile." |
| 6 | Referral check-in | `components/checkin/StageTrack.tsx` in `ApplicantCheckInModal.tsx` | Mid-pipeline stage selected | "Always know where you stand." | The status-tracking benefit. |
| 7 | Verified sponsor and reporting, either the work-email modal or the report sheet | `components/home/WorkEmailVerificationModal.tsx` or `components/ui/ReportUserSheet.tsx` | Modal open; ideally show verified state | "Real employees. Real accountability." | Trust screen. Reviewers and cautious users look here; keep it last. **[CONFIRM]** "real employees" is only true if verification is enforced (it is a soft gate per code comments). Alt: "Verified by work email." |

Optional 8th (only if slots are free): Matches tab, "Every opportunity, one desk." from `app/(tabs)/matches.tsx` / `components/MatchesView.tsx`.

Do not use as a screenshot: the Account/Premium areas, anything with "2 likes", the like-limit gate (`LikeLimitGateModal.tsx`), marketplace gate modals, or the intro cinema in place of app UI (it's beautiful but not the product).

## iPad 13" notes

The app has a split layout on tablet (`lib/responsive.ts`, `isSplit` when width passes the breakpoint). Capture screens 1, 3, 4, 5, 6 on iPad to show the split (list plus detail) layout, and reuse the same captions. Check that no screen looks like a stretched phone layout: reshoot or drop it if so. If any iPad screen has visual bugs, fix it before shipping rather than hide it with framing.

## App Preview video (15 to 30 seconds, portrait 6.9")

Rules: Apple requires it to be captured from the app; screen recording from a device or simulator, no fake UI. No device frame with hands. Keep the music soft and licensed. Provide captions since it autoplays muted.

| Time | Shot | On-screen line |
|---|---|---|
| 0:00 to 0:03 | Feed: first job card, slide through two plates, tap to advance | "A short deck of jobs. Every day." |
| 0:03 to 0:06 | Tap INTERESTED; card stamps and lifts away (`DecisionStamp`) | "Ask the ones you want." |
| 0:06 to 0:10 | Cut to sponsor view: an applicant card, tap CONNECT | "Insiders choose who to back." |
| 0:10 to 0:14 | Match celebration modal | "Both say yes. You're in touch." |
| 0:14 to 0:19 | Thread: messages arriving, quick, natural | "Talk to someone who works there." |
| 0:19 to 0:25 | The Signing: hold to sign | "A referral, signed." |
| 0:25 to 0:28 | Check-in StageTrack fills to the next stage | "Every step, tracked." |
| 0:28 to 0:30 | Paper-white end card with the BackChannel wordmark | "BackChannel" |

The first 3 seconds have to work with no sound; the poster frame (choose in App Store Connect) should be screen 1 or the match moment.

## Product Page Optimization (A/B) ideas

Apple lets you test icon, screenshots, and previews with up to 3 treatments against the original. Run one variable at a time, and wait for the statistical confidence the tool reports. Every result below is a hypothesis; do not assume an outcome.

1. **Screenshot 1, pain-led vs. payoff-led.** A: "Skip the résumé black hole." B: "An insider says yes." C: the thread screen first.
2. **First-three-screens order.** Current (Feed, Match, Thread) vs. (Thread, Feed, Signing).
3. **Caption style.** Serif italic accent word vs. plain sans.
4. **Screenshot 1 device content.** Applicant job card vs. sponsor applicant card, testing which side attracts installs (also informs which side to acquire first).
5. **Icon.** Current icon vs. a version with higher-contrast mark. Icon tests need an alternate icon added to the build (App Store Connect requires the alternate icons be in the app binary), so plan it for an update, not launch.
6. **App Preview on or off** as the first item.
7. **Dark screen early.** Move The Signing (the app's only dark screen) to slot 2 to test if contrast raises tap-through.

Tie each test to a secondary check: conversion (product-page views to downloads) is the metric; also watch that downloads convert to sign-ups in analytics, since a caption that attracts the wrong audience can lift installs and hurt activation.
