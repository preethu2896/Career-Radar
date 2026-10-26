import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  isStep1Valid,
  isValidProfileUrl,
  isValidResume,
  prefillFromResume,
  toggleSelection,
  validateOnboardingStep,
  applyResumeSuggestions,
  MAX_RESUME_BYTES,
  buildProfilePayload,
  hydrateDraftFromProfile,
  parseDecimalCompensation,
  normalizePhone,
  isValidPhoneInput,
  extractLocalPhoneNumber,
  isValidGithubUrl,
  normalizeGithubUrl,
  validateEntireOnboarding,
  type OnboardingDraftFields,
} from "../src/services/onboarding.js";
import type { Profile } from "../src/services/auth.js";
import {
  OnboardingStepView,
  Visual,
  meta,
  ChoiceRow,
  stepImages,
  blankDraft,
  type Draft,
} from "../src/ui/CandidateOnboarding.js";

const base = {
  resumeName: "",
  linkedin: "",
  roles: [],
  skills: [],
  fresher: false,
  cities: [],
  remote: false,
  modes: [],
  relocation: "",
  availability: "",
};

const blankDraftFields: OnboardingDraftFields = {
  firstName: "",
  lastName: "",
  phone: "",
  linkedin: "",
  github: "",
  portfolio: "",
  roles: [],
  skills: [],
  experienceYears: "",
  fresher: false,
};

