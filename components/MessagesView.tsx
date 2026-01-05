import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle,
  FileText,
  Lightbulb,
  MapPin,
  Paperclip,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  Info,
  UserCheck,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  ChevronRight,
  ClipboardCheck
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - (MODAL_PADDING * 2);

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
    linkedin: "linkedin.com/in/sarahchen",
    education: "MBA, Stanford GSB",
    previousCompanies: ["Amazon", "Salesforce"],
    isHidden: false
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
    linkedin: "linkedin.com/in/mrodriguez",
    education: "B.S. Computer Science, UT Austin",
    previousCompanies: ["Uber", "Twitter"],
    isHidden: false
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
    linkedin: "linkedin.com/in/emilywatson",
    education: "MFA Design, Parsons",
    previousCompanies: ["Apple", "IDEO"],
    isHidden: false
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
    linkedin: "linkedin.com/in/davidpark",
    education: "PhD Computer Science, MIT",
    previousCompanies: ["Google Brain", "DeepMind"],
    isHidden: false
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
    linkedin: "linkedin.com/in/jessicavelez",
    education: "B.A. Business, UC Berkeley",
    previousCompanies: ["Dropbox", "Zoom"],
    isHidden: false
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
    linkedin: "linkedin.com/in/marcusthorne",
    education: "M.S. Computer Science, Stanford",
    previousCompanies: ["AWS", "Docker"],
    isHidden: true
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
    linkedin: "linkedin.com/in/soniagupta",
    education: "B.Des Industrial Design, NID",
    previousCompanies: ["Spotify", "Airbnb"],
    isHidden: true
  }
];

const mockMessages = [
  { id: 1, text: "Hi! I saw you're looking for referrals at Google. I'd love to help!", sender: "them", time: "10:30 AM" },
  { id: 2, text: "That would be amazing! Thank you so much.", sender: "me", time: "10:32 AM" },
  { id: 3, text: "No problem! Can you send me your resume?", sender: "them", time: "10:33 AM" },
  { id: 4, text: "Of course! Just sent it over.", sender: "me", time: "10:35 AM" },
  { id: 5, text: "I'd be happy to refer you! Let me know when you apply.", sender: "them", time: "10:36 AM" },
];

interface MessagesViewProps {
  onThreadActiveChange?: (isThreadActive: boolean) => void;
  userType?: "applicant" | "sponsor";
}

