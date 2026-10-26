import { useEffect, useRef, useState } from "react";
import "./HowItWorks.css";

const TABS = [
  { label: "Find your best matches", path: "/jobs" },
  { label: "Tailor your resume", path: "/resume" },
  { label: "Apply for you", path: "/applications" },
  { label: "Track your inbox", path: "/inbox-tracker" },
];

// Scroll range (0–1 of pin travel) over which the 4 tabs advance
const TAB_START = 0.05;
const TAB_END = 0.91;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export default function HowItWorks() {
  const shellRef = useRef(null);
  const cardRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entered, setEntered] = useState(false);

  // Scroll-driven tab switching (reversible — scroll up steps tabs back)
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let ticking = false;

    const render = () => {
      ticking = false;
      const top = shell.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, shell.offsetHeight - window.innerHeight);
      const p = clamp((window.scrollY - top) / distance, 0, 1);
      const segment = (TAB_END - TAB_START) / TABS.length;
      const idx = clamp(Math.floor((p - TAB_START) / segment), 0, TABS.length - 1);
      setActiveIndex(idx); // React bails out when the value is unchanged
    };

    const requestRender = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    };

    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
    };
  }, []);

  // Blur-to-sharp entrance when the card first enters the viewport
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setEntered(true);
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Clicking a pill smooth-scrolls to that tab's scroll position
  const goToTab = (index) => {
    const shell = shellRef.current;
    if (!shell) return;
    const top = shell.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(1, shell.offsetHeight - window.innerHeight);
    const segment = (TAB_END - TAB_START) / TABS.length;
    const targetP = TAB_START + index * segment + segment * 0.5;
    window.scrollTo({ top: top + targetP * distance, behavior: "smooth" });
  };

  return (
    <div className="howitworks-root">
      {/* Demo spacer — delete when embedding in a real page */}
      <div className="spacer" aria-hidden="true">
        <div className="scroll-hint">Scroll down</div>
      </div>

      <main className="how-shell" id="how-it-works" ref={shellRef}>
        <div className="sticky-stage">
          <h1 className="howitworks-title">How it works.</h1>

          <section
            className={`demo-card${entered ? " entered" : ""}`}
            ref={cardRef}
            aria-label="Interactive product walkthrough"
          >
            <div className="browser">
              <div className="browser-bar">
                <div className="traffic" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <div className="address">app.myjobb.ai{TABS[activeIndex].path}</div>
                <div className="window-icon" aria-hidden="true">
                  ⋯
                </div>
              </div>

              <div className="screens">
                {/* TAB 1 — Find your best matches */}
                <article
                  className={`screen matches${activeIndex === 0 ? " active" : ""}`}
                  aria-hidden={activeIndex !== 0}
                >
                  <aside className="side">
                    <div className="kicker">YOUR MATCHES</div>
                    <div className="ui-title">5 roles that fit you, ranked.</div>
                    <div className="job-card selected">
                      <div className="logo">N</div>
                      <div>
                        <div className="job-name">Senior Frontend Engineer</div>
                        <div className="company">Novapay · Bengaluru</div>
                        <div className="job-meta">₹42L–₹58L/yr · 2h ago</div>
                        <div className="tags">
                          <span className="tag">React</span>
                          <span className="tag">TypeScript</span>
                          <span className="tag">Remote</span>
                        </div>
                      </div>
                      <span className="match-chip">96%</span>
                    </div>
                    <div className="job-card">
                      <div className="logo orange">Z</div>
                      <div>
                        <div className="job-name">Frontend Engineer</div>
                        <div className="company">Zentail · Mumbai</div>
                        <div className="job-meta">₹35L–₹50L/yr · 5h ago</div>
                        <div className="tags">
                          <span className="tag">Next.js</span>
                          <span className="tag">Design systems</span>
                        </div>
                      </div>
                      <span className="match-chip">91%</span>
                    </div>
                    <div className="job-card">
                      <div className="logo blue">C</div>
                      <div>
                        <div className="job-name">UI Engineer</div>
                        <div className="company">Cloudkart · Remote</div>
                        <div className="job-meta">₹30L–₹44L/yr · 8h ago</div>
                        <div className="tags">
                          <span className="tag">React</span>
                          <span className="tag">GraphQL</span>
                        </div>
                      </div>
                      <span className="match-chip">89%</span>
                    </div>
                  </aside>
                  <div className="panel detail-card">
                    <div className="detail-head">
                      <div>
                        <div className="kicker lime">NOVAPAY · 2.4M CUSTOMERS</div>
                        <h2>Senior Frontend Engineer</h2>
                        <div className="ui-sub">Hybrid · Bengaluru</div>
                      </div>
                      <span className="match-chip">96% MATCH</span>
                    </div>
                    <div className="detail-stat">
                      <div>
                        <b>₹42L–₹58L</b>
                        <span>Annual salary</span>
                      </div>
                      <div>
                        <b>5–7 years</b>
                        <span>Experience</span>
                      </div>
                      <div>
                        <b>2 days</b>
                        <span>In office</span>
                      </div>
                    </div>
                    <div className="why">
                      <div className="kicker">WHY YOU MATCH</div>
                      <p>✓ 9 of 10 core skills match your profile</p>
                      <p>✓ Your payments experience is highly relevant</p>
                      <p>✓ Compensation and location fit your preferences</p>
                    </div>
                    <div className="button-row">
                      <button className="ui-button" tabIndex={-1}>
                        Apply
                      </button>
                      <button className="ui-button secondary" tabIndex={-1}>
                        See why
                      </button>
                    </div>
                  </div>
                </article>

                {/* TAB 2 — Tailor your resume */}
                <article
                  className={`screen resume${activeIndex === 1 ? " active" : ""}`}
                  aria-hidden={activeIndex !== 1}
                >
                  <aside className="side chat">
                    <div>
                      <div className="kicker">RESUME ASSISTANT</div>
                      <div className="ui-title">Tailor with a conversation.</div>
                    </div>
                    <div className="bubble">
                      I&apos;ve tailored your resume for the Senior Frontend role at Novapay.
                    </div>
                    <div className="bubble user">add my Next.js work</div>
                    <div className="bubble">
                      Done — added it to Experience and matched 4 more keywords.
                    </div>
                    <div className="chat-input">Tell me what to tighten…</div>
                  </aside>
                  <div className="panel">
                    <div className="resume-page">
                      <h3>Aarav Mehta</h3>
                      <div className="resume-contact">
                        Frontend Engineer · Bengaluru · aarav@example.com
                      </div>
                      <div className="ats">
                        <div className="ats-score">
                          94/100<small>Strong</small>
                        </div>
                      </div>
                      <div className="resume-section">SUMMARY</div>
                      <p>
                        Frontend engineer building fast, accessible financial
                        products with React, TypeScript and Next.js.
                      </p>
                      <div className="resume-section">EXPERIENCE</div>
                      <div className="resume-role">
                        Senior Frontend Engineer · Finlytics
                      </div>
                      <p>• Led a Next.js migration that improved checkout performance by 38%.</p>
                      <p>• Built a reusable design system adopted across 6 product teams.</p>
                      <p>• Reduced page-load time by 1.4 seconds through bundle optimization.</p>
                      <div className="resume-role">UI Engineer · Cloudmint</div>
                      <p>• Shipped data-heavy dashboards used by 120,000 customers.</p>
                      <p>• Partnered with design to raise accessibility coverage to WCAG AA.</p>
                      <div className="resume-section">SKILLS</div>
                      <p>React · TypeScript · Next.js · Design Systems · GraphQL · Testing</p>
                    </div>
                  </div>
                </article>

                {/* TAB 3 — Apply for you */}
                <article
                  className={`screen apply${activeIndex === 2 ? " active" : ""}`}
                  aria-hidden={activeIndex !== 2}
                >
                  <aside className="side">
                    <div className="kicker">APPLICATIONS</div>
                    <div className="ui-title">24 this week</div>
                    <div className="app-row">
                      <b>Senior Frontend Engineer</b>
                      <div className="company">Novapay</div>
                      <span>● Submitted</span>
                    </div>
                    <div className="app-row">
                      <b>Product Engineer</b>
                      <div className="company">Zentail</div>
                      <span>● Submitted</span>
                    </div>
                    <div className="app-row">
                      <b>UI Engineer</b>
                      <div className="company">Cloudkart</div>
                      <span>● Submitted</span>
                    </div>
                  </aside>
                  <div className="panel">
                    <div className="kicker">AGENT ACTIVITY</div>
                    <div className="ui-title">Novapay application</div>
                    <div className="timeline">
                      <div className="event">
                        <b>Opened your application on Novapay careers</b>
                        <time>5:06:23 PM</time>
                      </div>
                      <div className="event">
                        <b>Filled your details</b>
                        <div className="ui-sub">
                          Name, email, phone, location and portfolio from profile
                        </div>
                        <time>5:06:32 PM</time>
                      </div>
                      <div className="event">
                        <b>Application submitted</b>
                        <div className="ui-sub">Confirmation received</div>
                        <time>5:07:24 PM</time>
                      </div>
                    </div>
                  </div>
                  <div className="panel form-panel">
                    <div className="kicker">APPLICATION FORM</div>
                    <div className="ui-title">Review of answers</div>
                    <div className="form-row">
                      <label>Current location</label>
                      <div className="answer">
                        <span>Bengaluru, India</span>
                        <span className="badge">From profile</span>
                      </div>
                    </div>
                    <div className="form-row">
                      <label>Why do you want to join us?</label>
                      <div className="answer">
                        <span>To build trusted payment products at scale.</span>
                        <span className="badge amber">Reasoned</span>
                      </div>
                    </div>
                    <div className="form-row">
                      <label>Years using React</label>
                      <div className="answer">
                        <span>6 years</span>
                        <span className="badge">From profile</span>
                      </div>
                    </div>
                    <div className="form-row">
                      <label>Notice period</label>
                      <div className="answer">
                        <span>30 days</span>
                        <span className="badge">From profile</span>
                      </div>
                    </div>
                    <div className="heads-up">
                      <b>Heads up</b>
                      <br />
                      Re-read AI-drafted answers before your interview.
                    </div>
                  </div>
                </article>

                {/* TAB 4 — Track your inbox */}
                <article
                  className={`screen inbox${activeIndex === 3 ? " active" : ""}`}
                  aria-hidden={activeIndex !== 3}
                >
                  <aside className="side">
                    <div className="kicker">INBOX</div>
                    <div className="ui-title">Every reply, together.</div>
                    <div className="mail-address">aarav.mehta@inbox.myjobb.ai</div>
                    <div className="filters">
                      <span className="filter active">Interview</span>
                      <span className="filter">Offer</span>
                      <span className="filter">Applied</span>
                    </div>
                    <div className="mail-row selected">
                      <div className="sender-dot">N</div>
                      <div>
                        <b>Novapay Recruiting</b>
                        <p>Interview invitation · Senior Frontend Engineer</p>
                      </div>
                      <time>2m</time>
                    </div>
                    <div className="mail-row">
                      <div className="sender-dot">Z</div>
                      <div>
                        <b>Zentail Careers</b>
                        <p>Your application has moved forward</p>
                      </div>
                      <time>1h</time>
                    </div>
                    <div className="mail-row">
                      <div className="sender-dot">C</div>
                      <div>
                        <b>Cloudkart Talent</b>
                        <p>Thanks for applying</p>
                      </div>
                      <time>3h</time>
                    </div>
                  </aside>
                  <div className="panel mail-open">
                    <div className="kicker lime">INTERVIEW</div>
                    <h2>Let&apos;s talk about the Senior Frontend Engineer role</h2>
                    <div className="mail-from">
                      From: Priya at Novapay Recruiting · 2 minutes ago
                    </div>
                    <div className="mail-copy">
                      <p>Hi Aarav,</p>
                      <p>
                        Thanks for your application. Your product engineering
                        experience stood out to our team.
                      </p>
                      <p>
                        We&apos;d like to invite you to a 30-minute first
                        conversation about the role and your work with design
                        systems.
                      </p>
                      <p>
                        <strong>Choose a time that works for you.</strong>
                      </p>
                      <p>
                        Best,
                        <br />
                        Priya
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <nav className="tabs-wrap" aria-label="How it works steps">
            <button className="arrow" type="button" tabIndex={-1} aria-hidden="true">
              ‹
            </button>
            <div className="tabs">
              {TABS.map((tab, i) => (
                <button
                  key={tab.label}
                  className={`tab${i === activeIndex ? " active" : ""}`}
                  type="button"
                  onClick={() => goToTab(i)}
                  aria-current={i === activeIndex ? "step" : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button className="arrow" type="button" tabIndex={-1} aria-hidden="true">
              ›
            </button>
          </nav>
        </div>
      </main>

      {/* Demo spacer — delete when embedding in a real page */}
      <div className="spacer bottom" aria-hidden="true"></div>
    </div>
  );
}
