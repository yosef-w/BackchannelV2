import { Card, Pill, Screen, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { getPublicProfile } from "@/lib/api";
import {
  Award,
  Briefcase,
  Check,
  ChevronLeft,
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

interface SponsorPublicProfileViewProps {
  /** Full conversation object passed from MessagesView via onShowPublicProfile */
  userData: any;
  onClose: () => void;
}

export function SponsorPublicProfileView({
  userData,
  onClose,
}: SponsorPublicProfileViewProps) {
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const userId =
    userData?.otherParticipant?.id || userData?.USER_ID || userData?.userId;

  useEffect(() => {
    if (!userId) return;
    setLoadingProfile(true);
    getPublicProfile(String(userId))
      .then((pub) => setFullProfile(pub))
      .catch((err) =>
        console.warn(
          "[SponsorPublicProfileView] Failed to fetch profile:",
          err,
        ),
      )
      .finally(() => setLoadingProfile(false));
  }, [userId]);

  const sp = fullProfile?.sponsor_profile || {};

  const firstName =
    fullProfile?.FIRST_NAME ||
    userData?.otherParticipant?.name?.split(" ")[0] ||
    "";
  const lastName = fullProfile?.LAST_NAME || "";
  const displayName = fullProfile
    ? `${firstName} ${lastName}`.trim()
    : (userData?.otherParticipant?.name ?? "");

  const photoUrl =
    fullProfile?.PHOTO_URL || userData?.otherParticipant?.profileImageUrl;
  const jobTitle = sp.JOB_TITLE || userData?.otherParticipant?.role || "";
  const company = sp.COMPANY || userData?.otherParticipant?.company || "";

  const city = fullProfile?.CITY;
  const state = fullProfile?.STATE;
  const country = fullProfile?.COUNTRY;
  const locationStr = [city, state, country].filter(Boolean).join(", ");

  const bio = fullProfile?.BIO;
  const duration = sp.DURATION;
  const openToReferrals = sp.OPEN_TO_REFERRALS as boolean | undefined;
  const companiesCanReferTo: string[] = sp.COMPANIES_CAN_REFER_TO || [];
  const insights: { question: string; answer: string }[] = sp.INSIGHTS || [];

  const matchedJobTitle =
    userData?.jobContext?.jobTitle || userData?.appliedRole;
  const matchedCompany = userData?.jobContext?.company || company;

  // Split into first / last for the two-line serif headline
  const headlineFirst = firstName || displayName.split(" ")[0] || "—";
  const headlineRest = lastName || displayName.replace(headlineFirst, "").trim();

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

          <View style={styles.nameStack}>
            <Text variant="heroSerif" align="center" style={styles.nameLine}>
              {headlineFirst}
            </Text>
            {headlineRest ? (
              <Text
                variant="heroSerifItalic"
                align="center"
                style={styles.nameLine}
              >
                {headlineRest}
              </Text>
            ) : null}
          </View>

          {jobTitle || company ? (
            <View style={styles.metaRow}>
              <Briefcase
                color={tokens.colors.textMuted}
                size={13}
                strokeWidth={1.8}
              />
              <Text variant="bodySmall" color={tokens.colors.textBody}>
                {jobTitle}
                {company ? ` · ${company}` : ""}
                {duration ? ` · ${duration}` : ""}
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

        {/* Loading */}
        {loadingProfile ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.text} size="small" />
            <Text variant="bodySmall" color={tokens.colors.textMuted}>
              Loading profile details…
            </Text>
          </View>
        ) : null}

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
                  {matchedCompany ? (
                    <Text
                      variant="bodySmall"
                      color={tokens.colors.textBody}
                      style={{ marginTop: 2 }}
                    >
                      {matchedCompany}
                    </Text>
                  ) : null}
                </View>
                <Pill
                  tone={openToReferrals === false ? "danger" : "success"}
                  dot
                >
                  {openToReferrals === false ? "Closed" : "Open"}
                </Pill>
              </View>
            </Card>
          </Section>
        ) : null}

        {/* Key insights */}
        {!loadingProfile ? (
          <Section eyebrow="Key insights" icon={Sparkles}>
            {insights.length > 0 ? (
              insights.map((insight, idx) => (
                <Card
                  key={idx}
                  variant="default"
                  padded
                  style={styles.cardSpacing}
                >
                  <View style={styles.insightHeader}>
                    <View style={styles.insightIcon}>
                      {idx % 2 === 0 ? (
                        <Check
                          size={12}
                          color={tokens.colors.text}
                          strokeWidth={2.4}
                        />
                      ) : (
                        <Award
                          size={12}
                          color={tokens.colors.text}
                          strokeWidth={2.4}
                        />
                      )}
                    </View>
                    <Text variant="eyebrow" style={{ flex: 1 }}>
                      {insight.question}
                    </Text>
                  </View>
                  <Text
                    variant="body"
                    color={tokens.colors.textBody}
                    style={{ marginLeft: 32 }}
                  >
                    {insight.answer}
                  </Text>
                </Card>
              ))
            ) : (
              <Card variant="default" padded>
                <Text
                  variant="bodySmall"
                  color={tokens.colors.textFaint}
                  align="center"
                >
                  No insights shared yet.
                </Text>
              </Card>
            )}
          </Section>
        ) : null}

        {/* Companies — referable */}
        {companiesCanReferTo.length > 0 ? (
          <Section eyebrow="Companies I can refer to">
            <View style={styles.pillCloud}>
              {companiesCanReferTo.map((co, idx) => (
                <Pill key={`${co}-${idx}`} tone="neutral">
                  {co}
                </Pill>
              ))}
            </View>
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: tokens.spacing.l,
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
  cardSpacing: {
    marginBottom: tokens.spacing.sm,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: tokens.spacing.s,
  },
  insightIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
