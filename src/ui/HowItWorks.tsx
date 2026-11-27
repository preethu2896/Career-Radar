import { useEffect, useRef, useState } from "react";
import { ArrowRight, LineChart, ShieldCheck } from "lucide-react";
import image1Url from "../../image1.webp";
export { CareerWalkthrough } from "./walkthrough/CareerWalkthrough.js";

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
