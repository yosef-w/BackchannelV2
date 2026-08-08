/**
 * /intro — the pre-signup "Product Cinema": an auto-playing scripted demo
 * of the product loop (deck → match → referral), shown between the splash
 * and role selection so a brand-new user learns what BackChannel IS before
 * being asked how they'll use it. Both Skip and the CTA continue the
 * funnel; iOS swipe-back returns to the splash (pushed, not replaced).
 */

import { router } from "expo-router";
import React from "react";
import { IntroCinema } from "../components/IntroCinema";

export default function IntroRoute() {
  return <IntroCinema onContinue={() => router.push("/choose-role")} />;
}