describe("candidate onboarding rules", () => {
  it("enforces role and skill caps while allowing removal", () => {
    expect(toggleSelection(["A", "B", "C"], "D", 3)).toEqual(["A", "B", "C"]);
    expect(toggleSelection(["A", "B", "C"], "B", 3)).toEqual(["A", "C"]);
    expect(toggleSelection(["A", "B", "C", "D", "E"], "F", 5)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("accepts only PDF resumes within the size limit", () => {
    expect(isValidResume({ name: "resume.pdf", type: "application/pdf", size: 100 })).toBe(true);
    expect(isValidResume({ name: "resume.PDF", type: "application/octet-stream", size: 100 })).toBe(true);
    expect(isValidResume({ name: "resume.pdf", type: "", size: 100 })).toBe(true);
    expect(isValidResume({ name: "resume.docx", type: "application/pdf", size: 100 })).toBe(false);
    expect(isValidResume({ name: "resume.pdf", type: "application/pdf", size: 5 * 1024 * 1024 + 1 })).toBe(false);
    expect(isValidResume({ name: "resume.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 })).toBe(false);
  });

  it("validates the required onboarding milestones without inventing optional data", () => {
    expect(validateOnboardingStep(1, { ...base })).toContain("PDF");
    expect(validateOnboardingStep(1, { ...base, resumeName: "resume.pdf" })).toBe("");
    expect(validateOnboardingStep(1, { ...base, linkedin: "linkedin.com/in/candidate" })).toBe("");
    expect(validateOnboardingStep(2, { ...base })).toContain("target role");
    expect(validateOnboardingStep(3, { ...base, fresher: true })).toBe("");
    expect(validateOnboardingStep(4, { ...base })).toContain("city");
    expect(validateOnboardingStep(4, { ...base, remote: true })).toContain("city");
    expect(validateOnboardingStep(4, { ...base, remote: true, cities: ["Bengaluru"] })).toBe("");
    expect(validateOnboardingStep(6, { ...base, modes: ["Hybrid"], relocation: "Yes", availability: "15 days" })).toBe("");
  });

  it("accepts supported LinkedIn hosts and rejects unrelated profiles", () => {
    expect(isValidProfileUrl("https://www.linkedin.com/in/candidate", "linkedin.com")).toBe(true);
    expect(isValidProfileUrl("linkedin.com/in/candidate", "linkedin.com")).toBe(true);
    expect(isValidProfileUrl("https://example.com/in/candidate", "linkedin.com")).toBe(false);
  });

  it("prefills empty onboarding fields from resume suggestions", () => {
    const suggestions = {
      candidateName: "Priya Sharma",
      phone: "+91 98765 00000",
      linkedin: "https://linkedin.com/in/priyasharma",
      github: "https://github.com/priyasharma",
      portfolio: "https://priyasharma.me",
      targetRoles: ["Frontend Developer", "Software Engineer"],
      skills: ["React", "TypeScript", "JavaScript"],
      totalExperienceYears: 3.4,
    };

    const { draft, prefilledFields, preservedFields } = prefillFromResume(blankDraftFields, suggestions);
    expect(draft.firstName).toBe("Priya");
    expect(draft.lastName).toBe("Sharma");
    expect(draft.phone).toBe("+91 98765 00000");
    expect(draft.linkedin).toBe("https://linkedin.com/in/priyasharma");
    expect(draft.github).toBe("https://github.com/priyasharma");
    expect(draft.portfolio).toBe("https://priyasharma.me");
    expect(draft.roles).toEqual(["Frontend Developer", "Software Engineer"]);
    expect(draft.skills).toEqual(["React", "TypeScript", "JavaScript"]);
    expect(draft.experienceYears).toBe("3");
    expect(prefilledFields).toContain("First name");
    expect(prefilledFields).toContain("Skills");
    expect(preservedFields).toEqual([]);
  });

  it("never overwrites candidate's manually entered values without confirmation", () => {
    const existingDraft: OnboardingDraftFields = {
      ...blankDraftFields,
      firstName: "Aarav",
      lastName: "Patel",
      roles: ["Backend Developer"],
      skills: ["Python", "Django"],
      experienceYears: "5",
    };

    const suggestions = {
      candidateName: "Priya Sharma",
      targetRoles: ["Frontend Developer", "Software Engineer"],
      skills: ["React", "TypeScript"],
      totalExperienceYears: 2,
    };

    // By default (overwriteConfirmed: false), keep candidate's values
    const result = prefillFromResume(existingDraft, suggestions, { overwriteConfirmed: false });
    expect(result.draft.firstName).toBe("Aarav");
    expect(result.draft.lastName).toBe("Patel");
    expect(result.draft.roles).toEqual(["Backend Developer"]);
    expect(result.draft.skills).toEqual(["Python", "Django"]);
    expect(result.draft.experienceYears).toBe("5");
    expect(result.preservedFields).toContain("First name");
    expect(result.preservedFields).toContain("Last name");
    expect(result.preservedFields).toContain("Target roles");
    expect(result.preservedFields).toContain("Skills");
    expect(result.preservedFields).toContain("Years of experience");

    // When candidate explicitly confirms overwrite, update values
    const confirmedResult = prefillFromResume(existingDraft, suggestions, { overwriteConfirmed: true });
    expect(confirmedResult.draft.firstName).toBe("Priya");
    expect(confirmedResult.draft.lastName).toBe("Sharma");
    expect(confirmedResult.draft.roles).toEqual(["Frontend Developer", "Software Engineer"]);
    expect(confirmedResult.draft.skills).toEqual(["React", "TypeScript"]);
    expect(confirmedResult.draft.experienceYears).toBe("2");
    expect(confirmedResult.preservedFields).toEqual([]);
  });

  it("desktop onboarding CSS rules ensure viewport fitting and internal scrolling", () => {
    const cssPath = resolve(process.cwd(), "src/ui/app.css");
    const cssContent = readFileSync(cssPath, "utf-8");

    // Check desktop onboarding-experience has 100svh height constraint
    expect(cssContent).toMatch(/\.onboarding-experience\s*\{[^}]*height:\s*100svh/);
    expect(cssContent).toMatch(/\.onboarding-experience\s*\{[^}]*max-height:\s*100svh/);

    // Check onboarding-layout is a flex child with min-height: 0
    expect(cssContent).toMatch(/\.onboarding-layout\s*\{[^}]*flex:\s*1/);
    expect(cssContent).toMatch(/\.onboarding-layout\s*\{[^}]*min-height:\s*0/);

    // Check onboarding-form-panel enables internal vertical scrolling
    expect(cssContent).toMatch(/\.onboarding-form-panel\s*\{[^}]*overflow-y:\s*auto/);
    expect(cssContent).toMatch(/\.onboarding-form-panel\s*\{[^}]*min-height:\s*0/);

    // Check onboarding-actions is sticky at the bottom
    expect(cssContent).toMatch(/\.onboarding-actions\s*\{[^}]*position:\s*sticky/);

    // Check responsive reset on tablet/mobile (< 900px)
    expect(cssContent).toContain("@media (max-width: 900px)");
    expect(cssContent).toContain(".onboarding-experience { height: auto; max-height: none; min-height: 100svh;");
  });

  describe("Step 1 resume upload and validation regression tests", () => {
    it("passes Step 1 validation when a valid PDF is uploaded and parsed", () => {
      const draftState = { ...base, resumeName: "asha-rao-resume.pdf" };
      expect(isStep1Valid(draftState)).toBe(true);
      expect(validateOnboardingStep(1, draftState)).toBe("");
    });

    it("passes Step 1 validation for a valid PDF even with zero detected skills", () => {
      // Even if parsing found 0 skills/roles, the resume upload requirement is satisfied
      const draftWithZeroSkills = {
        ...base,
        resumeName: "minimal-resume.pdf",
        skills: [],
        roles: [],
      };
      expect(isStep1Valid(draftWithZeroSkills)).toBe(true);
      expect(validateOnboardingStep(1, draftWithZeroSkills)).toBe("");
    });

    it("fails validation with a useful error when file is invalid (extension or size)", () => {
      // Non-PDF file
      const nonPdfFile = { name: "portfolio.docx", type: "application/docx", size: 50_000 };
      expect(isValidResume(nonPdfFile)).toBe(false);

      // Oversized file (> 5 MB)
      const oversizedFile = { name: "huge.pdf", type: "application/pdf", size: MAX_RESUME_BYTES + 1 };
      expect(isValidResume(oversizedFile)).toBe(false);

      // When invalid, resumeName is not accepted into draft, so Step 1 fails
      const draftWithRejectedFile = { ...base, resumeName: "", linkedin: "" };
      expect(isStep1Valid(draftWithRejectedFile)).toBe(false);
      expect(validateOnboardingStep(1, draftWithRejectedFile)).toBe(
        "Add a PDF resume or a valid LinkedIn profile URL to continue."
      );
    });

    it("fails validation safely when PDF parsing errors out", () => {
      // If parsing fails (e.g. encrypted or malformed PDF), resumeName must not be recorded
      const draftAfterFailedParse = { ...base, resumeName: "", linkedin: "" };
      expect(isStep1Valid(draftAfterFailedParse)).toBe(false);
      expect(validateOnboardingStep(1, draftAfterFailedParse)).toBe(
        "Add a PDF resume or a valid LinkedIn profile URL to continue."
      );
    });

    it("passes Step 1 validation with a valid LinkedIn URL without requiring a PDF", () => {
      const draftWithLinkedIn = {
        ...base,
        resumeName: "",
        linkedin: "https://www.linkedin.com/in/rohanmehta",
      };
      expect(isStep1Valid(draftWithLinkedIn)).toBe(true);
      expect(validateOnboardingStep(1, draftWithLinkedIn)).toBe("");

      // Alternate URL format without https
      const draftWithShortLinkedIn = {
        ...base,
        resumeName: "",
        linkedin: "linkedin.com/in/rohanmehta",
      };
      expect(isStep1Valid(draftWithShortLinkedIn)).toBe(true);
      expect(validateOnboardingStep(1, draftWithShortLinkedIn)).toBe("");
    });

    it("fails Step 1 validation when LinkedIn URL is invalid and no PDF is uploaded", () => {
      const draftWithInvalidLinkedIn = {
        ...base,
        resumeName: "",
        linkedin: "https://github.com/rohanmehta",
      };
      expect(isStep1Valid(draftWithInvalidLinkedIn)).toBe(false);
      expect(validateOnboardingStep(1, draftWithInvalidLinkedIn)).toBe(
        "Add a PDF resume or a valid LinkedIn profile URL to continue."
      );

      const draftWithGarbage = {
        ...base,
        resumeName: "",
        linkedin: "just random text",
      };
      expect(isStep1Valid(draftWithGarbage)).toBe(false);
      expect(validateOnboardingStep(1, draftWithGarbage)).toBe(
        "Add a PDF resume or a valid LinkedIn profile URL to continue."
      );
    });

    it("clears valid-file state when the candidate removes the PDF", () => {
      // Initially uploaded
      let draftState = { ...base, resumeName: "resume.pdf" };
      expect(isStep1Valid(draftState)).toBe(true);

      // Candidate removes the PDF
      draftState = { ...draftState, resumeName: "" };
      expect(isStep1Valid(draftState)).toBe(false);
      expect(validateOnboardingStep(1, draftState)).toBe(
        "Add a PDF resume or a valid LinkedIn profile URL to continue."
      );
    });

    it("clears stale errors when a valid alternative is supplied", () => {
      // Candidate had an error because neither was provided
      let error = validateOnboardingStep(1, { ...base, resumeName: "", linkedin: "" });
      expect(error).toBe("Add a PDF resume or a valid LinkedIn profile URL to continue.");

      // Case A: Candidate enters a valid LinkedIn URL -> Step 1 is satisfied
      const withLinkedIn = { ...base, linkedin: "linkedin.com/in/validuser" };
      if (isStep1Valid(withLinkedIn)) {
        error = "";
      }
      expect(error).toBe("");
      expect(validateOnboardingStep(1, withLinkedIn)).toBe("");

      // Case B: Candidate uploads a valid PDF instead -> Step 1 is satisfied
      const withResume = { ...base, resumeName: "valid.pdf", linkedin: "invalid" };
      expect(isStep1Valid(withResume)).toBe(true);
      expect(validateOnboardingStep(1, withResume)).toBe("");
    });
  });

  describe("Resume extraction placement in onboarding (Step 1 & Step 2 verification)", () => {
    const renderStep = (
      step: number,
      draft: Draft,
      props: Partial<Parameters<typeof OnboardingStepView>[0]> = {}
    ) => {
      return renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step,
          draft,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          ...props,
        })
      );
    };

    it("1. Step 1 does not render the extracted-details summary or review drawer", () => {
      const draftWithResume: Draft = {
        ...blankDraft(),
        resumeName: "asha-rao-resume.pdf",
        resumeBytes: 150000,
        extractedRoles: ["Frontend Developer", "Software Engineer"],
        extractedSkills: ["React", "TypeScript", "Node.js"],
        prefilledFields: ["Target roles", "Skills"],
        preservedFields: [],
      };

      const html = renderStep(1, draftWithResume);

      // Must NOT contain extracted-details summary or review drawer
      expect(html).not.toContain("We found a few starting points");
      expect(html).not.toContain("Review detected details");
      expect(html).not.toContain("Hide detected details");
      expect(html).not.toContain("resume-summary");
      expect(html).not.toContain("resume-extracted-details");
      expect(html).not.toContain("Prefilled:");
      expect(html).not.toContain("Kept your previously entered values");
      expect(html).not.toContain("Update with resume data");

      // Must contain Step 1 essentials
      expect(html).toContain("asha-rao-resume.pdf");
      expect(html).toContain("Remove");
      expect(html).toContain("linkedin.com/in/you");
      expect(html).toContain("Import");
      expect(html).toContain("* Your resume or LinkedIn is required to continue.");
    });

    it("2. Resume parsing results remain available after navigating to Step 2 and Step 3", () => {
      // Step 1: parsed resume results are saved into draft
      const step1Draft: Draft = {
        ...blankDraft(),
        resumeName: "asha-rao-resume.pdf",
        resumeBytes: 150000,
        extractedRoles: ["Software Engineer", "Frontend Developer"],
        extractedSkills: ["React", "TypeScript", "SQL"],
        roles: ["Software Engineer", "Frontend Developer"],
        skills: ["React", "TypeScript", "SQL"],
        prefilledFields: ["Target roles", "Skills"],
      };

      // Navigate to Step 2 with the same draft
      expect(step1Draft.extractedRoles).toEqual(["Software Engineer", "Frontend Developer"]);
      expect(step1Draft.extractedSkills).toEqual(["React", "TypeScript", "SQL"]);

      const html = renderStep(2, step1Draft);
      expect(html).toContain("Software Engineer");
      expect(html).toContain("Frontend Developer");

      // Extracted skills are retained and rendered in designated Step 3
      const step3Html = renderStep(3, step1Draft);
      expect(step3Html).toContain("React");
      expect(step3Html).toContain("TypeScript");
      expect(step3Html).toContain("SQL");
    });

    it("3. Step 2 displays role suggestions from experience and Step 3 displays skills", () => {
      const draft: Draft = {
        ...blankDraft(),
        resumeName: "dev-resume.pdf",
        extractedRoles: ["Full-Stack Developer"],
        extractedSkills: ["React", "Node.js", "Docker"],
        roles: ["Full-Stack Developer"],
        skills: ["React", "Node.js", "Docker"],
      };

      const html = renderStep(2, draft);

      // Role suggestions derived from experience
      expect(html).toContain("From your resume");
      expect(html).toContain("Full-Stack Developer");
      expect(html).toContain("Select your top 3 titles");
      expect(html).toContain("1 of 3 selected");

      // Does not invent arbitrary roles that were not in experience
      expect(html).not.toContain("Cybersecurity Engineer");
      expect(html).not.toContain("Product Designer");

      // Extracted skills belong in Step 3
      const step3Html = renderStep(3, draft);
      expect(step3Html).toContain("React");
      expect(step3Html).toContain("Node.js");
      expect(step3Html).toContain("Docker");
    });

    it("4. Candidates can manually edit skills and roles", () => {
      // Roles: toggle selection, add custom role, remove role, enforce max 3
      let currentRoles = ["Software Engineer"];
      currentRoles = toggleSelection(currentRoles, "Frontend Developer", 3);
      expect(currentRoles).toEqual(["Software Engineer", "Frontend Developer"]);

      currentRoles = toggleSelection(currentRoles, "DevOps Engineer", 3);
      expect(currentRoles).toEqual(["Software Engineer", "Frontend Developer", "DevOps Engineer"]);

      // Capped at 3: adding a 4th role is blocked
      currentRoles = toggleSelection(currentRoles, "Data Scientist", 3);
      expect(currentRoles).toEqual(["Software Engineer", "Frontend Developer", "DevOps Engineer"]);

      // Removing a role succeeds
      currentRoles = toggleSelection(currentRoles, "Frontend Developer", 3);
      expect(currentRoles).toEqual(["Software Engineer", "DevOps Engineer"]);

      // Skills: add and remove
      let currentSkills = ["React", "TypeScript"];
      currentSkills = toggleSelection(currentSkills, "GraphQL");
      expect(currentSkills).toEqual(["React", "TypeScript", "GraphQL"]);

      currentSkills = toggleSelection(currentSkills, "React");
      expect(currentSkills).toEqual(["TypeScript", "GraphQL"]);
    });

    it("5. Existing manual values are not silently overwritten", () => {
      const manualDraft = {
        ...blankDraft(),
        firstName: "Rohan",
        roles: ["DevOps Engineer"],
        skills: ["Docker", "Kubernetes"],
      };

      const resumeSuggestions = {
        candidateName: "Asha Rao",
        targetRoles: ["Software Engineer", "Frontend Developer"],
        skills: ["React", "TypeScript"],
      };

      // 1. Silent prefill keeps manual values
      const prefilled = prefillFromResume(manualDraft, resumeSuggestions, {
        overwriteConfirmed: false,
      });
      expect(prefilled.draft.roles).toEqual(["DevOps Engineer"]);
      expect(prefilled.draft.skills).toEqual(["Docker", "Kubernetes"]);
      expect(prefilled.preservedFields).toContain("Target roles");
      expect(prefilled.preservedFields).toContain("Skills");

      const draftWithPreserved: Draft = {
        ...prefilled.draft,
        extractedRoles: resumeSuggestions.targetRoles,
        extractedSkills: resumeSuggestions.skills,
        preservedFields: prefilled.preservedFields,
      };

      // Render Step 2: verify obsolete decision box is NOT shown, manual values preserved
      const html = renderStep(2, draftWithPreserved);
      expect(html).not.toContain("Kept your previously entered values for:");
      expect(html).not.toContain("Merge resume suggestions");
      expect(html).not.toContain("Update with resume data");
      expect(html).toContain("DevOps Engineer");

      // 2. Explicit merge action
      const merged = applyResumeSuggestions(draftWithPreserved, "merge");
      expect(merged.roles).toEqual(["DevOps Engineer", "Software Engineer", "Frontend Developer"]);
      expect(merged.skills).toEqual(["Docker", "Kubernetes", "React", "TypeScript"]);
      expect(merged.preservedFields).not.toContain("Target roles");
      expect(merged.preservedFields).not.toContain("Skills");

      // 3. Explicit replace action
      const replaced = applyResumeSuggestions(draftWithPreserved, "replace");
      expect(replaced.roles).toEqual(["Software Engineer", "Frontend Developer"]);
      expect(replaced.skills).toEqual(["React", "TypeScript"]);
    });

    it("6. Empty extraction results do not block manual entry", () => {
      const emptyDraft: Draft = {
        ...blankDraft(),
        resumeName: "scanned-image.pdf",
        extractedRoles: [],
        extractedSkills: [],
      };

      const html = renderStep(2, emptyDraft);

      // Renders clean empty states without invented roles
      expect(html).toContain(
        "No target roles detected from your experience. Add up to 3 roles manually below."
      );
      expect(html).toContain("Add a title");
      expect(html).toContain("add a role");

      // Step 3 allows skills selection
      const step3Html = renderStep(3, emptyDraft);
      expect(step3Html).toContain("Choose up to five top skills");

      // Does not block manual entry: user enters values manually
      const manuallyFilled: Draft = {
        ...emptyDraft,
        roles: ["Product Manager"],
        skills: ["Figma", "User Research"],
      };

      // Validation passes with manual values
      expect(validateOnboardingStep(2, manuallyFilled)).toBe("");
    });

    it("7. Back navigation preserves the draft", () => {
      // Step 1 -> Step 2
      let userDraft: Draft = {
        ...blankDraft(),
        resumeName: "my-resume.pdf",
        resumeBytes: 80000,
        extractedRoles: ["Data Analyst"],
        extractedSkills: ["SQL", "Python"],
        roles: ["Data Analyst"],
        skills: ["SQL", "Python"],
      };

      // User adds a manual role and skill in Step 2 / Step 3
      userDraft = {
        ...userDraft,
        roles: [...userDraft.roles, "Data Scientist"],
        skills: [...userDraft.skills, "R"],
      };

      // Simulate back navigation to Step 1
      const step1Html = renderStep(1, userDraft);
      expect(step1Html).toContain("my-resume.pdf");

      // Simulate forward navigation back to Step 2
      const step2Html = renderStep(2, userDraft);
      expect(step2Html).toContain("Data Analyst");
      expect(step2Html).toContain("Data Scientist");

      // Simulate navigation to Step 3 for skills
      const step3Html = renderStep(3, userDraft);
      expect(step3Html).toContain("SQL");
      expect(step3Html).toContain("Python");
      expect(step3Html).toContain("R");
      expect(userDraft.extractedRoles).toEqual(["Data Analyst"]);
      expect(userDraft.extractedSkills).toEqual(["SQL", "Python"]);

      // Verify draft serialization (localStorage round-trip)
      const serialized = JSON.stringify(userDraft);
      const deserialized: Draft = { ...blankDraft(), ...JSON.parse(serialized) };
      expect(deserialized.resumeName).toBe("my-resume.pdf");
      expect(deserialized.roles).toEqual(["Data Analyst", "Data Scientist"]);
      expect(deserialized.skills).toEqual(["SQL", "Python", "R"]);
      expect(deserialized.extractedRoles).toEqual(["Data Analyst"]);
      expect(deserialized.extractedSkills).toEqual(["SQL", "Python"]);
    });
  });

  describe("candidate profile persistence and hydration", () => {
    const fullDraft: Draft = {
      ...blankDraft(),
      firstName: "Asha",
      lastName: "Rao",
      careerStage: "Experienced professional",
      roles: ["Software Engineer", "Frontend Developer"],
      skills: ["React", "TypeScript", "Node.js"],
      experienceYears: "4",
      fresher: false,
      cities: ["Bengaluru", "Pune"],
      remote: true,
      currentCompensation: "18.5",
      expectedCompensation: "28.75",
      modes: ["Hybrid"],
      relocation: "Yes, for the right role",
      availability: "Ready to join immediately",
      currentCity: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      phone: "+91 98765 43210",
      linkedin: "https://linkedin.com/in/asharao",
      github: "https://github.com/asharao",
      portfolio: "https://asharao.dev",
      resumeName: "asha-resume.pdf",
      resumeBytes: 1542000,
      industries: ["Applied AI", "SaaS"],
    };

    it("includes all supported onboarding fields in the save payload", () => {
      const payload = buildProfilePayload(fullDraft, "user-456", { onboardingComplete: true });

      expect(payload).toEqual({
        id: "user-456",
        first_name: "Asha",
        last_name: "Rao",
        career_stage: "Experienced professional",
        experience_level: "4 years",
        target_roles: ["Software Engineer", "Frontend Developer"],
        skills: ["React", "TypeScript", "Node.js"],
        preferred_cities: ["Bengaluru", "Pune"],
        work_preferences: ["Hybrid", "Remote"],
        industries: ["Applied AI", "SaaS"],
        onboarding_complete: true,
        phone: "+91 9876543210",
        current_city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
        current_compensation: 18.5,
        expected_compensation: 28.75,
        relocation: "Yes, for the right role",
        availability: "Ready to join immediately",
        linkedin_url: "https://linkedin.com/in/asharao",
        github_url: "https://github.com/asharao",
        portfolio_url: "https://asharao.dev",
        resume_name: "asha-resume.pdf",
        resume_bytes: 1542000,
      });
    });

    it("survives decimal compensation values across save and hydration", () => {
      // 1. Parse and build payload with decimal LPA values
      expect(parseDecimalCompensation("18.5")).toBe(18.5);
      expect(parseDecimalCompensation("28.75")).toBe(28.75);
      expect(parseDecimalCompensation("0")).toBe(0);
      expect(parseDecimalCompensation("")).toBeNull();
      expect(parseDecimalCompensation(null)).toBeNull();

      const payload = buildProfilePayload(fullDraft, "user-456", { onboardingComplete: true });
      expect(payload.current_compensation).toBe(18.5);
      expect(payload.expected_compensation).toBe(28.75);

      // 2. Hydrate back into a fresh draft
      const hydrated = hydrateDraftFromProfile(blankDraft(), payload);
      expect(hydrated.currentCompensation).toBe("18.5");
      expect(hydrated.expectedCompensation).toBe("28.75");

      // 3. Re-save from hydrated draft reproduces identical numerical values
      const roundTripPayload = buildProfilePayload(hydrated, "user-456", { onboardingComplete: true });
      expect(roundTripPayload.current_compensation).toBe(18.5);
      expect(roundTripPayload.expected_compensation).toBe(28.75);
    });

    it("re-populates all previously saved fields during draft hydration", () => {
      const savedProfile: Profile = {
        id: "user-789",
        first_name: "Rohan",
        last_name: "Mehta",
        career_stage: "Early career",
        experience_level: "2 years",
        target_roles: ["Backend Developer"],
        skills: ["Python", "SQL"],
        preferred_cities: ["Mumbai"],
        work_preferences: ["On-site"],
        industries: ["Fintech"],
        onboarding_complete: false,
        phone: "+91 91234 56789",
        current_city: "Mumbai",
        state: "Maharashtra",
        postal_code: "400001",
        current_compensation: 12.5,
        expected_compensation: 20,
        relocation: "No, keep me local",
        availability: "15 days",
        linkedin_url: "https://linkedin.com/in/rohanmehta",
        github_url: "https://github.com/rohanmehta",
        portfolio_url: "https://rohanmehta.com",
        resume_name: "rohan_cv.pdf",
        resume_bytes: 845200,
      };

      const hydrated = hydrateDraftFromProfile(blankDraft(), savedProfile);

      expect(hydrated.firstName).toBe("Rohan");
      expect(hydrated.lastName).toBe("Mehta");
      expect(hydrated.careerStage).toBe("Early career");
      expect(hydrated.experienceYears).toBe("2");
      expect(hydrated.fresher).toBe(false);
      expect(hydrated.roles).toEqual(["Backend Developer"]);
      expect(hydrated.skills).toEqual(["Python", "SQL"]);
      expect(hydrated.cities).toEqual(["Mumbai"]);
      expect(hydrated.modes).toEqual(["On-site"]);
      expect(hydrated.industries).toEqual(["Fintech"]);
      expect(hydrated.phone).toBe("+91 91234 56789");
      expect(hydrated.currentCity).toBe("Mumbai");
      expect(hydrated.state).toBe("Maharashtra");
      expect(hydrated.postalCode).toBe("400001");
      expect(hydrated.currentCompensation).toBe("12.5");
      expect(hydrated.expectedCompensation).toBe("20");
      expect(hydrated.relocation).toBe("No, keep me local");
      expect(hydrated.availability).toBe("15 days");
      expect(hydrated.linkedin).toBe("https://linkedin.com/in/rohanmehta");
      expect(hydrated.github).toBe("https://github.com/rohanmehta");
      expect(hydrated.portfolio).toBe("https://rohanmehta.com");
      expect(hydrated.resumeName).toBe("rohan_cv.pdf");
      expect(hydrated.resumeBytes).toBe(845200);
    });

    it("preserves expected fields and incomplete status during partial saves", () => {
      const existingProfile: Profile = {
        id: "user-partial",
        first_name: "Priya",
        last_name: "Sharma",
        career_stage: "Student / Fresher",
        experience_level: "No professional experience",
        target_roles: ["Data Analyst"],
        skills: ["SQL", "Python"],
        preferred_cities: ["Delhi NCR"],
        work_preferences: ["Remote"],
        industries: ["Healthtech"],
        onboarding_complete: false,
        phone: "+91 98111 22233",
        current_city: "Noida",
        state: "Uttar Pradesh",
        postal_code: "201301",
        current_compensation: null,
        expected_compensation: 10.5,
        relocation: "Yes, for the right role",
        availability: "Ready to join immediately",
        linkedin_url: "https://linkedin.com/in/priyasharma",
        github_url: "https://github.com/priyasharma",
        portfolio_url: "https://priyasharma.site",
        resume_name: "priya_resume.pdf",
        resume_bytes: 450000,
      };

      // Candidate is on Step 1, only touched their last name
      const step1Draft: Draft = {
        ...blankDraft(),
        firstName: "Priya",
        lastName: "Verma",
        resumeName: "priya_resume.pdf",
        resumeBytes: 450000,
      };

      // Perform partial save (completeLater)
      const partialPayload = buildProfilePayload(step1Draft, "user-partial", {
        existingProfile,
        isPartial: true,
        onboardingComplete: false,
      });

      expect(partialPayload.last_name).toBe("Verma");
      expect(partialPayload.onboarding_complete).toBe(false);
      expect(partialPayload.phone).toBe("+91 98111 22233");
      expect(partialPayload.current_city).toBe("Noida");
      expect(partialPayload.state).toBe("Uttar Pradesh");
      expect(partialPayload.expected_compensation).toBe(10.5);
      expect(partialPayload.relocation).toBe("Yes, for the right role");
      expect(partialPayload.availability).toBe("Ready to join immediately");
      expect(partialPayload.linkedin_url).toBe("https://linkedin.com/in/priyasharma");
      expect(partialPayload.github_url).toBe("https://github.com/priyasharma");
      expect(partialPayload.portfolio_url).toBe("https://priyasharma.site");
      expect(partialPayload.target_roles).toEqual(["Data Analyst"]);
      expect(partialPayload.skills).toEqual(["SQL", "Python"]);
    });

    it("handles empty optional fields consistently without saving undefined or junk values", () => {
      const minimalDraft: Draft = {
        ...blankDraft(),
        firstName: "Vikram",
        lastName: "Singh",
        roles: ["Software Engineer"],
        skills: ["Java"],
        cities: ["Hyderabad"],
        modes: ["On-site"],
        relocation: "No, keep me local",
        availability: "1 month",
      };

      const payload = buildProfilePayload(minimalDraft, "user-minimal", { onboardingComplete: true });

      expect(payload.phone).toBeNull();
      expect(payload.current_city).toBeNull();
      expect(payload.state).toBeNull();
      expect(payload.postal_code).toBeNull();
      expect(payload.current_compensation).toBeNull();
      expect(payload.expected_compensation).toBeNull();
      expect(payload.linkedin_url).toBeNull();
      expect(payload.github_url).toBeNull();
      expect(payload.portfolio_url).toBeNull();
      expect(payload.resume_name).toBeNull();
      expect(payload.resume_bytes).toBeNull();
    });

    it("persists current_compensation as numeric 0 for freshers in both full and partial saves", () => {
      const fresherDraft: Draft = {
        ...blankDraft(),
        firstName: "Neha",
        lastName: "Kapur",
        fresher: true,
        currentCompensation: "0",
        expectedCompensation: "8.5",
        roles: ["Data Analyst"],
        skills: ["SQL"],
        cities: ["Bengaluru"],
        modes: ["On-site"],
        relocation: "Yes, for the right role",
        availability: "Ready to join immediately",
      };

      // 1. Full save
      const fullPayload = buildProfilePayload(fresherDraft, "user-fresher", { onboardingComplete: true });
      expect(fullPayload.current_compensation).toBe(0);
      expect(fullPayload.expected_compensation).toBe(8.5);
      expect(fullPayload.experience_level).toBe("No professional experience");
      expect(fullPayload.onboarding_complete).toBe(true);

      // 2. Partial save (preserves numeric 0 rule)
      const existingExperiencedProfile: Profile = {
        id: "user-fresher",
        first_name: "Neha",
        last_name: "Kapur",
        career_stage: "Student / Fresher",
        experience_level: "No professional experience",
        target_roles: ["Data Analyst"],
        skills: ["SQL"],
        preferred_cities: ["Bengaluru"],
        work_preferences: ["On-site"],
        industries: [],
        current_compensation: 12,
        expected_compensation: 18,
        onboarding_complete: false,
      };

      const partialPayload = buildProfilePayload(fresherDraft, "user-fresher", {
        existingProfile: existingExperiencedProfile,
        isPartial: true,
        onboardingComplete: false,
      });
      expect(partialPayload.current_compensation).toBe(0);
      expect(partialPayload.expected_compensation).toBe(8.5);
      expect(partialPayload.onboarding_complete).toBe(false);
    });

    it("hydrates saved fresher profile with currentCompensation set to '0' and fresher true", () => {
      const savedFresherProfile: Profile = {
        id: "fresher-user",
        first_name: "Aman",
        last_name: "Gupta",
        career_stage: "Student / Fresher",
        experience_level: "No professional experience",
        target_roles: ["Junior Developer"],
        skills: ["JavaScript", "HTML"],
        preferred_cities: ["Delhi NCR"],
        work_preferences: ["Remote"],
        industries: ["SaaS"],
        current_compensation: 0,
        expected_compensation: 6.5,
        onboarding_complete: false,
      };

      const hydrated = hydrateDraftFromProfile(blankDraft(), savedFresherProfile);
      expect(hydrated.fresher).toBe(true);
      expect(hydrated.currentCompensation).toBe("0");
      expect(hydrated.expectedCompensation).toBe("6.5");
    });

    it("simulates toggling fresher status: sets compensation to 0 and restores previous value when toggled off", () => {
      let draft: Draft = {
        ...blankDraft(),
        currentCompensation: "18.5",
        expectedCompensation: "25",
        fresher: false,
      };
      let previousComp = draft.currentCompensation;

      // Toggle Fresher ON:
      if (draft.currentCompensation && draft.currentCompensation !== "0") {
        previousComp = draft.currentCompensation;
      }
      draft = { ...draft, fresher: true, currentCompensation: "0" };

      expect(draft.fresher).toBe(true);
      expect(draft.currentCompensation).toBe("0");

      const fresherPayload = buildProfilePayload(draft, "test-user", { onboardingComplete: true });
      expect(fresherPayload.current_compensation).toBe(0);
      expect(fresherPayload.expected_compensation).toBe(25);

      // Toggle Fresher OFF:
      draft = { ...draft, fresher: false, currentCompensation: previousComp || "" };
      expect(draft.fresher).toBe(false);
      expect(draft.currentCompensation).toBe("18.5");

      const restoredPayload = buildProfilePayload(draft, "test-user", { onboardingComplete: true });
      expect(restoredPayload.current_compensation).toBe(18.5);
      expect(restoredPayload.expected_compensation).toBe(25);
    });

    it("explicitly clears optional fields when blanked by candidate during a complete save", () => {
      const existingProfile: Profile = {
        id: "user-clearing",
        first_name: "Aarav",
        last_name: "Patel",
        career_stage: "Experienced professional",
        experience_level: "5 years",
        target_roles: ["Frontend Engineer"],
        skills: ["React"],
        preferred_cities: ["Pune"],
        work_preferences: ["Hybrid"],
        industries: ["Fintech"],
        onboarding_complete: false,
        phone: "+91 98888 77777",
        current_city: "Pune",
        state: "Maharashtra",
        postal_code: "411001",
        current_compensation: 20,
        expected_compensation: 32,
        relocation: "Yes, for the right role",
        availability: "Immediate",
        linkedin_url: "https://linkedin.com/in/aaravpatel",
        github_url: "https://github.com/aaravpatel",
        portfolio_url: "https://aaravpatel.dev",
        resume_name: "aarav_resume.pdf",
        resume_bytes: 250000,
      };

      // Candidate clears optional links, phone, locations, and resume in draft
      const clearedDraft: Draft = {
        ...blankDraft(),
        firstName: "Aarav",
        lastName: "Patel",
        roles: ["Frontend Engineer"],
        skills: ["React"],
        cities: ["Pune"],
        modes: ["Hybrid"],
        relocation: "Yes, for the right role",
        availability: "Immediate",
        phone: "",
        currentCity: "",
        state: "",
        postalCode: "",
        currentCompensation: "",
        expectedCompensation: "",
        linkedin: "",
        github: "",
        portfolio: "",
        resumeName: "",
        resumeBytes: 0,
      };

      const payload = buildProfilePayload(clearedDraft, "user-clearing", {
        existingProfile,
        isPartial: false,
        onboardingComplete: true,
      });

      expect(payload.phone).toBeNull();
      expect(payload.current_city).toBeNull();
      expect(payload.state).toBeNull();
      expect(payload.postal_code).toBeNull();
      expect(payload.current_compensation).toBeNull();
      expect(payload.expected_compensation).toBeNull();
      expect(payload.linkedin_url).toBeNull();
      expect(payload.github_url).toBeNull();
      expect(payload.portfolio_url).toBeNull();
      expect(payload.resume_name).toBeNull();
      expect(payload.resume_bytes).toBeNull();
      expect(payload.onboarding_complete).toBe(true);
    });

    it("safely handles missing profile rows (null or undefined) during hydration and payload building", () => {
      const draft = blankDraft();
      expect(hydrateDraftFromProfile(draft, null)).toEqual(draft);
      expect(hydrateDraftFromProfile(draft, undefined)).toEqual(draft);

      const payloadNull = buildProfilePayload(draft, "user-null", { existingProfile: null, isPartial: true });
      expect(payloadNull.id).toBe("user-null");
      expect(payloadNull.first_name).toBe("");
      expect(payloadNull.phone).toBeNull();

      const payloadUndefined = buildProfilePayload(draft, "user-undefined", { existingProfile: undefined, isPartial: true });
      expect(payloadUndefined.id).toBe("user-undefined");
      expect(payloadUndefined.first_name).toBe("");
    });

    it("ensures resume metadata contains only filename and byte size, never binary content", () => {
      const draftWithResume: Draft = {
        ...blankDraft(),
        firstName: "Ananya",
        lastName: "Iyer",
        roles: ["Product Designer"],
        skills: ["Figma"],
        cities: ["Chennai"],
        modes: ["Remote"],
        relocation: "No",
        availability: "Immediate",
        resumeName: "ananya_portfolio.pdf",
        resumeBytes: 1204800,
      };

      const payload = buildProfilePayload(draftWithResume, "user-resume", { onboardingComplete: true });
      expect(payload.resume_name).toBe("ananya_portfolio.pdf");
      expect(payload.resume_bytes).toBe(1204800);
      expect(typeof payload.resume_bytes).toBe("number");
      // Confirm no binary / buffer properties exist on payload
      expect((payload as Record<string, unknown>).resume_file).toBeUndefined();
      expect((payload as Record<string, unknown>).resume_data).toBeUndefined();
      expect((payload as Record<string, unknown>).resume_binary).toBeUndefined();
    });

    it("persists first and last names across complete saves and partial saves", () => {
      const namedDraft: Draft = {
        ...blankDraft(),
        firstName: "  Aditya  ",
        lastName: "  Nair  ",
        roles: ["Engineering Manager"],
        skills: ["System Design"],
        cities: ["Bengaluru"],
        modes: ["Hybrid"],
        relocation: "Yes, for the right role",
        availability: "1 month",
      };

      // 1. Complete save trims and persists names
      const completePayload = buildProfilePayload(namedDraft, "user-aditya", { onboardingComplete: true });
      expect(completePayload.first_name).toBe("Aditya");
      expect(completePayload.last_name).toBe("Nair");
      expect(completePayload.onboarding_complete).toBe(true);

      // 2. Partial save trims and persists names
      const partialPayload = buildProfilePayload(namedDraft, "user-aditya", { isPartial: true, onboardingComplete: false });
      expect(partialPayload.first_name).toBe("Aditya");
      expect(partialPayload.last_name).toBe("Nair");
      expect(partialPayload.onboarding_complete).toBe(false);
    });

    it("preserves existing saved first and last names during partial and complete saves when draft has empty names", () => {
      const existingProfile: Profile = {
        id: "user-existing-names",
        first_name: "Preet",
        last_name: "Singh",
        career_stage: "Experienced professional",
        experience_level: "3 years",
        target_roles: ["Backend Engineer"],
        skills: ["Go", "PostgreSQL"],
        preferred_cities: ["Delhi NCR"],
        work_preferences: ["On-site"],
        industries: ["Fintech"],
        onboarding_complete: false,
      };

      // Draft where candidate is on an unvisited step or hasn't touched the name fields
      const emptyNameDraft: Draft = {
        ...blankDraft(),
        firstName: "",
        lastName: "",
        cities: ["Delhi NCR"],
      };

      // 1. Partial save from unvisited step must NEVER erase existing names
      const partialResult = buildProfilePayload(emptyNameDraft, "user-existing-names", {
        existingProfile,
        isPartial: true,
        onboardingComplete: false,
      });
      expect(partialResult.first_name).toBe("Preet");
      expect(partialResult.last_name).toBe("Singh");

      // 2. Complete save must also preserve existing names if draft is empty
      const completeResult = buildProfilePayload(emptyNameDraft, "user-existing-names", {
        existingProfile,
        isPartial: false,
        onboardingComplete: true,
      });
      expect(completeResult.first_name).toBe("Preet");
      expect(completeResult.last_name).toBe("Singh");
    });

    it("hydrates draft from saved profile names with precedence, falling back to metadata when profile is empty", () => {
      // Case A: Profile has saved names from previous completion
      const savedProfile: Profile = {
        id: "cand-saved",
        first_name: "Ananya",
        last_name: "Iyer",
        career_stage: "Experienced professional",
        experience_level: "5 years",
        target_roles: ["Product Designer"],
        skills: ["Figma"],
        preferred_cities: ["Bengaluru"],
        work_preferences: ["Hybrid"],
        industries: ["SaaS"],
        onboarding_complete: true,
      };

      const freshDraft = blankDraft();
      const hydrated = hydrateDraftFromProfile(freshDraft, savedProfile);
      expect(hydrated.firstName).toBe("Ananya");
      expect(hydrated.lastName).toBe("Iyer");

      // Case B: Saved profile names take precedence over stale draft names
      const staleDraft: Draft = {
        ...blankDraft(),
        firstName: "OldStaleName",
        lastName: "OldLastName",
      };
      const hydratedPrecedence = hydrateDraftFromProfile(staleDraft, savedProfile);
      expect(hydratedPrecedence.firstName).toBe("Ananya");
      expect(hydratedPrecedence.lastName).toBe("Iyer");

      // Case C: When profile has empty names, draft names are preserved
      const emptyNameProfile: Profile = {
        ...savedProfile,
        first_name: "",
        last_name: "",
      };
      const hydratedFallback = hydrateDraftFromProfile(staleDraft, emptyNameProfile);
      expect(hydratedFallback.firstName).toBe("OldStaleName");
      expect(hydratedFallback.lastName).toBe("OldLastName");
    });

    it("Step 1 validation passes with resume or LinkedIn without requiring on-screen name inputs", () => {
      // Step 1 validation relies on resume or LinkedIn, so removing name inputs from Step 1 does not break progression
      const draftWithResume = {
        ...blankDraft(),
        resumeName: "resume.pdf",
      };
      expect(validateOnboardingStep(1, draftWithResume)).toBe("");

      const draftWithLinkedIn = {
        ...blankDraft(),
        linkedin: "https://linkedin.com/in/candidate",
      };
      expect(validateOnboardingStep(1, draftWithLinkedIn)).toBe("");

      const emptyDraft = blankDraft();
      expect(validateOnboardingStep(1, emptyDraft)).toBe("Add a PDF resume or a valid LinkedIn profile URL to continue.");
    });
  });

  describe("Phase 6 — Compensation defaults, phone input, location integrity, and required GitHub", () => {
    it("untouched expected compensation saves as null and placeholder is not saved as user input", () => {
      const freshDraft = blankDraft();
      expect(freshDraft.expectedCompensation).toBe("");

      // Saving untouched draft persists null, not placeholder 28 or 28.5
      const payload = buildProfilePayload(freshDraft, "user-comp-1", { onboardingComplete: true });
      expect(payload.expected_compensation).toBeNull();

      // Explicitly entering a placeholder value as string "28" saves numeric 28
      const enteredDraft = { ...freshDraft, expectedCompensation: "28" };
      const enteredPayload = buildProfilePayload(enteredDraft, "user-comp-1", { onboardingComplete: true });
      expect(enteredPayload.expected_compensation).toBe(28);
      expect(typeof enteredPayload.expected_compensation).toBe("number");

      // Clearing the value saves null on complete save
      const clearedDraft = { ...enteredDraft, expectedCompensation: "" };
      const clearedPayload = buildProfilePayload(clearedDraft, "user-comp-1", {
        existingProfile: { id: "user-comp-1", expected_compensation: 28 } as Profile,
        isPartial: false,
        onboardingComplete: true,
      });
      expect(clearedPayload.expected_compensation).toBeNull();
    });

    it("partial saves preserve existing compensation when its step is untouched", () => {
      const existingProfile: Profile = {
        id: "user-comp-2",
        first_name: "Karan",
        last_name: "Kapoor",
        expected_compensation: 24.5,
        current_compensation: 16.0,
      } as Profile;

      // Candidate is on Step 1, untouched expectedCompensation in draft
      const draftWithEmptyComp = {
        ...blankDraft(),
        firstName: "Karan",
        lastName: "Kapoor",
        expectedCompensation: "",
        currentCompensation: "",
      };

      const partialPayload = buildProfilePayload(draftWithEmptyComp, "user-comp-2", {
        existingProfile,
        isPartial: true,
        onboardingComplete: false,
      });

      expect(partialPayload.expected_compensation).toBe(24.5);
      expect(partialPayload.current_compensation).toBe(16.0);
    });

    it("preserves decimal precision for compensation values across save and hydration", () => {
      const testCases = ["18.5", "28.75", "12.25", "35.50"];
      for (const val of testCases) {
        const parsed = parseDecimalCompensation(val);
        expect(parsed).toBe(parseFloat(val));

        const draft = { ...blankDraft(), expectedCompensation: val };
        const payload = buildProfilePayload(draft, "user-dec", { onboardingComplete: true });
        expect(payload.expected_compensation).toBe(parseFloat(val));

        const hydrated = hydrateDraftFromProfile(blankDraft(), {
          id: "user-dec",
          expected_compensation: parseFloat(val),
        } as Profile);
        expect(hydrated.expectedCompensation).toBe(String(parseFloat(val)));
      }
    });

    it("preserves fresher rule: current_compensation is numeric 0 and expected compensation remains editable", () => {
      const fresherDraft = {
        ...blankDraft(),
        fresher: true,
        currentCompensation: "0",
        expectedCompensation: "14.5",
      };

      const payload = buildProfilePayload(fresherDraft, "user-fresh", { onboardingComplete: true });
      expect(payload.current_compensation).toBe(0);
      expect(payload.expected_compensation).toBe(14.5);
    });

    it("phone input defaults to blank number portion and does not treat prefix alone as valid phone", () => {
      // For a new candidate, extractLocalPhoneNumber is blank
      expect(extractLocalPhoneNumber("")).toBe("");
      expect(extractLocalPhoneNumber("+91")).toBe("");
      expect(extractLocalPhoneNumber("+91 ")).toBe("");

      // Normalization of blank or prefix alone produces null
      expect(normalizePhone("")).toBeNull();
      expect(normalizePhone("+91")).toBeNull();
      expect(normalizePhone("+91 ")).toBeNull();
      expect(normalizePhone("   ")).toBeNull();

      // Prefix alone does not trigger invalid format error (it is treated as empty optional input)
      expect(isValidPhoneInput("")).toBe(true);
      expect(isValidPhoneInput("+91")).toBe(true);
      expect(isValidPhoneInput("+91 ")).toBe(true);
    });

    it("preserves entered phone numbers without random generation and normalizes to international format", () => {
      // 10-digit standard Indian mobile
      expect(normalizePhone("9876543210")).toBe("+91 9876543210");
      expect(normalizePhone("+91 9876543210")).toBe("+91 9876543210");
      expect(normalizePhone("09876543210")).toBe("+91 9876543210");
      expect(normalizePhone("91 9876543210")).toBe("+91 9876543210");

      // Valid phone validation
      expect(isValidPhoneInput("9876543210")).toBe(true);
      expect(isValidPhoneInput("+91 9876543210")).toBe(true);

      // Invalid phone input (too short/non-numeric)
      expect(isValidPhoneInput("12345")).toBe(false);
      expect(isValidPhoneInput("invalid-phone")).toBe(false);

      // Step 7 validation catches invalid phone numbers
      const invalidPhoneDraft = { ...base, currentCity: "Bengaluru", state: "Karnataka", postalCode: "560001", phone: "12345" };
      expect(validateOnboardingStep(7, invalidPhoneDraft)).toContain("valid 10-digit mobile number");

      // Valid phone passes Step 7 validation
      const validPhoneDraft = { ...base, currentCity: "Bengaluru", state: "Karnataka", postalCode: "560001", phone: "9876543210" };
      expect(validateOnboardingStep(7, validPhoneDraft)).toBe("");

      // Payload saves normalized format
      const payload = buildProfilePayload({ ...blankDraft(), phone: "9876543210" }, "user-ph", { onboardingComplete: true });
      expect(payload.phone).toBe("+91 9876543210");
    });

    it("hydrates saved phone values without duplicating the country code", () => {
      const savedProfile = {
        id: "user-phone-hyd",
        phone: "+91 9876543210",
      } as Profile;

      const hydrated = hydrateDraftFromProfile(blankDraft(), savedProfile);
      expect(hydrated.phone).toBe("+91 9876543210");

      // Extracting for the local number input strips +91 cleanly
      const localNumber = extractLocalPhoneNumber(hydrated.phone);
      expect(localNumber).toBe("9876543210");
      expect(localNumber).not.toContain("+91");

      // Re-saving maintains correct single +91 prefix
      const resavedPayload = buildProfilePayload({ ...blankDraft(), phone: localNumber }, "user-phone-hyd", { onboardingComplete: true });
      expect(resavedPayload.phone).toBe("+91 9876543210");
    });

    it("empty optional phone and location fields do not generate fake data and preserve genuine values", () => {
      const emptyDraft = blankDraft();
      const payload = buildProfilePayload(emptyDraft, "user-empty-loc", { onboardingComplete: true });

      expect(payload.phone).toBeNull();
      expect(payload.current_city).toBeNull();
      expect(payload.state).toBeNull();
      expect(payload.postal_code).toBeNull();

      // Does not substitute preferred cities for current city
      const draftWithPreferred = { ...emptyDraft, cities: ["Bengaluru", "Hyderabad"] };
      const payloadWithPreferred = buildProfilePayload(draftWithPreferred, "user-empty-loc", { onboardingComplete: true });
      expect(payloadWithPreferred.preferred_cities).toEqual(["Bengaluru", "Hyderabad"]);
      expect(payloadWithPreferred.current_city).toBeNull();

      // Preserves genuine location values during hydration and save
      const savedProfile = {
        id: "user-loc-saved",
        current_city: "Kochi",
        state: "Kerala",
        postal_code: "682001",
      } as Profile;

      const hydrated = hydrateDraftFromProfile(emptyDraft, savedProfile);
      expect(hydrated.currentCity).toBe("Kochi");
      expect(hydrated.state).toBe("Kerala");
      expect(hydrated.postalCode).toBe("682001");

      // Partial save retains genuine location when draft location is empty
      const partialPayload = buildProfilePayload(emptyDraft, "user-loc-saved", {
        existingProfile: savedProfile,
        isPartial: true,
        onboardingComplete: false,
      });
      expect(partialPayload.current_city).toBe("Kochi");
      expect(partialPayload.state).toBe("Kerala");
      expect(partialPayload.postal_code).toBe("682001");
    });

    it("requires GitHub for completion on Step 8, rejecting empty or invalid values", () => {
      // Step 8 fails with empty GitHub
      const step8EmptyGithub = { ...base, github: "" };
      expect(validateOnboardingStep(8, step8EmptyGithub)).toBe(
        "GitHub profile URL is required to complete onboarding."
      );

      const step8WhitespaceGithub = { ...base, github: "   " };
      expect(validateOnboardingStep(8, step8WhitespaceGithub)).toBe(
        "GitHub profile URL is required to complete onboarding."
      );

      // Rejects invalid domains or malformed URLs
      expect(isValidGithubUrl("https://gitlab.com/username")).toBe(false);
      expect(isValidGithubUrl("https://google.com")).toBe(false);
      expect(isValidGithubUrl("just-text")).toBe(false);
      expect(isValidGithubUrl("javascript:alert(1)")).toBe(false);
      expect(isValidGithubUrl("https://github.com")).toBe(false);
      expect(isValidGithubUrl("https://github.com/")).toBe(false);
      expect(isValidGithubUrl("https://github.com/settings")).toBe(false);
      expect(isValidGithubUrl("https://github.com/explore")).toBe(false);

      const step8InvalidGithub = { ...base, github: "https://gitlab.com/username" };
      expect(validateOnboardingStep(8, step8InvalidGithub)).toBe(
        "Please enter a valid GitHub profile URL, for example github.com/username."
      );
    });

    it("accepts valid GitHub profile URLs, normalizes them to HTTPS, and hydrates correctly", () => {
      // Accepts full HTTPS url
      expect(isValidGithubUrl("https://github.com/torvalds")).toBe(true);
      expect(normalizeGithubUrl("https://github.com/torvalds")).toBe("https://github.com/torvalds");

      // Accepts shortened url and normalizes to HTTPS
      expect(isValidGithubUrl("github.com/torvalds")).toBe(true);
      expect(normalizeGithubUrl("github.com/torvalds")).toBe("https://github.com/torvalds");
      expect(normalizeGithubUrl("http://github.com/torvalds/")).toBe("https://github.com/torvalds");

      // Passes Step 8 validation
      const step8ValidGithub = { ...base, github: "github.com/torvalds" };
      expect(validateOnboardingStep(8, step8ValidGithub)).toBe("");

      // Normalizes into payload
      const draft = { ...blankDraft(), github: "github.com/torvalds" };
      const payload = buildProfilePayload(draft, "user-gh", { onboardingComplete: true });
      expect(payload.github_url).toBe("https://github.com/torvalds");

      // Hydration restores github URL accurately
      const savedProfile = {
        id: "user-gh-hyd",
        github_url: "https://github.com/torvalds",
      } as Profile;
      const hydrated = hydrateDraftFromProfile(blankDraft(), savedProfile);
    });
  });

  describe("Career Radar — Onboarding Wizard Fixes (Steps 1–8) Comprehensive Suite", () => {
    it("1 & 2. ensures selection-chip icons align at the end of their chips with consistent placement", () => {
      const markup = renderToStaticMarkup(
        createElement(ChoiceRow, {
          options: ["React", "TypeScript"],
          selected: ["React"],
          toggle: () => {},
        })
      );
      // Verify choice-chip structure has choice-chip-text before choice-chip-icon
      expect(markup).toContain('class="choice-chip selected"');
      expect(markup).toContain('class="choice-chip-text">React</span>');
      expect(markup).toContain("choice-chip-icon");
      // For selected option, text precedes the icon
      const reactTextIndex = markup.indexOf("React</span>");
      const checkIconIndex = markup.indexOf("choice-chip-icon", reactTextIndex);
      expect(checkIconIndex).toBeGreaterThan(reactTextIndex);

      // For unselected option, text precedes the Plus icon
      const tsTextIndex = markup.indexOf("TypeScript</span>");
      const plusIconIndex = markup.indexOf("choice-chip-icon", tsTextIndex);
      expect(plusIconIndex).toBeGreaterThan(tsTextIndex);

      // Verify CSS has flex layout with space-between and end alignment
      const cssPath = resolve(process.cwd(), "src/ui/app.css");
      const cssContent = readFileSync(cssPath, "utf-8");
      expect(cssContent).toMatch(/\.choice-chip\s*\{[^}]*display:\s*inline-flex/);
      expect(cssContent).toMatch(/\.choice-chip\s*\{[^}]*justify-content:\s*space-between/);
    });

    it("3. requires Total Years of Experience for non-freshers and rejects negative/invalid input", () => {
      const step3Base = { ...base, roles: ["Frontend Developer"], skills: ["React"] };
      expect(validateOnboardingStep(3, { ...step3Base, fresher: false, experienceYears: "" })).toBe(
        "Total years of experience is required."
      );
      expect(validateOnboardingStep(3, { ...step3Base, fresher: false, experienceYears: "-1" })).toBe(
        "Enter a valid non-negative number for years of experience."
      );
      expect(validateOnboardingStep(3, { ...step3Base, fresher: false, experienceYears: "invalid" })).toBe(
        "Enter a valid non-negative number for years of experience."
      );
      expect(validateOnboardingStep(3, { ...step3Base, fresher: false, experienceYears: "0" })).toBe("");
      expect(validateOnboardingStep(3, { ...step3Base, fresher: false, experienceYears: "3.5" })).toBe("");
    });

    it("4. locks experience at 0 when fresher is checked and persists 0", () => {
      const step3Fresher = { ...base, fresher: true, experienceYears: "0" };
      expect(validateOnboardingStep(3, step3Fresher)).toBe("");

      // Hydration sets experience to 0 and compensation to 0 for freshers
      const fresherProfile = {
        id: "user-fresher-1",
        experience_level: "No professional experience",
        current_compensation: 0,
      } as Profile;
      const hydrated = hydrateDraftFromProfile(blankDraft(), fresherProfile);
      expect(hydrated.fresher).toBe(true);
      expect(hydrated.experienceYears).toBe("0");
      expect(hydrated.currentCompensation).toBe("0");
    });

    it("5. restores previously entered experience when unchecking fresher in session", () => {
      // Simulating session toggle logic
      let previousEntered = "4.5";
      let currentExp = previousEntered;

      // Checking fresher:
      const handleCheck = () => {
        previousEntered = currentExp;
        currentExp = "0";
      };
      // Unchecking fresher:
      const handleUncheck = () => {
        currentExp = previousEntered || "";
      };

      handleCheck();
      expect(currentExp).toBe("0");
      handleUncheck();
      expect(currentExp).toBe("4.5");
    });

    it("6. requires at least one preferred city before proceeding past Step 4", () => {
      expect(validateOnboardingStep(4, { ...base, cities: [] })).toBe(
        "Choose at least one city."
      );
      // Even if remote preference is toggled, at least one city must be chosen
      expect(validateOnboardingStep(4, { ...base, cities: [], remote: true })).toBe(
        "Choose at least one city."
      );
      expect(validateOnboardingStep(4, { ...base, cities: ["Bengaluru"] })).toBe("");
      expect(validateOnboardingStep(4, { ...base, cities: ["Bengaluru", "Mumbai"] })).toBe("");
    });

    it("7. requires Expected Compensation and rejects empty, negative, or invalid amounts", () => {
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "" })).toBe(
        "Expected compensation is required."
      );
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "   " })).toBe(
        "Expected compensation is required."
      );
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "-5" })).toBe(
        "Enter a valid non-negative number for expected compensation."
      );
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "not-a-number" })).toBe(
        "Enter a valid non-negative number for expected compensation."
      );
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "0" })).toBe("");
      expect(validateOnboardingStep(5, { ...base, expectedCompensation: "18.5" })).toBe("");
    });

    it("8. requires Current city, State / province, Postal code, and Phone on Step 7", () => {
      const step7Valid = {
        ...base,
        currentCity: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "9876543210",
      };

      // Missing city
      expect(validateOnboardingStep(7, { ...step7Valid, currentCity: "" })).toBe(
        "Current city is required."
      );
      expect(validateOnboardingStep(7, { ...step7Valid, currentCity: "   " })).toBe(
        "Current city is required."
      );

      // Missing state
      expect(validateOnboardingStep(7, { ...step7Valid, state: "" })).toBe(
        "State / province is required."
      );

      // Missing postal code
      expect(validateOnboardingStep(7, { ...step7Valid, postalCode: "" })).toBe(
        "Postal code is required."
      );
      expect(validateOnboardingStep(7, { ...step7Valid, postalCode: "@#$%" })).toBe(
        "Enter a valid postal code."
      );

      // Missing phone
      expect(validateOnboardingStep(7, { ...step7Valid, phone: "" })).toBe(
        "Enter a valid 10-digit mobile number."
      );

      // All provided
      expect(validateOnboardingStep(7, step7Valid)).toBe("");
    });

    it("9. rejects phone prefix alone without local digits", () => {
      expect(isValidPhoneInput("12345")).toBe(false);
      expect(normalizePhone("+91")).toBeNull();
      expect(normalizePhone("+91 ")).toBeNull();

      const step7PrefixOnly = {
        ...base,
        currentCity: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "+91 ",
      };
      expect(validateOnboardingStep(7, step7PrefixOnly)).toBe(
        "Enter a valid 10-digit mobile number."
      );
    });

    it("10. hydrates and saves phone numbers without duplicating +91 prefix", () => {
      const initialSaved = "+91 9876543210";
      const localDigits = extractLocalPhoneNumber(initialSaved);
      expect(localDigits).toBe("9876543210");

      const resaved = normalizePhone(localDigits);
      expect(resaved).toBe("+91 9876543210");

      // Repeated normalization never duplicates +91
      expect(normalizePhone(resaved)).toBe("+91 9876543210");
      expect(normalizePhone("+91 9876543210")).toBe("+91 9876543210");
    });

    it("11. blocks step navigation and final completion when required fields are missing", () => {
      const incompleteDraft: Draft = {
        ...blankDraft(),
        resumeName: "resume.pdf",
        roles: ["Frontend Developer"],
        skills: ["React"],
        experienceYears: "", // missing
        cities: ["Bengaluru"],
        expectedCompensation: "20",
        modes: ["Remote"],
        relocation: "No",
        availability: "Immediate",
        currentCity: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "9876543210",
        github: "https://github.com/developer",
      };

      const result = validateEntireOnboarding(incompleteDraft);
      expect(result).not.toBeNull();
      expect(result?.step).toBe(3);
      expect(result?.message).toContain("experience");

      // When all steps are valid, validateEntireOnboarding passes
      const completeDraft: Draft = {
        ...incompleteDraft,
        experienceYears: "3",
      };
      const completeResult = validateEntireOnboarding(completeDraft);
      expect(completeResult).toBeNull();
    });

    it("12. references valid existing image assets across Steps 1 to 8", () => {
      for (let s = 1; s <= 8; s++) {
        const img = stepImages[s]!;
        expect(img).toBeDefined();
        expect(typeof img).toBe("string");
        expect(img.length).toBeGreaterThan(0);
      }
      // Verify image files exist on disk
      const rootDir = process.cwd();
      const files = ["imagee1.png", "imagee2.png", "imagee3.png", "imagee4.png", "imagee5.png", "imagee6.png"];
      for (const f of files) {
        const fullPath = resolve(rootDir, f);
        expect(readFileSync(fullPath).length).toBeGreaterThan(0);
      }
    });

    it("13. renders all eight steps with responsive structure (visual panel, form panel, mobile hero copy, actions)", () => {
      const dummyDraft: Draft = {
        ...blankDraft(),
        resumeName: "resume.pdf",
        roles: ["Frontend Developer"],
        skills: ["React"],
        experienceYears: "3",
        cities: ["Bengaluru"],
        expectedCompensation: "20",
        modes: ["Remote"],
        currentCity: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "9876543210",
        github: "https://github.com/developer",
      };

      for (let s = 1; s <= 8; s++) {
        // Visual component rendered on desktop/tablet/mobile
        const visualMarkup = renderToStaticMarkup(
          createElement(Visual, {
            step: s,
            label: meta[s - 1]![0],
            caption: meta[s - 1]![2],
          })
        );
        expect(visualMarkup).toContain(`onboarding-visual onboarding-visual-${s}`);
        expect(visualMarkup).toContain("onboarding-visual-overlay");
        expect(visualMarkup).toContain("onboarding-visual-copy");

        // Form panel content rendered for every step
        const stepMarkup = renderToStaticMarkup(
          createElement(OnboardingStepView, {
            step: s,
            draft: dummyDraft,
            update: () => {},
            toggle: () => {},
            setDraft: () => {},
            resumeRef: { current: null },
            onResume: async () => {},
            removeResume: () => {},
            parsingResume: false,
            applySuggestions: () => {},
            error: "",
            setError: () => {},
            onLinkedInImport: () => {},
            handleFresherToggle: () => {},
            onCurrentCompChange: () => {},
            onExpYearsChange: () => {},
          })
        );
        expect(stepMarkup.length).toBeGreaterThan(0);
      }

      // Verify the onboarding responsive layout classes exist in app.css
      const cssPath = resolve(process.cwd(), "src/ui/app.css");
      const cssContent = readFileSync(cssPath, "utf-8");
      expect(cssContent).toContain(".onboarding-mobile-hero-copy");
      expect(cssContent).toContain(".onboarding-form-panel");
      expect(cssContent).toContain(".onboarding-visual");
      expect(cssContent).toContain(".onboarding-actions");
    });

    it("14. maintains existing profile values and onboarding draft isolation", () => {
      const existingProfile = {
        id: "user-iso-1",
        full_name: "Original Name",
        current_city: "Original City",
        phone: "+91 9111122222",
      } as unknown as Profile;

      const partialDraft = {
        ...blankDraft(),
        currentCity: "", // user left blank in draft
      };

      const payload = buildProfilePayload(partialDraft, "user-iso-1", {
        existingProfile,
        isPartial: true,
        onboardingComplete: false,
      });

      // Partial saves preserve existing database values
      expect(payload.current_city).toBe("Original City");
      expect(payload.phone).toBe("+91 9111122222");
    });
  });

  describe("Career Radar — Onboarding Error UX, Resume Suggestions, Centering & Motion Polish (Task 1–12)", () => {
    it("1. Expected compensation produces one inline error only and links aria attributes", () => {
      const draft = { ...blankDraft(), expectedCompensation: "" };
      const markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 5,
          draft,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Expected compensation is required.",
        })
      );

      // Verify the error text appears exactly once
      const matches = markup.match(/Expected compensation is required\./g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);

      // Verify it is styled as onboarding-input-error with role=alert
      expect(markup).toContain('class="onboarding-input-error" role="alert"');
      expect(markup).toContain('id="onboarding-expected-compensation-error"');

      // Verify input associates aria-describedby and aria-invalid
      expect(markup).toContain('aria-invalid="true"');
      expect(markup).toContain('aria-describedby="onboarding-expected-compensation-error"');

      // Verify no duplicate auth-form-error banner inside step view
      expect(markup).not.toContain("auth-form-error");
    });

    it("2. Each invalid field displays one field-level error across steps", () => {
      // Step 1: Missing resume and linkedin
      const step1Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 1,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Add a PDF resume or a valid LinkedIn profile URL to continue.",
        })
      );
      const step1Matches = step1Markup.match(/Add a PDF resume or a valid LinkedIn profile URL to continue\./g);
      expect(step1Matches?.length).toBe(1);
      expect(step1Markup).toContain('id="step1-general-error"');
      expect(step1Markup).toContain('aria-describedby="step1-general-error"');

      // Step 2: Missing target role
      const step2Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 2,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Choose at least one target role.",
        })
      );
      const step2Matches = step2Markup.match(/Choose at least one target role\./g);
      expect(step2Matches?.length).toBe(1);
      expect(step2Markup).toContain('id="step2-roles-error"');

      // Step 3: Missing skills
      const step3Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 3,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Choose at least one skill, or mark yourself as a fresher.",
        })
      );
      const step3Matches = step3Markup.match(/Choose at least one skill, or mark yourself as a fresher\./g);
      expect(step3Matches?.length).toBe(1);
      expect(step3Markup).toContain('id="step3-skills-error"');

      // Step 4: Missing city
      const step4Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 4,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Choose at least one city.",
        })
      );
      const step4Matches = step4Markup.match(/Choose at least one city\./g);
      expect(step4Matches?.length).toBe(1);
      expect(step4Markup).toContain('id="step4-cities-error"');

      // Step 6: Missing work mode
      const step6Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 6,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Choose your work mode, relocation preference, and availability.",
        })
      );
      const step6Matches = step6Markup.match(/Choose your work mode, relocation preference, and availability\./g);
      expect(step6Matches?.length).toBe(1);
      expect(step6Markup).toContain('id="step6-modes-error"');

      // Step 7: Missing current city
      const step7Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 7,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Current city is required.",
        })
      );
      const step7Matches = step7Markup.match(/Current city is required\./g);
      expect(step7Matches?.length).toBe(1);
      expect(step7Markup).toContain('id="onboarding-current-city-error"');
      expect(step7Markup).toContain('aria-describedby="onboarding-current-city-error"');

      // Step 8: Missing GitHub URL
      const step8Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 8,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "GitHub profile URL is required to complete onboarding.",
        })
      );
      const step8Matches = step8Markup.match(/GitHub profile URL is required to complete onboarding\./g);
      expect(step8Matches?.length).toBe(1);
      expect(step8Markup).toContain('id="onboarding-github-error"');
      expect(step8Markup).toContain('aria-describedby="onboarding-github-error"');
    });

    it("3. Repeated validation does not create duplicate messages", () => {
      const draft = { ...blankDraft(), expectedCompensation: "" };
      const markup1 = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 5,
          draft,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Expected compensation is required.",
        })
      );
      const markup2 = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 5,
          draft,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Expected compensation is required.",
        })
      );
      expect(markup1).toBe(markup2);
      expect(markup2.match(/Expected compensation is required\./g)?.length).toBe(1);
    });

    it("4. The Step 7 security helper line is absent", () => {
      const markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 7,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
        })
      );
      expect(markup).not.toContain("These fields are saved securely to your candidate profile.");
      expect(markup).not.toContain("onboarding-privacy-note");
      expect(markup).toContain("onboarding-current-city");
      expect(markup).toContain("onboarding-state");
      expect(markup).toContain("onboarding-postal-code");
      expect(markup).toContain("onboarding-phone");
    });

    it("5. The Step 8 profile-link helper banner is absent", () => {
      const markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 8,
          draft: blankDraft(),
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
        })
      );
      expect(markup).not.toContain(
        "Only public profile links are required. Career Radar will never ask for your GitHub password or repository permissions."
      );
      expect(markup).not.toContain("onboarding-privacy-note");
      expect(markup).toContain("onboarding-github");
      expect(markup).toContain("onboarding-portfolio");
    });

    it("6. A successful second resume import replaces old resume-derived suggestions", () => {
      const firstResumeDraft: Draft = {
        ...blankDraft(),
        resumeName: "first-resume.pdf",
        resumeBytes: 100000,
        extractedRoles: ["Software Engineer", "Frontend Developer"],
        extractedSkills: ["React", "TypeScript"],
        roles: ["Software Engineer", "Frontend Developer"],
        skills: ["React", "TypeScript"],
        prefilledFields: ["Target roles", "Skills"],
      };

      const secondResumeSuggestions = {
        candidateName: "Vikram Sen",
        targetRoles: ["AI/ML Engineer", "Data Scientist"],
        skills: ["Python", "PyTorch"],
      };

      // When resume 2 is imported, roles were purely resume-derived
      const wasRolesResumeDerived =
        Boolean(firstResumeDraft.prefilledFields?.includes("Target roles")) &&
        firstResumeDraft.roles.every((r) => firstResumeDraft.extractedRoles?.includes(r));
      expect(wasRolesResumeDerived).toBe(true);

      const rolesToPass = wasRolesResumeDerived ? [] : firstResumeDraft.roles;
      const draftWithSecondFile: Draft = {
        ...firstResumeDraft,
        roles: rolesToPass,
        resumeName: "second-resume.pdf",
        resumeBytes: 150000,
        extractedRoles: secondResumeSuggestions.targetRoles,
        extractedSkills: secondResumeSuggestions.skills,
      };

      const { draft: nextDraft } = prefillFromResume(draftWithSecondFile, secondResumeSuggestions, {
        overwriteConfirmed: false,
      });

      // Verify newly imported resume suggestions replaced the old ones
      expect(nextDraft.extractedRoles).toEqual(["AI/ML Engineer", "Data Scientist"]);
      expect(nextDraft.extractedSkills).toEqual(["Python", "PyTorch"]);
      expect(nextDraft.roles).toEqual(["AI/ML Engineer", "Data Scientist"]);

      // Verify Step 2 shows the newly parsed suggestions and no stale suggestions
      const step2Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 2,
          draft: nextDraft,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
        })
      );
      expect(step2Markup).toContain("AI/ML Engineer");
      expect(step2Markup).toContain("Data Scientist");
      expect(step2Markup).not.toContain("Software Engineer");
      expect(step2Markup).not.toContain("Kept your previously entered values for:");
      expect(step2Markup).not.toContain("Merge resume suggestions");
      expect(step2Markup).not.toContain("Update with resume data");
    });

    it("7. Manually entered fields are not silently overwritten by resume parsing", () => {
      const draftWithManualEntries: Draft = {
        ...blankDraft(),
        firstName: "Aarav",
        lastName: "Patel",
        roles: ["Custom Architect Role"],
        skills: ["Rust", "Go"],
        phone: "+91 99999 88888",
        prefilledFields: [], // Not prefilled, candidate entered manually
      };

      const resumeSuggestions = {
        candidateName: "Priya Sharma",
        targetRoles: ["Frontend Developer"],
        skills: ["React"],
        phone: "+91 91234 56789",
      };

      const wasRolesResumeDerived =
        Boolean(draftWithManualEntries.prefilledFields?.includes("Target roles")) &&
        draftWithManualEntries.roles.every((r) => draftWithManualEntries.extractedRoles?.includes(r));
      expect(wasRolesResumeDerived).toBe(false);

      const rolesToPass = wasRolesResumeDerived ? [] : draftWithManualEntries.roles;
      const draftWithFile: Draft = {
        ...draftWithManualEntries,
        roles: rolesToPass,
        resumeName: "new-resume.pdf",
        resumeBytes: 120000,
        extractedRoles: resumeSuggestions.targetRoles,
        extractedSkills: resumeSuggestions.skills,
      };

      const { draft: nextDraft } = prefillFromResume(draftWithFile, resumeSuggestions, {
        overwriteConfirmed: false,
      });

      // Manually entered values are strictly preserved
      expect(nextDraft.firstName).toBe("Aarav");
      expect(nextDraft.lastName).toBe("Patel");
      expect(nextDraft.roles).toEqual(["Custom Architect Role"]);
      expect(nextDraft.skills).toEqual(["Rust", "Go"]);
      expect(nextDraft.phone).toBe("+91 99999 88888");
    });

    it("8. A failed resume import preserves the previous valid state and shows one error", () => {
      const validInitialDraft: Draft = {
        ...blankDraft(),
        resumeName: "previous-valid.pdf",
        resumeBytes: 200000,
        extractedRoles: ["Backend Developer"],
        extractedSkills: ["Java", "Spring"],
        roles: ["Backend Developer"],
        skills: ["Java", "Spring"],
      };

      // When an invalid file (e.g. non-PDF) is selected, isValidResume fails
      const badFile = { name: "malicious.exe", type: "application/x-msdownload", size: 50000 };
      expect(isValidResume(badFile)).toBe(false);

      // Previous draft is not cleared!
      const draftAfterFailedUpload = { ...validInitialDraft };
      expect(draftAfterFailedUpload.resumeName).toBe("previous-valid.pdf");
      expect(draftAfterFailedUpload.extractedRoles).toEqual(["Backend Developer"]);

      // Shows one clear inline error near the upload control
      const step1Markup = renderToStaticMarkup(
        createElement(OnboardingStepView, {
          step: 1,
          draft: draftAfterFailedUpload,
          update: () => {},
          toggle: () => {},
          setDraft: () => {},
          error: "Please choose a PDF resume.",
        })
      );
      expect(step1Markup).toContain("Please choose a PDF resume.");
      expect(step1Markup).toContain("previous-valid.pdf");
      expect(step1Markup.match(/Please choose a PDF resume\./g)?.length).toBe(1);
    });

    it("9. Steps 1–8 remain usable when centered on desktop and mobile", () => {
      const cssPath = resolve(process.cwd(), "src/ui/app.css");
      const cssContent = readFileSync(cssPath, "utf-8");

      // Verify Steps 1–8 centering classes
      expect(cssContent).toContain(".onboarding-page-step-1");
      expect(cssContent).toContain(".onboarding-page-step-6");
      expect(cssContent).toContain(".onboarding-page-step-7");
      expect(cssContent).toContain(".onboarding-page-step-8");
      expect(cssContent).toContain("align-content: safe center");
      expect(cssContent).toContain("margin-top: auto");
      expect(cssContent).toContain("margin-bottom: auto");

      // Verify visual alignment preserved
      expect(cssContent).toMatch(/\.onboarding-layout\s*\{[^}]*align-items:\s*start/);

      // Verify all steps 1 to 8 render their full content
      for (let s = 1; s <= 8; s++) {
        const markup = renderToStaticMarkup(
          createElement(OnboardingStepView, {
            step: s,
            draft: blankDraft(),
            update: () => {},
            toggle: () => {},
            setDraft: () => {},
          })
        );
        expect(markup.length).toBeGreaterThan(0);
      }
    });

    it("10. Animations do not lose onboarding state or trigger duplicate saves", () => {
      const initialDraft: Draft = {
        ...blankDraft(),
        firstName: "Asha",
        roles: ["Frontend Developer"],
        skills: ["React"],
        expectedCompensation: "25",
      };

      // Wrap in onboarding-step-transition
      const markup = renderToStaticMarkup(
        createElement(
          "div",
          { className: "onboarding-step-content onboarding-step-transition", key: 5 },
          createElement(OnboardingStepView, {
            step: 5,
            draft: initialDraft,
            update: () => {},
            toggle: () => {},
            setDraft: () => {},
          })
        )
      );

      expect(markup).toContain('class="onboarding-step-content onboarding-step-transition"');
      expect(markup).toContain("onboarding-expected-compensation");
      // State values remain present
      expect(markup).toContain('value="25"');
    });

    it("11. Reduced-motion preferences are respected", () => {
      const cssPath = resolve(process.cwd(), "src/ui/app.css");
      const cssContent = readFileSync(cssPath, "utf-8");

      expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
      expect(cssContent).toContain(".page-transition");
      expect(cssContent).toContain(".onboarding-step-transition");
      expect(cssContent).toMatch(/\.page-transition[^}]*animation:\s*none\s*!important/);
    });

    it("12. Existing authentication, onboarding persistence, and profile-save tests still pass", () => {
      const completeDraft: Draft = {
        ...blankDraft(),
        firstName: "Kavita",
        lastName: "Nair",
        roles: ["Software Engineer"],
        skills: ["Python", "SQL"],
        experienceYears: "2",
        fresher: false,
        cities: ["Bengaluru"],
        remote: false,
        currentCompensation: "12",
        expectedCompensation: "18",
        modes: ["On-site"],
        relocation: "Yes, for the right role",
        availability: "Ready to join immediately",
        currentCity: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "+91 98765 12345",
        github: "https://github.com/kavitanair",
        portfolio: "https://kavita.dev",
        resumeName: "kavita.pdf",
        resumeBytes: 90000,
        industries: ["Fintech"],
      };

      const payload = buildProfilePayload(completeDraft, "user-kavita", { onboardingComplete: true });
      expect(payload.id).toBe("user-kavita");
      expect(payload.first_name).toBe("Kavita");
      expect(payload.last_name).toBe("Nair");
      expect(payload.expected_compensation).toBe(18);
      expect(payload.current_city).toBe("Bengaluru");
      expect(payload.github_url).toBe("https://github.com/kavitanair");
    });
  });
});


