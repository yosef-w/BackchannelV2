import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Shared image-with-initial-fallback tile — the implementation behind both
 * `Avatar` (people) and `CompanyLogo` (companies). Those two components
 * used to be independent, ~90%-identical copies of this same logic (audit
 * flagged them as a fork that would keep drifting); they're now thin
 * variant wrappers around this one implementation. Don't import this
 * directly from feature code — use `Avatar`/`CompanyLogo`, which pick the
 * right per-variant defaults (corner radius fraction, initial size
 * fraction, resize mode, placeholder-URL filtering).
 */
export interface InitialTileProps {
  imageUrl?: string | null;
  /** Full/first name or company name — the first character becomes the fallback initial. */
  name?: string | null;
  /** Square edge length in pixels. */
  size: number;
  /** Corner radius. Pass `size / 2` for a circle. */
  borderRadius: number;
  backgroundColor?: string;
  textColor?: string;
  initialFontSize: number;
  style?: ViewStyle;
  resizeMode: "cover" | "contain";
  /** Treat this URL as missing (renders the initial instead). Used by the
   * company variant to filter legacy Unsplash placeholder URLs. */
  isPlaceholderUrl?: (url: string) => boolean;
}

export function InitialTile({
  imageUrl,
  name,
  size,
  borderRadius,
  backgroundColor = Colors.ink,
  textColor = Colors.paper,
  initialFontSize,
  style,
  resizeMode,
  isPlaceholderUrl,
}: InitialTileProps) {
  const trimmedUrl = (imageUrl || "").trim();
  const usableUrl =
    trimmedUrl && !isPlaceholderUrl?.(trimmedUrl) ? trimmedUrl : "";

  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state when the URL changes (e.g. card recycled in a list).
  useEffect(() => {
    setImgFailed(false);
  }, [usableUrl]);

  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImage = !!usableUrl && !imgFailed;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
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
        <Text style={[styles.initial, { fontSize: initialFontSize, color: textColor }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { fontWeight: "800" },
});
