import React from "react";
import { ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";
import { InitialTile } from "./InitialTile";

/**
 * Renders a person's avatar photo, falling back to a black tile with their
 * first initial when there's no photo or it fails to load. Mirrors
 * CompanyLogo's API so the two can sit side by side in the same list
 * (e.g. Matches rows, which show either a person or a company as the
 * leading element depending on row type) without visually clashing —
 * both are variant wrappers around the shared InitialTile implementation.
 *
 * Usage:
 *   <Avatar photoUrl={applicant.image} name={applicant.name} size={52} />
 */
export interface AvatarProps {
  photoUrl?: string | null;
  /** Full name or first name — the first character becomes the fallback initial. */
  name?: string | null;
  /** Square edge length in pixels. */
  size: number;
  /** Corner radius. Defaults to ~30% of `size` (soft-square, matching the app's card language). Pass `size / 2` for a circle. */
  borderRadius?: number;
  backgroundColor?: string;
  textColor?: string;
  initialFontSize?: number;
  style?: ViewStyle;
}

export function Avatar({
  photoUrl,
  name,
  size,
  borderRadius,
  backgroundColor = Colors.ink,
  textColor = Colors.paper,
  initialFontSize,
  style,
}: AvatarProps) {
  return (
    <InitialTile
      imageUrl={photoUrl}
      name={name}
      size={size}
      borderRadius={borderRadius ?? Math.round(size * 0.3)}
      backgroundColor={backgroundColor}
      textColor={textColor}
      initialFontSize={initialFontSize ?? Math.round(size * 0.4)}
      style={style}
      resizeMode="cover"
    />
  );
}
