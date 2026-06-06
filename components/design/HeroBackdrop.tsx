import { tokens } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

export interface HeroBackdropProps {
  /** Tint of the orbs. Defaults to a near-transparent ink that reads as a
   *  soft warm shadow against paper. */
  tint?: string;
  /** Override the maximum orb opacity (0–1). Defaults to 0.05. */
  intensity?: number;
}

/**
 * Decorative background for hero screens (splash, auth, choose-role,
 * empty states). Renders two soft radial-gradient orbs behind the page
 * content — matches the site's `.bg-orb` overlay.
 *
 * Sits as an absolutely-positioned, non-interactive layer. Drop it as the
 * FIRST child inside a Screen and place content on top in normal flow.
 */
export function HeroBackdrop({
  tint = tokens.colors.text,
  intensity = 0.05,
}: HeroBackdropProps) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Upper centre orb */}
      <View style={[styles.orb, styles.orbTop]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="orbTop" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0%"
                stopColor={tint}
                stopOpacity={intensity * 1.2}
              />
              <Stop offset="70%" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#orbTop)" />
        </Svg>
      </View>

      {/* Lower right orb — slightly smaller, softer */}
      <View style={[styles.orb, styles.orbBottom]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="orbBottom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={tint} stopOpacity={intensity} />
              <Stop offset="70%" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#orbBottom)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
  },
  orbTop: {
    width: 480,
    height: 480,
    top: -120,
    left: "50%",
    marginLeft: -240,
  },
  orbBottom: {
    width: 360,
    height: 360,
    bottom: 80,
    right: -80,
  },
});
