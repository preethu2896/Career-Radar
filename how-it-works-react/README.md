# How It Works — React

Standalone recreation of the scroll-driven "How it works" section.
Two files, no dependencies beyond React:

- `HowItWorks.jsx` — the component (scroll-pin logic via `useEffect` + `requestAnimationFrame`, tab state via `useState`)
- `HowItWorks.css` — all styles, scoped under `.howitworks-root` so it won't leak into your page

## Usage

```jsx
import HowItWorks from "./HowItWorks";

function App() {
  return (
    <>
      {/* your page content above */}
      <HowItWorks />
      {/* your page content below */}
    </>
  );
}
```

Works in Vite, Create React App, and Next.js (it's a client component —
in Next.js App Router add `"use client"` at the top of the file).

## Notes

- The top/bottom `.spacer` divs inside the component are demo-only scroll
  room for the pinned sequence — delete them when embedding in a real page
  (the pin needs ~650vh of scroll travel to feel right, so keep enough
  page height around it).
- Tab switching is driven purely by scroll position inside the pin and is
  fully reversible; clicking a pill smooth-scrolls to that tab's position.
- `prefers-reduced-motion` is respected; mobile stacks the mockup columns.
