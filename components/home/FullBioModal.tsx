import { BlurView } from "expo-blur";
import { Info, X } from "@/components/ui/icons";
import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

interface FullBioModalProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  bio: string;
}

/**
 * Render-only "About" sheet showing a candidate's full bio. Extracted from
 * HomeView verbatim — showFullBio stays in HomeView (opened from elsewhere
 * in the card UI), and name/bio are derived from currentData/
 * fullProfileCache in the parent, which keeps both since they're read from
 * many other places in HomeView.
 */
export function FullBioModal({ visible, onClose, name, bio }: FullBioModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#FFF",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 12,
          paddingBottom: 40,
          maxHeight: "75%",
          shadowColor: "#000",
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
            backgroundColor: "#D1D5DB",
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Info color="#000" size={20} />
            </View>
            <View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: "#000",
                  letterSpacing: -0.5,
                }}
              >
                About
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#999",
                  marginTop: 2,
                }}
              >
                {name}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              backgroundColor: "#F5F5F5",
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X color="#666" size={18} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: "#F0F0F0",
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
              fontSize: 16,
              lineHeight: 26,
              color: "#444",
              fontWeight: "500",
              letterSpacing: -0.2,
            }}
          >
            {bio}
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
