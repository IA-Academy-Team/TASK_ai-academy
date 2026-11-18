# AI Academy — Centro de Control

Herramienta interna de gestión de proyectos y tareas para el equipo de AI Academy, con login, roles
globales `administrador`/`trainer`/`colaborador`/`practicante` (solo `administrador` tiene permisos
elevados — los otros tres son organizacionales), y un líder por proyecto. Cada tarea tiene responsable, apoyo, prioridad,
horas estimadas/registradas, dependencia, y un workflow de estado con límites de WIP por proyecto
(`pendiente → activa → revisión → completada`, más `bloqueada`/`cancelada`).

## Comandos

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install` |
| Levantar Postgres | `pnpm db:up` — Docker, puerto 5433 |
| Servidor de desarrollo | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` |
| Arrancar (build) | `pnpm start` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Tests unitarios | `pnpm test` · un archivo: `pnpm test {path}` |
| E2E | `pnpm test:e2e` |
| Generar migración | `pnpm db:generate` |
| Aplicar migración | `pnpm db:migrate` |
| Inspeccionar DB | `pnpm db:studio` |
| Sembrar datos | `pnpm db:seed` |
| Regenerar schema de auth | `pnpm auth:generate` — tras cualquier cambio en `src/lib/auth.ts` |

**Gate:** `pnpm lint && pnpm typecheck && pnpm test` debe pasar antes de marcar cualquier tarea como terminada.

El runtime está fijado en `package.json` (`engines.node` >=24). Las versiones de dependencias viven
en `pnpm-lock.yaml` — léelo, nunca adivines una versión.

## Stack

Express 5 · TypeScript · EJS (vistas server-rendered) · PostgreSQL 17 · Drizzle ORM · better-auth ·
Zod · Docker Compose (Postgres local) · Vitest + Supertest · Playwright.

## Arquitectura

**Camino de una request.** Navegador → `src/server.ts` (abre el puerto) → `src/app.ts` (app de
Express: monta el handler de `better-auth`, el middleware de sesión, los routers de páginas/API, y
el manejador de errores, en ese orden) → un router en `src/routes/*.ts` → un repositorio en
`src/db/*-repo.ts` (el único lugar que emite queries de Drizzle) → `src/db/client.ts` → Postgres.
Las vistas renderizan desde `src/views/**/*.ejs`, con el shell compartido en
`src/views/partials/{styles,sidebar}.ejs` — nunca un segundo sistema de diseño.

**Rutas de página.** `/proyectos` (lista) → `/proyectos/nuevo` (crear) → `/proyectos/:id` (detalle:
tareas del proyecto + formulario de nueva tarea + configuración si sos líder/admin) → `/tareas/:id`
(detalle de una tarea: workflow de estado, registro de horas). `/admin/usuarios` solo para
`administrador`.

**Límites.**

| Capa | Puede importar de | Nunca debe |
|---|---|---|
| `src/routes/**` | `src/db/*-repo.ts`, `src/schemas/**`, `src/middleware/**`, `src/views` (solo render) | Abrir una conexión a la DB directamente — pasar por un repo |
| `src/db/*-repo.ts` | `src/db/client.ts`, `src/db/schema.ts` | Importar algo de `src/routes/**` o de `express` |
| `src/middleware/**` | `src/lib/auth.ts`, `src/lib/http-error.ts` | Importar un repo directamente — el middleware guarda acceso, no consulta |
| `src/lib/auth.ts` | `src/db/client.ts`, `src/db/schema.ts`, `src/db/auth-schema.ts` | Ser importado por una vista |

**Dónde vive cada cosa.**

| Concepto | Fuente única de verdad |
|---|---|
| Schema de la app (`projects`, `project_members`, `tasks`, `task_support`, `task_logs`) | `src/db/schema.ts` — cambiar aquí, luego `pnpm db:generate && pnpm db:migrate` |
| Transiciones de estado válidas de una tarea | `TRANSITIONS` en `src/db/tasks-repo.ts` — única fuente; la vista solo muestra los botones que ya son válidos, el repo los re-valida siempre |
| Schema de auth (user/session/account/verification) | generado por `pnpm auth:generate` en `src/db/auth-schema.ts` — **nunca editar a mano**; cambiar `src/lib/auth.ts` y regenerar |
| Acceso a variables de entorno | `.env`, cargado vía `node --env-file=.env` / `tsx --env-file=.env` en cada entry point; `drizzle-kit` y el CLI `auth` cargan `.env` por su cuenta (verificado) |
| Sesión/usuario actual | `src/middleware/session.ts` — un solo `attachSession()`, usado en todas partes; nunca leer la cookie de auth directamente en una ruta |
| Roles de usuario | `src/domain/roles.ts` — `ROLES`, `ADMIN_ROLE`, `isAdminRole()`; nunca el string `"administrador"` suelto |
| Chequeo de rol para una ruta protegida | `src/middleware/authorize.ts` — `authorize(ADMIN_ROLE)`; nunca `req.user.role === ADMIN_ROLE` inline en una ruta |
| Tokens de diseño | las variables CSS de abajo — ningún hex crudo en una vista |

## Reglas de código

