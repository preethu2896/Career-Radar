import {
  clerkEnabled,
  clerkPublishableKey,
  clerkAccessToken,
  clerkSession,
  subscribeClerk,
  onClerkIdentityInvalidated,
  clerkSignIn,
  clerkSignUp,
  clerkGoogle,
  clerkReset,
  clerkResend,
  clerkUpdatePassword,
  clerkSignOut,
} from "./clerkAuth.js";
import { createClient, type Session, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(
        supabaseUrl,
        supabaseAnonKey,
        clerkEnabled
          ? {
              accessToken: clerkAccessToken,
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
              },
            }
          : undefined,
      )
    : null;

export const authConfigured =
  Boolean(supabase) && (!clerkEnabled || Boolean(clerkPublishableKey));

export async function getAuthProviders(): Promise<{
  email: boolean;
  google: boolean;
}> {
  if (clerkEnabled) return { email: true, google: true };
  if (!supabase) return { email: false, google: false };
  const response = await fetch(supabaseUrl + "/auth/v1/settings", {
    headers: { apikey: supabaseAnonKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Sign-in providers could not be checked.");
  const settings = await response.json();
  return {
    email: settings.external?.email === true,
    google: settings.external?.google === true,
  };
}

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
  education_degree?: string | null;
  graduation_year?: number | null;
  education_score?: string | null;
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
let profileFreshUntil=0;
let inFlightSnapshot: Promise<AuthSnapshot> | null = null;
let authGeneration = 0;
let profileFlight: { generation: number; userId: string; promise: Promise<AuthSnapshot> } | null = null;
const snapshotGenerations = new WeakMap<AuthSnapshot, number>();
function cacheAuthSnapshot(snapshot: AuthSnapshot,profileFresh=false): AuthSnapshot {
  if(profileFresh)profileFreshUntil=Date.now()+15000;
  snapshotGenerations.set(snapshot, authGeneration);
  cachedSnapshot = snapshot;
  return snapshot;
}
let identity: string | null | undefined;
export class StaleAuthSnapshotError extends Error {
  constructor() {
    super("Authentication changed while loading. Please try again.");
  }
}
function invalidateAuth(nextIdentity: string | null | undefined) {
  authGeneration++;
  identity = nextIdentity;
  cachedSnapshot = null;
  profileFreshUntil=0;
  inFlightSnapshot = null;
  profileFlight = null;
}
function observeIdentity(nextIdentity: string | null) {
  if (identity !== nextIdentity) invalidateAuth(nextIdentity);
  return authGeneration;
}
function assertGeneration(generation: number) {
  if (generation !== authGeneration) throw new StaleAuthSnapshotError();
}
export function isCurrentAuthSnapshot(snapshot: AuthSnapshot) {
  return (
    snapshotGenerations.get(snapshot) === authGeneration &&
    (snapshot.session?.user.id ?? null) === identity
  );
}

export function getCachedAuthSnapshot(): AuthSnapshot | null {
  return cachedSnapshot;
}

export function setCachedAuthSnapshot(snapshot: AuthSnapshot | null): void {
  invalidateAuth(snapshot?.session?.user.id);
  if (snapshot) cacheAuthSnapshot(snapshot);
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
    minLength: password.length >= (clerkEnabled ? 15 : 8),
    hasUppercase: clerkEnabled || /[A-Z]/.test(password),
    hasLowercase: clerkEnabled || /[a-z]/.test(password),
    hasNumber: clerkEnabled || /[0-9]/.test(password),
    hasSpecial: clerkEnabled || /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordPolicyError(password: string): string | null {
  const requirements = evaluatePasswordPolicy(password);
  if (!requirements.minLength)
    return clerkEnabled
      ? "Use at least 15 characters."
      : "Use at least 8 characters.";
  if (!requirements.hasUppercase) return "Add at least one uppercase letter.";
  if (!requirements.hasLowercase) return "Add at least one lowercase letter.";
  if (!requirements.hasNumber) return "Add at least one number.";
  if (!requirements.hasSpecial) return "Add at least one special character.";
  return null;
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

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\")
  ) {
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
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith("career-radar-onboarding-draft"))
          keysToRemove.push(key);
      }
      for (const key of keysToRemove) storage.removeItem(key);
    } catch {
      /* One unavailable store must not prevent clearing the other. */
    }
  }
}

export async function clearStaleSession(): Promise<void> {
  if (clerkEnabled) {
    invalidateAuth(null);
    clearDraftStorage();
    await clerkSignOut();
    return;
  }
  invalidateAuth(null);
  clearDraftStorage();
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore signOut errors during local cleanup
    }
  }
}

