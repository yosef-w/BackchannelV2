import { BlurView } from "expo-blur";
import { ArrowLeft, ArrowRight, Check, Edit3, Mail, Plus, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
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
    Layout,
    useAnimatedStyle,
    withTiming,
    ZoomIn,
} from "react-native-reanimated";

interface SponsorQuestionnaireProps {
  onComplete: () => void;
  onBack: () => void;
}

const AVAILABLE_QUESTIONS = [
  "MY SECRET SUPERPOWER",
  "I'M BEST KNOWN FOR",
  "IF I WASN'T IN TECH",
  "MY FAVORITE BRAINSTORMING FUEL",
  "WHAT I LOOK FOR IN TALENT",
  "ONE THING THAT SURPRISED ME",
  "THE PROJECT I'M MOST PROUD OF",
  "MY MENTORSHIP STYLE",
  "WHY I SPONSOR",
  "WHAT ENERGIZES ME",
  "MY UNPOPULAR OPINION",
  "THE BEST ADVICE I'VE RECEIVED",
  "HOW I RECHARGE",
  "WHAT I'M LEARNING RIGHT NOW",
  "MY LEADERSHIP PHILOSOPHY",
];

const questions = [
  { id: 1, question: "Which company do you currently work at?", type: "text", placeholder: "e.g., Google, Stripe, Goldman Sachs" },
  { id: 2, question: "What is your current job title?", type: "text", placeholder: "e.g., Senior Software Engineer" },
  { id: 3, question: "How long have you worked there?", type: "select", options: ["< 1 year", "1-3 years", "3-5 years", "5+ years"] },
  { id: 4, question: "Are you open to referring qualified candidates?", type: "select", options: ["Yes, absolutely", "Case by case basis", "Not at this time"] },
  { id: 5, question: "Have you given professional referrals in the past?", type: "select", options: ["Frequently", "A few times", "Never yet"] },
  { id: 6, question: "Does your company offer a bonus for successful referrals?", type: "select", options: ["Yes", "No", "I'm not sure"] },
  { id: 7, question: "Share your professional personality", type: "insights", subtitle: "Pick 2-3 questions to help candidates know what you're about" },
  { id: 8, question: "Verify your employment", type: "email", placeholder: "name@company.com" },
];

