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
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import {
    BarFooter,
    canvasSheet,
    EmptySeatCard,
    PosterHero,
    SheetCloseButton,
    Timeline,
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
 * Waitlisted-job detail sheet (applicant view) — Gallery layout. The
 * vertical timeline carries the status ("where am I in the wait?"), and
 * the insider seat renders as a soft dashed card until a sponsor picks
 * the role up. Nudge lives in the action bar once the request has gone
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

      <DismissibleSheet
        onDismiss={onClose}
        style={[modalStyles.modalContent, canvasSheet]}
      >
        {job && (
          <>
            <SheetCloseButton onPress={onClose} />
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <PosterHero
                logoName={job.organization}
                title={job.title}
                company={job.organization}
                location={job.location}
                remote={job.is_remote}
              />

              <Timeline
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
                    sub: sponsored ? "Up next" : "After a sponsor joins",
                    state: sponsored ? "active" : "todo",
                  },
                ]}
              />

              {/* The seat your insider will fill — dashed while empty,
                  solid the moment someone picks the role up. */}
              {sponsored ? (
                <EmptySeatCard
                  filled
                  title="Someone picked this up!"
                  body="A sponsor has taken on this role. Head back to your feed to connect with them directly."
                />
              ) : (
                <EmptySeatCard
                  title="No insider yet"
                  body="This seat is waiting for your way in — you'll get a notification the moment a sponsor picks up this role."
                />
              )}

              {!!job.outcomeMessage && !sponsored && (
                <Text style={styles.outcomeMessage}>{job.outcomeMessage}</Text>
              )}
            </ScrollView>

            {sponsored ? (
              <BarFooter
                button={{ label: "Back to Your Feed", onPress: onClose }}
              />
            ) : canNudge ? (
              <BarFooter
                context={{
                  title: "No sponsor yet",
                  sub: `Waitlisted ${getRelativeTime(job.waitlisted_at)}`,
                  waiting: true,
                }}
                button={{
                  label: "Nudge",
                  onPress: () => onNudge(job),
                  loading: isNudging,
                  spinnerOnLoading: true,
                }}
              />
            ) : (
              <BarFooter
                context={{
                  title: "We'll notify you",
                  sub: "The moment a sponsor steps up",
                  waiting: true,
                }}
              />
            )}
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned action bar; scrolls the overflow.
  scroll: { flexShrink: 1 },
  outcomeMessage: {
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
    fontWeight: "500",
    fontStyle: "italic",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});
