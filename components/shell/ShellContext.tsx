// ShellContext — the contract between the (tabs) layout (which owns the app
// shell: top bar, floating tab bar, overlays, push routing) and the five tab
// route screens. This replaces MainApp's prop-drilling: routes are rendered
// by expo-router now, so cross-tab handoffs (e.g. "open Messages focused on
// this job's thread") travel through this context instead of props.

import type { PublicProfileUserData } from "@/types/profiles";
import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export type UserType = "applicant" | "sponsor";

export interface ShellContextValue {
  userType: UserType;

  /** Hinge-style scroll-aware chrome — HomeView writes these from its main
   * scroll handler; the floating tab bar and HomeView's header read them.
   * 0 = visible; larger values translate the chrome off-screen. */
  navTranslateY: SharedValue<number>;
  headerTranslateY: SharedValue<number>;

  /** MessagesView reports when a thread is open so the tab bar hides. */
  setThreadActive: (active: boolean) => void;

  /** Navigate to Messages and focus the thread for a job (and optionally a
   * specific counterpart user, disambiguating multi-applicant jobs). */
  navigateToMessages: (jobId: string, userId?: string) => void;

  /** Contextual push-permission trigger (first match / first message). */
  requestPushPermission: () => void;

  /** Open the referral check-in sheet for the current role. */
  openCheckIn: () => void;

  /** Show the full-screen public-profile overlay above the current tab. */
  showPublicProfile: (userData: PublicProfileUserData) => void;

  // ── Messages deep-link plumbing ────────────────────────────────────────
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  pendingMessageJobId: string | null;
  pendingMessageUserId: string | null;
  consumePendingJob: () => void;
  pendingMessageConversationId: string | null;
  consumePendingConversation: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error(
      "useShell must be used inside the (tabs) layout's ShellContext provider",
    );
  }
  return ctx;
}
