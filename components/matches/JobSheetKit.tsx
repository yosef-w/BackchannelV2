import {
    Check,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Copy,
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
    Share,
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
import { Colors, Type } from "@/constants/theme";

// expo-clipboard's NATIVE module may be missing from the running binary
// (dev client / TestFlight build compiled before the package was linked).
// A top-level import would throw at bundle-eval and take down every screen
// that transitively imports this kit — require lazily and degrade instead:
// without the module, copy actions fall back to the system share sheet
// (which includes Copy).
let Clipboard: typeof import("expo-clipboard") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Clipboard = require("expo-clipboard");
} catch {
  Clipboard = null;
}

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
// Consolidated onto the shared palette (constants/theme.ts) — these were
// a separate local Tailwind-gray scale duplicating Colors.body/.muted/
// .surface under different names. Kept as local aliases (not exported,
// used nowhere else) rather than touching every call site individually.
const SUB = Colors.body;
const FAINT = Colors.muted;
const TINT = Colors.surface;

/** Bottom inset of a canvas sheet — BarFooter extends its background
 * through it so the bar reads as anchored, not floating. */
const SHEET_BOTTOM = 36;

/** Merge into the sheet's content style to put it on the Gallery canvas. */
export const canvasSheet: ViewStyle = {
  backgroundColor: CANVAS,
  padding: 20,
  paddingBottom: SHEET_BOTTOM,
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

// ── Close affordances ───────────────────────────────────────────────────

/**
 * Close affordance pinned against the SHEET (absolute) — for sheets whose
 * top region is static (e.g. a fixed header row). Sheets whose content
 * scrolls from the very top should use the hero cards' `onClose` instead,
 * so the button scrolls away with the content it belongs to.
 */
export function SheetCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.closeBtn}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Close"
    >
      <X size={16} color={Colors.body} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

/** Close affordance in a hero card's corner — scrolls with the content. */
function CardCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={g.cardClose}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Close"
    >
      <X size={15} color="#6B7280" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

// ── Journey strip ───────────────────────────────────────────────────────

