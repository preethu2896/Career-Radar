import {SearchFeedback,SearchMatch} from './SearchFeedback.js';
import {jobCardTags} from '../services/jobCardTags.js';
import {CITY_SUGGESTIONS,locationSuggestions,primaryJobLocation} from '../services/directoryPolicy.js';
import {SearchAutocomplete} from './SearchAutocomplete.js';
import {loadCompanySearchNames} from '../services/searchCatalog.js';
import {ROLE_TITLES} from '../services/careerCatalog.js';
import {jobPath} from '../services/jobUrls.js';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  LockKeyhole,
  MapPin,
  Search,
  SlidersHorizontal,
  Bell,
  X,
} from "lucide-react";
import type { Profile } from "../services/auth.js";
import {
  loadApplications,
  saveApplication,
  isRecentOpening,
  type Opportunity,
} from "../services/candidateWorkspace.js";
import {
  filterOpenings,
  type JobFilters,
} from "../services/discovery.js";
import { safeExternalUrl } from "../domain/normalize.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import { CompanyLogo } from './CompanyLogo.js';
import "./jobsBoard.css";

type Props = {
  server?: {total:number;globalTotal:number;postedCounts:Record<string,number>;featured:Array<{id?:string;logoUrl?:string|null;name:string;location:string|null;count:number}>;companies:Array<[string,number]>;locations:string[];loadingMore:boolean;onMore:()=>void}|undefined;
  dashboard?: boolean;
  jobs: Opportunity[];
  visible: Opportunity[];
  filters: JobFilters;
  loading: boolean;
  error: string;
  userId: string | null;
  profile: Profile | null;
  accountLoading: boolean;
  update: (key: keyof JobFilters, value: string) => void;
  reset: () => void;
  retry: () => void;
  navigate: (path: string) => void;
};
const date = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "Date not stated";

