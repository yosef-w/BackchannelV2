import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams } from "expo-router";
import {
    Bell,
    Briefcase,
    Home,
    MessageCircle,
    Star,
    User,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Platform,
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
    withSpring,
} from "react-native-reanimated";
import { getUnreadNotificationCount, registerDevice } from "../lib/api";
import { useAuthStore } from "../stores/useAuthStore";
import { ApplicantPublicProfileView } from "./ApplicantPublicProfileView";
import { HomeView } from "./HomeView";
import { JobsView } from "./JobsView";
import { MatchesView } from "./MatchesView";
import { MessagesView } from "./MessagesView";
import { NotificationsView } from "./NotificationsView";
import { ProfileView } from "./ProfileView";
import { SponsorPublicProfileView } from "./SponsorPublicProfileView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MainAppProps {
  userType: "applicant" | "sponsor";
}

type ViewType =
  | "home"
  | "matches"
  | "messages"
  | "jobs"
  | "profile"
  | "notifications"
  | "publicProfile";

const navItems = [
  { id: "home", icon: Home, label: "Feed" },
  { id: "matches", icon: Star, label: "Matches" },
  { id: "jobs", icon: Briefcase, label: "Jobs", sponsorOnly: true },
  { id: "messages", icon: MessageCircle, label: "Inbox" },
  { id: "profile", icon: User, label: "Account" },
];

