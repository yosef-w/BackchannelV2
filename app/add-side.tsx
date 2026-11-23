import { Redirect } from "expo-router";
import React from "react";
import { AddSideScreen } from "@/components/sides/AddSideScreen";
import { DUAL_SIDES_ENABLED, DUAL_SIDES_PREVIEW } from "@/constants/config";
import { useSideSwitchStore } from "@/lib/switchSide";
import { addableRole } from "@/lib/sides";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * A sponsor adds a job search (docs/DUAL_SIDES.md) — pushed over the (tabs)
 * shell from the Account tab. Anyone else (an applicant, or a sponsor who
 * already has one) is sent back: lib/sides addableRole decides.
 */
export default function AddSideRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const roles = useAuthStore((s) => s.roles);
  const supported = useSideSwitchStore((s) => s.serverSupportsSides);
  const side = addableRole(roles);
  const canAdd = DUAL_SIDES_ENABLED && (supported || DUAL_SIDES_PREVIEW);

  if (!isAuthenticated) return <Redirect href="/splash" />;
  if (!canAdd || !side) return <Redirect href="/(tabs)/profile" />;
  return <AddSideScreen side={side} />;
}
