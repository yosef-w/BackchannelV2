import {
    trackConversationOpened,
    trackMessageSent,
    trackPublicProfileOpenedFromMessage,
    trackUnmatchConfirmed,
} from "@/lib/analytics/mixpanel";
import {
    getBasicProfile,
    getConversationMessages,
    getConversations,
    listReferrals,
    reportUser,
    sendMessage,
    unmatchConversation,
    WS_BASE_URL,
    type ConversationRow,
    type ReportReason,
} from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
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
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    Keyboard,
    Modal,
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
    FadeInUp,
    useAnimatedKeyboard,
    useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InboxList } from "./messages/InboxList";
import { InboxSection } from "./messages/InboxSection";
import { InboxEmpty, InboxError, InboxLoading } from "./messages/InboxStates";
import { ReferralFlowModal } from "./messages/ReferralFlowModal";
import { ThreadContextStrip } from "./messages/ThreadContextStrip";
import { ThreadMenuSheet } from "./messages/ThreadMenuSheet";
import { CharCounter } from "./ui/CharCounter";
import { ProfileDetailSheet } from "./ui/ProfileDetailSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2;

/**
 * Conversation starters for a brand-new (empty) thread. Most matches die in
 * silence because someone has to write the awkward first message — these
 * give a one-tap way past that, built entirely from data already on the
 * conversation object (job title/company, skills) so they don't need an
 * extra profile fetch just to populate an empty state.
 */
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

/** UI-shaped conversation, as transformConversation() produces from a raw
 * ConversationRow — the type every inbox/thread render site consumes. */
export interface Conversation {
  id: string;
  status: "ACTIVE" | "CLOSED";
  name: string;
  role: string;
  company: string;
  profileImageUrl: string | null;
  skills: string[];
  experience: string;
  otherParticipant: {
    id: string;
    name: string;
    profileImageUrl: string | null;
    role?: string;
    company?: string;
  };
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  };
  unreadCount: number;
  jobContext: {
    jobId: string;
    jobTitle: string;
    company: string;
    logoUrl?: string;
  };
  /** True when ACTIVE but no activity in 30+ days — buckets into the
   * "Hidden (30+ days inactive)" section instead of Active. */
  isHidden: boolean;
}

/**
 * Merge one server message into the current thread state, reconciling any
 * matching optimistic temp message in place — the same dedup logic the live
 * chat socket's `chat.message` handler already used inline. Extracted so the
 * socket-reconnect catch-up fetch (see the chat WebSocket effect) can apply
 * it per-message too, instead of doing a destructive full replace that would
 * drop an optimistic send still in flight when the reconnect fetch runs.
 */
