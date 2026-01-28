import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Briefcase, ChevronLeft, MapPin } from "lucide-react-native";
import React from "react";
import {
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface SponsorPublicProfileViewProps {
  userData: any;
  onClose: () => void;
}

export function SponsorPublicProfileView({
  userData,
  onClose,
}: SponsorPublicProfileViewProps) {
  // Mock stats - in a real app, these would come from userData
  const stats = [
    { label: "Network", value: "24" },
    { label: "Referrals", value: "15" },
    { label: "Success", value: "87%" },
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
            <Image source={{ uri: userData.image }} style={styles.avatar} />
          </View>

          <Text style={styles.name}>{userData.name}</Text>

          <View style={styles.infoRow}>
            <Briefcase color="#000" size={14} strokeWidth={2} />
            <Text style={styles.infoText}>
              {userData.role} @ {userData.company}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin color="#BBB" size={14} strokeWidth={2} />
            <Text style={styles.locationText}>{userData.location}</Text>
          </View>

          <Text style={styles.bio}>{userData.bio}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.whiteBtn}>
              <FontAwesome name="linkedin-square" size={20} color="#000" />
              <Text style={styles.whiteBtnText}>LinkedIn</Text>
            </TouchableOpacity>
          </View>
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
            <Text style={styles.sectionTitle}>Skills & Interests</Text>
            <View style={styles.tagCloud}>
              {userData.skills.map((skill: string) => (
                <View key={skill} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Companies I Can Refer To */}
        {userData.companiesCanReferTo &&
          userData.companiesCanReferTo.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Companies I Can Refer To</Text>
              <View style={styles.tagCloud}>
                {userData.companiesCanReferTo.map((company: string) => (
                  <View key={company} style={styles.companyTag}>
                    <Text style={styles.companyText}>{company}</Text>
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
    backgroundColor: "#FFF",
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
    backgroundColor: "#F9F9F9",
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
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
    color: "#000",
  },
  locationText: {
    fontSize: 14,
    color: "#BBB",
    fontWeight: "500",
  },
  bio: {
    fontSize: 15,
    color: "#666",
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
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#EEE",
  },
  whiteBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#F9F9F9",
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
    color: "#000",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#BBB",
    marginTop: 4,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#BBB",
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
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#EEE",
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  companyTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
  },
  companyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
});
