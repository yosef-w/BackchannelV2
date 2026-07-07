import { ChevronRight } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CreateJobStepHeader } from "./CreateJobStepHeader";
import { JobPreviewCard } from "./JobPreviewCard";

export interface EditableJobFields {
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  description: string;
}

interface CreateJobReviewScreenProps {
  visible: boolean;
  initial: EditableJobFields;
  /** True when the scrape found nothing — softens the framing so an empty
   * form doesn't read as a failure state. */
  wasAutoFilled: boolean;
  onContinue: (fields: EditableJobFields) => void;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Step 3 — the auto-filled (or blank) listing, fully editable before the
 * sponsor moves on. This is the "review" half of "review before you
 * commit": whatever the scrape got right stays, whatever it got wrong or
 * missed gets fixed here, in the same tap-a-field editor vocabulary as
 * Edit Profile.
 */
export function CreateJobReviewScreen({
  visible,
  initial,
  wasAutoFilled,
  onContinue,
  onBack,
  onClose,
}: CreateJobReviewScreenProps) {
  const [fields, setFields] = useState(initial);

  // Re-seed local edit state whenever a fresh scrape result arrives.
  useEffect(() => {
    if (visible) setFields(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial.title, initial.company]);

  if (!visible) return null;

  const set = (key: keyof EditableJobFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const canContinue = fields.title.trim().length > 0 && fields.company.trim().length > 0;

  return (
    <View style={styles.screen}>
      <CreateJobStepHeader
        title="Review the Listing"
        step={3}
        totalSteps={4}
        onBack={onBack}
        onClose={onClose}
      />
      {/* Keyboard avoidance is handled once at the flow root
          (CreateJobFlowScreen) — no per-screen KAV. */}
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <JobPreviewCard fields={fields} pending={{}} />

          <Text style={styles.helperText}>
            {wasAutoFilled
              ? "Here's what we found — fix anything that's off before it goes live."
              : "We couldn't auto-read this page. Fill in the basics below."}
          </Text>

          <Field
            label="JOB TITLE"
            required
            value={fields.title}
            onChangeText={set("title")}
            autoCapitalize="words"
          />
          <Field
            label="COMPANY"
            required
            value={fields.company}
            onChangeText={set("company")}
            autoCapitalize="words"
          />
          <Field
            label="LOCATION"
            value={fields.location}
            onChangeText={set("location")}
            placeholder="e.g. New York, NY or Remote"
            autoCapitalize="words"
          />
          <View style={styles.row}>
            <View style={styles.rowField}>
              <Field
                label="SALARY"
                value={fields.salary}
                onChangeText={set("salary")}
                placeholder="e.g. $120k - $150k"
              />
            </View>
            <View style={styles.rowField}>
              <Field
                label="TYPE"
                value={fields.type}
                onChangeText={set("type")}
                placeholder="Full-time"
                autoCapitalize="words"
              />
            </View>
          </View>
          <Field
            label="DESCRIPTION"
            value={fields.description}
            onChangeText={set("description")}
            placeholder="What does this role involve?"
            multiline
            style={styles.descriptionInput}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            disabled={!canContinue}
            onPress={() => onContinue(fields)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.continueBtnText,
                !canContinue && styles.continueBtnTextDisabled,
              ]}
            >
              Continue
            </Text>
            {canContinue && <ChevronRight color="#FFF" size={18} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  required,
  value,
  onChangeText,
  style,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  style?: object;
  placeholder?: string;
  autoCapitalize?: "words" | "none" | "sentences";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.requiredStar}>*</Text>}
      </View>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#BBB"
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  helperText: {
    fontSize: 13,
    color: "#999",
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 19,
  },
  row: { flexDirection: "row", gap: 12 },
  rowField: { flex: 1 },
  field: { marginBottom: 20 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.6,
  },
  requiredStar: { fontSize: 13, color: "#DC2626", fontWeight: "700" },
  input: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#000",
  },
  descriptionInput: { minHeight: 110, textAlignVertical: "top" },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  continueBtn: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueBtnDisabled: { backgroundColor: "#F0F0F0" },
  continueBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  continueBtnTextDisabled: { color: "#BBB" },
});
