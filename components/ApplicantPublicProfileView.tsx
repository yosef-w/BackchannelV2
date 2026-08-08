import { getPublicProfile, type PublicProfileResponse } from "@/lib/api";
import type { PublicProfileUserData } from "@/types/profiles";
import {
    Award,
    Briefcase,
    ChevronLeft,
    Globe,
    GraduationCap,
    MapPin,
    Target,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ExpandableText } from "./ui/ExpandableText";
import { Colors, Fonts, Type } from "@/constants/theme";

interface ApplicantPublicProfileViewProps {
  userData: PublicProfileUserData;
  onClose: () => void;
}

/** Parse a field that may be a JSON-encoded string, a real array, or absent. */
function parseVariant<T>(v: string | T[] | null | undefined): T[] {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      return JSON.parse(v) || [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

export function ApplicantPublicProfileView({
  userData,
  onClose,
}: ApplicantPublicProfileViewProps) {
  const [fullProfile, setFullProfile] = useState<PublicProfileResponse | null>(
    null,
  );
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Fetch full profile on mount using the other participant's ID
  useEffect(() => {
    const userId =
      userData?.otherParticipant?.id || userData?.USER_ID || userData?.userId;
    if (!userId) return;

    setLoadingProfile(true);
    getPublicProfile(String(userId))
      .then((pub) => setFullProfile(pub))
      .catch((err) =>
        console.warn(
          "[ApplicantPublicProfileView] Failed to fetch profile:",
          err,
        ),
      )
      .finally(() => setLoadingProfile(false));
  }, [userData?.otherParticipant?.id, userData?.USER_ID, userData?.userId]);

  // Parsed resume sections from full profile
  const ap: Partial<NonNullable<PublicProfileResponse["applicant_profile"]>> =
    fullProfile?.applicant_profile || {};
  const experiences = parseVariant(ap.PROFESSIONAL_EXPERIENCES);
  const educationEntries = parseVariant(ap.EDUCATION_ENTRIES);
  const certifications = parseVariant(ap.CERTIFICATIONS);
  const languages = parseVariant(ap.LANGUAGES);
  const achievements: string = ap.ACHIEVEMENTS || "";

  // Merge skills — prefer full profile data if available
  const skills: string[] = parseVariant(ap.SKILLS).length
    ? parseVariant(ap.SKILLS)
    : Array.isArray(userData?.skills)
      ? userData.skills
      : [];

  // ── Display values — prefer full API data; fall back to conversation fields ──
  const displayName = fullProfile
    ? `${fullProfile.FIRST_NAME || ""} ${fullProfile.LAST_NAME || ""}`.trim()
    : userData?.otherParticipant?.name || userData?.name || "";

  const photoUrl =
    fullProfile?.PHOTO_URL ||
    userData?.otherParticipant?.profileImageUrl ||
    userData?.profileImageUrl;

  const currentRole =
    ap.CURRENT_ROLE || userData?.otherParticipant?.role || userData?.role || "";

  const currentCompany =
    experiences[0]?.company ||
    userData?.otherParticipant?.company ||
    userData?.company ||
    "";

  const locationStr = [fullProfile?.CITY, fullProfile?.STATE]
    .filter(Boolean)
    .join(", ");

  const bio = fullProfile?.BIO || "";

  // Desired roles from applicant_profile positions
  const desiredRoles: string[] = parseVariant(ap.POSITIONS);

  // Insights / questionnaire answers. Same runtime as the untyped version
  // (`ap.INSIGHTS || []`, no parse) — the cast asserts the array form the
  // backend sends on this endpoint.
  const insights = (ap.INSIGHTS || []) as Array<{
    question: string;
    answer: string;
  }>;

  // Context from the conversation (the job this match is based on)
  const matchedJobTitle =
    userData?.jobContext?.jobTitle || userData?.appliedRole;
  const matchedJobCompany = userData?.jobContext?.company || "";

  // Real stats from full profile (2 cells match SponsorPublicProfileView layout)
  const profileStats = [
    { label: "YRS EXP.", value: ap.YEARS_EXPERIENCE || "—" },
    { label: "SKILLS", value: skills.length > 0 ? String(skills.length) : "—" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <ChevronLeft color="#000" size={28} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{displayName || "—"}</Text>

          {currentRole || currentCompany ? (
            <View style={styles.infoRow}>
              <Briefcase color="#000" size={14} strokeWidth={2} />
              <Text style={styles.infoText}>
                {currentRole}
                {currentCompany ? ` @ ${currentCompany}` : ""}
              </Text>
            </View>
          ) : null}

          {locationStr ? (
            <View style={styles.infoRow}>
              <MapPin color={Colors.faint} size={14} strokeWidth={2} />
              <Text style={styles.locationText}>{locationStr}</Text>
            </View>
          ) : null}

          {bio ? (
            <ExpandableText style={styles.bio} numberOfLines={5}>
              {bio}
            </ExpandableText>
          ) : null}
        </View>

        {/* Stats Grid — shown once profile has loaded */}
        {!loadingProfile ? (
          <View style={styles.statsGrid}>
            {profileStats.map((stat, index) => (
              <React.Fragment key={stat.label}>
                {index > 0 && <View style={styles.statDivider} />}
                <Animated.View
                  entering={FadeInUp.delay(index * 100).duration(400)}
                  style={styles.statBox}
                >
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </Animated.View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#000" size="small" />
            <Text style={styles.loadingText}>Loading profile details…</Text>
          </View>
        )}

        {/* Connected Via — the job this match is based on */}
        {matchedJobTitle ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONNECTED VIA</Text>
            <View style={styles.connectedCard}>
              <View style={styles.connectedIconCircle}>
                <Briefcase size={16} color="#000" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectedJobTitle}>{matchedJobTitle}</Text>
                {matchedJobCompany ? (
                  <Text style={styles.connectedCompany}>
                    {matchedJobCompany}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Skills & Interests */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SKILLS & INTERESTS</Text>
            <View style={styles.tagCloud}>
              {skills.map((skill: string, idx: number) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Desired Roles */}
        {desiredRoles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESIRED ROLES</Text>
            <View style={styles.tagCloud}>
              {desiredRoles.map((role: string, idx: number) => (
                <View key={idx} style={styles.roleTag}>
                  <Target size={14} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.roleTagText}>{role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Resume-derived sections (lazy-loaded) ── */}

        {/* Professional Experience */}
        {experiences.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <Briefcase size={15} color="#000" strokeWidth={2} />
              {/* marginBottom override — the standalone sectionTitle has
                  marginBottom:16 (needed when the label sits directly above
                  content), but inside a flex row that bottom margin makes
                  the text sit higher than the icon. The wrapping row's own
                  marginBottom already handles the separation to the cards
                  below. Same override applies to every resumeSectionHeader. */}
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                PROFESSIONAL EXPERIENCE
              </Text>
            </View>
            {experiences.map((exp, idx) => (
              <View key={idx} style={styles.resumeCard}>
                <View style={styles.resumeCardRow}>
                  <Text style={styles.resumeCardTitle}>{exp.jobTitle}</Text>
                  <Text style={styles.resumeCardDate}>
                    {exp.startDate}
                    {exp.current
                      ? " – Present"
                      : exp.endDate
                        ? ` – ${exp.endDate}`
                        : ""}
                  </Text>
                </View>
                <Text style={styles.resumeCardSubtitle}>{exp.company}</Text>
                {exp.description ? (
                  <Text style={styles.resumeCardBody}>{exp.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {educationEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <GraduationCap size={15} color="#000" strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                EDUCATION
              </Text>
            </View>
            {educationEntries.map((edu, idx) => (
              <View key={idx} style={styles.resumeCard}>
                <Text style={styles.resumeCardTitle}>
                  {edu.degree}
                  {edu.major ? ` in ${edu.major}` : ""}
                </Text>
                <Text style={styles.resumeCardSubtitle}>{edu.university}</Text>
                <View style={styles.resumeCardFooterRow}>
                  {edu.graduationYear ? (
                    <Text style={styles.resumeCardDate}>
                      Class of {edu.graduationYear}
                    </Text>
                  ) : null}
                  {edu.gpa ? (
                    <Text style={styles.resumeCardDate}>GPA: {edu.gpa}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <Award size={15} color="#000" strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                CERTIFICATIONS
              </Text>
            </View>
            <View style={styles.tagCloud}>
              {certifications.map((cert, idx) => (
                <View key={idx} style={styles.certBadge}>
                  <Text style={styles.certName}>{cert.name}</Text>
                  {cert.organization || cert.year ? (
                    <Text style={styles.certSub}>
                      {cert.organization}
                      {cert.year ? ` • ${cert.year}` : ""}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Key Insights */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                KEY INSIGHTS
              </Text>
            </View>
            {insights.map(
              (insight: { question: string; answer: string }, idx: number) => (
                <View key={idx} style={styles.resumeCard}>
                  <Text style={styles.resumeCardTitle}>{insight.question}</Text>
                  <Text style={styles.resumeCardBody}>{insight.answer}</Text>
                </View>
              ),
            )}
          </View>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <Globe size={15} color="#000" strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                LANGUAGES
              </Text>
            </View>
            <View style={styles.tagCloud}>
              {languages.map((lang, idx) => (
                <View key={idx} style={styles.langBadge}>
                  <Text style={styles.langName}>{lang.language}</Text>
                  {lang.proficiency ? (
                    <Text style={styles.langSub}>{lang.proficiency}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Achievements */}
        {achievements ? (
          <View style={styles.section}>
            <View style={styles.resumeSectionHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                ACHIEVEMENTS & AWARDS
              </Text>
            </View>
            <View style={styles.achievementsCard}>
              <ExpandableText style={styles.achievementsText} numberOfLines={5}>
                {achievements}
              </ExpandableText>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    ...Platform.select({
      android: {
        paddingTop: StatusBar.currentHeight,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 140,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 0,
    padding: 4,
    zIndex: 10,
  },
  avatarWrapper: {
    marginBottom: 20,
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.offWhite,
  },
  name: {
    ...Type.title,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.ink,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink,
  },
  locationText: {
    fontSize: 14,
    color: Colors.faint,
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  whiteBtnText: {
    color: Colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: Colors.offWhite,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  // Matches the site's .stat-num (serif for stat/count displays).
  statValue: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.faint,
    marginTop: 4,
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.faint,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  preferenceTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
    borderWidth: 1.5,
    borderColor: "#F4F4F5",
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.body,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#000",
  },
  roleTagText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  // ── Resume section styles ──
  resumeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  resumeCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resumeCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  resumeCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    flex: 1,
    marginRight: 8,
  },
  resumeCardDate: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
  },
  resumeCardSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },
  resumeCardBody: {
    fontSize: 13,
    color: Colors.body,
    lineHeight: 20,
    marginTop: 4,
  },
  resumeCardFooterRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  certBadge: {
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  certName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  certSub: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    marginTop: 2,
  },
  langBadge: {
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginBottom: 4,
  },
  langName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  langSub: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    marginTop: 2,
  },
  achievementsCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  achievementsText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
    fontWeight: "500",
  },

  // ── Avatar fallback ─────────────────────────────────────────────────────────
  avatarFallback: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#EDEDED",
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: "800" as const,
    color: Colors.ink,
  },

  // ── Stats divider ──────────────────────────────────────────────────────────────
  statDivider: {
    width: 1,
    backgroundColor: "#E8E8E8",
    marginVertical: 4,
    alignSelf: "stretch" as const,
  },

  // ── Connected Via card ─────────────────────────────────────────────────────
  connectedCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.offWhite,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDEDED",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  connectedJobTitle: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#000",
  },
  connectedCompany: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.body,
    marginTop: 2,
  },
});
