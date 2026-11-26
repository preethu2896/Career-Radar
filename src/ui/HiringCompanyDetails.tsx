import {StructuredDescription} from './StructuredDescription.js';
import {removeOpeningAboutHeading} from '../services/descriptionBlocks.js';
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import {
  loadHiringCompany,
  type Opportunity,
} from "../services/candidateWorkspace.js";
import { splitJobDescription } from "../services/jobDescription.js";
import "./jobDetails.css";

export function HiringCompanyDetails({ id }: { id: string }) {
  const [data, setData] = useState<{
      jobs: Opportunity[];
      total: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setData(null);
    void loadHiringCompany(id)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  if (loading)
    return <LoadingSkeleton label="Loading company details" rows={7} />;
  if (error)
    return (
      <section className="sf-empty">
        <p className="cr-error">Company details could not be loaded.</p>
        <button
          className="auth-secondary"
          onClick={() => setRevision((n) => n + 1)}
        >
          Try again
        </button>
      </section>
    );
  const job = data?.jobs[0];
  if (!job)
    return (
      <section className="sf-empty">
        <h1>Company details unavailable.</h1>
        <p>No current source listings are available for this company.</p>
        <a href="/jobs">Explore jobs</a>
      </section>
    );
  const overviews = data!.jobs
    .map((row) => ({
      text: splitJobDescription(row.description, job.company_name).companyText,
      source: row.source_url,
    }))
    .filter((row) => row.text);
  const overview = overviews[0];
  const jobsUrl = "/jobs?" + new URLSearchParams({ query: job.company_name });
  return (
    <article className="sf-role-detail sf-hiring-company-detail">
      <a className="sf-back" href={jobsUrl}>
        <ArrowLeft size={16} /> {job.company_name} jobs
      </a>
      <div className="sf-role-grid">
        <div className="sf-role-main">
          <header className="sf-role-card">
            <div className="sf-role-title">
              <CompanyLogo name={job.company_name} companyId={job.company_id} logoUrl={job.company_logo_url} className="sf-role-logo" />
              <div>
                <h1>{job.company_name}</h1>
                <p>Company details</p>
              </div>
            </div>
          </header>
          <section className="sf-role-card sf-company-overview">
            <h2>About the company</h2>
            <StructuredDescription text={overview?.text ? removeOpeningAboutHeading(overview.text,job.company_name) : "No separate company overview was provided in the available employer listings."} />
            {overview ? (
              <p className="sf-hint">
                Company information supplied in the employer’s published job
                descriptions.
              </p>
            ) : null}
          </section>
        </div>
        <aside className="sf-role-aside">
          <section className="sf-role-card">
            <h2>Current openings</h2>
            <p>
              {data!.total} checked {data!.total === 1 ? "role" : "roles"} in
              India on CareerRadar.
            </p>
            <a className="auth-primary" href={jobsUrl}>
              View open roles <ArrowRight size={16} />
            </a>
          </section>
        </aside>
      </div>
    </article>
  );
}
