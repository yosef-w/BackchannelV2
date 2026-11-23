import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { MessageCircle } from "@/components/ui/icons";
import React, { useEffect } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { PressableScale } from "@/components/ui/PressableScale";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { Colors, Fonts, Type } from "@/constants/theme";
import { FontScale, useResponsive } from "@/lib/responsive";

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

// ── Motion ────────────────────────────────────────────────────────────────
// One unhurried sequence, every move on the same long-deceleration curve
// and none of them overshooting: the page settles, the two people glide
// toward each other, a hairline joins them, then the words and the actions
// arrive in order. About a second and a half end to end.
const SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
/** How far apart the two avatars start, each side. */
const APART = 26;
const T = {
  avatarsIn: 140,
  avatarsMs: 760,
  /** The avatars have all but arrived — the join, the haptic, the ring. */
  meet: 620,
  joinMs: 420,
  ringMs: 900,
  title: 560,
  body: 680,
  role: 780,
  actions: 900,
  textMs: 520,
} as const;

/** Text blocks rise 10pt into place as they fade — enough to feel placed,
 * not enough to read as a slide. */
const rise = (delay: number) =>
  FadeInUp.delay(delay)
    .duration(T.textMs)
    .easing(SETTLE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });

/**
 * The connection moment: both people said yes. A calm, near-opaque frosted
 * page over the feed — solid enough that the words never fight the photo
 * behind them — with the two people joined by a hairline, what happened in
 * plain words, the role it's about, and the one thing to do next.
 *
 * Deliberately not a dating-app "match": no heart, no "It's a match". Two
 * professionals were introduced.
 *
 * Self-contained (extracted from HomeView): keyed off the `matchedUser`
 * prop. `matchedUser` itself stays with the caller, as do the dismiss and
 * message handlers, passed down as onDismiss/onMessage.
 */