function mergeIncomingMessage(prev: any[], incoming: any): any[] {
  // Already have this message by serverId or id — nothing to do.
  if (prev.some((msg) => msg.serverId === incoming.id || msg.id === incoming.id)) {
    return prev;
  }

  // An optimistic temp message from the same sender/content — replace it
  // in place rather than appending a duplicate.
  const tempIndex = prev.findIndex(
    (msg) =>
      msg.id.startsWith("temp-") &&
      msg.senderId === incoming.senderId &&
      msg.content === incoming.content,
  );
  if (tempIndex >= 0) {
    const updated = [...prev];
    updated[tempIndex] = {
      ...updated[tempIndex],
      serverId: incoming.id,
      createdAt: incoming.createdAt,
      isRead: true,
    };
    return updated;
  }

  return [...prev, incoming];
}

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
  // Deep-link target from a push notification tap — the conversation to open
  // directly (the push carries related_conversation_id). Consumed once opened.
  pendingConversationId?: string | null;
  onPendingConversationConsumed?: () => void;
  /**
   * Fired the first time this session that the user successfully sends a
   * message. Used by MainApp to trigger the push-notification permission
   * prompt at a moment the user has an obvious reason to want it, instead of
   * cold-asking on app open.
   */
  onFirstMessageSent?: () => void;
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
  pendingConversationId,
  onPendingConversationConsumed,
  onFirstMessageSent,
}: MessagesViewProps) {
  // Store current user ID from profile API to determine which participant to show
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(externalSelectedConversationId ?? null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReferralFlow, setShowReferralFlow] = useState(false);
  const [messageText, setMessageText] = useState("");
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
    queryFn: async (): Promise<Conversation[]> => {
      try {
        const response = await getConversations({ limit: 20, offset: 0 });
        setConversationsTotalCount(
          response.total_count ?? response.conversations.length,
        );
        return response.conversations.map(transformConversation);
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
    (next: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
      queryClient.setQueryData<Conversation[]>(
        ["conversations", "list", currentUserId],
        (prev) =>
          typeof next === "function"
            ? (next as (p: Conversation[]) => Conversation[])(prev ?? [])
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

  // Tracks which (applicantUserId:jobId) pairs have already been referred so
  // the header button reflects the referral status without a separate lookup.
  const [referredSet, setReferredSet] = useState<Set<string>>(new Set());

  // Unmatch / Report sheet visibility + in-flight state. The step/reason/
  // detail state now lives inside the extracted ThreadMenuSheet.
  const [showUnmatchMenu, setShowUnmatchMenu] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // Refs mirror state for use inside the long-lived inbox WebSocket handler,
  // which is created once and must read the *current* values without the
  // socket reconnecting every time selection or the list changes.
  const selectedConversationRef = useRef<string | null>(selectedConversation);
  const conversationsRef = useRef<Conversation[]>(conversations);
  const prevSelectedRef = useRef<string | null>(selectedConversation);
  // How many messages were already in the thread the moment it was opened —
  // only messages at or past this index get the entering fade (see the
  // render below). Without this, opening a 100-message history staggered
  // every bubble in at `index * 50`ms, so the user watched ~5 seconds of
  // messages they'd already read fade in one by one.
  const initialMessageCountRef = useRef(0);
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
  const transformConversation = (c: ConversationRow): Conversation => {
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
      // GET /api/messages/conversations/ doesn't return SKILLS or
      // YEARS_EXPERIENCE — this was reading fields that don't exist on the
      // response, always silently falling through to these defaults.
      // getConversationStarters() and the referral flow's Key Skills
      // section both already degrade gracefully to an empty list.
      skills: [],
      experience: "N/A",
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
        logoUrl: (c as any).LOGO_URL || (c as any).logo_url || undefined,
      },
      // "Hidden (30+ days inactive)" — a thread with no activity in 30+
      // days buckets out of Active. Previously this field was declared as
      // a filter target (see activeConversations/hiddenConversations below)
      // but never actually set here, so the Hidden section was permanently
      // empty; typing this transform's output surfaced the gap.
      isHidden: (() => {
        if (!c.LAST_AT) return false;
        const lastActivityMs = new Date(c.LAST_AT).getTime();
        if (Number.isNaN(lastActivityMs)) return false;
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        return Date.now() - lastActivityMs > THIRTY_DAYS_MS;
      })(),
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
  // Per-conversation chat WebSocket, with the same exponential-backoff
  // reconnect the inbox socket below already used — previously a dropped
  // connection mid-thread just went quiet with no retry until the user
  // manually backed out and reopened the conversation. On a successful
  // reconnect (not the first connect), we also pull the latest history and
  // merge it in via mergeIncomingMessage() rather than replacing the whole
  // array — a destructive full-replace here could wipe out an optimistic
  // message still in flight (its REST POST not yet resolved) if the catch-up
  // fetch happens to land in that window.
  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;
    let hasConnectedOnce = false;

    const catchUpHistory = async () => {
      try {
        const response = await getConversationMessages(selectedConversation, {
          limit: 100,
        });
        if (cancelled) return;
        setMessages((prev) =>
          response.messages.reduce(
            (acc, msg) =>
              mergeIncomingMessage(acc, {
                id: msg.MESSAGE_ID,
                senderId: msg.SENDER_USER_ID,
                content: msg.BODY,
                createdAt: msg.CREATED_AT,
              }),
            prev,
          ),
        );
      } catch (err) {
        console.warn("[MessagesView] Reconnect catch-up fetch failed:", err);
      }
    };

    const connect = () => {
      if (cancelled) return;
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return;

      try {
        // Connect to WebSocket for real-time messages. Built from the same
        // env-configured API host as every REST call (see WS_BASE_URL) so
        // switching environments doesn't require a second hardcoded URL.
        const wsUrl = `${WS_BASE_URL}/ws/chat/${selectedConversation}/?token=${accessToken}`;
        // Never log the full URL — it carries the access token in the query
        // string, and this line was previously leaking it into device logs.
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.warn("[MessagesView] Failed to connect to WebSocket:", err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        console.log("[MessagesView] WebSocket connected");
        if (hasConnectedOnce) catchUpHistory();
        hasConnectedOnce = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[MessagesView] WebSocket message received:", data);

          if (data.type === "chat.message") {
            const newMessage = {
              id: data.message_id,
              serverId: data.message_id,
              senderId: data.sender_user_id,
              content: data.body,
              messageType: "text" as const,
              isRead: true,
              createdAt: data.created_at,
            };

            setMessages((prev) => mergeIncomingMessage(prev, newMessage));

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

      ws.onerror = () => {
        // `onclose` fires right after and handles reconnect.
      };

      ws.onclose = (event) => {
        console.log(
          "[MessagesView] WebSocket closed:",
          event.code,
          event.reason,
        );
        if (cancelled) return;
        // 4001 = bad token, 4003 = forbidden — don't hammer reconnect on an
        // auth failure that won't fix itself.
        if (event.code === 4001 || event.code === 4003) {
          console.warn(
            `[MessagesView] WebSocket rejected: ${event.code}`,
          );
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
        // Same env-configured host as the per-conversation socket above —
        // see WS_BASE_URL.
        const wsUrl = `${WS_BASE_URL}/ws/inbox/?token=${accessToken}`;
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
    // Reset immediately on every conversation change (including to null) so
    // a stale count from the previous thread can't briefly apply while the
    // new one's history is still loading.
    initialMessageCountRef.current = 0;

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
        initialMessageCountRef.current = transformedMessages.length;

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

  // Report a user, then close the conversation the same way Unmatch does.
  // The block/close effect always happens via the already-shipped unmatch
  // endpoint, regardless of whether the report itself was recorded — see
  // reportUser()'s doc comment for why that's split this way. Takes
  // reason/detail as arguments (rather than reading them from state) since
  // that state now lives inside the extracted ThreadMenuSheet.
  const handleSubmitReport = async (reason: ReportReason, detail: string) => {
    if (!selectedConversation) return;
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
      console.warn("[MessagesView] Failed to close reported conversation:", err);
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

  // Deep-link from a push-notification tap: open the exact conversation the
  // push named (related_conversation_id) as soon as it's present in the loaded
  // list. The just-messaged conversation sorts to the top, so it's in the
  // first page in practice. Consume-once so returning to Messages later doesn't
  // force this thread back open.
  useEffect(() => {
    if (!pendingConversationId || conversations.length === 0) return;
    const conv = conversations.find((c) => c.id === pendingConversationId);
    if (conv) {
      handleConversationSelect(conv.id);
      onPendingConversationConsumed?.();
    }
  }, [pendingConversationId, conversations]);

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
      onFirstMessageSent?.();

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

  // The referral flow's own step/checkbox/submit/profile-fetch state now
  // lives entirely inside ReferralFlowModal (extracted — see its own
  // reset-on-hide effect for the equivalent of what resetReferralFlow()
  // used to do here).
  const openReferral = () => {
    setShowProfileModal(false);
    setShowReferralFlow(true);
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

  if (selectedConversation) {
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
        <InboxLoading />
      ) : conversationsError ? (
        <InboxError message={conversationsError} />
      ) : conversations.length === 0 ? (
        <InboxEmpty />
      ) : (
        <>
          <InboxSection
            title="Active"
            count={activeConversations.length}
            hidden={activeConversations.length === 0}
          >
            <InboxList
              conversations={activeConversations}
              variant="active"
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onSelect={handleConversationSelect}
            />
          </InboxSection>

          {/* Past Connections — unmatched conversations (status === 'CLOSED').
              Visually muted so they read as "archived". Still tappable so
              users can review the prior thread, but the send-message input
              below is disabled. */}
          <InboxSection
            title="Past Connections"
            count={pastConversations.length}
            hidden={pastConversations.length === 0}
            collapsible
          >
            <InboxList
              conversations={pastConversations}
              variant="past"
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onSelect={handleConversationSelect}
            />
          </InboxSection>

          <InboxSection
            title="Hidden (30+ days inactive)"
            count={hiddenConversations.length}
            hidden={hiddenConversations.length === 0}
            collapsible
          >
            <InboxList
              conversations={hiddenConversations}
              variant="hidden"
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onSelect={handleConversationSelect}
            />
          </InboxSection>

          {/* Load More */}
          {conversations.length < conversationsTotalCount && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMoreConversations}
              disabled={isLoadingMore}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>
                {isLoadingMore
                  ? "Loading..."
                  : `Load more (${conversationsTotalCount - conversations.length})`}
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
  // Conversation-starter chips shown in a brand-new empty thread.
  startersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  startersHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1,
  },
  startersList: {
    width: "100%",
    gap: 8,
  },
  starterChip: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  starterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    textAlign: "left",
  },
  headerTitleContainer: { marginBottom: 32 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -1.2 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 8 },
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
  // ── Grouped inbox rows (same person, multiple role-threads) ──────────
  // Second line of a group header: latest-message preview + a "N roles"
  // pill so the user sees at a glance this person spans several roles.
  // Chevron at the row's trailing edge; rotated 90° when the group is open.
  // Expanded per-role sub-threads, indented under the person row with a
  // hairline rail aligned to the avatar's right edge (avatar 56 + 16 gap).
  // Keeps role text aligned whether or not the unread dot is present.
  // Tag rendered in the timestamp slot of a Past Connections row so the
  // user knows why the conversation is muted (vs the "30+ days inactive"
  // hidden state).
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
  referralNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  referralNudgeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  referralNudgeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  referralNudgeSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 1,
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
  messagesScroll: { flex: 1, paddingHorizontal: 20 },
  // Spacing between messages lives on each messageWrapper (via an inline
  // marginTop) rather than a container gap, so clustered messages from the
  // same sender can sit tight while cluster boundaries keep the full gap.
  messagesContent: { paddingTop: 20, paddingBottom: 28 },
  messageWrapper: { maxWidth: "85%" },
  msgLeft: { alignSelf: "flex-start" },
  msgRight: { alignSelf: "flex-end" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: "#000" },
  bubbleThem: { backgroundColor: "#F2F2F2" },
  // Within a cluster, the corners facing the adjacent bubble tighten so the
  // run reads as one grouped exchange.
  bubbleClusterTopMe: { borderTopRightRadius: 6 },
  bubbleClusterTopThem: { borderTopLeftRadius: 6 },
  bubbleClusterBottomMe: { borderBottomRightRadius: 6 },
  bubbleClusterBottomThem: { borderBottomLeftRadius: 6 },
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
});
