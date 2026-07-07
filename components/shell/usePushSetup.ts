// usePushSetup — device push registration + the unfinished-deck local
// reminder, extracted verbatim from MainApp. Push *tap routing* lives in the
// (tabs) layout because it needs the router and shell setters.

import { registerDevice } from "@/lib/api";
import {
  cancelUnfinishedDeckReminder,
  scheduleDailyDeckReminder,
  scheduleUnfinishedDeckReminder,
} from "@/lib/localNotifications";
import { useAuthStore } from "@/stores/useAuthStore";
import { useJobsStore } from "@/stores/useJobsStore";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { DECK_SIZE } from "../HomeView";
import type { UserType } from "./ShellContext";

export function usePushSetup(userType: UserType) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setDeviceToken = useAuthStore((state) => state.setDeviceToken);

  // Bumped by requestPushPermission() to trigger a fresh attempt at the
  // native permission dialog. Starts at 0 so the effect below runs once on
  // mount too — but that initial run only ever *checks* status and silently
  // registers a device that's already granted; it never cold-asks. The
  // actual OS prompt only fires once this has been bumped by a contextual
  // moment (first match, first message sent).
  const [pushPromptTrigger, setPushPromptTrigger] = useState(0);
  const requestPushPermission = useCallback(() => {
    setPushPromptTrigger((n) => n + 1);
  }, []);

  /**
   * Register the device for push notifications whenever the user is
   * authenticated, re-running whenever requestPushPermission() is called.
   *
   * - Silently registers an already-granted permission on every run (cheap,
   *   idempotent on the backend).
   * - Only shows the native OS permission dialog when explicitly triggered
   *   via pushPromptTrigger — asking on first mount, before the user has any
   *   reason to say yes, is the most common way an app burns its one shot at
   *   push permission on iOS (a decline is effectively permanent).
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    const registerPushToken = async () => {
      try {
        // Android requires an explicit notification channel.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#000000",
          });
        }

        const { status: current } = await Notifications.getPermissionsAsync();
        let finalStatus = current;
        if (current === "undetermined") {
          // Never asked before — only show the native dialog once a
          // contextual trigger has fired.
          if (pushPromptTrigger === 0) {
            console.log(
              "[Shell] Deferring push permission prompt until a contextual trigger fires",
            );
            return;
          }
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        } else if (current !== "granted") {
          // Previously denied — the OS won't re-prompt anyway.
          console.log("[Shell] Push notification permission previously denied");
          return;
        }
        if (finalStatus !== "granted") {
          console.log("[Shell] Push notification permission not granted");
          return;
        }

        // projectId is required by Expo SDK ≥50 for getExpoPushTokenAsync.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as
          | string
          | undefined;
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!active) return;

        const platform: "ios" | "android" | "expo" =
          Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
              ? "android"
              : "expo";

        await registerDevice(token, platform);
        setDeviceToken(token);
        console.log("[Shell] Push token registered:", token);

        // Permission is confirmed granted at this point — schedule the daily
        // "your deck is ready" local reminder. Idempotent.
        scheduleDailyDeckReminder(userType);
      } catch (err) {
        // Non-fatal — the app works without push notifications.
        console.warn("[Shell] Failed to register push token:", err);
      }
    };

    registerPushToken();
    return () => {
      active = false;
    };
  }, [isAuthenticated, setDeviceToken, pushPromptTrigger, userType]);

  // ── Unfinished-deck local reminder ──────────────────────────────────────
  // When the app backgrounds with cards still left in today's deck, schedule
  // a one-time local nudge for later. Cancel it the moment the app comes
  // back to the foreground.
  useEffect(() => {
    if (!isAuthenticated) return;

    const onAppStateChange = (state: string) => {
      if (state === "background" || state === "inactive") {
        const jobsState = useJobsStore.getState();
        const hasDeck =
          userType === "sponsor"
            ? jobsState.sponsoredJobs.length > 0
            : jobsState.jobs.length > 0;
        if (!hasDeck) return;
        const remaining = DECK_SIZE - jobsState.progress + 1;
        if (remaining > 0) {
          scheduleUnfinishedDeckReminder(remaining, userType);
        }
      } else if (state === "active") {
        cancelUnfinishedDeckReminder();
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, [isAuthenticated, userType]);

  return { requestPushPermission };
}