export async function getSession(options?: {
  validate?: boolean;
}): Promise<Session | null> {
  if (clerkEnabled) return clerkSession(options?.validate);
  if (!supabase) return null;
  const generation = authGeneration;
  const { data, error } = await supabase.auth.getSession();
  assertGeneration(generation);
  if (error || !data.session?.user) return null;

  if (options?.validate) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(
        data.session.access_token,
      );
      assertGeneration(generation);
      if (userData.user && userData.user.id !== data.session.user.id)
        throw new StaleAuthSnapshotError();
      if (userError || !userData.user) {
        await clearStaleSession();
        return null;
      }
      data.session.user = userData.user;
    } catch (err) {
      if (err instanceof StaleAuthSnapshotError) throw err;
      assertGeneration(generation);
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
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function buildSnapshotForSession(
  session: Session,
  generation: number,
): Promise<AuthSnapshot> {
  const user = session.user;
  let profile: Profile | null = null;
  try {
    profile = await getProfile(user.id);
  } catch (err) {
    console.warn("Unable to fetch profile for snapshot:", err);
  }

  const profileWasLoaded=profile!==null;
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
    if (!profile.first_name && fallbackFirst)
      profile.first_name = fallbackFirst;
    if (!profile.last_name && fallbackLast) profile.last_name = fallbackLast;
  }

  assertGeneration(generation);
  return cacheAuthSnapshot({ session, profile },profileWasLoaded);
}

function sharedSnapshot(session: Session, generation: number) {
  if (profileFlight?.generation === generation && profileFlight.userId === session.user.id)
    return profileFlight.promise;
  const promise = buildSnapshotForSession(session, generation);
  profileFlight = { generation, userId: session.user.id, promise };
  void promise.finally(() => {
    if (profileFlight?.promise === promise) profileFlight = null;
  }).catch(() => {});
  return promise;
}

export async function getAuthSnapshot(
  session?: Session | null,
): Promise<AuthSnapshot> {
  if (clerkEnabled && session === undefined) {
    const current = await getSession({ validate: true });
    return getAuthSnapshot(current);
  }
  if (session !== undefined) {
    const generation = observeIdentity(session?.user.id ?? null);
    if (!session?.user) {
      return cacheAuthSnapshot({ session: null, profile: null });
    }
    // Session validation still happens above. Reuse only a recently fetched
    // profile for this same identity; never extend its original freshness window.
    if(cachedSnapshot?.session?.user.id===session.user.id&&isCurrentAuthSnapshot(cachedSnapshot)&&Date.now()<profileFreshUntil)return cacheAuthSnapshot({session,profile:cachedSnapshot.profile});
    return sharedSnapshot(session, generation);
  }
  if (inFlightSnapshot) return inFlightSnapshot;
  const startedGeneration = authGeneration;
  const pending = (async (): Promise<AuthSnapshot> => {
    if (!supabase) return getAuthSnapshot(null);
    const { data, error } = await supabase.auth.getSession();
    assertGeneration(startedGeneration);
    if (error || !data.session?.user) return getAuthSnapshot(null);
    const activeSession = data.session;
    const generation = observeIdentity(activeSession.user.id);
    const { data: userData, error: userError } = await supabase.auth.getUser(
      activeSession.access_token,
    );
    assertGeneration(generation);
    if (userData.user && userData.user.id !== activeSession.user.id)
      throw new StaleAuthSnapshotError();
    if (userError || !userData.user) {
      await clearStaleSession();
      return getAuthSnapshot(null);
    }
    return sharedSnapshot(
      { ...activeSession, user: userData.user },
      generation,
    );
  })();
  inFlightSnapshot = pending;
  try {
    return await pending;
  } finally {
    if (inFlightSnapshot === pending) inFlightSnapshot = null;
  }
}

export function subscribeToAuthChanges(
  onChange: (snapshot: AuthSnapshot) => void,
  onIdentityChange?: () => void,
) {
  if (clerkEnabled) {
    let active = true;
    const off = subscribeClerk(() => {
      onIdentityChange?.();
      void getAuthSnapshot()
        .then((snapshot) => {
          if (active && isCurrentAuthSnapshot(snapshot)) onChange(snapshot);
        })
        .catch(() => {});
    });
    return () => {
      active = false;
      off();
    };
  }
  if (!supabase) return () => undefined;
  let active = true;
  let revision = 0;
  let lastIdentity = cachedSnapshot?.session?.user.id ?? null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const currentRevision = ++revision;
    clearTimeout(timer);
    const nextIdentity = session?.user.id ?? null;
    observeIdentity(nextIdentity);
    if (lastIdentity !== nextIdentity) {
      lastIdentity = nextIdentity;
      onIdentityChange?.();
    }
    if (!session?.user) {
      clearDraftStorage();
      onChange(cacheAuthSnapshot({ session: null, profile: null }));
      return;
    }
    if (cachedSnapshot?.session?.user.id !== session.user.id)
      cachedSnapshot = null;
    timer = setTimeout(() => {
      void (
        event === "INITIAL_SESSION"
          ? getAuthSnapshot()
          : getAuthSnapshot(session)
      )
        .then((snapshot) => {
          if (
            active &&
            revision === currentRevision &&
            isCurrentAuthSnapshot(snapshot)
          )
            onChange(snapshot);
        })
        .catch(() => {
          // The protected route's explicit snapshot read reports connection failures.
        });
    }, 0);
  });
  return () => {
    active = false;
    revision++;
    clearTimeout(timer);
    data.subscription.unsubscribe();
  };
}

