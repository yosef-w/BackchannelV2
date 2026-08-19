import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Renders a company logo. Prefers the backend-provided URL (from PR #62's
 * Logo.dev pipeline — `LOGO_URL` on sponsored job responses,
 * `ORGANIZATION_LOGO` / `organization_logo` on ATS responses). Falls back to
 * a colored circle showing the first letter of the company name when no
 * usable URL is available OR when the image fails to load.
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
  /** Background color of the fallback tile. Defaults to "#000". */
  backgroundColor?: string;
  /** Text color of the fallback initial. Defaults to "#FFF". */
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

export function CompanyLogo({
  logoUrl,
  name,
  size,
  borderRadius,
  backgroundColor = "#000",
  textColor = "#FFF",
  initialFontSize,
  style,
  resizeMode = "contain",
}: CompanyLogoProps) {
  const trimmedUrl = (logoUrl || "").trim();
  // Backend has been seen to ship Unsplash placeholder URLs as a legacy
  // fallback on a couple of code paths. Those aren't real company logos, so
  // treat them as "missing" and render the initial instead.
  const usableUrl =
    trimmedUrl && !trimmedUrl.includes("images.unsplash.com")
      ? trimmedUrl
      : "";

  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state when the URL changes (e.g. card recycled in a list).
  useEffect(() => {
    setImgFailed(false);
  }, [usableUrl]);

  const radius = borderRadius ?? Math.round(size * 0.32);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImage = !!usableUrl && !imgFailed;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: showImage ? Colors.surface : backgroundColor,
  };

  return (
    <View style={[containerStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri: usableUrl }}
          style={{ width: size, height: size }}
          contentFit={resizeMode}
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            {
              color: textColor,
              fontSize: initialFontSize ?? Math.max(12, Math.round(size * 0.45)),
            },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: {
    fontWeight: "800",
  },
});
