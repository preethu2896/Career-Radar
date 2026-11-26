import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, Building2, UsersRound, ChevronDown, UserRound } from "lucide-react";
import {
  getAuthSnapshot,
  getCachedAuthSnapshot,
  isCurrentAuthSnapshot,
  subscribeToAuthChanges,
  signOut,
  StaleAuthSnapshotError,
  type AuthSnapshot,
} from "../services/auth.js";
import { useAuthReady } from "./ClerkRoot.js";
import "./siteHeader.css";
export function useSiteAccount() {
  const ready = useAuthReady();
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(() =>
    getCachedAuthSnapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError("");
    const apply = (next: AuthSnapshot) => {
      if (active && isCurrentAuthSnapshot(next)) {
        setSnapshot(next);
        setLoading(false);
        setError("");
      }
    };
    const read = (attempt = 0) => {
      void getAuthSnapshot()
        .then((next) => {
          if (!active) return;
          if (!isCurrentAuthSnapshot(next)) throw new StaleAuthSnapshotError();
          apply(next);
        })
        .catch((err) => {
          if (active) {
            // Initial Clerk hydration or a transient mapping request may race a
            // route refresh. Retry once, keeping the same verified identity path.
            if (attempt === 0) {
              read(1);
              return;
            }
            console.warn(
              "CareerRadar account loading failed:",
              err instanceof Error ? err.message : "Unknown error",
            );
            setLoading(false);
            setError("Account information could not be loaded. Please retry.");
          }
        });
    };
    read();
    const unsubscribe = subscribeToAuthChanges(apply, () => {
      if (active) {
        setSnapshot(null);
        setLoading(true);
        read();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ready, revision]);
  return {
    snapshot,
    userId: snapshot?.session?.user.id ?? null,
    loading,
    error,
    retry: () => setRevision((value) => value + 1),
  };
}
export type SiteAccount = ReturnType<typeof useSiteAccount>;
export function SiteHeader({
  navigate,
  path,
}: {
  navigate: (path: string) => void;
  path: string;
}) {
  const account = useSiteAccount();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
      navigate("/");
    } catch {
      setError("Could not sign out. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="sf-header cr-site-navbar">
        <a
          className="auth-logo"
          href="/jobs"
          aria-label="CareerRadar — jobs, back to top"
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            if (window.location.pathname === "/jobs") {
              event.preventDefault();
              event.stopPropagation();
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
            }
          }}
        >
          <img className="cr-navbar-mark" src="/careerradar-logo.png" width={28} height={28} alt="" aria-hidden="true" decoding="async" />
          <span className="cr-navbar-wordmark">career<span>radar</span></span>
        </a>
        <nav className="cr-market-tabs" aria-label="Explore CareerRadar">
          <a href="/jobs" aria-current={path === '/jobs' || path === '/explore' || path === '/dashboard' || path === '/radar' || (path.startsWith('/jobs/') && path.split('/').length < 5) ? 'page' : undefined}><BriefcaseBusiness size={15} aria-hidden="true"/><span>Jobs</span></a>
          <a href="/companies" aria-current={path.startsWith('/companies') || (path.startsWith('/jobs/') && path.split('/').length >= 5) ? 'page' : undefined}><Building2 size={15} aria-hidden="true"/><span>Companies</span></a>
          <a href="/refer" aria-current={path === '/refer' ? 'page' : undefined} title="Referrals · Coming soon"><UsersRound size={15} aria-hidden="true"/><span>Refer</span></a>
        </nav>
        <div className="sf-account">
          <a href="/pricing">Pricing</a>
          {account.userId ? (
            <details ref={menu} className="sf-account-menu">
              <summary aria-label="Profile menu">
                <UserRound
                  className="sf-mobile-account-icon"
                  size={18}
                  aria-hidden="true"
                />
                <span>Profile</span>
                <ChevronDown className="sf-account-chevron" size={14} />
              </summary>
              <div>
                <a href="/profile">Profile</a>
                <a href="/tracker">Tracker</a>
                <button disabled={busy} onClick={() => void logout()}>
                  {busy ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </details>
          ) : (
            <a className="auth-secondary" href="/login" aria-label="Sign in">
              <UserRound
                className="sf-mobile-account-icon"
                size={18}
                aria-hidden="true"
              />
              <span>Sign in</span>
            </a>
          )}
        </div>
      </header>
      {error ? (
        <p className="cr-error sf-header-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
