import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import './walkthrough.css';

const Demo = lazy(() => import('./CareerDemo.js'));

function StillFallback() {
  return <div className="cr-walkthrough-fallback"><span>CareerRadar</span><strong>Find a role. Take the next step.</strong><p>Explore jobs and companies, unlock apply links and apply directly with the employer.</p></div>;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <StillFallback /> : this.props.children; }
}

export function CareerWalkthrough() {
  const section = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <section id="how-it-works" className="cr-walkthrough" ref={section} aria-labelledby="career-walkthrough-heading">
    <div className="walkthrough-heading"><h2 id="career-walkthrough-heading">Find your next role.<br /><em>Go straight to the source.</em></h2><p>Explore jobs and companies, unlock apply links and apply on the employer’s own site.</p></div>
    <figure aria-label="How CareerRadar works: explore jobs and companies, sign in, get the application link, and apply directly on the employer’s site">
      <PreviewBoundary><Suspense fallback={<StillFallback />}>{near ? <Demo /> : <StillFallback />}</Suspense></PreviewBoundary>
    </figure>
  </section>;
}
