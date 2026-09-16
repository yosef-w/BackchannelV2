// FloatingTabBar — the glass bar (2026-08 "BG" redesign). A floating
// capsule of frosted glass over the page: the page shows through, a
// hairline of light runs along its top edge, and the active tab sits in a
// soft well. Lighter than the content instead of heavier — the previous
// solid-ink pill stacked a second black slab under the verdict bar and
// carried the app's last drop shadow.
//
// Still the custom tabBar of the (tabs) expo-router layout; still slides
// off-screen while the user scrolls down on HomeView via the shell's
// navTranslateY shared value (HomeView is the only writer). Count pills
// per route arrive via `badges`.

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  Briefcase,
  Home,
  MessageCircle,
  Star,
  User,
} from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useShell } from "./ShellContext";
import { Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BAR_HEIGHT = 62;

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
  badge,
  onPress,
  onMeasured,
}: {
  item: (typeof TAB_ITEMS)[number];
  isActive: boolean;
  /** Count pill on the icon — "someone is waiting for you here". */
  badge?: number;
  onPress: () => void;
  /** Reports this tab's own content-driven width/position (relative to the
   * row) so the shared sliding indicator can size and place itself to
   * exactly match — no more a fixed-width well that's narrower than a
   * longer label like "Matches"/"Account". */
  onMeasured: (name: string, x: number, width: number) => void;
}) {
  const Icon = item.icon;
  const handleLayout = (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    onMeasured(item.name, x, width);
  };
  return (
    <TouchableOpacity
      onLayout={handleLayout}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={
        badge ? `${item.label}, ${badge} waiting for you` : item.label
      }
      accessibilityState={{ selected: isActive }}
    >
      <View>
        <Icon
          color={isActive ? Colors.ink : Colors.body}
          size={19}
          strokeWidth={isActive ? 2.2 : 1.5}
        />
        {/* The count pill — ink on glass, the header's pill language. */}
        {!!badge && badge > 0 && (
          <Animated.View
            key={badge > 9 ? "9+" : String(badge)}
            entering={FadeIn.duration(200)}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </Animated.View>
        )}
      </View>
      <Text
        style={[styles.label, isActive && styles.labelActive]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

type FloatingTabBarProps = BottomTabBarProps & {
  /** Per-route count pills, keyed by route name (e.g. { matches: 3 }). */
  badges?: Partial<Record<string, number>>;
};

// Matches DismissibleSheet's settle spring — one motion language for the
// whole app rather than a bespoke feel per component.
const INDICATOR_SPRING = { damping: 20, stiffness: 220 };

export function FloatingTabBar({
  state,
  navigation,
  badges,
}: FloatingTabBarProps) {
  const shell = useShell();

  const navAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shell.navTranslateY.value }],
    opacity: 1 - Math.min(1, shell.navTranslateY.value / 120),
  }));

  const visibleItems = TAB_ITEMS.filter(
    (item) => !item.sponsorOnly || shell.userType === "sponsor",
  );

  const activeItem = visibleItems.find(
    (item) => state.routes[state.index]?.name === item.name,
  );

  // The sliding active-tab pill. Each TabItem reports its own
  // content-driven layout on mount/resize; this glides between those
  // measured positions instead of each tab popping its own background in
  // and out. `measuredOnce` gates the very first placement so the pill
  // snaps directly onto the initial tab rather than sliding in from 0.
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const measuredOnceRef = useRef(false);
  const [layoutTick, setLayoutTick] = useState(0);

  const handleTabMeasured = (name: string, x: number, width: number) => {
    layoutsRef.current[name] = { x, width };
    setLayoutTick((t) => t + 1);
  };

  useEffect(() => {
    const layout = activeItem && layoutsRef.current[activeItem.name];
    if (!layout) return;
    if (!measuredOnceRef.current) {
      indicatorX.value = layout.x;
      indicatorWidth.value = layout.width;
      measuredOnceRef.current = true;
    } else {
      indicatorX.value = withSpring(layout.x, INDICATOR_SPRING);
      indicatorWidth.value = withSpring(layout.width, INDICATOR_SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.name, layoutTick]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    opacity: indicatorWidth.value > 0 ? 1 : 0,
  }));

  return (
    <Animated.View
      style={[styles.navContainer, navAnimatedStyle]}
      pointerEvents="box-none"
    >
      <View style={styles.capsule}>
        {/* The glass: system blur under a milky wash so type stays
            legible whatever scrolls beneath. Android gets the wash alone
            (no native blur) — still a light capsule, just opaque. */}
        {/* The blur carries the capsule's own radius: on iOS a
            UIVisualEffectView clipped only by its parent can paint a
            dark halo outside the rounded corners on re-layout (tab
            changes) — rounding the effect view itself keeps it inside. */}
        <BlurView
          intensity={38}
          tint="light"
          style={[StyleSheet.absoluteFill, styles.blur]}
        />
        <View style={styles.wash} pointerEvents="none" />
        <View style={styles.edgeLight} pointerEvents="none" />
        <View style={styles.row}>
          <Animated.View
            style={[styles.indicator, indicatorStyle]}
            pointerEvents="none"
          />
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
                badge={badges?.[item.name]}
                onMeasured={handleTabMeasured}
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    position: "absolute",
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  capsule: {
    width: SCREEN_WIDTH * 0.9,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    // A hairline edge and the light along the top do the floating — no
    // drop shadow. On iOS a shadow on a non-opaque view (the glass) is
    // computed from its contents' alpha every frame; with a BlurView
    // inside an overflow-hidden capsule it rendered as a smeared shadow
    // off to the side on tab changes.
    borderWidth: 1,
    borderColor: "rgba(10,10,10,0.12)",
  },
  blur: {
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      Platform.OS === "android"
        ? "rgba(255,255,255,0.9)"
        : "rgba(255,255,255,0.64)",
  },
  // The hairline of light along the top edge — what makes glass read as
  // glass rather than as a translucent sheet.
  edgeLight: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    position: "relative",
  },
  // Content-driven width (no fixed size) — a longer label like "Matches"
  // or "Account" simply takes more room, instead of overflowing a
  // fixed-width well sized for the shortest label.
  tab: {
    height: 50,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  // The active tab's well — one shared pill that measures and glides to
  // whichever tab is active (see indicatorX/indicatorWidth) instead of
  // each tab toggling its own fixed-size background in and out.
  indicator: {
    position: "absolute",
    top: (BAR_HEIGHT - 50) / 2,
    left: 0,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(10,10,10,0.08)",
  },
  label: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: Colors.body,
  },
  labelActive: {
    color: Colors.ink,
  },
  badge: {
    position: "absolute",
    top: -7,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.paper,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
});
