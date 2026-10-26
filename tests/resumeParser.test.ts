import { describe, expect, it } from "vitest";
import { isValidResume, MAX_RESUME_BYTES, prefillFromResume } from "../src/services/onboarding.js";
import {
  extractResume,
  parseResumeText,
  splitCandidateName,
  detectSectionHeading,
  splitIntoSections,
  SKILL_ALIASES,
  CANONICAL_ROLES,
} from "../src/services/resumeParser.js";

describe("resume parser", () => {
  const resume = `Asha Rao
asha.rao@example.com | +91 98765 43210
linkedin.com/in/asharao github.com/asharao https://asharao.dev

Experience
Software Engineer
Acme Labs
Jan 2021 - Mar 2024

Frontend Developer
Beta Technologies
Jun 2019 - Dec 2020

Education
B.Tech in Computer Science
National Institute of Technology

Skills: Python, React, SQL, TypeScript, C++, Node.js, Docker, Kubernetes, CI/CD`;

  it("extracts supported contact, URL, skill, education, role and experience suggestions", () => {
    const result = parseResumeText(resume, new Date("2026-01-01"));
    expect(result.candidateName).toBe("Asha Rao");
    expect(result.email).toBe("asha.rao@example.com");
    expect(result.phone).toContain("+91 98765 43210");
    expect(result.linkedin).toContain("linkedin.com/in/asharao");
    expect(result.github).toContain("github.com/asharao");
    expect(result.portfolio).toBe("https://asharao.dev");
    expect(result.skills).toEqual(
      expect.arrayContaining(["Python", "React", "SQL", "TypeScript", "C++", "Node.js", "Docker", "Kubernetes", "CI/CD"])
    );
    expect(result.education[0]?.qualification).toContain("B.Tech");
    expect(result.education[0]?.institution).toContain("National Institute of Technology");
    expect(result.experience.length).toBeGreaterThanOrEqual(2);
    expect(result.experience[0]?.title).toBe("Software Engineer");
    expect(result.experience[0]?.company).toBe("Acme Labs");
    // Non-overlapping experience: Jun 2019 - Dec 2020 (19 mos) + Jan 2021 - Mar 2024 (39 mos) = 56 mos = 4.7 yrs
    expect(result.totalExperienceYears).toBe(4.7);
    expect(result.targetRoles).toEqual(expect.arrayContaining(["Software Engineer", "Frontend Developer"]));
  });

  it("handles symbolic and punctuated skills accurately without false positives", () => {
    const text = `Skills: C++, C#, .NET, Node.js, CI/CD, React, TypeScript.
Hobbies: I like to go for walks and read.`;
    const result = parseResumeText(text);
    expect(result.skills).toContain("C++");
    expect(result.skills).toContain("C#");
    expect(result.skills).toContain("Node.js");
    expect(result.skills).toContain("CI/CD");
    expect(result.skills).toContain("React");
    expect(result.skills).toContain("TypeScript");
    // Should NOT match "Go" simply because the word "go" appeared as an English verb
    expect(result.skills).not.toContain("Go");
  });

  it("strictly distinguishes phone numbers from date ranges", () => {
    const textWithoutPhone = `John Doe
johndoe@example.com
Software Engineer (2021 - 2024)
Previous: 2018 - 2021`;
    const result = parseResumeText(textWithoutPhone);
    expect(result.phone).toBeUndefined();

    const textWithPhone = `John Doe
+91 91234 56789 | johndoe@example.com
Software Engineer: 2021 - 2024`;
    const resultWithPhone = parseResumeText(textWithPhone);
    expect(resultWithPhone.phone).toBe("+91 91234 56789");
  });

  it("stays conservative when there is no recognizable data", () => {
    const result = parseResumeText("A short note with no contact details or work history.");
    expect(result.candidateName).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.experience).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.education).toEqual([]);
    expect(result.totalExperienceYears).toBeUndefined();
  });

  it("does not mistake headers or titles for candidate names", () => {
    const headerResume = `CURRICULUM VITAE
SOFTWARE ENGINEER
contact@example.com | +91 9876543210
Skills: Python, SQL`;
    const result = parseResumeText(headerResume);
    expect(result.candidateName).toBeUndefined();
  });

  it("splits a confident name without inventing missing parts", () => {
    expect(splitCandidateName("Asha Rao")).toEqual({ firstName: "Asha", lastName: "Rao" });
    expect(splitCandidateName("Priya M. Sharma")).toEqual({ firstName: "Priya", lastName: "M. Sharma" });
    expect(splitCandidateName(undefined)).toEqual({ firstName: "", lastName: "" });
    expect(splitCandidateName("")).toEqual({ firstName: "", lastName: "" });
  });

  it("calculates non-overlapping experience and handles Present/Current dates", () => {
    const resumeWithOverlap = `Jane Doe
jane@example.com | 9876543210

Experience
Software Engineer
Acme Corp
Jan 2022 - Present

Consultant
Beta Corp
Jun 2022 - Dec 2022`;
    const now = new Date("2024-01-01");
    const result = parseResumeText(resumeWithOverlap, now);
    // Jan 2022 to Jan 2024 = 24 months = 2.0 years (Beta Corp is fully inside Acme range)
    expect(result.totalExperienceYears).toBe(2.0);
  });

  it("maps detected experience to canonical Career Radar roles", () => {
    const text = `Experience
Frontend Engineer at Acme Labs
Jan 2020 - Dec 2022
Machine Learning Researcher at Beta AI
Jan 2023 - Present`;
    const result = parseResumeText(text, new Date("2024-01-01"));
    expect(result.targetRoles).toContain("Frontend Developer");
    expect(result.targetRoles).toContain("AI/ML Engineer");
  });

  it("keeps PDF validation at the existing 5 MB boundary", () => {
    expect(isValidResume({ name: "resume.pdf", type: "application/pdf", size: MAX_RESUME_BYTES })).toBe(true);
    expect(isValidResume({ name: "resume.pdf", type: "application/pdf", size: MAX_RESUME_BYTES + 1 })).toBe(false);
    expect(isValidResume({ name: "resume.docx", type: "application/pdf", size: 10 })).toBe(false);
    expect(isValidResume({ name: "resume.txt", type: "text/plain", size: 10 })).toBe(false);
  });

  it("returns a user-safe error for malformed PDF bytes", async () => {
    const result = await extractResume(
      new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })
    );
    expect(result.status).toBe("error");
    expect(result.status === "error" ? result.message : "").toContain("couldn't read that PDF");
  });

  it("rejects non-PDF files cleanly in extractResume", async () => {
    const result = await extractResume(
      new File([new Uint8Array([1, 2, 3])], "resume.png", { type: "image/png" })
    );
    expect(result.status).toBe("error");
    expect(result.status === "error" ? result.message : "").toContain("PDF resume");
  });

  it("rejects files larger than 5 MB in extractResume", async () => {
    const largeBytes = new Uint8Array(MAX_RESUME_BYTES + 10);
    const result = await extractResume(
      new File([largeBytes], "huge.pdf", { type: "application/pdf" })
    );
    expect(result.status).toBe("error");
    expect(result.status === "error" ? result.message : "").toContain("5 MB");
  });

  describe("section-aware parsing and regression tests", () => {
    const syntheticResume = `Rohan Mehta
rohan.mehta@example.com | +91 98765 12345
Bengaluru, India | linkedin.com/in/rohanmehta | github.com/rohanmehta | https://rohanmehta.dev

Professional Summary
Experienced full-stack engineer building high-concurrency cloud services with React, TypeScript, and Go.

Technical Skills
JavaScript, TypeScript, React, Node.js, Python, Docker, PostgreSQL, CI/CD, AWS

Work Experience
Full-Stack Developer
TechNova Solutions
Feb 2023 – Present
- Architected microservices serving 100k daily active users.
- Automated deployment pipelines on AWS with Docker.

Software Engineer
InfraSoft Systems
Jan 2021 – Dec 2022
- Maintained backend REST APIs in Node.js and TypeScript.
- Optimized PostgreSQL database queries by 40%.

Projects
Cloud Task Tracker | React, Node.js
Jan 2023 – Mar 2023
- Built an open-source real-time task manager.

AI Chat Assistant | Python, FastAPI
Jun 2022 – Aug 2022
- Created an intelligent agent using embeddings and FastAPI.

Education
Bachelor of Technology in Computer Science
National Institute of Technology Karnataka
2017 – 2021
CGPA: 8.8 / 10

Certifications & Achievements
AWS Certified Solutions Architect
Winner, National Hackathon 2022`;

    it("extracts synthetic resume fields correctly with strict section boundaries", () => {
      // Evaluate with a fixed now date: 2024-02-01 (12 months from Feb 2023)
      const now = new Date("2024-02-01");
      const result = parseResumeText(syntheticResume, now);

      // 1. Name & Contact
      expect(result.candidateName).toBe("Rohan Mehta");
      expect(result.email).toBe("rohan.mehta@example.com");
      expect(result.phone).toBe("+91 98765 12345");
      expect(result.linkedin).toContain("linkedin.com/in/rohanmehta");
      expect(result.github).toContain("github.com/rohanmehta");
      expect(result.portfolio).toBe("https://rohanmehta.dev");

      // 2. Experience detected
      expect(result.experience.length).toBe(2);
      expect(result.experience[0]?.title).toBe("Full-Stack Developer");
      expect(result.experience[0]?.company).toBe("TechNova Solutions");
      expect(result.experience[0]?.dateRange).toBe("Feb 2023 – Present");
      expect(result.experience[1]?.title).toBe("Software Engineer");
      expect(result.experience[1]?.company).toBe("InfraSoft Systems");
      expect(result.experience[1]?.dateRange).toBe("Jan 2021 – Dec 2022");

      // 3. Total experience excludes project dates (Jan-Mar 2023) and education dates (2017-2021)
      // Jan 2021 – Dec 2022 (23 mos) + Feb 2023 – Feb 2024 (12 mos) = 35 mos = 2.9 yrs.
      expect(result.totalExperienceYears).toBe(2.9);

      // 4. Target roles come from relevant job titles only (not from project titles or skills)
      expect(result.targetRoles).toEqual(
        expect.arrayContaining(["Full-Stack Developer", "Software Engineer"])
      );
      expect(result.targetRoles).not.toContain("AI/ML Engineer");

      // 5. Education contains only education info; Summary, Projects, Skills do not leak into Education
      expect(result.education.length).toBe(1);
      expect(result.education[0]?.qualification).toContain("Bachelor of Technology in Computer Science");
      expect(result.education[0]?.institution).toContain("National Institute of Technology Karnataka");
      expect(result.education[0]?.year).toBe("2017 – 2021");
      expect(result.education[0]?.grade).toBe("CGPA: 8.8 / 10");

      // Verify no leak of other sections into education
      const educationText = JSON.stringify(result.education);
      expect(educationText).not.toContain("TechNova Solutions");
      expect(educationText).not.toContain("Cloud Task Tracker");
      expect(educationText).not.toContain("Experienced full-stack engineer");
      expect(educationText).not.toContain("AWS Certified");
    });

    it("returns empty results for missing sections rather than leaking whole text", () => {
      const resumeWithoutExpOrEdu = `Sneha Patel
sneha@example.com | 9876543210

Summary
Passionate fresher looking for entry-level opportunities.

Technical Skills
JavaScript, React, Python`;

      const result = parseResumeText(resumeWithoutExpOrEdu);
      expect(result.candidateName).toBe("Sneha Patel");
      expect(result.email).toBe("sneha@example.com");
      expect(result.phone).toBe("9876543210");
      expect(result.experience).toEqual([]);
      expect(result.education).toEqual([]);
      expect(result.targetRoles).toEqual([]);
      expect(result.totalExperienceYears).toBeUndefined();
      expect(result.skills).toEqual(expect.arrayContaining(["JavaScript", "React", "Python"]));
    });

    it("prevents Education from leaking into Experience or vice versa when one section is absent", () => {
      const onlyEducation = `Aarav Sharma
aarav@example.com

Education
Master of Science in Data Science
Indian Institute of Science
2022 – 2024`;

      const result = parseResumeText(onlyEducation);
      expect(result.education.length).toBe(1);
      expect(result.education[0]?.qualification).toContain("Master of Science in Data Science");
      expect(result.education[0]?.institution).toContain("Indian Institute of Science");
      expect(result.experience).toEqual([]);
      expect(result.targetRoles).toEqual([]);
      expect(result.totalExperienceYears).toBeUndefined();
    });

    it("preserves manual candidate values unless overwrite is explicitly confirmed", () => {
      const initialDraft = {
        firstName: "Manually",
        lastName: "Entered",
        phone: "+91 99999 88888",
        linkedin: "https://linkedin.com/in/manual-profile",
        github: "https://github.com/manual-code",
        portfolio: "https://manual.site",
        roles: ["Cybersecurity Engineer"],
        skills: ["Cybersecurity"],
        experienceYears: "5",
        fresher: false,
      };

      const resumeSuggestions = {
        candidateName: "Resume Parsed",
        phone: "+91 11111 22222",
        linkedin: "https://linkedin.com/in/resume-parsed",
        github: "https://github.com/resume-parsed",
        portfolio: "https://resume-parsed.site",
        targetRoles: ["Software Engineer", "Frontend Developer"],
        skills: ["React", "TypeScript"],
        totalExperienceYears: 2,
      };

      // 1. By default, existing non-empty values are preserved
      const preservedResult = prefillFromResume(initialDraft, resumeSuggestions, {
        overwriteConfirmed: false,
      });

      expect(preservedResult.draft.firstName).toBe("Manually");
      expect(preservedResult.draft.lastName).toBe("Entered");
      expect(preservedResult.draft.phone).toBe("+91 99999 88888");
      expect(preservedResult.draft.linkedin).toBe("https://linkedin.com/in/manual-profile");
      expect(preservedResult.draft.roles).toEqual(["Cybersecurity Engineer"]);
      expect(preservedResult.preservedFields).toContain("First name");
      expect(preservedResult.preservedFields).toContain("Last name");
      expect(preservedResult.preservedFields).toContain("Phone");
      expect(preservedResult.preservedFields).toContain("LinkedIn");
      expect(preservedResult.preservedFields).toContain("Target roles");

      // 2. When overwriteConfirmed is true, values are replaced
      const overwrittenResult = prefillFromResume(initialDraft, resumeSuggestions, {
        overwriteConfirmed: true,
      });

      expect(overwrittenResult.draft.firstName).toBe("Resume");
      expect(overwrittenResult.draft.lastName).toBe("Parsed");
      expect(overwrittenResult.draft.phone).toBe("+91 11111 22222");
      expect(overwrittenResult.draft.linkedin).toBe("https://linkedin.com/in/resume-parsed");
      expect(overwrittenResult.draft.roles).toEqual(["Software Engineer", "Frontend Developer"]);
      expect(overwrittenResult.prefilledFields).toContain("First name");
      expect(overwrittenResult.prefilledFields).toContain("Last name");
      expect(overwrittenResult.prefilledFields).toContain("Phone");
      expect(overwrittenResult.prefilledFields).toContain("LinkedIn");
      expect(overwrittenResult.prefilledFields).toContain("Target roles");
    });
  });
});
