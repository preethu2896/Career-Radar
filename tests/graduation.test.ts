import { expect, it } from "vitest";
import {
  graduationYearFromEducation,
  preferredEducation,
  fillMissingEducation,
} from "../src/services/education.js";
import { parseResumeText } from "../src/services/resumeParser.js";
import { blankDraft } from "../src/services/onboarding.js";
it.each([
  ["2021 - 2025", "2025"],
  ["2021–2025", "2025"],
  ["August 2021 – May 2025", "2025"],
  ["2021 to 2025", "2025"],
  ["2021/2025", "2025"],
  ["2021–25", "2025"],
  ["1998–02", "2002"],
  ["2021 2025", "2025"],
  ["Expected graduation: June 2027", "2027"],
  ["Graduation year: 2026", "2026"],
  ["Class of 2025", "2025"],
  ["Batch 2025", "2025"],
  ["2021–Present", ""],
  ["Pursuing since 2021", ""],
  ["CGPA: 8.26/10", ""],
  ["College established 1990", ""],
  ["2025–2021", ""],
])("extracts a completion year from %s", (input, expected) =>
  expect(graduationYearFromEducation(input)).toBe(expected),
);
it.each([
  "Bachelor of Engineering\nExample University, 2021–2025\nCGPA:8.26/10",
  "Example University 2021–2025\nBachelor of Engineering\nCGPA:8.26/10",
  "Bachelor of Engineering 2021–2025 CGPA:8.26/10",
  "B.Com\nExample College\nMangaluru\n2022–2025\n75%",
])("associates degree, institution, dates and score: %s", (entry) => {
  const education = parseResumeText(
    `Asha Rao\nEDUCATION\n${entry}\nEXPERIENCE\nAnalyst\n2025–2026`,
  ).education;
  expect(education[0]?.year).toBe("2025");
});
it("prefills the degree over an earlier school entry and preserves manual corrections", () => {
  const education = [
    { qualification: "High School", year: "2019", grade: "90" },
    {
      qualification: "Bachelor of Engineering",
      year: "2021–2025",
      grade: "8.26",
    },
  ];
  expect(preferredEducation(education)?.qualification).toBe(
    "Bachelor of Engineering",
  );
  expect(fillMissingEducation(blankDraft(), education)).toMatchObject({
    educationDegree: "Bachelor of Engineering",
    graduationYear: "2025",
    educationScore: "8.26",
  });
  expect(
    fillMissingEducation({ ...blankDraft(), graduationYear: "2024" }, education)
      .graduationYear,
  ).toBe("2024");
});
it("keeps an ongoing degree without using its start year or school completion year", () => {
  const education = [
    { qualification: "High School", year: "2021" },
    { qualification: "Bachelor of Engineering", year: "2022–Present" },
  ];
  expect(fillMissingEducation(blankDraft(), education)).toMatchObject({
    educationDegree: "Bachelor of Engineering",
    graduationYear: "",
  });
});

it("does not attach another qualification’s year or marks to a manual correction", () => {
  const draft = { ...blankDraft(), educationDegree: "B.Com" };
  expect(
    fillMissingEducation(draft, [
      { qualification: "Bachelor of Engineering", year: "2025", grade: "8.26" },
    ]),
  ).toEqual(draft);
});
it("does not confuse Mechanical with a masters degree", () => {
  expect(
    preferredEducation([
      { qualification: "B.Tech in Mechanical Engineering", year: "2025" },
      { qualification: "Master of Science", year: "2024" },
    ])?.qualification,
  ).toBe("Master of Science");
  expect(graduationYearFromEducation("Admitted 2021")).toBe("");
});
