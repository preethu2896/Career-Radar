# Rehearsal: CareerRadar landing walkthrough

Gold: Stageshow 1.1.1 `examples/hero-demo`. Copied that example before adapting its measured targets, Stage/script structure, browser frame, bottom bleed and compact layout. Replaced its annotation/terminal story with CareerRadar's existing search, requirements, save and manually maintained application tracker. Uses the existing logo, DM Sans / Instrument Serif, cream surfaces and green accent.

Beats: search Frontend Developer → select Bengaluru → read requirements → save → open tracker → manually select Preparing, then Applied. Plays once on visibility, holds its result, and has explicit replay and a still alternative. Reduced motion selects the completed tracker poster. The compact composition uses a readable mobile web card instead of a scaled desktop screenshot.

Captured: desktop and mobile state sheets, opening/filtered/requirements/saved/tracker/preparing/applied states; integrated Chrome views at 1440, 768, 390 and 360 CSS pixels. Checked replay, still/play, reduced-motion changes and horizontal overflow. Touch input was emulated for phone widths.

Gate: `rehearsal passed (necessary, not sufficient: references/verify.md and the fresh eye in review.md still stand)` on desktop and mobile state sheets. The recorder also reports sampling gaps, so its continuous-motion coverage is **inconclusive**; this is not a claim that every animation frame passed an automated scan.

Film: mobile desktop-window proportion fault → replaced with a compact web-card composition; clipped action/frame edges → adjusted padding, reading space and crop; row title/subtitle spacing → explicit row line-height tokens; icon replacement → retained States transition. Remaining non-gate candidates include badge text's intentional pill inset, typed-field width changes and fractional glyph alignment. No detector checks were disabled. Sampling artifacts do not prove the absence of one-frame issues.

Review: independent fresh-eye pass found excess mobile whitespace, unused desktop space beside the tracker and a clipped changing badge. Responses: tightened mobile stage, expanded desktop tracker to available width, removed the redundant changing badge while retaining the stage selector. Added a separate Saved tracker capture mark.

Assumptions: examples are illustrative, not live vacancies. Applying happens on the employer's website; CareerRadar does not submit an application. No database, authentication, entitlement, payment or contact calls are made by the preview.

Performance: lazy-loaded near the section; runtime dependency subset only, no filming tools shipped, no additional npm packages. Playback stops when offscreen/hidden and a completed once scene holds rather than looping endlessly. Existing MIT license retained with vendored runtime.

Not checked: physical iPhone/Safari, Firefox, live private accounts, or real applications. This change does not address the existing catalogue provider quota block. Existing build warnings about the main bundle and mixed auth imports are outside this preview's scope.
