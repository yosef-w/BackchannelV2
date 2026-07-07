import { ProfileView } from "@/components/ProfileView";
import { useShell } from "@/components/shell/ShellContext";
import { useIsFocused } from "@react-navigation/native";
import React from "react";

export default function ProfileTab() {
  const shell = useShell();
  // Unmount on blur — matches MainApp's conditional-render semantics.
  const isFocused = useIsFocused();
  if (!isFocused) return null;

  return <ProfileView userType={shell.userType} />;
}
