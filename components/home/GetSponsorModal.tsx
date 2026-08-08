import { BlurView } from "expo-blur";
import { BellRing, Check, ChevronRight, X } from "@/components/ui/icons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Colors, Type } from "@/constants/theme";

interface GetSponsorModalProps {
  visible: boolean;
  applyStep: "select" | "requested";
  companyName?: string;
  isRequestingSponsor: boolean;
  onClose: () => void;
  onGetSponsor: () => void;
  onDone: () => void;
}

/**
 * "Get a Sponsor" flow for non-sponsored jobs. Extracted from HomeView as a
 * render-only component: applyStep/showApplyModal/pendingJob/
 * isRequestingSponsor are all set from outside this UI (the swipe-intercept
 * handler and handleGetSponsor/handleApplyModalDone), so a state-ownership
 * audit found no state that could safely move — everything stays in
 * HomeView and is passed down as props.
 */
export function GetSponsorModal({
  visible,
  applyStep,
  companyName,
  isRequestingSponsor,
  onClose,
  onGetSponsor,
  onDone,
}: GetSponsorModalProps) {
  return (
    <View style={styles.modalOverlay}>
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
        style={styles.applyModalContent}
      >
        <View style={styles.modalHandle} />

        <View style={styles.applyModalHeader}>
          <Text style={styles.applyModalTitle}>
            {applyStep === "select" ? "Get a Sponsor" : "Request sent!"}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X color="#000" size={24} />
          </TouchableOpacity>
        </View>

        {applyStep === "select" && (
          <Text style={styles.applyModalSubtitle}>
            This role at {companyName} doesn't have an active sponsor yet.
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
                onPress={onGetSponsor}
                disabled={isRequestingSponsor}
                activeOpacity={0.7}
              >
                <View style={styles.modalOptionIcon}>
                  <BellRing color="#000" size={24} />
                </View>
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionTitle}>Get a Sponsor</Text>
                  <Text style={styles.modalOptionDesc}>
                    We'll let employees at {companyName ?? "this company"} know
                    and notify you the moment someone signs on.
                  </Text>
                </View>
                {isRequestingSponsor ? (
                  <ActivityIndicator size="small" color={Colors.muted} />
                ) : (
                  <ChevronRight color={Colors.faint} size={20} />
                )}
              </TouchableOpacity>
            </View>
          )}

          {applyStep === "requested" && (
            <View style={styles.successContainer}>
              <View style={styles.successCircleLarge}>
                <Check color="#FFF" size={40} strokeWidth={3} />
              </View>
              <Text style={styles.successMessage}>
                {`This role doesn't have a dedicated sponsor yet, but your request has been sent to everyone we have available at ${companyName ?? "this company"}. If someone is able to sponsor you for this role, you'll be notified right away.`}
              </Text>
              <TouchableOpacity
                style={styles.successActionBtn}
                onPress={onDone}
                activeOpacity={0.7}
              >
                <Text style={styles.successActionBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
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
  applyModalTitle: { ...Type.heading, color: Colors.ink },
  applyModalSubtitle: {
    fontSize: 14,
    color: Colors.body,
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
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
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
  modalOptionDesc: { fontSize: 13, color: Colors.body, lineHeight: 18 },

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
    color: Colors.body,
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
