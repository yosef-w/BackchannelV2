import {
    trackConversationOpened,
    trackMessageSent,
    trackPublicProfileOpenedFromMessage,
    trackReferralSubmitted,
    trackUnmatchConfirmed,
} from "@/lib/analytics/mixpanel";
import {
    getBasicProfile,
    getConversationMessages,
    getConversations,
    getPublicProfile,
    listReferrals,
    sendMessage,
    submitReferral,
    unmatchConversation,
} from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { BlurView } from "expo-blur";
import {
    ArrowLeft,
    Briefcase,
    CheckCircle,
    ChevronRight,
    ClipboardCheck,
    Clock,
    FileText,
    Globe,
    GraduationCap,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Send,
    ShieldCheck,
    Sparkles,
    User,
    UserCheck,
    X,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
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
import { CharCounter } from "./ui/CharCounter";
import { CompanyLogo } from "./ui/CompanyLogo";
import { DismissibleSheet } from "./ui/DismissibleSheet";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

interface MessagesViewProps {
  onThreadActiveChange?: (isThreadActive: boolean) => void;
  userType?: "applicant" | "sponsor";
  onShowPublicProfile?: (userData: any) => void;
  selectedConversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  pendingJobId?: string | null;
  // Counterpart user id — when present, the auto-navigate effect picks the
  // conversation matching BOTH jobId AND otherParticipant.id, which is
  // required for sponsors with multiple matched applicants on the same job.
  pendingUserId?: string | null;
  onPendingJobConsumed?: () => void;
}

export function MessagesView({
  onThreadActiveChange,
  userType = "sponsor",
  onShowPublicProfile,
  selectedConversationId: externalSelectedConversationId,
  onConversationChange,
  pendingJobId,
  pendingUserId,
  onPendingJobConsumed,
}: MessagesViewProps) {
  // Store current user ID from profile API to determine which participant to show
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

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
  const [conversationsTotalCount, setConversationsTotalCount] = useState(0);

  // Conversations list — backed by React Query so it survives tab switches and
  // paints instantly on re-entry. staleTime: Infinity + refetchOnWindowFocus:
  // false means React Query NEVER auto-refetches behind the live inbox
  // WebSocket; the socket and pagination keep the cached list current through
  // the `setConversations` shim below, which has the exact signature of a
  // useState setter so every existing call site (WS updates, pagination,
  // mark-read/closed) is unchanged. Explicit refreshes go through
  // refreshConversations() → refetchConversations().
  const {
    data: conversations = [],
    isLoading: conversationsQueryLoading,
    error: conversationsErrorObj,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["conversations", "list", currentUserId],
    enabled: !!currentUserId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<any[]> => {
      try {
        const response = await getConversations({ limit: 20, offset: 0 });
        setConversationsTotalCount(
          response.total_count ?? response.conversations.length,
        );
        return response.conversations.map((conv) =>
          transformConversation(conv as any),
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch conversations";
        // 404 = endpoint not available yet or no conversations — empty state.
        if (errorMessage.includes("Not found") || errorMessage.includes("404"))
          return [];
        throw err;
      }
    },
  });
  // Before the user id resolves we're still "loading" (matches the old
  // initial `true`); after that, follow the query's first-load state only —
  // background refetches keep `conversations` visible (no flash).
  const conversationsLoading = !currentUserId || conversationsQueryLoading;
  const conversationsError =
    conversationsErrorObj instanceof Error ? conversationsErrorObj.message : null;

  // Shim with the exact (value | updater) signature of a useState setter, so
  // every existing setConversations(...) call site works unchanged while the
  // list actually lives in the React Query cache.
  const setConversations = useCallback(
    (next: any[] | ((prev: any[]) => any[])) => {
      queryClient.setQueryData<any[]>(
        ["conversations", "list", currentUserId],
        (prev) =>
          typeof next === "function"
            ? (next as (p: any[]) => any[])(prev ?? [])
            : next,
      );
    },
    [queryClient, currentUserId],
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Inbox grouping: which participant-groups are expanded (keyed by the
  // other participant's user id). Multi-thread people collapse into one row;
  // tapping expands their per-role sub-threads.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sendingMessage, setSendingMessage] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);

  // Referral flow — full public profile of the applicant being referred
  const [referralProfile, setReferralProfile] = useState<any>(null);
  const [referralProfileLoading, setReferralProfileLoading] = useState(false);

  // Tracks which (applicantUserId:jobId) pairs have already been referred so
  // the header button reflects the referral status without a separate lookup.
  const [referredSet, setReferredSet] = useState<Set<string>>(new Set());

  // Unmatch
  const [showUnmatchMenu, setShowUnmatchMenu] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);

  // Refs mirror state for use inside the long-lived inbox WebSocket handler,
  // which is created once and must read the *current* values without the
  // socket reconnecting every time selection or the list changes.
  const selectedConversationRef = useRef<string | null>(selectedConversation);
  const conversationsRef = useRef<any[]>(conversations);
  const prevSelectedRef = useRef<string | null>(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Fetch existing referrals (sponsor only) so the button reflects prior
  // referrals correctly even before the sponsor submits a new one.
  useEffect(() => {
    if (userType !== "sponsor") return;
    listReferrals({ limit: 100 })
      .then((res) => {
        const keys = (res.referrals || [])
          .filter((r) => r.STATUS === "REFERRED")
          .map((r) => `${r.APPLICANT_USER_ID}:${r.JOB_ID}`);
        setReferredSet(new Set(keys));
      })
      .catch(() => {
        // Non-fatal — button just stays in the default state
      });
  }, [userType]);

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

  // (Initial fetch is handled by the conversations useQuery above, which runs
  // automatically once `currentUserId` is set — no manual effect needed.)

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
      // Backend returns 'ACTIVE' or 'CLOSED' (closed = unmatched).
      status: (c.STATUS as "ACTIVE" | "CLOSED") || "ACTIVE",
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
        // Forward-compat — /api/messages/conversations/ doesn't currently
        // join LOGO_URL onto the row. Pull whichever naming surfaces if
        // backend adds it later; otherwise stays undefined and downstream
        // CompanyLogo components fall back to the company initial.
        logoUrl: c.LOGO_URL || c.logo_url || c.ORGANIZATION_LOGO || undefined,
      },
      createdAt: new Date().toISOString(),
    };
  };

  // Re-fetch the conversation list. Used by background refreshers (the inbox
  // socket, returning to the list from a thread). React Query keeps the
  // previous list visible during the refetch and on error, so the update is
  // inherently flash-free and a transient network error never wipes a good
  // list — the `silent` param is kept for call-site compatibility but is no
  // longer needed.
  const refreshConversations = async (_silent = false) => {
    if (!currentUserId) return;
    await refetchConversations();
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

              // Keep the inbox list's last-message preview in sync so the
              // conversation row updates live instead of going stale until
              // the list is refetched (e.g. on a tab switch).
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === selectedConversation
                    ? {
                        ...c,
                        lastMessage: {
                          content: newMessage.content,
                          senderId: newMessage.senderId,
                          createdAt: newMessage.createdAt,
                          isRead: true,
                        },
                      }
                    : c,
                ),
              );

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

  // ── Inbox-wide live updates ────────────────────────────────────────────
  // A single per-user WebSocket (ws/inbox/) kept open the whole time the
  // Messages tab is mounted. The backend pushes an `inbox.update` event
  // whenever ANY of this user's conversations gets a new message, so the
  // conversation-list previews stay live — even for threads that aren't
  // open. The per-conversation chat socket above only covers the thread
  // currently being viewed.
  //
  // Until the backend ships the `ws/inbox/` route (see §11 in
  // docs/BACKEND_CHANGES_NEEDED.md) the connection just fails and retries
  // quietly — the inbox still works via the on-mount fetch, the in-thread
  // message mirroring, and the refetch-on-return fallback below.
  useEffect(() => {
    if (!currentUserId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;
    let hasConnectedOnce = false;

    const applyInboxUpdate = (data: any) => {
      const convId = data.conversation_id;
      if (!convId) return;

      // Message landed in a conversation not in our list yet (e.g. a
      // brand-new match's first message) — pull the fresh list instead.
      if (!conversationsRef.current.some((c) => c.id === convId)) {
        refreshConversations(true);
        return;
      }

      const isFromMe = String(data.sender_user_id) === String(currentUserId);
      const isOpen = selectedConversationRef.current === convId;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: {
                  content: data.body,
                  senderId: data.sender_user_id,
                  createdAt: data.created_at,
                  isRead: true,
                },
                // Flag unread only when it's from the other person and we're
                // not already looking at that thread.
                unreadCount: !isFromMe && !isOpen ? 1 : c.unreadCount,
              }
            : c,
        ),
      );
    };

    const connect = () => {
      if (cancelled) return;
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return;

      try {
        const wsUrl = `wss://oyster-app-4pg5w.ondigitalocean.app/ws/inbox/?token=${accessToken}`;
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.warn("[MessagesView] Inbox WebSocket failed to open:", err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        // After a reconnect, refetch to catch anything missed while down.
        if (hasConnectedOnce) refreshConversations(true);
        hasConnectedOnce = true;
        console.log("[MessagesView] Inbox WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "inbox.update") applyInboxUpdate(data);
        } catch (err) {
          console.warn("[MessagesView] Bad inbox WebSocket payload:", err);
        }
      };

      ws.onerror = () => {
        // `onclose` fires right after and handles reconnect.
      };

      ws.onclose = (event) => {
        if (cancelled) return;
        // 4001 = bad token, 4003 = forbidden — don't hammer reconnect on
        // an auth failure that won't fix itself.
        if (event.code === 4001 || event.code === 4003) {
          console.warn("[MessagesView] Inbox WebSocket rejected:", event.code);
          return;
        }
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      attempt += 1;
      // Exponential backoff, capped at 30s.
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [currentUserId]);

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
    if (conversationId) {
      const conv = conversations.find((c) => c.id === conversationId);
      trackConversationOpened({
        conversationId,
        unreadCount: conv?.unreadCount,
      });
    }
  };

  const handleUnmatch = async () => {
    if (!selectedConversation) return;
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

  // Auto-navigate to a conversation thread when coming from Matches tab via
  // pendingJobId. When `pendingUserId` is also supplied (matches list cards
  // pass it now), match on BOTH jobId AND counterpart user id — necessary
  // because a sponsor with multiple matched applicants on the same job has
  // multiple conversations sharing that jobId, and find()-by-jobId-alone
  // would always pick the first one. Falls back to jobId-only when no
  // user hint is provided (older call sites that don't disambiguate).
  useEffect(() => {
    if (!pendingJobId || conversations.length === 0) return;
    const conv = pendingUserId
      ? conversations.find(
          (c) =>
            c.jobContext?.jobId === pendingJobId &&
            c.otherParticipant?.id === pendingUserId,
        )
      : conversations.find((c) => c.jobContext?.jobId === pendingJobId);
    if (conv) {
      handleConversationSelect(conv.id);
      onPendingJobConsumed?.();
    }
  }, [pendingJobId, pendingUserId, conversations]);

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
    // Mirror it into the inbox list so the conversation row's preview and
    // timestamp update immediately, without waiting for a list refetch.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation
          ? {
              ...c,
              lastMessage: {
                content: tempMessage.content,
                senderId: tempMessage.senderId,
                createdAt: tempMessage.createdAt,
                isRead: true,
              },
            }
          : c,
      ),
    );
    const messageToSend = messageText.trim();
    setMessageText("");

    try {
      setSendingMessage(true);
      console.log("[MessagesView] Sending message:", messageToSend);

      const response = await sendMessage(selectedConversation, messageToSend);
      console.log("[MessagesView] Message sent:", response);
      trackMessageSent({
        conversationId: selectedConversation,
        messageLength: messageToSend.length,
      });

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

  // Refetch the list when the user backs out of a thread to the inbox.
  // The inbox socket already keeps previews live; this is a cheap, instant
  // fallback that also clears the unread dot on the thread just exited
  // (the backend marks it read when its messages were fetched).
  useEffect(() => {
    const wasInThread = prevSelectedRef.current;
    prevSelectedRef.current = selectedConversation;
    if (wasInThread && !selectedConversation) {
      refreshConversations(true);
    }
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
      applied: { backgroundColor: "#666" },
      reviewing: { backgroundColor: "#666" },
      interview_scheduled: { backgroundColor: "#000" },
      offer: { backgroundColor: "#000" },
      rejected: { backgroundColor: "#DC2626" },
    };
    return (
      colors[status as keyof typeof colors] || { backgroundColor: "#9CA3AF" }
    );
  };

  const getStatusBadgeStyle = (status: string) => {
    const styles = {
      applied: { backgroundColor: "#F4F4F5", borderColor: "#E5E5E5" },
      reviewing: { backgroundColor: "#F4F4F5", borderColor: "#E5E5E5" },
      interview_scheduled: {
        backgroundColor: "#F4F4F5",
        borderColor: "#E5E5E5",
      },
      offer: { backgroundColor: "#F4F4F5", borderColor: "#E5E5E5" },
      rejected: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
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
      applied: { color: "#666" },
      reviewing: { color: "#666" },
      interview_scheduled: { color: "#000" },
      offer: { color: "#000" },
      rejected: { color: "#DC2626" },
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

  /** Normalize a backend ISO string to UTC (append 'Z' when no offset present). */
  const normalizeToUtc = (s: string): string => {
    const t = s.trim();
    return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t) ? s : `${s}Z`;
  };

  // Day header formatter for message thread dividers
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

  // Helper function to format time
  const formatTime = (timestamp: string) => {
    const date = new Date(normalizeToUtc(timestamp));
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    // Guard against clock skew / future timestamps.
    if (diff < 0) return "just now";
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
                </>
              )}
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
                onPress={handleSendMessage}
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
              image: conversation.otherParticipant?.profileImageUrl,
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
                        onShowPublicProfile(conversation);
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
                        onShowPublicProfile(conversation);
                      }
                    },
                  }
                : undefined
            }
          />
        )}

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
                          <CheckCircle size={18} color="#000" />
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
                          <CheckCircle size={18} color="#000" />
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
                          <CheckCircle size={18} color="#000" />
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
                          <CheckCircle size={18} color="#000" />
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
                  <ScrollView
                    style={styles.summaryScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    {referralProfileLoading ? (
                      <View style={styles.referralProfileLoading}>
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: "#F4F4F5",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 8,
                          }}
                        >
                          <User color="#BBB" size={24} strokeWidth={2} />
                        </View>
                        <Text style={styles.referralProfileLoadingText}>
                          Loading candidate details…
                        </Text>
                      </View>
                    ) : (
                      (() => {
                        const photo =
                          referralProfile?.PHOTO_URL ||
                          conversation.profileImageUrl;
                        const name = referralProfile
                          ? `${referralProfile.FIRST_NAME || ""} ${
                              referralProfile.LAST_NAME || ""
                            }`.trim()
                          : conversation.otherParticipant?.name ||
                            conversation.name;
                        const currentRole =
                          referralProfile?.applicant_profile?.CURRENT_ROLE ||
                          conversation.otherParticipant?.role ||
                          conversation.role ||
                          "";
                        const location = [
                          referralProfile?.CITY,
                          referralProfile?.STATE,
                        ]
                          .filter(Boolean)
                          .join(", ");
                        const industry =
                          referralProfile?.applicant_profile?.INDUSTRY || "";
                        const yearsExp =
                          referralProfile?.applicant_profile?.YEARS_EXPERIENCE;
                        const jobTitle =
                          conversation.jobContext?.jobTitle || "";
                        const company = conversation.jobContext?.company || "";
                        const bio = referralProfile?.BIO;
                        const experiences: any[] =
                          referralProfile?.applicant_profile
                            ?.PROFESSIONAL_EXPERIENCES || [];
                        const education: any[] =
                          referralProfile?.applicant_profile
                            ?.EDUCATION_ENTRIES || [];
                        const skills: string[] =
                          referralProfile?.applicant_profile?.SKILLS ||
                          conversation.skills ||
                          [];
                        const portfolioUrl = referralProfile?.PORTFOLIO_URL;

                        return (
                          <View style={{ gap: 12 }}>
                            {/* ATS hint banner — monochrome, modern */}
                            <View style={styles.atsBanner}>
                              <FileText
                                size={14}
                                color="#666"
                                strokeWidth={2}
                              />
                              <Text style={styles.atsBannerText}>
                                Enter these details into your ATS portal when
                                submitting the referral.
                              </Text>
                            </View>

                            {/* Hero: avatar + name + current role + quick chips */}
                            <View style={styles.candidateHero}>
                              {photo ? (
                                <Image
                                  source={{ uri: photo }}
                                  style={styles.candidateHeroAvatar}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.candidateHeroAvatar,
                                    styles.candidateHeroAvatarFallback,
                                  ]}
                                >
                                  <User color="#999" size={32} />
                                </View>
                              )}
                              <Text
                                style={styles.candidateHeroName}
                                numberOfLines={1}
                              >
                                {name}
                              </Text>
                              {!!currentRole && (
                                <Text
                                  style={styles.candidateHeroRole}
                                  numberOfLines={1}
                                >
                                  {currentRole}
                                </Text>
                              )}
                              {(!!location || !!industry || !!yearsExp) && (
                                <View style={styles.candidateChipsRow}>
                                  {!!location && (
                                    <View style={styles.candidateChip}>
                                      <MapPin size={11} color="#666" />
                                      <Text style={styles.candidateChipText}>
                                        {location}
                                      </Text>
                                    </View>
                                  )}
                                  {!!industry && (
                                    <View style={styles.candidateChip}>
                                      <Briefcase size={11} color="#666" />
                                      <Text style={styles.candidateChipText}>
                                        {industry}
                                      </Text>
                                    </View>
                                  )}
                                  {!!yearsExp && (
                                    <View style={styles.candidateChip}>
                                      <Clock size={11} color="#666" />
                                      <Text style={styles.candidateChipText}>
                                        {yearsExp} yrs
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>

                            {/* APPLYING FOR — role-context card. Hero logo
                                from PR #62 pipeline when conversations
                                eventually carry one (currently undefined,
                                so falls back to the company initial). */}
                            {!!jobTitle && (
                              <View style={styles.refContext}>
                                <View style={styles.refContextRow}>
                                  <CompanyLogo
                                    logoUrl={conversation.jobContext?.logoUrl}
                                    name={company || jobTitle}
                                    size={40}
                                    borderRadius={10}
                                    initialFontSize={17}
                                  />
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.refContextLabel}>
                                      APPLYING FOR
                                    </Text>
                                    <Text
                                      style={styles.refContextTitle}
                                      numberOfLines={1}
                                    >
                                      {jobTitle}
                                    </Text>
                                    {!!company && (
                                      <Text
                                        style={styles.refContextCompany}
                                        numberOfLines={1}
                                      >
                                        {company}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              </View>
                            )}

                            {/* Professional Summary */}
                            {!!bio && (
                              <View style={styles.refSection}>
                                <View style={styles.refSectionHeader}>
                                  <FileText size={16} color="#000" />
                                  <Text style={styles.refSectionTitle}>
                                    Professional Summary
                                  </Text>
                                </View>
                                <Text style={styles.refSectionBody}>{bio}</Text>
                              </View>
                            )}

                            {/* Experience — full list */}
                            {(experiences.length > 0 || !!yearsExp) && (
                              <View style={styles.refSection}>
                                <View style={styles.refSectionHeader}>
                                  <Briefcase size={16} color="#000" />
                                  <Text style={styles.refSectionTitle}>
                                    Experience
                                  </Text>
                                </View>
                                {!!yearsExp && (
                                  <Text style={styles.refSectionMeta}>
                                    {yearsExp} years in industry
                                  </Text>
                                )}
                                {experiences.map((exp: any, idx: number) => (
                                  <View
                                    key={idx}
                                    style={[
                                      styles.refEntryRow,
                                      idx > 0 && styles.refEntryRowDivider,
                                    ]}
                                  >
                                    <Text style={styles.refEntryTitle}>
                                      {exp.jobTitle || "Role"}
                                    </Text>
                                    <Text style={styles.refEntryMeta}>
                                      {exp.company || ""}
                                      {exp.current
                                        ? " · Current"
                                        : exp.endDate
                                          ? ` · ${exp.endDate}`
                                          : ""}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* Education — full list */}
                            {education.length > 0 && (
                              <View style={styles.refSection}>
                                <View style={styles.refSectionHeader}>
                                  <GraduationCap size={16} color="#000" />
                                  <Text style={styles.refSectionTitle}>
                                    Education
                                  </Text>
                                </View>
                                {education.map((edu: any, idx: number) => {
                                  const degreeLine = [edu.degree, edu.major]
                                    .filter(Boolean)
                                    .join(" in ");
                                  const head =
                                    degreeLine || edu.university || "Education";
                                  const meta = degreeLine ? edu.university : "";
                                  return (
                                    <View
                                      key={idx}
                                      style={[
                                        styles.refEntryRow,
                                        idx > 0 && styles.refEntryRowDivider,
                                      ]}
                                    >
                                      <Text style={styles.refEntryTitle}>
                                        {head}
                                      </Text>
                                      {!!meta && (
                                        <Text style={styles.refEntryMeta}>
                                          {meta}
                                        </Text>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Key Skills */}
                            {skills.length > 0 && (
                              <View style={styles.refSection}>
                                <View style={styles.refSectionHeader}>
                                  <Sparkles size={16} color="#000" />
                                  <Text style={styles.refSectionTitle}>
                                    Key Skills
                                  </Text>
                                </View>
                                <View style={styles.skillsRow}>
                                  {skills.map((skill: string, idx: number) => (
                                    <View key={idx} style={styles.skillBadge}>
                                      <Text style={styles.skillBadgeText}>
                                        {skill}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* Portfolio */}
                            {!!portfolioUrl && (
                              <View style={styles.refSection}>
                                <View style={styles.refSectionHeader}>
                                  <Globe size={16} color="#000" />
                                  <Text style={styles.refSectionTitle}>
                                    Portfolio
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() =>
                                    Linking.openURL(portfolioUrl).catch(
                                      () => {},
                                    )
                                  }
                                  activeOpacity={0.7}
                                  style={styles.refPortfolio}
                                >
                                  <Text
                                    style={styles.refPortfolioText}
                                    numberOfLines={1}
                                  >
                                    {portfolioUrl}
                                  </Text>
                                  <Globe size={14} color="#666" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })()
                    )}
                    {/* Final Confirmation — always shown, even while
                        the candidate profile is still loading */}
                    <View style={[styles.refSection, { marginTop: 12 }]}>
                      <View style={styles.refSectionHeader}>
                        <ShieldCheck size={16} color="#000" />
                        <Text style={styles.refSectionTitle}>
                          Final Confirmation
                        </Text>
                      </View>
                      <View style={styles.refFinalRow}>
                        <View style={styles.refFinalBullet} />
                        <Text style={styles.refFinalText}>
                          This referral is binding within our system.
                        </Text>
                      </View>
                      <View style={styles.refFinalRow}>
                        <View style={styles.refFinalBullet} />
                        <Text style={styles.refFinalText}>
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
                        trackReferralSubmitted({
                          conversationId: selectedConversation || "",
                          jobId,
                          applicantUserId,
                        });
                        // Mark this pair as referred so the header button
                        // updates immediately without a re-fetch.
                        setReferredSet((prev) => {
                          const next = new Set(prev);
                          next.add(`${applicantUserId}:${jobId}`);
                          return next;
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
                    <CheckCircle size={60} color="#000" />
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

        {/* UNMATCH ACTION SHEET — same visual + motion pattern as the
            profile detail sheet: fade-in blur backdrop, swipe-down
            dismissible bottom sheet, no native slide animation. Keeps the
            modal language consistent across the message thread. */}
        <Modal visible={showUnmatchMenu} transparent animationType="none">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
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

            <DismissibleSheet
              onDismiss={() => !isUnmatching && setShowUnmatchMenu(false)}
              style={styles.unmatchSheet}
            >
              <Text style={styles.unmatchSheetTitle}>
                {conversation.otherParticipant.name}
              </Text>
              <Text style={styles.unmatchSheetSubtitle}>
                Unmatching permanently ends your match and closes this
                conversation. It moves to Past Connections as read-only and
                can't be undone.
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
                  <ActivityIndicator size="small" color="#FFF" />
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
            </DismissibleSheet>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // Split conversations into three buckets:
  //   - Active: open, ongoing threads
  //   - Past Connections: unmatched (status === 'CLOSED') — read-only,
  //     surfaced separately so users see prior matches haven't vanished
  //   - Hidden: inactive 30+ days (existing concept, kept as-is)
  // The backend's GET /api/messages/conversations/ returns CLOSED threads
  // alongside ACTIVE ones with no status filter, so partitioning client-side
  // is correct (and avoids breaking other surfaces that may rely on the
  // unfiltered list).
  // ── Inbox grouping ──────────────────────────────────────────────────
  // A conversation exists per JOB_ID, so matching the same person on N roles
  // yields N threads and the same name repeats down the inbox. We collapse
  // threads by the other participant into a single row. One thread → a normal
  // row (unchanged). Multiple → a person row with a "N roles" pill that
  // expands into per-role sub-threads. Threads stay separate underneath, so
  // per-role context (and referrals) is untouched — only the list collapses.
  const toggleGroup = (key: string) => {
    // Single-open accordion: opening one person's roles collapses any other,
    // so tapping a different group also reads as "tap outside the open one".
    setExpandedGroups((prev) => (prev.has(key) ? new Set() : new Set([key])));
  };

  const convTimeMs = (conv: any) => {
    const t = conv?.lastMessage?.createdAt;
    if (!t) return 0;
    const ms = new Date(t).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };

  const groupByParticipant = (list: any[]) => {
    const map = new Map<string, any[]>();
    list.forEach((c) => {
      const key = c.otherParticipant?.id || c.id;
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    });
    const groups = Array.from(map.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => convTimeMs(b) - convTimeMs(a));
      return {
        key,
        items: sorted,
        latest: sorted[0],
        latestAt: convTimeMs(sorted[0]),
        // Count of threads with unread, used for the aggregated dot.
        unreadCount: items.reduce(
          (n, c) => n + (c.unreadCount > 0 ? 1 : 0),
          0,
        ),
      };
    });
    groups.sort((a, b) => b.latestAt - a.latestAt);
    return groups;
  };

  const renderConvAvatar = (
    name: string,
    imageUrl: string | undefined,
    opts: { hidden?: boolean; unread?: boolean },
  ) => (
    <View style={styles.imgWrapper}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={
            opts.hidden ? [styles.convImg, styles.convImgHidden] : styles.convImg
          }
        />
      ) : (
        <View
          style={[
            styles.convImg,
            opts.hidden && styles.convImgHidden,
            {
              backgroundColor: "#000",
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFF" }}>
            {(name || "?")[0].toUpperCase()}
          </Text>
        </View>
      )}
      {opts.unread && <View style={styles.dotIndicator} />}
    </View>
  );

  // A single thread shown as a full inbox row (person primary). Faithfully
  // reproduces the three section looks (active / past / hidden).
  const renderLeafRow = (conv: any, variant: "active" | "past" | "hidden") => {
    const hidden = variant !== "active";
    const nameStyle =
      variant === "active"
        ? styles.convName
        : [styles.convName, styles.convNameHidden];
    const msgStyle =
      variant === "active"
        ? styles.convMsg
        : [styles.convMsg, styles.convMsgHidden];
    return (
      <TouchableOpacity
        onPress={() => handleConversationSelect(conv.id)}
        style={
          variant === "active"
            ? styles.convItem
            : [styles.convItem, styles.convItemHidden]
        }
        activeOpacity={0.7}
      >
        {renderConvAvatar(
          conv.otherParticipant.name,
          conv.otherParticipant.profileImageUrl,
          { hidden, unread: variant === "active" && conv.unreadCount > 0 },
        )}
        <View style={styles.convMain}>
          <View style={styles.convHeader}>
            <Text style={nameStyle} numberOfLines={1}>
              {conv.otherParticipant.name}
            </Text>
            {variant === "past" ? (
              <Text style={styles.unmatchedTag}>UNMATCHED</Text>
            ) : (
              <Text style={styles.convTime}>
                {conv.lastMessage
                  ? formatTime(conv.lastMessage.createdAt).toUpperCase()
                  : variant === "hidden"
                    ? "OLD"
                    : "NEW"}
              </Text>
            )}
          </View>
          <Text style={msgStyle} numberOfLines={1}>
            {conv.lastMessage?.content ||
              (variant === "active" ? "Start a conversation..." : "No messages")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // A per-role thread shown inside an expanded group. Role/job is primary,
  // since the person is already named on the group header above.
  const renderSubRow = (conv: any, variant: "active" | "past" | "hidden") => {
    const roleLabel = conv.jobContext?.jobTitle || conv.role || "Role";
    const unread = variant === "active" && conv.unreadCount > 0;
    return (
      <TouchableOpacity
        key={conv.id}
        onPress={() => handleConversationSelect(conv.id)}
        style={styles.subRow}
        activeOpacity={0.7}
      >
        <View style={unread ? styles.subRowUnreadDot : styles.subRowDotSpacer} />
        <View style={styles.subRowMain}>
          <View style={styles.subRowHeader}>
            <Text
              style={
                variant === "active"
                  ? styles.subRowRole
                  : [styles.subRowRole, styles.subRowRoleHidden]
              }
              numberOfLines={1}
            >
              {roleLabel}
            </Text>
            {variant === "past" ? (
              <Text style={styles.unmatchedTag}>UNMATCHED</Text>
            ) : (
              <Text style={styles.subRowTime}>
                {conv.lastMessage
                  ? formatTime(conv.lastMessage.createdAt).toUpperCase()
                  : variant === "hidden"
                    ? "OLD"
                    : "NEW"}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.subRowMsg,
              variant !== "active" && styles.convMsgHidden,
            ]}
            numberOfLines={1}
          >
            {conv.lastMessage?.content ||
              (variant === "active" ? "Start a conversation..." : "No messages")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // A person with multiple role-threads: one collapsible row.
  const renderGroup = (
    group: any,
    variant: "active" | "past" | "hidden",
  ) => {
    const conv = group.latest;
    const expanded = expandedGroups.has(group.key);
    const hidden = variant !== "active";
    const nameStyle =
      variant === "active"
        ? styles.convName
        : [styles.convName, styles.convNameHidden];
    const msgStyle =
      variant === "active"
        ? styles.convMsg
        : [styles.convMsg, styles.convMsgHidden];
    return (
      <>
        <TouchableOpacity
          onPress={() => toggleGroup(group.key)}
          style={
            variant === "active"
              ? styles.convItem
              : [styles.convItem, styles.convItemHidden]
          }
          activeOpacity={0.7}
        >
          {renderConvAvatar(
            conv.otherParticipant.name,
            conv.otherParticipant.profileImageUrl,
            { hidden, unread: variant === "active" && group.unreadCount > 0 },
          )}
          <View style={styles.convMain}>
            <View style={styles.convHeader}>
              <Text style={nameStyle} numberOfLines={1}>
                {conv.otherParticipant.name}
              </Text>
              {variant === "past" ? (
                <Text style={styles.unmatchedTag}>UNMATCHED</Text>
              ) : (
                <Text style={styles.convTime}>
                  {conv.lastMessage
                    ? formatTime(conv.lastMessage.createdAt).toUpperCase()
                    : ""}
                </Text>
              )}
            </View>
            <View style={styles.convPreviewRow}>
              <Text style={[msgStyle, { flex: 1 }]} numberOfLines={1}>
                {conv.lastMessage?.content ||
                  `${group.items.length} conversations`}
              </Text>
              <View style={styles.rolesPill}>
                <Briefcase size={11} color="#666" />
                <Text style={styles.rolesPillText}>
                  {group.items.length} roles
                </Text>
              </View>
            </View>
          </View>
          <ChevronRight
            size={18}
            color="#BBB"
            style={[
              styles.groupChevron,
              expanded && { transform: [{ rotate: "90deg" }] },
            ]}
          />
        </TouchableOpacity>
        {expanded && (
          <View style={styles.convSubList}>
            {group.items.map((c: any) => renderSubRow(c, variant))}
          </View>
        )}
      </>
    );
  };

  // Group a section's conversations, then render each group as either a
  // single leaf row or a collapsible person-group.
  const renderGroupedList = (
    list: any[],
    variant: "active" | "past" | "hidden",
  ) =>
    groupByParticipant(list).map((group, index) => (
      <Animated.View key={group.key} entering={FadeInDown.delay(index * 50)}>
        {group.items.length === 1
          ? renderLeafRow(group.items[0], variant)
          : renderGroup(group, variant)}
      </Animated.View>
    ));

  const activeConversations = conversations.filter(
    (conv) => conv.status !== "CLOSED" && !conv.isHidden,
  );
  const pastConversations = conversations.filter(
    (conv) => conv.status === "CLOSED",
  );
  const hiddenConversations = conversations.filter(
    (conv) => conv.status !== "CLOSED" && conv.isHidden,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
    >
      {/* flex:1 surface so a tap on any empty inbox space collapses an open
          role group — "tap outside to dismiss". Row touchables win the
          responder, so their taps don't reach this. */}
      <Pressable
        style={{ flex: 1 }}
        onPress={() => {
          if (expandedGroups.size) setExpandedGroups(new Set());
        }}
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
          <Text style={{ color: "#DC2626", fontSize: 15, marginBottom: 8 }}>
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
                {renderGroupedList(activeConversations, "active")}
              </View>
            </View>
          )}

          {/* Past Connections — unmatched conversations (status === 'CLOSED').
              Visually muted with the same convItemHidden styles so they
              read as "archived". Still tappable so users can review the
              prior thread, but the send-message input below is disabled. */}
          {pastConversations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                PAST CONNECTIONS ({pastConversations.length})
              </Text>
              <View style={styles.list}>
                {renderGroupedList(pastConversations, "past")}
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
                {renderGroupedList(hiddenConversations, "hidden")}
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
      </Pressable>
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
  // ── Grouped inbox rows (same person, multiple role-threads) ──────────
  // Second line of a group header: latest-message preview + a "N roles"
  // pill so the user sees at a glance this person spans several roles.
  convPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rolesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rolesPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 0.3,
  },
  // Chevron at the row's trailing edge; rotated 90° when the group is open.
  groupChevron: { marginLeft: 8 },
  // Expanded per-role sub-threads, indented under the person row with a
  // hairline rail aligned to the avatar's right edge (avatar 56 + 16 gap).
  convSubList: {
    marginLeft: 72,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#EFEFEF",
    marginTop: 2,
    marginBottom: 8,
  },
  subRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  subRowUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#000",
    marginRight: 11,
  },
  // Keeps role text aligned whether or not the unread dot is present.
  subRowDotSpacer: { width: 7, marginRight: 11 },
  subRowMain: { flex: 1 },
  subRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  subRowRole: { fontSize: 14, fontWeight: "700", color: "#000" },
  subRowRoleHidden: { color: "#999" },
  subRowTime: { fontSize: 10, fontWeight: "800", color: "#BBB" },
  subRowMsg: { fontSize: 13, color: "#999" },
  // Tag rendered in the timestamp slot of a Past Connections row so the
  // user knows why the conversation is muted (vs the "30+ days inactive"
  // hidden state).
  unmatchedTag: {
    fontSize: 9,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 0.8,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  // In-thread banner shown in place of the message input when the
  // conversation has been unmatched/closed.
  closedNotice: {
    backgroundColor: "#F8F9FB",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: "center",
  },
  closedNoticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textAlign: "center",
    lineHeight: 19,
  },
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
  headerReferBtnDone: {},
  headerReferText: { fontSize: 13, fontWeight: "700" },
  headerReferTextDone: { color: "#000" },
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
    backgroundColor: "#F4F4F5",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sponsorOpenBadgeText: {
    fontSize: 12,
    color: "#000",
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
  summaryScroll: { maxHeight: SCREEN_HEIGHT * 0.6, marginBottom: 10 },
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
  // ── Referral Step 2 — modern detail-sheet aesthetic ─────────────────

  // ATS hint banner — monochrome, modern
  atsBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F4F4F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  atsBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    lineHeight: 17,
  },

  // Hero — centered avatar + name + role + quick-stats chips
  candidateHero: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  candidateHeroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 14,
    backgroundColor: "#EEE",
  },
  candidateHeroAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
  },
  candidateHeroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  candidateHeroRole: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  candidateChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  candidateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  candidateChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },

  // APPLYING FOR — role-context card (mirrors ProfileDetailSheet roleContext)
  refContext: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  refContextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refContextLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#999",
    marginBottom: 6,
  },
  refContextTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  refContextCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },

  // Detail sections — mirror the MatchesView detailSection aesthetic
  refSection: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  refSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  refSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  refSectionBody: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  refSectionMeta: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginBottom: 8,
  },

  // Experience / Education entry rows (stack with subtle dividers)
  refEntryRow: {
    paddingVertical: 8,
  },
  refEntryRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "#F4F4F5",
  },
  refEntryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  refEntryMeta: {
    fontSize: 13,
    color: "#666",
  },

  // Portfolio link tile
  refPortfolio: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  refPortfolioText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },

  // Skills badges (shared within refSection)
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },

  // Final Confirmation rows
  refFinalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 5,
  },
  refFinalBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
    marginTop: 8,
  },
  refFinalText: {
    flex: 1,
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
    lineHeight: 19,
  },
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
    backgroundColor: "#F4F4F5",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
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
  // Unmatch CTA — solid black to match the rest of the app's primary
  // action pattern (Match button, Send button, etc.). The destructive
  // context is communicated by the modal subtitle ("This cannot be
  // undone."), not by the button color — keeps the brand palette
  // consistent across surfaces.
  unmatchActionBtn: {
    paddingVertical: 17,
    borderRadius: 18,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  unmatchActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
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
