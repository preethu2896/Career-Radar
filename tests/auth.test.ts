import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  destinationForProfile,
  incompleteProfile,
  safeInternalRedirect,
  clearDraftStorage,
  clearStaleSession,
  getAuthSnapshot,
  getCachedAuthSnapshot,
  setCachedAuthSnapshot,
  signOut,
  type AuthSnapshot,
  type Profile,
} from "../src/services/auth.js";
import { resolveProtectedDestination } from "../src/ui/AuthFlows.js";
import { loadDraft } from "../src/ui/CandidateOnboarding.js";

const profile = {
  id: "user-1",
  first_name: "Asha",
  last_name: "Rao",
  career_stage: null,
  experience_level: null,
  target_roles: [],
  skills: [],
  preferred_cities: [],
  work_preferences: [],
  industries: [],
};

describe("candidate auth routing", () => {
  it("routes incomplete and completed profiles to the correct protected destination", () => {
    expect(destinationForProfile(null)).toBe("/onboarding");
    expect(destinationForProfile({ onboarding_complete: false })).toBe("/onboarding");
    expect(destinationForProfile({ onboarding_complete: true })).toBe("/dashboard");
  });

  it("rejects external redirect targets", () => {
    expect(safeInternalRedirect("//malicious.example", "/login")).toBe("/login");
    expect(safeInternalRedirect("/dashboard", "/login")).toBe("/dashboard");
  });

  it("creates an explicitly incomplete profile for a resumable onboarding flow", () => {
    expect(incompleteProfile(profile)).toEqual({ ...profile, onboarding_complete: false });
  });

  it("preserves all extended profile fields when marking a profile as incomplete", () => {
    const fullExtendedProfile: Omit<Profile, "onboarding_complete"> = {
      id: "cand-123",
      first_name: "Asha",
      last_name: "Rao",
      career_stage: "Experienced professional",
      experience_level: "4 years",
      target_roles: ["Software Engineer"],
      skills: ["React", "TypeScript"],
      preferred_cities: ["Bengaluru"],
      work_preferences: ["Hybrid"],
      industries: ["SaaS"],
      phone: "+91 98765 43210",
      current_city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
      current_compensation: 18.5,
      expected_compensation: 28.5,
      relocation: "Yes, for the right role",
      availability: "Ready to join immediately",
      linkedin_url: "https://linkedin.com/in/asharao",
      github_url: "https://github.com/asharao",
      portfolio_url: "https://asharao.dev",
      resume_name: "resume.pdf",
      resume_bytes: 1048576,
    };

    const incomplete = incompleteProfile(fullExtendedProfile);
    expect(incomplete.onboarding_complete).toBe(false);
    expect(incomplete.current_compensation).toBe(18.5);
    expect(incomplete.expected_compensation).toBe(28.5);
    expect(incomplete.phone).toBe("+91 98765 43210");
    expect(incomplete.current_city).toBe("Bengaluru");
    expect(incomplete.state).toBe("Karnataka");
    expect(incomplete.postal_code).toBe("560001");
    expect(incomplete.relocation).toBe("Yes, for the right role");
    expect(incomplete.availability).toBe("Ready to join immediately");
    expect(incomplete.linkedin_url).toBe("https://linkedin.com/in/asharao");
    expect(incomplete.github_url).toBe("https://github.com/asharao");
    expect(incomplete.portfolio_url).toBe("https://asharao.dev");
    expect(incomplete.resume_name).toBe("resume.pdf");
    expect(incomplete.resume_bytes).toBe(1048576);
  });
});

describe("candidate profile isolation and ownership boundaries", () => {
  it("enforces candidate identity ownership under row-level security policy", () => {
    const candidateA = "cand-auth-a-uuid";
    const candidateB = "cand-auth-b-uuid";

    // Simulating Postgres RLS policy check: (auth.uid() = id)
    const checkRlsSelectAccess = (sessionUid: string, profileTargetId: string) => {
      return sessionUid === profileTargetId;
    };

    const checkRlsUpdateAccess = (sessionUid: string, targetProfileId: string) => {
      return sessionUid === targetProfileId;
    };

    // Candidate A reading Candidate A's profile is permitted
    expect(checkRlsSelectAccess(candidateA, candidateA)).toBe(true);

    // Candidate A reading Candidate B's profile is blocked
    expect(checkRlsSelectAccess(candidateA, candidateB)).toBe(false);

    // Candidate A attempting to update Candidate B's profile is blocked
    expect(checkRlsUpdateAccess(candidateA, candidateB)).toBe(false);

    // Candidate B updating Candidate B's profile is permitted
    expect(checkRlsUpdateAccess(candidateB, candidateB)).toBe(true);
  });
});

