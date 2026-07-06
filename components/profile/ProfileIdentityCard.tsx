import { Briefcase, Camera, Edit, Eye, MapPin } from "lucide-react-native";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AvatarCompletionRing } from "./AvatarCompletionRing";

interface ProfileIdentityCardProps {
  profileImage: string | null;
  initials: string | null;
  name: string;
  roleLine: string;
  location: string;
  bio: string;
  completionPercentage: number;
  personalMissingCount: number;
  onOpenImagePicker: () => void;
  onEditProfile: () => void;
  onPreview: () => void;
  previewLoading: boolean;
  photoMissing: boolean;
}

/**
 * The identity header for the Profile hub — avatar (with a completion ring
 * instead of a hidden percentage), name/role/location, a one-line bio
 * teaser, and the two entry actions. Everything below this card is now
 * management (Finish Your Profile / Profile / Settings groups) rather than
 * a second copy of the profile's content, which lives in Preview.
 */
export function ProfileIdentityCard({
  profileImage,
  initials,
  name,
  roleLine,
  location,
  bio,
  completionPercentage,
  personalMissingCount,
  onOpenImagePicker,
  onEditProfile,
  onPreview,
  previewLoading,
  photoMissing,
}: ProfileIdentityCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenImagePicker}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <AvatarCompletionRing size={104} percentage={completionPercentage}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                {initials ? (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera color="#999" size={28} strokeWidth={1.5} />
                  </View>
                )}
              </View>
            )}
          </AvatarCompletionRing>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editFab, photoMissing && styles.editFabHighlight]}
          onPress={onOpenImagePicker}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Edit color="#FFF" size={13} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{name}</Text>
      {completionPercentage < 100 && (
        <Text style={styles.completionText}>
          {completionPercentage}% complete
        </Text>
      )}

      <View style={styles.infoRow}>
        <Briefcase color="#000" size={14} strokeWidth={2} />
        <Text style={styles.infoText}>{roleLine}</Text>
      </View>

      <View style={styles.infoRow}>
        <MapPin color="#BBB" size={14} strokeWidth={2} />
        {location ? (
          <Text style={styles.locationText}>{location}</Text>
        ) : (
          <Text style={styles.emptyHint}>No location added yet</Text>
        )}
      </View>

      {!!bio && (
        <Text style={styles.bio} numberOfLines={2}>
          {bio}
        </Text>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.blackBtn} onPress={onEditProfile}>
          <Edit color="#FFF" size={16} />
          <Text style={styles.blackBtnText}>Edit Profile</Text>
          {personalMissingCount > 0 && (
            <View style={styles.buttonBadge}>
              <Text style={styles.buttonBadgeText}>{personalMissingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.whiteBtn} onPress={onPreview}>
          <Eye color="#000" size={16} />
          <Text style={styles.whiteBtnText}>
            {previewLoading ? "Loading…" : "Preview"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 28 },
  avatarWrapper: { marginBottom: 16, position: "relative" },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  editFab: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#000",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  editFabHighlight: { backgroundColor: "#000" },
  name: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
  },
  completionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    marginTop: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  infoText: { fontSize: 15, fontWeight: "600", color: "#000" },
  locationText: { fontSize: 14, color: "#BBB", fontWeight: "500" },
  emptyHint: {
    fontSize: 13,
    color: "#BBB",
    fontStyle: "italic",
  },
  bio: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 24,
  },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  blackBtn: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
  },
  blackBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  whiteBtnText: { color: "#000", fontSize: 14, fontWeight: "700" },
  buttonBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonBadgeText: { fontSize: 10, fontWeight: "800", color: "#000" },
});
