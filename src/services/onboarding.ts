import type { Profile } from "./auth.js";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type Draft = {
  firstName: string;
  lastName: string;
  careerStage: string;
  roles: string[];
  skills: string[];
  experienceYears: string;
  fresher: boolean;
  cities: string[];
  remote: boolean;
  currentCompensation: string;
  expectedCompensation: string;
  modes: string[];
  relocation: string;
  availability: string;
  currentCity: string;
  state: string;
  postalCode: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  resumeName: string;
  resumeBytes: number;
  industries: string[];
  extractedRoles: string[];
  extractedSkills: string[];
  prefilledFields: string[];
  preservedFields: string[];
};

export const blankDraft = (): Draft => ({
  firstName: "",
  lastName: "",
  careerStage: "",
  roles: [],
  skills: [],
  experienceYears: "",
  fresher: false,
  cities: [],
  remote: false,
  currentCompensation: "",
  expectedCompensation: "",
  modes: [],
  relocation: "",
  availability: "",
  currentCity: "",
  state: "",
  postalCode: "",
  phone: "",
  linkedin: "",
  github: "",
  portfolio: "",
  resumeName: "",
  resumeBytes: 0,
  industries: [],
  extractedRoles: [],
  extractedSkills: [],
  prefilledFields: [],
  preservedFields: [],
});

export type OnboardingValidationInput = {
  resumeName: string;
  linkedin: string;
  roles: string[];
  skills: string[];
  fresher: boolean;
  cities: string[];
  remote: boolean;
  modes: string[];
  relocation: string;
  availability: string;
  phone?: string | undefined;
  github?: string | undefined;
  experienceYears?: string | undefined;
  expectedCompensation?: string | undefined;
  currentCity?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
};

export type OnboardingDraftFields = {
  firstName: string;
  lastName: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  roles: string[];
  skills: string[];
  experienceYears: string;
  fresher: boolean;
  extractedRoles?: string[];
  extractedSkills?: string[];
  prefilledFields?: string[];
  preservedFields?: string[];
};

export type PrefillResult<T extends OnboardingDraftFields> = {
  draft: T;
  prefilledFields: string[];
  preservedFields: string[];
};

export function applyResumeSuggestions<
  T extends {
    roles: string[];
    skills: string[];
    extractedRoles?: string[];
    extractedSkills?: string[];
    preservedFields?: string[];
  },
>(currentDraft: T, action: "merge" | "replace" = "merge"): T {
  const rolesFromResume = (currentDraft.extractedRoles || []).slice(0, 3);
  const skillsFromResume = currentDraft.extractedSkills || [];

  let nextRoles: string[];
  let nextSkills: string[];

  if (action === "replace") {
    nextRoles = [...rolesFromResume];
    nextSkills = [...skillsFromResume];
  } else {
    // merge
    const mergedRoles = [...currentDraft.roles];
    for (const r of rolesFromResume) {
      if (!mergedRoles.includes(r) && mergedRoles.length < 3) {
        mergedRoles.push(r);
      }
    }
    const mergedSkills = [...currentDraft.skills];
    for (const s of skillsFromResume) {
      if (!mergedSkills.includes(s)) {
        mergedSkills.push(s);
      }
    }
    nextRoles = mergedRoles;
    nextSkills = mergedSkills;
  }

  const nextPreserved = (currentDraft.preservedFields || []).filter(
    (field) => field !== "Target roles" && field !== "Skills"
  );

  return {
    ...currentDraft,
    roles: nextRoles,
    skills: nextSkills,
    preservedFields: nextPreserved,
  };
}

export function toggleSelection(values: string[], value: string, limit?: number): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (limit && values.length >= limit) return values;
  return [...values, value];
}

export function isValidResume(file: { name: string; type: string; size: number }): boolean {
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");
  const isPdfType = !file.type || file.type === "application/pdf" || file.type === "application/octet-stream";
  return isPdfName && isPdfType && file.size <= MAX_RESUME_BYTES;
}

