---
name: change-auth-config
description: Use when changing authentication configuration — better-auth options, user fields (role, isActive), session settings — in src/lib/auth.ts. e.g. "add a new field to the user table", "change session expiry".
---

# Change auth config

## When to use
A change is needed to how `better-auth` is configured: its options, plugins, or additional user
fields (the project already has `role` and `isActive` as `additionalFields`).

## Steps
1. Edit `src/lib/auth.ts` only. This is the single source for auth configuration — never edit
   `src/db/auth-schema.ts` by hand, it is generated.
2. Regenerate the auth schema from the new config:
   ```bash
   pnpm auth:generate
   ```
3. If the change added or changed a column, generate and apply the migration same as any schema
   change:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```
4. If the change affects session shape (e.g. a new user field routes/middleware should see), update
   `src/middleware/session.ts`'s `attachSession()` — the only place that reads the auth session —
   so the rest of the app keeps getting it from there, never from the auth cookie directly.
5. If the change affects role checks, verify `src/middleware/authorize.ts` still reads the new field
   correctly; never inline `req.user.role === "..."` in a route.

## Verify
```bash
pnpm auth:generate   # expect: exit 0, src/db/auth-schema.ts rewritten
pnpm db:migrate       # expect: exit 0 (only if a column changed)
pnpm typecheck        # expect: exit 0
pnpm test             # expect: exit 0
```

## Do not
- Hand-edit `src/db/auth-schema.ts` — any change there is lost on the next `pnpm auth:generate`.
- Read `req.user.role` directly in a route — go through `authorize(role)`.
- Read the auth cookie directly in a route — go through `attachSession()`.
