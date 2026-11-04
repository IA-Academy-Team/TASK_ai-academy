# AI Academy — Centro de Control

Herramienta interna de gestión de tareas para el equipo de AI Academy, con login y roles `admin`/`usuario`.

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
Las vistas renderizan desde `src/views/**/*.ejs`, reusando los tokens de abajo — nunca un segundo
sistema de diseño.

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
| Schema de la app (tasks) | `src/db/schema.ts` — cambiar aquí, luego `pnpm db:generate && pnpm db:migrate` |
| Schema de auth (user/session/account/verification) | generado por `pnpm auth:generate` en `src/db/auth-schema.ts` — **nunca editar a mano**; cambiar `src/lib/auth.ts` y regenerar |
| Acceso a variables de entorno | `.env`, cargado vía `node --env-file=.env` / `tsx --env-file=.env` en cada entry point; `drizzle-kit` y el CLI `auth` cargan `.env` por su cuenta (verificado) |
| Sesión/usuario actual | `src/middleware/session.ts` — un solo `attachSession()`, usado en todas partes; nunca leer la cookie de auth directamente en una ruta |
| Chequeo de rol | `src/middleware/authorize.ts` — `authorize("admin")`; nunca `req.user.role === "admin"` inline |
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

Portado literal de los prototipos HTML existentes (`AI_Academy_V3_2_Crear_Tarea.html`,
`AI_Academy_V3_3_Filtros_Estados.html`) — reusar estos tokens, no inventar otros.

| Rol | Valor | Uso |
|---|---|---|
| Primario | `#7346CC` | Botones primarios, enlaces, foco |
| Primario oscuro | `#5A37A5` | Hover de primario |
| Fondo de nav | `#1D1930` | Sidebar |
| Fondo de nav claro | `#302844` | Hover en sidebar |
| Lavanda | `#F0EBFB` | Fondos sutiles de acento |
| Fondo de página | `#F7F8FC` | Fondo general |
| Superficie | `#FFF` | Tarjetas, paneles |
| Borde | `#E9E8F0` | Divisores, inputs |
| Texto (ink) | `#252138` | Texto principal |
| Texto (muted) | `#5A566B` | Texto secundario |
| Texto (faint) | `#898699` | Placeholders |
| Éxito | `#178168` sobre `#E7F6F0` | Estado "completada" |
| Advertencia | `#AB702B` sobre `#FFF1DE` | Estado "en progreso" |
| Destructivo | `#BD4565` sobre `#FCEBF0` | Errores, estado bloqueado |
| Info | `#486FA8` sobre `#EAF1FC` | Avisos neutrales |

- **Tipografía:** `Poppins`/`Segoe UI`/Arial de respaldo, cuerpo `13px`.
- **Radio:** `10px` botones del sidebar, `13px` tarjetas/brandmark, `full` para avatares.
- **Layout:** sidebar fijo de `245px`, contenido con ancho máximo `1720px`.

## Entorno

| Variable | Requerida | Usada por | Fuente |
|---|---|---|---|
| `PORT` | no (default 3000) | `src/server.ts` | — |
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
