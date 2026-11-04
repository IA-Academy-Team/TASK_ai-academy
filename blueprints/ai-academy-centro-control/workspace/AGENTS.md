# AI Academy — Centro de Control — instrucciones para agentes

Herramienta interna de tareas (login + roles admin/usuario) en Express + TypeScript + EJS + Postgres.

## Comandos

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install` |
| Levantar Postgres | `pnpm db:up` |
| Servidor de desarrollo | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Tests unitarios | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Migrar DB | `pnpm db:migrate` |

## No negociable

1. Nunca editar a mano `src/db/auth-schema.ts` — lo genera `pnpm auth:generate`.
2. Nunca leer `req.user.role` sin pasar por `authorize()`.
3. Nunca commitear secretos, `.env`, ni `dist/`.
4. Nunca escribir una migración a mano.
5. Nunca marcar una tarea terminada con un comando de gate fallando.

Arquitectura completa, límites y tokens de diseño: ver `CLAUDE.md` en este directorio.
