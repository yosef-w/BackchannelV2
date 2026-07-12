import { getRelativeTime } from "@/utils/relativeTime";
import { BlurView } from "expo-blur";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import {
    FooterButton,
    InsiderSlot,
    JobSheetHero,
    JourneySteps,
    SheetCloseButton,
    SheetFooter,
    WaitingBar,
} from "./JobSheetKit";
import { WaitlistedJob } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface WaitlistedJobModalProps {
  /** The waitlisted job whose detail is being viewed, or null when closed. */
  job: WaitlistedJob | null;
  onClose: () => void;
  isNudging: boolean;
  onNudge: (job: WaitlistedJob) => void;
}

/** Re-sending a nudge before the request has gone quiet is just noise. */
const NUDGE_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Waitlisted-job detail sheet (applicant view) — JobSheetKit layout. The
 * whole point of this sheet is "where am I in the wait?", so the journey
 * strip carries the status, and the insider card renders as an EMPTY slot
 * (dashed) until a sponsor picks the role up — the absence of the human is
 * the status. Nudge lives in the pinned footer once the request has gone
 * quiet for 5+ days.
 */
export function WaitlistedJobModal({
  job,
  onClose,
  isNudging,
  onNudge,
}: WaitlistedJobModalProps) {
  const sponsored = !!job?.is_now_sponsored;
  const canNudge =
    !!job &&
    !sponsored &&
    Date.now() - new Date(job.waitlisted_at).getTime() >= NUDGE_COOLDOWN_MS;

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

      <DismissibleSheet onDismiss={onClose} style={modalStyles.modalContent}>
        {job && (
          <>
            <SheetCloseButton onPress={onClose} />
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <JobSheetHero
                logoName={job.organization}
                title={job.title}
                company={job.organization}
                location={job.location}
                remote={job.is_remote}
                insetForClose
              />
              <View style={{ height: 12 }} />

              <JourneySteps
                steps={[
                  {
                    label: "Requested",
                    sub: getRelativeTime(job.waitlisted_at),
                    state: "done",
                  },
                  {
                    label: "Sponsor found",
                    sub: sponsored ? undefined : "Searching…",
                    state: sponsored ? "done" : "active",
                  },
                  {
                    label: "Match",
                    sub: sponsored ? "Up next" : undefined,
                    state: "todo",
                  },
                ]}
              />

              {/* The slot your insider will fill — dashed while empty,
                  solid the moment someone picks the role up. */}
              {sponsored ? (
                <InsiderSlot
                  filled
                  title="Someone picked this up!"
                  body="A sponsor has taken on this role. Head back to your feed to connect with them directly."
                />
              ) : (
                <InsiderSlot
                  title="Nobody here yet"
                  body="We're looking for your way in — you'll get a notification the moment a sponsor picks up this role."
                />
              )}

              {!!job.outcomeMessage && !sponsored && (
                <Text style={styles.outcomeMessage}>{job.outcomeMessage}</Text>
              )}
            </ScrollView>

            <SheetFooter>
              {sponsored ? (
                <FooterButton label="Back to Your Feed" onPress={onClose} />
              ) : canNudge ? (
                <FooterButton
                  label="Nudge Again"
                  onPress={() => onNudge(job)}
                  loading={isNudging}
                  spinnerOnLoading
                />
              ) : (
                <WaitingBar text="We'll notify you when a sponsor steps up" />
              )}
            </SheetFooter>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned footer; scrolls the overflow.
  scroll: { flexShrink: 1 },
  outcomeMessage: {
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
    fontWeight: "500",
    fontStyle: "italic",
    marginBottom: 8,
  },
});
