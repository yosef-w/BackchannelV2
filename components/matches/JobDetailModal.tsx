import {
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Handshake,
    MapPin,
    MessageCircle,
    X,
} from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { extractDisplayDomain } from "../jobs/jobTransforms";
import { JobOpportunity } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface JobDetailModalProps {
  /** The liked job whose detail is being viewed, or null when closed. */
  job: JobOpportunity | null;
  onClose: () => void;
  /** Wired only when the job is MATCHED — messages the sponsor. */
  onNavigateToMessages?: (jobId: string) => void;
  /**
   * Replaces the default Message/Waiting CTA. Used when this modal is
   * layered over another flow whose action should carry through — e.g. an
   * interested sponsor's job context, where the right action is "Connect",
   * not a waiting state.
   */
  cta?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
  };
  /**
   * True while the caller is still fetching the full posting in the
   * background (thread strip / interested sponsor open with basics only).
   * Renders a skeleton where the details will land instead of letting
   * them pop in mid-read.
   */
  enriching?: boolean;
}

/** Collapsed description shorter than this never needs a Read more toggle. */
const READ_MORE_THRESHOLD = 280;

/**
 * Liked-job detail sheet — "insider first" layout. The story reads top to
 * bottom: the role (compact hero + stat rail), the human way in (inverted
 * insider card — the one high-contrast block, matching the CTA), the journey
 * so far (liked → matched → chat), then the long-form details. The primary
 * action is pinned below the scroll so it never has to be scrolled to.
 */
