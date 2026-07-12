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

import { getPublicProfile, type PublicProfileResponse } from "@/lib/api";
import {
  BarFooter,
  canvasSheet,
  PersonHero,
  PillButton,
  ReadMoreText,
  RoleTicket,
  SectionCard,
  SheetCloseButton,
} from "@/components/matches/JobSheetKit";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
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
    /** When provided, the block becomes tappable (chevron affordance) —
     * e.g. opening the full job detail for the role a sponsor wants the
     * applicant for. */
    onPress?: () => void;
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
const parseJsonArray = <T,>(v: unknown): T[] => {
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
  const [profile, setProfile] = useState<PublicProfileResponse | null>(
    null,
  );
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
  const ap: Partial<NonNullable<PublicProfileResponse["applicant_profile"]>> =
    profile?.applicant_profile || {};
  const sp: Partial<NonNullable<PublicProfileResponse["sponsor_profile"]>> =
    profile?.sponsor_profile || {};
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
          style={{ ...styles.sheet, ...dynamicSheet, ...canvasSheet }}
        >
          <View style={{ flex: 1 }}>
            <SheetCloseButton onPress={onDismiss} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              style={{ flexShrink: 1, flexGrow: 1 }}
            >
              {/* ── Hero — photo-forward, centered on a poster card. ── */}
              <PersonHero
                name={initial.name}
                image={initial.image}
                meta={
                  [displayedRole, displayedCompany]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                location={location || undefined}
                pill={badge}
              />

              {/* ── Role context — a tappable role ticket; lands on the
                  job sheet when wired. ── */}
              {roleContext && (
                <RoleTicket
                  label={roleContext.label}
                  title={roleContext.title}
                  company={roleContext.company}
                  logoUrl={roleContext.logoUrl}
                  onPress={roleContext.onPress}
                />
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
                  {/* About / bio — collapses past ~280 chars so long bios
                      don't wall off the rest of the profile. */}
                  {!!bio && (
                    <SectionCard title="About">
                      <ReadMoreText text={bio} />
                    </SectionCard>
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
                    <SectionCard title="Skills">
                      <View style={styles.chipRow}>
                        {skills.map((s, i) => (
                          <View key={i} style={styles.darkChip}>
                            <Text style={styles.darkChipText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  )}

                  {/* Sponsor: companies can refer to */}
                  {variant === "sponsor" && canReferTo.length > 0 && (
                    <SectionCard title="Can Refer To">
                      <View style={styles.chipRow}>
                        {canReferTo.map((c, i) => (
                          <View key={i} style={styles.darkChip}>
                            <Text style={styles.darkChipText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  )}

                  {/* Insights (Q&A prompts) — Hinge-style, each on its own
                      soft inset inside the card. */}
                  {insights.length > 0 && (
                    <SectionCard title="Insights">
                      {insights.map((p, i) => (
                        <View
                          key={i}
                          style={[
                            styles.insightCard,
                            i === insights.length - 1 && { marginBottom: 0 },
                          ]}
                        >
                          <Text style={styles.insightQ}>{p.question}</Text>
                          <Text style={styles.insightA}>{p.answer}</Text>
                        </View>
                      ))}
                    </SectionCard>
                  )}

                  {/* Empty fallback */}
                  {!loading && isEmpty && (
                    <SectionCard>
                      <Text style={styles.fallbackText}>
                        {firstName} hasn&apos;t filled out a profile yet.
                      </Text>
                    </SectionCard>
                  )}
                </>
              )}
            </ScrollView>

            {/* ── Pinned action bar — primary pill, secondary outlined
                below it when present. ── */}
            <BarFooter
              button={{
                label: primaryCta.label,
                icon: primaryCta.icon,
                onPress: primaryCta.onPress,
                loading: primaryCta.loading,
                disabled: primaryCta.disabled,
                spinnerOnLoading: true,
              }}
            >
              {secondaryCta && (
                <View style={{ marginTop: 8 }}>
                  <PillButton
                    label={secondaryCta.label}
                    icon={secondaryCta.icon}
                    onPress={secondaryCta.onPress}
                    variant="outline"
                  />
                </View>
              )}
            </BarFooter>
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
  // Skeleton placeholder base — neutral light gray with a soft border so
  // the shape reads even at the brightest point of the pulse animation.
  skeletonBase: {
    backgroundColor: "#ECECEC",
    borderRadius: 4,
  },
  block: { marginBottom: 20 },
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
  // Light chips — chips are information, not the star; black is reserved
  // for the sheet's single inverted block (the RoleCard) and the CTA.
  darkChip: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  darkChipText: { fontSize: 12, fontWeight: "700", color: "#000" },
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
  fallbackText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    lineHeight: 19,
  },
});
