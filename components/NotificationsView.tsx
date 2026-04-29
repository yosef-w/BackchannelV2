import * as Haptics from "expo-haptics";
import {
    ArrowLeft,
    Award,
    Bell,
    Briefcase,
    Check,
    CheckCircle,
    Heart,
    MessageCircle,
    RefreshCw,
    Star,
    UserPlus,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeInUp } from "react-native-reanimated";
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "../lib/api";
import { useToastStore } from "../stores/useToastStore";

interface NotificationsViewProps {
  userType: "applicant" | "sponsor";
  onBack: () => void;
  /** Open the Messages tab and focus a specific conversation */
  onOpenConversation: (conversationId: string) => void;
  /** Switch the bottom-tab active view */
  onOpenTab: (tab: "home" | "matches" | "jobs" | "messages") => void;
}

/** Backend notification shape as returned by GET /api/notifications/ */
type BackendNotification = {
  NOTIFICATION_ID: string;
  USER_ID: string;
  TYPE:
    | "match"
    | "message"
    | "referral"
    | "job_like"
    | "waitlist"
    | "connection"
    | "profile_update"
    | string;
  TITLE: string;
  BODY: string;
  IS_READ: boolean;
  RELATED_USER_ID: string | null;
  RELATED_JOB_ID: string | null;
  RELATED_CONVERSATION_ID: string | null;
  CREATED_AT: string;
};

/**
 * Per-type visual + routing config.
 *
 * Colors are drawn ONLY from the existing app palette:
 *   #000     — primary black (used everywhere)
 *   #2563EB  — existing accent blue (HomeView)
 *   #00CB54  — existing confirmation green (HomeView checkmarks)
 *
 * No new hues are introduced.
 */
const NOTIFICATION_CONFIG: Record<
  string,
  { Icon: React.ComponentType<any>; accent: string }
> = {
  match: { Icon: Heart, accent: "#000" },
  message: { Icon: MessageCircle, accent: "#2563EB" },
  referral: { Icon: Award, accent: "#00CB54" },
  job_like: { Icon: Star, accent: "#000" },
  waitlist: { Icon: Briefcase, accent: "#00CB54" },
  connection: { Icon: UserPlus, accent: "#000" },
  profile_update: { Icon: CheckCircle, accent: "#000" },
};

const DEFAULT_CONFIG = { Icon: Bell, accent: "#000" };

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type SectionKey = "today" | "yesterday" | "thisWeek" | "earlier";
const SECTION_LABELS: Record<SectionKey, string> = {
  today: "TODAY",
  yesterday: "YESTERDAY",
  thisWeek: "THIS WEEK",
  earlier: "EARLIER",
};

function bucketForDate(iso: string): SectionKey {
  const created = new Date(iso);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const t = created.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfYesterday) return "yesterday";
  if (t >= startOfWeek) return "thisWeek";
  return "earlier";
}

