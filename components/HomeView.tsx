import { BlurView } from "expo-blur";
import {
  Award,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Coffee,
  DollarSign,
  Globe,
  GraduationCap,
  Info,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface HomeViewProps {
  userType: "applicant" | "sponsor";
}

const DECK_SIZE = 10;

const mockProfiles = [
  {
    id: 1,    
    name: "Aria Nakamura",
    role: "VP of Design",
    company: "ZenPay",
    location: "Tokyo, Japan",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800",
    bio: "Minimalist designer focused on financial inclusion. Making complex banking feel like a deep breath.",
    insights: { 
      funFact: "Collects vintage typewriters from the 1920s.", 
      mentality: "The best interface is no interface at all." 
    },
    prompts: [
      { question: "I'M BEST KNOWN FOR", answer: "Being the 'No' person in product meetings—keeping us focused on what matters.", icon: <Check size={14} color="#000" /> },
      { question: "THE PROJECT I'M MOST PROUD OF", answer: "A micro-loan app that helped 50k+ small businesses in SE Asia.", icon: <Award size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Former Design Lead at Square. Helped scale the 'Cash App' design system globally.", 
      education: "MFA in Interaction Design, Tokyo University of the Arts.", 
      achievements: "AIGA Medalist; Keynote speaker at Config 2023." 
    }
  },
  {
    id: 2,
    name: "Liam O'Shea",
    role: "Founding Engineer",
    company: "Terraform AI",
    location: "Seattle, WA",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800",
    bio: "Building autonomous reforestation drones. Obsessed with low-level systems and environmental impact.",
    insights: { 
      funFact: "Lived off-grid in a solar-powered van for two years while building his first startup.", 
      mentality: "Efficiency is the only sustainable path forward." 
    },
    prompts: [
      { question: "MY SECRET SUPERPOWER", answer: "Optimizing C++ code until it runs on a potato.", icon: <Zap size={14} color="#000" /> },
      { question: "IF I WASN'T IN TECH", answer: "I'd be a park ranger in the North Cascades.", icon: <Globe size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Ex-SpaceX Flight Software. Led the embedded systems team for the Starlink constellation.", 
      education: "B.S. in Aerospace Engineering, Georgia Tech.", 
      achievements: "Patented a new thermal regulation system for micro-satellites." 
    }
  },
  {
    id: 3,
    name: "Ethan Sterling",
    role: "General Partner",
    company: "Bridge Ventures",
    location: "New York, NY",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800",
    bio: "Investing in the next generation of 'unsexy' software. Logistics, supply chain, and insurance tech.",
    insights: { 
      funFact: "Has run a marathon on every continent (including Antarctica).", 
      mentality: "I bet on the person, not just the deck." 
    },
    prompts: [
      { question: "MY FAVORITE BRAINSTORMING FUEL", answer: "A 5am run followed by a very cold brew.", icon: <Coffee size={14} color="#000" /> },
      { question: "WHAT I LOOK FOR IN TALENT", answer: "High agency. I want people who don't wait for permission.", icon: <Sparkles size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Founded 'LogiFlow' (acquired by FedEx). 15 years as an operator before moving to VC.", 
      education: "B.A. in Economics, Yale University.", 
      achievements: "Forbes Midas List 'One to Watch'; Seed investor in 3 unicorns." 
    }
  },
  {
    id: 4,
    name: "Zoe Castillo",
    role: "E-sports Strategy Lead",
    company: "Riot Games",
    location: "Los Angeles, CA",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
    bio: "Building the future of competitive gaming. Bridging the gap between entertainment and pro sports.",
    insights: { 
      funFact: "Was a top-500 ranked Overwatch player in college.", 
      mentality: "Community is the only moat that lasts." 
    },
    prompts: [
      { question: "MY SECRET SUPERPOWER", answer: "Spotting trends in Gen-Z behavior before they hit the mainstream.", icon: <Zap size={14} color="#000" /> },
      { question: "ONE THING THAT SURPRISED ME", answer: "How much 'traditional' sports can learn from e-sports production.", icon: <Info size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Managed global tournaments for League of Legends. Former Analyst at ESPN.", 
      education: "B.A. in Digital Media, USC.", 
      achievements: "Emmy for Outstanding Interactive Experience in Sports." 
    }
  },
  {
    id: 5,
    name: "Dr. Kofi Aris",
    role: "Security Researcher",
    company: "Cloudflare",
    location: "Berlin, Germany",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800",
    bio: "White-hat hacker focused on post-quantum cryptography. Making the internet a safer place, one bug at a time.",
    insights: { 
      funFact: "Discovered a critical zero-day exploit in a major browser while on vacation.", 
      mentality: "Trust, but verify. Then verify again." 
    },
    prompts: [
      { question: "I'M BEST KNOWN FOR", answer: "Breaking things so that they can be built back stronger.", icon: <Check size={14} color="#000" /> },
      { question: "IF I WASN'T IN TECH", answer: "I'd be a locksmith. It's the same logic, just physical.", icon: <Briefcase size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "10 years in InfoSec. Former consultant for government cybersecurity agencies.", 
      education: "PhD in Cryptography, TU Berlin.", 
      achievements: "BlackHat Speaker; Top 10 Bug Bounty Hunter globally." 
    }
  },
  {
    id: 6,
    name: "Yuki Tanaka",
    role: "Robotics Engineer",
    company: "Boston Dynamics",
    location: "Boston, MA",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
    bio: "Giving robots a sense of touch. Specialized in haptic feedback and soft robotics.",
    insights: { 
      funFact: "Builds miniature mechanical watches as a hobby.", 
      mentality: "Hardware is hard, but that's why it's worth it." 
    },
    prompts: [
      { question: "MY SECRET SUPERPOWER", answer: "Patience. Tuning a PID loop for 12 hours straight is my zen.", icon: <Zap size={14} color="#000" /> },
      { question: "MY FAVORITE BRAINSTORMING FUEL", answer: "Matcha and lo-fi beats.", icon: <Coffee size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Developed tactile sensors for prosthetic limbs at Johns Hopkins APL.", 
      education: "M.S. in Robotics, Carnegie Mellon.", 
      achievements: "R&D 100 Award Winner; 12 peer-reviewed publications." 
    }
  },
  {
    id: 7,
    name: "Sienna Rivera",
    role: "Head of Community",
    company: "Web3 Foundation",
    location: "Miami, FL",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800",
    bio: "Championing decentralized governance. Passionate about ownership and creator economies.",
    insights: { 
      funFact: "Managed a Discord community of 250,000 members for a viral NFT project.", 
      mentality: "People > Code." 
    },
    prompts: [
      { question: "ONE THING THAT SURPRISED ME", answer: "How quickly strangers can organize for a common goal when incentives align.", icon: <MessageCircle size={14} color="#000" /> },
      { question: "THE PROJECT I'M MOST PROUD OF", answer: "Launching a DAO that funded 200+ scholarships for women in tech.", icon: <Award size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Ex-Community Lead at Patreon. Expert in tokenomics and governance structures.", 
      education: "B.A. in Sociology, NYU.", 
      achievements: "Vogue Business 100 Innovators List." 
    }
  },
  {
    id: 8,
    name: "Rahul Mehta",
    role: "Bioinformatics Lead",
    company: "Moderna",
    location: "Cambridge, MA",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    bio: "Using machine learning to accelerate drug discovery. Turning biology into a programmable language.",
    insights: { 
      funFact: "Taught himself to code by writing scripts to analyze his own DNA.", 
      mentality: "Data is the most powerful medicine we have." 
    },
    prompts: [
      { question: "I'M BEST KNOWN FOR", answer: "Bridging the gap between 'wet lab' scientists and 'dry lab' engineers.", icon: <Globe size={14} color="#000" /> },
      { question: "IF I WASN'T IN TECH", answer: "I'd be a chef. Chemistry you can eat.", icon: <Coffee size={14} color="#000" /> }
    ],
    fullDetails: { 
      experience: "Research scientist at the Broad Institute. Led genomic sequencing pipelines.", 
      education: "PhD in Computational Biology, Stanford.", 
      achievements: "Published in Nature; NIH Director's New Innovator Award." 
    }
  }
];

const mockJobs = [
  {
    id: 1,
    title: "Senior Software Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$180k - $240k",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    description: "Join our Payments Platform team to build the financial infrastructure for the internet. You'll work on systems processing billions of dollars in transactions.",
    skills: ["TypeScript", "React", "Go", "Kubernetes"],
    benefits: ["Unlimited PTO", "401k Match", "Full Health Coverage", "Remote Flexible"],
    sponsorInfo: {
      name: "Sarah Chen",
      role: "Engineering Manager",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800",
      yearsAtCompany: "4 years",
      canRefer: true,
      referralNote: "I personally review all applications and fast-track strong candidates through our process."
    },
    backchannelInsights: {
      dayToDay: "You'll spend mornings in code review and design discussions, afternoons in deep work. We have 2-3 hours of meetings weekly, mostly async. The team values shipping over perfectionism.",
      teamCulture: "Team of 8 senior engineers. Very collaborative, low ego. We do weekly offsites and have a strict no-weekend-work policy. Remote-first since 2020.",
      idealCandidate: "We need someone comfortable with ambiguity who can own projects end-to-end. Communication matters more than perfect technical skills - we can teach the stack."
    },
    fullDetails: {
      responsibilities: "Design and build scalable payment processing systems. Collaborate with product and design to ship features used by millions. Mentor junior engineers and contribute to technical strategy.",
      requirements: "5+ years of software engineering experience. Strong CS fundamentals. Experience with distributed systems. Bonus: payment processing or fintech background.",
      interviewProcess: "3 rounds over 2 weeks: technical screen, system design, team fit. We don't do whiteboard coding - expect real-world problems and take-home projects."
    }
  },
  {
    id: 2,
    title: "Product Designer",
    company: "Notion",
    location: "New York, NY",
    type: "Full-time",
    salary: "$140k - $190k",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    description: "Help us reimagine how teams collaborate. You'll design experiences that balance power and simplicity for millions of users worldwide.",
    skills: ["Figma", "Prototyping", "User Research", "Design Systems"],
    benefits: ["Equity Package", "Learning Stipend", "Home Office Budget", "Flexible Hours"],
    sponsorInfo: {
      name: "Alex Kim",
      role: "Head of Design",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800",
      yearsAtCompany: "3 years",
      canRefer: true,
      referralNote: "I'm looking for designers who think in systems and can balance craft with shipping velocity."
    },
    backchannelInsights: {
      dayToDay: "Mornings are for user research and design critique. Afternoons for prototyping and collaboration with eng. Expect deep focus time - we protect maker schedules.",
      teamCulture: "Small team of 12 designers, very tight-knit. We value thoughtful work over speed. Quarterly design sprints in person, rest is remote. Strong mentorship culture.",
      idealCandidate: "Looking for someone who loves details but understands business constraints. Portfolio should show end-to-end thinking, not just pretty pixels."
    },
    fullDetails: {
      responsibilities: "Own end-to-end design for key product areas. Conduct user research and usability testing. Contribute to and maintain our design system. Partner closely with engineering and product.",
      requirements: "4+ years of product design experience. Strong portfolio showing shipped work. Experience with design systems. Proficiency in Figma. Bonus: B2B SaaS experience.",
      interviewProcess: "Portfolio review, design challenge (3 hours), team interviews, final round with leadership. We pay for your time on the design challenge."
    }
  },
  {
    id: 3,
    title: "Data Scientist",
    company: "Spotify",
    location: "Remote",
    type: "Full-time",
    salary: "$150k - $200k",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
    description: "Use ML to personalize music recommendations for 500M+ users. Build models that understand taste and discover the next big artist.",
    skills: ["Python", "SQL", "Machine Learning", "A/B Testing"],
    benefits: ["Remote First", "Premium Spotify", "Annual Bonus", "Stock Options"],
    sponsorInfo: {
      name: "Maria Rodriguez",
      role: "Data Science Lead",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
      yearsAtCompany: "5 years",
      canRefer: true,
      referralNote: "I fast-track candidates who can balance technical rigor with business impact. Show me you care about the music, not just the models."
    },
    backchannelInsights: {
      dayToDay: "Mornings: stakeholder syncs and experiment reviews. Afternoons: model building and data exploration. Fridays are for learning and side projects. Very async-friendly.",
      teamCulture: "15-person team spread across 8 time zones. Fully remote since before COVID. We over-communicate in Slack and do monthly in-person sprints in Stockholm.",
      idealCandidate: "Need someone who can translate business questions into tractable ML problems. SQL skills matter more than PhD. Music passion is a must - we're not just another tech company."
    },
    fullDetails: {
      responsibilities: "Build and deploy ML models for recommendation systems. Design and analyze A/B tests. Partner with product to identify opportunities. Communicate insights to leadership.",
      requirements: "3+ years in data science or ML engineering. Strong Python and SQL. Experience with production ML systems. Familiarity with modern ML stack (PyTorch, scikit-learn, etc.).",
      interviewProcess: "SQL + stats screen, ML case study, stakeholder collaboration exercise, final round. Whole process is 2-3 weeks. We're async-first so interviews are flexible."
    }
  }
];

const SkeletonCard = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.7, { duration: 800 }), withTiming(0.3, { duration: 800 })), -1, true);
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <Animated.View style={[styles.imageWrapper, { backgroundColor: '#EEE' }, shimmerStyle]} />
        <View style={styles.cardInfo}>
          <Animated.View style={[{ width: '60%', height: 24, backgroundColor: '#EEE', borderRadius: 4, marginBottom: 12 }, shimmerStyle]} />
          <Animated.View style={[{ width: '40%', height: 16, backgroundColor: '#F5F5F5', borderRadius: 4, marginBottom: 20 }, shimmerStyle]} />
          <View style={styles.divider} />
          <Animated.View style={[{ width: '90%', height: 14, backgroundColor: '#F9F9F9', borderRadius: 4, marginBottom: 8 }, shimmerStyle]} />
        </View>
      </View>
    </View>
  );
};

export function HomeView({ userType }: HomeViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [progress, setProgress] = useState(1); 
  const [isFlipped, setIsFlipped] = useState(false);
  const [showMore, setShowMore] = useState(false);
  
  const swipeX = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);
  const rotateY = useSharedValue(0);
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(progress, DECK_SIZE) / DECK_SIZE, { duration: 600 });
  }, [progress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  // Use profiles for sponsors, jobs for applicants
  const currentData = userType === "sponsor" 
    ? mockProfiles[currentProfileIndex % mockProfiles.length]
    : mockJobs[currentProfileIndex % mockJobs.length];
  const isDeckFinished = progress > DECK_SIZE;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const toggleFlip = () => {
    rotateY.value = withTiming(isFlipped ? 0 : 180, { duration: 600 });
    setIsFlipped(!isFlipped);
  };

  const toggleMore = () => {
    const nextShowMore = !showMore;
    if (nextShowMore) {
        setShowMore(true);
        setTimeout(() => scrollRef.current?.scrollTo({ y: 380, animated: true }), 80);
    } else {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        setTimeout(() => setShowMore(false), 300);
    }
  };

  const handleSwipe = (isAccept: boolean) => {
    if (isAccept) {
        setShowCelebration(true);
        setTimeout(() => {
            setShowCelebration(false);
            nextProfile(true);
        }, 1800);
    } else {
        nextProfile(false);
    }
  };

  const nextProfile = (isAccept: boolean) => {
    if (isFlipped) { rotateY.value = 0; setIsFlipped(false); }
    setShowMore(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    swipeX.value = withTiming(isAccept ? SCREEN_WIDTH : -SCREEN_WIDTH, { duration: 400 });
    swipeOpacity.value = withTiming(0, { duration: 300 });

    setTimeout(() => {
      setProgress(prev => prev + 1);
      setCurrentProfileIndex((prev) => (prev + 1));
      swipeX.value = 0;
      swipeOpacity.value = withTiming(1, { duration: 300 });
    }, 400);
  };

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
    opacity: swipeOpacity.value,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value + 180}deg` }],
    backfaceVisibility: 'hidden',
    position: 'absolute', top: 0, width: '100%', height: '100%',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(showMore ? '180deg' : '0deg') }]
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown} style={styles.header}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Card {Math.min(progress, DECK_SIZE)} of {DECK_SIZE}</Text>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, progressBarStyle]} />
              </View>
            </View>
          </Animated.View>

          {isDeckFinished ? (
            <Animated.View entering={FadeInUp} style={styles.emptyState}>
              <View style={styles.emptyIconCircle}><RefreshCcw color="#000" size={32} /></View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>You've reviewed your deck. Come back tomorrow for more.</Text>
              <TouchableOpacity style={styles.returnBtn} onPress={() => { setProgress(1); setCurrentProfileIndex(0); }}>
                <Text style={styles.returnBtnText}>Refresh Deck</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : isLoading ? (
            <SkeletonCard />
          ) : (
            <View>
              <Animated.View style={[styles.cardContainer, mainAnimatedStyle]}>
                <TouchableOpacity activeOpacity={1} onPress={toggleFlip}>
                  {userType === "sponsor" ? (
                    /* SPONSOR VIEW - Profile Cards */
                    <>
                      {/* Front Face - Profile */}
                      <Animated.View style={[styles.cardOuter, frontStyle]}>
                        <View style={styles.cardInner}>
                          <View style={styles.imageWrapper}>
                            <Image source={{ uri: 'image' in currentData ? currentData.image : '' }} style={styles.profileImage} />
                            <View style={styles.infoFloatingBtn}><Info color="#000" size={16} /></View>
                          </View>
                          <View style={styles.cardInfo}>
                            <Text style={styles.nameText}>{'name' in currentData ? currentData.name : ''}</Text>
                            <View style={styles.metaRow}><Briefcase color="#000" size={14} /><Text style={styles.metaText}>{'role' in currentData ? `${currentData.role} @ ${currentData.company}` : ''}</Text></View>
                            <View style={styles.metaRow}><MapPin color="#666" size={14} /><Text style={styles.locationText}>{'location' in currentData ? currentData.location : ''}</Text></View>
                            <View style={styles.divider} />
                            <Text style={styles.bioText}>{'bio' in currentData ? currentData.bio : ''}</Text>
                          </View>
                        </View>
                      </Animated.View>

                      {/* Back Face - Insights */}
                      <Animated.View style={[styles.cardOuter, styles.cardOuterBack, backStyle]}>
                        <View style={[styles.cardInner, styles.cardInnerBack]}>
                          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardInfo}>
                            <View style={styles.backHeader}>
                              <Sparkles color="#000" size={20} />
                              <Text style={styles.backTitle}>Key Insights</Text>
                            </View>
                            <View style={styles.insightSection}>
                              <Text style={styles.insightLabel}>QUICK HIT</Text>
                              <Text style={styles.insightContent}>{'insights' in currentData && currentData.insights ? currentData.insights.funFact : ''}</Text>
                            </View>
                            {'prompts' in currentData && currentData.prompts?.map((prompt: any, idx: number) => (
                              <View key={idx} style={styles.promptWrapper}>
                                <View style={styles.promptHeaderRow}>
                                  {prompt.icon}
                                  <Text style={styles.insightLabel}>{prompt.question}</Text>
                                </View>
                                <Text style={styles.promptContent}>{prompt.answer}</Text>
                              </View>
                            ))}
                            <TouchableOpacity style={styles.flipBackBtn} onPress={toggleFlip}>
                              <Text style={styles.flipBackText}>View Profile</Text>
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      </Animated.View>
                    </>
                  ) : (
                    /* APPLICANT VIEW - Job Cards */
                    <>
                      {/* Front Face - Job Details */}
                      <Animated.View style={[styles.cardOuter, frontStyle]}>
                        <View style={styles.cardInner}>
                          <View style={styles.jobCardContent}>
                            {/* Company Logo & Name Row First */}
                            <View style={styles.companyInfoRow}>
                              <Image source={{ uri: 'image' in currentData ? currentData.image : '' }} style={styles.companyLogo} />
                              <View style={styles.companyDetails}>
                                <Text style={styles.companyName}>{'company' in currentData ? currentData.company : ''}</Text>
                              </View>
                              <TouchableOpacity style={styles.infoFloatingBtnSmall} onPress={(e) => { e.stopPropagation(); toggleFlip(); }}>
                                <Info color="#000" size={14} />
                              </TouchableOpacity>
                            </View>

                            {/* Job Title Below */}
                            <Text style={styles.jobTitle} numberOfLines={2}>{'title' in currentData ? currentData.title : ''}</Text>

                            {/* Job Meta Info - Simple Text Lines */}
                            <View style={styles.jobMetaList}>
                              <View style={styles.jobMetaLine}>
                                <MapPin color="#999" size={14} />
                                <Text style={styles.jobMetaLineText}>{'location' in currentData ? currentData.location : ''}</Text>
                              </View>
                              <View style={styles.jobMetaLine}>
                                <DollarSign color="#999" size={14} />
                                <Text style={styles.jobMetaLineText}>{'salary' in currentData ? currentData.salary : ''}</Text>
                              </View>
                              <View style={styles.jobMetaLine}>
                                <Briefcase color="#999" size={14} />
                                <Text style={styles.jobMetaLineText}>{'type' in currentData ? currentData.type : ''}</Text>
                              </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Job Description */}
                            <Text style={styles.jobDescription} numberOfLines={3}>{'description' in currentData ? currentData.description : ''}</Text>

                            {/* Skills Preview */}
                            {'skills' in currentData && currentData.skills && (
                              <View style={styles.skillsPreviewSection}>
                                <Text style={styles.skillsPreviewLabel}>KEY SKILLS</Text>
                                <View style={styles.skillsRow}>
                                  {currentData.skills.slice(0, 4).map((skill: string, idx: number) => (
                                    <View key={idx} style={styles.skillChip}>
                                      <Text style={styles.skillChipText}>{skill}</Text>
                                    </View>
                                  ))}
                                  {currentData.skills.length > 4 && (
                                    <View style={[styles.skillChip, styles.skillChipMore]}>
                                      <Text style={[styles.skillChipText, styles.skillChipTextWhite]}>+{currentData.skills.length - 4}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      </Animated.View>

                      {/* Back Face - Sponsor Info */}
                      <Animated.View style={[styles.cardOuter, styles.cardOuterBack, backStyle]}>
                        <View style={[styles.cardInner, styles.cardInnerBack]}>
                          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardInfo}>
                            <View style={styles.backHeader}>
                              <Users color="#000" size={20} />
                              <Text style={styles.backTitle}>Your Sponsor</Text>
                            </View>
                            
                            {'sponsorInfo' in currentData && currentData.sponsorInfo && (
                              <>
                                <View style={styles.sponsorHeader}>
                                  <Image source={{ uri: currentData.sponsorInfo.image }} style={styles.sponsorAvatar} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.sponsorName}>{currentData.sponsorInfo.name}</Text>
                                    <Text style={styles.sponsorRole}>{currentData.sponsorInfo.role}</Text>
                                    <View style={[styles.metaRow, { marginTop: 4 }]}>
                                      <Calendar size={12} color="#999" />
                                      <Text style={styles.sponsorYears}>{currentData.sponsorInfo.yearsAtCompany} at company</Text>
                                    </View>
                                  </View>
                                </View>

                                <View style={styles.insightSection}>
                                  <Text style={styles.insightLabel}>REFERRAL NOTE</Text>
                                  <Text style={styles.promptContent}>{currentData.sponsorInfo.referralNote}</Text>
                                </View>

                                {currentData.sponsorInfo.canRefer && (
                                  <View style={styles.canReferBadge}>
                                    <Check size={14} color="#00CB54" />
                                    <Text style={styles.canReferText}>Can provide direct referral</Text>
                                  </View>
                                )}
                              </>
                            )}

                            <TouchableOpacity style={styles.flipBackBtn} onPress={toggleFlip}>
                              <Text style={styles.flipBackText}>View Job Details</Text>
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      </Animated.View>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View layout={LinearTransition}>
                {showMore && (
                  <View style={styles.expandedDetails}>
                    {userType === "sponsor" ? (
                      /* Sponsor More Details - Profile */
                      <>
                        {'fullDetails' in currentData && currentData.fullDetails && 'experience' in currentData.fullDetails && (
                          <>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><Briefcase size={14} color="#000" /><Text style={styles.detailTitle}>Experience</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).experience}</Text>
                            </View>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><GraduationCap size={14} color="#000" /><Text style={styles.detailTitle}>Education</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).education}</Text>
                            </View>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><Award size={14} color="#000" /><Text style={styles.detailTitle}>Achievements</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).achievements}</Text>
                            </View>
                          </>
                        )}
                      </>
                    ) : (
                      /* Applicant More Details - Job */
                      <>
                        {'fullDetails' in currentData && currentData.fullDetails && 'responsibilities' in currentData.fullDetails && (
                          <>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><Briefcase size={14} color="#000" /><Text style={styles.detailTitle}>Responsibilities</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).responsibilities}</Text>
                            </View>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><Award size={14} color="#000" /><Text style={styles.detailTitle}>Requirements</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).requirements}</Text>
                            </View>
                            <View style={styles.detailItem}>
                              <View style={styles.detailHeaderRow}><Calendar size={14} color="#000" /><Text style={styles.detailTitle}>Interview Process</Text></View>
                              <Text style={styles.detailBody}>{(currentData.fullDetails as any).interviewProcess}</Text>
                            </View>
                          </>
                        )}
                        {'skills' in currentData && currentData.skills && (
                          <View style={styles.detailItem}>
                            <View style={styles.detailHeaderRow}><TrendingUp size={14} color="#000" /><Text style={styles.detailTitle}>Required Skills</Text></View>
                            <View style={styles.skillsRow}>
                              {currentData.skills.map((skill: string, idx: number) => (
                                <View key={idx} style={styles.skillBadge}>
                                  <Text style={styles.skillBadgeText}>{skill}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        {'benefits' in currentData && currentData.benefits && (
                          <View style={styles.detailItem}>
                            <View style={styles.detailHeaderRow}><Sparkles size={14} color="#000" /><Text style={styles.detailTitle}>Benefits</Text></View>
                            <View style={styles.benefitsList}>
                              {currentData.benefits.map((benefit: string, idx: number) => (
                                <View key={idx} style={styles.benefitRow}>
                                  <Check size={14} color="#00CB54" />
                                  <Text style={styles.benefitText}>{benefit}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
                <View style={styles.bottomNav}>
                  <TouchableOpacity onPress={() => handleSwipe(false)} style={styles.navBtn}>
                    <View style={styles.circleBtn}><X color="#000" size={22} /></View>
                    <Text style={styles.navLabel}>SKIP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleMore} style={styles.navBtn}>
                    <View style={[styles.circleBtn, showMore && styles.activeBtn]}>
                      <Animated.View style={chevronStyle}><ChevronDown color={showMore ? "#FFF" : "#000"} size={22} /></Animated.View>
                    </View>
                    <Text style={styles.navLabel}>{showMore ? "LESS" : "MORE"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSwipe(true)} style={styles.navBtn}>
                    <View style={[styles.circleBtn, styles.connectCircle]}><Check color="#FFF" size={22} /></View>
                    <Text style={styles.navLabel}>{userType === "sponsor" ? "CONNECT" : "APPLY"}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Celebration Message */}
      {showCelebration && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
              <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="light" />
              <View style={styles.overlayCenter}>
                  <Animated.View entering={ZoomIn.duration(400)} style={styles.celebrationCard}>
                      <View style={styles.successCircle}>
                          <Check color="#FFF" size={32} strokeWidth={3} />
                      </View>
                      <Text style={styles.celebrationTitle}>
                        {userType === "sponsor" ? "Request Sent!" : "Application Sent!"}
                      </Text>
                      <Text style={styles.celebrationSub}>
                        {userType === "sponsor" 
                          ? `You've connected with ${'name' in currentData ? currentData.name : ''}`
                          : `You've applied to ${'title' in currentData ? currentData.title : ''}`
                        }
                      </Text>
                  </Animated.View>
              </View>
          </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 36, paddingBottom: 100 },
  header: {marginBottom: 28 },
  title: { fontSize: 34, fontWeight: "700", color: "#000", letterSpacing: -1.2 },
  progressHeader: { marginTop: 6 },
  progressText: { fontSize: 12, fontWeight: "700", color: "#BBB", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  progressTrack: { height: 6, backgroundColor: "#F0F0F0", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#000", borderRadius: 3 },
  cardContainer: { marginBottom: 24 },
  cardOuter: {
    borderRadius: 24,
    backgroundColor: "#FFF",
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 30 },
      android: { elevation: 18 },
    }),
  },
  cardOuterBack: { backgroundColor: "#FBFBFB" },
  cardInner: { backgroundColor: "#FFF", borderRadius: 24, borderWidth: 1, borderColor: "#F0F0F0", overflow: "hidden", height: 460 },
  cardInnerBack: { backgroundColor: "#FBFBFB" },
  imageWrapper: { height: 220, backgroundColor: "#F9F9F9" },
  profileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  infoFloatingBtn: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(255,255,255,0.8)", padding: 6, borderRadius: 8 },
  cardInfo: { padding: 24 },
  nameText: { fontSize: 24, fontWeight: "700", color: "#000", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: { fontSize: 14, fontWeight: "600", color: "#000" },
  locationText: { fontSize: 14, color: "#666" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10 },
  bioText: { fontSize: 15, color: "#444", lineHeight: 22 },
  expandedDetails: { marginBottom: 32, gap: 14 },
  detailItem: { 
    backgroundColor: "#FFF", 
    padding: 20, 
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 15 },
      android: { elevation: 4 },
    }),
  },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailTitle: { fontWeight: '800', fontSize: 12, textTransform: 'uppercase', color: '#000', letterSpacing: 0.5 },
  detailBody: { color: '#555', fontSize: 14, lineHeight: 20 },
  bottomNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  navBtn: { alignItems: 'center', gap: 10 },
  circleBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: "#EEE", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
  connectCircle: { backgroundColor: "#000", borderColor: "#000" },
  activeBtn: { backgroundColor: "#000", borderColor: "#000" },
  navLabel: { fontSize: 11, fontWeight: "800", color: "#CCC", letterSpacing: 1.5 },
  
  // BACK OF CARD (INSIGHTS)
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  backTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  insightSection: { marginBottom: 24 },
  insightLabel: { fontSize: 11, fontWeight: '800', color: '#AAA', marginBottom: 8, letterSpacing: 1.2 },
  insightContent: { fontSize: 16, fontWeight: '600', color: '#000', lineHeight: 24 },
  
  // PROMPTS
  promptWrapper: { marginBottom: 24, paddingLeft: 2 },
  promptHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  promptContent: { fontSize: 16, fontWeight: '500', color: '#444', fontStyle: 'italic', lineHeight: 24 },

  flipBackBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE' },
  flipBackText: { fontSize: 12, color: '#BBB', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  
  overlayCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, zIndex: 10000 },
  celebrationCard: { width: '100%', backgroundColor: '#FFF', padding: 40, borderRadius: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 25, elevation: 15 },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  celebrationTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  celebrationSub: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 12, lineHeight: 22 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
  returnBtn: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30 },
  returnBtnText: { color: '#FFF', fontWeight: '700' },
  sponsorHeader: { flexDirection: 'row', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sponsorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F5F5F5' },
  sponsorName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  sponsorRole: { fontSize: 13, color: '#666', marginBottom: 2 },
  sponsorYears: { fontSize: 12, color: '#999', marginLeft: 4 },
  canReferBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 12 },
  canReferText: { fontSize: 12, fontWeight: '700', color: '#00CB54' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  skillBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  skillBadgeText: { fontSize: 12, fontWeight: '700', color: '#000' },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { fontSize: 14, color: '#555', flex: 1 },
  
  // JOB CARD SPECIFIC STYLES
  jobCardContent: { padding: 24, paddingTop: 28 },
  companyInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  companyLogo: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E5E5E5' },
  companyDetails: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: '700', color: '#000' },
  jobTitle: { fontSize: 24, fontWeight: '800', color: '#000', lineHeight: 30, marginBottom: 16 },
  jobMetaList: { gap: 8, marginBottom: 10 },
  jobMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jobMetaLineText: { fontSize: 14, color: '#666', fontWeight: '500' },
  infoFloatingBtnSmall: { backgroundColor: '#F9F9F9', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#EEE' },
  jobDescription: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 18 },
  skillsPreviewSection: { marginTop: 4 },
  skillsPreviewLabel: { fontSize: 10, fontWeight: '900', color: '#999', marginBottom: 10, letterSpacing: 1 },
  skillChip: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5E5' },
  skillChipMore: { backgroundColor: '#000', borderColor: '#000' },
  skillChipText: { fontSize: 12, fontWeight: '700', color: '#000' },
  skillChipTextWhite: { color: '#FFF' }
});