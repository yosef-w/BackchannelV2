import {
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Handshake,
    MapPin,
    X,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
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

/**
 * The shared vocabulary of the redesigned "insider-first" job sheets —
 * hero row, stat rail, insider card, journey strip, pinned footer, and
 * loading skeletons. JobDetailModal established the language; the sibling
 * sheets (referral, waitlisted, sponsor-request role) compose the same
 * pieces so the Matches surface speaks one dialect.
 */

// ── Hero ────────────────────────────────────────────────────────────────

/**
 * Pinned close affordance — render it OUTSIDE the sheet's ScrollView (it's
 * absolutely positioned against the sheet) so it never scrolls away.
 */
export function SheetCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.closeBtn}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Close"
    >
      <X size={16} color="#666" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

export function JobSheetHero({
  logoUrl,
  logoName,
  title,
  company,
  location,
  remote,
  insetForClose,
}: {
  logoUrl?: string;
  /** Company name for the logo's initial fallback. */
  logoName?: string;
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  /** Keeps the title clear of a SheetCloseButton rendered by the sheet. */
  insetForClose?: boolean;
}) {
  return (
    <View style={[styles.heroRow, insetForClose && { paddingRight: 36 }]}>
      <CompanyLogo
        logoUrl={logoUrl}
        name={logoName || company || title}
        size={56}
        borderRadius={18}
        initialFontSize={24}
      />
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{title}</Text>
        {!!company && <Text style={styles.heroCompany}>{company}</Text>}
        {(!!location || remote) && (
          <View style={styles.heroLocationRow}>
            {!!location && (
              <>
                <MapPin size={12} color="#999" />
                <Text style={styles.heroLocationText} numberOfLines={1}>
                  {location}
                </Text>
              </>
            )}
            {remote && (
              <View style={styles.remoteBadge}>
                <Text style={styles.remoteText}>Remote</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Stat rail ───────────────────────────────────────────────────────────

export function StatRail({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  if (stats.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statRail}
      contentContainerStyle={styles.statRailContent}
    >
      {stats.map((s) => (
        <View key={s.label} style={styles.statCell}>
          <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
          <Text style={styles.statValue} numberOfLines={2}>
            {s.value}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Insider card / slot ─────────────────────────────────────────────────

/** The human way in — the sheet's single inverted (black) block. */
export function InsiderCard({
  label = "The Insider",
  chip,
  name,
  role,
  image,
}: {
  label?: string;
  /** Small status chip on the header row; muted = gray-on-black. */
  chip?: { label: string; muted?: boolean };
  name: string;
  role?: string;
  image?: string;
}) {
  return (
    <View style={styles.insiderCard}>
      <View style={styles.insiderHeader}>
        <Handshake size={14} color="rgba(255,255,255,0.75)" />
        <Text style={styles.insiderLabel}>{label}</Text>
        {chip && (
          <View
            style={[styles.insiderChip, chip.muted && styles.insiderChipMuted]}
          >
            {!chip.muted && <CheckCircle size={10} color="#000" />}
            <Text
              style={[
                styles.insiderChipText,
                chip.muted && styles.insiderChipTextMuted,
              ]}
            >
              {chip.label}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.insiderRow}>
        {image ? (
          <Image source={{ uri: image }} style={styles.insiderAvatar} />
        ) : (
          <View style={styles.insiderInitialAvatar}>
            <Text style={styles.insiderInitialText}>
              {(name || "S")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.insiderName}>{name}</Text>
          {!!role && (
            <Text style={styles.insiderRole} numberOfLines={1}>
              {role}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * The insider card's placeholder — no human yet (dashed empty slot) or a
 * human just arrived (solid, celebratory). The absence IS the status.
 */
export function InsiderSlot({
  title,
  body,
  filled,
}: {
  title: string;
  body: string;
  filled?: boolean;
}) {
  return (
    <View style={filled ? styles.insiderCard : styles.insiderSlotEmpty}>
      <View style={styles.insiderHeader}>
        <Handshake
          size={14}
          color={filled ? "rgba(255,255,255,0.75)" : "#BBB"}
        />
        <Text
          style={[styles.insiderLabel, !filled && styles.insiderLabelEmpty]}
        >
          The Insider
        </Text>
      </View>
      <Text style={[styles.insiderSlotTitle, !filled && { color: "#000" }]}>
        {title}
      </Text>
      <Text style={[styles.insiderSlotBody, !filled && { color: "#888" }]}>
        {body}
      </Text>
    </View>
  );
}

// ── Journey strip ───────────────────────────────────────────────────────

export interface JourneyStep {
  label: string;
  sub?: string;
  state: "done" | "active" | "todo";
}

/** Liked → Matched → Chat (or any pipeline) — the momentum story. */
export function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <View style={styles.journeyRow}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          {i > 0 && (
            <View
              style={[
                styles.journeyLine,
                step.state === "done" && styles.journeyLineDone,
              ]}
            />
          )}
          <View style={styles.journeyNode}>
            {step.state === "done" ? (
              <View style={styles.journeyDotDone}>
                <Check size={10} color="#FFF" strokeWidth={3.5} />
              </View>
            ) : step.state === "active" ? (
              <View style={styles.journeyDotActive}>
                <PulsingDot />
              </View>
            ) : (
              <View style={styles.journeyDotTodo} />
            )}
            <Text style={styles.journeyLabel}>{step.label}</Text>
            {!!step.sub && <Text style={styles.journeySub}>{step.sub}</Text>}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Long-form text ──────────────────────────────────────────────────────

/** Collapsed description shorter than this never needs a Read more toggle. */
const READ_MORE_THRESHOLD = 280;

/** Body text that collapses to a preview with a Read more toggle. */
export function ReadMoreText({
  text,
  collapsedLines = 5,
}: {
  text: string;
  collapsedLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [text]);
  const collapsible = text.length > READ_MORE_THRESHOLD;
  return (
    <>
      <Text
        style={styles.bodyText}
        numberOfLines={collapsible && !expanded ? collapsedLines : undefined}
      >
        {text}
      </Text>
      {collapsible && (
        <TouchableOpacity
          style={styles.readMoreBtn}
          onPress={() => setExpanded((e) => !e)}
          activeOpacity={0.7}
        >
          <Text style={styles.readMoreText}>
            {expanded ? "Show less" : "Read more"}
          </Text>
          {expanded ? (
            <ChevronUp size={14} color="#000" strokeWidth={2.5} />
          ) : (
            <ChevronDown size={14} color="#000" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

// ── Pinned footer ───────────────────────────────────────────────────────

/** Pinned below the sheet's scroll — the action never scrolls away. */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export function FooterButton({
  label,
  icon,
  onPress,
  loading,
  spinnerOnLoading,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  /** Swap the label for a spinner while loading (vs. label-only states). */
  spinnerOnLoading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.footerBtn, loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading && spinnerOnLoading ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <>
          {icon}
          <Text style={styles.footerBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Honest waiting state — a status bar, not a disabled fake button. */
export function WaitingBar({ text }: { text: string }) {
  return (
    <View style={styles.waitingBar}>
      <PulsingDot />
      <Text style={styles.waitingText}>{text}</Text>
    </View>
  );
}

// ── Loading ─────────────────────────────────────────────────────────────

/** Slow-breathing dot for in-progress states. */
export function PulsingDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 800 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.pulseDot, animatedStyle]} />;
}

/** Pulsing placeholder for the details area while the full posting loads. */
export function EnrichmentSkeleton({
  title = "About the Role",
}: {
  title?: string;
}) {
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

/** Hero-shaped placeholder for sheets that open with nothing at all yet. */
export function SkeletonHero() {
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.heroRow, animatedStyle]}>
      <View style={styles.skelLogo} />
      <View style={styles.heroText}>
        <View style={[styles.skelBar, { width: "70%" }]} />
        <View style={[styles.skelBar, { width: "45%", marginBottom: 0 }]} />
      </View>
    </Animated.View>
  );
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
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
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
  remoteBadge: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  remoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
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
  insiderSlotEmpty: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#DDD",
    borderStyle: "dashed",
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
  insiderLabelEmpty: { color: "#BBB" },
  insiderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  insiderChipMuted: { backgroundColor: "rgba(255,255,255,0.15)" },
  insiderChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000",
  },
  insiderChipTextMuted: { color: "rgba(255,255,255,0.8)" },
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
  insiderSlotTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 4,
  },
  insiderSlotBody: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
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
    textAlign: "center",
  },
  journeySub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#999",
    marginTop: 1,
    textAlign: "center",
  },
  bodyText: { fontSize: 14, color: "#555", lineHeight: 22 },
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
  footerBtn: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
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
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#999",
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
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
  skelLogo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
  },
});
