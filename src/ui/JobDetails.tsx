import {JobApplyAccess} from "./LinkAccess.js";
import {companyProfilePath} from '../services/companyProfileUrls.js';
import {StructuredDescription} from './StructuredDescription.js';
import { jobPath } from "../services/jobUrls.js";
import {
  cleanRoleDescription,
  statedRequirements,
} from "../services/roleContent.js";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  ExternalLink,
  LockKeyhole,
} from "lucide-react";
import { CompanyLogo } from "./CompanyLogo.js";
import { BoardJobCard } from "./JobsBoard.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import type { SiteAccount } from "./SiteHeader.js";
import {
  explainOpportunity,
  isRecentOpening,
  loadApplications,
  loadCompanyOpenings,
  publishedContact,
  saveApplication,
  updateApplication,
  type Application,
  type Opportunity,
} from "../services/candidateWorkspace.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { splitJobDescription } from "../services/jobDescription.js";
import "./jobDetails.css";

function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not stated";
}
const companySearch = (name: string) =>
  "/jobs?" + new URLSearchParams({ query: name });
const filters = (values: Record<string, string>) =>
  "/jobs?" + new URLSearchParams(values);

export function JobDetails({
  job,
  account,
  navigate,
}: {
  job: Opportunity;
  account: SiteAccount;
  navigate: (path: string) => void;
}) {
  const [applications, setApplications] = useState<Record<string, Application>>(
    {},
  );
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [askApplied, setAskApplied] = useState(false);
  const [company, setCompany] = useState<{
      jobs: Opportunity[];
      total: number;
    } | null>(null),
    [companyLoading, setCompanyLoading] = useState(true),
    [companyError, setCompanyError] = useState(false),
    [revision, setRevision] = useState(0);
  const mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (account.userId)
      void loadApplications(account.userId)
        .then((rows) => {
          if (active)
            setApplications(
              Object.fromEntries(rows.map((row) => [row.entity_key, row])),
            );
        })
        .catch(() => {});
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [account.userId]);
  useEffect(() => {
    let active = true;
    setCompanyLoading(true);
    setCompanyError(false);
    void loadCompanyOpenings(job)
      .then((data) => {
        if (active) setCompany(data);
      })
      .catch(() => {
        if (active) {
          setCompany(null);
          setCompanyError(true);
        }
      })
      .finally(() => {
        if (active) setCompanyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job.id, job.company_name, revision]);
  const save = async (target: Opportunity, applied = false) => {
    if (!account.userId) {
      navigate("/login?redirect=" + encodeURIComponent(jobPath(target)));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(target.id);
    setError("");
    setMessage("");
    try {
      let row =
        applications["opportunity:" + target.id] ??
        (await saveApplication(account.userId, {
          entity_key: "opportunity:" + target.id,
          source_kind: "OPPORTUNITY",
          company_name: target.company_name,
          title: target.title,
          source_url:
            safeExternalUrl(target.application_url) ||
            safeExternalUrl(target.source_url),
        }));
      if (applied)
        row = await updateApplication(account.userId, row.id, {
          status: "Applied",
        });
      if (mounted.current) {
        setApplications((current) => ({ ...current, [row.entity_key]: row }));
        setMessage(
          applied ? "Recorded as applied." : "Saved to your applications.",
        );
        setAskApplied(false);
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Please retry saving.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const description = splitJobDescription(job.description, job.company_name);
  const companyDetailsHref = job.company_profile_path || companyProfilePath({name:job.company_name,location:job.location});
  const roleText = cleanRoleDescription(description.roleText, job.title);
  const requirements = statedRequirements(job);
  const saved = applications["opportunity:" + job.id];
  const profile = account.snapshot?.profile ?? null,
    explanation = profile ? explainOpportunity(job, profile) : null;
  const contact = publishedContact(job),
    recent = isRecentOpening(job),
    apply =
      safeExternalUrl(job.application_url) || safeExternalUrl(job.source_url);
  const source = safeExternalUrl(job.source_url),
    login = "/login?redirect=" + encodeURIComponent(jobPath(job));
  const otherJobs = company?.jobs ?? [];
  const facts = [
    ["Location", job.location],
    ["Job type", job.employment_type],
    ["Workplace", job.work_mode],
    ["Posted", job.published_at ? date(job.published_at) : null],
    ["Last checked", job.last_checked_at ? date(job.last_checked_at) : null],
    ...(job.salary ? [["Salary", job.salary]] : []),
  ].filter(
    ([, value]) =>
      typeof value === "string" && value.trim() && value !== "Not stated",
  );
  return (
    <article className="sf-role-detail">
      <div className="sf-role-grid">
        <div className="sf-role-main">
          <header className="sf-role-card sf-role-summary">
            <nav className="sf-role-breadcrumb" aria-label="Breadcrumb">
              <a href="/jobs">Jobs</a>
              <span aria-hidden="true">/</span>
              <a href={companyDetailsHref}>{job.company_name}</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{job.title}</span>
            </nav>
            <div className="sf-role-title">
              <CompanyLogo name={job.company_name} companyId={job.company_id} logoUrl={job.company_logo_url} className="sf-role-logo" />
              <div>
                <h1>{job.title}</h1>
                <a href={companyDetailsHref}>{job.company_name}</a>
              </div>
            </div>
            <p className="sf-role-intro">
              {job.company_name} lists this role
              {job.location ? <> for {job.location}</> : null}. Sourced from the
              employer’s job board
              {job.last_checked_at ? (
                <> and checked on {date(job.last_checked_at)}</>
              ) : null}
              .
            </p>
            <dl className="sf-role-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </header>
          <section className="sf-role-card sf-role-description">
            <h2>About this role</h2>
            <StructuredDescription text={roleText || "Role-specific details were not provided in the source feed. Check the employer’s original posting for the available details."} />
          </section>
          {requirements.length ? (
            <section className="sf-role-card sf-role-requirements">
              <h2>Requirements at a glance</h2>
              <dl className="sf-role-requirement-list">
                {requirements.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {explanation ? (
                <div className="sf-role-profile-context">
                  <h3>Compared with your profile</h3>
                  <p>
                    {explanation.reasons.join(" · ") ||
                      "No direct role or skill matches were found in the available details."}
                  </p>
                  {explanation.gap ? (
                    <p className="cr-caution">{explanation.gap}</p>
                  ) : null}
                  <p className="sf-hint">
                    Check the original requirements before applying.
                  </p>
                </div>
              ) : (
                <a className="sf-role-inline-link" href="/profile">
                  Set up your profile for personal context{" "}
                  <ArrowRight size={15} />
                </a>
              )}
            </section>
          ) : null}
          {contact ? (
            <section className="sf-role-card sf-role-contact">
              <h2>Hiring contact</h2>
              {account.userId ? (
                <>
                  <a href={"mailto:" + contact}>{contact}</a>
                  {safeExternalUrl(job.contact_source_url) ? (
                    <a
                      className="sf-role-inline-link"
                      href={job.contact_source_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Contact source <ExternalLink size={14} />
                    </a>
                  ) : null}
                </>
              ) : (
                <a className="sf-role-inline-link" href={login}>
                  Sign in to view the sourced contact <ArrowRight size={15} />
                </a>
              )}
            </section>
          ) : null}
          <section className="sf-role-card sf-role-related">
            <h2>Explore related roles</h2>
            <div className="sf-role-chips">
              {job.skills.slice(0, 2).map((skill) => (
                <a key={skill} href={filters({ query: skill })}>
                  {skill} jobs
                </a>
              ))}
              {job.location ? (
                <a href={filters({ location: job.location })}>
                  More in this location
                </a>
              ) : null}
              <a href={filters({ experience: "internship" })}>Internships</a>
              <a href={filters({ experience: "freshers" })}>Fresher roles</a>
            </div>
          </section>
        </div>
        <aside
          className="sf-role-aside"
          aria-label="Application and company information"
        >
          <section className="sf-role-card sf-role-apply sf-action-panel">
            <h2>Apply for this role</h2>
            <p>You apply on {job.company_name}’s own site.</p>
            {recent?<JobApplyAccess key={(account.userId??'guest')+job.id} userId={account.userId} jobId={job.id} returnPath={jobPath(job)} onOpen={()=>setAskApplied(true)}/>:<p className="cr-caution">This role is no longer available or needs a fresh source check.</p>}
            <button
              className="auth-secondary"
              disabled={!!busy || account.loading || !!saved}
              onClick={() => void save(job)}
            >
              {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
              {saved ? "Saved" : busy === job.id ? "Saving…" : "Save role"}
            </button>
            {askApplied ? (
              <div className="sf-apply-confirm">
                <p>Did you submit an application?</p>
                <button
                  className="auth-primary"
                  disabled={!!busy}
                  onClick={() => void save(job, true)}
                >
                  Yes, mark applied
                </button>
                <button
                  className="cr-text-button"
                  onClick={() => setAskApplied(false)}
                >
                  Not yet
                </button>
              </div>
            ) : null}
            {error ? (
              <p className="cr-error" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p role="status">
                {message} <a href="/tracker">Open tracker</a>
              </p>
            ) : null}

          </section>
        </aside>
      </div>
      <section className="sf-role-more" aria-labelledby="more-company-roles">
        <header>
          <h2 id="more-company-roles">More open roles at {job.company_name}</h2>
          {company ? (
            <a href={companySearch(job.company_name)}>
              All {company.total} <ArrowRight size={14} />
            </a>
          ) : null}
        </header>
        {companyLoading ? (
          <LoadingSkeleton label="Loading company openings" rows={3} />
        ) : companyError ? (
          <div className="sf-role-card">
            <p>Other openings could not be loaded.</p>
            <button
              className="auth-secondary"
              onClick={() => setRevision((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : otherJobs.length ? (
          <div className="sf-board-cards">
            {otherJobs.map((other) => (
              <BoardJobCard
                key={other.id}
                job={other}
                userId={account.userId}
                profile={profile}
                saved={!!applications["opportunity:" + other.id]}
                disabled={!!busy || account.loading}
                saving={busy === other.id}
                onSave={() => void save(other)}
              />
            ))}
          </div>
        ) : (
          <p className="sf-role-empty">
            No other checked roles from this company are listed on CareerRadar
            right now.
          </p>
        )}
      </section>
      <section className="sf-role-browse">
        <h2>Browse jobs in India</h2>
        <p>Explore roles from connected employers’ own job boards.</p>
        <div>
          {[
            {
              title: "By role",
              links: [
                "Software Engineer",
                "Data Analyst",
                "Designer",
                "Marketing",
                "Operations",
                "Sales",
              ].map((label) => ({ label, href: filters({ query: label }) })),
            },
            {
              title: "Early career",
              links: [
                {
                  label: "Internships",
                  href: filters({ experience: "internship" }),
                },
                {
                  label: "Fresher roles",
                  href: filters({ experience: "freshers" }),
                },
                { label: "All open roles", href: "/jobs" },
              ],
            },
            {
              title: "By location",
              links: [
                "Bengaluru",
                "Hyderabad",
                "Mumbai",
                "Pune",
                "Chennai",
                "Delhi",
                "Noida",
                "Gurugram",
              ].map((label) => ({ label, href: filters({ location: label }) })),
            },
            {
              title: "Workplace",
              links: ["Remote", "Hybrid", "Onsite"].map((label) => ({
                label,
                href: filters({ workMode: label }),
              })),
            },
          ].map((group) => (
            <nav key={group.title} aria-label={group.title + " job links"}>
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>
      </section>
    </article>
  );
}
