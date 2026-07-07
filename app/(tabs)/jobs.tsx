import { JobsView } from "@/components/JobsView";
import { useShell } from "@/components/shell/ShellContext";
import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import React from "react";

export default function JobsTab() {
  const shell = useShell();
  const isFocused = useIsFocused();

  // Jobs is sponsor-only: the tab bar already hides it for applicants, but
  // the route itself must be unreachable too (deep links, typed navigation).
  if (shell.userType !== "sponsor") {
    return <Redirect href="/(tabs)/home" />;
  }

  // Unmount on blur — matches MainApp's conditional-render semantics.
  if (!isFocused) return null;

  return <JobsView />;
}
