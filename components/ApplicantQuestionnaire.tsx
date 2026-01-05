import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  Upload,
  X
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
  useAnimatedStyle,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AVAILABLE_QUESTIONS = [
  "MY SECRET SUPERPOWER",
  "I'M BEST KNOWN FOR",
  "IF I WASN'T IN TECH",
  "MY FAVORITE BRAINSTORMING FUEL",
  "WHAT I LOOK FOR IN A TEAM",
  "ONE THING THAT SURPRISED ME",
  "THE PROJECT I'M MOST PROUD OF",
  "MY DESIGN PHILOSOPHY",
  "WHAT ENERGIZES ME",
  "MY UNPOPULAR OPINION",
  "THE BEST ADVICE I'VE RECEIVED",
  "HOW I RECHARGE",
  "WHAT I'M LEARNING RIGHT NOW",
  "MY WORK STYLE",
  "WHY I CHOSE THIS CAREER",
];

const SKILLS_BY_INDUSTRY: Record<string, string[]> = {
  Technology: [
    "Software Engineering", "Full Stack Development", "Frontend Development", "Backend Development",
    "Mobile Development", "DevOps", "Cloud Architecture", "System Design",
    "Data Engineering", "Machine Learning", "AI/ML", "Data Science",
    "UI/UX Design", "Product Design", "Product Management", "Technical Writing",
    "Agile Methodology", "Scrum", "API Development", "Cybersecurity"
  ],
  Finance: [
    "Financial Analysis", "Investment Banking", "Portfolio Management", "Risk Management",
    "Financial Modeling", "Valuation", "Corporate Finance", "Accounting",
    "Quantitative Analysis", "Trading", "Compliance", "Audit",
    "Financial Planning", "Tax Strategy", "M&A", "Private Equity",
    "Venture Capital", "Excel Modeling", "SQL", "Bloomberg Terminal"
  ],
  Healthcare: [
    "Clinical Research", "Healthcare Management", "Medical Billing", "Patient Care",
    "Healthcare IT", "Electronic Health Records", "Regulatory Compliance", "HIPAA",
    "Medical Coding", "Public Health", "Epidemiology", "Healthcare Analytics",
    "Telemedicine", "Healthcare Operations", "Quality Assurance", "Patient Safety",
    "Pharmacy", "Medical Device", "Biotechnology", "Clinical Trials"
  ],
  Education: [
    "Curriculum Development", "Instructional Design", "Educational Technology", "Learning Management Systems",
    "Student Assessment", "Classroom Management", "Special Education", "ESL/ELL",
    "Educational Leadership", "Academic Advising", "Training & Development", "E-Learning",
    "Educational Research", "Student Affairs", "Higher Education", "K-12 Education",
    "Tutoring", "Pedagogy", "EdTech", "Educational Psychology"
  ],
  Marketing: [
    "Digital Marketing", "Content Marketing", "SEO/SEM", "Social Media Marketing",
    "Email Marketing", "Marketing Analytics", "Brand Strategy", "Copywriting",
    "Graphic Design", "Video Production", "Growth Marketing", "Performance Marketing",
    "Marketing Automation", "CRM", "Google Analytics", "A/B Testing",
    "Influencer Marketing", "PR", "Event Marketing", "Market Research"
  ],
  Other: [
    "Project Management", "Business Analysis", "Strategic Planning", "Operations Management",
    "Sales", "Business Development", "Customer Success", "Account Management",
    "Leadership", "Team Management", "Stakeholder Management", "Negotiation",
    "Data Analysis", "Problem Solving", "Communication", "Presentation Skills",
    "Process Improvement", "Change Management", "Consulting", "Research"
  ]
};

interface ApplicantQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
}

const questions = [
  { id: 1, question: "What industry are you targeting?", type: "select", options: ["Technology", "Finance", "Healthcare", "Education", "Marketing", "Other"] },
  { id: 2, question: "What role are you currently in?", type: "text", placeholder: "e.g., Software Engineer" },
  { id: 3, question: "What position are you seeking?", type: "text", placeholder: "e.g., Senior Product Lead" },
  { id: 4, question: "Choose up to 5 skills to highlight", type: "skills" },
  { id: 5, question: "Add personality to your profile", type: "insights", subtitle: "Pick 2-3 questions and share what makes you unique" },
  { id: 6, question: "Upload your professional resume", type: "file" },
];

