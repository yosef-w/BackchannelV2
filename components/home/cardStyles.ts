import { StyleSheet } from "react-native";
import { Colors, Fonts, Type } from "@/constants/theme";

/**
 * Shared style cluster for the Hinge-style profile/job cards rendered by
 * ApplicantProfileCard (sponsor view) and JobCardContent (applicant view)
 * in HomeView. Extracted verbatim — both components render the same
 * visual language (hero, sections, insight cards, timelines, chips) for
 * different data shapes, so the styles were already shared before the
 * split and stay shared now.
 */
export const cardStyles = StyleSheet.create({
  // ── Hero — "Dossier" ID block (2026-08 K redesign) ────────────────
  // PM feedback: the old centered avatar hero surfaced only photo, name,
  // and title, burying the standout facts below the fold. The dossier
  // hero is a passport-style ID row (modest square photo beside the
  // identity — deliberately not a dating-app portrait) followed by a
  // hairline LEDGER of the facts that decide the swipe. Shared verbatim
  // by both decks: applicant cards (EXPERIENCE / SHARPEST AT / KNOWN
  // FOR) and job cards (COMPENSATION / THE SETUP / YOUR FIT / YOUR
  // SPONSOR).
  kHero: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  kIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  kIdPhoto: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  kIdPhotoFallback: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  kIdPhotoInitial: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    color: Colors.paper,
  },
  kIdText: {
    flex: 1,
    minWidth: 0,
  },
  // Names and job titles are headline-tier (serif), same rule as
  // ProfileIdentityCard — sized for a column beside the ID photo, with
  // numberOfLines at the call site handling the long tail.
  kIdName: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 29,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  kIdSub: {
    fontSize: 13.5,
    fontWeight: "500",
    color: Colors.body,
    lineHeight: 19,
    marginTop: 5,
  },
  // The italic accent inside the sub-line (desired role / company) —
  // the site's signature serif-italic-muted emphasis.
  kIdSubEm: {
    fontFamily: Fonts.serifItalic,
    fontSize: 14.5,
    color: Colors.muted,
  },
  // The hairline ledger. Rows own their bottom rule, and the top rule
  // closes the box — so the ledger also replaces the old hero divider.
  kLedger: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // The same ledger inside the full read's AT A GLANCE section — the
  // section label provides the spacing the hero's marginTop did.
  kLedgerRead: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  kLedgerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // 11px floor (not the app's 12px section-header floor: these are table
  // keys, not section headers) with a fixed key column so values align
  // into a scannable ledger. Width is sized off the longest key
  // (COMPENSATION ≈ 101px at this size/tracking) with real headroom —
  // a wrapped key orphans its last letter onto a second line, which is
  // exactly the widow bug this width exists to prevent. Call sites also
  // set numberOfLines={1} as the backstop.
  kLedgerKey: {
    width: 118,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: Colors.muted,
    paddingTop: 2,
  },
  kLedgerValueWrap: {
    flex: 1,
    minWidth: 0,
  },
  kLedgerValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.ink,
    lineHeight: 19,
  },
  kLedgerValueSub: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.muted,
    lineHeight: 17,
    marginTop: 2,
  },
  // Pull-quote — the candidate's/sponsor's own words promoted from the
  // buried Q&A list to right under the ledger. "In their own words" is
  // the product's differentiator; it reads as editorial, not résumé.
  kQuote: {
    paddingTop: 22,
    paddingBottom: 4,
  },
  kQuoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 40,
    lineHeight: 42,
    color: Colors.faint,
    marginBottom: -10,
  },
  kQuoteText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 19,
    lineHeight: 27,
    color: Colors.ink,
  },
  kQuoteAttr: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.muted,
    marginTop: 10,
  },
  // INSIGHTS quote bands — the hero pull-quote's voice one step smaller,
  // so the promoted first answer keeps primacy.
  kInsightQuoteGap: { marginTop: 22 },
  kInsightQuoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 32,
    color: Colors.faint,
    marginBottom: -8,
  },
  kInsightQuoteText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16.5,
    lineHeight: 24,
    color: Colors.ink,
  },
  // Top-of-card badge row (status pills + SPONSORED ROLE) — left-aligned
  // to match the dossier hero's left rag.
  kBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },

  // ── "Liked your role" top-of-card pill ────────────────────────────
  likedYourRoleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },

  // ── Section primitives ────────────────────────────────────────────
  // ── The read's sections (2026-08 rebrand pass) ───────────────────
  // Caps labels at the 12pt floor, DM Sans body in the body token, serif
  // for anything that names a role or a credential, hairlines instead of
  // boxes, paper chips instead of gray ones. No hex grays.
  hingeSection: { paddingVertical: 18 },
  hingeSectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.muted,
    marginBottom: 12,
  },
  hingeBodyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.body,
    lineHeight: 23,
  },

  // ── At-a-glance stats strip (sponsor view) ────────────────────────


  // ── Chip wrapping (skills, credentials, role details) ─────────────
  hingeChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hingeSkillChip: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  hingeSkillChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Colors.ink,
  },

  // ── Timeline (experience, education) ──────────────────────────────
  hingeTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  hingeTimelineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.ink,
    marginTop: 8,
  },
  hingeTimelineBody: { flex: 1, minWidth: 0 },
  // Roles and degrees are headline-tier — serif, like every name/title.
  hingeTimelineTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.ink,
  },
  hingeTimelineSubtitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.body,
    marginTop: 3,
  },
  hingeTimelineMeta: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: Colors.muted,
    marginTop: 4,
  },
  hingeTimelineDescription: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.body,
    lineHeight: 21,
    marginTop: 8,
  },

  // ── Credentials (certifications, languages): flat hairline rows, not
  // gray boxes — the ledger's voice ──────────────────────────────────
  hingeCredentialList: {},
  hingeCredentialBlock: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hingeCredentialName: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.ink,
  },
  hingeCredentialMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Colors.muted,
    marginTop: 3,
  },

  // ── Status pills (waitlisted / applied / sponsored role) — rendered
  // inside kBadgeRow at the top of the card ──────────────────────────
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.4,
  },

  // ── The Vouch — sponsor zone (2026-08 P redesign) ─────────────────
  // The product's core mechanic — a real person staking their name on a
  // role — rendered as typography instead of an inset gray card. A
  // hairline rule opens the section, a serif statement leads ("Jordan
  // put their *name* on this role."), then the identity row, trust
  // facts as outlined ink chips (VERIFIED is the single filled accent),
  // the sponsor's remaining Q&A as flat quote bands, and the role-spec
  // insights as labeled passages. No box, no shadow, no green.
  // Sizes here are the preview mock's values scaled ~1.2× — the mock's
  // phone frame is 320px wide vs ~390pt on device, so a literal px copy
  // renders visibly smaller and tighter than the approved preview. Line
  // heights get extra headroom on top of that: DM Serif Display sits
  // taller than the mock's Georgia.
  vouchSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 26,
    paddingBottom: 8,
  },
  vouchStatement: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 31,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  vouchStatementEm: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  vouchIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },
  vouchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  vouchAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  vouchAvatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    color: Colors.paper,
  },
  vouchName: {
    fontFamily: Fonts.sansBold,
    fontSize: 16.5,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  vouchRole: {
    fontSize: 13.5,
    fontWeight: "500",
    color: Colors.body,
    marginTop: 3,
  },
  vouchChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 16,
  },
  vouchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.2,
    borderColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  vouchChipText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.ink,
  },
  vouchChipFill: {
    backgroundColor: Colors.ink,
  },
  vouchChipFillText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.paper,
  },
  vouchQuote: {
    marginTop: 22,
  },
  vouchQuoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 38,
    color: Colors.faint,
    marginBottom: -8,
  },
  vouchQuoteText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.ink,
  },
  // Passage headers for the sponsor's role-spec insights — 12px floor
  // per the section-header accessibility feedback (they head passages,
  // unlike the ledger's table keys).
  vouchInsightLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.muted,
    marginTop: 22,
    marginBottom: 8,
  },

  // ── "No sponsor yet" (applicant view): a serif statement on hairlines,
  // no gray box, no icon-in-a-circle — the vouch statement's voice ─────
  noSponsorInlineBlock: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // A person's name — same "names are headline-tier" rule as
  // ProfileIdentityCard, embedded inline. Still used by
  // ReferralSigningScreen; the deck's sponsor zone now uses the vouch
  // styles above.
  sponsorMeetName: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 19,
    color: Colors.ink,
    letterSpacing: -0.3,
  },

  // PR #56 — "Liked your role" badge at the top of a sponsor's profile-pack
  // card. Black accent pill so it visually anchors the high-conviction
  // signal above the neutral hero block.
  likedYourRolePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    backgroundColor: "#000",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  likedYourRolePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.8,
  },
  benefitsList: { gap: 10, marginTop: 4 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: {
    fontFamily: Fonts.sans,
    fontSize: 14.5,
    lineHeight: 20,
    color: Colors.body,
    flex: 1,
  },

  // JOB CARD SPECIFIC STYLES

  // Non-Sponsored Back Design
  // Small centered kicker label at the top of the back faces.
  // Non-sponsored back — centered "no sponsor yet" status block.
  // About-the-company blurb beneath the no-sponsor status block.
  noSponsorHeadline: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  noSponsorHeadlineEm: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  noSponsorSubtext: {
    fontFamily: Fonts.sansLight,
    fontSize: 14.5,
    color: Colors.body,
    lineHeight: 21,
  },

  // "View original posting" row — shows the sponsor's pasted domain
  // (subdomain and all) as a legibility/trust signal, tappable to open the
  // real posting. Lives inside a hingeSection (this file) alongside every
  // other card section, so no extra top margin here. See
  // BACKEND_CHANGES_NEEDED.md §O.
  originalPostingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  originalPostingText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.body,
  },
});
