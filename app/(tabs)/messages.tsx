import { MessagesView } from "@/components/MessagesView";
import { useShell } from "@/components/shell/ShellContext";
import { useIsFocused } from "@react-navigation/native";
import React from "react";

export default function MessagesTab() {
  const shell = useShell();
  // Unmount on blur — matches MainApp's conditional-render semantics. Note
  // the public-profile overlay does NOT blur this tab (it's an overlay in
  // the shell, not a navigation), so MessagesView stays mounted underneath
  // it — preserving the reanimated ghost-overlay fix from MainApp.
  const isFocused = useIsFocused();
  if (!isFocused) return null;

  return (
    <MessagesView
      userType={shell.userType}
      onThreadActiveChange={shell.setThreadActive}
      onShowPublicProfile={shell.showPublicProfile}
      selectedConversationId={shell.selectedConversationId}
      onConversationChange={shell.setSelectedConversationId}
      pendingJobId={shell.pendingMessageJobId}
      pendingUserId={shell.pendingMessageUserId}
      onPendingJobConsumed={shell.consumePendingJob}
      pendingConversationId={shell.pendingMessageConversationId}
      onPendingConversationConsumed={shell.consumePendingConversation}
      onFirstMessageSent={shell.requestPushPermission}
    />
  );
}
