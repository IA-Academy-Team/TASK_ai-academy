# 003 — Animate support-request toast dismissal instead of hard remove()

- **Status**: DONE
- **Commit**: 0d6aad3
- **Severity**: MEDIUM
- **Category**: Interruptibility / Missed opportunities
- **Estimated scope**: 2 files (`src/views/partials/sidebar.ejs`,
  `src/views/partials/styles.ejs`), CSS + small JS change

## Problem

The support-request toast (pushed live over SSE in
`src/views/partials/sidebar.ejs`) enters with a proper animation —
`.toast-alert` plays `toast-in` (`opacity`+`translateY`, 250ms,
`var(--ease)`) — but every exit path calls the DOM's bare `.remove()`
with no animation at all: the manual close button, and the 12-second
auto-dismiss timer. The toast simply disappears on the frame `.remove()`
runs, and because `#toast-stack` is a normal flow container, any toast
below it instantly jumps up to fill the gap. An element that animates in
but teleports out (and shoves its siblings when it does) is an
asymmetric, jarring exit on exactly the kind of transient, occasional UI
(`AUDIT.md` category 4) that should feel symmetric with its own entrance.

Current code, `src/views/partials/sidebar.ejs` (inside the toast script
block):

```js
/* src/views/partials/sidebar.ejs:72 — current */
    close.onclick = function () { toast.remove(); };
```

```js
/* src/views/partials/sidebar.ejs:90 — current */
    getToastStack().appendChild(toast);
    setTimeout(function () { toast.remove(); }, 12000);
```

```css
/* src/views/partials/styles.ejs:254,260 — current */
.toast-alert{position:relative;background:var(--paper);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-2);padding:14px 36px 14px 16px;animation:toast-in var(--t-base) var(--ease)}
@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
```

## Target

Add a `.toast-alert.leaving` state that fades/slides out using a CSS
*transition* (not a second `@keyframes`, so a rapid double-dismiss — e.g.
click close right as the 12s timer also fires — simply retargets instead
of restarting), and drive removal from a single `dismissToast(toast)`
helper that both the close button and the auto-dismiss timer call instead
of calling `.remove()` directly:

```css
/* target: src/views/partials/styles.ejs — add next to .toast-alert (around line 254-260) */
.toast-alert{position:relative;background:var(--paper);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-2);padding:14px 36px 14px 16px;animation:toast-in var(--t-base) var(--ease);transition:opacity var(--duration-fast) var(--ease-standard),transform var(--duration-fast) var(--ease-standard)}
.toast-alert.leaving{opacity:0;transform:translateY(-6px)}
@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
```

```js
/* target: src/views/partials/sidebar.ejs — replace the two toast.remove() call sites */
  function dismissToast(toast) {
    if (toast.classList.contains('leaving')) return;
    toast.classList.add('leaving');
    toast.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'opacity') return;
      toast.removeEventListener('transitionend', handler);
      toast.remove();
    });
  }
```

## Repo conventions to follow

- Easing/duration always come from the shared tokens defined at
  `src/views/partials/styles.ejs:17` — this plan reuses
  `var(--duration-fast)` (150ms) and `var(--ease-standard)`
  (`cubic-bezier(.2,.8,.2,1)`), the same pair already used for every
  other hover/press transition in the file (e.g. `.btn` at line 102).
  Do not invent a new duration or curve.
- The codebase already uses the "keyframes for entrance, transition +
  state class for the reversible/exit direction" split elsewhere:
  `.drawer-panel` enters/exits via a plain `transition:transform`
  (`src/views/partials/styles.ejs:194`) rather than two keyframes. This
  plan brings `.toast-alert` in line with that same split instead of
  adding a second `@keyframes toast-out`.
- `src/views/partials/sidebar.ejs`'s existing toast script is a single
  IIFE with helper functions (`getToastStack`, `showSupportAlert`) defined
  before they're used — add `dismissToast` as a sibling helper function in
  the same style, defined before `showSupportAlert` (which will call it).

