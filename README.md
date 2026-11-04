# AI Academy — Centro de Control

Herramienta interna de gestión de tareas para el equipo de AI Academy, con login y roles
`admin`/`usuario`. Express 5 + TypeScript + EJS + Drizzle ORM + PostgreSQL + better-auth.

## Arrancar en local

```bash
cp .env.example .env
pnpm install
pnpm approve-builds --all
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm auth:generate
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abrí http://localhost:3100/login — las credenciales del admin semillado están en `src/db/seed.ts`.

## Comandos

| Tarea | Comando |
|---|---|
| Servidor de desarrollo | `pnpm dev` |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Tests unitarios | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Aplicar migración | `pnpm db:migrate` |
| Sembrar datos | `pnpm db:seed` |

Arquitectura completa, convenciones y tokens de diseño: ver [`CLAUDE.md`](./CLAUDE.md).