export function NotificationsView({
  userType,
  onBack,
  onOpenConversation,
  onOpenTab,
}: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  // Bump this counter every 30s so relative-time strings refresh on screen
  // without re-fetching from the server.
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setIsLoading(true);
        setError(null);
        const response = await getNotifications({ limit: 50 });
        setNotifications(response.notifications);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load notifications";
        // 404 = endpoint not yet seeded / user has no notifications — show empty
        if (msg.includes("404") || msg.includes("Not found")) {
          setNotifications([]);
        } else if (!opts?.silent) {
          setError(msg);
        }
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchNotifications]);

  const markOneRead = useCallback(async (notification: BackendNotification) => {
    if (notification.IS_READ) return;
    // Optimistic UI
    setNotifications((prev) =>
      prev.map((n) =>
        n.NOTIFICATION_ID === notification.NOTIFICATION_ID
          ? { ...n, IS_READ: true }
          : n,
      ),
    );
    try {
      await markNotificationAsRead(notification.NOTIFICATION_ID);
    } catch (err) {
      // Revert on failure — the gesture/tap shouldn't lie about state
      setNotifications((prev) =>
        prev.map((n) =>
          n.NOTIFICATION_ID === notification.NOTIFICATION_ID
            ? { ...n, IS_READ: false }
            : n,
        ),
      );
      console.warn(
        "[NotificationsView] Failed to mark notification as read:",
        err,
      );
    }
  }, []);

  const handleMarkAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, IS_READ: true })));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.warn("[NotificationsView] Failed to mark all read:", err);
      showToast("Failed to mark all as read. Please try again.", "error");
    } finally {
      setIsMarkingAll(false);
    }
  };

  /**
   * Tap: mark-read (if unread) + deep-link to the related surface.
   * Falls through to a tab switch when a specific target isn't available.
   */
  const handleNotificationPress = async (n: BackendNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Kick off mark-read in the background; don't await — routing shouldn't wait.
    markOneRead(n);

    switch (n.TYPE) {
      case "message": {
        if (n.RELATED_CONVERSATION_ID) {
          onOpenConversation(n.RELATED_CONVERSATION_ID);
        } else {
          onOpenTab("messages");
        }
        return;
      }
      case "match":
      case "referral": {
        onOpenTab("matches");
        return;
      }
      case "job_like": {
        // Defensive: backend only sends this to sponsors, but guard anyway.
        onOpenTab(userType === "sponsor" ? "jobs" : "matches");
        return;
      }
      case "waitlist": {
        onOpenTab("home");
        return;
      }
      default: {
        // Unknown / connection / profile_update — no deep link target.
        // Mark-read already fired; stay on the list.
        return;
      }
    }
  };

  /**
   * Swipe-left action: mark-read with a committed gesture.
   * The child row closes its own Swipeable via its internal ref.
   * (True dismiss requires a backend DELETE endpoint — see
   * docs/BACKEND_CHANGES_NEEDED.md "Optional E".)
   */
  const handleSwipeCommit = useCallback(
    (n: BackendNotification) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markOneRead(n);
    },
    [markOneRead],
  );

  const hasUnread = notifications.some((n) => !n.IS_READ);

  /** Group rows into time buckets, preserving newest-first ordering. */
  const sections = useMemo(() => {
    const buckets: Record<SectionKey, BackendNotification[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };
    for (const n of notifications) {
      buckets[bucketForDate(n.CREATED_AT)].push(n);
    }
    return (Object.keys(SECTION_LABELS) as SectionKey[])
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ key: k, label: SECTION_LABELS[k], rows: buckets[k] }));
  }, [notifications]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullToRefresh}
          tintColor="#000"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <ArrowLeft color="#000" size={22} />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.title}>Notifications</Text>
        </View>

        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={!hasUnread || isMarkingAll}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.markAllRead,
              (!hasUnread || isMarkingAll) && { opacity: 0.4 },
            ]}
          >
            {isMarkingAll ? "Marking…" : "Mark all"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>Failed to load notifications</Text>
          <TouchableOpacity
            onPress={() => fetchNotifications()}
            style={styles.retryButton}
            activeOpacity={0.7}
          >
            <RefreshCw color="#000" size={16} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications list, grouped by recency */}
      {!isLoading && !error && notifications.length > 0 && (
        <View>
          {sections.map((section, sectionIdx) => (
            <View
              key={section.key}
              style={sectionIdx === 0 ? undefined : styles.sectionSpacer}
            >
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <View style={styles.notificationsList}>
                {section.rows.map((notification, rowIdx) => {
                  const config =
                    NOTIFICATION_CONFIG[notification.TYPE] ?? DEFAULT_CONFIG;
                  const { Icon, accent } = config;

                  const card = (
                    <View
                      style={[
                        styles.notificationCard,
                        !notification.IS_READ && styles.notificationCardUnread,
                      ]}
                    >
                      {!notification.IS_READ && (
                        <View style={styles.unreadIndicator} />
                      )}

                      <View style={styles.notificationContent}>
                        <View
                          style={[
                            styles.iconContainer,
                            { backgroundColor: accent },
                          ]}
                        >
                          <Icon color="#ffffff" size={20} strokeWidth={2.5} />
                        </View>

                        <View style={styles.textContainer}>
                          <View style={styles.titleRow}>
                            <Text
                              style={styles.notificationTitle}
                              numberOfLines={1}
                            >
                              {notification.TITLE}
                            </Text>
                            <Text style={styles.notificationTime}>
                              {formatRelativeTime(notification.CREATED_AT)}
                            </Text>
                          </View>
                          <Text
                            style={styles.notificationMessage}
                            numberOfLines={2}
                          >
                            {notification.BODY}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );

                  const touchable = (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.notificationCardWrapper}
                      onPress={() => handleNotificationPress(notification)}
                    >
                      {card}
                    </TouchableOpacity>
                  );

                  return (
                    <Animated.View
                      key={notification.NOTIFICATION_ID}
                      entering={FadeInUp.delay(rowIdx * 40).duration(350)}
                    >
                      {notification.IS_READ ? (
                        touchable
                      ) : (
                        <ReanimatedSwipeable
                          friction={2}
                          rightThreshold={48}
                          overshootRight={false}
                          renderRightActions={() => (
                            <View style={styles.swipeActionContainer}>
                              <View style={styles.swipeAction}>
                                <Check
                                  color="#FFF"
                                  size={18}
                                  strokeWidth={2.5}
                                />
                                <Text style={styles.swipeActionText}>Read</Text>
                              </View>
                            </View>
                          )}
                          onSwipeableOpen={() =>
                            handleSwipeCommit(notification)
                          }
                        >
                          {touchable}
                        </ReanimatedSwipeable>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty state — user has no notifications at all */}
      {!isLoading && !error && notifications.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No notifications yet</Text>
        </View>
      )}

      {/* All-caught-up banner — shown only when list is non-empty and all read */}
      {!isLoading && !error && notifications.length > 0 && !hasUnread && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>You&apos;re all caught up</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  markAllRead: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  sectionSpacer: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  notificationsList: {
    gap: 12,
  },
  notificationCardWrapper: {
    marginBottom: 0,
  },
  notificationCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  notificationCardUnread: {
    borderColor: "#000",
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  unreadIndicator: {
    position: "absolute",
    top: -1,
    left: -1,
    width: 4,
    height: "102%",
    backgroundColor: "#000",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingLeft: 6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    lineHeight: 20,
  },
  swipeActionContainer: {
    justifyContent: "center",
    paddingLeft: 8,
  },
  swipeAction: {
    backgroundColor: "#000",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
    height: "100%",
    minWidth: 92,
  },
  swipeActionText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
});
