// ProfileSections — the record under every sponsor-card opening (Tori's
// Figma, shared by the hero / connector / fit layouts): About, Experience
// (LinkedIn-style employer groups with a dotted role timeline), Education,
// Achievements, Skills, and "More about" prompt cards.
//
// Each section takes plain props from ApplicantFacts and returns null when
// it has nothing to show (DATA HONESTY RULE) — the composer can list them
// unconditionally. Every sub-line is rendered only when its field exists,
// so a sparse resume parse degrades to shorter rows, never "N/A". Each
// section owns its 16pt horizontal padding; the composer adds none.

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { ExpandableText } from "@/components/ui/ExpandableText";
import {
  ArrowUpRight,
  Award,
  Coffee,
  Lightbulb,
  MessageCircle,
  Zap,
} from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { joinFacts } from "../dossierFacts";
import { Eyebrow, QUIET_FILL, TIMELINE_DOT } from "./Eyebrow";
import type {
  Achievement,
  EducationItem,
  ExperienceGroup,
  ExperienceRole,
  PromptAnswer,
} from "./model";

// ── Shared frame ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Logo({ url, name }: { url: string | null; name: string }) {
  return (
    <CompanyLogo
      logoUrl={url}
      name={name}
      size={50}
      borderRadius={10}
      backgroundColor={Colors.surface}
      textColor={Colors.ink}
      style={styles.logo}
    />
  );
}

// ── About ─────────────────────────────────────────────────────────────────

export function AboutSection({ firstName, bio }: { firstName: string; bio: string | null }) {
  const text = (bio || "").trim();
  if (!text) return null;
  return (
    <Section title={`About ${firstName}`}>
      <ExpandableText style={styles.about} numberOfLines={6}>
        {text}
      </ExpandableText>
    </Section>
  );
}

// ── Experience ────────────────────────────────────────────────────────────

function RoleLines({ role }: { role: ExperienceRole }) {
  return (
    <>
      <Text style={styles.rowTitle}>{role.title}</Text>
      {role.employmentType ? <Text style={styles.rowSub}>{role.employmentType}</Text> : null}
      {role.dateLabel ? <Text style={styles.rowMeta}>{role.dateLabel}</Text> : null}
      {role.location ? <Text style={styles.rowMeta}>{role.location}</Text> : null}
      {role.description ? (
        <ExpandableText style={styles.rowDesc} numberOfLines={4}>
          {role.description}
        </ExpandableText>
      ) : null}
    </>
  );
}

function SingleRoleGroup({ group }: { group: ExperienceGroup }) {
  const role = group.roles[0];
  const companyLine = joinFacts([group.company, role.employmentType]);
  return (
    <View style={styles.itemRow}>
      <Logo url={group.logoUrl} name={group.company} />
      <View style={styles.itemBody}>
        <Text style={styles.rowTitle}>{role.title}</Text>
        {companyLine ? <Text style={styles.rowSub}>{companyLine}</Text> : null}
        {role.dateLabel ? <Text style={styles.rowMeta}>{role.dateLabel}</Text> : null}
        {role.location ? <Text style={styles.rowMeta}>{role.location}</Text> : null}
        {role.description ? (
          <ExpandableText style={styles.rowDesc} numberOfLines={4}>
            {role.description}
          </ExpandableText>
        ) : null}
      </View>
    </View>
  );
}

