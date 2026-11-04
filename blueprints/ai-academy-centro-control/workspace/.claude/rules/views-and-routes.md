---
description: EJS view and route conventions
paths:
  - "src/views/**"
  - "src/routes/**"
---

- A view never queries the database. It receives already-shaped data from its route handler.
- Reuse the CSS tokens in `CLAUDE.md`'s Design system table — no new hex literal in a `.ejs` file.
- Every route that mutates state validates `req.body`/`req.query` with a Zod schema from
  `src/schemas/**` before calling a repository.
- A page route guarded by `authorize("admin")` that rejects an unauthorized request redirects
  browsers to `/login`; a JSON/API route under the same guard returns `403` instead.
- Keep `src/views/tareas/index.ejs` and `src/views/admin/usuarios.ejs` as the only two page
  templates for v1 — do not fork a third variant per role; branch inside the template with the
  session's `role`.