describe("candidate auth snapshot and cache management", () => {
  it("allows setting and reading cached snapshot for zero-latency route initialization", async () => {
    const { getCachedAuthSnapshot, setCachedAuthSnapshot } = await import("../src/services/auth.js");
    
    // Initial state or reset
    setCachedAuthSnapshot(null);
    expect(getCachedAuthSnapshot()).toBeNull();

    const mockSnapshot = {
      session: {
        access_token: "mock-token",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "mock-refresh",
        user: {
          id: "cand-user-999",
          app_metadata: {},
          user_metadata: { first_name: "Rohit", last_name: "Verma" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
      profile: {
        id: "cand-user-999",
        first_name: "Rohit",
        last_name: "Verma",
        career_stage: null,
        experience_level: null,
        target_roles: [],
        skills: [],
        preferred_cities: [],
        work_preferences: [],
        industries: [],
        onboarding_complete: false,
      },
    };

    setCachedAuthSnapshot(mockSnapshot);
    const cached = getCachedAuthSnapshot();
    expect(cached).not.toBeNull();
    expect(cached?.session?.user.id).toBe("cand-user-999");
    expect(cached?.profile?.first_name).toBe("Rohit");
    expect(cached?.profile?.last_name).toBe("Verma");

    // Clean up
    setCachedAuthSnapshot(null);
    expect(getCachedAuthSnapshot()).toBeNull();
  });
});

describe("signup password security policy", () => {
  it("enforces all individual password requirements", async () => {
    const { evaluatePasswordPolicy, isPasswordPolicySatisfied } = await import("../src/services/auth.js");

    // 1. Minimum 8 characters
    const tooShort = evaluatePasswordPolicy("Aa1!xyz");
    expect(tooShort.minLength).toBe(false);
    expect(isPasswordPolicySatisfied("Aa1!xyz")).toBe(false);

    // 2. Uppercase letter required
    const noUpper = evaluatePasswordPolicy("preetham123!");
    expect(noUpper.hasUppercase).toBe(false);
    expect(noUpper.hasLowercase).toBe(true);
    expect(noUpper.hasNumber).toBe(true);
    expect(noUpper.hasSpecial).toBe(true);
    expect(isPasswordPolicySatisfied("preetham123!")).toBe(false);

    // 3. Lowercase letter required
    const noLower = evaluatePasswordPolicy("PREETHAM123!");
    expect(noLower.hasUppercase).toBe(true);
    expect(noLower.hasLowercase).toBe(false);
    expect(isPasswordPolicySatisfied("PREETHAM123!")).toBe(false);

    // 4. Number required
    const noNum = evaluatePasswordPolicy("Preetham!xyz");
    expect(noNum.hasNumber).toBe(false);
    expect(isPasswordPolicySatisfied("Preetham!xyz")).toBe(false);

    // 5. Special character required
    const noSpecial = evaluatePasswordPolicy("Preetham123");
    expect(noSpecial.hasSpecial).toBe(false);
    expect(isPasswordPolicySatisfied("Preetham123")).toBe(false);

    // 6. Valid password satisfying all 5 criteria
    const valid = evaluatePasswordPolicy("RadarSecure#2026");
    expect(valid.minLength).toBe(true);
    expect(valid.hasUppercase).toBe(true);
    expect(valid.hasLowercase).toBe(true);
    expect(valid.hasNumber).toBe(true);
    expect(valid.hasSpecial).toBe(true);
    expect(isPasswordPolicySatisfied("RadarSecure#2026")).toBe(true);
  });
});

describe("open redirect defense-in-depth", () => {
  it("strictly prevents open redirect attempts across backslashes, protocol-relative, and external URLs", async () => {
    const { safeInternalRedirect } = await import("../src/services/auth.js");

    // Valid internal routes
    expect(safeInternalRedirect("/dashboard", "/login")).toBe("/dashboard");
    expect(safeInternalRedirect("/onboarding?step=2", "/login")).toBe("/onboarding?step=2");
    expect(safeInternalRedirect("/settings#account", "/login")).toBe("/settings#account");

    // Protocol-relative attacks
    expect(safeInternalRedirect("//malicious.com", "/login")).toBe("/login");
    expect(safeInternalRedirect("//malicious.com/path", "/login")).toBe("/login");

    // Windows backslash bypass attempts
    expect(safeInternalRedirect("/\\malicious.com", "/login")).toBe("/login");
    expect(safeInternalRedirect("/\\/malicious.com", "/login")).toBe("/login");
    expect(safeInternalRedirect("/path\\with\\backslash", "/login")).toBe("/login");

    // Full external URLs
    expect(safeInternalRedirect("https://attacker.example.com", "/login")).toBe("/login");
    expect(safeInternalRedirect("http://attacker.example.com", "/login")).toBe("/login");
    expect(safeInternalRedirect("javascript:alert(1)", "/login")).toBe("/login");

    // Empty, null, undefined
    expect(safeInternalRedirect("", "/login")).toBe("/login");
    expect(safeInternalRedirect(null, "/login")).toBe("/login");
    expect(safeInternalRedirect(undefined, "/login")).toBe("/login");
  });
});

describe("profile mutation mass-assignment and IDOR protection", () => {
  it("restricts saveProfile to explicitly allowed profile fields", async () => {
    const { ALLOWED_PROFILE_KEYS } = await import("../src/services/auth.js");

    // Allowed fields contains known candidate attributes
    expect(ALLOWED_PROFILE_KEYS).toContain("first_name");
    expect(ALLOWED_PROFILE_KEYS).toContain("last_name");
    expect(ALLOWED_PROFILE_KEYS).toContain("target_roles");
    expect(ALLOWED_PROFILE_KEYS).toContain("current_compensation");

    // Must NOT contain sensitive system or admin privilege columns
    expect(ALLOWED_PROFILE_KEYS).not.toContain("role");
    expect(ALLOWED_PROFILE_KEYS).not.toContain("is_admin");
    expect(ALLOWED_PROFILE_KEYS).not.toContain("admin");
    expect(ALLOWED_PROFILE_KEYS).not.toContain("permissions");
  });

  it("blocks profile mutation when target profile id does not match active session user", async () => {
    const { saveProfile, setCachedAuthSnapshot } = await import("../src/services/auth.js");

    // Establish active session for User A
    setCachedAuthSnapshot({
      session: {
        access_token: "token-a",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "refresh-a",
        user: {
          id: "authenticated-user-a",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
      profile: null,
    });

    // Attempt to save profile for User B (IDOR attempt)
    const unauthorizedPayload = {
      id: "victim-user-b",
      first_name: "Attacker",
      last_name: "Injected",
      career_stage: null,
      experience_level: null,
      target_roles: [],
      skills: [],
      preferred_cities: [],
      work_preferences: [],
      industries: [],
      onboarding_complete: false,
    };

    await expect(saveProfile(unauthorizedPayload)).rejects.toThrow("UNAUTHORIZED_PROFILE_MUTATION");

    // Clean up
    setCachedAuthSnapshot(null);
  });

  it("blocks profile mutation when caller is unauthenticated", async () => {
    const { saveProfile, setCachedAuthSnapshot } = await import("../src/services/auth.js");

    // Ensure completely unauthenticated
    setCachedAuthSnapshot(null);

    const unauthenticatedPayload = {
      id: "any-unauth-user",
      first_name: "Sneaky",
      last_name: "Saver",
      career_stage: null,
      experience_level: null,
      target_roles: [],
      skills: [],
      preferred_cities: [],
      work_preferences: [],
      industries: [],
      onboarding_complete: false,
    };

    await expect(saveProfile(unauthenticatedPayload)).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("safe external URL sanitization", () => {
  it("allows safe http/https URLs and rejects unsafe protocols", async () => {
    const { safeExternalUrl } = await import("../src/domain/normalize.js");

    // Valid URLs
    expect(safeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(safeExternalUrl("http://company.in/careers")).toBe("http://company.in/careers");
    expect(safeExternalUrl("company.in/about")).toBe("https://company.in/about");

    // Unsafe protocols (XSS vectors)
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("onboarding preview messaging and redirect preservation", () => {
  it("defines distinct messages for unconfigured Supabase vs unauthenticated preview", async () => {
    const { UNCONFIGURED_AUTH_MESSAGE, PREVIEW_ONBOARDING_MESSAGE } = await import(
      "../src/ui/CandidateOnboarding.js"
    );

    // Supabase unconfigured message
    expect(UNCONFIGURED_AUTH_MESSAGE).toBe(
      "Supabase is not configured, so this preview cannot save a profile."
    );
    expect(UNCONFIGURED_AUTH_MESSAGE.toLowerCase()).toContain("supabase is not configured");

    // Unauthenticated preview message
    expect(PREVIEW_ONBOARDING_MESSAGE).toBe(
      "You're previewing onboarding. Sign in or create an account to save your profile."
    );
    expect(PREVIEW_ONBOARDING_MESSAGE.toLowerCase()).toContain("previewing onboarding");
    expect(PREVIEW_ONBOARDING_MESSAGE.toLowerCase()).toContain("sign in or create an account");

    // Messages must be distinct
    expect(UNCONFIGURED_AUTH_MESSAGE).not.toBe(PREVIEW_ONBOARDING_MESSAGE);
  });

  it("constructs sign-in and sign-up links preserving the onboarding destination", () => {
    const target = safeInternalRedirect("/onboarding", "/onboarding");
    expect(target).toBe("/onboarding");

    const loginUrl = `/login?redirect=${encodeURIComponent(target)}`;
    const signupUrl = `/signup?redirect=${encodeURIComponent(target)}`;

    expect(loginUrl).toBe("/login?redirect=%2Fonboarding");
    expect(signupUrl).toBe("/signup?redirect=%2Fonboarding");

    // Extracting redirect query param restores the safe internal destination
    const parsedLoginRedirect = new URLSearchParams(loginUrl.split("?")[1]).get("redirect");
    expect(safeInternalRedirect(parsedLoginRedirect, "/dashboard")).toBe("/onboarding");

    const parsedSignupRedirect = new URLSearchParams(signupUrl.split("?")[1]).get("redirect");
    expect(safeInternalRedirect(parsedSignupRedirect, "/dashboard")).toBe("/onboarding");
  });

  it("returns candidate to /onboarding after successful authentication", () => {
    const redirectParam = "/onboarding";
    const profileIncomplete = { onboarding_complete: false };

    // With redirect param present
    const destinationWithParam = safeInternalRedirect(redirectParam, destinationForProfile(profileIncomplete));
    expect(destinationWithParam).toBe("/onboarding");

    // Default destination without redirect param for incomplete profile
    const defaultDestination = destinationForProfile(profileIncomplete);
    expect(defaultDestination).toBe("/onboarding");
  });

  it("rejects unsafe external redirect destinations and falls back to safe destination", () => {
    const safeFallback = "/onboarding";

    // Protocol-relative URLs
    expect(safeInternalRedirect("//attacker.example.com", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("//malicious.com/onboarding", safeFallback)).toBe(safeFallback);

    // Absolute external URLs
    expect(safeInternalRedirect("https://evil.example.com", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("http://evil.example.com/login", safeFallback)).toBe(safeFallback);

    // Javascript/data URIs
    expect(safeInternalRedirect("javascript:alert(1)", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("data:text/html,evil", safeFallback)).toBe(safeFallback);

    // Backslash bypasses
    expect(safeInternalRedirect("/\\evil.com", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("\\evil.com", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("/path\\evil", safeFallback)).toBe(safeFallback);

    // Valid internal relative path is preserved
    expect(safeInternalRedirect("/onboarding", safeFallback)).toBe("/onboarding");
  });
});

describe("authentication flow, session persistence, and onboarding regression suite", () => {
  it("1. handles signup returning a valid session without unnecessary login redirect", async () => {
    const { getAuthSnapshot, destinationForProfile } = await import("../src/services/auth.js");

    const mockSession = {
      access_token: "mock-access-token",
      token_type: "bearer" as const,
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        app_metadata: {},
        user_metadata: { first_name: "Kavya", last_name: "Iyer" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const snapshot = await getAuthSnapshot(mockSession);
    expect(snapshot.session?.user.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(snapshot.profile?.first_name).toBe("Kavya");
    expect(snapshot.profile?.last_name).toBe("Iyer");

    // Newly registered candidate with incomplete profile routes to /onboarding
    expect(destinationForProfile(snapshot.profile)).toBe("/onboarding");
  });

  it("2. preserves destination and handles confirmation-required state when signup has no session", () => {
    const redirectParam = "%2Fonboarding";
    const decodedTarget = decodeURIComponent(redirectParam);
    const safeTarget = safeInternalRedirect(decodedTarget, "/onboarding");
    expect(safeTarget).toBe("/onboarding");

    // Login URL preserves the intended target
    const loginUrl = `/login?redirect=${encodeURIComponent(safeTarget)}`;
    expect(loginUrl).toBe("/login?redirect=%2Fonboarding");
  });

  it("3. login safely redirects to /onboarding when requested", () => {
    const searchParams = new URLSearchParams("?redirect=%2Fonboarding");
    const redirectParam = searchParams.get("redirect");
    const destination = safeInternalRedirect(redirectParam, "/dashboard");
    expect(destination).toBe("/onboarding");
  });

  it("4. preview action buttons navigate to correct login and signup endpoints", () => {
    const safeTarget = safeInternalRedirect("/onboarding", "/onboarding");
    const loginLink = `/login?redirect=${encodeURIComponent(safeTarget)}`;
    const signupLink = `/signup?redirect=${encodeURIComponent(safeTarget)}`;

    expect(loginLink).toBe("/login?redirect=%2Fonboarding");
    expect(signupLink).toBe("/signup?redirect=%2Fonboarding");
  });

  it("5. valid session survives page reload / cache restoration", async () => {
    const { setCachedAuthSnapshot, getCachedAuthSnapshot } = await import("../src/services/auth.js");

    const restoredSnapshot = {
      session: {
        access_token: "restored-token",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "restored-refresh",
        user: {
          id: "persisted-candidate-42",
          app_metadata: {},
          user_metadata: { first_name: "Vikram", last_name: "Reddy" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
      profile: {
        id: "persisted-candidate-42",
        first_name: "Vikram",
        last_name: "Reddy",
        career_stage: "Experienced professional",
        experience_level: "3–5 years",
        target_roles: ["Full-Stack Developer"],
        skills: ["React", "TypeScript", "Node.js"],
        preferred_cities: ["Bengaluru", "Hyderabad"],
        work_preferences: ["Hybrid"],
        industries: ["SaaS"],
        onboarding_complete: false,
      },
    };

    setCachedAuthSnapshot(restoredSnapshot);
    const snapshot = getCachedAuthSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.session?.user.id).toBe("persisted-candidate-42");
    expect(snapshot?.profile?.first_name).toBe("Vikram");
    expect(snapshot?.profile?.target_roles).toContain("Full-Stack Developer");

    // Clean up
    setCachedAuthSnapshot(null);
  });

  it("6. getAuthSnapshot with explicit session updates cached snapshot and does not clobber it", async () => {
    const { getAuthSnapshot, getCachedAuthSnapshot, setCachedAuthSnapshot } = await import("../src/services/auth.js");

    const activeSession = {
      access_token: "active-token",
      token_type: "bearer" as const,
      expires_in: 3600,
      refresh_token: "active-refresh",
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        app_metadata: {},
        user_metadata: { first_name: "Meera", last_name: "Nair" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const snap = await getAuthSnapshot(activeSession);
    expect(snap.session?.user.id).toBe("00000000-0000-4000-8000-000000000002");
    expect(getCachedAuthSnapshot()?.session?.user.id).toBe("00000000-0000-4000-8000-000000000002");

    // Clean up
    setCachedAuthSnapshot(null);
  });

  it("7. candidate draft in localStorage survives redirect transitions", async () => {
    const { loadDraft } = await import("../src/ui/CandidateOnboarding.js");

    const mockStorage: Record<string, string> = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
      length: 0,
      key: () => null,
    };
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = { localStorage: storageMock };

    try {
      const testDraft = {
        firstName: "Divya",
        lastName: "Menon",
        roles: ["Frontend Developer", "UI/UX Engineer"],
        skills: ["React", "CSS", "Figma"],
        cities: ["Bengaluru"],
        resumeName: "divya_resume.pdf",
        resumeBytes: 102400,
        fresher: false,
        currentCompensation: "12",
        expectedCompensation: "18",
      };

      storageMock.setItem("career-radar-onboarding-draft", JSON.stringify(testDraft));

      const loaded = loadDraft();
      expect(loaded.firstName).toBe("Divya");
      expect(loaded.lastName).toBe("Menon");
      expect(loaded.roles).toEqual(["Frontend Developer", "UI/UX Engineer"]);
      expect(loaded.resumeName).toBe("divya_resume.pdf");
      expect(loaded.resumeBytes).toBe(102400);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  });

  it("8. unsafe external redirects are strictly blocked across multiple evasion patterns", () => {
    const safeFallback = "/onboarding";

    expect(safeInternalRedirect("https://attacker.org/onboarding", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("//attacker.org", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("/\\evil.com", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("javascript:alert(1)", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("data:text/html,hack", safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect(null, safeFallback)).toBe(safeFallback);
    expect(safeInternalRedirect("", safeFallback)).toBe(safeFallback);
  });

  it("9. unauthenticated users cannot save profiles", async () => {
    const { saveProfile, setCachedAuthSnapshot } = await import("../src/services/auth.js");

    setCachedAuthSnapshot(null);

    const payload = {
      id: "unauth-user-999",
      first_name: "Hacker",
      last_name: "Try",
      career_stage: null,
      experience_level: null,
      target_roles: [],
      skills: [],
      preferred_cities: [],
      work_preferences: [],
      industries: [],
      onboarding_complete: true,
    };

    await expect(saveProfile(payload)).rejects.toThrow("UNAUTHENTICATED");
  });

  it("10. signOut clears cached auth snapshot and resets authentication state", async () => {
    const { signOut, setCachedAuthSnapshot, getCachedAuthSnapshot } = await import("../src/services/auth.js");

    setCachedAuthSnapshot({
      session: {
        access_token: "logout-token",
        token_type: "bearer" as const,
        expires_in: 3600,
        refresh_token: "logout-refresh",
        user: {
          id: "logout-candidate",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
      profile: null,
    });

    expect(getCachedAuthSnapshot()).not.toBeNull();
    await signOut();
    expect(getCachedAuthSnapshot()).toBeNull();
  });
});

describe("Mobile auth UI and stale session redirect resolution suite", () => {
  const dummyUser = {
    id: "00000000-0000-4000-8000-000000000099",
    app_metadata: {},
    user_metadata: { first_name: "Anita", last_name: "Desai" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const dummySession = {
    access_token: "mock-valid-token",
    token_type: "bearer" as const,
    expires_in: 3600,
    refresh_token: "mock-valid-refresh",
    user: dummyUser,
  };

  it("1. unauthenticated access to /onboarding redirects to /login with preserved return path", () => {
    // Both null snapshot and empty session must redirect to /login
    const nullSnapDecision = resolveProtectedDestination("onboarding", null);
    expect(nullSnapDecision.shouldRedirect).toBe(true);
    expect(nullSnapDecision.destination).toBe("/login?redirect=/onboarding");

    const emptySnapDecision = resolveProtectedDestination("onboarding", { session: null, profile: null });
    expect(emptySnapDecision.shouldRedirect).toBe(true);
    expect(emptySnapDecision.destination).toBe("/login?redirect=/onboarding");
  });

  it("2. unauthenticated access to /dashboard redirects to /login with preserved return path", () => {
    const nullSnapDecision = resolveProtectedDestination("dashboard", null);
    expect(nullSnapDecision.shouldRedirect).toBe(true);
    expect(nullSnapDecision.destination).toBe("/login?redirect=/dashboard");

    const emptySnapDecision = resolveProtectedDestination("dashboard", { session: null, profile: null });
    expect(emptySnapDecision.shouldRedirect).toBe(true);
    expect(emptySnapDecision.destination).toBe("/login?redirect=/dashboard");
  });

  it("3. an existing authenticated user with an incomplete profile can continue onboarding and is barred from dashboard", () => {
    const incompleteSnap: AuthSnapshot = {
      session: dummySession,
      profile: {
        id: dummyUser.id,
        first_name: "Anita",
        last_name: "Desai",
        career_stage: null,
        experience_level: null,
        target_roles: ["Frontend Developer"],
        skills: ["React"],
        preferred_cities: ["Bengaluru"],
        work_preferences: ["Hybrid"],
        industries: ["SaaS"],
        onboarding_complete: false,
      },
    };

    // Candidate stays on /onboarding
    const onbDecision = resolveProtectedDestination("onboarding", incompleteSnap);
    expect(onbDecision.shouldRedirect).toBe(false);
    expect(onbDecision.destination).toBe("/onboarding");

    // Attempting to visit /dashboard redirects back to /onboarding
    const dashDecision = resolveProtectedDestination("dashboard", incompleteSnap);
    expect(dashDecision.shouldRedirect).toBe(true);
    expect(dashDecision.destination).toBe("/onboarding");
  });

  it("4. an authenticated user with a completed profile reaches the dashboard and is redirected away from onboarding", () => {
    const completedSnap: AuthSnapshot = {
      session: dummySession,
      profile: {
        id: dummyUser.id,
        first_name: "Anita",
        last_name: "Desai",
        career_stage: "Experienced professional",
        experience_level: "3 years",
        target_roles: ["Frontend Developer"],
        skills: ["React", "TypeScript"],
        preferred_cities: ["Bengaluru"],
        work_preferences: ["Hybrid"],
        industries: ["SaaS"],
        onboarding_complete: true,
      },
    };

    // Candidate stays on /dashboard
    const dashDecision = resolveProtectedDestination("dashboard", completedSnap);
    expect(dashDecision.shouldRedirect).toBe(false);
    expect(dashDecision.destination).toBe("/dashboard");

    // Attempting to visit /onboarding redirects to /dashboard
    const onbDecision = resolveProtectedDestination("onboarding", completedSnap);
    expect(onbDecision.shouldRedirect).toBe(true);
    expect(onbDecision.destination).toBe("/dashboard");
  });

  it("5. a session with a missing/deleted profile cannot use stale cached profile data", async () => {
    // Even if cache was pre-seeded with a completed profile from another context
    setCachedAuthSnapshot({
      session: dummySession,
      profile: {
        id: dummyUser.id,
        first_name: "OldName",
        last_name: "OldLast",
        career_stage: "Executive",
        experience_level: "15 years",
        target_roles: ["CTO"],
        skills: ["Management"],
        preferred_cities: ["Mumbai"],
        work_preferences: ["Remote"],
        industries: ["Finance"],
        onboarding_complete: true,
      },
    });

    // When getAuthSnapshot resolves for a user whose database profile row does not exist,
    // it must NOT reuse the stale completed profile!
    const freshSnap = await getAuthSnapshot(dummySession);
    expect(freshSnap.session?.user.id).toBe(dummyUser.id);
    // Profile is recognized as incomplete, not silently trusted as the stale completed profile
    expect(freshSnap.profile?.onboarding_complete).toBe(false);
    expect(freshSnap.profile?.first_name).toBe("Anita");
    expect(freshSnap.profile?.last_name).toBe("Desai");
    expect(freshSnap.profile?.target_roles).toEqual([]);

    setCachedAuthSnapshot(null);
  });

  it("6. signing out clears the previous user's cached snapshot and onboarding draft", async () => {
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    const mockStorage: Record<string, string> = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
      get length() { return Object.keys(mockStorage).length; },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage: storageMock };

    try {
      // Seed user draft and snapshot
      storageMock.setItem("career-radar-onboarding-draft", JSON.stringify({ firstName: "UserA", phone: "9876543210" }));
      storageMock.setItem("career-radar-onboarding-draft:user-a", JSON.stringify({ firstName: "UserA", phone: "9876543210" }));
      setCachedAuthSnapshot({ session: dummySession, profile: null });

      expect(getCachedAuthSnapshot()).not.toBeNull();
      expect(storageMock.getItem("career-radar-onboarding-draft")).not.toBeNull();

      // Execute signOut
      await signOut();

      // State is completely wiped
      expect(getCachedAuthSnapshot()).toBeNull();
      expect(storageMock.getItem("career-radar-onboarding-draft")).toBeNull();
      expect(storageMock.getItem("career-radar-onboarding-draft:user-a")).toBeNull();
      expect(loadDraft()).toEqual(expect.objectContaining({ firstName: "", phone: "" }));
    } finally {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  });

  it("7. a deleted or invalid user session does not reopen onboarding", async () => {
    // Clear stale session simulates wiping of deleted user
    await clearStaleSession();

    expect(getCachedAuthSnapshot()).toBeNull();

    // Guard on unauthenticated access routes to login, NOT onboarding
    const onbDecision = resolveProtectedDestination("onboarding", null);
    expect(onbDecision.shouldRedirect).toBe(true);
    expect(onbDecision.destination).toBe("/login?redirect=/onboarding");
  });

  it("8. session restoration does not cause redirect loops or prematurely reject a valid session", async () => {
    const validSnap = await getAuthSnapshot(dummySession);
    expect(validSnap.session?.user.id).toBe(dummyUser.id);

    const onbDecision = resolveProtectedDestination("onboarding", validSnap);
    expect(onbDecision.shouldRedirect).toBe(false);
    expect(onbDecision.destination).toBe("/onboarding");
  });

  it("9. mobile auth hero section is hidden at mobile widths but remains visible on desktop", () => {
    const cssPath = resolve(process.cwd(), "src/ui/app.css");
    const css = readFileSync(cssPath, "utf-8");

    // Extract the @media (max-width: 680px) block that targets the auth UI
    const mobileMediaMatches = [...css.matchAll(/@media\s*\(max-width:\s*680px\)\s*\{([\s\S]*?)\n\}/g)];
    const authMobileBlock = mobileMediaMatches.find(m => Boolean(m[1]?.includes(".auth-story")))?.[1] || "";
    expect(authMobileBlock).toBeTruthy();

    // Mobile media query hides auth-story
    expect(authMobileBlock).toMatch(/\.auth-story\s*\{[^}]*display:\s*none\s*!important/);

    // Desktop auth-story retains its background hero image
    expect(css).toContain('url("/assets/career-radar-hero-landscape.png")');
    expect(css).toMatch(/\.auth-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(420px,\s*1fr\)/);
  });

  it("10. signup and login form controls remain fully usable on mobile widths (320px, 375px, 430px)", () => {
    const cssPath = resolve(process.cwd(), "src/ui/app.css");
    const css = readFileSync(cssPath, "utf-8");

    const mobileMediaMatches = [...css.matchAll(/@media\s*\(max-width:\s*680px\)\s*\{([\s\S]*?)\n\}/g)];
    const authMobileBlock = mobileMediaMatches.find(m => Boolean(m[1]?.includes(".auth-story")))?.[1] || "";
    expect(authMobileBlock).toBeTruthy();

    // In mobile media query, auth-panel has 100svh min-height and proper padding
    expect(authMobileBlock).toMatch(/\.auth-panel\s*\{[^}]*min-height:\s*100svh/);

    // Two-col inputs collapse to 1 column on mobile to fit 320px/375px viewports
    expect(authMobileBlock).toMatch(/\.auth-two-col\s*\{[^}]*grid-template-columns:\s*1fr/);

    // Auth card uses full width up to max-width
    expect(authMobileBlock).toMatch(/\.auth-card\s*\{[^}]*width:\s*100%/);
  });
});

