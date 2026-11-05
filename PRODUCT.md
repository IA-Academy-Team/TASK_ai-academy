# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipo interno de AI Academy. Dos roles globales: `admin` (gestión de usuarios, acceso total) y
`usuario`. Cada proyecto tiene además un líder de proyecto, responsable de su configuración y del
límite de WIP. Las tareas tienen un responsable y opcionalmente un apoyo.

## Product Purpose

Gestión de proyectos y tareas para el equipo de AI Academy: asignar responsables/apoyo, fijar
prioridad, estimar y registrar horas, declarar dependencias entre tareas, y mover cada tarea por un
workflow de estado (`pendiente → activa → revisión → completada`, con salidas a `bloqueada` o
`cancelada`) respetando un límite de WIP por proyecto.

## Positioning

No es un tracker genérico tipo Trello/Jira: el diferencial es un workflow de estado fijo y
auditable (no tableros libres) con límite de WIP forzado por proyecto, liderazgo por proyecto
(no solo roles globales), y re-validación de transiciones siempre en servidor
(`TRANSITIONS` en `src/db/tasks-repo.ts`), nunca solo en la UI — pensado para el flujo de trabajo
específico de este equipo, no para ser configurable como un tracker de propósito general.

## Operating Context

Flujo diario: un líder de proyecto crea tareas, asigna responsable/apoyo y prioridad; los miembros
mueven sus tareas por el workflow y registran horas trabajadas contra la estimación. El admin
gestiona usuarios en `/admin/usuarios`. Sin integración externa conocida (no Slack, no calendario);
todo vive en esta app.

## Capabilities and Constraints

- Entidades: `projects`, `project_members`, `tasks`, `task_support`, `task_logs`.
- Transiciones de estado válidas son la única fuente de verdad en el repo, no en la vista.
- Autorización siempre server-side vía `authorize(role)`; nunca `req.user.role === "admin"` inline.
- Validación de input en el borde (Zod) antes de tocar un repositorio.
- Sin app móvil nativa — solo web server-rendered (EJS).

## Brand Commitments

- Nombre: "AI Academy — Centro de Control".
- Logo confirmado por el usuario: icono de diamante/destello blanco sobre fondo transparente,
  rodeado por 4 cuadrantes en degradé púrpura (carpeta, personas, checklist, gráfico de barras) —
  representan proyectos, equipo, tareas y reportes. Servido en runtime desde `src/public/brand/logo.png`
  (vía `/static/brand/logo.png`).
  **Resuelto:** el logomark queda en su púrpura original — no se recolorea hacia teal. La paleta
  teal/petrol de `CLAUDE.md` / `styles.ejs` sigue siendo el único color de UI (botones, acentos,
  badges, estado activo del sidebar); el logo es una marca independiente, no un color de acento.
  Usado como brandmark en el sidebar (`partials/sidebar.ejs`) y como favicon en las 7 vistas
  autenticadas.
- Paleta teal/petrol (claro + oscuro), tipografía Poppins/Segoe UI, radios y sombras — ya fijados
  en `src/views/partials/styles.ejs`, fuente única de tokens. Ver detalle completo en `CLAUDE.md`.

## Evidence on Hand

- Logo en `src/public/brand/logo.png`, servido vía `express.static` montado en `/static`
  (`src/app.ts`) — sin más variantes (solo PNG, sin SVG ni favicon multi-tamaño) ni guía de uso
  aún.
- No hay testimonios, casos de estudio, ni prensa — herramienta interna, no se debe fabricar
  ninguno de estos.
- Pendiente conocido, no resuelto ahora: `pnpm build` (`tsc`) no copia assets no-`.ts` (ni
  `src/views/**/*.ejs` ni `src/public/**`) a `dist/` — el mismo gap preexistente para las vistas,
  ahora también aplica al logo. Solo afecta producción buildeada, no `pnpm dev`.

## Product Principles

1. El estado de una tarea es siempre el que el servidor valida, nunca el que la UI insinúa.
2. El límite de WIP por proyecto es una restricción real, no una sugerencia visual.
3. Un rol se verifica en el servidor (`authorize()`); ocultar un botón en la vista no es seguridad.
4. Workflow fijo y predecible por encima de la flexibilidad de un tracker genérico.
5. Esta es una herramienta interna: sin afán de posicionamiento externo, sin contenido inventado.

## Accessibility & Inclusion

Sin estándar formal exigido (WCAG u otro) — el usuario confirmó que no hay requisito definido.
Diseñar con buen criterio de accesibilidad igual, pero sin gate de cumplimiento obligatorio.
