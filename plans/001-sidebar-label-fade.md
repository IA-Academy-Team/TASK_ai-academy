# 001 — Fade sidebar labels instead of hard display toggle

- **Status**: DONE
- **Commit**: 0d6aad3
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Cohesion
- **Estimated scope**: 1 file (`src/views/partials/styles.ejs`), CSS only

## Problem

`.sidebar` already animates its own `width` smoothly over `var(--t-base)`
(250ms, `var(--ease)` = `cubic-bezier(.2,.8,.2,1)`) when the user toggles
collapsed/expanded via the `.brand` button
(`src/views/partials/sidebar.ejs:3`, sets `html[data-sidebar]`). But every
text label inside it swaps with `display:none` / `display:block|inline`,
which has no transition — the labels pop in/out instantly while the
container around them is still visibly animating its width. The result:
text appears to "snap" mid-motion instead of participating in the same
move, breaking the single-motion illusion the width transition was trying
to create.

Current code, `src/views/partials/styles.ejs:54-93`:

```css
/* src/views/partials/styles.ejs:54 — current */
.sidebar{width:245px;flex:0 0 245px;background:var(--nav);color:#DED8E2;display:flex;flex-direction:column;padding:24px 16px 18px;position:sticky;top:0;height:100vh;z-index:85;transition:background-color var(--t-base) var(--ease),width var(--t-base) var(--ease)}
.brand{width:100%;padding:2px 11px 22px;display:flex;gap:11px;align-items:center;border-bottom:1px solid rgba(255,255,255,.12);background:transparent;border-left:0;border-right:0;border-top:0;color:inherit;text-align:left;font:inherit}
.brand h2{margin:0;color:white;font-size:16px}
.navlabel{display:block;color:#7E98A0;font-size:10px;font-weight:760;text-transform:uppercase;letter-spacing:.08em;padding:9px 13px 5px}
.sidebar-user-name{color:white;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (min-width:751px){
  .sidebar{width:72px;flex:0 0 72px;padding:22px 10px 16px;align-items:center}
  .brand{padding:0 0 18px;justify-content:center}
  .brand h2{display:none}
  .navgroup{width:100%}
  .navlabel{display:none}
  .navbtn{justify-content:center;position:relative}
  .navbtn-label{display:none}
  .navcount{position:absolute;top:2px;right:6px;margin-left:0;padding:1px 5px;font-size:9px}
  .sidebar-user{position:relative;justify-content:center;gap:0;padding:9px 0 13px}
  .sidebar-user-name{display:none}
  html[data-sidebar="expanded"] .sidebar{width:245px;flex:0 0 245px;padding:24px 16px 18px;align-items:stretch}
  html[data-sidebar="expanded"] .brand{padding:2px 11px 22px;justify-content:flex-start}
  html[data-sidebar="expanded"] .brand h2{display:block}
  html[data-sidebar="expanded"] .navgroup{width:auto}
  html[data-sidebar="expanded"] .navlabel{display:block}
  html[data-sidebar="expanded"] .navbtn{justify-content:flex-start;position:static}
  html[data-sidebar="expanded"] .navbtn-label{display:inline}
  html[data-sidebar="expanded"] .navcount{position:static;margin-left:auto;padding:2px 7px;font-size:10px}
  html[data-sidebar="expanded"] .sidebar-user{position:static;justify-content:flex-start;gap:10px;padding:9px 13px 13px}
  html[data-sidebar="expanded"] .sidebar-user-name{display:block}
}
```

## Target

Replace the four `display:none ↔ display:block|inline` label toggles
(`.brand h2`, `.navlabel`, `.navbtn-label`, `.sidebar-user-name`) with an
`opacity` fade that is desynced from the width transition: labels fade
**out** fast at the start of a collapse (so they don't get visually
squeezed as the sidebar narrows) and fade **in** only after the width
transition has mostly finished expanding (so text doesn't render into a
too-narrow box). Everything else (layout, `justify-content`,
`position`/`navcount` rules) stays exactly as-is — those are not motion
properties and are out of scope.

Base rules (outside the media query) gain a transition and a default
(collapsed-safe) opacity — they must still default to fully visible for
users below the 751px breakpoint, where the sidebar is never collapsed:

```css
/* target: src/views/partials/styles.ejs — add transition, keep base opacity:1 */
.brand h2{margin:0;color:white;font-size:16px;opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)}
.navlabel{display:block;color:#7E98A0;font-size:10px;font-weight:760;text-transform:uppercase;letter-spacing:.08em;padding:9px 13px 5px;opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)}
.navbtn-label{opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)}
.sidebar-user-name{color:white;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)}
```

Inside `@media (min-width:751px){ ... }`, the collapsed (default) state
swaps `display:none` for `opacity:0` + `pointer-events:none` (keep
`display` at its normal value so layout doesn't change, the element is
just invisible and non-interactive — this is intentional, it is what makes
the fade possible):

```css
/* target: collapsed state inside the 751px+ media query */
.brand h2{opacity:0;pointer-events:none;transition-delay:0s}
.navlabel{opacity:0;pointer-events:none;transition-delay:0s}
.navbtn-label{opacity:0;pointer-events:none;transition-delay:0s}
.sidebar-user-name{opacity:0;pointer-events:none;transition-delay:0s}
```

And the `html[data-sidebar="expanded"]` overrides swap `display:block` /
`display:inline` for `opacity:1` with a delay so the fade-in starts only
once most of the width animation has played out:

