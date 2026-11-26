import { fillMissingEducation } from "../services/education.js";
import { validateSetup } from "../services/setupValidation.js";
export { validateSetup } from "../services/setupValidation.js";
import { MAX_PROFILE_SKILLS } from "../services/careerCatalog.js";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { useProtectedAuth } from "./AuthFlows.js";
import {
  friendlyAuthError,
  saveProfile,
  type Profile,
} from "../services/auth.js";
import {
  hydrateDraftFromProfile,
  prefillFromResume,
  type Draft,
} from "../services/onboarding.js";
import { loadDraft, saveDraft } from "./CandidateOnboarding.js";
import { extractResume } from "../services/resumeParser.js";

import {
  getSavedResume,
  readSavedResumeFile,
  saveResume,
  removeSavedResume,
  type SavedResume,
} from "../services/resumeStorage.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";

import "./candidateWorkspace.css";
import { SetupSections } from "./SetupSections.js";
type Navigate = (path: string) => void;

export function CandidateSetupRoute({
  navigate,
  editing = false,
}: {
  navigate: Navigate;
  editing?: boolean;
}) {
  const auth = useProtectedAuth(navigate, editing ? "profile" : "onboarding");
  if (auth.loading)
    return (
      <main className="cr-loading">
        <LoadingSkeleton label="Loading your profile" />
      </main>
    );
  if (auth.error)
    return (
      <main className="cr-loading">
        <p role="alert">{auth.error}</p>
        <button className="auth-primary" onClick={() => navigate("/login")}>
          Sign in again
        </button>
      </main>
    );
  if (!auth.userId || !auth.profile) return null;
  return (
    <SetupForm
      key={auth.userId}
      userId={auth.userId}
      profile={auth.profile}
      editing={editing}
      navigate={navigate}
    />
  );
}
function SetupForm({
  userId,
  profile,
  editing,
  navigate,
}: {
  userId: string;
  profile: Profile;
  editing: boolean;
  navigate: Navigate;
}) {
  const [draft, setDraft] = useState(() =>
    hydrateDraftFromProfile(
      { ...loadDraft(userId), resumeName: "", resumeBytes: 0 },
      profile,
    ),
  );
  const [stage, setStage] = useState(1);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [resumeBusy, setResumeBusy] = useState(false);
  const [resume, setResume] = useState<SavedResume | null>(null),
    [resumeReady, setResumeReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    active = useRef(true),
    operation = useRef(0);
  useEffect(() => {
    active.current = true;
    const revision = ++operation.current;
    void getSavedResume(userId)
      .then(async (record) => {
        if (active.current && operation.current === revision) {
          setResume(record);
          setDraft((current) => ({
            ...current,
            resumeName: record?.file_name ?? "",
            resumeBytes: record?.file_size ?? 0,
          }));
          if (
            record &&
            (!draft.educationDegree ||
              !draft.graduationYear ||
              !draft.educationScore)
          ) {
            setResumeBusy(true);
            try {
              const file = await readSavedResumeFile(userId);
              const parsed = await extractResume(file);
              if (
                active.current &&
                operation.current === revision &&
                parsed.status === "success"
              )
                setDraft((current) =>
                  fillMissingEducation(current, parsed.suggestions.education),
                );
            } catch {
              /* Missing details remain editable when a saved PDF cannot be parsed. */
            } finally {
              if (active.current && operation.current === revision)
                setResumeBusy(false);
            }
          }
        }
      })
      .catch(() => {
        if (active.current && operation.current === revision)
          setNotice(
            "Saved resume could not be checked. You can still enter your details.",
          );
      })
      .finally(() => {
        if (active.current && operation.current === revision)
          setResumeReady(true);
      });
    return () => {
      active.current = false;
      operation.current++;
    };
  }, [userId]);
  useEffect(() => {
    saveDraft(userId, draft);
  }, [userId, draft]);
  useEffect(() => {
    document.title = editing
      ? "Your profile | Career Radar"
      : "Set up your radar | Career Radar";
  }, [editing]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const toggle = (key: "cities" | "modes", value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  const addRole = (role: string) => {
    const value = role.trim().slice(0, 100);
    if (!value) return;
    if (draft.roles.length >= 3) {
      setError("Choose up to three roles.");
      return;
    }
    setDraft((current) => ({
      ...current,
      roles: [...new Set([...current.roles, value])].slice(0, 3),
    }));

    setError("");
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || resumeBusy) return;
    const revision = ++operation.current;
    setResumeBusy(true);
    setError("");
    setNotice("");
    try {
      const parsed = await extractResume(file);
      if (!active.current || operation.current !== revision) return;
      if (parsed.status === "error") throw new Error(parsed.message);
      if (parsed.status === "success") {
        setDraft((current) => {
          const next = prefillFromResume(current, parsed.suggestions).draft;

          return {
            ...next,
            roles: next.roles.slice(0, 3),
            skills: [
              ...new Map(
                [...current.skills, ...parsed.suggestions.skills].map(
                  (value) => [value.toLowerCase(), value],
                ),
              ).values(),
            ].slice(0, MAX_PROFILE_SKILLS),
            ...fillMissingEducation(
              {
                educationDegree: current.educationDegree,
                graduationYear: current.graduationYear,
                educationScore: current.educationScore,
              },
              parsed.suggestions.education,
            ),
          };
        });
      }
      const saved = await saveResume(userId, file, true);
      if (!active.current || operation.current !== revision) return;
      setResume(saved);
      setDraft((current) => ({
        ...current,
        resumeName: saved.file_name,
        resumeBytes: saved.file_size,
      }));
      setNotice(
        parsed.status === "empty"
          ? "Text could not be read. Enter your details manually."
          : "",
      );
    } catch (err) {
      if (active.current)
        setError(
          err instanceof Error
            ? err.message
            : "Resume could not be saved. Please retry.",
        );
    } finally {
      if (active.current) setResumeBusy(false);
    }
  };
  const remove = async () => {
    if (
      !window.confirm(
        "Remove your stored PDF? Your profile details will remain.",
      )
    )
      return;
    setResumeBusy(true);
    setError("");
    try {
      await removeSavedResume(userId);
      if (active.current) {
        setResume(null);
        setDraft((current) => ({ ...current, resumeName: "", resumeBytes: 0 }));
        setNotice("Stored PDF removed.");
      }
    } catch (err) {
      if (active.current)
        setError(
          err instanceof Error ? err.message : "Could not remove your PDF.",
        );
    } finally {
      if (active.current) setResumeBusy(false);
    }
  };
  const move = (next: number): boolean => {
    const message =
      next > stage ? validateSetup(stage, draft, Boolean(resume)) : "";
    if (message) {
      setError(message);
      return false;
    }
    setError("");
    setStage(next);
    return true;
  };
  const finish = async () => {
    for (const step of [1, 2]) {
      const message = validateSetup(step, draft, Boolean(resume));
      if (message) {
        setStage(step);
        setError(message);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile({
        ...profile,
        id: userId,
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        career_stage: draft.careerStage,
        experience_level:
          draft.careerStage === "Student / Fresher"
            ? "No professional experience"
            : draft.experienceYears
              ? `${draft.experienceYears} years`
              : null,
        target_roles: draft.roles.slice(0, 3),
        skills: draft.skills.slice(0, MAX_PROFILE_SKILLS),
        preferred_cities: draft.cities,
        work_preferences: draft.modes,
        education_degree: draft.educationDegree.trim().slice(0, 160) || null,
        graduation_year: draft.graduationYear ? +draft.graduationYear : null,
        education_score: draft.educationScore.trim().slice(0, 80) || null,
        linkedin_url: draft.linkedin ? safeExternalUrl(draft.linkedin) : null,
        github_url: draft.github ? safeExternalUrl(draft.github) : null,
        portfolio_url: draft.portfolio
          ? safeExternalUrl(draft.portfolio)
          : null,
        resume_name: resume?.file_name ?? null,
        resume_bytes: resume?.file_size ?? null,
        onboarding_complete: true,
      });
      for (const store of [window.localStorage, window.sessionStorage]) {
        try {
          store.removeItem(`career-radar-onboarding-draft:${userId}`);
        } catch {
          /* Optional browser storage. */
        }
      }
      navigate("/dashboard");
    } catch (err) {
      if (active.current) {
        setError(friendlyAuthError(err));
        setBusy(false);
      }
    }
  };
  return (
    <SetupSections
      stage={stage}
      draft={draft}
      resume={resume}
      editing={editing}
      busy={busy}
      resumeBusy={resumeBusy}
      resumeReady={resumeReady}
      error={error}
      notice={notice}
      fileInput={fileInput}
      update={update}
      toggle={toggle}
      addRole={addRole}
      move={move}
      finish={finish}
      upload={upload}
      remove={remove}
      navigate={navigate}
    />
  );
}
