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
const roles = [
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

export function loadDraft(userId?: string): Draft {
  try {
    const key = userId ? `career-radar-onboarding-draft:${userId}` : "career-radar-onboarding-draft";
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Draft> & { _ownerId?: string };
      if (userId && parsed._ownerId && parsed._ownerId !== userId) {
        return blankDraft();
      }
      return { ...blankDraft(), ...parsed };
    }
    if (userId) {
      const legacy = window.localStorage.getItem("career-radar-onboarding-draft");
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<Draft> & { _ownerId?: string };
        if (!parsed._ownerId || parsed._ownerId === userId) {
          return { ...blankDraft(), ...parsed };
        }
      }
    }
    return blankDraft();
  } catch {
    return blankDraft();
  }
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
  const { loading, userId, profile, error: authError } = auth;
  const safeRedirectTarget = safeInternalRedirect("/onboarding", "/onboarding");
  const loginUrl = `/login?redirect=${encodeURIComponent(safeRedirectTarget)}`;
  const signupUrl = `/signup?redirect=${encodeURIComponent(safeRedirectTarget)}`;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
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
    try {
      const toSave = userId ? { ...draft, _ownerId: userId } : draft;
      if (userId) {
        window.localStorage.setItem(`career-radar-onboarding-draft:${userId}`, JSON.stringify(toSave));
      }
      window.localStorage.setItem("career-radar-onboarding-draft", JSON.stringify(toSave));
    } catch {
      /* Local draft is best-effort. */
    }
  }, [draft, userId]);

  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setDraft((current) => {
      const next = hydrateDraftFromProfile(current, profile);
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

  const onResume = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      } else if (result.status === "error") {
        setError(result.message);
      }
    } catch {
      setError("We couldn't read that PDF. Try an unlocked PDF with selectable text.");
    } finally {
      setParsingResume(false);
    }
  };

  const removeResume = (event?: React.MouseEvent) => {
    event?.stopPropagation();
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
      setError("Please paste a LinkedIn profile URL (e.g. linkedin.com/in/you) to import.");
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
        <p className="onboarding-loading">Checking your secure session…</p>
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
            <div className="onboarding-actions">
              <button
                className="auth-secondary"
                type="button"
                onClick={step === 1 ? () => void completeLater() : back}
                disabled={busy}
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
                  disabled={busy || (step === 1 && parsingResume)}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button className="auth-primary" type="button" onClick={() => void finish()} disabled={busy}>
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
    const trimmed = customRoleInput.trim();
    if (!trimmed) return;
    if (draft.roles.includes(trimmed)) {
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
        <p className="onboarding-lede">Upload your latest resume or paste your LinkedIn profile URL.</p>
        <div className="resume-upload-wrapper">
          <button
            id="step1-resume-dropzone"
            className={`resume-dropzone ${draft.resumeName ? "has-file" : ""}`}
            type="button"
            onClick={() => resumeRef?.current?.click()}
            disabled={parsingResume}
            aria-invalid={Boolean(isFileError || isStep1GeneralError)}
            aria-describedby={
              isFileError ? "step1-resume-error" : isStep1GeneralError ? "step1-general-error" : undefined
            }
          >
            <span className="onboarding-icon">
              {draft.resumeName ? <Check size={19} /> : <Upload size={19} />}
            </span>
            <span>
              <strong>
                {parsingResume ? "Reading your resume locally…" : draft.resumeName || "Upload your resume"}
              </strong>
              <small>
                {draft.resumeName
                  ? `${(draft.resumeBytes / 1024 / 1024).toFixed(1)} MB selected · PDF only`
                  : "PDF · we'll read your experience, skills and locations"}
              </small>
            </span>
          </button>
          {draft.resumeName && !parsingResume ? (
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
            Import <ArrowRight size={14} />
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
          * Your resume or LinkedIn is required to continue.
        </small>
      </>
    );
  }

  if (step === 2) {
    const resumeRoles = draft.extractedRoles || [];
    const hasResumeRoles = resumeRoles.length > 0;

    const additionalRoles = draft.roles.filter(
      (r) => (hasResumeRoles ? !resumeRoles.includes(r) : !roles.includes(r))
    );

    const isRoleError = Boolean(error && (/role/i.test(error) || /title/i.test(error)));

    return (
      <>
        <div className="onboarding-role-header">
          <span className="onboarding-role-instruction">Select your top 3 titles</span>
          <span className="onboarding-role-count">{draft.roles.length} of 3 selected</span>
        </div>

        {hasResumeRoles ? (
          <div className="onboarding-role-section">
            <span className="onboarding-section-label">From your resume</span>
            <div
              className="onboarding-pill-grid"
              role="group"
              aria-label="Roles from your resume"
              aria-describedby={isRoleError ? "step2-roles-error" : undefined}
            >
              {resumeRoles.map((role) => {
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
        ) : draft.resumeName ? (
          <div className="onboarding-empty-notice" role="note">
            No target roles detected from your experience. Add up to 3 roles manually below.
          </div>
        ) : (
          <div className="onboarding-role-section">
            <span className="onboarding-section-label">Suggested roles</span>
            <div
              className="onboarding-pill-grid"
              role="group"
              aria-label="Suggested roles"
              aria-describedby={isRoleError ? "step2-roles-error" : undefined}
            >
              {roles.map((role) => {
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
        )}

        {additionalRoles.length > 0 ? (
          <div className="onboarding-role-section">
            <span className="onboarding-section-label">Your added roles</span>
            <div className="onboarding-pill-grid" role="group" aria-label="Your added roles">
              {additionalRoles.map((role) => (
                <button
                  type="button"
                  key={role}
                  className="onboarding-role-pill selected"
                  onClick={() => {
                    toggle("roles", role, 3);
                    if (error && setError) setError("");
                  }}
                  aria-pressed={true}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
          <span className="onboarding-field-label">Add a title</span>
          <div className="onboarding-custom-role-input-row">
            <input
              type="text"
              id="onboarding-custom-role-input"
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
