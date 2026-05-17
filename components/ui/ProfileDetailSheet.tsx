// ProfileDetailSheet — the standardized bottom-sheet for surfacing a
// person's profile (applicant or sponsor) from various entry points in the
// app: matched cards on MatchesView, "Top Applicants" rows on JobsView,
// and the participant header in MessagesView threads.
//
// Why a shared component: we ended up with three near-identical modals
// that drifted in subtle ways (different paddings, different chip styles,
// different ways of rendering insights). Consolidating them keeps the
// experience consistent and means one place to update if we change the
// design language.
//
// The component handles its own public-profile fetch and loading state,
// so consumers just pass `userId` plus a small seed of fields they
// already know (name, image, current role/company) for immediate render
// while the richer fields arrive.

import { getPublicProfile } from "@/lib/api";
import { CheckCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { DismissibleSheet } from "./DismissibleSheet";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface ProfileDetailSheetProps {
  visible: boolean;
  onDismiss: () => void;

  /** User id used to fetch the full public profile. */
  userId: string;

  /**
   * Which side of the marketplace this profile represents — drives which
   * fields we render below the hero (applicant: bio + skills + experience
   * + insights; sponsor: capability pills + companies-can-refer + sponsor
   * insights).
   */
  variant: "applicant" | "sponsor";

  /**
   * Seed data shown immediately while the public-profile fetch resolves.
   * If `userId` is empty (e.g., legacy match without a stored id), the
   * sheet renders only these fields and the fallback note.
   */
  initial: {
    name: string;
    image?: string;
    role?: string;
    company?: string;
  };

  /**
   * Optional small status pill rendered under the name (e.g., "Matched",
   * "Liked your role"). Default green when colors are omitted.
   */
  badge?: {
    label: string;
    color?: string;
    bgColor?: string;
  };

  /**
   * Optional context card under the hero (e.g.,
   * "INTERESTED IN: Senior PM · Stripe"). Skipped when omitted.
   */
  roleContext?: {
    label: string;
    title: string;
    company?: string;
  };

  /** Required primary action button (pinned at the bottom). */
  primaryCta: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
  };

  /**
   * Optional secondary action button rendered ABOVE the primary, with an
   * outline style. Used for e.g., "View Full Profile" sitting above a
   * primary "Provide Referral".
   */
  secondaryCta?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
  };
}

// Helpers — parse JSON-encoded TEXT columns coming back from the Postgres
// adapter (it uppercases keys; values arrive as strings for variant
// columns like SKILLS, INSIGHTS, PROFESSIONAL_EXPERIENCES).
const parseJsonArray = (v: unknown): any[] => {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
};

