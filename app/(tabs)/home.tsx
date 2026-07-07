import { HomeView } from "@/components/HomeView";
import { useShell } from "@/components/shell/ShellContext";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import React from "react";

export default function HomeTab() {
  const router = useRouter();
  const shell = useShell();
  // Unmount on blur — matches MainApp's conditional-render semantics: the
  // view refetches on every visit, and deck position survives via
  // useJobsStore (which is exactly why it lives there).
  const isFocused = useIsFocused();
  if (!isFocused) return null;

  return (
    <HomeView
      userType={shell.userType}
      onNavigateToProfile={() => router.navigate("/(tabs)/profile")}
      navTranslateY={shell.navTranslateY}
      headerTranslateY={shell.headerTranslateY}
      onNavigateToMessages={shell.navigateToMessages}
      onMatchCreated={shell.requestPushPermission}
    />
  );
}
