import type{ReactNode}from'react';
export type HelpGroup={id:string;title:string;questions:Array<{id:string;question:string;answer:ReactNode}>};
export const helpGroups:HelpGroup[]=[
 {id:'finding-jobs',title:'Finding jobs and companies',questions:[
  {id:'job-sources',question:'Where do the jobs come from?',answer:<p>CareerRadar lists sourced roles from employer career pages and applicant tracking systems, including Greenhouse, Lever and Ashby. We do not create vacancies. Role details show the last source-check date when available.</p>},
  {id:'country-coverage',question:'Is CareerRadar only for jobs in India?',answer:<p>No. CareerRadar is operated from India and lists jobs from multiple countries. Use location and workplace filters, then check the employer’s requirements. A remote label does not necessarily mean the job is available worldwide.</p>},
  {id:'company-hiring',question:'Does every company in the directory have open jobs?',answer:<p>No. Company research and verified openings are separate. A company can appear in the directory without current verified listings. Its detail page shows open roles only when we have them.</p>},
  {id:'closed-role',question:'Why is a role missing, closed or waiting for a fresh check?',answer:<p>Employers can close or change roles between checks. CareerRadar excludes records that fail its current-source checks and may withhold an application link until the source is checked again. The employer’s posting is the final place to confirm availability.</p>},
  {id:'search-jobs',question:'How do I narrow my search?',answer:<p>Use the existing <a href="/jobs">Jobs filters</a> to search for a title, company or skill, then refine location, workplace, experience or posting date. Remove individual filters or use Reset if there are no matches.</p>},
 ]},
 {id:'applying',title:'Applying and free unlocks',questions:[
  {id:'free-unlocks',question:'What do the three free apply unlocks include?',answer:<p>A free account can unlock application links for three different jobs. Reopening an already unlocked role does not use another unlock. You can check your remaining allowance in <a href="/settings#settings-subscription">Subscription settings</a>.</p>},
  {id:'submit-application',question:'Does unlocking or opening a link apply for me?',answer:<p>No. You complete and submit your application on the employer’s career portal or ATS website. Opening the link does not submit an application. Mark a role as applied in your tracker only after you actually submit it.</p>},
  {id:'career-links',question:'Why are company careers links locked?',answer:<p>Company career-page links require Pro access. Signing in alone does not unlock them. Pro checkout is not enabled yet; see <a href="/pricing">Pricing</a> for the current availability of plans.</p>},
  {id:'no-guarantee',question:'Does CareerRadar provide referrals or guarantee an interview?',answer:<p>No. CareerRadar helps you discover and organise opportunities. It does not recruit on an employer’s behalf or guarantee an interview, referral or job. Referrals and hiring contacts are coming soon and are not available to unlock.</p>},
 ]},
 {id:'account-access',title:'Account and sign-in',questions:[
  {id:'forgot-password',question:'I cannot sign in. What should I try?',answer:<p>Check that you are using the same email and sign-in method as before. If your account uses a password, use <a href="/forgot-password">Forgot password</a> and enter the verification code sent to that email. For Google sign-in, use Continue with Google with the original Google account.</p>},
  {id:'profile-optional',question:'Do I need a résumé or career preferences to use CareerRadar?',answer:<p>No. Profile details, preferences and résumé upload are optional. You can browse, use your free apply unlocks, save roles and track applications without uploading a résumé.</p>},
  {id:'account-controls',question:'Where can I change my password or delete my account?',answer:<p>Open <a href="/settings">Settings</a>. Password accounts can change their password there. Account deletion requires your sign-in email and an explicit DELETE confirmation and removes your active private profile, résumé, saved companies, tracker and sign-in account.</p>},
 ]},
 {id:'saving-progress',title:'Saved roles, companies and tracker',questions:[
  {id:'dashboard-tracker',question:'How are Dashboard and Tracker different?',answer:<p>Your <a href="/dashboard">Dashboard</a> summarises saved roles, application stages, followed companies and recent tracker updates. Your <a href="/tracker">Tracker</a> is where you add roles, change stages, record application dates and save private notes.</p>},
  {id:'manual-tracking',question:'Can I track a role I found on another website?',answer:<p>Yes. Choose Add a role in your tracker, enter the company and role, and optionally add the original link. This creates a private record for you; it does not publish a job on CareerRadar.</p>},
  {id:'saved-companies',question:'How do I follow a company?',answer:<p>Open a company detail page and choose Save company. It appears under Followed companies on your dashboard. You can also use Saved companies in the <a href="/companies?saved=1">company directory</a>. Saving a company does not subscribe you to emails.</p>},
 ]},
 {id:'resume-privacy',title:'Résumé and privacy',questions:[
  {id:'private-resume',question:'Who can see my résumé and tracker notes?',answer:<p>They are private account data and are not published to other job seekers, employers or referrers. Authorised administrators and service providers may access data as needed to operate and support the service. See the <a href="/privacy">Privacy Policy</a> for details.</p>},
  {id:'resume-file',question:'Which résumé files can I upload?',answer:<p>Upload a valid PDF up to 5 MB from <a href="/profile#profile-resume">Profile</a>. You can download, replace or remove the stored file there. Removing the file does not delete separately saved profile fields.</p>},
 ]},
 {id:'plans-alerts',title:'Plans, emails and support',questions:[
  {id:'buy-plan',question:'Can I buy a subscription now?',answer:<p>No. Checkout and subscription purchases are not enabled. CareerRadar is not collecting payments or automatically renewing subscriptions. Future checkout will show prices, access periods and the applicable cancellation and refund terms before payment.</p>},
  {id:'email-alerts',question:'Why am I not receiving job alerts?',answer:<p>Job and followed-company email alerts are coming soon. The product-update checkbox in Settings stores a preference for future product emails; it does not create a job alert, and product-update emails are not being sent yet. Sign-in verification emails are separate.</p>},
  {id:'contact-support',question:'How can I contact CareerRadar?',answer:<p>The support email is intentionally pending until the domain is set up. The <a href="/contact">Contact page</a> shows its current availability and links to the self-service account controls.</p>},
 ]},
];
