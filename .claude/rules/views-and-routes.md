---
description: EJS view and route conventions
paths:
  - "src/views/**"
  - "src/routes/**"
---

- Una vista nunca consulta la base de datos. Recibe los datos ya armados de su route handler.
- Reusá los tokens CSS de `src/views/partials/styles.ejs` (`<%- include('../partials/styles') %>`)
  — ningún hex nuevo en un `.ejs`.
- Cada página autenticada incluye el sidebar compartido: `<%- include('../partials/sidebar', {
  active: '<proyectos|usuarios>', user }) %>` — siempre pasar `user`, la vista lo necesita.
- Cada ruta que muta estado valida `req.body`/`req.query` con un schema Zod de `src/schemas/**`
  antes de llamar a un repositorio.
- Las transiciones de estado de una tarea viven en `TRANSITIONS` (`src/db/tasks-repo.ts`) — la
  vista solo muestra los botones ya válidos para el estado actual, pero el repo siempre re-valida;
  nunca confiar en lo que mostró el formulario.
- Aprobar una tarea (`completada`) y editar la configuración de un proyecto solo los puede hacer el
  líder del proyecto o un `admin` — chequeado en la ruta, nunca solo ocultando el botón.
