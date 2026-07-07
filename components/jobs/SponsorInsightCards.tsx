import {
    Check,
    ChevronUp,
    Coffee,
    Info,
    Plus,
    Target,
    Users,
} from "@/components/ui/icons";
import React, { useState } from "react";
import {
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CharCounter } from "../ui/CharCounter";

// ─── Sponsor insight prompts ──────────────────────────────────────────────
// The four open-ended questions a sponsor answers when sponsoring a job.
// Rendered as light "prompt cards" (one focused editor at a time) instead of
// a wall of textareas, so they feel optional and quick rather than like a
// form. Shared by both the sponsor-existing-job flow and the create-from-URL
// flow so the experience is identical.
export type SponsorInsightKey =
  | "dayToDay"
  | "teamCulture"
  | "idealCandidate"
  | "insiderInsights";

// Per-prompt character cap for the sponsor's job insights. Generous enough for
// a real paragraph, bounded so one answer can't balloon the applicant's home
// card (where these render) or bloat the job record.
const SPONSOR_INSIGHT_MAXLEN = 500;

const SPONSOR_INSIGHT_FIELDS: {
  key: SponsorInsightKey;
  Icon: React.ComponentType<any>;
  title: string;
  subtitle: string;
  placeholder: string;
  chips: string[];
}[] = [
  {
    key: "dayToDay",
    Icon: Coffee,
    title: "The real day-to-day",
    subtitle: "What this role actually looks like beyond the job description.",
    placeholder:
      "Be honest about the daily work — pace, focus time, meetings, autonomy…",
    chips: ["Pace", "Meetings", "Focus time", "Autonomy"],
  },
  {
    key: "teamCulture",
    Icon: Users,
    title: "Team culture & dynamics",
    subtitle: "A real sense of who they'll be working with.",
    placeholder:
      "Team size, seniority mix, remote vs. in-office norms, collaboration style…",
    chips: ["Team size", "Seniority", "Remote norms", "Collaboration"],
  },
  {
    key: "idealCandidate",
    Icon: Target,
    title: "Who actually thrives here",
    subtitle: "What matters more than what's on the resume?",
    placeholder:
      "Mindset, soft skills, working style, backgrounds that tend to succeed…",
    chips: ["Mindset", "Soft skills", "Working style", "Background"],
  },
  {
    key: "insiderInsights",
    Icon: Info,
    title: "Everything else worth knowing",
    subtitle: "Interview process, growth path, comp — anything they should know.",
    placeholder:
      "Interview format, timeline, promotion path, equity situation…",
    chips: ["Interview", "Timeline", "Growth", "Comp"],
  },
];

