import { getPublicProfile } from "@/lib/api";
import {
    Award,
    Briefcase,
    ChevronLeft,
    Globe,
    GraduationCap,
    MapPin,
    Sparkles,
    Target,
} from "lucide-react-native";
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
import { tokens } from "@/constants/theme";

interface ApplicantPublicProfileViewProps {
  userData: any;
  onClose: () => void;
}

const parseVariant = (v: any): any[] => {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      return JSON.parse(v) || [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
};

export function ApplicantPublicProfileView({
  userData,
  onClose,
}: ApplicantPublicProfileViewProps) {
  const [fullProfile, setFullProfile] = useState<any>(null);
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
  const ap = (fullProfile as any)?.applicant_profile || {};
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
    (experiences[0] as any)?.company ||
    userData?.otherParticipant?.company ||
    userData?.company ||
    "";

  const locationStr = [fullProfile?.CITY, fullProfile?.STATE]
    .filter(Boolean)
    .join(", ");

  const bio = fullProfile?.BIO || "";

  // Desired roles from applicant_profile positions
  const desiredRoles: string[] = parseVariant(ap.POSITIONS);

  // Insights / questionnaire answers
  const insights: Array<{ question: string; answer: string }> =
    ap.INSIGHTS || [];

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
            <ChevronLeft color={tokens.colors.text} size={28} strokeWidth={2} />
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
              <Briefcase color={tokens.colors.text} size={14} strokeWidth={2} />
              <Text style={styles.infoText}>
                {currentRole}
                {currentCompany ? ` @ ${currentCompany}` : ""}
              </Text>
            </View>
          ) : null}

          {locationStr ? (
            <View style={styles.infoRow}>
              <MapPin color={tokens.colors.textFaint} size={14} strokeWidth={2} />
              <Text style={styles.locationText}>{locationStr}</Text>
            </View>
          ) : null}

          {bio ? <Text style={styles.bio}>{bio}</Text> : null}
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
            <ActivityIndicator color={tokens.colors.text} size="small" />
            <Text style={styles.loadingText}>Loading profile details…</Text>
          </View>
        )}

        {/* Connected Via — the job this match is based on */}
        {matchedJobTitle ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONNECTED VIA</Text>
            <View style={styles.connectedCard}>
              <View style={styles.connectedIconCircle}>
                <Briefcase size={16} color={tokens.colors.text} strokeWidth={2} />
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
                  <Target size={14} color={tokens.colors.brandText} strokeWidth={2.5} />
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
              <Briefcase size={15} color={tokens.colors.text} strokeWidth={2} />
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
            {experiences.map((exp: any, idx: number) => (
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
              <GraduationCap size={15} color={tokens.colors.text} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                EDUCATION
              </Text>
            </View>
            {educationEntries.map((edu: any, idx: number) => (
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
              <Award size={15} color={tokens.colors.text} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                CERTIFICATIONS
              </Text>
            </View>
            <View style={styles.tagCloud}>
              {certifications.map((cert: any, idx: number) => (
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
              <Sparkles size={15} color={tokens.colors.text} strokeWidth={2} />
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
              <Globe size={15} color={tokens.colors.text} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                LANGUAGES
              </Text>
            </View>
            <View style={styles.tagCloud}>
              {languages.map((lang: any, idx: number) => (
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
              <Sparkles size={15} color={tokens.colors.text} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                ACHIEVEMENTS & AWARDS
              </Text>
            </View>
            <View style={styles.achievementsCard}>
              <Text style={styles.achievementsText}>{achievements}</Text>
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
    backgroundColor: tokens.colors.bg,
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
    backgroundColor: tokens.colors.bgOffWhite,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -1,
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
    color: tokens.colors.text,
  },
  locationText: {
    fontSize: 14,
    color: tokens.colors.textFaint,
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: tokens.colors.textBody,
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
    backgroundColor: tokens.colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  whiteBtnText: {
    color: tokens.colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.textFaint,
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
    color: tokens.colors.textMuted,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.colors.textFaint,
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
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  preferenceTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand,
  },
  roleTagText: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.brandText,
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
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
    flex: 1,
    marginRight: 8,
  },
  resumeCardDate: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.colors.textMuted,
  },
  resumeCardSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.textBody,
    marginBottom: 6,
  },
  resumeCardBody: {
    fontSize: 13,
    color: tokens.colors.textBody,
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
    borderColor: tokens.colors.border,
    marginBottom: 4,
  },
  certName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  certSub: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  langBadge: {
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    marginBottom: 4,
  },
  langName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  langSub: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  achievementsCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  achievementsText: {
    fontSize: 14,
    color: tokens.colors.textBody,
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
    color: tokens.colors.text,
  },

  // ── Stats divider ──────────────────────────────────────────────────────────────
  statDivider: {
    width: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: 4,
    alignSelf: "stretch" as const,
  },

  // ── Connected Via card ─────────────────────────────────────────────────────
  connectedCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
  },
  connectedCompany: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: tokens.colors.textBody,
    marginTop: 2,
  },
});
