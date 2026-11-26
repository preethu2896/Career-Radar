export const POLICY_VERSION = "2026-10-29";
const configuredEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() ?? "";
const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : "";
export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const privacy = kind === "privacy";
  return <main className="dashboard-page"><article className="dashboard-content" style={{ maxWidth: 800, lineHeight: 1.7 }}>
    <h1>{privacy ? "Privacy Policy" : "Terms of Service"}</h1><p>Version: 29 October 2026 · Career Radar · Karnataka, India.</p>
    {!supportEmail ? <p className="auth-form-error" role="status">Preview policy: the support and privacy contact has not been configured yet. These pages must be completed before public onboarding or paid service begins.</p> : null}
    {privacy ? <>
      <h2>What we collect and why</h2><p>We collect your account email and name to provide sign-in. Profile details you enter or confirm can include phone, location, roles, skills, experience, salary preferences, availability and profile links. We use these details for profile setup and career discovery.</p>
      <p>If you agree to upload a PDF, we store the file, its name and size, your account identifier, upload time and the version and time of your storage consent. We use the PDF for profile setup and manual CV review. Do not include Aadhaar, PAN, bank details or other unnecessary sensitive information.</p>
      <h2>Resume parsing and LinkedIn</h2><p>PDF text is read in your browser to suggest fields for you to review. Suggestions can be incomplete or incorrect. Scanned PDFs do not receive automatic text recognition. A LinkedIn URL is a profile reference; the site does not log into LinkedIn or import your profile from that link.</p>
      <h2>Storage and access</h2><p>Clerk provides account authentication. Supabase provides the database and private file storage. Your PDF is not published through a public URL. Your account can retrieve or remove it; The Career Radar administrator can access it through administrative tools for review and support. No employee or employer sharing is performed by this website. A future referral flow will need separate, specific sharing consent.</p>
      <p>The browser stores your sign-in session and an account-specific onboarding draft that expires after 24 hours. Personal draft fields are held in tab session storage; the persistent draft retains career preferences without contact details, names or profile links. Signing out clears both draft stores. The application does not add advertising trackers or send resumes to an external AI model.</p>
      <h2>Retention and removal</h2><p>Your saved PDF is kept until you remove it or replace it. You can download or remove it in onboarding or on your dashboard. Removal deletes stored PDF versions; extracted profile fields and your account remain. Provider backups and operational logs may follow separate retention schedules; immediate erasure from backups is not promised.</p>
      <p>Profile details remain while your account is retained. Contact us to request access, correction, account deletion or to withdraw consent for further review. We may need to verify account ownership. A self-service account-deletion flow is not currently available.</p>
      <h2>Changes</h2><p>We will update this notice when the data we collect or its use changes. New uses or sharing will be explained before asking for the relevant consent.</p>
    </> : <>
      <h2>Current service</h2><p>Career Radar is an early-stage career discovery and profile-setup service. Company records and illustrative previews do not establish that a vacancy is live, suitable for a fresher or available for referral. Check the original employer source before applying.</p>
      <h2>Your responsibilities</h2><p>Use your own account and provide information you are entitled to share. Review extracted resume suggestions before saving. Do not impersonate another person, submit fabricated qualifications, misuse another person's information or attempt unauthorised access.</p>
      <h2>No hiring guarantee</h2><p>Career Radar does not guarantee a referral, interview, employer response or job. Employees and employers make their own decisions. Listing a company does not imply a partnership or endorsement.</p>
      <h2>Free service and future paid features</h2><p>Browsing, profile setup and application tracking are currently free. There is no paid referral or recruitment-coordination service. Any future paid features, price and cancellation or refund terms will be explained before checkout.</p>
      <h2>Availability and corrections</h2><p>This early version may contain errors or interruptions. Report problems through the contact below. Nothing in these terms removes rights that cannot lawfully be excluded.</p>
    </>}
    <h2>Contact and privacy requests</h2>{supportEmail ? <p>Contact Career Radar at <a href={"mailto:" + supportEmail}>{supportEmail}</a> for support, correction, deletion or privacy concerns.</p> : <p>A working contact address is pending. No email address has been invented for this preview.</p>}
    <p><a href="/">Back to Career Radar</a></p>
  </article></main>;
}
