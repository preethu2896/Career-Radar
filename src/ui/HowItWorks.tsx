import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Check, CircleHelp, ExternalLink, Globe2, LineChart, ShieldCheck } from "lucide-react";
import { companies, signalRows, type Company } from "./mockData.js";
import image1Url from "../../image1.webp";

const stages = [
  { label: "Discover companies", short: "Discover" },
  { label: "Understand the evidence", short: "Evidence" },
  { label: "Track career signals", short: "Signals" },
  { label: "Build your watchlist", short: "Watchlist" },
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function DemoPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "mint" | "blue" | "amber" }) {
  return <span className={`how-pill how-pill-${tone}`}>{children}</span>;
}
function CompanyMark({ company }: { company: Company }) {
  return <span className="how-company-mark" style={{ background: company.accent }}>{company.mark}</span>;
}

function BrowserContent({ activeIndex }: { activeIndex: number }) {
  const featured = companies[0]!;
  if (activeIndex === 0) return <div className="how-preview-screen how-discovery-screen"><aside className="how-preview-sidebar"><span className="how-preview-kicker">CAREER RADAR</span><strong>Discover beyond the obvious.</strong><span className="how-sidebar-note">Illustrative preview</span><div className="how-sidebar-item active"><Globe2 size={13} /> Company map</div><div className="how-sidebar-item"><LineChart size={13} /> Signals</div><div className="how-sidebar-item"><Check size={13} /> Watchlist</div></aside><div className="how-preview-main"><div className="how-preview-heading"><div><span className="how-preview-kicker">EXAMPLE MARKET VIEW</span><h3>Companies worth a closer look</h3></div><DemoPill tone="mint">Demo data</DemoPill></div><div className="how-preview-filter-row"><span>Applied AI · Bengaluru</span><span>4 example companies</span></div><div className="how-company-list">{companies.slice(0, 3).map((company) => <div className="how-company-row" key={company.id}><CompanyMark company={company} /><div className="how-company-copy"><b>{company.name}</b><span>{company.category} · {company.city}</span><small>{company.reason}</small><div className="how-company-tags">{company.skills.slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="how-company-score"><strong>{company.match}%</strong><small>illustrative fit</small></div></div>)}</div></div></div>;
  if (activeIndex === 1) return <div className="how-preview-screen how-evidence-screen"><aside className="how-preview-sidebar how-detail-sidebar"><span className="how-preview-kicker">COMPANY DETAIL</span><CompanyMark company={featured} /><strong>{featured.name}</strong><span>{featured.category}</span><DemoPill tone="mint">{featured.status}</DemoPill><a href={`https://${featured.website}`} target="_blank" rel="noreferrer noopener">Open source <ExternalLink size={11} /></a></aside><div className="how-preview-main"><div className="how-preview-heading"><div><span className="how-preview-kicker">WHY THIS MAY FIT</span><h3>{featured.name}</h3></div><DemoPill tone="blue">Illustrative relevance</DemoPill></div><p className="how-evidence-intro">A transparent view of the signals that informed this example recommendation.</p><div className="how-evidence-grid"><div><Check size={15} /><b>Official source</b><span>{featured.source} · checked {featured.lastChecked}</span></div><div><Check size={15} /><b>Role context</b><span>{featured.roles} example roles across {featured.skills.slice(0, 2).join(" and ")}</span></div><div className="how-evidence-unknown"><CircleHelp size={15} /><b>Still unknown</b><span>Compensation and current hiring intent are not verified here.</span></div></div><div className="how-evidence-reason"><span className="how-preview-kicker">REASON SHOWN AS CONTEXT</span><p>{featured.reason}</p></div></div></div>;
  if (activeIndex === 2) return <div className="how-preview-screen how-signals-screen"><aside className="how-preview-sidebar"><span className="how-preview-kicker">SIGNAL LEDGER</span><strong>What changed, and what did not.</strong><span className="how-sidebar-note">Illustrative observations</span><DemoPill tone="amber">History incomplete</DemoPill></aside><div className="how-preview-main"><div className="how-preview-heading"><div><span className="how-preview-kicker">EXAMPLE ACTIVITY</span><h3>Career-page observations</h3></div><DemoPill tone="blue">Not live data</DemoPill></div><div className="how-signal-list">{signalRows.map((row) => <div className="how-signal-row" key={row.company}><span className={`how-signal-node how-signal-node-${row.tone}`} /><div><b>{row.type}</b><span>{row.company} · {row.detail}</span></div><div><DemoPill tone={row.status === "UNKNOWN" ? "amber" : row.status === "OBSERVED" ? "blue" : "mint"}>{row.status === "UNKNOWN" ? "Unknown" : row.status === "OBSERVED" ? "Observed" : "Confirmed new"}</DemoPill><time>{row.when}</time></div></div>)}</div><p className="how-preview-footnote">Statuses are examples only until verified observation history is connected.</p></div></div>;
  return <div className="how-preview-screen how-watchlist-screen"><aside className="how-preview-sidebar"><span className="how-preview-kicker">YOUR WATCHLIST</span><strong>Keep the context that matters.</strong><span className="how-sidebar-note">Illustrative saved companies</span><div className="how-sidebar-count">4 <small>saved examples</small></div></aside><div className="how-preview-main"><div className="how-preview-heading"><div><span className="how-preview-kicker">SAVED COMPANIES</span><h3>Return when the signal is useful</h3></div><DemoPill tone="mint">Ready to revisit</DemoPill></div><div className="how-watch-grid">{companies.slice(0, 3).map((company) => <div className="how-watch-row" key={company.id}><CompanyMark company={company} /><div><b>{company.name}</b><span>{company.category} · {company.city}</span></div><div className="how-watch-meta"><DemoPill tone={company.status === "Verified" ? "mint" : "amber"}>{company.status}</DemoPill><a href={`https://${company.website}`} target="_blank" rel="noreferrer noopener" aria-label={`Open ${company.name} website`}><ExternalLink size={13} /></a></div></div>)}</div><p className="how-preview-footnote">Save a company to preserve its source, context, and latest known status.</p></div></div>;
}

export function CareerWalkthrough() {
  const shellRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let ticking = false;
    let startY = 0;
    let distance = 1;
    let isMobile = false;
    const measure = () => {
      isMobile = window.matchMedia("(max-width: 720px)").matches;
      startY = shell.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, shell.offsetHeight - (isMobile ? window.innerHeight * 0.25 : window.innerHeight));
      if (isMobile) startY -= window.innerHeight * 0.25;
    };
    const render = () => {
      ticking = false;
      const p = clamp((window.scrollY - startY) / distance, 0, 1);
      if (!isMobile) {
        frameRef.current?.style.setProperty("--walkthrough-scale", String(0.84 + clamp(p / 0.2, 0, 1) * 0.16));
      }
      const stageProgress = isMobile ? p : clamp((p - 0.2) / 0.7, 0, 0.999);
      const nextIndex = clamp(Math.floor(stageProgress * stages.length), 0, stages.length - 1);
      if (nextIndex !== activeIndexRef.current) {
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    const onResize = () => { measure(); onScroll(); };
    measure(); render(); window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, []);
  useEffect(() => { const frame = frameRef.current; if (!frame) return; const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) setEntered(true); }, { threshold: 0.2 }); observer.observe(frame); return () => observer.disconnect(); }, []);
  const goToStage = (index: number) => { const shell = shellRef.current; if (!shell || window.matchMedia("(max-width: 720px)").matches) { activeIndexRef.current = index; setActiveIndex(index); return; } const distance = Math.max(1, shell.offsetHeight - window.innerHeight); const targetProgress = 0.2 + ((index + 0.5) / stages.length) * 0.7; window.scrollTo({ top: shell.getBoundingClientRect().top + window.scrollY + targetProgress * distance, behavior: "smooth" }); };
  return <section id="how-it-works" className="career-walkthrough" ref={shellRef}><div className="career-walkthrough-sticky"><div className="walkthrough-heading"><h2>Follow the signal, <em>keep the choice.</em></h2><p>One calm workspace for finding companies, checking the evidence, and deciding what deserves your attention.</p></div><div className={`walkthrough-frame ${entered ? "is-entered" : ""}`} ref={frameRef} style={{ "--walkthrough-scale": 0.84 } as CSSProperties}><div className="walkthrough-browser"><div className="walkthrough-browser-bar"><span className="browser-traffic"><i /><i /><i /></span><span className="browser-address">app.careerradar.example / {stages[activeIndex]!.short.toLowerCase()}</span><span className="browser-menu">•••</span></div><BrowserContent activeIndex={activeIndex} /></div></div><div className="walkthrough-controls" role="tablist" aria-label="Career Radar walkthrough stages">{stages.map((stage, index) => <button key={stage.label} type="button" role="tab" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onClick={() => goToStage(index)}>{stage.label}</button>)}</div></div></section>;
}

