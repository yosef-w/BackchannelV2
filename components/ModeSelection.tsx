import { ArrowLeft, Briefcase, ChevronRight, Handshake } from "lucide-react-native";
import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";
import { useOnboardingStore } from "../stores/useOnboardingStore";

interface ModeSelectionProps {
  onSelect: (mode: "applicant" | "sponsor") => void;
  onBack: () => void;
  onSkipToDashboard?: () => void;
  onSkipToApplicantDashboard?: () => void;
}

export function ModeSelection({ onSelect, onBack, onSkipToDashboard, onSkipToApplicantDashboard }: ModeSelectionProps) {
  const [selected, setSelected] = useState<"applicant" | "sponsor" | null>(null);
  const setUserType = useOnboardingStore((state) => state.setUserType);

  const handleSelect = (mode: "applicant" | "sponsor") => {
    setSelected(mode);
    setUserType(mode);
    setTimeout(() => onSelect(mode), 200);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Back Button */}
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <ArrowLeft color="#000" size={24} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Header Section - No Spring, just clean Ease Out */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            style={styles.header}
          >
            <Text style={styles.title}>How will you use{"\n"}BackChannel?</Text>
            <Text style={styles.subtitle}>Select your role to continue</Text>
          </Animated.View>

          <View style={styles.cardsContainer}>
            {/* Applicant Card */}
            <Animated.View 
              entering={FadeInDown.delay(100).duration(500)}
            >
              <TouchableOpacity
                onPress={() => handleSelect("applicant")}
                activeOpacity={0.9}
                style={[
                  styles.card,
                  selected === "applicant" && styles.cardSelected
                ]}
              >
                <View style={styles.cardMain}>
                  <View style={[
                    styles.iconCircle,
                    selected === "applicant" && styles.iconCircleSelected
                  ]}>
                    <Briefcase 
                      color={selected === "applicant" ? "#FFF" : "#000"} 
                      size={22} 
                      strokeWidth={2} 
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[
                      styles.cardTitle,
                      selected === "applicant" && styles.textSelected
                    ]}>I'm an Applicant</Text>
                    <Text style={[
                      styles.cardDescription,
                      selected === "applicant" && styles.textSelectedMuted
                    ]}>
                      I want to find referrals and land my next role.
                    </Text>
                  </View>
                </View>
                <ChevronRight 
                  color={selected === "applicant" ? "#FFF" : "#CCC"} 
                  size={18} 
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Sponsor Card */}
            <Animated.View 
              entering={FadeInDown.delay(200).duration(500)}
            >
              <TouchableOpacity
                onPress={() => handleSelect("sponsor")}
                activeOpacity={0.9}
                style={[
                  styles.card,
                  selected === "sponsor" && styles.cardSelected
                ]}
              >
                <View style={styles.cardMain}>
                  <View style={[
                    styles.iconCircle,
                    selected === "sponsor" && styles.iconCircleSelected
                  ]}>
                    <Handshake 
                      color={selected === "sponsor" ? "#FFF" : "#000"} 
                      size={22} 
                      strokeWidth={2} 
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[
                      styles.cardTitle,
                      selected === "sponsor" && styles.textSelected
                    ]}>I'm a Sponsor</Text>
                    <Text style={[
                      styles.cardDescription,
                      selected === "sponsor" && styles.textSelectedMuted
                    ]}>
                      I want to refer talent and help others grow.
                    </Text>
                  </View>
                </View>
                <ChevronRight 
                  color={selected === "sponsor" ? "#FFF" : "#CCC"} 
                  size={18} 
                />
              </TouchableOpacity>

              <View style={styles.skipLinksContainer}>
                {!!onSkipToDashboard && (
                  <TouchableOpacity
                    onPress={onSkipToDashboard}
                    activeOpacity={0.7}
                    style={styles.skipToDashboard}
                  >
                    <Text style={styles.skipToDashboardText}>Skip to Sponsor Dashboard</Text>
                  </TouchableOpacity>
                )}

                {!!onSkipToApplicantDashboard && (
                  <TouchableOpacity
                    onPress={onSkipToApplicantDashboard}
                    activeOpacity={0.7}
                    style={styles.skipToDashboard}
                  >
                    <Text style={styles.skipToDashboardText}>Skip to Applicant Dashboard</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Branding Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>- BackChannel Logo -</Text>
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
  backButton: {
    padding: 20,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  header: {
    marginBottom: 44,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 17,
    color: "#666",
    marginTop: 12,
    fontWeight: "400",
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBFBFB",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    justifyContent: "space-between",
  },
  cardSelected: {
    backgroundColor: "#000000", // Brand Black
    borderColor: "#000000",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  iconCircleSelected: {
    backgroundColor: "#222", // Slightly lighter black for icon visibility
    borderColor: "#333",
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    lineHeight: 20,
  },
  textSelected: {
    color: "#FFFFFF",
  },
  textSelectedMuted: {
    color: "#AAAAAA",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 11,
    color: "#BBB",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  skipLinksContainer: {
    marginTop: 24,
    alignItems: "center",
    gap: 12,
  },
  skipToDashboard: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipToDashboardText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});