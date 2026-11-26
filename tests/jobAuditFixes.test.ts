import { expect, it } from "vitest";
import { explicitlyAcceptsFreshers } from "../src/services/candidateWorkspace.js";
import { primaryJobLocation } from "../src/services/directoryPolicy.js";
it("rejects mentions of training freshers and past hires", () => {
  expect(
    explicitlyAcceptsFreshers(
      "8-10 years of experience.\nExperience managing and training teams, particularly freshers/management trainees",
    ),
  ).toBe(false);
  expect(
    explicitlyAcceptsFreshers(
      "Freshers who joined 3 months back are working with CXOs",
    ),
  ).toBe(false);
});
it("retains explicit eligibility and source-stated fresher exceptions", () => {
  for (const text of [
    "Freshers welcome",
    "Qualified CA Fresher from 2025/2026 batch.",
    "Strong freshers with relevant project work may be considered.",
    "No prior professional experience required.",
    "0 to 2 years of experience.",
  ])
    expect(explicitlyAcceptsFreshers(text)).toBe(true);
});
it("uses an India location from multi-country postings without removing eligible countries from stored data", () => {
  expect(
    primaryJobLocation("Remote, Canada; Remote, India; Remote, United States"),
  ).toBe("India");
  expect(primaryJobLocation("China; Hong Kong; India; United States")).toBe(
    "India",
  );
  expect(primaryJobLocation("Bangalore / Singapore / Delhi")).toBe("Bengaluru");
});
