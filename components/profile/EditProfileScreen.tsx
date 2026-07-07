// Full-screen Edit Profile editor — autosave on blur. Every field is always
// editable (no more tap-to-edit-then-checkmark), and each one saves itself
// the moment focus leaves it, mirroring NotificationsScreen/ResumeScreen's
// header "Saved" pill. Tags and work-preference checkboxes already saved
// themselves immediately before this redesign, so those interactions are
// unchanged — only the plain text/select fields gained the always-visible +
// onBlur-save treatment.
//
// Location is a single "City, State" field (Places `mode="city"`), matching
// onboarding (ApplicantQuestionnaire) exactly — the product only ever reads
// city for matching/display (see utils/profileCompletion.ts), so there's no
// separate street/zip/country UI here anymore.
//
// State/handlers that persist to the backend (handleSaveField, tag
// handlers) still live in ProfileView because they're shared with
// ResumeScreen's Achievements field — this screen only owns the local text
// values while the user is typing.

import { Check, Lock, MapPin, Plus, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GOOGLE_PLACES_API_KEY } from "../../constants/config";
import { ALL_SKILLS } from "../../constants/skills";
import { AutocompleteInput } from "../ui/AutocompleteInput";
import { CharCounter } from "../ui/CharCounter";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { EditorScreen } from "./EditorScreen";
import { SaveStatusPill } from "./SaveStatusPill";
import { useAutosaveStatus } from "./useAutosaveStatus";

interface Props {
  visible: boolean;
  onClose: () => void;
  userType: "applicant" | "sponsor";
  isFieldMissing: (field: string) => boolean;
  personalMissingCount: number;
  missingFieldLabels: string[];

  firstName: string;
  lastName: string;
  role: string;
  company: string;
  workEmailVerified: boolean;
  email: string;
  workEmail: string;
  bio: string;
  location: string;
  expertise: string[];
  workPreferences: string[];
  desiredRoles: string[];

  onSaveField: (field: string, value: string) => Promise<void>;
  onSaveLocation: (location: string) => Promise<void>;
  onAddTag: (
    type: "expertise" | "workPreferences" | "desiredRoles",
    value?: string,
  ) => Promise<void>;
  onRemoveTag: (
    type: "expertise" | "workPreferences" | "desiredRoles",
    index: number,
  ) => Promise<void>;
  onToggleWorkPreference: (preference: string) => Promise<void>;
}

