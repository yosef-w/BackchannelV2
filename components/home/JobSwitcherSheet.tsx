import { BlurView } from "expo-blur";
import React from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { Colors, Type } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SwitcherJob {
  jobId: string;
  title?: string;
  company?: string;
  likesCount?: number;
}

interface JobSwitcherSheetProps {
  visible: boolean;
  jobs: SwitcherJob[];
  activeJobId: string | null;
  onSwitch: (jobId: string) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for a sponsor to pick which sponsored role the deck reviews
 * applicants for. Rows use the shared grouped-card language; the
 * pending-applicant count keeps the same pill shape on every row so the
 * eye can scan high/low counts easily — active counts are black/white,
 * zero is the same shape muted.
 */
export function JobSwitcherSheet({
  visible,
  jobs,
  activeJobId,
  onSwitch,
  onClose,
}: JobSwitcherSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <DismissibleSheet
          scrollDismiss
          onDismiss={onClose}
          style={styles.sheet}
        >
          <Text style={styles.title}>Switch role</Text>
          <Text style={styles.subtitle}>
            Pick which sponsored role to review applicants for. We&apos;ll
            match them with that role when you swipe right.
          </Text>

          <SheetScrollView style={{ marginTop: 8 }}>
            {jobs.map((job) => {
              const isActive = job.jobId === activeJobId;
              const count = job.likesCount ?? 0;
              return (
                <TouchableOpacity
                  key={job.jobId}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => onSwitch(job.jobId)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {job.title || "Untitled role"}
                    </Text>
                    {!!job.company && (
                      <Text style={styles.rowCompany} numberOfLines={1}>
                        {job.company}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      count === 0 && styles.countBadgeMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        count === 0 && styles.countBadgeTextMuted,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </SheetScrollView>
        </DismissibleSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
    // Absolute px (not "70%") because the sheet sits inside
    // DismissibleSheet's GestureHandlerRootView wrapper, which is
    // content-sized. A % maxHeight against it would resolve to 0 / clip
    // content — same fix we applied to MatchesView's modalContent.
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  title: {
    ...Type.heading,
    color: Colors.ink,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.body,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    marginBottom: 8,
  },
  rowActive: {
    borderColor: "#000",
    borderWidth: 2,
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#000" },
  rowCompany: { fontSize: 13, fontWeight: "500", color: Colors.body, marginTop: 2 },
  countBadge: {
    backgroundColor: "#000",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeMuted: { backgroundColor: Colors.border },
  countBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  countBadgeTextMuted: { color: Colors.muted },
});
