import { ChevronRight } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface OpportunityRowProps {
  onPress: () => void;
  /** Avatar or CompanyLogo — the row doesn't care which, it just sizes/positions it. */
  leading: React.ReactNode;
  title: string;
  /** Dims the title + subtitle — used for withdrawn/inactive rows within In Progress. */
  muted?: boolean;
  subtitle?: string;
  /** Small icon+text line under the subtitle — e.g. "❤ 2d ago". */
  meta?: React.ReactNode;
  /** Full-width content under everything else — e.g. <PipelineStageTimeline />. */
  detail?: React.ReactNode;
  /**
   * Trailing content. Pass a <StatusChip /> for passive/waiting rows, or a
   * string to render the black CTA pill (e.g. "View", "Message") for rows
   * that need action. Omit for a plain chevron (still communicates
   * "tappable" without implying a specific verb).
   */
  right?: React.ReactNode;
  cta?: string;
  /**
   * When provided, the CTA pill becomes its own tap target (e.g. "Message")
   * separate from the row's own onPress (e.g. "view profile") — the same
   * two-action pattern the old match cards used (tap card vs. tap Message
   * button). When omitted, the CTA is decorative and the whole row just
   * calls `onPress`.
   */
  onPressCta?: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function OpportunityRow({
  onPress,
  leading,
  title,
  muted,
  subtitle,
  meta,
  detail,
  right,
  cta,
  onPressCta,
  disabled,
  isLast,
}: OpportunityRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {leading}
      <View style={styles.info}>
        <Text
          style={[styles.title, muted && styles.titleMuted]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[styles.subtitle, muted && styles.subtitleMuted]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
        {!!meta && <View style={styles.metaRow}>{meta}</View>}
        {detail}
      </View>
      <View style={styles.trailing}>
        {cta ? (
          onPressCta ? (
            <TouchableOpacity
              style={styles.ctaPill}
              onPress={onPressCta}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.ctaText}>{cta}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ctaPill}>
              <Text style={styles.ctaText}>{cta}</Text>
            </View>
          )
        ) : (
          (right ?? <ChevronRight size={18} color="#CCC" />)
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Convenience for the common "icon + small gray text" meta line (e.g. a relative timestamp). */
export function MetaLine({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <>
      {icon}
      <Text style={styles.metaText}>{text}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: "#000" },
  titleMuted: { color: "#999" },
  subtitle: { fontSize: 12, color: "#888", fontWeight: "500" },
  subtitleMuted: { color: "#BBB" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  trailing: { alignItems: "flex-end", justifyContent: "center" },
  ctaPill: {
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ctaText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  metaText: { fontSize: 11, color: "#999", fontWeight: "600" },
});
