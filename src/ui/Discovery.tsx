import{PublicCompanies}from'./PublicCompanies.js';
import {catalogueEnabled,catalogueJobs,catalogueFacets,type PublicJobPage,type PublicFacets} from '../services/publicCatalogueClient.js';
import {loadOpportunityList} from '../services/opportunityList.js';
import {normalizeSearchText} from '../services/directoryPolicy.js';
import {CompaniesBoard} from './CompaniesBoard.js';
import {CompanyProfile} from './CompanyProfile.js';
import {companyProfilePath,parseCompanyProfilePath} from '../services/companyProfileUrls.js';
import {SearchAutocomplete} from './SearchAutocomplete.js';
import {StructuredDescription} from './StructuredDescription.js';
import {jobPath,parseJobPath} from '../services/jobUrls.js';
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  UserRound,
} from "lucide-react";
import { useSiteAccount as useAccount, type SiteAccount as Account } from './SiteHeader.js';
import {
  loadOpportunities,
  loadOpportunity,
  loadOpportunityByPath,
  isRecentOpening,
  explainOpportunity,
  publishedContact,
  loadApplications,
  saveApplication,
  updateApplication,
  type Opportunity,
  type Application,
} from "../services/candidateWorkspace.js";
import type { LocalCompanyRecord } from "../services/localCompanyRepository.js";
import { loadDiscoveryCompanies } from "../services/discoveryCompanies.js";
import {
  EMPTY_JOB_FILTERS,
  filterOpenings,
  type JobFilters,
} from "../services/discovery.js";
import {
  loadSavedCompanies,
  setCompanySaved,
} from "../services/savedCompanies.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import { SavedResumePanel } from "./SavedResumePanel.js";
import { Tracker } from "./CandidateWorkspace.js";
import { CompanyLogo } from './CompanyLogo.js';
import { JobDetails } from './JobDetails.js';
import { HiringCompanyDetails } from './HiringCompanyDetails.js';
import { JobsBoard } from "./JobsBoard.js";

import "./candidateWorkspace.css";
import "./discovery.css";

