import { createClient, type Session, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const authConfigured = Boolean(supabase);

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  career_stage: string | null;
  experience_level: string | null;
  target_roles: string[];
  skills: string[];
  preferred_cities: string[];
  work_preferences: string[];
  industries: string[];
  onboarding_complete: boolean;
  phone?: string | null;
  current_city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  current_compensation?: number | null;
  expected_compensation?: number | null;
  relocation?: string | null;
  availability?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  resume_name?: string | null;
  resume_bytes?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AuthSnapshot = {
  session: Session | null;
  profile: Profile | null;
};

let cachedSnapshot: AuthSnapshot | null = null;
let inFlightSnapshot: Promise<AuthSnapshot> | null = null;

export function getCachedAuthSnapshot(): AuthSnapshot | null {
  return cachedSnapshot;
}

export function setCachedAuthSnapshot(snapshot: AuthSnapshot | null): void {
  cachedSnapshot = snapshot;
}

export type PasswordRequirements = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
};

export function evaluatePasswordPolicy(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordPolicySatisfied(password: string): boolean {
  const reqs = evaluatePasswordPolicy(password);
  return (
    reqs.minLength &&
    reqs.hasUppercase &&
    reqs.hasLowercase &&
    reqs.hasNumber &&
    reqs.hasSpecial
  );
}

export function safeInternalRedirect(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    if (parsed.protocol !== "http:") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function clearDraftStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("career-radar-onboarding-draft")) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function clearStaleSession(): Promise<void> {
  cachedSnapshot = null;
  inFlightSnapshot = null;
  clearDraftStorage();
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore signOut errors during local cleanup
    }
  }
}

export async function getSession(options?: { validate?: boolean }): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  if (options?.validate) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        await clearStaleSession();
        return null;
      }
      data.session.user = userData.user;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err.status === 401 || err.status === 403 || err.status === 400)
      ) {
        await clearStaleSession();
        return null;
      }
    }
  }

  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function buildSnapshotForSession(session: Session): Promise<AuthSnapshot> {
  const user = session.user;
  let profile: Profile | null = null;
  try {
    profile = await getProfile(user.id);
  } catch (err) {
    console.warn("Unable to fetch profile for snapshot:", err);
  }

  // Extract user metadata from signup or OAuth
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaFirst = String(meta.first_name ?? meta.given_name ?? "").trim();
  const metaLast = String(meta.last_name ?? meta.family_name ?? "").trim();
  const metaFull = String(meta.full_name ?? meta.name ?? "").trim();
  let fallbackFirst = metaFirst;
  let fallbackLast = metaLast;
  if (!fallbackFirst && metaFull) {
    const parts = metaFull.split(/\s+/);
    fallbackFirst = parts[0] ?? "";
    fallbackLast = parts.slice(1).join(" ");
  }

  if (!profile) {
    // Explicitly handle missing profile: do not use stale cached profile data or invent arbitrary data
    profile = {
      id: user.id,
      first_name: fallbackFirst,
      last_name: fallbackLast,
      career_stage: null,
      experience_level: null,
      target_roles: [],
      skills: [],
      preferred_cities: [],
      work_preferences: [],
      industries: [],
      onboarding_complete: false,
    };
  } else {
    if (!profile.first_name && fallbackFirst) profile.first_name = fallbackFirst;
    if (!profile.last_name && fallbackLast) profile.last_name = fallbackLast;
  }

  cachedSnapshot = { session, profile };
  return cachedSnapshot;
}

export async function getAuthSnapshot(session?: Session | null): Promise<AuthSnapshot> {
  // If an explicit session argument is provided:
  if (session !== undefined) {
    if (!session?.user) {
      cachedSnapshot = { session: null, profile: null };
      return cachedSnapshot;
    }
    return await buildSnapshotForSession(session);
  }

  // Ambient lookup (session === undefined):
  if (inFlightSnapshot) return inFlightSnapshot;

  inFlightSnapshot = (async () => {
    try {
      if (!supabase) {
        cachedSnapshot = { session: null, profile: null };
        return cachedSnapshot;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        cachedSnapshot = { session: null, profile: null };
        return cachedSnapshot;
      }

      // Validate session with Auth server to detect deleted users
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          await clearStaleSession();
          cachedSnapshot = { session: null, profile: null };
          return cachedSnapshot;
        }
        sessionData.session.user = userData.user;
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "status" in err &&
          (err.status === 401 || err.status === 403 || err.status === 400)
        ) {
          await clearStaleSession();
          cachedSnapshot = { session: null, profile: null };
          return cachedSnapshot;
        }
      }

      return await buildSnapshotForSession(sessionData.session);
    } finally {
      inFlightSnapshot = null;
    }
  })();

  return inFlightSnapshot;
}

