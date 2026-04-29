import {
    getBasicProfile,
    getConversationMessages,
    getConversations,
    getPublicProfile,
    sendMessage,
    submitReferral,
    unmatchConversation,
} from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { BlurView } from "expo-blur";
import {
    ArrowLeft,
    Award,
    Briefcase,
    Check,
    CheckCircle,
    ChevronRight,
    ClipboardCheck,
    Clock,
    FileText,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Send,
    ShieldCheck,
    User,
    UserCheck,
    X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Keyboard,
    Linking,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    FadeInDown,
    FadeInUp,
    SlideInDown,
    SlideOutDown,
    useAnimatedKeyboard,
    useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

interface MessagesViewProps {
  onThreadActiveChange?: (isThreadActive: boolean) => void;
  userType?: "applicant" | "sponsor";
  onShowPublicProfile?: (userData: any) => void;
  selectedConversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  pendingJobId?: string | null;
  onPendingJobConsumed?: () => void;
}

export function MessagesView({
  onThreadActiveChange,
  userType = "sponsor",
  onShowPublicProfile,
  selectedConversationId: externalSelectedConversationId,
  onConversationChange,
  pendingJobId,
  onPendingJobConsumed,
}: MessagesViewProps) {
  // Store current user ID from profile API to determine which participant to show
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(externalSelectedConversationId ?? null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [showReferralFlow, setShowReferralFlow] = useState(false);
  const [referralStep, setReferralStep] = useState(1);
  const [activeSlide, setActiveSlide] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [hasMessaged, setHasMessaged] = useState(false);
  const [feelsConfident, setFeelsConfident] = useState(false);
  const [knowsBackground, setKnowsBackground] = useState(false);
  const [comfortableAttaching, setComfortableAttaching] = useState(false);
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  // Real data state
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [conversationsTotalCount, setConversationsTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sendingMessage, setSendingMessage] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);

  // Referral flow — full public profile of the applicant being referred
  const [referralProfile, setReferralProfile] = useState<any>(null);
  const [referralProfileLoading, setReferralProfileLoading] = useState(false);

  // Unmatch
  const [showUnmatchMenu, setShowUnmatchMenu] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);

  // Fetch current user profile to get USER_ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const profile = await getBasicProfile();
        console.log("[MessagesView] Current user profile:", profile);
        setCurrentUserId(profile.USER_ID);
      } catch (err) {
        console.warn("[MessagesView] Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      if (!currentUserId) {
        console.log("[MessagesView] Waiting for current user ID...");
        return;
      }

      try {
        setConversationsLoading(true);
        console.log("[MessagesView] Fetching conversations...");

        const response = await getConversations({ limit: 20, offset: 0 });
        console.log("[MessagesView] Conversations response:", response);

        setConversationsTotalCount(
          response.total_count ?? response.conversations.length,
        );

        // Transform UPPERCASE PostgreSQL fields to our UI format
        // Determine which participant is "the other person" based on current user ID
        const transformedConversations = response.conversations.map((conv) => {
          const c = conv as any; // backend returns richer fields than typed stub
          const isCurrentUserApplicant = c.APPLICANT_USER_ID === currentUserId;

          // Show the OTHER person's info
          const otherPersonFirstName = isCurrentUserApplicant
            ? c.SPONSOR_FIRST_NAME
            : c.APPLICANT_FIRST_NAME;
          const otherPersonLastName = isCurrentUserApplicant
            ? c.SPONSOR_LAST_NAME
            : c.APPLICANT_LAST_NAME;
          const otherPersonPhoto = isCurrentUserApplicant
            ? c.SPONSOR_PHOTO_URL
            : c.APPLICANT_PHOTO_URL;
          const otherPersonId = isCurrentUserApplicant
            ? c.SPONSOR_USER_ID
            : c.APPLICANT_USER_ID;
          const otherPersonRole = isCurrentUserApplicant
            ? c.SPONSOR_JOB_TITLE
            : c.APPLICANT_POSITIONS
              ? (() => {
                  try {
                    const arr = JSON.parse(c.APPLICANT_POSITIONS);
                    return Array.isArray(arr) && arr.length
                      ? arr[0]
                      : "Job Seeker";
                  } catch {
                    return "Job Seeker";
                  }
                })()
              : "Job Seeker";
          const otherPersonCompany = isCurrentUserApplicant
            ? c.SPONSOR_COMPANY
            : "";

          return {
            id: c.CONVERSATION_ID,
            name:
              `${otherPersonFirstName || ""} ${otherPersonLastName || ""}`.trim() ||
              "Unknown",
            role: otherPersonRole || "Unknown Role",
            company: otherPersonCompany || c.COMPANY || "Unknown Company",
            profileImageUrl: otherPersonPhoto,
            skills: c.SKILLS
              ? Array.isArray(c.SKILLS)
                ? c.SKILLS
                : [c.SKILLS]
              : [],
            experience: c.YEARS_EXPERIENCE
              ? `${c.YEARS_EXPERIENCE} years`
              : "N/A",
            otherParticipant: {
              id: otherPersonId,
              name:
                `${otherPersonFirstName || ""} ${otherPersonLastName || ""}`.trim() ||
                "Unknown",
              profileImageUrl: otherPersonPhoto,
              role: otherPersonRole || undefined,
              company: otherPersonCompany || undefined,
            },
            lastMessage: c.LAST_BODY
              ? {
                  content: c.LAST_BODY,
                  senderId: "",
                  createdAt: c.LAST_AT || new Date().toISOString(),
                  isRead: true,
                }
              : undefined,
            unreadCount:
              (isCurrentUserApplicant && c.APPLICANT_HAS_UNREAD) ||
              (!isCurrentUserApplicant && c.SPONSOR_HAS_UNREAD)
                ? 1
                : 0,
            jobContext: {
              jobId: c.JOB_ID,
              jobTitle: c.TITLE,
              company: c.COMPANY || "",
            },
            createdAt: new Date().toISOString(),
          };
        });

        setConversations(transformedConversations);
      } catch (err) {
        console.warn("[MessagesView] Failed to fetch conversations:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch conversations";

        // If 404, backend might not have implemented endpoint yet or no conversations exist
        if (
          errorMessage.includes("Not found") ||
          errorMessage.includes("404")
        ) {
          console.log(
            "[MessagesView] Conversations endpoint not available or no conversations exist - showing empty state",
          );
          setConversations([]);
          setConversationsError(null); // Don't show error for 404, just empty state
        } else {
          setConversationsError(errorMessage);
        }
      } finally {
        setConversationsLoading(false);
      }
    };

    fetchConversations();
  }, [currentUserId]);

  // Build a transformed conversation object from raw API response (shared by initial fetch + load more)
  const transformConversation = (c: any) => {
    const isCurrentUserApplicant = c.APPLICANT_USER_ID === currentUserId;
    const otherPersonFirstName = isCurrentUserApplicant
      ? c.SPONSOR_FIRST_NAME
      : c.APPLICANT_FIRST_NAME;
    const otherPersonLastName = isCurrentUserApplicant
      ? c.SPONSOR_LAST_NAME
      : c.APPLICANT_LAST_NAME;
    const otherPersonPhoto = isCurrentUserApplicant
      ? c.SPONSOR_PHOTO_URL
      : c.APPLICANT_PHOTO_URL;
    const otherPersonId = isCurrentUserApplicant
      ? c.SPONSOR_USER_ID
      : c.APPLICANT_USER_ID;
    const otherPersonRole = isCurrentUserApplicant
      ? c.SPONSOR_JOB_TITLE
      : c.APPLICANT_POSITIONS
        ? (() => {
            try {
              const arr = JSON.parse(c.APPLICANT_POSITIONS);
              return Array.isArray(arr) && arr.length ? arr[0] : "Job Seeker";
            } catch {
              return "Job Seeker";
            }
          })()
        : "Job Seeker";
    const otherPersonCompany = isCurrentUserApplicant ? c.SPONSOR_COMPANY : "";
    return {
      id: c.CONVERSATION_ID,
      name:
        `${otherPersonFirstName || ""} ${otherPersonLastName || ""}`.trim() ||
        "Unknown",
      role: otherPersonRole || "Unknown Role",
      company: otherPersonCompany || c.COMPANY || "Unknown Company",
      profileImageUrl: otherPersonPhoto,
      skills: c.SKILLS ? (Array.isArray(c.SKILLS) ? c.SKILLS : [c.SKILLS]) : [],
      experience: c.YEARS_EXPERIENCE ? `${c.YEARS_EXPERIENCE} years` : "N/A",
      otherParticipant: {
        id: otherPersonId,
        name:
          `${otherPersonFirstName || ""} ${otherPersonLastName || ""}`.trim() ||
          "Unknown",
        profileImageUrl: otherPersonPhoto,
        role: otherPersonRole || undefined,
        company: otherPersonCompany || undefined,
      },
      lastMessage: c.LAST_BODY
        ? {
            content: c.LAST_BODY,
            senderId: "",
            createdAt: c.LAST_AT || new Date().toISOString(),
            isRead: true,
          }
        : undefined,
      unreadCount:
        (isCurrentUserApplicant && c.APPLICANT_HAS_UNREAD) ||
        (!isCurrentUserApplicant && c.SPONSOR_HAS_UNREAD)
          ? 1
          : 0,
      jobContext: {
        jobId: c.JOB_ID,
        jobTitle: c.TITLE,
        company: c.COMPANY || "",
      },
      createdAt: new Date().toISOString(),
    };
  };

  const loadMoreConversations = async () => {
    if (isLoadingMore || conversations.length >= conversationsTotalCount)
      return;
    try {
      setIsLoadingMore(true);
      const response = await getConversations({
        limit: 20,
        offset: conversations.length,
      });
      const more = response.conversations.map((conv) =>
        transformConversation(conv as any),
      );
      setConversations((prev) => [...prev, ...more]);
    } catch (err) {
      console.warn("[MessagesView] Failed to load more conversations:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };
  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    let ws: WebSocket | null = null;
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      try {
        // Connect to WebSocket for real-time messages
        const wsUrl = `wss://oyster-app-4pg5w.ondigitalocean.app/ws/chat/${selectedConversation}/?token=${accessToken}`;
        console.log("[MessagesView] Connecting to WebSocket:", wsUrl);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[MessagesView] WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[MessagesView] WebSocket message received:", data);

            if (data.type === "chat.message") {
              // Add new message to the list in real-time, reconciling any optimistic temp message
              const newMessage = {
                id: data.message_id,
                serverId: data.message_id,
                senderId: data.sender_user_id,
                content: data.body,
                messageType: "text" as const,
                isRead: true,
                createdAt: data.created_at,
              };

              setMessages((prev) => {
                // If already have this message by serverId or id, keep as-is
                if (
                  prev.some(
                    (msg) =>
                      msg.serverId === newMessage.id ||
                      msg.id === newMessage.id,
                  )
                ) {
                  return prev;
                }

                // If we have an optimistic temp message from same sender/content, replace it in-place
                const tempIndex = prev.findIndex(
                  (msg) =>
                    msg.id.startsWith("temp-") &&
                    msg.senderId === newMessage.senderId &&
                    msg.content === newMessage.content,
                );
                if (tempIndex >= 0) {
                  const updated = [...prev];
                  updated[tempIndex] = {
                    ...updated[tempIndex],
                    serverId: newMessage.id,
                    createdAt: newMessage.createdAt,
                    isRead: true,
                  };
                  return updated;
                }

                return [...prev, newMessage];
              });

              // Scroll to bottom when new message arrives
              setTimeout(() => scrollToBottom(true), 100);
            } else if (data.type === "error") {
              console.warn("[MessagesView] WebSocket error:", data.message);
            }
          } catch (err) {
            console.warn(
              "[MessagesView] Failed to parse WebSocket message:",
              err,
            );
          }
        };

        ws.onerror = (error) => {
          console.warn("[MessagesView] WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log(
            "[MessagesView] WebSocket closed:",
            event.code,
            event.reason,
          );
          if (event.code === 4001) {
            console.warn(
              "[MessagesView] WebSocket auth failed - invalid token",
            );
          } else if (event.code === 4003) {
            console.warn(
              "[MessagesView] WebSocket rejected - not a participant",
            );
          }
        };
      } catch (err) {
        console.warn("[MessagesView] Failed to connect to WebSocket:", err);
      }
    }

    return () => {
      if (ws) {
        console.log("[MessagesView] Closing WebSocket connection");
        ws.close();
      }
    };
  }, [selectedConversation]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation) {
        setMessages([]);
        return;
      }

      try {
        setMessagesLoading(true);
        setMessagesError(null);
        console.log(
          "[MessagesView] Fetching messages for conversation:",
          selectedConversation,
        );

        const response = await getConversationMessages(selectedConversation, {
          limit: 100,
        });
        console.log("[MessagesView] Messages response:", response);

        // Transform UPPERCASE PostgreSQL fields to our UI format
        const transformedMessages = response.messages.map((msg) => ({
          id: msg.MESSAGE_ID,
          serverId: msg.MESSAGE_ID,
          senderId: msg.SENDER_USER_ID,
          content: msg.BODY,
          messageType: "text" as const,
          isRead: true, // Backend doesn't track per-message read status
          createdAt: msg.CREATED_AT,
        }));

        setMessages(transformedMessages);

        // Infer current user ID from messages
        if (response.messages && response.messages.length > 0) {
          // Find current user by checking which sender appears most frequently
          const senderCounts: Record<string, number> = {};
          response.messages.forEach((msg) => {
            const senderId = msg.SENDER_USER_ID;
            senderCounts[senderId] = (senderCounts[senderId] || 0) + 1;
          });

          // Get the conversation to find the other participant
          const conv = conversations.find((c) => c.id === selectedConversation);
          if (conv) {
            // Current user is the one NOT in otherParticipant
            const otherUserId = conv.otherParticipant.id;
            const allSenders = Object.keys(senderCounts);
            const inferredCurrentUser =
              allSenders.find((id) => id !== otherUserId) || allSenders[0];
            if (inferredCurrentUser && !currentUserId) {
              setCurrentUserId(inferredCurrentUser);
            }
          }
        }
      } catch (err) {
        console.warn("[MessagesView] Failed to fetch messages:", err);
        setMessagesError(
          err instanceof Error ? err.message : "Failed to fetch messages",
        );
      } finally {
        setMessagesLoading(false);
      }
    };

    // Initial fetch only; WebSocket handles live updates and removes flicker
    fetchMessages();

    // No polling to avoid UI flicker; rely on WebSocket for real-time updates
    return () => {
      /* no interval to clear */
    };
  }, [selectedConversation]);

  const handleConversationSelect = (conversationId: string | null) => {
    setSelectedConversation(conversationId);
    if (onConversationChange) {
      onConversationChange(conversationId ?? null);
    }
  };

  const handleUnmatch = async () => {
    if (!selectedConversation) return;
    try {
      setIsUnmatching(true);
      await unmatchConversation(selectedConversation);
      // Optimistically remove from local list
      setConversations((prev) =>
        prev.filter((c) => c.id !== selectedConversation),
      );
      setShowUnmatchMenu(false);
      handleConversationSelect(null);
    } catch (err) {
      console.warn("[MessagesView] Failed to unmatch:", err);
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

  // Auto-navigate to a conversation thread when coming from Matches tab via pendingJobId
  useEffect(() => {
    if (!pendingJobId || conversations.length === 0) return;
    const conv = conversations.find(
      (c) => c.jobContext?.jobId === pendingJobId,
    );
    if (conv) {
      handleConversationSelect(conv.id);
      onPendingJobConsumed?.();
    }
  }, [pendingJobId, conversations]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sendingMessage) return;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId || "me",
      content: messageText.trim(),
      messageType: "text" as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Optimistically add message to UI
    setMessages((prev) => [...prev, tempMessage]);
    const messageToSend = messageText.trim();
    setMessageText("");

    try {
      setSendingMessage(true);
      console.log("[MessagesView] Sending message:", messageToSend);

      const response = await sendMessage(selectedConversation, messageToSend);
      console.log("[MessagesView] Message sent:", response);

      // Reconcile temp message: stamp serverId, keep stable id to avoid flicker
      setMessages((prev) => {
        // Only drop the temp if a DIFFERENT, separate entry already has this server ID.
        // Do NOT treat the temp itself as a reason to remove it — the WebSocket reconciler
        // may have already stamped serverId onto the temp, and we must not delete it.
        const existsAsSeparateEntry = prev.some(
          (m) =>
            m.id !== tempMessage.id &&
            (m.serverId === response.message_id ||
              m.id === response.message_id),
        );

        if (existsAsSeparateEntry) {
          // A fully separate entry exists; drop the now-redundant temp
          return prev.filter((m) => m.id !== tempMessage.id);
        }

        // Keep the temp, just ensure serverId is stamped (WebSocket may have done this already)
        return prev.map((msg) =>
          msg.id === tempMessage.id
            ? { ...msg, serverId: response.message_id, isRead: true }
            : msg,
        );
      });

      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err) {
      console.warn("[MessagesView] Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setMessageText(messageToSend); // Restore message text
      showToast("Failed to send message. Please try again.", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveSlide(slide);
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  };

  const keyboardSpacerStyle = useAnimatedStyle(() => {
    return {
      paddingBottom: Math.max(0, keyboard.height.value - insets.bottom),
    };
  });

  useEffect(() => {
    onThreadActiveChange?.(Boolean(selectedConversation));
    if (selectedConversation) {
      setTimeout(() => scrollToBottom(false), 100);
    }
    return () => onThreadActiveChange?.(false);
  }, [selectedConversation]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      scrollToBottom(true),
    );
    return () => showSub.remove();
  }, []);

  const resetReferralFlow = () => {
    setReferralStep(1);
    setHasMessaged(false);
    setFeelsConfident(false);
    setKnowsBackground(false);
    setComfortableAttaching(false);
    setReferralError(null);
    setReferralSubmitting(false);
    setReferralProfile(null);
  };

  // Fetch the applicant's full public profile when the referral flow opens so
  // the Step 2 review card can show rich, real data.
  useEffect(() => {
    if (!showReferralFlow) {
      setReferralProfile(null);
      return;
    }
    const conv = conversations.find((c) => c.id === selectedConversation);
    const applicantId = conv?.otherParticipant?.id;
    if (!applicantId) return;
    setReferralProfileLoading(true);
    getPublicProfile(String(applicantId))
      .then((profile) => setReferralProfile(profile))
      .catch((err) =>
        console.warn("[MessagesView] Failed to fetch referral profile:", err),
      )
      .finally(() => setReferralProfileLoading(false));
  }, [showReferralFlow]);

  const canProceedFromStep1 =
    hasMessaged && feelsConfident && knowsBackground && comfortableAttaching;

  const getStatusLabel = (status: string) => {
    const labels = {
      applied: "Applied",
      reviewing: "Under Review",
      interview_scheduled: "Interview",
      offer: "Offer",
      rejected: "Closed",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusDotColor = (status: string) => {
    const colors = {
      applied: { backgroundColor: "#3B82F6" },
      reviewing: { backgroundColor: "#F59E0B" },
      interview_scheduled: { backgroundColor: "#10B981" },
      offer: { backgroundColor: "#8B5CF6" },
      rejected: { backgroundColor: "#EF4444" },
    };
    return (
      colors[status as keyof typeof colors] || { backgroundColor: "#9CA3AF" }
    );
  };

  const getStatusBadgeStyle = (status: string) => {
    const styles = {
      applied: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
      reviewing: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
      interview_scheduled: {
        backgroundColor: "#D1FAE5",
        borderColor: "#A7F3D0",
      },
      offer: { backgroundColor: "#EDE9FE", borderColor: "#DDD6FE" },
      rejected: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
    };
    return (
      styles[status as keyof typeof styles] || {
        backgroundColor: "#F3F4F6",
        borderColor: "#E5E7EB",
      }
    );
  };

  const getStatusTextColor = (status: string) => {
    const colors = {
      applied: { color: "#1E40AF" },
      reviewing: { color: "#B45309" },
      interview_scheduled: { color: "#065F46" },
      offer: { color: "#5B21B6" },
      rejected: { color: "#991B1B" },
    };
    return colors[status as keyof typeof colors] || { color: "#374151" };
  };

  const openReferral = () => {
    setShowProfileModal(false);
    setReferralStep(1);
    setShowReferralFlow(true);
  };

  const getApplicationFromConversation = (conv: any) => {
    if (!conv.applicationStatus) return null;

    const statusToTimeline: Record<string, any[]> = {
      applied: [
        {
          stage: "Applied",
          date: conv.appliedDate || "Recent",
          completed: true,
        },
        {
          stage: "Referred",
          date: "Pending",
          completed: false,
          isReferred: true,
        },
        { stage: "Screening", date: "Pending", completed: false },
        { stage: "Interview", date: "TBD", completed: false },
        { stage: "Decision", date: "TBD", completed: false },
      ],
      reviewing: [
        {
          stage: "Applied",
          date: conv.appliedDate || "Recent",
          completed: true,
        },
        {
          stage: "Referred",
          date: "Completed",
          completed: true,
          isReferred: true,
        },
        { stage: "Screening", date: "In Progress", completed: false },
        { stage: "Interview", date: "TBD", completed: false },
        { stage: "Decision", date: "TBD", completed: false },
      ],
      interview_scheduled: [
        {
          stage: "Applied",
          date: conv.appliedDate || "Recent",
          completed: true,
        },
        {
          stage: "Referred",
          date: "Completed",
          completed: true,
          isReferred: true,
        },
        { stage: "Screening", date: "Completed", completed: true },
        { stage: "Interview", date: "Scheduled", completed: false },
        { stage: "Decision", date: "TBD", completed: false },
      ],
      offer: [
        {
          stage: "Applied",
          date: conv.appliedDate || "Recent",
          completed: true,
        },
        {
          stage: "Referred",
          date: "Completed",
          completed: true,
          isReferred: true,
        },
        { stage: "Screening", date: "Completed", completed: true },
        { stage: "Interview", date: "Completed", completed: true },
        { stage: "Decision", date: "Offer Received", completed: true },
      ],
      rejected: [
        {
          stage: "Applied",
          date: conv.appliedDate || "Recent",
          completed: true,
        },
        {
          stage: "Referred",
          date: "Completed",
          completed: true,
          isReferred: true,
        },
        { stage: "Screening", date: "Completed", completed: true },
        { stage: "Interview", date: "Completed", completed: true },
        { stage: "Decision", date: "Closed", completed: true },
      ],
    };

    return {
      jobTitle: conv.appliedRole,
      company: conv.company,
      companyLogo: conv.image,
      status: conv.applicationStatus,
      appliedDate: conv.appliedDate || "Recent",
      nextAction: conv.nextAction || "No pending actions",
      sponsorName: conv.name,
      sponsorRole: conv.role,
      sponsorImage: conv.image,
      timeline:
        statusToTimeline[conv.applicationStatus] || statusToTimeline.applied,
    };
  };

  // Day header formatter for message thread dividers
  const formatDayHeader = (timestamp: string) => {
    const date = new Date(timestamp);
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

  // Helper function to format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (selectedConversation) {
    const conversation = conversations.find(
      (c) => c.id === selectedConversation,
    );

    if (!conversation) {
      // Conversations are still fetching — show a loading state so we don't flash
      // a false "not found" message while the async fetch completes after a
      // re-mount (e.g. navigating back from the public profile view).
      if (conversationsLoading) {
        return (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator size="large" color="#000" />
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
              <Image
                source={{
                  uri:
                    conversation.otherParticipant.profileImageUrl ||
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
                }}
                style={styles.headerImage}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>
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
              {userType === "sponsor" ? (
                <TouchableOpacity
                  style={styles.headerReferBtn}
                  onPress={openReferral}
                  activeOpacity={0.7}
                >
                  <UserCheck color="#000" size={20} />
                  <Text style={styles.headerReferText}>Refer</Text>
                </TouchableOpacity>
              ) : conversation.applicationStatus ? (
                <TouchableOpacity
                  style={styles.headerStatusBtn}
                  onPress={() => setShowApplicationDetail(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerStatusText}>Status</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.headerMoreBtn}
                onPress={() => setShowUnmatchMenu(true)}
                activeOpacity={0.7}
              >
                <MoreHorizontal color="#000" size={20} />
              </TouchableOpacity>
            </View>
          </View>
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
                  style={{ color: "#FF3B30", fontSize: 15, marginBottom: 8 }}
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
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ color: "#999", fontSize: 15 }}>
                  No messages yet
                </Text>
                <Text style={{ color: "#BBB", fontSize: 13, marginTop: 8 }}>
                  Start the conversation!
                </Text>
              </View>
            ) : (
              messages.map((message, index) => {
                // A message is mine if:
                //  1. sender matches the resolved currentUserId
                //  2. it is still an unreconciled optimistic temp (senderId may be "me" or real ID)
                //  3. senderId is literally "me" (fallback before currentUserId loaded)
                const isMyMessage = currentUserId
                  ? message.senderId === currentUserId ||
                    message.senderId === "me" ||
                    (message.id.startsWith("temp-") && !message.serverId)
                  : message.id.startsWith("temp-") || message.senderId === "me";
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const isFirstOfDay =
                  !prevMessage ||
                  new Date(message.createdAt).toDateString() !==
                    new Date(prevMessage.createdAt).toDateString();
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
                      entering={FadeInUp.delay(index * 50)}
                      style={[
                        styles.messageWrapper,
                        isMyMessage ? styles.msgRight : styles.msgLeft,
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
              })
            )}
          </ScrollView>
          <View style={styles.inputArea}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Write a message..."
              placeholderTextColor="#BBB"
              style={styles.textInput}
              multiline
              onFocus={() => setTimeout(() => scrollToBottom(true), 150)}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!messageText.trim() || sendingMessage) && { opacity: 0.5 },
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              <Send color="#FFF" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* PROFILE MODAL — content branches on userType:
              sponsor = viewing applicant (skills, resume, referral button)
              applicant = viewing sponsor (title/company, job context, no resume/referral)
              Using animationType="slide" lets React Native handle the
              show/hide animation natively, avoiding the Reanimated
              SlideInDown/SlideOutDown ghost-overlay freeze. */}
        <Modal visible={showProfileModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowProfileModal(false)}
            >
              <BlurView
                intensity={30}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            </TouchableOpacity>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {userType === "sponsor" ? (
                  /* ── SPONSOR is viewing an APPLICANT'S profile ── */
                  <>
                    <View style={styles.jobRefTag}>
                      <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                      <View style={styles.jobRefBadge}>
                        <Briefcase size={12} color="#000" />
                        <Text style={styles.jobRefText}>
                          {conversation.jobContext?.jobTitle ||
                            conversation.appliedRole ||
                            ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.swipableContainer}>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                      >
                        {/* Page 1 — Applicant overview */}
                        <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                          <View style={styles.infoCardHeader}>
                            <Image
                              source={{
                                uri: conversation.otherParticipant
                                  .profileImageUrl,
                              }}
                              style={styles.modalAvatar}
                            />
                            <View>
                              <Text style={styles.modalName}>
                                {conversation.otherParticipant.name}
                              </Text>
                              <View style={styles.locationRow}>
                                <MapPin size={12} color="#AAA" />
                                <Text style={styles.locationText}>
                                  {conversation.otherParticipant.role ||
                                    "Job Seeker"}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Text style={styles.bioText} numberOfLines={3}>
                            {conversation.otherParticipant.role
                              ? `${conversation.otherParticipant.role} seeking new opportunities and looking for a warm referral.`
                              : "Experienced professional seeking a referral opportunity."}
                          </Text>
                          <View style={styles.skillsContainer}>
                            {(conversation.skills || []).map(
                              (s: string, i: number) => (
                                <View key={i} style={styles.skillChip}>
                                  <Text style={styles.skillText}>{s}</Text>
                                </View>
                              ),
                            )}
                          </View>
                          <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                              <Award size={14} color="#000" />
                              <Text style={styles.statLabel}>
                                {conversation.experience || "N/A"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.resumeBtn}
                              activeOpacity={0.7}
                            >
                              <FileText size={14} color="#FFF" />
                              <Text style={styles.resumeBtnText}>
                                View Resume
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        {/* Page 2 — Key Insights */}
                        <View
                          style={[
                            styles.infoCard,
                            {
                              width: CARD_WIDTH,
                              backgroundColor: "#F9F9F9",
                              borderWidth: 1,
                              borderColor: "#F0F0F0",
                            },
                          ]}
                        >
                          <ScrollView showsVerticalScrollIndicator={false}>
                            {conversation.prompts?.map(
                              (prompt: any, idx: number) => (
                                <View
                                  key={idx}
                                  style={styles.promptCardInModal}
                                >
                                  <View style={styles.promptIconRowInModal}>
                                    <View style={styles.promptIconCircle}>
                                      {idx === 0 ? (
                                        <Check size={14} color="#000" />
                                      ) : (
                                        <Award size={14} color="#000" />
                                      )}
                                    </View>
                                    <Text style={styles.promptQuestionInModal}>
                                      {prompt.question}
                                    </Text>
                                  </View>
                                  <Text style={styles.promptAnswerInModal}>
                                    {prompt.answer}
                                  </Text>
                                </View>
                              ),
                            )}
                          </ScrollView>
                        </View>
                      </ScrollView>
                      <View style={styles.pagination}>
                        <View
                          style={[
                            styles.dot,
                            activeSlide === 0
                              ? styles.dotActive
                              : styles.dotInactive,
                          ]}
                        />
                        <View
                          style={[
                            styles.dot,
                            activeSlide === 1
                              ? styles.dotActive
                              : styles.dotInactive,
                          ]}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.fullProfileBtn}
                      onPress={() => {
                        setShowProfileModal(false);
                        if (onShowPublicProfile) {
                          onShowPublicProfile(conversation);
                        }
                      }}
                    >
                      <User color="#FFF" size={18} />
                      <Text style={styles.fullProfileBtnText}>
                        View Full Profile
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.referFromModalBtn}
                      onPress={openReferral}
                    >
                      <UserCheck color="#000" size={18} />
                      <Text style={styles.referFromModalBtnText}>
                        Provide Referral
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  /* ── APPLICANT is viewing a SPONSOR'S profile ── */
                  <>
                    <View style={styles.jobRefTag}>
                      <Text style={styles.jobRefLabel}>CONNECTED ON</Text>
                      <View style={styles.jobRefBadge}>
                        <Briefcase size={12} color="#000" />
                        <Text style={styles.jobRefText}>
                          {conversation.jobContext?.jobTitle ||
                            conversation.appliedRole ||
                            ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.swipableContainer}>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                      >
                        {/* Page 1 — Sponsor overview */}
                        <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                          <View style={styles.infoCardHeader}>
                            <Image
                              source={{
                                uri:
                                  conversation.otherParticipant
                                    .profileImageUrl ||
                                  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200",
                              }}
                              style={styles.modalAvatar}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.modalName}>
                                {conversation.otherParticipant.name}
                              </Text>
                              {(conversation.otherParticipant.role ||
                                conversation.otherParticipant.company) && (
                                <Text
                                  style={styles.sponsorTitleText}
                                  numberOfLines={1}
                                >
                                  {[
                                    conversation.otherParticipant.role,
                                    conversation.otherParticipant.company,
                                  ]
                                    .filter(Boolean)
                                    .join(" @ ")}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Referring for row */}
                          <View style={styles.sponsorReferringRow}>
                            <View style={styles.sponsorReferringIcon}>
                              <Briefcase size={14} color="#000" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.sponsorReferringLabel}>
                                Referring for
                              </Text>
                              <Text
                                style={styles.sponsorReferringValue}
                                numberOfLines={1}
                              >
                                {conversation.jobContext?.jobTitle ||
                                  "Open Position"}
                                {conversation.jobContext?.company
                                  ? ` at ${conversation.jobContext.company}`
                                  : ""}
                              </Text>
                            </View>
                          </View>

                          {/* Status badges */}
                          <View style={styles.sponsorBadgeRow}>
                            <View style={styles.sponsorOpenBadge}>
                              <ShieldCheck size={13} color="#059669" />
                              <Text style={styles.sponsorOpenBadgeText}>
                                Open to Referrals
                              </Text>
                            </View>
                            <View style={styles.sponsorMatchBadge}>
                              <Check size={13} color="#000" />
                              <Text style={styles.sponsorMatchBadgeText}>
                                Active Match
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.sponsorTipText}>
                            Tap "View Full Profile" to see{" "}
                            {conversation.otherParticipant.name?.split(
                              " ",
                            )[0] ?? "their"}{" "}
                            background, referral history, and key insights.
                          </Text>
                        </View>

                        {/* Page 2 — Key Insights */}
                        <View
                          style={[
                            styles.infoCard,
                            {
                              width: CARD_WIDTH,
                              backgroundColor: "#F9F9F9",
                              borderWidth: 1,
                              borderColor: "#F0F0F0",
                            },
                          ]}
                        >
                          {conversation.prompts?.length ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                              {conversation.prompts.map(
                                (prompt: any, idx: number) => (
                                  <View
                                    key={idx}
                                    style={styles.promptCardInModal}
                                  >
                                    <View style={styles.promptIconRowInModal}>
                                      <View style={styles.promptIconCircle}>
                                        {idx === 0 ? (
                                          <Check size={14} color="#000" />
                                        ) : (
                                          <Award size={14} color="#000" />
                                        )}
                                      </View>
                                      <Text
                                        style={styles.promptQuestionInModal}
                                      >
                                        {prompt.question}
                                      </Text>
                                    </View>
                                    <Text style={styles.promptAnswerInModal}>
                                      {prompt.answer}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </ScrollView>
                          ) : (
                            <View style={styles.sponsorInsightsEmpty}>
                              <View style={styles.sponsorInsightsIconCircle}>
                                <Award size={22} color="#000" />
                              </View>
                              <Text style={styles.sponsorInsightsEmptyTitle}>
                                Key Insights
                              </Text>
                              <Text style={styles.sponsorInsightsEmptyText}>
                                View{" "}
                                {conversation.otherParticipant.name?.split(
                                  " ",
                                )[0] ?? "their"}{" "}
                                full profile to see their background,
                                motivations, and referral experience.
                              </Text>
                            </View>
                          )}
                        </View>
                      </ScrollView>
                      <View style={styles.pagination}>
                        <View
                          style={[
                            styles.dot,
                            activeSlide === 0
                              ? styles.dotActive
                              : styles.dotInactive,
                          ]}
                        />
                        <View
                          style={[
                            styles.dot,
                            activeSlide === 1
                              ? styles.dotActive
                              : styles.dotInactive,
                          ]}
                        />
                      </View>
                    </View>

                    {/* Applicant only gets View Full Profile — no resume or referral button */}
                    <TouchableOpacity
                      style={styles.fullProfileBtn}
                      onPress={() => {
                        setShowProfileModal(false);
                        if (onShowPublicProfile) {
                          onShowPublicProfile(conversation);
                        }
                      }}
                    >
                      <User color="#FFF" size={18} />
                      <Text style={styles.fullProfileBtnText}>
                        View Full Profile
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal visible={showReferralFlow} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => {
                setShowReferralFlow(false);
                resetReferralFlow();
              }}
            >
              <BlurView
                intensity={60}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            </TouchableOpacity>
            <Animated.View
              entering={SlideInDown}
              style={styles.referralFlowContainer}
            >
              <View style={styles.flowHeader}>
                <Text style={styles.flowTitle}>Referral Vetting</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowReferralFlow(false);
                    resetReferralFlow();
                  }}
                >
                  <X color="#000" size={24} />
                </TouchableOpacity>
              </View>
              {referralStep === 1 && (
                <Animated.View entering={FadeInUp} style={styles.stepContent}>
                  <Text style={styles.stepSubtitle}>Confidence Check</Text>
                  <Text style={styles.stepDesc}>
                    Before referring{" "}
                    {conversation.otherParticipant?.name || conversation.name},
                    please confirm your due diligence:
                  </Text>
                  <View style={styles.vettingList}>
                    <TouchableOpacity
                      style={styles.vettingItem}
                      onPress={() => setHasMessaged(!hasMessaged)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.vettingCheck}>
                        {hasMessaged ? (
                          <CheckCircle size={18} color="#00CB54" />
                        ) : (
                          <CheckCircle size={18} color="#E5E5E5" />
                        )}
                      </View>
                      <Text style={styles.vettingText}>
                        I have messaged and spoken to the applicant directly.
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.vettingItem}
                      onPress={() => setFeelsConfident(!feelsConfident)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.vettingCheck}>
                        {feelsConfident ? (
                          <CheckCircle size={18} color="#00CB54" />
                        ) : (
                          <CheckCircle size={18} color="#E5E5E5" />
                        )}
                      </View>
                      <Text style={styles.vettingText}>
                        I feel confident they would be successful in this role.
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.vettingItem}
                      onPress={() => setKnowsBackground(!knowsBackground)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.vettingCheck}>
                        {knowsBackground ? (
                          <CheckCircle size={18} color="#00CB54" />
                        ) : (
                          <CheckCircle size={18} color="#E5E5E5" />
                        )}
                      </View>
                      <Text style={styles.vettingText}>
                        I am aware of their background and experience level.
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.vettingItem}
                      onPress={() =>
                        setComfortableAttaching(!comfortableAttaching)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.vettingCheck}>
                        {comfortableAttaching ? (
                          <CheckCircle size={18} color="#00CB54" />
                        ) : (
                          <CheckCircle size={18} color="#E5E5E5" />
                        )}
                      </View>
                      <Text style={styles.vettingText}>
                        I feel comfortable attaching my name to this referral.
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      !canProceedFromStep1 && styles.primaryBtnDisabled,
                    ]}
                    onPress={() => canProceedFromStep1 && setReferralStep(2)}
                    disabled={!canProceedFromStep1}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.primaryBtnText}>
                      Review Applicant Details
                    </Text>
                    <ChevronRight color="#FFF" size={18} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              {referralStep === 2 && (
                <Animated.View entering={FadeInUp} style={styles.stepContent}>
                  <Text style={styles.stepSubtitle}>Review & Confirm</Text>
                  <Text style={styles.stepDesc}>
                    Use the applicant's information below to enter their details
                    into your company's ATS or job portal. Copy the relevant
                    fields carefully to ensure the referral is submitted
                    successfully on their behalf.
                  </Text>
                  <ScrollView
                    style={styles.summaryScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {referralProfileLoading ? (
                      <View style={styles.referralProfileLoading}>
                        <ActivityIndicator size="large" color="#000" />
                        <Text style={styles.referralProfileLoadingText}>
                          Loading candidate details…
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.candidateInfoCard}>
                        {/* ── ATS hint banner ── */}
                        <View style={styles.atsBanner}>
                          <FileText size={13} color="#1E40AF" strokeWidth={2} />
                          <Text style={styles.atsBannerText}>
                            Enter these details into your ATS portal when
                            submitting the referral.
                          </Text>
                        </View>

                        {/* ── Header: avatar + name + current role ── */}
                        <View style={styles.candidateHeader}>
                          {referralProfile?.PHOTO_URL ||
                          conversation.profileImageUrl ? (
                            <Image
                              source={{
                                uri:
                                  referralProfile?.PHOTO_URL ||
                                  conversation.profileImageUrl,
                              }}
                              style={styles.candidateAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.candidateAvatar,
                                styles.candidateAvatarFallback,
                              ]}
                            >
                              <User color="#999" size={24} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.candidateName}>
                              {referralProfile
                                ? `${referralProfile.FIRST_NAME || ""} ${referralProfile.LAST_NAME || ""}`.trim()
                                : conversation.otherParticipant?.name ||
                                  conversation.name}
                            </Text>
                            <Text style={styles.candidateRole}>
                              {referralProfile?.applicant_profile
                                ?.CURRENT_ROLE ||
                                conversation.otherParticipant?.role ||
                                conversation.role ||
                                ""}
                            </Text>
                          </View>
                        </View>

                        {/* ── Applying For ── */}
                        <View style={styles.infoSection}>
                          <Text style={styles.infoSectionTitle}>
                            APPLYING FOR
                          </Text>
                          <Text style={styles.infoSectionValue}>
                            {conversation.jobContext?.jobTitle || "—"}
                          </Text>
                          {conversation.jobContext?.company ? (
                            <Text
                              style={[
                                styles.infoSectionValue,
                                { color: "#666" },
                              ]}
                            >
                              {conversation.jobContext.company}
                            </Text>
                          ) : null}
                        </View>

                        {/* ── Professional Summary ── */}
                        {referralProfile?.BIO ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              PROFESSIONAL SUMMARY
                            </Text>
                            <Text
                              style={[
                                styles.infoSectionValue,
                                { lineHeight: 20, color: "#444" },
                              ]}
                            >
                              {referralProfile.BIO}
                            </Text>
                          </View>
                        ) : null}

                        {/* ── Location ── */}
                        {[referralProfile?.CITY, referralProfile?.STATE]
                          .filter(Boolean)
                          .join(", ") ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              LOCATION
                            </Text>
                            <Text style={styles.infoSectionValue}>
                              {[referralProfile?.CITY, referralProfile?.STATE]
                                .filter(Boolean)
                                .join(", ")}
                            </Text>
                          </View>
                        ) : null}

                        {/* ── Experience ── */}
                        <View style={styles.infoSection}>
                          <Text style={styles.infoSectionTitle}>
                            EXPERIENCE
                          </Text>
                          {referralProfile?.applicant_profile
                            ?.YEARS_EXPERIENCE ? (
                            <Text style={styles.infoSectionValue}>
                              {
                                referralProfile.applicant_profile
                                  .YEARS_EXPERIENCE
                              }{" "}
                              years in industry
                            </Text>
                          ) : conversation.experience &&
                            conversation.experience !== "N/A" ? (
                            <Text style={styles.infoSectionValue}>
                              {conversation.experience} in industry
                            </Text>
                          ) : null}
                          {(
                            referralProfile?.applicant_profile
                              ?.PROFESSIONAL_EXPERIENCES || []
                          )
                            .slice(0, 2)
                            .map((exp: any, idx: number) => (
                              <Text key={idx} style={styles.infoSectionValue}>
                                {exp.jobTitle} @ {exp.company}
                                {exp.current
                                  ? " (Current)"
                                  : exp.endDate
                                    ? ` · ${exp.endDate}`
                                    : ""}
                              </Text>
                            ))}
                        </View>

                        {/* ── Education ── */}
                        {(
                          referralProfile?.applicant_profile
                            ?.EDUCATION_ENTRIES || []
                        ).length > 0 ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              EDUCATION
                            </Text>
                            {(
                              referralProfile.applicant_profile
                                .EDUCATION_ENTRIES as any[]
                            )
                              .slice(0, 2)
                              .map((edu: any, idx: number) => (
                                <Text key={idx} style={styles.infoSectionValue}>
                                  {[edu.degree, edu.major]
                                    .filter(Boolean)
                                    .join(" in ")}
                                  {edu.university ? ` — ${edu.university}` : ""}
                                </Text>
                              ))}
                          </View>
                        ) : null}

                        {/* ── Key Skills ── */}
                        {(
                          referralProfile?.applicant_profile?.SKILLS ||
                          conversation.skills ||
                          []
                        ).length > 0 ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              KEY SKILLS
                            </Text>
                            <View style={styles.skillsRow}>
                              {(
                                referralProfile?.applicant_profile?.SKILLS ||
                                conversation.skills ||
                                []
                              ).map((skill: string, idx: number) => (
                                <View key={idx} style={styles.skillBadge}>
                                  <Text style={styles.skillBadgeText}>
                                    {skill}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        {/* ── Industry ── */}
                        {referralProfile?.applicant_profile?.INDUSTRY ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              INDUSTRY
                            </Text>
                            <Text style={styles.infoSectionValue}>
                              {referralProfile.applicant_profile.INDUSTRY}
                            </Text>
                          </View>
                        ) : null}

                        {/* ── LinkedIn (tappable) ── */}
                        {referralProfile?.LINKED_IN ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              LINKEDIN
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                Linking.openURL(
                                  referralProfile.LINKED_IN,
                                ).catch(() => {})
                              }
                              activeOpacity={0.7}
                            >
                              <Text style={styles.infoSectionLink}>
                                {referralProfile.LINKED_IN}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}

                        {/* ── Portfolio ── */}
                        {referralProfile?.PORTFOLIO_URL ? (
                          <View style={styles.infoSection}>
                            <Text style={styles.infoSectionTitle}>
                              PORTFOLIO
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                Linking.openURL(
                                  referralProfile.PORTFOLIO_URL,
                                ).catch(() => {})
                              }
                              activeOpacity={0.7}
                            >
                              <Text style={styles.infoSectionLink}>
                                {referralProfile.PORTFOLIO_URL}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    )}
                    <View style={styles.finalChecklist}>
                      <Text style={styles.checklistTitle}>
                        Final Confirmation
                      </Text>
                      <View style={styles.checkRow}>
                        <ShieldCheck size={16} color="#000" />
                        <Text style={styles.checkText}>
                          This referral is binding within our system.
                        </Text>
                      </View>
                      <View style={styles.checkRow}>
                        <ShieldCheck size={16} color="#000" />
                        <Text style={styles.checkText}>
                          Your reputation score may be affected by the outcome.
                        </Text>
                      </View>
                    </View>
                  </ScrollView>
                  {/* Inline error — shown if submission fails */}
                  {referralError && (
                    <View style={styles.referralErrorBox}>
                      <Text style={styles.referralErrorText}>
                        {referralError}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      referralSubmitting && { opacity: 0.65 },
                    ]}
                    onPress={async () => {
                      const applicantUserId = conversation.otherParticipant?.id;
                      const jobId = conversation.jobContext?.jobId;

                      if (!applicantUserId || !jobId) {
                        setReferralError(
                          "Missing applicant or job information. Please try again.",
                        );
                        return;
                      }

                      setReferralSubmitting(true);
                      setReferralError(null);
                      try {
                        await submitReferral({
                          applicant_user_id: applicantUserId,
                          job_id: jobId,
                          confidence_checks: {
                            has_messaged: hasMessaged,
                            feels_confident: feelsConfident,
                            knows_background: knowsBackground,
                            comfortable_attaching: comfortableAttaching,
                          },
                        });
                        // Submission succeeded — move to success step
                        setReferralStep(3);
                      } catch (err) {
                        const msg =
                          err instanceof Error ? err.message : String(err);
                        if (
                          msg.includes("400") ||
                          msg.toLowerCase().includes("already")
                        ) {
                          setReferralError(
                            "A referral already exists for this applicant and role.",
                          );
                        } else if (
                          msg.includes("403") ||
                          msg.toLowerCase().includes("match")
                        ) {
                          setReferralError(
                            "You must be matched with this applicant to refer them.",
                          );
                        } else {
                          setReferralError(
                            "Failed to submit referral. Please try again.",
                          );
                        }
                      } finally {
                        setReferralSubmitting(false);
                      }
                    }}
                    disabled={referralSubmitting}
                    activeOpacity={0.7}
                  >
                    {referralSubmitting ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <ClipboardCheck color="#FFF" size={20} />
                        <Text style={styles.primaryBtnText}>
                          Submit Formal Referral
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
              {referralStep === 3 && (
                <Animated.View entering={FadeInDown} style={styles.successStep}>
                  <View style={styles.successIcon}>
                    <CheckCircle size={60} color="#00CB54" />
                  </View>
                  <Text style={styles.successTitle}>Referral Submitted!</Text>
                  <Text style={styles.successDesc}>
                    You have successfully referred{" "}
                    {referralProfile
                      ? `${referralProfile.FIRST_NAME || ""} ${referralProfile.LAST_NAME || ""}`.trim()
                      : conversation.otherParticipant?.name ||
                        conversation.name}{" "}
                    for the {conversation.jobContext?.jobTitle || "this"}{" "}
                    position.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      setShowReferralFlow(false);
                      resetReferralFlow();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.primaryBtnText}>Back to Messages</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </Modal>

        {/* APPLICATION DETAIL MODAL */}
        {conversation.applicationStatus &&
          (() => {
            const applicationData =
              getApplicationFromConversation(conversation);
            if (!applicationData) return null;

            return (
              <Modal
                visible={showApplicationDetail}
                transparent
                animationType="fade"
              >
                <View style={styles.modalOverlay}>
                  <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setShowApplicationDetail(false)}
                  >
                    <BlurView
                      intensity={60}
                      style={StyleSheet.absoluteFill}
                      tint="dark"
                    />
                  </TouchableOpacity>

                  <Animated.View
                    entering={SlideInDown}
                    exiting={SlideOutDown}
                    style={styles.modalContent}
                  >
                    <View style={styles.modalHandle} />
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setShowApplicationDetail(false)}
                    >
                      <X color="#000" size={24} />
                    </TouchableOpacity>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={styles.modalScroll}
                    >
                      <View style={styles.appDetailHeader}>
                        <Image
                          source={{ uri: applicationData.companyLogo }}
                          style={styles.appDetailLogo}
                        />
                        <Text style={styles.appDetailTitle}>
                          {applicationData.jobTitle}
                        </Text>
                        <Text style={styles.appDetailCompany}>
                          {applicationData.company}
                        </Text>
                        <View style={styles.statusBadgeBlack}>
                          <Text style={styles.statusBadgeBlackText}>
                            {getStatusLabel(applicationData.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>
                          APPLICATION TIMELINE
                        </Text>
                        <View style={styles.timelineDetailContainer}>
                          {applicationData.timeline.map(
                            (stage: any, idx: number) => (
                              <View key={idx} style={styles.timelineDetailItem}>
                                <View style={styles.timelineDetailLeft}>
                                  <View
                                    style={[
                                      styles.timelineDetailDot,
                                      stage.completed &&
                                        styles.timelineDetailDotCompleted,
                                      stage.isReferred &&
                                        styles.timelineDetailDotReferred,
                                      stage.isReferred &&
                                        stage.completed &&
                                        styles.timelineDetailDotReferredCompleted,
                                    ]}
                                  />
                                  {idx <
                                    applicationData.timeline.length - 1 && (
                                    <View
                                      style={[
                                        styles.timelineDetailLine,
                                        stage.completed &&
                                          applicationData.timeline[idx + 1]
                                            .completed &&
                                          styles.timelineDetailLineCompleted,
                                      ]}
                                    />
                                  )}
                                </View>
                                <View style={styles.timelineDetailRight}>
                                  <Text
                                    style={[
                                      styles.timelineDetailStage,
                                      stage.completed &&
                                        styles.timelineDetailStageCompleted,
                                      stage.isReferred &&
                                        stage.completed &&
                                        styles.timelineDetailStageReferred,
                                    ]}
                                  >
                                    {stage.stage}
                                  </Text>
                                  <Text style={styles.timelineDetailDate}>
                                    {stage.date}
                                  </Text>
                                </View>
                              </View>
                            ),
                          )}
                        </View>
                      </View>

                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>SPONSOR</Text>
                        <View style={styles.sponsorCard}>
                          <Image
                            source={{ uri: applicationData.sponsorImage }}
                            style={styles.sponsorDetailAvatar}
                          />
                          <View style={styles.sponsorDetailInfo}>
                            <Text style={styles.sponsorDetailName}>
                              {applicationData.sponsorName}
                            </Text>
                            <Text style={styles.sponsorDetailRole}>
                              {applicationData.sponsorRole} @{" "}
                              {applicationData.company}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>
                          NEXT STEPS
                        </Text>
                        <View style={styles.nextActionCard}>
                          <Clock size={20} color="#000" />
                          <Text style={styles.nextActionText}>
                            {applicationData.nextAction}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.messageBtn}
                        activeOpacity={0.7}
                        onPress={() => setShowApplicationDetail(false)}
                      >
                        <MessageCircle color="#FFF" size={20} />
                        <Text style={styles.messageBtnText}>
                          Continue Conversation
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </Animated.View>
                </View>
              </Modal>
            );
          })()}

        {/* UNMATCH ACTION SHEET */}
        <Modal visible={showUnmatchMenu} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => !isUnmatching && setShowUnmatchMenu(false)}
            >
              <BlurView
                intensity={30}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            </TouchableOpacity>
            <View style={styles.unmatchSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.unmatchSheetTitle}>
                {conversation.otherParticipant.name}
              </Text>
              <Text style={styles.unmatchSheetSubtitle}>
                Unmatching will permanently close this conversation and remove
                it from your inbox. This cannot be undone.
              </Text>
              <TouchableOpacity
                style={[
                  styles.unmatchActionBtn,
                  isUnmatching && { opacity: 0.6 },
                ]}
                onPress={handleUnmatch}
                disabled={isUnmatching}
                activeOpacity={0.7}
              >
                {isUnmatching ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.unmatchActionText}>Unmatch</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unmatchCancelBtn}
                onPress={() => setShowUnmatchMenu(false)}
                disabled={isUnmatching}
                activeOpacity={0.7}
              >
                <Text style={styles.unmatchCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const activeConversations = conversations.filter((conv) => !conv.isHidden);
  const hiddenConversations = conversations.filter((conv) => conv.isHidden);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerTitleContainer}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>Direct lines to your connections</Text>
      </View>

      {conversationsLoading ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Text style={{ color: "#999", fontSize: 15 }}>
            Loading conversations...
          </Text>
        </View>
      ) : conversationsError ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Text style={{ color: "#FF3B30", fontSize: 15, marginBottom: 8 }}>
            Failed to load conversations
          </Text>
          <Text style={{ color: "#999", fontSize: 13, textAlign: "center" }}>
            {conversationsError}
          </Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <MessageCircle size={48} color="#DDD" style={{ marginBottom: 16 }} />
          <Text
            style={{
              color: "#999",
              fontSize: 17,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            No conversations yet
          </Text>
          <Text style={{ color: "#BBB", fontSize: 14, textAlign: "center" }}>
            Start matching with people to begin conversations!
          </Text>
        </View>
      ) : (
        <>
          {/* Active Messages */}
          {activeConversations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                ACTIVE MESSAGES ({activeConversations.length})
              </Text>
              <View style={styles.list}>
                {activeConversations.map((conv, index) => (
                  <Animated.View
                    key={conv.id}
                    entering={FadeInDown.delay(index * 50)}
                  >
                    <TouchableOpacity
                      onPress={() => handleConversationSelect(conv.id)}
                      style={styles.convItem}
                    >
                      <View style={styles.imgWrapper}>
                        <Image
                          source={{
                            uri:
                              conv.otherParticipant.profileImageUrl ||
                              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
                          }}
                          style={styles.convImg}
                        />
                        {conv.unreadCount > 0 && (
                          <View style={styles.dotIndicator} />
                        )}
                      </View>
                      <View style={styles.convMain}>
                        <View style={styles.convHeader}>
                          <Text style={styles.convName}>
                            {conv.otherParticipant.name}
                          </Text>
                          <Text style={styles.convTime}>
                            {conv.lastMessage
                              ? formatTime(
                                  conv.lastMessage.createdAt,
                                ).toUpperCase()
                              : "NEW"}
                          </Text>
                        </View>
                        <Text style={styles.convMsg} numberOfLines={1}>
                          {conv.lastMessage?.content ||
                            "Start a conversation..."}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          {/* Hidden Messages */}
          {hiddenConversations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                HIDDEN (30+ DAYS INACTIVE) ({hiddenConversations.length})
              </Text>
              <View style={styles.list}>
                {hiddenConversations.map((conv, index) => (
                  <Animated.View
                    key={conv.id}
                    entering={FadeInDown.delay(index * 50)}
                  >
                    <TouchableOpacity
                      onPress={() => handleConversationSelect(conv.id)}
                      style={[styles.convItem, styles.convItemHidden]}
                    >
                      <View style={styles.imgWrapper}>
                        <Image
                          source={{
                            uri:
                              conv.otherParticipant.profileImageUrl ||
                              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
                          }}
                          style={[styles.convImg, styles.convImgHidden]}
                        />
                      </View>
                      <View style={styles.convMain}>
                        <View style={styles.convHeader}>
                          <Text
                            style={[styles.convName, styles.convNameHidden]}
                          >
                            {conv.otherParticipant.name}
                          </Text>
                          <Text style={styles.convTime}>
                            {conv.lastMessage
                              ? formatTime(
                                  conv.lastMessage.createdAt,
                                ).toUpperCase()
                              : "OLD"}
                          </Text>
                        </View>
                        <Text
                          style={[styles.convMsg, styles.convMsgHidden]}
                          numberOfLines={1}
                        >
                          {conv.lastMessage?.content || "No messages"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          {/* Load More */}
          {conversations.length < conversationsTotalCount && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMoreConversations}
              disabled={isLoadingMore}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>
                {isLoadingMore ? "Loading..." : "Load More Conversations"}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 140 },
  headerTitleContainer: { marginBottom: 32 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -1.2 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 8 },
  section: { marginBottom: 40 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  list: { gap: 4 },
  loadMoreBtn: {
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center" as const,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#374151",
  },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  convItemHidden: { opacity: 0.6 },
  imgWrapper: { position: "relative" },
  convImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F9F9F9",
  },
  convImgHidden: { opacity: 0.5 },
  dotIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  convMain: { flex: 1, marginLeft: 16 },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convName: { fontSize: 17, fontWeight: "700" },
  convNameHidden: { color: "#999" },
  convTime: { fontSize: 10, fontWeight: "800", color: "#BBB" },
  convMsg: { fontSize: 14, color: "#666" },
  convMsgHidden: { color: "#AAA" },
  chatContainer: { flex: 1, backgroundColor: "#FFF" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  headerImage: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: "700" },
  headerRole: { fontSize: 12, color: "#666" },
  headerReferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerReferText: { fontSize: 13, fontWeight: "700" },
  headerStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9F9F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  headerStatusText: { fontSize: 13, fontWeight: "700", color: "#000" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  messagesScroll: { flex: 1, paddingHorizontal: 20 },
  messagesContent: { paddingTop: 20, paddingBottom: 28, gap: 20 },
  messageWrapper: { maxWidth: "85%" },
  msgLeft: { alignSelf: "flex-start" },
  msgRight: { alignSelf: "flex-end" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: "#000" },
  bubbleThem: { backgroundColor: "#F2F2F2" },
  txtMe: { color: "#FFF", fontSize: 15 },
  txtThem: { color: "#000", fontSize: 15 },
  msgTime: {
    fontSize: 10,
    color: "#BBB",
    marginTop: 6,
    fontWeight: "600",
    alignSelf: "flex-end",
  },
  dayHeader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  dayHeaderText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    backgroundColor: "#FFF",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 44,
    maxHeight: 110,
    marginRight: 10,
    color: "#000",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  jobRefTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 15,
    marginBottom: 20,
  },
  jobRefLabel: { fontSize: 10, fontWeight: "900", color: "#999" },
  jobRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobRefText: { fontSize: 12, fontWeight: "700" },
  swipableContainer: { width: CARD_WIDTH, alignSelf: "center" },
  infoCard: {
    height: 280,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 15,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: "#000" },
  dotInactive: { width: 6, backgroundColor: "#DDD" },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  modalAvatar: { width: 55, height: 55, borderRadius: 27 },
  modalName: { fontSize: 20, fontWeight: "800" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 12, color: "#AAA", fontWeight: "600" },
  bioText: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 15 },
  skillsContainer: { flexDirection: "row", gap: 8, marginBottom: 15 },
  skillChip: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  skillText: { fontSize: 11, fontWeight: "700", color: "#666" },
  statsRow: { flexDirection: "row", gap: 8 },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  statLabel: { fontSize: 11, fontWeight: "800" },
  resumeBtn: {
    flex: 1,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  resumeBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  promptCardInModal: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  promptIconRowInModal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  promptIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  promptQuestionInModal: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  promptAnswerInModal: {
    fontSize: 14,
    fontWeight: "400",
    color: "#666",
    lineHeight: 20,
  },
  fullProfileBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 24,
  },
  fullProfileBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  referFromModalBtn: {
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 12,
  },
  referFromModalBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },

  /* ── Sponsor profile (applicant view) ── */
  sponsorTitleText: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
    fontWeight: "500",
  },
  sponsorReferringRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 10,
  },
  sponsorReferringIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorReferringLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sponsorReferringValue: {
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
    marginTop: 1,
  },
  sponsorBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  sponsorOpenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sponsorOpenBadgeText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "700",
  },
  sponsorMatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sponsorMatchBadgeText: {
    fontSize: 12,
    color: "#222",
    fontWeight: "700",
  },
  sponsorTipText: {
    fontSize: 12,
    color: "#999",
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center",
  },
  sponsorInsightsEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  sponsorInsightsIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sponsorInsightsEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  sponsorInsightsEmptyText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 19,
  },

  referralFlowContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    paddingBottom: 50,
    width: "100%",
    minHeight: 400,
  },
  flowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  flowTitle: { fontSize: 24, fontWeight: "800" },
  stepContent: { gap: 12 },
  stepSubtitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  stepDesc: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 10 },
  vettingList: { gap: 16, marginBottom: 20 },
  vettingItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  vettingCheck: { marginTop: 2 },
  vettingText: { fontSize: 15, fontWeight: "600", color: "#444", flex: 1 },
  primaryBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  primaryBtnDisabled: { backgroundColor: "#E5E5E5" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  summaryScroll: { maxHeight: 450, marginBottom: 10 },
  summaryCard: {
    backgroundColor: "#F8F9FB",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#AAA",
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 16,
  },
  summarySkills: { flexDirection: "row", flexWrap: "wrap" },
  summarySkillText: { fontSize: 13, color: "#666", fontWeight: "600" },
  candidateInfoCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  candidateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  candidateAvatar: { width: 60, height: 60, borderRadius: 30 },
  candidateName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  candidateRole: { fontSize: 14, color: "#666" },
  infoSection: { marginBottom: 20 },
  infoSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#999",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  infoSectionValue: { fontSize: 15, color: "#000", marginBottom: 4 },
  infoSectionLink: {
    fontSize: 14,
    color: "#1E40AF",
    textDecorationLine: "underline",
    marginBottom: 4,
  },
  atsBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  atsBannerText: {
    fontSize: 12,
    color: "#1E40AF",
    flex: 1,
    lineHeight: 18,
    fontWeight: "500",
  },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  skillBadge: {
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skillBadgeText: { fontSize: 12, fontWeight: "700", color: "#000" },
  finalChecklist: { marginTop: 20, gap: 10 },
  checklistTitle: { fontSize: 14, fontWeight: "800", marginBottom: 5 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  checkText: { fontSize: 12, color: "#666", fontWeight: "500" },
  confirmBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  successStep: { alignItems: "center", paddingVertical: 20, width: "100%" },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  successDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },

  // Application Detail Modal Styles
  modalCloseBtn: { position: "absolute", top: 24, right: 24, zIndex: 10 },
  modalScroll: { maxHeight: "80%" },
  appDetailHeader: { alignItems: "center", marginBottom: 32 },
  appDetailLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#F9F9F9",
    marginBottom: 16,
  },
  appDetailTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
  },
  appDetailCompany: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
    marginBottom: 16,
  },
  statusBadgeBlack: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusBadgeBlackText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  detailSection: { marginBottom: 28 },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  timelineDetailContainer: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
  },
  timelineDetailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  timelineDetailLeft: { alignItems: "center", marginRight: 16 },
  timelineDetailDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E5E5",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  timelineDetailDotCompleted: { backgroundColor: "#000" },
  timelineDetailDotReferred: { width: 18, height: 18, borderRadius: 9 },
  timelineDetailDotReferredCompleted: {
    backgroundColor: "#000",
    borderWidth: 4,
    borderColor: "#F9F9F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineDetailLine: {
    width: 2,
    height: 32,
    backgroundColor: "#E5E5E5",
    marginTop: 4,
  },
  timelineDetailLineCompleted: { backgroundColor: "#BBB" },
  timelineDetailRight: { flex: 1, paddingTop: 2 },
  timelineDetailStage: {
    fontSize: 15,
    fontWeight: "700",
    color: "#999",
    marginBottom: 2,
  },
  timelineDetailStageCompleted: { color: "#000" },
  timelineDetailStageReferred: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timelineDetailDate: { fontSize: 13, color: "#BBB", fontWeight: "600" },
  sponsorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 16,
  },
  sponsorDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
  },
  sponsorDetailInfo: { flex: 1, marginLeft: 12 },
  sponsorDetailName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  sponsorDetailRole: { fontSize: 13, color: "#666", fontWeight: "600" },
  nextActionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF9E6",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  nextActionText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#000" },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  messageBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  // Referral flow
  referralProfileLoading: {
    paddingVertical: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  referralProfileLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "400" as const,
  },
  candidateAvatarFallback: {
    backgroundColor: "#E0E0E0",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  referralErrorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  referralErrorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  unmatchSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 52,
  },
  unmatchSheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  unmatchSheetSubtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  unmatchActionBtn: {
    paddingVertical: 17,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  unmatchActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  unmatchCancelBtn: {
    paddingVertical: 17,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  unmatchCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
});
