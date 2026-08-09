import { Heart } from "@/components/ui/icons";
import type {
    EnrichedApplicantProfile,
    ProfileDeckCard,
    ProfilePrompt,
} from "@/types/profiles";
import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ExpandableText } from "../ui/ExpandableText";
import { cardStyles } from "./cardStyles";
import { deriveExperienceFact, joinFacts } from "./dossierFacts";
import { Colors } from "@/constants/theme";

interface ApplicantProfileCardProps {
  /** The current sponsor-side profile pack entry (the transformed deck
   * card). The `"x" in currentData` runtime checks below predate this
   * typing and are kept as belt-and-suspenders against partial rows. */
  currentData: ProfileDeckCard;
  fullProfileCache: Record<string, EnrichedApplicantProfile>;
  fullProfileLoading: boolean;
}

/**
 * Sponsor-side view of the swipe deck: an applicant's profile pack,
 * rendered as a single continuous scroll.
 *
 * 2026-08 "Dossier" redesign (PM feedback: standout facts were buried
 * below the fold). The hero is a passport-style ID block — modest square
 * photo beside the name — followed by a hairline ledger answering the
 * sponsor's five-second question ("worth my name?") with evidence:
 * EXPERIENCE (years + current seat, derived from the enriched resume),
 * SHARPEST AT (top skills), KNOWN FOR (achievements). The applicant's
 * first prompt answer is promoted to an editorial pull-quote right under
 * the ledger — "in their own words" is the product's differentiator —
 * with the remaining prompts still rendered in INSIGHTS below. Ledger
 * rows that depend on the lazily-fetched enrichment simply appear when
 * the cache lands, same as the resume sections always have.
 *
 * This content is purely a function of currentData/fullProfileCache/
 * fullProfileLoading with no event handlers beyond ExpandableText's
 * self-contained toggle (the wrapping Animated.ScrollView, scroll
 * handler, and gesture refs all stay in HomeView since they're shared
 * with the job-card view too).
 */
