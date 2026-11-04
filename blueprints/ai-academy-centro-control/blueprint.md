# AI Academy — Centro de Control — Blueprint

> Generado por The Architect el 2026-11-04
> Shape: internal-tool · `knowledge/shapes/internal-tool.md`
> Runtime track: ts-node (desviado del framework por defecto — ver §2 y §20.3) · `knowledge/runtime-tracks/ts-node.md`
> Modo de emisión: bundle
> Versión del blueprint: 1
> Versiones verificadas por última vez: 2026-11-04 — ver §11 para la procedencia por paquete

---

## 1. Project Overview & Non-Goals

### Current state (brownfield — qué existe hoy)

La carpeta de trabajo contenía dos prototipos HTML standalone sin backend:
`AI_Academy_V3_2_Crear_Tarea.html` y `AI_Academy_V3_3_Filtros_Estados.html` — "AI Academy · Centro
de control". Son HTML/CSS/JS vanilla puro: sin build, sin framework, sin persistencia, con tareas
de ejemplo hardcodeadas en objetos JS inline (sidebar, tarjetas de tarea, filtros por estado, y
strings `rol`/`admin`/`usuario` ya presentes en los datos mock — señal de que los roles ya estaban
pensados, nunca implementados). No hay backend, no hay login real, no hay base de datos, no hay
tests, no hay CI. El `.github/` del repositorio raíz pertenece al plugin "The Architect" en sí, no
a esta aplicación.

**No es una migración.** No hay ningún sistema corriendo en producción que este blueprint
reemplace: los dos HTML son referencia visual, no un servicio activo con tráfico o datos reales que
cortar. Por eso §9.1 (Parity and cutover) es `NOT APPLICABLE` — ver esa sección.

### Target state (qué hay después de este build)

Una aplicación Express + TypeScript + EJS con login real (email/contraseña vía `better-auth`),
roles `admin`/`usuario` server-side, y las dos pantallas de los mockups reconstruidas como vistas
reales atadas a una tabla `tasks` en Postgres — mismos tokens visuales, mismo layout, datos reales
en vez de un array hardcodeado. Un panel de administración nuevo (no existía en los mockups) para
que un `admin` cree y desactive usuarios.

### Vision

Centro de control interno de AI Academy para que el equipo (hoy: quien crea rutas/cápsulas/
propuestas) gestione sus tareas de trabajo con una vista de lista, filtros por estado, y cambio de
estado — con una capa de acceso real para separar quién administra usuarios de quién solo gestiona
sus propias tareas.

### Users

| Persona | Qué viene a hacer | Frecuencia |
|---|---|---|
| Usuario (`usuario`) | Crear, listar y filtrar sus tareas; cambiar su estado | Diaria |
| Administrador (`admin`) | Todo lo anterior, más: crear/desactivar cuentas de usuario | Semanal |

### Goals — v1 scope

1. Login con email/contraseña, sesión por cookie, logout.
2. Dos roles (`admin`, `usuario`) aplicados server-side en cada ruta protegida — nunca solo en el
   cliente.
3. Gestión de tareas (crear, listar, filtrar por estado, cambiar estado) sobre datos reales en
   Postgres, reusando el layout y los tokens visuales de los dos mockups existentes.
4. Panel de administración para crear y desactivar usuarios.

### Non-Goals — explicitly out of scope for v1

| Not building | Why not now | Revisit when |
|---|---|---|
| Self-signup público | Es herramienta interna, invitada — nadie paga ni se registra solo | El producto se vuelve algo que se vende a terceros |
| SSO / login social | Nadie lo pidió; el equipo es pequeño y ya usa email/contraseña | Un cliente empresarial lo exige, o el proveedor de identidad del equipo cambia |
| Reset de contraseña por email | Necesita un proveedor de email (SES/Resend) — costo e infraestructura nuevos para un equipo chico | Más de ~10 usuarios activos, o un admin lo pide dos veces |
| Multi-tenant / organizaciones | Un solo equipo usa la herramienta; no hay concepto de "cliente" todavía | AI Academy vende esto a otro equipo/empresa |
| Billing | Herramienta interna, nadie paga por usarla | Se decide ofrecerla como producto externo |
| Audit log formal (tabla `audit_events`) | `created_at`/`updated_at` en cada tabla alcanza para un equipo de este tamaño; una tabla de auditoría completa es trabajo real que nadie pidió | Un admin necesita reconstruir "quién cambió qué" para una tarea específica |
| Notificaciones (email/Slack) al cambiar estado | No hay proveedor de notificaciones integrado y nadie lo pidió | El equipo reporta que se pierden cambios de estado |

**El builder no debe implementar nada de esta tabla**, aunque parezca un agregado chico mientras
trabaja en un paso adyacente.

### Success metrics

| Metric | Target | How measured |
|---|---|---|
| Login funcional end-to-end | 100% de los logins válidos entran a /tareas | `tests/e2e/flujo-completo.spec.ts`, assertion 1 |
| Cobertura de los 2 mockups portados | 2/2 pantallas con datos reales | §9, steps 6 y 7 |
| Suite verde | 0 failed, 0 skipped | `pnpm test` — §9, step 10 |

---

## 2. Tech Stack

**Runtime track: ts-node.** Esta tabla nombra decisiones, no versiones — cada pin vive en §11 y en
ningún otro lugar.

| Layer | Choice | Why this, over what |
|---|---|---|
| Language / runtime | Node.js 24 LTS + TypeScript | Un solo lenguaje front/back; el equipo ya tiene los dos mockups en JS vanilla, cero fricción para migrar su lógica |
| Framework | **Express 5** | El usuario pidió explícitamente un modelo **MVC** literal (`routes/` → `controllers` embebidos en las rutas → `models` = repos de Drizzle, `views` = EJS). Next.js (default de `ts-node.md` para `internal-tool`) impone App Router/Server Components — una capa de abstracción que no es MVC y que no aporta nada aquí, ya que no hay necesidad de SSR avanzado ni de una SPA — rechazado por no encajar con el pedido explícito |
| Vistas | **EJS** | Server-rendered, permite portar los dos HTML existentes casi 1:1, reusando el mismo CSS — ninguna librería de componentes agrega valor para 2 pantallas |
| Base de datos | **PostgreSQL 17** (Docker local) | Relacional, encaja con usuarios+roles+tareas con relaciones reales; evita el overhead de un servicio administrado para un equipo interno chico |
| ORM / acceso a datos | **Drizzle ORM** | SQL-shaped, sin generador pesado tipo Prisma; integra de forma nativa con el adapter de `better-auth` |
| Auth | **better-auth**, self-hosted, sesión por cookie | Usuarios viven en nuestra propia Postgres (FKs reales); rol en una columna (`additionalFields`) — rung 1 de `knowledge/capabilities/auth.md`, suficiente para 2 roles. Rechazado Clerk/Supabase Auth: son para SaaS multi-tenant o cuando ya se vive en Supabase; ninguno de los dos aplica a un equipo interno de este tamaño |
| Background work | NOT APPLICABLE | No hay colas, cron, ni trabajo asíncrono en v1 |
| Payments | NOT APPLICABLE | Herramienta interna, nadie paga |
| File storage | NOT APPLICABLE | Ninguna tarea adjunta archivos en v1 |
| Email / notificaciones | NOT APPLICABLE | Ver Non-Goals — reset de contraseña y notificaciones quedan fuera de v1 |
| Hosting | Docker Compose (local y producción) — ver §12 | Mismo mecanismo en dev y en prod; sin atarse a un PaaS específico para un equipo que puede autohospedar |
| Package manager | **pnpm** | Convención de `knowledge/runtime-tracks/ts-node.md`; `node_modules` estricto evita dependencias fantasma |

### Compatibility check

Checked against `knowledge/stack-compatibility.md` — no known-bad combinations para Express 5 +
Drizzle + better-auth + Postgres. La única fricción real encontrada y resuelta en la práctica (ver
§11 y los *Gotchas* de cada paso): la sintaxis de wildcard de Express 5 (`/api/auth/*splat`, no
`*`) y que `better-auth` valida su esquema de Drizzle en JS independientemente de lo que exista en
la base — ambas quedaron verificadas corriendo el stack real, no solo leídas de documentación.

---

## 3. Directory Structure

```
ai-academy-centro-control/
  src/
    app.ts                 # fábrica de la app Express — monta auth, sesión, routers, error handler
    server.ts               # entry point — abre el puerto
    lib/
      auth.ts                 # instancia de better-auth (drizzleAdapter, role/isActive)
      http-error.ts            # clase HttpError(status, message)
    middleware/
      session.ts                # attachSession() — lee la sesión de better-auth, setea req.user
      authorize.ts                # authorize(role) — guard de rol, 403 si no coincide
      error-handler.ts             # middleware de error de 4 args, al final de app.ts
    schemas/
      task.ts                       # Zod: crear tarea, filtro por estado, cambio de estado
      admin.ts                       # Zod: crear usuario desde el panel admin
    routes/
      health.ts                      # GET /health
      tasks.ts                        # GET/POST /tareas, POST /tareas/:id/estado
      admin.ts                         # GET/POST /admin/usuarios, POST .../desactivar
    views/
      login.ejs                       # formulario de login
      tareas/index.ejs                  # port de V3.2 + V3.3 — lista, crear, filtrar, cambiar estado
      admin/usuarios.ejs                 # panel de administración de usuarios
    db/
      schema.ts                           # tabla tasks (Drizzle)
      auth-schema.ts                       # GENERADO por `pnpm auth:generate` — user/session/account/verification
      client.ts                             # pool de pg + cliente drizzle (schema combinado)
      seed.ts                                # admin de desarrollo + tarea de ejemplo
      tasks-repo.ts                            # createTask, listTasks, filterTasks, updateStatus
  tests/
    smoke/health.test.ts
    auth/session.test.ts
    db/tasks-repo.test.ts
    routes/tasks.test.ts
    routes/tasks-filtros.test.ts
    routes/admin.test.ts
    middleware/error-handler.test.ts
    middleware/authorize.test.ts
    e2e/flujo-completo.spec.ts
  drizzle/                    # migraciones SQL generadas — nombre lo pone drizzle-kit, nunca a mano
  blueprints/
    ai-academy-centro-control/   # este bundle — queda dentro del proyecto a propósito (ver §19.6)
  .github/workflows/ci.yml
  .claude/
    settings.json
    skills/add-ejs-view/SKILL.md
    skills/add-task-status/SKILL.md
    rules/db-and-auth.md
    rules/views-and-routes.md
  package.json
  tsconfig.json
  tsconfig.build.json
  biome.json
  drizzle.config.ts
  docker-compose.yml
  vitest.config.ts
  playwright.config.ts
  .env.example
  .gitignore
  CLAUDE.md
  AGENTS.md
  README.md
```