export function isValidProfileUrl(value: string, host: string): boolean {
  try {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const hostMatches = url.hostname === host || url.hostname.endsWith("." + host);
    const hasPath = url.pathname.length > 1 && url.pathname !== "/";
    return hostMatches && hasPath;
  } catch {
    return false;
  }
}

export function isStep1Valid(input: { resumeName?: string | undefined; linkedin?: string | undefined }): boolean {
  return Boolean(input.resumeName || isValidProfileUrl(input.linkedin ?? "", "linkedin.com"));
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Extract all digits
  const digits = trimmed.replace(/\D/g, "");
  // If no digits or only country code 91 with no subscriber digits
  if (!digits || digits === "91") return null;

  // 10-digit Indian mobile number
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  // 12-digit number starting with 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2)}`;
  }
  // 11-digit number starting with 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91 ${digits.slice(1)}`;
  }
  // International format with 10 to 15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    if (trimmed.startsWith("+")) {
      return `+${digits}`;
    }
    return `+91 ${digits.slice(-10)}`;
  }

  return null;
}

export function isValidPhoneInput(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "+91" || trimmed === "+91 ") return true;
  if (/[a-zA-Z]/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits || digits === "91") {
    return trimmed === "+91" || trimmed === "+91 ";
  }
  return digits.length === 10 || (digits.length === 12 && digits.startsWith("91")) || (digits.length >= 10 && digits.length <= 15);
}

export function extractLocalPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (!trimmed || trimmed === "+91") return "";
  if (trimmed.startsWith("+91")) {
    return trimmed.slice(3).trim();
  }
  if (trimmed.startsWith("91") && trimmed.length === 12) {
    return trimmed.slice(2).trim();
  }
  return trimmed;
}

export function isValidGithubUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Reject script/data injection schemes
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) return false;

  try {
    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;

    // Must have a path with a valid username
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return false;
    const username = segments[0];
    if (!username) return false;

    const reserved = [
      "explore",
      "features",
      "topics",
      "collections",
      "trending",
      "pricing",
      "security",
      "enterprise",
      "customer-stories",
      "readme",
      "about",
      "contact",
      "join",
      "login",
      "signup",
      "settings",
      "notifications",
    ];
    if (reserved.includes(username.toLowerCase())) return false;

    // GitHub username rules: 1-39 chars, alphanumeric with single hyphens, cannot start or end with hyphen
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username);
  } catch {
    return false;
  }
}

export function normalizeGithubUrl(value: string | null | undefined): string | null {
  if (!value || !isValidGithubUrl(value)) return null;
  const trimmed = value.trim();
  try {
    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const username = segments[0];
    if (!username) return null;
    return `https://github.com/${username}`;
  } catch {
    return null;
  }
}

export function validateOnboardingStep(step: number, input: OnboardingValidationInput): string {
  if (step === 1 && !isStep1Valid(input)) {
    return "Add a PDF resume or a valid LinkedIn profile URL to continue.";
  }
  if (step === 2 && !input.roles.length) return "Choose at least one target role.";
  if (step === 3) {
    if (!input.skills.length && !input.fresher) {
      return "Choose at least one skill, or mark yourself as a fresher.";
    }
    if (!input.fresher) {
      const expStr = (input.experienceYears ?? "").trim();
      if (!expStr) {
        return "Total years of experience is required.";
      }
      const num = Number(expStr);
      if (!/^\d+(\.\d+)?$/.test(expStr) || isNaN(num) || num < 0) {
        return "Enter a valid non-negative number for years of experience.";
      }
    }
  }
  if (step === 4 && (!input.cities || !input.cities.length)) {
    return "Choose at least one city.";
  }
  if (step === 5) {
    const compStr = (input.expectedCompensation ?? "").trim();
    if (!compStr) {
      return "Expected compensation is required.";
    }
    const parsed = parseDecimalCompensation(compStr);
    if (parsed === null || parsed < 0) {
      return "Enter a valid non-negative number for expected compensation.";
    }
  }
  if (step === 6 && (!input.modes.length || !input.relocation || !input.availability)) {
    return "Choose your work mode, relocation preference, and availability.";
  }
  if (step === 7) {
    const city = (input.currentCity ?? "").trim();
    if (!city) {
      return "Current city is required.";
    }
    const state = (input.state ?? "").trim();
    if (!state) {
      return "State / province is required.";
    }
    const postal = (input.postalCode ?? "").trim();
    if (!postal) {
      return "Postal code is required.";
    }
    if (!/^[a-zA-Z0-9\s-]{3,10}$/.test(postal)) {
      return "Enter a valid postal code.";
    }
    const phone = (input.phone ?? "").trim();
    const localPhone = extractLocalPhoneNumber(phone);
    if (!phone || !localPhone || phone === "+91" || phone === "+91 ") {
      return "Enter a valid 10-digit mobile number.";
    }
    if (!isValidPhoneInput(phone) || normalizePhone(phone) === null) {
      return "Enter a valid 10-digit mobile number.";
    }
  }
  if (step === 8) {
    if (!input.github || !input.github.trim()) {
      return "GitHub profile URL is required to complete onboarding.";
    }
    if (!isValidGithubUrl(input.github)) {
      return "Please enter a valid GitHub profile URL, for example github.com/username.";
    }
  }
  return "";
}

