import {
  BellRing,
  Briefcase,
  Calendar,
  Check,
  DollarSign,
  MapPin,
  Zap,
} from "@/components/ui/icons";
import React from "react";
import { Image, Text, View } from "react-native";
import type { Job } from "@/types/jobs";
import type { EnrichedSponsorProfile } from "@/types/profiles";
import { CompanyLogo } from "../ui/CompanyLogo";
import { ExpandableText } from "../ui/ExpandableText";
import { cardStyles } from "./cardStyles";

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
 * single continuous scroll (status banner, hero, about, role details,
 * responsibilities, requirements, skills, highlights, sponsor zone).
 * Extracted from HomeView verbatim — this content is purely a function of
 * currentData/waitlistedJobIds/requestedSponsorJobIds/appliedJobIds/
 * sponsorProfileCache with no event handlers, confirmed by a
 * state-ownership audit before extraction (the wrapping
 * Animated.ScrollView, scroll handler, and gesture refs all stay in
 * HomeView since they're shared with the profile-card view too).
 */
export function JobCardContent({
  currentData,
  waitlistedJobIds,
  requestedSponsorJobIds,
  appliedJobIds,
  sponsorProfileCache,
}: JobCardContentProps) {
  return (
    /* ────────────────────────────────────────────────────
       APPLICANT VIEW — job, vertical scroll
       ──────────────────────────────────────────────────── */
    <>
      {/* Status banner at the top — waitlisted /
          sponsor-requested / applied. Replaces the old
          "overlay" that floated above the card image. */}
      {"id" in currentData &&
        (waitlistedJobIds.has(String(currentData.id)) ||
          requestedSponsorJobIds.has(String(currentData.id)) ||
          appliedJobIds.has(String(currentData.id))) && (
          <View style={cardStyles.statusBannerRow}>
            {waitlistedJobIds.has(String(currentData.id)) ? (
              <View style={cardStyles.statusBanner}>
                <Check color="#FFF" size={13} strokeWidth={3} />
                <Text style={cardStyles.statusBannerText}>
                  Waitlisted
                </Text>
              </View>
            ) : requestedSponsorJobIds.has(
                String(currentData.id),
              ) ? (
              <View style={cardStyles.statusBanner}>
                <Check color="#FFF" size={13} strokeWidth={3} />
                <Text style={cardStyles.statusBannerText}>
                  Sponsor requested
                </Text>
              </View>
            ) : (
              <View style={cardStyles.statusBanner}>
                <Check color="#FFF" size={13} strokeWidth={3} />
                <Text style={cardStyles.statusBannerText}>
                  Applied
                </Text>
              </View>
            )}
          </View>
        )}
    
      {/* HERO — company logo + role identity */}
      <View style={cardStyles.hingeHero}>
        <CompanyLogo
          logoUrl={
            "image" in currentData
              ? (currentData.image as string)
              : undefined
          }
          name={
            "company" in currentData
              ? (currentData.company as string)
              : ""
          }
          size={88}
          borderRadius={44}
          initialFontSize={32}
        />
        <Text style={cardStyles.hingeHeroName} numberOfLines={3}>
          {"title" in currentData ? currentData.title : ""}
        </Text>
        {"company" in currentData && !!currentData.company && (
          <Text
            style={cardStyles.hingeHeroSubtitle}
            numberOfLines={1}
          >
            {currentData.company}
          </Text>
        )}
        {"isSponsored" in currentData && (
          <View
            style={
              currentData.isSponsored
                ? cardStyles.heroStatusSponsored
                : cardStyles.heroStatusMuted
            }
          >
            {currentData.isSponsored && (
              <Check color="#FFF" size={10} strokeWidth={3} />
            )}
            <Text
              style={
                currentData.isSponsored
                  ? cardStyles.heroStatusSponsoredText
                  : cardStyles.heroStatusMutedText
              }
            >
              {currentData.isSponsored
                ? "Sponsored"
                : "No sponsor yet"}
            </Text>
          </View>
        )}
        <View style={cardStyles.hingeHeroPillRow}>
          {"location" in currentData &&
            !!currentData.location && (
              <View style={cardStyles.heroPill}>
                <MapPin color="#666" size={11} />
                <Text style={cardStyles.heroPillText}>
                  {currentData.location}
                </Text>
              </View>
            )}
          {"salary" in currentData && !!currentData.salary && (
            <View style={cardStyles.heroPill}>
              <DollarSign color="#666" size={11} />
              <Text style={cardStyles.heroPillText}>
                {currentData.salary}
              </Text>
            </View>
          )}
          {"type" in currentData && !!currentData.type && (
            <View style={cardStyles.heroPill}>
              <Briefcase color="#666" size={11} />
              <Text style={cardStyles.heroPillText}>
                {currentData.type}
              </Text>
            </View>
          )}
          {(() => {
            const percent =
              "relevanceScore" in currentData
                ? formatRelevancePercent(
                    currentData.relevanceScore,
                  )
                : null;
            if (percent === null) return null;
            return (
              <View style={cardStyles.heroPillAccent}>
                <Zap size={10} color="#FFF" strokeWidth={2.5} />
                <Text style={cardStyles.heroPillAccentText}>
                  {percent}% AI Match
                </Text>
              </View>
            );
          })()}
        </View>
      </View>
    
      <View style={cardStyles.hingeDivider} />
    
      {/* ABOUT THE ROLE — full text, no clamp */}
      {(() => {
        const description =
          "description" in currentData
            ? currentData.description || ""
            : "";
        if (!description.trim()) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              ABOUT THE ROLE
            </Text>
            <Text style={cardStyles.hingeBodyText}>
              {description}
            </Text>
          </View>
        );
      })()}
    
      {/* ROLE DETAILS — experience level + work arrangement chips */}
      {(() => {
        const expLvl =
          "experienceLevel" in currentData
            ? currentData.experienceLevel
            : "";
        const workArr =
          "workArrangement" in currentData
            ? currentData.workArrangement
            : "";
        if (!expLvl && !workArr) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              ROLE DETAILS
            </Text>
            <View style={cardStyles.hingeChipsWrap}>
              {!!expLvl && (
                <View style={cardStyles.roleDetailChip}>
                  <Briefcase size={13} color="#000" />
                  <Text style={cardStyles.roleDetailChipText}>
                    {(() => {
                      const v = String(expLvl).trim();
                      return /^[\d+\-\s]+$/.test(v)
                        ? `${v} years experience`
                        : v;
                    })()}
                  </Text>
                </View>
              )}
              {!!workArr && (
                <View style={cardStyles.roleDetailChip}>
                  <MapPin size={13} color="#000" />
                  <Text style={cardStyles.roleDetailChipText}>
                    {workArr}
                  </Text>
                </View>
              )}
            </View>
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
            <Text style={cardStyles.hingeSectionLabel}>
              REQUIREMENTS
            </Text>
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
            <Text style={cardStyles.hingeSectionLabel}>
              REQUIRED SKILLS
            </Text>
            <View style={cardStyles.hingeChipsWrap}>
              {currentData.skills.map(
                (skill: string, idx: number) => (
                  <View key={idx} style={cardStyles.hingeSkillChip}>
                    <Text style={cardStyles.hingeSkillChipText}>
                      {skill}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </View>
        )}
    
      {/* HIGHLIGHTS — benefits as a checked list */}
      {"benefits" in currentData &&
        currentData.benefits &&
        currentData.benefits.length > 0 && (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              HIGHLIGHTS
            </Text>
            <View style={cardStyles.benefitsList}>
              {currentData.benefits.map(
                (benefit: string, idx: number) => (
                  <View key={idx} style={cardStyles.benefitRow}>
                    <Check size={14} color="#000" />
                    <Text style={cardStyles.benefitText}>
                      {benefit}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </View>
        )}
    
      {/* NO SPONSOR YET — status block + company description */}
      {"isSponsored" in currentData &&
      currentData.isSponsored === false ? (
        <>
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>STATUS</Text>
            <View style={cardStyles.noSponsorInlineBlock}>
              <View style={cardStyles.noSponsorIconCircle}>
                <BellRing
                  size={22}
                  color="#000"
                  strokeWidth={2}
                />
              </View>
              <Text style={cardStyles.noSponsorHeadline}>
                No sponsor yet
              </Text>
              <Text style={cardStyles.noSponsorSubtext}>
                When someone at{" "}
                {"company" in currentData && currentData.company
                  ? currentData.company
                  : "this company"}{" "}
                signs on to sponsor this role, you'll be
                notified instantly.
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
        /* MEET YOUR SPONSOR — identity, trust, words; plus
           the role's inside-story insights below it. */
        "sponsorInfo" in currentData &&
        currentData.sponsorInfo &&
        (() => {
          const si = currentData.sponsorInfo;
          const sid = si.userId ? String(si.userId) : "";
          const sp = sid ? sponsorProfileCache[sid] : null;
          const company =
            "company" in currentData ? currentData.company : "";
          const qa = (sp?.insights || []).filter(
            (i) => i && i.question && i.answer,
          );
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
            jobInsights.push({
              label: "DAY-TO-DAY",
              text: ins.dayToDay,
            });
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
          return (
            <>
              {/* ── SPONSOR ZONE CARD ───────────────── */}
              <View style={cardStyles.sponsorZoneOuter}>
                <View style={cardStyles.sponsorZoneCard}>
                  <View style={cardStyles.sponsorZoneBody}>
                    {/* Subtle "SPONSORED BY" kicker */}
                    <Text style={cardStyles.sponsorZoneQALabel}>
                      SPONSORED BY
                    </Text>
    
                    {/* Identity row */}
                    <View
                      style={[
                        cardStyles.sponsorMeetInline,
                        { marginTop: 10 },
                      ]}
                    >
                      {si.image ? (
                        <Image
                          source={{ uri: si.image }}
                          style={cardStyles.sponsorMeetAvatar}
                        />
                      ) : (
                        <View
                          style={
                            cardStyles.sponsorMeetAvatarFallback
                          }
                        >
                          <Text
                            style={
                              cardStyles.sponsorMeetAvatarInitial
                            }
                          >
                            {(si.name || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={cardStyles.sponsorMeetName}
                          numberOfLines={1}
                        >
                          {si.name}
                        </Text>
                        {!!(si.role || company) && (
                          <Text
                            style={cardStyles.sponsorMeetRole}
                            numberOfLines={1}
                          >
                            {si.role}
                            {si.role && company ? " · " : ""}
                            {company}
                          </Text>
                        )}
                        {sp?.verified && (
                          <View
                            style={[
                              cardStyles.canReferTag,
                              { marginTop: 6 },
                            ]}
                          >
                            <Check
                              size={10}
                              color="#000"
                              strokeWidth={3}
                            />
                            <Text
                              style={cardStyles.canReferTagText}
                            >
                              Verified employee
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
    
                    {/* Fact pills */}
                    {(!!si.yearsAtCompany || si.canRefer) && (
                      <View
                        style={[
                          cardStyles.hingeChipsWrap,
                          { marginTop: 12 },
                        ]}
                      >
                        {!!si.yearsAtCompany && (
                          <View style={cardStyles.heroPill}>
                            <Calendar color="#666" size={11} />
                            <Text style={cardStyles.heroPillText}>
                              {si.yearsAtCompany} here
                            </Text>
                          </View>
                        )}
                        {si.canRefer && (
                          <View style={cardStyles.heroPill}>
                            <Check
                              color="#666"
                              size={11}
                              strokeWidth={3}
                            />
                            <Text style={cardStyles.heroPillText}>
                              Can refer directly
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
    
                    {/* Sponsor Q&A — matches the
                        applicant-from-sponsor view's
                        quote-style card so the
                        sponsor's voice reads with the
                        same "in their own words"
                        treatment everywhere it appears
                        in the app. */}
                    {qa.length > 0 && (
                      <>
                        <View
                          style={cardStyles.sponsorZoneDivider}
                        />
                        <Text style={cardStyles.sponsorZoneQALabel}>
                          SPONSOR INSIGHTS
                        </Text>
                        {qa.map((item, i) => (
                          <View
                            key={item.question}
                            style={[
                              cardStyles.hingeInsightCard,
                              i > 0 && { marginTop: 12 },
                            ]}
                          >
                            <View
                              style={cardStyles.hingeInsightAccent}
                            />
                            <View
                              style={cardStyles.hingeInsightBody}
                            >
                              <Text
                                style={
                                  cardStyles.hingeInsightQuestion
                                }
                              >
                                {item.question}
                              </Text>
                              <View
                                style={
                                  cardStyles.hingeInsightAnswerRow
                                }
                              >
                                <Text
                                  style={
                                    cardStyles.hingeInsightQuoteMark
                                  }
                                >
                                  “
                                </Text>
                                <Text
                                  style={
                                    cardStyles.hingeInsightAnswer
                                  }
                                >
                                  {item.answer}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </>
                    )}
    
                    {/* Job insights — role-specific
                        spec written BY the sponsor
                        ABOUT the role. Uses a
                        documented "header strip" card
                        (dark label band on top, body
                        below) so it reads as a formal
                        role brief rather than a
                        personal quote — distinct from
                        the SPONSOR INSIGHTS cards
                        right above it. */}
                    {jobInsights.length > 0 && (
                      <>
                        <View
                          style={cardStyles.sponsorZoneDivider}
                        />
                        <Text
                          style={cardStyles.sponsorZoneJobLabel}
                        >
                          JOB INSIGHTS
                        </Text>
                        {jobInsights.map((it, idx) => (
                          <View
                            key={it.label}
                            style={[
                              cardStyles.jobInsightCard,
                              idx > 0 && { marginTop: 12 },
                            ]}
                          >
                            <View
                              style={cardStyles.jobInsightHeader}
                            >
                              <Text
                                style={
                                  cardStyles.jobInsightHeaderLabel
                                }
                              >
                                {it.label}
                              </Text>
                            </View>
                            <View style={cardStyles.jobInsightBody}>
                              <ExpandableText
                                style={
                                  cardStyles.jobInsightBodyText
                                }
                                numberOfLines={6}
                              >
                                {it.text}
                              </ExpandableText>
                            </View>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              </View>
            </>
          );
        })()
      )}
    </>
  );
}