export function TrustAndAudienceSections({ onEnter }: { onEnter: () => void }) {
  return <><RadarNotificationSection /><section className="career-radar-cta-section"><div className="career-radar-cta-inner"><h2 className="career-radar-cta-heading">Your next opportunity<br />could be closer<br /><em>than you think.</em></h2><p className="career-radar-cta-description">Discover companies beyond the obvious, understand the signals behind their opportunities, and build a shortlist that reflects where you want your career to go.</p><button className="career-radar-cta-button" onClick={onEnter}>Explore Career Radar <ArrowRight size={17} /></button></div></section></>;
}

function RadarNotificationSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setVisible(true);
    }, { threshold: 0.18 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return <section id="trust" className={`radar-notification-section ${visible ? "is-visible" : ""}`} ref={sectionRef}>
    <div className="radar-notification-inner">
      <div className="radar-notification-copy">
        <p className="radar-notification-eyebrow">YOUR NEXT MOVE, MADE CLEARER</p>
        <h2>Skip the endless search.<br /><em>Wake up to better signals.</em></h2>
        <p className="radar-notification-description">Career Radar helps you discover companies worth knowing, understand the evidence behind each opportunity, and keep track of the career signals that matter to you. Your next move stays your choice.</p>
        <a className="radar-notification-cta" href="/#signals">Explore your radar <ArrowRight size={16} /></a>
      </div>
      <div className="radar-notification-visual" aria-label="Illustrative Career Radar signal notifications">
        <img src={image1Url} alt="A person standing in a sunlit field beneath a wide blue sky" loading="lazy" width={1122} height={1402} />
        <div className="radar-notification-stack">
          <article className="radar-notification-card radar-notification-card-one"><div className="radar-notification-icon"><LineChart size={15} /></div><div><span>Career Radar</span><strong>A company worth exploring</strong><small>Applied AI · Bengaluru</small></div><time>New signal</time></article>
          <article className="radar-notification-card radar-notification-card-two"><div className="radar-notification-icon"><ShieldCheck size={15} /></div><div><span>Career Radar</span><strong>Career signal updated</strong><small>A saved company&apos;s career page has changed</small></div><time>Recently checked</time></article>
        </div>
      </div>
    </div>
  </section>;
}
