import { expect, it } from "vitest";
import {
  numericEducationScore,
  qualificationWithoutScore,
} from "../src/services/education.js";
import { parseResumeText } from "../src/services/resumeParser.js";
import {
  blankDraft,
  hydrateDraftFromProfile,
} from "../src/services/onboarding.js";
const degree = "Bachelor of Engineering in Computer Science and Design";
it.each(["CGPA: 8.26 / 10", "CGPA:8.26", "8.26/10", "8.26 CGPA", "8.26"])(
  "keeps only the numeric score from %s",
  (value) => {
    expect(numericEducationScore(value)).toBe("8.26");
  },
);
it.each(["CGPA: 8", "8/10", "8"])("keeps integer marks from %s", (value) => {
  expect(numericEducationScore(value)).toBe("8");
});
it("keeps percentage and four-point scores numeric without converting scales", () => {
  expect(numericEducationScore("75%")).toBe("75");
  expect(numericEducationScore("GPA: 3.7/4")).toBe("3.7");
});
it("separates a score appended to the qualification in the same resume line", () => {
  const parsed = parseResumeText(
    `Asha Rao\nEDUCATION\n${degree} CGPA: 8.26 / 10`,
  );
  expect(parsed.education[0]?.qualification).toBe(degree);
  expect(parsed.education[0]?.grade).toBe("8.26");
  expect(qualificationWithoutScore(`${degree} | CGPA:8`)).toBe(degree);
});
it("cleans existing draft and saved profile values when loading", () => {
  const profile = {
    id: "test",
    first_name: "Asha",
    last_name: "",
    career_stage: "Student / Fresher",
    experience_level: "No professional experience",
    target_roles: [],
    skills: [],
    preferred_cities: [],
    work_preferences: [],
    industries: [],
    onboarding_complete: false,
    education_degree: `${degree} CGPA:8.26/10`,
    education_score: "CGPA:8.26/10",
  };
  const fromProfile = hydrateDraftFromProfile(blankDraft(), profile);
  expect(fromProfile.educationDegree).toBe(degree);
  expect(fromProfile.educationScore).toBe("8.26");
  const fromDraft = hydrateDraftFromProfile(
    {
      ...blankDraft(),
      educationDegree: `${degree} CGPA:8`,
      educationScore: "8/10",
    },
    profile,
  );
  expect(fromDraft.educationDegree).toBe(degree);
  expect(fromDraft.educationScore).toBe("8");
});
