import {
  trackJobCardViewed,
  trackJobLiked,
  trackJobSkipped,
  trackJobWaitlistJoined,
  trackMatchCreated,
  trackProfileCardViewed,
  trackProfileLiked,
  trackProfileSkipped,
  trackSponsorRequested,
  trackTesterModeEnabled,
} from "@/lib/analytics/mixpanel";
import {
  fetchJobsPack,
  fetchProfilesPack,
  getMyJobs,
  getPublicProfile,
  joinWaitlist,
  likeJob,
  likeProfile,
  recordJobFeedAction,
  recordProfileFeedAction,
  requestSponsorForJob,
} from "@/lib/api";
import { authApi } from "@/lib/auth-api";
import { transformJobApiResponse, type JobApiResponse } from "@/types/jobs";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import {
  Award,
  BellRing,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  DollarSign,
  Globe,
  Heart,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { tokens } from "@/constants/theme";
import { useJobsStore } from "../stores/useJobsStore";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import { ProfileCompletionModal } from "./ProfileCompletionModal";
import { CompanyLogo } from "./ui/CompanyLogo";
import { DismissibleSheet } from "./ui/DismissibleSheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface HomeViewProps {
  userType: "applicant" | "sponsor";
  onNavigateToProfile?: () => void;
  /**
   * Shared value that drives the floating bottom nav bar's translateY in
   * MainApp. HomeView writes to it on scroll so the bar slides off-screen
   * as the user scrolls into a profile (revealing the sticky Pass/Connect
   * action bar) and reappears when they return to the top. Optional so
   * HomeView can still render standalone without breaking.
   */
  navTranslateY?: import("react-native-reanimated").SharedValue<number>;
  /**
   * Companion shared value for the TOP header (progress bar + role
   * switcher). Mirrors `navTranslateY` but moves the header upward
   * off-screen as the user scrolls down, reappearing when they return
   * to the top. HomeView writes to both from the same scroll handler so
   * header (up) and nav (down) move in sync.
   */
  headerTranslateY?: import("react-native-reanimated").SharedValue<number>;
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
    yearsExperience: "8+ years",
    skills: ["UI/UX Design", "Design Systems", "Figma", "Product Strategy"],
    desiredRole: "Chief Design Officer",
    insights: {
      funFact: "Collects vintage typewriters from the 1920s.",
      mentality: "The best interface is no interface at all.",
    },
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Being the 'No' person in product meetings—keeping us focused on what matters.",
        icon: <Check size={14} color={tokens.colors.text} />,
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A micro-loan app that helped 50k+ small businesses in SE Asia.",
        icon: <Award size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "VP of Design",
          company: "ZenPay",
          startDate: "Jan 2022",
          current: true,
          description:
            "Leading product design for fintech platform serving 2M+ users across Asia-Pacific.",
        },
        {
          jobTitle: "Design Lead",
          company: "Square",
          startDate: "Mar 2019",
          endDate: "Dec 2021",
          description:
            "Scaled the Cash App design system globally. Managed team of 12 designers.",
        },
      ],
      education: [
        {
          degree: "MFA",
          major: "Interaction Design",
          university: "Tokyo University of the Arts",
          graduationYear: "2018",
        },
      ],
      achievements:
        "AIGA Medalist; Keynote speaker at Config 2023; Featured in WIRED's 'Design Leaders to Watch'",
      certifications: [
        {
          name: "Design Leadership Certificate",
          organization: "IDEO U",
          year: "2021",
        },
      ],
      languages: [
        { language: "Japanese", proficiency: "Native" },
        { language: "English", proficiency: "Fluent" },
      ],
    },
  },
  {
    id: 2,
    name: "Liam O'Shea",
    role: "Founding Engineer",
    company: "Terraform AI",
    location: "Seattle, WA",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800",
    bio: "Building autonomous reforestation drones. Obsessed with low-level systems and environmental impact.",
    yearsExperience: "12+ years",
    skills: ["C++", "Embedded Systems", "Rust", "Robotics"],
    desiredRole: "VP of Engineering",
    insights: {
      funFact:
        "Lived off-grid in a solar-powered van for two years while building his first startup.",
      mentality: "Efficiency is the only sustainable path forward.",
    },
    prompts: [
      {
        question: "MY SECRET SUPERPOWER",
        answer: "Optimizing C++ code until it runs on a potato.",
        icon: <Zap size={14} color={tokens.colors.text} />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a park ranger in the North Cascades.",
        icon: <Globe size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "Founding Engineer",
          company: "Terraform AI",
          startDate: "Jun 2021",
          current: true,
          description:
            "Building autonomous reforestation drone systems. Leading embedded systems architecture.",
        },
        {
          jobTitle: "Senior Flight Software Engineer",
          company: "SpaceX",
          startDate: "Jan 2015",
          endDate: "May 2021",
          description:
            "Led embedded systems team for Starlink constellation. Developed thermal regulation systems.",
        },
      ],
      education: [
        {
          degree: "B.S.",
          major: "Aerospace Engineering",
          university: "Georgia Tech",
          graduationYear: "2014",
          gpa: "3.9",
        },
      ],
      achievements:
        "Patented thermal regulation system for micro-satellites; Published 5+ papers on embedded systems optimization",
      certifications: [
        {
          name: "Professional Engineer (PE)",
          organization: "Washington State",
          year: "2017",
        },
      ],
      languages: [{ language: "English", proficiency: "Native" }],
    },
  },
  {
    id: 3,
    name: "Ethan Sterling",
    role: "General Partner",
    company: "Bridge Ventures",
    location: "New York, NY",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800",
    bio: "Investing in the next generation of 'unsexy' software. Logistics, supply chain, and insurance tech.",
    yearsExperience: "15+ years",
    skills: ["Venture Capital", "Operations", "B2B SaaS", "Growth Strategy"],
    desiredRole: "Managing Partner",
    insights: {
      funFact: "Has run a marathon on every continent (including Antarctica).",
      mentality: "I bet on the person, not just the deck.",
    },
    prompts: [
      {
        question: "MY FAVORITE BRAINSTORMING FUEL",
        answer: "A 5am run followed by a very cold brew.",
        icon: <Coffee size={14} color={tokens.colors.text} />,
      },
      {
        question: "WHAT I LOOK FOR IN TALENT",
        answer: "High agency. I want people who don't wait for permission.",
        icon: <Sparkles size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "General Partner",
          company: "Bridge Ventures",
          startDate: "Jan 2018",
          current: true,
          description:
            "Leading investments in B2B SaaS, logistics, and supply chain technology. 20+ portfolio companies.",
        },
        {
          jobTitle: "Founder & CEO",
          company: "LogiFlow (Acquired by FedEx)",
          startDate: "Mar 2010",
          endDate: "Dec 2017",
          description:
            "Built logistics optimization platform serving 500+ enterprise clients. Acquired for $140M.",
        },
      ],
      education: [
        {
          degree: "B.A.",
          major: "Economics",
          university: "Yale University",
          graduationYear: "2009",
        },
      ],
      achievements:
        "Forbes Midas List 'One to Watch'; Seed investor in 3 unicorns (combined valuation $15B+)",
      certifications: [],
      languages: [{ language: "English", proficiency: "Native" }],
    },
  },
  {
    id: 4,
    name: "Zoe Castillo",
    role: "E-sports Strategy Lead",
    company: "Riot Games",
    location: "Los Angeles, CA",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
    bio: "Building the future of competitive gaming. Bridging the gap between entertainment and pro sports.",
    yearsExperience: "6+ years",
    skills: [
      "Community Management",
      "Event Production",
      "Analytics",
      "Partnerships",
    ],
    desiredRole: "VP of Esports",
    insights: {
      funFact: "Was a top-500 ranked Overwatch player in college.",
      mentality: "Community is the only moat that lasts.",
    },
    prompts: [
      {
        question: "MY SECRET SUPERPOWER",
        answer:
          "Spotting trends in Gen-Z behavior before they hit the mainstream.",
        icon: <Zap size={14} color={tokens.colors.text} />,
      },
      {
        question: "ONE THING THAT SURPRISED ME",
        answer:
          "How much 'traditional' sports can learn from e-sports production.",
        icon: <Info size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "E-sports Strategy Lead",
          company: "Riot Games",
          startDate: "Feb 2020",
          current: true,
          description:
            "Building competitive gaming strategy. Managing global tournament operations and community engagement.",
        },
        {
          jobTitle: "Esports Analyst",
          company: "ESPN",
          startDate: "Jun 2018",
          endDate: "Jan 2020",
          description:
            "Covered professional gaming. Produced digital content for 5M+ monthly viewers.",
        },
      ],
      education: [
        {
          degree: "B.A.",
          major: "Digital Media",
          university: "USC",
          graduationYear: "2018",
        },
      ],
      achievements:
        "Emmy for Outstanding Interactive Experience in Sports; Top 500 Overwatch player globally",
      certifications: [],
      languages: [
        { language: "English", proficiency: "Native" },
        { language: "Korean", proficiency: "Conversational" },
      ],
    },
  },
  {
    id: 5,
    name: "Dr. Kofi Aris",
    role: "Security Researcher",
    company: "Cloudflare",
    location: "Berlin, Germany",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800",
    bio: "White-hat hacker focused on post-quantum cryptography. Making the internet a safer place, one bug at a time.",
    yearsExperience: "10+ years",
    skills: [
      "Cryptography",
      "Penetration Testing",
      "Network Security",
      "Python",
    ],
    desiredRole: "Chief Security Officer",
    insights: {
      funFact:
        "Discovered a critical zero-day exploit in a major browser while on vacation.",
      mentality: "Trust, but verify. Then verify again.",
    },
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer: "Breaking things so that they can be built back stronger.",
        icon: <Check size={14} color={tokens.colors.text} />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a locksmith. It's the same logic, just physical.",
        icon: <Briefcase size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "Security Researcher",
          company: "Cloudflare",
          startDate: "Aug 2019",
          current: true,
          description:
            "Leading post-quantum cryptography research. Discovered 15+ critical vulnerabilities.",
        },
        {
          jobTitle: "Senior Security Consultant",
          company: "Government Cybersecurity Agency",
          startDate: "Jan 2013",
          endDate: "Jul 2019",
          description:
            "Advised national security infrastructure. Led penetration testing for critical systems.",
        },
      ],
      education: [
        {
          degree: "PhD",
          major: "Cryptography",
          university: "TU Berlin",
          graduationYear: "2012",
        },
      ],
      achievements:
        "BlackHat Speaker; Top 10 Bug Bounty Hunter globally; Discovered critical zero-day exploit",
      certifications: [
        { name: "OSCP", organization: "Offensive Security", year: "2014" },
        { name: "CISSP", organization: "ISC2", year: "2015" },
      ],
      languages: [
        { language: "English", proficiency: "Fluent" },
        { language: "German", proficiency: "Native" },
      ],
    },
  },
  {
    id: 6,
    name: "Yuki Tanaka",
    role: "Robotics Engineer",
    company: "Boston Dynamics",
    location: "Boston, MA",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
    bio: "Giving robots a sense of touch. Specialized in haptic feedback and soft robotics.",
    yearsExperience: "7+ years",
    skills: ["ROS", "Computer Vision", "Control Systems", "C++"],
    desiredRole: "Principal Robotics Engineer",
    insights: {
      funFact: "Builds miniature mechanical watches as a hobby.",
      mentality: "Hardware is hard, but that's why it's worth it.",
    },
    prompts: [
      {
        question: "MY SECRET SUPERPOWER",
        answer: "Patience. Tuning a PID loop for 12 hours straight is my zen.",
        icon: <Zap size={14} color={tokens.colors.text} />,
      },
      {
        question: "MY FAVORITE BRAINSTORMING FUEL",
        answer: "Matcha and lo-fi beats.",
        icon: <Coffee size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "Robotics Engineer",
          company: "Boston Dynamics",
          startDate: "Feb 2020",
          current: true,
          description:
            "Designing haptic feedback systems for quadruped robots. Leading soft robotics integration.",
        },
        {
          jobTitle: "Research Engineer",
          company: "Johns Hopkins Applied Physics Laboratory",
          startDate: "Jun 2017",
          endDate: "Jan 2020",
          description:
            "Developed tactile sensors for prosthetic limbs. Published research on haptic perception.",
        },
      ],
      education: [
        {
          degree: "M.S.",
          major: "Robotics",
          university: "Carnegie Mellon University",
          graduationYear: "2017",
          gpa: "3.8",
        },
        {
          degree: "B.S.",
          major: "Mechanical Engineering",
          university: "University of Tokyo",
          graduationYear: "2015",
        },
      ],
      achievements:
        "R&D 100 Award Winner; 12 peer-reviewed publications in robotics journals",
      certifications: [
        {
          name: "ROS Certified Developer",
          organization: "Open Robotics",
          year: "2018",
        },
      ],
      languages: [
        { language: "Japanese", proficiency: "Native" },
        { language: "English", proficiency: "Fluent" },
      ],
    },
  },
  {
    id: 7,
    name: "Sienna Rivera",
    role: "Head of Community",
    company: "Web3 Foundation",
    location: "Miami, FL",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800",
    bio: "Championing decentralized governance. Passionate about ownership and creator economies.",
    yearsExperience: "5+ years",
    skills: ["Community Building", "Discord", "Tokenomics", "Social Media"],
    desiredRole: "Chief Community Officer",
    insights: {
      funFact:
        "Managed a Discord community of 250,000 members for a viral NFT project.",
      mentality: "People > Code.",
    },
    prompts: [
      {
        question: "ONE THING THAT SURPRISED ME",
        answer:
          "How quickly strangers can organize for a common goal when incentives align.",
        icon: <MessageCircle size={14} color={tokens.colors.text} />,
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "Launching a DAO that funded 200+ scholarships for women in tech.",
        icon: <Award size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "Head of Community",
          company: "Web3 Foundation",
          startDate: "Jan 2022",
          current: true,
          description:
            "Building decentralized governance systems. Managing 250k+ member Discord community.",
        },
        {
          jobTitle: "Community Lead",
          company: "Patreon",
          startDate: "Mar 2019",
          endDate: "Dec 2021",
          description:
            "Led creator engagement initiatives. Launched DAO that funded 200+ scholarships.",
        },
      ],
      education: [
        {
          degree: "B.A.",
          major: "Sociology",
          university: "New York University",
          graduationYear: "2019",
        },
      ],
      achievements:
        "Vogue Business 100 Innovators List; Managed viral NFT project with 250k Discord members",
      certifications: [
        {
          name: "Certified Community Manager",
          organization: "CMX",
          year: "2020",
        },
      ],
      languages: [
        { language: "English", proficiency: "Native" },
        { language: "Spanish", proficiency: "Fluent" },
      ],
    },
  },
  {
    id: 8,
    name: "Rahul Mehta",
    role: "Bioinformatics Lead",
    company: "Moderna",
    location: "Cambridge, MA",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    bio: "Using machine learning to accelerate drug discovery. Turning biology into a programmable language.",
    yearsExperience: "9+ years",
    skills: ["Python", "Machine Learning", "Genomics", "Data Science"],
    desiredRole: "Director of Computational Biology",
    insights: {
      funFact:
        "Taught himself to code by writing scripts to analyze his own DNA.",
      mentality: "Data is the most powerful medicine we have.",
    },
    prompts: [
      {
        question: "I'M BEST KNOWN FOR",
        answer:
          "Bridging the gap between 'wet lab' scientists and 'dry lab' engineers.",
        icon: <Globe size={14} color={tokens.colors.text} />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a chef. Chemistry you can eat.",
        icon: <Coffee size={14} color={tokens.colors.text} />,
      },
    ],
    fullDetails: {
      experiences: [
        {
          jobTitle: "Bioinformatics Lead",
          company: "Moderna",
          startDate: "Aug 2021",
          current: true,
          description:
            "Using ML to accelerate mRNA vaccine development. Leading computational biology team.",
        },
        {
          jobTitle: "Research Scientist",
          company: "Broad Institute of MIT and Harvard",
          startDate: "Jun 2015",
          endDate: "Jul 2021",
          description:
            "Led genomic sequencing pipelines. Developed ML models for variant analysis.",
        },
      ],
      education: [
        {
          degree: "PhD",
          major: "Computational Biology",
          university: "Stanford University",
          graduationYear: "2015",
        },
        {
          degree: "B.S.",
          major: "Computer Science & Biology",
          university: "MIT",
          graduationYear: "2010",
          gpa: "4.0",
        },
      ],
      achievements:
        "Published in Nature; NIH Director's New Innovator Award; 15+ peer-reviewed publications",
      certifications: [
        {
          name: "Bioinformatics Professional",
          organization: "ISCB",
          year: "2016",
        },
      ],
      languages: [
        { language: "English", proficiency: "Native" },
        { language: "Hindi", proficiency: "Native" },
      ],
    },
  },
];

