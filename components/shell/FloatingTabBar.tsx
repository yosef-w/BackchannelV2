// FloatingTabBar — the black floating pill (extracted from MainApp), now
// rendered as the custom tabBar of the (tabs) expo-router layout instead of
// a hand-rolled view switcher. Slides down off-screen while the user scrolls
// down on HomeView (Hinge-style), driven by the shell's navTranslateY shared
// value which only HomeView writes to; on every other screen the value stays
// 0 so the bar is anchored.

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import {
  Briefcase,
  Home,
  MessageCircle,
  Star,
  User,
} from "@/components/ui/icons";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useShell } from "./ShellContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Route name → tab chrome. Order here is the render order; must match the
// Tabs.Screen declarations in app/(tabs)/_layout.tsx.
const TAB_ITEMS: {
  name: string;
  icon: React.ComponentType<{
    color: string;
    size: number;
    strokeWidth: number;
  }>;
  label: string;
  sponsorOnly?: boolean;
}[] = [
  { name: "home", icon: Home, label: "Feed" },
  { name: "matches", icon: Star, label: "Matches" },
  // Jobs is no longer sponsor-only — applicants get a read-only
  // browse/search view (ApplicantJobsBrowseView).
  { name: "jobs", icon: Briefcase, label: "Jobs" },
  { name: "messages", icon: MessageCircle, label: "Inbox" },
  { name: "profile", icon: User, label: "Account" },
];

function TabItem({
  item,
  isActive,
  onPress,
}: {
  item: (typeof TAB_ITEMS)[number];
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const Icon = item.icon;

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 1, {
      damping: 15,
      stiffness: 150,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={animatedIconStyle}>
        <Icon
          color={isActive ? "#FFF" : "#666"}
          size={22}
          strokeWidth={isActive ? 2.5 : 1.5}
        />
      </Animated.View>
      <Text
        style={[styles.navLabel, isActive && styles.navLabelActive]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const shell = useShell();

  const navAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shell.navTranslateY.value }],
    opacity: 1 - Math.min(1, shell.navTranslateY.value / 120),
  }));

  const visibleItems = TAB_ITEMS.filter(
    (item) => !item.sponsorOnly || shell.userType === "sponsor",
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(600)}
      style={[styles.navContainer, navAnimatedStyle]}
      pointerEvents="box-none"
    >
      <View style={styles.navBar}>
        {visibleItems.map((item) => {
          const routeIndex = state.routes.findIndex(
            (r) => r.name === item.name,
          );
          const isActive = state.index === routeIndex;
          return (
            <TabItem
              key={item.name}
              item={item}
              isActive={isActive}
              onPress={() => {
                const route = state.routes[routeIndex];
                const event = navigation.emit({
                  type: "tabPress",
                  target: route?.key,
                  canPreventDefault: true,
                });
                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate(item.name);
                }
              }}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
    letterSpacing: -0.1,
  },
  navLabelActive: {
    color: "#FFF",
    fontWeight: "700",
  },
});
