import {SearchAutocomplete} from './SearchAutocomplete.js';
import {canonicalLocation,CITY_SUGGESTIONS,normalizeSearchText} from '../services/directoryPolicy.js';
import { numericEducationScore } from "../services/education.js";
import { RequiredMark } from "./RequiredMark.js";
import { SingleSelect } from "./SingleSelect.js";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Check, Upload, X } from "lucide-react";
import {
  ROLE_TITLES,
  SKILL_TITLES,
  MAX_PROFILE_SKILLS,
} from "../services/careerCatalog.js";
import {
  CAREER_STAGES,
  validateSetupSection,
} from "../services/setupValidation.js";
import { suggestRelatedRoles } from "../services/roleSuggestions.js";
import type { Draft } from "../services/onboarding.js";
import type { SavedResume } from "../services/resumeStorage.js";
import { SuggestionPicker } from "./SuggestionPicker.js";
import portrait1 from "../../imagee1.webp";
import portrait2 from "../../imagee2.webp";
import portrait3 from "../../imagee3.webp";
import portrait4 from "../../imagee4.webp";
import portrait5 from "../../imagee5.webp";
import portrait6 from "../../imagee6.webp";
import landscape from "../../image1.webp";
const horizon = "/assets/career-radar-hero-landscape.webp";

