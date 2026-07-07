import type { PublicProfileUserData } from "@/types/profiles";
import {
  trackPublicProfileOpenedFromMessage,
  trackUnmatchConfirmed,
  trackUserReported,
} from "@/lib/analytics/mixpanel";
import {
  reportUser,
  unmatchConversation,
  type ReportReason,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  MessageCircle,
  MoreHorizontal,
  Send,
  Sparkles,
  User,
  UserCheck,
} from "@/components/ui/icons";
import React, { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { Conversation } from "../MessagesView";
import { CharCounter } from "../ui/CharCounter";
import { ProfileDetailSheet } from "../ui/ProfileDetailSheet";
import { ReferralFlowModal } from "./ReferralFlowModal";
import { ThreadContextStrip } from "./ThreadContextStrip";
import { ThreadMenuSheet } from "./ThreadMenuSheet";
import { threadScreenStyles as styles } from "./threadScreenStyles";

function getConversationStarters(
  conversation: any,
  userType: "applicant" | "sponsor",
): string[] {
  const jobTitle: string | undefined = conversation?.jobContext?.jobTitle;
  const company: string | undefined =
    conversation?.jobContext?.company || conversation?.company;
  const skill: string | undefined =
    Array.isArray(conversation?.skills) && conversation.skills.length > 0
      ? conversation.skills[0]
      : undefined;

  if (userType === "applicant") {
    return [
      company
        ? `What's the team culture like at ${company}?`
        : "What's the team culture like there?",
      jobTitle
        ? `What's the interview process like for the ${jobTitle} role?`
        : "What's the interview process like?",
      company
        ? `What made you want to work at ${company}?`
        : "What made you want to work there?",
    ];
  }

  return [
    jobTitle
      ? `What interests you about the ${jobTitle} role?`
      : "What are you looking for in your next role?",
    skill
      ? `I noticed you know ${skill} — how have you used that day to day?`
      : "Tell me a bit about your background.",
    "What's most important to you in your next role?",
  ];
}

/** Normalize a backend ISO string to UTC (append 'Z' when no offset present). */
function normalizeToUtc(s: string): string {
  const t = s.trim();
  return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t) ? s : `${s}Z`;
}

interface ThreadScreenProps {
  conversations: Conversation[];
  setConversations: (
    next: Conversation[] | ((prev: Conversation[]) => Conversation[]),
  ) => void;
  selectedConversation: string;
  userType: "applicant" | "sponsor";
  referredSet: Set<string>;
  setReferredSet: React.Dispatch<React.SetStateAction<Set<string>>>;
  messages: any[];
  currentUserId: string | null;
  conversationsLoading: boolean;
  handleConversationSelect: (conversationId: string | null) => void;
  keyboardSpacerStyle: any;
  scrollViewRef: React.RefObject<ScrollView | null>;
  scrollToBottom: (animated?: boolean) => void;
  messagesLoading: boolean;
  messagesError: string | null;
  initialMessageCountRef: React.MutableRefObject<number>;
  sendingMessage: boolean;
  /** Takes the composer text as a parameter (rather than reading parent
   * closure state) and reports success/failure so this component can
   * restore the draft on a failed send — see the call site below. */
  handleSendMessage: (text: string) => Promise<boolean>;
  onShowPublicProfile?: (userData: PublicProfileUserData) => void;
}

/**
 * The open-thread view: header, message list, composer, and the
 * referral-flow/thread-menu modal instances.
 *
 * Stage 3b of the ThreadScreen work: messageText, tappedMessageId,
 * showProfileModal, showReferralFlow, showUnmatchMenu, isUnmatching, and
 * isReporting are all local state now (a state-ownership audit found no
 * other readers in MessagesView), so they start fresh every time this
 * component mounts — i.e. every time a conversation is opened, either by
 * going back to the list first (already unmounted this view) or directly
 * via the `key={selectedConversation}` on the call site in MessagesView
 * (deep-link thread-to-thread navigation). This is what fixes the three
 * previously-signed-off bugs: stale draft text leaking into the next
 * conversation, the referral flow reappearing after backing out mid-flow,
 * and the tapped-timestamp reveal not resetting.
 *
 * messages/messagesLoading/messagesError/sendingMessage and their
 * WebSocket/fetch effects stay in MessagesView — that state is already
 * correctly reset by its own effect (keyed on selectedConversation)
 * regardless of where it lives, so moving it wouldn't fix anything and
 * would add real risk (reconnect/reconciliation logic) for no behavior
 * change.
 */
