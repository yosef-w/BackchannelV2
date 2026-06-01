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
import { Color, Radius, Type } from "@/constants/theme";

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
            <ChevronLeft color="#000" size={28} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            {userData.image ? (
              <Image source={{ uri: userData.image }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: "#000",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text
                  style={{ fontSize: 36, fontWeight: "800", color: "#FFF" }}
                >
                  {(userData.name || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{userData.name}</Text>

          <View style={styles.infoRow}>
            <Briefcase color="#000" size={14} strokeWidth={2} />
            <Text style={styles.infoText}>
              {userData.role}
              {userData.company && ` @ ${userData.company}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin color="#BBB" size={14} strokeWidth={2} />
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
                  <Target size={14} color="#FFF" strokeWidth={2.5} />
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
    backgroundColor: Color.offWhite,
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
    marginBottom: 18,
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Color.surface,
  },
  name: {
    fontFamily: Type.sans400,
    fontSize: 30,
    color: Color.ink,
    letterSpacing: -0.7,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontFamily: Type.sans500,
    fontSize: 14,
    color: Color.body,
  },
  locationText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.muted,
  },
  bio: {
    fontFamily: Type.sans300,
    fontSize: 15,
    color: Color.body,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 16,
    paddingHorizontal: 10,
    maxWidth: 380,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: Color.paper,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Color.border,
  },
  whiteBtnText: {
    fontFamily: Type.sans500,
    color: Color.ink,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.xl,
    padding: 22,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: Type.sans600,
    fontSize: 22,
    color: Color.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: Type.sans500,
    fontSize: 10,
    color: Color.muted,
    marginTop: 4,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: Type.sans500,
    fontSize: 11,
    color: Color.muted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.paper,
    borderWidth: 1,
    borderColor: Color.border,
  },
  tagText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.ink,
    letterSpacing: -0.1,
  },
  preferenceTag: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
  },
  preferenceText: {
    fontFamily: Type.sans500,
    fontSize: 13,
    color: Color.body,
    letterSpacing: -0.1,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Color.ink,
  },
  roleTagText: {
    fontFamily: Type.sans500,
    fontSize: 12,
    color: Color.paper,
    letterSpacing: -0.1,
  },
});
