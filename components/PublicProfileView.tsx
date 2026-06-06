import { Pill, Screen, Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { Briefcase, ChevronLeft, MapPin } from "lucide-react-native";
import React from "react";
import {
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

/**
 * Generic public profile view — a magazine-spread layout: serif name,
 * eyebrow metadata, body bio, pill clouds for skills / preferences / roles.
 * Used as a fallback for older code paths that haven't migrated to the
 * applicant- or sponsor-specific variants.
 */
export function ApplicantPublicProfileView({
  userData,
  onClose,
}: ApplicantPublicProfileViewProps) {
  const stats = [
    { label: "Connections", value: "42" },
    { label: "Referrals", value: "8" },
    { label: "Response", value: "98%" },
  ];

  const name: string = userData?.name ?? "";
  const firstLine = name.split(" ")[0] || name;
  const restLine = name.replace(firstLine, "").trim();
  const initial = (name || "?")[0]?.toUpperCase() ?? "?";

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
            {userData?.image ? (
              <Image source={{ uri: userData.image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text variant="titleSerif" color={tokens.colors.brandText}>
                  {initial}
                </Text>
              </View>
            )}
          </View>

          {/* Two-line serif name: first name + rest in italic accent */}
          <View style={styles.nameStack}>
            <Text variant="heroSerif" align="center" style={styles.nameLine}>
              {firstLine}
            </Text>
            {restLine ? (
              <Text
                variant="heroSerifItalic"
                align="center"
                style={styles.nameLine}
              >
                {restLine}
              </Text>
            ) : null}
          </View>

          {/* Role + location row */}
          {userData?.role ? (
            <View style={styles.metaRow}>
              <Briefcase
                color={tokens.colors.textMuted}
                size={13}
                strokeWidth={1.8}
              />
              <Text variant="bodySmall" color={tokens.colors.textBody}>
                {userData.role}
                {userData.company ? ` · ${userData.company}` : ""}
              </Text>
            </View>
          ) : null}
          {userData?.location ? (
            <View style={styles.metaRow}>
              <MapPin
                color={tokens.colors.textFaint}
                size={13}
                strokeWidth={1.8}
              />
              <Text variant="bodySmall" color={tokens.colors.textMuted}>
                {userData.location}
              </Text>
            </View>
          ) : null}

          {userData?.bio ? (
            <Text
              variant="bodyLarge"
              align="center"
              style={styles.bio}
            >
              {userData.bio}
            </Text>
          ) : null}
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          {stats.map((stat, index) => (
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

        {/* Skills */}
        {userData?.skills?.length ? (
          <Section eyebrow="Skills &amp; interests">
            <PillCloud items={userData.skills} tone="neutral" />
          </Section>
        ) : null}

        {/* Work preferences */}
        {userData?.workPreferences?.length ? (
          <Section eyebrow="Work preferences">
            <PillCloud items={userData.workPreferences} tone="info" />
          </Section>
        ) : null}

        {/* Desired roles */}
        {userData?.desiredRoles?.length ? (
          <Section eyebrow="Desired roles">
            <PillCloud items={userData.desiredRoles} tone="success" />
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" style={styles.sectionEyebrow}>
        {eyebrow}
      </Text>
      {children}
    </View>
  );
}

function PillCloud({
  items,
  tone,
}: {
  items: string[];
  tone: "neutral" | "info" | "success";
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
    paddingBottom: tokens.spacing.xxxl,
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
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionEyebrow: {
    marginBottom: tokens.spacing.sm,
  },
  pillCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