export function ThreadScreen({
  conversations,
  setConversations,
  selectedConversation,
  userType,
  referredSet,
  setReferredSet,
  messages,
  currentUserId,
  conversationsLoading,
  handleConversationSelect,
  keyboardSpacerStyle,
  scrollViewRef,
  scrollToBottom,
  messagesLoading,
  messagesError,
  initialMessageCountRef,
  sendingMessage,
  handleSendMessage,
  onShowPublicProfile,
}: ThreadScreenProps) {
  const showToast = useToastStore((state) => state.showToast);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReferralFlow, setShowReferralFlow] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);
  const [showUnmatchMenu, setShowUnmatchMenu] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const openReferral = () => {
    setShowProfileModal(false);
    setShowReferralFlow(true);
  };

  const onSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || sendingMessage) return;
    setMessageText("");
    const ok = await handleSendMessage(trimmed);
    if (!ok) setMessageText(trimmed);
  };

  const handleUnmatch = async () => {
    try {
      setIsUnmatching(true);
      trackUnmatchConfirmed({ conversationId: selectedConversation });
      await unmatchConversation(selectedConversation);
      // Mark the conversation CLOSED rather than dropping it. This moves it
      // into the "Past Connections" section (instead of making it vanish),
      // and keeps `selectedConversation` pointing at a row that still
      // exists — so the thread can't flash a "Conversation not found"
      // screen in the render between this update and navigating away.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation
            ? { ...c, status: "CLOSED" as const }
            : c,
        ),
      );
      setShowUnmatchMenu(false);
      handleConversationSelect(null);
    } catch (err) {
      console.warn("[ThreadScreen] Failed to unmatch:", err);
      setShowUnmatchMenu(false);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to unmatch. Please try again.",
        "error",
      );
    } finally {
      setIsUnmatching(false);
    }
  };

  // Report a user, then close the conversation the same way Unmatch does.
  // The block/close effect always happens via the already-shipped unmatch
  // endpoint, regardless of whether the report itself was recorded — see
  // reportUser()'s doc comment for why that's split this way.
  const handleSubmitReport = async (reason: ReportReason, detail: string) => {
    const reportedUserId = conversations.find(
      (c) => c.id === selectedConversation,
    )?.otherParticipant?.id;
    setIsReporting(true);
    try {
      if (reportedUserId) {
        await reportUser({
          reportedUserId: String(reportedUserId),
          reason,
          detail: detail.trim() || undefined,
          conversationId: selectedConversation,
        });
        trackUserReported({ reason, fromConversation: true });
      }
      await unmatchConversation(selectedConversation);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation
            ? { ...c, status: "CLOSED" as const }
            : c,
        ),
      );
      setShowUnmatchMenu(false);
      handleConversationSelect(null);
      showToast("Reported. This conversation has been closed.", "success");
    } catch (err) {
      console.warn("[ThreadScreen] Failed to close reported conversation:", err);
      setShowUnmatchMenu(false);
      showToast(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
        "error",
      );
    } finally {
      setIsReporting(false);
    }
  };

  const formatDayHeader = (timestamp: string) => {
    const date = new Date(normalizeToUtc(timestamp));
    const now = new Date();
    const todayDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const msgDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (msgDate.getTime() === todayDate.getTime()) {
      return `Today · ${timeStr}`;
    } else if (msgDate.getTime() === yesterdayDate.getTime()) {
      return `Yesterday · ${timeStr}`;
    } else {
      const sameYear = date.getFullYear() === now.getFullYear();
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
      });
      return `${dateStr} · ${timeStr}`;
    }
  };


