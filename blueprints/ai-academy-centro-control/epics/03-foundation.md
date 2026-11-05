# Epic 03: V3.3 foundation

> Preparación para el expansion de 6 a 18 vistas (spec V3.3): tablas de auditoría y solicitudes de
> apoyo, capacidad semanal por usuario, el dashboard Inicio, y restringir la creación de proyectos a
> admin. Las 12 vistas restantes quedan para los epics 04 (ciclo de vida de tareas) y 05
> (colaboración y reportes) — no incluidos acá.

| | |
|---|---|
| **Epic id** | `03-foundation` |
| **Tasks** | `E3-T1` … `E3-T7` |
| **Depends on** | `02-interface-hardening` |
| **Unlocks** | `04-task-lifecycle`, `05-collaboration-reporting` (no escritos todavía) |

---

## Qué se construyó

- **`audit_log`** (`src/db/schema.ts`) — historial de cambios. `projectId`/`taskId` con cascade,
  `actorId` **sin** cascade (mismo patrón que `taskLogs.userId`: un borrado duro de usuario queda
  bloqueado si alguna vez actuó en el sistema). Repo: `src/db/audit-repo.ts`
  (`recordChange`, `listByProject`, `listByTask`, `listRecent`).
- **`support_requests`** — workflow solicitar/aceptar apoyo en una tarea, hasta ahora inexistente
  (`task_support` solo se poblaba al crear la tarea). Repo: `src/db/support-requests-repo.ts`
  (`createRequest`, `listByTask`, `listPendingForUser`, `resolveRequest` — aceptar inserta en
  `task_support`).
- **`user.weeklyCapacityHours`** — `additionalFields` en `src/lib/auth.ts`, default 40, para
  "Equipo y cargas" / "Plan semanal" (epic 05).
- **Auditoría conectada** a `createTask`, `transitionTask`, `logHours` (`tasks-repo.ts`) y
  `updateSettings` (`projects-repo.ts`) — cada uno ahora pide `actorId`.
- **`GET /admin/usuarios/:id/eliminar`** extendido: bloquea también si el usuario tiene filas en
  `audit_log` o `support_requests`.
- **`GET /`** — dashboard Inicio (`src/routes/dashboard.ts`, vista `src/views/inicio.ejs`): KPIs
  (proyectos activos, mis tareas activas, mis tareas vencidas) + feed de actividad reciente
  (`listRecent`). Nav lateral ahora tiene "Inicio" primero.
- **`POST /proyectos` y `GET /proyectos/nuevo` restringidos a `admin`** (antes cualquier usuario
  autenticado podía crear un proyecto) — coincide con el prototipo V3.2/V3.3.

## Decisiones (confirmadas con el usuario)

1. Capacidad semanal: campo real en DB (no una constante fija).
2. Crear proyecto: solo admin.
3. Alcance: este epic primero, pausa para revisión antes de 04/05.

## Gate

`pnpm lint && pnpm typecheck && pnpm test` — 46/46 tests verdes. Migración `drizzle/0003_high_madripoor.sql` aplicada.

## Pendiente (no es parte de este epic)

Las 12 vistas restantes del spec V3.3 (Plan semanal, Mis tareas, Equipo y cargas, Solicitudes de
apoyo, Productividad, Notificaciones, Editar/Entregar/Cancelar tarea, Horas de apoyo dedicada,
Auditoría, reordenar tareas en Configuración, filtros multi-chip V3.3) — ver el plan de 19 tareas
discutido con el usuario, agrupado en epics 04 y 05, todavía sin escribir como blueprint.
