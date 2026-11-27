import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import './walkthrough.css';

const Demo = lazy(() => import('./CareerDemo.js'));

function StillFallback() {
  return <div className="cr-walkthrough-fallback"><span>Example walkthrough</span><strong>Search. Save. Keep moving.</strong><p>Find a role, check its requirements and keep track of your next step.</p></div>;
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
    <div className="walkthrough-heading"><h2 id="career-walkthrough-heading">Find your next role.<br /><em>Keep your next step clear.</em></h2><p>Search the market, understand the role and keep your job hunt moving in one place.</p></div>
    <figure aria-label="CareerRadar search and tracker walkthrough" aria-describedby="career-demo-description">
      <PreviewBoundary><Suspense fallback={<StillFallback />}>{near ? <Demo /> : <StillFallback />}</Suspense></PreviewBoundary>
    </figure>
  </section>;
}
