import { CheckCircle, Info, XCircle } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useToastStore } from "@/stores/useToastStore";
import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";

const ICON_SIZE = 18;

// How long the fade-out takes (ms) — keep mounted this long after hide
const EXIT_ANIMATION_MS = 300;
const AUTO_DISMISS_MS = 3500;

// Swipe-up dismissal: either the finger travels this far up, or flicks
// with this velocity — matching the system-notification gesture users
// already know.
const SWIPE_DISMISS_DISTANCE = -32;
const SWIPE_DISMISS_VELOCITY = -600;

function ToastIcon({ variant }: { variant: string }) {
  if (variant === "success")
    return <CheckCircle size={ICON_SIZE} color="#FFF" strokeWidth={2.5} />;
  if (variant === "error")
    return <XCircle size={ICON_SIZE} color="#FFF" strokeWidth={2.5} />;
  return <Info size={ICON_SIZE} color="#FFF" strokeWidth={2.5} />;
}

export function AppToast() {
  const { visible, message, variant, hideToast } = useToastStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the Animated.View mounted long enough for the exit animation to finish.
  // If we return null immediately when visible→false, SlideOutDown never plays.
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      // Cancel any pending unmount from a previous dismiss
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setShouldRender(true);

      // Every toast lands physically as well as visually — success and
      // error get their system notification patterns, info a light tap.
      // Fired here (not at showToast call sites) so all 100+ callers get
      // it for free and no toast ever double-buzzes.
      if (variant === "success") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else if (variant === "error") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // Auto-dismiss after AUTO_DISMISS_MS
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        hideToast();
      }, AUTO_DISMISS_MS);
    } else {
      // Wait for exit animation to complete before unmounting
      exitTimerRef.current = setTimeout(() => {
        setShouldRender(false);
      }, EXIT_ANIMATION_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [visible, message, variant]);

  // ── Swipe-up to dismiss ─────────────────────────────────────────────
  // The card follows the finger upward (downward drags get heavy
  // resistance — the toast lives at the top, there's nowhere to go), and
  // a far-enough drag or a flick dismisses. Anything else springs back.
  const translateY = useSharedValue(0);
  useEffect(() => {
    if (visible) translateY.value = 0; // fresh toast — reset any old drag
  }, [visible, translateY]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value =
        event.translationY < 0
          ? event.translationY
          : event.translationY * 0.15;
    })
    .onEnd((event) => {
      if (
        event.translationY < SWIPE_DISMISS_DISTANCE ||
        event.velocityY < SWIPE_DISMISS_VELOCITY
      ) {
        // Carry the card off-screen in the direction of the swipe, then
        // let hideToast run the normal exit/unmount timing.
        translateY.value = withTiming(-160, { duration: 180 });
        runOnJS(hideToast)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!shouldRender) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInDown.duration(300)}
        exiting={FadeOutUp.duration(250)}
        style={[styles.container, dragStyle]}
      >
        <ToastIcon variant={variant} />
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={hideToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.dismissBtn}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: Colors.ink,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 9999,
  },
  message: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
