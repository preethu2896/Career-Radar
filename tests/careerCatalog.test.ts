import { describe, expect, it } from "vitest";
import {
  ROLE_TITLES,
  SKILL_TITLES,
  searchSuggestions,
} from "../src/services/careerCatalog.js";
import { parseResumeText } from "../src/services/resumeParser.js";
import {
  prefillFromResume,
  blankDraft,
  hydrateDraftFromProfile,
} from "../src/services/onboarding.js";
describe("role and skill discovery", () => {
  it.each([
    "Generative AI Engineer",
    "AI Agent Developer",
    "Clinical Research Associate",
    "Chartered Accountant",
    "Mechanical Engineer",
    "Content Writer",
    "HR Intern",
  ])("finds %s across career categories", (title) => {
    expect(searchSuggestions(title, ROLE_TITLES)).toContain(title);
  });
  it("finds acronyms and excludes selected titles regardless of case", () => {
    expect(searchSuggestions("sde", ROLE_TITLES)[0]).toBe("Software Engineer");
    expect(searchSuggestions("genai", ROLE_TITLES)[0]).toBe(
      "Generative AI Engineer",
    );
    expect(
      searchSuggestions("data analyst", ROLE_TITLES, ["data analyst"]),
    ).not.toContain("Data Analyst");
    expect(searchSuggestions("lang", SKILL_TITLES)).toContain("LangGraph");
  });
  it("extracts technical and nontechnical skills without a five-skill trim", () => {
    const parsed = parseResumeText(
      "Asha Rao\nSKILLS\nPython, SQL, React, Docker, LangGraph, Power BI, Tally, Recruitment, Communication, Figma, Excel",
    );
    expect(parsed.skills).toEqual(
      expect.arrayContaining([
        "Python",
        "SQL",
        "React",
        "Docker",
        "LangGraph",
        "Power BI",
        "Tally",
        "Recruitment",
        "Communication",
        "Figma",
        "Excel",
      ]),
    );
    expect(
      prefillFromResume(blankDraft(), parsed).draft.skills.length,
    ).toBeGreaterThan(5);
  });
  it("restores fractional years of experience", () => {
    const draft = hydrateDraftFromProfile(blankDraft(), {
      id: "test",
      first_name: "A",
      last_name: "",
      career_stage: "Career switcher",
      experience_level: "1.5 years",
      target_roles: [],
      skills: [],
      preferred_cities: [],
      work_preferences: [],
      industries: [],
      onboarding_complete: true,
    });
    expect(draft.experienceYears).toBe("1.5");
  });
});
