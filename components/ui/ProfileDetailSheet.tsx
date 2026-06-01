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
import { Color, Radius, Type } from "@/constants/theme";
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CompanyLogo } from "./CompanyLogo";
import { DismissibleSheet } from "./DismissibleSheet";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// SkeletonBlock — a gray rounded placeholder with a gentle opacity pulse.
// Mounted once per render and reused throughout the loading state. The
// animation runs on the UI thread via reanimated, so we don't burn JS
// frames driving it. Width/height/radius come from style so consumers
// can size each shape to its eventual content.
function SkeletonBlock({ style }: { style: ViewStyle | ViewStyle[] }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 900 }),
      -1,
      true,
    );
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.skeletonBase, style, animatedStyle]} />
  );
}

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
   * When `logoUrl` is supplied (PR #62 logo pipeline), the company logo
   * is rendered alongside the text; otherwise the card stays text-only.
   */
  roleContext?: {
    label: string;
    title: string;
    company?: string;
    logoUrl?: string | null;
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
                          backgroundColor: badge.bgColor ?? "#F4F4F5",
                        },
                      ]}
                    >
                      <CheckCircle
                        size={11}
                        color={badge.color ?? "#000"}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: badge.color ?? "#000" },
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
                  <View style={styles.contextBlockRow}>
                    <CompanyLogo
                      logoUrl={roleContext.logoUrl}
                      name={roleContext.company || roleContext.title}
                      size={40}
                      borderRadius={10}
                      initialFontSize={17}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.sectionLabel}>{roleContext.label}</Text>
                      <Text
                        style={styles.contextTitle}
                        numberOfLines={1}
                      >
                        {roleContext.title}
                      </Text>
                      {!!roleContext.company && (
                        <Text
                          style={styles.contextCompany}
                          numberOfLines={1}
                        >
                          {roleContext.company}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* ── Loading or content ────────────────────────────── */}
              {loading && isEmpty ? (
                // Skeleton — gray placeholder shapes that approximate the
                // real content layout (bio paragraph, capability pill,
                // skill chips, two insight cards). Reads as "content is on
                // its way" instead of a spinner that gives no preview of
                // what's about to render.
                <>
                  <View style={styles.block}>
                    <SkeletonBlock
                      style={{ width: 60, height: 9, marginBottom: 12 }}
                    />
                    <SkeletonBlock
                      style={{
                        width: "100%",
                        height: 14,
                        marginBottom: 8,
                      }}
                    />
                    <SkeletonBlock
                      style={{
                        width: "92%",
                        height: 14,
                        marginBottom: 8,
                      }}
                    />
                    <SkeletonBlock
                      style={{ width: "55%", height: 14 }}
                    />
                  </View>
                  <View style={styles.capRow}>
                    <SkeletonBlock
                      style={{
                        width: 120,
                        height: 28,
                        borderRadius: 20,
                      }}
                    />
                  </View>
                  <View style={styles.block}>
                    <SkeletonBlock
                      style={{ width: 50, height: 9, marginBottom: 12 }}
                    />
                    <View style={styles.chipRow}>
                      <SkeletonBlock
                        style={{ width: 62, height: 24, borderRadius: 8 }}
                      />
                      <SkeletonBlock
                        style={{ width: 88, height: 24, borderRadius: 8 }}
                      />
                      <SkeletonBlock
                        style={{ width: 54, height: 24, borderRadius: 8 }}
                      />
                      <SkeletonBlock
                        style={{ width: 72, height: 24, borderRadius: 8 }}
                      />
                    </View>
                  </View>
                  <View style={styles.block}>
                    <SkeletonBlock
                      style={{ width: 70, height: 9, marginBottom: 12 }}
                    />
                    <View style={styles.insightCard}>
                      <SkeletonBlock
                        style={{ width: 90, height: 9, marginBottom: 10 }}
                      />
                      <SkeletonBlock
                        style={{
                          width: "100%",
                          height: 12,
                          marginBottom: 6,
                        }}
                      />
                      <SkeletonBlock
                        style={{ width: "70%", height: 12 }}
                      />
                    </View>
                    <View style={styles.insightCard}>
                      <SkeletonBlock
                        style={{ width: 110, height: 9, marginBottom: 10 }}
                      />
                      <SkeletonBlock
                        style={{
                          width: "100%",
                          height: 12,
                          marginBottom: 6,
                        }}
                      />
                      <SkeletonBlock
                        style={{ width: "60%", height: 12 }}
                      />
                    </View>
                  </View>
                </>
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
    backgroundColor: Color.paper,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: 28,
    paddingBottom: 40,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarInitial: {
    fontFamily: Type.serifItalic,
    fontSize: 28,
    color: Color.paper,
  },
  name: {
    fontFamily: Type.sans400,
    fontSize: 22,
    color: Color.ink,
    letterSpacing: -0.5,
  },
  meta: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  metaLocation: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.muted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontFamily: Type.sans600,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  contextBlock: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    padding: 16,
    marginBottom: 16,
  },
  contextBlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionLabel: {
    fontFamily: Type.sans500,
    fontSize: 10,
    color: Color.muted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  contextTitle: {
    fontFamily: Type.sans600,
    fontSize: 15,
    color: Color.ink,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  contextCompany: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
  },
  // Skeleton base — neutral fill that reads at the brightest pulse.
  skeletonBase: {
    backgroundColor: Color.surface,
    borderRadius: 4,
  },
  block: { marginBottom: 20 },
  body: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.body,
    lineHeight: 22,
  },
  capRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  capPill: {
    backgroundColor: Color.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Color.border,
  },
  capPillText: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.body,
    letterSpacing: -0.1,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  darkChip: {
    backgroundColor: Color.ink,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  darkChipText: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.paper,
    letterSpacing: -0.1,
  },
  insightCard: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    padding: 16,
    marginBottom: 10,
  },
  insightQ: {
    fontFamily: Type.sans500,
    fontSize: 10,
    color: Color.muted,
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  insightA: {
    fontFamily: Type.sans300,
    fontSize: 14,
    color: Color.ink,
    lineHeight: 22,
  },
  fallback: {
    backgroundColor: Color.paper,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    padding: 14,
    marginBottom: 16,
  },
  fallbackText: {
    fontFamily: Type.sans300,
    fontSize: 13,
    color: Color.body,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: Color.ink,
    paddingVertical: 16,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryBtnText: {
    fontFamily: Type.sans500,
    color: Color.paper,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  secondaryBtn: {
    backgroundColor: Color.paper,
    paddingVertical: 14,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Color.border,
    marginTop: 12,
  },
  secondaryBtnText: {
    fontFamily: Type.sans500,
    color: Color.ink,
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
