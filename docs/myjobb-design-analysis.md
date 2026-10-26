# MyJobb teardown: design analysis for Career Radar

## Source and evidence boundary

This analysis is based on the complete 26-page `myjobb.ai Independent analysis / Full Product Teardown`, dated 8 October 2026. The report is the primary source. It distinguishes between public pages and mockups that were seen, onboarding that was completed, and logged-in surfaces that remained behind a mandatory live-application gate.

The report explicitly says that the dashboard, application tracker, inbox tracker, referral interface, cold-email interface, automations canvas, settings, real submissions, and recruiter-open tracking were not live-verified. Public feature pages are therefore treated as intended behavior and design direction, not proof that those features work as shown.

## 1. Strongest patterns identified

### A. A clear emotional promise supported by a concrete product preview

The homepage hero leads with a large serif headline, italic emphasis, a cream background, a bright lime call to action, soft organic imagery, and browser-framed product visuals. The report describes the promise as emotional before technical: the page feels consumer-friendly rather than enterprise-heavy.

The strongest marketing device is the realistic browser frame used in the four-tab “How it works” block. It lets visitors see the intended product architecture instead of asking them to believe an abstract automation claim.

### B. Relevance is shown as evidence, not just asserted

The Matches mockup prioritizes match percentage, “Best match” labels, role, company, and matched-skill chips. The report says the mockup sells relevance rather than volume. This is a strong fit for Career Radar because company discovery should explain why an opportunity is useful, not merely enumerate openings.

### C. Contextual workspaces create a coherent product loop

The public mockups expose Jobs, Resume, Applications, and Inbox Tracker as parts of one product. Resume tailoring and referral discovery are described as inheriting context from the same job object. The report identifies this shared context as a strength: features feel connected instead of like a collection of independent tools.

### D. Visible activity and provenance make automation legible

The Apply mockup shows a timestamped activity panel narrating the agent’s work. Screening answers are labelled “Reasoned” or “From profile,” and the report calls provenance badges a meaningful trust pattern. The matching feature is also described with a deductions ledger rather than an unexplained score.

This is the report’s strongest product pattern: the system exposes what it did, why it did it, and where an answer came from.

### E. Progressive extraction reduces blank-page onboarding

Onboarding begins by parsing a PDF resume or LinkedIn URL, then pre-filling roles, skills, and locations. The user narrows the extracted information through constrained steps: up to three target roles, up to five skill chips, experience, locations, compensation, and other profile details.

The report considers this better than asking the candidate to build a profile from zero. The extracted values remain editable, which preserves user control.

### F. Warm visual system with disciplined contrast

The reported system is playful-modern SaaS: serif display headlines with italic green emphasis; cream and off-white surfaces; deep green contrast sections; bright lime calls to action; rounded cards; soft shadows; and a sunflower-field illustration motif. The report repeatedly notes that lime is used sparingly for momentum and conversion, while deep green supplies authority.

The rendered report pages reinforce this hierarchy: light editorial pages carry most explanatory content, while dark green pages are reserved for high-stakes or high-emphasis moments such as the access gate and final verdict.

## 2. UI elements worth using as inspiration

### Hero and landing page

- A single, emotionally legible headline with a restrained italic accent.
- One primary CTA with strong contrast and a clear action.
- A product preview close to the promise, rather than decorative imagery alone.
- Soft organic imagery as atmosphere, not as the information-bearing layer.
- A floating pill-style navigation treatment, adapted to Career Radar’s own information architecture.

### Product demonstrations

- Browser-framed or device-framed previews that show the actual discovery workflow.
- A tabbed “How it works” section that switches between Discovery, Company Intelligence, Watchlist, and Apply/Source pages.
- Realistic evidence density in mockups: company, role, match explanation, source, and next action.
- A resume-like measurable workspace pattern, adapted to company and job intelligence rather than resume scoring.

### Cards and information hierarchy

- Rounded cards with clear hierarchy and modest shadows.
- Compact chips for matched skills, work modes, verification state, and location.
- Prominent but explainable match signals instead of a decorative percentage.
- Small status labels and timestamps to establish recency and provenance.
- Dark contrast panels for summaries, guardrails, and high-attention decisions.

### Trust and interaction patterns

- An activity ledger for source checks, career-page changes, and watchlist events.
- “From source,” “Observed on,” and “Inferred” labels that make evidence boundaries visible.
- Approval or confirmation gates before consequential actions such as opening an external application URL.
- Empty and loading states that explain what is being checked, not just generic spinners.

### Onboarding

- Resume/profile extraction as an optional accelerator, not a requirement.
- Editable suggestions instead of blank form fields.
- Short steps with visible progress and the ability to skip sensitive or nonessential fields.
- Early value through a sample discovery view or a limited company preview before requesting extensive profile data.

## 3. Weaknesses and friction points to avoid

### Trust is requested before value is demonstrated

The report says the final onboarding step asks for full postal address, gender, disability status, work authorization, compensation, relocation, start date, and a job-inbox password. No “skip for now” path was observed. Career Radar should separate discovery value from sensitive profile enrichment and make optionality explicit.

