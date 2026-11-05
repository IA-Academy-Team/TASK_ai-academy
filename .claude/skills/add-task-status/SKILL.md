---
name: add-task-status
description: Use when adding a new task status/estado value, or a new allowed transition between statuses, to the task workflow.
---

# Add task status

## When to use
A new value is needed in the task `status` column's allowed set (currently `pendiente`, `activa`,
`revision`, `completada`, `bloqueada`, `cancelada`), or an existing status needs a new allowed next
transition.

## Steps
1. Add the literal to `statusEnum` in `src/schemas/task.ts` (the single source of the allowed set —
   `src/db/schema.ts`'s `status` column stays a plain `text`, Zod is the gate).
2. Add it to `TRANSITIONS` in `src/db/tasks-repo.ts` — the key is the status, the array is every
   status it may move to. This is the single source `transitionTask` enforces server-side.
3. Add the status's badge color to `.badge.<status>` in `src/views/partials/styles.ejs`, using one
   of the existing tokens from `CLAUDE.md` (never a new hex).
4. Add the transition button to `src/views/tareas/detalle.ejs`'s status block, guarded the same way
   the existing ones are (role check for `completada`, dependency/WIP checks already live in the
   repo so the view never duplicates them).
5. Add a case to `tests/db/tasks-repo.test.ts` asserting the new transition is accepted, and one
   asserting an invalid transition into/out of it is rejected.

## Verify
```bash
pnpm typecheck   # expect: exit 0
pnpm test tests/db/tasks-repo.test.ts   # expect: exit 0
pnpm test tests/routes/tasks.test.ts    # expect: exit 0
```

## Do not
- Add a database migration for this — the column is already `text`, unconstrained by a DB enum,
  specifically so this change never touches `src/db/schema.ts` or `drizzle/`.
- Duplicate the dependency/WIP-limit/evidence checks in the view — they live once, in
  `transitionTask`.