export function JobDetailModal({
  job,
  onClose,
  onNavigateToMessages,
  cta,
  enriching,
}: JobDetailModalProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  useEffect(() => setDescExpanded(false), [job?.id]);

  const matched = job?.status === "MATCHED";
  const sponsorFirstName =
    job && job.sponsorInfo.name && job.sponsorInfo.name !== "Pending"
      ? job.sponsorInfo.name.split(" ")[0]
      : "the sponsor";

  const stats: { label: string; value: string }[] = [];
  if (job) {
    if (job.salary) {
      stats.push({
        label: "Salary",
        value:
          job.salary +
          (job.salaryCurrency && job.salaryCurrency !== "USD"
            ? ` ${job.salaryCurrency}`
            : ""),
      });
    }
    if (job.experienceLevel)
      stats.push({ label: "Experience", value: job.experienceLevel });
    if (job.workArrangement)
      stats.push({ label: "Arrangement", value: job.workArrangement });
    if (job.type) stats.push({ label: "Type", value: job.type });
  }

  const sourceDomain = job?.url ? extractDisplayDomain(job.url) : null;
  const showReadMore = !!job && job.description.length > READ_MORE_THRESHOLD;
  // Skeleton only while the details area would otherwise be empty; the
  // moment any real detail lands, the real sections take over.
  const showSkeleton =
    !!enriching &&
    !!job &&
    !job.description &&
    !job.coreResponsibilities &&
    job.skills.length === 0 &&
    job.benefits.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onClose} style={modalStyles.modalContent}>
        {job && (
          <>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close job details"
            >
              <X size={16} color="#666" strokeWidth={2.5} />
            </TouchableOpacity>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Hero — compact, left-aligned: logo beside title so the
                  vertical budget goes to content, not ceremony. */}
              <View style={styles.heroRow}>
                <CompanyLogo
                  logoUrl={job.companyLogoUrl}
                  name={job.company}
                  size={56}
                  borderRadius={18}
                  initialFontSize={24}
                />
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>{job.title}</Text>
                  <Text style={styles.heroCompany}>{job.company}</Text>
                  {(!!job.location || job.remoteOption) && (
                    <View style={styles.heroLocationRow}>
                      {!!job.location && (
                        <>
                          <MapPin size={12} color="#999" />
                          <Text
                            style={styles.heroLocationText}
                            numberOfLines={1}
                          >
                            {job.location}
                          </Text>
                        </>
                      )}
                      {job.remoteOption && (
                        <View style={modalStyles.jobRemoteBadge}>
                          <Text style={modalStyles.jobRemoteText}>Remote</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Source — trust signal, above the fold: verify the posting
                  before investing in the read. See BACKEND doc §O/§P. */}
              {sourceDomain && (
                <TouchableOpacity
                  style={styles.sourceRow}
                  onPress={() => Linking.openURL(job.url!).catch(() => {})}
                  activeOpacity={0.7}
                  accessibilityLabel={`View original posting on ${sourceDomain}`}
                >
                  <ExternalLink size={12} color="#666" strokeWidth={2} />
                  <Text style={styles.sourceText}>
                    Original posting · {sourceDomain}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Stat rail — equal-weight fact cells; scrolls sideways if
                  the role has more facts than the screen has width. */}
              {stats.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.statRail}
                  contentContainerStyle={styles.statRailContent}
                >
                  {stats.map((s) => (
                    <View key={s.label} style={styles.statCell}>
                      <Text style={styles.statLabel}>
                        {s.label.toUpperCase()}
                      </Text>
                      <Text style={styles.statValue} numberOfLines={2}>
                        {s.value}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* The Insider — the differentiator, so it sits right under
                  the role facts and is the sheet's one inverted block. */}
              <View style={styles.insiderCard}>
                <View style={styles.insiderHeader}>
                  <Handshake size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.insiderLabel}>The Insider</Text>
                  {matched && !cta && (
                    <View style={styles.insiderMatchedChip}>
                      <CheckCircle size={10} color="#000" />
                      <Text style={styles.insiderMatchedText}>Matched</Text>
                    </View>
                  )}
                </View>
                <View style={styles.insiderRow}>
                  {job.sponsorInfo.image ? (
                    <Image
                      source={{ uri: job.sponsorInfo.image }}
                      style={styles.insiderAvatar}
                    />
                  ) : (
                    <View style={styles.insiderInitialAvatar}>
                      <Text style={styles.insiderInitialText}>
                        {(job.sponsorInfo.name || "S")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insiderName}>
                      {job.sponsorInfo.name}
                    </Text>
                    {!!job.sponsorInfo.role &&
                      job.sponsorInfo.role !== "Sponsor" && (
                        <Text style={styles.insiderRole} numberOfLines={1}>
                          {job.sponsorInfo.role}
                        </Text>
                      )}
                  </View>
                </View>
              </View>

              {/* Journey — liked → matched → chat, the momentum story.
                  Only for liked jobs (layered contexts have no likedAt and
                  carry their own action through the cta prop). */}
              {!!job.likedAt && !cta && (
                <View style={styles.journeyRow}>
                  <JourneyNode
                    state="done"
                    label="Liked"
                    sub={new Date(job.likedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  />
                  <View
                    style={[
                      styles.journeyLine,
                      matched && styles.journeyLineDone,
                    ]}
                  />
                  <JourneyNode
                    state={matched ? "done" : "active"}
                    label="Matched"
                    sub={matched ? undefined : "Waiting"}
                  />
                  <View
                    style={[
                      styles.journeyLine,
                      matched && styles.journeyLineDone,
                    ]}
                  />
                  <JourneyNode
                    state={matched ? "done" : "todo"}
                    label="Chat"
                    sub={matched ? "Unlocked" : "Locked"}
                  />
                </View>
              )}

              {/* Enrichment skeleton — holds the details area's place while
                  the full posting loads, instead of content popping in
                  mid-read. */}
              {showSkeleton && <EnrichmentSkeleton />}

              {/* About the Role — collapsed to a preview; the full text is
                  one tap away instead of a wall on open. */}
              {!!job.description && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>
                    About the Role
                  </Text>
                  <Text
                    style={modalStyles.jobSectionText}
                    numberOfLines={
                      showReadMore && !descExpanded ? 5 : undefined
                    }
                  >
                    {job.description}
                  </Text>
                  {showReadMore && (
                    <TouchableOpacity
                      style={styles.readMoreBtn}
                      onPress={() => setDescExpanded((e) => !e)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.readMoreText}>
                        {descExpanded ? "Show less" : "Read more"}
                      </Text>
                      {descExpanded ? (
                        <ChevronUp size={14} color="#000" strokeWidth={2.5} />
                      ) : (
                        <ChevronDown
                          size={14}
                          color="#000"
                          strokeWidth={2.5}
                        />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* What You'll Do */}
              {!!job.coreResponsibilities && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>
                    What You&apos;ll Do
                  </Text>
                  <Text style={modalStyles.jobSectionText}>
                    {job.coreResponsibilities}
                  </Text>
                </View>
              )}

              {/* Skills */}
              {job.skills.length > 0 && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>Skills</Text>
                  <View style={modalStyles.skillsRow}>
                    {job.skills.map((skill, idx) => (
                      <View key={idx} style={modalStyles.skillBadge}>
                        <Text style={modalStyles.skillBadgeText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Highlights / Benefits */}
              {job.benefits.length > 0 && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>Highlights</Text>
                  {job.benefits.map((benefit, idx) => (
                    <View key={idx} style={modalStyles.benefitRow}>
                      <Check size={14} color="#000" />
                      <Text style={modalStyles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Pinned footer — the action (or the honest waiting state)
                is always visible; nothing to scroll for. */}
            <View style={styles.footer}>
              {cta ? (
                <TouchableOpacity
                  style={[
                    modalStyles.applyBtnLarge,
                    cta.loading && { opacity: 0.6 },
                  ]}
                  onPress={cta.onPress}
                  disabled={cta.loading}
                  activeOpacity={0.8}
                >
                  {cta.icon}
                  <Text style={modalStyles.applyBtnLargeText}>
                    {cta.label}
                  </Text>
                </TouchableOpacity>
              ) : matched && onNavigateToMessages && !!job.jobId ? (
                <TouchableOpacity
                  style={modalStyles.applyBtnLarge}
                  onPress={() => {
                    const jid = job.jobId as string;
                    onClose();
                    onNavigateToMessages(jid);
                  }}
                >
                  <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                  <Text style={modalStyles.applyBtnLargeText}>
                    Message {sponsorFirstName}
                  </Text>
                </TouchableOpacity>
              ) : (
                // Not a disabled button pretending to be an action — a
                // status bar that says what's actually happening.
                <View style={styles.waitingBar}>
                  <PulsingDot />
                  <Text style={styles.waitingText}>
                    Waiting on {sponsorFirstName} to accept
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

/** One stop on the liked → matched → chat strip. */
function JourneyNode({
  state,
  label,
  sub,
}: {
  state: "done" | "active" | "todo";
  label: string;
  sub?: string;
}) {
  return (
    <View style={styles.journeyNode}>
      {state === "done" ? (
        <View style={styles.journeyDotDone}>
          <Check size={10} color="#FFF" strokeWidth={3.5} />
        </View>
      ) : state === "active" ? (
        <View style={styles.journeyDotActive}>
          <PulsingDot />
        </View>
      ) : (
        <View style={styles.journeyDotTodo} />
      )}
      <Text style={styles.journeyLabel}>{label}</Text>
      {!!sub && <Text style={styles.journeySub}>{sub}</Text>}
    </View>
  );
}

/** Pulsing placeholder for the details area while enrichment loads. */
function EnrichmentSkeleton() {
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={modalStyles.jobSection}>
      <Text style={modalStyles.jobSectionTitle}>About the Role</Text>
      <Animated.View style={animatedStyle}>
        <View style={[styles.skelBar, { width: "100%" }]} />
        <View style={[styles.skelBar, { width: "94%" }]} />
        <View style={[styles.skelBar, { width: "72%" }]} />
        <View style={styles.skelChipRow}>
          <View style={[styles.skelChip, { width: 72 }]} />
          <View style={[styles.skelChip, { width: 96 }]} />
          <View style={[styles.skelChip, { width: 60 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

/** Slow-breathing dot for in-progress states. */
function PulsingDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 800 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.pulseDot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  closeBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned footer; scrolls the overflow.
  scroll: { flexShrink: 1 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
    // Keep the title clear of the absolute-positioned close button.
    paddingRight: 36,
  },
  heroText: { flex: 1 },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroCompany: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  heroLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  heroLocationText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    flexShrink: 1,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 4,
  },
  sourceText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  statRail: { marginBottom: 16, flexGrow: 0 },
  statRailContent: { gap: 8 },
  statCell: {
    minWidth: 104,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
    maxWidth: 150,
  },
  insiderCard: {
    backgroundColor: "#000",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  insiderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  insiderLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  insiderMatchedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  insiderMatchedText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000",
  },
  insiderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insiderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  insiderInitialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  insiderInitialText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
  },
  insiderName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
  },
  insiderRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  journeyNode: {
    width: 68,
    alignItems: "center",
    zIndex: 1,
  },
  journeyLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#EEE",
    marginTop: 8,
    marginHorizontal: -14,
  },
  journeyLineDone: { backgroundColor: "#000" },
  journeyDotDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  journeyDotActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  journeyDotTodo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EEE",
    marginBottom: 6,
  },
  journeyLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
  },
  journeySub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#999",
    marginTop: 1,
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 4,
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
  },
  footer: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 18,
    paddingVertical: 16,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#888",
  },
  skelBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
    marginBottom: 10,
  },
  skelChipRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  skelChip: {
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#999",
  },
});
