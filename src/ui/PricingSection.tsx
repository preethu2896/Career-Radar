import { ArrowRight, Check } from 'lucide-react';
import './pricingSection.css';

export const membershipPlans = [
  { name: 'Daily', price: '1', period: 'day', description: 'For a focused day of applying.', duration: '24 hours of access' },
  { name: 'Weekly', price: '2.50', period: 'week', description: 'For a short, active search.', duration: '7 days of access' },
  { name: 'Monthly', price: '9', period: 'month', description: 'For a longer job search.', duration: '30 days of access' },
] as const;

export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2';
  return <section id="pricing" className="cr-membership" aria-labelledby="membership-heading">
    <div className="cr-membership-intro"><Heading id="membership-heading">One membership.<br /><em>Your whole job search.</em></Heading><p>Explore for free. Choose the time you need for direct access to employer application links.</p></div>
    <p className="cr-membership-free"><strong>Free to explore — $0.</strong> Browse jobs and companies, read role details and get 3 free apply unlocks when you create an account. <a href="/signup">Start free <ArrowRight size={14} /></a></p>
    <div className="cr-membership-grid">{membershipPlans.map(plan => <article className={`cr-membership-card${plan.name === 'Monthly' ? ' is-featured' : ''}`} key={plan.name}>
      <div className="cr-membership-card-heading"><h3>{plan.name}</h3>{plan.name === 'Monthly' && <span>Best value</span>}</div>
      <p className="cr-membership-price"><span>${plan.price}</span><small>/{plan.period}</small></p>
      <p className="cr-membership-description">{plan.description}</p>
      <ul>{[plan.duration,'Direct job-application links','Company careers-page access','Everything in the free account'].map(feature=><li key={feature}><Check size={16} aria-hidden="true"/><span>{feature}</span></li>)}</ul>
      <span className="cr-membership-availability">Purchases coming soon</span>
    </article>)}</div>
    <p className="cr-membership-note">Proposed prices in USD. Checkout is not open and no payment is collected. All three plans include the same features; the access period changes.</p>
    <p className="cr-membership-coming">Contacts and referrals are coming soon.</p>
  </section>;
}