export function MatchCelebrationModal({
  matchedUser,
  userType,
  onDismiss,
  onMessage,
}: MatchCelebrationModalProps) {
  const profileData = useUserProfileStore((state) => state.data);
  // On iPad the stage is capped (see `stage`) rather than shrunk to look
  // like a form, so it has real width to spare — scale the avatars up a
  // touch to fill it instead of looking sparse.
  const { isRegular } = useResponsive();
  const reduceMotion = useReducedMotion();
  const avatarSize = isRegular ? 96 : 84;

  const approach = useSharedValue(0); // 0 apart → 1 together
  const join = useSharedValue(0); // the hairline between them, 0 → 1
  const ring = useSharedValue(0); // one soft pulse as they meet

  // Keyed on WHO matched, not on the object: a caller that passes a fresh
  // object each render would otherwise restart the sequence every time.
  const matchKey = matchedUser
    ? `${matchedUser.userId ?? ""}|${matchedUser.jobId ?? ""}|${matchedUser.name}`
    : null;
  useEffect(() => {
    if (!matchKey) return;
    approach.value = 0;
    join.value = 0;
    ring.value = 0;
    if (reduceMotion) {
      approach.value = 1;
      join.value = 1;
    } else {
      approach.value = withDelay(
        T.avatarsIn,
        withTiming(1, { duration: T.avatarsMs, easing: SETTLE }),
      );
      join.value = withDelay(T.meet, withTiming(1, { duration: T.joinMs, easing: SETTLE }));
      ring.value = withDelay(
        T.meet,
        withTiming(1, { duration: T.ringMs, easing: Easing.out(Easing.quad) }),
      );
    }
    // The haptic lands as the two meet, not when the page opens.
    const haptic = setTimeout(
      () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      },
      reduceMotion ? 0 : T.meet,
    );
    return () => clearTimeout(haptic);
  }, [matchKey, reduceMotion, approach, join, ring]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: approach.value,
    transform: [{ translateX: -APART * (1 - approach.value) }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: approach.value,
    transform: [{ translateX: APART * (1 - approach.value) }],
  }));
  const joinStyle = useAnimatedStyle(() => ({
    opacity: join.value,
    transform: [{ scaleX: join.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.2 * (1 - ring.value) * (ring.value > 0 ? 1 : 0),
    transform: [{ scale: 1 + 0.42 * ring.value }],
  }));

  const first = (matchedUser?.name || "").trim().split(/\s+/)[0] || "";
  const role = (matchedUser?.jobTitle || "").trim();
  const myInitial = (profileData?.personal?.firstName || "Y")[0].toUpperCase();
  const myImage = profileData?.personal?.profileImage;
  const sentence = first
    ? userType === "sponsor"
      ? `${first} is interested in your role, and you chose to connect.`
      : `${first} can sponsor you, and you're both interested.`
    : "You're both interested.";

  const avatar = (uri: string | undefined | null, initial: string) => (
    <View style={[styles.avatarFrame, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: avatarSize - 8,
            height: avatarSize - 8,
            borderRadius: (avatarSize - 8) / 2,
          }}
        />
      ) : (
        <View
          style={[
            styles.avatarInitial,
            {
              width: avatarSize - 8,
              height: avatarSize - 8,
              borderRadius: (avatarSize - 8) / 2,
            },
          ]}
        >
          <Text style={styles.avatarInitialText} maxFontSizeMultiplier={1}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={!!matchedUser}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(260)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        {/* Frost for depth, then a near-solid paper wash for legibility:
            the text reads the same over any photo. */}
        <BlurView intensity={70} style={StyleSheet.absoluteFill} tint="light" />
        <View style={[StyleSheet.absoluteFill, styles.wash]} />

        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.stage}>
            <Animated.Text
              entering={FadeIn.delay(80).duration(420)}
              style={styles.eyebrow}
              maxFontSizeMultiplier={FontScale.label}
            >
              YOU BOTH SAID YES
            </Animated.Text>

            {/* The two people, joined */}
            <View
              style={styles.avatarRow}
              accessible
              accessibilityLabel={first ? `You and ${matchedUser?.name}` : "You are connected"}
            >
              <Animated.View style={leftStyle}>
                <Animated.View
                  style={[
                    styles.ring,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                    ringStyle,
                  ]}
                />
                {avatar(myImage, myInitial)}
              </Animated.View>
              <Animated.View style={[styles.join, joinStyle]} />
              <Animated.View style={rightStyle}>
                <Animated.View
                  style={[
                    styles.ring,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                    ringStyle,
                  ]}
                />
                {avatar(matchedUser?.image, (matchedUser?.name || "?")[0].toUpperCase())}
              </Animated.View>
            </View>

            <Animated.View entering={reduceMotion ? undefined : rise(T.title)}>
              <Text style={styles.title} accessibilityRole="header">
                You&apos;re <Text style={styles.titleAccent}>connected.</Text>
              </Text>
            </Animated.View>

            <Animated.View entering={reduceMotion ? undefined : rise(T.body)}>
              <Text style={styles.sentence}>{sentence}</Text>
            </Animated.View>

            {/* The role this is about — one ruled line, the ledger voice. */}
            {role ? (
              <Animated.View
                entering={reduceMotion ? undefined : rise(T.role)}
                style={styles.roleRow}
              >
                <Text style={styles.roleKey} maxFontSizeMultiplier={FontScale.label}>
                  ROLE
                </Text>
                <Text style={styles.roleValue} numberOfLines={2}>
                  {role}
                </Text>
              </Animated.View>
            ) : null}

            <Animated.View
              entering={reduceMotion ? undefined : rise(T.actions)}
              style={styles.actions}
            >
              <PressableScale
                style={styles.primary}
                pressedScale={0.97}
                onPress={onMessage}
                accessibilityRole="button"
                accessibilityLabel={first ? `Message ${first}` : "Send a message"}
              >
                <MessageCircle size={18} color={Colors.paper} />
                <Text
                  style={styles.primaryText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={FontScale.label}
                >
                  {first ? `MESSAGE ${first.toUpperCase()}` : "SEND A MESSAGE"}
                </Text>
              </PressableScale>

              <TouchableOpacity
                onPress={onDismiss}
                activeOpacity={0.7}
                style={styles.secondary}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText} maxFontSizeMultiplier={FontScale.label}>
                  {userType === "sponsor" ? "KEEP REVIEWING" : "KEEP BROWSING"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Near-solid: the frost underneath only softens the edges of what's
  // behind; it never has to carry the contrast.
  wash: { backgroundColor: "rgba(255,255,255,0.93)" },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  // No card, no shadow: the moment plays on the page itself. Capped so the
  // action pill doesn't stretch across an iPad.
  stage: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    alignItems: "center",
  },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.muted,
    marginBottom: 28,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  // A paper mat inside a hairline ink ring — a framed portrait, not a
  // sticker.
  avatarFrame: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  avatarInitial: {
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontFamily: Fonts.serif,
    color: Colors.paper,
    fontSize: 30,
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  join: {
    width: 36,
    height: 1,
    backgroundColor: Colors.ink,
  },
  title: {
    ...Type.title,
    fontSize: 36,
    lineHeight: 40,
    color: Colors.ink,
    textAlign: "center",
  },
  // The site's .hero-title em rule — italic muted accent word.
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  sentence: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.body,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  roleRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 24,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roleKey: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.muted,
  },
  roleValue: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 23,
    color: Colors.ink,
    textAlign: "right",
  },
  actions: {
    alignSelf: "stretch",
    marginTop: 28,
    gap: 6,
  },
  primary: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  primaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2,
    color: Colors.paper,
    flexShrink: 1,
  },
  // Quiet text, not a second bordered button beside the filled pill.
  secondary: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.muted,
  },
});
