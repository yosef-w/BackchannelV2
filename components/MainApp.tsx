import * as Haptics from "expo-haptics";
import { Bell, Briefcase, Home, MessageCircle, Star, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import { HomeView } from "./HomeView";
import { JobsView } from "./JobsView";
import { MatchesView } from "./MatchesView";
import { MessagesView } from "./MessagesView";
import { NotificationsView } from "./NotificationsView";
import { ProfileView } from "./ProfileView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MainAppProps {
  userType: "applicant" | "sponsor";
}

type ViewType = "home" | "matches" | "messages" | "jobs" | "profile" | "notifications";

const navItems = [
  { id: "home", icon: Home, label: "Feed" },
  { id: "matches", icon: Star, label: "Matches" },
    { id: "jobs", icon: Briefcase, label: "Jobs", sponsorOnly: true },
  { id: "messages", icon: MessageCircle, label: "Inbox" },
  { id: "profile", icon: User, label: "Account" },
];

function NavItem({ item, isActive, onPress }: { item: any, isActive: boolean, onPress: () => void }) {
  const scale = useSharedValue(1);
  const Icon = item.icon;

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 1, {
      damping: 15,
      stiffness: 150,
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
      style={styles.navItem}
    >
      <Animated.View style={animatedIconStyle}>
        <Icon
          color={isActive ? "#FFF" : "#666"}
          size={24}
          strokeWidth={isActive ? 2.5 : 1.5}
        />
      </Animated.View>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

export function MainApp({ userType }: MainAppProps) {
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);

  const visibleNavItems = navItems.filter((item) => {
    return !item.sponsorOnly || userType === "sponsor";
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>BackChannel</Text>
          <View style={styles.topBarButtons}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveView("notifications");
              }}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <Bell color="#000" size={22} strokeWidth={1.5} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main content wrapper */}
        <View style={styles.mainContent}>
          {activeView === "home" && <HomeView userType={userType} onWebViewActiveChange={setIsBottomNavHidden} />}
          {activeView === "matches" && <MatchesView userType={userType} />}
          {activeView === "messages" && (
            <MessagesView onThreadActiveChange={setIsBottomNavHidden} userType={userType} />
          )}
          {activeView === "jobs" && userType === "sponsor" && <JobsView />}
          {activeView === "profile" && <ProfileView userType={userType} />}
          {activeView === "notifications" && (
            <NotificationsView onBack={() => setActiveView("home")} />
          )}
        </View>

        {/* Bottom Navigation - Floating Pill Style */}
        {activeView !== "notifications" && !isBottomNavHidden && (
          <Animated.View 
            entering={FadeInDown.duration(600)} 
            style={styles.navContainer}
          >
            <View style={styles.navBar}>
              {visibleNavItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activeView === item.id}
                  onPress={() => setActiveView(item.id as ViewType)}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
  },
  topBarButtons: {
    flexDirection: "row",
    gap: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  notificationDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#FFF",
  },
  mainContent: {
    flex: 1,
  },
  navContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  navBar: {
    flexDirection: "row",
    backgroundColor: "#000",
    width: SCREEN_WIDTH * 0.85,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
  },
  activeIndicator: {
    position: "absolute",
    bottom: 8,
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFF",
  },
});