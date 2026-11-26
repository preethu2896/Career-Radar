import { CANONICAL_ROLES } from "../services/resumeParser.js";
import { suggestRelatedRoles } from "../services/roleSuggestions.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import { getSavedResume, saveResume, removeSavedResume } from "../services/resumeStorage.js";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Upload, X } from "lucide-react";
import { authConfigured, friendlyAuthError, incompleteProfile, safeInternalRedirect, saveProfile } from "../services/auth.js";

export const UNCONFIGURED_AUTH_MESSAGE = "Supabase is not configured, so this preview cannot save a profile.";
export const PREVIEW_ONBOARDING_MESSAGE = "You're previewing onboarding. Sign in or create an account to save your profile.";
import {
  isValidProfileUrl,
  isValidResume,
  isStep1Valid,
  prefillFromResume,
  toggleSelection,
  validateOnboardingStep,
  validateEntireOnboarding,
  applyResumeSuggestions,
  MAX_RESUME_BYTES,
  Draft,
  blankDraft,
  buildProfilePayload,
  hydrateDraftFromProfile,
  extractLocalPhoneNumber,
  normalizePhone,
  isValidPhoneInput,
  isValidGithubUrl,
} from "../services/onboarding.js";
import { extractResume, splitCandidateName, type ResumeParseResult } from "../services/resumeParser.js";
import { useProtectedAuth } from "./AuthFlows.js";
import imagee1Url from "../../imagee1.webp";
import imagee2Url from "../../imagee2.webp";
import imagee3Url from "../../imagee3.webp";
import imagee4Url from "../../imagee4.webp";
import imagee5Url from "../../imagee5.webp";
import imagee6Url from "../../imagee6.webp";

type Navigate = (path: string) => void;

const skills = [
  "Python",
  "JavaScript",
  "React",
  "SQL",
  "Machine Learning",
  "Cloud",
  "Figma",
  "RAG",
  "MCP",
  "LLMs",
];
const cities = [
  "Bengaluru",
  "Delhi NCR",
  "Gurugram",
  "Noida",
  "Mumbai",
  "Pune",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
];
const modes = ["On-site", "Hybrid", "Remote"];
const industries = ["Applied AI", "SaaS", "Fintech", "Healthtech", "Climate", "Consumer technology"];

export type { Draft } from "../services/onboarding.js";
export { blankDraft } from "../services/onboarding.js";
export { clearDraftStorage } from "../services/auth.js";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DRAFT_PREFIX = "career-radar-onboarding-draft";
export function saveDraft(userId: string, draft: Draft, now = Date.now()): void {
  if (!userId || typeof window === "undefined") return;
  const key = `${DRAFT_PREFIX}:${userId}`;
  const envelope = { ...draft, _ownerId: userId, _expiresAt: now + DRAFT_TTL_MS };
  // Personal fields survive a same-tab reload, but are not retained on disk by
  // the application's persistent draft. Session storage is still accessible to
  // scripts on this origin; it is not an encryption boundary.
  try { window.sessionStorage.setItem(key, JSON.stringify(envelope)); } catch { /* Best effort. */ }
  const persistent = { ...envelope, educationDegree: "", graduationYear: "", educationScore: "", firstName: "", lastName: "", phone: "", postalCode: "", currentCity: "", state: "", currentCompensation: "", expectedCompensation: "", linkedin: "", github: "", portfolio: "", resumeName: "", resumeBytes: 0, prefilledFields: [], preservedFields: [] };
  try {
    window.localStorage.setItem(key, JSON.stringify(persistent));
    window.localStorage.removeItem(DRAFT_PREFIX);
  } catch { /* Best effort. */ }
}
export function loadDraft(userId?: string, now = Date.now()): Draft {
  if (!userId || typeof window === "undefined") return blankDraft();
  const key = `${DRAFT_PREFIX}:${userId}`;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      storage.removeItem(DRAFT_PREFIX);
      const stored = storage.getItem(key);
      if (!stored) continue;
      const parsed = JSON.parse(stored) as Partial<Draft> & { _ownerId?: string; _expiresAt?: number };
      if (parsed._ownerId !== userId || typeof parsed._expiresAt !== "number" || !Number.isFinite(parsed._expiresAt) || parsed._expiresAt <= now || parsed._expiresAt > now + DRAFT_TTL_MS) {
        storage.removeItem(key);
        continue;
      }
      const clean = blankDraft();
      for (const field of Object.keys(clean) as (keyof Draft)[]) {
        const value = parsed[field];
        if (Array.isArray(clean[field])) {
          if (Array.isArray(value) && value.length <= 100 && value.every(v => typeof v === "string" && v.length <= 500)) Object.assign(clean, { [field]: value });
        } else if (typeof value === typeof clean[field] && (typeof value !== "string" || value.length <= 2000)) Object.assign(clean, { [field]: value });
      }
      return clean;
    } catch { /* Try the other store, then fall back to a blank draft. */ }
  }
  return blankDraft();
}