const mockJobs = [
  {
    id: 1,
    title: "Senior Software Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$180k - $240k",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&h=200&fit=crop",
    description:
      "Join our Payments Platform team to build the financial infrastructure for the internet. You'll work on systems processing billions of dollars in transactions.",
    skills: ["TypeScript", "React", "Go", "Kubernetes"],
    benefits: [
      "Unlimited PTO",
      "401k Match",
      "Full Health Coverage",
      "Remote Flexible",
    ],
    applicationUrl:
      "https://stripe.com/jobs/listing/senior-software-engineer/12345",
    sponsorInfo: {
      name: "Sarah Chen",
      role: "Engineering Manager",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800",
      yearsAtCompany: "4 years",
      canRefer: true,
    },
    backchannelInsights: {
      dayToDay:
        "You'll spend mornings in code review and design discussions, afternoons in deep work. We have 2-3 hours of meetings weekly, mostly async. The team values shipping over perfectionism.",
      teamCulture:
        "Team of 8 senior engineers. Very collaborative, low ego. We do weekly offsites and have a strict no-weekend-work policy. Remote-first since 2020.",
      idealCandidate:
        "We need someone comfortable with ambiguity who can own projects end-to-end. Communication matters more than perfect technical skills - we can teach the stack.",
    },
    fullDetails: {
      responsibilities:
        "Design and build scalable payment processing systems. Collaborate with product and design to ship features used by millions. Mentor junior engineers and contribute to technical strategy.",
      requirements:
        "5+ years of software engineering experience. Strong CS fundamentals. Experience with distributed systems. Bonus: payment processing or fintech background.",
      interviewProcess:
        "3 rounds over 2 weeks: technical screen, system design, team fit. We don't do whiteboard coding - expect real-world problems and take-home projects.",
    },
  },
  {
    id: 2,
    title: "Senior Software Engineer",
    company: "Toyota",
    location: "Remote",
    type: "Full-time",
    salary: "$130k - $180k",
    image:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=200&h=200&fit=crop",
    description:
      "Join Toyota's digital transformation team. Build software that powers the future of mobility and smart manufacturing.",
    skills: ["Java", "Kafka", "AWS", "Microservices"],
    benefits: [
      "Travel Credit",
      "Remote Work",
      "Health Stipend",
      "Flexible Hours",
    ],
    isSponsored: false,
    applicationUrl:
      "https://careers.toyota.com/us/en/job/10274543/Senior-Software-Engineer",
    companyDescription:
      "Toyota is pioneering the future of mobility with innovative technology solutions. Our software engineering team works on cutting-edge projects from autonomous vehicles to smart manufacturing systems.",
    fullDetails: {
      responsibilities:
        "Maintain and scale core backend services. Optimize database queries and service communication. Lead incident response and post-mortems. Improve system observability.",
      requirements:
        "4+ years of backend engineering experience. Proficiency in Java or similar JVM languages. Experience with message queues (Kafka) and cloud infrastructure (AWS).",
      interviewProcess:
        "Standard process: Recruiter screen, Technical Phone Screen (Coding), Virtual Onsite (System Design + Coding + Culture). Decisions are made quickly.",
    },
  },
  {
    id: 3,
    title: "Product Designer",
    company: "Notion",
    location: "New York, NY",
    type: "Full-time",
    salary: "$140k - $190k",
    image:
      "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=200&h=200&fit=crop",
    description:
      "Help us reimagine how teams collaborate. You'll design experiences that balance power and simplicity for millions of users worldwide.",
    skills: ["Figma", "Prototyping", "User Research", "Design Systems"],
    benefits: [
      "Equity Package",
      "Learning Stipend",
      "Home Office Budget",
      "Flexible Hours",
    ],
    applicationUrl: "https://notion.so/careers/designer",
    sponsorInfo: {
      name: "Alex Kim",
      role: "Head of Design",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800",
      yearsAtCompany: "3 years",
      canRefer: true,
    },
    backchannelInsights: {
      dayToDay:
        "Mornings are for user research and design critique. Afternoons for prototyping and collaboration with eng. Expect deep focus time - we protect maker schedules.",
      teamCulture:
        "Small team of 12 designers, very tight-knit. We value thoughtful work over speed. Quarterly design sprints in person, rest is remote. Strong mentorship culture.",
      idealCandidate:
        "Looking for someone who loves details but understands business constraints. Portfolio should show end-to-end thinking, not just pretty pixels.",
    },
    fullDetails: {
      responsibilities:
        "Own end-to-end design for key product areas. Conduct user research and usability testing. Contribute to and maintain our design system. Partner closely with engineering and product.",
      requirements:
        "4+ years of product design experience. Strong portfolio showing shipped work. Experience with design systems. Proficiency in Figma. Bonus: B2B SaaS experience.",
      interviewProcess:
        "Portfolio review, design challenge (3 hours), team interviews, final round with leadership. We pay for your time on the design challenge.",
    },
  },
  {
    id: 4,
    title: "Machine Learning Engineer",
    company: "Tesla",
    location: "Palo Alto, CA",
    type: "Full-time",
    salary: "$160k - $220k",
    image:
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=200&h=200&fit=crop",
    description:
      "Build and deploy neural networks for Autopilot. Work on perception, prediction, and planning for autonomous driving at scale.",
    skills: ["PyTorch", "C++", "Computer Vision", "Robotics"],
    benefits: [
      "Stock Options",
      "Health Coverage",
      "401k",
      "Relocation Assistance",
    ],
    isSponsored: false,
    applicationUrl: "https://www.tesla.com/careers/search/job/249481",
    companyDescription:
      "Tesla's mission is to accelerate the world's transition to sustainable energy. Our AI team works on some of the most challenging real-world robotics problems — building software that can drive millions of vehicles safely. We process billions of miles of driving data and train models on custom supercomputers, pushing the boundaries of what's possible with machine learning.",
    fullDetails: {
      responsibilities:
        "Design and train deep learning models for autonomous driving. Optimize inference for real-time performance. Collaborate with robotics teams on sensor fusion. Analyze fleet data to improve model performance.",
      requirements:
        "3+ years ML engineering experience. Strong understanding of neural networks and computer vision. Experience with PyTorch or TensorFlow. C++ proficiency preferred.",
      interviewProcess:
        "Technical screen, take-home ML project, onsite technical deep dive, team fit. Expect questions on ML fundamentals, coding, and system design.",
    },
  },
  {
    id: 5,
    title: "Data Scientist",
    company: "Spotify",
    location: "Remote",
    type: "Full-time",
    salary: "$150k - $200k",
    image:
      "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=200&h=200&fit=crop",
    description:
      "Use ML to personalize music recommendations for 500M+ users. Build models that understand taste and discover the next big artist.",
    skills: ["Python", "SQL", "Machine Learning", "A/B Testing"],
    benefits: [
      "Remote First",
      "Premium Spotify",
      "Annual Bonus",
      "Stock Options",
    ],
    applicationUrl: "https://spotify.com/careers/data-scientist",
    sponsorInfo: {
      name: "Maria Rodriguez",
      role: "Data Science Lead",
      image:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
      yearsAtCompany: "5 years",
      canRefer: true,
    },
    backchannelInsights: {
      dayToDay:
        "Mornings: stakeholder syncs and experiment reviews. Afternoons: model building and data exploration. Fridays are for learning and side projects. Very async-friendly.",
      teamCulture:
        "15-person team spread across 8 time zones. Fully remote since before COVID. We over-communicate in Slack and do monthly in-person sprints in Stockholm.",
      idealCandidate:
        "Need someone who can translate business questions into tractable ML problems. SQL skills matter more than PhD. Music passion is a must - we're not just another tech company.",
    },
    fullDetails: {
      responsibilities:
        "Build and deploy ML models for recommendation systems. Design and analyze A/B tests. Partner with product to identify opportunities. Communicate insights to leadership.",
      requirements:
        "3+ years in data science or ML engineering. Strong Python and SQL. Experience with production ML systems. Familiarity with modern ML stack (PyTorch, scikit-learn, etc.).",
      interviewProcess:
        "SQL + stats screen, ML case study, stakeholder collaboration exercise, final round. Whole process is 2-3 weeks. We're async-first so interviews are flexible.",
    },
  },
  {
    id: 6,
    title: "Full Stack Developer",
    company: "Shopify",
    location: "Toronto, ON",
    type: "Full-time",
    salary: "$120k - $170k CAD",
    image:
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&h=200&fit=crop",
    description:
      "Build tools that help millions of merchants run their businesses. Work on features spanning checkout, payments, and analytics.",
    skills: ["Ruby", "React", "GraphQL", "PostgreSQL"],
    benefits: ["Remote Flexible", "Learning Fund", "Health Benefits", "Equity"],
    isSponsored: false,
    applicationUrl:
      "https://www.shopify.com/careers/software-engineers_c96af3a9-82a3-4c6a-9b86-1f7e6b376167",
    companyDescription:
      "Shopify powers over 4 million businesses worldwide, from small startups to Fortune 500 companies. We're building commerce infrastructure for the internet — enabling anyone to start, run, and grow a business. Our engineering teams ship code that processes billions in sales annually, and we're known for our merchant-first culture and focus on craft.",
    fullDetails: {
      responsibilities:
        "Build and maintain core commerce features. Write clean, tested Ruby and React code. Participate in code reviews and design discussions. Ship features that impact millions of merchants.",
      requirements:
        "2+ years full-stack development experience. Strong with Ruby on Rails and modern JavaScript. Understanding of SQL and API design. E-commerce experience is a plus.",
      interviewProcess:
        "Recruiter chat, technical interview (live coding), system design, final round with team. Process takes 2-3 weeks. We value thoughtful problem-solving over speed.",
    },
  },
  {
    id: 7,
    title: "DevOps Engineer",
    company: "Datadog",
    location: "Boston, MA",
    type: "Full-time",
    salary: "$140k - $190k",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&h=200&fit=crop",
    description:
      "Build and maintain infrastructure for our monitoring platform. Scale systems that ingest trillions of data points daily.",
    skills: ["Kubernetes", "Terraform", "Python", "AWS"],
    benefits: [
      "Unlimited PTO",
      "Stock Options",
      "401k Match",
      "Home Office Setup",
    ],
    applicationUrl: "https://datadog.com/careers/devops",
    sponsorInfo: {
      name: "Kevin Liu",
      role: "Infrastructure Lead",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      yearsAtCompany: "6 years",
      canRefer: true,
    },
    backchannelInsights: {
      dayToDay:
        "Mix of infrastructure work and automation. On-call rotation with fair compensation. Team is distributed but syncs daily. Focus on reducing toil through better tooling.",
      teamCulture:
        "Infrastructure team of 12. We value documentation and knowledge sharing. Weekly demos of automation wins. Strong mentorship for those new to cloud-native tools.",
      idealCandidate:
        "Someone who's automated away their previous job. We want engineers who think in systems and love building tools for other engineers.",
    },
    fullDetails: {
      responsibilities:
        "Manage Kubernetes clusters at scale. Build CI/CD pipelines. Implement infrastructure as code. Improve system observability and reliability. Participate in on-call rotation.",
      requirements:
        "3+ years DevOps or SRE experience. Strong with Kubernetes and cloud platforms. Experience with Infrastructure as Code (Terraform, Pulumi). Solid scripting skills (Python, Bash).",
      interviewProcess:
        "Technical screen (system design + troubleshooting), take-home infrastructure challenge, onsite with team. We focus on real-world scenarios.",
    },
  },
  {
    id: 8,
    title: "iOS Engineer",
    company: "Discord",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$150k - $210k",
    image:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop",
    description:
      "Build features for 150M+ monthly active users. Work on voice, video, and messaging that powers online communities.",
    skills: ["Swift", "UIKit", "SwiftUI", "Core Audio"],
    benefits: ["Equity", "Health Coverage", "Unlimited PTO", "Remote Options"],
    isSponsored: false,
    applicationUrl: "https://discord.com/jobs/8112880002",
    companyDescription:
      "Discord is where millions of people come together to talk, hang out, and have fun. We're building a platform that brings people closer through voice, video, and text — whether they're studying together, playing games, or just catching up. Our iOS app is used by over 50 million people monthly, and we're constantly pushing the boundaries of real-time communication on mobile.",
    fullDetails: {
      responsibilities:
        "Develop new features for the iOS app. Optimize performance for real-time audio and video. Work closely with design and product teams. Write clean, maintainable Swift code. Debug production issues.",
      requirements:
        "4+ years iOS development experience. Expert in Swift and iOS SDK. Experience with real-time communication is a plus. Strong understanding of performance optimization and memory management.",
      interviewProcess:
        "Phone screen, iOS technical interview (live coding in Swift), system design for mobile, final round. We look for engineers who care about user experience and performance.",
    },
  },
];

