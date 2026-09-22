import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
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
import { Colors, Fonts, Type } from "@/constants/theme";
import { useResponsive } from "@/lib/responsive";

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
  // On iPad the card is capped (see matchCard) rather than shrunk to look
  // like a form, so it has real width to spare — scale the avatars up a
  // touch to fill it instead of looking sparse.
  const { isRegular } = useResponsive();
  const avatarWrapperSize = isRegular ? 96 : 80;
  const avatarSize = isRegular ? 88 : 74;

  const matchRingScale = useSharedValue(0.8);
  const matchRingOpacity = useSharedValue(0);

  // Pulse-ring that radiates outward from both avatars when a mutual match fires
  useEffect(() => {
    if (matchedUser) {
      // The app's biggest moment finally lands physically too — it was
      // the one celebration with no haptic.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
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
        <BlurView intensity={92} style={StyleSheet.absoluteFill} tint="light" />

        <View style={styles.matchModalOverlay}>
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(180)}
            style={styles.matchCard}
          >
            {/* Eyebrow — the caps voice, no pill */}
            <Animated.View entering={FadeInDown.delay(150).duration(350)}>
              <Text style={styles.matchEyebrow}>A MUTUAL MATCH</Text>
            </Animated.View>

            {/* Avatar row */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(400)}
              style={styles.matchAvatarRow}
            >
              {/* Current user's avatar */}
              <View
                style={[
                  styles.matchAvatarWrapper,
                  { width: avatarWrapperSize, height: avatarWrapperSize },
                ]}
              >
                <Animated.View
                  style={[
                    styles.matchAvatarRing,
                    {
                      width: avatarWrapperSize,
                      height: avatarWrapperSize,
                      borderRadius: avatarWrapperSize / 2,
                    },
                    matchRingStyle,
                  ]}
                />
                {profileData?.personal?.profileImage ? (
                  <Image
                    source={{ uri: profileData.personal.profileImage }}
                    style={[
                      styles.matchAvatar,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.matchAvatar,
                      styles.matchAvatarInitial,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                      },
                    ]}
                  >
                    <Text style={styles.matchAvatarInitialText}>
                      {(profileData?.personal?.firstName || "Y")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Connector between the two avatars */}
              <View style={styles.matchSparkWrapper}>
                <Heart size={18} color={Colors.ink} strokeWidth={2.2} />
              </View>

              {/* Matched user's avatar */}
              <View
                style={[
                  styles.matchAvatarWrapper,
                  { width: avatarWrapperSize, height: avatarWrapperSize },
                ]}
              >
                <Animated.View
                  style={[
                    styles.matchAvatarRing,
                    {
                      width: avatarWrapperSize,
                      height: avatarWrapperSize,
                      borderRadius: avatarWrapperSize / 2,
                    },
                    matchRingStyle,
                  ]}
                />
                {matchedUser?.image ? (
                  <Image
                    source={{ uri: matchedUser.image }}
                    style={[
                      styles.matchAvatar,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.matchAvatar,
                      styles.matchAvatarInitial,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                      },
                    ]}
                  >
                    <Text style={styles.matchAvatarInitialText}>
                      {(matchedUser?.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <Text style={styles.matchTitle}>
                It’s a <Text style={styles.matchTitleAccent}>match.</Text>
              </Text>
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
                <MessageCircle size={18} color={Colors.paper} />
                <Text style={styles.matchMsgBtnText}>MESSAGE NOW</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchSkipBtn}
                onPress={onDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.matchSkipBtnText}>KEEP GOING</Text>
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
  // The stage — no card, no shadow: the moment plays on the frosted page
  // itself, the way the Broadcast beats do.
  matchCard: {
    width: "100%",
    // Capped like DeckDoneCard's 420 — a celebratory full-screen moment,
    // so bounded-but-wide rather than shrunk to a form column. Uncapped,
    // the 54pt action pills below stretched to ~952pt on a 13" iPad.
    maxWidth: 460,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  matchEyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.muted,
    marginBottom: 26,
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
    borderColor: Colors.ink,
  },
  matchAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: Colors.paper,
  },
  matchAvatarInitial: {
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarInitialText: {
    fontFamily: Fonts.serif,
    color: Colors.paper,
    fontSize: 28,
  },
  matchSparkWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  matchTitle: {
    ...Type.title,
    color: Colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  // The site's .hero-title em rule — italic muted accent word.
  matchTitleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  matchSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    color: Colors.body,
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
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  matchMsgBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.paper,
  },
  matchSkipBtn: {
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  matchSkipBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.body,
  },
});
