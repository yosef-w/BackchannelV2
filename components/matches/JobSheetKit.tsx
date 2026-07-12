import {
    Briefcase,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ExternalLink,
    Handshake,
    MapPin,
    X,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { CompanyLogo } from "../ui/CompanyLogo";

/**
 * The shared vocabulary of the Matches-surface sheets — the "Gallery"
 * system: a soft off-white canvas with floating white cards, where depth
 * (elevation + tint) carries hierarchy instead of black fills. Black is
 * reserved for display typography and the CTA pill. Reference points:
 * App Store stat strips and buy bars, Airbnb's host card, Shop's vertical
 * order timeline, Hinge's prompt cards.
 */

// ── Gallery tokens ──────────────────────────────────────────────────────

/** Sheet background — the soft canvas white cards float on. */
export const CANVAS = "#F6F7F9";
const HAIRLINE = "rgba(15,23,42,0.06)";
const SUB = "#6B7280";
const FAINT = "#9CA3AF";
const TINT = "#F0F2F7";

/** Merge into the sheet's content style to put it on the Gallery canvas. */
export const canvasSheet: ViewStyle = {
  backgroundColor: CANVAS,
  padding: 20,
  paddingBottom: 36,
};

/** Elevation shared by every floating card. */
const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  android: { elevation: 3 },
})!;

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
  children,
}: {
  label?: string;
  /** Small status chip on the header row; muted = gray-on-black. */
  chip?: { label: string; muted?: boolean };
  name: string;
  role?: string;
  image?: string;
  /** Extra content below the person row (e.g. their referral note). */
  children?: React.ReactNode;
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
      {children}
    </View>
  );
}

/** A quote from the insider, rendered inside their card. */
export function InsiderNote({ text }: { text: string }) {
  return <Text style={styles.insiderNote}>&ldquo;{text}&rdquo;</Text>;
}

/**
 * The InsiderCard's mirror image — on a PERSON sheet, the one inverted
 * block is the role connecting you. Tap it to land on the job sheet
 * (whose inverted block is the person — two sides of the same coin).
 */
export function RoleCard({
  label,
  title,
  company,
  logoUrl,
  onPress,
}: {
  /** e.g. "Wants you for" / "Interested in". */
  label: string;
  title: string;
  company?: string;
  logoUrl?: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.insiderCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `View job: ${title}` : undefined}
    >
      <View style={styles.insiderHeader}>
        <Briefcase size={14} color="rgba(255,255,255,0.75)" />
        <Text style={styles.insiderLabel}>{label}</Text>
      </View>
      <View style={styles.insiderRow}>
        <View style={styles.roleCardLogoWrap}>
          <CompanyLogo
            logoUrl={logoUrl || undefined}
            name={company || title}
            size={44}
            borderRadius={12}
            initialFontSize={18}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.insiderName} numberOfLines={1}>
            {title}
          </Text>
          {!!company && (
            <Text style={styles.insiderRole} numberOfLines={1}>
              {company}
            </Text>
          )}
        </View>
        {onPress && (
          <ChevronRight
            color="rgba(255,255,255,0.5)"
            size={18}
            strokeWidth={2.2}
          />
        )}
      </View>
    </TouchableOpacity>
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
  disabled,
  spinnerOnLoading,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Swap the label for a spinner while loading (vs. label-only states). */
  spinnerOnLoading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.footerBtn, (loading || disabled) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading || disabled}
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

// ═══ Gallery components ═════════════════════════════════════════════════

/** A floating white card — the Gallery's basic unit of content. */
export function Card({
  style,
  children,
}: {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}) {
  return <View style={[g.card, style]}>{children}</View>;
}

/** A titled floating card for a content section. */
export function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={g.card}>
      {!!title && <Text style={g.sectionTitle}>{title.toUpperCase()}</Text>}
      {children}
    </View>
  );
}

/**
 * The job's stage — a poster card: framed logo, display title, location,
 * and the original-posting link as a small trust pill.
 */
