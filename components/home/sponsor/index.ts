// Public surface of sponsor deck v2 (components/home/sponsor). HomeView
// imports from here; the view model lives in model.ts, derivations in
// facts.ts, and each .tsx is one presentational piece of Tori's Figma.

export { SponsorApplicantCard, SPONSOR_CARD_TAIL } from "./SponsorApplicantCard";
export type { SponsorApplicantCardProps } from "./SponsorApplicantCard";
export { DecisionPills } from "./DecisionPills";
export { RoleContextRow } from "./RoleContextRow";
export { ApplicantHeroCard } from "./ApplicantHeroCard";
export { ConnectorHeader } from "./ConnectorHeader";
export { StatsCard } from "./StatsCard";
export { FitHeader } from "./FitHeader";
export { FitTable } from "./FitTable";
export {
  AboutSection,
  AchievementsSection,
  EducationSection,
  ExperienceSection,
  MoreAboutSection,
  SkillsSection,
} from "./ProfileSections";
export * from "./facts";
export type * from "./model";
