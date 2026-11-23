// SideSwitcherSheet — pick which side of the account the app shows
// (docs/DUAL_SIDES.md). Opened from the top-bar pill on any tab. Same sheet
// language as JobSwitcherSheet (the sponsor's role picker): bounded rows on
// paper, the active one in an ink border.
//
// Presentational: the tabs shell owns the switch itself (lib/switchSide).

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { DismissibleSheet } from "@/components/ui/DismissibleSheet";
import { Check } from "@/components/ui/icons";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";
import { sheetMaxHeight } from "@/lib/responsive";
import {
  sideSummary,
  sideTitle,
  waitingLine,
  waitingTotal,
  type Role,
  type SidesSummary,
} from "@/lib/sides";

interface SideSwitcherSheetProps {
  visible: boolean;
  /** Every side the account holds, in display order. */
  roles: Role[];
  activeRole: Role;
  /** The sponsor side's company, for "Sponsor at …" and the privacy line. */
  company?: string | null;
  /** What's waiting on each side, when the server can say. Without it the
   * rows describe what each side is for. */
  summaries?: SidesSummary;
  onSwitch: (role: Role) => void;
  onClose: () => void;
}

export function SideSwitcherSheet({
  visible,
  roles,
  activeRole,
  company,
  summaries,
  onSwitch,
  onClose,
}: SideSwitcherSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const employer = (company || "").trim();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <DismissibleSheet
          onDismiss={onClose}
          style={[styles.sheet, { maxHeight: sheetMaxHeight(windowHeight, 0.7) }]}
        >
          <Text style={styles.title} accessibilityRole="header">
            Switch <Text style={styles.titleEm}>sides.</Text>
          </Text>

          <View style={styles.rows}>
            {roles.map((role) => {
              const active = role === activeRole;
              const title = sideTitle(role, employer);
              const waiting = waitingLine(role, summaries?.[role]);
              const total = waitingTotal(summaries?.[role]);
              const sub = waiting ?? sideSummary(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.row, active && styles.rowActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (active) {
                      onClose();
                      return;
                    }
                    Haptics.selectionAsync().catch(() => {});
                    onSwitch(role);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${title}. ${sub}${active ? ". Current side" : ""}`}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text
                      style={[styles.rowSub, waiting ? styles.rowSubWaiting : null]}
                      numberOfLines={2}
                    >
                      {sub}
                    </Text>
                  </View>
                  {active ? (
                    <View style={styles.check}>
                      <Check size={13} color={Colors.paper} strokeWidth={3} />
                    </View>
                  ) : total > 0 ? (
                    // The count pill the tab bar and section headers use.
                    <View style={styles.count}>
                      <Text style={styles.countText} maxFontSizeMultiplier={1.2}>
                        {total > 99 ? "99+" : total}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.checkEmpty} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            Each side has its own feed, matches and inbox.
            {employer ? ` ${employer} can't see your job search.` : ""}
          </Text>
        </DismissibleSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  title: { ...Type.heading, color: Colors.ink, marginTop: 4 },
  titleEm: { fontFamily: Fonts.serifItalic, color: Colors.muted },
  rows: { marginTop: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 68,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  rowActive: { borderColor: Colors.ink, borderWidth: 1.5 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: Fonts.sansBold, fontSize: 16, lineHeight: 21, color: Colors.ink },
  rowSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  rowSubWaiting: { color: Colors.ink, fontFamily: Fonts.sansMedium },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.paper },
  checkEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
  },
  footnote: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 16,
  },
});
