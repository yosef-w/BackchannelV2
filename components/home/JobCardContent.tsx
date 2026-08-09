import {
  BellRing,
  Check,
  ExternalLink,
} from "@/components/ui/icons";
import { Image } from "expo-image";
import React from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { Job } from "@/types/jobs";
import type { EnrichedSponsorProfile } from "@/types/profiles";
import { CompanyLogo } from "../ui/CompanyLogo";
import { ExpandableText } from "../ui/ExpandableText";
import { extractDisplayDomain } from "../jobs/jobTransforms";
import { cardStyles } from "./cardStyles";
import { formatExperienceLevelLabel, joinFacts } from "./dossierFacts";
import { Colors } from "@/constants/theme";

/**
 * Turns a raw relevance score (either a 0-1 fraction or an already-scaled
 * 0-100 number — upstream hasn't been consistent) into a display percent.
 * Clamped to 1-100 so a bad value can't render something like "1500% AI
 * Match" instead of silently doing the wrong-but-plausible thing.
 */
function formatRelevancePercent(raw: unknown): number | null {
  const score = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(score) || score <= 0) return null;
  const percent = score > 1 ? score : score * 100;
  return Math.min(100, Math.max(1, Math.round(percent)));
}

interface JobCardContentProps {
  /** The current applicant-side job entry. The `"x" in currentData`
   * runtime checks below predate this typing and are kept as
   * belt-and-suspenders against partial rows. */
  currentData: Job;
  waitlistedJobIds: Set<string>;
  requestedSponsorJobIds: Set<string>;
  appliedJobIds: Set<string>;
  sponsorProfileCache: Record<string, EnrichedSponsorProfile>;
}

/**
 * Applicant-side view of the swipe deck: a job listing, rendered as a
 * single continuous scroll.
 *
 * 2026-08 "Dossier" redesign, mirroring ApplicantProfileCard. The hero
 * is an ID block (square company-logo tile beside the title) followed by
 * a hairline ledger answering the applicant's five-second question
 * ("worth my ask?"): COMPENSATION, THE SETUP (arrangement · type ·
 * level), YOUR FIT (the AI match, formerly an accent pill), and YOUR
 * SPONSOR — the product's differentiator, promoted from the bottom of
 * the scroll into a hero-level fact. When the sponsor's Q&A insights are
 * cached, their first answer runs as an editorial pull-quote under the
 * ledger (attributed by first name); the rest keep their cards in the
 * sponsor zone below, which still carries the full identity, trust
 * signals, and job-insight briefs. The old ROLE DETAILS chip section is
 * gone — the ledger's THE SETUP row is that data.
 *
 * This content is purely a function of its props with no event handlers
 * beyond the source link and ExpandableText's self-contained toggle (the
 * wrapping Animated.ScrollView, scroll handler, and gesture refs all
 * stay in HomeView since they're shared with the profile-card view too).
 */
