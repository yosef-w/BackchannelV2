import { Text } from "@/components/design";
import { tokens } from "@/constants/theme";
import { CheckCircle, Info, XCircle } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useToastStore } from "../../stores/useToastStore";

const ICON_SIZE = 16;

// How long the fade-out takes (ms) — keep mounted this long after hide
const EXIT_ANIMATION_MS = 300;
const AUTO_DISMISS_MS = 3500;

type Variant = "success" | "error" | "info" | string;

function toneColor(variant: Variant): string {
  if (variant === "success") return tokens.colors.successFg;
  if (variant === "error") return tokens.colors.dangerFg;
  return tokens.colors.infoFg;
}

function ToastIcon({ variant }: { variant: Variant }) {
  const color = toneColor(variant);
  if (variant === "success")
    return <CheckCircle size={ICON_SIZE} color={color} strokeWidth={2} />;
  if (variant === "error")
    return <XCircle size={ICON_SIZE} color={color} strokeWidth={2} />;
  return <Info size={ICON_SIZE} color={color} strokeWidth={2} />;
}

/**
 * Toast banner — paper-on-hairline editorial style. The leading icon is the
 * only colour the toast carries; everything else stays neutral so it doesn't
 * compete with the page below.
 */
export function AppToast() {
  const { visible, message, variant, hideToast } = useToastStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, [visible, message, hideToast]);

  if (!shouldRender) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutUp.duration(220)}
      style={styles.container}
      pointerEvents="box-none"
    >
      <View style={styles.iconWrap}>
        <ToastIcon variant={variant} />
      </View>
      <Text variant="bodySmall" style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={hideToast}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.dismissBtn}
      >
        <Text variant="eyebrow" color={tokens.colors.textMuted}>
          Dismiss
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: tokens.layout.screenPaddingH,
    right: tokens.layout.screenPaddingH,
    zIndex: 9999,
    backgroundColor: tokens.colors.bg,
    borderRadius: tokens.radii.m,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.m,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    color: tokens.colors.text,
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});
