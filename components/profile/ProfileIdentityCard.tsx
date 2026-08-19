import { Camera, Edit } from "@/components/ui/icons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

interface ProfileIdentityCardProps {
  profileImage: string | null;
  initials: string | null;
  name: string;
  roleLine: string;
  location: string;
  onOpenImagePicker: () => void;
  photoMissing: boolean;
}

/**
 * The identity header for the Profile hub — 2026-08 "Two Faces" rebrand.
 * A dossier ID block matching the deck cards: modest square photo beside
 * the serif name and role · location sub-line. The circular completion
 * ring retired with this redesign — completion now reads as the STRENGTH
 * row in ProfileView's ledger, and the old bio teaser / Edit Profile
 * button live behind the ledger + Personal details row instead.
 */
export function ProfileIdentityCard({
  profileImage,
  initials,
  name,
  roleLine,
  location,
  onOpenImagePicker,
  photoMissing,
}: ProfileIdentityCardProps) {
  const subLine = [roleLine, location].filter(Boolean).join(" · ");
  return (
    <View style={styles.container}>
      <View style={styles.photoWrapper}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenImagePicker}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              {initials ? (
                <Text style={styles.photoInitials}>{initials}</Text>
              ) : (
                <Camera color={Colors.muted} size={26} strokeWidth={1.5} />
              )}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editFab, photoMissing && styles.editFabHighlight]}
          onPress={onOpenImagePicker}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <Edit color="#FFF" size={12} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.idText}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {!!subLine && (
          <Text style={styles.subLine} numberOfLines={2}>
            {subLine}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
  },
  photoWrapper: { position: "relative" },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  photoFallback: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitials: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    color: Colors.muted,
  },
  editFab: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.ink,
    borderWidth: 2,
    borderColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  editFabHighlight: {
    borderColor: Colors.borderStrong,
  },
  idText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 29,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  subLine: {
    fontSize: 13.5,
    fontWeight: "500",
    color: Colors.body,
    lineHeight: 19,
    marginTop: 5,
  },
});
