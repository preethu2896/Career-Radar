import {
  clerkEnabled,
  clerkCodeRequired,
  verifyClerkCode,
  clerkCallback,
} from "../services/clerkAuth.js";
import { RequiredMark } from "./RequiredMark.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import { SavedResumePanel } from "./SavedResumePanel.js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  X,
} from "lucide-react";
import {
  authConfigured,
  destinationForProfile,
  destinationForUser,
  passwordPolicyError,
  friendlyAuthError,
  getCachedAuthSnapshot,
  isCurrentAuthSnapshot,
  StaleAuthSnapshotError,
  getAuthSnapshot,
  getSession,
  getAuthProviders,
  incompleteProfile,
  isPasswordPolicySatisfied,
  resendVerification,
  safeInternalRedirect,
  saveProfile,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  subscribeToAuthChanges,
  supabase,
  updatePassword,
  type AuthSnapshot,
  type Profile,
} from "../services/auth.js";

type Navigate = (path: string) => void;
type AuthMode = "signup" | "login";

export type ProtectedTarget = "onboarding" | "dashboard" | "profile" | "account";

export function resolveProtectedDestination(
  target: ProtectedTarget,
  snapshot: AuthSnapshot | null,
): { shouldRedirect: boolean; destination: string } {
  if (!snapshot?.session?.user) {
    return { shouldRedirect: true, destination: `/login?redirect=/${target}` };
  }
  const destination = destinationForProfile(snapshot.profile);
  if (
    target === "onboarding" && destination === "/dashboard"
  ) {
    return { shouldRedirect: true, destination };
  }
  return { shouldRedirect: false, destination: `/${target}` };
}

export function useProtectedAuth(navigate: Navigate, target: ProtectedTarget) {
  const [state, setState] = useState<{
    loading: boolean;
    userId: string;
    profile: Profile | null;
    error: string;
  }>(() => {
    const cached = getCachedAuthSnapshot();
    if (cached?.session?.user) {
      return {
        loading: false,
        userId: cached.session.user.id,
        profile: cached.profile,
        error: "",
      };
    }
    return { loading: true, userId: "", profile: null, error: "" };
  });

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setState((current) => ({ ...current, loading: false }));
      return () => {
        active = false;
      };
    }
    const apply = (snapshot: Awaited<ReturnType<typeof getAuthSnapshot>>) => {
      if (!active || !isCurrentAuthSnapshot(snapshot)) return;
      const decision = resolveProtectedDestination(target, snapshot);
      if (decision.shouldRedirect) {
        setState({ loading: true, userId: "", profile: null, error: "" });
        navigate(decision.destination);
        return;
      }
      setState({
        loading: false,
        userId: snapshot.session!.user.id,
        profile: snapshot.profile,
        error: "",
      });
    };
    void getAuthSnapshot()
      .then(apply)
      .catch((error) => {
        if (active && !(error instanceof StaleAuthSnapshotError))
          setState({
            loading: false,
            userId: "",
            profile: null,
            error: friendlyAuthError(error),
          });
      });
    const unsubscribe = subscribeToAuthChanges(
      (snapshot) => apply(snapshot),
      () => {
        if (active)
          setState({ loading: true, userId: "", profile: null, error: "" });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, target]);

  return state;
}

