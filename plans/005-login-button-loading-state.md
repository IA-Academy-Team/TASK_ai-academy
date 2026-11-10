# 005 — Give the login submit button a loading state during fetch

- **Status**: DONE
- **Commit**: 0d6aad3
- **Severity**: LOW
- **Category**: Missed opportunities / Purpose & frequency (feedback)
- **Estimated scope**: 1 file (`src/views/login.ejs`), JS + small CSS
  addition

## Problem

The login form submits via `fetch` and only reacts once the response
resolves — there is zero visual feedback from the moment the user clicks
"Entrar" to the moment the request settles:

Current code, `src/views/login.ejs:114-131`:

```js
/* src/views/login.ejs:114 — current */
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("error");
    errorBox.style.display = "none";
    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      errorBox.textContent = "Email o contraseña incorrectos.";
      errorBox.style.display = "block";
    }
  });
```

The button (`src/views/login.ejs:71`,
`<button type="submit" class="btn primary" …>Entrar</button>`) stays
exactly as it was before the click: fully enabled, same label. On a slow
connection, or simply because `better-auth`'s sign-in does real password
hashing work, this is enough of a gap for an impatient user to click
"Entrar" again (firing a second concurrent sign-in request) with no sign
anything is happening at all — a state change (idle → submitting →
settled) that currently teleports with no feedback in between.

## Target

Disable the button and swap its label to an in-flight state the instant
the form submits, restore it in every exit path (success redirects away
so restoring there is moot, but the `else` branch and the body of a
`try`/`finally` must restore it), and give the label swap a quick fade so
it doesn't hard-flash:

```ejs
<!-- target: src/views/login.ejs:71 — add an id -->
      <button type="submit" class="btn primary" id="login-submit" style="width:100%;justify-content:center">Entrar</button>
```

```css
/* target: src/views/login.ejs — inside the existing <style> block, e.g. near .login-options */
  #login-submit{transition:opacity var(--duration-fast) var(--ease-standard)}
  #login-submit:disabled{opacity:.7;cursor:default}
```

```js
/* target: src/views/login.ejs:114 — current submit handler, rewritten */
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("login-submit");
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("error");
    errorBox.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando…";
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      errorBox.textContent = "Email o contraseña incorrectos.";
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Entrar";
    }
  });
```

Note the `finally` block runs on the success path too (before the
`window.location.href` navigation actually completes), which briefly
re-enables the button during the redirect — this is intentional and
harmless (the page is navigating away regardless) and far simpler than
threading an extra flag through to skip it.

## Repo conventions to follow

- Easing/duration tokens from the shared stylesheet
  (`src/views/partials/styles.ejs:17`, included via
  `<%- include('partials/styles') %>` at `src/views/login.ejs:9`) —
  `var(--duration-fast)` and `var(--ease-standard)` are already in scope
  inside `login.ejs`'s own `<style>` block exactly like the rest of this
  file's hand-written rules (e.g. `.pw-field button` uses plain color
  values but every *animated* rule in this repo sources its
  duration/easing from these tokens — see `.login-card` at
  `src/views/login.ejs:25`, which transitions `opacity`/`transform`
  using literal `.85s ease` / `.85s cubic-bezier(...)` — this file does
  mix tokens and literals already, but new additions should prefer the
  tokens per the rest of the codebase's convention in
  `styles.ejs`).
- The existing password-visibility toggle in this same file
  (`src/views/login.ejs:105-110`) already follows the "grab the element
  by `id`, mutate a small bit of state/text in a plain event listener"
  pattern used here — this plan's `dismissToast`-style button-state
  logic matches that existing style, not a new abstraction.

## Steps

1. In `src/views/login.ejs`, add `id="login-submit"` to the submit
   button (currently line 71):
   `<button type="submit" class="btn primary" style="width:100%;justify-content:center">Entrar</button>`
   becomes
   `<button type="submit" class="btn primary" id="login-submit" style="width:100%;justify-content:center">Entrar</button>`.
2. In the `<style>` block at the top of the file (anywhere alongside the
   other rules, e.g. right after the `.login-options` rules), add:
   ```css
   #login-submit{transition:opacity var(--duration-fast) var(--ease-standard)}
   #login-submit:disabled{opacity:.7;cursor:default}
   ```
3. Replace the entire submit handler (currently
   `src/views/login.ejs:114-131`) with the rewritten version shown in
   **Target** above — it adds `const submitBtn = …`, disables/relabels
   the button before the `fetch`, wraps the `fetch` + branching in a
   `try`, and restores the button in a `finally`.

## Boundaries

- Do NOT add a spinner icon/SVG — a text swap ("Entrar" →
  "Entrando…") plus the `:disabled` opacity dip is sufficient feedback
  for a single-field form submission and matches this app's otherwise
  icon-light button style.
- Do NOT touch the password-visibility toggle or the splash/replay
  animation logic earlier in the same `<script>` block — only the
  final `login-form` submit listener changes.
- Do NOT add client-side validation beyond what already exists (the
  `required` attributes on the inputs) — this plan is only about
  in-flight feedback, not form validation.
- Do NOT change the `/api/auth/sign-in/email` request itself (method,
  headers, body) or the success/failure branching logic — only wrap it
  with the loading-state toggle.
- If the submit handler no longer matches the code shown above when you
  open the file (i.e. it has drifted since the commit stamp), STOP and
  report instead of guessing where to insert the `try`/`finally`.

## Verification

- **Mechanical**: `pnpm lint && pnpm typecheck` should pass (inline
  script in an `.ejs` view, no TypeScript surface touched).
- **Feel check**: run `pnpm dev`, open `/login`, skip or wait out the
  splash, and:
  - Throttle the network in DevTools (e.g. "Slow 4G") and submit valid
    credentials — confirm the button immediately dims slightly, becomes
    unclickable, and reads "Entrando…" for the duration of the request,
    then the page navigates to "/".
  - Submit invalid credentials under the same throttling and confirm the
    button returns to its normal enabled "Entrar" state at the same
    moment the error message appears — no stuck "Entrando…" state.
  - Click "Entrar" rapidly multiple times while a slow request is still
    in flight and confirm only one request is actually sent (the
    `disabled` attribute blocks subsequent clicks from re-submitting the
    form).
  - In DevTools' Rendering panel, toggle `prefers-reduced-motion: reduce`
    and confirm the disabled-state dim still applies instantly (no
    motion is lost here since this is an opacity-only feedback cue, not
    a position change).
- **Done when**: the submit button visibly reflects "submitting" from
  click to response on every code path (success, failure, slow network),
  and cannot be used to fire a second concurrent sign-in request while
  one is already in flight.
