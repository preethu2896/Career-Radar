import { it, expect } from "vitest";
import { splitJobDescription } from "../src/services/jobDescription.js";
it("moves Zeta company history and products but keeps role duties and requirements", () => {
  const parts = splitJobDescription(
    "About Us\nBuild the future of banking.\nZeta builds banking platforms.\nOur Impact and Growth\n25 million cards.\nOur Product Lines\nTachyon and Cipher.\nOur Culture and Values\nEngineering first.\nAbout the role\nLead legal work.\nResponsibilities\nReview contracts.\nRequirements\n9 years of experience.",
    "Zeta",
  );
  expect(parts.companyText).toContain("25 million cards.");
  expect(parts.companyText).toContain("Tachyon and Cipher.");
  expect(parts.roleText).not.toContain("banking platforms");
  expect(parts.roleText).toContain("Review contracts.");
  expect(parts.roleText).toContain("9 years");
});
it("keeps team-specific context on Paytm roles and handles inline introductory headings", () => {
  const p = splitJobDescription(
    "About Us: Paytm builds payments.\nAbout the team:\nWork on Paytm Ads.\nJob Responsibilities:\nOwn revenue.\nDesired Qualifications:\n7+ years.",
    "Paytm",
  );
  expect(p.companyText).toContain("Paytm builds payments.");
  expect(p.roleText).toContain("Work on Paytm Ads.");
  expect(p.roleText).toContain("Own revenue.");
});
it("separates an explicit unlabelled company preface at the actual role heading", () => {
  const p = splitJobDescription(
    "HackerRank helps companies hire.\n\nOur platform serves engineering teams.\n\nAbout the role\nResearch deep learning models.",
    "HackerRank",
  );
  expect(p.companyText).toContain("Our platform");
  expect(p.roleText).toBe("About the role\nResearch deep learning models.");
});
it("does not move a job introduction just because it starts with the company name", () => {
  const text =
    "Drivetrain is seeking a marketer with 0-3 years of experience.\nResponsibilities:\nManage marketing operations.";
  expect(splitJobDescription(text, "Drivetrain")).toEqual({
    roleText: text,
    companyText: "",
  });
});
it("preserves subsidiary headings without relabelling the text as a different company", () => {
  const p = splitJobDescription(
    "ABOUT FERMI\nFermi is an initiative of Meraki Labs.\nROLE OVERVIEW\nBuild tutoring systems.",
    "Meraki Labs",
  );
  expect(p.companyText).toBe(
    "ABOUT FERMI\nFermi is an initiative of Meraki Labs.",
  );
  expect(p.roleText).toContain("Build tutoring systems.");
});
it("does not invent a role description when only company information is supplied", () => {
  expect(
    splitJobDescription("About the company\nWe build tools.", "Employer"),
  ).toEqual({
    roleText: "",
    companyText: "About the company\nWe build tools.",
  });
});
it("preserves unrecognised prose and handles missing descriptions", () => {
  expect(
    splitJobDescription("Help customers solve problems.", "Employer"),
  ).toEqual({ roleText: "Help customers solve problems.", companyText: "" });
  expect(splitJobDescription(null, "Employer")).toEqual({
    roleText: "",
    companyText: "",
  });
});
it("never moves About you or internship requirements to company information", () => {
  const p = splitJobDescription(
    "Company Description\nWe build software.\nAbout you\nYou know Python.\nAbout the internship\nWork for six months.",
    "Employer",
  );
  expect(p.companyText).toBe("Company Description\nWe build software.");
  expect(p.roleText).toContain("You know Python.");
  expect(p.roleText).toContain("Work for six months.");
});
