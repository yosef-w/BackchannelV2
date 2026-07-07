import { BlurView } from "expo-blur";
import { Heart, MessageCircle } from "@/components/ui/icons";
import React, { useEffect } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

export interface MatchedUser {
  name: string;
  image: string;
  role: string;
  jobTitle?: string;
  /** jobId/userId for the new conversation — lets "Message Now" actually
   * open it instead of just dismissing the modal. */
  jobId?: string;
  userId?: string;
}

interface MatchCelebrationModalProps {
  matchedUser: MatchedUser | null;
  userType: "applicant" | "sponsor";
  onDismiss: () => void;
  onMessage: () => void;
}

/**
 * Mutual-match celebration overlay. Extracted from HomeView as a
 * self-contained modal: matchRingScale/matchRingOpacity/matchRingStyle have
 * zero readers outside this UI (confirmed by a state-ownership audit before
 * extraction), so the pulse-ring animation moves in wholesale, keyed off the
 * `matchedUser` prop instead of the parent's own state. `matchedUser` itself
 * stays in HomeView (it also gates swipe logic elsewhere), as do
 * handleMatchModalDismiss/handleMatchModalMessage (they call nextProfile /
 * onNavigateToMessages), passed down as onDismiss/onMessage.
 */
export function MatchCelebrationModal({
  matchedUser,
  userType,
  onDismiss,
  onMessage,
}: MatchCelebrationModalProps) {
  const profileData = useUserProfileStore((state) => state.data);

  const matchRingScale = useSharedValue(0.8);
  const matchRingOpacity = useSharedValue(0);

  // Pulse-ring that radiates outward from both avatars when a mutual match fires
  useEffect(() => {
    if (matchedUser) {
      matchRingScale.value = 0.8;
      matchRingOpacity.value = 0;
      matchRingScale.value = withTiming(1.9, { duration: 750 });
      matchRingOpacity.value = withSequence(
        withTiming(0.28, { duration: 260 }),
        withTiming(0, { duration: 490 }),
      );
    }
  }, [matchedUser, matchRingOpacity, matchRingScale]);

  const matchRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: matchRingScale.value }],
    opacity: matchRingOpacity.value,
  }));

  return (
    <Modal
      visible={!!matchedUser}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={styles.matchModalOverlay}>
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(180)}
            style={styles.matchCard}
          >
            {/* "IT'S A MATCH" pill label */}
            <Animated.View
              entering={FadeInDown.delay(150).duration(350)}
              style={styles.matchLabelPill}
            >
              <Text style={styles.matchLabelText}>IT’S A MATCH</Text>
            </Animated.View>

            {/* Avatar row */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(400)}
              style={styles.matchAvatarRow}
            >
              {/* Current user's avatar */}
              <View style={styles.matchAvatarWrapper}>
                <Animated.View style={[styles.matchAvatarRing, matchRingStyle]} />
                {profileData?.personal?.profileImage ? (
                  <Image
                    source={{ uri: profileData.personal.profileImage }}
                    style={styles.matchAvatar}
                  />
                ) : (
                  <View style={[styles.matchAvatar, styles.matchAvatarInitial]}>
                    <Text style={styles.matchAvatarInitialText}>
                      {(profileData?.personal?.firstName || "Y")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Connector between the two avatars */}
              <View style={styles.matchSparkWrapper}>
                <Heart size={18} color="#000" strokeWidth={2.2} />
              </View>

              {/* Matched user's avatar */}
              <View style={styles.matchAvatarWrapper}>
                <Animated.View style={[styles.matchAvatarRing, matchRingStyle]} />
                {matchedUser?.image ? (
                  <Image
                    source={{ uri: matchedUser.image }}
                    style={styles.matchAvatar}
                  />
                ) : (
                  <View style={[styles.matchAvatar, styles.matchAvatarInitial]}>
                    <Text style={styles.matchAvatarInitialText}>
                      {(matchedUser?.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <Text style={styles.matchTitle}>It’s a Match!</Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View entering={FadeInUp.delay(400).duration(400)}>
              <Text style={styles.matchSubtitle}>
                {userType === "applicant"
                  ? `You and ${
                      matchedUser?.name ?? "your sponsor"
                    } are both interested${
                      matchedUser?.jobTitle ? ` in ${matchedUser.jobTitle}` : ""
                    }`
                  : `You and ${
                      matchedUser?.name ?? "this applicant"
                    } are both interested in connecting`}
              </Text>
            </Animated.View>

            {/* Action buttons */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              style={styles.matchActions}
            >
              <TouchableOpacity
                style={styles.matchMsgBtn}
                onPress={onMessage}
                activeOpacity={0.8}
              >
                <MessageCircle size={18} color="#FFF" />
                <Text style={styles.matchMsgBtnText}>Message Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchSkipBtn}
                onPress={onDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.matchSkipBtnText}>Continue Exploring</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  matchModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  matchCard: {
    backgroundColor: "#FFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 20,
  },
  matchLabelPill: {
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  matchLabelText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  matchAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  matchAvatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
  },
  matchAvatarRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#000",
  },
  matchAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  matchAvatarInitial: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarInitialText: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
  },
  matchSparkWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  matchSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  matchActions: {
    width: "100%",
    gap: 10,
  },
  matchMsgBtn: {
    backgroundColor: "#000",
    borderRadius: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  matchMsgBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  matchSkipBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  matchSkipBtnText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },
});
