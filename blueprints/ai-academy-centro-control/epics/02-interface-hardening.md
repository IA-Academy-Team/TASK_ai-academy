# Epic 02: Interface and hardening

> After this epic: filtros/estados on the tasks page, an admin user-management page, a centralized
> error handler, full unit + E2E coverage of the login-to-admin flow, CI, and a README — the v1
> scope in full.

| | |
|---|---|
| **Epic id** | `02-interface-hardening` |
| **Tasks** | `E2-T1` … `E2-T6` |
| **Depends on** | `01-foundation` |
| **Unlocks** | nothing — this is the last epic |
| **Parallel with** | `E2-T1` and `E2-T2` share no files and may run concurrently; everything after `E2-T3` is sequential |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Express 5 · TypeScript 6 · EJS · PostgreSQL 17 (Docker) · Drizzle ORM · better-auth · Zod ·
Vitest + Supertest · Playwright. Package manager: `pnpm`. Dependency versions are in
`pnpm-lock.yaml` — read it, never guess one.

| Task | Command |
|---|---|
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (one file) | `pnpm test {path}` |
| Full suite | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Install E2E browsers | `pnpm exec playwright install --with-deps` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` passes before any task here is marked done.
Postgres must already be up (`pnpm db:up` from epic 01) — every test here hits the real database.

## Directory subtree

Only the parts this epic touches. Everything under `01-foundation`'s subtree already exists and is
read, not recreated.

```
src/
  app.ts                       # EDITED in E2-T2 (mount admin router) and E2-T3 (mount error handler)
  routes/
    tasks.ts                    # EXISTS from epic 01, EDITED in E2-T1 (filters + status change)
    admin.ts                     # NEW in E2-T2
  db/
    tasks-repo.ts                 # EXISTS from epic 01, EDITED in E2-T1 (filterTasks, updateStatus)
  schemas/
    task.ts                        # EXISTS from epic 01, EDITED in E2-T1 (filter + status schemas)
    admin.ts                        # NEW in E2-T2
  views/
    tareas/index.ejs                 # EXISTS from epic 01, EDITED in E2-T1 (filter controls, status buttons)
    admin/usuarios.ejs                # NEW in E2-T2
  middleware/
    authorize.ts                       # EXISTS from epic 01, read-only here until E2-T4's dedicated test
    error-handler.ts                    # NEW in E2-T3
  lib/
    http-error.ts                        # NEW in E2-T3
tests/
  routes/
    tasks-filtros.test.ts                 # NEW in E2-T1
    admin.test.ts                           # NEW in E2-T2
  middleware/
    error-handler.test.ts                    # NEW in E2-T3
    authorize.test.ts                         # NEW in E2-T4
  db/
    tasks-repo.test.ts                         # EXISTS from epic 01, EDITED in E2-T4 (edge cases)
  e2e/
    flujo-completo.spec.ts                      # NEW in E2-T5
.github/workflows/ci.yml                          # NEW in E2-T6
README.md                                          # NEW in E2-T6
```

Everything outside this subtree is out of scope. If a task seems to require editing a file not
listed here, stop and report — it means the epic boundary is wrong.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `tasks` | reads/writes `status` through `updateStatus`, reads through `filterTasks` | No schema change — `status` stays `text`, unconstrained at the DB level by design (see `.claude/skills/add-task-status/SKILL.md`). |
| `user` | reads `role`, writes `role` (create) and `isActive` (deactivate) | Only `src/routes/admin.ts`, guarded by `authorize("admin")`, ever writes these two fields after epic 01's seed. |

## Contracts

**Consumed** — already exists, do not rebuild:

| From | Interface | Guarantee |
|---|---|---|
| `01-foundation` | `src/db/tasks-repo.ts` → `createTask`, `listTasks` | Real Postgres rows, ordered by `createdAt` desc |
| `01-foundation` | `src/middleware/authorize.ts` → `authorize(role)` | 403 via `next(err)` on role mismatch, never a thrown synchronous error |
| `01-foundation` | `src/middleware/session.ts` → `attachSession` | Sets `req.user` with `role` and `isActive`, or leaves it `undefined` |
| `01-foundation` | `src/lib/auth.ts` → `auth` | `auth.api.signUpEmail` available for server-side user creation |

**Produced** — nothing outside this epic depends on it; it is the last epic.

## Conventions that bite in this area

- `filterTasks` and `updateStatus` live in the **same** `src/db/tasks-repo.ts` from epic 01 — this
  is an edit, not a new file. Do not create `src/db/tasks-filter-repo.ts` or similar.
- The error handler added in `E2-T3` is a **safety net**, not a retrofit. Routes from epic 01 and
  from `E2-T1`/`E2-T2` keep returning their own `res.status(...).json(...)`/`res.redirect(...)`
  directly; do not go back and rewrite them to throw instead. Rewiring an already-green route risks
  breaking its existing `Verify` (§9 rule 9) for a cosmetic gain.
- `pnpm exec playwright install --with-deps` downloads real browser binaries — run it once, before
  `E2-T5`'s `test:e2e`, not inside the spec file.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/db-and-auth.md`,
