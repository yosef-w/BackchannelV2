import React from "react";
import { ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";
import { InitialTile } from "./InitialTile";

/**
 * Renders a company logo. Prefers the backend-provided URL (from PR #62's
 * Logo.dev pipeline — `LOGO_URL` on sponsored job responses,
 * `ORGANIZATION_LOGO` / `organization_logo` on ATS responses). Falls back to
 * a colored circle showing the first letter of the company name when no
 * usable URL is available OR when the image fails to load. A variant
 * wrapper around the shared InitialTile implementation (see Avatar, its
 * person-tile counterpart).
 *
 * Usage:
 *   <CompanyLogo
 *     logoUrl={job.LOGO_URL ?? job.ORGANIZATION_LOGO}
 *     name={job.company}
 *     size={44}
 *     borderRadius={14}
 *   />
 */
export interface CompanyLogoProps {
  /**
   * Backend logo URL. Accepts string, null, or undefined for ergonomic
   * pass-through from API responses where the field may be missing.
   * Empty strings are treated as missing.
   */
  logoUrl?: string | null;
  /** Company / organization name. The first character becomes the fallback initial. */
  name?: string | null;
  /** Square edge length in pixels. */
  size: number;
  /**
   * Corner radius. Defaults to ~32% of `size` (slight rounding, matching
   * the existing site styles like `borderRadius: 14` on a 44px tile).
   * Pass `size / 2` for a circle.
   */
  borderRadius?: number;
  /** Background color of the fallback tile. Defaults to Colors.ink. */
  backgroundColor?: string;
  /** Text color of the fallback initial. Defaults to Colors.paper. */
  textColor?: string;
  /**
   * Override the initial font size if the auto-derived value
   * (`size * 0.45`) isn't right for a specific layout.
   */
  initialFontSize?: number;
  /** Extra container style overrides — e.g. `marginBottom`. */
  style?: ViewStyle;
  /**
   * Image resize mode. Defaults to "contain" so logos sit inside the
   * tile rather than getting cropped. Use "cover" for hero imagery.
   */
  resizeMode?: "cover" | "contain";
}

// Backend has been seen to ship Unsplash placeholder URLs as a legacy
// fallback on a couple of code paths. Those aren't real company logos, so
// treat them as "missing" and render the initial instead.
function isPlaceholderUrl(url: string): boolean {
  return url.includes("images.unsplash.com");
}

export function CompanyLogo({
  logoUrl,
  name,
  size,
  borderRadius,
  backgroundColor = Colors.ink,
  textColor = Colors.paper,
  initialFontSize,
  style,
  resizeMode = "contain",
}: CompanyLogoProps) {
  return (
    <InitialTile
      imageUrl={logoUrl}
      name={name}
      size={size}
      borderRadius={borderRadius ?? Math.round(size * 0.32)}
      backgroundColor={backgroundColor}
      textColor={textColor}
      initialFontSize={initialFontSize ?? Math.max(12, Math.round(size * 0.45))}
      style={style}
      resizeMode={resizeMode}
      isPlaceholderUrl={isPlaceholderUrl}
    />
  );
}