export function validateEntireOnboarding(
  input: OnboardingValidationInput
): { step: number; message: string } | null {
  for (let s = 1; s <= 8; s++) {
    const message = validateOnboardingStep(s, input);
    if (message) {
      return { step: s, message };
    }
  }
  return null;
}

/**
 * Prefill candidate onboarding fields from resume suggestions while strictly preserving
 * manually entered values unless the candidate explicitly confirms overwriting them.
 */
export type ResumePrefillSuggestions = {
  candidateName?: string | undefined;
  phone?: string | undefined;
  linkedin?: string | undefined;
  github?: string | undefined;
  portfolio?: string | undefined;
  targetRoles?: string[] | undefined;
  skills?: string[] | undefined;
  totalExperienceYears?: number | undefined;
};

export function prefillFromResume<T extends OnboardingDraftFields>(
  currentDraft: T,
  suggestions: ResumePrefillSuggestions,
  options: {
    overwriteConfirmed?: boolean;
    nameSplitter?: (fullName: string) => { firstName: string; lastName: string };
  } = {}
): PrefillResult<T> {
  const { overwriteConfirmed = false, nameSplitter } = options;
  const nextDraft = { ...currentDraft };
  const prefilledFields: string[] = [];
  const preservedFields: string[] = [];

  // 1. Candidate Name (First & Last)
  if (suggestions.candidateName) {
    const split = nameSplitter
      ? nameSplitter(suggestions.candidateName)
      : (() => {
          const parts = suggestions.candidateName.trim().split(/\s+/);
          return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
        })();

    if (split.firstName) {
      if (!currentDraft.firstName || overwriteConfirmed) {
        nextDraft.firstName = split.firstName;
        prefilledFields.push("First name");
      } else if (currentDraft.firstName !== split.firstName) {
        preservedFields.push("First name");
      }
    }
    if (split.lastName) {
      if (!currentDraft.lastName || overwriteConfirmed) {
        nextDraft.lastName = split.lastName;
        prefilledFields.push("Last name");
      } else if (currentDraft.lastName !== split.lastName) {
        preservedFields.push("Last name");
      }
    }
  }

  // 2. Phone
  if (suggestions.phone) {
    if (!currentDraft.phone || overwriteConfirmed) {
      nextDraft.phone = suggestions.phone;
      prefilledFields.push("Phone");
    } else if (currentDraft.phone !== suggestions.phone) {
      preservedFields.push("Phone");
    }
  }

  // 3. LinkedIn
  if (suggestions.linkedin) {
    if (!currentDraft.linkedin || overwriteConfirmed) {
      nextDraft.linkedin = suggestions.linkedin;
      prefilledFields.push("LinkedIn");
    } else if (currentDraft.linkedin !== suggestions.linkedin) {
      preservedFields.push("LinkedIn");
    }
  }

  // 4. GitHub
  if (suggestions.github) {
    if (!currentDraft.github || overwriteConfirmed) {
      nextDraft.github = suggestions.github;
      prefilledFields.push("GitHub");
    } else if (currentDraft.github !== suggestions.github) {
      preservedFields.push("GitHub");
    }
  }

  // 5. Portfolio
  if (suggestions.portfolio) {
    if (!currentDraft.portfolio || overwriteConfirmed) {
      nextDraft.portfolio = suggestions.portfolio;
      prefilledFields.push("Portfolio");
    } else if (currentDraft.portfolio !== suggestions.portfolio) {
      preservedFields.push("Portfolio");
    }
  }

  // 6. Target roles (up to 3)
  if (suggestions.targetRoles && suggestions.targetRoles.length > 0) {
    const proposed = suggestions.targetRoles.slice(0, 3);
    if (!currentDraft.roles.length || overwriteConfirmed) {
      nextDraft.roles = proposed;
      prefilledFields.push("Target roles");
    } else {
      preservedFields.push("Target roles");
    }
  }

  // 7. Skills (up to 5)
  if (suggestions.skills && suggestions.skills.length > 0) {
    const proposed = suggestions.skills.slice(0, 5);
    if (!currentDraft.skills.length || overwriteConfirmed) {
      nextDraft.skills = proposed;
      prefilledFields.push("Skills");
    } else {
      preservedFields.push("Skills");
    }
  }

  // 8. Experience years
  if (suggestions.totalExperienceYears !== undefined) {
    const expYearsStr = String(Math.round(suggestions.totalExperienceYears));
    if (!currentDraft.experienceYears || overwriteConfirmed) {
      nextDraft.experienceYears = expYearsStr;
      prefilledFields.push("Years of experience");
    } else if (currentDraft.experienceYears !== expYearsStr) {
      preservedFields.push("Years of experience");
    }
  }

  return { draft: nextDraft, prefilledFields, preservedFields };
}

