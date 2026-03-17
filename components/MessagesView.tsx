import {
    getBasicProfile,
    getConversationMessages,
    getConversations,
    sendMessage,
} from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
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
    Paperclip,
    Send,
    ShieldCheck,
    User,
    UserCheck,
    X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    Keyboard,
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

// --- MOCK DATA ---
const mockConversations = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior PM",
    company: "Google",
    image: "https://images.unsplash.com/photo-1563132337-f159f484226c?w=200",
    lastMessage: "I'd be happy to refer you! Let me know when you apply.",
    time: "2m ago",
    unread: 2,
    appliedRole: "Lead Product Strategist",
    experience: "8+ Years",
    skills: ["Product Vision", "Agile", "SQL"],
    location: "San Francisco, CA",
    email: "sarah.chen@gmail.com",
    phone: "+1 (415) 555-0123",
    education: "MBA, Stanford GSB",
    previousCompanies: ["Amazon", "Salesforce"],
    bio: "Product leader passionate about building products that scale. Focused on fintech and enterprise SaaS. Love mentoring emerging PMs and helping teams ship with confidence.",
    workPreferences: ["Remote Flexible", "Startup", "High Growth"],
    desiredRoles: ["VP Product", "Chief Product Officer", "Head of Product"],
    companiesCanReferTo: ["Google", "Amazon", "Salesforce"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Being the 'No' person in product meetings—keeping us focused on what matters.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A micro-loan app that helped 50k+ small businesses in SE Asia.",
      },
    ],
    isHidden: false,
    applicationStatus: "interview_scheduled" as const,
    appliedDate: "Jan 2, 2026",
    nextAction: "Interview on Jan 8 at 2pm PT",
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    role: "SWE",
    company: "Meta",
    image: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?w=200",
    lastMessage: "Thanks for connecting! Looking forward to chatting.",
    time: "1h ago",
    unread: 0,
    appliedRole: "Full Stack Lead",
    experience: "5 Years",
    skills: ["React", "Node.js", "System Design"],
    location: "Austin, TX",
    email: "m.rodriguez@email.com",
    phone: "+1 (512) 555-0198",
    education: "B.S. Computer Science, UT Austin",
    previousCompanies: ["Uber", "Twitter"],
    bio: "Full-stack engineer who loves building scalable systems. Passionate about developer tools and platform engineering. Always learning, always shipping.",
    workPreferences: ["Hybrid", "Tech Company", "Innovation"],
    desiredRoles: [
      "Staff Engineer",
      "Principal Engineer",
      "Engineering Manager",
    ],
    companiesCanReferTo: ["Meta", "Uber", "Twitter"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Optimizing systems—I once reduced API latency by 80% with a single refactor.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "Building a real-time streaming platform that now handles 50M+ events/day.",
      },
    ],
    isHidden: false,
    applicationStatus: "reviewing" as const,
    appliedDate: "Jan 3, 2026",
    nextAction: "Under review by hiring team",
  },
  {
    id: 3,
    name: "Emily Watson",
    role: "UX Lead",
    company: "Airbnb",
    image: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=200",
    lastMessage: "Here's the link to the application portal...",
    time: "3h ago",
    unread: 0,
    appliedRole: "Principal Designer",
    experience: "10+ Years",
    skills: ["Figma", "Design Systems", "User Research"],
    location: "Brooklyn, NY",
    email: "emily.w@design.co",
    phone: "+1 (718) 555-0142",
    education: "MFA Design, Parsons",
    previousCompanies: ["Apple", "IDEO"],
    companiesCanReferTo: ["Airbnb", "Apple", "IDEO"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Creating design systems that actually get used—not just admired in Figma.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A redesign that increased user satisfaction by 40% while reducing support tickets.",
      },
    ],
    isHidden: false,
    applicationStatus: "applied" as const,
    appliedDate: "Jan 4, 2026",
    nextAction: "Waiting for response",
  },
  {
    id: 4,
    name: "David Park",
    role: "Data Scientist",
    company: "Netflix",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    lastMessage: "Your background in ML is exactly what our team needs.",
    time: "5h ago",
    unread: 1,
    appliedRole: "Senior AI Engineer",
    experience: "6 Years",
    skills: ["Python", "PyTorch", "BigQuery"],
    location: "Los Gatos, CA",
    email: "dpark@ml.ai",
    phone: "+1 (408) 555-0176",
    education: "PhD Computer Science, MIT",
    previousCompanies: ["Google Brain", "DeepMind"],
    companiesCanReferTo: ["Netflix", "Google", "DeepMind"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Translating complex ML models into production systems that actually ship.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A recommendation algorithm that increased engagement by 25% across 100M+ users.",
      },
    ],
    isHidden: false,
    applicationStatus: "offer" as const,
    appliedDate: "Dec 28, 2025",
    nextAction: "Offer received - respond by Jan 10",
  },
  {
    id: 5,
    name: "Jessica Velez",
    role: "Recruiter",
    company: "Stripe",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    lastMessage: "Are you free for a quick sync tomorrow morning?",
    time: "Yesterday",
    unread: 0,
    appliedRole: "Technical Program Manager",
    experience: "4 Years",
    skills: ["Operations", "Strategy", "Public Speaking"],
    location: "Remote",
    email: "jvelez@stripe.com",
    phone: "+1 (555) 123-4567",
    education: "B.A. Business, UC Berkeley",
    previousCompanies: ["Dropbox", "Zoom"],
    companiesCanReferTo: ["Stripe", "Dropbox", "Zoom"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Unblocking teams—I'm the person who makes impossible timelines possible.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "Leading a cross-functional launch that shipped 3 weeks early with zero bugs.",
      },
    ],
    isHidden: false,
  },
  {
    id: 6,
    name: "Marcus Thorne",
    role: "Head of Engineering",
    company: "Scale AI",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
    lastMessage: "Let's skip the screening and go straight to tech.",
    time: "2d ago",
    unread: 0,
    appliedRole: "Staff Engineer",
    experience: "12+ Years",
    skills: ["Infrastructure", "Go", "Kubernetes"],
    location: "Seattle, WA",
    email: "marcus.t@scaleai.com",
    phone: "+1 (206) 555-0199",
    education: "M.S. Computer Science, Stanford",
    previousCompanies: ["AWS", "Docker"],
    companiesCanReferTo: ["Scale AI", "AWS", "Docker"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Building engineering cultures where people actually want to work late.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "Scaling infrastructure from 1M to 100M users without a single outage.",
      },
    ],
    isHidden: true,
  },
  {
    id: 7,
    name: "Sonia Gupta",
    role: "Product Designer",
    company: "Uber",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    lastMessage: "I loved your portfolio piece on the fintech app!",
    time: "3d ago",
    unread: 0,
    appliedRole: "Senior UX Designer",
    experience: "7 Years",
    skills: ["Prototyping", "A/B Testing", "Mobile Design"],
    location: "London, UK",
    email: "sonia.g@uber.com",
    phone: "+44 20 7123 4567",
    education: "B.Des Industrial Design, NID",
    previousCompanies: ["Spotify", "Airbnb"],
    companiesCanReferTo: ["Uber", "Spotify", "Airbnb"],
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Making complex features feel simple—like they were always meant to be that way.",
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A mobile redesign that won a Webby and became a case study at design schools.",
      },
    ],
    isHidden: true,
  },
];