type Navigate = (path: string) => void;
function safePathId(value: string) { try { return decodeURIComponent(value); } catch { return ''; } }
function Footer() {
  return (
    <footer className="sf-footer">
      <a className="auth-logo" href="/">
        career<span>radar</span>
      </a>
      <p>A clearer route to your next opportunity.</p>
      <nav aria-label="Footer">
        <a href="/about">About</a>
        <a href="/pricing">Pricing</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </footer>
  );
}
function External({
  url,
  children,
  primary = false,
  onClick,
}: {
  url: string | null | undefined;
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  const href = safeExternalUrl(url);
  return href ? (
    <a
      className={primary ? "auth-primary" : "sf-external"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      {children}
      <ExternalLink size={14} />
    </a>
  ) : null;
}
function Stamp({ value }: { value: string | null }) {
  const valid = value && Number.isFinite(Date.parse(value));
  return (
    <>
      {valid
        ? new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Not stated"}
    </>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sf-empty">
      
      <h2>{title}</h2>
      {children}
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="sf-empty">
      <p className="cr-error" role="alert">
        {message}
      </p>
      <button className="auth-secondary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

export function DiscoveryRoute({
  path,
  navigate,
}: {
  path: string;
  navigate: Navigate;
}) {
  const account = useAccount();
  return (
    <div className={"cr-workspace sf-discovery" + (["/jobs", "/explore", "/companies", "/dashboard", "/radar"].includes(path) ? " sf-board-page" : "") + (path.startsWith("/jobs/") ? " sf-role-page" : "")}>
      <a className="sf-skip" href="#discovery-main">
        Skip to content
      </a>

      <main id="discovery-main" className="sf-main">
        {path === "/refer" ? (
          <section className="sf-empty">
            <p className="sf-section-label">Coming soon</p>
            <h1>Referrals, on CareerRadar.</h1>
            <p>We’re working on this. Explore jobs and companies while you wait.</p>
            <a className="auth-primary" href="/jobs">Explore jobs <ArrowRight size={16}/></a>
          </section>
        ) : path === "/pricing" ? (
          <Pricing />
        ) : path === "/account" ? (
          <AccountPage key={account.userId ?? 'public'} account={account} />
        ) : path === "/tracker" ? (
          <ApplicationsPage key={account.userId ?? 'public'} account={account} />
        ) : (parseCompanyProfilePath(path)||path.startsWith('/companies/')) ? (
          <CompanyProfile key={path} path={path}/>
        ) : path.startsWith("/companies") ? (
          catalogueEnabled?<PublicCompanies key={account.userId??'public'} userId={account.userId}/>:<Companies key={account.userId ?? 'public'} path={path} account={account} />
        ) : (
          <Jobs key={account.userId ?? 'public'} path={path} account={account} navigate={navigate} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function Jobs({
  path,
  account,
  navigate,
}: {
  path: string;
  account: Account;
  navigate: Navigate;
}) {
  const [jobs, setJobs] = useState<Opportunity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [remote,setRemote]=useState<PublicJobPage|null>(null),[facets,setFacets]=useState<PublicFacets|null>(null),[offset,setOffset]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  useEffect(()=>{if(catalogueEnabled)void catalogueFacets().then(setFacets).catch(()=>{});},[]);
  const [filters, setFilters] = useState<JobFilters>(() => ({
    ...EMPTY_JOB_FILTERS,
    ...Object.fromEntries(
      [...new URLSearchParams(window.location.search)].filter(
        ([key]) => key in EMPTY_JOB_FILTERS,
      ),
    ),
  }));

  useEffect(() => {
    let active = true;const controller=new AbortController();
    if(!catalogueEnabled||offset===0)setLoading(true);
    else setLoadingMore(true);
    setError("");
    const requestTimer=setTimeout(()=>{void (
      path.startsWith('/jobs/') ? loadOpportunityByPath(path).then(row=>row?[row]:[]) : catalogueEnabled ? catalogueJobs(filters,offset,controller.signal).then(page=>{if(active)setRemote(page);return page.rows;}) : loadOpportunityList({force:revision>0})
    )
      .then((rows) => {
        if (active) setJobs(current=>catalogueEnabled&&offset>0?[...current,...rows.filter(row=>!current.some(old=>old.id===row.id))]:rows);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) {setLoading(false);setLoadingMore(false);}
      });},catalogueEnabled&&!path.startsWith('/jobs/')?150:0);
    return () => {
      active = false;controller.abort();clearTimeout(requestTimer);
    };
  }, [revision, path, ...(catalogueEnabled?[filters,offset]:[])]);
  useEffect(()=>{const route=parseJobPath(path);const selected=jobs[0];if(path.startsWith('/jobs/')&&route&&'id' in route&&selected?.company_slug&&selected.role_slug){const canonical=jobPath(selected);if(window.location.pathname!==canonical){window.history.replaceState({},'',canonical+window.location.search);window.dispatchEvent(new PopStateEvent('popstate'));}}},[path,jobs]);
  useEffect(()=>{const restore=()=>{setOffset(0);setFilters({...EMPTY_JOB_FILTERS,...Object.fromEntries([...new URLSearchParams(location.search)].filter(([key])=>key in EMPTY_JOB_FILTERS))});};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
  const visible = useMemo(() => catalogueEnabled?jobs:filterOpenings(jobs, filters), [jobs, filters]);
  const update = (key: keyof JobFilters, value: string) => {
    const next = { ...filters, [key]: value, ...(key==='company'?{companyId:''}:{}) };
    setOffset(0);
    setFilters(next);

    const query = new URLSearchParams(
      Object.entries(next).filter(
        ([key, value]) =>
          value && value !== EMPTY_JOB_FILTERS[key as keyof JobFilters],
      ),
    );
    window.history.replaceState({}, "", path + (query.size ? "?" + query : ""));
  };
  const reset = () => {
    setOffset(0);
    setFilters({ ...EMPTY_JOB_FILTERS });

    window.history.replaceState({}, "", path);
  };
  if (path.startsWith("/jobs/")) {
    const selectedJob = jobs[0] ?? null;
    return (
      <>
        {loading ? (
          <LoadingSkeleton label="Loading role" rows={7} />
        ) : error ? (
          <ErrorState
            message={error}
            retry={() => setRevision((value) => value + 1)}
          />
        ) : selectedJob ? (
          <JobDetails
            key={selectedJob.id}
            job={selectedJob}
            account={account}
            navigate={navigate}
          />
        ) : (
          <Empty title="This role is unavailable.">
            <p>It may have been removed or is no longer published.</p>
            <a className="auth-primary" href="/jobs">
              Explore current openings
            </a>
          </Empty>
        )}
      </>
    );
  }
  return <JobsBoard dashboard={path==='/dashboard'||path==='/radar'} server={catalogueEnabled&&remote?{total:remote.total,globalTotal:facets?.total??remote.total,postedCounts:remote.postedCounts,featured:facets?.featured??[],companies:facets?.companies??[],locations:facets?.locations??[],loadingMore,onMore:()=>setOffset(jobs.length)}:undefined} jobs={jobs} visible={visible} filters={filters} loading={loading} error={error} userId={account.userId} profile={account.snapshot?.profile ?? null} accountLoading={account.loading} update={update} reset={reset} retry={() => setRevision(value => value + 1)} navigate={navigate}/>;
}
function Companies({ path, account }: { path: string; account: Account }) {
  const [addedOnly,setAddedOnly]=useState(new URLSearchParams(window.location.search).get('added')==='1');
  const [rows, setRows] = useState<LocalCompanyRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(
      new URLSearchParams(window.location.search).get("q") ?? "",
    ),
    [city, setCity] = useState(new URLSearchParams(window.location.search).get("city")??""),
    [industry, setIndustry] = useState(""),
    [limit, setLimit] = useState(24),
    [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]),
    [saveError, setSaveError] = useState(""),
    [pending, setPending] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadDiscoveryCompanies()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setError("Company research could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, path]);
  useEffect(() => {
    let active = true;
    setSaved([]);
    setSaveError("");
    if (account.userId)
      void loadSavedCompanies(account.userId)
        .then((ids) => {
          if (active) setSaved(ids);
        })
        .catch((err) => {
          if (active) setSaveError(err.message);
        });
    return () => {
      active = false;
    };
  }, [account.userId, revision]);
  const toggleSaved = async (id: string) => {
    if (!account.userId) return;
    setPending(id);
    setSaveError("");
    try {
      const next = !saved.includes(id);
      await setCompanySaved(account.userId, id, next);
      setSaved((current) =>
        next ? [...current, id] : current.filter((value) => value !== id),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Please retry.");
    } finally {
      setPending("");
    }
  };
  const filtered = useMemo(
    () =>
      rows
        .filter((row) =>
          normalizeSearchText(`${row.name} ${row.industry ?? ""} ${row.headquarters ?? ""} ${row.cityAssociations.flatMap(item=>[item.city,item.datasetCity]).filter(Boolean).join(" ")}`).includes(normalizeSearchText(query)),
        )
        .filter(
          (row) =>
            !city ||
            row.cityAssociations.some((item) =>
              normalizeSearchText(item.datasetCity || item.city || "").includes(normalizeSearchText(city)),
            ),
        )
        .filter((row) => !industry || row.industry === industry)
        .filter((row) => !savedOnly || saved.includes(row.id))
        .filter((row) => !addedOnly || Boolean(row.addedAt))
        .sort((a,b)=>(b.addedAt??" ").localeCompare(a.addedAt??" ") || a.name.localeCompare(b.name)),
    [rows, query, city, industry, savedOnly, saved, addedOnly],
  );
  const industries = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.industry)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [rows],
  );
  let id = "";
  if (path.startsWith("/companies/"))
    try {
      id = decodeURIComponent(path.slice(11));
    } catch {
      /* Show missing company. */
    }
  if (id) {
    const company = rows.find((row) => row.id === id);
    return (
      <>
        <a className="sf-back" href="/companies">
          <ArrowLeft size={16} />
          All companies
        </a>
        {loading ? (
          <LoadingSkeleton label="Loading company" rows={7} />
        ) : error ? (
          <ErrorState
            message={error}
            retry={() => setRevision((value) => value + 1)}
          />
        ) : company ? (
          <CompanyDetails
            company={company}
            account={account}
            saved={saved.includes(id)}
            pending={pending === id}
            error={saveError}
            onSave={() => void toggleSaved(id)}
          />
        ) : (
          <Empty title="Company not found.">
            <p>This research record may no longer be available.</p>
            <a href="/companies">Explore companies</a>
          </Empty>
        )}
      </>
    );
  }
  return <CompaniesBoard rows={rows} visible={filtered} query={query} city={city} industry={industry} industries={industries} addedOnly={addedOnly} savedOnly={savedOnly} userId={account.userId} loading={loading} error={error||saveError} limit={limit} setQuery={value=>{setQuery(value);setLimit(24);}} setCity={value=>{setCity(value);setLimit(24);}} setIndustry={value=>{setIndustry(value);setLimit(24);}} setAddedOnly={value=>{setAddedOnly(value);setLimit(24);}} setSavedOnly={value=>{setSavedOnly(value);setLimit(24);}} more={()=>setLimit(value=>value+24)} retry={()=>setRevision(value=>value+1)}/>;
}
function CompanyDetails({
  company,
  account,
  saved,
  pending,
  error,
  onSave,
}: {
  company: LocalCompanyRecord;
  account: Account;
  saved: boolean;
  pending: boolean;
  error: string;
  onSave: () => void;
}) {
  return (
    <article className="sf-detail">
      <header className="sf-detail-heading">
        <p>Company research</p>
        <h1>{company.name}</h1>
        <p>
          {company.industry || "Industry not established"}
          {company.headquarters ? " · " + company.headquarters : ""}
        </p>
      </header>
      <div className="sf-detail-layout">
        <div>
          {company.description ? <section className="sf-detail-section sf-supplied-company"><h2>About the company</h2><StructuredDescription text={company.description}/><p className="sf-hint">From the supplied company list; not independently verified.</p></section> : null}
          <section className="sf-detail-section">
            <h2>Explore the company</h2>
            <div className="sf-actions">
              <External url={company.website}>Company website</External>
              {company.careerUrls.slice(0, 3).map((url) => (
                <External key={url} url={url}>
                  Career page
                </External>
              ))}
            </div>
            {!company.website && !company.careerUrls.length ? (
              <p>No confirmed website or careers URL is available.</p>
            ) : null}
            <dl className="sf-facts">
              <div>
                <dt>Associated locations</dt>
                <dd>
                  {[
                    ...new Set(
                      company.cityAssociations
                        .map((item) => item.datasetCity || item.city)
                        .filter(Boolean),
                    ),
                  ].join(", ") || "Not established"}
                </dd>
              </div>
              <div>
                <dt>Record status</dt>
                <dd>Historical research; current hiring needs checking.</dd>
              </div>
            </dl>
            {company.identityReviewStatuses.some(
              (status) => status !== "NO_REVIEW_NEEDED",
            ) ? (
              <p className="cr-caution">
                This record needs an identity review. Verify the company against
                its official website.
              </p>
            ) : null}
          </section>
          <section className="sf-detail-section">
            <h2>Current openings</h2>
            <p>
              Historical role counts are not presented as live vacancies. Search
              our checked feed, or visit the company’s career page.
            </p>
            <a
              className="auth-secondary"
              href={"/jobs?query=" + encodeURIComponent(company.name)}
            >
              Search checked openings
              <ArrowRight size={15} />
            </a>
          </section>
          <section className="sf-detail-section">
            <h2>People & hiring contacts</h2>
            <p>No researched contacts are available for this company yet.</p>
            <p className="sf-hint">
              Contact access is planned for Pro. There is nothing to unlock or
              pay for on this record.
            </p>
          </section>
        </div>
        <aside>
          <section className="sf-action-panel">
            <h2>Keep it on your radar</h2>
            <p>Save the company to revisit its career page.</p>
            {account.userId ? (
              <button
                className="auth-secondary"
                disabled={pending}
                onClick={onSave}
              >
                {saved ? <Check size={16} /> : <Bookmark size={16} />}
                {pending
                  ? "Saving…"
                  : saved
                    ? "Saved · Remove"
                    : "Save company"}
              </button>
            ) : (
              <a
                className="auth-secondary"
                href={
                  "/login?redirect=" +
                  encodeURIComponent("/companies/" + company.id)
                }
              >
                Sign in to save
              </a>
            )}
            {error ? (
              <p className="cr-error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="sf-hint">
              Saving does not subscribe you to alerts. Company monitoring is not
              live yet.
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}

function ApplicationsPage({ account }: { account: Account }) {
  const [rows, setRows] = useState<Application[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setRows([]);
    setError("");
    setLoading(true);
    if (account.userId)
      void loadApplications(account.userId)
        .then((data) => {
          if (active) setRows(data);
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [account.userId, revision]);
  if (account.loading)
    return <LoadingSkeleton label="Loading applications" rows={6} />;
  if (account.error) return <ErrorState message={account.error} retry={account.retry}/>;
  if (!account.userId)
    return (
      <SignInPrompt
        title="Keep your applications together."
        next="/tracker"
        error={account.error}
      />
    );
  return (
    <>
      <section className="sf-compact-intro">
        <p className="sf-section-label">Keep the thread</p>
        <h1>Saved & applications.</h1>
        <p>Your progress, recorded by you. Add roles from anywhere.</p>
      </section>
      {loading ? (
        <LoadingSkeleton label="Loading your tracker" rows={6} />
      ) : (
        <Tracker
          key={account.userId}
          userId={account.userId}
          rows={rows}
          setRows={setRows}
          error={error}
          retry={() => setRevision((value) => value + 1)}
        />
      )}
      <p className="sf-hint sf-results-note">
        Company shortlist?{" "}
        <a href="/companies">Open Companies and choose Saved companies.</a>
      </p>
    </>
  );
}
function SignInPrompt({
  title,
  next,
  error,
}: {
  title: string;
  next: string;
  error: string;
}) {
  return (
    <Empty title={title}>
      <p>
        {error ||
          "Create a free account to save your progress. Browsing and applying stay free."}
      </p>
      <div className="sf-actions">
        <a
          className="auth-primary"
          href={"/login?redirect=" + encodeURIComponent(next)}
        >
          Sign in
        </a>
        <a
          className="auth-secondary"
          href={"/signup?redirect=" + encodeURIComponent(next)}
        >
          Create account
        </a>
      </div>
    </Empty>
  );
}
function AccountPage({ account }: { account: Account }) {
  if (account.loading)
    return <LoadingSkeleton label="Loading account" rows={5} />;
  if (account.error) return <ErrorState message={account.error} retry={account.retry}/>;
  if (!account.userId)
    return (
      <SignInPrompt
        title="Your CareerRadar account."
        next="/account"
        error={account.error}
      />
    );
  return (
    <>
      <section className="sf-compact-intro">
        <h1>Your account.</h1>
        <p>Your profile, private résumé and membership in one place.</p>
      </section>
      <div className="sf-account-grid">
        <section className="sf-detail-section">
          <h2>Profile</h2>
          <p>{account.snapshot?.session?.user.email}</p>
          <p>
            {account.snapshot?.profile?.onboarding_complete
              ? "Profile setup complete."
              : "Finish your profile to personalize My Radar."}
          </p>
          <a className="auth-secondary" href="/profile">
            Edit your profile
            <ArrowRight size={15} />
          </a>
        </section>
        <section className="sf-detail-section">
          <h2>Membership</h2>
          <p>
            <strong>Free</strong> · No active paid subscription.
          </p>
          <p>Pro is planned. Payments and paid alerts are not enabled.</p>
          <a href="/pricing">
            See planned features
            <ArrowRight size={15} />
          </a>
        </section>
        <SavedResumePanel key={account.userId} userId={account.userId} />
        <section className="sf-detail-section">
          <h2>Notifications</h2>
          <p>
            Email alerts and company monitoring are not live yet. No
            notification subscription has been created.
          </p>
        </section>
      </div>
    </>
  );
}
function Pricing() {
  const features = [
    ["Search jobs and companies", "Included", "Included"],
    ["Job descriptions", "Included", "Included"],
    ["Job-apply links", "3 free unlocks", "Included"],
    ["Company careers links", "Locked", "Included"],
    ["Profile context, saves and tracker", "Included", "Included"],
    ["Private résumé storage", "Included", "Included"],
    [
      "Researched company-contact access",
      "Coming soon",
      "Coming soon",
    ],
    ["Saved-search email alerts", "—", "5 active searches*"],
    ["Watched-company alerts", "—", "20 companies*"],
  ];
  return (
    <>
      <section className="sf-compact-intro sf-pricing-intro">
        <p className="sf-section-label">Start with a clearer search</p>
        <h1>Free to find your next move.</h1>
        <p>Browse jobs, apply at the source and keep track of your progress.</p>
      </section>
      <div className="sf-pricing-grid">
        <section>
          <h2>Free</h2>
          <p className="sf-price">₹0</p>
          <p>For exploring and organizing your job search.</p>
          <ul>
            <li>Public job and company discovery</li>
            <li>3 free job-apply unlocks</li>
            <li>Personal profile and application tracking</li>
            <li>Private résumé storage</li>
          </ul>
          <a className="auth-primary" href="/signup">
            Create a free account
            <ArrowRight size={16} />
          </a>
        </section>
        <section>
          <span className="sf-planned">
            Planned · Not available to purchase
          </span>
          <h2>Pro</h2>
          <p className="sf-price">
            ₹199 <small>/ 30 days</small>
          </p>
          <p>Proposed launch price. No automatic renewal planned.</p>
          <ul>
            <li>More apply links and company careers access</li>
            <li>Saved-search email alerts</li>
            <li>Watched-company opening alerts</li>
          </ul>
          <p className="sf-hint">
            We’ll enable purchase when contact coverage, monitoring and billing
            are ready. No payment is collected now.
          </p>
        </section>
      </div>
      <section className="sf-comparison">
        <h2>What’s included</h2>
        <div
          className="sf-comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Plan comparison"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col">Pro (planned)</th>
              </tr>
            </thead>
            <tbody>
              {features.map(([name, free, pro]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{free}</td>
                  <td>{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sf-hint">
          * Contact allowances and alerts are planned, not currently available.
          Unavailable contacts won’t consume an unlock. Published hiring emails
          already attached to free job listings remain visible.
        </p>
      </section>
    </>
  );
}