export function PosterHero({
  logoUrl,
  logoName,
  title,
  company,
  location,
  remote,
  sourceUrl,
}: {
  logoUrl?: string;
  logoName?: string;
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  sourceUrl?: string;
}) {
  const domain = sourceUrl ? extractDomainForPill(sourceUrl) : null;
  return (
    <View style={[g.card, g.posterCard]}>
      <View style={g.posterLogoTile}>
        <CompanyLogo
          logoUrl={logoUrl}
          name={logoName || company || title}
          size={64}
          borderRadius={18}
          initialFontSize={26}
        />
      </View>
      <Text style={g.posterTitle}>{title}</Text>
      {!!company && <Text style={g.posterCompany}>{company}</Text>}
      {(!!location || remote) && (
        <View style={g.posterMetaRow}>
          {!!location && (
            <>
              <MapPin size={12} color={FAINT} />
              <Text style={g.posterMetaText} numberOfLines={1}>
                {location}
              </Text>
            </>
          )}
          {remote && (
            <View style={g.tintPill}>
              <Text style={g.tintPillText}>Remote</Text>
            </View>
          )}
        </View>
      )}
      {!!domain && (
        <TouchableOpacity
          style={g.sourcePill}
          onPress={() => Linking.openURL(sourceUrl!).catch(() => {})}
          activeOpacity={0.7}
          accessibilityLabel={`View original posting on ${domain}`}
        >
          <ExternalLink size={11} color="#3B4353" strokeWidth={2.2} />
          <Text style={g.sourcePillText}>{domain}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Local, dependency-free domain trim for the source pill (jobTransforms'
// extractDisplayDomain lives with the jobs feature; the kit stays leaf).
function extractDomainForPill(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * A person's stage — photo-forward centered hero for profile sheets.
 * The status pill keeps whatever accent the caller passes (e.g. the red
 * "Wants to connect").
 */
export function PersonHero({
  name,
  image,
  meta,
  location,
  pill,
}: {
  name: string;
  image?: string;
  meta?: string;
  location?: string;
  pill?: { label: string; color?: string; bgColor?: string };
}) {
  return (
    <View style={[g.card, g.posterCard]}>
      {image ? (
        <Image source={{ uri: image }} style={g.personAvatar} />
      ) : (
        <View style={[g.personAvatar, g.personAvatarFallback]}>
          <Text style={g.personAvatarInitial}>
            {(name || "?")[0].toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={g.posterTitle}>{name}</Text>
      {!!meta && <Text style={g.posterCompany}>{meta}</Text>}
      {!!location && (
        <View style={g.posterMetaRow}>
          <MapPin size={12} color={FAINT} />
          <Text style={g.posterMetaText} numberOfLines={1}>
            {location}
          </Text>
        </View>
      )}
      {pill && (
        <View
          style={[g.tintPill, { marginTop: 10, backgroundColor: pill.bgColor ?? TINT }]}
        >
          <CheckCircle size={11} color={pill.color ?? "#3B4353"} />
          <Text style={[g.tintPillText, { color: pill.color ?? "#3B4353" }]}>
            {pill.label}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * App-Store-style fact strip — one card, equal cells, hairline dividers,
 * big values over tiny labels.
 */
export function StatStrip({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  if (stats.length === 0) return null;
  return (
    <View style={[g.card, g.statStrip]}>
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <View style={g.statDivider} />}
          <View style={g.statCell}>
            <Text style={g.statValue} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={g.statLabel}>{s.label.toUpperCase()}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Airbnb-host-style person card — the human gets physical size (oversized
 * avatar, display name) on a white card, not a black slab. Optional quote
 * renders as a soft inset block (their referral note, their ask).
 */
export function HostCard({
  label,
  name,
  role,
  image,
  pill,
  note,
  children,
}: {
  label: string;
  name: string;
  role?: string;
  image?: string;
  pill?: { label: string; tone?: "neutral" | "red" };
  note?: string;
  children?: React.ReactNode;
}) {
  const red = pill?.tone === "red";
  return (
    <View style={[g.card, g.posterCard]}>
      <Text style={g.sectionTitle}>{label.toUpperCase()}</Text>
      {image ? (
        <Image source={{ uri: image }} style={g.hostAvatar} />
      ) : (
        <View style={[g.hostAvatar, g.personAvatarFallback]}>
          <Text style={g.hostAvatarInitial}>
            {(name || "?")[0].toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={g.hostName}>{name}</Text>
      {!!role && (
        <Text style={g.hostRole} numberOfLines={2}>
          {role}
        </Text>
      )}
      {pill && (
        <View
          style={[
            g.tintPill,
            { marginTop: 10 },
            red && { backgroundColor: "#FEF2F2" },
          ]}
        >
          <CheckCircle size={11} color={red ? "#DC2626" : "#3B4353"} />
          <Text style={[g.tintPillText, red && { color: "#DC2626" }]}>
            {pill.label}
          </Text>
        </View>
      )}
      {!!note && (
        <View style={g.hostNoteBox}>
          <Text style={g.hostNoteText}>&ldquo;{note}&rdquo;</Text>
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * A tappable role object — logo tile, label, title, chevron. The person
 * sheet's doorway into the job sheet.
 */
export function RoleTicket({
  label,
  title,
  company,
  logoUrl,
  onPress,
}: {
  label: string;
  title: string;
  company?: string;
  logoUrl?: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[g.card, g.ticketRow]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `View job: ${title}` : undefined}
    >
      <View style={g.ticketLogoTile}>
        <CompanyLogo
          logoUrl={logoUrl || undefined}
          name={company || title}
          size={40}
          borderRadius={12}
          initialFontSize={17}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={g.sectionTitle}>{label.toUpperCase()}</Text>
        <Text style={g.ticketTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!company && (
          <Text style={g.ticketCompany} numberOfLines={1}>
            {company}
          </Text>
        )}
      </View>
      {onPress && <ChevronRight color="#B6BCC8" size={18} strokeWidth={2.2} />}
    </TouchableOpacity>
  );
}

/**
 * Shop-style vertical timeline in a card — each stage a row with a dot
 * rail; the active stage gets a tinted highlight.
 */
export function Timeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <View style={[g.card, { paddingVertical: 12 }]}>
      {steps.map((s, i) => (
        <View key={s.label} style={g.tlRow}>
          <View style={g.tlRail}>
            {s.state === "done" ? (
              <View style={g.tlDotDone}>
                <Check size={9} color="#FFF" strokeWidth={3.5} />
              </View>
            ) : s.state === "active" ? (
              <View style={g.tlDotActive}>
                <PulsingDot />
              </View>
            ) : (
              <View style={g.tlDotTodo} />
            )}
            {i < steps.length - 1 && (
              <View
                style={[
                  g.tlLine,
                  steps[i + 1].state === "done" && g.tlLineDone,
                ]}
              />
            )}
          </View>
          <View style={[g.tlContent, s.state === "active" && g.tlContentActive]}>
            <Text
              style={[g.tlLabel, s.state === "todo" && { color: FAINT }]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
            {!!s.sub && <Text style={g.tlSub}>{s.sub}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The insider seat, still empty — a soft dashed card, quiet not dark.
 * `filled` flips it solid white when someone arrives.
 */
export function EmptySeatCard({
  title,
  body,
  filled,
}: {
  title: string;
  body: string;
  filled?: boolean;
}) {
  return (
    <View style={[g.card, g.posterCard, !filled && g.emptySeat]}>
      <View style={[g.hostAvatar, g.personAvatarFallback]}>
        {filled ? (
          <CheckCircle size={30} color="#000" strokeWidth={2.2} />
        ) : (
          <Handshake size={30} color={FAINT} strokeWidth={1.8} />
        )}
      </View>
      <Text style={g.hostName}>{title}</Text>
      <Text style={[g.hostRole, { textAlign: "center" }]}>{body}</Text>
    </View>
  );
}

/** Black CTA pill (or outline variant). */
export function PillButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  spinnerOnLoading,
  variant = "primary",
  stretch,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  spinnerOnLoading?: boolean;
  variant?: "primary" | "outline";
  stretch?: boolean;
}) {
  const outline = variant === "outline";
  return (
    <TouchableOpacity
      style={[
        g.pillBtn,
        outline && g.pillBtnOutline,
        stretch && { flex: 1 },
        (loading || disabled) && { opacity: 0.55 },
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
    >
      {loading && spinnerOnLoading ? (
        <ActivityIndicator size="small" color={outline ? "#000" : "#FFF"} />
      ) : (
        <>
          {icon}
          <Text style={[g.pillBtnText, outline && { color: "#000" }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * App-Store-style action bar pinned under the scroll — context on the
 * left (with waiting/done affordances), a compact pill on the right.
 * With no context the pill stretches full width. `children` renders
 * below the row for quiet secondary actions.
 */
export function BarFooter({
  context,
  button,
  children,
}: {
  context?: { title: string; sub?: string; waiting?: boolean; done?: boolean };
  button?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    spinnerOnLoading?: boolean;
  };
  children?: React.ReactNode;
}) {
  return (
    <View style={g.footer}>
      <View style={g.footerRow}>
        {context && (
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={g.footerTitleRow}>
              {context.waiting && <PulsingDot />}
              {context.done && (
                <CheckCircle size={13} color="#000" strokeWidth={2.5} />
              )}
              <Text style={g.footerTitle} numberOfLines={1}>
                {context.title}
              </Text>
            </View>
            {!!context.sub && (
              <Text style={g.footerSub} numberOfLines={1}>
                {context.sub}
              </Text>
            )}
          </View>
        )}
        {button && (
          <PillButton
            label={button.label}
            icon={button.icon}
            onPress={button.onPress}
            loading={button.loading}
            disabled={button.disabled}
            spinnerOnLoading={button.spinnerOnLoading}
            stretch={!context}
          />
        )}
      </View>
      {children}
    </View>
  );
}

/** Quiet centered text action (e.g. "Not right now", destructive confirms). */
export function QuietAction({
  label,
  onPress,
  destructive,
  loading,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={g.quietAction}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={destructive ? "#DC2626" : "#999"}
        />
      ) : (
        <Text
          style={[g.quietActionText, destructive && { color: "#DC2626" }]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** Pulsing placeholder card for content that's still loading. */
export function SkeletonCard({ title }: { title?: string }) {
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={g.card}>
      {!!title && <Text style={g.sectionTitle}>{title.toUpperCase()}</Text>}
      <Animated.View style={animatedStyle}>
        <View style={[g.skelBar, { width: "100%" }]} />
        <View style={[g.skelBar, { width: "94%" }]} />
        <View style={[g.skelBar, { width: "68%", marginBottom: 0 }]} />
      </Animated.View>
    </View>
  );
}

const g = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: FAINT,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  posterCard: { alignItems: "center", paddingVertical: 24 },
  posterLogoTile: {
    padding: 12,
    borderRadius: 26,
    backgroundColor: CANVAS,
    marginBottom: 14,
  },
  posterTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 4,
  },
  posterCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    textAlign: "center",
  },
  posterMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  posterMetaText: { fontSize: 13, color: FAINT, fontWeight: "500" },
  tintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: TINT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginLeft: 4,
  },
  tintPillText: { fontSize: 11, fontWeight: "800", color: "#3B4353" },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: TINT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 14,
  },
  sourcePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B4353",
  },
  personAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 12,
  },
  personAvatarFallback: {
    backgroundColor: TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarInitial: { fontSize: 32, fontWeight: "800", color: "#3B4353" },
  hostAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 10,
  },
  hostAvatarInitial: { fontSize: 28, fontWeight: "800", color: "#3B4353" },
  hostName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  hostRole: {
    fontSize: 13,
    fontWeight: "500",
    color: SUB,
    marginTop: 3,
    textAlign: "center",
  },
  hostNoteBox: {
    backgroundColor: CANVAS,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    alignSelf: "stretch",
  },
  hostNoteText: {
    fontSize: 14,
    fontStyle: "italic",
    fontWeight: "500",
    color: "#374151",
    lineHeight: 21,
    textAlign: "center",
  },
  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCell: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: HAIRLINE },
  statValue: { fontSize: 15, fontWeight: "800", color: "#000" },
  statLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: FAINT,
    letterSpacing: 0.8,
    marginTop: 3,
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  ticketLogoTile: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: CANVAS,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginTop: -4,
  },
  ticketCompany: { fontSize: 13, fontWeight: "500", color: SUB, marginTop: 1 },
  tlRow: { flexDirection: "row", minHeight: 48 },
  tlRail: { width: 26, alignItems: "center" },
  tlDotDone: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  tlDotActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  tlDotTodo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
  },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginVertical: 3,
  },
  tlLineDone: { backgroundColor: "#000" },
  tlContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tlContentActive: { backgroundColor: TINT },
  tlLabel: { fontSize: 14, fontWeight: "700", color: "#000", flexShrink: 1 },
  tlSub: { fontSize: 12, fontWeight: "600", color: FAINT, marginLeft: 8 },
  emptySeat: {
    borderWidth: 1.5,
    borderColor: "#D7DBE3",
    borderStyle: "dashed",
    backgroundColor: "transparent",
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  pillBtn: {
    backgroundColor: "#000",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillBtnOutline: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  pillBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  footer: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  footerRow: { flexDirection: "row", alignItems: "center" },
  footerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
    flexShrink: 1,
  },
  footerSub: { fontSize: 12, fontWeight: "500", color: SUB, marginTop: 2 },
  quietAction: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 6,
  },
  quietActionText: { fontSize: 14, fontWeight: "600", color: "#999" },
  skelBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E9ECF1",
    marginBottom: 10,
  },
});

const styles = StyleSheet.create({
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
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
  // White backing so company logos (often on transparent PNGs) read
  // against the card's black.
  roleCardLogoWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF",
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
  insiderNote: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 19,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
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