const mockMessages = [
  {
    id: 1,
    text: "Hi! I saw you're looking for referrals at Google. I'd love to help!",
    sender: "them",
    time: "10:30 AM",
  },
  {
    id: 2,
    text: "That would be amazing! Thank you so much.",
    sender: "me",
    time: "10:32 AM",
  },
  {
    id: 3,
    text: "No problem! Can you send me your resume?",
    sender: "them",
    time: "10:33 AM",
  },
  {
    id: 4,
    text: "Of course! Just sent it over.",
    sender: "me",
    time: "10:35 AM",
  },
  {
    id: 5,
    text: "I'd be happy to refer you! Let me know when you apply.",
    sender: "them",
    time: "10:36 AM",
  },
];

interface MessagesViewProps {
  onThreadActiveChange?: (isThreadActive: boolean) => void;
  userType?: "applicant" | "sponsor";
  onShowPublicProfile?: (userData: any) => void;
  selectedConversationId?: number | null;
  onConversationChange?: (conversationId: number | null) => void;
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

  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(externalSelectedConversationId?.toString() ?? null);
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
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  // Real data state
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );

  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sendingMessage, setSendingMessage] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);

  // Fetch current user profile to get USER_ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const profile = await getBasicProfile();
        console.log("[MessagesView] Current user profile:", profile);
        setCurrentUserId(profile.USER_ID);
      } catch (err) {
        console.error("[MessagesView] Failed to fetch current user:", err);
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

        const response = await getConversations();
        console.log("[MessagesView] Conversations response:", response);

        // Transform UPPERCASE Snowflake fields to our UI format
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
        console.error("[MessagesView] Failed to fetch conversations:", err);
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
          // Fall back to mock data on other errors
          setConversations(
            mockConversations.map((conv) => ({
              id: String(conv.id),
              otherParticipant: {
                id: String(conv.id),
                name: conv.name,
                role: conv.role,
                company: conv.company,
                profileImageUrl: conv.image,
              },
              lastMessage: {
                content: conv.lastMessage,
                senderId: String(conv.id),
                createdAt: new Date().toISOString(),
                isRead: conv.unread === 0,
              },
              unreadCount: conv.unread,
              jobContext: conv.appliedRole
                ? {
                    jobId: String(conv.id),
                    jobTitle: conv.appliedRole,
                    company: conv.company,
                  }
                : undefined,
              applicationStatus: conv.applicationStatus,
              createdAt: new Date().toISOString(),
            })),
          );
        }
      } finally {
        setConversationsLoading(false);
      }
    };

    fetchConversations();
  }, [currentUserId]);

  // WebSocket connection for real-time messaging
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
              console.error("[MessagesView] WebSocket error:", data.message);
            }
          } catch (err) {
            console.error(
              "[MessagesView] Failed to parse WebSocket message:",
              err,
            );
          }
        };

        ws.onerror = (error) => {
          console.error("[MessagesView] WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log(
            "[MessagesView] WebSocket closed:",
            event.code,
            event.reason,
          );
          if (event.code === 4001) {
            console.error(
              "[MessagesView] WebSocket auth failed - invalid token",
            );
          } else if (event.code === 4003) {
            console.error(
              "[MessagesView] WebSocket rejected - not a participant",
            );
          }
        };
      } catch (err) {
        console.error("[MessagesView] Failed to connect to WebSocket:", err);
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

        // Transform UPPERCASE Snowflake fields to our UI format
        const transformedMessages = response.messages.map((msg) => ({
          id: msg.MESSAGE_ID,
          serverId: msg.MESSAGE_ID,
          // Backend returns SENDER_USER_ID from Snowflake; SENDER_ID is a fallback for older schema
          senderId:
            (msg as any).SENDER_USER_ID ||
            (msg as any).SENDER_ID ||
            msg.SENDER_ID,
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
            senderCounts[msg.SENDER_ID] =
              (senderCounts[msg.SENDER_ID] || 0) + 1;
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
        console.error("[MessagesView] Failed to fetch messages:", err);
        setMessagesError(
          err instanceof Error ? err.message : "Failed to fetch messages",
        );
        // Fall back to mock messages on error
        setMessages(
          mockMessages.map((msg, idx) => ({
            id: String(idx + 1),
            senderId: msg.sender === "me" ? "current-user" : "other",
            content: msg.text,
            messageType: "text" as const,
            isRead: true,
            createdAt: new Date().toISOString(),
          })),
        );
        if (!currentUserId) {
          setCurrentUserId("current-user");
        }
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
      onConversationChange(conversationId ? Number(conversationId) : null);
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
      console.error("[MessagesView] Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setMessageText(messageToSend); // Restore message text
      alert("Failed to send message. Please try again.");
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
  };

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

  const getApplicationFromConversation = (
    conv: (typeof mockConversations)[0],
  ) => {
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
            <TouchableOpacity style={styles.iconBtn}>
              <Paperclip color="#000" size={20} />
            </TouchableOpacity>
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

        {/* PROFILE MODAL */}
        <Modal visible={showProfileModal} transparent animationType="none">
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
            <Animated.View
              entering={SlideInDown}
              exiting={SlideOutDown}
              style={styles.modalContent}
            >
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>
                      {conversation.appliedRole}
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
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image
                          source={{ uri: conversation.image }}
                          style={styles.modalAvatar}
                        />
                        <View>
                          <Text style={styles.modalName}>
                            {conversation.name}
                          </Text>
                          <View style={styles.locationRow}>
                            <MapPin size={12} color="#AAA" />
                            <Text style={styles.locationText}>
                              New York, NY
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.bioText} numberOfLines={3}>
                        Senior {conversation.role} with a focus on scaling
                        user-centric products at {conversation.company}.
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
                            {conversation.experience}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.resumeBtn}
                          activeOpacity={0.7}
                        >
                          <FileText size={14} color="#FFF" />
                          <Text style={styles.resumeBtnText}>View Resume</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
                            <View key={idx} style={styles.promptCardInModal}>
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
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        {/* REFERRAL FLOW MODAL */}
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
                    Before referring {conversation.name}, please confirm your
                    due diligence:
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
                  <ScrollView
                    style={styles.summaryScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.candidateInfoCard}>
                      <View style={styles.candidateHeader}>
                        <Image
                          source={{ uri: conversation.image }}
                          style={styles.candidateAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.candidateName}>
                            {conversation.name}
                          </Text>
                          <Text style={styles.candidateRole}>
                            {conversation.role} @ {conversation.company}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>
                          APPLYING FOR
                        </Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.appliedRole}
                        </Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>
                          CONTACT INFORMATION
                        </Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.email}
                        </Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.phone}
                        </Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>LOCATION</Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.location}
                        </Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>EXPERIENCE</Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.experience} in industry
                        </Text>
                        <Text style={styles.infoSectionValue}>
                          Previous: {conversation.previousCompanies.join(", ")}
                        </Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>EDUCATION</Text>
                        <Text style={styles.infoSectionValue}>
                          {conversation.education}
                        </Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>KEY SKILLS</Text>
                        <View style={styles.skillsRow}>
                          {(conversation.skills || []).map(
                            (skill: string, idx: number) => (
                              <View key={idx} style={styles.skillBadge}>
                                <Text style={styles.skillBadgeText}>
                                  {skill}
                                </Text>
                              </View>
                            ),
                          )}
                        </View>
                      </View>
                    </View>
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
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => setReferralStep(3)}
                    activeOpacity={0.7}
                  >
                    <ClipboardCheck color="#FFF" size={20} />
                    <Text style={styles.primaryBtnText}>
                      Submit Formal Referral
                    </Text>
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
                    You have successfully referred {conversation.name} for the{" "}
                    {conversation.appliedRole} position.
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
});