const SkeletonCard = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // flex:1 + alignSelf:"stretch" fills fullEmptyContainer top-to-bottom and
    // edge-to-edge, defeating its justifyContent:"center"/alignItems:"center".
    // paddingTop/paddingBottom mirror profileScrollContent so the skeleton hero
    // lands at the exact same Y position as a real profile's hero avatar.
    <ScrollView
      style={{ flex: 1, alignSelf: "stretch" }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 24 }}>
        {/* 96×96 circular avatar */}
        <Animated.View
          style={[
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.colors.bgSurface,
            },
            shimmerStyle,
          ]}
        />
        {/* Name shimmer ~60% */}
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.bgSurface,
              width: "58%",
              height: 26,
              borderRadius: 6,
              marginTop: 16,
            },
            shimmerStyle,
          ]}
        />
        {/* Subtitle shimmer ~38% */}
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.bgSurface,
              width: "38%",
              height: 16,
              borderRadius: 4,
              marginTop: 8,
            },
            shimmerStyle,
          ]}
        />
        {/* Fact-pill row */}
        <View
          style={{
            flexDirection: "row",
            gap: 7,
            marginTop: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {([80, 90, 75, 65] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: tokens.colors.bgSurface,
                  width: w,
                  height: 28,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: tokens.colors.border, marginVertical: 4 }}
      />

      {/* ── ABOUT section ────────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        {/* Section label */}
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.border,
              width: "28%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3 body-text lines */}
        <View style={{ gap: 8 }}>
          <Animated.View
            style={[
              { backgroundColor: tokens.colors.bgSurface, height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              { backgroundColor: tokens.colors.bgSurface, height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: tokens.colors.bgSurface,
                width: "70%",
                height: 15,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: tokens.colors.border, marginVertical: 4 }}
      />

      {/* ── AT-A-GLANCE stats strip ───────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.border,
              width: "38%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3-cell strip — single block that mirrors hingeStatsRow shape */}
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.bgSurface,
              borderRadius: 16,
              height: 64,
              overflow: "hidden",
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: tokens.colors.border, marginVertical: 4 }}
      />

      {/* ── INSIGHTS section ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18, gap: 10 }}>
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.border,
              width: "32%",
              height: 11,
              borderRadius: 4,
            },
            shimmerStyle,
          ]}
        />
        {/* 2 insight card placeholders matching hingeInsightCard shape */}
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.bgSurface,
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: tokens.colors.border,
            },
            shimmerStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.bgSurface,
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: tokens.colors.border,
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: tokens.colors.border, marginVertical: 4 }}
      />

      {/* ── TOP SKILLS chips ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: tokens.colors.border,
              width: "30%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([70, 90, 60, 80, 75] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: tokens.colors.bgSurface,
                  width: w,
                  height: 30,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export function HomeView({
  userType,
  onNavigateToProfile,
  navTranslateY,
  headerTranslateY,
}: HomeViewProps) {
  const router = useRouter();
  const profileData = useUserProfileStore((state) => state.data);
  const workEmailVerified = useUserProfileStore(
    (state) => state.workEmailVerified,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const pendingWorkEmail = useUserProfileStore(
    (state) => state.pendingWorkEmail,
  );
  const setPendingWorkEmail = useUserProfileStore(
    (state) => state.setPendingWorkEmail,
  );
  const updatePersonalStore = useUserProfileStore(
    (state) => state.updatePersonal,
  );

  // Jobs store
  const jobs = useJobsStore((state) => state.jobs);
  const jobsLoading = useJobsStore((state) => state.isLoading);
  const jobsError = useJobsStore((state) => state.error);
  const setJobs = useJobsStore((state) => state.setJobs);
  const setJobsLoading = useJobsStore((state) => state.setLoading);
  const setJobsError = useJobsStore((state) => state.setError);

  // Sponsored jobs (for sponsors)
  const sponsoredJobs = useJobsStore((state) => state.sponsoredJobs);
  const addSponsoredJob = useJobsStore((state) => state.addSponsoredJob);
  const activeSponsoredJobId = useJobsStore(
    (state) => state.activeSponsoredJobId,
  );
  const setActiveSponsoredJobId = useJobsStore(
    (state) => state.setActiveSponsoredJobId,
  );
  // Job-switcher (sponsor-only) — lets a sponsor with multiple sponsored
  // roles pick which one the deck represents. Switching changes
  // activeSponsoredJobId, which both re-fetches the profile pack for that
  // role AND becomes the JOB_ID stamped on every like the sponsor creates.
  const [showJobSwitcher, setShowJobSwitcher] = useState(false);
  const activeSponsoredJob = sponsoredJobs.find(
    (j) => j.jobId === activeSponsoredJobId,
  );

  // Profiles state (for sponsors)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  // Which sponsored-job id the current `profiles` list belongs to.
  // The empty state ("No applicants yet") needs this to distinguish
  // "we genuinely fetched and got zero" from "we haven't fetched for
  // this role yet". Without it, switching roles flashes the empty
  // state for one render between the role change and the effect
  // firing, and a failed fetch leaves the empty state stuck.
  const [profilesJobId, setProfilesJobId] = useState<string | null>(null);
  // Cache of lazily-fetched full profiles keyed by USER_ID
  const [fullProfileCache, setFullProfileCache] = useState<Record<string, any>>(
    {},
  );
  const [fullProfileLoading, setFullProfileLoading] = useState(false);
  // Cache of sponsor public profiles, keyed by sponsor user id. Powers the
  // "Meet your sponsor" back face on applicant job cards — the job payload
  // only carries a thin sponsor object, so we fetch the rest (bio, the
  // sponsor's Q&A insights, referral network, verified status) once per
  // sponsor and reuse it.
  const [sponsorProfileCache, setSponsorProfileCache] = useState<
    Record<
      string,
      {
        bio: string;
        insights: { question: string; answer: string }[];
        companiesCanReferTo: string[];
        verified: boolean;
      }
    >
  >({});

  // Navigation state from store
  const currentProfileIndex = useJobsStore((state) => state.currentIndex);
  const setCurrentProfileIndex = useJobsStore((state) => state.setCurrentIndex);
  const progress = useJobsStore((state) => state.progress);
  const setProgress = useJobsStore((state) => state.setProgress);
  const resetNavigation = useJobsStore((state) => state.resetNavigation);
  const lastFetched = useJobsStore((state) => state.lastFetched);

  const scrollRef = useRef<ScrollView>(null);
  // Initialize loading based on whether we already have data
  const [isLoading, setIsLoading] = useState(() => {
    return userType === "applicant" ? jobs.length === 0 : false;
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{
    name: string;
    image: string;
    role: string;
    jobTitle?: string;
  } | null>(null);
  // 2026-05-26 redesign: the card-flip metaphor was retired in favor of a
  // Hinge-style vertical scroll. All content (front-face hero + former
  // back-face content + former "show more" expanded section) now lives in
  // a single scrollable column, so the flip and show-more toggles are
  // gone — but a few modals (full bio / full job description) are still
  // useful for very long copy, so their visibility state stays.
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);

  // Profile completion state
  const [showProfileCompletionModal, setShowProfileCompletionModal] =
    useState(false);
  const [isTester, setIsTester] = useState(false);

  // Email verification gate (sponsors only)
  const [showEmailVerificationModal, setShowEmailVerificationModal] =
    useState(false);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState("");
  // Inline-edit state for the work-email shown in the verification modal.
  // The backend's send endpoint embeds the supplied email into the JWT and
  // (on link click) persists it to sponsor_profiles.work_email along with
  // setting verified=TRUE — so one call corrects typos AND triggers
  // verification. The `pendingWorkEmail` value lives in useUserProfileStore
  // (AsyncStorage-persisted) so the latest address the user submitted
  // survives tab switches, app relaunches, and full profile re-fetches —
  // it's cleared only when the backend confirms verification of that same
  // address.
  const [isEditingWorkEmail, setIsEditingWorkEmail] = useState(false);
  const [editedWorkEmail, setEditedWorkEmail] = useState("");
  const profileCompletion = profileData
    ? checkProfileCompleteness(profileData)
    : { isComplete: false, percentage: 0, missingFields: [] };

  // Apply Modal State (for non-sponsored jobs)
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyStep, setApplyStep] = useState<"select" | "requested">("select");
  const [pendingJob, setPendingJob] = useState<any>(null);
  const [isRequestingSponsor, setIsRequestingSponsor] = useState(false);
  // Server-rendered message for the "requested" success step. The backend
  // returns context-aware copy (count of sponsors notified, "already has a
  // sponsor", "no sponsors at this company yet", etc.) — surface it verbatim
  // so the user sees the actual outcome.
  const [sponsorRequestMessage, setSponsorRequestMessage] = useState<
    string | null
  >(null);
  const [waitlistedJobIds, setWaitlistedJobIds] = useState<Set<string>>(
    new Set(),
  );
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [requestedSponsorJobIds, setRequestedSponsorJobIds] = useState<
    Set<string>
  >(new Set());

  // Drives the cross-fade between profiles. The old swipeX horizontal
  // translation + rotateY card-flip shared values were removed with the
  // card UI; only the opacity-driven fade survives the redesign.
  const swipeOpacity = useSharedValue(1);
  const matchRingScale = useSharedValue(0.8);
  const matchRingOpacity = useSharedValue(0);
  // Tracks the previous scroll Y on the worklet thread so the scroll
  // handler can derive direction (scroll-up vs scroll-down) frame-by-
  // frame. Used by the Hinge-style nav-bar hide animation below.
  const prevScrollY = useSharedValue(0);
  // Pulsing LIVE dot for the "No Applicants Yet" empty state. Loops
  // a gentle opacity oscillation so the indicator reads as active /
  // running, the way streaming UIs and status dashboards do it.
  const livePulse = useSharedValue(1);
  useEffect(() => {
    livePulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [livePulse]);
  const livePulseStyle = useAnimatedStyle(() => ({
    opacity: livePulse.value,
  }));

  // Pulse-ring that radiates outward from both avatars when a mutual match fires
  useEffect(() => {
    if (matchedUser) {
      matchRingScale.value = 0.8;
      matchRingOpacity.value = 0;
      matchRingScale.value = withTiming(1.9, { duration: 750 });
      matchRingOpacity.value = withSequence(
        withTiming(0.28, { duration: 260 }),
        withTiming(0, { duration: 490 }),
      );
    }
  }, [matchedUser]);

  const matchRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: matchRingScale.value }],
    opacity: matchRingOpacity.value,
  }));

  // Use profiles for sponsors, jobs for applicants
  const applicantJobs = userType === "applicant" ? jobs : mockJobs;
  // For sponsors: use real profiles, don't fall back to mock data
  const sponsorProfiles = userType === "sponsor" ? profiles : mockProfiles;
  // Only fire the empty state when we've actually fetched FOR THE CURRENT
  // ROLE and got zero back. Without this gate the state flashes during
  // role transitions (new id is set, effect hasn't yet flipped loading)
  // and sticks permanently if the fetch errors before profiles is
  // written — both of which manifest as "Your sponsored job is live,
  // but no applicants have shown interest yet" appearing on every role.
  const hasNoApplicants =
    userType === "sponsor" &&
    sponsoredJobs.length > 0 &&
    profiles.length === 0 &&
    !profilesLoading &&
    profilesJobId === activeSponsoredJobId &&
    !profilesError;

  console.log("[HomeView] Using data:", {
    userType,
    apiJobsCount: jobs.length,
    apiProfilesCount: profiles.length,
    usingApiJobs: jobs.length > 0,
    usingApiProfiles: profiles.length > 0,
    currentIndex: currentProfileIndex,
  });

  const currentData =
    userType === "sponsor"
      ? sponsorProfiles[currentProfileIndex % sponsorProfiles.length]
      : applicantJobs[currentProfileIndex % applicantJobs.length];
  const isDeckFinished = progress > DECK_SIZE;

  // True only when real cards are loaded and being displayed.
  // Used to dim the progress bar + show an em-dash placeholder
  // when the deck isn't active (empty/error/loading states).
  const deckIsActive =
    !isDeckFinished &&
    !isLoading &&
    !(userType === "sponsor" && sponsoredJobs.length === 0) &&
    !hasNoApplicants &&
    !(
      userType === "sponsor" &&
      profilesError != null &&
      profiles.length === 0
    ) &&
    !(userType === "applicant" && jobsError != null && jobs.length === 0) &&
    !(userType === "applicant" && !jobsLoading && jobs.length === 0);

  // Bootstrap sponsor state on mount — ensures activeSponsoredJobId is set
  // even when the user lands on the dashboard before visiting the jobs tab.
  // Adds every sponsored job to the store (no REFERENCE_JOB_ID filter — that
  // would exclude manually-created jobs and cause the role dropdown to show
  // fewer roles than the "My Sponsored" tab on the Jobs board).
  //
  // SMART DEFAULT: after populating the store, set the active role to the
  // one with the highest PENDING_LIKES_COUNT (most unactioned applicants
  // waiting on the sponsor — PR #56's pending-only signal). The sponsor
  // lands on whatever role has the most work to do, instead of whatever
  // the backend happened to return first. Ties break by response order
  // (CREATED_AT DESC, so the most-recent role wins ties — including the
  // all-zero cold-start case).
  useEffect(() => {
    if (userType !== "sponsor") return;
    if (activeSponsoredJobId) return;
    const bootstrap = async () => {
      try {
        const response = await getMyJobs();
        if (!response.jobs?.length) return;
        response.jobs.forEach((j: any) => {
          addSponsoredJob({
            jobId: String(j.JOB_ID),
            // Empty string for manually-created jobs that have no ATS source.
            atsJobId: j.REFERENCE_JOB_ID ? String(j.REFERENCE_JOB_ID) : "",
            title: j.TITLE || "",
            company: j.COMPANY || "",
            likesCount: Number(j.PENDING_LIKES_COUNT ?? j.LIKES_COUNT) || 0,
          });
        });
        // Pick the role with the highest PENDING_LIKES_COUNT as the smart
        // default. Fall back to LIKES_COUNT if the new field is absent
        // (older backend, defensive). Reduce-with-strict-greater-than gives
        // "ties go to first seen" → first in the response (most recent)
        // wins ties, including the all-zero case.
        const pending = (j: any) =>
          Number(j.PENDING_LIKES_COUNT ?? j.LIKES_COUNT ?? 0);
        const winner = response.jobs.reduce(
          (best: any, j: any) => (pending(j) > pending(best) ? j : best),
          response.jobs[0],
        );
        if (winner) {
          setActiveSponsoredJobId(String(winner.JOB_ID));
        }
      } catch {
        // silent fail — dashboard will show empty state with CTA
      }
    };
    bootstrap();
  }, [userType]);

  // Fetch jobs/profiles on mount (only if we don't have recent data).
  //
  // 2026-05-27 — Daily-pack cache window.
  // The applicant job deck is treated as STABLE for the rest of the
  // calendar day once fetched. Tab-switching, backgrounding for a few
  // minutes, or remounting HomeView all hit the cache and reuse the
  // existing deck + scroll position. The cache rolls over at midnight
  // local-time so the next morning's first mount fetches a fresh pack.
  //
  // This is forward-compatible with the upcoming backend daily-pack
  // flag (every user gets 10 jobs per day, refreshes at the day
  // boundary). Once that flag is on server-side, this client-side
  // gate becomes redundant but harmless — both will agree.
  //
  // Previously this was a rolling 5-minute TTL, which caused decks to
  // silently swap underneath users whenever they returned to Home
  // after a coffee break.
  useEffect(() => {
    const loadData = async () => {
      if (userType === "applicant") {
        const lastFetchedDate = lastFetched ? new Date(lastFetched) : null;
        const now = new Date();
        const isSameDay =
          !!lastFetchedDate &&
          lastFetchedDate.getFullYear() === now.getFullYear() &&
          lastFetchedDate.getMonth() === now.getMonth() &&
          lastFetchedDate.getDate() === now.getDate();
        const isCacheValid = isSameDay && jobs.length > 0;

        if (isCacheValid) {
          console.log("[HomeView] Reusing today's cached deck — no refetch.");
          return;
        }

        try {
          console.log("[HomeView] Fetching jobs for applicant...");
          setJobsLoading(true);
          const apiJobs = await fetchJobsPack();
          console.log("[HomeView] Fetched", apiJobs.length, "jobs from API");
          const transformedJobs = apiJobs.map((job: JobApiResponse) =>
            transformJobApiResponse(job),
          );
          console.log("[HomeView] Transformed jobs:", transformedJobs.length);
          setJobs(transformedJobs);
          // Fresh deck → start at card 1. Without this, currentIndex
          // would persist from the previous (now-replaced) deck and
          // the user would land mid-pack on an arbitrary card.
          resetNavigation();
          console.log("[HomeView] Job deck URLs:");
          transformedJobs.forEach((job, i) => {
            console.log(
              `  ${i + 1}. ${job.title} @ ${job.company} → ${job.applicationUrl}`,
            );
          });
        } catch (err) {
          console.warn("[HomeView] Failed to fetch jobs:", err);
          setJobsError(
            err instanceof Error ? err.message : "Failed to fetch jobs",
          );
        } finally {
          setJobsLoading(false);
        }
      } else if (userType === "sponsor") {
        // Fetch profiles for sponsors only if they have a sponsored job
        if (!activeSponsoredJobId) {
          console.log(
            "[HomeView] No sponsored jobs yet, skipping profile fetch",
          );
          setProfilesLoading(false);
          return;
        }

        // Snapshot the id we're fetching for. If the user clicks a
        // different role before this resolves, we'll detect the
        // mismatch and discard the response so we don't overwrite
        // a fresher fetch with stale data.
        const fetchingForJobId = activeSponsoredJobId;
        try {
          console.log(
            "[HomeView] Fetching profiles for sponsored job:",
            fetchingForJobId,
          );
          setProfilesLoading(true);
          setProfilesError(null);
          const response = await fetchProfilesPack(fetchingForJobId);
          console.log(
            "[HomeView] Profile pack response:",
            JSON.stringify(response, null, 2),
          );
          console.log(
            "[HomeView] Fetched",
            response.profiles.length,
            "profiles from API",
          );
          console.log("[HomeView] First profile sample:", response.profiles[0]);

          // Transform API response to match UI expectations
          const transformedProfiles = response.profiles.map((profile: any) => {
            // Parse JSON strings
            const skills = profile.SKILLS ? JSON.parse(profile.SKILLS) : [];
            const positions = profile.POSITIONS
              ? JSON.parse(profile.POSITIONS)
              : [];

            // PR #39 (Opt C, 2026-05-05): the pack endpoint now includes
            // ap.INSIGHTS and up.BIO directly, so the back-of-card prompts +
            // the richer "About" text render on first paint. The lazy
            // `fetchFullProfileFor` call below still runs for the deeper
            // sections (experiences / education / certifications / languages
            // / achievements) which the pack does NOT include.
            const bio: string =
              profile.BIO || profile.REASON || "Looking for new opportunities";
            let prompts: any[] = [];
            if (profile.INSIGHTS) {
              try {
                const parsed = JSON.parse(profile.INSIGHTS);
                if (Array.isArray(parsed)) prompts = parsed;
              } catch {
                // Malformed JSON — fall through with empty prompts; the
                // lazy fetch will fill them in if it succeeds.
              }
            }

            return {
              ...profile, // Keep all original fields
              id: profile.USER_ID,
              name: `${profile.FIRST_NAME} ${profile.LAST_NAME}`.trim(),
              location: profile.LOCATION || "",
              skills: skills,
              desiredRole: positions[0] || "Open to opportunities",
              bio,
              prompts,
              image: profile.PHOTO_URL || "",
              company: "", // Applicants don't have company
            };
          });

          console.log(
            "[HomeView] Transformed first profile:",
            transformedProfiles[0],
          );
          setProfiles(transformedProfiles);
          // Mark which role this list represents so the empty-state
          // check can tell genuine "no applicants" apart from "still
          // loading after a role switch".
          setProfilesJobId(fetchingForJobId);
        } catch (err) {
          console.warn("[HomeView] Failed to fetch profiles:", err);
          setProfilesError(
            err instanceof Error ? err.message : "Failed to fetch profiles",
          );
          // Fall back to mock data on error
        } finally {
          setProfilesLoading(false);
        }
      }
    };

    loadData();
  }, [userType, activeSponsoredJobId]); // Re-fetch when sponsored job changes

  // Update local loading state based on store loading and whether we have data
  useEffect(() => {
    if (userType === "applicant") {
      // Show skeleton only while the fetch is actually in flight and we
      // have no data yet. Previously this was `|| jobs.length === 0`
      // which kept isLoading=true permanently when the API returned an
      // empty deck, making the skeleton spin forever.
      const shouldLoad = jobsLoading && jobs.length === 0;
      setIsLoading(shouldLoad);
    } else {
      // For sponsors, show loading while fetching profiles
      const shouldLoad = profilesLoading && profiles.length === 0;
      setIsLoading(shouldLoad);
    }
  }, [userType, jobsLoading, jobs.length, profilesLoading, profiles.length]);

  // Lazy-load the deeper applicant profile (experiences, education,
  // certifications, languages, achievements) on demand. As of PR #39 (Opt C,
  // 2026-05-05) the pack endpoint already includes BIO + INSIGHTS so the
  // back-of-card prompts and richer About text are populated upfront — this
  // lazy fetch only fills in the heavier sections that the pack still omits.
  const fetchFullProfileFor = useCallback(
    async (userId: string) => {
      if (!userId || fullProfileCache[userId] || fullProfileLoading) return;
      setFullProfileLoading(true);
      try {
        const pub = await getPublicProfile(String(userId));
        const ap = (pub as any).applicant_profile || {};
        const parseV = (v: any): any[] => {
          if (!v) return [];
          if (typeof v === "string") {
            try {
              return JSON.parse(v) || [];
            } catch {
              return [];
            }
          }
          return Array.isArray(v) ? v : [];
        };
        setFullProfileCache((prev) => ({
          ...prev,
          [userId]: {
            experiences: parseV(ap.PROFESSIONAL_EXPERIENCES),
            education: parseV(ap.EDUCATION_ENTRIES),
            certifications: parseV(ap.CERTIFICATIONS),
            languages: parseV(ap.LANGUAGES),
            achievements: ap.ACHIEVEMENTS || "",
            prompts: parseV(ap.INSIGHTS),
            bio: (pub as any).BIO || "",
          },
        }));
      } catch {
        // silent — feature degrades gracefully if backend call fails
      } finally {
        setFullProfileLoading(false);
      }
    },
    [fullProfileCache, fullProfileLoading],
  );

  // Eager-fetch the full applicant profile when a sponsor advances to a
  // new card so the back-of-card insights + richer front-of-card bio are
  // ready before the user flips.
  useEffect(() => {
    if (userType !== "sponsor") return;
    const userId = (currentData as any)?.USER_ID;
    if (userId) fetchFullProfileFor(String(userId));
  }, [userType, currentData, fetchFullProfileFor]);

  // Fetch the sponsor's public profile for the "Meet your sponsor" back
  // face. The job's `sponsorInfo` only has name/photo/role/years — bio,
  // the sponsor's personal Q&A insights, and referral network come from
  // GET /api/profiles/<id>/public/.
  const fetchSponsorProfileFor = useCallback(
    async (userId: string) => {
      if (!userId || sponsorProfileCache[userId]) return;
      try {
        const pub = await getPublicProfile(String(userId));
        const sp = (pub as any).sponsor_profile || {};
        const parseV = (v: any): any[] => {
          if (!v) return [];
          if (typeof v === "string") {
            try {
              return JSON.parse(v) || [];
            } catch {
              return [];
            }
          }
          return Array.isArray(v) ? v : [];
        };
        setSponsorProfileCache((prev) => ({
          ...prev,
          [userId]: {
            bio: (pub as any).BIO || "",
            insights: parseV(sp.INSIGHTS),
            companiesCanReferTo: parseV(sp.COMPANIES_CAN_REFER_TO),
            // WORK_EMAIL_VERIFIED isn't on the public-profile payload yet —
            // see BACKEND_CHANGES_NEEDED.md §9. The badge stays hidden until
            // the backend exposes it; reading both casings defensively.
            verified:
              (pub as any).WORK_EMAIL_VERIFIED === true ||
              (pub as any).sponsor_profile?.WORK_EMAIL_VERIFIED === true,
          },
        }));
      } catch {
        // silent — the back face degrades to the thin sponsorInfo data
      }
    },
    [sponsorProfileCache],
  );

  // Eager-fetch the sponsor profile when an applicant advances to a new
  // sponsored job card, so the back face is ready before they flip.
  useEffect(() => {
    if (userType === "sponsor") return;
    const sponsorId = (currentData as any)?.sponsorInfo?.userId;
    if (sponsorId) fetchSponsorProfileFor(String(sponsorId));
  }, [userType, currentData, fetchSponsorProfileFor]);

  // Record "viewed" in the feed history and Mixpanel whenever the active
  // card changes. Fire-and-forget — failures must never block the UI.
  useEffect(() => {
    if (!currentData) return;
    if (userType === "applicant") {
      const jobId = currentData?.id;
      if (jobId) {
        const isSponsored =
          "isSponsored" in currentData
            ? Boolean(currentData.isSponsored)
            : false;
        recordJobFeedAction(String(jobId), "viewed").catch(() => {});
        trackJobCardViewed({ jobId: String(jobId), isSponsored });
      }
    } else {
      const applicantUserId = (currentData as any)?.USER_ID || currentData?.id;
      if (applicantUserId && activeSponsoredJobId) {
        recordProfileFeedAction(
          activeSponsoredJobId,
          String(applicantUserId),
          "viewed",
        ).catch(() => {});
        trackProfileCardViewed({
          applicantUserId: String(applicantUserId),
          jobId: activeSponsoredJobId,
        });
      }
    }
  }, [currentData, userType, activeSponsoredJobId]);

  // Hinge-style redesign — when a profile becomes current, kick off the
  // deep-profile fetch (experiences/education/certs/languages) eagerly
  // since they're inline in the scroll now instead of behind a Show More
  // toggle. Idempotent on the cache side so this is a no-op once loaded.
  useEffect(() => {
    if (userType !== "sponsor") return;
    const userId = currentData?.USER_ID;
    if (userId) fetchFullProfileFor(String(userId));
    // fetchFullProfileFor is stable enough for our use; we re-fire only on
    // profile change, not when the function identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData?.USER_ID, userType]);

  const handleSwipe = async (isAccept: boolean) => {
    // Check profile completeness for applicants before any swipe action (unless they're a tester)
    if (
      userType === "applicant" &&
      profileCompletion.percentage < 90 &&
      !isTester
    ) {
      setShowProfileCompletionModal(true);
      return;
    }

    // Block sponsors from swiping until they've verified their work email
    if (userType === "sponsor" && !workEmailVerified && !isTester) {
      setEmailVerifyError("");
      setShowEmailVerificationModal(true);
      return;
    }

    // If applicant tries to apply to Non-Sponsored Job, intercept
    if (
      userType === "applicant" &&
      isAccept &&
      "isSponsored" in currentData &&
      currentData.isSponsored === false
    ) {
      // Already waitlisted — skip silently and advance the deck.
      // Route through nextProfile so progress (and the dots/number) bumps
      // in lock-step with currentIndex, like every other action.
      if (waitlistedJobIds.has(String(currentData.id))) {
        nextProfile(true);
        return;
      }
      setPendingJob(currentData);
      setApplyStep("select");
      setShowApplyModal(true);
      return;
    }

    if (isAccept) {
      // Call like API when accepting
      let didMatch = false;
      try {
        if (userType === "applicant") {
          // Applicant liking a job
          const jobId = currentData?.id;
          if (jobId) {
            console.log("[HomeView] Applicant liking job:", jobId);
            const response = await likeJob(jobId);
            console.log("[HomeView] Like job response:", response);

            // Mark sponsored job as applied
            setAppliedJobIds((prev) => new Set([...prev, String(jobId)]));

            // Record "liked" in the feed history (fire-and-forget)
            recordJobFeedAction(String(jobId), "liked").catch(() => {});

            const isSponsoredJob =
              "isSponsored" in currentData
                ? Boolean(currentData.isSponsored)
                : false;
            trackJobLiked({
              jobId: String(jobId),
              isSponsored: isSponsoredJob,
              matched: Boolean(response.matched),
            });

            // Show match celebration modal on mutual like
            if (response.matched) {
              console.log("[HomeView] 🎉 It's a match!");
              didMatch = true;
              const matchName =
                "sponsorInfo" in currentData && currentData.sponsorInfo?.name
                  ? (currentData.sponsorInfo.name as string)
                  : "company" in currentData
                    ? (currentData.company as string) || "Your Sponsor"
                    : "Your Sponsor";
              setMatchedUser({
                name: matchName,
                image:
                  "sponsorInfo" in currentData
                    ? (currentData.sponsorInfo?.image as string) || ""
                    : "",
                role:
                  "sponsorInfo" in currentData
                    ? (currentData.sponsorInfo?.role as string) || ""
                    : "",
                jobTitle:
                  "title" in currentData
                    ? (currentData.title as string)
                    : undefined,
              });
              trackMatchCreated({
                matchedWithName: matchName,
                jobId: String(jobId),
                origin: "applicant_swipe",
              });
            }
          } else {
            console.warn("[HomeView] No job ID found for current data");
          }
        } else {
          // Sponsor liking a profile
          const applicantUserId = currentData?.USER_ID || currentData?.id;
          if (applicantUserId) {
            console.log("[HomeView] Sponsor liking profile:", applicantUserId);
            console.log(
              "[HomeView] Active sponsored job:",
              activeSponsoredJobId,
            );
            const response = await likeProfile(
              String(applicantUserId),
              activeSponsoredJobId || undefined,
            );
            console.log("[HomeView] Like profile response:", response);

            trackProfileLiked({
              applicantUserId: String(applicantUserId),
              jobId: activeSponsoredJobId || undefined,
              matched: Boolean(response.matched),
            });

            // Record "liked" in the feed history (fire-and-forget)
            if (activeSponsoredJobId) {
              recordProfileFeedAction(
                activeSponsoredJobId,
                String(applicantUserId),
                "liked",
              ).catch(() => {});
            }

            // Show match celebration modal on mutual like
            if (response.matched) {
              console.log("[HomeView] 🎉 It's a match!");
              didMatch = true;
              const matchName =
                (currentData.name as string) ||
                `${(currentData.FIRST_NAME as string) || ""} ${(currentData.LAST_NAME as string) || ""}`.trim() ||
                "Applicant";
              setMatchedUser({
                name: matchName,
                image:
                  (currentData.image as string) ||
                  (currentData.PHOTO_URL as string) ||
                  "",
                role:
                  (currentData.desiredRole as string) ||
                  (currentData.role as string) ||
                  "",
              });
              trackMatchCreated({
                matchedWithName: matchName,
                jobId: activeSponsoredJobId || undefined,
                origin: "sponsor_swipe",
              });
            }
          } else {
            console.warn(
              "[HomeView] No applicant user ID found for current data",
            );
          }
        }
      } catch (err) {
        console.warn("[HomeView] Failed to record like:", err);
        // Continue with UI update even if API fails
      }

      if (!didMatch) {
        // Standard swipe-right toast — only shown when there is no mutual match
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          nextProfile(true);
        }, 1800);
      }
      // When didMatch=true, nextProfile is called when the match modal is dismissed
    } else {
      // Skip / swipe-left analytics — fired regardless of role.
      if (userType === "applicant") {
        const skippedJobId = currentData?.id;
        if (skippedJobId) {
          trackJobSkipped({
            jobId: String(skippedJobId),
            isSponsored:
              "isSponsored" in currentData
                ? Boolean(currentData.isSponsored)
                : false,
          });
          // Record "passed" in the feed history (fire-and-forget)
          recordJobFeedAction(String(skippedJobId), "passed").catch(() => {});
        }
      } else {
        const skippedApplicantId = currentData?.USER_ID || currentData?.id;
        if (skippedApplicantId) {
          trackProfileSkipped({
            applicantUserId: String(skippedApplicantId),
            jobId: activeSponsoredJobId || undefined,
          });
          // Record "passed" in the feed history (fire-and-forget)
          if (activeSponsoredJobId) {
            recordProfileFeedAction(
              activeSponsoredJobId,
              String(skippedApplicantId),
              "passed",
            ).catch(() => {});
          }
        }
      }
      nextProfile(false);
    }
  };

  // Hinge-style profile transition. The card-flip metaphor is gone, so
  // there's no horizontal swipe to animate — we just cross-fade with a
  // subtle vertical lift to keep the action feeling responsive. The
  // `isAccept` arg is retained for API compatibility but no longer drives
  // a direction since both Pass and Connect feel the same to the layout.
  const nextProfile = (_isAccept: boolean) => {
    // Scroll back to the top so the next profile starts at its hero, not
    // mid-bio. Snap (not animated) — the cross-fade hides the jump.
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    swipeOpacity.value = withTiming(0, { duration: 220 });

    setTimeout(() => {
      setProgress(progress + 1);
      setCurrentProfileIndex(currentProfileIndex + 1);
      swipeOpacity.value = withTiming(1, { duration: 280 });
    }, 220);
  };

  const handleMatchModalDismiss = () => {
    setMatchedUser(null);
    nextProfile(true);
  };

  // Combined "Get a Sponsor" — fires both APIs in parallel. Request-sponsor
  // pushes notifications to employees at the company; join-waitlist makes
  // sure the applicant is queued for a notification when *anyone* sponsors
  // the job (whether through our outbound notification or any other path).
  // Promise.allSettled so a single failure doesn't lose the other half.
  const handleGetSponsor = async () => {
    if (!pendingJob?.id) return;
    const jobId = String(pendingJob.id);
    setIsRequestingSponsor(true);
    setSponsorRequestMessage(null);
    const [requestRes] = await Promise.allSettled([
      requestSponsorForJob(jobId),
      joinWaitlist(jobId),
    ]);
    trackSponsorRequested({ jobId });
    trackJobWaitlistJoined({ jobId });
    if (requestRes.status === "fulfilled") {
      // Backend's context-aware copy: count of sponsors, "already has a
      // sponsor", "no sponsors at this company yet", duplicate request, etc.
      setSponsorRequestMessage(requestRes.value.message ?? null);
    } else {
      console.warn("[HomeView] request-sponsor failed:", requestRes.reason);
    }
    setIsRequestingSponsor(false);
    setApplyStep("requested");
    // Track both client-side sets so the card overlay reflects either kind
    // of pending state — waitlisted badge OR sponsor-requested badge.
    setRequestedSponsorJobIds((prev) => new Set([...prev, jobId]));
    setWaitlistedJobIds((prev) => new Set([...prev, jobId]));
  };

  const handleApplyModalDone = () => {
    setShowApplyModal(false);
    setPendingJob(null);
    // Advance the deck so the actioned card moves to the back. Use
    // nextProfile so progress advances in lock-step with currentIndex —
    // a bare setCurrentProfileIndex left the progress bar frozen.
    nextProfile(true);
  };

  // Hinge-style transition — pure opacity cross-fade with a subtle 8px
  // lift so the swap feels responsive without the abrupt swipe-out the
  // old card UI used. translateX is intentionally dropped; the page is
  // a vertical scroll now, so horizontal motion would feel mis-aligned.
  const mainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: swipeOpacity.value,
    transform: [{ translateY: (1 - swipeOpacity.value) * 8 }],
  }));

  // Hinge-style hide-on-scroll for BOTH chrome elements: the bottom nav
  // bar (slides down) and the top header (slides up). The handler runs
  // on the worklet thread (no JS bridge), so it stays buttery even on
  // long profiles. Direction is derived from the frame-to-frame delta of
  // contentOffset.y; small deltas under DEAD_ZONE are ignored to keep
  // the bars from juddering during fingertip-jitter.
  //
  // The thresholds:
  //   • Y <= TOP_PIN          → always pin both visible (covers top bounce)
  //   • Y >= maxY - BOTTOM_PIN → freeze state (covers bottom rubber-band)
  //   • dy > DEAD_ZONE        → scrolling down → hide both
  //   • dy < -DEAD_ZONE       → scrolling up   → reveal both
  //
  // Why the bottom freeze: when the user reaches the end of the scroll
  // and keeps pulling, iOS rubber-bands — contentOffset.y overshoots
  // past maxY, then snaps back. The snap-back fires a burst of frames
  // with dy < 0 (looks like "scrolling up" to a naive handler), which
  // would re-reveal the nav and cause it to vibrate against the user's
  // finger. Freezing the chrome state inside the overscroll zone
  // kills the jitter completely.
  //
  // navTranslateY + headerTranslateY are owned by MainApp; HomeView is
  // the sole writer to both. Different HIDE_OFFSETs because the header
  // is shorter than the nav pill — 80 is enough to clear it.
  const TOP_PIN = 4;
  const BOTTOM_PIN = 4;
  const DEAD_ZONE = 3;
  const NAV_HIDE_OFFSET = 120;
  const HEADER_HIDE_OFFSET = 80;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      "worklet";
      const y = e.contentOffset.y;
      const dy = y - prevScrollY.value;
      const maxY = e.contentSize.height - e.layoutMeasurement.height;
      // Guard `maxY > 0` so we don't accidentally treat a short
      // profile (no scroll possible) as "always at the bottom".
      const atBottom = maxY > 0 && y >= maxY - BOTTOM_PIN;

      if (y <= TOP_PIN) {
        // At (or above) the top — always reveal. Covers the iOS
        // overscroll bounce, which can briefly report negative Y.
        if (navTranslateY && navTranslateY.value !== 0) {
          navTranslateY.value = withTiming(0, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== 0) {
          headerTranslateY.value = withTiming(0, { duration: 220 });
        }
      } else if (atBottom) {
        // At (or past) the bottom — hold the current chrome state.
        // The rubber-band snap-back generates a flurry of negative
        // dy frames that would otherwise re-reveal the nav and make
        // it vibrate against the user's finger. By doing nothing
        // here, the bar stays exactly where it was when the user
        // hit the end. As soon as they scroll BACK up past the
        // bottom zone, the regular dy logic takes over again.
      } else if (dy > DEAD_ZONE) {
        if (navTranslateY && navTranslateY.value !== NAV_HIDE_OFFSET) {
          navTranslateY.value = withTiming(NAV_HIDE_OFFSET, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== HEADER_HIDE_OFFSET) {
          headerTranslateY.value = withTiming(HEADER_HIDE_OFFSET, {
            duration: 220,
          });
        }
      } else if (dy < -DEAD_ZONE) {
        if (navTranslateY && navTranslateY.value !== 0) {
          navTranslateY.value = withTiming(0, { duration: 220 });
        }
        if (headerTranslateY && headerTranslateY.value !== 0) {
          headerTranslateY.value = withTiming(0, { duration: 220 });
        }
      }
      prevScrollY.value = y;
    },
  });

  // Animated style consumed by the header element itself. Translates
  // upward (negative Y) and fades as the shared value grows toward
  // HEADER_HIDE_OFFSET. Reading the shared value here is what makes
  // the header tween in lock-step with the nav bar.
  // headerHeight is captured once via onLayout so we can interpolate the
  // layout height to 0 as the header hides, collapsing the dead white band.
  const headerHeight = useSharedValue(0);
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, (headerTranslateY?.value ?? 0) / 80);
    const collapsing = progress > 0 && headerHeight.value > 0;
    return {
      transform: [{ translateY: -(headerTranslateY?.value ?? 0) }],
      opacity: 1 - progress,
      // Only constrain height while actively collapsing. When fully
      // visible, let natural height through so taller content (e.g. the
      // sponsor's role-switcher pill that mounts later, once sponsoredJobs
      // loads) isn't clipped by a stale onLayout capture against
      // overflow:"hidden".
      height: collapsing
        ? Math.max(0, headerHeight.value * (1 - progress))
        : undefined,
      marginBottom: collapsing ? (1 - progress) * 28 : undefined,
      overflow: "hidden",
    };
  });

  // Floating Pass/Connect buttons ride in lock-step with the bottom nav
  // pill. At the top of the scroll the nav is visible (navTranslateY = 0)
  // and would otherwise sit directly on top of the buttons — so we lift
  // them FLOATING_NAV_CLEARANCE px clear of the pill. As the user scrolls
  // down the nav slides off-screen (navTranslateY → NAV_HIDE_OFFSET) and
  // the buttons drop in unison into the space it vacates, landing at their
  // natural bottom position. Scrolling back up reverses it. Reading the
  // same shared value the nav uses keeps the two glued together frame-for-
  // frame, and the nav's withTiming tween carries the buttons along.
  const FLOATING_NAV_CLEARANCE = 88;
  const floatingActionsAnimatedStyle = useAnimatedStyle(() => {
    const navHidden = Math.min(
      1,
      Math.max(0, (navTranslateY?.value ?? 0) / NAV_HIDE_OFFSET),
    );
    return {
      transform: [{ translateY: -FLOATING_NAV_CLEARANCE * (1 - navHidden) }],
    };
  });

  // Reset both chrome shared values whenever HomeView unmounts (user
  // switches tab away from Home) so the bar AND header are visible on
  // the next screen, even if HomeView happened to leave them hidden.
  useEffect(() => {
    return () => {
      if (navTranslateY) navTranslateY.value = 0;
      if (headerTranslateY) headerTranslateY.value = 0;
    };
  }, [navTranslateY, headerTranslateY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Hinge-style page layout: sticky header at top, full-bleed
            scrollable profile in the middle, sticky action bar at the
            bottom. The old page-wide ScrollView wrapped EVERYTHING
            (header + card + nav) which forced the action buttons to
            scroll with the content. That metaphor's gone — the bar is
            now persistent so swipe decisions are always one tap away,
            no matter where you are in a long profile. */}
        <View style={styles.pageContainer}>
          {/* Sticky header — outside the scroll so the progress and
              role-switcher never leave the viewport. */}
          <Animated.View
            entering={FadeInDown}
            onLayout={(e) => {
              // Re-capture natural height whenever the header isn't mid-
              // hide animation. Capturing only once was wrong: the first
              // onLayout fires before sponsoredJobs loads (no role pill),
              // so the captured height was too small and the pill got
              // clipped by overflow:"hidden" once it mounted.
              if ((headerTranslateY?.value ?? 0) === 0) {
                headerHeight.value = e.nativeEvent.layout.height;
              }
            }}
            style={[styles.headerRow, headerAnimatedStyle]}
          >
            {/* Progress indicator — dims + shows "–/10" when the deck
                isn't active (empty/error/loading states). */}
            <View
              style={[
                styles.progressHeaderContainer,
                !deckIsActive && { opacity: 0.3 },
              ]}
            >
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressCurrent}>
                  {deckIsActive ? Math.min(progress, DECK_SIZE) : 0}
                </Text>
                <Text style={styles.progressTotal}>/{DECK_SIZE}</Text>
              </View>
              <View style={styles.progressDotsRow}>
                {Array.from({ length: DECK_SIZE }).map((_, i) => {
                  const cardNumber = i + 1;
                  const isPast = cardNumber < progress;
                  const isCurrent = cardNumber === progress;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        (isPast || isCurrent) && styles.progressDotFilled,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
            {/* Role switcher — sponsor-only. Hidden when the sponsor has
                no sponsored jobs (deck shows the empty state). Always
                tappable so the sponsor can change roles whenever, even
                with just one job currently sponsored.
                Redesigned as a high-contrast black pill (matches the
                primary CTA language elsewhere in the app). Shows a
                pending-applicants count badge inline when the active
                role has unactioned interest, so the most important
                signal lives right in the header. */}
            {userType === "sponsor" && sponsoredJobs.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowJobSwitcher(true)}
                activeOpacity={0.85}
                style={styles.roleSwitcherPill}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={styles.roleSwitcherTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeSponsoredJob?.title || "Pick a role"}
                </Text>
                {!!activeSponsoredJob?.likesCount &&
                  activeSponsoredJob.likesCount > 0 && (
                    <View style={styles.roleSwitcherBadge}>
                      <Text style={styles.roleSwitcherBadgeText}>
                        {activeSponsoredJob.likesCount > 99
                          ? "99+"
                          : activeSponsoredJob.likesCount}
                      </Text>
                    </View>
                  )}
                <ChevronDown color={tokens.colors.textBody} size={14} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {isDeckFinished ? (
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color={tokens.colors.text} size={32} />
                </View>
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptySub}>
                  You've reviewed your deck. Come back tomorrow for more.
                </Text>
                <TouchableOpacity
                  style={styles.returnBtn}
                  onPress={() => {
                    resetNavigation();
                  }}
                >
                  <Text style={styles.returnBtnText}>Refresh Deck</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : userType === "sponsor" && sponsoredJobs.length === 0 ? (
            /* "Start Your Journey" — sponsor has no sponsored jobs yet.
               Redesigned: instead of a flat icon-circle, render a
               stacked-deck illustration that visually represents "your
               applicant deck is empty, waiting to be filled". Clean
               monochrome, generous spacing, single primary CTA. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.emptyDeckIllustration}>
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardBack]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardMid]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardFront]}
                  >
                    <Briefcase color={tokens.colors.text} size={28} strokeWidth={1.8} />
                  </View>
                </View>

                <Text style={styles.sponsorEmptyTitle}>Build your deck</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  Sponsor a role to start seeing applicants matched to it. Pick
                  one from the ATS feed or post your own.
                </Text>

                <TouchableOpacity
                  style={styles.sponsorEmptyPrimary}
                  onPress={() => {
                    router.push("/dashboard?mode=sponsor&tab=jobs");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sponsorEmptyPrimaryText}>
                    Browse Jobs
                  </Text>
                  <ChevronRight color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : hasNoApplicants ? (
            /* "No Applicants Yet" — sponsor has a sponsored role but no
               one's shown interest yet. Redesigned to feel less "empty"
               and more "in flight": a pulsing LIVE indicator at the
               top, a preview card of the role itself (so the user
               knows exactly which sponsored job they're waiting on),
               and momentum-positive copy. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.livePill}>
                  <Animated.View style={[styles.liveDot, livePulseStyle]} />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>

                {activeSponsoredJob && (
                  <View style={styles.sponsorWaitingJobCard}>
                    <CompanyLogo
                      logoUrl={undefined}
                      name={activeSponsoredJob.company}
                      size={48}
                      borderRadius={24}
                      initialFontSize={20}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={styles.sponsorWaitingJobTitle}
                        numberOfLines={1}
                      >
                        {activeSponsoredJob.title || "Untitled role"}
                      </Text>
                      {!!activeSponsoredJob.company && (
                        <Text
                          style={styles.sponsorWaitingJobCompany}
                          numberOfLines={1}
                        >
                          {activeSponsoredJob.company}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <Text style={styles.sponsorEmptyTitle}>Out in the wild</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  Your role is in front of candidates. New applicants surface
                  here the moment they show interest — usually within a day of
                  going live.
                </Text>

                <View style={styles.sponsorEmptyActions}>
                  <TouchableOpacity
                    style={styles.sponsorEmptySecondary}
                    onPress={() => {
                      // Reset both the list and the job-id tag so the
                      // empty-state check goes through the loading
                      // branch while the retry is in flight.
                      setProfiles([]);
                      setProfilesJobId(null);
                      setProfilesError(null);
                      const loadData = async () => {
                        if (activeSponsoredJobId) {
                          const fetchingForJobId = activeSponsoredJobId;
                          try {
                            setProfilesLoading(true);
                            const response =
                              await fetchProfilesPack(fetchingForJobId);
                            setProfiles(response.profiles);
                            setProfilesJobId(fetchingForJobId);
                          } catch (err) {
                            console.warn(
                              "[HomeView] Failed to fetch profiles:",
                              err,
                            );
                            setProfilesError(
                              err instanceof Error
                                ? err.message
                                : "Failed to fetch profiles",
                            );
                          } finally {
                            setProfilesLoading(false);
                          }
                        }
                      };
                      loadData();
                    }}
                    activeOpacity={0.85}
                  >
                    <RefreshCcw color={tokens.colors.text} size={16} strokeWidth={2.2} />
                    <Text style={styles.sponsorEmptySecondaryText}>
                      Refresh
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sponsorEmptyPrimary}
                    onPress={() => {
                      router.push("/dashboard?mode=sponsor&tab=jobs");
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.sponsorEmptyPrimaryText}>
                      Sponsor Another
                    </Text>
                    <ChevronRight color={tokens.colors.brandText} size={18} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : userType === "sponsor" &&
            profilesError &&
            profiles.length === 0 ? (
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color={tokens.colors.text} size={32} />
                </View>
                <Text style={styles.emptyTitle}>Couldn't Load Profiles</Text>
                <Text style={styles.emptySub}>
                  We hit a snag fetching applicants for this role.
                  {"\n\n"}
                  {profilesError}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    // Re-trigger the load effect by clearing the
                    // tagged jobId. Setting profilesJobId to null
                    // and clearing the error nudges the dependency
                    // chain so the user gets a fresh attempt.
                    setProfilesError(null);
                    setProfilesJobId(null);
                    const id = activeSponsoredJobId;
                    if (id) {
                      (async () => {
                        try {
                          setProfilesLoading(true);
                          const response = await fetchProfilesPack(id);
                          const transformed = (response.profiles || []).map(
                            (profile: any) => {
                              const skills = profile.SKILLS
                                ? JSON.parse(profile.SKILLS)
                                : [];
                              const positions = profile.POSITIONS
                                ? JSON.parse(profile.POSITIONS)
                                : [];
                              let prompts: any[] = [];
                              if (profile.INSIGHTS) {
                                try {
                                  const parsed = JSON.parse(profile.INSIGHTS);
                                  if (Array.isArray(parsed)) prompts = parsed;
                                } catch {}
                              }
                              return {
                                ...profile,
                                id: profile.USER_ID,
                                name: `${profile.FIRST_NAME} ${profile.LAST_NAME}`.trim(),
                                location: profile.LOCATION || "",
                                skills,
                                desiredRole:
                                  positions[0] || "Open to opportunities",
                                bio:
                                  profile.BIO ||
                                  profile.REASON ||
                                  "Looking for new opportunities",
                                prompts,
                                image: profile.PHOTO_URL || "",
                                company: "",
                              };
                            },
                          );
                          setProfiles(transformed);
                          setProfilesJobId(id);
                        } catch (err) {
                          setProfilesError(
                            err instanceof Error
                              ? err.message
                              : "Failed to fetch profiles",
                          );
                        } finally {
                          setProfilesLoading(false);
                        }
                      })();
                    }
                  }}
                >
                  <RefreshCcw color={tokens.colors.brandText} size={18} />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : userType === "applicant" && jobsError && jobs.length === 0 ? (
            /* Applicant error state — fetch threw or returned an error.
               Mirrors the sponsor error state visually (icon circle +
               RefreshCcw + Try Again) so the design language is
               consistent regardless of which side of the market you're on. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View entering={FadeInUp} style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <RefreshCcw color={tokens.colors.text} size={32} />
                </View>
                <Text style={styles.emptyTitle}>Couldn't Load Roles</Text>
                <Text style={styles.emptySub}>
                  Something went wrong fetching your deck. Check your connection
                  and try again.
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    (async () => {
                      try {
                        setJobsLoading(true);
                        setJobsError(null);
                        const apiJobs = await fetchJobsPack();
                        const transformedJobs = apiJobs.map(
                          (job: JobApiResponse) => transformJobApiResponse(job),
                        );
                        setJobs(transformedJobs);
                        resetNavigation();
                      } catch (err) {
                        setJobsError(
                          err instanceof Error
                            ? err.message
                            : "Failed to fetch jobs",
                        );
                      } finally {
                        setJobsLoading(false);
                      }
                    })();
                  }}
                >
                  <RefreshCcw color={tokens.colors.brandText} size={18} />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : userType === "applicant" && !jobsLoading && jobs.length === 0 ? (
            /* Applicant no-jobs state — fetch completed successfully but
               the API returned an empty deck. Uses the same stacked-deck
               illustration as the sponsor "Build your deck" state to keep
               visual language consistent; copy is applicant-appropriate. */
            <View style={styles.fullEmptyContainer}>
              <Animated.View
                entering={FadeInUp}
                style={styles.sponsorEmptyState}
              >
                <View style={styles.emptyDeckIllustration}>
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardBack]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardMid]}
                  />
                  <View
                    style={[styles.emptyDeckCard, styles.emptyDeckCardFront]}
                  >
                    <Briefcase color={tokens.colors.text} size={28} strokeWidth={1.8} />
                  </View>
                </View>

                <Text style={styles.sponsorEmptyTitle}>You're early</Text>
                <Text style={styles.sponsorEmptySubtitle}>
                  We're filling the deck with roles matched to your profile.
                  Check back tomorrow for a fresh batch.
                </Text>

                <View style={styles.sponsorEmptyActions}>
                  <TouchableOpacity
                    style={styles.sponsorEmptySecondary}
                    onPress={() => {
                      (async () => {
                        try {
                          setJobsLoading(true);
                          const apiJobs = await fetchJobsPack();
                          const transformedJobs = apiJobs.map(
                            (job: JobApiResponse) =>
                              transformJobApiResponse(job),
                          );
                          setJobs(transformedJobs);
                          resetNavigation();
                        } catch (err) {
                          setJobsError(
                            err instanceof Error
                              ? err.message
                              : "Failed to fetch jobs",
                          );
                        } finally {
                          setJobsLoading(false);
                        }
                      })();
                    }}
                    activeOpacity={0.85}
                  >
                    <RefreshCcw color={tokens.colors.text} size={16} strokeWidth={2.2} />
                    <Text style={styles.sponsorEmptySecondaryText}>
                      Refresh
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : isLoading || !currentData ? (
            <View style={styles.fullEmptyContainer}>
              <SkeletonCard />
            </View>
          ) : (
            <>
              {/* Hinge-style: one big vertically-scrolling profile with a
                  cross-fade transition between deck entries. The card
                  metaphor — front face / back face / flip / "show more"
                  toggle — is gone. Everything that used to be split across
                  those surfaces now lives inline below the hero, so the
                  user scrolls through one continuous, well-paced read. */}
              <Animated.View style={[styles.profileFader, mainAnimatedStyle]}>
                <Animated.ScrollView
                  ref={scrollRef as any}
                  contentContainerStyle={styles.profileScrollContent}
                  showsVerticalScrollIndicator={false}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                >
                  {userType === "sponsor" ? (
                    /* ────────────────────────────────────────────────────
                       SPONSOR VIEW — applicant profile, vertical scroll
                       ──────────────────────────────────────────────────── */
                    <>
                      {/* "Liked your role" badge (PR #56) — high-conviction
                          interest, anchored at the top before the hero so
                          it's the first thing the sponsor sees. */}
                      {(currentData as any).HAS_LIKED_JOB === true && (
                        <View style={styles.likedYourRoleRow}>
                          <View style={styles.likedYourRolePill}>
                            <Heart
                              size={11}
                              color={tokens.colors.brandText}
                              fill={tokens.colors.brandText}
                              strokeWidth={2}
                            />
                            <Text style={styles.likedYourRolePillText}>
                              LIKED YOUR ROLE
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* HERO — applicant identity */}
                      <View style={styles.hingeHero}>
                        {"image" in currentData && currentData.image ? (
                          <Image
                            source={{ uri: currentData.image as string }}
                            style={styles.hingeHeroAvatar}
                          />
                        ) : (
                          <View style={styles.hingeHeroAvatarFallback}>
                            <Text style={styles.hingeHeroAvatarInitial}>
                              {("name" in currentData
                                ? currentData.name || "?"
                                : "?")[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.hingeHeroName} numberOfLines={2}>
                          {"name" in currentData ? currentData.name : ""}
                        </Text>
                        {"desiredRole" in currentData &&
                          !!currentData.desiredRole && (
                            <Text
                              style={styles.hingeHeroSubtitle}
                              numberOfLines={2}
                            >
                              {currentData.desiredRole}
                            </Text>
                          )}
                        <View style={styles.hingeHeroPillRow}>
                          {"company" in currentData &&
                            !!currentData.company && (
                              <View style={styles.heroPill}>
                                <Briefcase color={tokens.colors.textBody} size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.company}
                                </Text>
                              </View>
                            )}
                          {"location" in currentData &&
                            !!currentData.location && (
                              <View style={styles.heroPill}>
                                <MapPin color={tokens.colors.textBody} size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.location}
                                </Text>
                              </View>
                            )}
                        </View>
                      </View>

                      <View style={styles.hingeDivider} />

                      {/* ABOUT — full bio, no clamp */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cachedBio =
                          uid && fullProfileCache[String(uid)]?.bio;
                        const bio: string =
                          cachedBio ||
                          ("bio" in currentData ? currentData.bio : "") ||
                          "";
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>ABOUT</Text>
                            <Text style={styles.hingeBodyText}>
                              {bio.trim().length > 0
                                ? bio
                                : "No bio added yet."}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* INSIGHTS — Q&A cards, full text */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const inlinePrompts =
                          "prompts" in currentData
                            ? (currentData as any).prompts
                            : null;
                        const prompts: any[] =
                          cached?.prompts && cached.prompts.length > 0
                            ? cached.prompts
                            : Array.isArray(inlinePrompts)
                              ? inlinePrompts
                              : [];
                        if (prompts.length === 0 && fullProfileLoading) {
                          return (
                            <View style={styles.hingeSection}>
                              <Text style={styles.hingeSectionLabel}>
                                INSIGHTS
                              </Text>
                              <View
                                style={{
                                  alignItems: "flex-start",
                                  paddingVertical: 4,
                                }}
                              >
                                <ActivityIndicator color={tokens.colors.textMuted} />
                              </View>
                            </View>
                          );
                        }
                        if (prompts.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              INSIGHTS
                            </Text>
                            {prompts.map((prompt: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeInsightCard,
                                  idx > 0 && { marginTop: 14 },
                                ]}
                              >
                                {/* Vertical black accent stripe — pulls
                                    the eye to the content without
                                    introducing color into the monochrome
                                    palette. */}
                                <View style={styles.hingeInsightAccent} />
                                <View style={styles.hingeInsightBody}>
                                  {!!prompt.question && (
                                    <Text style={styles.hingeInsightQuestion}>
                                      {prompt.question}
                                    </Text>
                                  )}
                                  {/* Decorative opening quote — large
                                      serif-style mark sits flush with
                                      the answer's first line, giving
                                      the card its "in their own words"
                                      gravitas. */}
                                  <View style={styles.hingeInsightAnswerRow}>
                                    <Text style={styles.hingeInsightQuoteMark}>
                                      “
                                    </Text>
                                    <Text style={styles.hingeInsightAnswer}>
                                      {prompt.answer}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* TOP SKILLS — chips */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const fromCache = Array.isArray((cached as any)?.skills)
                          ? ((cached as any).skills as string[])
                          : [];
                        const fromCard =
                          "skills" in currentData &&
                          Array.isArray((currentData as any).skills)
                            ? ((currentData as any).skills as string[])
                            : [];
                        const skills =
                          fromCache.length > 0 ? fromCache : fromCard;
                        if (skills.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              TOP SKILLS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {skills.map((skill: string, idx: number) => (
                                <View key={idx} style={styles.hingeSkillChip}>
                                  <Text style={styles.hingeSkillChipText}>
                                    {skill}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* EXPERIENCE — timeline */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const experiences: any[] = Array.isArray(
                          cached?.experiences,
                        )
                          ? cached!.experiences
                          : [];
                        if (experiences.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              EXPERIENCE
                            </Text>
                            {experiences.map((exp: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeTimelineRow,
                                  idx > 0 && { marginTop: 18 },
                                ]}
                              >
                                <View style={styles.hingeTimelineDot} />
                                <View style={styles.hingeTimelineBody}>
                                  <Text style={styles.hingeTimelineTitle}>
                                    {exp.jobTitle}
                                  </Text>
                                  <Text style={styles.hingeTimelineSubtitle}>
                                    {exp.company}
                                  </Text>
                                  <Text style={styles.hingeTimelineMeta}>
                                    {exp.startDate}
                                    {exp.current
                                      ? " — Present"
                                      : exp.endDate
                                        ? ` — ${exp.endDate}`
                                        : ""}
                                  </Text>
                                  {!!exp.description && (
                                    <Text
                                      style={styles.hingeTimelineDescription}
                                    >
                                      {exp.description}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* EDUCATION — timeline */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const education: any[] = Array.isArray(
                          cached?.education,
                        )
                          ? cached!.education
                          : [];
                        if (education.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              EDUCATION
                            </Text>
                            {education.map((edu: any, idx: number) => (
                              <View
                                key={idx}
                                style={[
                                  styles.hingeTimelineRow,
                                  idx > 0 && { marginTop: 18 },
                                ]}
                              >
                                <View style={styles.hingeTimelineDot} />
                                <View style={styles.hingeTimelineBody}>
                                  <Text style={styles.hingeTimelineTitle}>
                                    {edu.degree}
                                    {edu.major ? ` in ${edu.major}` : ""}
                                  </Text>
                                  <Text style={styles.hingeTimelineSubtitle}>
                                    {edu.university}
                                  </Text>
                                  <Text style={styles.hingeTimelineMeta}>
                                    {[
                                      edu.graduationYear &&
                                        `Class of ${edu.graduationYear}`,
                                      edu.gpa && `GPA ${edu.gpa}`,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}

                      {/* CERTIFICATIONS — credential blocks */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const certs: any[] = Array.isArray(
                          cached?.certifications,
                        )
                          ? cached!.certifications
                          : [];
                        if (certs.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              CERTIFICATIONS
                            </Text>
                            <View style={styles.hingeCredentialList}>
                              {certs.map((cert: any, idx: number) => (
                                <View
                                  key={idx}
                                  style={styles.hingeCredentialBlock}
                                >
                                  <Text style={styles.hingeCredentialName}>
                                    {cert.name}
                                  </Text>
                                  <Text style={styles.hingeCredentialMeta}>
                                    {cert.organization}
                                    {cert.year ? ` · ${cert.year}` : ""}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* LANGUAGES — credential blocks */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const langs: any[] = Array.isArray(cached?.languages)
                          ? cached!.languages
                          : [];
                        if (langs.length === 0) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              LANGUAGES
                            </Text>
                            <View style={styles.hingeCredentialList}>
                              {langs.map((lang: any, idx: number) => (
                                <View
                                  key={idx}
                                  style={styles.hingeCredentialBlock}
                                >
                                  <Text style={styles.hingeCredentialName}>
                                    {lang.language}
                                  </Text>
                                  <Text style={styles.hingeCredentialMeta}>
                                    {lang.proficiency}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* ACHIEVEMENTS */}
                      {(() => {
                        const uid = (currentData as any)?.USER_ID;
                        const cached = uid
                          ? fullProfileCache[String(uid)]
                          : null;
                        const ach: string = cached?.achievements || "";
                        if (!ach) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ACHIEVEMENTS
                            </Text>
                            <Text style={styles.hingeBodyText}>{ach}</Text>
                          </View>
                        );
                      })()}
                    </>
                  ) : (
                    /* ────────────────────────────────────────────────────
                       APPLICANT VIEW — job, vertical scroll
                       ──────────────────────────────────────────────────── */
                    <>
                      {/* Status banner at the top — waitlisted /
                          sponsor-requested / applied. Replaces the old
                          "overlay" that floated above the card image. */}
                      {"id" in currentData &&
                        (waitlistedJobIds.has(String(currentData.id)) ||
                          requestedSponsorJobIds.has(String(currentData.id)) ||
                          appliedJobIds.has(String(currentData.id))) && (
                          <View style={styles.statusBannerRow}>
                            {waitlistedJobIds.has(String(currentData.id)) ? (
                              <View style={styles.statusBanner}>
                                <Check color={tokens.colors.brandText} size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Waitlisted
                                </Text>
                              </View>
                            ) : requestedSponsorJobIds.has(
                                String(currentData.id),
                              ) ? (
                              <View style={styles.statusBanner}>
                                <Check color={tokens.colors.brandText} size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Sponsor requested
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.statusBanner}>
                                <Check color={tokens.colors.brandText} size={13} strokeWidth={3} />
                                <Text style={styles.statusBannerText}>
                                  Applied
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                      {/* HERO — company logo + role identity */}
                      <View style={styles.hingeHero}>
                        <CompanyLogo
                          logoUrl={
                            "image" in currentData
                              ? (currentData.image as string)
                              : undefined
                          }
                          name={
                            "company" in currentData
                              ? (currentData.company as string)
                              : ""
                          }
                          size={88}
                          borderRadius={44}
                          initialFontSize={32}
                        />
                        <Text style={styles.hingeHeroName} numberOfLines={3}>
                          {"title" in currentData ? currentData.title : ""}
                        </Text>
                        {"company" in currentData && !!currentData.company && (
                          <Text
                            style={styles.hingeHeroSubtitle}
                            numberOfLines={1}
                          >
                            {currentData.company}
                          </Text>
                        )}
                        {"isSponsored" in currentData && (
                          <View
                            style={
                              currentData.isSponsored
                                ? styles.heroStatusSponsored
                                : styles.heroStatusMuted
                            }
                          >
                            {currentData.isSponsored && (
                              <Check color={tokens.colors.brandText} size={10} strokeWidth={3} />
                            )}
                            <Text
                              style={
                                currentData.isSponsored
                                  ? styles.heroStatusSponsoredText
                                  : styles.heroStatusMutedText
                              }
                            >
                              {currentData.isSponsored
                                ? "Sponsored"
                                : "No sponsor yet"}
                            </Text>
                          </View>
                        )}
                        <View style={styles.hingeHeroPillRow}>
                          {"location" in currentData &&
                            !!currentData.location && (
                              <View style={styles.heroPill}>
                                <MapPin color={tokens.colors.textBody} size={11} />
                                <Text style={styles.heroPillText}>
                                  {currentData.location}
                                </Text>
                              </View>
                            )}
                          {"salary" in currentData && !!currentData.salary && (
                            <View style={styles.heroPill}>
                              <DollarSign color={tokens.colors.textBody} size={11} />
                              <Text style={styles.heroPillText}>
                                {currentData.salary}
                              </Text>
                            </View>
                          )}
                          {"type" in currentData && !!currentData.type && (
                            <View style={styles.heroPill}>
                              <Briefcase color={tokens.colors.textBody} size={11} />
                              <Text style={styles.heroPillText}>
                                {currentData.type}
                              </Text>
                            </View>
                          )}
                          {"relevanceScore" in currentData &&
                            (currentData as any).relevanceScore > 0 && (
                              <View style={styles.heroPillAccent}>
                                <Zap size={10} color={tokens.colors.brandText} strokeWidth={2.5} />
                                <Text style={styles.heroPillAccentText}>
                                  {Math.round(
                                    (currentData as any).relevanceScore > 1
                                      ? (currentData as any).relevanceScore
                                      : (currentData as any).relevanceScore *
                                          100,
                                  )}
                                  % AI Match
                                </Text>
                              </View>
                            )}
                        </View>
                      </View>

                      <View style={styles.hingeDivider} />

                      {/* ABOUT THE ROLE — full text, no clamp */}
                      {(() => {
                        const description =
                          "description" in currentData
                            ? currentData.description || ""
                            : "";
                        if (!description.trim()) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ABOUT THE ROLE
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {description}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* ROLE DETAILS — experience level + work arrangement chips */}
                      {(() => {
                        const expLvl =
                          "experienceLevel" in currentData
                            ? (currentData as any).experienceLevel
                            : "";
                        const workArr =
                          "workArrangement" in currentData
                            ? (currentData as any).workArrangement
                            : "";
                        if (!expLvl && !workArr) return null;
                        return (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              ROLE DETAILS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {!!expLvl && (
                                <View style={styles.roleDetailChip}>
                                  <Briefcase size={13} color={tokens.colors.text} />
                                  <Text style={styles.roleDetailChipText}>
                                    {(() => {
                                      const v = String(expLvl).trim();
                                      return /^[\d+\-\s]+$/.test(v)
                                        ? `${v} years experience`
                                        : v;
                                    })()}
                                  </Text>
                                </View>
                              )}
                              {!!workArr && (
                                <View style={styles.roleDetailChip}>
                                  <MapPin size={13} color={tokens.colors.text} />
                                  <Text style={styles.roleDetailChipText}>
                                    {workArr}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {/* CORE RESPONSIBILITIES */}
                      {"coreResponsibilities" in currentData &&
                        (currentData as any).coreResponsibilities && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              CORE RESPONSIBILITIES
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {(currentData as any).coreResponsibilities}
                            </Text>
                          </View>
                        )}

                      {/* REQUIREMENTS */}
                      {"requirementsSummary" in currentData &&
                        (currentData as any).requirementsSummary && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              REQUIREMENTS
                            </Text>
                            <Text style={styles.hingeBodyText}>
                              {(currentData as any).requirementsSummary}
                            </Text>
                          </View>
                        )}

                      {/* REQUIRED SKILLS — chips */}
                      {"skills" in currentData &&
                        currentData.skills &&
                        currentData.skills.length > 0 && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              REQUIRED SKILLS
                            </Text>
                            <View style={styles.hingeChipsWrap}>
                              {currentData.skills.map(
                                (skill: string, idx: number) => (
                                  <View key={idx} style={styles.hingeSkillChip}>
                                    <Text style={styles.hingeSkillChipText}>
                                      {skill}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          </View>
                        )}

                      {/* HIGHLIGHTS — benefits as a checked list */}
                      {"benefits" in currentData &&
                        currentData.benefits &&
                        currentData.benefits.length > 0 && (
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>
                              HIGHLIGHTS
                            </Text>
                            <View style={styles.benefitsList}>
                              {currentData.benefits.map(
                                (benefit: string, idx: number) => (
                                  <View key={idx} style={styles.benefitRow}>
                                    <Check size={14} color={tokens.colors.text} />
                                    <Text style={styles.benefitText}>
                                      {benefit}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          </View>
                        )}

                      {/* NO SPONSOR YET — status block + company description */}
                      {"isSponsored" in currentData &&
                      currentData.isSponsored === false ? (
                        <>
                          <View style={styles.hingeSection}>
                            <Text style={styles.hingeSectionLabel}>STATUS</Text>
                            <View style={styles.noSponsorInlineBlock}>
                              <View style={styles.noSponsorIconCircle}>
                                <BellRing
                                  size={22}
                                  color={tokens.colors.text}
                                  strokeWidth={2}
                                />
                              </View>
                              <Text style={styles.noSponsorHeadline}>
                                No sponsor yet
                              </Text>
                              <Text style={styles.noSponsorSubtext}>
                                When someone at{" "}
                                {"company" in currentData && currentData.company
                                  ? currentData.company
                                  : "this company"}{" "}
                                signs on to sponsor this role, you'll be
                                notified instantly.
                              </Text>
                            </View>
                          </View>
                          {"companyDescription" in currentData &&
                            currentData.companyDescription && (
                              <View style={styles.hingeSection}>
                                <Text style={styles.hingeSectionLabel}>
                                  ABOUT THE COMPANY
                                </Text>
                                <Text style={styles.hingeBodyText}>
                                  {currentData.companyDescription}
                                </Text>
                              </View>
                            )}
                        </>
                      ) : (
                        /* MEET YOUR SPONSOR — identity, trust, words; plus
                           the role's inside-story insights below it. */
                        "sponsorInfo" in currentData &&
                        currentData.sponsorInfo &&
                        (() => {
                          const si = currentData.sponsorInfo;
                          const sid = si.userId ? String(si.userId) : "";
                          const sp = sid ? sponsorProfileCache[sid] : null;
                          const company =
                            "company" in currentData ? currentData.company : "";
                          const qa = (sp?.insights || []).filter(
                            (i) => i && i.question && i.answer,
                          );
                          const ins =
                            "backchannelInsights" in currentData &&
                            currentData.backchannelInsights
                              ? currentData.backchannelInsights
                              : null;
                          const jobInsights: {
                            label: string;
                            text: string;
                          }[] = [];
                          if (ins?.dayToDay)
                            jobInsights.push({
                              label: "DAY-TO-DAY",
                              text: ins.dayToDay,
                            });
                          if (ins?.teamCulture)
                            jobInsights.push({
                              label: "TEAM CULTURE",
                              text: ins.teamCulture,
                            });
                          if (ins?.idealCandidate)
                            jobInsights.push({
                              label: "WHO THRIVES HERE",
                              text: ins.idealCandidate,
                            });
                          if ((ins as any)?.insiderInsights)
                            jobInsights.push({
                              label: "EVERYTHING ELSE",
                              text: (ins as any).insiderInsights,
                            });
                          return (
                            <>
                              {/* ── SPONSOR ZONE CARD ───────────────── */}
                              <View style={styles.sponsorZoneOuter}>
                                <View style={styles.sponsorZoneCard}>
                                  <View style={styles.sponsorZoneBody}>
                                    {/* Subtle "SPONSORED BY" kicker */}
                                    <Text style={styles.sponsorZoneQALabel}>
                                      SPONSORED BY
                                    </Text>

                                    {/* Identity row */}
                                    <View
                                      style={[
                                        styles.sponsorMeetInline,
                                        { marginTop: 10 },
                                      ]}
                                    >
                                      {si.image ? (
                                        <Image
                                          source={{ uri: si.image }}
                                          style={styles.sponsorMeetAvatar}
                                        />
                                      ) : (
                                        <View
                                          style={
                                            styles.sponsorMeetAvatarFallback
                                          }
                                        >
                                          <Text
                                            style={
                                              styles.sponsorMeetAvatarInitial
                                            }
                                          >
                                            {(si.name || "?")[0].toUpperCase()}
                                          </Text>
                                        </View>
                                      )}
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                          style={styles.sponsorMeetName}
                                          numberOfLines={1}
                                        >
                                          {si.name}
                                        </Text>
                                        {!!(si.role || company) && (
                                          <Text
                                            style={styles.sponsorMeetRole}
                                            numberOfLines={1}
                                          >
                                            {si.role}
                                            {si.role && company ? " · " : ""}
                                            {company}
                                          </Text>
                                        )}
                                        {sp?.verified && (
                                          <View
                                            style={[
                                              styles.canReferTag,
                                              { marginTop: 6 },
                                            ]}
                                          >
                                            <Check
                                              size={10}
                                              color={tokens.colors.text}
                                              strokeWidth={3}
                                            />
                                            <Text
                                              style={styles.canReferTagText}
                                            >
                                              Verified employee
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>

                                    {/* Fact pills */}
                                    {(!!si.yearsAtCompany || si.canRefer) && (
                                      <View
                                        style={[
                                          styles.hingeChipsWrap,
                                          { marginTop: 12 },
                                        ]}
                                      >
                                        {!!si.yearsAtCompany && (
                                          <View style={styles.heroPill}>
                                            <Calendar color={tokens.colors.textBody} size={11} />
                                            <Text style={styles.heroPillText}>
                                              {si.yearsAtCompany} here
                                            </Text>
                                          </View>
                                        )}
                                        {si.canRefer && (
                                          <View style={styles.heroPill}>
                                            <Check
                                              color={tokens.colors.textBody}
                                              size={11}
                                              strokeWidth={3}
                                            />
                                            <Text style={styles.heroPillText}>
                                              Can refer directly
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    )}

                                    {/* Sponsor Q&A — matches the
                                        applicant-from-sponsor view's
                                        quote-style card so the
                                        sponsor's voice reads with the
                                        same "in their own words"
                                        treatment everywhere it appears
                                        in the app. */}
                                    {qa.length > 0 && (
                                      <>
                                        <View
                                          style={styles.sponsorZoneDivider}
                                        />
                                        <Text style={styles.sponsorZoneQALabel}>
                                          SPONSOR INSIGHTS
                                        </Text>
                                        {qa.map((item, i) => (
                                          <View
                                            key={item.question}
                                            style={[
                                              styles.hingeInsightCard,
                                              i > 0 && { marginTop: 12 },
                                            ]}
                                          >
                                            <View
                                              style={styles.hingeInsightAccent}
                                            />
                                            <View
                                              style={styles.hingeInsightBody}
                                            >
                                              <Text
                                                style={
                                                  styles.hingeInsightQuestion
                                                }
                                              >
                                                {item.question}
                                              </Text>
                                              <View
                                                style={
                                                  styles.hingeInsightAnswerRow
                                                }
                                              >
                                                <Text
                                                  style={
                                                    styles.hingeInsightQuoteMark
                                                  }
                                                >
                                                  “
                                                </Text>
                                                <Text
                                                  style={
                                                    styles.hingeInsightAnswer
                                                  }
                                                >
                                                  {item.answer}
                                                </Text>
                                              </View>
                                            </View>
                                          </View>
                                        ))}
                                      </>
                                    )}

                                    {/* Job insights — role-specific
                                        spec written BY the sponsor
                                        ABOUT the role. Uses a
                                        documented "header strip" card
                                        (dark label band on top, body
                                        below) so it reads as a formal
                                        role brief rather than a
                                        personal quote — distinct from
                                        the SPONSOR INSIGHTS cards
                                        right above it. */}
                                    {jobInsights.length > 0 && (
                                      <>
                                        <View
                                          style={styles.sponsorZoneDivider}
                                        />
                                        <Text
                                          style={styles.sponsorZoneJobLabel}
                                        >
                                          JOB INSIGHTS
                                        </Text>
                                        {jobInsights.map((it, idx) => (
                                          <View
                                            key={it.label}
                                            style={[
                                              styles.jobInsightCard,
                                              idx > 0 && { marginTop: 12 },
                                            ]}
                                          >
                                            <View
                                              style={styles.jobInsightHeader}
                                            >
                                              <Text
                                                style={
                                                  styles.jobInsightHeaderLabel
                                                }
                                              >
                                                {it.label}
                                              </Text>
                                            </View>
                                            <View style={styles.jobInsightBody}>
                                              <Text
                                                style={
                                                  styles.jobInsightBodyText
                                                }
                                              >
                                                {it.text}
                                              </Text>
                                            </View>
                                          </View>
                                        ))}
                                      </>
                                    )}
                                  </View>
                                </View>
                              </View>
                            </>
                          );
                        })()
                      )}
                    </>
                  )}
                </Animated.ScrollView>
              </Animated.View>

              {/* Floating action buttons — Hinge-style. Two circular
                  buttons sit on top of the scroll content with no tray
                  background, drop-shadowed against whatever's behind
                  them. The wrapper uses pointerEvents="box-none" so taps
                  on empty space between the buttons fall through to the
                  scroll, while the buttons themselves still receive
                  touches. The scroll content has bottom padding that
                  matches the button stack so the last section isn't
                  hidden under them. */}
              <Animated.View
                style={[styles.floatingActionsRow, floatingActionsAnimatedStyle]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  onPress={() => handleSwipe(false)}
                  style={styles.floatingPassBtn}
                  activeOpacity={0.85}
                >
                  <X color={tokens.colors.text} size={26} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSwipe(true)}
                  style={styles.floatingConnectBtn}
                  activeOpacity={0.85}
                >
                  <Check color={tokens.colors.brandText} size={26} strokeWidth={2.8} />
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Celebration Message */}
      {showCelebration && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={80}
            style={StyleSheet.absoluteFill}
            tint="light"
          />
          <View style={styles.overlayCenter}>
            <Animated.View
              entering={ZoomIn.duration(400)}
              style={styles.celebrationCard}
            >
              <View style={styles.successCircle}>
                <Check color={tokens.colors.brandText} size={32} strokeWidth={3} />
              </View>
              <Text style={styles.celebrationTitle}>
                {userType === "sponsor" ? "Request Sent!" : "Application Sent!"}
              </Text>
              <Text style={styles.celebrationSub}>
                {userType === "sponsor"
                  ? `You've connected with ${"name" in currentData ? currentData.name : ""}`
                  : `You've applied to ${"title" in currentData ? currentData.title : ""}`}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* ── Match Celebration Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!matchedUser}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={60}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <View style={styles.matchModalOverlay}>
            <Animated.View
              entering={ZoomIn.springify().damping(14).stiffness(180)}
              style={styles.matchCard}
            >
              {/* "IT'S A MATCH" pill label */}
              <Animated.View
                entering={FadeInDown.delay(150).duration(350)}
                style={styles.matchLabelPill}
              >
                <Text style={styles.matchLabelText}>IT’S A MATCH</Text>
              </Animated.View>

              {/* Avatar row */}
              <Animated.View
                entering={FadeInUp.delay(100).duration(400)}
                style={styles.matchAvatarRow}
              >
                {/* Current user's avatar */}
                <View style={styles.matchAvatarWrapper}>
                  <Animated.View
                    style={[styles.matchAvatarRing, matchRingStyle]}
                  />
                  {profileData?.personal?.profileImage ? (
                    <Image
                      source={{ uri: profileData.personal.profileImage }}
                      style={styles.matchAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.matchAvatar, styles.matchAvatarInitial]}
                    >
                      <Text style={styles.matchAvatarInitialText}>
                        {(profileData?.personal?.firstName ||
                          "Y")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Spark connector */}
                <View style={styles.matchSparkWrapper}>
                  <Sparkles size={18} color={tokens.colors.text} />
                </View>

                {/* Matched user's avatar */}
                <View style={styles.matchAvatarWrapper}>
                  <Animated.View
                    style={[styles.matchAvatarRing, matchRingStyle]}
                  />
                  {matchedUser?.image ? (
                    <Image
                      source={{ uri: matchedUser.image }}
                      style={styles.matchAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.matchAvatar, styles.matchAvatarInitial]}
                    >
                      <Text style={styles.matchAvatarInitialText}>
                        {(matchedUser?.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Title */}
              <Animated.View entering={FadeInUp.delay(300).duration(400)}>
                <Text style={styles.matchTitle}>It’s a Match!</Text>
              </Animated.View>

              {/* Subtitle */}
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                <Text style={styles.matchSubtitle}>
                  {userType === "applicant"
                    ? `You and ${
                        matchedUser?.name ?? "your sponsor"
                      } are both interested${
                        matchedUser?.jobTitle
                          ? ` in ${matchedUser.jobTitle}`
                          : ""
                      }`
                    : `You and ${
                        matchedUser?.name ?? "this applicant"
                      } are both interested in connecting`}
                </Text>
              </Animated.View>

              {/* Action buttons */}
              <Animated.View
                entering={FadeInUp.delay(500).duration(400)}
                style={styles.matchActions}
              >
                <TouchableOpacity
                  style={styles.matchMsgBtn}
                  onPress={handleMatchModalDismiss}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={18} color={tokens.colors.brandText} />
                  <Text style={styles.matchMsgBtnText}>Message Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.matchSkipBtn}
                  onPress={handleMatchModalDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={styles.matchSkipBtnText}>
                    Continue Exploring
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      {/* Get-a-Sponsor Action Modal (For Non-Sponsored Jobs) */}
      <Modal visible={showApplyModal} animationType="none" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowApplyModal(false)}
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
            style={styles.applyModalContent}
          >
            <View style={styles.modalHandle} />

            <View style={styles.applyModalHeader}>
              <Text style={styles.applyModalTitle}>
                {applyStep === "select" ? "Get a Sponsor" : "Request sent!"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowApplyModal(false)}
                style={styles.closeBtn}
              >
                <X color={tokens.colors.text} size={24} />
              </TouchableOpacity>
            </View>

            {applyStep === "select" && (
              <Text style={styles.applyModalSubtitle}>
                This role at {pendingJob?.company} doesn't have an active
                sponsor yet.
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {applyStep === "select" && (
                <View style={styles.modalOptionsContainer}>
                  {/* Single combined action — both "request a sponsor"
                      (notify employees at the company) AND "join waitlist"
                      (get notified when any sponsor signs on) fire in
                      parallel. They were redundant from the user's point of
                      view; one button, two backend writes. */}
                  <TouchableOpacity
                    style={[
                      styles.modalOptionBtn,
                      isRequestingSponsor && { opacity: 0.6 },
                    ]}
                    onPress={handleGetSponsor}
                    disabled={isRequestingSponsor}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOptionIcon}>
                      <BellRing color={tokens.colors.text} size={24} />
                    </View>
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionTitle}>Get a Sponsor</Text>
                      <Text style={styles.modalOptionDesc}>
                        We'll let employees at{" "}
                        {pendingJob?.company ?? "this company"} know and notify
                        you the moment someone signs on.
                      </Text>
                    </View>
                    {isRequestingSponsor ? (
                      <ActivityIndicator size="small" color={tokens.colors.textMuted} />
                    ) : (
                      <ChevronRight color={tokens.colors.textFaint} size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {applyStep === "requested" && (
                <View style={styles.successContainer}>
                  <View style={styles.successCircleLarge}>
                    <Check color={tokens.colors.brandText} size={40} strokeWidth={3} />
                  </View>
                  <Text style={styles.successMessage}>
                    {`This role doesn't have a dedicated sponsor yet, but your request has been sent to everyone we have available at ${pendingJob?.company ?? "this company"}. If someone is able to sponsor you for this role, you'll be notified right away.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.successActionBtn}
                    onPress={handleApplyModalDone}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.successActionBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        visible={showProfileCompletionModal}
        onClose={() => setShowProfileCompletionModal(false)}
        profileCompletion={profileCompletion}
        onGoToProfile={() => {
          setShowProfileCompletionModal(false);
          onNavigateToProfile?.();
        }}
        onTesterMode={() => {
          trackTesterModeEnabled({ source: "profile_completion_modal" });
          setIsTester(true);
          setShowProfileCompletionModal(false);
        }}
      />

      {/* Job Switcher Modal — sponsor picks which sponsored role the deck
          represents. Selection updates activeSponsoredJobId (re-fetches the
          profile pack relevant to that role) and resets the deck index so
          they start from card 1 of the new pack. */}
      <Modal visible={showJobSwitcher} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.jobSwitcherOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowJobSwitcher(false)}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => setShowJobSwitcher(false)}
            fullSheetGesture
            style={styles.jobSwitcherSheet}
          >
            <Text style={styles.jobSwitcherSheetTitle}>Switch role</Text>
            <Text style={styles.jobSwitcherSheetSubtitle}>
              Pick which sponsored role to review applicants for. We'll match
              them with that role when you swipe right.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ marginTop: 8 }}
            >
              {sponsoredJobs.map((job) => {
                const isActive = job.jobId === activeSponsoredJobId;
                const count = job.likesCount ?? 0;
                return (
                  <TouchableOpacity
                    key={job.jobId}
                    style={[
                      styles.jobSwitcherRow,
                      isActive && styles.jobSwitcherRowActive,
                    ]}
                    onPress={() => {
                      if (!isActive) {
                        setActiveSponsoredJobId(job.jobId);
                        // Fresh pack for the new role — start at card 1.
                        resetNavigation();
                      }
                      setShowJobSwitcher(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.jobSwitcherRowTitle}
                        numberOfLines={1}
                      >
                        {job.title || "Untitled role"}
                      </Text>
                      {!!job.company && (
                        <Text
                          style={styles.jobSwitcherRowCompany}
                          numberOfLines={1}
                        >
                          {job.company}
                        </Text>
                      )}
                    </View>
                    {/* Pending-applicant signal — same pill shape across
                        every row so the eye can scan high/low counts
                        easily. Active counts render as black-bg/white-fg
                        ("12"); zero is the same shape but muted gray ("0").
                        Visual rhythm beats descriptive copy here. */}
                    <View
                      style={[
                        styles.jobSwitcherCountBadge,
                        count === 0 && styles.jobSwitcherCountBadgeMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.jobSwitcherCountBadgeText,
                          count === 0 && styles.jobSwitcherCountBadgeTextMuted,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Verification Modal — sponsors must verify work email before
          swiping. Soft gate: closing the modal just blocks swiping; the user
          can still navigate to other tabs (Profile etc.) to fix things. */}
      <Modal
        visible={showEmailVerificationModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowEmailVerificationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.emailVerifOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              // Reset the inline edit state so the modal reopens fresh.
              setIsEditingWorkEmail(false);
              setEditedWorkEmail("");
              setEmailVerifyError("");
              setShowEmailVerificationModal(false);
            }}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>

          <DismissibleSheet
            onDismiss={() => {
              setIsEditingWorkEmail(false);
              setEditedWorkEmail("");
              setEmailVerifyError("");
              setShowEmailVerificationModal(false);
            }}
            fullSheetGesture
            style={styles.emailVerifModal}
          >
            <View style={styles.emailVerifIconCircle}>
              <Mail color={tokens.colors.brandText} size={32} strokeWidth={1.5} />
            </View>

            <Text style={styles.emailVerifTitle}>Verify Your Work Email</Text>

            {(() => {
              const displayedEmail =
                pendingWorkEmail ?? profileData.personal.workEmail ?? "";
              if (isEditingWorkEmail) {
                return (
                  <View style={styles.emailVerifEditBlock}>
                    <Text style={styles.emailVerifEditLabel}>
                      Update your work email
                    </Text>
                    <TextInput
                      value={editedWorkEmail}
                      onChangeText={setEditedWorkEmail}
                      placeholder="name@company.com"
                      placeholderTextColor={tokens.colors.textFaint}
                      style={styles.emailVerifEditInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    <View style={styles.emailVerifEditActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditingWorkEmail(false);
                          setEditedWorkEmail("");
                          setEmailVerifyError("");
                        }}
                        style={styles.emailVerifEditCancel}
                        activeOpacity={0.7}
                        disabled={emailVerifyLoading}
                      >
                        <Text style={styles.emailVerifEditCancelText}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          const trimmed = editedWorkEmail.trim();
                          if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
                            setEmailVerifyError(
                              "That doesn't look like a valid email.",
                            );
                            return;
                          }
                          setEmailVerifyLoading(true);
                          setEmailVerifyError("");
                          try {
                            // Two coordinated backend calls + a local mirror:
                            //   1. PATCH sponsor profile so the backend
                            //      persists work_email immediately and
                            //      auto-flips work_email_verified=FALSE
                            //      (services/profiles.py:162). Without this
                            //      the column doesn't update until the user
                            //      clicks the verification link.
                            //   2. Send the verification email — backend
                            //      embeds the email in a JWT; on link click
                            //      it re-saves and flips verified=TRUE.
                            // Run them in parallel since they're independent.
                            await Promise.all([
                              authApi.updateWorkEmail(trimmed),
                              authApi.sendWorkEmailVerification(trimmed),
                            ]);
                            await setPendingWorkEmail(trimmed);
                            // Mirror to data.personal.workEmail so ProfileView
                            // reflects the new address immediately without
                            // waiting for a full profile refetch.
                            await updatePersonalStore({ workEmail: trimmed });
                            setIsEditingWorkEmail(false);
                            setEditedWorkEmail("");
                            setEmailVerifyError(`Sent! Check ${trimmed}.`);
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : "Couldn't send.";
                            setEmailVerifyError(
                              msg.toLowerCase().includes("rate")
                                ? "Too many sends — please wait a bit and try again."
                                : "Couldn't send to that address. Please try again.",
                            );
                          } finally {
                            setEmailVerifyLoading(false);
                          }
                        }}
                        style={styles.emailVerifEditSave}
                        activeOpacity={0.8}
                        disabled={emailVerifyLoading}
                      >
                        {emailVerifyLoading ? (
                          <ActivityIndicator size="small" color={tokens.colors.brandText} />
                        ) : (
                          <Text style={styles.emailVerifEditSaveText}>
                            Save & resend
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              return (
                <>
                  <Text style={styles.emailVerifSubtitle}>
                    To start discovering candidates, verify the link we sent to{" "}
                    <Text style={styles.emailVerifAddress}>
                      {displayedEmail || "your work address"}
                    </Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditedWorkEmail(displayedEmail);
                      setIsEditingWorkEmail(true);
                      setEmailVerifyError("");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emailVerifEditLink}>
                      Wrong email? Update it
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            <View style={styles.emailVerifInfoBox}>
              <Text style={styles.emailVerifInfoText}>
                This keeps the network trusted — every candidate knows they're
                talking to a real, verified professional.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.emailVerifPrimaryBtn}
              onPress={() => Linking.openURL("message:")}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifPrimaryBtnText}>
                Open Email App
              </Text>
              <ChevronRight color={tokens.colors.brandText} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailVerifSecondaryBtn}
              onPress={async () => {
                setEmailVerifyLoading(true);
                setEmailVerifyError("");
                try {
                  await fetchFromBackend();
                  const isNowVerified =
                    useUserProfileStore.getState().workEmailVerified;
                  if (isNowVerified) {
                    setShowEmailVerificationModal(false);
                  } else {
                    setEmailVerifyError(
                      "Still pending — please click the link in your inbox.",
                    );
                  }
                } catch {
                  setEmailVerifyError(
                    "Could not check status. Please try again.",
                  );
                } finally {
                  setEmailVerifyLoading(false);
                }
              }}
              disabled={emailVerifyLoading}
              activeOpacity={0.8}
            >
              {emailVerifyLoading ? (
                <ActivityIndicator size="small" color={tokens.colors.text} />
              ) : (
                <Text style={styles.emailVerifSecondaryBtnText}>
                  I've Verified My Email
                </Text>
              )}
            </TouchableOpacity>

            {emailVerifyError ? (
              <Text style={styles.emailVerifErrorText}>{emailVerifyError}</Text>
            ) : null}

            {/* Resend (PR #42) — re-trigger the verification email if the user
              never received it. Prefers the in-modal pendingWorkEmail (the
              corrected address from the "Update it" flow) over whatever's on
              file. Backend rate-limits to 5/hour per user. */}
            <TouchableOpacity
              style={styles.emailVerifTesterBtn}
              onPress={async () => {
                const workEmail =
                  pendingWorkEmail ?? profileData.personal.workEmail;
                if (!workEmail) {
                  setEmailVerifyError(
                    "We don't have a work email on file. Tap 'Update it' to add one.",
                  );
                  return;
                }
                setEmailVerifyError("");
                try {
                  await authApi.sendWorkEmailVerification(workEmail);
                  setEmailVerifyError("Sent! Check your inbox.");
                } catch (err) {
                  const msg =
                    err instanceof Error ? err.message : "Couldn't resend.";
                  setEmailVerifyError(
                    msg.toLowerCase().includes("rate")
                      ? "Too many resends — please wait a bit and try again."
                      : "Couldn't resend. Please try again.",
                  );
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifTesterBtnText}>Resend email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailVerifTesterBtn}
              onPress={() => {
                trackTesterModeEnabled({ source: "email_verification_modal" });
                setIsTester(true);
                setShowEmailVerificationModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emailVerifTesterBtnText}>I am a tester</Text>
            </TouchableOpacity>
          </DismissibleSheet>
        </KeyboardAvoidingView>
      </Modal>

      {/* Description Modal */}
      <Modal
        visible={showDescriptionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDescriptionModal(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowDescriptionModal(false)}
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
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: tokens.colors.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 40,
            maxHeight: "50%",
            shadowColor: tokens.colors.brand,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {/* Drag Handle */}
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: tokens.colors.borderStrong,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 28,
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: tokens.colors.bgSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Briefcase color={tokens.colors.text} size={20} />
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: tokens.fontFamilies.serif,
                    fontSize: 24,
                    lineHeight: 28,
                    color: tokens.colors.text,
                    letterSpacing: -0.4,
                  }}
                >
                  About the Role
                </Text>
                <Text
                  style={{
                    fontFamily: tokens.fontFamilies.sans500,
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {currentData && "company" in currentData
                    ? currentData.company
                    : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowDescriptionModal(false)}
              style={{
                width: 36,
                height: 36,
                backgroundColor: tokens.colors.bgSurface,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.7}
            >
              <X color={tokens.colors.textBody} size={18} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: tokens.colors.border,
              marginHorizontal: 28,
              marginVertical: 20,
            }}
          />

          {/* Content */}
          <ScrollView
            style={{ maxHeight: "100%", paddingHorizontal: 28 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              style={{
                fontFamily: tokens.fontFamilies.sans400,
                fontSize: 16,
                lineHeight: 26,
                color: tokens.colors.textBody,
                letterSpacing: -0.1,
              }}
            >
              {currentData && "description" in currentData
                ? currentData.description
                : ""}
            </Text>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Full Bio Modal */}
      <Modal
        visible={showFullBio}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullBio(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowFullBio(false)}
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
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: tokens.colors.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 40,
            maxHeight: "75%",
            shadowColor: tokens.colors.brand,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: tokens.colors.borderStrong,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 28,
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: tokens.colors.bgSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Info color={tokens.colors.text} size={20} />
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: tokens.fontFamilies.serif,
                    fontSize: 24,
                    lineHeight: 28,
                    color: tokens.colors.text,
                    letterSpacing: -0.4,
                  }}
                >
                  About
                </Text>
                <Text
                  style={{
                    fontFamily: tokens.fontFamilies.sans500,
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {currentData && "name" in currentData
                    ? (currentData as any).name
                    : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowFullBio(false)}
              style={{
                width: 36,
                height: 36,
                backgroundColor: tokens.colors.bgSurface,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.7}
            >
              <X color={tokens.colors.textBody} size={18} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: tokens.colors.border,
              marginHorizontal: 28,
              marginVertical: 20,
            }}
          />

          <ScrollView
            style={{ paddingHorizontal: 28 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              style={{
                fontFamily: tokens.fontFamilies.sans400,
                fontSize: 16,
                lineHeight: 26,
                color: tokens.colors.textBody,
                letterSpacing: -0.1,
              }}
            >
              {(() => {
                if (!currentData) return "";
                const uid = (currentData as any)?.USER_ID;
                const cachedBio = uid && fullProfileCache[String(uid)]?.bio;
                if (cachedBio) return cachedBio;
                return "bio" in currentData ? currentData.bio : "";
              })()}
            </Text>
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 36, paddingBottom: 100 },
  // 2026-05-26 Hinge-style redesign — layout primitives.
  // `pageContainer` is the flex-column that holds the sticky header,
  // the active profile scroll, and the sticky bottom action bar.
  pageContainer: { flex: 1, paddingHorizontal: 24 },
  // Each non-active deck state (empty / loading / no-applicants etc.)
  // fills the page beneath the header with its centered illustration.
  fullEmptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  // The fade/translate wrapper around the active profile scroll. Drives
  // the cross-fade between deck entries via `mainAnimatedStyle`.
  profileFader: { flex: 1 },
  // Vertical scroll for the active profile. Bottom padding leaves room
  // for the sticky action bar so the last section isn't covered.
  profileScrollContent: { paddingBottom: 120, paddingTop: 4 },

  // ── Hero (applicant identity / job identity) ──────────────────────
  hingeHero: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  hingeHeroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tokens.colors.border,
  },
  hingeHeroAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  hingeHeroAvatarInitial: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 34,
    color: tokens.colors.brandText,
  },
  hingeHeroName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 30,
    lineHeight: 34,
    color: tokens.colors.text,
    letterSpacing: -0.6,
    marginTop: 16,
    textAlign: "center",
  },
  hingeHeroSubtitle: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    marginTop: 4,
  },
  hingeHeroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },

  // ── "Liked your role" top-of-card pill ────────────────────────────
  likedYourRoleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },

  // ── Section primitives ────────────────────────────────────────────
  hingeDivider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: 4,
  },
  hingeSection: { paddingVertical: 18 },
  hingeSectionLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  hingeBodyText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 15,
    color: tokens.colors.text,
    lineHeight: 23,
  },

  // ── At-a-glance stats strip (sponsor view) ────────────────────────
  hingeStatsRow: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    paddingVertical: 14,
    marginVertical: 8,
  },
  hingeStatCell: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: tokens.colors.border,
  },
  hingeStatCellLast: { borderRightWidth: 0 },
  hingeStatValue: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    lineHeight: 28,
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  hingeStatLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    marginTop: 4,
    textTransform: "uppercase",
  },

  // ── Insight Q&A cards — quote-style with vertical accent ──────────
  // White card with a soft drop shadow + thin hairline border for
  // depth (instead of the prior gray-on-gray look that disappeared
  // into the page). A 3px black stripe runs the full height of the
  // left edge as a brand accent — the only color is monochrome, but
  // the stripe gives the card a strong sense of authorship ("here are
  // the applicant's actual words"). A large opening quote mark next
  // to the answer plays the same role typographically.
  hingeInsightCard: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  hingeInsightAccent: {
    width: 3,
    backgroundColor: tokens.colors.brand,
  },
  hingeInsightBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  hingeInsightQuestion: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.colors.textMuted,
    letterSpacing: 1.0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  hingeInsightAnswerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hingeInsightQuoteMark: {
    fontSize: 36,
    lineHeight: 30,
    fontWeight: "800",
    color: tokens.colors.text,
    marginRight: 8,
    marginTop: -2,
  },
  hingeInsightAnswer: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: tokens.colors.text,
    lineHeight: 24,
  },

  // ── Job-brief cards (role-spec insights from the sponsor) ─────────
  // Same depth treatment as the sponsor's quote cards (white bg, soft
  // shadow, hairline border), but a totally different visual rhythm:
  // a dark "header strip" at the top carries the label, then body
  // text below. Reads as a formal documented brief rather than a
  // personal quote — distinct enough at a glance that the user knows
  // this is "what the sponsor wrote ABOUT the role" vs. "what the
  // sponsor said in their own words".
  jobInsightCard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  jobInsightHeader: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  jobInsightHeaderLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  jobInsightBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  jobInsightBodyText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 15,
    color: tokens.colors.text,
    lineHeight: 23,
  },

  // ── Chip wrapping (skills, credentials, role details) ─────────────
  hingeChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hingeSkillChip: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  hingeSkillChipText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },

  // ── Timeline (experience, education) ──────────────────────────────
  hingeTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  hingeTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: tokens.colors.brand,
    marginTop: 7,
  },
  hingeTimelineBody: { flex: 1, minWidth: 0 },
  hingeTimelineTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  hingeTimelineSubtitle: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 14,
    color: tokens.colors.text,
    marginTop: 2,
  },
  hingeTimelineMeta: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 3,
  },
  hingeTimelineDescription: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 21,
    marginTop: 8,
  },

  // ── Credential blocks (certifications, languages) ─────────────────
  hingeCredentialList: { gap: 12 },
  hingeCredentialBlock: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  hingeCredentialName: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 14,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  hingeCredentialMeta: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 3,
  },

  // ── Status banner (waitlisted / applied / sponsor-requested) ──────
  statusBannerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.colors.brandText,
    letterSpacing: 0.4,
  },

  // ── "No sponsor yet" inline block (applicant view) ────────────────
  noSponsorInlineBlock: {
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  // ── Sponsor zone card (sponsored jobs — distinct section) ─────────
  sponsorZoneOuter: { paddingVertical: 18 },
  sponsorZoneCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  sponsorZoneHeader: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderBottomWidth: tokens.borders.hairline,
    borderBottomColor: tokens.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sponsorZoneHeaderText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sponsorZoneBody: { padding: 16 },
  sponsorZoneDivider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: 16,
  },
  // "SPONSOR INSIGHTS" sub-label — personal voice
  sponsorZoneQALabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  // "JOB INSIGHTS" sub-label
  sponsorZoneJobLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.text,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sponsorZoneQACard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
  },

  // ── Meet your sponsor inline block ────────────────────────────────
  sponsorMeetInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sponsorMeetAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.border,
  },
  sponsorMeetAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorMeetAvatarInitial: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    color: tokens.colors.brandText,
  },
  sponsorMeetName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 22,
    lineHeight: 26,
    color: tokens.colors.text,
    letterSpacing: -0.3,
  },
  sponsorMeetRole: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    marginTop: 2,
  },

  // ── Floating action buttons (Hinge-style) ────────────────────────
  // Two free-standing circular buttons that sit on top of the scroll
  // content. The row is absolute so it stays pinned to the bottom of
  // the page while the scroll content flows freely behind it.
  // `pointerEvents="box-none"` on this wrapper (set on the JSX) means
  // taps in the gap between buttons fall through to the underlying
  // scroll, while the circles themselves still catch their own taps.
  floatingActionsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 28 : 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  floatingPassBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    // Drop shadow so the white circle reads against light content
    // underneath. Subtle to keep the brand minimal.
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  floatingConnectBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 12,
  },
  progressHeaderContainer: { flex: 1 },
  // 2026-05-27 redesign — progress indicator typography + segmented dots.
  //
  // The label row stacks a large bold current-card number against a thin
  // gray "/N" suffix (e.g. "3" + "/10"), matching the modern app pattern
  // used by Hinge / Bumble / similar swipe-decks. Below it, a row of 10
  // equal-width pill segments (one per card in DECK_SIZE) lights up
  // as the user advances — past cards filled black, current card filled
  // black, future cards a soft gray. Reads as a "deck remaining" gauge
  // rather than a generic loading bar, which fits the rest of the
  // deck-of-cards branding language in the app.
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    marginBottom: 8,
  },
  progressCurrent: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 22,
    lineHeight: 24,
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  progressTotal: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  progressDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: tokens.colors.border,
  },
  progressDotFilled: {
    backgroundColor: tokens.colors.brand,
  },

  // 2026-05-27 redesign — Role switcher pill (sponsor-only).
  //
  // Replaces the prior low-contrast outlined chip with a filled black
  // pill that reads as a primary affordance (same language as the
  // floating Connect button + sponsor empty-state CTAs). When the
  // active role has pending applicants, a compact white-on-darker
  // count badge appears inline — the most important signal lives
  // directly in the header. Long titles still truncate gracefully
  // because the title text wraps in a flex-shrink wrapper.
  roleSwitcherPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: tokens.radii.pill,
    maxWidth: 220,
    gap: 8,
  },
  roleSwitcherTitle: {
    flexShrink: 1,
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 13,
    color: tokens.colors.text,
    letterSpacing: -0.1,
  },
  roleSwitcherBadge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSwitcherBadgeText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 10,
    color: tokens.colors.brandText,
    letterSpacing: 0.2,
  },
  // Modal: bottom sheet, content-sized, listing all sponsored jobs.
  // Matches the matches-screen modal aesthetic (40px top radius, 28px
  // padding) for visual consistency with the other DismissibleSheets.
  jobSwitcherOverlay: { flex: 1, justifyContent: "flex-end" },
  jobSwitcherSheet: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    // Absolute px (not "70%") because the sheet sits inside
    // DismissibleSheet's GestureHandlerRootView wrapper, which is
    // content-sized. A % maxHeight against it would resolve to 0 / clip
    // content — same fix we applied to MatchesView's modalContent.
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  jobSwitcherSheetTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 28,
    lineHeight: 32,
    color: tokens.colors.text,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  jobSwitcherSheetSubtitle: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  jobSwitcherRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: tokens.radii.ml,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.bgOffWhite,
    marginBottom: 8,
  },
  // Subtle active state — ink border (no fill) so the row reads as
  // "currently selected" without competing with content underneath.
  jobSwitcherRowActive: {
    borderColor: tokens.colors.brand,
    borderWidth: 1.5,
    backgroundColor: tokens.colors.bg,
  },
  jobSwitcherRowTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  jobSwitcherRowCompany: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    marginTop: 2,
  },
  // Count badge — pending applicants for a sponsored role. Same shape
  // regardless of count so the eye finds the high numbers fast; zero
  // counts use the muted variant below.
  jobSwitcherCountBadge: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  jobSwitcherCountBadgeMuted: {
    backgroundColor: tokens.colors.border,
  },
  jobSwitcherCountBadgeText: {
    color: tokens.colors.brandText,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  jobSwitcherCountBadgeTextMuted: {
    color: tokens.colors.textMuted,
  },

  // Modal Styles
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  modalTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 28,
    lineHeight: 32,
    color: tokens.colors.text,
    letterSpacing: -0.5,
  },
  closeModalBtn: {
    padding: 4,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: 20,
  },
  modalContent: { padding: 28, paddingBottom: 40 },
  modalFooter: {
    padding: 28,
    borderTopWidth: tokens.borders.hairline,
    borderTopColor: tokens.colors.border,
    gap: 16,
  },
  applyBtn: {
    backgroundColor: tokens.colors.brand,
    height: 56,
    borderRadius: tokens.radii.m,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  applyBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.brandText,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  clearBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  clearBtnText: {
    fontFamily: tokens.fontFamilies.sans500,
    color: tokens.colors.textMuted,
    fontSize: 14,
  },
  title: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 38,
    lineHeight: 42,
    color: tokens.colors.text,
    letterSpacing: -0.8,
  },
  cardContainer: { marginBottom: 24 },
  cardOuter: {
    borderRadius: 24,
    backgroundColor: tokens.colors.bg,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.brand,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
      },
      android: { elevation: 18 },
    }),
  },
  cardOuterBack: { backgroundColor: tokens.colors.bgOffWhite },
  cardInner: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    height: 460,
  },
  cardInnerBack: { backgroundColor: tokens.colors.bgOffWhite },

  // Waitlisted overlay
  waitlistedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  waitlistedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.brand,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  waitlistedBadgeText: {
    color: tokens.colors.brandText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  appliedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.brand,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  appliedBadgeText: {
    color: tokens.colors.brandText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Layout: Image on Left + Details on Right
  profileCardTop: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  profileImageSquare: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
  },
  companyImageSquare: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
  },
  profileInfoColumn: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },

  // Name Header - Full Width Below Image Section
  profileNameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  profileNameTop: {
    flex: 1,
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 24,
    lineHeight: 28,
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  sponsorTag: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  sponsorTagText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sponsorTagMuted: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  sponsorTagMutedText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textFaint,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  profileRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileRole: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 13,
    color: tokens.colors.textBody,
    flex: 1,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  companyPill: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  companyPillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  profileLocation: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  profileExperience: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },

  // Content Section
  profileCardContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 16,
  },
  descriptionSection: {
    gap: 8,
  },
  sectionLabelSmall: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  descriptionText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.text,
    lineHeight: 22,
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  readMoreBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 12,
    color: tokens.colors.text,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // ── Centered-profile card front face (redesign) ──
  // Circular avatar + centered identity + centered fact pills, with a
  // left-aligned ABOUT block below. Shared by the sponsor view (applicant
  // profile cards) and the applicant view (job cards).
  heroCentered: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.border,
  },
  heroAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarInitial: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 30,
    color: tokens.colors.brandText,
  },
  heroName: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 26,
    lineHeight: 30,
    color: tokens.colors.text,
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 14,
  },
  heroSubtitle: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 13,
    color: tokens.colors.textBody,
    textAlign: "center",
    marginTop: 4,
  },
  heroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  // "Liked your role" badge at the top of a sponsor's profile-pack card.
  // Soft success-tinted pill so the high-conviction signal reads as an
  // editorial highlight rather than a colour-block.
  likedYourRolePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    backgroundColor: tokens.colors.successBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginBottom: 10,
  },
  likedYourRolePillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.successFg,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroPillText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  // Accent pill — used for the AI-match score. Soft info-tinted pill so it
  // signals "high signal" without competing with the headline.
  heroPillAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.infoBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.infoBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  heroPillAccentText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.infoFg,
    letterSpacing: 0.4,
  },
  // Sponsorship status pill (job cards only).
  heroStatusSponsored: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.successBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginTop: 10,
  },
  heroStatusSponsoredText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.successFg,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroStatusMuted: {
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginTop: 10,
  },
  heroStatusMutedText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroAboutBlock: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 8,
  },
  // "Meet your sponsor" back face — centered sponsor identity block.
  sponsorMeetHero: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },
  // The sponsor's own-words Q&A section beneath the trust strip.
  sponsorWordsSection: {
    marginTop: 16,
    gap: 14,
  },
  skillsSection: {
    gap: 10,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChipSmall: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skillChipSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.colors.text,
  },

  // Back Card Insights
  insightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  // Section header on the back of the card (JOB SPONSOR, INSIGHTS) —
  // matches the front card's "ABOUT" label (sectionLabelSmall) so the
  // two faces share one type system.
  insightSectionLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  // Legacy styles (keep for backward compatibility)
  imageWrapperRedesign: {
    height: 180,
    backgroundColor: tokens.colors.bgOffWhite,
    position: "relative",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 40,
  },
  nameTagCard: {
    gap: 4,
  },
  nameTextCard: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.brandText,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleTextCard: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.brandText,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Company & Location Badges
  companyLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  companyBadge: {
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  companyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.colors.brandText,
    letterSpacing: 0.3,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },

  // Summary Content
  summaryLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 4,
  },
  mentalityText: {
    fontFamily: tokens.fontFamilies.serifItalic,
    fontSize: 16,
    color: tokens.colors.text,
    lineHeight: 24,
  },

  // Detail Sections (for back of card)
  // Flat block — no shadow. The expanded-details list reads as a clean
  // stack of bordered sections rather than a pile of floating cards.
  detailSection: {
    backgroundColor: tokens.colors.bg,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 12,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  detailSectionTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    textTransform: "uppercase",
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: tokens.colors.text,
    letterSpacing: 1,
  },
  detailSectionText: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 21,
    fontWeight: "500",
  },

  // Legacy styles (keep for backward compatibility)
  cardHeader: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: 14,
    backgroundColor: tokens.colors.bgOffWhite,
  },
  profileImageCompact: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
    borderWidth: 2,
    borderColor: tokens.colors.bg,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  companyTextBold: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 13,
    color: tokens.colors.text,
    letterSpacing: -0.1,
  },
  infoFloatingBtnCompact: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colors.bg,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },

  cardContentExpanded: {
    padding: 20,
    gap: 18,
    flex: 1,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  bioTextExpanded: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.text,
    lineHeight: 22,
  },
  insightPreviewText: {
    fontFamily: tokens.fontFamilies.sans400Italic,
    fontSize: 13,
    color: tokens.colors.textBody,
    lineHeight: 20,
  },
  promptPreviewText: {
    fontFamily: tokens.fontFamilies.sans400Italic,
    fontSize: 13,
    color: tokens.colors.textBody,
    lineHeight: 20,
  },
  tapForMoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginTop: "auto",
  },
  tapForMoreText: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Legacy styles (keep for backward compatibility with other parts)
  imageWrapper: { height: 220, backgroundColor: tokens.colors.bgOffWhite },
  profileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  infoFloatingBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 6,
    borderRadius: 8,
  },
  cardInfo: { padding: 24 },
  // Back-face content padding. Bottom is trimmed so the insights preview
  // (up to 4 subsections + the expand hint) fits the fixed card height.
  cardInfoScrollable: { padding: 24, paddingBottom: 20 },
  nameText: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  metaText: { fontSize: 12, fontWeight: "600", color: tokens.colors.text },
  locationText: { fontSize: 12, color: tokens.colors.textBody, fontWeight: "500" },
  divider: { height: 1, backgroundColor: tokens.colors.border, marginVertical: 10 },
  bioText: { fontSize: 15, color: tokens.colors.textBody, lineHeight: 22 },
  expandedDetails: { marginBottom: 32, gap: 14 },

  // New Experience Card Styles
  experienceCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 12,
  },
  experienceTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  experienceDates: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  experienceCompany: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 14,
    color: tokens.colors.textBody,
    marginBottom: 8,
  },
  experienceDescription: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    lineHeight: 20,
  },

  // Education Card Styles
  educationCard: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  educationDegree: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 15,
    color: tokens.colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  educationSchool: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 14,
    color: tokens.colors.textBody,
    marginBottom: 6,
  },
  educationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  educationYear: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  educationGpa: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 12,
    color: tokens.colors.textBody,
  },

  // Certifications Grid
  certificationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  certificationBadge: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    minWidth: "48%",
    flexGrow: 1,
    maxWidth: "100%",
  },
  certificationName: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 13,
    color: tokens.colors.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  certificationDetails: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },

  // Languages Grid
  languagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageBadge: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  languageName: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 13,
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  languageProficiency: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },

  // Achievements Text
  achievementsText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 22,
  },

  // Job Detail Card (for expanded job details)
  jobDetailCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  jobDetailText: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 22,
  },

  detailItem: {
    backgroundColor: tokens.colors.bg,
    padding: 20,
    borderRadius: tokens.radii.ml,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  detailTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 11,
    textTransform: "uppercase",
    color: tokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  detailBody: {
    fontFamily: tokens.fontFamilies.sans400,
    color: tokens.colors.textBody,
    fontSize: 14,
    lineHeight: 21,
  },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: tokens.colors.brand, borderColor: tokens.colors.brand },
  // Primary CTA — a gentle, diffuse lift rather than a hard drop shadow,
  // so it reads as "the main action" without clashing with the now-flat
  // detail sections.
  primaryActionBtn: {
    flex: 1,
    height: 56,
    backgroundColor: tokens.colors.brand,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryActionLabel: {
    color: tokens.colors.brandText,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // BACK OF CARD (INSIGHTS)
  backHeader: { marginBottom: 24 },
  backTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.5,
  },

  // Redesigned Prompt Cards
  promptCard: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  promptIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  promptIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  promptQuestion: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: tokens.colors.textBody,
    letterSpacing: 1,
    textTransform: "uppercase",
    lineHeight: 14,
  },
  promptAnswer: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.text,
    lineHeight: 24,
    letterSpacing: -0.2,
  },

  // Redesigned applicant back-of-card
  applicantBackScroll: { padding: 20, paddingBottom: 40 },
  applicantBackIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  applicantBackPhoto: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
  },
  applicantBackIdentityText: { flex: 1, gap: 2 },
  applicantBackName: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  applicantBackRole: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  applicantBackLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  applicantBackLocationText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: "500",
  },

  applicantBackStatsRow: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 14,
    marginBottom: 24,
  },
  applicantBackStatCell: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: tokens.colors.border,
  },
  applicantBackStatCellLast: {
    borderRightWidth: 0,
  },
  applicantBackStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  applicantBackStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },

  applicantBackSection: { marginBottom: 24 },
  applicantBackSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  applicantBackSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: 1.4,
  },

  applicantBackLoadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  applicantBackLoadingText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: "500",
  },
  applicantBackEmptyWrap: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  applicantBackEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    marginTop: 4,
  },
  applicantBackEmptyBody: {
    fontSize: 12,
    color: tokens.colors.textFaint,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // Insight (prompt) cards — quote-bar style
  insightQuoteCard: {
    flexDirection: "row",
    backgroundColor: tokens.colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  insightQuoteAccent: {
    width: 3,
    backgroundColor: tokens.colors.brand,
  },
  insightQuoteContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  insightQuoteQuestion: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  insightQuoteAnswer: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.text,
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  // Experience timeline
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineDotWrap: {
    width: 12,
    alignItems: "center",
    paddingTop: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.brand,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: tokens.colors.border,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    gap: 2,
  },
  timelineRole: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  timelineCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  timelineDates: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },

  // Education (back-of-card)
  eduBackCard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 2,
  },
  eduBackSchool: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  eduBackDegree: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  eduBackYear: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },

  // Achievements (back-of-card)
  achievementsBackCard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  achievementsBackText: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.colors.text,
    lineHeight: 20,
  },

  // Languages
  languagePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  languagePillName: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  languagePillProf: {
    fontSize: 11,
    fontWeight: "500",
    color: tokens.colors.textMuted,
  },

  insightSection: { marginBottom: 24 },
  // Centered "chapter" header for the INSIGHTS block on the back of the
  // card — uppercase label flanked by hairline rules.
  insightsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  insightsHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.colors.border,
  },
  insightsHeaderCentered: {
    fontSize: 11,
    fontWeight: "900",
    color: tokens.colors.text,
    letterSpacing: 1.6,
  },
  // Expand affordance under the insights preview — mirrors the front
  // card's "Read more" so the down-chevron's purpose is discoverable.
  insightsExpandHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 16,
  },
  insightsExpandHintText: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  // Sub-label inside the INSIGHTS section (DAY-TO-DAY, TEAM CULTURE…) —
  // matches the app's small uppercase label convention.
  insightLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  // Body copy — aligned to the app's standard body text (descriptionText /
  // ProfileDetailSheet body): 14px / 500 / #333. Was 16/600/#000, which
  // ran heavier and larger than the rest of the app.
  insightContent: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.text,
    lineHeight: 21,
  },

  // PROMPTS (Legacy)
  promptWrapper: { marginBottom: 24, paddingLeft: 2 },
  promptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  promptContent: {
    fontSize: 16,
    fontWeight: "500",
    color: tokens.colors.textBody,
    fontStyle: "italic",
    lineHeight: 24,
  },

  overlayCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    zIndex: 10000,
  },
  celebrationCard: {
    width: "100%",
    backgroundColor: tokens.colors.bg,
    padding: 40,
    borderRadius: 32,
    alignItems: "center",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 15,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  celebrationTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 30,
    lineHeight: 34,
    color: tokens.colors.text,
    letterSpacing: -0.6,
  },
  celebrationSub: {
    fontFamily: tokens.fontFamilies.sans300,
    fontSize: 16,
    color: tokens.colors.textBody,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 28,
    lineHeight: 32,
    color: tokens.colors.text,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: tokens.fontFamilies.sans300,
    fontSize: 16,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
    maxWidth: 360,
  },
  returnBtn: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  returnBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText, letterSpacing: -0.1 },
  primaryBtn: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    flex: 1,
  },
  primaryBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText,
    fontSize: 15, letterSpacing: -0.1 },
  secondaryBtn: {
    backgroundColor: tokens.colors.bgSurface,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  secondaryBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.text,
    fontSize: 15, letterSpacing: -0.1 },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    paddingHorizontal: 20,
  },

  // ── Sponsor empty states (modern redesign) ────────────────────────
  // Container is similar to `emptyState` but with more breathing room,
  // wider max content area, and styling primitives shared across both
  // sponsor empty states ("Build your deck" + "Out in the wild").
  sponsorEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    width: "100%",
    maxWidth: 380,
  },

  // Stacked-deck illustration — three nested rounded squares offset
  // like a deck of cards, the front one carrying an icon. Replaces
  // the generic gray icon circle for the "Build your deck" empty
  // state to visually evoke the missing roles.
  emptyDeckIllustration: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  emptyDeckCard: {
    width: 96,
    height: 116,
    borderRadius: 18,
    position: "absolute",
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  emptyDeckCardBack: {
    transform: [{ translateX: 18 }, { translateY: 10 }, { rotate: "8deg" }],
    opacity: 0.55,
  },
  emptyDeckCardMid: {
    transform: [{ translateX: -14 }, { translateY: 4 }, { rotate: "-5deg" }],
    opacity: 0.8,
  },
  emptyDeckCardFront: {
    backgroundColor: tokens.colors.bgSurface,
    borderColor: tokens.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero typography shared by both sponsor empty states.
  sponsorEmptyTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 10,
  },
  sponsorEmptySubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 26,
    paddingHorizontal: 8,
  },

  // Primary CTA — black pill with a trailing chevron, modeled after
  // the floating Connect button so the brand reads consistently.
  sponsorEmptyPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: tokens.colors.brand,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  sponsorEmptyPrimaryText: {
    color: tokens.colors.brandText,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  // Secondary action — outlined, lower visual weight.
  sponsorEmptySecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1.5,
    borderColor: tokens.colors.brand,
  },
  sponsorEmptySecondaryText: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sponsorEmptyActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },

  // ── "LIVE" status pill (pulsing dot) ──────────────────────────────
  // Anchored above the "Out in the wild" state so the user reads
  // "your job is up and running" before "no applicants yet". The
  // dot animates between full opacity and 35% via `livePulseStyle`.
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.colors.bg,
  },
  livePillText: {
    color: tokens.colors.brandText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  // Compact preview of the active sponsored job, anchored under the
  // LIVE pill in the "Out in the wild" state so the sponsor sees
  // exactly which role is being shopped around.
  sponsorWaitingJobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 24,
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sponsorWaitingJobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  sponsorWaitingJobCompany: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.colors.textBody,
    marginTop: 3,
  },

  // ── Referral Check-in Banner ───────────────────────────────────────────────
  checkInBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  checkInBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.brand,
  },
  checkInBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.textBody,
  },
  sponsorHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  sponsorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.bgSurface,
  },
  sponsorName: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  sponsorRole: { fontSize: 13, color: tokens.colors.textBody, marginBottom: 2 },
  sponsorYears: { fontSize: 12, color: tokens.colors.textMuted, marginLeft: 4 },
  canReferBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  canReferText: { fontSize: 12, fontWeight: "700", color: tokens.colors.successFg },
  sponsorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  canReferTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  canReferTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.successFg,
    letterSpacing: 0.2,
  },
  insightBlock: {},
  insightsEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  insightsEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  insightsEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 4,
    textAlign: "center",
  },
  insightsEmptySubtext: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  skillBadge: {
    backgroundColor: tokens.colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillBadgeText: { fontSize: 12, fontWeight: "700", color: tokens.colors.text },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, color: tokens.colors.textBody, flex: 1 },

  // JOB CARD SPECIFIC STYLES
  jobCardContent: { padding: 24, paddingTop: 28 },
  companyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  companyDetails: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "700", color: tokens.colors.text },
  jobTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.colors.text,
    lineHeight: 30,
    marginBottom: 16,
  },
  jobMetaList: { gap: 8, marginBottom: 10 },
  jobMetaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  jobMetaLineText: { fontSize: 14, color: tokens.colors.textBody, fontWeight: "500" },
  infoFloatingBtnSmall: {
    backgroundColor: tokens.colors.bgOffWhite,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  jobDescription: {
    fontSize: 15,
    color: tokens.colors.textBody,
    lineHeight: 22,
    marginBottom: 18,
  },
  skillsPreviewSection: { marginTop: 4 },
  skillsPreviewLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: tokens.colors.textMuted,
    marginBottom: 10,
    letterSpacing: 1,
  },
  skillChip: {
    backgroundColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skillChipMore: { backgroundColor: tokens.colors.brand, borderColor: tokens.colors.brand },
  skillChipText: { fontSize: 12, fontWeight: "700", color: tokens.colors.text },
  skillChipTextWhite: { color: tokens.colors.brandText },

  // Non-Sponsored Back Design
  companyLogoLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  companyDescriptionSection: { marginBottom: 20 },
  companyDescriptionText: {
    fontSize: 15,
    color: tokens.colors.textBody,
    lineHeight: 24,
    fontWeight: "500",
  },
  insightsHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  insightContentSmall: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.textBody,
    lineHeight: 20,
  },
  noSponsorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    padding: 16,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  noSponsorText: {
    fontSize: 13,
    color: tokens.colors.textBody,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
  emptyStateDivider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    alignSelf: "stretch",
    marginVertical: 24,
  },
  noSponsorEmptyState: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Small centered kicker label at the top of the back faces.
  backKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: tokens.colors.textMuted,
    letterSpacing: 1.4,
    textAlign: "center",
    marginBottom: 18,
  },
  // Non-sponsored back — centered "no sponsor yet" status block.
  noSponsorHero: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 8,
  },
  // About-the-company blurb beneath the no-sponsor status block.
  noSponsorAboutBlock: {
    marginTop: 24,
    gap: 8,
  },
  noSponsorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  noSponsorHeadline: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.colors.text,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  noSponsorSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },

  // Apply Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: tokens.colors.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  applyModalContent: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  applyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  applyModalTitle: { fontSize: 24, fontWeight: "800", color: tokens.colors.text },
  applyModalSubtitle: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    marginBottom: 24,
  },
  closeBtn: { padding: 4 },

  modalOptionsContainer: { gap: 12 },
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.bg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionContent: { flex: 1 },
  modalOptionTitle: {
    fontFamily: tokens.fontFamilies.sans600,
    fontSize: 16,
    color: tokens.colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  modalOptionDesc: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 13,
    color: tokens.colors.textBody,
    lineHeight: 20,
  },

  successContainer: { alignItems: "center", paddingVertical: 32 },
  successCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  successActionBtn: {
    backgroundColor: tokens.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    minWidth: 200,
  },
  successActionBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText, fontSize: 16, letterSpacing: -0.1 },

  // Relevance badge & requirements summary
  relevancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  relevancePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.brandText,
    letterSpacing: 0.3,
  },
  requirementsSummaryBlock: {
    marginTop: 12,
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  roleDetailChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: tokens.colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  roleDetailChipText: {
    fontSize: 13,
    color: tokens.colors.text,
    fontWeight: "500" as const,
  },

  // ── Match Celebration Modal ────────────────────────────────────────────────
  matchModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  matchCard: {
    backgroundColor: tokens.colors.bg,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: tokens.colors.brand,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 20,
  },
  matchLabelPill: {
    backgroundColor: tokens.colors.successBg,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.successBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginBottom: 24,
  },
  matchLabelText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.successFg,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  matchAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  matchAvatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
  },
  matchAvatarRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: tokens.colors.brand,
  },
  matchAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: tokens.colors.bg,
  },
  matchAvatarInitial: {
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarInitialText: {
    fontFamily: tokens.fontFamilies.serif,
    color: tokens.colors.brandText,
    fontSize: 30,
  },
  matchSparkWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.bgSurface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  matchTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 32,
    lineHeight: 36,
    color: tokens.colors.text,
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: "center",
  },
  matchSubtitle: {
    fontFamily: tokens.fontFamilies.sans300,
    fontSize: 15,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  matchActions: {
    width: "100%",
    gap: 8,
  },
  matchMsgBtn: {
    backgroundColor: tokens.colors.brand,
    borderRadius: tokens.radii.m,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  matchMsgBtnText: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.brandText,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  matchSkipBtn: {
    borderRadius: tokens.radii.m,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
  },
  matchSkipBtnText: {
    fontFamily: tokens.fontFamilies.sans500,
    color: tokens.colors.textMuted,
    fontSize: 14,
  },

  // Email Verification Modal — overlay anchors the sheet to the bottom of
  // the screen via flex; the sheet itself is content-sized.
  emailVerifOverlay: { flex: 1, justifyContent: "flex-end" },
  emailVerifModal: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
  },
  emailVerifIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  emailVerifTitle: {
    fontFamily: tokens.fontFamilies.serif,
    fontSize: 28,
    lineHeight: 32,
    color: tokens.colors.text,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  emailVerifSubtitle: {
    fontFamily: tokens.fontFamilies.sans400,
    fontSize: 14,
    color: tokens.colors.textBody,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emailVerifAddress: {
    fontFamily: tokens.fontFamilies.sans600,
    color: tokens.colors.text,
  },
  emailVerifInfoBox: {
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  emailVerifInfoText: {
    fontSize: 14,
    color: tokens.colors.textBody,
    lineHeight: 20,
    textAlign: "center",
  },
  emailVerifPrimaryBtn: {
    backgroundColor: tokens.colors.brand,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  emailVerifPrimaryBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.brandText,
    fontSize: 17, letterSpacing: -0.1 },
  emailVerifSecondaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifSecondaryBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.text,
    fontSize: 16, letterSpacing: -0.1 },
  emailVerifErrorText: {
    fontSize: 13,
    color: tokens.colors.dangerFg,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  emailVerifTesterBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emailVerifTesterBtnText: { fontFamily: tokens.fontFamilies.sans600, color: tokens.colors.textMuted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5 },
  // Inline "Wrong email? Update it" affordance + edit form for fixing typos
  // in the modal without leaving the verification flow. Muted gray to match
  // the modal's neutral palette (no bright accent — the existing primary CTA
  // already owns the visual emphasis).
  emailVerifEditLink: {
    color: tokens.colors.textBody,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
    textDecorationLine: "underline",
  },
  emailVerifEditBlock: {
    width: "100%",
    marginVertical: 8,
  },
  emailVerifEditLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.textBody,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emailVerifEditInput: {
    width: "100%",
    fontSize: 15,
    fontWeight: "500",
    color: tokens.colors.text,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: tokens.colors.bgOffWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  emailVerifEditActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  emailVerifEditCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditCancelText: {
    color: tokens.colors.textBody,
    fontSize: 14,
    fontWeight: "600",
  },
  emailVerifEditSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditSaveText: {
    color: tokens.colors.brandText,
    fontSize: 14,
    fontWeight: "700",
  },
});