function MultiRoleGroup({ group }: { group: ExperienceGroup }) {
  return (
    <View>
      <View style={styles.itemRow}>
        <Logo url={group.logoUrl} name={group.company} />
        <View style={[styles.itemBody, styles.groupHead]}>
          <Text style={styles.rowTitle}>{group.company}</Text>
          {group.tenureLabel ? <Text style={styles.rowMeta}>{group.tenureLabel}</Text> : null}
        </View>
      </View>
      {group.roles.map((role, i) => {
        const last = i === group.roles.length - 1;
        return (
          <View key={`${role.title}-${i}`} style={styles.timelineRow}>
            {/* Rail sits in the logo column, centred under the logo. */}
            <View style={styles.rail}>
              <View style={styles.dot} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.itemBody}>
              <RoleLines role={role} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ExperienceSection({ groups }: { groups: ExperienceGroup[] }) {
  const shown = groups.filter((g) => g.roles.length > 0);
  if (shown.length === 0) return null;
  return (
    <Section title="Experience">
      {shown.map((group, i) => (
        <View key={`${group.company}-${i}`} style={i > 0 && styles.itemGap}>
          {group.roles.length === 1 ? (
            <SingleRoleGroup group={group} />
          ) : (
            <MultiRoleGroup group={group} />
          )}
        </View>
      ))}
    </Section>
  );
}

// ── Education ─────────────────────────────────────────────────────────────

export function EducationSection({ items }: { items: EducationItem[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="Education">
      {items.map((item, i) => (
        <View key={`${item.school}-${i}`} style={[styles.itemRow, i > 0 && styles.itemGap]}>
          <Logo url={item.logoUrl} name={item.school} />
          <View style={styles.itemBody}>
            <Text style={styles.rowTitle}>{item.school}</Text>
            {item.degree ? <Text style={styles.rowSub}>{item.degree}</Text> : null}
            {item.years ? <Text style={styles.rowMeta}>{item.years}</Text> : null}
            {item.detail ? (
              <ExpandableText style={styles.rowDesc} numberOfLines={3}>
                {item.detail}
              </ExpandableText>
            ) : null}
          </View>
        </View>
      ))}
    </Section>
  );
}

// ── Achievements ──────────────────────────────────────────────────────────

const ACHIEVEMENT_GLYPHS = [ArrowUpRight, Award];

export function AchievementsSection({ items }: { items: Achievement[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="Achievements">
      {items.map((item, i) => {
        const Glyph = ACHIEVEMENT_GLYPHS[i % ACHIEVEMENT_GLYPHS.length];
        return (
          <View key={`${item.title}-${i}`} style={[styles.itemRow, i > 0 && styles.itemGap]}>
            <View style={styles.glyph} importantForAccessibility="no" accessibilityElementsHidden>
              <Glyph size={28} strokeWidth={2} color={Colors.laurel} />
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.detail ? <Text style={styles.rowDesc}>{item.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </Section>
  );
}

// ── Skills ────────────────────────────────────────────────────────────────

export function SkillsSection({ skills }: { skills: string[] }) {
  const shown = skills.map((s) => s.trim()).filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <Section title="Skills">
      <View style={styles.chips}>
        {shown.map((skill, i) => (
          <View key={`${skill}-${i}`} style={styles.chip}>
            <Text style={styles.chipText}>{skill}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ── More about (prompt cards) ─────────────────────────────────────────────

const PROMPT_ICONS = [Zap, Coffee, Lightbulb, MessageCircle];
const PROMPT_CARD_WIDTH = 298;
const PROMPT_GAP = 16;

export function MoreAboutSection({
  firstName,
  prompts,
}: {
  firstName: string;
  prompts: PromptAnswer[];
}) {
  const shown = prompts.filter((p) => p.question.trim() && p.answer.trim());
  if (shown.length === 0) return null;
  return (
    <View style={styles.section}>
      <Eyebrow>{`More about ${firstName}`}</Eyebrow>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PROMPT_CARD_WIDTH + PROMPT_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        // Bleed back to the screen edge so cards scroll under the gutter.
        style={styles.promptScroll}
        contentContainerStyle={styles.promptRow}
      >
        {shown.map((p, i) => {
          const Icon = PROMPT_ICONS[i % PROMPT_ICONS.length];
          return (
            <View
              key={`${p.question}-${i}`}
              style={styles.promptCard}
              accessible
              accessibilityLabel={`${p.question}. ${p.answer}`}
            >
              <Icon size={24} color={Colors.ink} strokeWidth={1.75} />
              <Text style={styles.promptQ}>{p.question.toUpperCase()}</Text>
              <Text style={styles.promptA}>{`“${p.answer.trim()}”`}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 16, marginTop: 24 },
  sectionBody: { marginTop: 24 },
  about: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.ink,
  },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  itemGap: { marginTop: 24 },
  itemBody: { flex: 1, minWidth: 0 },
  logo: { borderWidth: 1, borderColor: Colors.border },
  groupHead: { minHeight: 50, justifyContent: "center" },
  rowTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  rowSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
    marginTop: 2,
  },
  rowMeta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 2,
  },
  rowDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: Colors.body,
    marginTop: 8,
  },
  // Timeline under a multi-role employer: the rail occupies the 50pt logo
  // column so role text lines up with the company name above it.
  timelineRow: { flexDirection: "row", alignItems: "stretch", gap: 14, marginTop: 16 },
  rail: { width: 50, alignItems: "center" },
  // 12pt dot centred on the 20pt title line (top offset 4).
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: TIMELINE_DOT,
    marginTop: 4,
  },
  // Runs from under this dot to the next row's dot (next row's marginTop 16
  // + its dot offset 4 → extend by 20).
  line: {
    position: "absolute",
    top: 18,
    bottom: -20,
    width: 4,
    borderRadius: 2,
    backgroundColor: QUIET_FILL,
  },
  glyph: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: QUIET_FILL,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  promptScroll: { marginHorizontal: -16, marginTop: 24 },
  promptRow: { paddingHorizontal: 16, gap: PROMPT_GAP },
  promptCard: {
    width: PROMPT_CARD_WIDTH,
    minHeight: 176,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    padding: 17,
  },
  promptQ: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginTop: 16,
  },
  promptA: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.ink,
    marginTop: 8,
  },
});
