import type { Draft } from "./onboarding.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { MAX_PROFILE_SKILLS } from "./careerCatalog.js";

export const CAREER_STAGES = [
  "Student / Fresher",
  "Early career",
  "Career switcher",
  "Experienced professional",
] as const;
export function validateSetupSection(
  stage: number,
  section: number,
  draft: Draft,
  hasResume = false,
): string {
  if (
    stage === 1 &&
    section === 0 &&
    (!draft.roles.length || draft.roles.length > 3)
  )
    return "Choose one to three roles.";
  if (stage === 1 && section === 1) {
    if (!draft.cities.length) return "Choose at least one preferred location.";
    if (!draft.modes.length) return "Choose at least one work preference.";
  }
  if (stage !== 2) return "";
  if (section === 0 && !hasResume)
    return "Upload and save your PDF resume to continue.";
  if (section === 1) {
    if (!draft.firstName.trim()) return "Add your first name.";
    if (!CAREER_STAGES.some((value) => value === draft.careerStage))
      return "Choose your career stage.";
    if (
      draft.careerStage !== "Student / Fresher" &&
      (!/^\d+(\.\d+)?$/.test(draft.experienceYears.trim()) ||
        +draft.experienceYears > 70)
    )
      return "Enter years of experience between 0 and 70.";
  }
  if (section === 2) {
    if (!draft.educationDegree.trim())
      return "Add your degree or qualification.";
    if (
      !/^\d{4}$/.test(draft.graduationYear) ||
      +draft.graduationYear < 1950 ||
      +draft.graduationYear > 2100
    )
      return "Enter a valid graduation year.";
    const score = draft.educationScore.trim();
    if (!score) return "Add your marks or CGPA.";
    if (!/^\d+(?:\.\d+)?$/.test(score) || +score > 100)
      return "Enter a number from 0 to 100, such as 8.26 or 75.";
  }
  if (section === 3 && draft.skills.length > MAX_PROFILE_SKILLS)
    return `Choose up to ${MAX_PROFILE_SKILLS} skills.`;
  if (section === 4) {
    for (const [label, value] of [
      ["LinkedIn", draft.linkedin],
      ["GitHub", draft.github],
      ["Portfolio", draft.portfolio],
    ]) {
      if (value && !safeExternalUrl(value)) return `Use a valid ${label} link.`;
    }
  }
  return "";
}
export function validateSetup(
  stage: number,
  draft: Draft,
  hasResume = false,
): string {
  for (let section = 0; section < (stage === 1 ? 2 : 5); section++) {
    const error = validateSetupSection(stage, section, draft, hasResume);
    if (error) return error;
  }
  return "";
}
