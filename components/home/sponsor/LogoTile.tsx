// LogoTile — a company mark on a white tile with breathing room, the way
// the Figma frames the hiring company (role row, connector). Logo.dev
// marks arrive edge-to-edge, so a raw CompanyLogo at tile size crowds its
// border; this insets the mark to ~70% of the tile. With no logo it falls
// back to CompanyLogo's initial tile at full size (an inset initial would
// just look small).

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Colors } from "@/constants/theme";

interface LogoTileProps {
  logoUrl: string | null;
  name: string;
  size: number;
  borderRadius: number;
  style?: ViewStyle;
}

export function LogoTile({ logoUrl, name, size, borderRadius, style }: LogoTileProps) {
  if (!logoUrl) {
    return (
      <CompanyLogo
        logoUrl={null}
        name={name}
        size={size}
        borderRadius={borderRadius}
        backgroundColor={Colors.surface}
        textColor={Colors.ink}
        style={style}
      />
    );
  }
  const inner = Math.round(size * 0.7);
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius },
        style,
      ]}
    >
      <CompanyLogo
        logoUrl={logoUrl}
        name={name}
        size={inner}
        borderRadius={0}
        backgroundColor={Colors.paper}
        textColor={Colors.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
