import { getPublicProfile, type PublicProfileResponse } from "@/lib/api";
import type { PublicProfileUserData } from "@/types/profiles";
import {
    Award,
    Briefcase,
    Check,
    ChevronLeft,
    MapPin,
    ShieldCheck,
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

interface SponsorPublicProfileViewProps {
  /** Full conversation object passed from MessagesView via onShowPublicProfile */
  userData: PublicProfileUserData;
  onClose: () => void;
}

export function SponsorPublicProfileView({
  userData,
  onClose,
}: SponsorPublicProfileViewProps) {
  const [fullProfile, setFullProfile] =
    useState<PublicProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // The sponsor's user ID lives in otherParticipant.id of the conversation object.
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

  // ── Derive display values ─────────────────────────────────────────────────
  // Prefer full API data; fall back to conversation fields so something shows
  // while the network call is in-flight.
  const sp: Partial<NonNullable<PublicProfileResponse["sponsor_profile"]>> =
    fullProfile?.sponsor_profile || {};

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
  // Same runtime as the untyped version (no parse) — the cast asserts the
  // array form the backend sends on this endpoint.
  const insights = (sp.INSIGHTS || []) as Array<{
    question: string;
    answer: string;
  }>;

  // Context from the conversation (the job they connected on)
  const matchedJobTitle =
    userData?.jobContext?.jobTitle || userData?.appliedRole;
  const matchedCompany = userData?.jobContext?.company || company;

  // Stats grid removed — DURATION is shown inline in the header now.

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Header ───────────────────────────────────────────── */}
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

          {jobTitle || company ? (
            <View style={styles.infoRow}>
              <Briefcase color="#000" size={14} strokeWidth={2} />
              <Text style={styles.infoText}>
                {jobTitle}
                {company ? ` @ ${company}` : ""}
                {duration ? ` · ${duration}` : ""}
              </Text>
            </View>
          ) : null}

          {locationStr ? (
            <View style={styles.infoRow}>
              <MapPin color="#BBB" size={14} strokeWidth={2} />
              <Text style={styles.locationText}>{locationStr}</Text>
            </View>
          ) : null}

          {bio ? (
            <ExpandableText style={styles.bio} numberOfLines={5}>
              {bio}
            </ExpandableText>
          ) : null}
        </View>

        {/* Stats grid removed — the only quantified field we have is
            DURATION (now inlined into the header role line) and the
            former "REFERRED" cell was never populated by the backend.
            See conversation history if/when INDIVIDUALS_REFERRED ships. */}
        {loadingProfile && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#000" size="small" />
            <Text style={styles.loadingText}>Loading profile details…</Text>
          </View>
        )}

        {/* ── Connected Via ────────────────────────────────────────────── */}
        {matchedJobTitle ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONNECTED VIA</Text>
            <View style={styles.connectedCard}>
              <View style={styles.connectedIconCircle}>
                <Briefcase size={16} color="#000" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectedJobTitle}>{matchedJobTitle}</Text>
                {matchedCompany ? (
                  <Text style={styles.connectedCompany}>{matchedCompany}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusPill,
                  openToReferrals === false
                    ? styles.statusPillClosed
                    : styles.statusPillOpen,
                ]}
              >
                {openToReferrals === false ? (
                  <Award size={11} color="#DC2626" strokeWidth={2.5} />
                ) : (
                  <ShieldCheck size={11} color="#000" strokeWidth={2.5} />
                )}
                <Text
                  style={[
                    styles.statusPillText,
                    openToReferrals === false
                      ? styles.statusPillTextClosed
                      : styles.statusPillTextOpen,
                  ]}
                >
                  {openToReferrals === false ? "Closed" : "Open"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Key Insights ─────────────────────────────────────────────── */}
        {!loadingProfile ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                KEY INSIGHTS
              </Text>
            </View>
            {insights.length > 0 ? (
              insights.map(
                (
                  insight: { question: string; answer: string },
                  idx: number,
                ) => (
                  <View key={idx} style={styles.insightCard}>
                    <View style={styles.insightQuestionRow}>
                      <View style={styles.insightIconCircle}>
                        {idx % 2 === 0 ? (
                          <Check size={13} color="#000" strokeWidth={2.5} />
                        ) : (
                          <Award size={13} color="#000" strokeWidth={2.5} />
                        )}
                      </View>
                      <Text style={styles.insightQuestion}>
                        {insight.question}
                      </Text>
                    </View>
                    <Text style={styles.insightAnswer}>{insight.answer}</Text>
                  </View>
                ),
              )
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>
                  No insights shared yet.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Companies I Can Refer To ─────────────────────────────────── */}
        {companiesCanReferTo.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMPANIES I CAN REFER TO</Text>
            <View style={styles.tagCloud}>
              {companiesCanReferTo.map((co: string, idx: number) => (
                <View key={idx} style={styles.companyTag}>
                  <Text style={styles.companyText}>{co}</Text>
                </View>
              ))}
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
      android: { paddingTop: StatusBar.currentHeight },
    }),
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 140,
  },

  // ── Header ────────────────────────────────────────────────────────────────
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
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#F9F9F9",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDEDED",
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: "800",
    color: "#000",
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
    textAlign: "center",
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
    color: "#000",
  },
  locationText: {
    fontSize: 14,
    color: "#BBB",
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 10,
  },
  // ── Stats Grid ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#F9F9F9",
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
  },
  statValueOpen: {
    color: "#000",
    fontSize: 18,
  },
  statValueClosed: {
    color: "#DC2626",
    fontSize: 18,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#BBB",
    marginTop: 4,
    letterSpacing: 1,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E8E8E8",
    marginVertical: 4,
    alignSelf: "stretch" as const,
  },

  // ── Loading ───────────────────────────────────────────────────────────────
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    justifyContent: "center",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#BBB",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },

  // ── Connected Via card ────────────────────────────────────────────────────
  connectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  connectedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    justifyContent: "center",
  },
  connectedJobTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  connectedCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillOpen: {
    backgroundColor: "#F4F4F5",
  },
  statusPillClosed: {
    backgroundColor: "#FEF2F2",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPillTextOpen: {
    color: "#000",
  },
  statusPillTextClosed: {
    color: "#DC2626",
  },

  // ── Key Insights ──────────────────────────────────────────────────────────
  insightCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  insightQuestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  insightIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  insightQuestion: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
    flex: 1,
    lineHeight: 20,
  },
  insightAnswer: {
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
    fontWeight: "500",
    paddingLeft: 36,
  },
  emptyCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginTop: 12,
  },
  emptyCardText: {
    fontSize: 14,
    color: "#BBB",
    fontWeight: "600",
  },

  // ── Companies tag cloud ───────────────────────────────────────────────────
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // Companies-can-refer-to chips — neutral grays so they match the brand
  // and stay consistent with the same tags rendered in ProfileView's
  // sponsor section. (Was light-blue Tailwind-style chips before.)
  companyTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  companyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
});