export function SponsorQuestionnaire({ onComplete, onBack }: SponsorQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  // UI & Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sent">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Insights state
  const [selectedInsights, setSelectedInsights] = useState<Array<{ question: string; answer: string }>>([]);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => onComplete(), 2200);
    }, 2000);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setIsVerifying(true);
      // Simulate verification completion
      setTimeout(() => {
        setIsVerifying(false);
        handleFinalSubmit();
      }, 6000); 
    }
  };

  const handleResend = () => {
    setIsResending(true);
    setTimeout(() => {
      setIsResending(false);
      setResendStatus("sent");
      setTimeout(() => setResendStatus("idle"), 3000);
    }, 1500);
  };

  const handleChangeEmail = () => {
    setIsVerifying(false);
    // Question 8 is index 7 (8th question - email verification)
    setCurrentQuestion(7);
  };

  const handleBack = () => {
    if (isVerifying) {
        setIsVerifying(false);
        return;
    }
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
    else onBack();
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isInsightsScreen = question.type === "insights";
  const canContinue = isInsightsScreen
    ? (selectedInsights.length >= 2 && selectedInsights.length <= 3 && selectedInsights.every(i => i.answer.trim().length > 0))
    : answers[currentQuestion] && answers[currentQuestion].length > 0;

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

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View key={currentQuestion} layout={Layout.springify()} entering={FadeInDown.duration(500)}>
            <Text style={styles.questionText}>{question.question}</Text>

            {!isVerifying ? (
                <>
                {question.type === "insights" ? (
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
                      💡 These help candidates understand your mentorship style and what it's like to work with you
                    </Text>
                  </View>
                ) : question.type === "text" || question.type === "email" ? (
                <View style={styles.inputWrapper}>
                    {question.type === "email" && <Mail color="#AAA" size={20} style={{ marginRight: 12 }} />}
                    <TextInput 
                    placeholder={question.placeholder} 
                    placeholderTextColor="#BBB" 
                    value={answers[currentQuestion] || ""} 
                    onChangeText={(v) => setAnswers({...answers, [currentQuestion]: v})} 
                    style={styles.textInput}
                    autoFocus
                    keyboardType={question.type === "email" ? "email-address" : "default"}
                    autoCapitalize="none"
                    />
                </View>
                ) : (
                <View style={styles.optionsContainer}>
                    {question.options?.map((option) => {
                    const isSelected = answers[currentQuestion] === option;
                    return (
                        <TouchableOpacity 
                        key={option} 
                        onPress={() => setAnswers({...answers, [currentQuestion]: option})} 
                        style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                        >
                        <Text style={[styles.optionText, isSelected && styles.textWhite]}>{option}</Text>
                        {isSelected && <Check color="#FFF" size={20} />}
                        </TouchableOpacity>
                    );
                    })}
                </View>
                )}
                </>
            ) : (
              /* VERIFICATION STATUS DASHBOARD */
              <Animated.View entering={FadeInDown.delay(200)} style={styles.verificationCard}>
                <View style={styles.mailCircle}>
                    <Mail color="#000" size={32} />
                </View>
                <Text style={styles.sentToText}>Link sent to:</Text>
                <Text style={styles.emailDisplay}>{answers[7]}</Text>
                
                <View style={styles.statusBadge}>
                    <ActivityIndicator size="small" color="#666" style={{ transform: [{ scale: 0.8 }] }} />
                    <Text style={styles.statusText}>Awaiting verification...</Text>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={handleResend} disabled={isResending} style={styles.subBtn}>
                        {isResending ? <ActivityIndicator size="small" color="#000" /> : (
                            <>
                                <RefreshCw size={14} color={resendStatus === "sent" ? "#4BB543" : "#000"} />
                                <Text style={[styles.subBtnText, resendStatus === "sent" && { color: "#4BB543" }]}>
                                    {resendStatus === "sent" ? "Sent!" : "Resend"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.verticalDivider} />

                    <TouchableOpacity onPress={handleChangeEmail} style={styles.subBtn}>
                        <Edit3 size={14} color="#000" />
                        <Text style={styles.subBtnText}>Change</Text>
                    </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {!isVerifying && (
            <TouchableOpacity 
              onPress={handleNext} 
              disabled={!canContinue || isSubmitting}
              style={[styles.nextButton, (!canContinue || isSubmitting) && styles.nextButtonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {isLastQuestion ? "Verify & Complete" : "Continue"}
                  </Text>
                  <ArrowRight color="#FFF" size={20} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {showSuccess && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill}>
            <View style={styles.successContainer}>
              <Animated.View entering={ZoomIn.delay(200).duration(600)} style={styles.successIconBox}>
                <ShieldCheck color="#000" size={48} />
              </Animated.View>
              <Animated.Text entering={FadeInDown.delay(400)} style={styles.successTitle}>Verified & Ready</Animated.Text>
              <Animated.Text entering={FadeInDown.delay(600)} style={styles.successSub}>Your professional profile is live. Welcome to the network.</Animated.Text>
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
  questionText: { fontSize: 32, fontWeight: "700", color: "#000", letterSpacing: -1, lineHeight: 38, marginBottom: 40 },
  optionsContainer: { gap: 12 },
  optionCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderRadius: 16, backgroundColor: "#F9F9F9", borderWidth: 1, borderColor: "#F0F0F0" },
  optionCardSelected: { backgroundColor: "#000", borderColor: "#000" },
  optionText: { fontSize: 17, fontWeight: "500", color: "#000" },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F9F9F9", borderRadius: 16, borderWidth: 1, borderColor: "#F0F0F0", paddingHorizontal: 16, height: 64 },
  textInput: { flex: 1, fontSize: 18, color: "#000", fontWeight: "500" },
  
  // Verification Dashboard Styles
  verificationCard: { backgroundColor: "#F9F9F9", borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: "#F0F0F0" },
  mailCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#FFF", alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  sentToText: { fontSize: 14, color: "#999", marginBottom: 4, fontWeight: "500" },
  emailDisplay: { fontSize: 18, fontWeight: "700", color: "#000", marginBottom: 24 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FFF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#EEE", marginBottom: 32 },
  statusText: { fontSize: 13, color: "#666", fontWeight: "600", marginLeft: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-evenly' },
  subBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  subBtnText: { fontSize: 14, fontWeight: "700", color: "#000" },
  verticalDivider: { width: 1, height: 20, backgroundColor: "#EEE" },
  
  // Insights styles
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
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  successTitle: { fontSize: 28, fontWeight: "800", color: "#000", textAlign: "center" },
  successSub: { fontSize: 16, color: "#666", textAlign: "center", marginTop: 12, lineHeight: 22 },
});