export function MessagesView({ onThreadActiveChange, userType = "sponsor" }: MessagesViewProps) {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
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
    const showSub = Keyboard.addListener("keyboardDidShow", () => scrollToBottom(true));
    return () => showSub.remove();
  }, []);

  const resetReferralFlow = () => {
    setReferralStep(1);
    setHasMessaged(false);
    setFeelsConfident(false);
    setKnowsBackground(false);
    setComfortableAttaching(false);
  };

  const canProceedFromStep1 = hasMessaged && feelsConfident && knowsBackground && comfortableAttaching;

  const openReferral = () => {
    setShowProfileModal(false);
    setReferralStep(1);
    setShowReferralFlow(true);
  };

  if (selectedConversation) {
    const conversation = mockConversations.find((c) => c.id === selectedConversation);
    if (!conversation) return null;

    return (
      <View style={{ flex: 1 }}>
        <Animated.View style={[styles.chatContainer, keyboardSpacerStyle]}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelectedConversation(null)} style={styles.backButton}>
              <ArrowLeft color="#000" size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIdentity} onPress={() => setShowProfileModal(true)} activeOpacity={0.7}>
              <Image source={{ uri: conversation.image }} style={styles.headerImage} />
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>{conversation.name}</Text>
                <Text style={styles.headerRole}>{conversation.role} @ {conversation.company}</Text>
              </View>
            </TouchableOpacity>
            {userType === "sponsor" && (
              <TouchableOpacity style={styles.headerReferBtn} onPress={openReferral} activeOpacity={0.7}>
                <UserCheck color="#000" size={20} />
                <Text style={styles.headerReferText}>Refer</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView ref={scrollViewRef} style={styles.messagesScroll} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollToBottom(false)}>
            {mockMessages.map((message, index) => (
              <Animated.View key={message.id} entering={FadeInUp.delay(index * 50)} style={[styles.messageWrapper, message.sender === "me" ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.bubble, message.sender === "me" ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={message.sender === "me" ? styles.txtMe : styles.txtThem}>{message.text}</Text>
                </View>
                <Text style={styles.msgTime}>{message.time}</Text>
              </Animated.View>
            ))}
          </ScrollView>
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.iconBtn}><Paperclip color="#000" size={20} /></TouchableOpacity>
            <TextInput value={messageText} onChangeText={setMessageText} placeholder="Write a message..." placeholderTextColor="#BBB" style={styles.textInput} multiline onFocus={() => setTimeout(() => scrollToBottom(true), 150)} />
            <TouchableOpacity style={styles.sendBtn} onPress={() => { setMessageText(""); Keyboard.dismiss(); }}>
              <Send color="#FFF" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* PROFILE MODAL */}
        <Modal visible={showProfileModal} transparent animationType="none">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
              <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
            </TouchableOpacity>
            <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>{conversation.appliedRole}</Text>
                  </View>
                </View>
                <View style={styles.swipableContainer}>
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image source={{ uri: conversation.image }} style={styles.modalAvatar} />
                        <View>
                          <Text style={styles.modalName}>{conversation.name}</Text>
                          <View style={styles.locationRow}><MapPin size={12} color="#AAA" /><Text style={styles.locationText}>New York, NY</Text></View>
                        </View>
                      </View>
                      <Text style={styles.bioText} numberOfLines={3}>Senior {conversation.role} with a focus on scaling user-centric products at {conversation.company}.</Text>
                      <View style={styles.skillsContainer}>
                        {conversation.skills.map((s, i) => (
                          <View key={i} style={styles.skillChip}><Text style={styles.skillText}>{s}</Text></View>
                        ))}
                      </View>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}><Award size={14} color="#000" /><Text style={styles.statLabel}>{conversation.experience}</Text></View>
                        <TouchableOpacity style={styles.resumeBtn} activeOpacity={0.7}>
                          <FileText size={14} color="#FFF" />
                          <Text style={styles.resumeBtnText}>View Resume</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.infoCard, { width: CARD_WIDTH, backgroundColor: '#000' }]}>
                      <View style={styles.insightsHeader}>
                        <Lightbulb size={20} color="#FFD700" />
                        <Text style={styles.insightsTitle}>Key Insights</Text>
                      </View>
                      <View style={styles.insightRow}><Target size={16} color="#FFF" /><Text style={styles.insightText}>Matches 94% of your requirements.</Text></View>
                      <View style={styles.insightRow}><TrendingUp size={16} color="#FFF" /><Text style={styles.insightText}>Recent growth at {conversation.company}.</Text></View>
                      <View style={styles.insightRow}><ShieldCheck size={16} color="#FFF" /><Text style={styles.insightText}>Verified professional background.</Text></View>
                      <View style={[styles.statItem, { backgroundColor: '#222', borderColor: '#333', marginTop: 'auto', alignSelf: 'flex-start' }]}>
                        <CheckCircle size={14} color="#00CB54" /><Text style={[styles.statLabel, { color: '#FFF' }]}>Fully Verified</Text>
                      </View>
                    </View>
                  </ScrollView>
                  <View style={styles.pagination}>
                    <View style={[styles.dot, activeSlide === 0 ? styles.dotActive : styles.dotInactive]} />
                    <View style={[styles.dot, activeSlide === 1 ? styles.dotActive : styles.dotInactive]} />
                  </View>
                </View>
                <TouchableOpacity style={styles.fullProfileBtn} onPress={() => setShowProfileModal(false)}>
                  <User color="#FFF" size={18} />
                  <Text style={styles.fullProfileBtnText}>View Full Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.referFromModalBtn} onPress={openReferral}>
                  <UserCheck color="#000" size={18} />
                  <Text style={styles.referFromModalBtnText}>Provide Referral</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        {/* REFERRAL FLOW MODAL */}
        <Modal visible={showReferralFlow} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setShowReferralFlow(false); resetReferralFlow(); }}>
              <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
            </TouchableOpacity>
            <Animated.View entering={SlideInDown} style={styles.referralFlowContainer}>
              <View style={styles.flowHeader}>
                <Text style={styles.flowTitle}>Referral Vetting</Text>
                <TouchableOpacity onPress={() => { setShowReferralFlow(false); resetReferralFlow(); }}>
                  <X color="#000" size={24} />
                </TouchableOpacity>
              </View>
              {referralStep === 1 && (
                <Animated.View entering={FadeInUp} style={styles.stepContent}>
                  <Text style={styles.stepSubtitle}>Confidence Check</Text>
                  <Text style={styles.stepDesc}>Before referring {conversation.name}, please confirm your due diligence:</Text>
                  <View style={styles.vettingList}>
                    <TouchableOpacity style={styles.vettingItem} onPress={() => setHasMessaged(!hasMessaged)} activeOpacity={0.7}>
                      <View style={styles.vettingCheck}>
                        {hasMessaged ? <CheckCircle size={18} color="#00CB54" /> : <CheckCircle size={18} color="#E5E5E5" />}
                      </View>
                      <Text style={styles.vettingText}>I have messaged and spoken to the applicant directly.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.vettingItem} onPress={() => setFeelsConfident(!feelsConfident)} activeOpacity={0.7}>
                      <View style={styles.vettingCheck}>
                        {feelsConfident ? <CheckCircle size={18} color="#00CB54" /> : <CheckCircle size={18} color="#E5E5E5" />}
                      </View>
                      <Text style={styles.vettingText}>I feel confident they would be successful in this role.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.vettingItem} onPress={() => setKnowsBackground(!knowsBackground)} activeOpacity={0.7}>
                      <View style={styles.vettingCheck}>
                        {knowsBackground ? <CheckCircle size={18} color="#00CB54" /> : <CheckCircle size={18} color="#E5E5E5" />}
                      </View>
                      <Text style={styles.vettingText}>I am aware of their background and experience level.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.vettingItem} onPress={() => setComfortableAttaching(!comfortableAttaching)} activeOpacity={0.7}>
                      <View style={styles.vettingCheck}>
                        {comfortableAttaching ? <CheckCircle size={18} color="#00CB54" /> : <CheckCircle size={18} color="#E5E5E5" />}
                      </View>
                      <Text style={styles.vettingText}>I feel comfortable attaching my name to this referral.</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={[styles.primaryBtn, !canProceedFromStep1 && styles.primaryBtnDisabled]} onPress={() => canProceedFromStep1 && setReferralStep(2)} disabled={!canProceedFromStep1} activeOpacity={0.7}>
                    <Text style={styles.primaryBtnText}>Review Applicant Details</Text>
                    <ChevronRight color="#FFF" size={18} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              {referralStep === 2 && (
                <Animated.View entering={FadeInUp} style={styles.stepContent}>
                  <Text style={styles.stepSubtitle}>Review & Confirm</Text>
                  <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.candidateInfoCard}>
                      <View style={styles.candidateHeader}>
                        <Image source={{ uri: conversation.image }} style={styles.candidateAvatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.candidateName}>{conversation.name}</Text>
                          <Text style={styles.candidateRole}>{conversation.role} @ {conversation.company}</Text>
                        </View>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>APPLYING FOR</Text>
                        <Text style={styles.infoSectionValue}>{conversation.appliedRole}</Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>CONTACT INFORMATION</Text>
                        <Text style={styles.infoSectionValue}>{conversation.email}</Text>
                        <Text style={styles.infoSectionValue}>{conversation.phone}</Text>
                        <Text style={styles.infoSectionValue}>{conversation.linkedin}</Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>LOCATION</Text>
                        <Text style={styles.infoSectionValue}>{conversation.location}</Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>EXPERIENCE</Text>
                        <Text style={styles.infoSectionValue}>{conversation.experience} in industry</Text>
                        <Text style={styles.infoSectionValue}>Previous: {conversation.previousCompanies.join(', ')}</Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>EDUCATION</Text>
                        <Text style={styles.infoSectionValue}>{conversation.education}</Text>
                      </View>
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>KEY SKILLS</Text>
                        <View style={styles.skillsRow}>
                          {conversation.skills.map((skill, idx) => (
                            <View key={idx} style={styles.skillBadge}>
                              <Text style={styles.skillBadgeText}>{skill}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={styles.finalChecklist}>
                      <Text style={styles.checklistTitle}>Final Confirmation</Text>
                      <View style={styles.checkRow}><ShieldCheck size={16} color="#000" /><Text style={styles.checkText}>This referral is binding within our system.</Text></View>
                      <View style={styles.checkRow}><ShieldCheck size={16} color="#000" /><Text style={styles.checkText}>Your reputation score may be affected by the outcome.</Text></View>
                    </View>
                  </ScrollView>
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => setReferralStep(3)} activeOpacity={0.7}>
                    <ClipboardCheck color="#FFF" size={20} />
                    <Text style={styles.primaryBtnText}>Submit Formal Referral</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              {referralStep === 3 && (
                <Animated.View entering={FadeInDown} style={styles.successStep}>
                  <View style={styles.successIcon}><CheckCircle size={60} color="#00CB54" /></View>
                  <Text style={styles.successTitle}>Referral Submitted!</Text>
                  <Text style={styles.successDesc}>You have successfully referred {conversation.name} for the {conversation.appliedRole} position.</Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => { setShowReferralFlow(false); resetReferralFlow(); }} activeOpacity={0.7}>
                    <Text style={styles.primaryBtnText}>Back to Messages</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </Modal>
      </View>
    );
  }

  const activeConversations = mockConversations.filter(conv => !conv.isHidden);
  const hiddenConversations = mockConversations.filter(conv => conv.isHidden);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>Direct lines to your connections</Text>
      </View>
      
      {/* Active Messages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE MESSAGES</Text>
        <View style={styles.list}>
          {activeConversations.map((conv, index) => (
            <Animated.View key={conv.id} entering={FadeInDown.delay(index * 50)}>
              <TouchableOpacity onPress={() => setSelectedConversation(conv.id)} style={styles.convItem}>
                <View style={styles.imgWrapper}>
                  <Image source={{ uri: conv.image }} style={styles.convImg} />
                  {conv.unread > 0 && <View style={styles.dotIndicator} />}
                </View>
                <View style={styles.convMain}>
                  <View style={styles.convHeader}>
                    <Text style={styles.convName}>{conv.name}</Text>
                    <Text style={styles.convTime}>{conv.time.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.convMsg} numberOfLines={1}>{conv.lastMessage}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Hidden Messages */}
      {hiddenConversations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HIDDEN (30+ DAYS INACTIVE)</Text>
          <View style={styles.list}>
            {hiddenConversations.map((conv, index) => (
              <Animated.View key={conv.id} entering={FadeInDown.delay(index * 50)}>
                <TouchableOpacity onPress={() => setSelectedConversation(conv.id)} style={[styles.convItem, styles.convItemHidden]}>
                  <View style={styles.imgWrapper}>
                    <Image source={{ uri: conv.image }} style={[styles.convImg, styles.convImgHidden]} />
                  </View>
                  <View style={styles.convMain}>
                    <View style={styles.convHeader}>
                      <Text style={[styles.convName, styles.convNameHidden]}>{conv.name}</Text>
                      <Text style={styles.convTime}>{conv.time.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.convMsg, styles.convMsgHidden]} numberOfLines={1}>{conv.lastMessage}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
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
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#BBB", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16 },
  list: { gap: 4 },
  convItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  convItemHidden: { opacity: 0.6 },
  imgWrapper: { position: "relative" },
  convImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F9F9F9" },
  convImgHidden: { opacity: 0.5 },
  dotIndicator: { position: "absolute", top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "#000", borderWidth: 2, borderColor: "#FFF" },
  convMain: { flex: 1, marginLeft: 16 },
  convHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  convName: { fontSize: 17, fontWeight: "700" },
  convNameHidden: { color: "#999" },
  convTime: { fontSize: 10, fontWeight: "800", color: "#BBB" },
  convMsg: { fontSize: 14, color: "#666" },
  convMsgHidden: { color: "#AAA" },
  chatContainer: { flex: 1, backgroundColor: "#FFF" },
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  backButton: { padding: 8, marginLeft: -8 },
  headerIdentity: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 8 },
  headerImage: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: "700" },
  headerRole: { fontSize: 12, color: "#666" },
  headerReferBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  headerReferText: { fontSize: 13, fontWeight: '700' },
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
  msgTime: { fontSize: 10, color: "#BBB", marginTop: 6, fontWeight: "600", alignSelf: "flex-end" },
  inputArea: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 12 : 12, borderTopWidth: 1, borderTopColor: "#F5F5F5", backgroundColor: "#FFF" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F9F9F9", alignItems: "center", justifyContent: "center", marginRight: 10, marginBottom: 2 },
  textInput: { flex: 1, fontSize: 16, backgroundColor: "#F5F5F5", borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, minHeight: 44, maxHeight: 110, marginRight: 10, color: '#000' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#000", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  jobRefTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 15, marginBottom: 20 },
  jobRefLabel: { fontSize: 10, fontWeight: '900', color: '#999' },
  jobRefBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  jobRefText: { fontSize: 12, fontWeight: '700' },
  swipableContainer: { width: CARD_WIDTH, alignSelf: 'center' },
  infoCard: { height: 280, borderRadius: 24, padding: 20, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#EEE' },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 15 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: '#000' },
  dotInactive: { width: 6, backgroundColor: '#DDD' },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  modalAvatar: { width: 55, height: 55, borderRadius: 27 },
  modalName: { fontSize: 20, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 12, color: '#AAA', fontWeight: '600' },
  bioText: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 15 },
  skillsContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  skillChip: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  skillText: { fontSize: 11, fontWeight: '700', color: '#666' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  statLabel: { fontSize: 11, fontWeight: '800' },
  resumeBtn: { flex: 1, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
  resumeBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  insightsTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  insightRow: { flexDirection: 'row', gap: 12, marginBottom: 15, alignItems: 'center' },
  insightText: { color: '#AAA', fontSize: 14, flex: 1 },
  fullProfileBtn: { backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 18, marginTop: 24 },
  fullProfileBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  referFromModalBtn: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 18, marginTop: 12 },
  referFromModalBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  referralFlowContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 50, width: '100%', minHeight: 400 },
  flowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  flowTitle: { fontSize: 24, fontWeight: '800' },
  stepContent: { gap: 12 },
  stepSubtitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  stepDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 10 },
  vettingList: { gap: 16, marginBottom: 20 },
  vettingItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  vettingCheck: { marginTop: 2 },
  vettingText: { fontSize: 15, fontWeight: '600', color: '#444', flex: 1 },
  primaryBtn: { backgroundColor: '#000', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, width: '100%' },
  primaryBtnDisabled: { backgroundColor: '#E5E5E5' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  summaryScroll: { maxHeight: 450, marginBottom: 10 },
  summaryCard: { backgroundColor: '#F8F9FB', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#EEE' },
  summaryLabel: { fontSize: 10, fontWeight: '900', color: '#AAA', letterSpacing: 1, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 16 },
  summarySkills: { flexDirection: 'row', flexWrap: 'wrap' },
  summarySkillText: { fontSize: 13, color: '#666', fontWeight: '600' },
  candidateInfoCard: { backgroundColor: '#F9F9F9', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  candidateAvatar: { width: 60, height: 60, borderRadius: 30 },
  candidateName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  candidateRole: { fontSize: 14, color: '#666' },
  infoSection: { marginBottom: 20 },
  infoSectionTitle: { fontSize: 11, fontWeight: '900', color: '#999', marginBottom: 8, letterSpacing: 0.5 },
  infoSectionValue: { fontSize: 15, color: '#000', marginBottom: 4 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  skillBadge: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#E5E5E5' },
  skillBadgeText: { fontSize: 12, fontWeight: '700', color: '#000' },
  finalChecklist: { marginTop: 20, gap: 10 },
  checklistTitle: { fontSize: 14, fontWeight: '800', marginBottom: 5 },
  checkRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  checkText: { fontSize: 12, color: '#666', fontWeight: '500' },
  confirmBtn: { backgroundColor: '#000', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  successStep: { alignItems: 'center', paddingVertical: 20, width: '100%' },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  successDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 20 }
});