export function ApplicantProfileCard({
  currentData,
  fullProfileCache,
  fullProfileLoading,
}: ApplicantProfileCardProps) {
  const uid = currentData?.USER_ID;
  const cached: EnrichedApplicantProfile | null =
    (uid && fullProfileCache[String(uid)]) || null;

  const name = ("name" in currentData && currentData.name) || "";
  const image = ("image" in currentData && currentData.image) || "";
  const desiredRole =
    ("desiredRole" in currentData && currentData.desiredRole) || "";
  const location = ("location" in currentData && currentData.location) || "";

  const skillsFromCache = Array.isArray(cached?.skills) ? cached.skills : [];
  const skillsFromCard =
    "skills" in currentData && Array.isArray(currentData.skills)
      ? currentData.skills
      : [];
  const skills = skillsFromCache.length > 0 ? skillsFromCache : skillsFromCard;

  const inlinePrompts = "prompts" in currentData ? currentData.prompts : null;
  const prompts: ProfilePrompt[] =
    cached?.prompts && cached.prompts.length > 0
      ? cached.prompts
      : Array.isArray(inlinePrompts)
        ? inlinePrompts
        : [];
  const validPrompts = prompts.filter(
    (prompt) =>
      prompt &&
      typeof prompt.answer === "string" &&
      prompt.answer.trim().length > 0,
  );
  // First answered prompt becomes the hero pull-quote; the rest stay in
  // the INSIGHTS section so no words are lost to the promotion.
  const heroPrompt = validPrompts[0] ?? null;
  const restPrompts = validPrompts.slice(1);

  const bio: string =
    cached?.bio || ("bio" in currentData ? currentData.bio : "") || "";

  // ── Hero ledger rows — each omitted when its data is absent ─────────
  const experienceFact = deriveExperienceFact(cached?.experiences);
  const sharpestAt = joinFacts(skills.slice(0, 2));
  const knownFor = (cached?.achievements || "").trim();
  const ledger: { key: string; value: string; sub?: string }[] = [];
  if (experienceFact) ledger.push({ key: "EXPERIENCE", ...experienceFact });
  if (sharpestAt) ledger.push({ key: "SHARPEST AT", value: sharpestAt });
  if (knownFor) ledger.push({ key: "KNOWN FOR", value: knownFor });

  const experiences = Array.isArray(cached?.experiences)
    ? cached.experiences
    : [];
  const education = Array.isArray(cached?.education) ? cached.education : [];
  const certs = Array.isArray(cached?.certifications)
    ? cached.certifications
    : [];
  const langs = Array.isArray(cached?.languages) ? cached.languages : [];
  const achievements: string = cached?.achievements || "";

  return (
    /* ────────────────────────────────────────────────────
       SPONSOR VIEW — applicant profile, vertical scroll
       ──────────────────────────────────────────────────── */
    <>
      {/* "Liked your role" badge (PR #56) — high-conviction
          interest, anchored at the top before the hero so
          it's the first thing the sponsor sees. */}
      {currentData.HAS_LIKED_JOB === true && (
        <View style={cardStyles.likedYourRoleRow}>
          <View style={cardStyles.likedYourRolePill}>
            <Heart size={11} color="#FFF" fill="#FFF" strokeWidth={2} />
            <Text style={cardStyles.likedYourRolePillText}>
              LIKED YOUR ROLE
            </Text>
          </View>
        </View>
      )}

      {/* HERO — dossier ID block + ledger */}
      <View style={cardStyles.kHero}>
        <View style={cardStyles.kIdRow}>
          {image ? (
            <Image
              source={{ uri: image as string }}
              style={cardStyles.kIdPhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View style={cardStyles.kIdPhotoFallback}>
              <Text style={cardStyles.kIdPhotoInitial}>
                {(name || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={cardStyles.kIdText}>
            <Text style={cardStyles.kIdName} numberOfLines={2}>
              {name}
            </Text>
            {!!(desiredRole || location) && (
              <Text style={cardStyles.kIdSub} numberOfLines={2}>
                {desiredRole ? (
                  <>
                    Wants:{" "}
                    <Text style={cardStyles.kIdSubEm}>{desiredRole}</Text>
                  </>
                ) : null}
                {desiredRole && location ? " · " : ""}
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

      {/* PULL-QUOTE — the applicant's own words, promoted */}
      {heroPrompt && (
        <View style={cardStyles.kQuote}>
          <Text style={cardStyles.kQuoteMark}>“</Text>
          <ExpandableText style={cardStyles.kQuoteText} numberOfLines={6}>
            {heroPrompt.answer ?? ""}
          </ExpandableText>
          {!!heroPrompt.question && (
            <Text style={cardStyles.kQuoteAttr} numberOfLines={2}>
              {heroPrompt.question.toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {/* ABOUT — full bio, no clamp */}
      <View style={cardStyles.hingeSection}>
        <Text style={cardStyles.hingeSectionLabel}>ABOUT</Text>
        <Text style={cardStyles.hingeBodyText}>
          {bio.trim().length > 0 ? bio : "No bio added yet."}
        </Text>
      </View>

      {/* INSIGHTS — remaining Q&A cards, full text */}
      {validPrompts.length === 0 && fullProfileLoading ? (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>INSIGHTS</Text>
          <View style={{ alignItems: "flex-start", paddingVertical: 4 }}>
            <ActivityIndicator color={Colors.muted} />
          </View>
        </View>
      ) : restPrompts.length > 0 ? (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>INSIGHTS</Text>
          {restPrompts.map((prompt, idx) => (
            <View
              key={idx}
              style={[cardStyles.hingeInsightCard, idx > 0 && { marginTop: 14 }]}
            >
              {/* Vertical black accent stripe — pulls
                  the eye to the content without
                  introducing color into the monochrome
                  palette. */}
              <View style={cardStyles.hingeInsightAccent} />
              <View style={cardStyles.hingeInsightBody}>
                {!!prompt.question && (
                  <Text style={cardStyles.hingeInsightQuestion}>
                    {prompt.question}
                  </Text>
                )}
                {/* Decorative opening quote — large
                    serif-style mark sits flush with
                    the answer's first line, giving
                    the card its "in their own words"
                    gravitas. */}
                <View style={cardStyles.hingeInsightAnswerRow}>
                  <Text style={cardStyles.hingeInsightQuoteMark}>“</Text>
                  <Text style={cardStyles.hingeInsightAnswer}>
                    {prompt.answer}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* TOP SKILLS — chips */}
      {skills.length > 0 && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>TOP SKILLS</Text>
          <View style={cardStyles.hingeChipsWrap}>
            {skills.map((skill: string, idx: number) => (
              <View key={idx} style={cardStyles.hingeSkillChip}>
                <Text style={cardStyles.hingeSkillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* EXPERIENCE — timeline */}
      {experiences.length > 0 && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>EXPERIENCE</Text>
          {experiences.map((exp, idx) => (
            <View
              key={idx}
              style={[cardStyles.hingeTimelineRow, idx > 0 && { marginTop: 18 }]}
            >
              <View style={cardStyles.hingeTimelineDot} />
              <View style={cardStyles.hingeTimelineBody}>
                <Text style={cardStyles.hingeTimelineTitle}>
                  {exp.jobTitle}
                </Text>
                <Text style={cardStyles.hingeTimelineSubtitle}>
                  {exp.company}
                </Text>
                <Text style={cardStyles.hingeTimelineMeta}>
                  {exp.startDate}
                  {exp.current
                    ? " — Present"
                    : exp.endDate
                      ? ` — ${exp.endDate}`
                      : ""}
                </Text>
                {!!exp.description && (
                  <Text style={cardStyles.hingeTimelineDescription}>
                    {exp.description}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* EDUCATION — timeline */}
      {education.length > 0 && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>EDUCATION</Text>
          {education.map((edu, idx) => (
            <View
              key={idx}
              style={[cardStyles.hingeTimelineRow, idx > 0 && { marginTop: 18 }]}
            >
              <View style={cardStyles.hingeTimelineDot} />
              <View style={cardStyles.hingeTimelineBody}>
                <Text style={cardStyles.hingeTimelineTitle}>
                  {edu.degree}
                  {edu.major ? ` in ${edu.major}` : ""}
                </Text>
                <Text style={cardStyles.hingeTimelineSubtitle}>
                  {edu.university}
                </Text>
                <Text style={cardStyles.hingeTimelineMeta}>
                  {[
                    edu.graduationYear && `Class of ${edu.graduationYear}`,
                    edu.gpa && `GPA ${edu.gpa}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* CERTIFICATIONS — credential blocks */}
      {certs.length > 0 && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>CERTIFICATIONS</Text>
          <View style={cardStyles.hingeCredentialList}>
            {certs.map((cert, idx) => (
              <View key={idx} style={cardStyles.hingeCredentialBlock}>
                <Text style={cardStyles.hingeCredentialName}>{cert.name}</Text>
                <Text style={cardStyles.hingeCredentialMeta}>
                  {cert.organization}
                  {cert.year ? ` · ${cert.year}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LANGUAGES — credential blocks */}
      {langs.length > 0 && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>LANGUAGES</Text>
          <View style={cardStyles.hingeCredentialList}>
            {langs.map((lang, idx) => (
              <View key={idx} style={cardStyles.hingeCredentialBlock}>
                <Text style={cardStyles.hingeCredentialName}>
                  {lang.language}
                </Text>
                <Text style={cardStyles.hingeCredentialMeta}>
                  {lang.proficiency}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ACHIEVEMENTS — full text (the KNOWN FOR ledger row above is the
          two-line teaser of this) */}
      {!!achievements && (
        <View style={cardStyles.hingeSection}>
          <Text style={cardStyles.hingeSectionLabel}>ACHIEVEMENTS</Text>
          <Text style={cardStyles.hingeBodyText}>{achievements}</Text>
        </View>
      )}
    </>
  );
}
