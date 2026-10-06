import { MatchesView } from "@/components/MatchesView";
import { useShell } from "@/components/shell/ShellContext";
import { useIsFocused } from "expo-router/react-navigation";
import React from "react";

export default function MatchesTab() {
  const shell = useShell();
  // Unmount on blur — matches MainApp's conditional-render semantics.
  const isFocused = useIsFocused();
  if (!isFocused) return null;

  return (
    <MatchesView
      userType={shell.userType}
      onNavigateToMessages={shell.navigateToMessages}
      onOpenCheckIn={shell.openCheckIn}
    />
  );
}
