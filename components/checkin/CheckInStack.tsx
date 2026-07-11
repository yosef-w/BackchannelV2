// CheckInStack — the shared card-per-referral session engine both check-in
// sheets render inside CheckInSheetShell. One referral per card, an
// IG-Stories segmented progress bar, the tappable StageTrack as the single
// input, a collapsed optional note, Skip on every card, and a recap frame
// as the session's only exit (the sheet stays deliberately non-dismissible
// — its entry points are all user-initiated, so the lock means "finish the
// pass you started", and Skip keeps it from ever being a hostage
// situation).
//
// Two submit modes, chosen by which callback the role sheet provides:
//  - immediate (applicant): onSubmitCard fires per card; a rejection keeps
//    the card open so nothing is silently lost.
//  - accumulate (sponsor): results collect across cards and onFinalize
//    fires once from the recap (maps onto the batch endpoint).

import { Check, ChevronRight } from "@/components/ui/icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInRight, ZoomIn } from "react-native-reanimated";
import { CharCounter } from "../ui/CharCounter";
import { CompanyLogo } from "../ui/CompanyLogo";
import {
  nextPendingIndex,
  summarize,
  type CardResult,
  type SessionResults,
} from "./checkInSession";
import { StageTrack } from "./StageTrack";

const NOTE_MAX = 500;

export interface StackCardItem {
  id: string;
  /** Big line: company (applicant sheet) / candidate name (sponsor sheet). */
  heading: string;
  /** Role title. */
  subheading: string;
  /** "via Jordan · referred 12 days ago" style context line. */
  meta: string;
  /** Shows the quiet "needs update" tag on the card. */
  stale?: boolean;
  /** Avatar/logo image; falls back to initials from `heading`. */
  imageUrl?: string | null;
}

export interface StackSelection {
  stageIndex: number;
  terminal: boolean;
  note: string;
}

interface CheckInStackProps {
  items: StackCardItem[];
  /** Pipeline stages (terminal excluded). */
  stages: readonly string[];
  terminalLabel: string;
  noteEnabled?: boolean;
  notePlaceholder?: string;
  /** Immediate mode: submit this card now; throw to keep the card open. */
  onSubmitCard?: (item: StackCardItem, selection: StackSelection) => Promise<void>;
  /** Accumulate mode: submit everything from the recap. */
  onFinalize?: (
    updates: { id: string; stageIndex: number; terminal: boolean }[],
  ) => Promise<void>;
  /** Recap primary-button label in accumulate mode, given the update count. */
  finalizeLabel?: (count: number) => string;
  /** Recap subtitle line. */
  recapSubtitle: (updated: number) => string;
  /** Session finished and (if accumulate) finalized — dismiss the sheet. */
  onDone: () => void;
}

