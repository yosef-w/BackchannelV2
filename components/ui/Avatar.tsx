import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";

/**
 * Renders a person's avatar photo, falling back to a black tile with their
 * first initial when there's no photo or it fails to load. Mirrors
 * CompanyLogo's API so the two can sit side by side in the same list
 * (e.g. Matches rows, which show either a person or a company as the
 * leading element depending on row type) without visually clashing.
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
  backgroundColor = "#000",
  textColor = "#FFF",
  initialFontSize,
  style,
}: AvatarProps) {
  const usableUrl = (photoUrl || "").trim();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [usableUrl]);

  const radius = borderRadius ?? Math.round(size * 0.3);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImage = !!usableUrl && !imgFailed;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: showImage ? "#F4F4F5" : backgroundColor,
  };

  return (
    <View style={[containerStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri: usableUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: initialFontSize ?? Math.round(size * 0.4), color: textColor },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { fontWeight: "800" },
});