export function destinationForProfile(
  profile: Pick<Profile, "onboarding_complete"> | null,
): "/onboarding" | "/dashboard" {
  return profile?.onboarding_complete ? "/dashboard" : "/onboarding";
}

export function incompleteProfile(
  profile: Omit<Profile, "onboarding_complete">,
): Profile {
  return { ...profile, onboarding_complete: false };
}

export async function destinationForUser(user: User) {
  if (cachedSnapshot?.session?.user.id === user.id && isCurrentAuthSnapshot(cachedSnapshot))
    return destinationForProfile(cachedSnapshot.profile);
  const profile = await getProfile(user.id);
  return profile?.onboarding_complete ? "/dashboard" : "/onboarding";
}

export function friendlyAuthError(error: unknown) {
  if (
    clerkEnabled &&
    typeof error === "object" &&
    error &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const first = error.errors[0];
    return String(
      first?.longMessage ??
        first?.message ??
        "Authentication failed. Please try again.",
    );
  }
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  if (message.startsWith("PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"))
    return message.slice(message.indexOf(":") + 1).trim();
  if (/password should (?:be|contain)/i.test(message)) return message;
  if (
    /PASSWORD_DOES_NOT_MEET_REQUIREMENTS|password.*(weak|strength|policy|requirements)/i.test(
      message,
    )
  )
    return "Use at least 8 characters with uppercase, lowercase, a number and a symbol.";
  if (/UNAUTHORIZED_PROFILE_MUTATION/i.test(message))
    return "You do not have permission to modify this profile.";
  if (/UNAUTHENTICATED/i.test(message))
    return "You must be signed in to save your profile.";
  if (
    /email.*already.*registered|user already registered|user already exists/i.test(
      message,
    )
  )
    return "That email is already registered. Try logging in instead.";
  if (
    /invalid login credentials|invalid_credentials|user not found/i.test(
      message,
    )
  )
    return "Those details do not match an account. Check your email and password, or reset your password.";
  if (/email not confirmed|email_not_confirmed/i.test(message))
    return "Please confirm your email address before logging in. Check your inbox for the confirmation link.";
  if (/invalid api key|invalid.*(publishable|anon).*key|apikey/i.test(message))
    return "The authentication key is not accepted by Supabase. Check the local project configuration.";
  if (/network|fetch|failed to connect|timeout/i.test(message))
    return "We could not reach Supabase. Check your connection and try again.";
  if (/rate limit|too many/i.test(message))
    return "Too many attempts. Please wait a moment and try again.";
  return message || "An unexpected authentication error occurred.";
}

export async function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  if (clerkEnabled) return clerkSignUp(input);
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  if (!isPasswordPolicySatisfied(input.password)) {
    throw new Error(
      `PASSWORD_DOES_NOT_MEET_REQUIREMENTS: ${passwordPolicyError(input.password)}`,
    );
  }
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        terms_version: "2026-10-29",
        privacy_version: "2026-10-29",
        policies_accepted_at: new Date().toISOString(),
      },
    },
  });
}

export async function signIn(email: string, password: string) {
  if (clerkEnabled) return clerkSignIn(email, password);
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  if (clerkEnabled) return clerkGoogle();
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  if (!(await getAuthProviders()).google)
    throw new Error(
      "Google sign-in is not enabled. Please use email and password.",
    );
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function sendPasswordReset(email: string) {
  if (clerkEnabled) return clerkReset(email);
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function resendVerification(email: string) {
  if (clerkEnabled) return clerkResend();
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  return supabase.auth.resend({ type: "signup", email });
}

export async function updatePassword(password: string, code?: string) {
  if (clerkEnabled) return clerkUpdatePassword(password, code);
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  if (!isPasswordPolicySatisfied(password)) {
    throw new Error(
      `PASSWORD_DOES_NOT_MEET_REQUIREMENTS: ${passwordPolicyError(password)}`,
    );
  }
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  if (clerkEnabled) {
    invalidateAuth(null);
    clearDraftStorage();
    await clerkSignOut();
    return;
  }
  invalidateAuth(null);
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
  "education_degree",
  "graduation_year",
  "education_score",
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

export async function saveProfile(
  profile: Omit<Profile, "id"> & { id: string },
) {
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

  const { data, error } = await supabase
    .from("profiles")
    .upsert(sanitizedProfile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  const saved = data as Profile;
  if (cachedSnapshot?.session?.user.id === profile.id) {
    cacheAuthSnapshot({ session: cachedSnapshot.session, profile: saved });
  }
  return saved;
}

onClerkIdentityInvalidated((clearDrafts) => {
  invalidateAuth(undefined);
  if (clearDrafts) clearDraftStorage();
});
