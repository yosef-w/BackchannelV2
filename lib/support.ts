// Contact-support helper — one place that builds the support mailto so every
// "Contact us" entry point (Settings, the delete-account fallback, future
// in-flow help links) sends the same useful, pre-filled email.
//
// The diagnostic footer is the point: "it doesn't work" with no version, OS,
// or account is nearly impossible to act on. It's visible in the compose
// window and the user chooses whether to send it — nothing is transmitted
// automatically.

import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { SUPPORT_EMAIL } from "@/constants/config";

export type SupportTopic = "feedback" | "problem" | "account";

const SUBJECTS: Record<SupportTopic, string> = {
  feedback: "BackChannel feedback",
  problem: "BackChannel: something's not working",
  account: "BackChannel account help",
};

/** Pure builder (exported for tests). */
export function buildSupportMailto(opts: {
  topic?: SupportTopic;
  appVersion: string;
  os: string;
  osVersion: string | number;
  userId?: string | null;
}): string {
  const { topic = "feedback", appVersion, os, osVersion, userId } = opts;
  const footer = [
    "",
    "",
    "----------------",
    "Helps us find your account and reproduce issues:",
    `App version: ${appVersion}`,
    `Device: ${os} ${osVersion}`,
    userId ? `Account ID: ${userId}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return (
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(SUBJECTS[topic])}` +
    `&body=${encodeURIComponent(footer)}`
  );
}

/**
 * Open the user's mail app pre-filled. Resolves `false` if no mail client is
 * configured (common on fresh iPhones/simulators) so the caller can show the
 * plain address instead of failing silently.
 */
export async function contactSupport(
  topic: SupportTopic = "feedback",
  userId?: string | null,
): Promise<boolean> {
  const url = buildSupportMailto({
    topic,
    appVersion: Constants.expoConfig?.version ?? "unknown",
    os: Platform.OS === "ios" ? "iOS" : Platform.OS,
    osVersion: Platform.Version,
    userId,
  });
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
