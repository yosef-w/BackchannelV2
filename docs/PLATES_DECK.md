# The Plates deck — "Skim & Dive" (`components/home/plates/`)

The home deck's card body, behind `PLATES_ENABLED` (`constants/config.ts`).

## The grammar

**Sliding is for deciding, scrolling is for reading.**

- The first screen of a card is a **row of full-bleed plates** — one idea
  each — slid through horizontally. Tap the right two-thirds to advance,
  the left third to go back, or drag; the next plate peeks 22pt at the
  right edge so the gesture teaches itself. A light haptic ticks per plate.
- Scroll down from **any** plate and the page continues into **the full
  read** — the existing `ApplicantProfileCard` / `JobCardContent` in
  `presentation="read"` (hero, ledger, and hero quote omitted, since the
  plates carried them). Nothing below the fold is required to decide.
- From plate two onward — and through the full read — a slim **anchor strip**
  pins identity (photo/logo, name, claim line, `PLATE n / N` → `THE FULL READ`).
- The **deck gauge** (3/10) is the only progress bar: the current card's
  segment subdivides into plate ticks (`HomeView` → `plateProgress`).
- ✕/✓ float exactly where they always did and work from any plate. A decision
  lifts the card away (`mainAnimatedStyle`) — the sheet-lift beat.

## Plate order — and where each one deep-links

| Applicant (sponsor looking)              | → lands on   | Job (applicant looking)                 | → lands on     |
|------------------------------------------|--------------|-----------------------------------------|----------------|
| placard — photo, name, claim line        | top          | role — logo, title, comp · where        | top            |
| in brief — the bio's opening (if real)   | ABOUT        | the role, in brief — summary/description opening | ABOUT THE ROLE |
| the record — years stat, seat, receipts  | EXPERIENCE   | what they need — level · type · arrangement, top skills, first requirement | REQUIREMENTS / RESPONSIBILITIES / REQUIRED SKILLS |
| in their words — first prompt (or bio)   | INSIGHTS     | the vouch — sponsor's name, quote, chips | THE VOUCH      |
| why you're seeing them — skill overlap   | TOP SKILLS   | your fit — your skill overlap / match    | REQUIRED SKILLS |

Plates whose data is absent are omitted (`plateContent.ts`). Everything is
**derived, never invented**: claim lines come from achievements → lead
skill → desired role; briefs are the opening sentences of the bio /
summary / description; receipts are real experience rows; fit lines are
computed overlaps (`skillOverlap`).

### The deep link

The cue between ✕ and ✓ is **contextual**: its label is the current plate's
`readCta` ("ALL EXPERIENCE ↓", "FULL DESCRIPTION ↓") and tapping it scrolls
to the plate's `readTarget` section. Sections register their offsets via
`ReadSections.tsx` (`<ReadSection id label>` wrappers in both cards); the
landing section flashes a hairline, and the anchor's right label shows the
section name while reading. A manual scroll is never auto-jumped — it stays
a natural continuous read (the read opens with AT A GLANCE, the ledger).

## Files

- `plateContent.ts` — pure builders + `deriveAnchor` (unit-tested).
- `PlateViews.tsx` — one composition per plate kind; `Rich` renders the
  italic-muted accent spans.
- `ReadSections.tsx` — section registry + `<ReadSection>` (offset, landing flash).
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
