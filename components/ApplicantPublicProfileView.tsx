import { Card, Pill, Screen, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { getPublicProfile } from "@/lib/api";
import {
  Award,
  Briefcase,
  ChevronLeft,
  Globe,
  GraduationCap,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
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

  const ap = (fullProfile as any)?.applicant_profile || {};
  const experiences = parseVariant(ap.PROFESSIONAL_EXPERIENCES);
  const educationEntries = parseVariant(ap.EDUCATION_ENTRIES);
  const certifications = parseVariant(ap.CERTIFICATIONS);
  const languages = parseVariant(ap.LANGUAGES);
  const achievements: string = ap.ACHIEVEMENTS || "";

  const skills: string[] = parseVariant(ap.SKILLS).length
    ? parseVariant(ap.SKILLS)
    : Array.isArray(userData?.skills)
      ? userData.skills
      : [];

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
  const desiredRoles: string[] = parseVariant(ap.POSITIONS);
  const insights: { question: string; answer: string }[] = ap.INSIGHTS || [];
  const matchedJobTitle =
    userData?.jobContext?.jobTitle || userData?.appliedRole;
  const matchedJobCompany = userData?.jobContext?.company || "";

  // Split name into first / rest for the two-line serif headline.
  const firstName = displayName.split(" ")[0] || displayName;
  const lastName = displayName.replace(firstName, "").trim();

  const profileStats = [
    { label: "Years exp.", value: ap.YEARS_EXPERIENCE || "—" },
    { label: "Skills", value: skills.length > 0 ? String(skills.length) : "—" },
  ];

  return (
    <Screen background="paper">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <ChevronLeft color={tokens.colors.text} size={24} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text variant="titleSerif" color={tokens.colors.brandText}>
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>
            )}
          </View>

          {/* Two-line serif name */}
          <View style={styles.nameStack}>
            <Text variant="heroSerif" align="center" style={styles.nameLine}>
              {firstName || "—"}
            </Text>
            {lastName ? (
              <Text
                variant="heroSerifItalic"
                align="center"
                style={styles.nameLine}
              >
                {lastName}
              </Text>
            ) : null}
          </View>

          {currentRole || currentCompany ? (
            <View style={styles.metaRow}>
              <Briefcase
                color={tokens.colors.textMuted}
                size={13}
                strokeWidth={1.8}
              />
              <Text variant="bodySmall" color={tokens.colors.textBody}>
                {currentRole}
                {currentCompany ? ` · ${currentCompany}` : ""}
              </Text>
            </View>
          ) : null}

          {locationStr ? (
            <View style={styles.metaRow}>
              <MapPin
                color={tokens.colors.textFaint}
                size={13}
                strokeWidth={1.8}
              />
              <Text variant="bodySmall" color={tokens.colors.textMuted}>
                {locationStr}
              </Text>
            </View>
          ) : null}

          {bio ? (
            <Text variant="bodyLarge" align="center" style={styles.bio}>
              {bio}
            </Text>
          ) : null}
        </View>

        {/* Stats strip */}
        {!loadingProfile ? (
          <View style={styles.statsStrip}>
            {profileStats.map((stat, index) => (
              <React.Fragment key={stat.label}>
                {index > 0 ? <View style={styles.statSep} /> : null}
                <Animated.View
                  entering={FadeInUp.delay(index * 80).duration(360)}
                  style={styles.statBox}
                >
                  <Text variant="titleSerif" style={styles.statValue}>
                    {stat.value}
                  </Text>
                  <Text variant="eyebrow" color={tokens.colors.textFaint}>
                    {stat.label}
                  </Text>
                </Animated.View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.text} size="small" />
            <Text variant="bodySmall" color={tokens.colors.textMuted}>
              Loading profile details…
            </Text>
          </View>
        )}

        {/* Connected via */}
        {matchedJobTitle ? (
          <Section eyebrow="Connected via">
            <Card variant="default" padded>
              <View style={styles.connectedRow}>
                <View style={styles.connectedIcon}>
                  <Briefcase
                    size={16}
                    color={tokens.colors.text}
                    strokeWidth={1.8}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="cardTitle">{matchedJobTitle}</Text>
                  {matchedJobCompany ? (
                    <Text
                      variant="bodySmall"
                      color={tokens.colors.textBody}
                      style={{ marginTop: 2 }}
                    >
                      {matchedJobCompany}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          </Section>
        ) : null}

        {/* Skills */}
        {skills.length > 0 ? (
          <Section eyebrow="Skills &amp; interests">
            <PillCloud items={skills} tone="neutral" />
          </Section>
        ) : null}

        {/* Desired roles */}
        {desiredRoles.length > 0 ? (
          <Section eyebrow="Desired roles">
            <PillCloud items={desiredRoles} tone="success" />
          </Section>
        ) : null}

        {/* Experience */}
        {experiences.length > 0 ? (
          <Section eyebrow="Professional experience" icon={Briefcase}>
            {experiences.map((exp: any, idx: number) => (
              <Card key={idx} variant="default" padded style={styles.cardSpacing}>
                <View style={styles.resumeRow}>
                  <Text variant="cardTitle" style={{ flex: 1 }}>
                    {exp.jobTitle}
                  </Text>
                  <Text variant="meta">
                    {exp.startDate}
                    {exp.current
                      ? " – Present"
                      : exp.endDate
                        ? ` – ${exp.endDate}`
                        : ""}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  color={tokens.colors.textBody}
                  style={{ marginTop: 2 }}
                >
                  {exp.company}
                </Text>
                {exp.description ? (
                  <Text
                    variant="bodySmall"
                    color={tokens.colors.textBody}
                    style={{ marginTop: tokens.spacing.s }}
                  >
                    {exp.description}
                  </Text>
                ) : null}
              </Card>
            ))}
          </Section>
        ) : null}

        {/* Education */}
        {educationEntries.length > 0 ? (
          <Section eyebrow="Education" icon={GraduationCap}>
            {educationEntries.map((edu: any, idx: number) => (
              <Card key={idx} variant="default" padded style={styles.cardSpacing}>
                <Text variant="cardTitle">
                  {edu.degree}
                  {edu.major ? ` in ${edu.major}` : ""}
                </Text>
                <Text
                  variant="bodySmall"
                  color={tokens.colors.textBody}
                  style={{ marginTop: 2 }}
                >
                  {edu.university}
                </Text>
                <View style={styles.resumeFooterRow}>
                  {edu.graduationYear ? (
                    <Text variant="meta">Class of {edu.graduationYear}</Text>
                  ) : null}
                  {edu.gpa ? (
                    <Text variant="meta">GPA: {edu.gpa}</Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </Section>
        ) : null}

        {/* Certifications */}
        {certifications.length > 0 ? (
          <Section eyebrow="Certifications" icon={Award}>
            <View style={styles.cardCol}>
              {certifications.map((cert: any, idx: number) => (
                <Card
                  key={idx}
                  variant="default"
                  padded={false}
                  style={styles.smallCard}
                >
                  <Text variant="cardTitle">{cert.name}</Text>
                  {cert.organization || cert.year ? (
                    <Text
                      variant="meta"
                      color={tokens.colors.textMuted}
                      style={{ marginTop: 2 }}
                    >
                      {cert.organization}
                      {cert.year ? ` · ${cert.year}` : ""}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Insights — Q&A pairs */}
        {insights.length > 0 ? (
          <Section eyebrow="Key insights" icon={Sparkles}>
            {insights.map(
              (insight: { question: string; answer: string }, idx: number) => (
                <Card
                  key={idx}
                  variant="default"
                  padded
                  style={styles.cardSpacing}
                >
                  <Text variant="eyebrow" style={{ marginBottom: 6 }}>
                    {insight.question}
                  </Text>
                  <Text variant="body" color={tokens.colors.textBody}>
                    {insight.answer}
                  </Text>
                </Card>
              ),
            )}
          </Section>
        ) : null}

        {/* Languages */}
        {languages.length > 0 ? (
          <Section eyebrow="Languages" icon={Globe}>
            <View style={styles.cardCol}>
              {languages.map((lang: any, idx: number) => (
                <Card
                  key={idx}
                  variant="default"
                  padded={false}
                  style={styles.smallCard}
                >
                  <Text variant="cardTitle">{lang.language}</Text>
                  {lang.proficiency ? (
                    <Text
                      variant="meta"
                      color={tokens.colors.textMuted}
                      style={{ marginTop: 2 }}
                    >
                      {lang.proficiency}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Achievements — free-form text */}
        {achievements ? (
          <Section eyebrow="Achievements &amp; awards" icon={Sparkles}>
            <Card variant="default" padded>
              <Text variant="body" color={tokens.colors.textBody}>
                {achievements}
              </Text>
            </Card>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({
  eyebrow,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {Icon ? (
          <Icon size={13} color={tokens.colors.text} strokeWidth={1.8} />
        ) : null}
        <Text variant="eyebrow">{eyebrow}</Text>
      </View>
      {children}
    </View>
  );
}

function PillCloud({
  items,
  tone,
}: {
  items: string[];
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <View style={styles.pillCloud}>
      {items.map((item, idx) => (
        <Pill key={`${item}-${idx}`} tone={tone}>
          {item}
        </Pill>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: tokens.layout.screenPaddingH,
    paddingTop: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxxl + tokens.spacing.l,
  },
  header: {
    alignItems: "center",
    marginBottom: tokens.spacing.xl,
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 0,
    padding: 4,
    zIndex: 10,
  },
  avatarWrap: {
    marginBottom: tokens.spacing.m,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tokens.colors.bgOffWhite,
  },
  avatarFallback: {
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  nameStack: {
    alignItems: "center",
    marginBottom: tokens.spacing.s,
  },
  nameLine: {
    fontSize: 36,
    lineHeight: 40,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: tokens.spacing.xs,
  },
  bio: {
    marginTop: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.sm,
    maxWidth: 480,
  },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.l,
    paddingVertical: tokens.spacing.ml,
    marginBottom: tokens.spacing.xl,
  },
  statSep: {
    width: 1,
    height: 32,
    backgroundColor: tokens.colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 26,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: tokens.spacing.m,
    marginBottom: tokens.spacing.s,
  },
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  pillCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cardSpacing: {
    marginBottom: tokens.spacing.sm,
  },
  cardCol: {
    gap: tokens.spacing.s,
  },
  smallCard: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.m,
  },
  resumeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.s,
  },
  resumeFooterRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  connectedIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.s,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
});
