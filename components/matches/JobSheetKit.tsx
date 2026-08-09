import {
    Check,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Copy,
    ExternalLink,
    Handshake,
    X,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";
import Animated, { FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { CompanyLogo } from "../ui/CompanyLogo";
import { Colors, Fonts, Type } from "@/constants/theme";

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
 * The shared vocabulary of the Matches-surface sheets — the "Docket"
 * system (2026-08 rebrand, replacing the floating-card Gallery): flat
 * sections on paper divided by hairlines, serif identity blocks with
 * square tiles, facts as a caps-key ledger (the deck cards' exact
 * language), and one filled ink pill per surface for the primary action.
 * No canvas tint, no card shadows — depth retired in favor of rules.
 */

// ── Docket tokens ───────────────────────────────────────────────────────

/** Sheet background. The Gallery's soft canvas is gone — sheets sit on
 * paper; kept exported under the old name for the call sites. */
export const CANVAS = Colors.paper;
const HAIRLINE = Colors.border;
const SUB = Colors.body;
const FAINT = Colors.muted;
const TINT = Colors.surface;

/** Bottom inset of a sheet — BarFooter extends its background through it
 * so the bar reads as anchored, not floating. */
const SHEET_BOTTOM = 36;

/** Merge into the sheet's content style. */
export const canvasSheet: ViewStyle = {
  backgroundColor: Colors.paper,
  padding: 20,
  paddingBottom: SHEET_BOTTOM,
};

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

/** Close affordance in a hero block's corner — scrolls with the content. */
function CardCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={g.cardClose}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Close"
    >
      <X size={15} color={Colors.body} strokeWidth={2.5} />
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
            <ChevronUp size={14} color={Colors.ink} strokeWidth={2.5} />
          ) : (
            <ChevronDown size={14} color={Colors.ink} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      )}
    </>
  );
}


// ── Skills (capped) ─────────────────────────────────────────────────────

/**
 * Skill chips capped at `initialCount` with a dashed "+N more" expander —
 * ATS jobs ship 15-20 skills and an unbounded wall of chips dominated the
 * scroll (PM feedback). Shared by every sheet that lists skills.
 */
