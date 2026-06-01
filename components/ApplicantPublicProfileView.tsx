import { getPublicProfile } from "@/lib/api";
import { Color, Radius, Type } from "@/constants/theme";
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
              <MapPin color="#BBB" size={14} strokeWidth={2} />
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
              <GraduationCap size={15} color="#000" strokeWidth={2} />
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
              <Award size={15} color="#000" strokeWidth={2} />
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
              <Sparkles size={15} color="#000" strokeWidth={2} />
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
              <Sparkles size={15} color="#000" strokeWidth={2} />
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
    backgroundColor: Color.offWhite,
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
    marginBottom: 18,
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Color.surface,
  },
  name: {
    fontFamily: Type.sans400,
    fontSize: 30,
    color: Color.ink,
    letterSpacing: -0.7,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontFamily: Type.sans500,
    fontSize: 14,
    color: Color.body,
  },
  locationText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
  },
  bio: {
    fontFamily: Type.sans300,
    fontSize: 15,
    color: Color.body,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 16,
    paddingHorizontal: 10,
    maxWidth: 380,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: Color.paper,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Color.border,
  },
  whiteBtnText: {
    fontFamily: Type.sans500,
    color: Color.ink,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.xl,
    padding: 22,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: Type.sans600,
    fontSize: 22,
    color: Color.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: Type.sans500,
    fontSize: 10,
    color: Color.muted,
    marginTop: 4,
    letterSpacing: 1.4,
    textTransform: "uppercase",
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
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.muted,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
  },
  tagText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  preferenceTag: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
  },
  preferenceText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.body,
    letterSpacing: -0.1,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.ink,
  },
  roleTagText: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.paper,
    letterSpacing: -0.1,
  },

  // ── Resume section ──
  resumeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  resumeCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Color.border,
  },
  resumeCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  resumeCardTitle: {
    fontFamily: Type.sans600,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  resumeCardDate: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  resumeCardSubtitle: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.body,
    marginBottom: 6,
  },
  resumeCardBody: {
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.body,
    lineHeight: 21,
    marginTop: 6,
  },
  resumeCardFooterRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  certBadge: {
    backgroundColor: Color.paper,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Color.border,
    marginBottom: 4,
  },
  certName: {
    fontFamily: Type.sans600,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  certSub: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.muted,
    marginTop: 2,
  },
  langBadge: {
    backgroundColor: Color.paper,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    marginBottom: 4,
  },
  langName: {
    fontFamily: Type.sans600,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  langSub: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 3,
  },
  achievementsCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: Color.border,
  },
  achievementsText: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.body,
    lineHeight: 22,
  },

  // ── Avatar fallback ──
  avatarFallback: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: Color.ink,
  },
  avatarInitials: {
    fontFamily: Type.serifItalic,
    fontSize: 40,
    color: Color.paper,
  },

  // ── Stats divider ──
  statDivider: {
    width: 1,
    backgroundColor: Color.border,
    marginVertical: 4,
    alignSelf: "stretch" as const,
  },

  // ── Connected Via card ──
  connectedCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Color.border,
  },
  connectedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  connectedJobTitle: {
    fontFamily: Type.sans600,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.2,
  },
  connectedCompany: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
    marginTop: 2,
  },
});