```css
/* target: expanded overrides inside the 751px+ media query */
html[data-sidebar="expanded"] .brand h2{opacity:1;pointer-events:auto;transition-delay:120ms}
html[data-sidebar="expanded"] .navlabel{opacity:1;pointer-events:auto;transition-delay:120ms}
html[data-sidebar="expanded"] .navbtn-label{opacity:1;pointer-events:auto;transition-delay:120ms}
html[data-sidebar="expanded"] .sidebar-user-name{opacity:1;pointer-events:auto;transition-delay:120ms}
```

## Repo conventions to follow

- Easing/duration are always referenced through tokens, never hand-typed:
  `var(--duration-fast)` (150ms) and `var(--ease-standard)` (`cubic-bezier(.2,.8,.2,1)`),
  both defined at `src/views/partials/styles.ejs:17`. Do not introduce new
  tokens for this fix.
- The repo already fades/transitions things that change visibility rather
  than hard-toggling them — see `.drawer-backdrop` and `.modal-backdrop`
  at `src/views/partials/styles.ejs:192` and `:225`, which transition
  `opacity` instead of toggling `display`. Follow that same pattern here.
- The global reduced-motion rule at `src/views/partials/styles.ejs:52`
  already collapses all `transition-duration`/`animation-duration` to
  `.01ms` — no extra reduced-motion handling is needed in this plan, the
  existing global rule covers it.

## Steps

1. In `src/views/partials/styles.ejs`, on the base `.brand h2` rule
   (currently line 57), add `opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)`
   to the existing declaration block (do not remove any existing
   property).
2. On the base `.navlabel` rule (currently line 64), add the same
   `opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)`.
3. Find the `.navbtn-label` selector — it currently has no base rule of
   its own (only `display:none`/`display:inline` inside the media query).
   Add a new base rule right before the `@media (min-width:751px){` block:
   `.navbtn-label{opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)}`.
4. On the base `.sidebar-user-name` rule (currently line 68), add
   `opacity:1;transition:opacity var(--duration-fast) var(--ease-standard)`.
5. Inside `@media (min-width:751px){`, replace `.brand h2{display:none}`
   (currently line 73) with
   `.brand h2{opacity:0;pointer-events:none;transition-delay:0s}`.
6. Replace `.navlabel{display:none}` (currently line 75) with
   `.navlabel{opacity:0;pointer-events:none;transition-delay:0s}`.
7. Replace `.navbtn-label{display:none}` (currently line 77) with
   `.navbtn-label{opacity:0;pointer-events:none;transition-delay:0s}`.
8. Replace `.sidebar-user-name{display:none}` (currently line 80) with
   `.sidebar-user-name{opacity:0;pointer-events:none;transition-delay:0s}`.
9. Replace `html[data-sidebar="expanded"] .brand h2{display:block}`
   (currently line 84) with
   `html[data-sidebar="expanded"] .brand h2{opacity:1;pointer-events:auto;transition-delay:120ms}`.
10. Replace `html[data-sidebar="expanded"] .navlabel{display:block}`
    (currently line 86) with
    `html[data-sidebar="expanded"] .navlabel{opacity:1;pointer-events:auto;transition-delay:120ms}`.
11. Replace `html[data-sidebar="expanded"] .navbtn-label{display:inline}`
    (currently line 88) with
    `html[data-sidebar="expanded"] .navbtn-label{opacity:1;pointer-events:auto;transition-delay:120ms}`.
12. Replace `html[data-sidebar="expanded"] .sidebar-user-name{display:block}`
    (currently line 91) with
    `html[data-sidebar="expanded"] .sidebar-user-name{opacity:1;pointer-events:auto;transition-delay:120ms}`.

## Boundaries

- Do NOT touch `.navgroup`, `.navbtn`, `.navcount`, `.sidebar-user`,
  `justify-content`, `position`, or any other non-opacity/non-transition
  property on these selectors — the realignment of icons when
  `justify-content` flips is a separate layout concern, not part of this
  finding.
- Do NOT touch the `<751px` (mobile `.open` drawer) sidebar rules at
  `src/views/partials/styles.ejs:302` — that's a different interaction
  (off-canvas slide-in) and out of scope.
- Do NOT touch `src/views/partials/sidebar.ejs` — the toggle logic (which
  sets `data-sidebar` and `localStorage`) does not need to change.
- Do NOT add new CSS custom properties or new duration/easing values —
  reuse `var(--duration-fast)` / `var(--ease-standard)` exactly.
- If the line numbers cited above have drifted from what's actually in
  the file (i.e. the surrounding selectors don't match), STOP and report
  instead of guessing which rule to edit.

## Verification

- **Mechanical**: `pnpm lint && pnpm typecheck` — this is a CSS-only
  change inside an `.ejs` partial, both should pass unaffected.
- **Feel check**: run `pnpm dev`, log in, and on a desktop-width viewport
  (>751px) click the "Expandir o contraer el menú" brand button
  repeatedly:
  - Collapsing: labels should fade out immediately as the sidebar starts
    narrowing, not remain legible and then vanish partway through.
  - Expanding: labels should stay invisible while the sidebar is still
    visibly widening, then fade in over the final ~130ms once the width
    is close to its final 245px — no text rendering cramped into a
    half-width sidebar.
  - Click the toggle rapidly several times in a row — the fade must never
    restart from a hard pop; because this uses CSS transitions (not
    `@keyframes`), interrupting mid-fade should retarget smoothly from
    the current opacity.
  - In DevTools' Rendering panel, enable "Emulate CSS media feature
    prefers-reduced-motion: reduce" and confirm the labels now appear/
    disappear near-instantly (the global `.01ms` override from
    `styles.ejs:52` applies) with no visible transition.
- **Done when**: toggling the sidebar never shows label text popping in
  or out while the surrounding width animation is still visibly mid-flight,
  and no other sidebar layout behavior (icon centering, tooltips on hover,
  `navcount` badge position) has changed.