1. **Un archivo de ruta por recurso. Máximo 200 líneas.** Dividir por sub-recurso si crece más.
2. **Los imports relativos usan la extensión `.ts`** (`./app.ts`, nunca `./app` ni `./app.js`) —
   `tsconfig.json` fija `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, así que
   resuelve igual bajo `tsx` (dev, seed, tests) y bajo `tsc` (build). Nunca mezclar un specifier
   `.js`.
3. **Validar en el borde.** Cada handler de ruta parsea `req.body`/`req.query` con un schema Zod de
   `src/schemas/**` antes de tocar un repositorio. Ningún input sin validar llega a `src/db/**`.
4. **Autorizar siempre en el servidor.** `authorize(role)` corre en la cadena de middleware de la
   ruta, nunca solo en la plantilla EJS (ocultar un botón no es un permiso).
5. **Ninguna dependencia nueva sin una razón de una línea en el commit.**

## Sistema de diseño

Paleta de marca: negro carbón / blanco / morado profundo / morado eléctrico (gradiente
`#6030AD → #9636FF`), modo claro + oscuro. Única fuente de tokens:
`src/views/partials/styles.ejs` — reusar estas variables, nunca un hex crudo en una vista.

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| Primario (acción) | `#6030AD` morado profundo | `#9636FF` morado eléctrico | Botones primarios, estado activo del sidebar |
| Primario hover | `#4D2689` | `#AD5CFF` | Hover de primario |
| Acento | `#9636FF` morado eléctrico | `#9636FF` | Enlaces, foco, badge "activa" |
| Fondo de nav | `#1D1D1B` negro carbón | `#0F0E11` | Sidebar |
| Fondo de nav claro | `#2E2438` | `#221B2E` | Hover en sidebar |
| Acento sutil | `#F2EAFC` | `rgba(150,54,255,.16)` | Fondos sutiles de acento |
| Fondo de página | `#F6F5F9` | `#141316` | Fondo general |
| Superficie | `#FFFFFF` blanco | `#201E24` | Tarjetas, paneles |
| Borde | `#E3DFEA` | `#3A3640` | Divisores, inputs |
| Texto (ink) | `#1D1D1B` negro carbón | `#F3F1F6` | Texto principal |
| Texto (muted) | `#55525C` | `#C7C3CE` | Texto secundario |
| Texto (faint) | `#6B6872` | `#9C98A3` | Placeholders |
| Éxito | `#18794E` sobre `#E6F4EC` | `#3DDC9A` sobre `rgba(24,121,78,.25)` | Estado "completada", prioridad "baja" |
| Advertencia | `#986100` sobre `#FCF1E3` | `#F2A93B` sobre `rgba(152,97,0,.28)` | Estado "revisión", prioridad "alta" |
| Destructivo | `#B42318` sobre `#FBE7E5` | `#F2777A` sobre `rgba(180,35,24,.28)` | Errores, estado "bloqueada", prioridad "crítica" |
| Info | `#205EA6` sobre `#E8F0FA` | `#6FA8E0` sobre `rgba(32,94,166,.28)` | Prioridad "media", rol "usuario" |

- **Tema:** `data-theme="dark"` en `<html>`, fijado sin parpadeo por
  `src/views/partials/theme-init.ejs` (localStorage `aiacademy-theme`, si no hay preferencia usa
  `prefers-color-scheme`). Toggle en el sidebar. Todo `.ejs` autenticado incluye `theme-init` antes
  de `styles` en `<head>`.
- **Tipografía:** `Poppins`/`Segoe UI`/Arial de respaldo, cuerpo `13px` (identidad existente —
  DESIGN.md permite conservar tipografía de marca).
- **Radio:** `12px` botones/inputs/sidebar, `18px` tarjetas, `16px` brandmark, `full` para avatares.
- **Sombra de tarjeta:** `0 4px 16px rgba(23,43,56,.06)` (claro) / `0 4px 16px rgba(0,0,0,.35)`
  (oscuro).
- **Foco:** `outline: 3px solid var(--focus-ring)` global vía `:focus-visible`.
- **Layout:** sidebar fijo de `245px`, contenido con ancho máximo `1720px`.
- **Movimiento:** `prefers-reduced-motion: reduce` desactiva transiciones/animaciones global.

## Entorno

| Variable | Requerida | Usada por | Fuente |
|---|---|---|---|
| `PORT` | no (default 3100, ver `.env.example`) | `src/server.ts` | — |
| `DATABASE_URL` | sí | `src/db/client.ts`, `drizzle.config.ts` | string de conexión que imprime `pnpm db:up` |
| `BETTER_AUTH_SECRET` | sí | `src/lib/auth.ts` | generar 32+ caracteres aleatorios |
| `BETTER_AUTH_URL` | sí | `src/lib/auth.ts` | `http://localhost:3000` en local |

`.env.example` está commiteado y se mantiene sincronizado. `.env` está en `.gitignore`.

## Reglas diferidas

Convenciones diferidas — leer el archivo correspondiente antes de editar esa área:

| Archivo | Aplica a |
|---|---|
| `.claude/rules/db-and-auth.md` | `src/db/**`, `src/lib/auth.ts` |
| `.claude/rules/views-and-routes.md` | `src/views/**`, `src/routes/**` |

## No negociable

1. Nunca editar a mano `src/db/auth-schema.ts` — es generado. Cambiar `src/lib/auth.ts` y correr
   `pnpm auth:generate`.
2. Nunca leer `req.user.role` sin pasar por `authorize()` para una acción protegida.
3. Nunca commitear secretos, `.env`, ni `dist/`.
4. Nunca escribir una migración a mano — `pnpm db:generate` la nombra.
5. Nunca marcar una tarea terminada con un comando de gate fallando.
6. Nunca dejar que `blueprints/` quede sin excluir en una herramienta que camina el árbol — ver
   `biome.json` / `vitest.config.ts`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
