import { router } from "expo-router";
import React from "react";
import { SplashScreen } from "../components/SplashScreen";

export default function SplashRoute() {
  return (
    <SplashScreen
      onGetStarted={() => router.replace("/choose-role" as any)}
    //   autoAdvanceDelay={0}
    />
  );
}
