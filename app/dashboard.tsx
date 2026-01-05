import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { MainApp } from "../components/MainApp";

type UserType = "applicant" | "sponsor";

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const userType: UserType = useMemo(() => {
    return params.mode === "sponsor" ? "sponsor" : "applicant";
  }, [params.mode]);

  return (
    <MainApp
      userType={userType}
    />
  );
}
