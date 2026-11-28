# Rehearsal: CareerRadar apply workflow

Built from the previously rehearsed Stageshow 1.1.1 hero-demo adaptation, retaining measured targets, responsive frames, CareerRadar fonts/colours and MIT runtime license.

Story: search jobs / explore companies → read role → get application link → continue on employer’s career portal. The portal form stays empty; the animation does not submit an application. No login, signup, plan, subscription, pricing, free-unlock count, tracking, preview/example banner, explanatory footer, replay or still control is presented.

Playback: loops while visible. The scene body fades at the reset while the header remains anchored; state and pointer reset behind that fade. Cursor starts and ends on the same measured rest target. Reduced-motion preference displays the completed employer handoff as a still. Lazy loading and offscreen/hidden-tab playback management are retained.

Checks: TypeScript and API smoke checks; production frontend build; integrated Chrome responsive checks at 1440, 768, 390 and 360px, no page errors or horizontal overflow. Mobile rehearsal state sheet ended `rehearsal passed`. The recorder reported sampling gaps, so continuous frame-by-frame motion coverage remains inconclusive. A cursor loop-seam warning was corrected by using the measured rest target at both ends; the handoff link retains its transform layer. No detector checks were disabled.

Runtime scope: an authored product illustration, with no database writes, authentication requests, purchases, entitlement changes or external application submissions. Actual access rules and pricing pages are unchanged. No new npm dependency.

Not checked: physical Safari/iPhone, Firefox, actual signup/payment or real employer application submissions. Those flows are outside this visual change.
