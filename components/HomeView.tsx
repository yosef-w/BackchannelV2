import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import {
  Award,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  DollarSign,
  ExternalLink,
  Globe,
  GraduationCap,
  Info,
  MapPin,
  MessageCircle,
  RefreshCcw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
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
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import { checkProfileCompleteness } from "../utils/profileCompletion";
import { JobApplicationWebView } from "./JobApplicationWebView";
import { ProfileCompletionModal } from "./ProfileCompletionModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface HomeViewProps {
  userType: "applicant" | "sponsor";
  onWebViewActiveChange?: (isActive: boolean) => void;
  onNavigateToProfile?: () => void;
}

const DECK_SIZE = 10;

const FILTER_OPTS = {
  applicant: [
    {
      id: "role",
      label: "Target Role",
      options: ["Product", "Engineering", "Design", "Data", "Sales"],
    },
    {
      id: "industry",
      label: "Industry",
      options: ["Tech", "FinTech", "Health", "EdTech", "Media"],
    },
    {
      id: "goal",
      label: "Goal",
      options: ["Referral", "Career Advice", "Resume Review", "Interview Prep"],
    },
  ],
  sponsor: [
    {
      id: "role",
      label: "Role",
      options: [
        "Product Manager",
        "Software Engineer",
        "Designer",
        "Data Scientist",
      ],
    },
    {
      id: "exp",
      label: "Experience",
      options: ["Junior (0-2y)", "Mid (2-5y)", "Senior (5-8y)", "Lead (8y+)"],
    },
    {
      id: "status",
      label: "Status",
      options: ["Actively Looking", "Passive", "Open to Networking"],
    },
  ],
};

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
        icon: <Check size={14} color="#000" />,
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "A micro-loan app that helped 50k+ small businesses in SE Asia.",
        icon: <Award size={14} color="#000" />,
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
        icon: <Zap size={14} color="#000" />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a park ranger in the North Cascades.",
        icon: <Globe size={14} color="#000" />,
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
        icon: <Coffee size={14} color="#000" />,
      },
      {
        question: "WHAT I LOOK FOR IN TALENT",
        answer: "High agency. I want people who don't wait for permission.",
        icon: <Sparkles size={14} color="#000" />,
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
        icon: <Zap size={14} color="#000" />,
      },
      {
        question: "ONE THING THAT SURPRISED ME",
        answer:
          "How much 'traditional' sports can learn from e-sports production.",
        icon: <Info size={14} color="#000" />,
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
        icon: <Check size={14} color="#000" />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a locksmith. It's the same logic, just physical.",
        icon: <Briefcase size={14} color="#000" />,
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
        icon: <Zap size={14} color="#000" />,
      },
      {
        question: "MY FAVORITE BRAINSTORMING FUEL",
        answer: "Matcha and lo-fi beats.",
        icon: <Coffee size={14} color="#000" />,
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
        icon: <MessageCircle size={14} color="#000" />,
      },
      {
        question: "THE PROJECT I'M MOST PROUD OF",
        answer:
          "Launching a DAO that funded 200+ scholarships for women in tech.",
        icon: <Award size={14} color="#000" />,
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
        icon: <Globe size={14} color="#000" />,
      },
      {
        question: "IF I WASN'T IN TECH",
        answer: "I'd be a chef. Chemistry you can eat.",
        icon: <Coffee size={14} color="#000" />,
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
      referralNote:
        "I personally review all applications and fast-track strong candidates through our process.",
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
      referralNote:
        "I'm looking for designers who think in systems and can balance craft with shipping velocity.",
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
      referralNote:
        "I fast-track candidates who can balance technical rigor with business impact. Show me you care about the music, not just the models.",
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
      referralNote:
        "We're looking for engineers who love automation and think about reliability from day one. If you've scaled infrastructure before, let's talk.",
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
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        {/* Name Header Shimmer */}
        <Animated.View
          style={[
            {
              backgroundColor: "#EEE",
              height: 24,
              marginHorizontal: 20,
              marginTop: 20,
              marginBottom: 14,
              borderRadius: 4,
            },
            shimmerStyle,
          ]}
        />

        {/* Image + Details Row */}
        <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 20 }}>
          {/* Square Image Shimmer */}
          <Animated.View
            style={[
              {
                backgroundColor: "#EEE",
                width: 110,
                height: 110,
                borderRadius: 16,
              },
              shimmerStyle,
            ]}
          />

          {/* Details Column */}
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View
              style={[
                { backgroundColor: "#EEE", height: 18, borderRadius: 4 },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#EEE",
                  height: 24,
                  width: "60%",
                  borderRadius: 12,
                },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#EEE",
                  height: 16,
                  width: "80%",
                  borderRadius: 4,
                },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#EEE",
                  height: 16,
                  width: "50%",
                  borderRadius: 4,
                },
                shimmerStyle,
              ]}
            />
          </View>
        </View>

        {/* About Section Shimmer */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Animated.View
            style={[
              {
                backgroundColor: "#F5F5F5",
                height: 14,
                width: 60,
                marginBottom: 8,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: "#F9F9F9",
                height: 16,
                marginBottom: 6,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: "#F9F9F9",
                height: 16,
                width: "90%",
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
        </View>

        {/* Skills Shimmer */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Animated.View
            style={[
              {
                backgroundColor: "#F5F5F5",
                height: 14,
                width: 80,
                marginBottom: 8,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Animated.View
              style={[
                {
                  backgroundColor: "#F5F5F5",
                  height: 28,
                  width: 80,
                  borderRadius: 14,
                },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#F5F5F5",
                  height: 28,
                  width: 100,
                  borderRadius: 14,
                },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#F5F5F5",
                  height: 28,
                  width: 90,
                  borderRadius: 14,
                },
                shimmerStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  backgroundColor: "#F5F5F5",
                  height: 28,
                  width: 70,
                  borderRadius: 14,
                },
                shimmerStyle,
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export function HomeView({
  userType,
  onWebViewActiveChange,
  onNavigateToProfile,
}: HomeViewProps) {
  const router = useRouter();
  const profileData = useUserProfileStore((state) => state.data);
  const scrollRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [progress, setProgress] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Profile completion state
  const [showProfileCompletionModal, setShowProfileCompletionModal] =
    useState(false);
  const [isTester, setIsTester] = useState(false);
  const profileCompletion = profileData
    ? checkProfileCompleteness(profileData)
    : { isComplete: false, percentage: 0, missingFields: [] };

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >({});

  // Apply Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyStep, setApplyStep] = useState<
    "select" | "waitlist" | "external"
  >("select");
  const [pendingJob, setPendingJob] = useState<any>(null);

  // WebView State
  const [showWebView, setShowWebView] = useState(false);
  const [webViewJob, setWebViewJob] = useState<any>(null);

  // Notify parent when WebView state changes
  useEffect(() => {
    onWebViewActiveChange?.(showWebView);
  }, [showWebView]);

  const toggleFilter = (category: string, option: string) => {
    setSelectedFilters((prev) => {
      const current = prev[category] || [];
      if (current.includes(option)) {
        return { ...prev, [category]: current.filter((o) => o !== option) };
      } else {
        return { ...prev, [category]: [...current, option] };
      }
    });
  };

  const activeFilterCount = Object.values(selectedFilters).flat().length;

  const swipeX = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);
  const rotateY = useSharedValue(0);
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(
      Math.min(progress, DECK_SIZE) / DECK_SIZE,
      { duration: 600 },
    );
  }, [progress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  // Use profiles for sponsors, jobs for applicants
  const currentData =
    userType === "sponsor"
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
      setTimeout(
        () => scrollRef.current?.scrollTo({ y: 380, animated: true }),
        80,
      );
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => setShowMore(false), 300);
    }
  };

  const handleSwipe = (isAccept: boolean) => {
    // Check profile completeness for applicants before any swipe action (unless they're a tester)
    if (
      userType === "applicant" &&
      profileCompletion.percentage < 90 &&
      !isTester
    ) {
      setShowProfileCompletionModal(true);
      return;
    }

    // If applicant tries to apply to Non-Sponsored Job, intercept
    if (
      userType === "applicant" &&
      isAccept &&
      "isSponsored" in currentData &&
      currentData.isSponsored === false
    ) {
      setPendingJob(currentData);
      setApplyStep("select");
      setShowApplyModal(true);
      return;
    }

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
    if (isFlipped) {
      rotateY.value = 0;
      setIsFlipped(false);
    }
    setShowMore(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    swipeX.value = withTiming(isAccept ? SCREEN_WIDTH : -SCREEN_WIDTH, {
      duration: 400,
    });
    swipeOpacity.value = withTiming(0, { duration: 300 });

    setTimeout(() => {
      setProgress((prev) => prev + 1);
      setCurrentProfileIndex((prev) => prev + 1);
      swipeX.value = 0;
      swipeOpacity.value = withTiming(1, { duration: 300 });
    }, 400);
  };

  const handleDirectApply = () => {
    // Close the apply modal
    setShowApplyModal(false);

    // Open WebView with the job application URL
    setWebViewJob(pendingJob);
    setShowWebView(true);
  };

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
    opacity: swipeOpacity.value,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
    backfaceVisibility: "hidden",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value + 180}deg` }],
    backfaceVisibility: "hidden",
    position: "absolute",
    top: 0,
    width: "100%",
    height: "100%",
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(showMore ? "180deg" : "0deg") }],
  }));

  // If WebView is active, show it
  if (showWebView && webViewJob) {
    return (
      <JobApplicationWebView
        jobUrl={webViewJob.applicationUrl}
        jobTitle={webViewJob.title}
        company={webViewJob.company}
        onClose={() => {
          setShowWebView(false);
          setWebViewJob(null);
          // Mark as applied and continue
          handleSwipe(true);
        }}
      />
    );
  }

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
          <Animated.View entering={FadeInDown} style={styles.headerRow}>
            <View style={styles.progressHeaderContainer}>
              <Text style={styles.progressText}>
                Card {Math.min(progress, DECK_SIZE)} of {DECK_SIZE}
              </Text>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[styles.progressFill, progressBarStyle]}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                activeFilterCount > 0 && styles.filterBtnActive,
              ]}
              onPress={() => setShowFilters(true)}
              activeOpacity={0.7}
            >
              <SlidersHorizontal
                size={20}
                color={activeFilterCount > 0 ? "#FFF" : "#000"}
              />
            </TouchableOpacity>
          </Animated.View>

          {isDeckFinished ? (
            <Animated.View entering={FadeInUp} style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <RefreshCcw color="#000" size={32} />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>
                You've reviewed your deck. Come back tomorrow for more.
              </Text>
              <TouchableOpacity
                style={styles.returnBtn}
                onPress={() => {
                  setProgress(1);
                  setCurrentProfileIndex(0);
                }}
              >
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
                          {/* Name Header - Full Width */}
                          <View style={styles.profileNameHeader}>
                            <Text style={styles.profileNameTop}>
                              {"name" in currentData ? currentData.name : ""}
                            </Text>
                          </View>

                          {/* Layout: Image on Left + Details on Right */}
                          <View style={styles.profileCardTop}>
                            <Image
                              source={{
                                uri:
                                  "image" in currentData
                                    ? currentData.image
                                    : "",
                              }}
                              style={styles.profileImageSquare}
                            />
                            <View style={styles.profileInfoColumn}>
                              <View style={styles.profileMetaRow}>
                                <View style={styles.companyPill}>
                                  <Text style={styles.companyPillText}>
                                    {"company" in currentData
                                      ? currentData.company
                                      : ""}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.profileMetaRow}>
                                <MapPin color="#999" size={11} />
                                <Text style={styles.profileLocation}>
                                  {"location" in currentData
                                    ? currentData.location
                                    : ""}
                                </Text>
                              </View>
                              {"desiredRole" in currentData && (
                                <>
                                  <View
                                    style={[
                                      styles.profileMetaRow,
                                      { marginTop: 12 },
                                    ]}
                                  >
                                    <Text style={styles.sectionLabelSmall}>
                                      DESIRED ROLE
                                    </Text>
                                  </View>
                                  <View style={styles.profileMetaRow}>
                                    <TrendingUp color="#999" size={11} />
                                    <Text style={styles.profileExperience}>
                                      {currentData.desiredRole}
                                    </Text>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>

                          {/* Content Section */}
                          <View style={styles.profileCardContent}>
                            <View style={styles.descriptionSection}>
                              <Text style={styles.sectionLabelSmall}>
                                ABOUT
                              </Text>
                              <Text style={styles.descriptionText}>
                                {"bio" in currentData ? currentData.bio : ""}
                              </Text>
                            </View>

                            {"skills" in currentData && currentData.skills && (
                              <View style={styles.skillsSection}>
                                <Text style={styles.sectionLabelSmall}>
                                  TOP SKILLS
                                </Text>
                                <View style={styles.skillsRow}>
                                  {currentData.skills
                                    .slice(0, 4)
                                    .map((skill: string, idx: number) => (
                                      <View
                                        key={idx}
                                        style={styles.skillChipSmall}
                                      >
                                        <Text style={styles.skillChipSmallText}>
                                          {skill}
                                        </Text>
                                      </View>
                                    ))}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      </Animated.View>

                      {/* Back Face - Insights Only */}
                      <Animated.View
                        style={[
                          styles.cardOuter,
                          styles.cardOuterBack,
                          backStyle,
                        ]}
                      >
                        <View style={[styles.cardInner, styles.cardInnerBack]}>
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.cardInfoScrollable}
                          >
                            <View style={styles.backHeader}>
                              <Text style={styles.backTitle}>
                                {"name" in currentData ? currentData.name : ""}
                              </Text>
                            </View>

                            {/* Prompts Section */}
                            {"prompts" in currentData &&
                              currentData.prompts?.map(
                                (prompt: any, idx: number) => (
                                  <View key={idx} style={styles.promptCard}>
                                    <View style={styles.promptIconRow}>
                                      <View style={styles.promptIconCircle}>
                                        {prompt.icon}
                                      </View>
                                      <Text style={styles.promptQuestion}>
                                        {prompt.question}
                                      </Text>
                                    </View>
                                    <Text style={styles.promptAnswer}>
                                      {prompt.answer}
                                    </Text>
                                  </View>
                                ),
                              )}
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
                          {/* Job Title Header - Full Width */}
                          <View style={styles.profileNameHeader}>
                            <Text style={styles.profileNameTop}>
                              {"title" in currentData ? currentData.title : ""}
                            </Text>
                          </View>

                          {/* Layout: Image on Left + Details on Right */}
                          <View style={styles.profileCardTop}>
                            <Image
                              source={{
                                uri:
                                  "image" in currentData
                                    ? currentData.image
                                    : "",
                              }}
                              style={styles.companyImageSquare}
                            />

                            <View style={styles.profileInfoColumn}>
                              {/* Company Name */}
                              <View style={styles.profileMetaRow}>
                                <View style={styles.companyPill}>
                                  <Text style={styles.companyPillText}>
                                    {"company" in currentData
                                      ? currentData.company
                                      : ""}
                                  </Text>
                                </View>
                              </View>

                              {/* Location */}
                              <View style={styles.profileMetaRow}>
                                <MapPin color="#999" size={11} />
                                <Text style={styles.profileLocation}>
                                  {"location" in currentData
                                    ? currentData.location
                                    : ""}
                                </Text>
                              </View>

                              {/* Salary */}
                              <View style={styles.profileMetaRow}>
                                <DollarSign color="#999" size={11} />
                                <Text style={styles.profileLocation}>
                                  {"salary" in currentData
                                    ? currentData.salary
                                    : ""}
                                </Text>
                              </View>

                              {/* Job Type */}
                              <View style={styles.profileMetaRow}>
                                <Briefcase color="#999" size={11} />
                                <Text style={styles.profileLocation}>
                                  {"type" in currentData
                                    ? currentData.type
                                    : ""}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Content Section */}
                          <View style={styles.profileCardContent}>
                            <View style={styles.descriptionSection}>
                              <Text style={styles.sectionLabelSmall}>
                                ABOUT THE ROLE
                              </Text>
                              <Text style={styles.descriptionText}>
                                {"description" in currentData
                                  ? currentData.description
                                  : ""}
                              </Text>
                            </View>

                            {"skills" in currentData && currentData.skills && (
                              <View style={styles.skillsSection}>
                                <Text style={styles.sectionLabelSmall}>
                                  KEY SKILLS
                                </Text>
                                <View style={styles.skillsRow}>
                                  {currentData.skills
                                    .slice(0, 4)
                                    .map((skill: string, idx: number) => (
                                      <View
                                        key={idx}
                                        style={styles.skillChipSmall}
                                      >
                                        <Text style={styles.skillChipSmallText}>
                                          {skill}
                                        </Text>
                                      </View>
                                    ))}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      </Animated.View>

                      {/* Back Face - Sponsor Info */}
                      <Animated.View
                        style={[
                          styles.cardOuter,
                          styles.cardOuterBack,
                          backStyle,
                        ]}
                      >
                        <View style={[styles.cardInner, styles.cardInnerBack]}>
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.cardInfoScrollable}
                          >
                            {"isSponsored" in currentData &&
                            currentData.isSponsored === false ? (
                              // NON-SPONSORED BACK DESIGN
                              <>
                                <View style={styles.backHeader}>
                                  <Image
                                    source={{
                                      uri:
                                        "image" in currentData
                                          ? currentData.image
                                          : "",
                                    }}
                                    style={styles.companyLogoLarge}
                                  />
                                  <Text style={styles.backTitle}>
                                    About{" "}
                                    {"company" in currentData
                                      ? currentData.company
                                      : "Company"}
                                  </Text>
                                </View>

                                {"companyDescription" in currentData &&
                                  currentData.companyDescription && (
                                    <View
                                      style={styles.companyDescriptionSection}
                                    >
                                      <Text
                                        style={styles.companyDescriptionText}
                                        numberOfLines={7}
                                      >
                                        {currentData.companyDescription}
                                      </Text>
                                    </View>
                                  )}

                                <View style={styles.noSponsorBanner}>
                                  <MessageCircle size={16} color="#666" />
                                  <Text style={styles.noSponsorText}>
                                    No active sponsors yet. Join the waitlist to
                                    get notified.
                                  </Text>
                                </View>
                              </>
                            ) : (
                              // SPONSORED BACK DESIGN (Existing)
                              <>
                                <View style={styles.backHeader}>
                                  <Text style={styles.backTitle}>
                                    {"title" in currentData
                                      ? currentData.title
                                      : ""}
                                  </Text>
                                </View>

                                {"sponsorInfo" in currentData &&
                                  currentData.sponsorInfo && (
                                    <>
                                      {/* Sponsor Info */}
                                      <View style={styles.insightSection}>
                                        <View style={styles.insightHeaderRow}>
                                          <Text
                                            style={styles.insightSectionLabel}
                                          >
                                            JOB SPONSOR
                                          </Text>
                                        </View>
                                        <View style={styles.sponsorHeader}>
                                          <Image
                                            source={{
                                              uri: currentData.sponsorInfo
                                                .image,
                                            }}
                                            style={styles.sponsorAvatar}
                                          />
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.sponsorName}>
                                              {currentData.sponsorInfo.name}
                                            </Text>
                                            <Text style={styles.sponsorRole}>
                                              {currentData.sponsorInfo.role}
                                            </Text>
                                            <View
                                              style={[
                                                styles.metaRow,
                                                { marginTop: 4 },
                                              ]}
                                            >
                                              <Calendar
                                                size={12}
                                                color="#999"
                                              />
                                              <Text style={styles.sponsorYears}>
                                                {
                                                  currentData.sponsorInfo
                                                    .yearsAtCompany
                                                }{" "}
                                                at company
                                              </Text>
                                            </View>
                                          </View>
                                        </View>
                                      </View>

                                      <View style={styles.insightSection}>
                                        <View style={styles.insightHeaderRow}>
                                          <Text
                                            style={styles.insightSectionLabel}
                                          >
                                            REFERRAL NOTE
                                          </Text>
                                        </View>
                                        <Text style={styles.insightContent}>
                                          {currentData.sponsorInfo.referralNote}
                                        </Text>
                                      </View>

                                      {currentData.sponsorInfo.canRefer && (
                                        <View style={styles.canReferBadge}>
                                          <Check size={14} color="#00CB54" />
                                          <Text style={styles.canReferText}>
                                            Can provide direct referral
                                          </Text>
                                        </View>
                                      )}
                                    </>
                                  )}
                              </>
                            )}
                          </ScrollView>
                          <TouchableOpacity
                            style={styles.flipBackBtn}
                            onPress={toggleFlip}
                          >
                            <Text style={styles.flipBackText}>
                              View Job Details
                            </Text>
                          </TouchableOpacity>
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
                        {"fullDetails" in currentData &&
                          currentData.fullDetails && (
                            <>
                              {/* Professional Experience */}
                              {"experiences" in currentData.fullDetails &&
                                Array.isArray(
                                  currentData.fullDetails.experiences,
                                ) &&
                                currentData.fullDetails.experiences.length >
                                  0 && (
                                  <>
                                    <View style={styles.detailSection}>
                                      <View style={styles.detailSectionHeader}>
                                        <Briefcase size={16} color="#000" />
                                        <Text style={styles.detailSectionTitle}>
                                          Professional Experience
                                        </Text>
                                      </View>
                                      {currentData.fullDetails.experiences.map(
                                        (exp: any, idx: number) => (
                                          <View
                                            key={idx}
                                            style={styles.experienceCard}
                                          >
                                            <View
                                              style={styles.experienceHeader}
                                            >
                                              <Text
                                                style={styles.experienceTitle}
                                              >
                                                {exp.jobTitle}
                                              </Text>
                                              <Text
                                                style={styles.experienceDates}
                                              >
                                                {exp.startDate}
                                                {exp.current
                                                  ? " - Present"
                                                  : exp.endDate
                                                    ? ` - ${exp.endDate}`
                                                    : ""}
                                              </Text>
                                            </View>
                                            <Text
                                              style={styles.experienceCompany}
                                            >
                                              {exp.company}
                                            </Text>
                                            {exp.description && (
                                              <Text
                                                style={
                                                  styles.experienceDescription
                                                }
                                              >
                                                {exp.description}
                                              </Text>
                                            )}
                                          </View>
                                        ),
                                      )}
                                    </View>
                                  </>
                                )}

                              {/* Education */}
                              {"education" in currentData.fullDetails &&
                                Array.isArray(
                                  currentData.fullDetails.education,
                                ) &&
                                currentData.fullDetails.education.length >
                                  0 && (
                                  <>
                                    <View style={styles.detailSection}>
                                      <View style={styles.detailSectionHeader}>
                                        <GraduationCap size={16} color="#000" />
                                        <Text style={styles.detailSectionTitle}>
                                          Education
                                        </Text>
                                      </View>
                                      {currentData.fullDetails.education.map(
                                        (edu: any, idx: number) => (
                                          <View
                                            key={idx}
                                            style={styles.educationCard}
                                          >
                                            <Text
                                              style={styles.educationDegree}
                                            >
                                              {edu.degree} in {edu.major}
                                            </Text>
                                            <Text
                                              style={styles.educationSchool}
                                            >
                                              {edu.university}
                                            </Text>
                                            <View
                                              style={styles.educationFooter}
                                            >
                                              <Text
                                                style={styles.educationYear}
                                              >
                                                Class of {edu.graduationYear}
                                              </Text>
                                              {edu.gpa && (
                                                <Text
                                                  style={styles.educationGpa}
                                                >
                                                  GPA: {edu.gpa}
                                                </Text>
                                              )}
                                            </View>
                                          </View>
                                        ),
                                      )}
                                    </View>
                                  </>
                                )}

                              {/* Certifications */}
                              {"certifications" in currentData.fullDetails &&
                                Array.isArray(
                                  currentData.fullDetails.certifications,
                                ) &&
                                currentData.fullDetails.certifications.length >
                                  0 && (
                                  <>
                                    <View style={styles.detailSection}>
                                      <View style={styles.detailSectionHeader}>
                                        <Award size={16} color="#000" />
                                        <Text style={styles.detailSectionTitle}>
                                          Certifications
                                        </Text>
                                      </View>
                                      <View style={styles.certificationsGrid}>
                                        {currentData.fullDetails.certifications.map(
                                          (cert: any, idx: number) => (
                                            <View
                                              key={idx}
                                              style={styles.certificationBadge}
                                            >
                                              <Text
                                                style={styles.certificationName}
                                              >
                                                {cert.name}
                                              </Text>
                                              <Text
                                                style={
                                                  styles.certificationDetails
                                                }
                                              >
                                                {cert.organization} •{" "}
                                                {cert.year}
                                              </Text>
                                            </View>
                                          ),
                                        )}
                                      </View>
                                    </View>
                                  </>
                                )}

                              {/* Languages */}
                              {"languages" in currentData.fullDetails &&
                                Array.isArray(
                                  currentData.fullDetails.languages,
                                ) &&
                                currentData.fullDetails.languages.length >
                                  0 && (
                                  <>
                                    <View style={styles.detailSection}>
                                      <View style={styles.detailSectionHeader}>
                                        <Globe size={16} color="#000" />
                                        <Text style={styles.detailSectionTitle}>
                                          Languages
                                        </Text>
                                      </View>
                                      <View style={styles.languagesGrid}>
                                        {currentData.fullDetails.languages.map(
                                          (lang: any, idx: number) => (
                                            <View
                                              key={idx}
                                              style={styles.languageBadge}
                                            >
                                              <Text style={styles.languageName}>
                                                {lang.language}
                                              </Text>
                                              <Text
                                                style={
                                                  styles.languageProficiency
                                                }
                                              >
                                                {lang.proficiency}
                                              </Text>
                                            </View>
                                          ),
                                        )}
                                      </View>
                                    </View>
                                  </>
                                )}

                              {/* Achievements */}
                              {"achievements" in currentData.fullDetails &&
                                currentData.fullDetails.achievements && (
                                  <>
                                    <View style={styles.detailSection}>
                                      <View style={styles.detailSectionHeader}>
                                        <Sparkles size={16} color="#000" />
                                        <Text style={styles.detailSectionTitle}>
                                          Achievements & Awards
                                        </Text>
                                      </View>
                                      <Text style={styles.achievementsText}>
                                        {currentData.fullDetails.achievements}
                                      </Text>
                                    </View>
                                  </>
                                )}
                            </>
                          )}
                      </>
                    ) : (
                      /* Applicant More Details - Job */
                      <>
                        {"fullDetails" in currentData &&
                          currentData.fullDetails &&
                          "responsibilities" in currentData.fullDetails && (
                            <>
                              <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                  <Briefcase size={16} color="#000" />
                                  <Text style={styles.detailSectionTitle}>
                                    Responsibilities
                                  </Text>
                                </View>
                                <View style={styles.jobDetailCard}>
                                  <Text style={styles.jobDetailText}>
                                    {
                                      (currentData.fullDetails as any)
                                        .responsibilities
                                    }
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                  <Award size={16} color="#000" />
                                  <Text style={styles.detailSectionTitle}>
                                    Requirements
                                  </Text>
                                </View>
                                <View style={styles.jobDetailCard}>
                                  <Text style={styles.jobDetailText}>
                                    {
                                      (currentData.fullDetails as any)
                                        .requirements
                                    }
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                  <Calendar size={16} color="#000" />
                                  <Text style={styles.detailSectionTitle}>
                                    Interview Process
                                  </Text>
                                </View>
                                <View style={styles.jobDetailCard}>
                                  <Text style={styles.jobDetailText}>
                                    {
                                      (currentData.fullDetails as any)
                                        .interviewProcess
                                    }
                                  </Text>
                                </View>
                              </View>
                            </>
                          )}
                        {"skills" in currentData && currentData.skills && (
                          <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                              <TrendingUp size={16} color="#000" />
                              <Text style={styles.detailSectionTitle}>
                                Required Skills
                              </Text>
                            </View>
                            <View style={styles.skillsRow}>
                              {currentData.skills.map(
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
                        )}
                        {"benefits" in currentData && currentData.benefits && (
                          <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                              <Sparkles size={16} color="#000" />
                              <Text style={styles.detailSectionTitle}>
                                Benefits
                              </Text>
                            </View>
                            <View style={styles.benefitsList}>
                              {currentData.benefits.map(
                                (benefit: string, idx: number) => (
                                  <View key={idx} style={styles.benefitRow}>
                                    <Check size={14} color="#00CB54" />
                                    <Text style={styles.benefitText}>
                                      {benefit}
                                    </Text>
                                  </View>
                                ),
                              )}
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
                <View style={styles.bottomNav}>
                  <TouchableOpacity
                    onPress={() => handleSwipe(false)}
                    style={styles.iconBtn}
                    activeOpacity={0.7}
                  >
                    <X color="#000" size={24} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={toggleMore}
                    style={[styles.iconBtn, showMore && styles.iconBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Animated.View style={chevronStyle}>
                      <ChevronDown
                        color={showMore ? "#FFF" : "#000"}
                        size={24}
                      />
                    </Animated.View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSwipe(true)}
                    style={styles.primaryActionBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionLabel}>
                      {userType === "sponsor" ? "Connect" : "Apply"}
                    </Text>
                    <Check color="#FFF" size={20} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          )}
        </ScrollView>
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
                <Check color="#FFF" size={32} strokeWidth={3} />
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

      {/* Apply Action Modal (For Non-Sponsored Jobs) */}
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
                {applyStep === "select"
                  ? "How to Apply"
                  : applyStep === "waitlist"
                    ? "You're on the list!"
                    : "Redirecting..."}
              </Text>
              <TouchableOpacity
                onPress={() => setShowApplyModal(false)}
                style={styles.closeBtn}
              >
                <X color="#000" size={24} />
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
                  <TouchableOpacity
                    style={styles.modalOptionBtn}
                    onPress={handleDirectApply}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOptionIcon}>
                      <ExternalLink color="#000" size={24} />
                    </View>
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionTitle}>
                        Apply Directly
                      </Text>
                      <Text style={styles.modalOptionDesc}>
                        Use our autofill feature to complete the company
                        application.
                      </Text>
                    </View>
                    <ChevronRight color="#CCC" size={20} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOptionBtn}
                    onPress={() => setApplyStep("waitlist")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOptionIcon}>
                      <Users color="#000" size={24} />
                    </View>
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionTitle}>Join Waitlist</Text>
                      <Text style={styles.modalOptionDesc}>
                        Get notified first when a sponsor becomes available.
                      </Text>
                    </View>
                    <ChevronRight color="#CCC" size={20} />
                  </TouchableOpacity>
                </View>
              )}

              {applyStep === "waitlist" && (
                <View style={styles.successContainer}>
                  <View style={styles.successCircleLarge}>
                    <Check color="#FFF" size={40} strokeWidth={3} />
                  </View>
                  <Text style={styles.successMessage}>
                    You are next in line for {pendingJob?.company}. We'll notify
                    you as soon as a sponsor is ready to review referrals.
                  </Text>
                  <TouchableOpacity
                    style={styles.successActionBtn}
                    onPress={() => {
                      setShowApplyModal(false);
                      handleSwipe(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.successActionBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {applyStep === "external" && (
                <View style={styles.successContainer}>
                  <View
                    style={[
                      styles.successCircleLarge,
                      { backgroundColor: "#000" },
                    ]}
                  >
                    <Sparkles color="#FFF" size={32} />
                  </View>
                  <Text style={styles.successMessage}>
                    We're sending you to the {pendingJob?.company} career site.
                    Our AI will pop up to help you autocomplete the forms.
                  </Text>
                  <TouchableOpacity
                    style={styles.successActionBtn}
                    onPress={() => {
                      setShowApplyModal(false);
                      handleSwipe(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.successActionBtnText}>Go to Site</Text>
                    <ExternalLink color="#FFF" size={18} />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refine Feed</Text>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={styles.closeModalBtn}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {(FILTER_OPTS[userType] || []).map((section: any) => (
                <View key={section.id} style={styles.filterSection}>
                  <Text style={styles.filterLabel}>{section.label}</Text>
                  <View style={styles.filterOptionsRow}>
                    {section.options.map((opt: string) => {
                      const isSelected = (
                        selectedFilters[section.id] || []
                      ).includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.filterChip,
                            isSelected && styles.filterChipSelected,
                          ]}
                          onPress={() => toggleFilter(section.id, opt)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isSelected && styles.filterChipTextSelected,
                            ]}
                          >
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  setShowFilters(false);
                  setIsLoading(true);
                  // Simulate reloading stack
                  setTimeout(() => setIsLoading(false), 600);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.applyBtnText}>Show Results</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setSelectedFilters({})}
              >
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </BlurView>
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
          setIsTester(true);
          setShowProfileCompletionModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 36, paddingBottom: 100 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  progressHeaderContainer: { flex: 1, marginRight: 20 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: "#000" },
  filterBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#F5F5F5",
  },

  // Modal Styles
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  closeModalBtn: { padding: 4, backgroundColor: "#F5F5F5", borderRadius: 20 },
  modalContent: { padding: 28, paddingBottom: 40 },
  filterSection: { marginBottom: 32 },
  filterLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  filterOptionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  filterChipSelected: { backgroundColor: "#000", borderColor: "#000" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#000" },
  filterChipTextSelected: { color: "#FFF" },
  modalFooter: {
    padding: 28,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 16,
  },
  applyBtn: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  clearBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  clearBtnText: { color: "#000", fontSize: 14, fontWeight: "600" },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1.2,
  },
  progressHeader: { marginTop: 6 },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#BBB",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#000", borderRadius: 3 },
  cardContainer: { marginBottom: 24 },
  cardOuter: {
    borderRadius: 24,
    backgroundColor: "#FFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
      },
      android: { elevation: 18 },
    }),
  },
  cardOuterBack: { backgroundColor: "#FBFBFB" },
  cardInner: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    height: 460,
  },
  cardInnerBack: { backgroundColor: "#FBFBFB" },

  // Layout: Image on Left + Details on Right
  profileCardTop: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileImageSquare: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  companyImageSquare: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  profileInfoColumn: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },

  // Name Header - Full Width Below Image Section
  profileNameHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileNameTop: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },
  profileRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileRole: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    flex: 1,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  companyPill: {
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  companyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  profileLocation: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999",
  },
  profileExperience: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },

  // Content Section
  profileCardContent: {
    padding: 20,
    gap: 16,
  },
  descriptionSection: {
    gap: 8,
  },
  sectionLabelSmall: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 21,
    fontWeight: "500",
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
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skillChipSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },

  // Back Card Insights
  insightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  insightSectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },

  // Legacy styles (keep for backward compatibility)
  imageWrapperRedesign: {
    height: 180,
    backgroundColor: "#F9F9F9",
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
    color: "#FFF",
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
    color: "#FFF",
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
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  companyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },

  // Summary Content
  summaryLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 4,
  },
  mentalityText: {
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "600",
  },

  // Detail Sections (for back of card)
  detailSection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  detailSectionTitle: {
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    color: "#000",
    letterSpacing: 0.8,
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
    color: "#000",
    letterSpacing: 1,
  },
  detailSectionText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
    fontWeight: "500",
  },

  // Legacy styles (keep for backward compatibility)
  cardHeader: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 14,
    backgroundColor: "#FAFAFA",
  },
  profileImageCompact: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  companyTextBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  infoFloatingBtnCompact: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
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
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
  },
  bioTextExpanded: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    fontWeight: "500",
  },
  insightPreviewText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
    fontStyle: "italic",
  },
  promptPreviewText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 19,
    fontStyle: "italic",
  },
  tapForMoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginTop: "auto",
  },
  tapForMoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.5,
  },

  // Legacy styles (keep for backward compatibility with other parts)
  imageWrapper: { height: 220, backgroundColor: "#F9F9F9" },
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
  cardInfoScrollable: { padding: 24, paddingBottom: 80 },
  nameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  metaText: { fontSize: 12, fontWeight: "600", color: "#333" },
  locationText: { fontSize: 12, color: "#666", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10 },
  bioText: { fontSize: 15, color: "#444", lineHeight: 22 },
  expandedDetails: { marginBottom: 32, gap: 14 },

  // New Experience Card Styles
  experienceCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 12,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    flex: 1,
    letterSpacing: -0.3,
  },
  experienceDates: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 0.2,
  },
  experienceCompany: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 8,
  },
  experienceDescription: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },

  // Education Card Styles
  educationCard: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  educationDegree: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  educationSchool: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 6,
  },
  educationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  educationYear: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  educationGpa: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },

  // Certifications Grid
  certificationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  certificationBadge: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: "48%",
    flexGrow: 1,
    maxWidth: "100%",
  },
  certificationName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 3,
  },
  certificationDetails: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
  },

  // Languages Grid
  languagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  languageName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  languageProficiency: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6366F1",
  },

  // Achievements Text
  achievementsText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },

  // Job Detail Card (for expanded job details)
  jobDetailCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  jobDetailText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },

  detailItem: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
  },
  detailTitle: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    color: "#000",
    letterSpacing: 0.5,
  },
  detailBody: { color: "#555", fontSize: 14, lineHeight: 20 },
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
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: "#000", borderColor: "#000" },
  primaryActionBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#000",
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // BACK OF CARD (INSIGHTS)
  backHeader: { marginBottom: 24 },
  backTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
  },

  // Redesigned Prompt Cards
  promptCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
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
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  promptQuestion: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 1,
    textTransform: "uppercase",
    lineHeight: 14,
  },
  promptAnswer: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    lineHeight: 24,
    letterSpacing: -0.2,
  },

  insightSection: { marginBottom: 24 },
  insightLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#AAA",
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  insightContent: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    lineHeight: 24,
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
    color: "#444",
    fontStyle: "italic",
    lineHeight: 24,
  },

  flipBackBtn: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FBFBFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  flipBackText: {
    fontSize: 12,
    color: "#BBB",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
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
    backgroundColor: "#FFF",
    padding: 40,
    borderRadius: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 15,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  celebrationTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  celebrationSub: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  emptySub: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  returnBtn: {
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  returnBtnText: { color: "#FFF", fontWeight: "700" },
  sponsorHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sponsorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F5",
  },
  sponsorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  sponsorRole: { fontSize: 13, color: "#666", marginBottom: 2 },
  sponsorYears: { fontSize: 12, color: "#999", marginLeft: 4 },
  canReferBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FFF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  canReferText: { fontSize: 12, fontWeight: "700", color: "#00CB54" },
  skillBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillBadgeText: { fontSize: 12, fontWeight: "700", color: "#000" },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, color: "#555", flex: 1 },

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
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  companyDetails: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "700", color: "#000" },
  jobTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    lineHeight: 30,
    marginBottom: 16,
  },
  jobMetaList: { gap: 8, marginBottom: 10 },
  jobMetaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  jobMetaLineText: { fontSize: 14, color: "#666", fontWeight: "500" },
  infoFloatingBtnSmall: {
    backgroundColor: "#F9F9F9",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  jobDescription: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    marginBottom: 18,
  },
  skillsPreviewSection: { marginTop: 4 },
  skillsPreviewLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#999",
    marginBottom: 10,
    letterSpacing: 1,
  },
  skillChip: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skillChipMore: { backgroundColor: "#000", borderColor: "#000" },
  skillChipText: { fontSize: 12, fontWeight: "700", color: "#000" },
  skillChipTextWhite: { color: "#FFF" },

  // Non-Sponsored Back Design
  companyLogoLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  companyDescriptionSection: { marginBottom: 20 },
  companyDescriptionText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 24,
    fontWeight: "500",
  },
  insightsHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  insightContentSmall: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
    lineHeight: 20,
  },
  noSponsorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  noSponsorText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },

  // Apply Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  applyModalContent: {
    backgroundColor: "#FFF",
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
  applyModalTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  applyModalSubtitle: {
    fontSize: 14,
    color: "#666",
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
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionContent: { flex: 1 },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  modalOptionDesc: { fontSize: 13, color: "#666", lineHeight: 18 },

  successContainer: { alignItems: "center", paddingVertical: 32 },
  successCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  successActionBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    minWidth: 200,
  },
  successActionBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