type Props = {
  stage: number;
  draft: Draft;
  resume: SavedResume | null;
  editing: boolean;
  busy: boolean;
  resumeBusy: boolean;
  resumeReady: boolean;
  error: string;
  notice: string;
  fileInput: RefObject<HTMLInputElement>;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  toggle: (key: "cities" | "modes", value: string) => void;
  addRole: (role: string) => void;
  move: (stage: number) => boolean;
  finish: () => Promise<void>;
  upload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  remove: () => Promise<void>;
  navigate: (path: string) => void;
};
export function RolePicker({
  roles,
  onAdd,
  onRemove,
}: {
  roles: string[];
  onAdd: (role: string) => void;
  onRemove: (role: string) => void;
}) {
  return (
    <div className="cr-role-picker">
      <div className="cr-field-label">
        <span>
          Target roles
          <RequiredMark />
        </span>
        <span>{roles.length}/3 selected</span>
      </div>
      <div className="cr-chips">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            className="cr-chip is-selected"
            aria-label={`Remove ${role}`}
            onClick={() => onRemove(role)}
          >
            {role}
            <X size={13} />
          </button>
        ))}
      </div>
      <SuggestionPicker
        label="Search or add a role"
        catalog={ROLE_TITLES}
        selected={roles}
        onAdd={onAdd}
        limit={3}
        listLabel="Suggested roles"
        required
      />
      <div className="cr-chips cr-role-recommendations">
        {(roles.length
          ? suggestRelatedRoles(roles)
          : [
              "Software Engineer",
              "Data Analyst",
              "Digital Marketing Executive",
              "Operations Associate",
            ]
        )
          .slice(0, 4)
          .filter((role) => !roles.includes(role))
          .map((role) => (
            <button
              key={role}
              type="button"
              className="cr-chip"
              disabled={roles.length >= 3}
              onClick={() => onAdd(role)}
            >
              + {role}
            </button>
          ))}
      </div>
    </div>
  );
}
const SECTIONS = [
  ["Roles", "Preferences"],
  ["Resume", "About you", "Education", "Skills", "Links"],
  ["Review"],
];
const IMAGES = [
  portrait1,
  portrait2,
  portrait3,
  portrait4,
  portrait5,
  portrait6,
  landscape,
  horizon,
];
const IMAGE_COPY = [
  "Find your direction.",
  "Make room for possibility.",
  "Start with your story.",
  "Your next chapter.",
  "Build on what you know.",
  "Let your strengths show.",
  "Connect the dots.",
  "A clearer next step.",
];
export function SetupSections({
  stage,
  draft,
  resume,
  editing,
  busy,
  resumeBusy,
  resumeReady,
  error,
  notice,
  fileInput,
  update,
  toggle,
  addRole,
  move,
  finish,
  upload,
  remove,
  navigate,
}: Props) {
  const [section, setSection] = useState(0);
  const [localError, setLocalError] = useState("");
  const [city, setCity] = useState("");
  const selectedCities=[...new Set(draft.cities.map(canonicalLocation))];
  const heading = useRef<HTMLHeadingElement>(null);
  const sections = SECTIONS[stage - 1]!;
  const sectionIndex = Math.min(section, sections.length - 1);
  const imageIndex =
    stage === 1 ? sectionIndex : stage === 2 ? sectionIndex + 2 : 7;
  useEffect(() => {
    setSection(0);
    setLocalError("");
  }, [stage]);
  useEffect(() => {
    setLocalError("");
  }, [draft, resume]);
  useEffect(() => {
    if (!error) return;
    if (stage === 1 && /location|work preference/i.test(error)) setSection(1);
    if (stage === 2) {
      if (/resume/i.test(error)) setSection(0);
      else if (/first name|career stage|years of experience/i.test(error))
        setSection(1);
      else if (/degree|qualification|graduation|marks|CGPA/i.test(error))
        setSection(2);
      else if (/LinkedIn|GitHub|Portfolio/i.test(error)) setSection(4);
    }
  }, [stage, error]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [stage, section]);
  const validate = () => {
    const message = validateSetupSection(
      stage,
      sectionIndex,
      draft,
      Boolean(resume),
    );
    setLocalError(message);
    return !message;
  };
  const next = () => {
    if (!validate()) return;
    if (sectionIndex < sections.length - 1) {
      setSection(sectionIndex + 1);
      setLocalError("");
    } else if (stage < 3) move(stage + 1);
    else void finish();
  };
  const back = () => {
    setLocalError("");
    if (sectionIndex > 0) setSection(sectionIndex - 1);
    else move(stage - 1);
  };
  const addCity = () => {
    const value = canonicalLocation(city.trim()).slice(0, 100);
    if (
      value &&
      !draft.cities.some((item) => normalizeSearchText(item) === normalizeSearchText(value))
    )
      update("cities", [...selectedCities, value]);
    setCity("");
  };
  const titles =
    stage === 1
      ? ["Choose your direction.", "Where would you like to work?"]
      : stage === 2
        ? [
            "Start with your resume.",
            "A little about you.",
            "Your education.",
            "What are your strengths?",
            "Add your profile links.",
          ]
        : ["Your radar, ready to go."];
  const captions =
    stage === 1
      ? [
          "Pick up to three roles. Add your own if needed.",
          "Choose at least one location and work preference.",
        ]
      : stage === 2
        ? [
            "Upload a PDF to fill in your details. Review them next.",
            "Tell us your name and career stage.",
            "Add your qualification, graduation year and marks.",
            "Review extracted skills and add anything missing.",
            "Optional. LinkedIn saves a link only.",
          ]
        : ["Check your details before exploring."];
  const shownError = localError || error;
  useEffect(() => {
    const next = new Image();
    next.src = IMAGES[(imageIndex + 1) % IMAGES.length]!;
  }, [imageIndex]);
  return (
    <main className="cr-setup">
      <header className="cr-setup-top"><a className="auth-logo" href="/">career<span>radar</span></a>{editing ? <button className="cr-text-button" type="button" onClick={() => navigate('/dashboard')}>Back to radar</button> : null}</header>
      <nav className="cr-steps" aria-label="Profile setup">
        {["Direction", "Background", "Review"].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={stage === index + 1 ? "step" : undefined}
            disabled={index + 1 > stage || busy || resumeBusy}
            onClick={() => move(index + 1)}
          >
            <span>{stage > index + 1 ? <Check size={14} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="cr-setup-grid">
        <aside className="cr-setup-image">
          <img key={imageIndex} src={IMAGES[imageIndex]} alt="" />
          <div>
            <h2>{IMAGE_COPY[imageIndex]}</h2>
            <span>Your profile stays private.</span>
          </div>
        </aside>
        <section className="cr-setup-form" aria-labelledby="setup-title">
          <div className="cr-setup-section-top">
            <p className="cr-overline">Step {stage} of 3</p>
            {sections.length > 1 ? (
              <span>
                {sectionIndex + 1} / {sections.length}
              </span>
            ) : null}
          </div>
          <h1 ref={heading} tabIndex={-1} id="setup-title">
            {titles[sectionIndex]}
          </h1>
          <p className="cr-intro">{captions[sectionIndex]}</p>
          {stage === 2 ? (
            <nav className="cr-subsections" aria-label="Background sections">
              {sections.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-current={index === sectionIndex ? "step" : undefined}
                  disabled={busy || resumeBusy || (stage === 2 && !resumeReady)}
                  onClick={() => {
                    for (let previous = 0; previous < index; previous++) {
                      const message = validateSetupSection(
                        stage,
                        previous,
                        draft,
                        Boolean(resume),
                      );
                      if (message) {
                        setSection(previous);
                        setLocalError(message);
                        return;
                      }
                    }
                    setSection(index);
                    setLocalError("");
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : null}
          <div key={`${stage}-${sectionIndex}`} className="cr-setup-section">
            {stage === 1 && sectionIndex === 0 ? (
              <RolePicker
                roles={draft.roles}
                onAdd={addRole}
                onRemove={(role) =>
                  update(
                    "roles",
                    draft.roles.filter((value) => value !== role),
                  )
                }
              />
            ) : null}
            {stage === 1 && sectionIndex === 1 ? (
              <div className="cr-fields">
                <fieldset>
                  <legend>
                    Preferred locations
                    <RequiredMark />
                  </legend>
                  <div className="cr-chips">
                    {[
                      ...new Set([
                        "Bengaluru",
                        "Mumbai",
                        "Pune",
                        "Hyderabad",
                        "Chennai",
                        "Delhi NCR",
                        "Remote",
                        ...selectedCities,
                      ]),
                    ].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selectedCities.includes(value)}
                        className={`cr-chip ${selectedCities.includes(value) ? "is-selected" : ""}`}
                        onClick={() => update("cities",selectedCities.includes(value)?selectedCities.filter(city=>city!==value):[...selectedCities,value])}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="cr-inline-form cr-city-add">
                    <SearchAutocomplete label="Another preferred city" placeholder="Add another city" maxLength={100} value={city} onChange={setCity} choices={CITY_SUGGESTIONS.map(value=>({value,kind:'Location'}))} onEnter={()=>addCity()}/>
                    <button
                      type="button"
                      className="auth-secondary"
                      disabled={!city.trim()}
                      onClick={addCity}
                    >
                      Add
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    Work preference
                    <RequiredMark />
                  </legend>
                  <div className="cr-chips">
                    {["On-site", "Hybrid", "Remote"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`cr-chip ${draft.modes.includes(value) ? "is-selected" : ""}`}
                        aria-pressed={draft.modes.includes(value)}
                        onClick={() => toggle("modes", value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : null}
            {stage === 2 && sectionIndex === 0 ? (
              <div className="cr-fields cr-identity-fields">
                <div className="cr-field-label">
                  <span>
                    Resume
                    <RequiredMark />
                  </span>
                </div>
                <div className="cr-resume-box">
                  <Upload size={19} />
                  <div>
                    <strong>{resume?.file_name || "Resume"}</strong>
                    <span>
                      {resumeBusy
                        ? "Reading and saving…"
                        : resume
                          ? `PDF · ${Math.max(1, Math.round(resume.file_size / 1024))} KB`
                          : "PDF up to 5 MB"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="auth-secondary"
                    disabled={resumeBusy || !resumeReady}
                    onClick={() => fileInput.current?.click()}
                  >
                    {resume ? "Replace" : "Choose PDF"}
                  </button>
                  {resume ? (
                    <button
                      type="button"
                      className="cr-icon-button"
                      aria-label="Remove stored resume"
                      disabled={resumeBusy}
                      onClick={() => void remove()}
                    >
                      <X size={17} />
                    </button>
                  ) : null}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    aria-label="Upload resume"
                    className="visually-hidden"
                    onChange={(event) => void upload(event)}
                  />
                </div>
                <p className="cr-small cr-resume-privacy">
                  <span>
                    {resume ? "Saved privately" : "Your PDF stays private"}
                  </span>{" "}
                  · <a href="/privacy">Privacy</a>
                </p>
                {notice ? (
                  <p className="cr-inline-notice" role="status">
                    {notice}
                  </p>
                ) : null}
              </div>
            ) : null}
            {stage === 2 && sectionIndex === 1 ? (
              <div className="cr-fields cr-identity-fields">
                <div className="cr-two-fields">
                  <label className="cr-field">
                    <span className="cr-field-caption">
                      First name
                      <RequiredMark />
                    </span>
                    <input
                      required
                      aria-label="First name"
                      value={draft.firstName}
                      maxLength={100}
                      autoComplete="given-name"
                      onChange={(event) =>
                        update("firstName", event.target.value)
                      }
                    />
                  </label>
                  <label className="cr-field">
                    <span className="cr-field-caption">
                      Last name <small>(optional)</small>
                    </span>
                    <input
                      value={draft.lastName}
                      maxLength={100}
                      autoComplete="family-name"
                      onChange={(event) =>
                        update("lastName", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="cr-field">
                  <span className="cr-field-caption">
                    Career stage
                    <RequiredMark />
                  </span>
                  <SingleSelect
                    label="Career stage"
                    value={draft.careerStage}
                    options={CAREER_STAGES}
                    required
                    invalid={Boolean(
                      shownError && /career stage/i.test(shownError),
                    )}
                    onChange={(value) => {
                      update("careerStage", value);
                      if (value === "Student / Fresher")
                        update("experienceYears", "0");
                      else if (draft.careerStage === "Student / Fresher")
                        update("experienceYears", "");
                    }}
                  />
                </div>
                {draft.careerStage &&
                draft.careerStage !== "Student / Fresher" ? (
                  <label className="cr-field">
                    <span className="cr-field-caption">
                      Years of experience
                      <RequiredMark />
                    </span>
                    <input
                      required
                      type="number"
                      min="0"
                      max="70"
                      step="any"
                      inputMode="decimal"
                      aria-label="Years of experience"
                      value={draft.experienceYears}
                      placeholder="e.g. 1.5"
                      onChange={(event) =>
                        update("experienceYears", event.target.value)
                      }
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            {stage === 2 && sectionIndex === 2 ? (
              <div className="cr-fields">
                <label className="cr-field">
                  <span className="cr-field-caption">
                    Degree / qualification
                    <RequiredMark />
                  </span>
                  <input
                    required
                    aria-label="Degree / qualification"
                    value={draft.educationDegree}
                    maxLength={160}
                    placeholder="e.g. B.Com, B.Tech, Diploma"
                    onChange={(event) =>
                      update("educationDegree", event.target.value)
                    }
                  />
                </label>
                <div className="cr-two-fields">
                  <label className="cr-field">
                    <span className="cr-field-caption">
                      Graduation year
                      <RequiredMark />
                    </span>
                    <input
                      required
                      inputMode="numeric"
                      aria-label="Graduation year"
                      value={draft.graduationYear}
                      maxLength={4}
                      placeholder="e.g. 2026"
                      onChange={(event) =>
                        update("graduationYear", event.target.value)
                      }
                    />
                  </label>
                  <label className="cr-field">
                    <span className="cr-field-caption">
                      Marks / CGPA
                      <RequiredMark />
                    </span>
                    <input
                      required
                      aria-label="Marks / CGPA"
                      value={draft.educationScore}
                      maxLength={80}
                      placeholder="e.g. 8.26"
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/^\d*(?:\.\d*)?$/.test(value))
                          update("educationScore", value);
                        else {
                          const number = numericEducationScore(value);
                          if (number) update("educationScore", number);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            {stage === 2 && sectionIndex === 3 ? (
              <div className="cr-fields">
                <div className="cr-field-label">
                  <span>Skills (optional)</span>
                  <span>
                    {draft.skills.length}/{MAX_PROFILE_SKILLS}
                  </span>
                </div>
                <div className="cr-chips">
                  {draft.skills.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="cr-chip is-selected"
                      aria-label={`Remove skill ${value}`}
                      onClick={() =>
                        update(
                          "skills",
                          draft.skills.filter((item) => item !== value),
                        )
                      }
                    >
                      {value}
                      <X size={13} />
                    </button>
                  ))}
                </div>
                <SuggestionPicker
                  label="Add a skill"
                  catalog={SKILL_TITLES}
                  selected={draft.skills}
                  onAdd={(value) => update("skills", [...draft.skills, value])}
                  limit={MAX_PROFILE_SKILLS}
                  listLabel="Suggested skills"
                />
                <p className="cr-small">
                  Check the extracted skills. You can add your own.
                </p>
              </div>
            ) : null}
            {stage === 2 && sectionIndex === 4 ? (
              <div className="cr-fields">
                {(["linkedin", "github", "portfolio"] as const).map((key) => (
                  <label className="cr-field" key={key}>
                    <span className="cr-field-caption">
                      {key === "linkedin"
                        ? "LinkedIn"
                        : key === "github"
                          ? "GitHub"
                          : "Portfolio"}{" "}
                      <small>(optional)</small>
                    </span>
                    <input
                      type="url"
                      value={draft[key]}
                      placeholder="https://"
                      onChange={(event) => update(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {stage === 3 ? (
              <div className="cr-review">
                <dl>
                  {[
                    ["Your roles", draft.roles.join(", ")],
                    ["Locations", selectedCities.join(", ")],
                    ["Work mode", draft.modes.join(", ")],
                    [
                      "Background",
                      [
                        draft.careerStage,
                        draft.careerStage !== "Student / Fresher"
                          ? `${draft.experienceYears} years`
                          : "",
                        draft.educationDegree,
                        draft.graduationYear,
                        draft.educationScore,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    ],
                    ["Skills", draft.skills.join(", ") || "Not added"],
                    ["Resume", resume?.file_name || "Not uploaded"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
          {shownError ? (
            <p className="cr-error" role="alert">
              {shownError}
            </p>
          ) : null}
          <footer className="cr-setup-actions">
            {stage > 1 || sectionIndex > 0 ? (
              <button
                type="button"
                className="auth-secondary"
                disabled={busy || resumeBusy || (stage === 2 && !resumeReady)}
                onClick={back}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <span />
            )}
            <div>
              <button
                type="button"
                className="auth-primary"
                disabled={busy || resumeBusy || (stage === 2 && !resumeReady)}
                onClick={next}
              >
                {busy
                  ? "Saving…"
                  : stage === 3
                    ? editing
                      ? "Save profile"
                      : "Open my radar"
                    : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
