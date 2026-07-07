import { Briefcase, Heart, MapPin } from "@/components/ui/icons";
import type {
    EnrichedApplicantProfile,
    ProfileDeckCard,
    ProfilePrompt,
} from "@/types/profiles";
import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { cardStyles } from "./cardStyles";

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
 * rendered as a single continuous scroll (hero, about, insights, skills,
 * experience, education, certifications, languages, achievements).
 * Extracted from HomeView verbatim — this content is purely a function of
 * currentData/fullProfileCache/fullProfileLoading with no event handlers,
 * confirmed by a state-ownership audit before extraction (the wrapping
 * Animated.ScrollView, scroll handler, and gesture refs all stay in
 * HomeView since they're shared with the job-card view too).
 */
export function ApplicantProfileCard({
  currentData,
  fullProfileCache,
  fullProfileLoading,
}: ApplicantProfileCardProps) {
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
            <Heart
              size={11}
              color="#FFF"
              fill="#FFF"
              strokeWidth={2}
            />
            <Text style={cardStyles.likedYourRolePillText}>
              LIKED YOUR ROLE
            </Text>
          </View>
        </View>
      )}
    
      {/* HERO — applicant identity */}
      <View style={cardStyles.hingeHero}>
        {"image" in currentData && currentData.image ? (
          <Image
            source={{ uri: currentData.image as string }}
            style={cardStyles.hingeHeroAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={cardStyles.hingeHeroAvatarFallback}>
            <Text style={cardStyles.hingeHeroAvatarInitial}>
              {("name" in currentData
                ? currentData.name || "?"
                : "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={cardStyles.hingeHeroName} numberOfLines={2}>
          {"name" in currentData ? currentData.name : ""}
        </Text>
        {"desiredRole" in currentData &&
          !!currentData.desiredRole && (
            <Text
              style={cardStyles.hingeHeroSubtitle}
              numberOfLines={2}
            >
              {currentData.desiredRole}
            </Text>
          )}
        <View style={cardStyles.hingeHeroPillRow}>
          {"company" in currentData &&
            !!currentData.company && (
              <View style={cardStyles.heroPill}>
                <Briefcase color="#666" size={11} />
                <Text style={cardStyles.heroPillText}>
                  {currentData.company}
                </Text>
              </View>
            )}
          {"location" in currentData &&
            !!currentData.location && (
              <View style={cardStyles.heroPill}>
                <MapPin color="#666" size={11} />
                <Text style={cardStyles.heroPillText}>
                  {currentData.location}
                </Text>
              </View>
            )}
        </View>
      </View>
    
      <View style={cardStyles.hingeDivider} />
    
      {/* ABOUT — full bio, no clamp */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cachedBio =
          uid && fullProfileCache[String(uid)]?.bio;
        const bio: string =
          cachedBio ||
          ("bio" in currentData ? currentData.bio : "") ||
          "";
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>ABOUT</Text>
            <Text style={cardStyles.hingeBodyText}>
              {bio.trim().length > 0
                ? bio
                : "No bio added yet."}
            </Text>
          </View>
        );
      })()}
    
      {/* INSIGHTS — Q&A cards, full text */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const inlinePrompts =
          "prompts" in currentData ? currentData.prompts : null;
        const prompts: ProfilePrompt[] =
          cached?.prompts && cached.prompts.length > 0
            ? cached.prompts
            : Array.isArray(inlinePrompts)
              ? inlinePrompts
              : [];
        if (prompts.length === 0 && fullProfileLoading) {
          return (
            <View style={cardStyles.hingeSection}>
              <Text style={cardStyles.hingeSectionLabel}>
                INSIGHTS
              </Text>
              <View
                style={{
                  alignItems: "flex-start",
                  paddingVertical: 4,
                }}
              >
                <ActivityIndicator color="#999" />
              </View>
            </View>
          );
        }
        if (prompts.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              INSIGHTS
            </Text>
            {prompts.map((prompt, idx) => (
              <View
                key={idx}
                style={[
                  cardStyles.hingeInsightCard,
                  idx > 0 && { marginTop: 14 },
                ]}
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
                    <Text style={cardStyles.hingeInsightQuoteMark}>
                      “
                    </Text>
                    <Text style={cardStyles.hingeInsightAnswer}>
                      {prompt.answer}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      })()}
    
      {/* TOP SKILLS — chips */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const fromCache = Array.isArray(cached?.skills)
          ? cached.skills
          : [];
        const fromCard =
          "skills" in currentData && Array.isArray(currentData.skills)
            ? currentData.skills
            : [];
        const skills =
          fromCache.length > 0 ? fromCache : fromCard;
        if (skills.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              TOP SKILLS
            </Text>
            <View style={cardStyles.hingeChipsWrap}>
              {skills.map((skill: string, idx: number) => (
                <View key={idx} style={cardStyles.hingeSkillChip}>
                  <Text style={cardStyles.hingeSkillChipText}>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}
    
      {/* EXPERIENCE — timeline */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const experiences = Array.isArray(cached?.experiences)
          ? cached.experiences
          : [];
        if (experiences.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              EXPERIENCE
            </Text>
            {experiences.map((exp, idx) => (
              <View
                key={idx}
                style={[
                  cardStyles.hingeTimelineRow,
                  idx > 0 && { marginTop: 18 },
                ]}
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
                    <Text
                      style={cardStyles.hingeTimelineDescription}
                    >
                      {exp.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        );
      })()}
    
      {/* EDUCATION — timeline */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const education = Array.isArray(cached?.education)
          ? cached.education
          : [];
        if (education.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              EDUCATION
            </Text>
            {education.map((edu, idx) => (
              <View
                key={idx}
                style={[
                  cardStyles.hingeTimelineRow,
                  idx > 0 && { marginTop: 18 },
                ]}
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
                      edu.graduationYear &&
                        `Class of ${edu.graduationYear}`,
                      edu.gpa && `GPA ${edu.gpa}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })()}
    
      {/* CERTIFICATIONS — credential blocks */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const certs = Array.isArray(cached?.certifications)
          ? cached.certifications
          : [];
        if (certs.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              CERTIFICATIONS
            </Text>
            <View style={cardStyles.hingeCredentialList}>
              {certs.map((cert, idx) => (
                <View
                  key={idx}
                  style={cardStyles.hingeCredentialBlock}
                >
                  <Text style={cardStyles.hingeCredentialName}>
                    {cert.name}
                  </Text>
                  <Text style={cardStyles.hingeCredentialMeta}>
                    {cert.organization}
                    {cert.year ? ` · ${cert.year}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}
    
      {/* LANGUAGES — credential blocks */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const langs = Array.isArray(cached?.languages)
          ? cached.languages
          : [];
        if (langs.length === 0) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              LANGUAGES
            </Text>
            <View style={cardStyles.hingeCredentialList}>
              {langs.map((lang, idx) => (
                <View
                  key={idx}
                  style={cardStyles.hingeCredentialBlock}
                >
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
        );
      })()}
    
      {/* ACHIEVEMENTS */}
      {(() => {
        const uid = currentData?.USER_ID;
        const cached = uid
          ? fullProfileCache[String(uid)]
          : null;
        const ach: string = cached?.achievements || "";
        if (!ach) return null;
        return (
          <View style={cardStyles.hingeSection}>
            <Text style={cardStyles.hingeSectionLabel}>
              ACHIEVEMENTS
            </Text>
            <Text style={cardStyles.hingeBodyText}>{ach}</Text>
          </View>
        );
      })()}
    </>
  );
}