export function ApplicantQuestionnaire({ onComplete, onBack }: ApplicantQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // Insights state
  const [selectedInsights, setSelectedInsights] = useState<Array<{ question: string; answer: string }>>([]);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(null);
  const [tempAnswer, setTempAnswer] = useState("");

  const filteredSkills = useMemo(() => {
    const selectedIndustry = answers[0] || "Other";
    const industrySkills = SKILLS_BY_INDUSTRY[selectedIndustry] || SKILLS_BY_INDUSTRY.Other;
    return industrySkills
      .filter(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [searchQuery, answers]);

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    // Simulate processing
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2200);
    }, 2000);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
    else onBack();
  };

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else if (selectedSkills.length < 5) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0].name);
        setAnswers({ ...answers, [currentQuestion]: result.assets[0].uri });
      }
    } catch (error) { console.error(error); }
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;

  // UPDATED LOGIC: Allow 1-5 skills, require text input, and require 2-3 insights
  const isSkillsScreen = question.type === "skills";
  const isTextScreen = question.type === "text";
  const isInsightsScreen = question.type === "insights";
  const canContinue = isSkillsScreen 
    ? (selectedSkills.length > 0 && selectedSkills.length <= 5) 
    : isTextScreen
    ? (answers[currentQuestion]?.trim().length > 0)
    : isInsightsScreen
    ? (selectedInsights.length >= 2 && selectedInsights.length <= 3 && selectedInsights.every(i => i.answer.trim().length > 0))
    : true;

  const progressBarStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 400 }),
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.topNav}>
          <TouchableOpacity onPress={handleBack} disabled={isSubmitting} style={styles.iconBtn}>
            <ArrowLeft color="#000" size={24} />
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>{currentQuestion + 1} of {questions.length}</Text>
          <View style={{ width: 40 }} /> 
        </View>

        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBar, progressBarStyle]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Animated.View key={currentQuestion} entering={FadeInDown.duration(500)}>
              <Text style={styles.questionText}>{question.question}</Text>

              {question.type === "select" && (
                <View style={styles.optionsContainer}>
                  {question.options?.map((option) => {
                    const isSelected = answers[currentQuestion] === option;
                    return (
                      <TouchableOpacity key={option} onPress={() => setAnswers({...answers, [currentQuestion]: option})} style={[styles.optionCard, isSelected && styles.optionCardSelected]}>
                        <Text style={[styles.optionText, isSelected && styles.textWhite]}>{option}</Text>
                        {isSelected ? <Check color="#FFF" size={20} /> : <ChevronRight color="#CCC" size={18} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {question.type === "text" && (
                <View style={styles.inputWrapper}>
                  <TextInput placeholder={question.placeholder} placeholderTextColor="#BBB" value={answers[currentQuestion] || ""} onChangeText={(v) => setAnswers({...answers, [currentQuestion]: v})} style={styles.textInput} autoFocus />
                </View>
              )}

              {question.type === "skills" && (
                <View>
                  <View style={styles.searchWrapper}>
                    <Search color="#AAA" size={20} style={{ marginRight: 10 }} />
                    <TextInput placeholder="Search skills..." placeholderTextColor="#BBB" value={searchQuery} onChangeText={setSearchQuery} style={styles.searchInput} />
                  </View>
                  <View style={styles.skillsGrid}>
                    {filteredSkills.map((skill) => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <TouchableOpacity key={skill} onPress={() => toggleSkill(skill)} style={[styles.skillItem, isSelected && styles.skillItemSelected]}>
                          <Text style={[styles.skillText, isSelected && styles.textWhite]}>{skill}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.selectionCount}>{selectedSkills.length} of 5 selected</Text>
                </View>
              )}

              {question.type === "insights" && (
                <View>
                  {question.subtitle && (
                    <Text style={styles.insightsSubtitle}>{question.subtitle}</Text>
                  )}
                  
                  {/* Display selected insights */}
                  {selectedInsights.map((insight, index) => (
                    <Animated.View key={index} entering={FadeInDown.delay(index * 100)} style={styles.insightCard}>
                      <View style={styles.insightCardHeader}>
                        <View style={styles.insightQuestionBadge}>
                          <Sparkles size={12} color="#000" />
                          <Text style={styles.insightQuestion}>{insight.question}</Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => {
                            setSelectedInsights(selectedInsights.filter((_, i) => i !== index));
                          }}
                          style={styles.removeInsightBtn}
                        >
                          <X size={16} color="#999" />
                        </TouchableOpacity>
                      </View>
                      
                      <TextInput
                        placeholder="Share your answer..."
                        placeholderTextColor="#BBB"
                        value={insight.answer}
                        onChangeText={(text) => {
                          const updated = [...selectedInsights];
                          updated[index].answer = text;
                          setSelectedInsights(updated);
                        }}
                        multiline
                        style={styles.insightAnswerInput}
                        maxLength={200}
                      />
                      <Text style={styles.charCount}>{insight.answer.length}/200</Text>
                    </Animated.View>
                  ))}
                  
                  {/* Add new insight button */}
                  {selectedInsights.length < 3 && (
                    <TouchableOpacity 
                      onPress={() => setShowQuestionPicker(!showQuestionPicker)}
                      style={styles.addInsightBtn}
                    >
                      <Plus size={20} color="#000" />
                      <Text style={styles.addInsightText}>
                        {selectedInsights.length === 0 ? "Choose your first question" : `Add question (${selectedInsights.length}/3)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Question picker */}
                  {showQuestionPicker && (
                    <Animated.View entering={FadeInDown} style={styles.questionPickerContainer}>
                      <Text style={styles.pickerTitle}>Choose a question</Text>
                      <ScrollView style={styles.questionsList} nestedScrollEnabled>
                        {AVAILABLE_QUESTIONS.filter(
                          q => !selectedInsights.some(insight => insight.question === q)
                        ).map((q) => (
                          <TouchableOpacity
                            key={q}
                            onPress={() => {
                              setSelectedInsights([...selectedInsights, { question: q, answer: "" }]);
                              setShowQuestionPicker(false);
                            }}
                            style={styles.questionOption}
                          >
                            <Text style={styles.questionOptionText}>{q}</Text>
                            <Plus size={18} color="#000" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </Animated.View>
                  )}
                  
                  <Text style={styles.insightsHelper}>
                    💡 These help sponsors get to know the real you beyond your resume
                  </Text>
                </View>
              )}
              
              {question.type === "file" && (
                <TouchableOpacity onPress={handleFilePick} style={[styles.fileContainer, selectedFile && styles.fileContainerActive]}>
                  <Upload color={selectedFile ? "#000" : "#AAA"} size={32} strokeWidth={1.5} />
                  <Text style={[styles.fileTitle, selectedFile && styles.textBold]}>{selectedFile || "Select document"}</Text>
                  <Text style={styles.fileSubtitle}>PDF or Word (max. 10MB)</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            onPress={handleNext} 
            disabled={!canContinue || isSubmitting}
            style={[styles.nextButton, (!canContinue || isSubmitting) && styles.nextButtonDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{isLastQuestion ? "Complete Profile" : "Continue"}</Text>
                <ArrowRight color="#FFF" size={20} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {showSuccess && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill}>
            <View style={styles.successContainer}>
              <Animated.View entering={ZoomIn.delay(200).duration(600)} style={styles.successIconBox}>
                <Sparkles color="#000" size={48} />
              </Animated.View>
              <Animated.Text entering={FadeInDown.delay(400)} style={styles.successTitle}>Profile Created</Animated.Text>
              <Animated.Text entering={FadeInDown.delay(600)} style={styles.successSub}>Welcome to BackChannel</Animated.Text>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1 },
  topNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { padding: 8 },
  stepIndicator: { fontSize: 14, fontWeight: "600", color: "#BBB", textTransform: "uppercase", letterSpacing: 1 },
  progressBarBg: { height: 2, backgroundColor: "#F0F0F0", width: "100%" },
  progressBar: { height: "100%", backgroundColor: "#000" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40 },
  content: { flex: 1 },
  questionText: { fontSize: 32, fontWeight: "700", color: "#000", letterSpacing: -1, lineHeight: 38, marginBottom: 40 },
  optionsContainer: { gap: 12 },
  optionCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderRadius: 16, backgroundColor: "#F9F9F9", borderWidth: 1, borderColor: "#F0F0F0" },
  optionCardSelected: { backgroundColor: "#000", borderColor: "#000" },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  inputWrapper: { backgroundColor: "#F9F9F9", borderRadius: 16, borderWidth: 1, borderColor: "#F0F0F0", paddingHorizontal: 16, height: 64, justifyContent: "center" },
  textInput: { fontSize: 18, color: "#000", fontWeight: "500" },
  fileContainer: { borderWidth: 1, borderStyle: "dashed", borderColor: "#DDD", borderRadius: 20, padding: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAFA" },
  fileContainerActive: { borderColor: "#000", backgroundColor: "#FFF" },
  fileTitle: { fontSize: 16, color: "#000", marginTop: 16, marginBottom: 4 },
  fileSubtitle: { fontSize: 13, color: "#AAA" },
  searchWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9F9F9", borderRadius: 12, paddingHorizontal: 16, height: 54, borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 24 },
  searchInput: { flex: 1, fontSize: 16, color: "#000", fontWeight: "500" },
  skillsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#000", marginBottom: 4 },
  skillItemSelected: { backgroundColor: "#000" },
  skillText: { fontSize: 14, fontWeight: "600", color: "#000" },
  selectionCount: { marginTop: 24, fontSize: 14, color: "#BBB", fontWeight: "600", textAlign: "center" },
  insightsSubtitle: { fontSize: 16, color: "#666", marginBottom: 32, lineHeight: 24 },
  insightCard: { backgroundColor: "#F9F9F9", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  insightCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  insightQuestionBadge: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, backgroundColor: "#FFF", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "#E5E5E5" },
  insightQuestion: { fontSize: 11, fontWeight: "800", color: "#000", letterSpacing: 0.5, flex: 1 },
  removeInsightBtn: { padding: 4 },
  insightAnswerInput: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, fontSize: 15, color: "#000", minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: "#E5E5E5", fontWeight: "500" },
  charCount: { fontSize: 12, color: "#999", marginTop: 8, textAlign: "right" },
  addInsightBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FFF", borderWidth: 2, borderColor: "#000", borderStyle: "dashed", borderRadius: 16, padding: 20, marginBottom: 16 },
  addInsightText: { fontSize: 15, fontWeight: "700", color: "#000" },
  questionPickerContainer: { backgroundColor: "#FFF", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E5E5E5", maxHeight: 300 },
  pickerTitle: { fontSize: 13, fontWeight: "800", color: "#999", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" },
  questionsList: { maxHeight: 240 },
  questionOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  questionOptionText: { fontSize: 13, fontWeight: "700", color: "#000", flex: 1, letterSpacing: 0.3 },
  insightsHelper: { fontSize: 14, color: "#999", lineHeight: 20, marginTop: 8, fontStyle: "italic" },
  footer: { paddingHorizontal: 28, paddingBottom: 30, paddingTop: 20 },
  nextButton: { backgroundColor: "#000", height: 60, borderRadius: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  nextButtonDisabled: { opacity: 0.3 },
  nextButtonText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  textWhite: { color: "#FFF" },
  textBold: { fontWeight: "700" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  successTitle: { fontSize: 28, fontWeight: "800", color: "#000", textAlign: "center" },
  successSub: { fontSize: 16, color: "#666", textAlign: "center", marginTop: 12, lineHeight: 22 },
});