import * as Haptics from "expo-haptics";
import {
    ArrowLeft,
    Award,
    Bell,
    BellRing,
    Briefcase,
    CheckCircle,
    Heart,
    MessageCircle,
    RefreshCw,
    Star,
    Trash2,
    UserPlus,
} from "lucide-react-native";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeInUp } from "react-native-reanimated";
import {
    trackAllNotificationsMarkedRead,
    trackNotificationMarkedRead,
    trackNotificationTapped,
} from "../lib/analytics/mixpanel";
import {
    clearReadNotifications,
    deleteNotification,
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "../lib/api";
import { useToastStore } from "../stores/useToastStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// React Query key for the notifications list. Caching it means the screen
// paints instantly on re-entry instead of re-fetching every time, while a
// 20s refetch interval keeps it live. Optimistic mutations (mark-read,
// delete, clear) write to this cache via setQueryData.
const NOTIFICATIONS_QUERY_KEY = ["notifications", "list"] as const;

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
    | "sponsor_request"
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
  // Denormalized metadata from PR #43.
  RELATED_USER_NAME: string | null;
  RELATED_USER_PHOTO_URL: string | null;
  RELATED_JOB_TITLE: string | null;
  RELATED_JOB_COMPANY: string | null;
};

/**
 * Per-type icon mapping. Icons render monochrome (black glyph on a light
 * gray circle) — the brand is predominantly black/white, so the icon
 * SHAPE plus the notification title carry the "what happened" signal
 * rather than colored chips. Keeps the screen calm and editorial.
 */
const NOTIFICATION_ICON: Record<string, React.ComponentType<any>> = {
  match: Heart,
  message: MessageCircle,
  referral: Award,
  job_like: Star,
  profile_like: Heart,
  waitlist: Briefcase,
  sponsor_request: BellRing,
  connection: UserPlus,
  profile_update: CheckCircle,
};

const DEFAULT_ICON = Bell;

/** Normalize a backend ISO string to UTC by appending 'Z' when no timezone
 * offset is present. Without this, JS treats the string as local time, which
 * makes timestamps from UTC backends appear hours in the future for users
 * behind UTC and produces negative diffs (e.g. "-1d ago"). */