export function SponsorInsightCards({
  values,
  onChange,
}: {
  values: Record<SponsorInsightKey, string>;
  onChange: (key: SponsorInsightKey, text: string) => void;
}) {
  // Which card's editor is expanded. Only one is open at a time so each
  // question gets full focus; answered cards collapse to a quote preview.
  const [activeKey, setActiveKey] = useState<SponsorInsightKey | null>(null);
  const answeredCount = SPONSOR_INSIGHT_FIELDS.filter(
    (f) => (values[f.key] || "").trim().length > 0,
  ).length;

  // A chip "owns" the line that starts with its bullet marker. We detect
  // presence by that marker so tapping a chip toggles its prompt in/out
  // instead of stacking duplicates.
  const chipIsOn = (text: string, chip: string) =>
    text.split("\n").some((l) => l.trimStart().startsWith(`• ${chip}`));

  const toggleChip = (key: SponsorInsightKey, chip: string) => {
    const cur = values[key] || "";
    if (chipIsOn(cur, chip)) {
      // Remove the chip's bullet line(s) and tidy up the blank lines left
      // behind so toggling never leaves ragged whitespace.
      const next = cur
        .split("\n")
        .filter((l) => !l.trimStart().startsWith(`• ${chip}`))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "");
      onChange(key, next);
    } else {
      // Add a labeled bullet so the blank page never stares back — the
      // sponsor just fills in after the dash.
      const prefix = cur.trim().length ? cur.replace(/\s+$/, "") + "\n" : "";
      onChange(key, `${prefix}• ${chip} — `);
    }
  };

  // Closing the editor must drop the keyboard, otherwise it keeps covering
  // the cards below when the user returns to the list.
  const collapse = () => {
    Keyboard.dismiss();
    setActiveKey(null);
  };

  return (
    <View style={styles.siWrap}>
      <Text style={styles.siProgress}>
        {answeredCount === 0
          ? "Even one answer helps you stand out"
          : `${answeredCount} of ${SPONSOR_INSIGHT_FIELDS.length} added`}
      </Text>

      {SPONSOR_INSIGHT_FIELDS.map((field) => {
        const value = values[field.key] || "";
        const filled = value.trim().length > 0;
        const isActive = activeKey === field.key;
        const Icon = field.Icon;
        const engaged = filled || isActive;

        // Header is identical in every state so each card always announces
        // which question it is — before tapping, while editing, and after.
        const header = (
          <View style={styles.siHeaderRow}>
            <View
              style={engaged ? styles.siIconCircleActive : styles.siIconCircle}
            >
              <Icon
                color={engaged ? "#FFF" : "#999"}
                size={16}
                strokeWidth={2.2}
              />
            </View>
            <View style={styles.siHeaderText}>
              <Text style={styles.siTitle}>{field.title}</Text>
              {filled && !isActive ? (
                <Text style={styles.siPreview} numberOfLines={3}>
                  {value.trim()}
                </Text>
              ) : (
                <Text style={styles.siSubtitle}>{field.subtitle}</Text>
              )}
            </View>
            {isActive ? (
              <TouchableOpacity
                onPress={collapse}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronUp color="#999" size={20} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : filled ? (
              <Text style={styles.siEditText}>Edit</Text>
            ) : (
              <View style={styles.siPlusCircle}>
                <Plus color="#000" size={16} strokeWidth={2.6} />
              </View>
            )}
          </View>
        );

        if (isActive) {
          return (
            <View key={field.key} style={[styles.siCard, styles.siCardActive]}>
              {header}

              <TextInput
                style={styles.siInput}
                placeholder={field.placeholder}
                placeholderTextColor="#AAA"
                value={value}
                onChangeText={(t) => onChange(field.key, t)}
                multiline
                autoFocus
                maxLength={SPONSOR_INSIGHT_MAXLEN}
                autoCapitalize="sentences"
                textAlignVertical="top"
              />
              <CharCounter count={value.length} max={SPONSOR_INSIGHT_MAXLEN} />

              <Text style={styles.siChipHint}>Tap to add a prompt</Text>
              <View style={styles.siChipRow}>
                {field.chips.map((chip) => {
                  const on = chipIsOn(value, chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[styles.siChip, on && styles.siChipActive]}
                      onPress={() => toggleChip(field.key, chip)}
                      activeOpacity={0.7}
                    >
                      {on ? (
                        <Check color="#FFF" size={12} strokeWidth={2.8} />
                      ) : (
                        <Plus color="#000" size={12} strokeWidth={2.6} />
                      )}
                      <Text
                        style={[
                          styles.siChipText,
                          on && styles.siChipTextActive,
                        ]}
                      >
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.siDoneBtn}
                onPress={collapse}
                activeOpacity={0.85}
              >
                <Check color="#FFF" size={15} strokeWidth={2.6} />
                <Text style={styles.siDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={field.key}
            style={[styles.siCard, filled && styles.siCardFilled]}
            onPress={() => setActiveKey(field.key)}
            activeOpacity={0.85}
          >
            {filled && <View style={styles.siAccent} />}
            {header}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  siWrap: { marginTop: 6, marginBottom: 8, gap: 12 },
  siProgress: {
    fontSize: 12,
    fontWeight: "700",
    color: "#AAA",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  siCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ECECEC",
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  siCardActive: {
    borderColor: "#000",
    shadowOpacity: 0.1,
  },
  siCardFilled: { borderColor: "#E0E0E0" },
  siAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#000",
  },
  siHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  siHeaderText: { flex: 1 },
  siIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  siIconCircleActive: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  siTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -0.2,
  },
  siSubtitle: { fontSize: 13, color: "#999", marginTop: 2, lineHeight: 18 },
  siPreview: {
    fontSize: 14,
    color: "#333",
    marginTop: 4,
    lineHeight: 20,
    fontWeight: "500",
  },
  siEditText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginLeft: 8,
  },
  siPlusCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  siInput: {
    marginTop: 14,
    minHeight: 120,
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  siChipHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AAA",
    marginTop: 16,
    marginBottom: 2,
  },
  siChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  siChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F4F4F4",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  siChipActive: { backgroundColor: "#000", borderColor: "#000" },
  siChipText: { fontSize: 13, fontWeight: "600", color: "#333" },
  siChipTextActive: { color: "#FFF" },
  siDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#000",
  },
  siDoneBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