export function EditProfileScreen({
  visible,
  onClose,
  userType,
  isFieldMissing,
  personalMissingCount,
  missingFieldLabels,
  firstName,
  lastName,
  role,
  company,
  workEmailVerified,
  email,
  workEmail,
  bio,
  location,
  expertise,
  workPreferences,
  desiredRoles,
  onSaveField,
  onSaveLocation,
  onAddTag,
  onRemoveTag,
  onToggleWorkPreference,
}: Props) {
  const { status, run } = useAutosaveStatus();
  const [local, setLocal] = useState({
    firstName,
    lastName,
    role,
    company,
    bio,
    location,
  });
  const [locationManual, setLocationManual] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newRoleTag, setNewRoleTag] = useState("");

  // Re-sync local text state whenever the screen opens, so it reflects the
  // latest store values rather than whatever was left over from last time.
  useEffect(() => {
    if (visible) {
      setLocal({
        firstName,
        lastName,
        role,
        company,
        bio,
        location,
      });
      setLocationManual(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (key: keyof typeof local) => (value: string) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const saveOnBlur = (field: string, key: keyof typeof local) => () => {
    const value = local[key];
    run(() => onSaveField(field, value));
  };

  return (
    <EditorScreen
      visible={visible}
      onClose={onClose}
      title="Edit Profile"
      headerRight={<SaveStatusPill status={status} />}
    >
      {personalMissingCount > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {personalMissingCount} field
            {personalMissingCount !== 1 ? "s" : ""} remaining:{" "}
            {missingFieldLabels.join(", ")}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(0, 100 - (personalMissingCount / 15) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      <Text style={styles.groupLabel}>BASIC INFORMATION</Text>

      <Field
        label="FIRST NAME"
        required={isFieldMissing("firstName")}
        value={local.firstName}
        onChangeText={set("firstName")}
        onBlur={saveOnBlur("firstName", "firstName")}
        autoCapitalize="words"
      />
      <Field
        label="LAST NAME"
        required={isFieldMissing("lastName")}
        value={local.lastName}
        onChangeText={set("lastName")}
        onBlur={saveOnBlur("lastName", "lastName")}
        autoCapitalize="words"
      />
      <Field
        label="ROLE"
        required={isFieldMissing("role")}
        value={local.role}
        onChangeText={set("role")}
        onBlur={saveOnBlur("role", "role")}
        autoCapitalize="words"
      />

      {userType === "sponsor" &&
        (workEmailVerified ? (
          <LockedField
            label="COMPANY"
            value={company}
            note="Locked to your verified work email. Contact support to change your company."
          />
        ) : (
          <Field
            label="COMPANY"
            required={!company}
            value={local.company}
            onChangeText={set("company")}
            onBlur={saveOnBlur("company", "company")}
            autoCapitalize="words"
          />
        ))}

      <LockedField
        label="EMAIL"
        value={email}
        note="The email you log in with. Can't be changed here yet — contact support to update it."
      />

      {userType === "sponsor" && (
        <LockedField
          label="WORK EMAIL"
          value={workEmail || "Not set"}
          note="Your corporate email — helps verify your employer. Cannot be changed here. Contact support to update it."
        />
      )}

      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>BIO</Text>
          {isFieldMissing("bio") && <Text style={styles.requiredStar}>*</Text>}
        </View>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={local.bio}
          onChangeText={set("bio")}
          onBlur={saveOnBlur("bio", "bio")}
          multiline
          maxLength={1000}
          autoCapitalize="sentences"
        />
        <CharCounter count={local.bio.length} max={1000} />
      </View>

      {/* Just the city — matches onboarding, which only ever collects a
          "City, State" location (no street/zip/country; the product never
          reads those, per utils/profileCompletion.ts). */}
      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>LOCATION</Text>
          {isFieldMissing("city") && (
            <Text style={styles.requiredStar}>*</Text>
          )}
        </View>
        {GOOGLE_PLACES_API_KEY && !locationManual ? (
          <PlacesAutocomplete
            mode="city"
            inputStyle={styles.input}
            initialValue={local.location}
            placeholder="e.g., San Francisco"
            onSelect={(addr) => {
              const combined = [addr.city, addr.state]
                .filter(Boolean)
                .join(", ");
              const value = combined || addr.city;
              set("location")(value);
              run(() => onSaveLocation(value));
            }}
            onError={() => {}}
            onSwitchToManual={() => setLocationManual(true)}
          />
        ) : (
          <View style={styles.locationInputWrap}>
            <MapPin color="#AAA" size={18} />
            <TextInput
              style={styles.locationInput}
              placeholder="e.g., San Francisco, CA"
              placeholderTextColor="#BBB"
              value={local.location}
              onChangeText={set("location")}
              onBlur={() => run(() => onSaveLocation(local.location))}
              autoCapitalize="words"
            />
          </View>
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>
            {userType === "applicant"
              ? "SKILLS & INTERESTS (Max 5)"
              : "I CAN HELP WITH (Max 5)"}
          </Text>
          {isFieldMissing("skills") && (
            <Text style={styles.requiredStar}>*</Text>
          )}
        </View>
        <View style={styles.tagsContainer}>
          {expertise.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
              <TouchableOpacity onPress={() => onRemoveTag("expertise", index)}>
                <X color="#000" size={14} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {expertise.length < 5 && (
          <View style={styles.addTagRow}>
            <AutocompleteInput
              value={newTag}
              onChangeText={setNewTag}
              onSelect={(v) => {
                onAddTag("expertise", v);
                setNewTag("");
              }}
              suggestions={ALL_SKILLS}
              placeholder="Add new..."
              style={styles.tagInput}
            />
            <TouchableOpacity
              style={styles.addTagBtn}
              onPress={() => {
                onAddTag("expertise", newTag);
                setNewTag("");
              }}
            >
              <Plus color="#FFF" size={18} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {userType === "applicant" && (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WORK PREFERENCES</Text>
            <View style={{ gap: 8, marginTop: 4 }}>
              {["Remote", "Hybrid", "On-site"].map((preference) => {
                const selected = workPreferences.includes(preference);
                return (
                  <TouchableOpacity
                    key={preference}
                    style={styles.checkboxRow}
                    onPress={() => onToggleWorkPreference(preference)}
                  >
                    <View
                      style={[styles.checkbox, selected && styles.checkboxOn]}
                    >
                      {selected && (
                        <Check color="#FFF" size={16} strokeWidth={3} />
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>{preference}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>DESIRED ROLES (Max 3)</Text>
            <View style={styles.tagsContainer}>
              {desiredRoles.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <TouchableOpacity
                    onPress={() => onRemoveTag("desiredRoles", index)}
                  >
                    <X color="#000" size={14} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {desiredRoles.length < 3 && (
              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add role..."
                  value={newRoleTag}
                  autoCapitalize="words"
                  onChangeText={setNewRoleTag}
                  onSubmitEditing={() => {
                    onAddTag("desiredRoles", newRoleTag);
                    setNewRoleTag("");
                  }}
                />
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={() => {
                    onAddTag("desiredRoles", newRoleTag);
                    setNewRoleTag("");
                  }}
                >
                  <Plus color="#FFF" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
    </EditorScreen>
  );
}

function Field({
  label,
  required,
  value,
  onChangeText,
  onBlur,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  keyboardType?: "phone-pad" | "numeric" | "default";
  autoCapitalize?: "words" | "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.requiredStar}>*</Text>}
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        {...inputProps}
      />
    </View>
  );
}

function LockedField({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={[styles.input, styles.lockedInput]}>
        <Text style={styles.lockedText}>{value}</Text>
        <Lock color="#999" size={16} />
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
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
  field: { marginBottom: 20 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "800", color: "#999", letterSpacing: 0.6 },
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
  bioInput: { minHeight: 100, textAlignVertical: "top" },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
    color: "#000",
    paddingVertical: 12,
  },
  lockedInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    opacity: 0.6,
  },
  lockedText: { fontSize: 15, color: "#000" },
  note: { fontSize: 11, color: "#999", marginTop: 4, fontStyle: "italic" },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, fontWeight: "600", color: "#000" },
  addTagRow: { flexDirection: "row", gap: 8 },
  tagInput: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#DDD",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#000", borderColor: "#000" },
  checkboxLabel: { fontSize: 14, fontWeight: "600", color: "#000" },
});
