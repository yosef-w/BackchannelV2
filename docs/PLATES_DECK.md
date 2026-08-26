# The Plates deck — "Skim & Dive" (`components/home/plates/`)

The home deck's card body, behind `PLATES_ENABLED` (`constants/config.ts`).

## The grammar

**Sliding is for deciding, scrolling is for reading.**

- The first screen of a card is a **row of full-bleed plates** — one idea
  each — slid through horizontally. Tap the right two-thirds to advance,
  the left third to go back, or drag; the next plate peeks 22pt at the
  right edge so the gesture teaches itself. A light haptic ticks per plate.
- Scroll down from **any** plate and the page continues into **the full
  dossier** — the existing `ApplicantProfileCard` / `JobCardContent` in
  `presentation="dossier"` (hero, ledger, and hero quote omitted, since the
  plates carried them). Nothing below the fold is required to decide.
- From plate two onward — and through the dossier — a slim **anchor strip**
  pins identity (photo/logo, name, claim line, `PLATE n / N` → `THE DOSSIER`).
- The **deck gauge** (3/10) is the only progress bar: the current card's
  segment subdivides into plate ticks (`HomeView` → `plateProgress`).
- ✕/✓ float exactly where they always did and work from any plate. A decision
  lifts the card away (`mainAnimatedStyle`) — the sheet-lift beat.

## Plate order

| Applicant (sponsor looking)        | Job (applicant looking)          |
|-----------------------------------|----------------------------------|
| placard — photo, name, claim line | role — logo, title, comp · where |
| record — years stat, seat, receipts | setup — ledger rows           |
| voice — first prompt (or bio)     | vouch — sponsor's name, quote, chips |
| fit — why you're seeing them      | fit — your skill overlap / match |

Plates whose data is absent are omitted (`plateContent.ts`). Everything is
**derived, never invented**: claim lines come from achievements → lead
skill → desired role; receipts are real experience rows; fit lines are
computed overlaps (`skillOverlap`) against the sponsor's active role
(`myJobs` skills) or the applicant's own profile skills.

## Files

- `plateContent.ts` — pure builders + `deriveAnchor` (unit-tested).
- `PlateViews.tsx` — one composition per plate kind; `Rich` renders the
  italic-muted accent spans.
- `PlateDeck.tsx` — owns the vertical `Animated.ScrollView` (HomeView's
  chrome hide-on-scroll handler + scroll ref pass straight through), the
  horizontal plate row, and the anchor.
- `plateStyles.ts` — paper/ink tokens, DM Serif/Sans, `BUTTON_ZONE`
  (plates keep clear of the floating buttons), `ANCHOR_HEIGHT`.

## Rollback

`PLATES_ENABLED = false` restores the single-scroll card untouched — the
fallback branch in `HomeView` is the previous render, and both cards default
to `presentation="full"`.

## Next (not yet built)

- AI-composed claim lines (one cached call per profile at classify time)
  can replace `deriveApplicantClaim` without touching the plates.
- A "plate seen" analytics event per index for funnel insight.
