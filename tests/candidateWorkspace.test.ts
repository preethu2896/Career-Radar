import { describe, expect, it } from "vitest";
import { validateSetup } from "../src/ui/CandidateSetup.js";
import { blankDraft } from "../src/services/onboarding.js";
import {
  explainOpportunity,
  explicitlyAcceptsFreshers,
  isRecentOpening,
  publishedContact,
  type Opportunity,
} from "../src/services/candidateWorkspace.js";
import type { Profile } from "../src/services/auth.js";
const now = Date.parse("2026-11-20T12:00:00Z");
const job: Opportunity = {
  id: "test",
  company_name: "Test company",
  title: "Junior Data Analyst",
  location: "Bengaluru",
  work_mode: "Hybrid",
  experience_requirement: "Freshers welcome",
  education_requirement: null,
  graduation_requirement: null,
  marks_requirement: null,
  salary: null,
  description: null,
  application_instructions: null,
  skills: ["SQL"],
  source_url: "https://example.com/careers",
  application_url: null,
  contact_email: null,
  contact_source_url: null,
  source_kind: "OFFICIAL",
  status: "OPEN",
  published_at: null,
  first_seen_at: "2026-11-19T12:00:00Z",
  last_checked_at: "2026-11-20T10:00:00Z",
};
const profile: Profile = {
  id: "alice",
  first_name: "A",
  last_name: "",
  career_stage: "Student / Fresher",
  experience_level: "No professional experience",
  target_roles: ["Data Analyst"],
  skills: ["SQL"],
  preferred_cities: ["Bengaluru"],
  work_preferences: ["Hybrid"],
  industries: [],
  onboarding_complete: true,
};
const completeDraft = {
  ...blankDraft(),
  firstName: "Asha",
  careerStage: "Student / Fresher",
  roles: ["Data Analyst"],
  cities: ["Bengaluru"],
  modes: ["Hybrid"],
  educationDegree: "B.Com",
  graduationYear: "2026",
  educationScore: "75",
};
describe("required setup", () => {
  it("requires a saved resume, preferences and education, with optional links and skills", () => {
    expect(validateSetup(1, completeDraft)).toBe("");
    expect(validateSetup(2, completeDraft, true)).toBe("");
    expect(
      validateSetup(2, { ...completeDraft, resumeName: "fake.pdf" }, false),
    ).toMatch(/resume/);
  });
  it.each([
    ["cities", [], "location"],
    ["modes", [], "preference"],
    ["roles", [], "roles"],
  ])("requires %s", (key, value, error) => {
    expect(
      validateSetup(1, { ...completeDraft, [key as string]: value }),
    ).toMatch(new RegExp(error as string));
  });
  it.each([
    ["firstName", "", "first name"],
    ["careerStage", "", "career stage"],
    ["educationDegree", "", "degree"],
    ["graduationYear", "abc", "graduation year"],
    ["educationScore", "", "marks"],
    ["educationScore", "11 CGPA", "number"],
  ])("validates %s", (key, value, error) => {
    expect(validateSetup(2, { ...completeDraft, [key]: value }, true)).toMatch(
      new RegExp(error),
    );
  });
  it("requires numeric experience for every non-fresher stage", () => {
    for (const careerStage of [
      "Early career",
      "Career switcher",
      "Experienced professional",
    ]) {
      expect(
        validateSetup(
          2,
          { ...completeDraft, careerStage, experienceYears: "" },
          true,
        ),
      ).toMatch(/experience/);
      expect(
        validateSetup(
          2,
          { ...completeDraft, careerStage, experienceYears: "-1" },
          true,
        ),
      ).toMatch(/experience/);
      expect(
        validateSetup(
          2,
          { ...completeDraft, careerStage, experienceYears: "1.5" },
          true,
        ),
      ).toBe("");
    }
    expect(
      validateSetup(1, { ...completeDraft, roles: ["a", "b", "c", "d"] }),
    ).toMatch(/one to three/);
  });
});
describe("source-based discovery", () => {
  it("excludes historical, closed, undated and future-dated records from recent openings", () => {
    expect(isRecentOpening(job, now)).toBe(true);
    for (const patch of [
      { status: "CLOSED" },
      { source_kind: "UNKNOWN" },
      { last_checked_at: null },
      { last_checked_at: "2026-10-01T12:00:00Z" },
      { last_checked_at: "2026-11-21T12:00:00Z" },
    ])
      expect(isRecentOpening({ ...job, ...patch } as Opportunity, now)).toBe(
        false,
      );
  });
  it("explains evidence without inventing missing eligibility or a match percentage", () => {
    const explanation = explainOpportunity(job, profile);
    expect(explanation.relevant).toBe(true);
    expect(explanation.acceptsFreshers).toBe(true);
    expect(explanation.reasons).toContain("Skills: SQL");
    expect(explanation.missing).toContain("Degree requirements not stated");
    expect(explanation).not.toHaveProperty("score");
    expect(
      explainOpportunity(
        {
          ...job,
          title: "Senior Accountant",
          skills: [],
          experience_requirement: "3 years",
        },
        profile,
      ).gap,
    ).toContain("3 years");
    expect(
      explainOpportunity(
        { ...job, title: "Senior Accountant", skills: [] },
        profile,
      ).relevant,
    ).toBe(false);
  });
  it("does not label explicit fresher exclusions as eligible", () => {
    for (const requirement of [
      "No freshers",
      "Freshers are not eligible",
      "Not for freshers",
      "Experienced candidates only",
    ])
      expect(explicitlyAcceptsFreshers(requirement)).toBe(false);
  });
  it("never exposes an unsourced or malformed recruiter address", () => {
    expect(
      publishedContact({ ...job, contact_email: "person@example.com" }),
    ).toBeNull();
    expect(
      publishedContact({
        ...job,
        contact_email: "person@example.com",
        contact_source_url: "https://example.com/post",
      }),
    ).toBe("person@example.com");
    expect(
      publishedContact({
        ...job,
        contact_email: "person@example.com\r\nBcc:other@example.com",
        contact_source_url: "https://example.com/post",
      }),
    ).toBeNull();
  });
});
