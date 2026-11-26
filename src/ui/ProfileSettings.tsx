import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, X } from "lucide-react";
import { useProtectedAuth } from "./AuthFlows.js";
import {
  friendlyAuthError,
  getCachedAuthSnapshot,
  getProfile,
  saveProfile,
  type Profile,
} from "../services/auth.js";
import { ROLE_TITLES } from "../services/careerCatalog.js";
import {
  CITY_SUGGESTIONS,
  canonicalLocation,
} from "../services/directoryPolicy.js";
import { SuggestionPicker } from "./SuggestionPicker.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import {
  downloadSavedResume,
  getSavedResume,
  saveResume,
  removeSavedResume,
  type SavedResume,
} from "../services/resumeStorage.js";
import "./candidateWorkspace.css";
import "./profileSettings.css";
import portrait from "../../imagee1.webp";

type Navigate = (path: string) => void;
export function ProfileSettingsRoute({
  navigate,
  welcome = false,
}: {
  navigate: Navigate;
  welcome?: boolean;
}) {
  const auth = useProtectedAuth(navigate, welcome ? "onboarding" : "profile");
  if (auth.loading)
    return (
      <main className="cr-loading">
        <LoadingSkeleton label="Loading your account" />
      </main>
    );
  if (auth.error)
    return (
      <main className="cr-loading">
        <p role="alert">{auth.error}</p>
        <button
          className="auth-secondary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  if (!auth.userId || !auth.profile) return null;
  return (
    <ProfileSettings
      key={auth.userId}
      initial={auth.profile}
      email={getCachedAuthSnapshot()?.session?.user.email ?? ""}
      navigate={navigate}
      welcome={welcome}
    />
  );
}
function ProfileSettings({
  initial,
  email,
  navigate,
  welcome,
}: {
  initial: Profile;
  email: string;
  navigate: Navigate;
  welcome: boolean;
}) {
  const [profile, setProfile] = useState(initial);
  const [first, setFirst] = useState(initial.first_name);
  const [last, setLast] = useState(initial.last_name);
  const [roles, setRoles] = useState(initial.target_roles);
  const [cities, setCities] = useState([
    ...new Set(initial.preferred_cities.map(canonicalLocation)),
  ]);
  const [modes, setModes] = useState(initial.work_preferences);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    document.title = `${welcome ? "Welcome" : "Your profile"} | CareerRadar`;
  }, [welcome]);
  const submit = async (skip = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Merge only fields this page edits. Existing education, skills, links and
      // resume metadata must survive the shorter onboarding and profile saves.
      const current = await getProfile(profile.id);
      const saved = await saveProfile({
        ...profile,
        ...current,
        ...(skip
          ? {}
          : {
              first_name: first.trim(),
              last_name: last.trim(),
              target_roles: roles,
              preferred_cities: cities,
              work_preferences: modes,
            }),
        onboarding_complete: true,
      });
      if (!mounted.current) return;
      setProfile(saved);
      setMessage("Profile saved.");
      if (welcome) navigate("/jobs");
    } catch (e) {
      if (mounted.current) setError(friendlyAuthError(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const preferences = (
    <>
      <div className="cr-profile-field">
        <span id="profile-roles">Target roles (optional)</span>
        <SuggestionPicker
          label="Search or add a role"
          catalog={ROLE_TITLES}
          selected={roles}
          onAdd={(v) => setRoles((current) => [...current, v].slice(0, 3))}
          limit={3}
          listLabel="Suggested roles"
        />
        <div className="cr-chips">
          {roles.map((role) => (
            <button
              className="cr-chip"
              type="button"
              key={role}
              aria-label={`Remove role ${role}`}
              onClick={() => setRoles(roles.filter((v) => v !== role))}
            >
              {role}
              <X size={14} />
            </button>
          ))}
        </div>
        <small>
          Up to 3 roles. Your choices do not limit the jobs you can browse.
        </small>
      </div>
      <div className="cr-profile-field">
        <span>Preferred locations (optional)</span>
        <SuggestionPicker
          label="Search or add a location"
          catalog={CITY_SUGGESTIONS}
          selected={cities}
          onAdd={(v) =>
            setCities((current) => [
              ...new Set([...current, canonicalLocation(v)]),
            ])
          }
          limit={50}
          listLabel="Suggested locations"
        />
        <div className="cr-chips">
          {cities.map((city) => (
            <button
              className="cr-chip"
              type="button"
              key={city}
              aria-label={`Remove location ${city}`}
              onClick={() => setCities(cities.filter((v) => v !== city))}
            >
              {city}
              <X size={14} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
  const feedback = (
    <>
      {error ? (
        <p className="cr-profile-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="cr-profile-success" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
  if (welcome)
    return (
      <main className="cr-setup cr-welcome">
        <div className="cr-welcome-top">
          <a className="auth-logo" href="/jobs">
            <img src="/careerradar-logo.png" alt="" width="28" height="28" />
            career<span>radar</span>
          </a>
        </div>
        <div className="cr-welcome-layout">
          <aside className="cr-welcome-image">
            <img src={portrait} alt="" />
            <h2>Your next move starts here.</h2>
          </aside>
          <form
            className="cr-welcome-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="cr-welcome-greeting"><div><h1>Make it yours.</h1>
            <p>Set a few preferences, or jump straight into jobs.</p></div></div>
            <fieldset disabled={busy}>{preferences}</fieldset>
            {feedback}
            <div className="cr-profile-actions">
              <button
                className="auth-secondary"
                type="button"
                disabled={busy}
                onClick={() => void submit(true)}
              >
                Skip for now
              </button>
              <button className="auth-primary" disabled={busy}>
                {busy ? "Saving…" : "Explore jobs"}
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="cr-profile-note">
              No résumé or education details needed. You can edit your profile
              later.
            </p>
          </form>
        </div>
      </main>
    );
  return (
    <main className="cr-workspace cr-profile-page">
      <div className="cr-profile-container">
        <header className="cr-page-heading cr-profile-heading">
          <span className="cr-profile-avatar" aria-hidden="true">
            {(first.trim()[0] || email[0] || "C").toUpperCase()}
          </span>
          <div>
            <h1>Your profile.</h1>
            <p>
              Keep only the details you want to save. All fields are optional.
            </p>
          </div>
        </header>
        <nav className="cr-profile-jump" aria-label="Profile sections">
          <a href="#profile-details">Details</a>
          <a href="#profile-preferences">Preferences</a>
          <a href="#profile-resume">Résumé</a>
          <a href="/applications">
            Tracker
            <ArrowRight size={14} />
          </a>
        </nav>
        <div className="cr-profile-layout">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset disabled={busy}>
              <section className="cr-profile-section" id="profile-details">
                <h2>Personal details</h2>
                <div className="cr-two-fields">
                  <label className="cr-field">
                    First name (optional)
                    <input
                      value={first}
                      maxLength={100}
                      autoComplete="given-name"
                      onChange={(e) => setFirst(e.target.value)}
                    />
                  </label>
                  <label className="cr-field">
                    Last name (optional)
                    <input
                      value={last}
                      maxLength={100}
                      autoComplete="family-name"
                      onChange={(e) => setLast(e.target.value)}
                    />
                  </label>
                </div>
              </section>
              <section className="cr-profile-section" id="profile-preferences">
                <h2>Job preferences</h2>
                {preferences}
                <fieldset className="cr-profile-modes">
                  <legend>Work preference (optional)</legend>
                  {["On-site", "Hybrid", "Remote"].map((mode) => (
                    <label key={mode}>
                      <input
                        type="checkbox"
                        checked={modes.includes(mode)}
                        onChange={() =>
                          setModes((current) =>
                            current.includes(mode)
                              ? current.filter((v) => v !== mode)
                              : [...current, mode],
                          )
                        }
                      />
                      {mode}
                    </label>
                  ))}
                </fieldset>
              </section>
            </fieldset>
            {feedback}
            <div className="cr-profile-actions">
              <a href="/jobs" className="auth-secondary">
                Back to jobs
              </a>
              <button className="auth-primary" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
          <aside className="cr-profile-aside" aria-label="Account and résumé">
            <section className="cr-profile-section">
              <h2>Account</h2>
              <span className="cr-profile-label">Sign-in email</span>
              <p className="cr-profile-email">{email}</p>
              <a className="cr-profile-security" href="/forgot-password">
                Reset your password
                <ArrowRight size={14} />
              </a>
            </section>
            <ResumeSettings userId={profile.id} />
            <section className="cr-profile-section">
              <div className="cr-profile-plan-row">
                <h2>Membership</h2>
                <span className="cr-profile-badge">Free</span>
              </div>
              <p>Paid subscriptions are not enabled yet.</p>
              <div className="cr-profile-coming">
                <span>Hiring contacts</span>
                <span className="cr-profile-label">Coming soon</span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
function ResumeSettings({ userId }: { userId: string }) {
  const [record, setRecord] = useState<SavedResume | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void getSavedResume(userId)
      .then((r) => {
        if (mounted.current) setRecord(r);
      })
      .catch(() => {
        if (mounted.current)
          setError("Your saved résumé could not be loaded. Reload to retry.");
      })
      .finally(() => {
        if (mounted.current) setReady(true);
      });
    return () => {
      mounted.current = false;
    };
  }, [userId]);
  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (mounted.current) setMessage(success);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section
      className="cr-profile-section cr-profile-resume"
      id="profile-resume"
    >
      <h2>Résumé (optional)</h2>
      <p>Stored privately. Not shared with employers or required to apply.</p>
      {!ready ? (
        <LoadingSkeleton label="Loading your résumé" rows={2} />
      ) : (
        <>
          <p>{record?.file_name || "No résumé uploaded."}</p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            aria-label="Upload résumé PDF"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void act(async () => {
                  const saved = await saveResume(userId, file, true);
                  if (mounted.current) setRecord(saved);
                }, "Résumé saved privately.");
            }}
          />
          <div className="cr-profile-resume-actions">
            <button
              className="auth-secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {record ? "Replace résumé" : "Upload PDF"}
            </button>
            {record ? (
              <>
                <button
                  className="auth-secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => downloadSavedResume(userId),
                      "Download started.",
                    )
                  }
                >
                  Download
                </button>
                <button
                  className="cr-text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove your saved résumé? Your profile details will remain.",
                      )
                    )
                      void act(async () => {
                        await removeSavedResume(userId);
                        if (mounted.current) setRecord(null);
                      }, "Résumé removed.");
                  }}
                >
                  Remove
                </button>
              </>
            ) : null}
          </div>
          <small>
            PDF only · up to 5 MB. Choosing a PDF saves it privately until you
            remove it. <a href="/privacy">Privacy</a>
          </small>
        </>
      )}
      {busy ? <p role="status">Working…</p> : null}
      {error ? (
        <p className="cr-profile-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="cr-profile-success" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
