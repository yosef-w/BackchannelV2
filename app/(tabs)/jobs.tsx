import { ApplicantJobsBrowseView } from "@/components/ApplicantJobsBrowseView";
import { JobsView } from "@/components/JobsView";
import { useShell } from "@/components/shell/ShellContext";
import { useIsFocused } from "@react-navigation/native";
import React from "react";

export default function JobsTab() {
  const shell = useShell();
  const isFocused = useIsFocused();

  // Unmount on blur — matches MainApp's conditional-render semantics.
  if (!isFocused) return null;

  // Sponsors manage their listings; applicants get a read-only browse +
  // search with the existing waitlist/request-sponsor actions — a way past
  // the daily deck's scarcity without touching its connect economy.
  return shell.userType === "sponsor" ? (
    <JobsView />
  ) : (
    <ApplicantJobsBrowseView />
  );
}
