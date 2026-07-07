// Full-screen Edit Resume editor. This is a presentational shell only —
// the actual list state (experiences/education/certs/languages) and the
// per-item edit/expand logic live in ProfileView and are shared with other
// parts of the profile, so they're passed in as render props rather than
// duplicated here. Achievements uses the same field-level tap-to-edit
// mechanism (editingField/tempValue/handleEditField/handleSaveField) as the
// Edit Profile screen, so that state is passed through too.

import { Briefcase, Edit, GraduationCap, Plus } from "@/components/ui/icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  AutofillData,
  EducationEntry,
  ProfessionalExperience,
} from "@/stores/useUserProfileStore";
import { CharCounter } from "../ui/CharCounter";
import { EditorScreen } from "./EditorScreen";

interface Props {
  visible: boolean;
  onClose: () => void;
  professionalMissingCount: number;
  missingFieldLabels: string[];
  professionalExperiences: ProfessionalExperience[];
  educationEntries: EducationEntry[];
  certifications: AutofillData["certifications"];
  languages: AutofillData["languages"];
  achievements: string;
  editingField: string | null;
  tempValue: string;
  setTempValue: (value: string) => void;
  handleEditField: (field: string, currentValue: string) => void;
  handleSaveField: (field: string) => void;
  renderExperienceCard: (experience: ProfessionalExperience) => React.ReactElement | null;
  renderEducationCard: (education: EducationEntry) => React.ReactElement | null;
  renderCertificationCard: (
    cert: AutofillData["certifications"][number],
    index: number,
  ) => React.ReactElement | null;
  renderLanguageCard: (
    lang: AutofillData["languages"][number],
    index: number,
  ) => React.ReactElement | null;
  handleAddExperience: () => void;
  handleAddEducation: () => void;
  handleAddCertification: () => void;
  handleAddLanguage: () => void;
}

export function ResumeScreen({
  visible,
  onClose,
  professionalMissingCount,
  missingFieldLabels,
  professionalExperiences,
  educationEntries,
  certifications,
  languages,
  achievements,
  editingField,
  tempValue,
  setTempValue,
  handleEditField,
  handleSaveField,
  renderExperienceCard,
  renderEducationCard,
  renderCertificationCard,
  renderLanguageCard,
  handleAddExperience,
  handleAddEducation,
  handleAddCertification,
  handleAddLanguage,
}: Props) {
  return (
    <EditorScreen visible={visible} onClose={onClose} title="Edit Resume">
      {professionalMissingCount > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {professionalMissingCount} field
            {professionalMissingCount !== 1 ? "s" : ""} remaining:{" "}
            {missingFieldLabels.join(", ")}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(0, 100 - (professionalMissingCount / 9) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      <Text style={styles.groupLabel}>PROFESSIONAL EXPERIENCE</Text>
      {professionalExperiences.length === 0 && (
        <View style={styles.emptyStateCard}>
          <Briefcase size={32} color="#999" />
          <Text style={styles.emptyStateText}>
            No work experience added yet.{"\n"}
            Add your professional experience here.
          </Text>
        </View>
      )}
      {professionalExperiences.map((exp, idx) => {
        const card = renderExperienceCard(exp);
        if (!card) return null;
        return React.cloneElement(card, { key: exp.id || `exp-${idx}` });
      })}
      <TouchableOpacity style={styles.addItemBtn} onPress={handleAddExperience}>
        <Plus color="#000" size={18} />
        <Text style={styles.addItemText}>Add Work Experience</Text>
      </TouchableOpacity>

      <Text style={styles.groupLabel}>EDUCATION</Text>
      {educationEntries.length === 0 && (
        <View style={styles.emptyStateCard}>
          <GraduationCap size={32} color="#999" />
          <Text style={styles.emptyStateText}>
            No education added yet.{"\n"}
            Add your degrees and schools here.
          </Text>
        </View>
      )}
      {educationEntries.map((entry, idx) => {
        const card = renderEducationCard(entry);
        if (!card) return null;
        return React.cloneElement(card, { key: entry.id || `edu-${idx}` });
      })}
      <TouchableOpacity style={styles.addItemBtn} onPress={handleAddEducation}>
        <Plus color="#000" size={18} />
        <Text style={styles.addItemText}>Add Education</Text>
      </TouchableOpacity>

      <Text style={styles.groupLabel}>ADDITIONAL DETAILS</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>CERTIFICATIONS & LICENSES</Text>
        {certifications.map((cert, index) => renderCertificationCard(cert, index))}
        <TouchableOpacity style={styles.addItemBtn} onPress={handleAddCertification}>
          <Plus color="#000" size={18} />
          <Text style={styles.addItemText}>Add Certification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>LANGUAGES</Text>
        {languages.map((lang, index) => renderLanguageCard(lang, index))}
        <TouchableOpacity style={styles.addItemBtn} onPress={handleAddLanguage}>
          <Plus color="#000" size={18} />
          <Text style={styles.addItemText}>Add Language</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.field, { marginBottom: 0 }]}>
        <Text style={styles.fieldLabel}>ACHIEVEMENTS & AWARDS</Text>
        {editingField === "achievements" ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={styles.bioInput}
              value={tempValue}
              onChangeText={setTempValue}
              placeholder="Notable achievements, awards, publications, speaking engagements..."
              multiline
              maxLength={1000}
              autoCapitalize="sentences"
              autoFocus
              onBlur={() => handleSaveField("achievements")}
            />
            <CharCounter count={tempValue.length} max={1000} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.fieldDisplay}
            onPress={() => handleEditField("achievements", achievements)}
          >
            <Text style={styles.fieldText}>{achievements || "Not set"}</Text>
            <Edit color="#666" size={16} />
          </TouchableOpacity>
        )}
      </View>
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  progressContainer: { marginBottom: 24 },
  progressText: { fontSize: 12, color: "#999", marginBottom: 8, lineHeight: 17 },
  progressBar: { height: 4, backgroundColor: "#F0F0F0", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#000", borderRadius: 2 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 20,
  },
  emptyStateCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  emptyStateText: { fontSize: 13, color: "#999", textAlign: "center", lineHeight: 18 },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  addItemText: { fontSize: 14, fontWeight: "700", color: "#000" },
  field: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  fieldDisplay: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  fieldText: { flex: 1, fontSize: 14, color: "#000", lineHeight: 20 },
  bioInput: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#000",
    minHeight: 100,
    textAlignVertical: "top",
  },
});
