import { BlurView } from "expo-blur";
import { Check } from "@/components/ui/icons";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CheckInSheetShellProps {
  visible: boolean;
  /**
   * Only reachable from the "empty" frame's "Got it" button — there's
   * nothing to act on there, so that's the one path that has to let the
   * user leave. Every other state requires answering and submitting.
   */
  onClose: () => void;
  /** Which frame to show. "content" renders children. */
  state: "loading" | "empty" | "success" | "content";
  loadingText: string;
  emptyTitle: string;
  emptyText: string;
  successTitle: string;
  successSubtitle: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the referral check-in sheets — the full-height modal,
 * blur backdrop, drag handle, and the loading/empty/success frames were
 * duplicated nearly line-for-line across ApplicantCheckInModal and
 * SponsorCheckInModal; this owns them once so the two roles' sheets can't
 * drift apart visually. The flows inside stay separate on purpose: the
 * applicant sheet is a single-referral report (timeline + note), the
 * sponsor sheet is a batch triage — different interaction models, not
 * duplicated code.
 *
 * Intentionally has no close/X affordance and isn't dismissible by tapping
 * the backdrop. This sheet exists to nudge a check-in the user might
 * otherwise put off indefinitely, so the only way out of the "content"
 * frame is submitting an update — the "empty" frame is the sole exception,
 * since there's genuinely nothing to check in on there.
 */
export function CheckInSheetShell({
  visible,
  onClose,
  state,
  loadingText,
  emptyTitle,
  emptyText,
  successTitle,
  successSubtitle,
  children,
}: CheckInSheetShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Non-dismissible blur backdrop */}
      <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.sheetWrapper}>
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(24, insets.bottom + 16),
              height:
                Platform.OS === "ios"
                  ? SCREEN_HEIGHT * 0.94
                  : SCREEN_HEIGHT * 0.92,
            },
          ]}
        >
          {/* Drag handle — decorative only; the sheet doesn't actually
              dismiss on swipe (no dismiss gesture wired to this handle). */}
          <View style={styles.handle} />

          {state === "success" ? (
            <Animated.View
              entering={ZoomIn.duration(320)}
              style={styles.successContainer}
            >
              <View style={styles.successCircle}>
                <Check color="#FFF" size={34} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>{successTitle}</Text>
              <Text style={styles.successSubtitle}>{successSubtitle}</Text>
            </Animated.View>
          ) : state === "loading" ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#000" />
              <Text style={styles.stateText}>{loadingText}</Text>
            </View>
          ) : state === "empty" ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.stateText}>{emptyText}</Text>
              <TouchableOpacity
                style={styles.emptyDismissBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyDismissBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          ) : (
            children
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 12,
    paddingHorizontal: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 52,
    paddingHorizontal: 20,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 12,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  stateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyDismissBtn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: "#000",
  },
  emptyDismissBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