### The access gate forces a real-world action

The dashboard remained locked until one real application was attempted. The user declined the final submission, so the dashboard and later surfaces could not be inspected. Career Radar should never require an external application merely to preview the product or understand a company match.

### Marketing claims and observed evidence are mixed too easily

The report flags claims such as 500K+ live jobs, 50K+ new jobs per day, 1M+ jobseekers, and hired-at logos as unindependently verified. Career Radar should pair scale or outcome claims with a source, date, scope, and methodology—or omit the claim.

### Navigation hides important access paths

The report notes that the main navigation favors “Get early access” and does not surface a clear Login link. The `/faq` route redirected to the homepage. Career Radar should make sign-in, product overview, sources, and help discoverable, and every promised route should have a meaningful destination.

### Commercial and policy language creates expectation mismatches

The report identifies three incompatible pricing and entitlement presentations, including conflicting cancel, renewal, rollover, and application-limit language. It also notes that “Honest” and “Aggressive” tailoring labels need clearer policy explanation. Career Radar should use one canonical source of truth for limits and plain-language labels for any confidence, automation, or data-use policy.

### Mockup coverage can overstate product maturity

The report explicitly says that public mockups establish intended behavior but do not verify the live inbox, tracker, referral, cold-email, automation, or settings interfaces. Career Radar should label previews as previews and avoid presenting future screens as shipped capability.

### Automation is more prominent than the evidence warrants

The report’s conclusion is “strong enough to test, not clear enough to trust blindly.” For Career Radar, the emphasis should remain on discovery, signals, and explainability. Any later automation should be incremental, bounded, and reversible.

## 4. Adaptation into an original Career Radar identity

| MyJobb pattern | Career Radar adaptation | Boundary to preserve |
| --- | --- | --- |
| Cream / off-white editorial field | Use a warm, quiet base for company intelligence and a distinct Career Radar accent system | Do not copy MyJobb’s exact palette, imagery, or brand treatment |
| Serif headline with italic emphasis | Create an original display typographic voice for “discover what is behind the job title” | Establish our own font pairing and copy style |
| Browser-framed product previews | Show a Career Radar company profile, signal timeline, and source panel in a framed preview | Use original screens, data labels, and layout compositions |
| Match percentages and skill chips | Use evidence-weighted fit summaries with matched skills, location, work mode, and career-stage context | Never let a score replace an explanation or imply unsupported precision |
| Resume / job shared context | Make a company the durable context object linking locations, career sources, jobs, signals, and watchlist activity | Keep company-level facts separate from job-level facts |
| Activity ledger | Show “first seen,” “last checked,” source changes, verification state, and watchlist events | Do not label a job NEW or REMOVED without defensible historical evidence |
| Provenance badges | Add visible source, observation date, verification, and confidence labels | Preserve unknown values instead of guessing |
| Progressive extraction onboarding | Let users start with interests, skills, target cities, or an optional resume and quickly see discovery results | Do not require address, gender, disability, password, or application submission to reach value |
| Contrast panels for high-attention moments | Use a dark panel for “what changed,” “why this matches,” or “review before opening source” | Use contrast to clarify decisions, not to create pressure |
| Tabbed product story | Use sections such as Discover, Signals, Watchlist, and Apply | Avoid copying the exact four-tab IA or visual layout |

The resulting identity should feel like premium career intelligence: calm, evidence-forward, locally relevant to Indian job seekers, and more interested in helping users make a good decision than in automating a consequential action.

## 5. What the report does not establish

- It does not establish responsive behavior across mobile, tablet, and desktop breakpoints. The report contains screenshots and descriptions, but no responsive audit or breakpoint findings.
- It does not establish implementation quality, accessibility, keyboard behavior, screen-reader semantics, or color-contrast compliance.
- It does not establish animation behavior, timing, easing, scroll transitions, hover states, or reduced-motion support. The report describes an Automations canvas and activity states, but does not verify motion design.
- It does not establish the live dashboard, application tracker, inbox tracker, referral interface, cold-email composer, automation canvas, settings, recruiter-open tracking, or real submissions.
- It does not establish that marketing scale claims, security claims, product-stated reply multipliers, or send-time optimization claims are independently valid.
- It does not establish how the product behaves with incomplete, contradictory, stale, or inaccessible job data.
- It does not establish pricing stability; in fact, it documents contradictory public offers.
- It does not establish whether the Google-only sign-in boundary is the final authentication design or whether account recovery and consent flows are adequate.
- It does not establish how users export, correct, delete, or restrict sensitive profile data.
- It does not establish the actual performance of resume parsing, matching, ATS scoring, or career-page monitoring beyond the observed onboarding/test-drive sequence and public claims.

## Design direction for review

Career Radar should borrow the report’s strongest principles—visible evidence, contextual product demonstrations, progressive onboarding, and auditable activity—while reversing its most damaging trust choices. The first frontend should show value before demanding sensitive information, clearly separate observed facts from interpretation, and make company discovery useful even when no job application is initiated.

Frontend implementation should begin only after this analysis is reviewed and the original Career Radar visual direction is approved.
