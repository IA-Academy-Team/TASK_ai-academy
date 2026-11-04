---
name: add-task-status
description: Use when adding a new task status/estado value (e.g. "add a cancelada status") to the tasks workflow.
---

# Add task status

## When to use
A new value is needed in the task `status` column's allowed set (currently `pendiente`,
`en_progreso`, `completada`).

## Steps
1. Add the literal to the Zod enum in `src/schemas/task.ts` (the single source of the allowed
   set — `src/db/schema.ts`'s `status` column stays a plain `text`, Zod is the gate).
2. Add the status's color mapping to `src/views/tareas/index.ejs`'s status-badge logic, using one
   of the existing tokens from `CLAUDE.md` (never a new hex).
3. Add a row to `tests/routes/tasks-filtros.test.ts` asserting a task can be filtered to and moved
   into the new status.

## Verify
```bash
pnpm typecheck   # expect: exit 0
pnpm test tests/routes/tasks-filtros.test.ts   # expect: exit 0
```

## Do not
- Add a database migration for this — the column is already `text`, unconstrained by a DB enum,
  specifically so this change never touches `src/db/schema.ts` or `drizzle/`.
