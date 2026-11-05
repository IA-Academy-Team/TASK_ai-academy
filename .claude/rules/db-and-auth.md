---
description: Database schema and better-auth conventions
paths:
  - "src/db/**"
  - "src/lib/auth.ts"
  - "drizzle.config.ts"
---

- `src/db/schema.ts` owns app tables only (`projects`, `project_members`, `tasks`, `task_support`,
  `task_logs`). Never add `user`, `session`, `account`, or `verification` here — those are
  better-auth's, generated into `src/db/auth-schema.ts`.
- `tasks.dependencyId` is a self-reference with **no DB-level FK** on purpose (avoids the circular
  reference drizzle can't express cleanly) — `createTask` in `src/db/tasks-repo.ts` validates it
  exists and belongs to the same project before inserting. Keep that check if you touch it.
- `tasks.status`/`tasks.priority` are plain `text`, no DB enum — same convention as the rest of the
  project. `src/schemas/task.ts`'s Zod enums are the gate, and `TRANSITIONS` in
  `src/db/tasks-repo.ts` is the single source of which status can move to which.
- After editing `src/lib/auth.ts` (e.g. a new `user.additionalFields` entry), run
  `pnpm auth:generate` then `pnpm db:generate && pnpm db:migrate` — in that order, every time.
- Every query goes through a `*-repo.ts` module (`projects-repo.ts`, `tasks-repo.ts`). No
  `db.select()`/`db.insert()` call lives in a route file.
- `role` and `isActive` are `additionalFields` with `input: false` — they can never be set from
  the public sign-up payload. Only an admin route, server-side, may change them.
- Migrations are named by `drizzle-kit generate` (a random codename). Never hand-name or hand-edit
  a file under `drizzle/`.
- `tests/setup-db.ts` cleans up between tests with `db.delete(projects)` then `db.delete(user)` —
  deleting `projects` first matters, it cascades `tasks`/`task_support`/`task_logs`/
  `project_members`; deleting `user` first would hit the FK from `tasks.ownerId`/`projects.leaderId`.
