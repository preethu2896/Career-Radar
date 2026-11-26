import { it, expect } from "vitest";
import {
  cleanRoleDescription,
  statedRequirements,
} from "../src/services/roleContent.js";
it("removes repeated role/team labels and repeated titles without removing their actual details", () => {
  expect(
    cleanRoleDescription(
      "Engineer\nAbout the role\nBuild tools.\nAbout the team\nWork with payments engineers.\nResponsibilities\nShip software.",
      "Engineer",
    ),
  ).toBe(
    "Build tools.\nWork with payments engineers.\nResponsibilities\nShip software.",
  );
});
it("removes exact repeated paragraphs while preserving separate duties and qualifications", () => {
  const paragraph =
    "You will design reliable data pipelines and collaborate closely with customers.";
  expect(
    cleanRoleDescription(
      paragraph + "\n\n" + paragraph + "\n\nRequirements\nSQL",
      "Engineer",
    ),
  ).toBe(paragraph + "\n\nRequirements\nSQL");
});
it("shows only provided requirements and never inserts Not stated values", () => {
  expect(
    statedRequirements({
      experience_requirement: "0–1 years",
      education_requirement: null,
      graduation_requirement: "Not stated",
      marks_requirement: " ",
      skills: ["SQL", "SQL", ""],
    }),
  ).toEqual([
    ["Experience", "0–1 years"],
    ["Skills", "SQL"],
  ]);
});
it("returns no rows when requirements are absent", () => {
  expect(
    statedRequirements({ experience_requirement: null, skills: [] }),
  ).toEqual([]);
  expect(
    statedRequirements({
      education_requirement: "N/A",
      marks_requirement: "Unknown",
    }),
  ).toEqual([]);
});
