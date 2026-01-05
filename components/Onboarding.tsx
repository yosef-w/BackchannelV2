import { ArrowLeft, ArrowRight, Building2, HandHeart, Network, Rocket, Send, Target, TrendingUp, UserCheck, Zap } from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOut
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingProps {
  onComplete: () => void;
  onBack: () => void;
  userType: "applicant" | "sponsor";
}

const applicantSlides = [
  {
    Icon: UserCheck,
    title: "Connect with insiders who can refer you",
    description: "Build authentic relationships with professionals who work at your dream companies.",
  },
  {
    Icon: Rocket,
    title: "Skip the resume black hole",
    description: "Get your application directly in front of hiring managers through employee referrals.",
  },
  {
    Icon: TrendingUp,
    title: "Land interviews 5x faster",
    description: "Referred candidates are significantly more likely to get interviews and offers.",
  },
];

const sponsorSlides = [
  {
    Icon: HandHeart,
    title: "Help talented people break into great companies",
    description: "Use your position to open doors for deserving candidates at your company.",
  },
  {
    Icon: Building2,
    title: "Shape your future team",
    description: "Strengthen your organization by referring peers who align with your company's high standards.",
  },
  {
    Icon: Network,
    title: "Expand your professional network",
    description: "Build lasting relationships with top talent and grow your influence across the industry.",
  },
];

export function Onboarding({ onComplete, onBack, userType }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = userType === "applicant" ? applicantSlides : sponsorSlides;

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    } else {
      onBack();
    }
  };

  const currentSlideData = slides[currentSlide];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={prevSlide} style={styles.iconBtn}>
            <ArrowLeft color="#000" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComplete}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Animated.View
            key={currentSlide}
            entering={FadeInDown.duration(500)}
            exiting={FadeOut.duration(300)}
            style={styles.slideWrapper}
          >
            {/* Minimal Icon Representation */}
            <View style={styles.iconCircle}>
              <currentSlideData.Icon color="#000" size={40} strokeWidth={1.5} />
            </View>

            <View style={styles.textSection}>
              <Text style={styles.title}>{currentSlideData.title}</Text>
              <Text style={styles.description}>{currentSlideData.description}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          {/* Progress Indicator */}
          <View style={styles.dotsContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentSlide ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            onPress={nextSlide} 
            activeOpacity={0.8} 
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 ? "Get Started" : "Continue"}
            </Text>
            <ArrowRight color="#FFF" size={20} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  iconBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  slideWrapper: {
    alignItems: "flex-start", // Left-aligned for a modern professional look
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  textSection: {
    width: "100%",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: "#666",
    lineHeight: 26,
    fontWeight: "400",
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 32,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 24,
    backgroundColor: "#000",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#EEE",
  },
  nextButton: {
    backgroundColor: "#000",
    height: 60,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  nextButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
});