export function ProfileDetailSheet({
  visible,
  onDismiss,
  userId,
  variant,
  initial,
  badge,
  roleContext,
  primaryCta,
  secondaryCta,
}: ProfileDetailSheetProps) {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Re-fetch on every open so stale data doesn't linger across separate
  // profiles. Reset state on close so the next open shows the spinner
  // immediately instead of flashing the previous person's data.
  useEffect(() => {
    if (!visible) {
      setProfile(null);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getPublicProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) =>
        console.warn("[ProfileDetailSheet] getPublicProfile failed:", err),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  // Derive the rich fields with sane fallbacks. The applicant_profile
  // shape comes from /api/profiles/<userId>/public/ and has the same
  // contract documented in lib/api.ts → getPublicProfile.
  const ap: any = profile?.applicant_profile || {};
  const sp: any = profile?.sponsor_profile || {};
  const bio: string = profile?.BIO || "";
  const location: string = profile?.LOCATION || "";
  const skills: string[] = parseJsonArray(ap.SKILLS);
  const insights = (
    variant === "applicant" ? parseJsonArray(ap.INSIGHTS) : sp.INSIGHTS || []
  ) as Array<{ question: string; answer: string }>;
  const years = ap.YEARS_EXPERIENCE
    ? `${ap.YEARS_EXPERIENCE} yrs experience`
    : "";

  // Sponsor-variant fields
  const sponsorCapabilities = {
    openToReferrals: !!sp.OPEN_TO_REFERRALS,
    financialReward: !!sp.FINANCIAL_REWARD,
    duration: sp.DURATION || "",
  };
  const canReferTo: string[] = Array.isArray(sp.COMPANIES_CAN_REFER_TO)
    ? sp.COMPANIES_CAN_REFER_TO
    : [];

  // Effective values — fetched data wins, initial seed is the fallback.
  const displayedRole =
    variant === "applicant"
      ? ap.CURRENT_ROLE || initial.role || ""
      : sp.JOB_TITLE || initial.role || "";
  const displayedCompany =
    variant === "applicant"
      ? initial.company || ""
      : sp.COMPANY || initial.company || "";

  const isEmpty =
    !bio &&
    !years &&
    skills.length === 0 &&
    insights.length === 0 &&
    !sponsorCapabilities.openToReferrals &&
    !sponsorCapabilities.financialReward &&
    !sponsorCapabilities.duration &&
    canReferTo.length === 0;

  const firstName = initial.name?.split(" ")[0] || "this person";

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onDismiss}
        >
          <BlurView
            intensity={30}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </TouchableOpacity>

        <DismissibleSheet
          onDismiss={onDismiss}
          style={{ ...styles.sheet, ...dynamicSheet }}
        >
          <View style={{ flex: 1 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              style={{ flexShrink: 1, flexGrow: 1 }}
            >
              {/* ── Hero ──────────────────────────────────────────── */}
              <View style={styles.heroRow}>
                {initial.image ? (
                  <Image
                    source={{ uri: initial.image }}
                    style={styles.avatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: "#000",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text style={styles.avatarInitial}>
                      {(initial.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{initial.name}</Text>
                  {!!(displayedRole || displayedCompany) && (
                    <Text style={styles.meta} numberOfLines={2}>
                      {[displayedRole, displayedCompany]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                  {!!location && (
                    <Text style={styles.metaLocation} numberOfLines={1}>
                      {location}
                    </Text>
                  )}
                  {badge && (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: badge.bgColor ?? "#E6FAEE",
                        },
                      ]}
                    >
                      <CheckCircle
                        size={11}
                        color={badge.color ?? "#00CB54"}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: badge.color ?? "#00CB54" },
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Role context ──────────────────────────────────── */}
              {roleContext && (
                <View style={styles.contextBlock}>
                  <Text style={styles.sectionLabel}>{roleContext.label}</Text>
                  <Text style={styles.contextTitle}>{roleContext.title}</Text>
                  {!!roleContext.company && (
                    <Text style={styles.contextCompany}>
                      {roleContext.company}
                    </Text>
                  )}
                </View>
              )}

              {/* ── Loading or content ────────────────────────────── */}
              {loading && isEmpty ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#AAA" />
                  <Text style={styles.loadingText}>Loading profile…</Text>
                </View>
              ) : (
                <>
                  {/* About / bio */}
                  {!!bio && (
                    <View style={styles.block}>
                      <Text style={styles.sectionLabel}>ABOUT</Text>
                      <Text style={styles.body}>{bio}</Text>
                    </View>
                  )}

                  {/* Applicant: experience pill */}
                  {variant === "applicant" && !!years && (
                    <View style={styles.capRow}>
                      <View style={styles.capPill}>
                        <Text style={styles.capPillText}>{years}</Text>
                      </View>
                    </View>
                  )}

                  {/* Sponsor: capability pills */}
                  {variant === "sponsor" &&
                    (sponsorCapabilities.openToReferrals ||
                      sponsorCapabilities.financialReward ||
                      !!sponsorCapabilities.duration) && (
                      <View style={styles.capRow}>
                        {sponsorCapabilities.openToReferrals && (
                          <View style={styles.capPill}>
                            <Text style={styles.capPillText}>
                              Open to Referrals
                            </Text>
                          </View>
                        )}
                        {sponsorCapabilities.financialReward && (
                          <View style={styles.capPill}>
                            <Text style={styles.capPillText}>
                              Financial Reward
                            </Text>
                          </View>
                        )}
                        {!!sponsorCapabilities.duration && (
                          <View style={styles.capPill}>
                            <Text style={styles.capPillText}>
                              {sponsorCapabilities.duration}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                  {/* Applicant skills */}
                  {variant === "applicant" && skills.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.sectionLabel}>SKILLS</Text>
                      <View style={styles.chipRow}>
                        {skills.map((s, i) => (
                          <View key={i} style={styles.darkChip}>
                            <Text style={styles.darkChipText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Sponsor: companies can refer to */}
                  {variant === "sponsor" && canReferTo.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.sectionLabel}>CAN REFER TO</Text>
                      <View style={styles.chipRow}>
                        {canReferTo.map((c, i) => (
                          <View key={i} style={styles.darkChip}>
                            <Text style={styles.darkChipText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Insights (Q&A prompts) */}
                  {insights.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.sectionLabel}>INSIGHTS</Text>
                      {insights.map((p, i) => (
                        <View key={i} style={styles.insightCard}>
                          <Text style={styles.insightQ}>{p.question}</Text>
                          <Text style={styles.insightA}>{p.answer}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Empty fallback */}
                  {!loading && isEmpty && (
                    <View style={styles.fallback}>
                      <Text style={styles.fallbackText}>
                        {firstName} hasn't filled out a profile yet.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* ── Pinned CTA(s) ──────────────────────────────────── */}
            {secondaryCta && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={secondaryCta.onPress}
              >
                {secondaryCta.icon}
                <Text style={styles.secondaryBtnText}>
                  {secondaryCta.label}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { marginTop: secondaryCta ? 8 : 12 },
                (primaryCta.loading || primaryCta.disabled) && {
                  opacity: 0.5,
                },
              ]}
              activeOpacity={0.85}
              disabled={primaryCta.loading || primaryCta.disabled}
              onPress={primaryCta.onPress}
            >
              {primaryCta.loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  {primaryCta.icon}
                  <Text style={styles.primaryBtnText}>{primaryCta.label}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </DismissibleSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dynamicSheet: ViewStyle = {
  minHeight: SCREEN_HEIGHT * 0.65,
  maxHeight: SCREEN_HEIGHT * 0.9,
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarInitial: { fontSize: 24, fontWeight: "800", color: "#FFF" },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    lineHeight: 18,
    marginTop: 4,
  },
  metaLocation: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  contextBlock: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  contextCompany: { fontSize: 13, fontWeight: "500", color: "#666" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: { fontSize: 13, color: "#AAA", fontWeight: "500" },
  block: { marginBottom: 20 },
  body: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    lineHeight: 22,
  },
  capRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  capPill: {
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  capPillText: { fontSize: 11, fontWeight: "700", color: "#333" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  darkChip: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  darkChipText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  insightCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 14,
    marginBottom: 10,
  },
  insightQ: {
    fontSize: 10,
    fontWeight: "800",
    color: "#AAA",
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  insightA: {
    fontSize: 14,
    fontWeight: "500",
    color: "#222",
    lineHeight: 20,
  },
  fallback: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 14,
    marginBottom: 16,
  },
  fallbackText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    backgroundColor: "#FFF",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#000",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
