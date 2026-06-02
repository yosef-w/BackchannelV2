import { CheckCircle, Info, XCircle } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useToastStore } from "../../stores/useToastStore";
import { Color, Radius, Type } from "@/constants/theme";

const ICON_SIZE = 18;

// How long the fade-out takes (ms) — keep mounted this long after hide
const EXIT_ANIMATION_MS = 300;
const AUTO_DISMISS_MS = 3500;

function ToastIcon({ variant }: { variant: string }) {
  if (variant === "success")
    return <CheckCircle size={ICON_SIZE} color={Color.paper} strokeWidth={2} />;
  if (variant === "error")
    return <XCircle size={ICON_SIZE} color={Color.paper} strokeWidth={2} />;
  return <Info size={ICON_SIZE} color={Color.paper} strokeWidth={2} />;
}

export function AppToast() {
  const { visible, message, variant, hideToast } = useToastStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the Animated.View mounted long enough for the exit animation to finish.
  // If we return null immediately when visible→false, FadeOutUp never plays.
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setShouldRender(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        hideToast();
      }, AUTO_DISMISS_MS);
    } else {
      exitTimerRef.current = setTimeout(() => {
        setShouldRender(false);
      }, EXIT_ANIMATION_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [visible, message]);

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
    backgroundColor: Color.ink,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 9999,
  },
  message: {
    flex: 1,
    fontFamily: Type.sans500,
    color: Color.paper,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    fontFamily: Type.sans500,
    color: "rgba(255,255,255,0.42)",
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
});
