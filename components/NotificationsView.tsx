import {
  ArrowLeft,
  Award,
  CheckCircle,
  Heart,
  MessageCircle,
  UserPlus,
} from "lucide-react-native";
import React from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface NotificationsViewProps {
  onBack: () => void;
}

type NotificationType = {
  id: number;
  type: string;
  Icon: React.ComponentType<any>;
  iconGradient: readonly [string, string];
  title: string;
  message: string;
  image?: string;
  time: string;
  unread: boolean;
};

const mockNotifications: NotificationType[] = [
  {
    id: 1,
    type: "match",
    Icon: Heart,
    iconGradient: ["#ec4899", "#ef4444"],
    title: "New Match!",
    message: "Sarah Chen accepted your connection request",
    image: "https://images.unsplash.com/photo-1563132337-f159f484226c?w=100",
    time: "2m ago",
    unread: true,
  },
  {
    id: 2,
    type: "message",
    Icon: MessageCircle,
    iconGradient: ["#3b82f6", "#9333ea"],
    title: "New Message",
    message: "Michael Rodriguez: Thanks for reaching out!",
    image: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?w=100",
    time: "1h ago",
    unread: true,
  },
  {
    id: 3,
    type: "referral",
    Icon: Award,
    iconGradient: ["#22c55e", "#059669"],
    title: "Referral Submitted",
    message: "Emily Watson submitted your referral to Google",
    image: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=100",
    time: "3h ago",
    unread: false,
  },
  {
    id: 4,
    type: "connection",
    Icon: UserPlus,
    iconGradient: ["#9333ea", "#ec4899"],
    title: "New Connection Request",
    message: "David Kim wants to connect with you",
    image: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=100",
    time: "5h ago",
    unread: false,
  },
  {
    id: 5,
    type: "success",
    Icon: CheckCircle,
    iconGradient: ["#3b82f6", "#06b6d4"],
    title: "Profile Update",
    message: "Your profile has been successfully updated",
    time: "1d ago",
    unread: false,
  },
];

export function NotificationsView({ onBack }: NotificationsViewProps) {
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

        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.markAllRead}>Mark all</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications list */}
      <View style={styles.notificationsList}>
        {mockNotifications.map((notification, index) => {
          const Icon = notification.Icon;
          return (
            <Animated.View
              key={notification.id}
              entering={FadeInUp.delay(index * 50).duration(400)}
            >
              <TouchableOpacity activeOpacity={0.7} style={styles.notificationCardWrapper}>
                <View
                  style={[
                    styles.notificationCard,
                    notification.unread && styles.notificationCardUnread,
                  ]}
                >
                  {/* Unread indicator */}
                  {notification.unread && (
                    <View style={styles.unreadIndicator} />
                  )}

                  <View style={styles.notificationContent}>
                    {/* Icon or Image */}
                    {notification.image ? (
                      <View style={styles.imageContainer}>
                        <Image
                          source={{ uri: notification.image }}
                          style={styles.notificationImage}
                          resizeMode="cover"
                        />
                        <View style={styles.badgeContainer}>
                          <View style={styles.badge}>
                            <Icon color="#ffffff" size={10} strokeWidth={2.5} />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.iconContainer}>
                        <Icon color="#ffffff" size={20} strokeWidth={2.5} />
                      </View>
                    )}

                    {/* Content */}
                    <View style={styles.textContainer}>
                      <View style={styles.titleRow}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.notificationTime}>
                          {notification.time}
                        </Text>
                      </View>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Empty state at bottom */}
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>You're all caught up! 🎉</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
        shadowColor: '#000',
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
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
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
        shadowColor: '#000',
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
        shadowColor: '#000',
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
    top: 0,
    left: 0,
    width: 3,
    height: "100%",
    backgroundColor: "#000",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  imageContainer: {
    position: "relative",
    width: 44,
    height: 44,
  },
  notificationImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  badgeContainer: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: '600',
    color: "#999",
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '600',
    color: "#999",
  },
});