export function CheckInStack({
  items,
  stages,
  terminalLabel,
  noteEnabled = false,
  notePlaceholder,
  onSubmitCard,
  onFinalize,
  finalizeLabel,
  recapSubtitle,
  onDone,
}: CheckInStackProps) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SessionResults>({});
  const [showRecap, setShowRecap] = useState(false);

  // Per-card transient state.
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const current = items[index] ?? null;

  // Reset per-card state when the card changes.
  useEffect(() => {
    setStageIndex(null);
    setTerminal(false);
    setNote("");
    setNoteOpen(false);
  }, [index]);

  const summary = summarize(ids, results);
  const hasSelection = terminal || stageIndex !== null;

  const advance = (nextResults: SessionResults) => {
    const next = nextPendingIndex(ids, nextResults, index);
    if (next === null) {
      setShowRecap(true);
    } else {
      setIndex(next);
    }
  };

  const handleSkip = () => {
    if (submitting || !current) return;
    const nextResults: SessionResults = {
      ...results,
      [current.id]: { kind: "skipped" },
    };
    setResults(nextResults);
    advance(nextResults);
  };

  const handleSend = async () => {
    if (!current || !hasSelection || submitting) return;
    const selection: StackSelection = {
      stageIndex: terminal ? -1 : (stageIndex as number),
      terminal,
      note: note.trim(),
    };
    const result: CardResult = {
      kind: "updated",
      stageIndex: selection.stageIndex,
      terminal,
    };

    if (onSubmitCard) {
      try {
        setSubmitting(true);
        await onSubmitCard(current, selection);
      } catch {
        // The role sheet surfaced the error (toast); keep the card open so
        // the answer isn't lost.
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    const nextResults: SessionResults = { ...results, [current.id]: result };
    setResults(nextResults);
    advance(nextResults);
  };

  const handleFinalize = async () => {
    if (!onFinalize) {
      onDone();
      return;
    }
    const updates = ids
      .map((id) => {
        const r = results[id];
        if (r?.kind !== "updated") return null;
        return { id, stageIndex: r.stageIndex, terminal: r.terminal };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    if (updates.length === 0) {
      onDone();
      return;
    }

    try {
      setFinalizing(true);
      await onFinalize(updates);
      onDone();
    } catch {
      // Role sheet surfaced the error — stay on the recap so nothing is lost.
    } finally {
      setFinalizing(false);
    }
  };

  // ── Recap frame ──────────────────────────────────────────────────────────
  if (showRecap) {
    const accumulate = !!onFinalize;
    const primaryLabel =
      accumulate && summary.updated > 0
        ? (finalizeLabel?.(summary.updated) ??
          `Send ${summary.updated} update${summary.updated === 1 ? "" : "s"}`)
        : "Done";
    return (
      <Animated.View entering={ZoomIn.duration(280)} style={styles.recap}>
        <View style={styles.recapBadge}>
          <Check color="#FFF" size={30} strokeWidth={3} />
        </View>
        <Text style={styles.recapTitle}>
          {summary.updated > 0 ? "All caught up" : "Nothing updated"}
        </Text>
        <Text style={styles.recapSubtitle}>
          {summary.updated > 0
            ? recapSubtitle(summary.updated)
            : "You skipped everything this pass — we'll nudge you again later."}
        </Text>

        <View style={styles.recapList}>
          {items.map((item) => {
            const r = results[item.id];
            return (
              <View key={item.id} style={styles.recapRow}>
                <Text style={styles.recapRowText} numberOfLines={1}>
                  {item.heading}
                </Text>
                {r?.kind === "updated" ? (
                  <View style={styles.recapRowBadge}>
                    <Check color="#FFF" size={10} strokeWidth={3.5} />
                    <Text style={styles.recapRowBadgeText}>
                      {r.terminal ? terminalLabel : stages[r.stageIndex]}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.recapRowSkipped}>Skipped</Text>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, finalizing && styles.primaryBtnDisabled]}
          onPress={handleFinalize}
          disabled={finalizing}
          activeOpacity={0.85}
        >
          {finalizing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (!current) return null;

  // ── Card frame ───────────────────────────────────────────────────────────
  const position = Math.min(summary.updated + summary.skipped + 1, items.length);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Stories-style segmented progress — one segment per referral. */}
      {items.length > 1 && (
        <View style={styles.progressRow}>
          {ids.map((id, i) => {
            const handled = !!results[id];
            const isCurrent = i === index;
            return (
              <View
                key={id}
                style={[
                  styles.progressSegment,
                  handled && styles.progressSegmentDone,
                  isCurrent && styles.progressSegmentCurrent,
                ]}
              />
            );
          })}
        </View>
      )}

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.cardScroll}
      >
        <Animated.View
          key={current.id}
          entering={
            items.length > 1
              ? SlideInRight.duration(240)
              : FadeIn.duration(200)
          }
        >
          {items.length > 1 && (
            <Text style={styles.positionText}>
              {position} of {items.length}
            </Text>
          )}

          {/* Identity block */}
          <View style={styles.identity}>
            <CompanyLogo
              logoUrl={current.imageUrl ?? undefined}
              name={current.heading}
              size={56}
              borderRadius={18}
              initialFontSize={22}
            />
            <Text style={styles.heading} numberOfLines={1}>
              {current.heading}
            </Text>
            <Text style={styles.subheading} numberOfLines={1}>
              {current.subheading}
            </Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {current.meta}
            </Text>
            {current.stale && (
              <View style={styles.stalePill}>
                <Text style={styles.stalePillText}>NEEDS AN UPDATE</Text>
              </View>
            )}
          </View>

          <Text style={styles.promptText}>Where are things now?</Text>

          <StageTrack
            stages={stages}
            selectedIndex={stageIndex}
            terminalSelected={terminal}
            terminalLabel={terminalLabel}
            onSelectStage={(i) => {
              setStageIndex(i);
              setTerminal(false);
            }}
            onSelectTerminal={() => {
              setTerminal(true);
              setStageIndex(null);
            }}
          />

          {/* Collapsed optional note. */}
          {noteEnabled &&
            (noteOpen ? (
              <View style={styles.noteWrap}>
                <TextInput
                  style={styles.noteInput}
                  placeholder={notePlaceholder ?? "Add a note (optional)"}
                  placeholderTextColor="#BBB"
                  multiline
                  value={note}
                  onChangeText={setNote}
                  maxLength={NOTE_MAX}
                  autoCapitalize="sentences"
                  textAlignVertical="top"
                  autoFocus
                />
                <CharCounter count={note.length} max={NOTE_MAX} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.noteToggle}
                onPress={() => setNoteOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.noteToggleText}>+ Add a note</Text>
              </TouchableOpacity>
            ))}
        </Animated.View>
      </ScrollView>

      {/* Footer — Skip is always available so one confusing referral can't
          dam the whole session; it comes back around via the nudge cadence. */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!hasSelection || submitting) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!hasSelection || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text
                style={[
                  styles.sendBtnText,
                  !hasSelection && styles.sendBtnTextDisabled,
                ]}
              >
                Send update
              </Text>
              {hasSelection && (
                <ChevronRight color="#FFF" size={17} strokeWidth={2.5} />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Stories-style progress
  progressRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 18,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#EBEBEB",
  },
  progressSegmentDone: {
    backgroundColor: "#000",
  },
  progressSegmentCurrent: {
    backgroundColor: "#BBB",
  },

  cardScroll: {
    paddingBottom: 16,
  },
  positionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  identity: {
    alignItems: "center",
    gap: 4,
    marginBottom: 22,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    marginTop: 10,
  },
  subheading: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
  },
  metaText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  stalePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F4F4F4",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  stalePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#666",
  },

  promptText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 16,
  },

  noteToggle: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  noteToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  noteWrap: {
    marginTop: 16,
  },
  noteInput: {
    minHeight: 84,
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 14,
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F2",
  },
  skipBtn: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  sendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
  },
  sendBtnDisabled: {
    backgroundColor: "#F0F0F0",
  },
  sendBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  sendBtnTextDisabled: {
    color: "#BBB",
  },

  // Recap
  recap: {
    alignItems: "center",
    paddingTop: 28,
    flex: 1,
  },
  recapBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  recapTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  recapSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 12,
  },
  recapList: {
    alignSelf: "stretch",
    gap: 8,
    marginBottom: 24,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recapRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  recapRowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recapRowBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  recapRowSkipped: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AAA",
  },
  primaryBtn: {
    alignSelf: "stretch",
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
