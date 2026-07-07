import { CheckCircle, Clock, MapPin } from "@/components/ui/icons";
import { getRelativeTime } from "@/utils/relativeTime";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { WaitlistedJob } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface WaitlistedJobModalProps {
  /** The waitlisted job whose detail is being viewed, or null when closed. */
  job: WaitlistedJob | null;
  onClose: () => void;
  isNudging: boolean;
  onNudge: (job: WaitlistedJob) => void;
}

/**
 * Waitlisted-job detail sheet (applicant view) — shows whether the role has
 * since found a sponsor, and offers a "Nudge again" CTA once the original
 * request has gone quiet for 5+ days. Extracted from MatchesView; shares
 * the hero/location styles via sharedModalStyles.ts.
 */
export function WaitlistedJobModal({
  job,
  onClose,
  isNudging,
  onNudge,
}: WaitlistedJobModalProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        onDismiss={onClose}
        style={[modalStyles.modalContent, { maxHeight: "65%" }]}
      >
        {job && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Hero */}
            <View style={modalStyles.jobModalHero}>
              <View style={styles.jobModalHeroInitial}>
                <Text style={styles.jobModalHeroInitialText}>
                  {(job.organization || "?")[0].toUpperCase()}
                </Text>
              </View>
              <Text style={modalStyles.jobModalHeroTitle}>{job.title}</Text>
              <Text style={modalStyles.jobModalHeroCompany}>
                {job.organization}
              </Text>
              {!!job.location && (
                <View style={modalStyles.jobModalLocationRow}>
                  <MapPin size={13} color="#999" />
                  <Text style={modalStyles.jobModalLocationText}>
                    {job.location}
                  </Text>
                  {job.is_remote && (
                    <View style={modalStyles.jobRemoteBadge}>
                      <Text style={modalStyles.jobRemoteText}>Remote</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Status banner */}
            {job.is_now_sponsored ? (
              <View style={styles.statusBanner}>
                <CheckCircle size={22} color="#000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Now Sponsored!</Text>
                  <Text style={styles.statusBody}>
                    A sponsor has picked up this role. Head back to your feed
                    to connect with them directly.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.statusBanner}>
                <Clock size={22} color="#666" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusTitle, { color: "#666" }]}>
                    Waiting for a Sponsor
                  </Text>
                  <Text style={styles.statusBody}>
                    We’ll notify you as soon as someone sponsors this role.
                    Keep an eye on your notifications.
                  </Text>
                  {!!job.outcomeMessage && (
                    <Text style={styles.outcomeMessage}>
                      {job.outcomeMessage}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Waitlist date */}
            <Text style={styles.waitlistedDate}>
              Waitlisted {getRelativeTime(job.waitlisted_at)}
            </Text>

            {/* Nudge again — only once the request has gone quiet for a
                while; re-sending immediately would just be noise. */}
            {!job.is_now_sponsored &&
              Date.now() - new Date(job.waitlisted_at).getTime() >=
                5 * 24 * 60 * 60 * 1000 && (
                <TouchableOpacity
                  style={[
                    styles.nudgeBtn,
                    isNudging && { opacity: 0.6 },
                  ]}
                  onPress={() => onNudge(job)}
                  disabled={isNudging}
                  activeOpacity={0.85}
                >
                  {isNudging ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.nudgeBtnText}>Nudge again</Text>
                  )}
                </TouchableOpacity>
              )}
          </ScrollView>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  jobModalHeroInitial: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  jobModalHeroInitialText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
  },
  statusBanner: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  statusBody: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
    fontWeight: "500",
  },
  outcomeMessage: {
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 10,
    fontStyle: "italic",
  },
  waitlistedDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#BBB",
    textAlign: "center",
    marginBottom: 16,
  },
  nudgeBtn: {
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  nudgeBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
