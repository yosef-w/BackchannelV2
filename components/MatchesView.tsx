import { BlurView } from "expo-blur";
import {
  Award,
  Briefcase,
  CheckCircle,
  DollarSign,
  ExternalLink,
  FileText,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Users,
  Zap
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
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
  FadeInRight,
  FadeInUp,
  SlideInDown,
  SlideOutDown
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - (MODAL_PADDING * 2);

interface Match {
  id: number;
  name: string;
  role: string;
  company: string;
  image: string;
  status: string;
  date: string;
  appliedRole: string;
  experience: string;
  skills: string[];
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

const mockMatches: Match[] = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior Product Manager",
    company: "Google",
    image: "https://images.unsplash.com/photo-1563132337-f159f484226c?w=200",
    status: "referred",
    date: "2 days ago",
    appliedRole: "Lead Product Strategist",
    experience: "8+ Years",
    skills: ["Product Vision", "Agile", "SQL"],
    insights: {
      funFact: "Built a side project that reached 100k users in 3 months."
    },
    prompts: [
      { question: "MY SECRET SUPERPOWER", answer: "Turning complex data into simple, actionable stories." }
    ]
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    role: "Software Engineer",
    company: "Meta",
    image: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?w=200",
    status: "pending",
    date: "5 days ago",
    appliedRole: "Full Stack Lead",
    experience: "5 Years",
    skills: ["React", "Node.js", "System Design"],
    insights: {
      funFact: "Contributed to 3 major open-source libraries used by millions."
    },
    prompts: [
      { question: "I'M BEST KNOWN FOR", answer: "Writing code that's so clean it doesn't need comments." }
    ]
  },
  {
    id: 3,
    name: "Emily Watson",
    role: "UX Design Lead",
    company: "Airbnb",
    image: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=200",
    status: "connected",
    date: "1 week ago",
    appliedRole: "Principal Designer",
    experience: "10+ Years",
    skills: ["Figma", "Design Systems", "User Research"],
    insights: {
      funFact: "Has a collection of over 50 rare design books from the 60s."
    },
    prompts: [
      { question: "MY DESIGN PHILOSOPHY", answer: "If it's not intuitive, it's not finished." }
    ]
  },
];

interface JobOpportunity {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  image: string;
  description: string;
  skills: string[];
  benefits: string[];
  sponsorInfo: {
    name: string;
    role: string;
    image: string;
    canRefer: boolean;
  };
}

const mockJobs: JobOpportunity[] = [
  {
    id: 1,
    title: "Senior Software Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    salary: "$180k - $240k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200",
    description: "Join our Payments Platform team to build the financial infrastructure for the internet.",
    skills: ["TypeScript", "React", "Go", "Kubernetes"],
    benefits: ["Unlimited PTO", "401k Match", "Full Health Coverage"],
    sponsorInfo: {
      name: "Sarah Chen",
      role: "Engineering Manager",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
      canRefer: true
    }
  },
  {
    id: 2,
    title: "Product Designer",
    company: "Notion",
    location: "New York, NY",
    salary: "$140k - $190k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200",
    description: "Help us reimagine how teams collaborate with beautiful, intuitive design.",
    skills: ["Figma", "Prototyping", "Design Systems"],
    benefits: ["Equity Package", "Learning Stipend", "Remote Flexible"],
    sponsorInfo: {
      name: "Alex Kim",
      role: "Head of Design",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
      canRefer: true
    }
  },
  {
    id: 3,
    title: "Data Scientist",
    company: "Spotify",
    location: "Remote",
    salary: "$150k - $200k",
    type: "Full-time",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200",
    description: "Use ML to personalize music recommendations for 500M+ users worldwide.",
    skills: ["Python", "SQL", "Machine Learning"],
    benefits: ["Remote First", "Premium Spotify", "Annual Bonus"],
    sponsorInfo: {
      name: "Maria Rodriguez",
      role: "Data Science Lead",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200",
      canRefer: true
    }
  }
];