## Steps

1. In `src/views/partials/styles.ejs`, on the `.toast-alert` rule
   (currently line 254), append `;transition:opacity var(--duration-fast) var(--ease-standard),transform var(--duration-fast) var(--ease-standard)`
   to the existing declaration list (keep the existing `animation:toast-in …`
   property — both can coexist, since `animation` only drives the
   mount and `transition` only engages once the `.leaving` class changes
   `opacity`/`transform` afterward).
2. Immediately after that rule, add a new rule:
   `.toast-alert.leaving{opacity:0;transform:translateY(-6px)}`.
3. In `src/views/partials/sidebar.ejs`, inside the toast `<script>`
   block, add a new `dismissToast` function directly above the
   `function showSupportAlert(data) {` line:
   ```js
   function dismissToast(toast) {
     if (toast.classList.contains('leaving')) return;
     toast.classList.add('leaving');
     toast.addEventListener('transitionend', function handler(e) {
       if (e.propertyName !== 'opacity') return;
       toast.removeEventListener('transitionend', handler);
       toast.remove();
     });
   }
   ```
4. Replace `close.onclick = function () { toast.remove(); };`
   (currently line 72) with
   `close.onclick = function () { dismissToast(toast); };`.
5. Replace `setTimeout(function () { toast.remove(); }, 12000);`
   (currently line 90) with
   `setTimeout(function () { dismissToast(toast); }, 12000);`.

## Boundaries

- Do NOT add a height/`max-height` collapse for the vacated space —
  siblings snapping up one position after a toast fades out is a much
  smaller seam than the current instant full-teleport and is acceptable
  scope for this plan; a height-collapse animation would require
  measuring `scrollHeight` and is a separate, larger change.
- Do NOT touch `getToastStack()` or the toast's `appendChild` entrance
  logic — only the removal path changes.
- Do NOT add a second `@keyframes` for the exit — this must be a
  transition (per Hard Rule / `AUDIT.md` category 4: transitions retarget,
  keyframes restart), driven by the `.leaving` class.
- Do NOT change the 12000ms auto-dismiss delay itself.
- If `src/views/partials/sidebar.ejs`'s toast script no longer has
  exactly these two `.remove()` call sites when you open the file (i.e.
  it has drifted since the commit stamp), STOP and report instead of
  guessing which calls to replace.

## Verification

- **Mechanical**: `pnpm lint && pnpm typecheck` should pass (inline
  script in an `.ejs` partial; no type errors expected).
- **Feel check**: run `pnpm dev`, trigger a support-request toast (via
  `/tareas/:id/apoyo`, inviting another user, from a second logged-in
  session/browser so the SSE event fires), then:
  - Click the toast's "×" close button and confirm it visibly fades and
    lifts slightly before disappearing, instead of vanishing on the
    click.
  - Trigger a second toast, wait for the 12s auto-dismiss, and confirm
    the same fade-out plays automatically.
  - Trigger two toasts in quick succession and dismiss the first one
    manually — confirm the second toast doesn't jump or stutter, it just
    settles into place after the first finishes fading.
  - Click close twice rapidly on the same toast (double-click territory)
    and confirm it does not error or double-remove — the `leaving` class
    guard in `dismissToast` should make the second call a no-op.
  - In DevTools, set Animations panel playback to 10% while dismissing a
    toast and confirm the fade+lift plays smoothly, not a snap followed
    by a long hold.
  - Toggle `prefers-reduced-motion` (Rendering panel) and confirm the
    toast still disappears (the global `.01ms` override at
    `src/views/partials/styles.ejs:52` collapses the transition duration,
    but the `transitionend` listener still fires and still removes the
    node — it does not get stuck on-screen).
- **Done when**: no code path removes a `.toast-alert` node without first
  playing the fade-out, and rapid/duplicate dismissal never throws or
  leaves a half-visible toast behind.