`.claude/rules/views-and-routes.md`. Both sit in the project root — the builder copied them there
from the bundle's `workspace/` before task one.

---

## Tasks

Listed in the same order as `tasks.json`. That order is the build order — work top to bottom and do
not re-rank by priority or by what looks quick.

### `E2-T1` — Add filtros and cambio de estado to the tasks page

**Depends on:** `E1-T6` · **Priority:** p0

Port `AI_Academy_V3_3_Filtros_Estados.html`'s filter row and status badges into
`src/views/tareas/index.ejs`, reusing the same tokens. Add `filterTasks({ status })` and
`updateStatus(id, status)` to `src/db/tasks-repo.ts` — `updateStatus` returns the updated row or
`undefined` if the id did not match. Extend `src/schemas/task.ts` with a status enum (`"pendiente"
\| "en_progreso" \| "completada"`) used by both a new query-string schema for `GET /tareas` and a
body schema for `POST /tareas/:id/estado`. `src/routes/tasks.ts` adds the query parsing to the
existing `GET /tareas` handler and the new `POST /tareas/:id/estado` route, responding 404 when
`updateStatus` returns `undefined`.

**Files**
- `src/db/tasks-repo.ts` — edit
- `src/routes/tasks.ts` — edit
- `src/views/tareas/index.ejs` — edit
- `src/schemas/task.ts` — edit
- `tests/routes/tasks-filtros.test.ts` — new

**Acceptance**

1. **WHEN** GET /tareas?estado=completada is requested **THE SYSTEM SHALL** return only tasks whose
   status is `completada`.
2. **WHEN** GET /tareas?estado=bogus is requested **THE SYSTEM SHALL** respond 400.
3. **WHEN** POST /tareas/:id/estado sets a valid next status **THE SYSTEM SHALL** update that task
   and leave every other task's status unchanged.
4. **WHEN** POST /tareas/:id/estado targets a nonexistent id **THE SYSTEM SHALL** respond 404.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm test tests/routes/tasks-filtros.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "step 7: filtros y estados"
git tag step-07-filtros-estados
```

### `E2-T2` — Add admin user management page

**Depends on:** `E1-T4` · **Priority:** p0

`src/schemas/admin.ts` exports a Zod schema for creating a user (`email`, `password`, `name`).
`src/routes/admin.ts`, guarded by `authorize("admin")`, adds `GET /admin/usuarios` (lists every
`user` row), `POST /admin/usuarios` (calls `auth.api.signUpEmail` — the new row gets
`role="usuario"` from the field's default, since the public signup path cannot set it), and `POST
/admin/usuarios/:id/desactivar` (`db.update(user).set({ isActive: false })`). `src/views/admin/
usuarios.ejs` renders the list and the create form, same shell and tokens as `tareas/index.ejs`.

**Files**
- `src/routes/admin.ts` — new
- `src/views/admin/usuarios.ejs` — new
- `src/schemas/admin.ts` — new
- `src/app.ts` — edit
- `tests/routes/admin.test.ts` — new

**Acceptance**

1. **WHEN** an `admin`-role session GETs /admin/usuarios **THE SYSTEM SHALL** render the user list
   with status 200.
2. **WHEN** a `usuario`-role session GETs /admin/usuarios **THE SYSTEM SHALL** respond 403.
3. **WHEN** POST /admin/usuarios creates a user with a valid email and password **THE SYSTEM
   SHALL** create it with `role="usuario"`.
4. **WHEN** POST /admin/usuarios/:id/desactivar is called on an existing user **THE SYSTEM SHALL**
   set `isActive=false` for that user.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm test tests/routes/admin.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "step 8: admin usuarios"
git tag step-08-admin-usuarios
```