function NavItem({
  item,
  isActive,
  onPress,
}: {
  item: any;
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
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [previousView, setPreviousView] = useState<ViewType>("home");
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const [publicProfileData, setPublicProfileData] = useState<any>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [pendingMessageJobId, setPendingMessageJobId] = useState<string | null>(
    null,
  );

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setDeviceToken = useAuthStore((state) => state.setDeviceToken);

  // ── Unread notification count for the bell badge ─────────────────────────
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const notifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = async () => {
    try {
      const { unread_count } = await getUnreadNotificationCount();
      setUnreadNotificationCount(unread_count);
    } catch {
      // non-fatal — badge just won't update
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    // Poll every 60s so the badge stays reasonably fresh without hammering the server
    notifPollRef.current = setInterval(fetchUnreadCount, 60_000);
    return () => {
      if (notifPollRef.current) clearInterval(notifPollRef.current);
    };
  }, [isAuthenticated]);

  /**
   * Register the device for push notifications whenever the user is
   * authenticated.  Runs once per login session.
   *
   * - Requests OS permission (prompt shown only on first run).
   * - Gets the Expo push token (requires a valid EAS projectId).
   * - POSTs the token to /api/devices/register/ so the backend can target
   *   this device with Firebase Cloud Messaging.
   * - Stores the token in useAuthStore so ProfileView can unregister it
   *   on logout.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    const registerPushToken = async () => {
      try {
        // Android requires an explicit notification channel.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#000000",
          });
        }

        // Request permission — iOS shows a dialog on first call, Android 13+
        // uses the POST_NOTIFICATIONS permission.
        const { status: current } = await Notifications.getPermissionsAsync();
        let finalStatus = current;
        if (current !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("[MainApp] Push notification permission not granted");
          return;
        }

        // projectId is required by Expo SDK ≥50 for getExpoPushTokenAsync.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as
          | string
          | undefined;
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!active) return;

        const platform: "ios" | "android" | "expo" =
          Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
              ? "android"
              : "expo";

        await registerDevice(token, platform);
        setDeviceToken(token);
        console.log("[MainApp] Push token registered:", token);
      } catch (err) {
        // Non-fatal — the app works without push notifications.
        console.warn("[MainApp] Failed to register push token:", err);
      }
    };

    registerPushToken();
    return () => {
      active = false;
    };
  }, [isAuthenticated, setDeviceToken]);

  // ── Handle push notification taps (deep-link to the right screen) ────────
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fired when the user taps a notification while the app is in foreground
    // or when it's brought to the foreground from background/killed state.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined;
        if (!data) return;

        const type = data.type as string | undefined;
        if (type === "match" || type === "referral") {
          setActiveView("matches");
        } else if (type === "message") {
          setActiveView("messages");
        } else {
          // Generic fallback — open notifications list so the user can act on it
          setActiveView("notifications");
        }
        // Refresh unread count now that we're acting on a push
        fetchUnreadCount();
      },
    );

    return () => subscription.remove();
  }, [isAuthenticated]);

  const handleNavigateToMessages = (jobId: string) => {
    setPendingMessageJobId(jobId || null);
    setActiveView("messages");
  };

  // Handle initial tab from URL parameter
  useEffect(() => {
    if (params.tab) {
      const validTabs: ViewType[] = [
        "home",
        "matches",
        "jobs",
        "messages",
        "profile",
      ];
      if (validTabs.includes(params.tab as ViewType)) {
        setActiveView(params.tab as ViewType);
      }
    }
  }, [params.tab]);

  const handleShowPublicProfile = (userData: any) => {
    setPublicProfileData(userData);
    setActiveView("publicProfile");
  };

  const handleViewChange = (newView: ViewType) => {
    if (newView !== "notifications" && newView !== "publicProfile") {
      setPreviousView(activeView);
    }
    setActiveView(newView);
  };

  const visibleNavItems = navItems.filter((item) => {
    return !item.sponsorOnly || userType === "sponsor";
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>Backchannel</Text>
          <View style={styles.topBarButtons}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleViewChange("notifications");
                // Optimistically clear badge when the user opens the screen;
                // the NotificationsView will mark-all-read on its own.
                setUnreadNotificationCount(0);
              }}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <Bell color="#000" size={22} strokeWidth={1.5} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Main content wrapper */}
        <View style={styles.mainContent}>
          {activeView === "home" && (
            <HomeView
              userType={userType}
              onWebViewActiveChange={setIsBottomNavHidden}
              onNavigateToProfile={() => setActiveView("profile")}
            />
          )}
          {activeView === "matches" && (
            <MatchesView
              userType={userType}
              onNavigateToMessages={handleNavigateToMessages}
            />
          )}
          {/* Keep MessagesView mounted when messages OR publicProfile is active.
              It always has flex:1 — the public-profile view is layered on top
              as an absoluteFillObject overlay. This means display:none is
              NEVER applied to this subtree, so Reanimated worklets (e.g. the
              profile-modal SlideInDown/SlideOutDown) always have a live host
              view and can complete normally, preventing the ghost-overlay
              freeze that occurred with the previous display:none approach. */}
          {(activeView === "messages" || activeView === "publicProfile") && (
            <View style={{ flex: 1 }}>
              <MessagesView
                onThreadActiveChange={setIsBottomNavHidden}
                userType={userType}
                onShowPublicProfile={handleShowPublicProfile}
                selectedConversationId={selectedConversationId}
                onConversationChange={setSelectedConversationId}
                pendingJobId={pendingMessageJobId}
                onPendingJobConsumed={() => setPendingMessageJobId(null)}
              />
            </View>
          )}
          {activeView === "jobs" && userType === "sponsor" && <JobsView />}
          {activeView === "profile" && <ProfileView userType={userType} />}
          {activeView === "notifications" && (
            <NotificationsView onBack={() => setActiveView(previousView)} />
          )}
          {/* Public profile rendered as a full-screen absolute overlay on top
              of MessagesView. Removing it unmounts cleanly without ever having
              hidden MessagesView underneath. */}
          {activeView === "publicProfile" &&
            publicProfileData &&
            (userType === "sponsor" ? (
              <View style={StyleSheet.absoluteFillObject}>
                <ApplicantPublicProfileView
                  userData={publicProfileData}
                  onClose={() => setActiveView("messages")}
                />
              </View>
            ) : (
              <View style={StyleSheet.absoluteFillObject}>
                <SponsorPublicProfileView
                  userData={publicProfileData}
                  onClose={() => setActiveView("messages")}
                />
              </View>
            ))}
        </View>

        {/* Bottom Navigation - Floating Pill Style */}
        {activeView !== "notifications" &&
          activeView !== "publicProfile" &&
          !isBottomNavHidden && (
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
                    onPress={() => handleViewChange(item.id as ViewType)}
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