export function JobCardContent({
  currentData,
  waitlistedJobIds,
  requestedSponsorJobIds,
  appliedJobIds,
  sponsorProfileCache,
}: JobCardContentProps) {
  const jobId = "id" in currentData ? String(currentData.id) : "";
  const statusLabel = !jobId
    ? null
    : waitlistedJobIds.has(jobId)
      ? "WAITLISTED"
      : requestedSponsorJobIds.has(jobId)
        ? "SPONSOR REQUESTED"
        : appliedJobIds.has(jobId)
          ? "APPLIED"
          : null;

  const title = ("title" in currentData && currentData.title) || "";
  const company = ("company" in currentData && currentData.company) || "";
  const location = ("location" in currentData && currentData.location) || "";
  const logoUrl =
    "image" in currentData ? (currentData.image as string) : undefined;
  const isSponsored =
    "isSponsored" in currentData ? currentData.isSponsored : undefined;

  const si =
    ("sponsorInfo" in currentData && currentData.sponsorInfo) || null;
  const sponsorProfile = si?.userId
    ? sponsorProfileCache[String(si.userId)]
    : null;
  const sponsorQA = (sponsorProfile?.insights || []).filter(
    (item) => item && item.question && item.answer,
  );
  // The sponsor zone renders for any job not explicitly unsponsored that
  // carries sponsorInfo; the hero quote follows the same gate.
  const showSponsorZone = isSponsored !== false && !!si;
  const heroQA = showSponsorZone && sponsorQA.length > 0 ? sponsorQA[0] : null;
  const zoneQA = heroQA ? sponsorQA.slice(1) : sponsorQA;
  const sponsorFirstName = (si?.name || "").trim().split(/\s+/)[0] || "";

  // ── Hero ledger rows — each omitted when its data is absent ─────────
  const salary = (("salary" in currentData && currentData.salary) || "").trim();
  const setup = joinFacts([
    "workArrangement" in currentData ? currentData.workArrangement : "",
    "type" in currentData ? currentData.type : "",
    formatExperienceLevelLabel(
      "experienceLevel" in currentData ? currentData.experienceLevel : "",
    ),
  ]);
  const fitPercent = formatRelevancePercent(
    "relevanceScore" in currentData ? currentData.relevanceScore : null,
  );
  const ledger: { key: string; value: string; sub?: string }[] = [];
  if (salary) ledger.push({ key: "COMPENSATION", value: salary });
  if (setup) ledger.push({ key: "THE SETUP", value: setup });
  // Fixed phrases below use non-breaking spaces ( ) so a wrap can
  // never orphan the last word of a phrase onto its own line — multi-part
  // values break at the " · " separators instead.
  if (fitPercent !== null)
    ledger.push({
      key: "YOUR FIT",
      value: `${fitPercent}% match, by our read`,
    });
  if (isSponsored === false) {
    ledger.push({
      key: "YOUR SPONSOR",
      value: "No one yet",
      sub: "You'll be notified the moment someone signs on",
    });
  } else if (si && (si.name || "").trim()) {
    ledger.push({
      key: "YOUR SPONSOR",
      value: si.name,
      sub: joinFacts([
        si.role,
        si.yearsAtCompany
          ? `${String(si.yearsAtCompany).trim().replace(/\s+/g, " ")} here`
          : "",
        si.canRefer ? "Can refer directly" : "",
      ]),
    });
  }

  return (
    /* ────────────────────────────────────────────────────
       APPLICANT VIEW — job, vertical scroll
       ──────────────────────────────────────────────────── */
    <>
      {/* Top badge row — action status (waitlisted / sponsor-requested /
          applied) plus the sponsorship signal, in the ledger's caps
          voice. Left-aligned to match the dossier hero's rag. */}
      {(statusLabel || isSponsored === true) && (
        <View style={cardStyles.kBadgeRow}>
          {statusLabel && (
            <Animated.View entering={FadeIn.duration(220)}>
              <View style={cardStyles.statusBanner}>
                <Check color="#FFF" size={13} strokeWidth={3} />
                <Text style={cardStyles.statusBannerText}>{statusLabel}</Text>
              </View>
            </Animated.View>
          )}
          {isSponsored === true && (
            <View style={cardStyles.statusBanner}>
              <Check color="#FFF" size={13} strokeWidth={3} />
              <Text style={cardStyles.statusBannerText}>SPONSORED ROLE</Text>
            </View>
          )}
        </View>
      )}

      {/* HERO — dossier ID block + ledger */}
      <View style={cardStyles.kHero}>
        <View style={cardStyles.kIdRow}>
          <CompanyLogo
            logoUrl={logoUrl}
            name={company}
            size={96}
            borderRadius={18}
            initialFontSize={38}
          />
          <View style={cardStyles.kIdText}>
            <Text style={cardStyles.kIdName} numberOfLines={3}>
              {title}
            </Text>
            {!!(company || location) && (
              <Text style={cardStyles.kIdSub} numberOfLines={2}>
                {company ? (
                  <Text style={cardStyles.kIdSubEm}>{company}</Text>
                ) : null}
                {company && location ? " · " : ""}
                {location}
              </Text>
            )}
          </View>
        </View>

        {ledger.length > 0 && (
          <View style={cardStyles.kLedger}>
            {ledger.map((row) => (
              <View key={row.key} style={cardStyles.kLedgerRow}>
                <Text style={cardStyles.kLedgerKey} numberOfLines={1}>
                  {row.key}
                </Text>
                <View style={cardStyles.kLedgerValueWrap}>
                  <Text style={cardStyles.kLedgerValue} numberOfLines={2}>
                    {row.value}
                  </Text>
                  {!!row.sub && (
                    <Text style={cardStyles.kLedgerValueSub} numberOfLines={2}>
                      {row.sub}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* PULL-QUOTE — the sponsor's own words, promoted */}
      {heroQA && (
        <View style={cardStyles.kQuote}>
          <Text style={cardStyles.kQuoteMark}>“</Text>
          <ExpandableText style={cardStyles.kQuoteText} numberOfLines={6}>
            {heroQA.answer ?? ""}
          </ExpandableText>
          <Text style={cardStyles.kQuoteAttr} numberOfLines={2}>
            {joinFacts([sponsorFirstName, heroQA.question || ""]).toUpperCase()}
          </Text>
        </View>
      )}

      {/* ABOUT THE ROLE — full text, no clamp */}
      {(() => {
        const description =
          "description" in currentData ? currentData.description || "" : "";
        if (!description.trim()) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>ABOUT THE ROLE</Text>
            <Text style={cardStyles.hingeBodyText}>{description}</Text>
          </View>
        );
      })()}

      {/* CORE RESPONSIBILITIES */}
      {"coreResponsibilities" in currentData &&
        currentData.coreResponsibilities && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              CORE RESPONSIBILITIES
            </Text>
            <Text style={cardStyles.hingeBodyText}>
              {currentData.coreResponsibilities}
            </Text>
          </View>
        )}

      {/* REQUIREMENTS */}
      {"requirementsSummary" in currentData &&
        currentData.requirementsSummary && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>REQUIREMENTS</Text>
            <Text style={cardStyles.hingeBodyText}>
              {currentData.requirementsSummary}
            </Text>
          </View>
        )}

      {/* REQUIRED SKILLS — chips */}
      {"skills" in currentData &&
        currentData.skills &&
        currentData.skills.length > 0 && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>REQUIRED SKILLS</Text>
            <View style={cardStyles.hingeChipsWrap}>
              {currentData.skills.map((skill: string, idx: number) => (
                <View key={idx} style={cardStyles.hingeSkillChip}>
                  <Text style={cardStyles.hingeSkillChipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      {/* HIGHLIGHTS — benefits as a checked list */}
      {"benefits" in currentData &&
        currentData.benefits &&
        currentData.benefits.length > 0 && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>HIGHLIGHTS</Text>
            <View style={cardStyles.benefitsList}>
              {currentData.benefits.map((benefit: string, idx: number) => (
                <View key={idx} style={cardStyles.benefitRow}>
                  <Check size={14} color="#000" />
                  <Text style={cardStyles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      {/* SOURCE — the sponsor's pasted/ATS source link, shown whenever the
          job has one (regardless of how it was created). Deliberately
          shows the real domain rather than generic "Source" text: a
          mismatched domain is a legibility signal on its own, and it lets
          an applicant verify the listing against the real posting. Same
          hingeSection rhythm as every other card section (label + body)
          rather than a bare row, so it reads as a peer section, not an
          addendum tacked onto Highlights. See BACKEND_CHANGES_NEEDED.md §O. */}
      {"url" in currentData &&
        currentData.url &&
        extractDisplayDomain(currentData.url) && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>SOURCE</Text>
            <TouchableOpacity
              style={cardStyles.originalPostingRow}
              onPress={() => Linking.openURL(currentData.url).catch(() => {})}
              activeOpacity={0.7}
            >
              <ExternalLink size={14} color={Colors.body} strokeWidth={2} />
              <Text style={cardStyles.originalPostingText}>
                {extractDisplayDomain(currentData.url)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      {/* NO SPONSOR YET — status block + company description */}
      {isSponsored === false ? (
        <>
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>STATUS</Text>
            <View style={cardStyles.noSponsorInlineBlock}>
              <View style={cardStyles.noSponsorIconCircle}>
                <BellRing size={22} color="#000" strokeWidth={2} />
              </View>
              <Text style={cardStyles.noSponsorHeadline}>No sponsor yet</Text>
              <Text style={cardStyles.noSponsorSubtext}>
                When someone at {company || "this company"} signs on to
                sponsor this role, you&apos;ll be notified instantly.
              </Text>
            </View>
          </View>
          {"companyDescription" in currentData &&
            currentData.companyDescription && (
              <View style={cardStyles.hingeSection}>
                <Text style={cardStyles.hingeSectionLabel}>
                  ABOUT THE COMPANY
                </Text>
                <Text style={cardStyles.hingeBodyText}>
                  {currentData.companyDescription}
                </Text>
              </View>
            )}
        </>
      ) : (
        /* THE VOUCH — the sponsor zone (2026-08 P redesign). The
           product's core mechanic — a real person staking their name on
           this role — leads as a serif statement, then the identity
           row, trust facts as outlined ink chips (VERIFIED is the one
           filled accent), the sponsor's remaining Q&A as flat quote
           bands, and the role-spec insights as labeled passages. The
           pre-rebrand gray inset card (shadows, green verified pill,
           dark header strips) is gone. */
        si &&
        (() => {
          const ins =
            "backchannelInsights" in currentData &&
            currentData.backchannelInsights
              ? currentData.backchannelInsights
              : null;
          const jobInsights: {
            label: string;
            text: string;
          }[] = [];
          if (ins?.dayToDay)
            jobInsights.push({ label: "DAY-TO-DAY", text: ins.dayToDay });
          if (ins?.teamCulture)
            jobInsights.push({
              label: "TEAM CULTURE",
              text: ins.teamCulture,
            });
          if (ins?.idealCandidate)
            jobInsights.push({
              label: "WHO THRIVES HERE",
              text: ins.idealCandidate,
            });
          if (ins?.insiderInsights)
            jobInsights.push({
              label: "EVERYTHING ELSE",
              text: ins.insiderInsights,
            });
          const yearsChip = (si.yearsAtCompany || "").trim();
          return (
            <View style={cardStyles.vouchSection}>
              <Text style={cardStyles.vouchStatement}>
                {sponsorFirstName || "Someone"} put their{" "}
                <Text style={cardStyles.vouchStatementEm}>name</Text>
                {" on this role."}
              </Text>

              {/* Identity row */}
              <View style={cardStyles.vouchIdRow}>
                {si.image ? (
                  <Image
                    source={{ uri: si.image }}
                    style={cardStyles.vouchAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                ) : (
                  <View style={cardStyles.vouchAvatarFallback}>
                    <Text style={cardStyles.vouchAvatarInitial}>
                      {(si.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={cardStyles.vouchName} numberOfLines={1}>
                    {si.name}
                  </Text>
                  {!!(si.role || company) && (
                    <Text style={cardStyles.vouchRole} numberOfLines={1}>
                      {si.role}
                      {si.role && company ? " · " : ""}
                      {company}
                    </Text>
                  )}
                </View>
              </View>

              {/* Trust chips — verified arrives with the enrichment
                  cache, same as it always has */}
              {(sponsorProfile?.verified || !!yearsChip || si.canRefer) && (
                <View style={cardStyles.vouchChipsRow}>
                  {sponsorProfile?.verified && (
                    <View
                      style={[cardStyles.vouchChip, cardStyles.vouchChipFill]}
                    >
                      <Check color={Colors.paper} size={10} strokeWidth={3} />
                      <Text
                        style={cardStyles.vouchChipFillText}
                        numberOfLines={1}
                      >
                        VERIFIED
                      </Text>
                    </View>
                  )}
                  {!!yearsChip && (
                    <View style={cardStyles.vouchChip}>
                      <Text style={cardStyles.vouchChipText} numberOfLines={1}>
                        {`${yearsChip} here`.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {si.canRefer && (
                    <View style={cardStyles.vouchChip}>
                      <Text style={cardStyles.vouchChipText} numberOfLines={1}>
                        CAN REFER
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Remaining Q&A — the first answer already runs as the
                  hero pull-quote; the rest keep the same flat quote
                  voice here, attributed by first name + question */}
              {zoneQA.map((item) => (
                <View key={item.question} style={cardStyles.vouchQuote}>
                  <Text style={cardStyles.vouchQuoteMark}>“</Text>
                  <ExpandableText
                    style={cardStyles.vouchQuoteText}
                    numberOfLines={6}
                  >
                    {item.answer ?? ""}
                  </ExpandableText>
                  <Text style={cardStyles.kQuoteAttr} numberOfLines={2}>
                    {joinFacts([
                      sponsorFirstName,
                      item.question || "",
                    ]).toUpperCase()}
                  </Text>
                </View>
              ))}

              {/* Job insights — role-specific spec written BY the
                  sponsor ABOUT the role, as labeled passages */}
              {jobInsights.map((it) => (
                <View key={it.label}>
                  <Text style={cardStyles.vouchInsightLabel}>{it.label}</Text>
                  <ExpandableText
                    style={cardStyles.hingeBodyText}
                    numberOfLines={6}
                  >
                    {it.text}
                  </ExpandableText>
                </View>
              ))}
            </View>
          );
        })()
      )}
    </>
  );
}