### `E2-T3` — Add a centralized error-handling safety net

**Depends on:** `E2-T1`, `E2-T2` · **Priority:** p1

`src/lib/http-error.ts` exports a small `HttpError extends Error` with a `status: number` field.
`src/middleware/error-handler.ts` exports a four-argument Express error middleware: a `ZodError`
becomes `{ success: false, error: <first issue's message> }` at 400; an `HttpError` responds with
its own `status` and `message`; anything else responds 500 with a generic body — the raw message
and stack are logged server-side, never sent to the client, regardless of `NODE_ENV`. `src/app.ts`
mounts it last, after every router.

**Files**
- `src/middleware/error-handler.ts` — new
- `src/lib/http-error.ts` — new
- `src/app.ts` — edit
- `tests/middleware/error-handler.test.ts` — new

**Acceptance**

1. **WHEN** a handler throws a `ZodError` **THE SYSTEM SHALL** respond 400 with `{ "success":
   false, "error": <message> }`.
2. **WHEN** a handler throws `new HttpError(404, "...")` **THE SYSTEM SHALL** respond with status
   404 and that message.
3. **WHEN** a handler throws an unexpected `Error` **THE SYSTEM SHALL** respond 500 with a generic
   body, never the raw stack trace.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm test tests/middleware/error-handler.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "step 9: error handler"