### Delta (brownfield)

Todo el árbol de arriba es nuevo — los dos archivos HTML originales (`AI_Academy_V3_2_Crear_
Tarea.html`, `AI_Academy_V3_3_Filtros_Estados.html`) no se tocan ni se borran; quedan en la raíz
del repo como referencia histórica del diseño. Ningún step de §9 los modifica.

**Boundary rules**

- Nada en `src/routes/**` abre una conexión a la base — solo pasa por un repo en `src/db/*-repo.ts`.
- `src/db/*-repo.ts` es el único lugar que llama a `db.select()/insert()/update()`.
- Los imports relativos usan siempre la extensión `.ts` (`./app.ts`) — ver la matriz de resolución
  en §19.6, verificada en los cuatro contextos que existen en este proyecto (fuente, tests,
  script standalone, build).

---

## 4. Data Model

### Entities

**`tasks`** — una tarea de trabajo del equipo.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default random | — |
| `title` | text | not null | título de la tarea |
| `status` | text | not null, default `'pendiente'` | sin enum a nivel DB a propósito — Zod es el gate (ver `.claude/skills/add-task-status/SKILL.md`) |
| `created_at` | timestamptz | not null, default now() | — |
| `updated_at` | timestamptz | not null, default now() | — |

**`user`** (generada por `better-auth`) — cuenta de acceso.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | PK | id de better-auth |
| `name` | text | not null | — |
| `email` | text | not null, unique | — |
| `email_verified` | boolean | default false | no usado en v1 (no hay flujo de verificación por email) |
| `image` | text | nullable | no usado en v1 |
| `created_at`/`updated_at` | timestamp | not null | — |
| `role` | text | default `'usuario'`, `input: false` | **additionalField** — inalcanzable desde el payload público de signup |
| `is_active` | boolean | default `true`, `input: false` | **additionalField** — solo una ruta de admin, server-side, la cambia |

**`session`, `account`, `verification`** (generadas por `better-auth`) — forma estándar de la
librería: sesiones por cookie, credenciales de email/contraseña, tokens de verificación. Nunca se
editan a mano — ver `.claude/rules/db-and-auth.md`.

### Relationships

- `session` —(N:1)→ `user`, `on delete cascade` (borrar un usuario borra sus sesiones).
- `account` —(N:1)→ `user`, `on delete cascade` (guarda el hash de contraseña del flujo email).
- `tasks` no tiene FK a `user` en v1 — las tareas son del equipo, no de un dueño individual (los
  mockups originales no modelan "asignado a"; agregarlo es un Non-Goal implícito, revisitar si se
  pide asignación por persona).

### Indexes

| Table | Index | Why |
|---|---|---|
| `session` | `user_id` | `attachSession()` busca por usuario en cada request |
| `account` | `user_id` | login por email/contraseña busca la cuenta del usuario |
| `verification` | `identifier` | lookup de tokens (infraestructura de better-auth, no usada activamente en v1) |

### Schema

