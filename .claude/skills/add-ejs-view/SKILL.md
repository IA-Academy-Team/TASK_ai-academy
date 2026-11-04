---
name: add-ejs-view
description: Use when adding a new server-rendered page (a new EJS view plus the route that renders it) to this project — e.g. "add a settings page", "add a reports screen".
---

# Add EJS view

## When to use
A new page is needed that renders server-side HTML (not a JSON API endpoint).

## Steps
1. Create `src/views/<area>/<name>.ejs`. Reuse the design tokens from `CLAUDE.md` — no new hex
   literal.
2. Add a `GET` handler in the matching `src/routes/<area>.ts` that loads only the data this view
   needs from a `*-repo.ts` module, then `res.render("<area>/<name>", { ... })`.
3. If the page is role-restricted, add `authorize("<role>")` to the route's middleware chain —
   never branch visibility only inside the template.
4. Add a test in `tests/routes/<area>.test.ts` asserting the status code for an authorized and an
   unauthorized request.

## Verify
```bash
pnpm typecheck   # expect: exit 0
pnpm test tests/routes/<area>.test.ts   # expect: exit 0
```

## Do not
- Query the database from inside the `.ejs` file.
- Duplicate the sidebar/layout markup — extract a partial if a second page needs it.
