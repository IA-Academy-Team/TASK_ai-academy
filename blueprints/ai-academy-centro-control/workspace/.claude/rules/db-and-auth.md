---
description: Database schema and better-auth conventions
paths:
  - "src/db/**"
  - "src/lib/auth.ts"
  - "drizzle.config.ts"
---

- `src/db/schema.ts` owns app tables only (`tasks`). Never add `user`, `session`, `account`, or
  `verification` here — those are better-auth's, generated into `src/db/auth-schema.ts`.
- After editing `src/lib/auth.ts` (e.g. a new `user.additionalFields` entry), run
  `pnpm auth:generate` then `pnpm db:generate && pnpm db:migrate` — in that order, every time.
- Every query goes through a `*-repo.ts` module. No `db.select()`/`db.insert()` call lives in a
  route file.
- `role` and `isActive` are `additionalFields` with `input: false` — they can never be set from
  the public sign-up payload. Only an admin route, server-side, may change them.
- Migrations are named by `drizzle-kit generate` (a random codename). Never hand-name or hand-edit
  a file under `drizzle/`.
