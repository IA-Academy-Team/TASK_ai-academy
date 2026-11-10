# 004 — Draw the progress ring in instead of painting it static

- **Status**: DONE
- **Commit**: 0d6aad3
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (`src/views/partials/progress-ring.ejs`),
  CSS + inline SVG attribute change

## Problem

`src/views/partials/progress-ring.ejs` renders a circular progress
indicator with a `stroke-dasharray`/`stroke-dashoffset` SVG trick — the
exact same mechanism the codebase already uses, and already *animates*,
for the small checkmark badge:
`.badge-check{…stroke-dasharray:16;stroke-dashoffset:16;animation:checkdraw 300ms var(--ease) 150ms forwards}`
/ `@keyframes checkdraw{from{stroke-dashoffset:16}to{stroke-dashoffset:0}}`
(`src/views/partials/styles.ejs:50-51`). The progress ring's foreground
circle sets `stroke-dashoffset` straight to its final computed value with
no animation at all, so it paints as a fully-formed static arc on first
render — a missed opportunity to use a pattern this exact codebase
already has, on a component (task/project completion %) that appears
repeatedly across dashboards and detail pages.

Current code, `src/views/partials/progress-ring.ejs:1-9`:

```ejs
<!-- src/views/partials/progress-ring.ejs — current -->
<% var ringSize = typeof size !== 'undefined' ? size : 36; %>
<% var r = 16; var circumference = 2 * Math.PI * r; %>
<% var offset = (circumference * (1 - Math.max(0, Math.min(100, pct)) / 100)).toFixed(2); %>
<svg class="progress-ring" viewBox="0 0 40 40" width="<%= ringSize %>" height="<%= ringSize %>" role="img" aria-label="<%= pct %>% completado">
  <circle cx="20" cy="20" r="<%= r %>" fill="none" stroke="var(--line)" stroke-width="4" />
  <circle cx="20" cy="20" r="<%= r %>" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" transform="rotate(-90 20 20)" stroke-dasharray="<%= circumference.toFixed(2) %>" stroke-dashoffset="<%= offset %>" />
  <text x="20" y="23.5" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)"><%= pct %>%</text>
</svg>
```

## Target

Give the foreground circle a class, drive its start/end dash-offset
through two inline CSS custom properties (`--ring-start` = full
circumference, i.e. empty ring; `--ring-end` = the already-computed
`offset`, i.e. the real percentage), and animate between them with a new
`@keyframes ringdraw`, timed like `checkdraw` (300ms, `var(--ease)`, a
small start delay so it reads as a deliberate reveal rather than
competing with whatever entrance the card around it is doing):

```ejs
<!-- target: src/views/partials/progress-ring.ejs -->
<% var ringSize = typeof size !== 'undefined' ? size : 36; %>
<% var r = 16; var circumference = 2 * Math.PI * r; %>
<% var offset = (circumference * (1 - Math.max(0, Math.min(100, pct)) / 100)).toFixed(2); %>
<svg class="progress-ring" viewBox="0 0 40 40" width="<%= ringSize %>" height="<%= ringSize %>" role="img" aria-label="<%= pct %>% completado">
  <circle cx="20" cy="20" r="<%= r %>" fill="none" stroke="var(--line)" stroke-width="4" />
  <circle class="progress-ring-fill" cx="20" cy="20" r="<%= r %>" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" transform="rotate(-90 20 20)" stroke-dasharray="<%= circumference.toFixed(2) %>" stroke-dashoffset="<%= offset %>" style="--ring-start:<%= circumference.toFixed(2) %>;--ring-end:<%= offset %>" />
  <text x="20" y="23.5" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)"><%= pct %>%</text>
</svg>
```

```css
/* target: src/views/partials/styles.ejs — add near .badge-check / @keyframes checkdraw (around line 50-51) */
.progress-ring-fill{animation:ringdraw 500ms var(--ease) 100ms backwards}
@keyframes ringdraw{from{stroke-dashoffset:var(--ring-start)}to{stroke-dashoffset:var(--ring-end)}}
```

Note the inline `stroke-dashoffset="<%= offset %>"` attribute on the
circle stays exactly as it is today — it is the no-JS/no-CSS-animation
fallback value (and the value a crawler or a reduced-motion user with the
animation suppressed will simply see immediately). The animation only
ever moves the paint *from* the full circumference *to* that same
already-correct value.

