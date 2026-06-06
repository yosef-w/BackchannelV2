import { Briefcase, ChevronLeft, MapPin, Target } from "lucide-react-native";
import React from "react";
import {
    Image,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { tokens } from "@/constants/theme";

interface ApplicantPublicProfileViewProps {
  userData: any;
  onClose: () => void;
}

export function ApplicantPublicProfileView({
  userData,
  onClose,
}: ApplicantPublicProfileViewProps) {
  // Mock stats - in a real app, these would come from userData
  const stats = [
    { label: "Connections", value: "42" },
    { label: "Referrals", value: "8" },
    { label: "Response", value: "98%" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <ChevronLeft color={tokens.colors.text} size={28} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            {userData.image ? (
              <Image source={{ uri: userData.image }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: tokens.colors.brand,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text
                  style={{ fontSize: 36, fontWeight: "800", color: tokens.colors.brandText }}
                >
                  {(userData.name || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{userData.name}</Text>

          <View style={styles.infoRow}>
            <Briefcase color={tokens.colors.text} size={14} strokeWidth={2} />
            <Text style={styles.infoText}>
              {userData.role}
              {userData.company && ` @ ${userData.company}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin color={tokens.colors.textFaint} size={14} strokeWidth={2} />
            <Text style={styles.locationText}>{userData.location}</Text>
          </View>

          <Text style={styles.bio}>{userData.bio}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Animated.View
              key={stat.label}
              entering={FadeInUp.delay(index * 100).duration(400)}
              style={styles.statBox}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Skills & Interests */}
        {userData.skills && userData.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SKILLS & INTERESTS</Text>
            <View style={styles.tagCloud}>
              {userData.skills.map((skill: string, idx: number) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Work Preferences */}
        {userData.workPreferences && userData.workPreferences.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WORK PREFERENCES</Text>
            <View style={styles.tagCloud}>
              {userData.workPreferences.map((pref: string, idx: number) => (
                <View key={idx} style={styles.preferenceTag}>
                  <Text style={styles.preferenceText}>{pref}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Desired Roles */}
        {userData.desiredRoles && userData.desiredRoles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESIRED ROLES</Text>
            <View style={styles.tagCloud}>
              {userData.desiredRoles.map((role: string, idx: number) => (
                <View key={idx} style={styles.roleTag}>
                  <Target size={14} color={tokens.colors.brandText} strokeWidth={2.5} />
                  <Text style={styles.roleTagText}>{role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    ...Platform.select({
      android: {
        paddingTop: StatusBar.currentHeight,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 140,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 0,
    padding: 4,
    zIndex: 10,
  },
  avatarWrapper: {
    marginBottom: 20,
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: tokens.colors.bgOffWhite,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  locationText: {
    fontSize: 14,
    color: tokens.colors.textFaint,
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  whiteBtnText: {
    color: tokens.colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.textFaint,
    marginTop: 4,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.colors.textFaint,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  preferenceTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand,
  },
  roleTagText: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.brandText,
  },
});