export interface JourneyStep {
  label: string;
  sub?: string;
  state: "done" | "active" | "todo";
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
  onClose,
}: {
  logoUrl?: string;
  logoName?: string;
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  sourceUrl?: string;
  /** Close affordance in the card's corner — scrolls with the content. */
  onClose?: () => void;
}) {
  const domain = sourceUrl ? extractDomainForPill(sourceUrl) : null;
  return (
    <View style={[g.card, g.posterCard]}>
      {onClose && <CardCloseButton onPress={onClose} />}
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
  infoPill,
  pill,
  onClose,
}: {
  name: string;
  image?: string;
  meta?: string;
  location?: string;
  /**
   * Quiet neutral fact pill between the location and the status pill —
   * e.g. tenure ("3-5 years at Snowflake") or experience. Detail facts
   * belong on the person's card, not floating between content cards.
   */
  infoPill?: string;
  pill?: { label: string; color?: string; bgColor?: string };
  /** Close affordance in the card's corner — scrolls with the content. */
  onClose?: () => void;
}) {
  return (
    <View style={[g.card, g.posterCard]}>
      {onClose && <CardCloseButton onPress={onClose} />}
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
      {!!infoPill && (
        <View style={[g.tintPill, { marginTop: 10 }]}>
          <Text style={g.tintPillText}>{infoPill}</Text>
        </View>
      )}
      {pill && (
        <View
          style={[
            g.tintPill,
            { marginTop: infoPill ? 8 : 10, backgroundColor: pill.bgColor ?? TINT },
          ]}
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
            <Text
              style={g.statValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
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
          color={destructive ? "#DC2626" : Colors.muted}
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

/**
 * Whole-surface selection card — an attestation/choice the user commits to
 * by tapping ANYWHERE on the card (testers didn't recognize bare text rows
 * as tappable). Selected state flips the border black and fills the check.
 */
export function SelectionCard({
  icon,
  title,
  description,
  selected,
  onToggle,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[g.card, g.selectRow, selected && g.selectRowSelected]}
      onPress={onToggle}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
    >
      {icon && <View style={g.selectIcon}>{icon}</View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={g.selectTitle}>{title}</Text>
        {!!description && (
          <Text style={g.selectDescription}>{description}</Text>
        )}
      </View>
      <View style={[g.selectCheck, selected && g.selectCheckOn]}>
        {selected && <Check size={13} color="#FFF" strokeWidth={3.5} />}
      </View>
    </TouchableOpacity>
  );
}

export interface PacketField {
  label: string;
  value: string;
}

/**
 * The referral packet — the applicant's details a sponsor types into their
 * company's ATS portal. Every row tap-copies its value (Cash-App-receipt
 * energy); Copy All puts the whole packet on the clipboard as label: value
 * lines. `onCopied` lets the caller toast.
 */
export function PacketCard({
  title = "Referral Packet",
  fields,
  onCopied,
}: {
  title?: string;
  fields: PacketField[];
  onCopied?: (what: string) => void;
}) {
  const rows = fields.filter((f) => !!f.value);
  if (rows.length === 0) return null;
  const put = (text: string, what: string) => {
    if (Clipboard) {
      Clipboard.setStringAsync(text).catch(() => {});
      onCopied?.(what);
    } else {
      // No native clipboard in this binary — the share sheet's Copy
      // action covers it (no onCopied toast; the sheet IS the feedback).
      Share.share({ message: text }).catch(() => {});
    }
  };
  const copyOne = (f: PacketField) => put(f.value, f.label);
  const copyAll = () =>
    put(rows.map((f) => `${f.label}: ${f.value}`).join("\n"), "Everything");
  return (
    <View style={g.card}>
      <Text style={g.sectionTitle}>{title.toUpperCase()}</Text>
      {rows.map((f, i) => (
        <TouchableOpacity
          key={f.label}
          style={[g.packetRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
          onPress={() => copyOne(f)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${f.label}`}
        >
          <Text style={g.packetLabel}>{f.label.toUpperCase()}</Text>
          <Text style={g.packetValue} numberOfLines={2}>
            {f.value}
          </Text>
          <Copy size={14} color="#9CA3AF" strokeWidth={2} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={g.packetCopyAll}
        onPress={copyAll}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Copy the whole packet"
      >
        <Copy size={13} color="#000" strokeWidth={2.2} />
        <Text style={g.packetCopyAllText}>Copy All</Text>
      </TouchableOpacity>
    </View>
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
  cardClose: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: "center",
    justifyContent: "center",
  },
  posterLogoTile: {
    padding: 12,
    borderRadius: 26,
    backgroundColor: CANVAS,
    marginBottom: 14,
  },
  posterTitle: {
    ...Type.heading,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 4,
  },
  posterCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: SUB,
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
  tintPillText: { fontSize: 11, fontWeight: "800", color: Colors.ink },
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
    color: Colors.ink,
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
  personAvatarInitial: { fontSize: 32, fontWeight: "800", color: Colors.ink },
  hostAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 10,
  },
  hostAvatarInitial: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  // A person's name — same headline-tier rule used elsewhere.
  hostName: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 18,
    color: Colors.ink,
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
    // Bleed through the sheet's padding on all three closed sides so the
    // bar's white runs edge-to-edge AND down to the screen bottom — the
    // sheet's canvas showing beneath the bar made the spacing look uneven
    // and the bar look like it was floating.
    marginHorizontal: -20,
    marginBottom: -SHEET_BOTTOM,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: SHEET_BOTTOM,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
  },
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
  quietActionText: { fontSize: 14, fontWeight: "600", color: Colors.muted },
  skelBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E9ECF1",
    marginBottom: 10,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 10,
  },
  selectRowSelected: {
    borderColor: "#000",
    borderWidth: 1.5,
  },
  selectIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  selectTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  selectDescription: {
    fontSize: 12,
    fontWeight: "500",
    color: SUB,
    marginTop: 2,
    lineHeight: 17,
  },
  selectCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  selectCheckOn: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  packetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  packetLabel: {
    width: 86,
    fontSize: 9,
    fontWeight: "900",
    color: FAINT,
    letterSpacing: 0.8,
  },
  packetValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  packetCopyAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: TINT,
  },
  packetCopyAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
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
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
});
