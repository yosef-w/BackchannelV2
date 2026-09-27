// AppConfigGate — the full-screen blocker for the two "stop, don't use the
// app right now" states the server can declare (see lib/appConfig.ts):
//   1. update required — this build is older than the server's min_version
//   2. maintenance     — the server wants a message shown instead of the app
//
// Renders NOTHING in the normal case (the overwhelmingly common one), and
// the underlying config is fail-open, so a broken/missing endpoint can't
// trip this. It's an absolute overlay rather than a route so it covers
// every screen — including auth and onboarding — without per-screen wiring.

import React, { useEffect } from "react";
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { APP_STORE_URL } from "@/constants/config";
import { Colors, Fonts } from "@/constants/theme";
import { getCurrentVersion, isUpdateRequired } from "@/lib/appConfig";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { useAppConfigStore } from "@/stores/useAppConfigStore";

export function AppConfigGate() {
  const config = useAppConfigStore((s) => s.config);
  const refresh = useAppConfigStore((s) => s.refresh);

  // Check at boot and every time the app returns to the foreground (the
  // store throttles, so this can't become request spam).
  useEffect(() => {
    refresh().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const needsUpdate = isUpdateRequired(getCurrentVersion(), config.minVersion);
  const maintenance = config.maintenanceMessage;
  if (!needsUpdate && !maintenance) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>
          {needsUpdate ? "UPDATE REQUIRED" : "BACK SOON"}
        </Text>
        <Text style={styles.title}>
          {needsUpdate
            ? "Time for a new version."
            : "We're making things better."}
        </Text>
        <Text style={styles.body}>
          {needsUpdate
            ? "This version of BackChannel is out of date and can no longer connect. Update from the App Store to keep going. Your account and matches are safe."
            : maintenance}
        </Text>
        {needsUpdate && (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => openExternalUrl(APP_STORE_URL)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Update BackChannel in the App Store"
          >
            <Text style={styles.ctaText}>Update in the App Store</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    // Above everything, including toasts and the offline banner.
    zIndex: 1000,
  },
  card: { width: "100%", maxWidth: 420, alignItems: "center" },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.muted,
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.body,
    textAlign: "center",
    marginBottom: 28,
  },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15.5,
    color: Colors.paper,
  },
});
