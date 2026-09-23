import { BlurView } from "expo-blur";

import React, { cloneElement, isValidElement } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sheetMaxHeight, sheetColumn } from "@/lib/responsive";
import { Colors, Radii, Type } from "@/constants/theme";

/** Sheet chrome above wherever `children` starts rendering: the sheet's own
 * `paddingTop` plus the drag handle's height and bottom margin. Combined
 * with the sheet's own top position (`sheetTopOffset` below), this is how
 * far down the SCREEN the content actually starts — which is what
 * CheckInStack's KeyboardAvoidingView needs as its `keyboardVerticalOffset`
 * (see CheckInStack.tsx for why). Keep in sync with `styles.sheet.paddingTop`
 * and `styles.handle` below. */
export const SHEET_CONTENT_INSET = 12 + 5 + 20;

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
  const { height: windowHeight } = useWindowDimensions();
  const fraction =
    heightFraction ?? (Platform.OS === "ios" ? 0.94 : 0.92);
  // Live, not a frozen module-scope constant — recomputes on rotation,
  // Split View and Stage Manager resize (see lib/responsive.ts).
  const sheetHeight = sheetMaxHeight(windowHeight, fraction);
  // The sheet's own absolute top on screen — how far down the leftover
  // space above the bottom-anchored sheet leaves it (sheetWrapper's
  // `justifyContent: "flex-end"`). This, not that PLUS the sheet's own
  // inner chrome, is what CheckInStack's KeyboardAvoidingView needs as its
  // `keyboardVerticalOffset`: RN measures the KAV's own `frame.y` via
  // `onLayout`, which is already relative to ITS PARENT (the sheet) — so
  // it already includes SHEET_CONTENT_INSET (the handle + paddingTop the
  // KAV sits below). `keyboardVerticalOffset` only needs to supply the
  // piece `onLayout` can't see: where that parent itself sits on the real
  // screen. Adding SHEET_CONTENT_INSET here too would double-count it and
  // overpad the gap above the keyboard by that same amount.
  const sheetTopOffset = Math.max(0, windowHeight - sheetHeight);
  const contentWithOffset =
    state === "content" && isValidElement(children)
      ? cloneElement(
          children as React.ReactElement<{ sheetTopOffset?: number }>,
          { sheetTopOffset },
        )
      : children;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      // Android hardware back fires onRequestClose regardless of whether one
      // is passed — omitting it left Android's back button free to dismiss
      // the modal at the OS level while React state still thought it was
      // open, breaking the "finish the pass you started" lock this sheet is
      // built around. Only the `content` state is actually meant to be
      // that non-dismissible session lock, though (it has Skip as its own
      // escape hatch) — `loading` renders a bare spinner with no affordance
      // at all, so making back inert there too turned an unlucky hung
      // fetch (nothing here has a request timeout) into a screen with
      // truly no way out short of force-quitting. `empty` already has an
      // explicit exit ("Got it"); wiring the same onClose here just gives
      // back the identical result instead of silently doing nothing.
      onRequestClose={state === "content" ? () => {} : onClose}
    >
      {/* Non-dismissible blur backdrop */}
      <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.sheetWrapper}>
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[
            styles.sheet,
            sheetColumn,
            {
              paddingBottom: Math.max(24, insets.bottom + 16),
              height: sheetHeight,
            },
          ]}
        >
          {/* Drag handle — decorative only; the sheet doesn't actually
              dismiss on swipe (no dismiss gesture wired to this handle). */}
          <View style={styles.handle} />

          {state === "loading" ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.ink} />
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
            contentWithOffset
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
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    ...Platform.select({
      ios: {
        shadowColor: Colors.ink,
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
    borderRadius: 999,
    backgroundColor: Colors.ink,
  },
  emptyDismissBtnText: {
    color: Colors.paper,
    fontSize: 14,
    fontWeight: "700",
  },
});
