# 002 — Shorten dashboard chart animation and respect reduced motion

- **Status**: DONE
- **Commit**: 0d6aad3
- **Severity**: MEDIUM
- **Category**: Easing & duration / Accessibility / Purpose & frequency
- **Estimated scope**: 1 file (`src/public/js/charts.js`), JS only

## Problem

`src/views/inicio.ejs` (the app's landing page — the single highest-
frequency view, rendered on every "/" visit) and
`src/views/productividad.ejs` both render Chart.js canvases through the
shared helper in `src/public/js/charts.js`. Neither the helper nor the
call sites pass an `options.animation` config, so every chart uses
Chart.js's built-in default: a 1000ms `easeOutQuart` animation that plays
in full on every single page load. For a dashboard that's opened many
times a day, that's a full second of unnecessary motion on the two most
central widgets ("Tareas por estado", "Horas registradas") standing
between the user and the numbers they came to see. Chart.js also does not
read `prefers-reduced-motion` on its own — nothing in this codebase sets
it, so the reduced-motion preference the rest of the app already honors
(`src/views/partials/styles.ejs:52`) is silently ignored for these two
charts.

Current code, `src/public/js/charts.js:38-47`:

```js
/* src/public/js/charts.js:38 — current */
  if (window.Chart) {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.font.family = "'Poppins','Segoe UI',Arial,sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = palette.muted;
    Chart.defaults.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.backgroundColor = palette.paper;
    Chart.defaults.plugins.tooltip.titleColor = palette.ink;
    Chart.defaults.plugins.tooltip.bodyColor = palette.ink;
    Chart.defaults.plugins.tooltip.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }
```

## Target

Set `Chart.defaults.animation` once, alongside the other global defaults,
to a duration inside the UI budget (modals/drawers band: 200–500ms — a
data visualization reveal is closer to a "drawer" than a "button" in
weight, so 400ms is appropriate) using Chart.js's built-in `easeOutQuart`
easing name (equivalent family to this repo's `--ease-standard`
`cubic-bezier(.2,.8,.2,1)` — both are quart-family ease-outs; Chart.js
options take a named easing string, not a CSS token, so the string name
is the correct repo-equivalent here, not a literal cubic-bezier). When
the user has `prefers-reduced-motion: reduce` set, disable the animation
entirely (`false`) rather than just shortening it — a chart appearing
instantly is not a loss of comprehension the way removing a state
transition would be, so full removal is correct here (contrast with
`AUDIT.md`'s "keep opacity/color, drop movement" guidance, which applies
to transitions that convey a state change; an initial chart render has no
"before" state to lose):

```js
/* target: src/public/js/charts.js — inside the `if (window.Chart)` block */
  if (window.Chart) {
    var prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = prefersReducedMotion
      ? false
      : { duration: 400, easing: "easeOutQuart" };
    Chart.defaults.font.family = "'Poppins','Segoe UI',Arial,sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = palette.muted;
    Chart.defaults.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.backgroundColor = palette.paper;
    Chart.defaults.plugins.tooltip.titleColor = palette.ink;
    Chart.defaults.plugins.tooltip.bodyColor = palette.ink;
    Chart.defaults.plugins.tooltip.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }
```

## Repo conventions to follow

- `src/public/js/charts.js` already sets every visual default once,
  globally, on `Chart.defaults.*` inside this same `if (window.Chart)`
  block (colors, fonts, tooltip styling) rather than repeating options on
  each `new Chart(...)` call in `doughnutByStatus` / `areaSeries` /
  `barByCategory`. Follow that exact pattern — set `Chart.defaults.animation`
  once here, do not add `animation:` options to the individual chart
  configs later in the file.
- The repo's existing reduced-motion check lives in
  `src/views/login.ejs:111`:
  `if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finishSplash();`
  — use the identical `window.matchMedia("(prefers-reduced-motion: reduce)").matches`
  expression for consistency.

## Steps

1. Open `src/public/js/charts.js`. Inside the `if (window.Chart) { ... }`
   block (starts at line 38), add a `var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;`
   statement as the first line inside the block, before
   `Chart.defaults.responsive = true;`.
2. Immediately after the existing `Chart.defaults.maintainAspectRatio = false;`
   line, add:
   `Chart.defaults.animation = prefersReducedMotion ? false : { duration: 400, easing: "easeOutQuart" };`
3. Leave every other line in the block (`Chart.defaults.font.*`,
   `Chart.defaults.color`, `Chart.defaults.borderColor`,
   `Chart.defaults.plugins.tooltip.*`) exactly as-is.

## Boundaries

- Do NOT add an `animation` option inside `doughnutByStatus`,
  `areaSeries`, or `barByCategory`'s per-chart `options` objects — this is
  a global default, set once.
- Do NOT touch `src/views/inicio.ejs` or `src/views/productividad.ejs` —
  they only need the shared helper to behave correctly, no call-site
  changes.
- Do NOT add a listener for `matchMedia(...).addEventListener('change', ...)` —
  this value only needs to be read once at script load (the user would
  need to reload the page to pick up an OS-level reduced-motion change
  anyway, same as the rest of this codebase's reduced-motion checks).
- Do NOT touch `src/public/vendor/chart.js` (the vendored library itself).
- If `window.Chart` is not actually guarded the way shown above when you
  open the file (i.e. the block structure has changed since the commit
  stamp), STOP and report instead of guessing where to insert the lines.

## Verification

- **Mechanical**: `pnpm lint && pnpm typecheck` should pass (plain
  browser JS, no type errors expected). Manually confirm in a terminal
  that `node --check src/public/js/charts.js` reports no syntax errors.
- **Feel check**: run `pnpm dev`, open `http://localhost:3100/` (or
  `/productividad`) with some task data seeded so the charts render:
  - The doughnut and line charts should visibly finish animating in
    well under half a second — noticeably snappier than before, not a
    full one-second draw-in.
  - In DevTools' Rendering panel, enable "Emulate CSS media feature
    prefers-reduced-motion: reduce", hard-reload the page, and confirm
    both charts render with their final values immediately, no animated
    draw-in at all.
  - Turn the emulation back off, hard-reload again, and confirm the
    short animation is back.
- **Done when**: both dashboard charts animate in under ~400ms by
  default, and render instantly (no animation) whenever
  `prefers-reduced-motion: reduce` is active.