interface PotentialSponsor {
  id: number;
  name: string;
  role: string;
  company: string;
  image: string;
  matchScore: string;
  bio: string;
  experience: string;
  skills: string[];
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

const mockSponsors: PotentialSponsor[] = [
  {
    id: 1,
    name: "David Park",
    role: "Engineering Manager",
    company: "Amazon",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
    matchScore: "95% Match",
    bio: "Leading a team of 15 engineers building next-gen cloud infrastructure.",
    experience: "12+ Years",
    skills: ["Cloud Architecture", "Team Leadership", "System Design"],
    insights: {
      funFact: "Mentored 20+ engineers who went on to become senior leaders."
    },
    prompts: [
      { question: "WHAT I LOOK FOR", answer: "High agency and a bias toward action over perfection." }
    ]
  },
  {
    id: 2,
    name: "Lisa Nguyen",
    role: "VP of Product",
    company: "Figma",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    matchScore: "88% Match",
    bio: "Building products that empower millions of designers and developers.",
    experience: "10+ Years",
    skills: ["Product Strategy", "Design Thinking", "User Research"],
    insights: {
      funFact: "Started as a designer and taught myself to code to bridge the gap."
    },
    prompts: [
      { question: "MY MENTORSHIP STYLE", answer: "I believe in giving ownership and learning through doing." }
    ]
  },
  {
    id: 3,
    name: "James Wilson",
    role: "Director of Engineering",
    company: "Shopify",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    matchScore: "92% Match",
    bio: "Scaling e-commerce infrastructure to support millions of merchants globally.",
    experience: "15+ Years",
    skills: ["Infrastructure", "Scaling", "Mentorship"],
    insights: {
      funFact: "Built my first company at 19, sold it, and never looked back."
    },
    prompts: [
      { question: "WHY I SPONSOR", answer: "I want to pay forward the breaks I got early in my career." }
    ]
  }
];

const QUICK_REPLIES = ["Nice to meet you!", "Great profile!", "Let's chat!", "Impressive skills!"];

export function MatchesView({ userType = "sponsor" }: { userType?: "applicant" | "sponsor" }) {
  const [selectedProfile, setSelectedProfile] = useState<Match | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobOpportunity | null>(null);
  const [selectedSponsor, setSelectedSponsor] = useState<PotentialSponsor | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "message">("view");
  const [activeSlide, setActiveSlide] = useState(0);
  const [message, setMessage] = useState("");

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveSlide(slide);
  };

  const openProfile = (profile: Match, mode: "view" | "message") => {
    setModalMode(mode);
    setSelectedProfile(profile);
    setActiveSlide(0);
  };

  const openJob = (job: JobOpportunity) => {
    setSelectedJob(job);
    setActiveSlide(0);
  };

  const openSponsor = (sponsor: PotentialSponsor, mode: "view" | "message") => {
    setModalMode(mode);
    setSelectedSponsor(sponsor);
    setActiveSlide(0);
  };

