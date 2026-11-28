import './publicFooter.css';
export const publicFooterLinks=[['/connect','Use with AI'],['/about','About'],['/pricing','Pricing'],['/help','Help / FAQ'],['/contact','Contact'],['/privacy','Privacy'],['/terms','Terms'],['/refund-policy','Refund Policy']] as const;
export function PublicFooter(){return <footer className="sf-footer cr-public-footer"><a className="auth-logo" href="/">career<span>radar</span></a><p>A clearer route to your next opportunity.</p><nav aria-label="Footer">{publicFooterLinks.map(([href,label])=><a href={href} key={href}>{label}</a>)}</nav></footer>;}