export function subscribeToAuthChanges(onChange: (snapshot: AuthSnapshot) => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") {
      clearDraftStorage();
      cachedSnapshot = { session: null, profile: null };
      onChange(cachedSnapshot);
      return;
    }

    if (session?.user) {
      if (cachedSnapshot?.session?.user.id !== session.user.id) {
        cachedSnapshot = null;
      }
      // On INITIAL_SESSION, perform server validation so deleted users are caught immediately
      const snap = event === "INITIAL_SESSION"
        ? await getAuthSnapshot()
        : await getAuthSnapshot(session);
      onChange(snap);
      return;
    }

    // For non-SIGNED_OUT events where session is null (e.g. INITIAL_SESSION before storage read completes):
    const freshSession = await getSession({ validate: true });
    if (freshSession?.user) {
      const snap = await getAuthSnapshot(freshSession);
      onChange(snap);
      return;
    }

    // Truly unauthenticated
    clearDraftStorage();
    cachedSnapshot = { session: null, profile: null };
    onChange(cachedSnapshot);
  });
  return () => data.subscription.unsubscribe();
}

export function destinationForProfile(profile: Pick<Profile, "onboarding_complete"> | null): "/onboarding" | "/dashboard" {
  return profile?.onboarding_complete ? "/dashboard" : "/onboarding";
}

export function incompleteProfile(profile: Omit<Profile, "onboarding_complete">): Profile {
  return { ...profile, onboarding_complete: false };
}

export async function destinationForUser(user: User) {
  const profile = await getProfile(user.id);
  return profile?.onboarding_complete ? "/dashboard" : "/onboarding";
}

export function friendlyAuthError(error: unknown) {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : error instanceof Error ? error.message : String(error ?? "");
  if (/PASSWORD_DOES_NOT_MEET_REQUIREMENTS|password.*(weak|strength|policy|requirements)/i.test(message)) return "Please choose a stronger password that meets all requirements.";
  if (/UNAUTHORIZED_PROFILE_MUTATION/i.test(message)) return "You do not have permission to modify this profile.";
  if (/UNAUTHENTICATED/i.test(message)) return "You must be signed in to save your profile.";
  if (/email.*already.*registered|user already registered|user already exists/i.test(message)) return "That email is already registered. Try logging in instead.";
  if (/invalid login credentials|invalid_credentials|user not found/i.test(message)) return "Those details do not match an account. Check your email and password, or reset your password.";
  if (/email not confirmed|email_not_confirmed/i.test(message)) return "Please confirm your email address before logging in. Check your inbox for the confirmation link.";
  if (/invalid api key|invalid.*(publishable|anon).*key|apikey/i.test(message)) return "The authentication key is not accepted by Supabase. Check the local project configuration.";
  if (/network|fetch|failed to connect|timeout/i.test(message)) return "We could not reach Supabase. Check your connection and try again.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  return message || "An unexpected authentication error occurred.";
}

export async function signUp(input: { email: string; password: string; firstName: string; lastName: string }) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  if (!isPasswordPolicySatisfied(input.password)) {
    throw new Error("PASSWORD_DOES_NOT_MEET_REQUIREMENTS");
  }
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: { first_name: input.firstName, last_name: input.lastName },
    },
  });
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function sendPasswordReset(email: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
}

export async function resendVerification(email: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.resend({ type: "signup", email });
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  if (!isPasswordPolicySatisfied(password)) {
    throw new Error("PASSWORD_DOES_NOT_MEET_REQUIREMENTS");
  }
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  cachedSnapshot = null;
  inFlightSnapshot = null;
  clearDraftStorage();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const ALLOWED_PROFILE_KEYS = [
  "id",
  "first_name",
  "last_name",
  "career_stage",
  "experience_level",
  "target_roles",
  "skills",
  "preferred_cities",
  "work_preferences",
  "industries",
  "onboarding_complete",
  "phone",
  "current_city",
  "state",
  "postal_code",
  "current_compensation",
  "expected_compensation",
  "relocation",
  "availability",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "resume_name",
  "resume_bytes",
] as const;

export async function saveProfile(profile: Omit<Profile, "id"> & { id: string }) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

  // Verify authenticated caller identity (defense in depth against unauthenticated writes and IDOR)
  const currentSession = cachedSnapshot?.session ?? (await getSession());
  if (!currentSession?.user) {
    throw new Error("UNAUTHENTICATED");
  }
  if (currentSession.user.id !== profile.id) {
    throw new Error("UNAUTHORIZED_PROFILE_MUTATION");
  }

  // Filter out any unauthorized or unexpected columns (mass assignment protection)
  const sanitizedProfile: Record<string, unknown> = {};
  for (const key of ALLOWED_PROFILE_KEYS) {
    if (key in profile) {
      sanitizedProfile[key] = (profile as Record<string, unknown>)[key];
    }
  }

  const { data, error } = await supabase.from("profiles").upsert(sanitizedProfile, { onConflict: "id" }).select().single();
  if (error) throw error;
  const saved = data as Profile;
  if (cachedSnapshot?.session?.user.id === profile.id) {
    cachedSnapshot = { session: cachedSnapshot.session, profile: saved };
  }
  return saved;
}
