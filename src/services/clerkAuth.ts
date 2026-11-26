import type { Session, User } from "@supabase/supabase-js";
import type { useClerk, useSignIn, useSignUp } from "@clerk/react";
export const clerkEnabled = import.meta.env.VITE_AUTH_PROVIDER === "clerk";
export const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
type Runtime = {
  clerk: ReturnType<typeof useClerk>;
  signIn: ReturnType<typeof useSignIn>["signIn"];
  signUp: ReturnType<typeof useSignUp>["signUp"];
};
let runtime: Runtime | null = null;
let pending: "signup" | "signin" | "reset" | null = null;
let identityKey = "";
let mapped: { subject: string; id: string } | null = null;
let identityFlight: Promise<string> | null = null;
let generation = 0;
const listeners = new Set<() => void>();
let invalidate: (clearDrafts: boolean) => void = () => {};
export function onClerkIdentityInvalidated(
  callback: (clearDrafts: boolean) => void,
) {
  invalidate = callback;
}
export function installClerkRuntime(next: Runtime) {
  runtime = next;
  const key =
    (next.clerk.user?.id ?? "") + ":" + (next.clerk.session?.id ?? "");
  if (key !== identityKey) {
    const clearDrafts =
      Boolean(identityKey.split(":")[0]) &&
      identityKey.split(":")[0] !== next.clerk.user?.id;
    identityKey = key;
    generation++;
    mapped = null;
    identityFlight = null;
    invalidate(clearDrafts);
    for (const listener of listeners) listener();
  }
}
export function subscribeClerk(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function current() {
  if (!runtime?.clerk.loaded)
    throw new Error("Authentication is still loading. Please try again.");
  return runtime;
}
export async function clerkAccessToken() {
  return runtime?.clerk.session?.getToken() ?? null;
}
function check(result: { error: unknown }) {
  if (result.error) throw result.error;
}
export async function clerkSession(validate = false): Promise<Session | null> {
  const app = current().clerk;
  if (!app.session || !app.user) return null;
  const revision = generation,
    subject = app.user.id;
  // Clerk refreshes expired tokens automatically. Forcing a network refresh on
  // every protected read adds round trips; backend JWT/RLS checks still apply.
  const token = await app.session.getToken();
  if (!token) return null;
  if (!mapped || mapped.subject !== subject) {
    identityFlight ??= (async () => {
      const response = await fetch(
        import.meta.env.VITE_SUPABASE_URL + "/functions/v1/candidate-identity",
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
            Authorization: "Bearer " + token,
          },
          signal: AbortSignal.timeout(40000),
        },
      );
      if (!response.ok)
        throw new Error(
          "Your account could not be verified. Please retry signing in.",
        );
      const body = await response.json();
      if (!/^[0-9a-f-]{36}$/i.test(body.user_id))
        throw new Error("Invalid account identity.");
      if (generation !== revision)
        throw new Error(
          "Authentication changed while loading. Please try again.",
        );
      mapped = { subject, id: body.user_id };
      return body.user_id as string;
    })();
    try {
      await identityFlight;
    } finally {
      if (generation === revision) identityFlight = null;
    }
  }
  if (generation !== revision || !mapped || mapped.subject !== subject)
    throw new Error("Authentication changed while loading. Please try again.");
  const user = {
    id: mapped.id,
    aud: "authenticated",
    app_metadata: { provider: "clerk" },
    user_metadata: {
      ...app.user.unsafeMetadata,
      first_name:
        app.user.firstName ?? app.user.unsafeMetadata.first_name ?? "",
      last_name: app.user.lastName ?? app.user.unsafeMetadata.last_name ?? "",
    },
    created_at: app.user.createdAt?.toISOString() ?? "",
    email: app.user.primaryEmailAddress?.emailAddress,
  } as User;
  return {
    access_token: token,
    refresh_token: "",
    expires_in: 60,
    token_type: "bearer",
    user,
  };
}
export function clerkCodeRequired() {
  return pending === "signup" || pending === "signin";
}
async function finishSignIn() {
  const { signIn } = current();
  if (signIn.status === "complete") {
    check(await signIn.finalize({ navigate: async () => {} }));
    pending = null;
    return clerkSession(true);
  }
  if (
    signIn.status === "needs_client_trust" ||
    signIn.status === "needs_second_factor"
  ) {
    check(await signIn.mfa.sendEmailCode());
    pending = "signin";
    return null;
  }
  throw new Error(
    "Sign-in needs another verification step. Please restart sign-in.",
  );
}
export async function clerkSignIn(email: string, password: string) {
  check(await current().signIn.password({ emailAddress: email, password }));
  const session = await finishSignIn();
  return { data: { session, user: session?.user ?? null }, error: null };
}
export async function clerkSignUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const { signUp } = current();
  check(
    await signUp.password({
      emailAddress: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      legalAccepted: true,
      unsafeMetadata: {
        first_name: input.firstName,
        last_name: input.lastName,
        terms_version: "2026-10-29",
        privacy_version: "2026-10-29",
        policies_accepted_at: new Date().toISOString(),
      },
    }),
  );
  if (signUp.status === "complete") {
    check(await signUp.finalize({ navigate: async () => {} }));
    const session = await clerkSession(true);
    return { data: { session, user: session?.user ?? null }, error: null };
  }
  check(await signUp.verifications.sendEmailCode());
  pending = "signup";
  return { data: { session: null, user: null }, error: null };
}
export async function verifyClerkCode(code: string) {
  if (pending === "signup") {
    const { signUp } = current();
    check(await signUp.verifications.verifyEmailCode({ code }));
    if (signUp.status !== "complete")
      throw new Error(
        "Verification is incomplete. Check the code and try again.",
      );
    check(await signUp.finalize({ navigate: async () => {} }));
    pending = null;
    return clerkSession(true);
  }
  if (pending === "signin") {
    check(await current().signIn.mfa.verifyEmailCode({ code }));
    return finishSignIn();
  }
  throw new Error("Start sign-in again to request a new verification code.");
}
export async function clerkResend() {
  if (pending === "signup")
    check(await current().signUp.verifications.sendEmailCode());
  else if (pending === "signin")
    check(await current().signIn.mfa.sendEmailCode());
  else throw new Error("Request a new verification code by starting again.");
  return { error: null };
}
export async function clerkGoogle() {
  const { safeInternalRedirect } = await import('./auth.js');
  const destination = safeInternalRedirect(new URLSearchParams(window.location.search).get('redirect'), '/onboarding');
  check(
    await current().signIn.sso({
      strategy: "oauth_google",
      redirectUrl: window.location.origin + destination,
      redirectCallbackUrl: window.location.origin + '/auth/callback?redirect=' + encodeURIComponent(destination),
    }),
  );
}
export async function clerkCallback() {
  const { safeInternalRedirect } = await import('./auth.js');
  const destination = safeInternalRedirect(new URLSearchParams(window.location.search).get('redirect'), '/onboarding');
  await current().clerk.handleRedirectCallback({
    signInFallbackRedirectUrl: destination,
    signUpFallbackRedirectUrl: destination,
    signInUrl: "/login",
    signUpUrl: "/signup",
  });
}
export async function clerkReset(email: string) {
  check(await current().signIn.create({ identifier: email }));
  check(await current().signIn.resetPasswordEmailCode.sendCode());
  pending = "reset";
  return { error: null };
}
export async function clerkUpdatePassword(password: string, code?: string) {
  if (pending !== "reset")
    throw new Error(
      "Request a password reset code before changing your password.",
    );
  const { signIn } = current();
  if (signIn.status !== "needs_new_password") {
    if (!code?.trim())
      throw new Error("Enter the verification code from your email.");
    check(
      await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }),
    );
  }
  check(await signIn.resetPasswordEmailCode.submitPassword({ password }));
  await finishSignIn();
  return { error: null };
}
export async function clerkSignOut() {
  pending = null;
  await current().clerk.signOut();
}

export async function clerkChangePassword(currentPassword:string,newPassword:string){
 const user=current().clerk.user;if(!user)throw Error('Sign in again to change your password.');
 await user.updatePassword({currentPassword,newPassword,signOutOfOtherSessions:true});
}