```ts
// src/db/schema.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pendiente"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

Formato exacto verificado contra `pnpm format` (Biome 2.6.5) — pegar este bloque tal cual deja
`pnpm lint` en verde sin necesitar un segundo paso de formateo.

`src/db/auth-schema.ts` no se escribe a mano — lo emite `pnpm auth:generate` leyendo
`src/lib/auth.ts`. Verificado en vivo (comando real, versión pinneada en §11): produce `user`,
`session`, `account`, `verification`, con `user.role` y `user.isActive` como columnas reales que
reflejan los `additionalFields` configurados.

### Migrations

`drizzle-kit generate` lee `drizzle.config.ts` (cuyo `schema` apunta a `src/db/schema.ts` +, desde
el step 3, también a `src/db/auth-schema.ts`) y escribe un archivo SQL en `drizzle/` con un nombre
que el propio generador elige (un codename aleatorio con prefijo numérico — nunca inventar ese
nombre). `drizzle-kit migrate` las aplica contra `DATABASE_URL`. Ambos comandos cargan `.env` por
su cuenta — verificado empíricamente (ver §19.6).

### Seed data

`pnpm db:seed` (`src/db/seed.ts`) crea un usuario de desarrollo vía `auth.api.signUpEmail`, le pone
`role="admin"` con un `UPDATE` directo (porque el campo no es alcanzable desde el signup público), y
agrega una tarea de ejemplo. Es idempotente: una segunda corrida no duplica el admin.

---

## 5. API Design

### Conventions

- Base path: ninguno — esta es una app de páginas server-rendered, no una API versionada. Las
  rutas de mutación (`POST /tareas`, `POST /tareas/:id/estado`, `POST /admin/usuarios`,
  `POST /admin/usuarios/:id/desactivar`) responden con un **redirect** (páginas) salvo que la
  validación falle.
- Response envelope en el error handler (ver §9, step 9): `{ "success": false, "error": <mensaje> }`
  a 400/403/404/500. Las rutas de página que funcionan correctamente responden HTML o un `redirect`,
  nunca el envelope.
- Validación: Zod, schemas en `src/schemas/**`, siempre llamado antes de tocar un repo.
- Paginación: NOT APPLICABLE en v1 — el volumen esperado de tareas de un equipo chico no la
  justifica; revisitar si una lista supera unas pocas centenas de filas.
- Idempotencia: `POST /tareas/:id/estado` es naturalmente idempotente (fija un estado, no lo
  incrementa). `pnpm db:seed` es idempotente por diseño (ver §4).
- Rate limiting: NOT APPLICABLE en v1 — acceso interno, sin exposición pública; revisitar si la
  herramienta se expone fuera de la red del equipo.

### Routes

| Method | Path | Description | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/health` | healthcheck | público | — |
| GET/POST | `/api/auth/*splat` | manejado por better-auth (sign-in, sign-up, sign-out, sesión) | público (el propio handler decide) | — |
| GET | `/login` | formulario de login | público | — |
| GET | `/tareas` | lista + filtro por `estado` | sesión | — |
| POST | `/tareas` | crear tarea | sesión | — |
| POST | `/tareas/:id/estado` | cambiar estado | sesión | — |
| GET | `/admin/usuarios` | lista de usuarios | `admin` | — |
| POST | `/admin/usuarios` | crear usuario | `admin` | — |
| POST | `/admin/usuarios/:id/desactivar` | desactivar usuario | `admin` | — |

### Critical endpoints — full detail

**`POST /tareas`**
- Request: `{ title: string }` (form-urlencoded).
- Validación: `z.object({ title: z.string().min(1).max(200) })`.
- 400 si `title` vacío o ausente — no crea fila.
- 303 + redirect a `/tareas` si crea correctamente.
- Efecto: una fila en `tasks` con `status="pendiente"`.

**`POST /tareas/:id/estado`**
- Request: `{ status: "pendiente" | "en_progreso" | "completada" }`.
- Validación: enum Zod — 400 si el valor no es uno de los tres.
- 404 si `:id` no existe — `updateStatus` devuelve `undefined`.
- Efecto: actualiza solo esa fila; el resto de `tasks` queda sin cambios (asserted en §9 step 7).

**`POST /admin/usuarios`**
- Request: `{ email: string, password: string, name: string }`.
- Validación: `z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1) })`.
- Llama a `auth.api.signUpEmail` — el nuevo usuario queda con `role="usuario"` (default del campo,
  inalcanzable desde este payload).
- Guard: `authorize("admin")` — 403 si quien llama no es admin.

**`POST /admin/usuarios/:id/desactivar`**
- Guard: `authorize("admin")`.
- Efecto: `UPDATE user SET is_active = false WHERE id = :id`.

---

## 6. Frontend Architecture

### Routes

| Route | Page | Data source | Auth |
|---|---|---|---|
| `/login` | Login | — | público |
| `/tareas` | Centro de control — tareas | `listTasks()`/`filterTasks()` | sesión |
| `/admin/usuarios` | Administración de usuarios | `db.select().from(user)` | `admin` |

### Rendering strategy

100% server-rendered con EJS — sin hidratación de cliente, sin bundler de frontend. El único
JavaScript de cliente es el `fetch()` del formulario de login hacia `/api/auth/sign-in/email` (la
API de better-auth no acepta un POST de formulario tradicional) y los botones de cambio de estado
en `/tareas`, que hacen un `fetch()` a `POST /tareas/:id/estado` y luego recargan la lista — sin
framework de cliente, inline en la vista.

### Component hierarchy

```
views/
  tareas/index.ejs
    partial: sidebar (misma estructura que los mockups V3.2/V3.3)
    partial: formulario "crear tarea"
    partial: controles de filtro por estado
    partial: tabla/lista de tareas con badge de estado
  admin/usuarios.ejs
    partial: sidebar (mismo componente, reusado)
    partial: formulario "crear usuario"
    partial: tabla de usuarios con botón "desactivar"
```

### State management

Todo el estado vive en el servidor (Postgres) y se re-renderiza en cada request. No hay estado de
cliente persistente más allá del cookie de sesión de better-auth.

### Loading, empty, and error states

- Lista de tareas vacía: la vista renderiza un mensaje ("Sin tareas todavía") en vez de una tabla
  vacía — asserted en `tests/routes/tasks.test.ts`.
- Error de validación en el formulario de crear tarea: la vista re-renderiza el formulario con el
  mensaje de error del `error-handler` (step 9), sin perder el resto de la lista.
- Lista de usuarios vacía: no ocurre en la práctica (siempre hay al menos el admin semillado), no
  se construye un estado dedicado para ese caso.

---

## 7. Design System

Portado literal de los dos prototipos HTML existentes — mismos valores, no una reinterpretación.

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--primary` | `#7346CC` | `#7346CC` | botones primarios, enlaces, foco |
| `--primary-dark` | `#5A37A5` | `#5A37A5` | hover de primario |
| `--nav` | `#1D1930` | `#1D1930` | sidebar |
| `--navlight` | `#302844` | `#302844` | hover en sidebar |
| `--lav` | `#F0EBFB` | `#F0EBFB` | fondos sutiles de acento |
| `--bg` | `#F7F8FC` | `#F7F8FC` | fondo de página |
| `--paper` | `#FFF` | `#FFF` | tarjetas, paneles |
| `--line` | `#E9E8F0` | `#E9E8F0` | divisores, inputs |
| `--ink` | `#252138` | `#252138` | texto principal |
| `--text` | `#5A566B` | `#5A566B` | texto secundario |
| `--muted` | `#898699` | `#898699` | placeholders |
| `--green` / `--greenlight` | `#178168` / `#E7F6F0` | — | estado "completada" |
| `--orange` / `--orangelight` | `#AB702B` / `#FFF1DE` | — | estado "en progreso" |
| `--red` / `--redlight` | `#BD4565` / `#FCEBF0` | — | errores, estado bloqueado |
| `--blue` / `--bluelight` | `#486FA8` / `#EAF1FC` | — | avisos neutrales |

No hay modo oscuro en los mockups originales — v1 mantiene un único tema, igual que ellos (Non-Goal
implícito: dark mode queda para cuando alguien lo pida).

**Contrast:** `--ink` (#252138) sobre `--bg` (#F7F8FC) ≈ 14.6:1 — muy por encima de AA. `--text`
(#5A566B) sobre `--paper` (#FFF) ≈ 5.3:1 — pasa el 4.5:1 de texto de cuerpo. El par más riesgoso,
`--muted` (#898699) sobre `--paper`, ≈ 3.9:1 — por debajo del 4.5:1 de AA para texto normal; se usa
solo en placeholders (no en texto de contenido), que WCAG no exige al mismo nivel, pero si se
reusa para texto de cuerpo en una pantalla nueva, oscurecerlo primero.

### Typography

| Role | Family | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Body | Poppins, "Segoe UI", Arial, sans-serif | 13px / normal | 400 | normal |
| Heading (brand) | Poppins | 16-17px | 850 | `-0.02em`/`-0.03em` |
| Nav heading | Poppins | 9px | 750 | `0.14em` |

**Font loading:** Google Fonts (como en el HTML original) o self-hosted — cualquiera de las dos es
válida; v1 reusa el `<link>` de Google Fonts de los mockups para no introducir una dependencia
nueva de build.

### Spacing, radius, elevation

- Radius: `10px` botones de sidebar, `13px` tarjetas/brandmark, `50%` avatares.
- Shadow: `0 6px 24px rgba(25,20,45,.035)` (el único nivel de elevación usado en los mockups).
- Max content width: `1720px` · sidebar fijo `245px`.

### Motion

Ninguna animación no trivial en los mockups originales — v1 no agrega ninguna. Si se agrega
transición en un paso futuro, respetar `prefers-reduced-motion: reduce`.

### Component style

Panel administrativo denso, sidebar oscuro fijo + contenido claro, tarjetas con sombra sutil,
tipografía Poppins — el estilo "SaaS B2B" ya establecido por los dos mockups. Referencia: los
propios `AI_Academy_V3_2_Crear_Tarea.html` y `AI_Academy_V3_3_Filtros_Estados.html` en la raíz del
repo.

---

## 8. Authentication & Authorization

### Provider and rationale

`better-auth`, self-hosted, adapter de Drizzle sobre la misma Postgres de la app — ver
`knowledge/capabilities/auth.md`: rung 1 (columna de rol) es suficiente para 2 roles sin UI de
permisos custom.

### Flows

- **Login:** `GET /login` renderiza el formulario → `fetch()` cliente a `POST /api/auth/sign-in/
  email` (manejado enteramente por better-auth) → cookie de sesión → redirect a `/tareas`.
- **Logout:** botón que hace `fetch()` a `POST /api/auth/sign-out` (better-auth) → redirect a
  `/login`.
- **Expiración de sesión:** default de better-auth (sesión de 7 días, renovable); una sesión
  vencida en una ruta protegida redirige a `/login`.
- No hay signup público, ni reset de contraseña, ni borrado de cuenta en v1 — ver Non-Goals.

### Route protection

| Surface | Rule | Enforced where |
|---|---|---|
| `/tareas`, `POST /tareas`, `POST /tareas/:id/estado` | sesión válida | `src/middleware/session.ts` (`attachSession`) en `src/app.ts` |
| `/admin/usuarios*` | `role === "admin"` | `src/middleware/authorize.ts` (`authorize("admin")`), montado solo en el router de admin |

**Enforcement rule:** la autorización se chequea server-side en cada request. Ocultar un botón en
la vista no es un permiso — `authorize()` corre antes de que el handler se ejecute.

### Roles and permissions

| Role | Can | Cannot |
|---|---|---|
| `usuario` | Crear/listar/filtrar/cambiar estado de tareas | Ver o tocar `/admin/usuarios` |
| `admin` | Todo lo de `usuario`, más: crear y desactivar usuarios | — |

### Sessions

Cookie `httpOnly` + `Secure` (en producción) + `SameSite=Lax`, gestionada enteramente por
`better-auth`. Revocación: borrar la fila de `session` (better-auth expone esto vía su propia API;
no se construye una UI de "cerrar sesión en todos los dispositivos" en v1 — Non-Goal implícito).

### Multi-tenancy / row-level isolation

NOT APPLICABLE — un solo equipo, sin concepto de organización en v1 (ver Non-Goals).

---

## 9. BUILD ORDER

12 steps, 0 a desplegable. Divididos en 2 épicas (`01-foundation`, 6 steps; `02-interface-
hardening`, 6 steps) — el detalle completo de cada step, idéntico al de abajo, también vive en
`epics/01-foundation.md` y `epics/02-interface-hardening.md` para que un builder sin contexto
pueda trabajar un épico sin abrir este archivo.

### Step map

| # | Step | Depends on | Touches | Gate |
|---|---|---|---|---|
| 1 | Scaffold + health entry point | — | `src/app.ts`, `src/server.ts`, `src/routes/health.ts`, `tests/smoke/health.test.ts` | `pnpm test tests/smoke/health.test.ts` + correr `dist/server.js` de verdad |
| 2 | Tasks schema + Postgres local | 1 | `src/db/schema.ts`, `src/db/client.ts` | `psql` confirma la tabla `tasks` |
| 3 | better-auth + role/isActive | 2 | `src/lib/auth.ts`, `src/db/auth-schema.ts`, `drizzle.config.ts`, `src/db/client.ts` | `psql` confirma las 5 tablas |
| 4 | Login + sesión + guard de rol | 3 | `src/app.ts`, `src/middleware/session.ts`, `src/middleware/authorize.ts`, `src/views/login.ejs`, `tests/auth/session.test.ts` | `pnpm test tests/auth/session.test.ts` |
| 5 | Seed + repo de tareas | 4 | `src/db/seed.ts`, `src/db/tasks-repo.ts`, `tests/db/tasks-repo.test.ts` | `pnpm test tests/db/tasks-repo.test.ts` |
| 6 | Crear Tarea (port V3.2) | 5 | `src/routes/tasks.ts`, `src/views/tareas/index.ejs`, `src/schemas/task.ts`, `src/app.ts`, `tests/routes/tasks.test.ts` | `pnpm test tests/routes/tasks.test.ts` |
| 7 | Filtros y estados (port V3.3) | 6 | `src/db/tasks-repo.ts`, `src/routes/tasks.ts`, `src/views/tareas/index.ejs`, `src/schemas/task.ts`, `tests/routes/tasks-filtros.test.ts` | `pnpm test tests/routes/tasks-filtros.test.ts` |
| 8 | Panel admin de usuarios | 4 | `src/routes/admin.ts`, `src/views/admin/usuarios.ejs`, `src/schemas/admin.ts`, `src/app.ts`, `tests/routes/admin.test.ts` | `pnpm test tests/routes/admin.test.ts` |
| 9 | Error handler centralizado | 7, 8 | `src/middleware/error-handler.ts`, `src/lib/http-error.ts`, `src/app.ts`, `tests/middleware/error-handler.test.ts` | `pnpm test tests/middleware/error-handler.test.ts` |
| 10 | Tests de authorize() + suite completa | 9 | `tests/middleware/authorize.test.ts`, `tests/db/tasks-repo.test.ts` | `pnpm test` (toda la suite) |
| 11 | E2E flujo completo | 10 | `tests/e2e/flujo-completo.spec.ts` | `pnpm test:e2e` |
| 12 | CI + README + gate final | 11 | `.github/workflows/ci.yml`, `README.md` | el gate completo de §20.1 |

Steps 7 y 8 dependen solo de steps anteriores distintos entre sí (7 de 6, 8 de 4) — pueden
construirse en paralelo antes de converger en el step 9.

---

### Step 1 — Scaffold Express app and run the health entry point

**Do**
Crear el servidor más chico posible que corra de verdad. `src/routes/health.ts` exporta un
`Router` de Express con un único `GET /health` que responde `{ status: "ok" }`. `src/app.ts`
exporta `createApp()`, que construye el `express()` y monta ese router — nada más todavía.
`src/server.ts` importa `createApp`, lee `PORT` de `process.env` (default `3000`), y llama a
`app.listen`. Este es el entry point que corre cada step después — se ejercita acá mismo, de
verdad, no solo se compila (regla 13).

Archivos: `src/app.ts`, `src/server.ts`, `src/routes/health.ts`, `tests/smoke/health.test.ts`
(este último usa `supertest(createApp())`, el pin de §11).

**Done when**
- [ ] WHEN GET /health es solicitado THE SYSTEM SHALL responder 200 con body `{"status":"ok"}`.
- [ ] WHEN el servidor arranca sin PORT seteado THE SYSTEM SHALL usar 3000 por default.
- [ ] WHEN `pnpm typecheck` corre THE SYSTEM SHALL salir con exit 0.

**Verify**
```bash
pnpm install --frozen-lockfile                    # expect: exit 0
pnpm typecheck                                     # expect: exit 0
pnpm lint                                          # expect: exit 0
pnpm build                                          # expect: exit 0, dist/server.js existe
pnpm test tests/smoke/health.test.ts                 # expect: exit 0, 1 passed
node --env-file=.env dist/server.js & pid=$!; sleep 1; code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"; kill "$pid" 2>/dev/null || true; test "$code" = "200"
                                                        # expect: exit 0 — el binario construido responde 200 de verdad
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: scaffold"
git tag step-01-scaffold
```

### Step 2 — Add tasks schema and apply it to a local Postgres

**Do**
`src/db/schema.ts` define la tabla `tasks` con `pgTable` de Drizzle — el bloque completo está en
§4. `src/db/client.ts` crea un `pg.Pool` desde `DATABASE_URL` y exporta el cliente `drizzle()`.
`drizzle.config.ts` ya existe (de `workspace/`) apuntando solo a `./src/db/schema.ts` — se deja así
en este step, step 3 lo extiende.

Archivos: `src/db/schema.ts`, `src/db/client.ts`.

**Done when**
- [ ] WHEN `pnpm db:up` corre THE SYSTEM SHALL levantar Postgres y reportarlo healthy.
- [ ] WHEN `pnpm db:generate && pnpm db:migrate` corren contra la base vacía THE SYSTEM SHALL crear
      la tabla `tasks`.
- [ ] WHEN `pnpm db:migrate` corre una segunda vez sin migraciones nuevas THE SYSTEM SHALL salir
      con exit 0 sin aplicar nada más.

**Verify**
```bash
pnpm lint                                                             # expect: exit 0
pnpm db:up                                                            # expect: exit 0, contenedor healthy
pnpm db:generate                                                       # expect: exit 0, 1 archivo SQL nuevo en drizzle/
pnpm db:migrate                                                         # expect: exit 0
docker compose exec -T db psql -U app -d ai_academy -tAc "select to_regclass('public.tasks') is not null" | grep -qx t
                                                                          # expect: exit 0 — la tabla existe
pnpm db:migrate                                                          # expect: exit 0 — idempotente
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: db schema"
git tag step-02-db-schema
```

### Step 3 — Wire better-auth with the role and isActive fields

**Do**
`src/lib/auth.ts` llama a `betterAuth({ database: drizzleAdapter(db, { provider: "pg", schema }),
emailAndPassword: { enabled: true }, user: { additionalFields: { role: { type: "string",
defaultValue: "usuario", input: false }, isActive: { type: "boolean", defaultValue: true, input:
false } } } })`, donde `schema` es el objeto combinado `{ ...appSchema, ...authSchema }` —
**importar `src/db/auth-schema.ts` aunque todavía no exista; se crea en el siguiente comando de
este mismo step, antes de que nada lo importe de verdad.** Correr `pnpm auth:generate` para
producirlo. Editar `drizzle.config.ts`: el campo `schema` pasa de string a
`["./src/db/schema.ts", "./src/db/auth-schema.ts"]`. Editar `src/db/client.ts` para pasar el schema
combinado también a `drizzle()`. Regenerar y migrar.

Archivos: `src/lib/auth.ts`, `src/db/auth-schema.ts` (generado — nunca escribir su contenido a
mano), `drizzle.config.ts` (edit), `src/db/client.ts` (edit).

**Done when**
- [ ] WHEN `pnpm auth:generate` corre THE SYSTEM SHALL emitir `src/db/auth-schema.ts` definiendo
      `user`, `session`, `account`, y `verification`, con `user.role` default `"usuario"` y
      `user.isActive` default `true`.
- [ ] WHEN `pnpm db:generate && pnpm db:migrate` corren después de regenerar THE SYSTEM SHALL crear
      `tasks`, `user`, `session`, `account`, y `verification`, las cinco.
- [ ] WHEN `pnpm db:migrate` corre una segunda vez THE SYSTEM SHALL salir con exit 0 sin nada más
      que aplicar.

**Verify**
```bash
pnpm lint                                               # expect: exit 0
pnpm auth:generate                                      # expect: exit 0, src/db/auth-schema.ts escrito
pnpm db:generate                                         # expect: exit 0
pnpm db:migrate                                            # expect: exit 0
docker compose exec -T db psql -U app -d ai_academy -tAc "select to_regclass('public.tasks') is not null and to_regclass('public.user') is not null and to_regclass('public.session') is not null and to_regclass('public.account') is not null and to_regclass('public.verification') is not null" | grep -qx t
                                                             # expect: exit 0 — las cinco existen
pnpm db:migrate                                              # expect: exit 0 — idempotente
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: auth schema"
git tag step-03-auth-schema
```

### Step 4 — Add login page, session middleware, and role guard

**Do**
`src/middleware/session.ts` exporta `attachSession`, un middleware que llama a
`auth.api.getSession({ headers: new Headers(req.headers as Record<string, string>) })` y setea
`req.user` (o lo deja `undefined`). `src/middleware/authorize.ts` exporta `authorize(role)`, que
chequea `req.user?.role` y llama `next()` o `next(new HttpError(403, "forbidden"))` — construir
`HttpError` inline acá como una clase de dos campos si el step 9 todavía no corrió; ese step
después la mueve a `src/lib/http-error.ts` sin cambiar el comportamiento de este. `src/app.ts`
monta `toNodeHandler(auth)` en `app.all("/api/auth/*splat", ...)` **antes** de `express.json()`,
luego `attachSession` global, luego un `GET /login` que renderiza `src/views/login.ejs` — un
formulario simple que hace `fetch()` client-side a `POST /api/auth/sign-in/email` y redirige a
`/tareas` si tiene éxito.

Archivos: `src/app.ts` (edit), `src/middleware/session.ts`, `src/middleware/authorize.ts`,
`src/views/login.ejs`, `tests/auth/session.test.ts`.

**Done when**
- [ ] WHEN GET /login es solicitado sin sesión THE SYSTEM SHALL renderizar el formulario con
      status 200.
- [ ] WHEN una cookie de sesión válida llega a una ruta detrás de `attachSession()` THE SYSTEM
      SHALL setear `req.user` con su `role` e `isActive`.
- [ ] WHEN `authorize("admin")` guarda una ruta y una sesión con role `usuario` la golpea THE
      SYSTEM SHALL responder 403.
- [ ] WHEN ninguna sesión llega a una ruta de página detrás de `attachSession()` que la requiere
      THE SYSTEM SHALL redirigir a /login.

**Verify**
```bash
pnpm typecheck                               # expect: exit 0
pnpm lint                                     # expect: exit 0
pnpm test tests/auth/session.test.ts          # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 4: login and session guard"
git tag step-04-login-session
```

### Step 5 — Seed an admin user and add the tasks repository

**Do**
`src/db/seed.ts` llama a `auth.api.signUpEmail` con un email/contraseña fijos de desarrollo, luego
— porque `role` e `isActive` son `input: false` y no se pueden setear desde ese llamado — hace un
`db.update(user).set({ role: "admin" }).where(eq(user.email, ...))`, guardado contra re-ejecución
(si la fila ya existe, no la duplica). Inserta una tarea de ejemplo vía `createTask`.
`src/db/tasks-repo.ts` exporta `createTask`, `listTasks` (ordenado por `createdAt` desc), y un
`updateStatus` placeholder que el step 7 completa.

Archivos: `src/db/seed.ts`, `src/db/tasks-repo.ts`, `tests/db/tasks-repo.test.ts`.

**Done when**
- [ ] WHEN `pnpm db:seed` corre THE SYSTEM SHALL crear exactamente una fila `user` con
      `role='admin'` y al menos una fila `tasks` de ejemplo.
- [ ] WHEN `pnpm db:seed` corre una segunda vez THE SYSTEM SHALL dejar exactamente una fila admin
      (sin duplicar por email).
- [ ] WHEN `createTask({ title })` es llamado THE SYSTEM SHALL insertar una fila con `status`
      default `"pendiente"`.
- [ ] WHEN `listTasks()` es llamado THE SYSTEM SHALL devolver las tareas ordenadas por `createdAt`
      descendente.

**Verify**
```bash
pnpm lint                                                                                   # expect: exit 0
pnpm db:seed                                                                                # expect: exit 0
docker compose exec -T db psql -U app -d ai_academy -tAc "select count(*) from \"user\" where role='admin'" | grep -qx 1
                                                                                               # expect: exit 0
pnpm db:seed                                                                                   # expect: exit 0 — idempotente
docker compose exec -T db psql -U app -d ai_academy -tAc "select count(*) from \"user\" where role='admin'" | grep -qx 1
                                                                                                  # expect: exit 0 — sigue siendo 1
pnpm test tests/db/tasks-repo.test.ts                                                             # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 5: seed and tasks repo"
git tag step-05-seed-tasks-repo
```

### Step 6 — Add Crear Tarea page wired to real task data

**Do**
Portar el layout y el markup de `AI_Academy_V3_2_Crear_Tarea.html` a `src/views/tareas/index.ejs`,
reusando los tokens de §7 — mismo shell de sidebar, misma envoltura de tarjetas, ahora alimentado
por filas reales en vez del array hardcodeado del mock. `src/schemas/task.ts` exporta un schema
Zod para el formulario de creación (`title: z.string().min(1).max(200)`). `src/routes/tasks.ts`
agrega `GET /tareas` (detrás de `attachSession`, redirigiendo a `/login` si no hay sesión)
llamando a `listTasks()`, y `POST /tareas` parseando el body con ese schema, llamando a
`createTask`, y redirigiendo 303 a `/tareas` — una falla de parseo responde 400 sin escribir nada.
`src/app.ts` monta el router y agrega `express.urlencoded({ extended: true })` para el POST del
formulario.

Archivos: `src/routes/tasks.ts`, `src/views/tareas/index.ejs`, `src/schemas/task.ts`, `src/app.ts`
(edit), `tests/routes/tasks.test.ts`.

**Done when**
- [ ] WHEN un usuario autenticado GETea /tareas THE SYSTEM SHALL renderizar la lista con status
      200.
- [ ] WHEN una request sin autenticar GETea /tareas THE SYSTEM SHALL redirigir a /login.
- [ ] WHEN POST /tareas llega con un `title` válido THE SYSTEM SHALL crear la tarea y redirigir a
      /tareas con status 303.
- [ ] WHEN POST /tareas llega con `title` vacío THE SYSTEM SHALL responder 400 sin crear fila.

**Verify**
```bash
pnpm typecheck                               # expect: exit 0
pnpm lint                                     # expect: exit 0
pnpm test tests/routes/tasks.test.ts          # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 6: crear tarea"
git tag step-06-crear-tarea
```

### Step 7 — Add filtros and cambio de estado to the tasks page

**Do**
Portar la fila de filtros y los badges de estado de `AI_Academy_V3_3_Filtros_Estados.html` a
`src/views/tareas/index.ejs`, reusando los mismos tokens. Agregar `filterTasks({ status })` y
`updateStatus(id, status)` a `src/db/tasks-repo.ts` — `updateStatus` devuelve la fila actualizada o
`undefined` si el id no coincide. Extender `src/schemas/task.ts` con un enum de estado
(`"pendiente" | "en_progreso" | "completada"`) usado tanto por un nuevo schema de query-string
para `GET /tareas` como por un schema de body para `POST /tareas/:id/estado`. `src/routes/tasks.ts`
agrega el parseo de query al handler existente de `GET /tareas` y la nueva ruta `POST
/tareas/:id/estado`, respondiendo 404 cuando `updateStatus` devuelve `undefined`.

Archivos: `src/db/tasks-repo.ts` (edit), `src/routes/tasks.ts` (edit), `src/views/tareas/index.ejs`
(edit), `src/schemas/task.ts` (edit), `tests/routes/tasks-filtros.test.ts`.

**Done when**
- [ ] WHEN GET /tareas?estado=completada es solicitado THE SYSTEM SHALL devolver solo tareas cuyo
      status sea `completada`.
- [ ] WHEN GET /tareas?estado=bogus es solicitado THE SYSTEM SHALL responder 400.
- [ ] WHEN POST /tareas/:id/estado fija un estado válido THE SYSTEM SHALL actualizar esa tarea y
      dejar el resto sin cambios.
- [ ] WHEN POST /tareas/:id/estado apunta a un id inexistente THE SYSTEM SHALL responder 404.

**Verify**
```bash
pnpm typecheck                                        # expect: exit 0
pnpm lint                                              # expect: exit 0
pnpm test tests/routes/tasks-filtros.test.ts           # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 7: filtros y estados"
git tag step-07-filtros-estados
```

### Step 8 — Add admin user management page

**Do**
`src/schemas/admin.ts` exporta un schema Zod para crear usuario (`email`, `password`, `name`).
`src/routes/admin.ts`, detrás de `authorize("admin")`, agrega `GET /admin/usuarios` (lista cada
fila `user`), `POST /admin/usuarios` (llama a `auth.api.signUpEmail` — la fila nueva queda con
`role="usuario"` por el default del campo, ya que el path público de signup no puede setearlo), y
`POST /admin/usuarios/:id/desactivar` (`db.update(user).set({ isActive: false })`).
`src/views/admin/usuarios.ejs` renderiza la lista y el formulario de creación, mismo shell y
tokens que `tareas/index.ejs`.

Archivos: `src/routes/admin.ts`, `src/views/admin/usuarios.ejs`, `src/schemas/admin.ts`,
`src/app.ts` (edit), `tests/routes/admin.test.ts`.

**Done when**
- [ ] WHEN una sesión con role `admin` GETea /admin/usuarios THE SYSTEM SHALL renderizar la lista
      con status 200.
- [ ] WHEN una sesión con role `usuario` GETea /admin/usuarios THE SYSTEM SHALL responder 403.
- [ ] WHEN POST /admin/usuarios crea un usuario con email/contraseña válidos THE SYSTEM SHALL
      crearlo con `role="usuario"`.
- [ ] WHEN POST /admin/usuarios/:id/desactivar es llamado sobre un usuario existente THE SYSTEM
      SHALL fijar `isActive=false` para ese usuario.

**Verify**
```bash
pnpm typecheck                              # expect: exit 0
pnpm lint                                    # expect: exit 0
pnpm test tests/routes/admin.test.ts         # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 8: admin usuarios"
git tag step-08-admin-usuarios
```

### Step 9 — Add a centralized error-handling safety net

**Do**
`src/lib/http-error.ts` exporta una clase chica `HttpError extends Error` con un campo
`status: number`. `src/middleware/error-handler.ts` exporta un middleware de error de Express de
4 argumentos: un `ZodError` se convierte en `{ success: false, error: <mensaje del primer issue>
}` a 400; un `HttpError` responde con su propio `status` y `message`; cualquier otra cosa responde
500 con un body genérico — el mensaje real y el stack se loguean server-side, nunca se envían al
cliente, sin importar `NODE_ENV`. `src/app.ts` lo monta al final, después de cada router.

Archivos: `src/middleware/error-handler.ts`, `src/lib/http-error.ts`, `src/app.ts` (edit),
`tests/middleware/error-handler.test.ts`.

**Done when**
- [ ] WHEN un handler lanza un `ZodError` THE SYSTEM SHALL responder 400 con
      `{ "success": false, "error": <mensaje> }`.
- [ ] WHEN un handler lanza `new HttpError(404, "...")` THE SYSTEM SHALL responder con status 404
      y ese mensaje.
- [ ] WHEN un handler lanza un `Error` inesperado THE SYSTEM SHALL responder 500 con un body
      genérico, nunca el stack trace real.

**Verify**
```bash
pnpm typecheck                                      # expect: exit 0
pnpm lint                                            # expect: exit 0
pnpm test tests/middleware/error-handler.test.ts     # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 9: error handler"
git tag step-09-error-handler
```

### Step 10 — Add authorize() unit tests and run the full suite together

**Do**
`tests/middleware/authorize.test.ts` aísla `authorize()` con objetos `req`/`res`/`next` falsos —
sin HTTP, sin base de datos. Agregar a `tests/db/tasks-repo.test.ts` un caso que asegure que
`updateStatus` sobre un id inexistente devuelve `undefined` y no escribe fila. Después correr toda
la suite una vez, junta, como el propio gate de este step — ningún step anterior corrió todos los
archivos de test a la vez.

Archivos: `tests/middleware/authorize.test.ts`, `tests/db/tasks-repo.test.ts` (edit).

**Done when**
- [ ] WHEN `authorize("admin")` es llamado con un actor de role `usuario` THE SYSTEM SHALL llamar
      `next(new HttpError(403, ...))` y nunca llamar al handler de la ruta.
- [ ] WHEN `authorize("admin")` es llamado con un actor de role `admin` THE SYSTEM SHALL llamar
      `next()` sin argumento.
- [ ] WHEN `updateStatus` apunta a un id de tarea inexistente THE SYSTEM SHALL devolver
      `undefined` sin escribir fila.
- [ ] WHEN la suite completa corre vía `pnpm test` THE SYSTEM SHALL reportar 0 failed y 0 skipped.

**Verify**
```bash
pnpm lint                                        # expect: exit 0
pnpm test tests/middleware/authorize.test.ts   # expect: exit 0
pnpm test tests/db/tasks-repo.test.ts           # expect: exit 0
pnpm test                                        # expect: exit 0, 0 failed, 0 skipped
```

**Checkpoint**
```bash
git add -A && git commit -m "step 10: authorize tests and full suite"
git tag step-10-unit-coverage
```

### Step 11 — Add the end-to-end login-to-admin flow

**Do**
`tests/e2e/flujo-completo.spec.ts`: iniciar sesión como el admin semillado (las credenciales fijas
de `pnpm db:seed`) a través del formulario real de `/login`, caer en `/tareas`, crear "Tarea E2E"
a través del formulario, filtrar por `estado=pendiente` y encontrarla, cambiar su estado a
`completada` a través del control de la UI, luego visitar `/admin/usuarios` y crear un usuario
nuevo — verificando que aparece con `role="usuario"`. Un solo archivo de spec, cinco assertions,
cada una mapeada 1:1 a una línea de aceptación de abajo.

Archivos: `tests/e2e/flujo-completo.spec.ts`.

**Done when**
- [ ] WHEN el admin semillado inicia sesión por la UI THE SYSTEM SHALL redirigir a /tareas.
- [ ] WHEN el admin crea una tarea titulada "Tarea E2E" por el formulario THE SYSTEM SHALL
      mostrarla en la lista con status `pendiente`.
- [ ] WHEN el admin filtra por `estado=pendiente` THE SYSTEM SHALL mostrar solo tareas con ese
      estado, incluyendo "Tarea E2E".
- [ ] WHEN el admin cambia el estado de "Tarea E2E" a `completada` THE SYSTEM SHALL reflejar el
      nuevo estado sin error en pantalla.
- [ ] WHEN el admin crea un usuario nuevo desde /admin/usuarios THE SYSTEM SHALL listarlo con role
      `usuario`.

**Verify**
```bash
pnpm lint                                               # expect: exit 0
pnpm exec playwright install --with-deps               # expect: exit 0 (no-op si ya están instalados)
pnpm test:e2e tests/e2e/flujo-completo.spec.ts           # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 11: e2e flujo completo"
git tag step-11-e2e-flujo
```

### Step 12 — Add CI workflow, README, and run the final gate

**Do**
`.github/workflows/ci.yml` corre en cada push: checkout, setup de pnpm, `docker compose up -d
--wait`, `pnpm install --frozen-lockfile`, `pnpm db:generate && pnpm db:migrate`, `pnpm typecheck`,
`pnpm lint`, `pnpm test`, `pnpm build` — en ese orden. `README.md` indica los comandos exactos para
`pnpm dev`, `pnpm test`, y `pnpm db:migrate` (copiados de la tabla de `CLAUDE.md`, no re-derivados).
Después correr el gate global una vez, local, como prueba de que cada step anterior sigue en pie
junto con los demás.

Archivos: `.github/workflows/ci.yml`, `README.md`.

**Done when**
- [ ] WHEN `.github/workflows/ci.yml` corre en un push THE SYSTEM SHALL ejecutar install,
      typecheck, lint, test, y build, en ese orden.
- [ ] WHEN README.md es leído THE SYSTEM SHALL indicar los comandos exactos de dev, test, y
      db:migrate.
- [ ] WHEN la secuencia completa del gate global corre localmente THE SYSTEM SHALL salir con exit
      0 de punta a punta, incluyendo el healthcheck contra el artefacto construido.

**Verify**
```bash
pnpm lint                                     # expect: exit 0
pnpm typecheck                                 # expect: exit 0
pnpm test                                       # expect: exit 0
pnpm build                                       # expect: exit 0
node --env-file=.env dist/server.js & pid=$!; sleep 1; code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"; kill "$pid" 2>/dev/null || true; test "$code" = "200"
                                                   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 12: ci and readme"
git tag step-12-ci-readme
```

---

### 9.1 Parity and cutover

`NOT APPLICABLE — greenfield build, no system is being replaced.` Los dos HTML existentes son
referencia de diseño estática, nunca un servicio corriendo con tráfico real que haya que cortar —
ver §1, Current state. No hay parity set, no hay shadow period, no hay cutover.

---

## 10. Environment Setup

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 24 LTS (ver §11) | `node -v` |
| pnpm | 12.16.1 (ver §11) | `pnpm -v` |
| Docker + Docker Compose | cualquiera con `docker compose` v2 | `docker compose version` |

### Accounts to create first

`NOT APPLICABLE` — ningún servicio de terceros requiere signup para v1; Postgres y la auth son
self-hosted.

### Environment variables

| Variable | Purpose | Where to get it | Required by step | Secret? |
|---|---|---|---|---|
| `PORT` | puerto HTTP de la app | — (default 3000) | 1 | no |
| `DATABASE_URL` | string de conexión a Postgres | `pnpm db:up` imprime el puerto; local: `postgresql://app:app@localhost:5433/ai_academy` | 2 | sí (en producción) |
| `BETTER_AUTH_SECRET` | firma las sesiones de better-auth | generar 32+ caracteres aleatorios | 3 | sí |
| `BETTER_AUTH_URL` | URL base que better-auth usa para cookies/redirects | `http://localhost:3000` en local | 3 | no |

`.env.example` está commiteado con las cuatro, con valores de desarrollo funcionales (no en blanco)
salvo el secreto, que lleva un placeholder explícito a reemplazar. `.env` está en `.gitignore`. La
app no tiene un validador de entorno centralizado — cada módulo lee la variable que necesita
(`src/server.ts` lee `PORT`, `src/db/client.ts` lee `DATABASE_URL`, `src/lib/auth.ts` lee las dos
de better-auth) exactamente desde el step que lo introduce, así que ningún step posterior rompe el
gate de uno anterior por una variable que todavía no existía (regla 9 de §9).

### Files that must be committed

| File | Why it is committed | Ignore-file exception line |
|---|---|---|
| `.env.example` | documenta cada variable con un valor de desarrollo usable | `!.env.example` después del patrón `.env*` en `.gitignore` |
| `drizzle/*.sql` | las migraciones son el historial real del schema | — no matched por ningún patrón de `.gitignore` |
| `.claude/**` | configuración del agente que construye el proyecto | — no matched por ningún patrón |
| `blueprints/ai-academy-centro-control/**` | este mismo bundle, como registro histórico de diseño | — no matched por ningún patrón (se excluye de las herramientas que caminan el árbol, pero no de git) |

### Bootstrap

```bash
# order matters: copia de workspace/ (trae .gitignore + sus excepciones, y cada config
# verify-critical de §19.6) → init de repo → primer commit → toolchain → install → assets de
# runners → servicios

rsync -a --ignore-existing blueprints/ai-academy-centro-control/workspace/ ./ \
  || cp -Rn blueprints/ai-academy-centro-control/workspace/. ./ || true
# nunca pisa un archivo que el build ya cambió desde entonces; sale 0 con cualquiera de las dos
# herramientas, incluso en una re-corrida donde todo ya está en su lugar

git rev-parse --git-dir >/dev/null 2>&1 || git init -b main   # idempotente: no-op si el scaffold ya lo hizo
[ -f .env ] || cp .env.example .env
git add -A && git commit -m "chore: scaffold" --allow-empty    # un tag necesita un commit al que apuntar

corepack enable --install-directory "$HOME/.local/bin"   # luego asegurar que esté en PATH
corepack prepare pnpm@12.16.1 --activate
node -v   # expect: v24.x o más nuevo

pnpm install || true   # la PRIMERA vez, pnpm resuelve el lockfile y sale 1 con ERR_PNPM_IGNORED_BUILDS
                        # (esbuild trae postinstall scripts que pnpm bloquea hasta aprobarlos) —
                        # verificado en vivo: siempre pasa en la primera corrida sobre este lockfile,
                        # nunca en una re-corrida, así que el `|| true` no esconde un fallo real de red
pnpm approve-builds --all   # idempotente: "There are no packages awaiting approval" en una re-corrida, exit 0
pnpm install                # ahora instala de verdad. Re-corrida: no-op si nada cambió

pnpm exec playwright install --with-deps   # binarios de browser para E2E — idempotente, no-op si ya están

pnpm db:up   # levanta Postgres (docker-compose.yml, de la copia de workspace/ de arriba)
```

---

## 11. Dependencies

Todo pin viene de una consulta real al registry el 2026-11-04 — nunca de memoria.

### Runtime

| Package | Version | Source | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| `express` | 5.3.0 | https://registry.npmjs.org/-/package/express/dist-tags | 2026-11-04 | §10 Bootstrap (vía `workspace/package.json`) | servidor HTTP, MVC literal |
| `ejs` | 7.0.2 | https://registry.npmjs.org/-/package/ejs/dist-tags | 2026-11-04 | §10 Bootstrap | motor de vistas server-rendered |
| `drizzle-orm` | 0.45.4 | https://registry.npmjs.org/-/package/drizzle-orm/dist-tags | 2026-11-04 | §10 Bootstrap | acceso a datos tipado |
| `pg` | 8.23.1 | https://registry.npmjs.org/-/package/pg/dist-tags | 2026-11-04 | §10 Bootstrap | driver de Postgres |
| `better-auth` | 1.7.17 | https://registry.npmjs.org/-/package/better-auth/dist-tags | 2026-11-04 | §10 Bootstrap | auth self-hosted, sesión por cookie |
| `zod` | 4.6.7 | https://registry.npmjs.org/-/package/zod/dist-tags | 2026-11-04 | §10 Bootstrap | validación en cada borde |

### Development

| Package | Version | Source | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| `typescript` | 6.0.3 | https://registry.npmjs.org/typescript — pin deliberado bajo el `latest` del registry (7.0.2) | 2026-11-04 | §10 Bootstrap | la línea 7.x es GA pero rompe tooling de terceros (ver `knowledge/runtime-tracks/ts-node.md`); 6.0.3 es la línea estable recomendada para todo el track |
| `tsx` | 4.23.15 | https://registry.npmjs.org/-/package/tsx/dist-tags | 2026-11-04 | §10 Bootstrap | runner de dev/scripts con `.ts` nativo |
| `@biomejs/biome` | 2.6.5 | https://registry.npmjs.org/-/package/@biomejs/biome/dist-tags | 2026-11-04 | §10 Bootstrap | lint + format, un solo config verificado limpio (0 warnings) |
| `vitest` | 5.1.0 | https://registry.npmjs.org/-/package/vitest/dist-tags | 2026-11-04 | §10 Bootstrap | test runner unitario/integración |
| `@playwright/test` | 1.64.1 | https://registry.npmjs.org/-/package/@playwright/test/dist-tags | 2026-11-04 | §10 Bootstrap | E2E |
| `drizzle-kit` | 0.31.11 | https://registry.npmjs.org/-/package/drizzle-kit/dist-tags | 2026-11-04 | §10 Bootstrap | generar/aplicar migraciones |
| `supertest` | 7.3.1 | https://registry.npmjs.org (`npm view supertest version`) | 2026-11-04 | §10 Bootstrap | tests de rutas Express en proceso |
| `auth` | 1.7.17 | https://registry.npmjs.org (`npm view auth version`) | 2026-11-04 | §10 Bootstrap | CLI de better-auth — **no** `@better-auth/cli`, que está deprecado ("Package no longer supported"); el paquete correcto hoy se llama literalmente `auth`, verificado corriendo ambos |
| `@types/node` | 24.19.2 | https://registry.npmjs.org (`npm view @types/node@24 version`) | 2026-11-04 | §10 Bootstrap | tipos alineados a la línea Node 24, no al `latest` global (26.x) |
| `@types/express` | 5.0.6 | https://registry.npmjs.org/-/package/@types/express/dist-tags | 2026-11-04 | §10 Bootstrap | tipos para Express 5 |
| `@types/pg` | 8.23.1 | https://registry.npmjs.org/-/package/@types/pg/dist-tags | 2026-11-04 | §10 Bootstrap | tipos para `pg` |
| `@types/supertest` | 7.2.1 | https://registry.npmjs.org (`npm view @types/supertest version`) | 2026-11-04 | §10 Bootstrap | tipos para `supertest` |

### Deliberately not used

| Rejected | Instead | Why |
|---|---|---|
| Next.js | Express 5 + EJS | El usuario pidió MVC literal; Next.js impone App Router, no MVC |
| `@better-auth/cli` | `auth` (mismo autor, mismo binario `better-auth`/`auth`) | `@better-auth/cli@1.4.21` está marcado `deprecated: "Package no longer supported"` en el registry — verificado corriendo ambos, mismo resultado, uno sin warning |
| `dotenv` | `node --env-file=.env` / `tsx --env-file=.env` (nativo desde Node 20.6+) | Node 24 ya lo soporta de fábrica; una dependencia menos |
| Prisma | Drizzle ORM | SQL-shaped, sin generador de cliente pesado, integra nativo con el adapter de better-auth |

---

## 12. Deployment Strategy

### Hosting

Docker Compose, autohospedado en la máquina/VPS del equipo (o cualquier host que corra
contenedores Docker — Railway, Fly, Render también sirven sin cambios si el equipo prefiere no
administrar un servidor). Build command: `pnpm build`. Output: `dist/`. Runtime: `node
--env-file=.env dist/server.js`, puerto desde `PORT`.

### Environments

| Environment | Branch | URL | Database | Third-party mode |
|---|---|---|---|---|
| Local | — | localhost:3000 | contenedor Docker local | — (no hay terceros) |
| Producción | `main` | a definir por el equipo al desplegar | Postgres en el mismo host o un servicio administrado | — |

No hay ambiente de Preview en v1 — es una herramienta interna de equipo chico, no justifica un
ambiente por PR; revisitar si el equipo crece.

### CI/CD

`.github/workflows/ci.yml` (step 12): checkout → setup pnpm → `docker compose up -d --wait` →
`pnpm install --frozen-lockfile` → `pnpm db:generate && pnpm db:migrate` → `pnpm typecheck` →
`pnpm lint` → `pnpm test` → `pnpm build`. El mismo set de comandos que el gate de §20.1 — si un
check está en el gate, está en CI, sin excepciones.

### Release and rollback

Deploy: construir la imagen/artefacto, correr `pnpm db:migrate` como paso explícito antes de
levantar la nueva versión (nunca en el boot de la app — instancias concurrentes correrían la
migración en carrera). Rollback: volver al tag de git anterior y redeployar; las migraciones de
Drizzle son forward-only en v1 (no hay reversa automática) — si un rollback de código requiere
revertir schema, se escribe una migración nueva que lo deshace, nunca se edita una ya aplicada.

### Domain, DNS, TLS

A definir por el equipo al elegir el host de producción — fuera del alcance de este blueprint
(herramienta interna, sin requerimiento de dominio público en v1).

---

## 13. Testing Strategy

| Layer | Framework | What it covers | Where | Runs |
|---|---|---|---|---|
| Unit/integración | Vitest + Supertest | rutas Express, repos de Drizzle contra Postgres real, middleware de auth/error | `tests/**/*.test.ts` | cada commit |
| E2E | Playwright | login → crear tarea → filtrar → cambiar estado → admin crea usuario | `tests/e2e/*.spec.ts` | antes de cada deploy, y en CI |

### Critical flows to cover E2E

1. Login → `/tareas` → crear tarea → verla en la lista (el flujo que el producto no puede perder).
2. Filtrar por estado y cambiar el estado de una tarea.
3. Admin crea un usuario nuevo y ese usuario queda con el rol correcto.

### Test data

Cada test de integración corre contra la misma Postgres local de `docker-compose.yml`
(`TEST`/`DATABASE_URL` comparten instancia en v1, dado el tamaño del proyecto — no hay base de
datos separada para tests). `pnpm db:seed` provee el admin fijo que usa el E2E. Los tests no
comparten estado mutable entre sí más allá de las filas que el propio flujo crea y que Postgres
conserva entre corridas — aceptable para este alcance; si la suite crece, separar
`TEST_DATABASE_URL` queda como mejora futura.

### What is deliberately not tested

Accesibilidad automatizada (axe) no está en el gate de v1 — ver §15, que sí define el baseline
manual. Carga/performance no se testea — el volumen esperado (un equipo chico) no lo justifica.

---

## 14. Security & Secrets

| Concern | Control | Implemented in |
|---|---|---|
| Secret storage | variables de entorno, nunca en el repo | `.env` (gitignored), `.env.example` como plantilla |
| Secret rotation | manual — rotar `BETTER_AUTH_SECRET` invalida toda sesión activa | documentado en README |
| Input validation | Zod en cada borde | `src/schemas/**` |
| Output encoding / XSS | EJS escapa por default con `<%= %>` | cada vista — nunca usar `<%- %>` con input de usuario |
| SQL injection | Drizzle parametriza cada query — ninguna SQL armada por concatenación | `src/db/*-repo.ts` |
| AuthN / AuthZ | ver §8 — chequeado server-side en cada request | `src/middleware/session.ts`, `src/middleware/authorize.ts` |
| CSRF | cookie `SameSite=Lax` de better-auth cubre el caso común; sin token CSRF dedicado en v1 | better-auth, default |
| Rate limiting / abuse | NOT APPLICABLE en v1 — acceso interno sin exposición pública | — |
| Webhook verification | NOT APPLICABLE — no hay webhooks en v1 | — |
| Dependency audit | `pnpm audit` manual antes de cada release | README |
| Security headers | default de Express; agregar `helmet` queda fuera de v1 (Non-Goal implícito, revisitar si se expone públicamente) | — |
| PII handling | solo email/nombre de usuarios internos; sin dato sensible de terceros | `user` table |
| Logging hygiene | el error handler nunca loguea el body de la request completo, solo el mensaje/stack del error | `src/middleware/error-handler.ts` |

**Hard rules**
- Ningún secreto se commitea, se imprime en un log, ni se manda al cliente.
- Toda autorización server-side corre antes del trabajo, nunca después.

Este proyecto no maneja datos regulados (salud, financieros, de menores, datos personales UE) —
solo cuentas internas del propio equipo.

---

## 15. Accessibility

**Target: WCAG 2.2 Level AA**, heredado de la paleta y el layout de los mockups originales (ya
verificados en §7 para los pares de contraste de texto).

### Baseline requirements

| Requirement | Rule |
|---|---|
| HTML semántico | landmarks (`header`/`nav`/`main`), un `h1` por página, listas para listas |
| Teclado | cada elemento interactivo alcanzable y operable por teclado, orden de tab lógico |
| Foco visible | indicador de foco visible en cada elemento, ≥3:1 contra su fondo |
| Formularios | cada input con label programático; errores en texto, no solo color |
| Zoom/reflow | usable al 200% de zoom sin scroll horizontal |

### Verification

No hay chequeo automatizado de a11y (axe) en el gate de v1 — ver §13. Antes de cada release: una
pasada manual con teclado por los tres flujos críticos de §13 y una pasada de zoom al 200% en el
breakpoint más angosto.

---

## 16. Observability & Cost

### Instrumentation

| Signal | Tool | What it captures | Who looks at it |
|---|---|---|---|
| Errores | logs de consola del proceso (stdout/stderr) | excepciones no atrapadas, con el mensaje del error handler | quien administra el deploy |
| Logs | mismo mecanismo | una línea por request vía el logger default de Express (`morgan` queda fuera de v1 por simplicidad) | — |

Dado el tamaño del equipo y el alcance interno, v1 no integra un proveedor de error-tracking
dedicado (Sentry, etc.) — Non-Goal implícito, revisitar si el equipo crece o el volumen de uso
sube.

### The metrics that matter for this project

| Metric | Target | Alert at |
|---|---|---|
| Disponibilidad de `/health` | 100% durante horario laboral | 2 fallos consecutivos |

### Health check

`GET /health` responde `{ status: "ok" }` — no verifica la conexión a Postgres en v1 (chequeo
mínimo, suficiente para un equipo chico); ampliarlo a un chequeo real de DB queda como mejora
futura si el equipo lo pide.

### Cost model

| Service | Free tier | Cost at v1 scale | Cost at 10× | Cliff to watch |
|---|---|---|---|---|
| Hosting (VPS/Docker) | depende del proveedor que elija el equipo | bajo — un contenedor chico | sigue bajo para un equipo interno | ninguno esperado a este tamaño |

**Costo mensual estimado: mínimo** — la app y la base corren en un único contenedor/VPS pequeño; no
hay servicios de terceros facturando por uso en v1.

---

## 17. Model Routing

`NOT APPLICABLE — this project does not call an LLM at runtime.`

---

## 18. Skills to Use During Build

| Skill | Build steps | Why | Install |
|---|---|---|---|
| `superpowers` | todos (1-12) | Framework de skills para el agente que construye: brainstorming, planes escritos, TDD, desarrollo con subagentes — exactamente el flujo que este blueprint pide (cada step escribe el test antes de pasar el gate) | `/plugin install superpowers@claude-plugins-official` (instalar el marketplace oficial primero si no está agregado) |

**Nunca depender duro de este skill.** Si no está disponible en la sesión que construye, el
builder sigue el flujo TDD descrito en cada step de §9 directamente (escribir el test en el mismo
archivo que el `Do` lista, correrlo, y recién entonces considerar el step terminado) — sin bloquear
el build por su ausencia.

---

## 19. Agent Workspace

Emitido como archivos reales bajo `workspace/`, copiados al root del proyecto por el comando de
§10 antes del step 1.

### 19.1 `CLAUDE.md`

Ver `workspace/CLAUDE.md` — 124 líneas, bajo el límite de 200. Contenido completo en ese archivo.

### 19.2 `AGENTS.md`

Ver `workspace/AGENTS.md`.

### 19.3 `.claude/settings.json`

Ver `workspace/.claude/settings.json` — allowlist cubriendo cada comando de `Verify` de §9 (`pnpm
install/typecheck/build/test/lint/format/dev/start/db:*/auth:generate/approve-builds`, `pnpm exec
playwright install`, `node`, `curl` localhost, `kill`, `sleep`, `test`, `docker compose up/down/
exec`, y los comandos de git que los Checkpoints usan). Deny explícito sobre `git push` y `docker
compose down -v` (destructivo) y lectura de `.env`.

### 19.4 Project skills — `.claude/skills/<name>/SKILL.md`

| Skill | Triggers on | What it automates |
|---|---|---|
| `add-ejs-view` | "agregar una página", "nueva vista" | crear una vista EJS + su ruta GET + guard de rol + test |
| `add-task-status` | "agregar un estado", "nuevo estado de tarea" | agregar un valor al enum de Zod + su color en la vista + un test de filtro |

Ver `workspace/.claude/skills/add-ejs-view/SKILL.md` y
`workspace/.claude/skills/add-task-status/SKILL.md` para el contenido completo.

### 19.5 `.claude/rules/*.md`

| File | `paths` globs | Covers |
|---|---|---|
| `.claude/rules/db-and-auth.md` | `src/db/**`, `src/lib/auth.ts`, `drizzle.config.ts` | convenciones de schema, regeneración de auth, nunca editar lo generado a mano |
| `.claude/rules/views-and-routes.md` | `src/views/**`, `src/routes/**` | validación en el borde, reusar tokens, nunca consultar la DB desde una vista |

### 19.6 Verify-critical config and local infrastructure

| Emit | Path in the project | Which `Verify` commands need it | Resolution/env handling it carries | Bundle-path exclusion |
|---|---|---|---|---|
| `package.json` | `./package.json` | todos — define cada script que `Verify` invoca | — | n/a — no es una herramienta que camina el árbol |
| `tsconfig.json` / `tsconfig.build.json` | `./` | `pnpm typecheck`, `pnpm build` | `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` — ver matriz abajo | `include: ["src"]` nunca camina `blueprints/` — no necesita exclusión explícita |
| `biome.json` | `./biome.json` | `pnpm lint`, `pnpm format` | ninguno — Biome no necesita cargar env ni resolver un paquete especial | `"!blueprints"` en `files.includes` — **verificado en vivo**: sin esta línea, Biome encuentra el árbol del bundle y lo reporta (no rompe el gate aquí porque no hay segundo `biome.json` dentro de `blueprints/`, pero la exclusión está puesta de todas formas por si un paso futuro agrega uno) |
| `drizzle.config.ts` | `./drizzle.config.ts` | `pnpm db:generate`, `pnpm db:migrate` | **ninguno necesario** — `drizzle-kit` carga `.env` por su cuenta. Verificado empíricamente: corrió con éxito incluso con un shell completamente limpio (`env -i`) y un fallback hardcodeado deliberadamente incorrecto en el propio archivo | n/a — no camina el árbol del proyecto, solo lee el schema que se le apunta |
| `docker-compose.yml` | `./docker-compose.yml` | `pnpm db:up`, cada comando `docker compose exec` de §9 | la variable `DATABASE_URL` en `.env.example` apunta al puerto `5433` que este archivo publica — coincide, ver §19.6 Cross-artifact value reconciliation | n/a |
| `vitest.config.ts` | `./vitest.config.ts` | `pnpm test` y cada `pnpm test {path}` | `exclude: ["blueprints/**", ...]` | `"blueprints/**"` en `exclude` — **verificado en vivo** (test real pasó con esta config) |
| `playwright.config.ts` | `./playwright.config.ts` | `pnpm test:e2e` | `webServer.command: "pnpm dev"` — levanta el server él mismo si no está corriendo | `testDir: "./tests/e2e"` nunca camina `blueprints/` |
| `.env.example` | `./.env.example` | ninguno directamente — `.env` (su copia) es lo que cada comando lee | — | n/a |
| `.gitignore` | `./.gitignore` | ninguno directamente — gobierna qué entra al primer commit de §10 | — | n/a |
| `.claude/settings.json` | `./.claude/settings.json` | ninguno directamente — gobierna qué comando puede correr sin preguntar | — | n/a |

#### A resolution convention is decided once and reconciled against every loader

**La convención, en una línea:** imports relativos con extensión `.ts` literal (`./app.ts`, nunca
`./app` ni `./app.js`), habilitado por `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`
en `tsconfig.json`.

| Context | Command that exercises it | Convention as it appears there | Config + literal setting that makes it work |
|---|---|---|---|
| Application source | `pnpm dev` (`tsx watch --env-file=.env src/server.ts`) | `./app.ts` desde `server.ts` | `tsconfig.json` — `allowImportingTsExtensions: true`. **Verificado en vivo**: el servidor arrancó y respondió 200 en `/health` con esta convención |
| Test files | `pnpm test` (Vitest 5.1.0) | `../../src/app.ts` desde `tests/smoke/health.test.ts` | Vitest resuelve TS vía su transform interno (esbuild), sin config adicional — **verificado en vivo**: el test real importó `../../src/app.ts` y pasó |
| Standalone scripts | `pnpm db:seed` (`tsx --env-file=.env src/db/seed.ts`) | mismo mecanismo que `tsx` en dev — no hay un contexto de "node plano" en este proyecto, todo script standalone corre vía `tsx` | ninguna config adicional — mismo `tsx` que ya corre `pnpm dev`, **verificado en vivo** con el patrón equivalente (`tsx --env-file=.env src/server.ts`) |
| Build / bundle | `pnpm build` (`tsc -p tsconfig.build.json`) | `tsc` reescribe `./app.ts` → `./app.js` al emitir | `tsconfig.json` — `rewriteRelativeImportExtensions: true`. **Verificado en vivo**: `dist/server.js` corrió con `node` plano, sin loader, después del build |

Las cuatro filas fueron ejercitadas de verdad durante el diseño de este blueprint, no solo leídas
de la documentación de la herramienta.

#### Cross-artifact value reconciliation

| Shared value | Single source | Literal value | Every other place it appears | Compared |
|---|---|---|---|---|
| Puerto de la app | `src/server.ts` (`process.env.PORT ?? 3000`) | `3000` | `.env.example` (`PORT=3000`), `playwright.config.ts` (`baseURL: "http://localhost:3000"`) | yes |
| Puerto de Postgres (host) | `docker-compose.yml` (`ports: "5433:5432"`) | `5433` | `.env.example` (`DATABASE_URL=...localhost:5433/...`), `drizzle.config.ts` (fallback) | yes |
| Punto de entrada construido | `tsconfig.json` (`outDir: "dist"`, `rootDir: "src"`) + `src/server.ts` | `dist/server.js` | cada `Verify` de §9 que corre el entry point (steps 1 y 12), `package.json`'s `start` script | yes |
| Nombre del proyecto | `package.json` (`"name"`) | `ai-academy-centro-control` | slug del bundle (`./blueprints/ai-academy-centro-control/`) | yes |
| Ruta del bundle | cada config que lo excluye | `blueprints` | `biome.json` (`files.includes`), `vitest.config.ts` (`exclude`) | yes |

#### Byte-exact artifact reconciliation

`NOT APPLICABLE — este blueprint no autoría ningún byte-exacto esperado por adelantado.` Cada test
afirma sobre comportamiento vivo (status codes, campos que el propio código define), nunca
transcribe un string generado por el runtime.

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

El proyecto está **terminado** cuando cada comando de abajo sale con exit 0 en un checkout limpio,
y no antes.

```bash
pnpm install --frozen-lockfile
pnpm typecheck                                        # expect: exit 0, cero errores
pnpm lint                                              # expect: exit 0, cero errores y cero warnings
pnpm test                                               # expect: exit 0, 0 failed, 0 skipped
pnpm test:e2e                                            # expect: exit 0, 0 failed
pnpm build                                                # expect: exit 0
node --env-file=.env dist/server.js & pid=$!; sleep 1; code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"; kill "$pid" 2>/dev/null || true; test "$code" = "200"
                                                             # expect: exit 0 — prueba que el artefacto construido es el que de verdad corre
```

Checklist manual (post-build launch checklist):

- [ ] Cada step de §9 tiene su tag de checkpoint en git (`git tag -l 'step-*'` lista las 12).
- [ ] Cada archivo de la tabla *Files that must be committed* (§10) está presente en un checkout
      limpio.
- [ ] El `.gitignore` estaba en el primer commit — ver §10 Bootstrap.
- [ ] El bootstrap de §10 se re-corrió una vez sobre un árbol ya bootstrapeado y salió con exit 0
      sin revertir el manifest.
- [ ] Cada fila de la tabla *Cross-artifact value reconciliation* (§19.6) está `Compared: yes`.
- [ ] §9.1 no aplica (greenfield) — nada que verificar ahí.
- [ ] Cada Non-Goal de §1 sigue sin construirse.
- [ ] Cada variable de entorno de §10 está seteada en producción y ausente del repo.
- [ ] Los flujos críticos de E2E (§13) pasan contra la URL de producción.
- [ ] Pasada manual de teclado + zoom 200% sobre los tres flujos de §13 (§15).

No se ignora ningún warning — un warning tolerado se vuelve permanente y esconde al siguiente real.

### 20.2 Risk register

| Risk | Likelihood | Impact | Early signal | Mitigation |
|---|---|---|---|---|
| better-auth valida su schema en JS independientemente de la DB real | M | M | log "Drizzle schema mismatch" al boot aunque las tablas existan | pasar siempre el schema combinado (`{...appSchema, ...authSchema}`) a `drizzleAdapter` y a `drizzle()` — ya resuelto y documentado en §9 step 3 y en `.claude/rules/db-and-auth.md` |
| `@better-auth/cli` deprecado, un builder lo instala por el nombre "obvio" | M | B | warning de npm "Package no longer supported" | §11 fija explícitamente el paquete correcto (`auth`), con la razón escrita |
| Express 5 cambió la sintaxis de wildcard (`*splat`) respecto a Express 4, documentación vieja en internet usa `*` | M | M | la ruta de better-auth responde 404 en vez de montar | §9 step 4 y `.claude/rules/db-and-auth.md` (implícito en el Do) fijan la sintaxis exacta, verificada en vivo |
| El equipo crece más allá de lo que soporta sin audit log/notificaciones | B | M | un admin pide "quién cambió esto" o "avisame cuando..." | ya está en §1 Non-Goals con su trigger de revisión |
| Postgres compartido entre tests y dev local esconde un test con estado sucio | B | B | un test pasa solo o falla según el orden de corrida | §13 lo documenta como alcance aceptado; separar `TEST_DATABASE_URL` si la suite crece |

### 20.3 Decision log

| # | Decision | Rejected alternative | Why | Would reverse if |
|---|---|---|---|---|
| 1 | Express 5 + EJS en vez de Next.js (default de `ts-node.md` para `internal-tool`) | Next.js App Router | El usuario pidió MVC literal; Next.js no es MVC y agrega abstracción que esta app no necesita | el equipo pide interactividad de cliente pesada (SPA real) que EJS no puede dar razonablemente |
| 2 | better-auth self-hosted en vez de Clerk/Supabase Auth | Clerk (hosted) | Clerk apunta a SaaS multi-tenant que factura por usuario; este es un equipo interno chico sin ese costo justificado | un comprador empresarial exige SSO/SAML que better-auth no cubre bien |
| 3 | `role`/`isActive` como `additionalFields` (rung 1 de `auth.md`) en vez de tablas `roles`/`permissions` (rung 3) | Tablas de permisos custom | Dos roles fijos no justifican un sistema de permisos configurable | el producto necesita que los clientes definan sus propios roles |
| 4 | Postgres vía Docker Compose en vez de un servicio administrado (Neon/Supabase) | Neon/Supabase Postgres | Equipo chico, sin necesidad de branch-per-PR todavía; Docker Compose es gratis y corre igual en dev y producción | el equipo necesita branches de base de datos por PR o escala más allá de un solo host |
| 5 | `auth` (paquete) en vez de `@better-auth/cli` | `@better-auth/cli@1.4.21` | Deprecado en el registry ("Package no longer supported"); `auth` es el reemplazo del mismo autor, mismo binario, verificado funcionando | el proyecto `auth` deja de mantenerse también |
| 6 | TypeScript 6.0.3 en vez del `latest` del registry (7.0.2) | TypeScript 7.0.2 | 7.x no tiene API de compilador estable todavía y rompe tooling de varios ecosistemas; el track recomienda 6.x para todo el stack | el ecosistema (Vitest, Playwright, Biome) confirma soporte estable de TS 7 |

### 20.4 What to build next

1. Reset de contraseña por email — cuando el equipo supere ~10 usuarios activos (trigger de §1).
2. Audit log formal — cuando un admin necesite reconstruir "quién cambió qué" (trigger de §1).
3. Notificaciones de cambio de estado — si el equipo reporta que se pierden cambios (trigger de §1).
4. SSO/login social — si un comprador/cliente empresarial lo exige (trigger de §1).

---

*Fin del blueprint. El orden de build es §9. Se detiene cuando §20.1 está verde.*
