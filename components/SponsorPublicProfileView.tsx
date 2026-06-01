import { getPublicProfile } from "@/lib/api";
import { Color, Radius, Type } from "@/constants/theme";
import {
    Award,
    Briefcase,
    Check,
    ChevronLeft,
    MapPin,
    ShieldCheck,
    Sparkles,
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
  const insights: Array<{ question: string; answer: string }> =
    sp.INSIGHTS || [];

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

          {bio ? <Text style={styles.bio}>{bio}</Text> : null}
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
              <Sparkles size={15} color="#000" strokeWidth={2} />
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
    backgroundColor: Color.offWhite,
    ...Platform.select({
      android: { paddingTop: StatusBar.currentHeight },
    }),
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 140,
  },

  // ── Header ──
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
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Color.surface,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.ink,
  },
  avatarInitials: {
    fontFamily: Type.serifItalic,
    fontSize: 40,
    color: Color.paper,
  },
  name: {
    fontFamily: Type.sans400,
    fontSize: 30,
    color: Color.ink,
    letterSpacing: -0.7,
    textAlign: "center",
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

  // ── Stats Grid ──
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
    paddingHorizontal: 8,
  },
  statValue: {
    fontFamily: Type.sans600,
    fontSize: 24,
    color: Color.ink,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  statValueOpen: {
    color: Color.ink,
    fontSize: 16,
  },
  statValueClosed: {
    color: Color.status.blockText,
    fontSize: 16,
  },
  statLabel: {
    fontFamily: Type.sans500,
    fontSize: 10,
    color: Color.muted,
    marginTop: 4,
    letterSpacing: 1.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    backgroundColor: Color.border,
    marginVertical: 4,
    alignSelf: "stretch" as const,
  },

  // ── Loading ──
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    justifyContent: "center",
    marginBottom: 8,
  },
  loadingText: {
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.muted,
  },

  // ── Sections ──
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  // ── Connected Via card ──
  connectedCard: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOpen: {
    backgroundColor: Color.surface,
    borderColor: Color.border,
  },
  statusPillClosed: {
    backgroundColor: Color.status.blockBg,
    borderColor: Color.status.blockBorder,
  },
  statusPillText: {
    fontFamily: Type.sans600,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statusPillTextOpen: {
    color: Color.ink,
  },
  statusPillTextClosed: {
    color: Color.status.blockText,
  },

  // ── Key Insights ──
  insightCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Color.border,
  },
  insightQuestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  insightIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  insightQuestion: {
    fontFamily: Type.sans600,
    fontSize: 12,
    color: Color.muted,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flex: 1,
    lineHeight: 16,
    paddingTop: 4,
  },
  insightAnswer: {
    fontFamily: Type.sans300,
    fontSize: 15,
    color: Color.ink,
    lineHeight: 24,
    paddingLeft: 34,
  },
  emptyCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Color.border,
    marginTop: 12,
  },
  emptyCardText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
  },

  // ── Companies tag cloud ──
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  companyTag: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
  },
  companyText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.body,
    letterSpacing: -0.1,
  },
});
