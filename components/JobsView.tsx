import { BlurView } from "expo-blur";
import {
  Award,
  Briefcase,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  Users,
  X,
  Zap,
  Lock
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  SlideOutDown
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_PADDING = 28;
const CARD_WIDTH = SCREEN_WIDTH - (MODAL_PADDING * 2);

interface SponsorInfo {
  name: string;
  role: string;
  image: string;
  canRefer: boolean;
}

interface Applicant {
  id: string;
  name: string;
  role: string;
  company: string;
  image: string;
  matchScore: number;
  experience: string;
  skills: string[];
  appliedRole: string;
  insights?: {
    funFact: string;
  };
  prompts?: {
    question: string;
    answer: string;
  }[];
}

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  applicants: number;
  image: string;
  logo: string;
  salary: string;
  postedAt: string;
  description: string;
  skills: string[];
  benefits: string[];
  currentSponsors: SponsorInfo[];
  isSponsored?: boolean;
  topApplicants?: Applicant[];
}

const mockJobs: JobPosting[] = [
  {
    id: "1",
    title: "Software Engineer",
    company: "JPMorgan Chase",
    location: "New York, NY",
    type: "Full-time",
    applicants: 24,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    logo: require("../assets/images/jpmc-logo.png"),
    salary: "$140k - $180k",
    postedAt: "2d ago",
    description: "Join our Corporate & Investment Bank division to build high-performance trading platforms.",
    skills: ["Java", "Spring Boot", "React", "Kafka"],
    benefits: ["Hybrid Work", "Pension Plan", "Health Insurance"],
    currentSponsors: [
      {
       name: "David Chen",
       role: "VP of Engineering",
       image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
       canRefer: true
      },
      {
       name: "Maria Rodriguez",
       role: "Senior Engineer",
       image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200",
       canRefer: false
      }
    ]
  },
  {
    id: "2",
    title: "Data Scientist",
    company: "JPMorgan Chase",
    location: "Plano, TX",
    type: "Full-time",
    applicants: 12,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    logo: require("../assets/images/jpmc-logo.png"),
    salary: "$130k - $160k",
    postedAt: "4h ago",
    description: "Leverage machine learning to detect fraud and improve customer experience in our Consumer Banking division.",
    skills: ["Python", "TensorFlow", "SQL", "Spark"],
    benefits: ["401k Match", "Wellness Stipend", "Flexible Hours"],
    currentSponsors: [
      {
       name: "Sarah Miller",
       role: "Lead Data Scientist",
       image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
       canRefer: true
      }
    ]
  },
  {
    id: "3",
    title: "Mobile Developer",
    company: "JPMorgan Chase",
    location: "Wilmington, DE",
    type: "Contract",
    applicants: 8,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    logo: require("../assets/images/jpmc-logo.png"),
    salary: "$90 - $120 / hr",
    postedAt: "1d ago",
    description: "Build the next generation of our mobile banking app used by millions of customers daily.",
    skills: ["Swift", "React Native", "iOS", "Security"],
    benefits: ["Contract", "Remote Options", "Performance Bonus"],
    currentSponsors: [
      {
       name: "James Wilson",
       role: "Executive Director",
       image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
       canRefer: false
      }
    ]
  },
  {
    id: "4",
    title: "Machine Learning Lead",
    company: "JPMorgan Chase",
    location: "San Francisco, CA",
    type: "Full-time",
    applicants: 45,
    isSponsored: true,
    topApplicants: [
      { 
        id: "a1", 
        name: "Elena Torres", 
        role: "Sr ML Engineer",
        company: "OpenAI", 
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200", 
        matchScore: 98,
        experience: "8+ Years",
        skills: ["PyTorch", "TensorFlow", "NLP", "Python"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Published 3 papers on transformer architectures at top AI conferences." },
        prompts: [{ question: "MY SECRET SUPERPOWER", answer: "Turning complex ML models into production-ready systems." }]
      },
      { 
        id: "a2", 
        name: "David Kim", 
        role: "AI Researcher",
        company: "Google", 
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200", 
        matchScore: 95,
        experience: "6+ Years",
        skills: ["Deep Learning", "Computer Vision", "Research", "Scaling"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Led a team that reduced model inference time by 10x using novel optimization techniques." },
        prompts: [{ question: "I'M BEST KNOWN FOR", answer: "Building AI systems that operate at massive scale with minimal latency." }]
      },
      { 
        id: "a3", 
        name: "Sarah Jenkins", 
        role: "Lead Data Scientist",
        company: "Meta", 
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200", 
        matchScore: 92,
        experience: "7+ Years",
        skills: ["Machine Learning", "A/B Testing", "SQL", "Leadership"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Grew a team from 3 to 25 data scientists while shipping 50+ ML models." },
        prompts: [{ question: "MY LEADERSHIP STYLE", answer: "Empowering teams through autonomy and data-driven decision making." }]
      },
      { 
        id: "a4", 
        name: "Marcus Johnson", 
        role: "ML Platform Engineer",
        company: "Microsoft", 
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200", 
        matchScore: 89,
        experience: "5+ Years",
        skills: ["MLOps", "Kubernetes", "Python", "System Design"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Built the ML infrastructure that powers Azure's recommendation engine." },
        prompts: [{ question: "WHAT DRIVES ME", answer: "Making machine learning accessible to every developer through great tooling." }]
      },
      { 
        id: "a5", 
        name: "Priya Patel", 
        role: "AI Research Scientist",
        company: "DeepMind", 
        image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200", 
        matchScore: 94,
        experience: "9+ Years",
        skills: ["Reinforcement Learning", "Research", "Mathematics", "PyTorch"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Co-authored breakthrough research on multi-agent RL systems." },
        prompts: [{ question: "MY APPROACH", answer: "Bridging the gap between cutting-edge research and real-world applications." }]
      },
      { 
        id: "a6", 
        name: "Alex Chen", 
        role: "Senior ML Engineer",
        company: "Tesla", 
        image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200", 
        matchScore: 91,
        experience: "6+ Years",
        skills: ["Computer Vision", "Autonomous Systems", "C++", "Real-time ML"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Shipped ML models running on millions of vehicles in production." },
        prompts: [{ question: "WHY I BUILD", answer: "Creating technology that saves lives through intelligent automation." }]
      },
      { 
        id: "a7", 
        name: "Sofia Rodriguez", 
        role: "Data Science Lead",
        company: "Uber", 
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200", 
        matchScore: 87,
        experience: "7+ Years",
        skills: ["Forecasting", "Optimization", "Python", "Team Leadership"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Built dynamic pricing models that optimize billions in revenue annually." },
        prompts: [{ question: "MY MISSION", answer: "Using data science to create seamless experiences for millions of users." }]
      },
      { 
        id: "a8", 
        name: "James Wilson", 
        role: "NLP Engineer",
        company: "Amazon", 
        image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200", 
        matchScore: 93,
        experience: "5+ Years",
        skills: ["NLP", "LLMs", "Transformers", "Distributed Systems"],
        appliedRole: "Machine Learning Lead",
        insights: { funFact: "Fine-tuned language models that power Alexa's conversational AI." },
        prompts: [{ question: "WHAT EXCITES ME", answer: "Making AI understand and communicate like humans through language." }]
      }
    ],
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800",
    logo: require("../assets/images/jpmc-logo.png"),
    salary: "$220k - $300k",
    postedAt: "5h ago",
    description: "Lead a team of researchers and engineers to deploy large language models for financial analysis.",
    skills: ["NLP", "PyTorch", "Leadership", "Cloud"],
    benefits: ["Relocation", "Stock Options", "Sabbatical"],
    currentSponsors: [
      {
       name: "Emily Zhang",
       role: "Managing Director, AI Research",
       image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200",
       canRefer: true
      },
      {
       name: "Robert Fox",
       role: "Senior Researcher",
       image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200",
       canRefer: true
      }
    ]
  },
];

export function JobsView() {
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [viewJobDetails, setViewJobDetails] = useState<JobPosting | null>(null);
  const [menuJob, setMenuJob] = useState<JobPosting | null>(null);
  
  const [selectedApplicantJob, setSelectedApplicantJob] = useState<JobPosting | null>(null);
  const [showSponsorGate, setShowSponsorGate] = useState<JobPosting | null>(null);
  const [selectedApplicantForMessage, setSelectedApplicantForMessage] = useState<Applicant | null>(null);
  const [message, setMessage] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideWidth = SCREEN_WIDTH - (MODAL_PADDING * 2);
    const slide = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveSlide(slide);
  };

  const toggleFilter = (category: string, option: string) => {
    setSelectedFilters(prev => {
      const current = prev[category] || [];
      if (current.includes(option)) {
        return { ...prev, [category]: current.filter(o => o !== option) };
      } else {
        return { ...prev, [category]: [...current, option] };
      }
    });
  };

  const FILTER_OPTIONS = [
    { id: 'type', label: 'Job Type', options: ['Full-time', 'Contract', 'Part-time', 'Internship'] },
    { id: 'location', label: 'Location', options: ['Remote', 'On-site', 'Hybrid', 'Relocation Available'] },
    { id: 'department', label: 'Department', options: ['Engineering', 'Product', 'Design', 'Data Science', 'Sales', 'Marketing'] },
    { id: 'experience', label: 'Experience', options: ['Entry Level', 'Mid-Level', 'Senior', 'Lead/Principal'] }
  ];

  const activeFilterCount = Object.values(selectedFilters).flat().length;

  const handleApplicantPress = (job: JobPosting) => {
    if (job.isSponsored) {
      setSelectedApplicantJob(job);
    } else {
      setShowSponsorGate(job);
    }
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sponsorshipStep, setSponsorshipStep] = useState(1);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [canRefer, setCanRefer] = useState<boolean | null>(null);
  
  // Create Listing Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [workAuthorization, setWorkAuthorization] = useState<string | null>(null);
  const [referralProcess, setReferralProcess] = useState<string | null>(null);
  const [canProvideReferral, setCanProvideReferral] = useState<boolean | null>(null);
  const [insiderInsights, setInsiderInsights] = useState('');
  const [dayToDay, setDayToDay] = useState('');
  const [teamCulture, setTeamCulture] = useState('');
  const [idealCandidate, setIdealCandidate] = useState('');

  const createScrollViewRef = useRef<ScrollView>(null);

  const isFormComplete = relationship !== null && canRefer !== null;

  const scrollToTop = () => {
    createScrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleOpenModal = (job: JobPosting) => {
    setSelectedJob(job);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSponsorshipStep(1);
    setSelectedJob(null);
    setRelationship(null);
    setCanRefer(null);
  };

  const handleConfirmSponsorship = () => {
    setSponsorshipStep(2);
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep(1);
    setJobTitle('');
    setCompany('');
    setLocation('');
    setEmploymentType(null);
    setExperienceLevel(null);
    setSalary('');
    setDescription('');
    setRequiredSkills([]);
    setSkillInput('');
    setWorkAuthorization(null);
    setReferralProcess(null);
    setCanProvideReferral(null);
    setInsiderInsights('');
    setDayToDay('');
    setTeamCulture('');
    setIdealCandidate('');
  };

  // Validation for each step
  const canProceedStep1 = jobTitle.trim() && company.trim() && location.trim();
  const canProceedStep2 = employmentType && experienceLevel;
  const canProceedStep3 = requiredSkills.length > 0 && workAuthorization;
  const canProceedStep4 = referralProcess && canProvideReferral !== null;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Job Board</Text>
          <Text style={styles.subtitle}>Manage your listings and find the right talent</Text>
        </View>
        
        <Animated.View entering={FadeInDown.duration(300)}>
          <TouchableOpacity style={styles.createButton} activeOpacity={0.9} onPress={openCreateModal}>
            <Plus color="#FFF" size={20} strokeWidth={3} />
            <Text style={styles.createButtonText}>Create Listing</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.sectionTitleRow}>
          <Text style={styles.listSectionTitle}>Available Jobs</Text>
          <TouchableOpacity 
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} 
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={20} color={activeFilterCount > 0 ? "#FFF" : "#000"} />
          </TouchableOpacity>
        </Animated.View>
        
        {mockJobs.filter(j => !j.isSponsored).map((job, index) => (
          <Animated.View key={job.id} entering={FadeInUp.delay(100 + (index * 40)).duration(300)}>
            <JobCard 
              job={job} 
              onSponsor={() => handleOpenModal(job)}
              onPress={() => setViewJobDetails(job)}
              onMenu={() => setMenuJob(job)}
              onApplicantPress={() => handleApplicantPress(job)}
            />
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.sponsoredHeaderRow}>
          <Text style={styles.listSectionTitle}>Sponsored Listings</Text>
        </Animated.View>

        {mockJobs.filter(j => j.isSponsored).map((job, index) => (
          <Animated.View key={job.id} entering={FadeInUp.delay(250 + (index * 40)).duration(300)}>
            <JobCard 
              job={job} 
              isSponsored
              onPress={() => setViewJobDetails(job)}
              onMenu={() => setMenuJob(job)}
              onApplicantPress={() => handleApplicantPress(job)}
            />
          </Animated.View>
        ))}
      </ScrollView>

      {/* Sponsorship Modal */}
      <Modal 
        visible={isModalVisible} 
        transparent 
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={closeModal}
          >
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          <Animated.View 
            entering={SlideInDown} 
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>
                {sponsorshipStep === 1 ? 'Confirm Sponsorship' : 'Sponsorship Active!'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            {sponsorshipStep === 1 ? (
              <>
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  <Text style={styles.modalSubTitle}>
                    Help us understand your role and referral capability
                  </Text>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Your relationship to this role</Text>
                    {['Hiring Manager', 'Team Member', 'Other'].map((item) => (
                      <TouchableOpacity 
                        key={item} 
                        style={styles.radioOption}
                        onPress={() => setRelationship(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View style={[styles.radioCircle, relationship === item && styles.radioCircleActive]} />
                          <Text style={[styles.radioText, relationship === item && styles.radioTextActive]}>{item}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Can you provide a referral?</Text>
                    <View style={styles.sideBySide}>
                      <TouchableOpacity 
                        style={styles.halfOption}
                        onPress={() => setCanRefer(true)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, canRefer === true && styles.radioCircleActive]} />
                        <Text style={[styles.radioText, canRefer === true && styles.radioTextActive]}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.halfOption}
                        onPress={() => setCanRefer(false)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, canRefer === false && styles.radioCircleActive]} />
                        <Text style={[styles.radioText, canRefer === false && styles.radioTextActive]}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
                <TouchableOpacity 
                  style={[styles.confirmBtn, !isFormComplete && styles.confirmBtnDisabled]} 
                  disabled={!isFormComplete}
                  onPress={handleConfirmSponsorship}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmBtnText}>Confirm Sponsorship</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Animated.View entering={FadeIn} style={styles.successStep}>
                <View style={styles.successIcon}>
                  <CheckCircle size={60} color="#00CB54" />
                </View>
                <Text style={styles.successTitle}>Sponsorship Confirmed!</Text>
                <Text style={styles.successDesc}>
                  You are now sponsoring {selectedJob?.title}. Applicants will be able to see your sponsorship.
                </Text>
                <TouchableOpacity 
                  style={styles.confirmBtn} 
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmBtnText}>Back to Job Board</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Create Listing Modal */}
      <Modal 
        visible={showCreateModal} 
        transparent 
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={closeCreateModal}
          >
            <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          <Animated.View 
            entering={SlideInDown} 
            exiting={SlideOutDown}
            style={styles.createModalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>
                {createStep === 1 && 'Job Details'}
                {createStep === 2 && 'Employment Info'}
                {createStep === 3 && 'Requirements'}
                {createStep === 4 && 'Referral Process'}
                {createStep === 5 && 'Review'}
                {createStep === 6 && 'BackChannel Insights'}
                {createStep === 7 && 'Job Posted!'}
              </Text>
              <TouchableOpacity onPress={closeCreateModal} style={styles.closeButton}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            {createStep < 7 && (
              <View style={styles.stepIndicator}>
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <View key={step} style={[styles.stepDot, createStep >= step && styles.stepDotActive]} />
                ))}
              </View>
            )}

            <ScrollView 
              ref={createScrollViewRef}
              showsVerticalScrollIndicator={false} 
              bounces={false} 
              style={styles.createScrollView}
            >
              {/* Step 1: Job Details */}
              {createStep === 1 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>Enter the basic information about the position</Text>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Job Title *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Senior Software Engineer"
                      placeholderTextColor="#999"
                      value={jobTitle}
                      onChangeText={setJobTitle}
                    />
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Company *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Google"
                      placeholderTextColor="#999"
                      value={company}
                      onChangeText={setCompany}
                    />
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Location *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. New York, NY or Remote"
                      placeholderTextColor="#999"
                      value={location}
                      onChangeText={setLocation}
                    />
                  </View>
                </Animated.View>
              )}

              {/* Step 2: Employment Info */}
              {createStep === 2 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>Specify employment type and experience level</Text>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Employment Type *</Text>
                    {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => (
                      <TouchableOpacity 
                        key={type} 
                        style={styles.radioOption}
                        onPress={() => setEmploymentType(type)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View style={[styles.radioCircle, employmentType === type && styles.radioCircleActive]} />
                          <Text style={[styles.radioText, employmentType === type && styles.radioTextActive]}>{type}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Experience Level *</Text>
                    {['Entry Level', 'Mid Level', 'Senior Level', 'Lead/Principal', 'Executive'].map((level) => (
                      <TouchableOpacity 
                        key={level} 
                        style={styles.radioOption}
                        onPress={() => setExperienceLevel(level)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View style={[styles.radioCircle, experienceLevel === level && styles.radioCircleActive]} />
                          <Text style={[styles.radioText, experienceLevel === level && styles.radioTextActive]}>{level}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Salary Range (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. $120k - $180k"
                      placeholderTextColor="#999"
                      value={salary}
                      onChangeText={setSalary}
                    />
                  </View>
                </Animated.View>
              )}

              {/* Step 3: Requirements */}
              {createStep === 3 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>Define the key requirements for this role</Text>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Required Skills *</Text>
                    <Text style={styles.fieldHint}>List the key skills needed for this position (press comma, space, or enter to add)</Text>
                    <TextInput
                      style={[styles.textInput, styles.skillsInput]}
                      placeholder="Type a skill and press comma, space, or enter..."
                      placeholderTextColor="#999"
                      value={skillInput}
                      onChangeText={(text) => {
                        const lastChar = text[text.length - 1];
                        if (lastChar === ',' || lastChar === ' ' || lastChar === '\n') {
                          const skillText = text.slice(0, -1).trim();
                          if (skillText.length > 0) {
                            if (!requiredSkills.includes(skillText)) {
                              setRequiredSkills(prev => [...prev, skillText]);
                            }
                            setSkillInput('');
                          }
                        } else {
                          setSkillInput(text);
                        }
                      }}
                      onSubmitEditing={() => {
                        const skillText = skillInput.trim();
                        if (skillText.length > 0) {
                          if (!requiredSkills.includes(skillText)) {
                            setRequiredSkills(prev => [...prev, skillText]);
                          }
                          setSkillInput('');
                        }
                      }}
                      blurOnSubmit={false}
                      returnKeyType="done"
                    />
                    {requiredSkills.length > 0 && (
                      <View style={styles.skillsPreview}>
                        {requiredSkills.map((skill, idx) => (
                          <View key={idx} style={styles.previewSkillBadge}>
                            <Text style={styles.previewSkillText}>{skill}</Text>
                            <TouchableOpacity 
                              onPress={() => setRequiredSkills(prev => prev.filter((_, i) => i !== idx))}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <X size={14} color="#FFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Work Authorization *</Text>
                    {['US Citizen/Green Card', 'Visa Sponsorship Available', 'Any Authorization'].map((auth) => (
                      <TouchableOpacity 
                        key={auth} 
                        style={styles.radioOption}
                        onPress={() => setWorkAuthorization(auth)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View style={[styles.radioCircle, workAuthorization === auth && styles.radioCircleActive]} />
                          <Text style={[styles.radioText, workAuthorization === auth && styles.radioTextActive]}>{auth}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Step 4: Referral Process */}
              {createStep === 4 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>How will you handle referrals and support applicants through the hiring process?</Text>
                  
                  <View style={styles.infoCallout}>
                    <Text style={styles.infoCalloutTitle}>🤝 The Power of Referrals</Text>
                    <Text style={styles.infoCalloutText}>
                      Your referral approach helps applicants understand what to expect and increases successful placements.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Referral Method *</Text>
                    <Text style={styles.fieldHint}>How will you submit qualified candidates?</Text>
                    {[
                      { value: 'Direct Referral to Hiring Manager', desc: 'I will personally introduce candidates to the hiring manager' },
                      { value: 'Submit Through Company Portal', desc: 'I will submit candidates through our internal system' },
                      { value: 'Forward Resume to Recruiter', desc: 'I will forward resumes to our recruiting team' }
                    ].map((process) => (
                      <TouchableOpacity 
                        key={process.value} 
                        style={styles.radioOptionWithDesc}
                        onPress={() => setReferralProcess(process.value)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioLeft}>
                          <View style={[styles.radioCircle, referralProcess === process.value && styles.radioCircleActive]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.radioText, referralProcess === process.value && styles.radioTextActive]}>
                              {process.value}
                            </Text>
                            <Text style={styles.radioDescription}>{process.desc}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Can you provide a referral? *</Text>
                    <Text style={styles.fieldHint}>Confirming your ability to refer increases applicant confidence</Text>
                    <View style={styles.sideBySide}>
                      <TouchableOpacity 
                        style={styles.halfOption}
                        onPress={() => setCanProvideReferral(true)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, canProvideReferral === true && styles.radioCircleActive]} />
                        <Text style={[styles.radioText, canProvideReferral === true && styles.radioTextActive]}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.halfOption}
                        onPress={() => setCanProvideReferral(false)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, canProvideReferral === false && styles.radioCircleActive]} />
                        <Text style={[styles.radioText, canProvideReferral === false && styles.radioTextActive]}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                </Animated.View>
              )}

              {/* Step 5: Review */}
              {createStep === 5 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>Review your job posting details</Text>
                  <View style={styles.reviewCard}>
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>JOB DETAILS</Text>
                      <Text style={styles.reviewValue}>{jobTitle}</Text>
                      <Text style={styles.reviewSubValue}>{company} • {location}</Text>
                    </View>
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>EMPLOYMENT</Text>
                      <Text style={styles.reviewValue}>{employmentType} • {experienceLevel}</Text>
                      {salary && <Text style={styles.reviewSubValue}>{salary}</Text>}
                    </View>
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>REQUIREMENTS</Text>
                      <View style={styles.reviewSkills}>
                        {requiredSkills.map((skill, idx) => (
                          <View key={idx} style={styles.reviewSkillBadge}>
                            <Text style={styles.reviewSkillText}>{skill}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.reviewSubValue}>{workAuthorization}</Text>
                    </View>
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>REFERRAL PROCESS</Text>
                      <Text style={styles.reviewValue}>{referralProcess}</Text>
                      <Text style={styles.reviewSubValue}>Can provide referral: {canProvideReferral ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Step 6: BackChannel Insights */}
              {createStep === 6 && (
                <Animated.View entering={FadeIn}>
                  <Text style={styles.modalSubTitle}>Share the inside story that candidates won't find anywhere else</Text>
                  
                  <View style={styles.backchannelCallout}>
                    <Text style={styles.backchannelTitle}>💡 Why BackChannel Insights Matter</Text>
                    <Text style={styles.backchannelText}>
                      Unlike traditional job boards, BackChannel gives you the opportunity to share the real story behind the role. This insider knowledge helps attract the right candidates and sets clear expectations from day one.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>The Real Day-to-Day</Text>
                    <Text style={styles.fieldHint}>What does this role actually look like beyond the job description?</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Be honest about the daily work. Example: 'You'll spend mornings in collaborative planning, afternoons in deep work. Expect 2-3 hours of meetings weekly, mostly async. Some weeks are heads-down coding, others are high-touch with stakeholders...'"
                      placeholderTextColor="#999"
                      value={dayToDay}
                      onChangeText={setDayToDay}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Team Culture & Dynamics</Text>
                    <Text style={styles.fieldHint}>Give candidates a real sense of who they'll be working with</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Example: 'Team of 6 senior engineers, we value mentorship and collaboration over ego. Very flexible on remote work - many of us WFH 3-4 days/week. We do quarterly offsites and have a no-weekend-work policy...'"
                      placeholderTextColor="#999"
                      value={teamCulture}
                      onChangeText={setTeamCulture}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Who Actually Thrives Here</Text>
                    <Text style={styles.fieldHint}>What matters more than what's on the resume?</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Example: 'We need someone comfortable with ambiguity who can own projects end-to-end. Strong communication beats perfect technical skills - we can teach the tech stack. Previous startup experience is a plus but not required...'"
                      placeholderTextColor="#999"
                      value={idealCandidate}
                      onChangeText={setIdealCandidate}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.fieldLabel}>Everything Else Worth Knowing (Optional)</Text>
                    <Text style={styles.fieldHint}>Interview process, growth opportunities, or anything else candidates should know</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Example: 'Interview is 3 rounds over 2 weeks - intro call, technical deep-dive, team fit. We're planning to 2x the team this year. Clear promotion path to Staff in 18-24 months. Comp is competitive but we're not top-of-market...'"
                      placeholderTextColor="#999"
                      value={insiderInsights}
                      onChangeText={setInsiderInsights}
                      multiline
                      numberOfLines={5}
                    />
                  </View>
                </Animated.View>
              )}

              {/* Step 7: Success */}
              {createStep === 7 && (
                <Animated.View entering={FadeIn} style={styles.successStep}>
                  <View style={styles.successIcon}>
                    <CheckCircle size={60} color="#00CB54" />
                  </View>
                  <Text style={styles.successTitle}>Job Posted Successfully!</Text>
                  <Text style={styles.successDesc}>
                    Your job posting for {jobTitle} is now live and visible to applicants on the job board.
                  </Text>
                </Animated.View>
              )}
            </ScrollView>

            {/* Navigation Buttons */}
            {createStep < 7 && (
              <View style={styles.navigationButtons}>
                {createStep > 1 && createStep < 6 && (
                  <TouchableOpacity 
                    style={styles.backNavBtn}
                    onPress={() => {
                      setCreateStep(createStep - 1);
                      setTimeout(() => scrollToTop(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft color="#000" size={20} />
                    <Text style={styles.backNavText}>Back</Text>
                  </TouchableOpacity>
                )}
                {createStep < 6 ? (
                  <TouchableOpacity 
                    style={[
                      styles.nextBtn,
                      createStep === 1 && !canProceedStep1 && styles.confirmBtnDisabled,
                      createStep === 2 && !canProceedStep2 && styles.confirmBtnDisabled,
                      createStep === 3 && !canProceedStep3 && styles.confirmBtnDisabled,
                      createStep === 4 && !canProceedStep4 && styles.confirmBtnDisabled,
                      createStep === 1 && { flex: 1 }
                    ]}
                    disabled={
                      (createStep === 1 && !canProceedStep1) ||
                      (createStep === 2 && !canProceedStep2) ||
                      (createStep === 3 && !canProceedStep3) ||
                      (createStep === 4 && !canProceedStep4)
                    }
                    onPress={() => {
                      setCreateStep(createStep + 1);
                      setTimeout(() => scrollToTop(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmBtnText}>Continue</Text>
                    <ChevronRight color="#FFF" size={20} />
                  </TouchableOpacity>
                ) : createStep === 6 ? (
                  <>
                    <TouchableOpacity 
                      style={styles.backNavBtn}
                      onPress={() => {
                        setCreateStep(5);
                        setTimeout(() => scrollToTop(), 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft color="#000" size={20} />
                      <Text style={styles.backNavText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.nextBtn]}
                      onPress={() => {
                        setCreateStep(7);
                        setTimeout(() => scrollToTop(), 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.confirmBtnText}>Publish Job</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {createStep === 7 && (
              <TouchableOpacity 
                style={styles.confirmBtn}
                onPress={closeCreateModal}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmBtnText}>Back to Job Board</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal visible={!!menuJob} transparent animationType="fade" onRequestClose={() => setMenuJob(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setMenuJob(null)}
          >
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalMainTitle}>Job Options</Text>
              <TouchableOpacity onPress={() => setMenuJob(null)} style={styles.closeButton}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 10, marginTop: 8 }}>
               <TouchableOpacity 
                 style={styles.menuOptionCard} 
                 onPress={() => setMenuJob(null)}
                 activeOpacity={0.7}
               >
                  <View style={styles.menuIconContainer}>
                    <Share size={18} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuOptionTitle}>Share Job</Text>
                    <Text style={styles.menuOptionDesc}>Send this opportunity to others</Text>
                  </View>
               </TouchableOpacity>
               
               <TouchableOpacity 
                 style={styles.menuOptionCard} 
                 onPress={() => setMenuJob(null)}
                 activeOpacity={0.7}
               >
                  <View style={styles.menuIconContainer}>
                    <ThumbsDown size={18} color="#666" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuOptionTitle}>Not Interested</Text>
                    <Text style={styles.menuOptionDesc}>Hide this job from your feed</Text>
                  </View>
               </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Job Details Modal */}
      <Modal visible={!!viewJobDetails} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setViewJobDetails(null)}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {viewJobDetails && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Job Header */}
                <View style={styles.jobModalHeader}>
                  <Image source={{ uri: viewJobDetails.image }} style={styles.jobModalImage} />
                  <View style={styles.jobModalInfo}>
                    <Text style={styles.jobModalCompany}>{viewJobDetails.company}</Text>
                    <Text style={styles.jobModalTitle}>{viewJobDetails.title}</Text>
                    <View style={styles.jobModalMeta}>
                      <View style={styles.jobModalMetaItem}>
                        <MapPin size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>{viewJobDetails.location}</Text>
                      </View>
                      <View style={styles.jobModalMetaItem}>
                        <DollarSign size={12} color="#999" />
                        <Text style={styles.jobModalMetaText}>{viewJobDetails.salary}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setViewJobDetails(null)} style={styles.closeButton}>
                    <X color="#000" size={24} />
                  </TouchableOpacity>
                </View>

                {/* Job Description */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>About the Role</Text>
                  <Text style={styles.jobSectionText}>{viewJobDetails.description}</Text>
                </View>

                {/* Skills */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Required Skills</Text>
                  <View style={styles.skillsContainer}>
                    {viewJobDetails.skills.map((skill, i) => (
                      <View key={i} style={styles.skillChip}>
                        <Text style={styles.skillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Benefits */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Benefits</Text>
                  {viewJobDetails.benefits.map((benefit, i) => (
                    <View key={i} style={styles.benefitRow}>
                      <CheckCircle size={14} color="#00CB54" />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>

                {/* Job Sponsors Section */}
                <View style={styles.jobSection}>
                  <Text style={styles.jobSectionTitle}>Job Sponsors</Text>
                  <View style={{ gap: 12 }}>
                    {viewJobDetails.currentSponsors.map((sponsor, i) => (
                      <View key={i} style={styles.sponsorInfoCard}>
                        <View style={styles.sponsorCardContent}>
                          <Image source={{ uri: sponsor.image }} style={styles.sponsorCardAvatar} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sponsorCardName}>{sponsor.name}</Text>
                            <Text style={styles.sponsorCardRole}>{sponsor.role}</Text>
                          </View>
                          {sponsor.canRefer && (
                            <View style={styles.canReferBadge}>
                              <CheckCircle size={12} color="#00CB54" />
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity 
                  style={styles.applyBtnLarge} 
                  onPress={() => {
                    const jobToSponsor = viewJobDetails;
                    setViewJobDetails(null);
                    setTimeout(() => {
                       if (jobToSponsor) handleOpenModal(jobToSponsor);
                    }, 50);
                  }}
                >
                  <Zap color="#FFF" size={20} fill="#FFF" />
                  <Text style={styles.applyBtnLargeText}>Sponsor</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Refine Feed</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.filterCloseModalBtn}>
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.filterModalContent}>
              {FILTER_OPTIONS.map((section) => (
                <View key={section.id} style={styles.filterSection}>
                  <Text style={styles.filterLabel}>{section.label}</Text>
                  <View style={styles.filterOptionsRow}>
                    {section.options.map((opt) => {
                       const isSelected = (selectedFilters[section.id] || []).includes(opt);
                       return (
                         <TouchableOpacity 
                           key={opt}
                           style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                           onPress={() => toggleFilter(section.id, opt)}
                           activeOpacity={0.8}
                         >
                           <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                             {opt}
                           </Text>
                         </TouchableOpacity>
                       );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.filterModalFooter}>
              <TouchableOpacity 
                style={styles.filterApplyBtn} 
                onPress={() => setShowFilters(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterApplyBtnText}>Show Results</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.filterClearBtn} 
                onPress={() => setSelectedFilters({})}
              >
                <Text style={styles.filterClearBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </BlurView>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedApplicantJob}
        onRequestClose={() => setSelectedApplicantJob(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setSelectedApplicantJob(null)}
          >
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.modalContent, { maxHeight: '60%' }]}>
             <View style={styles.modalHandle} />
             <View style={styles.modalHeader}>
               <Text style={styles.modalMainTitle}>Top Applicants</Text>
               <TouchableOpacity onPress={() => setSelectedApplicantJob(null)} style={styles.closeButton}>
                 <X color="#000" size={24} />
               </TouchableOpacity>
             </View>
             
             <ScrollView contentContainerStyle={{paddingBottom: 20}} showsVerticalScrollIndicator={false}>
                 {selectedApplicantJob?.topApplicants?.map((applicant, i) => (
                    <View key={i} style={styles.applicantRow}>
                       <Image source={{uri: applicant.image}} style={styles.applicantAvatar} />
                       <View style={{flex: 1}}>
                          <Text style={styles.applicantName}>{applicant.name}</Text>
                          <Text style={styles.applicantRole}>{applicant.role} @ {applicant.company}</Text>
                       </View>
                       <TouchableOpacity 
                         style={styles.messageApplicantBtn}
                         onPress={(e) => {
                           e.stopPropagation();
                           setSelectedApplicantJob(null);
                           setTimeout(() => {
                             setSelectedApplicantForMessage(applicant);
                           }, 100);
                         }}
                         activeOpacity={0.7}
                       >
                          <MessageCircle color="#FFF" size={16} strokeWidth={2.5} />
                       </TouchableOpacity>
                    </View>
                 ))}
                 {(!selectedApplicantJob?.topApplicants || selectedApplicantJob.topApplicants.length === 0) && (
                    <View style={{padding: 20, alignItems: 'center'}}>
                       <Text style={{textAlign: 'center', color: '#999', fontSize: 16}}>No applicants data available.</Text>
                    </View>
                 )}
             </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!showSponsorGate}
        onRequestClose={() => setShowSponsorGate(null)}
      >
        <View style={styles.gateModalOverlay}>
           <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={() => setShowSponsorGate(null)}
           >
              <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
           </TouchableOpacity>
           
           <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.gateModalContent}>
               <TouchableOpacity 
                 style={styles.gateCloseBtn} 
                 onPress={() => setShowSponsorGate(null)}
               >
                 <X color="#666" size={20} />
               </TouchableOpacity>
               
               <View style={styles.gateIconContainer}>
                  <Lock size={32} color="#000" />
               </View>
               <Text style={styles.gateTitle}>Sponsor to View</Text>
               <Text style={styles.gateDesc}>You must be a sponsor of this job listing to view the full applicant list.</Text>
               
               <View style={styles.gateActions}>
                  <TouchableOpacity 
                    style={styles.gateBtnPrimary}
                    onPress={() => {
                       const job = showSponsorGate;
                       setShowSponsorGate(null);
                       if(job) handleOpenModal(job);
                    }}
                  >
                     <Text style={styles.gateBtnPrimaryText}>Sponsor Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.gateBtnSecondary}
                    onPress={() => setShowSponsorGate(null)}
                  >
                     <Text style={styles.gateBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
               </View>
           </Animated.View>
        </View>
      </Modal>

      {/* Applicant Messaging Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedApplicantForMessage}
        onRequestClose={() => {
          setSelectedApplicantForMessage(null);
          setMessage("");
          setActiveSlide(0);
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => {
              setSelectedApplicantForMessage(null);
              setMessage("");
              setActiveSlide(0);
            }}
          >
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {selectedApplicantForMessage && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.jobRefTag}>
                  <Text style={styles.jobRefLabel}>INTERESTED IN</Text>
                  <View style={styles.jobRefBadge}>
                    <Briefcase size={12} color="#000" />
                    <Text style={styles.jobRefText}>{selectedApplicantForMessage.appliedRole}</Text>
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
                        <Image source={{ uri: selectedApplicantForMessage.image }} style={styles.modalAvatar} />
                        <View>
                          <Text style={styles.modalName}>{selectedApplicantForMessage.name}</Text>
                          <View style={styles.locationRow}><MapPin size={12} color="#AAA" /><Text style={styles.locationText}>New York, NY</Text></View>
                        </View>
                      </View>
                      <Text style={styles.bioText} numberOfLines={3}>Senior {selectedApplicantForMessage.role} with a focus on scaling user-centric products at {selectedApplicantForMessage.company}.</Text>
                      <View style={styles.skillsContainer}>
                        {selectedApplicantForMessage.skills.map((s, i) => (
                          <View key={i} style={styles.skillChip}><Text style={styles.skillText}>{s}</Text></View>
                        ))}
                      </View>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}><Award size={14} color="#000" /><Text style={styles.statLabel}>{selectedApplicantForMessage.experience}</Text></View>
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
                      
                      {selectedApplicantForMessage.insights && (
                        <View style={styles.insightSection}>
                          <Text style={styles.insightLabel}>QUICK HIT</Text>
                          <Text style={styles.insightContent}>{selectedApplicantForMessage.insights.funFact}</Text>
                        </View>
                      )}

                      {selectedApplicantForMessage.prompts?.map((prompt, idx) => (
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
                <Animated.View entering={FadeInUp} style={{ marginTop: 24 }}>
                  <Text style={styles.inputLabel}>Quick Reply</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.replyScroll} contentContainerStyle={{ gap: 8 }}>
                    {["Nice to meet you!", "Great profile!", "Let's chat!", "Impressive background!"].map((r, i) => (
                      <TouchableOpacity key={i} style={styles.replyChip} onPress={() => setMessage(r)}>
                        <Text style={styles.replyChipText}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.inputWrapper}>
                    <TextInput 
                      style={styles.messageInput} 
                      placeholder="Write a message..." 
                      value={message} 
                      onChangeText={setMessage} 
                      multiline 
                    />
                    <TouchableOpacity 
                      style={styles.sendBtn} 
                      onPress={() => {
                        setSelectedApplicantForMessage(null);
                        setMessage("");
                        setActiveSlide(0);
                      }}
                    >
                      <Send color="#FFF" size={18} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function JobCard({ job, isSponsored, onSponsor, onPress, onMenu, onApplicantPress }: { job: JobPosting; isSponsored?: boolean; onSponsor?: () => void; onPress?: () => void; onMenu?: () => void; onApplicantPress?: () => void }) {
    return (
      <TouchableOpacity 
        style={[styles.card, styles.cardShadow, isSponsored && styles.sponsoredCardBorder]} 
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Image source={typeof job.logo === 'string' ? { uri: job.logo } : job.logo} style={styles.companyLogo} />
            <View style={styles.headerInfo}>
              <Text style={styles.companyName}>{job.company}</Text>
              <Text style={styles.jobTitleText} numberOfLines={1}>{job.title}</Text>
            </View>
            <TouchableOpacity 
              style={styles.moreBtn} 
              onPress={(e) => {
                e.stopPropagation();
                onMenu && onMenu();
              }}
              activeOpacity={0.7}
            >
              <MoreHorizontal color="#999" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <MapPin size={10} color="#666" />
              <Text style={styles.tagText}>{job.location}</Text>
            </View>
            <View style={styles.tag}>
              <DollarSign size={10} color="#666" />
              <Text style={styles.tagText}>{job.salary}</Text>
            </View>
          </View>

          <Text style={styles.cardDescription} numberOfLines={2}>{job.description}</Text>

          <View style={styles.cardFooter}>
            <View style={styles.applicantInfo}>
              <TouchableOpacity onPress={onApplicantPress} activeOpacity={0.7} style={styles.applicantBadge}>
                <Users color="#000" size={12} />
                <Text style={styles.applicantText}>{job.applicants} Applicants</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                onSponsor && onSponsor();
              }} 
              disabled={isSponsored}
              style={[
                styles.cardSponsorBtn, 
                isSponsored ? styles.cardSponsorBtnActive : styles.cardSponsorBtnDefault
              ]}
            >
               {isSponsored && <Zap size={14} color="#FFF" fill="#FFF" style={{marginRight: 4}} />}
               <Text style={[styles.cardSponsorBtnText, isSponsored ? styles.textWhite : styles.textBlack]}>
                  {isSponsored ? "Sponsoring" : "Sponsor"}
               </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 20 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  title: { fontSize: 32, fontWeight: "800", color: "#000", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#666", marginTop: 6, fontWeight: "500" },
  
  createButton: { backgroundColor: "#000", flexDirection: "row", height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  createButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  listSectionTitle: { fontSize: 13, fontWeight: "800", color: "#999", letterSpacing: 1.2, textTransform: "uppercase", paddingLeft: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#000' },
  filterBadge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#F5F5F5' },

  // Filter Modal Styles (copied 1:1 from HomeView)
  filterModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterModalTitle: { fontSize: 24, fontWeight: '800', color: '#000', letterSpacing: -0.5 },
  filterCloseModalBtn: { padding: 4, backgroundColor: '#F5F5F5', borderRadius: 20 },
  filterModalContent: { padding: 28, paddingBottom: 40 },
  filterSection: { marginBottom: 32 },
  filterLabel: { fontSize: 12, fontWeight: '800', color: '#999', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  filterOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  filterChipSelected: { backgroundColor: '#000', borderColor: '#000' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#000' },
  filterChipTextSelected: { color: '#FFF' },
  filterModalFooter: { padding: 28, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 16 },
  filterApplyBtn: { backgroundColor: '#000', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  filterApplyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  filterClearBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  filterClearBtnText: { color: '#000', fontSize: 14, fontWeight: '600' },
  sponsoredHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 32, marginBottom: 16, paddingLeft: 4 },
  
  card: { backgroundColor: "#FFF", borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: "#EFEFEF" },
  sponsoredCardBorder: { borderColor: "#E0E0E0", borderWidth: 1 },
  cardShadow: { ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 30 }, android: { elevation: 18 } }) },
  
  cardCoverInfo: { display: 'none' },
  cardContent: { padding: 24, paddingTop: 26 },
  
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  companyLogo: { width: 60, height: 60, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0F0F0' },
  headerInfo: { flex: 1 },
  companyName: { fontSize: 13, fontWeight: "700", color: "#666", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  jobTitleText: { fontSize: 18, fontWeight: "800", color: "#000", letterSpacing: -0.5 },
  moreBtn: { padding: 12, margin: -8, alignSelf: 'flex-start' },
  
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8F9FA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  tagText: { fontSize: 12, fontWeight: "600", color: "#444" },
  cardDescription: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 16 },
  
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  applicantInfo: { flexDirection: "row", alignItems: "center" },
  applicantBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  applicantText: { fontSize: 12, fontWeight: "700", color: "#000" },
  
  cardSponsorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, minWidth: 100 },
  cardSponsorBtnDefault: { backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#000" },
  cardSponsorBtnActive: { backgroundColor: '#000', borderWidth: 1.5, borderColor: "#000" },
  cardSponsorBtnText: { fontSize: 13, fontWeight: "700" },
  textBlack: { color: "#000" },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalMainTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  closeButton: { padding: 4 },
  modalSubTitle: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 32 },
  formSection: { marginBottom: 24 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 },
  radioOption: { backgroundColor: '#F9F9F9', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#EEE', marginBottom: 12 },
  radioLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCC' },
  radioCircleActive: { borderColor: '#000', borderWidth: 6 },
  radioText: { fontSize: 15, color: '#666', fontWeight: '600' },
  radioTextActive: { color: '#000', fontWeight: '600' },
  sideBySide: { flexDirection: 'row', gap: 12 },
  halfOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE' },
  confirmBtn: { backgroundColor: '#000', paddingVertical: 18, borderRadius: 18, alignItems: 'center', width: '100%' },
  confirmBtnDisabled: { backgroundColor: '#E5E5E5' },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  textWhite: { color: '#FFF' },
  successStep: { alignItems: 'center', paddingVertical: 20, width: '100%' },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  successDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 20 },
  createModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 40, width: '100%', maxHeight: '90%' },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E5E5' },
  stepDotActive: { backgroundColor: '#000', width: 24 },
  createScrollView: { maxHeight: 420 },
  textInput: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE', borderRadius: 12, padding: 16, fontSize: 15, color: '#000' },
  skillsInput: { minHeight: 50 },
  multilineInput: { minHeight: 100, textAlignVertical: 'top', paddingTop: 16 },
  skillsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  previewSkillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  previewSkillText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  skillsTagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  skillTagActive: { backgroundColor: '#000', borderColor: '#000' },
  skillTagText: { fontSize: 13, fontWeight: '600', color: '#666' },
  skillTagTextActive: { color: '#FFF' },
  backchannelCallout: { backgroundColor: '#F0F0F0', padding: 20, borderRadius: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#000' },
  backchannelTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 8 },
  backchannelText: { fontSize: 14, color: '#555', lineHeight: 22 },
  reviewCard: { backgroundColor: '#F9F9F9', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EEE' },
  reviewSection: { marginBottom: 20 },
  reviewLabel: { fontSize: 11, fontWeight: '900', color: '#999', marginBottom: 6, letterSpacing: 0.5 },
  reviewValue: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  reviewSubValue: { fontSize: 14, color: '#666' },
  reviewSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reviewSkillBadge: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5E5' },
  reviewSkillText: { fontSize: 12, fontWeight: '700', color: '#000' },
  navigationButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  backNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 18 },
  backNavText: { fontSize: 16, fontWeight: '700', color: '#000' },
  nextBtn: { flex: 1, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18 },
  infoCallout: { backgroundColor: '#F0F0F0', padding: 20, borderRadius: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#000' },
  infoCalloutTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 8 },
  infoCalloutText: { fontSize: 14, color: '#555', lineHeight: 22 },
  fieldHint: { fontSize: 13, color: '#999', marginBottom: 12, lineHeight: 18 },
  radioOptionWithDesc: { backgroundColor: '#F9F9F9', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EEE', marginBottom: 12 },
  radioDescription: { fontSize: 12, color: '#999', marginTop: 4, lineHeight: 18 },
  supportOptions: { backgroundColor: '#F9F9F9', padding: 16, borderRadius: 12, gap: 12 },
  supportItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  supportText: { fontSize: 14, color: '#666', fontWeight: '600', flex: 1 },

  // Menu Modal
  menuOptionCard: { backgroundColor: '#F8F9FB', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#EEE' },
  menuIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  menuOptionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  menuOptionDesc: { fontSize: 13, color: '#666', fontWeight: '500' },
  
  // Modal
  modalHandle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
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

  // Applicant Modal
  applicantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  applicantAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEE' },
  applicantName: { fontSize: 16, fontWeight: '700', color: '#000' },
  applicantRole: { fontSize: 13, color: '#666', marginTop: 2 },
  messageApplicantBtn: { backgroundColor: '#000', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  matchScoreBadge: { backgroundColor: '#F0F9F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchScoreText: { color: '#006633', fontWeight: '800', fontSize: 12 },
  
  // Swipeable Card Modal Styles (from MatchesView)
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
  
  // Message Modal
  messageModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 8 },
  messageModalAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE' },
  messageModalName: { fontSize: 18, fontWeight: '800', color: '#000' },
  messageModalRole: { fontSize: 14, color: '#666', marginTop: 2 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#BBB', textTransform: 'uppercase', marginBottom: 10 },
  replyScroll: { marginBottom: 15, marginHorizontal: -28, paddingHorizontal: 28 },
  replyChip: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#000', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  replyChipText: { fontWeight: '700', fontSize: 13 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 20, padding: 8 },
  messageInput: { flex: 1, padding: 10, fontSize: 15, maxHeight: 80 },
  sendBtn: { backgroundColor: '#000', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Gate Modal
  gateModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  gateModalContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: {height: 10, width: 0}, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  gateCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  gateIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  gateTitle: { fontSize: 22, fontWeight: '900', color: '#000', marginBottom: 12, textAlign: 'center' },
  gateDesc: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  gateActions: { width: '100%', gap: 12 },
  gateBtnPrimary: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 16, alignItems: 'center', width: '100%' },
  gateBtnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  gateBtnSecondary: { paddingVertical: 12, alignItems: 'center' },
  gateBtnSecondaryText: { color: '#666', fontSize: 15, fontWeight: '600' },
});