function normalizeToUtc(s: string): string {
  const t = s.trim();
  return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t) ? s : `${s}Z`;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(normalizeToUtc(isoString)).getTime();
  // Guard against clock skew / future timestamps.
  if (diffMs < 0) return "Just now";
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(normalizeToUtc(isoString)).toLocaleDateString("en-US", {
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
  const created = new Date(normalizeToUtc(iso));
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

  // Notifications list — cached so the screen paints instantly on re-entry.
  // refetchInterval replaces the old manual `?since=` polling: it re-pulls
  // the list every 20s (server is the source of truth for read/delete state).
  const {
    data: notifications = [],
    isPending: isLoading,
    error: errorObj,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<BackendNotification[]> => {
      try {
        const response = await getNotifications({ limit: 50 });
        return response.notifications;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load notifications";
        // 404 = endpoint not yet seeded / user has no notifications — empty.
        if (msg.includes("404") || msg.includes("Not found")) return [];
        throw err;
      }
    },
    refetchInterval: 20_000,
  });
  const error =
    errorObj instanceof Error
      ? errorObj.message
      : errorObj
        ? "Failed to load notifications"
        : null;

  // Optimistically patch the cached notifications list. Mirrors the previous
  // setNotifications((prev) => ...) calls; the updater shape is identical.
  const patchNotifications = useCallback(
    (updater: (prev: BackendNotification[]) => BackendNotification[]) => {
      queryClient.setQueryData<BackendNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (prev) => updater(prev ?? []),
      );
    },
    [queryClient],
  );

  // Bump this counter every 30s so relative-time strings refresh on screen
  // without re-fetching from the server.
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const markOneRead = useCallback(
    async (notification: BackendNotification) => {
      if (notification.IS_READ) return;
      // Optimistic UI
      patchNotifications((prev) =>
        prev.map((n) =>
          n.NOTIFICATION_ID === notification.NOTIFICATION_ID
            ? { ...n, IS_READ: true }
            : n,
        ),
      );
      try {
        await markNotificationAsRead(notification.NOTIFICATION_ID);
        trackNotificationMarkedRead({
          notificationId: notification.NOTIFICATION_ID,
        });
      } catch (err) {
        // Revert on failure — the gesture/tap shouldn't lie about state
        patchNotifications((prev) =>
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
    },
    [patchNotifications],
  );

  const handleMarkAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      const unreadCount = notifications.filter((n) => !n.IS_READ).length;
      await markAllNotificationsAsRead();
      patchNotifications((prev) => prev.map((n) => ({ ...n, IS_READ: true })));
      trackAllNotificationsMarkedRead({ count: unreadCount });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.warn("[NotificationsView] Failed to mark all read:", err);
      showToast("Failed to mark all as read. Please try again.", "error");
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Deletes a single notification via DELETE /api/notifications/<id>/.
  // Optimistically removes from state — restores on failure so the row
  // doesn't lie about its existence.
  const handleDeleteNotification = useCallback(
    async (n: BackendNotification) => {
      const previous =
        queryClient.getQueryData<BackendNotification[]>(
          NOTIFICATIONS_QUERY_KEY,
        ) ?? [];
      patchNotifications((prev) =>
        prev.filter((row) => row.NOTIFICATION_ID !== n.NOTIFICATION_ID),
      );
      try {
        await deleteNotification(n.NOTIFICATION_ID);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        console.warn("[NotificationsView] Failed to delete:", err);
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, previous);
        showToast("Couldn't delete that. Please try again.", "error");
      }
    },
    [patchNotifications, queryClient, showToast],
  );

  // Bulk-delete every notification that's already read.
  const handleClearRead = async () => {
    if (isClearingRead) return;
    setIsClearingRead(true);
    const previous =
      queryClient.getQueryData<BackendNotification[]>(NOTIFICATIONS_QUERY_KEY) ??
      [];
    // Optimistic — pull the read rows out immediately.
    patchNotifications((prev) => prev.filter((n) => !n.IS_READ));
    try {
      await clearReadNotifications();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.warn("[NotificationsView] Failed to clear read:", err);
      queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, previous);
      showToast("Couldn't clear read notifications.", "error");
    } finally {
      setIsClearingRead(false);
    }
  };

  /**
   * Tap: mark-read (if unread) + deep-link to the related surface.
   * Falls through to a tab switch when a specific target isn't available.
   */
  const handleNotificationPress = async (n: BackendNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackNotificationTapped({
      notificationId: n.NOTIFICATION_ID,
      notificationType: n.TYPE,
    });
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
      case "referral":
      case "sponsor_request": {
        // Sponsor requests surface in Matches' "Your Move" section (see
        // getSponsorRequests() in MatchesView) — same deep link as
        // match/referral.
        onOpenTab("matches");
        return;
      }
      case "job_like": {
        // Defensive: backend only sends this to sponsors, but guard anyway.
        onOpenTab(userType === "sponsor" ? "jobs" : "matches");
        return;
      }
      case "profile_like": {
        // Sponsor liked the applicant's profile without a match yet (§D) —
        // surfaces under Matches' "Interested in You" section.
        onOpenTab("matches");
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

  // Swipe-left → delete (PR #43). Backed by DELETE /api/notifications/<id>/.
  const handleSwipeCommit = useCallback(
    (n: BackendNotification) => {
      handleDeleteNotification(n);
    },
    [handleDeleteNotification],
  );

  const hasUnread = notifications.some((n) => !n.IS_READ);
  const hasRead = notifications.some((n) => n.IS_READ);

  /**
   * Group rows into time buckets, preserving newest-first ordering. Shaped
   * for SectionList directly (`title`/`data`) rather than the app's usual
   * `label`/`rows` naming, since that's the prop contract SectionList reads.
   */
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
      .map((k) => ({
        key: k,
        title: SECTION_LABELS[k],
        data: buckets[k],
      }));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.IS_READ).length;

  const listHeader = (
    <>
      {/* ── Header — flat, no card. Plain back arrow, large title, an
          unread-count subtitle, and one understated action pill. ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.6}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft color="#000" size={24} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? "Loading…"
                : unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
            </Text>
          </View>

          {hasUnread ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={isMarkingAll}
              activeOpacity={0.7}
              style={[styles.actionPill, isMarkingAll && { opacity: 0.4 }]}
            >
              <Text style={styles.actionPillText}>
                {isMarkingAll ? "Marking…" : "Mark all read"}
              </Text>
            </TouchableOpacity>
          ) : hasRead ? (
            <TouchableOpacity
              onPress={handleClearRead}
              disabled={isClearingRead}
              activeOpacity={0.7}
              style={[styles.actionPill, isClearingRead && { opacity: 0.4 }]}
            >
              <Text style={styles.actionPillText}>
                {isClearingRead ? "Clearing…" : "Clear read"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.centeredState}>
          <View style={styles.stateIconCircle}>
            <Bell color="#BBB" size={28} strokeWidth={2} />
          </View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#AAA",
              marginTop: 4,
            }}
          >
            Loading notifications…
          </Text>
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <View style={styles.centeredState}>
          <View style={styles.stateIconCircle}>
            <Bell color="#BBB" size={28} strokeWidth={2} />
          </View>
          <Text style={styles.errorText}>Couldn't load notifications</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={styles.retryButton}
            activeOpacity={0.8}
          >
            <RefreshCw color="#FFF" size={15} strokeWidth={2.5} />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state — user has no notifications at all */}
      {!isLoading && !error && notifications.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.stateIconCircle}>
            <Bell color="#BBB" size={30} strokeWidth={2} />
          </View>
          <Text style={styles.emptyStateTitle}>No notifications yet</Text>
          <Text style={styles.emptyStateText}>
            Matches, messages, and referral updates will show up here.
          </Text>
        </View>
      )}
    </>
  );

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      // Loading/error/empty already render their own state inside the
      // header; suppress the section rows entirely while any of those
      // apply so nothing double-renders.
      sections={isLoading || error || notifications.length === 0 ? [] : sections}
      keyExtractor={(item) => item.NOTIFICATION_ID}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={listHeader}
      renderSectionHeader={({ section }) => (
        <Text
          style={[
            styles.sectionLabel,
            sections[0]?.key !== section.key && styles.sectionSpacer,
          ]}
        >
          {section.title}
        </Text>
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullToRefresh}
          tintColor="#000"
        />
      }
      renderItem={({ item: notification, index: rowIdx }) => {
        const Icon = NOTIFICATION_ICON[notification.TYPE] ?? DEFAULT_ICON;
        const isUnread = !notification.IS_READ;

        // Backend (PR #43) supplies denormalized RELATED_* metadata when
        // present. Prefer the related user's avatar over the generic
        // type-icon; the icon falls back when no photo.
        const hasAvatar = !!notification.RELATED_USER_PHOTO_URL;
        const jobContext =
          notification.RELATED_JOB_TITLE && notification.RELATED_JOB_COMPANY
            ? `${notification.RELATED_JOB_TITLE} · ${notification.RELATED_JOB_COMPANY}`
            : notification.RELATED_JOB_TITLE ||
              notification.RELATED_JOB_COMPANY ||
              null;

        const row = (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => handleNotificationPress(notification)}
            style={[styles.row, isUnread ? styles.rowUnread : styles.rowRead]}
          >
            {/* Leading avatar or monochrome icon */}
            {hasAvatar ? (
              <Image
                source={{
                  uri: notification.RELATED_USER_PHOTO_URL ?? undefined,
                }}
                style={styles.avatar}
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <View style={styles.iconCircle}>
                <Icon color="#1A1A1A" size={20} strokeWidth={2.3} />
              </View>
            )}

            {/* Text column */}
            <View style={styles.rowText}>
              <Text
                style={[styles.rowTitle, !isUnread && styles.rowTitleRead]}
                numberOfLines={1}
              >
                {notification.TITLE}
              </Text>
              <Text style={styles.rowBody} numberOfLines={2}>
                {notification.BODY}
              </Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>
                  {formatRelativeTime(notification.CREATED_AT)}
                </Text>
                {!!jobContext && (
                  <>
                    <View style={styles.metaDot} />
                    <Text style={styles.rowContext} numberOfLines={1}>
                      {jobContext}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Single unread signal — a small filled dot. */}
            {isUnread && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        );

        return (
          <View style={styles.notificationsList}>
            <Animated.View
              entering={FadeInUp.delay(rowIdx * 40).duration(320)}
            >
              <ReanimatedSwipeable
                friction={2}
                rightThreshold={48}
                overshootRight={false}
                renderRightActions={() => (
                  <View style={styles.swipeActionContainer}>
                    <View style={styles.swipeActionDelete}>
                      <Trash2 color="#FFF" size={18} strokeWidth={2.5} />
                      <Text style={styles.swipeActionText}>Delete</Text>
                    </View>
                  </View>
                )}
                onSwipeableOpen={() => handleSwipeCommit(notification)}
              >
                {row}
              </ReanimatedSwipeable>
            </Animated.View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  // ── Header — flat, sits directly on the white background ──
  header: {
    marginBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    marginTop: 3,
  },
  actionPill: {
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.1,
  },

  // ── States ──
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  stateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },

  // ── Section grouping ──
  sectionSpacer: {
    marginTop: 26,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  // Per-row wrapper — used to be `gap: 4` on a container of all of a
  // section's rows; SectionList renders each row in isolation (no shared
  // sibling container to apply flex `gap` to), so the same 4px breathing
  // room between rows is now a per-row marginBottom instead.
  notificationsList: {
    marginBottom: 4,
  },

  // ── Notification row — flat, no shadow. Unread rows lift via a subtle
  //    gray fill; read rows are transparent and recede. One signal. ──
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  // Unread lift — was #F5F6F8, a bluish gray that had become the only
  // off-palette color left in the app; #F4F4F5 is the system neutral.
  rowUnread: {
    backgroundColor: "#F4F4F5",
  },
  rowRead: {
    backgroundColor: "transparent",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F2F2F2",
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.2,
  },
  // Read rows soften the title so unread ones lead the eye.
  rowTitleRead: {
    fontWeight: "600",
    color: "#444",
  },
  rowBody: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#777",
    lineHeight: 19,
    marginTop: 2,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  rowTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AAA",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CCC",
  },
  rowContext: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AAA",
    flexShrink: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#000",
  },

  // ── Swipe-to-delete ──
  swipeActionContainer: {
    justifyContent: "center",
    paddingLeft: 8,
  },
  swipeActionDelete: {
    backgroundColor: "#DC2626",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
    height: "100%",
    minWidth: 96,
  },
  swipeActionText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 70,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});
