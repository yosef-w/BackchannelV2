import { BlurView } from "expo-blur";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Plus,
  Users,
  X,
  Zap
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Modal,
  Platform,
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
  SlideInDown,
  SlideOutDown
} from "react-native-reanimated";

interface JobPosting {
  id: string;
  title: string;
  location: string;
  type: string;
  applicants: number;
  isSponsored?: boolean;
}

const mockJobs: JobPosting[] = [
  { id: "1", title: "Software Engineer", location: "New York, NY", type: "Full-time", applicants: 24 },
  { id: "2", title: "Data Scientist", location: "Remote", type: "Full-time", applicants: 12 },
  { id: "3", title: "Mobile Developer", location: "Austin, TX", type: "Contract", applicants: 8 },
  { id: "4", title: "Machine Learning Lead", location: "San Francisco, CA", type: "Full-time", applicants: 45, isSponsored: true },
];

export function JobsView() {
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
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

        <Animated.Text entering={FadeInDown.delay(50).duration(300)} style={styles.listSectionTitle}>Available Jobs</Animated.Text>
        
        {mockJobs.filter(j => !j.isSponsored).map((job, index) => (
          <Animated.View key={job.id} entering={FadeInUp.delay(100 + (index * 40)).duration(300)}>
            <JobCard 
              job={job} 
              onSponsor={() => handleOpenModal(job)} 
            />
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.sponsoredHeaderRow}>
          <Text style={styles.listSectionTitle}>Sponsored Listings</Text>
          <Zap color="#BBB" size={14} fill="#BBB" />
        </Animated.View>

        {mockJobs.filter(j => j.isSponsored).map((job, index) => (
          <Animated.View key={job.id} entering={FadeInUp.delay(250 + (index * 40)).duration(300)}>
            <JobCard 
              job={job} 
              isSponsored 
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
    </View>
  );
}

function JobCard({ job, isSponsored, onSponsor }: { job: JobPosting; isSponsored?: boolean; onSponsor?: () => void }) {
    return (
      <View style={[styles.card, styles.cardShadow]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWrapper}>
            <Text style={styles.jobTitleText}>{job.title}</Text>
            <View style={styles.metaRow}>
              <MapPin size={12} color="#AAA" />
              <Text style={styles.jobMetaText}>JPMorgan Chase • {job.location}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreBtn}>
            <MoreHorizontal color="#CCC" size={20} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.applicantInfo}>
            <Users color="#666" size={16} />
            <Text style={styles.applicantText}>{job.applicants} Applicants</Text>
          </View>
          <TouchableOpacity 
            onPress={onSponsor} 
            disabled={isSponsored}
            style={[styles.cardSponsorBtn, isSponsored && styles.cardSponsorBtnActive]}
          >
             {isSponsored && <Zap size={12} color="#FFF" fill="#FFF" style={{marginRight: 4}} />}
             <Text style={[styles.cardSponsorBtnText, isSponsored && styles.textWhite]}>
                {isSponsored ? "Sponsoring" : "Sponsor"}
             </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#000" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 4 },
  createButton: { backgroundColor: "#000", flexDirection: "row", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 30 },
  createButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  listSectionTitle: { fontSize: 13, fontWeight: "800", color: "#BBB", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 },
  sponsoredHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 16 },
  card: { backgroundColor: "#FFF", borderRadius: 20, borderWidth: 1, borderColor: "#F0F0F0", padding: 20, marginBottom: 12 },
  cardShadow: { ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 3 } }) },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  titleWrapper: { flex: 1 },
  jobTitleText: { fontSize: 18, fontWeight: "800", color: "#000", marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobMetaText: { fontSize: 14, color: "#666" },
  moreBtn: { padding: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  applicantInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  applicantText: { fontSize: 14, fontWeight: "600", color: "#666" },
  cardSponsorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#000", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  cardSponsorBtnActive: { backgroundColor: '#000' },
  cardSponsorBtnText: { fontSize: 13, fontWeight: "800", color: "#000" },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 50, width: '100%' },
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
  supportText: { fontSize: 14, color: '#666', fontWeight: '600', flex: 1 }
});