# Animation improvement plans

Produced by the `improve-animations` skill audit on commit `0d6aad3`.
Each plan is fully self-contained — hand any single one to an executor
agent (or run `improve-animations execute <plan>`) with no extra context.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-sidebar-label-fade.md) | Fade sidebar labels instead of hard display toggle | MEDIUM | DONE |
| [002](002-dashboard-chart-animation.md) | Shorten dashboard chart animation and respect reduced motion | MEDIUM | DONE |
| [003](003-toast-exit-animation.md) | Animate support-request toast dismissal instead of hard `remove()` | MEDIUM | DONE |
| [004](004-progress-ring-draw-in.md) | Draw the progress ring in instead of painting it static | LOW | DONE |
| [005](005-login-button-loading-state.md) | Give the login submit button a loading state during fetch | LOW | DONE |

## Recommended execution order

No plan depends on another — all five touch disjoint files/selectors and
can run in any order or in parallel. Suggested order is just by leverage
(impact ÷ effort):

1. **002** — one-line-of-logic fix, touches the highest-frequency view
   (the dashboard, loaded on every visit).
2. **001** — CSS-only, fixes a visible glitch on a chrome element used
   every session.
3. **003** — small JS + CSS change, fixes a real-time UI element (toasts)
   that's easy to miss testing since it needs a second session to
   trigger.
4. **005** — small, isolated, purely additive (no existing behavior
   removed).
5. **004** — lowest severity, purely additive polish.

## Dependencies

None. Each plan lists its own exact file:line boundaries in its
**Boundaries** section — no two plans touch the same lines.
