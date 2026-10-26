import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  ExternalLink,
  Filter,
  Flame,
  Globe2,
  LayoutGrid,
  LineChart,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  X,
  Zap,
} from "lucide-react";
import {
  companies,
  signalRows,
  type Company,
  type SignalRow,
  type SignalStatus,
} from "./mockData.js";
import { CareerWalkthrough, TrustAndAudienceSections } from "./HowItWorks.js";
import { AuthCallbackRoute, AuthRoute, DashboardRoute, ForgotPasswordRoute, ResetPasswordRoute } from "./AuthFlows.js";
import { OnboardingRoute } from "./CandidateOnboarding.js";
import { loadProductCompanies } from "./productData.js";
import { safeExternalUrl } from "../domain/normalize.js";
import handUrl from "../../hand.webp";

type Screen = "home" | "discover" | "signals" | "watchlist";

const faqItems = [
  {
    question: "What exactly is Career Radar?",
    answer: "Career Radar helps you discover companies you might otherwise overlook, explore relevant career opportunities, and understand the evidence behind each recommendation. The goal is to help you make more informed career decisions—not simply show you another endless list of jobs.",
  },
  {
    question: "How is Career Radar different from a traditional job board?",
    answer: "Traditional job boards focus primarily on listing vacancies. Career Radar takes a company-first approach, helping you explore employers, understand their career pages and available role information, and build a shortlist aligned with your interests.",
  },
  {
    question: "How do you know whether a company is relevant to me?",
    answer: "Career Radar can use your career interests, preferred roles, skills, location preferences, and available company or role information to help you explore relevant opportunities. Recommendations should explain the available evidence, and missing or unverified information should be clearly identified rather than guessed.",
  },
  {
    question: "Are the companies and career opportunities verified?",
    answer: "We prioritize official company websites and official career pages, along with recognized applicant-tracking systems where available. Some information may be incomplete or inaccessible. Career Radar should distinguish verified information from partial verification and unknown details, and link you to the original source whenever possible.",
  },
  {
    question: "Does Career Radar apply for jobs on my behalf?",
    answer: "Career Radar is designed to help you discover companies, understand career signals, and organize opportunities worth exploring. It is not intended to submit applications automatically in the initial experience. You remain in control of whether and when you apply.",
  },
  {
    question: "Is Career Radar useful for both freshers and experienced professionals?",
    answer: "Yes. Career Radar is intended for both freshers and experienced professionals. The discovery experience can adapt to your career stage, interests, skills, preferred locations, and the kinds of opportunities you want to explore.",
  },
];

function CareerFaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="signals" className="career-faq-section">
      <div className="career-faq-intro">
        <h2>Questions worth asking.</h2>
        <p>
          Career decisions deserve more than guesswork. Here’s how Career Radar
          helps you discover companies, understand the evidence, and stay in
          control of your next move.
        </p>
      </div>
      <div className="career-faq-list">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          const answerId = `career-faq-answer-${index}`;
          const questionId = `career-faq-question-${index}`;
          return (
            <article className={`career-faq-item ${isOpen ? "is-open" : ""}`} key={item.question}>
              <h3>
                <button
                  id={questionId}
                  className="career-faq-question"
                  type="button"
                  aria-controls={answerId}
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <span>{item.question}</span>
                  <span className="career-faq-icon" aria-hidden="true">
                    {isOpen ? <X size={17} /> : <Plus size={17} />}
                  </span>
                </button>
              </h3>
              <div
                id={answerId}
                className="career-faq-answer-wrap"
                role="region"
                aria-labelledby={questionId}
                aria-hidden={!isOpen}
              >
                <div className="career-faq-answer">
                  <p>{item.answer}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="career-faq-contact">
        Still curious about Career Radar? <a href="#how-it-works">Explore how it works.</a>
      </p>
    </section>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-dot" />
      career<span>radar</span>
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "mint" | "amber" | "blue";
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function SignalStatusPill({ status }: { status: SignalStatus }) {
  const labels: Record<SignalStatus, string> = {
    OBSERVED: "Observed",
    CONFIRMED_NEW: "Confirmed new",
    PERSISTENT: "Persistent",
    UNKNOWN: "Unknown",
  };
  const tone =
    status === "OBSERVED" ? "blue" : status === "UNKNOWN" ? "amber" : "mint";
  return <Pill tone={tone}>{labels[status]}</Pill>;
}

function Landing({ onEnter, onLogin, onSignUp }: { onEnter: () => void; onLogin: () => void; onSignUp: () => void }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  return (
    <div id="top" className="landing">
      <nav className="landing-nav">
        <a className="brand-home" href="/#top" aria-label="Back to the top">
          <Logo />
        </a>
        <div className="landing-links">
          <a href="/#signals">Career signals</a>
          <a href="/#trust">Our approach</a>
        </div>
        <div className="landing-actions">
          <button className="text-button" onClick={onLogin}>
            Sign in
          </button>
          <button className="nav-cta" onClick={onEnter}>
            Try the preview <ArrowRight size={15} />
          </button>
        </div>
        <button
          className="mobile-menu"
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {mobileNavOpen && (
          <div className="mobile-nav-panel">
            <a href="/#signals" onClick={() => setMobileNavOpen(false)}>
              Career signals
            </a>
            <a href="/#trust" onClick={() => setMobileNavOpen(false)}>
              Our approach
            </a>
            <a href="/#how-it-works" onClick={() => setMobileNavOpen(false)}>
              How it works
            </a>
            <button
              className="mobile-nav-link"
              onClick={() => {
                setMobileNavOpen(false);
                onLogin();
              }}
            >
              Sign in
            </button>
            <button
              className="mobile-nav-cta"
              onClick={() => {
                setMobileNavOpen(false);
                onEnter();
              }}
            >
              Try the preview <ArrowRight size={15} />
            </button>
          </div>
        )}
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="kicker">
              <span className="kicker-line" />
              BUILT FOR THE NEXT MOVE
            </div>
            <h1>
              Find the signal
              <br />
              behind the <em>job.</em>
            </h1>
            <p className="hero-sub">
              Career Radar helps you discover the companies you would not find
              by searching harder—then shows you exactly why they are worth your
              attention.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={onSignUp}>
                Explore your market <ArrowRight size={17} />
              </button>
              <span className="hero-note">
                <ShieldCheck size={15} /> No application required
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of a career signal map"
          >
            <div className="hero-sun" />
            <div className="hero-ring ring-a" />
            <div className="hero-ring ring-b" />
            <div className="hero-card card-top">
              <span className="mini-spark">
                <Zap size={13} />
              </span>
              <div>
                <b>New signal</b>
                <small>Sarvam AI · 2 hrs ago</small>
              </div>
              <span className="signal-dot" />
            </div>
            <div className="hero-card card-main">
              <div className="card-main-top">
                <span
                  className="company-mark"
                  style={{ background: "#4aa79b" }}
                >
                  S
                </span>
                <div>
                  <b>Sarvam AI</b>
                  <small>Language intelligence · Bengaluru</small>
                </div>
                <span className="fit-score">81%</span>
              </div>
              <div className="fit-bar">
                <span style={{ width: "81%" }} />
              </div>
              <div className="fit-reasons">
                <span>
                  <Check size={12} /> NLP
                </span>
                <span>
                  <Check size={12} /> Research
                </span>
                <span>
                  <Check size={12} /> City match
                </span>
              </div>
              <div className="card-source">
                <Globe2 size={12} /> Source checked today{" "}
                <ArrowRight size={12} />
              </div>
            </div>
            <div className="hero-card card-bottom">
              <div className="pulse-icon">
                <LineChart size={14} />
              </div>
              <div>
                <b>Career page changed</b>
                <small>Observed signal · 3 roles listed</small>
              </div>
              <span>↗</span>
            </div>
            <div className="hero-stamp">
              <span>evidence</span>
              <b>first</b>
            </div>
            <div className="hero-demo-label"><span className="live-dot" /> Illustrative product preview</div>
          </div>
        </section>
        <section className="proof-strip">
          <p>DISCOVERY WITH RECEIPTS</p>
          <span />
          <p>FOR INDIAN JOB SEEKERS</p>
          <span />
          <p>ALWAYS YOUR CALL</p>
        </section>
        <CareerWalkthrough />
        <TrustAndAudienceSections onEnter={onEnter} />
        <CareerFaqSection />
        <section className="career-final-cta" style={{ backgroundImage: `url(${handUrl})` }}>
          <div className="career-final-cta-inner">
            <span className="kicker">
              <span className="kicker-line" /> YOUR NEXT MOVE
            </span>
            <h2>
              Find the companies worth your <em>next move.</em>
            </h2>
            <p>Start exploring the companies that deserve a closer look.</p>
            <button className="primary-button" onClick={onSignUp}>
              Explore your market <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
            <span className="landing-footer-kicker">CAREER INTELLIGENCE FOR THE CURIOUS</span>
            <h2>
              Find your <em>next move.</em>
            </h2>
            <p>
              Discover companies beyond the obvious, understand the signals behind their opportunities, and build a shortlist that reflects where you want your career to go.
            </p>
          </div>
          <nav className="landing-footer-column" aria-label="Product links">
            <h3>PRODUCT</h3>
            <a href="#how-it-works">How it works</a>
            <button type="button" onClick={onEnter}>Explore companies</button>
            <a href="#signals">Career signals</a>
            <button type="button" onClick={onEnter}>Watchlist</button>
          </nav>
          <nav className="landing-footer-column" aria-label="Explore links">
            <h3>EXPLORE</h3>
            <button type="button" onClick={onEnter}>Discover companies</button>
            <button type="button" onClick={onEnter}>Browse opportunities</button>
            <a href="#trust">Explore by city</a>
            <a href="#trust">Explore by industry</a>
          </nav>
          <nav className="landing-footer-column" aria-label="Company links">
            <h3>COMPANY</h3>
            <a href="#trust">About Career Radar</a>
            <a href="#signals">Questions worth asking</a>
          </nav>
          <nav className="landing-footer-column" aria-label="Connect links">
            <h3>CONNECT</h3>
            <button type="button" onClick={onEnter}>Try the preview</button>
            <a href="#top">Back to top</a>
          </nav>
        </div>
        <div className="landing-footer-meta">
          <a href="/#top" className="brand-home" aria-label="Career Radar home">
            <Logo />
          </a>
          <span>Career intelligence for the curious.</span>
          <span>© 2026 Career Radar · Mock data preview</span>
        </div>
        <div className="landing-footer-wordmark" aria-hidden="true">careerradar</div>
      </footer>
    </div>
  );
}

function CompanyCard({
  company,
  saved,
  onToggle,
  onOpen,
}: {
  company: Company;
  saved: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="company-card">
      <div className="company-card-head">
        <div className="company-identity">
          <span className="company-mark" style={{ background: company.accent }}>
            {company.mark}
          </span>
          <div>
            <span className="card-kicker">{company.demoData === false ? "COMPANY RECORD" : "RECOMMENDED COMPANY · DEMO"}</span>
            <h3>{company.name}</h3>
            <span>{company.category}</span>
          </div>
        </div>
        <button
          className={`icon-button ${saved ? "saved" : ""}`}
          aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
          onClick={onToggle}
        >
          {saved ? (
            <Bookmark size={17} fill="currentColor" />
          ) : (
            <Bookmark size={17} />
          )}
        </button>
      </div>
      <div className="company-card-meta">
        <span>
          <MapPin size={14} /> {company.city}
        </span>
        <span className="opening-scope">{company.openingSummary ?? `${company.roles ?? 0} role records`}</span>
        <span
          className={`status status-${company.status.toLowerCase().replaceAll(" ", "-")}`}
        >
          <span /> {company.status}
        </span>
      </div>
      <div className="match-row">
        <div>
          <strong>{company.match === null ? "—" : `${company.match}%`}</strong>
          <span>{company.match === null ? "No live match score" : "illustrative fit"}</span>
        </div>
        <div className="match-bar">
          <span style={{ width: `${company.match ?? 0}%` }} />
        </div>
      </div>
      <p className="company-reason">
        <Sparkles size={14} />{" "}
        <span>
          <b>Why it surfaced</b>
          {company.reason}
        </span>
      </p>
      <div className="skill-list">
        {company.skills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
      <div className="company-card-foot">
        <span className={`signal-label ${company.signalTone}`}>
          <span />
          {company.signal}
        </span>
        <button className="link-button" onClick={onOpen}>
          Inspect evidence <ArrowRight size={14} />
        </button>
      </div>
    </article>
  );
}

function AppShell({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("discover");
  const [saved, setSaved] = useState<string[]>(["atomicwork"]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productCompanies, setProductCompanies] = useState<Company[]>(companies);
  const [dataSource, setDataSource] = useState<"demo" | "local" | "live">("demo");
  const [dataError, setDataError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rolesOnly, setRolesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    if (screen === "signals") {
      document.title = "Signal Map | Career Radar";
    } else if (screen === "watchlist") {
      document.title = "Watchlist | Career Radar";
    } else {
      document.title = "Discover Companies | Career Radar";
    }
  }, [screen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    let active = true;
    loadProductCompanies().then((result) => {
      if (!active) return;
      if ((result.source === "local" || result.source === "live") && result.companies.length) { setProductCompanies(result.companies); setDataSource(result.source); }
      setDataError(result.error);
    });
    return () => { active = false; };
  }, []);
  const filtered = useMemo(
    () =>
      productCompanies.filter((company) =>
        `${company.name} ${company.category} ${company.city} ${company.skills.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ).filter((company) => !cityFilter || company.city.toLowerCase().includes(cityFilter.toLowerCase()))
        .filter((company) => !statusFilter || company.status === statusFilter)
        .filter((company) => !rolesOnly || (company.roles ?? 0) > 0),
    [cityFilter, productCompanies, query, rolesOnly, statusFilter],
  );
  useEffect(() => { setVisibleCount(24); }, [cityFilter, query, rolesOnly, statusFilter]);
  const toggle = (id: string) =>
    setSaved((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <button
            type="button"
            className="brand-button"
            onClick={onExit}
            aria-label="Return to Career Radar landing page"
          >
            <Logo />
          </button>
          <span className="mock-badge">DEMO DATA · NOT LIVE</span>
        </div>
        <div className="profile-mini">
          <div className="avatar">RK</div>
          <div>
            <b>Riya Kapoor</b>
            <span>Early career · Bengaluru</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="app-nav">
          <span className="nav-label">WORKSPACE</span>
          <button
            className={
              screen === "discover" ? "app-nav-item current" : "app-nav-item"
            }
            onClick={() => setScreen("discover")}
          >
            <LayoutGrid size={18} />
            Discover
          </button>
          <button
            className={
              screen === "signals" ? "app-nav-item current" : "app-nav-item"
            }
            onClick={() => setScreen("signals")}
          >
            <LineChart size={18} />
            Signals <span className="nav-count">3</span>
          </button>
          <button
            className={
              screen === "watchlist" ? "app-nav-item current" : "app-nav-item"
            }
            onClick={() => setScreen("watchlist")}
          >
            <Bookmark size={18} />
            Watchlist <span className="nav-count">{saved.length}</span>
          </button>
          <span className="nav-label nav-label-space">YOUR PROFILE</span>
          <button
            type="button"
            className="app-nav-item"
            onClick={() => setShowOnboarding(true)}
          >
            <Target size={18} />
            Career profile
          </button>
          <button
            type="button"
            className="app-nav-item"
            onClick={() => setShowOnboarding(true)}
          >
            <CircleHelp size={18} />
            How it works
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              <b>Source-first by default.</b>
              <small>Example workspace; no live data.</small>
            </span>
          </div>
          <button className="sidebar-exit" onClick={onExit}>
            Exit preview <ArrowRight size={14} />
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-header">
          <div className="mobile-app-brand">
            <button
              type="button"
              className="brand-button"
              onClick={onExit}
              aria-label="Return to Career Radar landing page"
            >
              <Logo />
            </button>
          </div>
          <div className="header-context">
            <span>DISCOVERY / INDIA · DEMO WORKSPACE</span>
            <h1>
              {screen === "discover"
                ? "Companies to know"
                : screen === "signals"
                  ? "Your signal map"
                  : "Your watchlist"}
            </h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="mobile-shell-menu-btn"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <button className="header-icon" type="button" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <button
              className="profile-button"
              type="button"
              onClick={() => setShowOnboarding(true)}
              aria-label="User profile"
            >
              <span className="avatar avatar-small">RK</span>
              <ChevronDown size={14} />
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="mobile-shell-menu-panel" role="menu">
              <button
                type="button"
                className={screen === "discover" ? "active" : ""}
                onClick={() => {
                  setScreen("discover");
                  setMobileMenuOpen(false);
                }}
              >
                <LayoutGrid size={16} /> Discover
              </button>
              <button
                type="button"
                className={screen === "signals" ? "active" : ""}
                onClick={() => {
                  setScreen("signals");
                  setMobileMenuOpen(false);
                }}
              >
                <LineChart size={16} /> Signals ({signalRows.length})
              </button>
              <button
                type="button"
                className={screen === "watchlist" ? "active" : ""}
                onClick={() => {
                  setScreen("watchlist");
                  setMobileMenuOpen(false);
                }}
              >
                <Bookmark size={16} /> Watchlist ({saved.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOnboarding(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Target size={16} /> Career profile
              </button>
              <button
                type="button"
                className="mobile-shell-exit-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onExit();
                }}
              >
                <ArrowRight size={16} /> Exit preview
              </button>
            </div>
          )}
        </header>
        {screen === "discover" && (
          <>
            <div className="discover-toolbar">
              <div className="toolbar-copy">
                <p>
                  {dataSource !== "demo" ? `${dataSource === "local" ? "Company records loaded from the local audited dataset." : "Company records loaded from the configured data repository."} Match scores and recommendations are not fabricated.` : "Illustrative recommendations shaped like your profile. Replace with verified data in integration."}
                </p>
                <span>
                  <span className="live-dot" /> {dataSource === "local" ? "LOCAL AUDITED DATA · EVIDENCE-FIRST" : dataSource === "live" ? "CONNECTED REPOSITORY · EVIDENCE-FIRST" : "Demo snapshot · not live"}
                </span>
                {dataError ? <small className="data-error">Live data unavailable; showing demo data.</small> : null}
              </div>
              <div className="toolbar-actions">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search companies, skills, cities"
                  />
                </label>
                <button className="filter-button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen}>
                  <Filter size={16} /> Filters <ChevronDown size={14} />
                </button>
                {filterOpen ? <div className="filter-popover">
                  <label>City<input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Any city" /></label>
                  <label>Verification<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Any status</option><option>Verified</option><option>Partially verified</option><option>Unverified</option><option>Unknown</option></select></label>
                  <label className="filter-check"><input type="checkbox" checked={rolesOnly} onChange={(event) => setRolesOnly(event.target.checked)} /> Has role data</label>
                </div> : null}
              </div>
            </div>
            <section className="insight-banner">
              <div className="insight-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <b>Illustrative market signal</b>
                <p>
                  Example: applied AI appears as a theme across this demo set. Counts and company details are not live.
                </p>
              </div>
              <button onClick={() => setScreen("signals")}>
                Explore signal <ArrowRight size={15} />
              </button>
            </section>
            <div className="list-head">
              <span>{filtered.length} {dataSource !== "demo" ? "company records" : "demo companies"}</span>
              <button onClick={() => setShowOnboarding(true)}>
                <Plus size={15} /> Refine my profile
              </button>
            </div>
            <div className="company-grid">
              {filtered.slice(0, visibleCount).map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  saved={saved.includes(company.id)}
                  onToggle={() => toggle(company.id)}
                  onOpen={() => setSelected(company)}
                />
              ))}
            </div>
            {filtered.length === 0 ? <div className="empty-state discovery-empty"><Search size={22} /><h3>No company records found.</h3><p>Try another name, city, or verification filter. Local records keep unknown evidence visible instead of guessing.</p></div> : null}
            {visibleCount < filtered.length ? <button className="load-more-button" onClick={() => setVisibleCount((count) => count + 24)}>Load more records <ArrowRight size={14} /></button> : null}
          </>
        )}
        {screen === "signals" && (
          <SignalsScreen onOpen={(company) => setSelected(company)} />
        )}
        {screen === "watchlist" && (
          <WatchlistScreen
            saved={saved}
            onToggle={toggle}
            onOpen={(company) => setSelected(company)}
            onDiscover={() => setScreen("discover")}
          />
        )}
      </main>
      {selected && (
        <CompanyDrawer
          company={selected}
          saved={saved.includes(selected.id)}
          onClose={() => setSelected(null)}
          onToggle={() => toggle(selected.id)}
        />
      )}
      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

function SignalsScreen({ onOpen }: { onOpen: (company: Company) => void }) {
  const extraRow: SignalRow = {
    company: "FamPay",
    type: "Source checked",
    detail: "Official careers page still active; no historical comparison in this demo",
    when: "3 days ago",
    tone: "mint",
    status: "UNKNOWN",
  };
  return (
    <div className="signals-screen">
      <div className="signal-overview">
        <div className="overview-card overview-dark">
          <span className="eyebrow">DEMO SNAPSHOT</span>
          <strong>14</strong>
          <p>illustrative signals in this example workspace</p>
          <span className="overview-trend">Not a live count</span>
        </div>
        <div className="overview-card">
          <div className="overview-icon amber">
            <Flame size={16} />
          </div>
          <strong>6</strong>
          <p>example role clusters surfaced</p>
          <span className="overview-link">Not confirmed new roles</span>
        </div>
        <div className="overview-card">
          <div className="overview-icon mint">
            <ShieldCheck size={16} />
          </div>
          <strong>87%</strong>
          <p>illustrative source coverage</p>
          <span className="overview-link">Demo only</span>
        </div>
      </div>
      <div className="signal-status-legend">
        <span>STATUS LEGEND</span>
        <SignalStatusPill status="OBSERVED" />
        <SignalStatusPill status="CONFIRMED_NEW" />
        <SignalStatusPill status="PERSISTENT" />
        <SignalStatusPill status="UNKNOWN" />
      </div>
      <div className="signals-layout">
        <div className="signal-timeline">
          <div className="subsection-head">
            <div>
              <span className="eyebrow">OBSERVED EVENTS · DEMO DATA</span>
              <h2>What changed</h2>
            </div>
            <button className="filter-button">
              Last 30 days <ChevronDown size={14} />
            </button>
          </div>
          {signalRows
            .concat([extraRow])
            .map((row, index) => (
              <div className="timeline-row" key={`${row.company}-${index}`}>
                <div className={`timeline-node ${row.tone}`} />{" "}
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <b>{row.type}</b>
                    <time>{row.when}</time>
                  </div>
                  <div className="timeline-detail">
                    <p>
                      <strong>{row.company}</strong> {row.detail}
                    </p>
                    <SignalStatusPill status={row.status} />
                  </div>
                  <button
                    onClick={() => {
                      const company = companies.find(
                        (item) => item.name === row.company,
                      );
                      if (company) onOpen(company);
                    }}
                  >
                    Inspect company <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
        </div>
        <div className="signal-aside">
          <div className="aside-note">
            <div className="aside-note-icon">
              <ShieldCheck size={17} />
            </div>
            <span className="eyebrow">HOW WE LABEL SIGNALS</span>
            <h3>Observed, not imagined.</h3>
            <p>
              A source change is not automatically a new job. “Confirmed new”
              and “Persistent” require defensible history; this preview keeps
              unsupported states explicit.
            </p>
            <div className="label-demo">
              <SignalStatusPill status="OBSERVED" />
              <SignalStatusPill status="CONFIRMED_NEW" />
              <SignalStatusPill status="PERSISTENT" />
              <SignalStatusPill status="UNKNOWN" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchlistScreen({
  saved,
  onToggle,
  onOpen,
  onDiscover,
}: {
  saved: string[];
  onToggle: (id: string) => void;
  onOpen: (company: Company) => void;
  onDiscover: () => void;
}) {
  const items = companies.filter((company) => saved.includes(company.id));
  return (
    <div className="watchlist-screen">
      <div className="watchlist-intro">
        <div>
          <span className="eyebrow">YOUR SHORTLIST</span>
          <h2>Keep the thread.</h2>
          <p>
            Save companies that feel worth following. We will show you what
            changes next.
          </p>
        </div>
        <button className="primary-button" onClick={onDiscover}>
          Find more companies <ArrowRight size={16} />
        </button>
      </div>
      {items.length ? (
        <div className="company-grid">
          {items.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              saved
              onToggle={() => onToggle(company.id)}
              onOpen={() => onOpen(company)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Bookmark size={22} />
          <h3>Your watchlist is quiet.</h3>
          <p>
            Save a company from Discover and we will keep an eye on the
            meaningful changes.
          </p>
          <button className="dark-button" onClick={onDiscover}>
            Explore companies <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function CompanyDrawer({
  company,
  saved,
  onClose,
  onToggle,
}: {
  company: Company;
  saved: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="company-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-top">
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
          <span className="mock-badge">{company.demoData === false ? "SOURCE-BACKED PROFILE" : "MOCK DATA PROFILE"}</span>
          <button
            className={`icon-button ${saved ? "saved" : ""}`}
            onClick={onToggle}
          >
            {saved ? (
              <Bookmark size={18} fill="currentColor" />
            ) : (
              <Bookmark size={18} />
            )}
          </button>
        </div>
        <div className="drawer-company">
          <span
            className="company-mark large"
            style={{ background: company.accent }}
          >
            {company.mark}
          </span>
          <span
            className={`status status-${company.status.toLowerCase().replaceAll(" ", "-")}`}
          >
            <span />
            {company.status}
          </span>
          <h2>{company.name}</h2>
          <p>
            {company.category} · {company.city}
          </p>
          <span className="opening-scope">{company.openingSummary ?? `${company.roles ?? 0} role records`}</span>
          {(() => {
            const safeWeb = safeExternalUrl(company.website);
            return (
              <a
                href={safeWeb ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
              >
                {safeWeb ? <>{company.website} <ExternalLink size={13} /></> : "Website not available"}
              </a>
            );
          })()}
          {company.careerUrls?.length ? (
            <div className="drawer-source-links">
              {company.careerUrls.slice(0, 3).map((url) => {
                const safeCareer = safeExternalUrl(url);
                if (!safeCareer) return null;
                return (
                  <a key={url} href={safeCareer} target="_blank" rel="noreferrer noopener">
                    Career source <ExternalLink size={13} />
                  </a>
                );
              })}
            </div>
          ) : (
            <small className="drawer-uncertain">Career page not established in the available source rows.</small>
          )}
        </div>
        <div className="drawer-fit">
          <div>
            <span className="eyebrow">{company.match === null ? "MATCHING NOT CONFIGURED" : "ILLUSTRATIVE FIT"}</span>
            <strong>{company.match === null ? "—" : `${company.match}%`}</strong>
            <p>
              Based on skills, location, work mode, and career-stage context.
            </p>
          </div>
          <div className="drawer-fit-ring">
            <span>{company.match === null ? "—" : company.match}</span>
          </div>
        </div>
        <div className="drawer-section">
          <span className="eyebrow">WHY THIS IS HERE</span>
          <p className="drawer-reason">
            <Sparkles size={15} /> {company.reason}
          </p>
          <div className="skill-list">
            {company.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
        <div className="drawer-section signal-section-small">
          <div>
            <span className="eyebrow">LATEST SIGNAL</span>
            <h3>{company.signal}</h3>
            <p>
              Observed from {company.source.toLowerCase()} ·{" "}
              {company.lastChecked}
            </p>
          </div>
          <LineChart size={20} />
        </div>
        <div className="drawer-section provenance">
          <ShieldCheck size={16} />
          <div>
            <b>Source context</b>
            <p>
              {company.source} · Last checked {company.lastChecked}. This is
              mock data for the preview.
            </p>
          </div>
        </div>
        {(() => {
          const officialUrl = safeExternalUrl(company.careerUrls?.[0] || company.website);
          return officialUrl ? (
            <a
              className="drawer-cta"
              href={officialUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open official source <ExternalLink size={15} />
            </a>
          ) : (
            <button className="drawer-cta" disabled type="button">
              Official source not available
            </button>
          );
        })()}
      </aside>
    </div>
  );
}

function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const steps = ["Your focus", "Your signal", "Your cities"];
  return (
    <div className="modal-backdrop">
      <div className="onboarding-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="onboard-progress">
          {steps.map((item, index) => (
            <div
              className={
                step > index + 1
                  ? "progress-step done"
                  : step === index + 1
                    ? "progress-step active"
                    : "progress-step"
              }
              key={item}
            >
              <span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
              {item}
            </div>
          ))}
        </div>
        {step === 1 && (
          <div className="onboard-body">
            <span className="eyebrow">LET’S MAKE THIS YOURS</span>
            <h2>
              What kind of work
              <br />
              do you want to <em>notice?</em>
            </h2>
            <p>Start with a few signals. You can change these anytime.</p>
            <div className="onboard-options">
              <button className="selected">
                <Check size={15} />
                Applied AI & ML
              </button>
              <button>Platform engineering</button>
              <button>Product & growth</button>
              <button>Research & data</button>
            </div>
            <div className="onboard-input">
              <Search size={15} />
              <input placeholder="Add another focus" />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="onboard-body">
            <span className="eyebrow">OPTIONAL ACCELERATOR</span>
            <h2>
              Bring your profile,
              <br />
              <em>or don’t.</em>
            </h2>
            <p>
              Upload a resume and we’ll suggest skills and roles. Nothing is
              saved in this preview.
            </p>
            <div className="upload-zone">
              <Sparkles size={22} />
              <b>Drop a PDF resume here</b>
              <span>or choose a file · Optional</span>
            </div>
            <button className="skip-link">Continue without a resume</button>
          </div>
        )}
        {step === 3 && (
          <div className="onboard-body">
            <span className="eyebrow">WHERE SHOULD WE LOOK?</span>
            <h2>
              Choose the places
              <br />
              that feel <em>right.</em>
            </h2>
            <p>Select a few cities or include remote roles.</p>
            <div className="city-options">
              {[
                "Bengaluru",
                "Mumbai",
                "Delhi NCR",
                "Hyderabad",
                "Pune",
                "Remote",
              ].map((city, index) => (
                <button
                  className={index === 0 || index === 5 ? "selected" : ""}
                  key={city}
                >
                  {index === 0 || index === 5 ? (
                    <Check size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {city}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="onboard-footer">
          <span>Step {step} of 3</span>
          <div>
            <button className="text-button" onClick={onClose}>
              Not now
            </button>
            {step < 3 ? (
              <button
                className="primary-button compact"
                onClick={() => setStep(step + 1)}
              >
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button className="primary-button compact" onClick={onClose}>
                See my radar <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundRoute({
  navigate,
  onEnter,
}: {
  navigate: (path: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="not-found-page">
      <header className="not-found-header">
        <a
          href="/#top"
          className="brand-home"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          aria-label="Career Radar home"
        >
          <Logo />
        </a>
      </header>
      <main className="not-found-content">
        <span className="kicker">
          <span className="kicker-line" /> SIGNAL LOST · 404
        </span>
        <h1>
          This page is <em>off our radar.</em>
        </h1>
        <p>
          The page you requested does not exist or may have moved. You can head back to the home page or explore the company discovery preview.
        </p>
        <div className="not-found-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/")}
          >
            Back to home <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="not-found-preview-btn"
            onClick={onEnter}
          >
            Explore preview
          </button>
        </div>
      </main>
    </div>
  );
}

function usePageMetadata(path: string, entered: boolean) {
  useEffect(() => {
    let title = "Career Radar — Company-first career intelligence";
    let description =
      "Discover companies worth your next career move, explore verified career signals, and build a shortlist with evidence.";

    if (entered) {
      title = "Discover Companies | Career Radar";
      description =
        "Explore companies beyond standard job listings with verified career signals.";
    } else {
      switch (path) {
        case "/":
          title = "Career Radar — Company-first career intelligence";
          description =
            "Discover companies worth your next career move, explore verified career signals, and build a shortlist with evidence.";
          break;
        case "/login":
          title = "Sign In | Career Radar";
          description =
            "Sign in to your Career Radar account to access your shortlist and career signals.";
          break;
        case "/signup":
          title = "Create Account | Career Radar";
          description =
            "Create your Career Radar account to discover verified companies and career opportunities.";
          break;
        case "/forgot-password":
          title = "Forgot Password | Career Radar";
          description =
            "Request a secure password reset link for your Career Radar account.";
          break;
        case "/reset-password":
          title = "Reset Password | Career Radar";
          description =
            "Set a new secure password for your Career Radar account.";
          break;
        case "/auth/callback":
          title = "Authenticating | Career Radar";
          description = "Verifying your authentication credentials...";
          break;
        case "/onboarding":
          title = "Profile Setup | Career Radar";
          description =
            "Configure your career preferences, role focus, skills, and target locations.";
          break;
        case "/dashboard":
          title = "Dashboard | Career Radar";
          description =
            "View your personalized career intelligence, company signals, and recommendations.";
          break;
        default:
          title = "Page Not Found | Career Radar";
          description =
            "The requested page could not be found. Return to Career Radar home or explore the preview.";
          break;
      }
    }

    document.title = title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);
  }, [path, entered]);
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => { const onPopState = () => setPath(window.location.pathname); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  const navigate = useCallback((nextPath: string) => { window.history.pushState({}, "", nextPath); setPath(nextPath.split("?")[0] ?? "/"); window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  usePageMetadata(path, entered);

  const pageKey = entered ? "app-shell" : path;

  let pageContent: React.ReactNode;
  if (entered) {
    pageContent = <AppShell onExit={() => setEntered(false)} />;
  } else if (path === "/signup" || path === "/login") {
    pageContent = <AuthRoute path={path} navigate={navigate} />;
  } else if (path === "/forgot-password") {
    pageContent = <ForgotPasswordRoute navigate={navigate} />;
  } else if (path === "/reset-password") {
    pageContent = <ResetPasswordRoute navigate={navigate} />;
  } else if (path === "/auth/callback") {
    pageContent = <AuthCallbackRoute navigate={navigate} />;
  } else if (path === "/onboarding") {
    pageContent = <OnboardingRoute navigate={navigate} />;
  } else if (path === "/dashboard") {
    pageContent = <DashboardRoute navigate={navigate} />;
  } else if (path === "/" || path === "") {
    pageContent = (
      <Landing
        onEnter={() => setEntered(true)}
        onLogin={() => navigate("/login")}
        onSignUp={() => navigate("/signup")}
      />
    );
  } else {
    pageContent = (
      <NotFoundRoute
        navigate={navigate}
        onEnter={() => setEntered(true)}
      />
    );
  }

  return (
    <div key={pageKey} className="page-transition">
      {pageContent}
    </div>
  );
}