git tag step-09-error-handler
```

### `E2-T4` — Add authorize() unit tests and run the full suite together

**Depends on:** `E2-T3` · **Priority:** p1

`tests/middleware/authorize.test.ts` isolates `authorize()` with fake `req`/`res`/`next` objects —
no HTTP, no database. Add to `tests/db/tasks-repo.test.ts` a case asserting `updateStatus` on a
nonexistent id returns `undefined` and writes no row. Then run the whole suite once, together, as
this task's own gate — no earlier task's `verify` ran every test file at once.

**Files**
- `tests/middleware/authorize.test.ts` — new
- `tests/db/tasks-repo.test.ts` — edit

**Acceptance**

1. **WHEN** `authorize("admin")` is called with a `usuario`-role actor **THE SYSTEM SHALL** call
   `next(new HttpError(403, ...))` and never call the route handler.
2. **WHEN** `authorize("admin")` is called with an `admin`-role actor **THE SYSTEM SHALL** call
   `next()` with no argument.
3. **WHEN** `updateStatus` targets a nonexistent task id **THE SYSTEM SHALL** return `undefined`
   and write no row.
4. **WHEN** the full suite runs via `pnpm test` **THE SYSTEM SHALL** report 0 failed and 0 skipped.

**Verify**

```bash
pnpm lint
pnpm test tests/middleware/authorize.test.ts
pnpm test tests/db/tasks-repo.test.ts
pnpm test
```

**Checkpoint**

```bash
git add -A && git commit -m "step 10: authorize tests and full suite"
git tag step-10-unit-coverage
```

### `E2-T5` — Add the end-to-end login-to-admin flow

**Depends on:** `E2-T4` · **Priority:** p1

`tests/e2e/flujo-completo.spec.ts`: sign in as the seeded admin (`pnpm db:seed`'s fixed
credentials) through the real `/login` form, land on `/tareas`, create "Tarea E2E" through the
form, filter by `estado=pendiente` and find it, change its status to `completada` through the UI
control, then visit `/admin/usuarios` and create a new user — asserting it appears with
`role="usuario"`. One spec file, five assertions, each mapped 1:1 to an acceptance line below.

**Files**
- `tests/e2e/flujo-completo.spec.ts` — new

**Acceptance**

1. **WHEN** the seeded admin logs in via the UI **THE SYSTEM SHALL** redirect to /tareas.
2. **WHEN** the admin creates a task titled "Tarea E2E" via the form **THE SYSTEM SHALL** show it
   in the list with status `pendiente`.
3. **WHEN** the admin filters by `estado=pendiente` **THE SYSTEM SHALL** show only tasks with that
   status, including "Tarea E2E".
4. **WHEN** the admin changes "Tarea E2E"'s status to `completada` **THE SYSTEM SHALL** reflect the
   new status with no error on screen.
5. **WHEN** the admin creates a new user from /admin/usuarios **THE SYSTEM SHALL** list that user
   with role `usuario`.

**Verify**

```bash
pnpm lint
pnpm exec playwright install --with-deps
pnpm test:e2e tests/e2e/flujo-completo.spec.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "step 11: e2e flujo completo"
git tag step-11-e2e-flujo
```

### `E2-T6` — Add CI workflow, README, and run the final gate

**Depends on:** `E2-T5` · **Priority:** p0

`.github/workflows/ci.yml` runs on every push: checkout, pnpm setup, `docker compose up -d --wait`,
`pnpm install --frozen-lockfile`, `pnpm db:generate && pnpm db:migrate`, `pnpm typecheck`, `pnpm
lint`, `pnpm test`, `pnpm build` — in that order. `README.md` states the exact commands for `pnpm
dev`, `pnpm test`, and `pnpm db:migrate` (copy them from `CLAUDE.md`'s Commands table, do not
re-derive). Then run the global gate once, locally, as this task's own proof that every earlier
step's gate still holds together.

**Files**
- `.github/workflows/ci.yml` — new
- `README.md` — new

**Acceptance**

1. **WHEN** `.github/workflows/ci.yml` runs on a push **THE SYSTEM SHALL** execute install,
   typecheck, lint, test, and build in that order.
2. **WHEN** README.md is read **THE SYSTEM SHALL** state the exact commands for dev, test, and
   db:migrate.
3. **WHEN** the global gate command sequence runs locally **THE SYSTEM SHALL** exit 0 end to end,
   including the health check against the built artifact.

**Verify**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node --env-file=.env dist/server.js & pid=$!; sleep 1; code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"; kill "$pid" 2>/dev/null || true; test "$code" = "200"
```

**Checkpoint**

```bash
git add -A && git commit -m "step 12: ci and readme"
git tag step-12-ci-readme
```

---

## Epic acceptance

The epic is done when every task above is `done` **and**:

1. **WHEN** `pnpm test:e2e` runs the full `flujo-completo.spec.ts` **THE SYSTEM SHALL** pass all
   five of its assertions in one run, against a freshly seeded database.
2. **WHEN** every command in `blueprint.md` §20.1 runs in sequence **THE SYSTEM SHALL** exit 0 at
   every line.

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e
```

Run from the project root. Both criteria must be decidable by these commands.

## Pitfalls

- **Retrofitting epic 01's routes to throw instead of returning directly.** `E2-T3`'s handler is
  additive. Changing a working route's control flow to "use the new error handler" risks breaking
  that route's own `Verify` for no acceptance-criterion gain.
- **Running `pnpm test:e2e` before `pnpm exec playwright install --with-deps`.** The browser
  binaries are not part of `pnpm install` — the first E2E run without them fails with a clear but
  easy-to-misread "executable doesn't exist" error.
- **Forgetting Postgres is still required.** Every test here, including the E2E spec, hits the real
  database from epic 01 — `pnpm db:up` first if the container was stopped between sessions.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json` — no task left `in_progress`.
- [ ] Every `verify` command of every task in this epic passed, not just the first one.
- [ ] No `verify` command was edited, and none was skipped because a file it names did not exist.
- [ ] Every task in this epic has its `checkpoint` tag in version control — `git tag -l 'step-*'`
      lists `step-07-filtros-estados` through `step-12-ci-readme` in addition to epic 01's six.
- [ ] Gate command passes clean, run from the project root.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` updated if this epic added a variable — it did not; state that explicitly.
- [ ] One commit per task, each prefixed with its task id, each followed by its checkpoint tag.