function AuthShell({
  children,
  title,
  eyebrow = "",
  compact = false,
  navigate,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  compact?: boolean;
  navigate?: Navigate;
}) {
  const onLogoClick = (event: React.MouseEvent) => {
    if (navigate) {
      event.preventDefault();
      navigate("/");
    }
  };
  return (
    <main className={compact ? "auth-page auth-page-compact" : "auth-page"}>
      <section className="auth-story">
        <a
          className="auth-story-logo"
          href="/"
          onClick={onLogoClick}
          aria-label="Career Radar home"
        >
          career<span>radar</span>
        </a>
        <div className="auth-story-content">
          <span className="auth-kicker">BUILT FOR YOUR NEXT MOVE</span>
          <h1>
            Discover your <em>next opportunity.</em>
          </h1>
          <p>
            The right career move starts with knowing where to look. Discover
            companies beyond the obvious, understand their hiring signals, and
            find opportunities aligned with your goals.
          </p>
          <ul>
            <li>Discover companies across your target cities.</li>
            <li>Understand the evidence behind career opportunities.</li>
            <li>Track companies and build your personal watchlist.</li>
          </ul>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <a
            className="auth-logo"
            href="/"
            onClick={onLogoClick}
            aria-label="Career Radar home"
          >
            career<span>radar</span>
          </a>
          {eyebrow ? <span className="auth-kicker">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}

function ConfigNotice() {
  return !authConfigured ? (
    <div className="auth-preview-notice" role="status">
      <strong>Preview mode</strong>
      <span>
        Authentication is not connected yet. Add <code>VITE_SUPABASE_URL</code>{" "}
        and <code>VITE_SUPABASE_ANON_KEY</code> to enable account actions.
      </span>
    </div>
  ) : null;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string | undefined;
  error?: string | undefined;
  autoComplete?: string | undefined;
}) {
  return (
    <label className="auth-field">
      <span>
        {label}
        {!label.includes("(optional)") ? <RequiredMark /> : null}
      </span>
      <input
        required={!label.includes("(optional)")}
        aria-label={label}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error ? (
        <small id={`${name}-error`} className="auth-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  onFocus,
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  error?: string | undefined;
  autoComplete?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field">
      <span>
        {label}
        <RequiredMark />
      </span>
      <div className="auth-password-wrap">
        <input
          required
          aria-label={label}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? (
        <small id={`${name}-error`} className="auth-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}

function AuthLinks({
  mode,
  navigate,
  onError,
  termsAccepted = false,
}: {
  mode: AuthMode;
  navigate: Navigate;
  onError: (message: string) => void;
  termsAccepted?: boolean;
}) {
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void getAuthProviders()
      .then((p) => {
        if (active) setGoogleEnabled(p.google);
      })
      .catch(() => {
        if (active) setGoogleEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const redirectParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect")
      : null;
  const safeParam = redirectParam
    ? safeInternalRedirect(redirectParam, "")
    : "";
  const switchTarget = mode === "signup" ? "/login" : "/signup";
  const switchUrl = safeParam
    ? `${switchTarget}?redirect=${encodeURIComponent(safeParam)}`
    : switchTarget;

  return (
    <>
      {googleEnabled ? (
        <>
          <div className="auth-divider">
            <span>OR</span>
          </div>
          <button
            className="auth-google"
            type="button"
            disabled={!googleEnabled}
            onClick={async () => {
              try {
                if (mode === "signup" && !termsAccepted)
                  throw new Error(
                    "Accept the terms before continuing with Google.",
                  );
                await signInWithGoogle();
              } catch (error) {
                onError(
                  error instanceof Error &&
                    error.message === "AUTH_NOT_CONFIGURED"
                    ? "Google sign-in is not configured for this environment."
                    : friendlyAuthError(error),
                );
              }
            }}
          >
            <span className="google-mark">G</span>
            {googleEnabled
              ? "Continue with Google"
              : "Google sign-in unavailable"}
          </button>
        </>
      ) : null}
      <p className="auth-switch">
        {mode === "signup"
          ? "Already have an account?"
          : "Don't have an account?"}{" "}
        <button type="button" onClick={() => navigate(switchUrl)}>
          {mode === "signup" ? "Log in" : "Sign up"}
        </button>
      </p>
    </>
  );
}

export function AuthRoute({
  path,
  navigate,
}: {
  path: string;
  navigate: Navigate;
}) {
  const mode: AuthMode = path === "/login" ? "login" : "signup";
  // Capture once: auth listeners may navigate before the submit promise resolves.
  const redirectTarget = useMemo(() => new URLSearchParams(window.location.search).get('redirect'), [path]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const redirect = async (
      session: Awaited<ReturnType<typeof getSession>>,
    ) => {
      if (active && session?.user) {
        const validated = await getSession({ validate: true });
        if (!active || !validated?.user) return;
        const redirectParam = redirectTarget;
        const dest = await destinationForUser(validated.user);
        if (active) navigate(safeInternalRedirect(redirectParam, dest));
      }
    };
    void getSession({ validate: true })
      .then(redirect)
      .catch(() => undefined);
    const unsubscribe = subscribeToAuthChanges((snapshot) => {
      if (active && snapshot.session?.user) {
        const redirectParam = redirectTarget;
        void destinationForUser(snapshot.session.user).then((destination) => {
          if (active)
            navigate(safeInternalRedirect(redirectParam, destination));
        });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const normalizedEmail = email.trim();
    if (mode === "signup" && !firstName.trim())
      next.firstName = "Enter your first name.";
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail))
      next.email = "Enter a valid email address.";
    if (!password) {
      next.password = "Enter your password.";
    } else if (mode === "signup" && !isPasswordPolicySatisfied(password)) {
      next.password =
        passwordPolicyError(password) || "Choose a stronger password.";
    }
    if (mode === "signup" && password !== confirmPassword)
      next.confirmPassword = "Passwords do not match.";
    if (mode === "signup" && !terms)
      next.terms = "Accept the terms to create your account.";
    setErrors(next);
    if (Object.keys(next).length || !authConfigured) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await signUp({
          email: normalizedEmail,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        if (error) throw error;

        // User already exists (identities array empty when anti-enumeration is enabled in Supabase)
        if (
          data.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          setErrors({
            form: "An account with this email address already exists. Try logging in instead.",
          });
          return;
        }

        const redirectParam = redirectTarget;
        const safeNext = redirectParam
          ? safeInternalRedirect(redirectParam, "/onboarding")
          : "/onboarding";

        if (data.session) {
          await getAuthSnapshot(data.session);
          navigate(safeNext);
        } else {
          // Email confirmation is required by Supabase project settings
          setConfirmedEmail(normalizedEmail);
          setConfirmationPending(true);
        }
      } else {
        const { data, error } = await signIn(normalizedEmail, password);
        if (error) throw error;
        if (clerkEnabled && clerkCodeRequired()) {
          setConfirmedEmail(normalizedEmail);
          setConfirmationPending(true);
          return;
        }
        if (!data.user) throw new Error("No authenticated user returned.");
        const snapshot = await getAuthSnapshot(data.session);
        navigate(
          safeInternalRedirect(
            redirectTarget,
            destinationForProfile(snapshot.profile),
          ),
        );
      }
    } catch (error) {
      setErrors({ form: friendlyAuthError(error) });
    } finally {
      setBusy(false);
    }
  };

  if (clerkEnabled && confirmationPending) {
    const verify = async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setErrors({});
      try {
        if (!/^\d{6,8}$/.test(verificationCode.trim()))
          throw new Error("Enter the verification code from your email.");
        const session = await verifyClerkCode(verificationCode.trim());
        if (!session)
          throw new Error("Verification is incomplete. Please try again.");
        const snapshot = await getAuthSnapshot(session);
        navigate(
          safeInternalRedirect(
            redirectTarget,
            destinationForProfile(snapshot.profile),
          ),
        );
      } catch (error) {
        setErrors({ form: friendlyAuthError(error) });
      } finally {
        setBusy(false);
      }
    };
    return (
      <AuthShell title="Check your email" navigate={navigate}>
        <p className="auth-intro">
          Enter the verification code sent to <strong>{confirmedEmail}</strong>.
        </p>
        <form
          className="auth-form"
          noValidate
          onSubmit={(event) => void verify(event)}
        >
          <Field
            label="Verification code"
            name="verificationCode"
            value={verificationCode}
            onChange={setVerificationCode}
            autoComplete="one-time-code"
          />
          {errors.form ? (
            <p className="auth-form-error" role="alert">
              {errors.form}
            </p>
          ) : null}
          <button className="auth-primary" disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="auth-secondary"
            disabled={resending}
            onClick={() => {
              setResending(true);
              void resendVerification(confirmedEmail)
                .then(() => setResendStatus("A new code was sent."))
                .catch((error) => setErrors({ form: friendlyAuthError(error) }))
                .finally(() => setResending(false));
            }}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
          <button
            type="button"
            className="cr-text-button"
            onClick={() => {
              setConfirmationPending(false);
              setVerificationCode("");
              setErrors({});
            }}
          >
            Back
          </button>
        </form>
        {resendStatus ? <p role="status">{resendStatus}</p> : null}
      </AuthShell>
    );
  }
  if (confirmationPending) {
    const redirectParam = redirectTarget;
    const safeNext = redirectParam
      ? safeInternalRedirect(redirectParam, "/onboarding")
      : "/onboarding";
    const loginUrl = safeNext
      ? `/login?redirect=${encodeURIComponent(safeNext)}`
      : "/login";

    const handleResend = async () => {
      setResending(true);
      setResendStatus("");
      try {
        const { error: resendError } = await resendVerification(confirmedEmail);
        if (resendError) throw resendError;
        setResendStatus("Confirmation email resent. Please check your inbox.");
      } catch (err) {
        setResendStatus(friendlyAuthError(err));
      } finally {
        setResending(false);
      }
    };

    return (
      <AuthShell title="Check your email" navigate={navigate}>
        <p className="auth-intro">
          We sent an activation link to <strong>{confirmedEmail}</strong>.
          Please check your inbox and click the link to confirm your account.
        </p>
        <div
          style={{
            margin: "1.25rem 0",
            padding: "1rem",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: "0.9rem",
            color: "var(--text-muted, #94a3b8)",
            lineHeight: "1.5",
          }}
        >
          After confirming your email, log in to continue directly with your
          onboarding progress.
        </div>
        {resendStatus ? (
          <div
            className="auth-success"
            role="status"
            style={{ marginBottom: "1rem" }}
          >
            {resendStatus}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginTop: "1rem",
          }}
        >
          <button
            className="auth-primary"
            type="button"
            onClick={() => navigate(loginUrl)}
          >
            Go to log in
            <ArrowRight size={16} />
          </button>
          <button
            className="auth-secondary"
            type="button"
            disabled={resending}
            onClick={handleResend}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {resending ? "Resending…" : "Resend confirmation email"}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      compact={mode === "signup"}
      title={mode === "signup" ? "Create your account" : "Welcome back"}
      navigate={navigate}
    >
      <ConfigNotice />
      <p className="auth-intro">
        {mode === "signup"
          ? "Find companies that fit you. Keep your next steps in one place."
          : "Pick up where you left off and keep exploring your career possibilities."}
      </p>
      {errors.form ? (
        <div className="auth-form-error" role="alert">
          {errors.form}
        </div>
      ) : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        {mode === "signup" ? (
          <>
            <div className="auth-two-col">
              <Field
                label="First name"
                name="firstName"
                value={firstName}
                onChange={setFirstName}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name (optional)"
                name="lastName"
                value={lastName}
                onChange={setLastName}
                error={errors.lastName}
                autoComplete="family-name"
              />
            </div>
          </>
        ) : null}
        <Field
          label="Email address"
          name="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          type="email"
          placeholder="you@example.com"
          autoComplete="username"
        />
        <PasswordField
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" ? (
          <>
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            <label className="auth-check">
              <input
                type="checkbox"
                required
                aria-invalid={Boolean(errors.terms)}
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
              />{" "}
              <span>
                I accept the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                .<RequiredMark />
              </span>
            </label>
            {errors.terms ? (
              <small className="auth-error">{errors.terms}</small>
            ) : null}
          </>
        ) : (
          <button
            className="auth-forgot"
            type="button"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password?
          </button>
        )}
        <div id="clerk-captcha" />
        <button
          className="auth-primary"
          type="submit"
          disabled={busy || !authConfigured}
        >
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
          <ArrowRight size={16} />
        </button>
      </form>
      <AuthLinks
        termsAccepted={terms}
        mode={mode}
        navigate={navigate}
        onError={(message) => setErrors({ form: message })}
      />
    </AuthShell>
  );
}

export function ForgotPasswordRoute({ navigate }: { navigate: Navigate }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!authConfigured) {
      setError("Password reset is unavailable until Supabase is configured.");
      return;
    }
    setBusy(true);
    try {
      const { error: requestError } = await sendPasswordReset(email.trim());
      if (requestError) throw requestError;
      setMessage(
        "If an account uses that email, reset instructions will arrive shortly.",
      );
      if (clerkEnabled) navigate("/reset-password");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Reset your password" navigate={navigate}>
      <ConfigNotice />
      <p className="auth-intro">
        Enter your email address and we'll send you instructions to reset your
        password.
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field
          label="Email address"
          name="email"
          value={email}
          onChange={setEmail}
          error={error}
          type="email"
          autoComplete="email"
        />
        <button
          className="auth-primary"
          type="submit"
          disabled={busy || !authConfigured}
        >
          {busy ? "Sending…" : clerkEnabled ? "Send reset code" : "Send reset link"}
          <ArrowRight size={16} />
        </button>
      </form>
      {message ? (
        <div className="auth-success" role="status">
          {message}
        </div>
      ) : null}
      <p className="auth-switch">
        <button type="button" onClick={() => navigate("/login")}>
          Return to login
        </button>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordRoute({ navigate }: { navigate: Navigate }) {
  const [resetCode, setResetCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isPasswordPolicySatisfied(password)) {
      setError(passwordPolicyError(password) || "Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!authConfigured) {
      setError("Password reset is unavailable until Supabase is configured.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await updatePassword(password, resetCode);
      if (updateError) throw updateError;
      setMessage("Your password has been updated. You can now log in.");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Choose a new password" navigate={navigate}>
      <p className="auth-intro">Choose a new password for your account.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {clerkEnabled ? (
          <Field
            label="Verification code"
            name="resetCode"
            value={resetCode}
            onChange={setResetCode}
            autoComplete="one-time-code"
          />
        ) : null}
        <PasswordField
          label="New password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm password"
          name="confirm"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        {error ? (
          <div className="auth-form-error" role="alert">
            {error}
          </div>
        ) : null}
        <button
          className="auth-primary"
          type="submit"
          disabled={busy || !authConfigured}
        >
          {busy ? "Updating…" : "Update password"}
          <ArrowRight size={16} />
        </button>
      </form>
      {message ? (
        <div className="auth-success" role="status">
          {message}{" "}
          <button type="button" onClick={() => navigate("/login")}>
            Log in
          </button>
        </div>
      ) : null}
    </AuthShell>
  );
}

export function AuthCallbackRoute({ navigate }: { navigate: Navigate }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let unsubscribe: () => void = () => undefined;
    const complete = async () => {
      if (!supabase) {
        setError("Authentication is not configured for this environment.");
        return;
      }
      const client = supabase;
      try {
        if (clerkEnabled) {
          const returnTo = new URLSearchParams(window.location.search).get('redirect');
          const session = await getSession();
          if (session) {
            const snapshot = await getAuthSnapshot(session);
            if (active) navigate(safeInternalRedirect(returnTo, destinationForProfile(snapshot.profile)));
          } else await clerkCallback();
          return;
        }
        const current = await getSession();
        if (current?.user) {
          navigate(await destinationForUser(current.user));
          return;
        }
        const returnedSession = await new Promise<
          Awaited<ReturnType<typeof getSession>>
        >((resolve) => {
          const finish = (session: Awaited<ReturnType<typeof getSession>>) => {
            window.clearTimeout(timer);
            unsubscribe();
            resolve(session);
          };
          timer = window.setTimeout(() => finish(null), 2500);
          const subscription = client.auth.onAuthStateChange(
            (_event, session) => {
              if (session?.user) finish(session);
            },
          );
          unsubscribe = () => subscription.data.subscription.unsubscribe();
        });
        if (!returnedSession?.user)
          throw new Error("No authenticated session returned.");
        if (active) navigate(await destinationForUser(returnedSession.user));
      } catch (requestError) {
        if (active) setError(friendlyAuthError(requestError));
      }
    };
    void complete();
    return () => {
      active = false;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [navigate]);
  return (
    <AuthShell
      title={
        error ? "We could not finish signing you in" : "Finishing sign in…"
      }
      eyebrow="AUTHENTICATION"
      navigate={navigate}
    >
      <ConfigNotice />
      {error ? (
        <>
          <div className="auth-form-error" role="alert">
            {error}
          </div>
          <button
            className="auth-primary"
            type="button"
            onClick={() => navigate("/login")}
          >
            Return to login
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <LoadingSkeleton label="Preparing your account" />
      )}
    </AuthShell>
  );
}

const roleOptions = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full-Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "AI/ML Engineer",
  "Product Designer",
  "Product Manager",
  "Cybersecurity Engineer",
  "DevOps Engineer",
];
const skillOptions = [
  "Python",
  "JavaScript",
  "React",
  "SQL",
  "Java",
  "Machine Learning",
  "Cloud",
  "Figma",
];
const cityOptions = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Anywhere in India",
  "Remote",
];
const workOptions = ["On-site", "Hybrid", "Remote"];
const industryOptions = [
  "Applied AI",
  "SaaS",
  "Fintech",
  "Healthtech",
  "Climate",
  "Consumer technology",
];

function ChoiceRow({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={
            selected.includes(option) ? "choice-chip selected" : "choice-chip"
          }
          onClick={() => onToggle(option)}
          aria-pressed={selected.includes(option)}
        >
          <span className="choice-chip-text">{option}</span>
          {selected.includes(option) ? (
            <Check size={14} className="choice-chip-icon" />
          ) : (
            <Plus size={14} className="choice-chip-icon" />
          )}
        </button>
      ))}
    </div>
  );
}
function TagInput({
  values,
  setValues,
  placeholder,
}: {
  values: string[];
  setValues: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !values.includes(value)) setValues([...values, value]);
    setDraft("");
  };
  return (
    <div className="tag-input">
      <div className="tag-list">
        {values.map((value) => (
          <span className="tag" key={value}>
            {value}
            <button
              type="button"
              onClick={() => setValues(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <button type="button" onClick={add} aria-label="Add item">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function OnboardingRoute({ navigate }: { navigate: Navigate }) {
  const auth = useProtectedAuth(navigate, "onboarding");
  const { loading, userId, profile, error: authError } = auth;
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [careerStage, setCareerStage] = useState("");
  const [experience, setExperience] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [workPreferences, setWorkPreferences] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");
  useEffect(() => {
    const existing = profile;
    if (!existing) return;
    setFirstName(existing.first_name || "");
    setLastName(existing.last_name || "");
    setCareerStage(existing.career_stage || "");
    setExperience(existing.experience_level || "");
    setRoles(existing.target_roles || []);
    setSkills(existing.skills || []);
    setCities(existing.preferred_cities || []);
    setWorkPreferences(existing.work_preferences || []);
    setIndustries(existing.industries || []);
  }, [profile]);
  const toggle = (
    values: string[],
    setValues: (next: string[]) => void,
    value: string,
  ) =>
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  const continueStep = () => {
    if (
      step === 1 &&
      (!firstName.trim() || !lastName.trim() || !careerStage || !experience)
    ) {
      setError("Complete the required fields before continuing.");
      return;
    }
    setError("");
    setStep(Math.min(3, step + 1));
  };
  const finish = async () => {
    if (!authConfigured) {
      setError(
        "Supabase is not configured, so this preview cannot save a profile.",
      );
      return;
    }
    if (!userId) {
      setError(
        "You're previewing onboarding. Sign in or create an account to save your profile.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile({
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        career_stage: careerStage,
        experience_level: experience,
        target_roles:
          customRole.trim() && !roles.includes(customRole.trim())
            ? [...roles, customRole.trim()]
            : roles,
        skills,
        preferred_cities: cities,
        work_preferences: workPreferences,
        industries,
        onboarding_complete: true,
      });
      navigate("/dashboard");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };
  const completeLater = async () => {
    if (!userId) {
      navigate("/");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile(
        incompleteProfile({
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          career_stage: careerStage || null,
          experience_level: experience || null,
          target_roles: roles,
          skills,
          preferred_cities: cities,
          work_preferences: workPreferences,
          industries,
        }),
      );
      navigate("/");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };
  const summary = useMemo(
    () =>
      [
        careerStage,
        experience,
        roles.join(", "),
        skills.join(", "),
        cities.join(", "),
        workPreferences.join(", "),
        industries.join(", "),
      ].filter(Boolean),
    [
      careerStage,
      experience,
      roles,
      skills,
      cities,
      workPreferences,
      industries,
    ],
  );
  if (loading)
    return (
      <AuthShell title="Loading your profile" navigate={navigate}>
        <LoadingSkeleton label="Checking your secure session" />
      </AuthShell>
    );
  if (authError)
    return (
      <AuthShell title="We could not load your profile" navigate={navigate}>
        <div className="auth-form-error" role="alert">
          {authError}
        </div>
        <button
          className="auth-primary"
          type="button"
          onClick={() => navigate("/login?redirect=/onboarding")}
        >
          Return to login
          <ArrowRight size={16} />
        </button>
      </AuthShell>
    );
  if (!authConfigured)
    return (
      <AuthShell title="Set up your profile" navigate={navigate}>
        <ConfigNotice />
        <p className="auth-intro">
          Candidate onboarding is ready, but it needs a connected Supabase
          project before it can save profile information.
        </p>
        <button
          className="auth-primary"
          type="button"
          onClick={() => navigate("/signup")}
        >
          Return to sign up
          <ArrowRight size={16} />
        </button>
      </AuthShell>
    );
  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <a
          className="auth-logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          aria-label="Career Radar home"
        >
          career<span>radar</span>
        </a>
        <div className="onboarding-progress">
          <span>STEP {step} OF 3</span>
          <div>
            <i style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
        {step === 1 ? (
          <>
            <span className="auth-kicker">ABOUT YOU</span>
            <h1>Let's start with you</h1>
            <p className="onboarding-intro">
              A little context helps Career Radar shape a more useful company
              discovery experience.
            </p>
            <div className="auth-two-col">
              <Field
                label="First name"
                name="firstName"
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name (optional)"
                name="lastName"
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
              />
            </div>
            <label className="auth-field">
              <span>Career stage</span>
              <select
                value={careerStage}
                onChange={(event) => setCareerStage(event.target.value)}
              >
                <option value="">Choose one</option>
                <option>Student / Fresher</option>
                <option>Experienced professional</option>
                <option>Career switcher</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Experience level</span>
              <select
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
              >
                <option value="">Choose one</option>
                <option>No professional experience</option>
                <option>Less than 1 year</option>
                <option>1–2 years</option>
                <option>3–5 years</option>
                <option>6–10 years</option>
                <option>10+ years</option>
              </select>
            </label>
          </>
        ) : step === 2 ? (
          <>
            <span className="auth-kicker">YOUR DIRECTION</span>
            <h1>Tell us what you'd like to explore</h1>
            <p className="onboarding-intro">
              These preferences stay yours. Add only what feels useful right
              now.
            </p>
            <label className="auth-field">
              <span>Target roles</span>
              <ChoiceRow
                options={roleOptions}
                selected={roles}
                onToggle={(value) => toggle(roles, setRoles, value)}
              />
              <TagInput
                values={customRole ? [customRole] : []}
                setValues={(values) => setCustomRole(values[0] || "")}
                placeholder="Add another role"
              />
            </label>
            <label className="auth-field">
              <span>Skills and technologies</span>
              <ChoiceRow
                options={skillOptions}
                selected={skills}
                onToggle={(value) => toggle(skills, setSkills, value)}
              />
              <TagInput
                values={skills.filter((value) => !skillOptions.includes(value))}
                setValues={(values) =>
                  setSkills([
                    ...skills.filter((value) => skillOptions.includes(value)),
                    ...values,
                  ])
                }
                placeholder="Add another skill"
              />
            </label>
          </>
        ) : (
          <>
            <span className="auth-kicker">YOUR CAREER MARKET</span>
            <h1>Choose where you want to work</h1>
            <p className="onboarding-intro">
              You can change these preferences later. Optional fields can be
              skipped.
            </p>
            <label className="auth-field">
              <span>Preferred locations</span>
              <ChoiceRow
                options={cityOptions}
                selected={cities}
                onToggle={(value) => toggle(cities, setCities, value)}
              />
            </label>
            <label className="auth-field">
              <span>Work preferences</span>
              <ChoiceRow
                options={workOptions}
                selected={workPreferences}
                onToggle={(value) =>
                  toggle(workPreferences, setWorkPreferences, value)
                }
              />
            </label>
            <label className="auth-field">
              <span>
                Industries <small>(optional)</small>
              </span>
              <ChoiceRow
                options={industryOptions}
                selected={industries}
                onToggle={(value) => toggle(industries, setIndustries, value)}
              />
            </label>
            <div className="onboarding-summary">
              <strong>Your starting map</strong>
              {summary.length ? (
                <span>{summary.join(" · ")}</span>
              ) : (
                <span>No optional preferences selected yet.</span>
              )}
            </div>
          </>
        )}
        {error || authError ? (
          <div className="auth-form-error" role="alert">
            {error || authError}
          </div>
        ) : null}
        <div className="onboarding-actions">
          {step > 1 ? (
            <button
              className="auth-secondary"
              type="button"
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              Back
            </button>
          ) : (
            <button
              className="auth-secondary"
              type="button"
              onClick={() => void completeLater()}
              disabled={busy}
            >
              Complete later
            </button>
          )}
          {step < 3 ? (
            <button
              className="auth-primary"
              type="button"
              onClick={continueStep}
              disabled={busy}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="auth-primary"
              type="button"
              onClick={finish}
              disabled={busy}
            >
              {busy ? "Saving…" : "Explore Career Radar"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function DashboardRoute({ navigate }: { navigate: Navigate }) {
  const auth = useProtectedAuth(navigate, "dashboard");
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const { loading, profile, error } = auth;
  if (loading)
    return (
      <AuthShell title="Loading your radar" navigate={navigate}>
        <LoadingSkeleton label="Checking your secure session" />
      </AuthShell>
    );
  if (error)
    return (
      <AuthShell title="We could not load your radar" navigate={navigate}>
        <div className="auth-form-error" role="alert">
          {error}
        </div>
        <button
          className="auth-primary"
          type="button"
          onClick={() => navigate("/login?redirect=/dashboard")}
        >
          Return to login
          <ArrowRight size={16} />
        </button>
      </AuthShell>
    );
  if (!authConfigured)
    return (
      <AuthShell title="Your Career Radar preview" navigate={navigate}>
        <ConfigNotice />
        <p className="auth-intro">
          Connect Supabase to access a protected candidate dashboard. The
          existing landing-page preview remains available from the home page.
        </p>
        <button
          className="auth-primary"
          type="button"
          onClick={() => navigate("/signup")}
        >
          Return to sign up
          <ArrowRight size={16} />
        </button>
      </AuthShell>
    );
  const logout = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
      navigate("/");
    } catch (requestError) {
      setLogoutError(friendlyAuthError(requestError));
    } finally {
      setLoggingOut(false);
    }
  };
  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <a
          className="auth-logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          aria-label="Career Radar home"
        >
          career<span>radar</span>
        </a>
        <button
          className="auth-secondary"
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </header>
      <section className="dashboard-content">
        <span className="auth-kicker">YOUR RADAR</span>
        <h1>Welcome, {profile?.first_name || "there"}.</h1>
        <p>Here is the starting map for the career direction you chose.</p>
        <div className="dashboard-grid">
          <article>
            <span>ROLES</span>
            <strong>
              {profile?.target_roles.length
                ? profile.target_roles.join(", ")
                : "No roles selected yet"}
            </strong>
          </article>
          <article>
            <span>PLACES</span>
            <strong>
              {profile?.preferred_cities.length
                ? profile.preferred_cities.join(", ")
                : "Anywhere you choose"}
            </strong>
          </article>
          <article className="dashboard-demo">
            <span>ILLUSTRATIVE PREVIEW</span>
            <strong>Sample company discovery</strong>
            <p>
              Connect verified company and job data later. Nothing shown here is
              a live hiring claim.
            </p>
            <button type="button" onClick={() => navigate("/")}>
              Back to Career Radar
              <ArrowRight size={16} />
            </button>
          </article>
        </div>
        {auth.userId ? (
          <SavedResumePanel key={auth.userId} userId={auth.userId} />
        ) : null}
        {logoutError ? (
          <div className="auth-form-error" role="alert">
            {logoutError}
          </div>
        ) : null}
      </section>
    </main>
  );
}
