import './companyLogoMarquee.css';

const rows = [
  [['OpenAI','openai'],['Stripe','stripe'],['Razorpay','razorpay'],['Notion','notion'],['Figma','figma'],['CRED','cred'],['Anthropic','anthropic'],['Swiggy','swiggy'],['Linear','linear'],['Databricks','databricks'],['Groww','groww'],['Vercel','vercel'],['Perplexity','perplexity'],['Meesho','meesho']],
  [['Airbnb','airbnb'],['Freshworks','freshworks'],['NVIDIA','nvidia'],['Supabase','supabase'],['Spotify','spotify'],['PostHog','posthog'],['Adobe','adobe'],['Cloudflare','cloudflare'],['Paytm','paytm'],['Duolingo','duolingo'],['Salesforce','salesforce'],['Discord','discord'],['Coinbase','coinbase'],['Zapier','zapier']],
] as const;

/** Decorative brand discovery strip. Duplicated groups are hidden from assistive technology. */
export function CompanyLogoMarquee() {
  return <section className="cr-logo-marquee" aria-labelledby="company-marquee-caption">
    <p id="company-marquee-caption">Open jobs from 10,000+ companies, pulled straight from their career pages</p>
    <div className="cr-logo-marquee-viewport" tabIndex={0} aria-label="Company logos; focus or hover to pause both rows">
      {rows.map((companies,row) => <div className="cr-logo-marquee-row" key={row}>
        <div className={`cr-logo-marquee-track${row === 1 ? ' is-reversed' : ''}`}>
          {[0,1].map(copy => <ul className="cr-logo-marquee-group" aria-hidden={copy === 1 ? true : undefined} key={copy}>
            {companies.map(([name,slug]) => <li className="cr-logo-chip" key={slug}>
              <img src={`/brand-logos/${slug}.svg`} width={20} height={20} alt="" loading="lazy" decoding="async" /><span>{name}</span>
            </li>)}
          </ul>)}
        </div>
      </div>)}
    </div>
  </section>;
}