export function ChoiceRow({
  options,
  selected,
  toggle,
  limit,
}: {
  options: string[];
  selected: string[];
  toggle: (value: string) => void;
  limit?: number;
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => {
        const active = selected.includes(option);
        const disabled = Boolean(limit && selected.length >= limit && !active);
        return (
          <button
            type="button"
            key={option}
            className={active ? "choice-chip selected" : "choice-chip"}
            onClick={() => toggle(option)}
            aria-pressed={active}
            disabled={disabled}
          >
            <span className="choice-chip-text">{option}</span>
            {active ? <Check size={14} className="choice-chip-icon" /> : <Plus size={14} className="choice-chip-icon" />}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({
  values,
  update,
  placeholder,
  limit,
}: {
  values: string[];
  update: (values: string[]) => void;
  placeholder: string;
  limit?: number;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const next = value.trim();
    if (next && !values.includes(next) && (!limit || values.length < limit)) update([...values, next]);
    setValue("");
  };
  return (
    <div className="tag-input">
      <div className="tag-list">
        {values.map((item) => (
          <span className="tag" key={item}>
            {item}
            <button
              type="button"
              onClick={() => update(values.filter((v) => v !== item))}
              aria-label={`Remove ${item}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <button
        type="button"
        onClick={add}
        aria-label={`Add ${placeholder}`}
        disabled={Boolean(limit && values.length >= limit)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  optional = false,
  required = false,
  disabled = false,
  error,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  type?: string | undefined;
  optional?: boolean | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
  id?: string | undefined;
}) {
  const inputId = id || `onboarding-input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const errorId = `${inputId}-error`;

  return (
    <label className="onboarding-input" htmlFor={inputId}>
      <span>
        {label}
        {required ? <b style={{ color: "var(--coral, #d9534f)", marginLeft: "4px" }}>*</b> : null}
        {optional ? <small> (optional)</small> : null}
      </span>
      <input
        id={inputId}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <small id={errorId} className="onboarding-input-error" role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}

function PhoneInput({
  value,
  onChange,
  disabled = false,
  required = false,
  error,
  id = "onboarding-phone",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  id?: string | undefined;
}) {
  const localDigits = extractLocalPhoneNumber(value);
  const errorId = `${id}-error`;

  const handleDigitsChange = (newDigits: string) => {
    // Keep digits, spaces, and hyphens only
    const cleaned = newDigits.replace(/[^\d\s-]/g, "");
    if (!cleaned.trim()) {
      onChange("");
    } else {
      onChange(`+91 ${cleaned.trim()}`);
    }
  };

  return (
    <label className="onboarding-input" htmlFor={id}>
      <span>
        Phone
        {required ? <b style={{ color: "var(--coral, #d9534f)", marginLeft: "4px" }}>*</b> : null}
      </span>
      <div className="onboarding-phone-wrap">
        <span className="onboarding-phone-prefix">+91</span>
        <input
          id={id}
          type="tel"
          value={localDigits}
          onChange={(event) => handleDigitsChange(event.target.value)}
          placeholder="e.g. 98765 43210"
          disabled={disabled}
          autoComplete="tel-national"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {error ? (
        <small id={errorId} className="onboarding-input-error" role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}

export const stepImages: Record<number, string> = {
  1: imagee1Url,
  2: imagee2Url,
  3: imagee3Url,
  4: imagee4Url,
  5: imagee5Url,
  6: imagee6Url,
  7: imagee4Url,
  8: imagee6Url,
};

export function Visual({ step, label, caption }: { step: number; label: string; caption: string }) {
  const imgUrl = stepImages[step] || imagee1Url;
  return (
    <aside className={`onboarding-visual onboarding-visual-${step}`}>
      <img
        src={imgUrl}
        alt={`Career Radar candidate onboarding - ${label.toLowerCase()}`}
        className="onboarding-visual-img"
        width={1086}
        height={1448}
      />
      <div className="onboarding-visual-overlay" />
      <div className="onboarding-visual-copy">
        <span>
          {String(step).padStart(2, "0")} / 08 &nbsp;·&nbsp; {label}
        </span>
        <strong>{caption}</strong>
      </div>
    </aside>
  );
}

export const meta = [
  ["YOUR STORY", "Let's build your apply-ready profile.", "start with who you are."],
  ["TARGET ROLES", "What roles should we apply for?", "picture where you belong."],
  ["SKILLS", "What are you great at?", "the craft you've built."],
  ["WHERE", "Which cities should we search in?", "where your career happens next."],
  ["COMPENSATION", "Let's talk numbers.", "the number you've earned."],
  ["HOW YOU WORK", "How do you want to work?", "the shape of the work."],
  ["WHERE YOU ARE", "Where are you based?", "where you are, on paper."],
  ["LAST DETAILS", "A few last details.", "let's make it happen."],
] as const;

export function OnboardingRoute({ navigate }: { navigate: Navigate }) {
  const auth = useProtectedAuth(navigate, "onboarding");
  // Remount local form state whenever identity changes; never reuse another account's draft.
  return <CandidateOnboardingForm key={auth.userId || "signed-out"} navigate={navigate} auth={auth} />;
}

function CandidateOnboardingForm({ navigate, auth }: { navigate: Navigate; auth: ReturnType<typeof useProtectedAuth> }) {
  const { loading, userId, profile, error: authError } = auth;
  const safeRedirectTarget = safeInternalRedirect("/onboarding", "/onboarding");
  const loginUrl = `/login?redirect=${encodeURIComponent(safeRedirectTarget)}`;
  const signupUrl = `/signup?redirect=${encodeURIComponent(safeRedirectTarget)}`;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => ({ ...loadDraft(userId), resumeName: "", resumeBytes: 0 }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [savingResume, setSavingResume] = useState(false);
  const [resumeSaveError, setResumeSaveError] = useState("");
  const pendingResumeFile = useRef<File | null>(null);
  const savedResumePath = useRef<string | undefined>(undefined);
  const [resumeStorageLoading, setResumeStorageLoading] = useState(Boolean(userId));
  const resumeOperation = useRef(0);
  useEffect(() => {
    let active = true;
    const operation = resumeOperation.current;
    if (!userId) return;
    void getSavedResume(userId).then(record => {
      if (!active || operation !== resumeOperation.current) return;
      savedResumePath.current = record?.storage_path;
      setDraft(current => ({ ...current, resumeName: record?.file_name ?? "", resumeBytes: record?.file_size ?? 0 }));
    }).catch(err => {
      if (active && operation === resumeOperation.current) { setDraft(current => ({ ...current, resumeName: "", resumeBytes: 0 })); setError(err.message); }
    }).finally(() => { if (active) setResumeStorageLoading(false); });
    return () => { active = false; resumeOperation.current++; };
  }, [userId]);
  const [resumeSummary, setResumeSummary] = useState<ResumeParseResult | null>(null);
  const [prefillState, setPrefillState] = useState<{ prefilled: string[]; preserved: string[] }>(() => ({
    prefilled: draft.prefilledFields || [],
    preserved: draft.preservedFields || [],
  }));

  const hydrated = useRef(false);
  const resumeRef = useRef<HTMLInputElement>(null);
  const previousCurrentCompRef = useRef<string>(
    draft.currentCompensation && draft.currentCompensation !== "0" ? draft.currentCompensation : ""
  );
  const previousExpYearsRef = useRef<string>(
    draft.experienceYears && draft.experienceYears !== "0" ? draft.experienceYears : ""
  );

  const handleFresherToggle = (isFresher: boolean) => {
    if (isFresher) {
      if (draft.currentCompensation && draft.currentCompensation !== "0") {
        previousCurrentCompRef.current = draft.currentCompensation;
      }
      if (draft.experienceYears && draft.experienceYears !== "0") {
        previousExpYearsRef.current = draft.experienceYears;
      }
      setDraft((curr) => ({
        ...curr,
        fresher: true,
        experienceYears: "0",
        currentCompensation: "0",
      }));
    } else {
      const restoredComp = previousCurrentCompRef.current || "";
      const restoredExp = previousExpYearsRef.current || "";
      setDraft((curr) => ({
        ...curr,
        fresher: false,
        experienceYears: restoredExp,
        currentCompensation: restoredComp,
      }));
    }
  };

  const handleCurrentCompChange = (value: string) => {
    if (!draft.fresher) {
      previousCurrentCompRef.current = value;
      update("currentCompensation", value);
    }
  };

  const handleExpYearsChange = (value: string) => {
    if (!draft.fresher) {
      previousExpYearsRef.current = value;
      update("experienceYears", value);
    }
  };

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const toggle = (
    key: "roles" | "skills" | "cities" | "modes" | "industries",
    value: string,
    limit?: number
  ) => setDraft((current) => ({ ...current, [key]: toggleSelection(current[key], value, limit) }));

  useEffect(() => {
    if (loading || !userId || authError) return;
    saveDraft(userId, draft);
  }, [draft, userId, loading, authError]);

  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setDraft((current) => {
      const next = hydrateDraftFromProfile(current, { ...profile, resume_name: null, resume_bytes: null });
      if (next.currentCompensation && next.currentCompensation !== "0") {
        previousCurrentCompRef.current = next.currentCompensation;
      }
      if (next.experienceYears && next.experienceYears !== "0") {
        previousExpYearsRef.current = next.experienceYears;
      }
      return next;
    });
  }, [profile]);

  const validate = () => validateOnboardingStep(step, draft);

  const next = () => {
    if (parsingResume) return;
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((value) => Math.min(8, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setError("");
    setStep((value) => Math.max(1, value - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPayload = (isPartial = false) =>
    buildProfilePayload(draft, userId, {
      existingProfile: profile,
      isPartial,
      onboardingComplete: !isPartial,
    });

  const finish = async () => {
    if (savingResume || resumeSaveError || parsingResume) return;
    const failure = validateEntireOnboarding(draft);
    if (failure) {
      setStep(failure.step);
      setError(failure.message);
      return;
    }
    if (!authConfigured) {
      setError(UNCONFIGURED_AUTH_MESSAGE);
      return;
    }
    if (!userId) {
      setError(PREVIEW_ONBOARDING_MESSAGE);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile(getPayload(false));
      try {
        window.sessionStorage.removeItem(`career-radar-onboarding-draft:${userId}`);
        window.localStorage.removeItem(`career-radar-onboarding-draft:${userId}`);
        window.localStorage.removeItem("career-radar-onboarding-draft");
      } catch {
        /* Best effort cleanup. */
      }
      navigate("/dashboard");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const completeLater = async () => {
    if (savingResume || resumeSaveError || parsingResume) return;
    if (!userId) {
      navigate("/");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile(getPayload(true));
      navigate("/");
    } catch (requestError) {
      setError(friendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const persistResume = async (file: File, operation: number) => {
    setSavingResume(true);
    setResumeSaveError("");
    try {
      // Selecting a file beside the storage notice is the affirmative upload action.
      const saved = await saveResume(userId, file, true, savedResumePath.current);
      if (operation !== resumeOperation.current) return;
      savedResumePath.current = saved.storage_path;
      pendingResumeFile.current = null;
    } catch (err) {
      if (operation === resumeOperation.current) setResumeSaveError(err instanceof Error ? err.message : "Your resume was not saved. Please retry.");
    } finally {
      if (operation === resumeOperation.current) setSavingResume(false);
    }
  };

  const onResume = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || parsingResume || savingResume) return;
    const operation = ++resumeOperation.current;

    // Reset input so selecting the same file again still fires onChange
    if (resumeRef.current) {
      resumeRef.current.value = "";
    }

    if (!isValidResume(file)) {
      setError(file.size > MAX_RESUME_BYTES ? "Your resume must be 5 MB or smaller." : "Please choose a PDF resume.");
      return;
    }

    setError("");
    setParsingResume(true);

    try {
      const result = await extractResume(file);
      if (operation !== resumeOperation.current) return;
      if (result.status === "error") { setError(result.message); return; }
      pendingResumeFile.current = file;
      void persistResume(file, operation);
      setResumeSummary(result);

      if (result.status === "success") {
        setDraft((currentDraft) => {
          const wasRolesResumeDerived =
            Boolean(currentDraft.prefilledFields?.includes("Target roles")) &&
            currentDraft.roles.every((r) => currentDraft.extractedRoles?.includes(r));
          const rolesToPass = wasRolesResumeDerived ? [] : currentDraft.roles;

          const wasSkillsResumeDerived =
            Boolean(currentDraft.prefilledFields?.includes("Skills")) &&
            currentDraft.skills.every((s) => currentDraft.extractedSkills?.includes(s));
          const skillsToPass = wasSkillsResumeDerived ? [] : currentDraft.skills;

          const draftWithFile: Draft = {
            ...currentDraft,
            roles: rolesToPass,
            skills: skillsToPass,
            resumeName: file.name,
            resumeBytes: file.size,
            extractedRoles: result.suggestions.targetRoles,
            extractedSkills: result.suggestions.skills,
          };
          const { draft: nextDraft, prefilledFields, preservedFields } = prefillFromResume(
            draftWithFile,
            result.suggestions,
            { overwriteConfirmed: false, nameSplitter: splitCandidateName }
          );
          setPrefillState({ prefilled: prefilledFields, preserved: preservedFields });
          return {
            ...nextDraft,
            extractedRoles: result.suggestions.targetRoles,
            extractedSkills: result.suggestions.skills,
            prefilledFields,
            preservedFields,
          };
        });
        setError("");
      } else if (result.status === "empty") {
        setDraft((currentDraft) => ({
          ...currentDraft,
          resumeName: file.name,
          resumeBytes: file.size,
          extractedRoles: [],
          extractedSkills: [],
          prefilledFields: [],
          preservedFields: [],
        }));
        setPrefillState({ prefilled: [], preserved: [] });
        setError("");
      }
    } catch (err) {
      if (operation === resumeOperation.current) setError(err instanceof Error ? err.message : "Resume could not be saved. Please retry.");
    } finally {
      if (operation === resumeOperation.current) setParsingResume(false);
    }
  };

  const removeResume = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (parsingResume || savingResume) return;
    setParsingResume(true);
    try { await removeSavedResume(userId); } catch (err) {
      setError(err instanceof Error ? err.message : "Resume could not be removed.");
      setParsingResume(false); return;
    }
    setParsingResume(false);
    savedResumePath.current = undefined;
    pendingResumeFile.current = null;
    setResumeSaveError("");
    setError("");
    setDraft((curr) => ({
      ...curr,
      resumeName: "",
      resumeBytes: 0,
      extractedRoles: [],
      extractedSkills: [],
      prefilledFields: [],
      preservedFields: [],
    }));
    setResumeSummary(null);
    setPrefillState({ prefilled: [], preserved: [] });
    if (resumeRef.current) {
      resumeRef.current.value = "";
    }
  };

  const applySuggestions = (action: "merge" | "replace" = "merge") => {
    setDraft((curr) => {
      const updated = applyResumeSuggestions(curr, action);
      setPrefillState((prev) => ({
        ...prev,
        preserved: updated.preservedFields || [],
      }));
      return updated;
    });
  };

  const onLinkedInImport = () => {
    if (!draft.linkedin.trim()) {
      setError("Please paste a LinkedIn profile URL (e.g. linkedin.com/in/you) to continue.");
      return;
    }
    if (!isValidProfileUrl(draft.linkedin, "linkedin.com")) {
      setError("Please enter a valid LinkedIn URL, for example linkedin.com/in/username.");
      return;
    }
    setError("");
    next();
  };

  const isFieldValidationError = (message: string): boolean => {
    if (!message) return false;
    if (message === UNCONFIGURED_AUTH_MESSAGE || message === PREVIEW_ONBOARDING_MESSAGE) {
      return false;
    }
    return /resume|pdf|linkedin|role|title|skill|experience|city|compensation|mode|relocation|availability|state|province|postal|phone|mobile|github/i.test(
      message
    );
  };

  const [label, title, caption] = meta[step - 1]!;

  const body = (
    <OnboardingStepView
      step={step}
      draft={draft}
      update={update}
      toggle={toggle}
      setDraft={setDraft}
      resumeRef={resumeRef}
      onResume={onResume}
      removeResume={removeResume}
      parsingResume={parsingResume}
      savingResume={savingResume}
      resumeStorageLoading={resumeStorageLoading}
      resumeSaveFailed={Boolean(resumeSaveError)}
      applySuggestions={applySuggestions}
      error={error}
      setError={setError}
      onLinkedInImport={onLinkedInImport}
      handleFresherToggle={handleFresherToggle}
      onCurrentCompChange={handleCurrentCompChange}
      onExpYearsChange={handleExpYearsChange}
    />
  );

  if (loading) {
    return (
      <main className="onboarding-page">
        <div className="onboarding-loading-layout"><div className="skeleton-portrait" aria-hidden="true" /><LoadingSkeleton label="Loading your profile" rows={5} /></div>
      </main>
    );
  }
  if (authError) {
    return (
      <main className="onboarding-page">
        <div className="onboarding-error">
          <div className="auth-form-error" role="alert">
            {authError}
          </div>
          <button className="auth-primary" type="button" onClick={() => navigate("/login?redirect=/onboarding")}>
            Return to login
            <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  }
  if (!authConfigured) {
    return (
      <main className="onboarding-page">
        <div className="onboarding-error">
          <p>{UNCONFIGURED_AUTH_MESSAGE}</p>
          <button className="auth-primary" type="button" onClick={() => navigate("/signup")}>
            Return to sign up
            <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={`onboarding-page onboarding-page-step-${step}`}>
      <div className="onboarding-experience">
        <a
          className="auth-logo onboarding-logo"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label="Career Radar home"
        >
          career<span>radar</span>
        </a>
        <div className="onboarding-progress">
          <span>STEP {step} OF 8</span>
          <div>
            <i style={{ width: `${(step / 8) * 100}%` }} />
          </div>
        </div>
        <div className={`onboarding-layout onboarding-layout-step-${step}`}>
          <Visual step={step} label={label} caption={caption} />
          <section className="onboarding-form-panel">
            <div className="onboarding-form-scroll" key={step}>
            {authConfigured && !userId ? (
              <div className="auth-preview-notice" role="status">
                <strong>Preview mode</strong>
                <span>{PREVIEW_ONBOARDING_MESSAGE}</span>
                <div className="onboarding-preview-links">
                  <button
                    type="button"
                    onClick={() => navigate(loginUrl)}
                  >
                    Sign in
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => navigate(signupUrl)}
                  >
                    Create account
                  </button>
                </div>
              </div>
            ) : null}
            <div className="onboarding-form-heading">
              <div className="onboarding-mobile-hero-copy">
                <span className="onboarding-mobile-step-tag">
                  {String(step).padStart(2, "0")} / 08 &nbsp;·&nbsp; {label}
                </span>
                <strong className="onboarding-mobile-caption">{caption}</strong>
              </div>
              <h1>{title}</h1>
            </div>
            <div key={step} className="onboarding-step-content onboarding-step-transition">{body}</div>
            {step === 1 && resumeSummary?.status === "empty" ? <p className="onboarding-note" role="status">No readable text. Enter your details manually.</p> : null}
            {savingResume ? <p className="resume-save-status" role="status"><span className="status-pulse" aria-hidden="true" />Saving resume…</p> : null}
            {resumeSaveError ? <div className="auth-form-error" role="alert"><p>{resumeSaveError}</p><button className="auth-secondary" type="button" onClick={() => { if (pendingResumeFile.current) void persistResume(pendingResumeFile.current, resumeOperation.current); }}>Retry</button></div> : null}
            {error && !isFieldValidationError(error) ? (
              <div className="auth-form-error" role="alert">
                <p>{error}</p>
                {authConfigured && !userId ? (
                  <div className="onboarding-preview-actions">
                    <button
                      className="auth-secondary"
                      type="button"
                      onClick={() => navigate(loginUrl)}
                    >
                      Sign in
                    </button>
                    <button
                      className="auth-primary"
                      type="button"
                      onClick={() => navigate(signupUrl)}
                    >
                      Create account <ArrowRight size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>
            <div className="onboarding-actions">
              <button
                className="auth-secondary"
                type="button"
                onClick={step === 1 ? () => void completeLater() : back}
                disabled={busy || parsingResume || (step === 1 && (savingResume || Boolean(resumeSaveError)))}
              >
                {step === 1 ? (
                  "Complete later"
                ) : (
                  <>
                    <ArrowLeft size={15} /> Back
                  </>
                )}
              </button>
              {step < 8 ? (
                <button
                  className="auth-primary"
                  type="button"
                  onClick={next}
                  disabled={busy || parsingResume}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button className="auth-primary" type="button" onClick={() => void finish()} disabled={busy || parsingResume || savingResume || Boolean(resumeSaveError)}>
                  {busy ? "Saving…" : "Explore Career Radar"} <ArrowRight size={15} />
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function OnboardingStepView({
  step,
  draft,
  update,
  toggle,
  setDraft,
  resumeRef,
  onResume,
  removeResume,
  parsingResume = false,
  savingResume = false,
  resumeStorageLoading = false,
  resumeSaveFailed = false,
  applySuggestions,
  error = "",
  setError,
  onLinkedInImport,
  handleFresherToggle,
  onCurrentCompChange,
  onExpYearsChange,
}: {
  step: number;
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  toggle: (
    key: "roles" | "skills" | "cities" | "modes" | "industries",
    value: string,
    limit?: number
  ) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  resumeRef?: React.RefObject<HTMLInputElement>;
  onResume?: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeResume?: (event?: React.MouseEvent) => void;
  parsingResume?: boolean;
  savingResume?: boolean;
  resumeStorageLoading?: boolean;
  resumeSaveFailed?: boolean;
  applySuggestions?: (action: "merge" | "replace") => void;
  error?: string;
  setError?: (err: string) => void;
  onLinkedInImport?: () => void;
  handleFresherToggle?: (isFresher: boolean) => void;
  onCurrentCompChange?: (value: string) => void;
  onExpYearsChange?: (value: string) => void;
}) {
  const [customRoleInput, setCustomRoleInput] = useState("");


  const onFresherToggle = (checked: boolean) => {
    if (handleFresherToggle) {
      handleFresherToggle(checked);
    } else {
      update("fresher", checked);
      if (checked) {
        update("experienceYears", "0");
        update("currentCompensation", "0");
      }
    }
  };

  const onCompChange = (value: string) => {
    if (onCurrentCompChange) {
      onCurrentCompChange(value);
    } else if (!draft.fresher) {
      update("currentCompensation", value);
    }
  };

  const onExpChange = (value: string) => {
    if (onExpYearsChange) {
      onExpYearsChange(value);
    } else if (!draft.fresher) {
      update("experienceYears", value);
    }
  };

  const handleAddCustomRole = () => {
    const raw = customRoleInput.trim();
    const trimmed = CANONICAL_ROLES.find(role => role.toLowerCase() === raw.toLowerCase()) || raw;
    if (!trimmed) return;
    if (draft.roles.some(role => role.toLowerCase() === trimmed.toLowerCase())) {
      setCustomRoleInput("");
      return;
    }
    if (draft.roles.length >= 3) {
      if (setError) setError("You can select up to 3 target roles.");
      return;
    }
    if (error && setError) setError("");
    update("roles", [...draft.roles, trimmed]);
    setCustomRoleInput("");
  };

  if (step === 1) {
    const isStep1GeneralError = Boolean(
      error && (error.includes("PDF resume or a valid LinkedIn profile URL") || error.includes("Add a PDF resume"))
    );
    const isFileError = Boolean(!isStep1GeneralError && error && /pdf|resume|unlocked|mb/i.test(error));
    const isLinkedInError = Boolean(!isStep1GeneralError && error && /linkedin/i.test(error));

    return (
      <>
        <p className="onboarding-lede">Add your resume or LinkedIn profile.</p>
        <div className={`resume-upload-wrapper ${parsingResume ? "is-reading" : ""}`} aria-busy={parsingResume || savingResume}>
          {parsingResume ? <LoadingSkeleton label="Reading your resume" rows={2} /> : null}
          <button
            id="step1-resume-dropzone"
            className={`resume-dropzone ${draft.resumeName ? "has-file" : ""}`}
            type="button"
            onClick={() => resumeRef?.current?.click()}
            disabled={parsingResume || savingResume}
            aria-invalid={Boolean(isFileError || isStep1GeneralError)}
            aria-describedby={
              isFileError ? "step1-resume-error" : isStep1GeneralError ? "step1-general-error" : undefined
            }
          >
            <span className="onboarding-icon">
              {draft.resumeName ? (resumeSaveFailed ? <X size={19} /> : <Check size={19} />) : <Upload size={19} />}
            </span>
            <span>
              <strong>
                {parsingResume ? "Reading your resume…" : draft.resumeName || "Upload your resume"}
              </strong>
              <small>
                {draft.resumeName
                  ? `${(draft.resumeBytes / 1024 / 1024).toFixed(1)} MB · ${savingResume ? "saving…" : resumeSaveFailed ? "not saved" : "saved privately"}`
                  : "PDF · up to 5 MB"}
              </small>
            </span>
          </button>
          {draft.resumeName && !parsingResume && !savingResume ? (
            <button
              type="button"
              className="resume-remove-btn"
              onClick={removeResume}
              aria-label="Remove resume"
              title="Remove resume"
            >
              <X size={15} />
              <span>Remove</span>
            </button>
          ) : null}
        </div>
        {isFileError ? (
          <small id="step1-resume-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}
        <p className="resume-storage-notice">Uploading saves your PDF privately for Career Radar review. Remove it anytime. <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></p>
        {resumeStorageLoading && !parsingResume && !draft.resumeName ? <LoadingSkeleton label="Checking for a saved resume" rows={1} /> : null}
        <input
          ref={resumeRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => void onResume?.(event)}
        />
        <div className="onboarding-or">
          <span>OR</span>
        </div>
        <div className="onboarding-linkedin-row">
          <input
            type="text"
            id="onboarding-linkedin-input"
            className="onboarding-linkedin-input"
            value={draft.linkedin}
            placeholder="linkedin.com/in/you"
            onChange={(event) => {
              const val = event.target.value;
              update("linkedin", val);
              if (error && setError && (draft.resumeName || isValidProfileUrl(val, "linkedin.com"))) {
                setError("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onLinkedInImport?.();
              }
            }}
            aria-invalid={Boolean(isLinkedInError || isStep1GeneralError)}
            aria-describedby={
              isLinkedInError ? "step1-linkedin-error" : isStep1GeneralError ? "step1-general-error" : undefined
            }
          />
          <button
            type="button"
            className="onboarding-linkedin-import-btn"
            onClick={onLinkedInImport}
          >
            Continue with link <ArrowRight size={14} />
          </button>
        </div>
        {isLinkedInError ? (
          <small id="step1-linkedin-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}
        {isStep1GeneralError ? (
          <small id="step1-general-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}
        <small className="onboarding-note onboarding-note-required">
          LinkedIn saves a link only; no profile information is imported.
        </small>
      </>
    );
  }

  if (step === 2) {
    const resumeRoles = draft.extractedRoles || [];
    const hasResumeRoles = resumeRoles.length > 0;

    const displayedRoles = [...new Set([...resumeRoles, ...draft.roles])];
    const relatedRoles = suggestRelatedRoles([...draft.roles, ...resumeRoles]);

    const isRoleError = Boolean(error && (/role/i.test(error) || /title/i.test(error)));

    return (
      <>
        <div className="onboarding-role-header">
          <span className="onboarding-role-instruction">Select your top 3 titles</span>
          <span className="onboarding-role-count">{draft.roles.length} of 3 selected</span>
        </div>

        {displayedRoles.length > 0 ? (
          <div className="onboarding-role-section">
            <span className="onboarding-section-label">Your roles</span>
            <div
              className="onboarding-pill-grid"
              role="group"
              aria-label="Your roles"
              aria-describedby={isRoleError ? "step2-roles-error" : undefined}
            >
              {displayedRoles.map((role) => {
                const active = draft.roles.includes(role);
                const disabled = !active && draft.roles.length >= 3;
                return (
                  <button
                    type="button"
                    key={role}
                    className={active ? "onboarding-role-pill selected" : "onboarding-role-pill"}
                    onClick={() => {
                      toggle("roles", role, 3);
                      if (error && setError) setError("");
                    }}
                    aria-pressed={active}
                    disabled={disabled}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {draft.resumeName && !hasResumeRoles ? <p className="onboarding-empty-notice">No target roles detected from your experience. Add up to 3 roles manually below.</p> : null}
        {relatedRoles.length > 0 ? <div className="onboarding-role-section">
          <span className="onboarding-section-label">You might also be interested in</span>

          <div className="onboarding-pill-grid" role="group" aria-label="Related roles">
            {relatedRoles.map(role => <button key={role} type="button" className="onboarding-role-pill" aria-pressed={false} disabled={draft.roles.length >= 3} onClick={() => toggle("roles", role, 3)}>{role}</button>)}
          </div>
        </div> : null}
        {isRoleError ? (
          <small
            id="step2-roles-error"
            className="onboarding-input-error"
            role="alert"
            style={{ marginTop: "4px", marginBottom: "16px", display: "block" }}
          >
            {error}
          </small>
        ) : null}

        <div className="onboarding-custom-role-wrap">
          <datalist id="role-title-suggestions">
            {CANONICAL_ROLES.filter(role => !draft.roles.some(selected => selected.toLowerCase() === role.toLowerCase())).map(role => <option key={role} value={role} />)}
          </datalist>
          <label className="onboarding-field-label" htmlFor="onboarding-custom-role-input">Add a title</label>
          <div className="onboarding-custom-role-input-row">
            <input
              type="text"
              id="onboarding-custom-role-input"
              list={draft.roles.length < 3 ? "role-title-suggestions" : undefined}
              autoComplete="off"
              className="onboarding-custom-role-input"
              value={customRoleInput}
              placeholder="add a role"
              onChange={(e) => {
                setCustomRoleInput(e.target.value);
                if (error && setError) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomRole();
                }
              }}
            />
            <button
              type="button"
              className="onboarding-custom-role-add-btn"
              onClick={handleAddCustomRole}
              aria-label="Add role"
              disabled={draft.roles.length >= 3}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </>
    );
  }

  if (step === 3) {
    const activeSkillOptions = (draft.extractedSkills && draft.extractedSkills.length > 0) ? draft.extractedSkills : skills;
    const isSkillError = Boolean(error && /skill/i.test(error));

    return (
      <>
        <p className="onboarding-lede">Choose up to five top skills — the ones recruiters see first.</p>
        <div className="onboarding-count">
          <strong>Your skills</strong>
          <span>{draft.skills.length} of 5 selected</span>
        </div>
        <ChoiceRow
          options={activeSkillOptions}
          selected={draft.skills}
          toggle={(value) => {
            toggle("skills", value, 5);
            if (error && /skill/i.test(error)) setError?.("");
          }}
          limit={5}
        />
        <TagInput
          values={draft.skills.filter((value) => !activeSkillOptions.includes(value))}
          update={(values) => {
            setDraft((current) => ({
              ...current,
              skills: [
                ...current.skills.filter((value) => activeSkillOptions.includes(value)),
                ...values,
              ].slice(0, 5),
            }));
            if (error && /skill/i.test(error)) setError?.("");
          }}
          placeholder="Add a skill"
          limit={5}
        />
        {isSkillError ? (
          <small
            id="step3-skills-error"
            className="onboarding-input-error"
            role="alert"
            style={{ marginTop: "8px", display: "block" }}
          >
            {error}
          </small>
        ) : null}
        <div className="onboarding-number-row">
          <label className="onboarding-check-row">
            <input
              type="checkbox"
              checked={draft.fresher}
              onChange={(event) => {
                onFresherToggle(event.target.checked);
                if (error && (/experience/i.test(error) || /skill/i.test(error))) setError?.("");
              }}
            />
            <span>I'm a fresher</span>
          </label>
          <Input
            id="onboarding-experience-years"
            label="Total years of experience"
            value={draft.fresher ? "0" : draft.experienceYears}
            onChange={(value) => {
              onExpChange(value);
              if (error && /experience/i.test(error)) setError?.("");
            }}
            placeholder="0"
            type="number"
            disabled={draft.fresher}
            required={!draft.fresher}
            error={error && /experience/i.test(error) ? error : undefined}
          />
        </div>
      </>
    );
  }

  if (step === 4) {
    const isCityError = Boolean(error && /city/i.test(error));

    return (
      <>
        <p className="onboarding-lede">Pick at least one preferred city. You can also switch on remote.</p>
        <div className="onboarding-count">
          <strong>Cities</strong>
          <span>{draft.cities.length} selected</span>
        </div>
        <ChoiceRow
          options={cities}
          selected={draft.cities}
          toggle={(value) => {
            toggle("cities", value);
            if (error && /city/i.test(error)) setError?.("");
          }}
        />
        <TagInput
          values={draft.cities.filter((value) => !cities.includes(value))}
          update={(values) => {
            setDraft((current) => ({
              ...current,
              cities: [...current.cities.filter((value) => cities.includes(value)), ...values],
            }));
            if (error && /city/i.test(error)) setError?.("");
          }}
          placeholder="Add a city"
        />
        {isCityError ? (
          <small
            id="step4-cities-error"
            className="onboarding-input-error"
            role="alert"
            style={{ marginTop: "8px", display: "block" }}
          >
            {error}
          </small>
        ) : null}
        <label className="onboarding-toggle">
          <span>
            <strong>Open to remote</strong>
            <small>Include remote roles from anywhere in India.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.remote}
            onChange={(event) => update("remote", event.target.checked)}
          />
        </label>
      </>
    );
  }

  if (step === 5) {
    return (
      <>
        <p className="onboarding-lede">Private context for how you think about your next move.</p>
        <div className="onboarding-comp-field">
          <Input
            id="onboarding-current-compensation"
            label="Current compensation"
            value={draft.fresher ? "0" : draft.currentCompensation}
            onChange={onCompChange}
            placeholder={draft.fresher ? "0" : "e.g. 18"}
            type="number"
            disabled={draft.fresher}
            optional
          />
          <span>₹ &nbsp; LPA</span>
        </div>
        {draft.fresher ? (
          <small className="onboarding-note" style={{ color: "#2d6b53", marginTop: "4px" }}>
            Current compensation is locked at ₹0 LPA for freshers / students.
          </small>
        ) : null}
        <label className="onboarding-check-row">
          <input
            type="checkbox"
            checked={draft.fresher}
            onChange={(event) => onFresherToggle(event.target.checked)}
          />
          <span>Fresher / Student</span>
        </label>
        <div className="onboarding-comp-field">
          <Input
            id="onboarding-expected-compensation"
            label="Expected compensation"
            value={draft.expectedCompensation}
            onChange={(value) => {
              update("expectedCompensation", value);
              if (error && /compensation/i.test(error)) setError?.("");
            }}
            placeholder="e.g. 28.5"
            type="number"
            required
            error={error && /compensation/i.test(error) ? error : undefined}
          />
          <span>₹ &nbsp; LPA</span>
        </div>
        <small className="onboarding-note">
          Compensation details are private to your profile.
        </small>
      </>
    );
  }

  if (step === 6) {
    const isStep6Error = Boolean(error && /mode|relocation|availability/i.test(error));
    const isModeMissing = isStep6Error && !draft.modes.length;
    const isRelocationMissing = isStep6Error && draft.modes.length > 0 && !draft.relocation;
    const isAvailabilityMissing =
      isStep6Error && draft.modes.length > 0 && Boolean(draft.relocation) && !draft.availability;

    const checkAndClearError = (
      nextModes: string[],
      nextRelocation: string,
      nextAvailability: string
    ) => {
      if (nextModes.length > 0 && nextRelocation && nextAvailability) {
        setError?.("");
      }
    };

    return (
      <>
        <p className="onboarding-lede">Shapes the matches we send you, not the forms we fill.</p>
        <div className="onboarding-field-heading">
          On-site, hybrid, or remote only? <b>*</b>
        </div>
        <ChoiceRow
          options={modes}
          selected={draft.modes}
          toggle={(value) => {
            const nextModes = toggleSelection(draft.modes, value);
            update("modes", nextModes);
            checkAndClearError(nextModes, draft.relocation, draft.availability);
          }}
        />
        {isModeMissing ? (
          <small id="step6-modes-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}

        <div className="onboarding-field-heading">
          Would you relocate for the right role? <b>*</b>
        </div>
        <ChoiceRow
          options={["Yes, for the right role", "No, keep me local"]}
          selected={draft.relocation ? [draft.relocation] : []}
          toggle={(value) => {
            update("relocation", value);
            checkAndClearError(draft.modes, value, draft.availability);
          }}
        />
        {isRelocationMissing ? (
          <small id="step6-relocation-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}

        <div className="onboarding-field-heading">
          When could you start? <b>*</b>
        </div>
        <ChoiceRow
          options={[
            "Ready to join immediately",
            "15 days",
            "1 month",
            "More than 1 month",
            "Currently not working",
          ]}
          selected={draft.availability ? [draft.availability] : []}
          toggle={(value) => {
            update("availability", value);
            checkAndClearError(draft.modes, draft.relocation, value);
          }}
        />
        {isAvailabilityMissing ? (
          <small id="step6-availability-error" className="onboarding-input-error" role="alert" style={{ marginTop: "6px", display: "block" }}>
            {error}
          </small>
        ) : null}
      </>
    );
  }

  if (step === 7) {
    return (
      <>
        <p className="onboarding-lede">
          Contact and location context for future application-ready features.
        </p>
        <div className="onboarding-form-grid">
          <Input
            id="onboarding-current-city"
            label="Current city"
            value={draft.currentCity}
            onChange={(value) => {
              update("currentCity", value);
              if (error && /current city/i.test(error) && value.trim()) setError?.("");
            }}
            placeholder="e.g. Bengaluru"
            required
            error={error && /current city/i.test(error) ? error : undefined}
          />
          <Input
            id="onboarding-state"
            label="State / province"
            value={draft.state}
            onChange={(value) => {
              update("state", value);
              if (error && /state|province/i.test(error) && value.trim()) setError?.("");
            }}
            placeholder="e.g. Karnataka"
            required
            error={error && /state|province/i.test(error) ? error : undefined}
          />
          <Input
            id="onboarding-postal-code"
            label="Postal code"
            value={draft.postalCode}
            onChange={(value) => {
              update("postalCode", value);
              if (error && /postal/i.test(error) && /^[a-zA-Z0-9\s-]{3,10}$/.test(value.trim())) setError?.("");
            }}
            placeholder="e.g. 560001"
            required
            error={error && /postal/i.test(error) ? error : undefined}
          />
          <PhoneInput
            id="onboarding-phone"
            value={draft.phone}
            onChange={(value) => {
              update("phone", value);
              if (error && /phone|mobile/i.test(error) && isValidPhoneInput(value) && normalizePhone(value) !== null) {
                setError?.("");
              }
            }}
            required
            error={error && /phone|mobile/i.test(error) ? error : undefined}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <p className="onboarding-lede">
        Add your GitHub profile so companies can evaluate your code and technical work.
      </p>
      <Input
        id="onboarding-github"
        label="GitHub profile"
        value={draft.github}
        onChange={(value) => {
          update("github", value);
          if (error && /github/i.test(error) && isValidGithubUrl(value)) setError?.("");
        }}
        placeholder="e.g. github.com/username"
        required
        error={error && /github/i.test(error) ? error : undefined}
      />
      <Input
        id="onboarding-portfolio"
        label="Portfolio / Personal site"
        value={draft.portfolio}
        onChange={(value) => update("portfolio", value)}
        placeholder="e.g. yoursite.com"
        optional
      />
    </>
  );
}
