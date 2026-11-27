import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  APPLICATION_STATUSES,
  deleteApplication,
  restoreApplication,
  saveApplication,
  updateApplication,
  type Application,
  type ApplicationStatus,
} from "../services/candidateWorkspace.js";
import { browserUuid } from "../services/browserUuid.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { CompanyRoleSearch } from "./CompanyRoleSearch.js";
import { RequiredMark } from "./RequiredMark.js";
import "./trackerFeedback.css";

type Props = {
  userId: string;
  rows: Application[];
  setRows: React.Dispatch<React.SetStateAction<Application[]>>;
  error: string;
  retry: () => void;
};
const stamp = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function Tracker({ userId, rows, setRows, error, retry }: Props) {
  const [adding, setAdding] = useState(false),
    [company, setCompany] = useState(""),
    [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [filter, setFilter] = useState(
      () => new URLSearchParams(location.search).get("status") ?? "All",
    );
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [noticeIsError, setNoticeIsError] = useState(false),
    [removed, setRemoved] = useState<Application[]>([]),
    [restoring, setRestoring] = useState("");
  const form = useRef<HTMLFormElement>(null),
    feedback = useRef<HTMLParagraphElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const restore = () =>
      setFilter(new URLSearchParams(location.search).get("status") ?? "All");
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("application");
    if (id)
      document
        .getElementById("application-" + id)
        ?.scrollIntoView({ block: "center" });
  }, []);
  const changeFilter = (value: string) => {
    setFilter(value);
    const params = new URLSearchParams(location.search);
    params.delete("application");
    if (value === "All") params.delete("status");
    else params.set("status", value);
    history.replaceState(
      {},
      "",
      location.pathname + (params.size ? "?" + params : ""),
    );
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!company.trim()) next.company = "Add a company name.";
    if (!title.trim()) next.title = "Add a role title.";
    if (url && !safeExternalUrl(url))
      next.url = "Use an http or https job link.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setBusy(true);
    setNotice("");
    setNoticeIsError(false);
    try {
      const item = await saveApplication(userId, {
        entity_key: "manual:" + browserUuid(),
        source_kind: "MANUAL",
        company_name: company,
        title,
        source_url: url || null,
      });
      if (mounted.current) {
        setRows((old) => [item, ...old.filter((row) => row.id !== item.id)]);
        setAdding(false);
        setCompany("");
        setTitle("");
        setUrl("");
        changeFilter("All");
        setNotice("Role added to your tracker.");
      }
    } catch (error) {
      if (mounted.current) {
        setErrors({
          form:
            error instanceof Error ? error.message : "Could not add this role.",
        });
        requestAnimationFrame(() => feedback.current?.focus());
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const undo = async (item: Application) => {
    if (restoring) return;
    setRestoring(item.id);
    setNotice("");
    setNoticeIsError(false);
    try {
      const restored = await restoreApplication(userId, item);
      if (mounted.current) {
        setRows((old) => [
          restored,
          ...old.filter((row) => row.entity_key !== restored.entity_key),
        ]);
        setRemoved((old) => old.filter((row) => row.id !== item.id));
        changeFilter("All");
        setNotice("Role is back in your tracker.");
      }
    } catch (error) {
      if (mounted.current) {
        setNoticeIsError(true);
        setNotice(
          error instanceof Error
            ? error.message
            : "Restore could not be confirmed. Refresh your tracker before retrying.",
        );
      }
    } finally {
      if (mounted.current) setRestoring("");
    }
  };
  const visible = rows.filter(
    (row) =>
      filter === "All" ||
      !APPLICATION_STATUSES.includes(filter as ApplicationStatus) ||
      row.status === filter,
  );
  return (
    <section className="cr-tracker">
      <div className="cr-tracker-toolbar">
        <label className="cr-field">
          Stage
          <select
            aria-label="Filter tracker stage"
            value={
              APPLICATION_STATUSES.includes(filter as ApplicationStatus)
                ? filter
                : "All"
            }
            onChange={(event) => changeFilter(event.target.value)}
          >
            {["All", ...APPLICATION_STATUSES].map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
        <button
          className="auth-primary"
          disabled={Boolean(error) || adding}
          onClick={() => {
            setAdding(true);
            setErrors({});
          }}
        >
          + Add a role
        </button>
      </div>
      {error ? (
        <div className="cr-error" role="alert">
          {error}
          <button className="auth-secondary" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      {adding ? (
        <form
          ref={form}
          className="cr-manual-form"
          noValidate
          onSubmit={(event) => void add(event)}
        >
          <h2>Track a role you found</h2>
          <div className="cr-two-fields">
            <label className="cr-field">
              <span>
                Company
                <RequiredMark />
              </span>
              <CompanyRoleSearch
                label="Company"
                value={company}
                onChange={setCompany}
                kind="company"
                nameOnly
                invalid={Boolean(errors.company)}
                errorId={errors.company ? "tracker-company-error" : undefined}
              />
              {errors.company ? (
                <small className="auth-error" id="tracker-company-error">
                  {errors.company}
                </small>
              ) : null}
            </label>
            <label className="cr-field">
              <span>
                Role
                <RequiredMark />
              </span>
              <CompanyRoleSearch
                label="Role"
                value={title}
                onChange={setTitle}
                kind="role"
                invalid={Boolean(errors.title)}
                errorId={errors.title ? "tracker-title-error" : undefined}
              />
              {errors.title ? (
                <small className="auth-error" id="tracker-title-error">
                  {errors.title}
                </small>
              ) : null}
            </label>
          </div>
          <label className="cr-field">
            Job link (optional)
            <input
              type="url"
              aria-label="Job link"
              aria-invalid={Boolean(errors.url)}
              aria-describedby={errors.url ? "tracker-url-error" : undefined}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
            />
            {errors.url ? (
              <small className="auth-error" id="tracker-url-error">
                {errors.url}
              </small>
            ) : null}
          </label>
          {errors.form ? (
            <p ref={feedback} tabIndex={-1} className="cr-error" role="alert">
              {errors.form}
            </p>
          ) : null}
          <div className="cr-detail-actions">
            <button
              className="auth-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setErrors({});
              }}
            >
              Cancel
            </button>
            <button className="auth-primary" disabled={busy}>
              {busy ? "Saving…" : "Add to tracker"}
            </button>
          </div>
        </form>
      ) : null}
      {notice ? (
        <p
          className={noticeIsError ? "cr-error" : "cr-tracker-feedback"}
          role={noticeIsError ? "alert" : "status"}
        >
          {notice}
        </p>
      ) : null}
      {removed.map((item) => (
        <div className="cr-tracker-undo" key={item.id}>
          <p role="status">Removed {item.title}.</p>
          <button
            className="auth-secondary"
            disabled={Boolean(restoring)}
            onClick={() => void undo(item)}
          >
            {restoring === item.id ? "Restoring…" : "Undo"}
          </button>
          <button
            className="cr-text-button"
            disabled={restoring === item.id}
            onClick={() =>
              setRemoved((old) => old.filter((row) => row.id !== item.id))
            }
          >
            Dismiss
          </button>
        </div>
      ))}
      {removed.length ? (
        <p className="cr-small">
          Undo is available until you refresh or leave this page.
        </p>
      ) : null}
      {!error && !rows.length && !adding ? (
        <div className="cr-empty">
          <h2>Keep your next move in view.</h2>
          <p>Save a role while browsing or add one you found elsewhere.</p>
          <button className="auth-secondary" onClick={() => setAdding(true)}>
            Add your first role
          </button>
        </div>
      ) : null}
      <div className="cr-tracker-list">
        {visible.map((item) => (
          <TrackerRow
            key={item.id}
            item={item}
            userId={userId}
            onChange={(next) =>
              setRows((old) =>
                old.map((row) => (row.id === next.id ? next : row)),
              )
            }
            onRemove={() => {
              setRows((old) => old.filter((row) => row.id !== item.id));
              setRemoved((old) => [item, ...old]);
            }}
          />
        ))}
        {rows.length > 0 && !visible.length ? (
          <p className="cr-inline-notice">
            No roles in this stage. Choose another stage or select All.
          </p>
        ) : null}
      </div>
    </section>
  );
}
function TrackerRow({
  item,
  userId,
  onChange,
  onRemove,
}: {
  item: Application;
  userId: string;
  onChange: (item: Application) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [expanded, setExpanded] = useState(false),
    [followup, setFollowup] = useState(""),
    [confirming, setConfirming] = useState(false),
    [removing, setRemoving] = useState(false);
  const mounted = useRef(true),
    removeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = async (patch: {
    status?: ApplicationStatus;
    notes?: string;
  }) => {
    setBusy(true);
    setMessage("");
    try {
      const next = await updateApplication(userId, item.id, patch);
      if (mounted.current) {
        onChange(next);
        setMessage("Saved.");
      }
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error ? error.message : "Could not save changes.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const cancel = () => {
    setConfirming(false);
    requestAnimationFrame(() => removeButton.current?.focus());
  };
  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    setMessage("");
    try {
      await deleteApplication(userId, item.id);
      if (mounted.current) onRemove();
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Removal could not be confirmed. Refresh your tracker before retrying.",
        );
    } finally {
      if (mounted.current) setRemoving(false);
    }
  };
  const pending = busy || removing;
  const due =
    item.status === "Applied" &&
    item.applied_at &&
    Date.now() - Date.parse(item.applied_at) >= 7 * 86400000;
  const original = safeExternalUrl(item.source_url);
  return (
    <article
      id={"application-" + item.id}
      className="cr-tracker-row"
      aria-busy={pending}
    >
      <div className="cr-tracker-row-main">
        <div>
          <p className="cr-company-name">{item.company_name}</p>
          <h2>{item.title}</h2>
          <p className="cr-small">
            {item.source_kind === "MANUAL" ? "Added by you" : "Saved from jobs"}{" "}
            · Saved {stamp(item.created_at)}
          </p>
          {due ? (
            <p className="cr-caution">
              Consider a follow-up. Applied {stamp(item.applied_at!)}.
            </p>
          ) : null}
        </div>
        <label className="cr-field">
          <span className="visually-hidden">Stage for {item.title}</span>
          <select
            aria-label={"Stage for " + item.title}
            value={item.status}
            disabled={pending}
            onChange={(event) =>
              void save({ status: event.target.value as ApplicationStatus })
            }
          >
            {APPLICATION_STATUSES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="cr-tracker-links">
        {item.source_kind === "OPPORTUNITY" &&
        item.entity_key.startsWith("opportunity:") ? (
          <a href={"/jobs/" + encodeURIComponent(item.entity_key.slice(12))}>
            View role
          </a>
        ) : original ? (
          <a href={original} target="_blank" rel="noopener noreferrer">
            Original link
          </a>
        ) : null}
        <button
          className="cr-text-button"
          aria-expanded={expanded}
          disabled={pending}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide notes" : "Notes & next step"}
        </button>
      </div>
      {expanded ? (
        <div className="cr-tracker-notes">
          <label className="cr-field">
            Private notes
            <textarea
              aria-label={"Private notes for " + item.title}
              rows={3}
              value={notes}
              maxLength={4000}
              disabled={pending}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What happened? What will you do next?"
            />
          </label>
          <div className="cr-detail-actions">
            <button
              className="auth-secondary"
              disabled={pending || notes === item.notes}
              onClick={() => void save({ notes })}
            >
              {busy ? "Saving…" : "Save notes"}
            </button>
            {["Applied", "Interview", "No response"].includes(item.status) ? (
              <button
                className="auth-secondary"
                disabled={pending}
                onClick={() =>
                  setFollowup(
                    `Hello,\n\nI’m following up on my application for ${item.title} at ${item.company_name}. Could you share any update on the next steps?\n\nThank you.`,
                  )
                }
              >
                Draft a follow-up
              </button>
            ) : null}
            <button
              ref={removeButton}
              className="cr-text-button cr-danger"
              disabled={pending || confirming}
              onClick={() => setConfirming(true)}
            >
              Remove role
            </button>
          </div>
          {confirming ? (
            <div
              className="cr-tracker-confirm"
              role="group"
              aria-label={"Confirm removal of " + item.title}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !removing) cancel();
              }}
            >
              <p>
                Remove {item.title} from your tracker? You can undo this on this
                page.
              </p>
              <div className="cr-detail-actions">
                <button
                  autoFocus
                  className="auth-secondary"
                  disabled={removing}
                  onClick={cancel}
                >
                  Keep role
                </button>
                <button
                  className="auth-primary"
                  disabled={removing}
                  onClick={() => void remove()}
                >
                  {removing ? "Removing…" : "Confirm removal"}
                </button>
              </div>
            </div>
          ) : null}
          {followup ? (
            <label className="cr-field">
              Follow-up draft · Copy and send yourself
              <textarea
                aria-label={"Follow-up draft for " + item.title}
                rows={6}
                value={followup}
                onChange={(event) => setFollowup(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p
          className={message === "Saved." ? "cr-small" : "cr-error"}
          role={message === "Saved." ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
    </article>
  );
}
