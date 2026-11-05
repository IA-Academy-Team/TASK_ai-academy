---
name: change-db-schema
description: Use when adding or changing a table, column, or relation in the app's database schema (projects, project_members, tasks, task_support, task_logs) — e.g. "add a due_date column to tasks", "add a new project_tags table".
---

# Change DB schema

## When to use
A new table, column, or relation is needed in the app schema. This is about
`src/db/schema.ts` only — never `src/db/auth-schema.ts` (see the `change-auth-config` skill for
that).

## Steps
1. Edit `src/db/schema.ts` — the single source of truth for the app schema. Reference
   `auth-schema.ts`'s `user` export for any FK to a user, same pattern as `projects.leaderId`.
2. Generate the migration — never write one by hand:
   ```bash
   pnpm db:generate
   ```
3. Apply it:
   ```bash
   pnpm db:migrate
   ```
4. Update the matching repo in `src/db/*-repo.ts` (the only place that may emit a Drizzle query for
   this table) to read/write the new column or relation.
5. If the column feeds a route, add it to the matching Zod schema in `src/schemas/**` so unvalidated
   input never reaches the repo.
6. Add or update a test in `tests/db/*-repo.test.ts` covering the new column/relation.

## Verify
```bash
pnpm db:up          # expect: Postgres running on 5433
pnpm db:migrate      # expect: exit 0, new migration applied
pnpm typecheck       # expect: exit 0
pnpm test tests/db/  # expect: exit 0
```

## Do not
- Hand-write a migration file — `pnpm db:generate` names and writes it from the schema diff.
- Query the database anywhere outside `src/db/*-repo.ts` (routes and middleware go through a repo).
- Touch `src/db/auth-schema.ts` — it is generated from `src/lib/auth.ts` by `pnpm auth:generate`,
  never edited by hand.
