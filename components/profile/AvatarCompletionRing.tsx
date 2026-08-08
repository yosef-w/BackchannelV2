import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Colors } from "@/constants/theme";

interface AvatarCompletionRingProps {
  /** Diameter of the avatar this ring wraps. */
  size: number;
  /** 0-100. Ring is hidden entirely at 100 — a finished profile doesn't need coaching chrome. */
  percentage: number;
  strokeWidth?: number;
  children: React.ReactNode;
}

/**
 * Progress ring around the profile avatar, showing profileCompletion's
 * percentage at a glance — the same "your profile strength" signal LinkedIn
 * and dating apps put right on the avatar instead of burying it in a
 * settings row. Disappears once complete so a finished profile isn't
 * decorated with a percentage nobody needs anymore.
 */
export function AvatarCompletionRing({
  size,
  percentage,
  strokeWidth = 4,
  children,
}: AvatarCompletionRingProps) {
  const padding = strokeWidth + 3;
  const svgSize = size + padding * 2;
  const radius = svgSize / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: svgSize, height: svgSize }}>
      {clamped < 100 && (
        <Svg
          width={svgSize}
          height={svgSize}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke={Colors.surface}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="#000"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            // Start the fill at 12 o'clock instead of 3 o'clock.
            rotation={-90}
            origin={`${svgSize / 2}, ${svgSize / 2}`}
          />
        </Svg>
      )}
      <View
        style={{
          position: "absolute",
          top: padding,
          left: padding,
          width: size,
          height: size,
        }}
      >
        {children}
      </View>
    </View>
  );
}
