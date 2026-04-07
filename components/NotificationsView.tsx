import {
    ArrowLeft,
    Award,
    Bell,
    CheckCircle,
    Heart,
    MessageCircle,
    RefreshCw,
    UserPlus,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "../lib/api";

interface NotificationsViewProps {
  onBack: () => void;
}

/** Backend notification shape as returned by GET /api/notifications/ */
type BackendNotification = {
  NOTIFICATION_ID: string;
  USER_ID: string;
  TYPE:
    | "match"
    | "message"
    | "referral"
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

/** Map backend TYPE value → icon component for the UI badge */
const NOTIFICATION_CONFIG: Record<string, { Icon: React.ComponentType<any> }> =
  {
    match: { Icon: Heart },
    message: { Icon: MessageCircle },
    referral: { Icon: Award },
    connection: { Icon: UserPlus },
    profile_update: { Icon: CheckCircle },
  };

const DEFAULT_CONFIG = { Icon: Bell };

/**
 * Format an ISO timestamp into a human-readable relative string.
 * Mirrors the behaviour of formatPostedDate in types/jobs.ts.
 */
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

export function NotificationsView({ onBack }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getNotifications({ limit: 50 });
      setNotifications(response.notifications);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load notifications";
      // 404 = endpoint not yet seeded / user has no notifications — show empty
      if (msg.includes("404") || msg.includes("Not found")) {
        setNotifications([]);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      // Optimistically mark all as read
      setNotifications((prev) => prev.map((n) => ({ ...n, IS_READ: true })));
    } catch (err) {
      console.warn("[NotificationsView] Failed to mark all read:", err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationPress = async (n: BackendNotification) => {
    if (n.IS_READ) return;

    // Optimistic update first for instant feedback
    setNotifications((prev) =>
      prev.map((item) =>
        item.NOTIFICATION_ID === n.NOTIFICATION_ID
          ? { ...item, IS_READ: true }
          : item,
      ),
    );

    try {
      await markNotificationAsRead(n.NOTIFICATION_ID);
    } catch (err) {
      // Revert on API failure
      setNotifications((prev) =>
        prev.map((item) =>
          item.NOTIFICATION_ID === n.NOTIFICATION_ID
            ? { ...item, IS_READ: false }
            : item,
        ),
      );
      console.warn(
        "[NotificationsView] Failed to mark notification as read:",
        err,
      );
    }
  };

  const hasUnread = notifications.some((n) => !n.IS_READ);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
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
            onPress={fetchNotifications}
            style={styles.retryButton}
            activeOpacity={0.7}
          >
            <RefreshCw color="#000" size={16} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications list */}
      {!isLoading && !error && notifications.length > 0 && (
        <View style={styles.notificationsList}>
          {notifications.map((notification, index) => {
            const { Icon } =
              NOTIFICATION_CONFIG[notification.TYPE] ?? DEFAULT_CONFIG;
            return (
              <Animated.View
                key={notification.NOTIFICATION_ID}
                entering={FadeInUp.delay(index * 50).duration(400)}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.notificationCardWrapper}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View
                    style={[
                      styles.notificationCard,
                      !notification.IS_READ && styles.notificationCardUnread,
                    ]}
                  >
                    {/* Unread indicator bar */}
                    {!notification.IS_READ && (
                      <View style={styles.unreadIndicator} />
                    )}

                    <View style={styles.notificationContent}>
                      {/* Type icon */}
                      <View style={styles.iconContainer}>
                        <Icon color="#ffffff" size={20} strokeWidth={2.5} />
                      </View>

                      {/* Content */}
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
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Empty state — user has no notifications at all */}
      {!isLoading && !error && notifications.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No notifications yet 🔔</Text>
        </View>
      )}

      {/* All-caught-up banner — shown only when list is non-empty and all read */}
      {!isLoading && !error && notifications.length > 0 && !hasUnread && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>You're all caught up! 🎉</Text>
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
    backgroundColor: "#000",
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