export function JobsBoard({
  server,
  dashboard = false,
  jobs,
  visible,
  filters,
  loading,
  error,
  userId,
  profile,
  accountLoading,
  update,
  reset,
  retry,
  navigate,
}: Props) {
  const [companyNames,setCompanyNames]=useState<string[]>([]);
  const loadSuggestions=()=>{if(!companyNames.length)void loadCompanySearchNames().then(setCompanyNames).catch(()=>{});};
  const locationNames=useMemo(()=>locationSuggestions([...CITY_SUGGESTIONS,...(server?.locations??[]),...jobs.map(job=>job.location??'')]),[jobs,server]);
  const searchChoices=useMemo(()=>{const choices=new Map<string,{value:string;kind:string}>();for(const name of [...companyNames,...(server?.companies.map(([name])=>name)??[]),...jobs.map(job=>job.company_name)])choices.set(name,{value:name,kind:'Company'});for(const title of [...jobs.map(job=>job.title),...ROLE_TITLES])if(!choices.has(title))choices.set(title,{value:title,kind:'Role'});for(const location of locationNames)if(!choices.has(location))choices.set(location,{value:location,kind:'Location'});return [...choices.values()];},[companyNames,jobs,locationNames,server?.companies]);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [limit, setLimit] = useState(24),
    [alertsOpen, setAlertsOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]),
    [pending, setPending] = useState(""),
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState(""),
    [trackerLoading, setTrackerLoading] = useState(Boolean(userId));
  const mounted = useRef(true);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const change = () => {
      setMobile(media.matches);
      setFiltersOpen(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const sheet = dialog.current;
    if (!mobile || !filtersOpen) {
      if (sheet?.open) sheet.close();
      return;
    }
    if (sheet && !sheet.open) sheet.showModal();
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      if (sheet?.open) sheet.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [mobile, filtersOpen]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setLimit(24);
  }, [filters]);
  useEffect(() => {
    let active = true;
    setSavedIds([]);
    setTrackerLoading(Boolean(userId));
    setSaveError("");
    if (userId)
      void loadApplications(userId)
        .then((rows) => {
          if (active)
            setSavedIds(
              rows
                .filter((row) => row.entity_key.startsWith("opportunity:"))
                .map((row) => row.entity_key.slice(12)),
            );
        })
        .catch(() => {
          if (active)
            setSaveError("Saved roles could not be loaded. Refresh to retry.");
        })
        .finally(() => {
          if (active) setTrackerLoading(false);
        });
    return () => {
      active = false;
    };
  }, [userId]);
  const save = async (job: Opportunity) => {
    if (!userId) {
      navigate("/login?redirect=" + encodeURIComponent(jobPath(job)));
      return;
    }
    setPending(job.id);
    setSaveError("");
    setNotice("");
    try {
      await saveApplication(userId, {
        entity_key: "opportunity:" + job.id,
        source_kind: "OPPORTUNITY",
        company_name: job.company_name,
        title: job.title,
        source_url:
          safeExternalUrl(job.application_url) ||
          safeExternalUrl(job.source_url),
      });
      if (mounted.current) {
        setSavedIds((current) => [...new Set([...current, job.id])]);
        setNotice("Role saved to your applications.");
      }
    } catch (err) {
      if (mounted.current)
        setSaveError(
          err instanceof Error ? err.message : "Could not save this role.",
        );
    } finally {
      if (mounted.current) setPending("");
    }
  };
  const fresh = useMemo(
    () => jobs.filter((job) => isRecentOpening(job)),
    [jobs],
  );
  const featuredLocal = useMemo(() => {
    const grouped = new Map<
      string,
      { id?: string | null | undefined; logoUrl?: string | null | undefined; name: string; location: string | null; count: number }
    >();
    for (const job of fresh) {
      const key = job.company_id ?? job.company_name.trim().toLowerCase();
      const company = grouped.get(key);
      if (company) company.count++;
      else
        grouped.set(key, {
          id: job.company_id,
          logoUrl: job.company_logo_url,
          name: job.company_name,
          location: primaryJobLocation(job.location),
          count: 1,
        });
    }
    return [...grouped.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [fresh]);
  const featured=server?.featured??featuredLocal;
  const total=server?.total??visible.length;
  const globalTotal=server?.globalTotal??fresh.length;
  const selectedFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "sort" && (key!=="companyId"||!filters.company) && Boolean(value),
  );
  const activeFilters = selectedFilters.length;
  const filterLabel = (key:string,value:string) => {
    const labels:Record<string,string>={query:'Search',company:'Company',companyId:'Company',location:'Location',workMode:'Workplace',experience:'Experience',posted:'Posted'};
    const text=key==='posted'?({'1':'Last 24h','7':'Last 7 days','30':'Last 30 days'}[value]??value):key==='experience'?({'freshers':'Accepts freshers','internship':'Internships'}[value]??value):key==='companyId'?(server?.featured.find(company=>company.id===value)?.name??'Selected company'):value;
    return `${labels[key]??key}: ${text}`;
  };
  const activeFilterControls = activeFilters ? <div className="sf-board-active-filters" aria-label="Active job filters">
    {selectedFilters.map(([key,value])=><button type="button" key={key} aria-label={'Remove '+filterLabel(key,value)} onClick={()=>update(key as keyof JobFilters,'')}><span>{filterLabel(key,value)}</span><X size={13} aria-hidden="true"/></button>)}
    <button type="button" className="sf-clear-filters" onClick={reset}>Clear all</button>
  </div>:null;
  const localCompaniesWithJobs=useMemo(()=>{
    const counts=new Map<string,number>();for(const job of fresh)counts.set(job.company_name,(counts.get(job.company_name)??0)+1);
    return [...counts].sort(([a],[b])=>a.localeCompare(b));
  },[fresh]);
  const companiesWithJobs=server?.companies??localCompaniesWithJobs;
  const companySearchUrl='/companies'+(filters.query.trim()?'?q='+encodeURIComponent(filters.query.trim()):'');
  const submitJobSearch=(value:string)=>{if(value!==filters.query)update('query',value);else if(error)retry();setFiltersOpen(false);requestAnimationFrame(()=>document.querySelector('.sf-jobs-board .sf-board-results')?.scrollIntoView({block:'start',behavior:'auto'}));};
  const countPosted = (days: string) =>
    server?.postedCounts[days]??filterOpenings(jobs, { ...filters, posted: days }).length;
  const filterPanel = (
    <>
      <div className="sf-board-filter-heading">
        <h2 id="board-filters-title">Filters</h2>
        <button className="cr-text-button sf-board-reset" onClick={reset}>
          Reset
        </button>
        {mobile ? (
          <button
            autoFocus
            className="cr-icon-button sf-sheet-close"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          >
            <X size={20} />
          </button>
        ) : null}
      </div>
      <div className="sf-sheet-body">
        <div className="sf-board-search">
          <label htmlFor="board-query">Search jobs</label>
          <div>
            <Search size={16} />
            <SearchAutocomplete maxLength={160} suggestionsMaxWidth={1024} recentKey="careerradar.recent.jobs" id="board-query" label="Search jobs" onSearch={submitJobSearch} searching={loading&&Boolean(filters.query.trim())} value={filters.query} onChange={value=>update('query',value)} choices={searchChoices} placeholder="e.g. Analyst, Python" onFocus={loadSuggestions}/>
          </div>
        </div>
        {activeFilterControls}
        <div
          id="board-filter-fields"
          className={`sf-board-filters ${filtersOpen ? "is-open" : ""}`}
        >
          <section className="sf-board-posted">
            <h3>Posted by employer</h3>
            <div className="sf-date-grid">
              {[
                ["", "Any time"],
                ["1", "Last 24h"],
                ["7", "Last 7 days"],
                ["30", "Last 30 days"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filters.posted === value}
                  onClick={() => update("posted", value!)}
                >
                  <span>{label}</span>
                  <small>
                    {loading||error ? "—" : countPosted(value!).toLocaleString()}
                  </small>
                </button>
              ))}
            </div>
          </section>
          <details>
            <summary data-active={Boolean(filters.company||filters.companyId)}>Company<span>{filters.company||(filters.companyId?'Selected company':'Any')}<ChevronDown size={14}/></span></summary>
            <div className="sf-board-filter-body">
              <label className="cr-field"><SearchAutocomplete maxLength={160} suggestionsMaxWidth={1024} label="Company" value={filters.company} onChange={value=>update('company',value)} choices={companiesWithJobs.map(([name,count])=>({value:name,kind:count+' roles'}))} placeholder={'All hiring companies ('+companiesWithJobs.length+')'}/>
              </label>
              <a className="sf-external" href={companySearchUrl}>Browse the full company directory <ArrowRight size={14}/></a>
            </div>
          </details>
          <details>
            <summary data-active={Boolean(filters.workMode)}>
              Workplace
              <span>
                {filters.workMode || "Any"}
                <ChevronDown size={14} />
              </span>
            </summary>
            <div className="sf-board-filter-body">
              <label className="cr-field"><select
                  aria-label="Workplace"
                  value={filters.workMode}
                  onChange={(event) => update("workMode", event.target.value)}
                >
                  <option value="">Any workplace</option>
                  {["Remote", "Hybrid", "Onsite"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <details>
            <summary data-active={Boolean(filters.location)}>
              Location
              <span>
                {filters.location || "Any"}
                <ChevronDown size={14} />
              </span>
            </summary>
            <div className="sf-board-filter-body">
              <label className="cr-field"><SearchAutocomplete maxLength={160} suggestionsMaxWidth={1024} label="Location" value={filters.location} onChange={value=>update('location',value)} placeholder="City, region or country" choices={locationNames.map(value=>({value,kind:'Location'}))}/>
              </label>
            </div>
          </details>
          <details>
            <summary data-active={Boolean(filters.experience)}>
              Experience
              <span>
                {filters.experience === "freshers" ? "Accepts freshers" : filters.experience === "internship" ? "Internships" : "Any"}
                <ChevronDown size={14} />
              </span>
            </summary>
            <div className="sf-board-filter-body">
              <label className="cr-field"><select
                  aria-label="Experience"
                  value={filters.experience}
                  onChange={(event) => update("experience", event.target.value)}
                >
                  <option value="">All experience levels</option>
                  <option value="freshers">Explicitly accepts freshers</option>
                  <option value="internship">Internships</option>
                </select>
              </label>
            </div>
          </details>
          <p className="sf-board-filter-note">
            Job counts include current sourced openings. The company directory also includes companies without verified live jobs.
          </p>
        </div>
      </div>
      {mobile ? (
        <footer className="sf-sheet-footer">
          <button
            className="auth-primary"
            onClick={() => setFiltersOpen(false)}
            aria-busy={loading}
          >
            {error||loading?'View results':<>Show {loading ? "matching" : total.toLocaleString()}{" "}{!loading&&total === 1 ? "job" : "jobs"}</>}
            <ArrowRight size={16} />
          </button>
        </footer>
      ) : null}
    </>
  );
  return (
    <div className="sf-board sf-jobs-board">
      {mobile ? (
        <dialog
          ref={dialog}
          className="sf-board-filter-dialog"
          aria-labelledby="board-filters-title"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
              ),
            ].filter((element) => element.getClientRects().length > 0);
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            setFiltersOpen(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (
                event.clientY < bounds.top ||
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY > bounds.bottom
              )
                setFiltersOpen(false);
            }
          }}
        >
          {filterPanel}
        </dialog>
      ) : (
        <aside className="sf-board-sidebar" aria-label="Job filters">
          {filterPanel}
        </aside>
      )}
      {mobile ? (
        <button
          className="sf-floating-filters"
          aria-label="Filters"
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-description={activeFilters ? `${activeFilters} active filters` : 'No active filters'}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={17} />
          Filters
          {activeFilters ? (
            <span aria-hidden="true">{activeFilters}</span>
          ) : null}
        </button>
      ) : null}
      <div className="sf-board-content">
        <section className="sf-board-intro">
          <div>
            <p className="sf-board-eyebrow">CareerRadar · Job board</p>
            <h1>
              Find a role. <em>See a way in.</em>
            </h1>
            <p>
              Explore sourced openings and the companies behind them.
              <br />
              One place to search. A clearer next step.
            </p>
          </div>
          <a
            className="auth-primary"
            href={userId ? "/tracker" : "/login?redirect=%2Fjobs"}
          >
            {userId ? "Open tracker" : "Unlock apply links"}
            {userId ? <ArrowRight size={16} /> : <LockKeyhole size={15} />}
          </a>
        </section>
        {featured.length ? (
          <section
            className="sf-board-featured"
            aria-label="Companies with checked openings"
          >
            <h2>
              <span />
              Hiring now
            </h2>
            <div>
              {featured.map((company) => (
                <button
                  key={company.id ?? company.name}
                  onClick={() => update("query", company.name)}
                >
                  <CompanyLogo name={company.name} companyId={company.id} logoUrl={company.logoUrl} />
                  <span>
                    <strong>{company.name}</strong>
                    <small>{company.location || "Location not stated"}</small>
                  </span>
                  <span className="sf-board-role-count">
                    {company.count} {company.count === 1 ? "role" : "roles"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section className="sf-board-results" aria-label="Job results">
          <div className="sf-board-results-heading">
            <h2>Latest roles</h2>
            <div className="sf-board-tools">
              <button
                className="sf-board-alert-button"
                aria-label="Job alerts"
                aria-expanded={alertsOpen}
                aria-controls="board-alert-info"
                onClick={() => setAlertsOpen((value) => !value)}
              >
                <Bell size={14} />
                <span>Job alerts</span>
              </button>
              <label className="sf-sort">
                <span>Sort by</span>
                <select
                  aria-label="Sort by"
                  value={filters.sort}
                  onChange={(event) => update("sort", event.target.value)}
                >
                  <option value="checked">{mobile ? "Last checked" : "Recently checked"}</option>
                  <option value="posted">{mobile ? "Newest" : "Newest posted"}</option>
                  <option value="company">{mobile ? "Company" : "Company name"}</option>
                </select>
              </label>
            </div>
          </div>
          <SearchFeedback query={filters.query} count={total} loading={loading} error={error} filtered={activeFilters>0} kind="jobs"/>
          {alertsOpen ? (
            <div
              id="board-alert-info"
              className="sf-board-alert-info"
              role="status"
            >
              <Bell size={17} />
              <p>
                Email alerts are coming soon. You can save and track roles with
                a free account today. <a href="/pricing">View planned alerts</a>
              </p>
              <button
                className="cr-icon-button"
                aria-label="Close alert information"
                onClick={() => setAlertsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
          {saveError ? (
            <p className="cr-error" role="alert">
              {saveError}
            </p>
          ) : null}
          {notice ? (
            <p className="sf-board-notice" role="status">
              {notice}
            </p>
          ) : null}
          {loading&&jobs.length===0 ? (
            <LoadingSkeleton label="Loading openings" rows={8} />
          ) : error ? (
            <div className="sf-board-empty">
              <p className="cr-error" role="alert">
                {error}
              </p>
              <button className="auth-secondary" onClick={retry}>
                Try again
              </button>
            </div>
          ) : !total ? (
            <div className="sf-board-empty">
              
              <h3>
                {globalTotal
                  ? "No roles match this search."
                  : "Fresh openings are on their way."}
              </h3>
              <p>
                {globalTotal
                  ? "Try a different title, location or fewer filters."
                  : "We’re building a checked selection of opportunities. Explore company career pages or track a role you already found."}
              </p>
              <div className="sf-actions">
                {globalTotal ? (
                  <button className="auth-primary" onClick={reset}>
                    Clear filters
                  </button>
                ) : (
                  <a className="auth-primary" href="/companies">
                    Explore companies
                    <ArrowRight size={15} />
                  </a>
                )}
                <a className="auth-secondary" href="/tracker">
                  Track an application
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="sf-board-cards">
                {(server?visible:visible.slice(0, limit)).map((job) => (
                  <BoardJobCard
                    key={job.id}
                    job={job}
                    query={filters.query}
                    profile={profile}
                    userId={userId}
                    saved={savedIds.includes(job.id)}
                    disabled={
                      accountLoading ||
                      trackerLoading ||
                      Boolean(pending)
                    }
                    saving={pending === job.id}
                    onSave={() => void save(job)}
                  />
                ))}
              </div>
              {(server?total>visible.length:visible.length>limit) ? (
                <button
                  className="auth-secondary sf-load-more"
                  disabled={server?.loadingMore}
                  onClick={() => server?server.onMore():setLimit((value) => value + 24)}
                >
                  {server?.loadingMore?"Loading…":"Show more roles"}
                </button>
              ) : null}
            </>
          )}
          <p className="sf-board-source-note">
            <LockKeyhole size={13} />
            {userId
              ? "Apply at the original source. You control your application progress."
              : "Browse without an account. Sign in for 3 free apply unlocks. Pro unlocks more."}
          </p>
        </section>
      </div>
    </div>
  );
}

export function BoardJobCard({
  job,
  query = "",
  userId,
  saved,
  disabled,
  saving,
  onSave,
}: {
  job: Opportunity;
  query?: string;
  profile: Profile | null;
  userId: string | null;
  saved: boolean;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const detail = jobPath(job);
  const tags = jobCardTags(job);
  const application =
    safeExternalUrl(job.application_url) || safeExternalUrl(job.source_url);
  return (
    <article className="sf-board-job">
      <div className="sf-board-job-heading">
        <CompanyLogo name={job.company_name} companyId={job.company_id} logoUrl={job.company_logo_url} />
        <div>
          <h3>
            <a href={detail}><SearchMatch text={job.title} query={query}/></a>
          </h3>
          <p><SearchMatch text={job.company_name} query={query}/></p>
        </div>
        <button
          className={`sf-board-save ${saved ? "is-saved" : ""}`}
          disabled={disabled || saved}
          aria-label={saved ? `${job.title} saved` : `Save ${job.title}`}
          aria-pressed={saved}
          title={saved ? "Saved to your applications" : "Save role"}
          onClick={onSave}
        >
          {saved ? <Check size={17} /> : <Bookmark size={17} />}
        </button>
      </div>
      {tags.length ? <div className="sf-board-tags" aria-label="Role details">
        {tags.map(tag => <span key={tag.toLowerCase()}><SearchMatch text={tag} query={query}/></span>)}
      </div> : null}
      <div className="sf-board-job-footer">
        <p>
          <MapPin size={13} />
          <span>
            <SearchMatch text={primaryJobLocation(job.location) || "Location not stated"} query={query}/>
            <small> · Checked {date(job.last_checked_at)}</small>
          </span>
        </p>
        <a
          href={detail}
          aria-label={`Apply for ${job.title}`}
        >
          Apply{userId ? <ArrowRight size={14} /> : <LockKeyhole size={13} />}
        </a>
      </div>
      {saving ? (
        <p className="sf-hint" role="status">
          Saving role…
        </p>
      ) : null}
    </article>
  );
}