## Repo conventions to follow

- Easing/duration tokens from `src/views/partials/styles.ejs:17` —
  reuse `var(--ease)` (alias of `var(--ease-standard)`), same as
  `checkdraw`'s own `300ms var(--ease) 150ms forwards`.
- Exemplar to imitate exactly: `.badge-check` /
  `@keyframes checkdraw` at `src/views/partials/styles.ejs:50-51` — same
  stroke-dashoffset draw-in technique, same token usage, same
  `forwards`/`backwards` fill-mode idiom (`checkdraw` uses `forwards`
  because it starts at its base CSS value and must hold the end state;
  this ring uses `backwards` because the element's own inline
  `stroke-dashoffset` attribute already holds the end state, and
  `animation-fill-mode:backwards` is what makes the animation apply its
  `from` value before the delay/start instead of flashing the final
  value first).
- New CSS keyframes/rules belong in `src/views/partials/styles.ejs`,
  the single shared stylesheet — not a new `<style>` block in the
  partial itself (no other `.ejs` partial in this repo defines its own
  `<style>` block; `src/views/partials/progress-ring.ejs` has none today
  and should not gain one).

## Steps

1. In `src/views/partials/progress-ring.ejs`, add `class="progress-ring-fill"`
   and `style="--ring-start:<%= circumference.toFixed(2) %>;--ring-end:<%= offset %>"`
   to the second `<circle>` element (the one with `stroke="var(--accent)"`),
   leaving every existing attribute on it (`stroke-dasharray`,
   `stroke-dashoffset`, `transform`, etc.) exactly as they are.
2. In `src/views/partials/styles.ejs`, immediately after the existing
   `.badge-check{…}` rule and its `@keyframes checkdraw{…}` (currently
   lines 50-51), add:
   ```css
   .progress-ring-fill{animation:ringdraw 500ms var(--ease) 100ms backwards}
   @keyframes ringdraw{from{stroke-dashoffset:var(--ring-start)}to{stroke-dashoffset:var(--ring-end)}}
   ```

## Boundaries

- Do NOT change the `circumference`/`offset` calculation logic in the
  `<% %>` block — only add the `class` and `style` attributes to the
  existing circle.
- Do NOT remove or alter the existing `stroke-dashoffset="<%= offset %>"`
  attribute — it must stay as the fallback/final value.
- Do NOT touch the background track circle (the first `<circle>`, with
  `stroke="var(--line)"`) — it has no dash pattern and nothing to
  animate.
- Do NOT touch any caller of this partial (`inicio.ejs`, task/project
  detail views, etc.) — this change is fully self-contained to the
  partial plus the shared stylesheet.
- If `progress-ring.ejs` no longer matches the 9-line structure shown
  above when you open it (i.e. it has drifted since the commit stamp),
  STOP and report instead of guessing where to add the attributes.

## Verification

- **Mechanical**: `pnpm lint && pnpm typecheck` should pass (EJS +
  inline SVG attributes, no TypeScript surface touched).
- **Feel check**: run `pnpm dev`, open any page that renders a progress
  ring with a non-zero, non-100 percentage (e.g. a project or task detail
  view with partial completion), and:
  - Confirm the colored arc now visibly sweeps in from empty to its
    final percentage shortly after the page paints, instead of
    appearing fully drawn immediately.
  - Reload a couple of times and confirm the arc always lands at the
    exact same final position as before this change (same `pct`, same
    stopping point) — only the reveal is new, the end state must be
    pixel-identical to the pre-change static render.
  - Check a ring at 0% and a ring at 100% specifically — both should
    still animate (from full circumference to their respective offset)
    without visual glitches (no arc briefly overshooting past 100% or
    flashing a wrong color).
  - In DevTools' Rendering panel, enable
    "prefers-reduced-motion: reduce" and confirm the ring now renders
    directly at its final value (duration collapsed to near-zero by the
    existing global rule at `src/views/partials/styles.ejs:52`), with no
    visible sweep.
- **Done when**: every progress ring draws in on first paint and settles
  at the exact same final arc it rendered statically before this change.