export function SkillChips({
  skills,
  initialCount = 8,
}: {
  skills: string[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [skills]);
  if (skills.length === 0) return null;
  const shown = expanded ? skills : skills.slice(0, initialCount);
  const hiddenCount = skills.length - shown.length;
  return (
    <View style={g.skillsWrap}>
      {shown.map((skill, idx) => (
        <View key={`${skill}-${idx}`} style={g.skillChip}>
          <Text style={g.skillChipText}>{skill}</Text>
        </View>
      ))}
      {hiddenCount > 0 && (
        <TouchableOpacity
          style={g.skillMore}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Show ${hiddenCount} more skills`}
        >
          <Text style={g.skillMoreText}>+{hiddenCount} more</Text>
        </TouchableOpacity>
      )}
      {expanded && skills.length > initialCount && (
        <TouchableOpacity
          style={g.skillMore}
          onPress={() => setExpanded(false)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Show fewer skills"
        >
          <Text style={g.skillMoreText}>Show fewer</Text>
        </TouchableOpacity>
      )}
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


// ═══ Docket components ══════════════════════════════════════════════════

/** A flat content section between hairlines — the Docket's basic unit. */
export function Card({
  style,
  children,
}: {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}) {
  return <View style={[g.card, style]}>{children}</View>;
}

/** A titled flat section. */
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
 * The job's identity — a dossier ID block: square logo tile beside the
 * serif title and company · location line, with the original-posting
 * domain as a quiet trust row.
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
  /** Close affordance in the block's corner — scrolls with the content. */
  onClose?: () => void;
}) {
  const domain = sourceUrl ? extractDomainForPill(sourceUrl) : null;
  const placeLine = joinDot([location, remote ? "Remote-friendly" : ""]);
  return (
    <View style={g.hero}>
      {onClose && <CardCloseButton onPress={onClose} />}
      <View style={g.heroRow}>
        <CompanyLogo
          logoUrl={logoUrl}
          name={logoName || company || title}
          size={64}
          borderRadius={16}
          initialFontSize={26}
        />
        <View style={g.heroText}>
          <Text style={g.heroTitle} numberOfLines={3}>
            {title}
          </Text>
          {!!(company || placeLine) && (
            <Text style={g.heroSub} numberOfLines={2}>
              {!!company && <Text style={g.heroSubEm}>{company}</Text>}
              {company && placeLine ? " · " : ""}
              {placeLine}
            </Text>
          )}
        </View>
      </View>
      {!!domain && (
        <TouchableOpacity
          style={g.sourceRow}
          onPress={() => Linking.openURL(sourceUrl!).catch(() => {})}
          activeOpacity={0.7}
          accessibilityLabel={`View original posting on ${domain}`}
        >
          <ExternalLink size={12} color={SUB} strokeWidth={2.2} />
          <Text style={g.sourceRowText}>{domain}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Local, dependency-free domain trim for the source row (jobTransforms'
// extractDisplayDomain lives with the jobs feature; the kit stays leaf).
function extractDomainForPill(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** " · "-joins the present parts. */
function joinDot(parts: (string | undefined | null)[]): string {
  return parts.filter((p) => !!p && p.trim().length > 0).join(" · ");
}

/**
 * A person's identity — the same dossier ID block with a square photo.
 * Status chips render as outlined caps chips under the identity (the
 * caller's accent color carries through for e.g. "Wants to connect").
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
  /** Quiet extra fact line under the meta — e.g. tenure or experience. */
  infoPill?: string;
  pill?: { label: string; color?: string; bgColor?: string };
  /** Close affordance in the block's corner — scrolls with the content. */
  onClose?: () => void;
}) {
  const accent = pill?.color ?? Colors.ink;
  return (
    <View style={g.hero}>
      {onClose && <CardCloseButton onPress={onClose} />}
      <View style={g.heroRow}>
        {image ? (
          <Image source={{ uri: image }} style={g.personAvatar} />
        ) : (
          <View style={[g.personAvatar, g.personAvatarFallback]}>
            <Text style={g.personAvatarInitial}>
              {(name || "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={g.heroText}>
          <Text style={g.heroTitle} numberOfLines={2}>
            {name}
          </Text>
          {!!(meta || location) && (
            <Text style={g.heroSub} numberOfLines={2}>
              {joinDot([meta, location])}
            </Text>
          )}
          {!!infoPill && (
            <Text style={g.heroFact} numberOfLines={1}>
              {infoPill}
            </Text>
          )}
        </View>
      </View>
      {pill && (
        <View style={g.heroChipRow}>
          <View style={[g.capsChip, { borderColor: accent }]}>
            <CheckCircle size={11} color={accent} />
            <Text style={[g.capsChipText, { color: accent }]}>
              {pill.label.toUpperCase()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Fact ledger — the deck cards' caps-key rows (was the App-Store stat
 * strip). Same {label, value} API; labels become ledger keys.
 */
export function StatStrip({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  if (stats.length === 0) return null;
  return (
    <View style={g.ledger}>
      {stats.map((s) => (
        <View key={s.label} style={g.ledgerRow}>
          <Text style={g.ledgerKey} numberOfLines={1}>
            {s.label.toUpperCase()}
          </Text>
          <Text style={g.ledgerValue} numberOfLines={2}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The insider block — flat identity row under a caps label, with their
 * words as a serif quote (the Vouch voice) when a note is present.
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
  const accent = red ? Colors.danger : Colors.ink;
  return (
    <View style={g.card}>
      <Text style={g.sectionTitle}>{label.toUpperCase()}</Text>
      <View style={g.hostRow}>
        {image ? (
          <Image source={{ uri: image }} style={g.hostAvatar} />
        ) : (
          <View style={[g.hostAvatar, g.personAvatarFallback]}>
            <Text style={g.hostAvatarInitial}>
              {(name || "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={g.hostName} numberOfLines={1}>
            {name}
          </Text>
          {!!role && (
            <Text style={g.hostRole} numberOfLines={2}>
              {role}
            </Text>
          )}
        </View>
      </View>
      {pill && (
        <View style={g.heroChipRow}>
          <View style={[g.capsChip, { borderColor: accent }]}>
            <CheckCircle size={11} color={accent} />
            <Text style={[g.capsChipText, { color: accent }]}>
              {pill.label.toUpperCase()}
            </Text>
          </View>
        </View>
      )}
      {!!note && (
        <View style={g.hostQuote}>
          <Text style={g.hostQuoteMark}>“</Text>
          <Text style={g.hostQuoteText}>{note}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * A tappable role object — logo tile, label, title, chevron. The person
 * sheet's doorway into the job sheet. Stays a bounded object (it's a
 * button, not a section).
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
      style={g.ticketRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `View job: ${title}` : undefined}
    >
      <CompanyLogo
        logoUrl={logoUrl || undefined}
        name={company || title}
        size={44}
        borderRadius={12}
        initialFontSize={18}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={g.ticketLabel}>{label.toUpperCase()}</Text>
        <Text style={g.ticketTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!company && (
          <Text style={g.ticketCompany} numberOfLines={1}>
            {company}
          </Text>
        )}
      </View>
      {onPress && (
        <ChevronRight color={Colors.faint} size={18} strokeWidth={2.2} />
      )}
    </TouchableOpacity>
  );
}

/**
 * Journey timeline — flat rows on a dot rail; done stages fill ink,
 * the active stage breathes, todo stages stay hollow.
 */
export function Timeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <View style={[g.card, { paddingVertical: 14 }]}>
      {steps.map((s, i) => (
        <View key={s.label} style={g.tlRow}>
          <View style={g.tlRail}>
            {s.state === "done" ? (
              <View style={g.tlDotDone}>
                <Check size={9} color={Colors.paper} strokeWidth={3.5} />
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
          <View style={g.tlContent}>
            <Text
              style={[g.tlLabel, s.state === "todo" && { color: Colors.faint }]}
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
 * The insider seat, still empty — a quiet dashed frame. `filled` flips
 * it solid when someone arrives.
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
    <View style={[g.emptySeat, filled && g.emptySeatFilled]}>
      <View style={g.emptySeatIcon}>
        {filled ? (
          <CheckCircle size={26} color={Colors.ink} strokeWidth={2.2} />
        ) : (
          <Handshake size={26} color={FAINT} strokeWidth={1.8} />
        )}
      </View>
      <Text style={g.emptySeatTitle}>{title}</Text>
      <Text style={g.emptySeatBody}>{body}</Text>
    </View>
  );
}

/** Ink CTA pill (or outline variant). */
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
        <ActivityIndicator
          size="small"
          color={outline ? Colors.ink : Colors.paper}
        />
      ) : (
        <>
          {icon}
          <Text style={[g.pillBtnText, outline && { color: Colors.ink }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Action bar pinned under the scroll — context on the left (with
 * waiting/done affordances), a compact pill on the right. With no
 * context the pill stretches full width. `children` renders below the
 * row for quiet secondary actions.
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
          /* Keyed on done so the pending→done swap fades in rather than
             hard-cutting (the check + message appear as a confirmation). */
          <Animated.View
            key={context.done ? "done" : "pending"}
            entering={FadeIn.duration(220)}
            style={{ flex: 1, paddingRight: 12 }}
          >
            <View style={g.footerTitleRow}>
              {context.waiting && <PulsingDot />}
              {context.done && (
                <CheckCircle size={13} color={Colors.ink} strokeWidth={2.5} />
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
          </Animated.View>
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
          color={destructive ? Colors.danger : Colors.muted}
        />
      ) : (
        <Text
          style={[g.quietActionText, destructive && { color: Colors.danger }]}
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
 * as tappable). Stays a bounded object; selected flips the border ink.
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
      style={[g.selectRow, selected && g.selectRowSelected]}
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
        {selected && <Check size={13} color={Colors.paper} strokeWidth={3.5} />}
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
 * company's ATS portal. Every row tap-copies its value; Copy All puts the
 * whole packet on the clipboard as label: value lines. `onCopied` lets the
 * caller toast.
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
          <Copy size={14} color={Colors.muted} strokeWidth={2} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={g.packetCopyAll}
        onPress={copyAll}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Copy the whole packet"
      >
        <Copy size={13} color={Colors.ink} strokeWidth={2.2} />
        <Text style={g.packetCopyAllText}>Copy All</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Pulsing placeholder section for content that's still loading. */
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
  // A flat section between hairlines — bg/shadow/radius retired.
  card: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  // 12px floor per the section-header accessibility feedback.
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: FAINT,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  cardClose: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TINT,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero ID blocks ────────────────────────────────────────────────
  hero: { paddingTop: 8, paddingBottom: 16 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    // Keep the identity clear of the corner close affordance.
    paddingRight: 26,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 22,
    lineHeight: 27,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13.5,
    fontWeight: "500",
    color: SUB,
    lineHeight: 19,
    marginTop: 5,
  },
  heroSubEm: {
    fontFamily: Fonts.serifItalic,
    fontSize: 14.5,
    color: Colors.muted,
  },
  heroFact: {
    fontSize: 12.5,
    fontWeight: "500",
    color: Colors.muted,
    marginTop: 3,
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  capsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.2,
    borderColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  capsChipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.ink,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  sourceRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: SUB,
  },
  personAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: TINT,
  },
  personAvatarFallback: {
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.muted,
  },

  // ── Ledger (was the stat strip) ───────────────────────────────────
  ledger: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  ledgerKey: {
    width: 106,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: FAINT,
    paddingTop: 2,
  },
  ledgerValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.ink,
    lineHeight: 19,
  },

  // ── Insider block ─────────────────────────────────────────────────
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: TINT,
  },
  hostAvatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.muted,
  },
  hostName: {
    fontFamily: Fonts.sansBold,
    fontSize: 15.5,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  hostRole: {
    fontSize: 12.5,
    fontWeight: "500",
    color: SUB,
    marginTop: 2,
  },
  hostQuote: { marginTop: 14 },
  hostQuoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 32,
    color: Colors.faint,
    marginBottom: -8,
  },
  hostQuoteText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16,
    lineHeight: 23,
    color: Colors.ink,
  },

  // ── Role ticket (bounded button) ──────────────────────────────────
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 16,
    padding: 13,
    marginVertical: 8,
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: FAINT,
    marginBottom: 2,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
  },
  ticketCompany: { fontSize: 12.5, fontWeight: "500", color: SUB, marginTop: 1 },

  // ── Timeline ──────────────────────────────────────────────────────
  tlRow: { flexDirection: "row", minHeight: 44 },
  tlRail: { width: 24, alignItems: "center" },
  tlDotDone: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  tlDotActive: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  tlDotTodo: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 5,
  },
  tlLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: Colors.border,
    marginVertical: 3,
  },
  tlLineDone: { backgroundColor: Colors.ink },
  tlContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tlLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.ink,
    flexShrink: 1,
  },
  tlSub: { fontSize: 12, fontWeight: "500", color: FAINT, marginLeft: 8 },

  // ── Empty seat ────────────────────────────────────────────────────
  emptySeat: {
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  emptySeatFilled: {
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  emptySeatIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: TINT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptySeatTitle: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 18,
    color: Colors.ink,
    textAlign: "center",
  },
  emptySeatBody: {
    fontSize: 13,
    fontWeight: "500",
    color: SUB,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 19,
  },

  // ── Skills ────────────────────────────────────────────────────────
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  skillChip: {
    backgroundColor: TINT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skillChipText: { fontSize: 12.5, fontWeight: "600", color: SUB },
  skillMore: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.faint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skillMoreText: { fontSize: 12.5, fontWeight: "700", color: Colors.muted },

  // ── CTA / footer ──────────────────────────────────────────────────
  pillBtn: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillBtnOutline: {
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  pillBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.paper,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  footer: {
    // Bleed through the sheet's padding on all three closed sides so the
    // bar's paper runs edge-to-edge AND down to the screen bottom.
    marginHorizontal: -20,
    marginBottom: -SHEET_BOTTOM,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: SHEET_BOTTOM,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: Colors.paper,
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
    color: Colors.ink,
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
    backgroundColor: Colors.border,
    marginBottom: 10,
  },

  // ── Selection / packet ────────────────────────────────────────────
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  selectRowSelected: {
    borderColor: Colors.ink,
    borderWidth: 1.5,
  },
  selectIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  selectTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.ink,
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
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCheckOn: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
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
    fontSize: 10,
    fontWeight: "800",
    color: FAINT,
    letterSpacing: 0.8,
  },
  packetValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
  },
  packetCopyAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  packetCopyAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.ink,
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
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyText: { fontSize: 14, color: Colors.body, lineHeight: 22 },
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
    color: Colors.ink,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
});