const conversation = conversations.find(
  (c) => c.id === selectedConversation,
);

// In-thread referral prompt eligibility (sponsor only) — after a real
// back-and-forth (3+ messages each way), nudge the sponsor toward the
// Refer flow instead of relying on them remembering the header button
// exists. Plain computation, not useMemo/hook — this whole block is
// inside a conditional branch of the component, so a hook here would
// violate the Rules of Hooks. Message lists are small enough that
// recomputing this every render is cheap.
let sponsorReferralPromptEligible = false;
if (userType === "sponsor" && conversation?.otherParticipant?.id) {
  const applicantId = conversation.otherParticipant.id;
  const jobId = conversation.jobContext?.jobId;
  const alreadyReferred =
    !!(applicantId && jobId) &&
    referredSet.has(`${applicantId}:${jobId}`);
  if (!alreadyReferred) {
    let mine = 0;
    let theirs = 0;
    for (const m of messages) {
      const isMine = currentUserId
        ? m.senderId === currentUserId ||
          m.senderId === "me" ||
          (m.id.startsWith("temp-") && !m.serverId)
        : m.id.startsWith("temp-") || m.senderId === "me";
      if (isMine) mine++;
      else theirs++;
    }
    sponsorReferralPromptEligible = mine >= 3 && theirs >= 3;
  }
}

if (!conversation) {
  // Conversations are still fetching — show a loading state so we don't flash
  // a false "not found" message while the async fetch completes after a
  // re-mount (e.g. navigating back from the public profile view).
  if (conversationsLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#F4F4F5",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <MessageCircle color="#BBB" size={28} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#AAA" }}>
          Loading conversation…
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 16, color: "#666" }}>
        Conversation not found
      </Text>
      <TouchableOpacity
        onPress={() => handleConversationSelect(null)}
        style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: "#000",
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "700" }}>
          Back to Messages
        </Text>
      </TouchableOpacity>
    </View>
  );
}

