import { BlurView } from "expo-blur";

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
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Type } from "@/constants/theme";

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
  state: "loading" | "empty" | "content";
  loadingText: string;
  emptyTitle: string;
  emptyText: string;
  /** Sheet height as a fraction of the screen. Defaults to the original
   * near-full height; the card-stack sheets use a shorter one. */
  heightFraction?: number;
  children: React.ReactNode;
}

/**
 * Shared shell for the referral check-in sheets — the modal, blur backdrop,
 * drag handle, and the loading/empty frames, owned once so the two roles'
 * sheets can't drift apart visually. Both roles render a CheckInStack
 * session inside (the old success frame is gone — the stack's recap is the
 * session exit).
 *
 * Intentionally has no close/X affordance and isn't dismissible by tapping
 * the backdrop. Its entry points are all user-initiated (Matches banner,
 * check-in notification, stale-count header icon), so the lock means
 * "finish the pass you started" — and the stack's per-card Skip keeps it
 * from ever being a hostage situation. The "empty" frame is the sole
 * direct exit, since there's genuinely nothing to check in on there.
 */
export function CheckInSheetShell({
  visible,
  onClose,
  state,
  loadingText,
  emptyTitle,
  emptyText,
  heightFraction,
  children,
}: CheckInSheetShellProps) {
  const insets = useSafeAreaInsets();
  const fraction =
    heightFraction ?? (Platform.OS === "ios" ? 0.94 : 0.92);

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
              height: SCREEN_HEIGHT * fraction,
            },
          ]}
        >
          {/* Drag handle — decorative only; the sheet doesn't actually
              dismiss on swipe (no dismiss gesture wired to this handle). */}
          <View style={styles.handle} />

          {state === "loading" ? (
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
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
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
    ...Type.heading,
    color: Colors.ink,
  },
  stateText: {
    fontSize: 14,
    color: Colors.body,
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
