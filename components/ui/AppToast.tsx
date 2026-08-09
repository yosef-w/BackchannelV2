import { CheckCircle, Info, XCircle } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useToastStore } from "@/stores/useToastStore";
import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";

const ICON_SIZE = 18;

// How long the fade-out takes (ms) — keep mounted this long after hide
const EXIT_ANIMATION_MS = 300;
const AUTO_DISMISS_MS = 3500;

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

  if (!shouldRender) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(250)}
      style={styles.container}
      pointerEvents="box-none"
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