return (
  <View style={{ flex: 1 }}>
    <Animated.View style={[styles.chatContainer, keyboardSpacerStyle]}>
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => handleConversationSelect(null)}
          style={styles.backButton}
        >
          <ArrowLeft color="#000" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIdentity}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.7}
        >
          {conversation.otherParticipant.profileImageUrl ? (
            <Image
              source={{
                uri: conversation.otherParticipant.profileImageUrl,
              }}
              style={styles.headerImage}
            />
          ) : (
            <View
              style={[
                styles.headerImage,
                {
                  backgroundColor: "#000",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: "#FFF" }}
              >
                {(conversation.otherParticipant.name ||
                  "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {conversation.otherParticipant.name}
            </Text>
            <Text style={styles.headerRole}>
              {conversation.otherParticipant.role &&
              conversation.otherParticipant.company
                ? `${conversation.otherParticipant.role} @ ${conversation.otherParticipant.company}`
                : conversation.otherParticipant.role ||
                  conversation.otherParticipant.company ||
                  ""}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {/* Hide the Refer button and three-dots (unmatch) menu on
              closed threads — the action is moot (you can't refer
              someone you're no longer matched with, and you can't
              unmatch what's already unmatched). The profile-image and
              name tap target above stays live so the profile sheet
              still opens. */}
          {conversation.status !== "CLOSED" && (
            <>
              {userType === "sponsor" ? (
                (() => {
                  const applicantId = conversation.otherParticipant?.id;
                  const jobId = conversation.jobContext?.jobId;
                  const alreadyReferred =
                    !!(applicantId && jobId) &&
                    referredSet.has(`${applicantId}:${jobId}`);
                  return alreadyReferred ? (
                    <View style={styles.headerReferBtn}>
                      <CheckCircle
                        color="#000"
                        size={17}
                        strokeWidth={2.5}
                      />
                      <Text
                        style={[
                          styles.headerReferText,
                          styles.headerReferTextDone,
                        ]}
                      >
                        Referred
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.headerReferBtn}
                      onPress={openReferral}
                      activeOpacity={0.7}
                    >
                      <UserCheck color="#000" size={20} />
                      <Text style={styles.headerReferText}>Refer</Text>
                    </TouchableOpacity>
                  );
                })()
              ) : null}
              <TouchableOpacity
                style={styles.headerMoreBtn}
                onPress={() => setShowUnmatchMenu(true)}
                activeOpacity={0.7}
              >
                <MoreHorizontal color="#000" size={20} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      {/* Pins which role this thread is about — the header above only
          says who you're talking to. Shown on closed threads too, since
          context matters most when reviewing an old conversation. */}
      <ThreadContextStrip
        jobTitle={conversation.jobContext?.jobTitle}
        company={conversation.jobContext?.company}
        logoUrl={conversation.jobContext?.logoUrl}
        onPress={() => setShowProfileModal(true)}
      />
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToBottom(false)}
      >
        {messagesLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: "#999", fontSize: 15 }}>
              Loading messages...
            </Text>
          </View>
        ) : messagesError ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text
              style={{ color: "#DC2626", fontSize: 15, marginBottom: 8 }}
            >
              Failed to load messages
            </Text>
            <Text
              style={{ color: "#999", fontSize: 13, textAlign: "center" }}
            >
              {messagesError}
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={{ padding: 28, alignItems: "center" }}>
            <Text style={{ color: "#999", fontSize: 15 }}>
              No messages yet
            </Text>
            <Text
              style={{
                color: "#BBB",
                fontSize: 13,
                marginTop: 8,
                marginBottom: 20,
              }}
            >
              Start the conversation!
            </Text>
            {/* Conversation starters — most matches die in silence
                because someone has to write the awkward first message.
                Tapping fills the composer rather than sending straight
                away, so the user still reviews/personalizes it. */}
            <View style={styles.startersHeader}>
              <Sparkles size={13} color="#999" strokeWidth={2.2} />
              <Text style={styles.startersHeaderText}>BREAK THE ICE</Text>
            </View>
            <View style={styles.startersList}>
              {getConversationStarters(conversation, userType).map(
                (starter, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.starterChip}
                    onPress={() => setMessageText(starter)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.starterChipText}>{starter}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </View>
        ) : (
          (() => {
            // A message is mine if:
            //  1. sender matches the resolved currentUserId
            //  2. it is still an unreconciled optimistic temp (senderId may be "me" or real ID)
            //  3. senderId is literally "me" (fallback before currentUserId loaded)
            const isMine = (m: any) =>
              currentUserId
                ? m.senderId === currentUserId ||
                  m.senderId === "me" ||
                  (m.id.startsWith("temp-") && !m.serverId)
                : m.id.startsWith("temp-") || m.senderId === "me";
            // Two messages cluster when the same sender sends them within
            // a couple of minutes on the same day — clustered bubbles sit
            // tight together with softened facing corners (the iMessage/
            // WhatsApp convention) instead of every bubble floating with
            // identical spacing.
            const CLUSTER_WINDOW_MS = 2 * 60 * 1000;
            const clustersWith = (a: any, b: any) =>
              !!a &&
              !!b &&
              isMine(a) === isMine(b) &&
              new Date(a.createdAt).toDateString() ===
                new Date(b.createdAt).toDateString() &&
              Math.abs(
                new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              ) < CLUSTER_WINDOW_MS;

            return messages.map((message, index) => {
              const isMyMessage = isMine(message);
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const nextMessage =
                index < messages.length - 1 ? messages[index + 1] : null;
              const isFirstOfDay =
                !prevMessage ||
                new Date(message.createdAt).toDateString() !==
                  new Date(prevMessage.createdAt).toDateString();
              const clusteredWithPrev =
                !isFirstOfDay && clustersWith(prevMessage, message);
              const clusteredWithNext = clustersWith(message, nextMessage);
              const isTapped = tappedMessageId === message.id;

              return (
                <React.Fragment key={message.id}>
                  {isFirstOfDay && (
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayHeaderText}>
                        {formatDayHeader(message.createdAt)}
                      </Text>
                    </View>
                  )}
                  <Animated.View
                    // Only messages that arrived after the thread was
                    // opened (a new incoming message, or one just sent)
                    // fade in — already-loaded history renders instantly.
                    entering={
                      index >= initialMessageCountRef.current
                        ? FadeInUp.duration(220)
                        : undefined
                    }
                    style={[
                      styles.messageWrapper,
                      isMyMessage ? styles.msgRight : styles.msgLeft,
                      {
                        marginTop: isFirstOfDay
                          ? 0
                          : clusteredWithPrev
                            ? 3
                            : 20,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        setTappedMessageId(isTapped ? null : message.id)
                      }
                      style={[
                        styles.bubble,
                        isMyMessage ? styles.bubbleMe : styles.bubbleThem,
                        clusteredWithPrev &&
                          (isMyMessage
                            ? styles.bubbleClusterTopMe
                            : styles.bubbleClusterTopThem),
                        clusteredWithNext &&
                          (isMyMessage
                            ? styles.bubbleClusterBottomMe
                            : styles.bubbleClusterBottomThem),
                      ]}
                    >
                      <Text
                        style={isMyMessage ? styles.txtMe : styles.txtThem}
                      >
                        {message.content}
                      </Text>
                    </TouchableOpacity>
                    {isTapped && (
                      <Text style={styles.msgTime}>
                        {new Date(message.createdAt).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </Text>
                    )}
                  </Animated.View>
                </React.Fragment>
              );
            });
          })()
        )}
      </ScrollView>
      {conversation.status === "CLOSED" ? (
        // Closed-thread notice — replaces the input area entirely so
        // the user can't even attempt to type. Matches the backend's
        // behavior (it rejects sends with "conversation is closed");
        // surfacing it pre-emptively avoids the "I typed it but it
        // never sent" confusion.
        <View style={styles.closedNotice}>
          <Text style={styles.closedNoticeText}>
            This conversation has been closed. You are no longer matched.
          </Text>
        </View>
      ) : (
        <View>
          {/* In-thread referral nudge (sponsor only) — see
              sponsorReferralPromptEligible above. Disappears on its own
              once the sponsor actually refers (alreadyReferred flips),
              no dismiss needed. */}
          {sponsorReferralPromptEligible && (
            <TouchableOpacity
              style={styles.referralNudge}
              onPress={openReferral}
              activeOpacity={0.8}
            >
              <View style={styles.referralNudgeIconCircle}>
                <UserCheck color="#FFF" size={16} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralNudgeTitle}>
                  Feeling good about{" "}
                  {conversation.otherParticipant.name.split(" ")[0]}?
                </Text>
                <Text style={styles.referralNudgeSubtitle}>
                  Tap to refer them for the role
                </Text>
              </View>
              <ChevronRight size={18} color="#999" />
            </TouchableOpacity>
          )}
          {/* Only surface the counter as you approach the 2000-char cap so
              it doesn't clutter normal chatting. */}
          {messageText.length >= 1800 && (
            <CharCounter
              count={messageText.length}
              max={2000}
              style={{ marginRight: 16, marginBottom: 4, marginTop: 0 }}
            />
          )}
          <View style={styles.inputArea}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Write a message..."
            placeholderTextColor="#BBB"
            style={styles.textInput}
            multiline
            maxLength={2000}
            autoCapitalize="sentences"
            onFocus={() => setTimeout(() => scrollToBottom(true), 150)}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!messageText.trim() || sendingMessage) && { opacity: 0.5 },
            ]}
            onPress={onSend}
            disabled={!messageText.trim() || sendingMessage}
          >
            <Send color="#FFF" size={18} strokeWidth={2.5} />
          </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>

    {/* PROFILE SHEET — opened when the user taps the participant's
        name or avatar at the top of the thread. Powered by the shared
        ProfileDetailSheet so it matches the layout we use on
        MatchesView and JobsView. Sponsor side gets two CTAs (View
        Full Profile + Provide Referral); applicant side gets just
        View Full Profile. */}
    {conversation && (
      <ProfileDetailSheet
        visible={showProfileModal}
        onDismiss={() => setShowProfileModal(false)}
        userId={String(conversation.otherParticipant?.id || "")}
        variant={userType === "sponsor" ? "applicant" : "sponsor"}
        initial={{
          name: conversation.otherParticipant?.name || "",
          image: conversation.otherParticipant?.profileImageUrl ?? undefined,
          role: conversation.otherParticipant?.role,
          company: conversation.otherParticipant?.company,
        }}
        roleContext={
          conversation.jobContext?.jobTitle
            ? {
                label:
                  userType === "sponsor" ? "INTERESTED IN" : "CONNECTED ON",
                title: conversation.jobContext.jobTitle,
                company: conversation.jobContext.company,
                logoUrl: conversation.jobContext.logoUrl,
              }
            : undefined
        }
        primaryCta={
          userType === "sponsor"
            ? {
                label: "Provide Referral",
                icon: (
                  <UserCheck color="#FFF" size={18} strokeWidth={2.5} />
                ),
                onPress: openReferral,
              }
            : {
                label: "View Full Profile",
                icon: <User color="#FFF" size={18} strokeWidth={2.5} />,
                onPress: () => {
                  setShowProfileModal(false);
                  const otherUserId = conversation.otherParticipant?.id;
                  if (otherUserId) {
                    trackPublicProfileOpenedFromMessage({
                      viewedUserId: String(otherUserId),
                    });
                  }
                  if (onShowPublicProfile) {
                    onShowPublicProfile({ ...conversation });
                  }
                },
              }
        }
        secondaryCta={
          userType === "sponsor"
            ? {
                label: "View Full Profile",
                icon: <User color="#000" size={18} strokeWidth={2.5} />,
                onPress: () => {
                  setShowProfileModal(false);
                  const otherUserId = conversation.otherParticipant?.id;
                  if (otherUserId) {
                    trackPublicProfileOpenedFromMessage({
                      viewedUserId: String(otherUserId),
                    });
                  }
                  if (onShowPublicProfile) {
                    onShowPublicProfile({ ...conversation });
                  }
                },
              }
            : undefined
        }
      />
    )}

    {/* Referral flow — extracted to
        components/messages/ReferralFlowModal.tsx (self-contained: the
        step, checkboxes, submit/error state, and lazily-fetched
        candidate profile have zero readers outside this modal, per the
        state-ownership audit). */}
    <Modal visible={showReferralFlow} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowReferralFlow(false)}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </TouchableOpacity>
        <ReferralFlowModal
          visible={showReferralFlow}
          conversation={conversation}
          onClose={() => setShowReferralFlow(false)}
          onSubmitted={(applicantUserId, jobId) => {
            setReferredSet((prev) => {
              const next = new Set(prev);
              next.add(`${applicantUserId}:${jobId}`);
              return next;
            });
          }}
        />
      </View>
    </Modal>

    {/* THREAD MENU SHEET — extracted to
        components/messages/ThreadMenuSheet.tsx (self-contained: its
        step/reason/detail state has zero readers outside the sheet,
        per the state-ownership audit). */}
    <Modal visible={showUnmatchMenu} transparent animationType="none">
      <ThreadMenuSheet
        visible={showUnmatchMenu}
        participantName={conversation.otherParticipant.name}
        isUnmatching={isUnmatching}
        isReporting={isReporting}
        onUnmatch={handleUnmatch}
        onReport={handleSubmitReport}
        onClose={() => setShowUnmatchMenu(false)}
      />
    </Modal>
  </View>
);
}
