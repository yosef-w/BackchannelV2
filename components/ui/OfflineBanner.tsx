// OfflineBanner — a slim, non-blocking strip that says so when the device
// has lost its connection, instead of leaving every failed request to fail
// in its own confusing way ("couldn't save", spinner forever, empty deck).
//
// It sits at the top under the status bar, below toasts, and never
// intercepts touches — the app stays fully usable (cached decks, drafts).
// See lib/network.ts for why "offline" is debounced and conservative.

import { WifiOff } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";
import { useIsOffline } from "@/lib/network";

export function OfflineBanner() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  if (!offline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.wrap, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <WifiOff size={14} color={Colors.paper} strokeWidth={2.4} />
        <Text style={styles.text}>
          You&apos;re offline. Some things won&apos;t load or save until
          you&apos;re back.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.ink,
    paddingBottom: 8,
    paddingHorizontal: 16,
    // Under AppToast (which is the transient, higher-signal message).
    zIndex: 90,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.paper,
    flexShrink: 1,
  },
});
