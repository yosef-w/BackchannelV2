// PromptsIntake — Hinge-style profile prompts (personality intake).
//
// Three focused moments:
//   1. Slots      — filled prompt cards + empty "answer a prompt" invitations.
//   2. Library    — a full-screen, categorized, searchable prompt picker.
//   3. Editor     — a calm full-screen answer editor with an example placeholder.
//
// Pure UI over the existing insights data shape (`{ question, answer }[]`), so
// it drops into both signup questionnaires with no data-model change.

import { ChevronRight, Pencil, Plus, Search, X } from "@/components/ui/icons";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { PromptCategory } from "@/constants/prompts";

export interface PromptAnswer {
  question: string;
  answer: string;
}

interface PromptsIntakeProps {
  value: PromptAnswer[];
  onChange: (next: PromptAnswer[]) => void;
  categories: PromptCategory[];
  examples?: Record<string, string>;
  /** Minimum answered prompts (empty slots shown up to this). Default 2. */
  min?: number;
  /** Maximum answered prompts. Default 3. */
  max?: number;
  maxAnswerLength?: number;
  subtitle?: string;
  /** Label on the dashed empty slot. Default "Answer a prompt". */
  emptySlotLabel?: string;
}

export function PromptsIntake({
  value,
  onChange,
  categories,
  examples = {},
  min = 2,
  max = 3,
  maxAnswerLength = 200,
  subtitle,
  emptySlotLabel = "Answer a prompt",
}: PromptsIntakeProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Editor state: `editorPrompt` non-null means the editor is open.
  const [editorPrompt, setEditorPrompt] = useState<string | null>(null);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const usedPrompts = useMemo(
    () => new Set(value.map((v) => v.question)),
    [value],
  );

  // Empty slots to render beneath the answered ones (up to `min`), plus an
  // optional "add another" once the minimum is met. Even with min=0 (fully
  // optional, e.g. job insights) an empty list still shows one dashed
  // invitation slot — a bare "add another" link reads like an afterthought.
  const emptySlots = Math.max(
    value.length === 0 && max > 0 ? 1 : 0,
    min - value.length,
  );
  const canAddMore =
    value.length >= Math.max(min, 1) && value.length < max;

  const openLibraryForNew = () => {
    if (value.length >= max) return;
    setEditorPrompt(null);
    setEditorIndex(null);
    setDraft("");
    setSearch("");
    setLibraryOpen(true);
  };

  // From inside the editor ("choose a different prompt"): hide the editor but
  // keep the in-progress draft + index, so it reopens on the new prompt instead
  // of stacking two modals.
  const openLibraryForChange = () => {
    setEditorPrompt(null);
    setSearch("");
    setLibraryOpen(true);
  };

  const openEditorForExisting = (index: number) => {
    setEditorPrompt(value[index].question);
    setEditorIndex(index);
    setDraft(value[index].answer);
  };

  const selectPrompt = (prompt: string) => {
    // Keep any in-progress draft/index when swapping the prompt from the editor.
    setEditorPrompt(prompt);
    setLibraryOpen(false);
  };

  const saveEditor = () => {
    if (editorPrompt === null || !draft.trim()) return;
    const item: PromptAnswer = { question: editorPrompt, answer: draft.trim() };
    if (editorIndex === null) {
      onChange([...value, item]);
    } else {
      onChange(value.map((v, i) => (i === editorIndex ? item : v)));
    }
    closeEditor();
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const closeEditor = () => {
    setEditorPrompt(null);
    setEditorIndex(null);
    setDraft("");
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .map((cat) => ({
        title: cat.title,
        prompts: cat.prompts.filter(
          (p) =>
            // Hide already-used prompts (except the one we're editing).
            (!usedPrompts.has(p) || p === editorPrompt) &&
            (!q || p.toLowerCase().includes(q)),
        ),
      }))
      .filter((cat) => cat.prompts.length > 0);
  }, [categories, search, usedPrompts, editorPrompt]);

  return (
    <View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* Answered prompts */}
      {value.map((item, index) => (
        <View key={`${item.question}-${index}`} style={styles.filledCard}>
          <View style={styles.filledHeader}>
            <View style={styles.promptBadge}>
              <Text style={styles.promptBadgeText}>{item.question}</Text>
            </View>
            <View style={styles.filledActions}>
              <TouchableOpacity
                onPress={() => openEditorForExisting(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Pencil size={16} color="#999" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeAt(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openEditorForExisting(index)}
          >
            <Text style={styles.filledAnswer}>{item.answer}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Empty slots up to the minimum */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <TouchableOpacity
          key={`empty-${i}`}
          style={styles.emptySlot}
          activeOpacity={0.7}
          onPress={openLibraryForNew}
        >
          <View style={styles.emptyPlus}>
            <Plus size={18} color="#000" />
          </View>
          <Text style={styles.emptyText}>{emptySlotLabel}</Text>
          <ChevronRight size={18} color="#CCC" />
        </TouchableOpacity>
      ))}

      {/* Optional "add another" once the minimum is satisfied */}
      {canAddMore ? (
        <TouchableOpacity
          style={styles.addAnother}
          activeOpacity={0.7}
          onPress={openLibraryForNew}
        >
          <Plus size={16} color="#666" />
          <Text style={styles.addAnotherText}>Add another prompt</Text>
        </TouchableOpacity>
      ) : null}

      {min > 0 ? (
        <Text style={styles.progress}>
          {value.length} of {min} answered
        </Text>
      ) : value.length > 0 ? (
        <Text style={styles.progress}>
          {value.length} {value.length === 1 ? "prompt" : "prompts"} answered
        </Text>
      ) : null}

      {/* ── Library sheet ─────────────────────────────────────────────────── */}
      <Modal
        visible={libraryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLibraryOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.sheet}>
          <SafeAreaView style={styles.sheetSafe}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose a prompt</Text>
              <TouchableOpacity
                onPress={() => setLibraryOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Search size={18} color="#AAA" />
              <TextInput
                placeholder="Search prompts…"
                placeholderTextColor="#BBB"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredCategories.map((cat) => (
                <View key={cat.title} style={styles.category}>
                  <Text style={styles.categoryTitle}>
                    {cat.title.toUpperCase()}
                  </Text>
                  {cat.prompts.map((prompt) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.promptRow}
                      activeOpacity={0.6}
                      onPress={() => selectPrompt(prompt)}
                    >
                      <Text style={styles.promptRowText}>{prompt}</Text>
                      <ChevronRight size={18} color="#CCC" />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {filteredCategories.length === 0 ? (
                <Text style={styles.noResults}>No prompts match “{search}”.</Text>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Answer editor ─────────────────────────────────────────────────── */}
      <Modal
        visible={editorPrompt !== null}
        animationType="slide"
        onRequestClose={closeEditor}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.editorSafe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.editorFlex}
          >
            <View style={styles.editorHeader}>
              <TouchableOpacity
                onPress={closeEditor}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.editorScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View entering={FadeInDown.duration(350)}>
                <View style={styles.editorBadge}>
                  <Text style={styles.editorBadgeText}>{editorPrompt}</Text>
                </View>
                  <TextInput
                    placeholder={
                      (editorPrompt && examples[editorPrompt]) ||
                      "Share your answer…"
                    }
                    placeholderTextColor="#A3A3A3"
                    value={draft}
                    onChangeText={setDraft}
                    style={styles.editorInput}
                    multiline
                    autoFocus
                    maxLength={maxAnswerLength}
                    autoCapitalize="sentences"
                  />
                  <View style={styles.editorMetaRow}>
                    <TouchableOpacity
                      onPress={openLibraryForChange}
                      style={styles.changePromptBtn}
                    >
                      <Text style={styles.changePromptText}>
                        Choose a different prompt
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.charCount}>
                      {draft.length}/{maxAnswerLength}
                    </Text>
                  </View>
                </Animated.View>
              </ScrollView>

              <Animated.View entering={FadeIn} style={styles.editorFooter}>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    !draft.trim() && styles.saveBtnDisabled,
                  ]}
                  disabled={!draft.trim()}
                  onPress={saveEditor}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveBtnText}>Save answer</Text>
                </TouchableOpacity>
              </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 28,
  },

  // Filled prompt card
  filledCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 18,
    marginBottom: 14,
  },
  filledHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  promptBadge: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    flexShrink: 1,
  },
  promptBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  filledActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingLeft: 12,
  },
  filledAnswer: { fontSize: 16, color: "#000", lineHeight: 22, fontWeight: "500" },

  // Empty slot
  emptySlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#000",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  emptyPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { flex: 1, fontSize: 16, fontWeight: "700", color: "#000" },

  addAnother: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  addAnotherText: { fontSize: 14, fontWeight: "600", color: "#666" },

  progress: {
    marginTop: 8,
    fontSize: 14,
    color: "#BBB",
    fontWeight: "600",
    textAlign: "center",
  },

  // Library sheet
  sheet: { flex: 1, backgroundColor: "#FFF" },
  sheetSafe: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetTitle: { fontSize: 24, fontWeight: "800", color: "#000", letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    // Give the input the same fixed height as its row (searchWrap) instead
    // of relying on intrinsic content sizing — without it, centering the
    // text/placeholder within an auto-sized box is unreliable and it ends up
    // sitting low.
    height: 48,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
    // Kill the platform's default vertical padding so the text/placeholder sits
    // centered in the field instead of dropping low / getting clipped.
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  sheetScroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  category: { marginBottom: 24 },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 8,
  },
  promptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  promptRowText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.3,
    flex: 1,
  },
  noResults: { fontSize: 15, color: "#999", textAlign: "center", marginTop: 24 },

  // Answer editor
  editorSafe: { flex: 1, backgroundColor: "#FFF" },
  editorFlex: { flex: 1 },
  editorHeader: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  editorScroll: { paddingHorizontal: 28, paddingTop: 12 },
  editorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 20,
  },
  editorBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  editorInput: {
    fontSize: 22,
    color: "#000",
    fontWeight: "500",
    lineHeight: 30,
    minHeight: 140,
    textAlignVertical: "top",
  },
  editorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  changePromptBtn: { paddingVertical: 4 },
  changePromptText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textDecorationLine: "underline",
  },
  charCount: { fontSize: 13, color: "#BBB", fontWeight: "500" },
  editorFooter: { paddingHorizontal: 28, paddingBottom: 16, paddingTop: 8 },
  saveBtn: {
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