  const closeAllModals = () => {
    setSelectedProfile(null);
    setSelectedJob(null);
    setSelectedSponsor(null);
    setMessage("");
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Opportunities</Text>
          <Text style={styles.subtitle}>
            {userType === "applicant" ? "Your active opportunities & sponsors" : "Talent you are sponsoring"}
          </Text>
        </View>

        {userType === "sponsor" ? (
          /* SPONSOR VIEW */
          <>
            {/* Interested Applicants */}
            <View style={styles.sectionContainer}>
              <Text style={styles.listSectionTitle}>Interested Applicants</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent} style={styles.horizontalScroll}>
                {mockMatches.map((match, index) => (
                  <Animated.View key={match.id} entering={FadeInRight.delay(index * 100)} style={styles.card}>
                    <Image source={{ uri: match.image }} style={styles.profileImage} />
                    <Text style={styles.cardName}>{match.name}</Text>
                    <Text style={styles.cardRole}>{match.role}</Text>
                    <TouchableOpacity style={styles.messageBtn} onPress={() => openProfile(match, "message")}>
                      <MessageCircle color="#FFF" size={16} strokeWidth={2.5} />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </ScrollView>
            </View>

            {/* Activity List */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>All Activity</Text>
              {mockMatches.map((match, index) => (
                <Animated.View key={`list-${index}`} entering={FadeInUp.delay(index * 100)} style={styles.listItem}>
                  <Image source={{ uri: match.image }} style={styles.listImage} />
                  <View style={styles.listInfo}>
                    <Text style={styles.listName}>{match.name}</Text>
                    <Text style={styles.listStatus}>{match.status.toUpperCase()} • {match.date}</Text>
                  </View>
                  <TouchableOpacity style={styles.iconAction} onPress={() => openProfile(match, "view")}>
                    <ExternalLink color="#000" size={20} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </>
        ) : (
          /* APPLICANT VIEW */
          <>
            {/* Potential Jobs */}
            <View style={styles.sectionContainer}>
              <Text style={styles.listSectionTitle}>Potential Jobs</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent} style={styles.horizontalScroll}>
                {mockJobs.map((job, index) => (
                  <Animated.View key={job.id} entering={FadeInRight.delay(index * 100)} style={styles.jobCard}>
                    <Image source={{ uri: job.image }} style={styles.jobImage} />
                    <View style={styles.jobCardInfo}>
                      <Text style={styles.jobCardCompany}>{job.company}</Text>
                      <Text style={styles.jobCardTitle} numberOfLines={2}>{job.title}</Text>
                      <TouchableOpacity style={styles.applyBtn} onPress={() => openJob(job)}>
                        <Heart color="#FFF" size={16} strokeWidth={2.5} />
                        <Text style={styles.applyBtnText}>Show Interest</Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
              </ScrollView>
            </View>

            {/* Potential Sponsors List */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>Potential Sponsors</Text>
              {mockSponsors.map((sponsor, index) => (
                <Animated.View key={`sponsor-${index}`} entering={FadeInUp.delay(index * 100)} style={styles.listItem}>
                  <Image source={{ uri: sponsor.image }} style={styles.listImage} />
                  <View style={styles.listInfo}>
                    <Text style={styles.listName}>{sponsor.name}</Text>
                    <Text style={styles.listStatus}>{sponsor.role} @ {sponsor.company}</Text>
                    <View style={styles.matchBadge}>
                      <Sparkles size={10} color="#00CB54" />
                      <Text style={styles.matchText}>{sponsor.matchScore}</Text>
                    </View>
                  </View>
                  <View style={styles.sponsorActions}>
                    <TouchableOpacity style={styles.iconAction} onPress={() => openSponsor(sponsor, "view")}>
                      <ExternalLink color="#000" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.messageSponsorBtn} onPress={() => openSponsor(sponsor, "message")}>
                      <MessageCircle color="#FFF" size={16} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Applicant Profile Modal (for Sponsors) */}
      <Modal visible={!!selectedProfile} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAllModals}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {selectedProfile && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>{selectedProfile.appliedRole}</Text>
                  </View>
                </View>

                {/* Swipable Card Section */}
                <View style={styles.swipableContainer}>
                  <ScrollView 
                    horizontal 
                    pagingEnabled 
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  >
                    {/* Front: Bio & Resume */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image source={{ uri: selectedProfile.image }} style={styles.modalAvatar} />
                        <View>
                          <Text style={styles.modalName}>{selectedProfile.name}</Text>
                          <View style={styles.locationRow}><MapPin size={12} color="#AAA" /><Text style={styles.locationText}>New York, NY</Text></View>
                        </View>
                      </View>
                      <Text style={styles.bioText} numberOfLines={3}>Senior {selectedProfile.role} with a focus on scaling user-centric products at {selectedProfile.company}.</Text>
                      <View style={styles.skillsContainer}>
                        {selectedProfile.skills.map((s, i) => (
                          <View key={i} style={styles.skillChip}><Text style={styles.skillText}>{s}</Text></View>
                        ))}
                      </View>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}><Award size={14} color="#000" /><Text style={styles.statLabel}>{selectedProfile.experience}</Text></View>
                        <TouchableOpacity style={styles.resumeBtn} activeOpacity={0.7}>
                          <FileText size={14} color="#FFF" />
                          <Text style={styles.resumeBtnText}>View Resume</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Back: Key Insights */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.insightsHeader}>
                        <Sparkles size={20} color="#000" />
                        <Text style={styles.insightsTitle}>Key Insights</Text>
                      </View>
                      
                      {selectedProfile.insights && (
                        <View style={styles.insightSection}>
                          <Text style={styles.insightLabel}>QUICK HIT</Text>
                          <Text style={styles.insightContent}>{selectedProfile.insights.funFact}</Text>
                        </View>
                      )}

                      {selectedProfile.prompts?.map((prompt, idx) => (
                        <View key={idx} style={styles.promptWrapper}>
                          <View style={styles.promptHeaderRow}>
                            <Zap size={14} color="#000" />
                            <Text style={styles.insightLabel}>{prompt.question}</Text>
                          </View>
                          <Text style={styles.promptContent}>{prompt.answer}</Text>
                        </View>
                      ))}

                      <View style={[styles.statItem, { marginTop: 'auto', alignSelf: 'flex-start' }]}>
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.statLabel}>Fully Verified</Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Indicators */}
                  <View style={styles.pagination}>
                    <View style={[styles.dot, activeSlide === 0 ? styles.dotActive : styles.dotInactive]} />
                    <View style={[styles.dot, activeSlide === 1 ? styles.dotActive : styles.dotInactive]} />
                  </View>
                </View>

                {/* Messaging Section */}
                {modalMode === "message" && (
                  <Animated.View entering={FadeInUp} style={{ marginTop: 24 }}>
                    <Text style={styles.inputLabel}>Quick Reply</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.replyScroll} contentContainerStyle={{ gap: 8 }}>
                      {QUICK_REPLIES.map((r, i) => (
                        <TouchableOpacity key={i} style={styles.replyChip} onPress={() => setMessage(r)}>
                          <Text style={styles.replyChipText}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.messageInput} placeholder="Write a message..." value={message} onChangeText={setMessage} multiline />
                      <TouchableOpacity style={styles.sendBtn} onPress={closeAllModals}><Send color="#FFF" size={18} /></TouchableOpacity>
                    </View>
                  </Animated.View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Job Details Modal (for Applicants) */}
      <Modal visible={!!selectedJob} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAllModals}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {selectedJob && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Job Header */}
                <View style={styles.jobModalHeader}>
                  <Image source={{ uri: selectedJob.image }} style={styles.jobModalImage} />
                  <View style={styles.jobModalInfo}>
                    <Text style={styles.jobModalCompany}>{selectedJob.company}</Text>
                    <Text style={styles.jobModalTitle}>{selectedJob.title}</Text>
                    <View style={styles.jobModalMeta}>
                      <View style={styles.jobModalMetaItem}>
                        <MapPin size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>{selectedJob.location}</Text>
                      </View>
                      <View style={styles.jobModalMetaItem}>
                        <DollarSign size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>{selectedJob.salary}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Job Description */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>About the Role</Text>
                  <Text style={styles.jobSectionText}>{selectedJob.description}</Text>
                </View>

                {/* Skills */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Required Skills</Text>
                  <View style={styles.skillsContainer}>
                    {selectedJob.skills.map((skill, i) => (
                      <View key={i} style={styles.skillChip}>
                        <Text style={styles.skillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Benefits */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Benefits</Text>
                  {selectedJob.benefits.map((benefit, i) => (
                    <View key={i} style={styles.benefitRow}>
                      <CheckCircle size={14} color="#00CB54" />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>

                {/* Sponsor Info */}
                <View style={styles.sponsorInfoCard}>
                  <View style={styles.sponsorCardHeader}>
                    <Users size={16} color="#000" />
                    <Text style={styles.sponsorCardTitle}>Job Sponsor</Text>
                  </View>
                  <View style={styles.sponsorCardContent}>
                    <Image source={{ uri: selectedJob.sponsorInfo.image }} style={styles.sponsorCardAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sponsorCardName}>{selectedJob.sponsorInfo.name}</Text>
                      <Text style={styles.sponsorCardRole}>{selectedJob.sponsorInfo.role}</Text>
                    </View>
                    {selectedJob.sponsorInfo.canRefer && (
                      <View style={styles.canReferBadge}>
                        <CheckCircle size={12} color="#00CB54" />
                      </View>
                    )}
                  </View>
                </View>

                {/* Apply Button */}
                <TouchableOpacity style={styles.applyBtnLarge} onPress={closeAllModals}>
                  <Heart color="#FFF" size={20} strokeWidth={2.5} />
                  <Text style={styles.applyBtnLargeText}>Show Interest</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sponsor Profile Modal (for Applicants) */}
      <Modal visible={!!selectedSponsor} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAllModals}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {selectedSponsor && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.matchScoreTag}>
                  <Sparkles size={12} color="#00CB54" />
                  <Text style={styles.matchScoreText}>{selectedSponsor.matchScore}</Text>
                </View>

                {/* Swipable Card Section */}
                <View style={styles.swipableContainer}>
                  <ScrollView 
                    horizontal 
                    pagingEnabled 
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  >
                    {/* Front: Bio & Info */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.infoCardHeader}>
                        <Image source={{ uri: selectedSponsor.image }} style={styles.modalAvatar} />
                        <View>
                          <Text style={styles.modalName}>{selectedSponsor.name}</Text>
                          <Text style={styles.sponsorSubtitle}>{selectedSponsor.role}</Text>
                          <Text style={styles.sponsorCompany}>{selectedSponsor.company}</Text>
                        </View>
                      </View>
                      <Text style={styles.bioText}>{selectedSponsor.bio}</Text>
                      <View style={styles.skillsContainer}>
                        {selectedSponsor.skills.map((s, i) => (
                          <View key={i} style={styles.skillChip}><Text style={styles.skillText}>{s}</Text></View>
                        ))}
                      </View>
                      <View style={styles.statItem}>
                        <Award size={14} color="#000" />
                        <Text style={styles.statLabel}>{selectedSponsor.experience}</Text>
                      </View>
                    </View>

                    {/* Back: Key Insights */}
                    <View style={[styles.infoCard, { width: CARD_WIDTH }]}>
                      <View style={styles.insightsHeader}>
                        <Sparkles size={20} color="#000" />
                        <Text style={styles.insightsTitle}>Why They Sponsor</Text>
                      </View>
                      
                      {selectedSponsor.insights && (
                        <View style={styles.insightSection}>
                          <Text style={styles.insightLabel}>QUICK HIT</Text>
                          <Text style={styles.insightContent}>{selectedSponsor.insights.funFact}</Text>
                        </View>
                      )}

                      {selectedSponsor.prompts?.map((prompt, idx) => (
                        <View key={idx} style={styles.promptWrapper}>
                          <View style={styles.promptHeaderRow}>
                            <Zap size={14} color="#000" />
                            <Text style={styles.insightLabel}>{prompt.question}</Text>
                          </View>
                          <Text style={styles.promptContent}>{prompt.answer}</Text>
                        </View>
                      ))}

                      <View style={[styles.statItem, { marginTop: 'auto', alignSelf: 'flex-start' }]}>
                        <CheckCircle size={14} color="#00CB54" />
                        <Text style={styles.statLabel}>Active Sponsor</Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Indicators */}
                  <View style={styles.pagination}>
                    <View style={[styles.dot, activeSlide === 0 ? styles.dotActive : styles.dotInactive]} />
                    <View style={[styles.dot, activeSlide === 1 ? styles.dotActive : styles.dotInactive]} />
                  </View>
                </View>

                {/* Messaging Section */}
                {modalMode === "message" && (
                  <Animated.View entering={FadeInUp} style={{ marginTop: 24 }}>
                    <Text style={styles.inputLabel}>Quick Reply</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.replyScroll} contentContainerStyle={{ gap: 8 }}>
                      {QUICK_REPLIES.map((r, i) => (
                        <TouchableOpacity key={i} style={styles.replyChip} onPress={() => setMessage(r)}>
                          <Text style={styles.replyChipText}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.messageInput} placeholder="Write a message..." value={message} onChangeText={setMessage} multiline />
                      <TouchableOpacity style={styles.sendBtn} onPress={closeAllModals}><Send color="#FFF" size={18} /></TouchableOpacity>
                    </View>
                  </Animated.View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 100 },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 4 },
  sectionContainer: { marginBottom: 40 },
  listSectionTitle: { fontSize: 12, fontWeight: "800", color: "#BBB", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 15 },
  horizontalScroll: { marginHorizontal: -28 },
  horizontalScrollContent: { paddingHorizontal: 28, gap: 16 },
  card: { width: 190, backgroundColor: "#F8F9FA", borderRadius: 24, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#EEE" },
  profileImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardRole: { fontSize: 13, color: "#666", marginBottom: 15 },
  messageBtn: { backgroundColor: "#000", width: '100%', padding: 10, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  messageBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  
  // Job Cards for Applicants
  jobCard: { width: 190, backgroundColor: "#F8F9FA", borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: "#EEE" },
  jobImage: { width: '100%', height: 100, backgroundColor: '#E5E5E5' },
  jobCardInfo: { padding: 16 },
  jobCardCompany: { fontSize: 13, fontWeight: "700", color: "#000", marginBottom: 4 },
  jobCardTitle: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 12, lineHeight: 20 },
  applyBtn: { backgroundColor: "#000", width: '100%', padding: 10, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  applyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  
  listSection: { gap: 12 },
  listItem: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: '#FAFAFA', borderRadius: 20 },
  listImage: { width: 50, height: 50, borderRadius: 15 },
  listInfo: { flex: 1, marginLeft: 15 },
  listName: { fontSize: 16, fontWeight: "700" },
  listStatus: { fontSize: 11, color: "#999", fontWeight: "700", marginTop: 2 },
  matchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  matchText: { fontSize: 11, fontWeight: '800', color: '#00CB54' },
  sponsorActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconAction: { padding: 8 },
  messageSponsorBtn: { backgroundColor: '#000', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  jobRefTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 15, marginBottom: 20 },
  jobRefLabel: { fontSize: 10, fontWeight: '900', color: '#999' },
  jobRefBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  jobRefText: { fontSize: 12, fontWeight: '700' },
  matchScoreTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 20 },
  matchScoreText: { fontSize: 12, fontWeight: '800', color: '#00CB54' },
  
  swipableContainer: { width: CARD_WIDTH, alignSelf: 'center' },
  infoCard: { height: 280, borderRadius: 24, padding: 20, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#EEE' },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 15 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: '#000' },
  dotInactive: { width: 6, backgroundColor: '#DDD' },

  // Slide Styles
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  modalAvatar: { width: 55, height: 55, borderRadius: 27 },
  modalName: { fontSize: 20, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 12, color: '#AAA', fontWeight: '600' },
  sponsorSubtitle: { fontSize: 14, color: '#666', fontWeight: '600', marginTop: 2 },
  sponsorCompany: { fontSize: 13, color: '#999', fontWeight: '600' },
  bioText: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 15 },
  skillsContainer: { flexDirection: 'row', gap: 8, marginBottom: 15, flexWrap: 'wrap' },
  skillChip: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  skillText: { fontSize: 11, fontWeight: '700', color: '#666' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  statLabel: { fontSize: 11, fontWeight: '800' },
  resumeBtn: { flex: 1, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
  resumeBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  insightsTitle: { color: '#000', fontSize: 18, fontWeight: '800' },
  insightSection: { marginBottom: 20 },
  insightLabel: { fontSize: 10, fontWeight: '800', color: '#AAA', marginBottom: 6, letterSpacing: 1.2 },
  insightContent: { fontSize: 14, fontWeight: '600', color: '#000', lineHeight: 20 },
  promptWrapper: { marginBottom: 20 },
  promptHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  promptContent: { fontSize: 14, fontWeight: '500', color: '#444', fontStyle: 'italic', lineHeight: 20 },

  // Job Modal Styles
  jobModalHeader: { flexDirection: 'row', gap: 12, marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  jobModalImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F5F5F5' },
  jobModalInfo: { flex: 1 },
  jobModalCompany: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 4 },
  jobModalTitle: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 8 },
  jobModalMeta: { flexDirection: 'row', gap: 12 },
  jobModalMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobModalMetaText: { fontSize: 12, color: '#999', fontWeight: '600' },
  jobSection: { marginBottom: 24 },
  jobSectionTitle: { fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  jobSectionText: { fontSize: 14, color: '#555', lineHeight: 22 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  benefitText: { fontSize: 14, color: '#555', fontWeight: '500' },
  sponsorInfoCard: { backgroundColor: '#F8F9FB', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
  sponsorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sponsorCardTitle: { fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase' },
  sponsorCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 20 },
  sponsorCardName: { fontSize: 14, fontWeight: '800', color: '#000' },
  sponsorCardRole: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 2 },
  canReferBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center' },
  applyBtnLarge: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyBtnLargeText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Input
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#BBB', textTransform: 'uppercase', marginBottom: 10 },
  replyScroll: { marginBottom: 15, marginHorizontal: -28, paddingHorizontal: 28 },
  replyChip: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#000', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  replyChipText: { fontWeight: '700', fontSize: 13 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 20, padding: 8 },
  messageInput: { flex: 1, padding: 10, fontSize: 15, maxHeight: 80 },
  sendBtn: { backgroundColor: '#000', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});