export function parseDecimalCompensation(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildProfilePayload(
  draft: Draft,
  userId: string,
  options: {
    existingProfile?: Profile | null | undefined;
    isPartial?: boolean | undefined;
    onboardingComplete?: boolean | undefined;
  } = {}
): Profile {
  const { existingProfile, isPartial = false, onboardingComplete = false } = options;

  const expLevel = draft.fresher
    ? "No professional experience"
    : draft.experienceYears
      ? `${draft.experienceYears} years`
      : isPartial
        ? (existingProfile?.experience_level ?? null)
        : null;

  const computedModes = draft.remote && !draft.modes.includes("Remote")
    ? [...draft.modes, "Remote"]
    : draft.modes;

  let currentComp: number | null = null;
  if (draft.fresher) {
    currentComp = 0;
  } else if (draft.currentCompensation.trim()) {
    currentComp = parseDecimalCompensation(draft.currentCompensation);
  } else if (isPartial) {
    currentComp = existingProfile?.current_compensation ?? null;
  }

  let expectedComp: number | null = null;
  if (draft.expectedCompensation.trim()) {
    expectedComp = parseDecimalCompensation(draft.expectedCompensation);
  } else if (isPartial) {
    expectedComp = existingProfile?.expected_compensation ?? null;
  }

  const pickString = (draftVal: string, existingVal?: string | null): string | null => {
    const trimmed = draftVal.trim();
    if (trimmed) return trimmed;
    if (isPartial && existingVal) return existingVal;
    return null;
  };

  const pickArray = (draftArr: string[], existingArr?: string[]): string[] => {
    if (draftArr.length) return draftArr;
    if (isPartial && existingArr && existingArr.length) return existingArr;
    return [];
  };

  const rawPhone = normalizePhone(draft.phone);
  const resolvedPhone = rawPhone !== null
    ? rawPhone
    : (isPartial ? (existingProfile?.phone ?? null) : null);

  const normalizedGithub = normalizeGithubUrl(draft.github);
  const resolvedGithub = normalizedGithub !== null
    ? normalizedGithub
    : (isPartial ? (existingProfile?.github_url ?? null) : null);

  return {
    id: userId,
    first_name: draft.firstName.trim() || existingProfile?.first_name || "",
    last_name: draft.lastName.trim() || existingProfile?.last_name || "",
    career_stage: draft.careerStage || (isPartial ? (existingProfile?.career_stage ?? null) : null),
    experience_level: expLevel,
    target_roles: pickArray(draft.roles, existingProfile?.target_roles),
    skills: pickArray(draft.skills, existingProfile?.skills),
    preferred_cities: pickArray(draft.cities, existingProfile?.preferred_cities),
    work_preferences: pickArray(computedModes, existingProfile?.work_preferences),
    industries: pickArray(draft.industries, existingProfile?.industries),
    onboarding_complete: onboardingComplete,
    phone: resolvedPhone,
    current_city: pickString(draft.currentCity, existingProfile?.current_city),
    state: pickString(draft.state, existingProfile?.state),
    postal_code: pickString(draft.postalCode, existingProfile?.postal_code),
    current_compensation: currentComp,
    expected_compensation: expectedComp,
    relocation: pickString(draft.relocation, existingProfile?.relocation),
    availability: pickString(draft.availability, existingProfile?.availability),
    linkedin_url: pickString(draft.linkedin, existingProfile?.linkedin_url),
    github_url: resolvedGithub,
    portfolio_url: pickString(draft.portfolio, existingProfile?.portfolio_url),
    resume_name: pickString(draft.resumeName, existingProfile?.resume_name),
    resume_bytes: draft.resumeBytes || (isPartial ? (existingProfile?.resume_bytes ?? null) : null),
  };
}

export function hydrateDraftFromProfile(
  current: Draft,
  profile: Profile | null | undefined
): Draft {
  if (!profile) return current;

  const isFresher = Boolean(
    current.fresher ||
      profile.experience_level === "No professional experience" ||
      profile.career_stage === "Student / Fresher" ||
      profile.current_compensation === 0
  );

  const resolvedCurrentComp = isFresher
    ? "0"
    : current.currentCompensation ||
      (profile.current_compensation !== null && profile.current_compensation !== undefined
        ? String(profile.current_compensation)
        : "");

  return {
    ...current,
    firstName: profile.first_name?.trim() || current.firstName.trim() || "",
    lastName: profile.last_name?.trim() || current.lastName.trim() || "",
    careerStage: current.careerStage || profile.career_stage || "",
    roles: current.roles.length ? current.roles : (profile.target_roles ?? []),
    skills: current.skills.length ? current.skills : (profile.skills ?? []),
    cities: current.cities.length ? current.cities : (profile.preferred_cities ?? []),
    modes: current.modes.length ? current.modes : (profile.work_preferences ?? []),
    industries: current.industries.length ? current.industries : (profile.industries ?? []),
    fresher: isFresher,
    experienceYears:
      isFresher
        ? "0"
        : (current.experienceYears || (profile.experience_level?.match(/^\d+/)?.[0] || "")),
    phone: current.phone || profile.phone || "",
    currentCity: current.currentCity || profile.current_city || "",
    state: current.state || profile.state || "",
    postalCode: current.postalCode || profile.postal_code || "",
    currentCompensation: resolvedCurrentComp,
    expectedCompensation:
      current.expectedCompensation ||
      (profile.expected_compensation !== null && profile.expected_compensation !== undefined
        ? String(profile.expected_compensation)
        : ""),
    relocation: current.relocation || profile.relocation || "",
    availability: current.availability || profile.availability || "",
    linkedin: current.linkedin || profile.linkedin_url || "",
    github: current.github || profile.github_url || "",
    portfolio: current.portfolio || profile.portfolio_url || "",
    resumeName: current.resumeName || profile.resume_name || "",
    resumeBytes: current.resumeBytes || (profile.resume_bytes ? Number(profile.resume_bytes) : 0),
  };
}

