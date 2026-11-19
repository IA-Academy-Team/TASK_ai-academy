import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
} from "drizzle-orm";
import { declaredHours, openHoursRemaining } from "../domain/hours.ts";
import { isAdminRole } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import { isUuid } from "../lib/uuid.ts";
import { recordChange } from "./audit-repo.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { projects, taskLogs, taskSupport, tasks } from "./schema.ts";

const TRANSITIONS: Record<string, string[]> = {
  pendiente: ["activa", "bloqueada", "cancelada"],
  activa: ["revision", "bloqueada", "cancelada"],
  revision: ["activa", "completada", "bloqueada"],
  bloqueada: ["pendiente", "activa", "cancelada"],
  completada: [],
  cancelada: [],
};

// Estados de tarea en los que tiene sentido pedir apoyo — misma lista que
// valida la ruta POST /tareas/:id/apoyo.
export const REQUESTABLE_SUPPORT_STATUSES = [
  "pendiente",
  "activa",
  "bloqueada",
];

// Una persona no puede tener más de 4h de tareas estimadas el mismo día —
// regla de negocio para evitar sobrecarga visible en el plan semanal. Se
// exporta porque Equipo y cargas la reusa como referencia de capacidad
// diaria en su filtro día/semana/mes.
export const DAILY_ESTIMATE_LIMIT_HOURS = 4;

async function assertDailyEstimateLimit(
  ownerId: string,
  due: string,
  estimate: number,
  excludeTaskId?: string,
): Promise<void> {
  const conditions = [
    eq(tasks.ownerId, ownerId),
    eq(tasks.due, due),
    notInArray(tasks.status, ["completada", "cancelada"]),
  ];
  if (excludeTaskId) conditions.push(ne(tasks.id, excludeTaskId));

  const rows = await db
    .select({ estimate: tasks.estimate })
    .from(tasks)
    .where(and(...conditions));

  const existingHours = rows.reduce((sum, r) => sum + Number(r.estimate), 0);
  if (existingHours + estimate > DAILY_ESTIMATE_LIMIT_HOURS) {
    throw new HttpError(
      400,
      `la persona ya tiene ${existingHours}h estimadas para el ${due} — el máximo es ${DAILY_ESTIMATE_LIMIT_HOURS}h por día`,
    );
  }
}

export async function createTask(input: {
  projectId: string | null;
  title: string;
  deliverable: string;
  description: string;
  ownerId: string;
  priority: string;
  weight: number;
  estimate: string;
  dependencyId: string | null;
  due: string;
  dueTime?: string | null;
  supportIds: string[];
  actorId: string;
}) {
  if (input.dependencyId) {
    const dep = await getTask(input.dependencyId);
    if (!dep || dep.projectId !== input.projectId) {
      throw new HttpError(
        400,
        "la dependencia debe ser una tarea del mismo proyecto",
      );
    }
  }

  await assertDailyEstimateLimit(
    input.ownerId,
    input.due,
    Number(input.estimate),
  );

  const row = await db.transaction(async (tx) => {
    // La secuencia (order) y el bloqueo de fila solo aplican a tareas
    // ancladas a un proyecto — una tarea independiente no compite por orden
    // con nadie, siempre es la primera de su (inexistente) lista.
    let order = 1;
    if (input.projectId) {
      const projectId = input.projectId;
      // Lock the project row so two concurrent creates can't both count the
      // same "existing" total and land on the same order number.
      await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update");

      const [{ value: existing }] = await tx
        .select({ value: count() })
        .from(tasks)
        .where(eq(tasks.projectId, projectId));
      order = existing + 1;
    }

    const [created] = await tx
      .insert(tasks)
      .values({
        projectId: input.projectId,
        order,
        title: input.title,
        deliverable: input.deliverable,
        description: input.description,
        ownerId: input.ownerId,
        priority: input.priority,
        weight: input.weight,
        estimate: input.estimate,
        dependencyId: input.dependencyId,
        due: input.due,
        dueTime: input.dueTime ?? null,
      })
      .returning();

    const supportIds = input.supportIds.filter((id) => id !== input.ownerId);
    if (supportIds.length > 0) {
      await tx
        .insert(taskSupport)
        .values(supportIds.map((userId) => ({ taskId: created.id, userId })));
    }

    return created;
  });

  await recordChange({
    projectId: input.projectId,
    taskId: row.id,
    actorId: input.actorId,
    action: "task_created",
    note: `Tarea "${row.title}" creada`,
  });

  return row;
}

export async function listTasksByProject(projectId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.order));
}

export async function listTasksWithoutProject() {
  return db
    .select()
    .from(tasks)
    .where(isNull(tasks.projectId))
    .orderBy(asc(tasks.order));
}

export async function getTask(id: string) {
  if (!isUuid(id)) return undefined;
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  return row;
}

// Sin entrada de auditoría: auditLog.taskId cascadea con la tarea, así que
// un registro "se borró esta tarea" desaparecería junto con ella.
export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function listSupport(taskId: string) {
  return db.select().from(taskSupport).where(eq(taskSupport.taskId, taskId));
}

export async function countByStatus(projectId: string, status: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)));
  return value;
}

export async function countAllByStatus() {
  const rows = await db
    .select({ status: tasks.status, value: count() })
    .from(tasks)
    .groupBy(tasks.status);
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = row.value;
  }
  return byStatus;
}

export async function transitionTask(
  id: string,
  nextStatus: string,
  actorId: string,
  input: { evidence?: string; note?: string },
) {
  const task = await getTask(id);
  if (!task) return undefined;

  const allowed = TRANSITIONS[task.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(
      400,
      `no se puede pasar de ${task.status} a ${nextStatus}`,
    );
  }

  if (nextStatus === "completada" && !task.evidence && !input.evidence) {
    throw new HttpError(
      400,
      "hace falta registrar la evidencia antes de aprobar",
    );
  }

  if (nextStatus === "revision") {
    if (!task.evidence && !input.evidence) {
      throw new HttpError(
        400,
        "hace falta registrar la evidencia antes de enviar a revisión",
      );
    }
    const existingLogs = await listLogs(id);
    if (declaredHours(existingLogs) <= 0) {
      throw new HttpError(
        400,
        "hace falta registrar horas antes de enviar a revisión",
      );
    }
  }

  const row = await db.transaction(async (tx) => {
    const projectId = task.projectId;

    // Los límites de WIP son por proyecto — una tarea independiente no
    // tiene proyecto que bloquear ni límite que chequear.
    if (projectId && (nextStatus === "activa" || nextStatus === "revision")) {
      // Lock the project row so two concurrent transitions into the same WIP
      // column can't both read the count as "under the limit" before either commits.
      await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update");
    }

    if (nextStatus === "activa") {
      if (task.dependencyId) {
        const dep = await getTask(task.dependencyId);
        if (dep && dep.status !== "completada") {
          throw new HttpError(
            400,
            "la tarea de la que depende todavía no está completada",
          );
        }
      }
      if (projectId) {
        const [project] = await tx
          .select()
          .from(projects)
          .where(eq(projects.id, projectId));
        const [{ value: activeCount }] = await tx
          .select({ value: count() })
          .from(tasks)
          .where(
            and(eq(tasks.projectId, projectId), eq(tasks.status, "activa")),
          );
        if (project && activeCount >= project.limitActive) {
          throw new HttpError(
            400,
            "el proyecto ya tiene el máximo de tareas activas",
          );
        }
      }
    }

    if (nextStatus === "revision" && projectId) {
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      const [{ value: reviewCount }] = await tx
        .select({ value: count() })
        .from(tasks)
        .where(
          and(eq(tasks.projectId, projectId), eq(tasks.status, "revision")),
        );
      if (project && reviewCount >= project.limitReview) {
        throw new HttpError(
          400,
          "el proyecto ya tiene el máximo de tareas en revisión",
        );
      }
    }

    const patch: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: new Date(),
    };
    if (input.evidence) patch.evidence = input.evidence;
    if (nextStatus === "completada") patch.approvedAt = new Date();

    const [updated] = await tx
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  });

  await recordChange({
    projectId: task.projectId,
    taskId: id,
    actorId,
    action: "task_status_changed",
    note: input.note
      ? `${task.status} → ${nextStatus}: ${input.note}`
      : `${task.status} → ${nextStatus}`,
  });

  return row;
}

export async function logHours(input: {
  taskId: string;
  userId: string;
  role: "owner" | "support";
  date: string;
  hours: string;
}) {
  const [row] = await db.insert(taskLogs).values(input).returning();

  const task = await getTask(input.taskId);
  if (task) {
    await recordChange({
      projectId: task.projectId,
      taskId: input.taskId,
      actorId: input.userId,
      action: "task_hours_logged",
      note: `${input.hours} h el ${input.date}`,
    });
  }

  return row;
}

export async function listLogs(taskId: string) {
  return db
    .select()
    .from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(asc(taskLogs.date));
}

// Misma forma que listLogs, pero para varias tareas en una sola consulta —
// evita hacer una query por tarea cuando se necesitan las horas de muchas a
// la vez (ej. la carga por persona de un proyecto).
export async function listLogsByTaskIds(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, { hours: string }[]>();
  const rows = await db
    .select({ taskId: taskLogs.taskId, hours: taskLogs.hours })
    .from(taskLogs)
    .where(inArray(taskLogs.taskId, taskIds));

  const byTask = new Map<string, { hours: string }[]>();
  for (const row of rows) {
    const list = byTask.get(row.taskId) ?? [];
    list.push({ hours: row.hours });
    byTask.set(row.taskId, list);
  }
  return byTask;
}

// Misma forma que listSupport, pero para varias tareas en una sola consulta
// — usado para marcar en un listado si el usuario actual es apoyo de cada tarea.
export async function listSupportUserIdsByTaskIds(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({ taskId: taskSupport.taskId, userId: taskSupport.userId })
    .from(taskSupport)
    .where(inArray(taskSupport.taskId, taskIds));

  const byTask = new Map<string, string[]>();
  for (const row of rows) {
    const list = byTask.get(row.taskId) ?? [];
    list.push(row.userId);
    byTask.set(row.taskId, list);
  }
  return byTask;
}

export async function countTasksForOwner(ownerId: string, statuses: string[]) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.ownerId, ownerId), inArray(tasks.status, statuses)));
  return value;
}

export async function countOverdueForOwner(ownerId: string, today: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.ownerId, ownerId),
        lt(tasks.due, today),
        notInArray(tasks.status, ["completada", "cancelada"]),
      ),
    );
  return value;
}

export async function listOverdueForOwner(ownerId: string, today: string) {
  return db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.ownerId, ownerId),
        lt(tasks.due, today),
        notInArray(tasks.status, ["completada", "cancelada"]),
      ),
    )
    .orderBy(asc(tasks.due));
}

// Tareas activas/en validación sin ninguna hora registrada todavía — el
// presupuesto (estimate) existe pero nadie reportó avance real contra él.
export async function listBudgetPendingForLeader(leaderId: string | null) {
  return db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(taskLogs, eq(taskLogs.taskId, tasks.id))
    .where(
      leaderId
        ? and(
            inArray(tasks.status, ["activa", "revision"]),
            isNull(taskLogs.id),
            eq(projects.leaderId, leaderId),
          )
        : and(
            inArray(tasks.status, ["activa", "revision"]),
            isNull(taskLogs.id),
          ),
    )
    .orderBy(asc(tasks.due));
}

export async function listReviewPendingForLeader(leaderId: string | null) {
  return db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      leaderId
        ? and(eq(tasks.status, "revision"), eq(projects.leaderId, leaderId))
        : eq(tasks.status, "revision"),
    )
    .orderBy(asc(tasks.due));
}

// Tareas para las que el usuario puede pedir apoyo: admin ve todas, el resto
// solo las que lidera (como líder del proyecto) o las que le pertenecen.
export async function listRequestableTasksForUser(
  userId: string,
  role: string,
) {
  const statusFilter = inArray(tasks.status, REQUESTABLE_SUPPORT_STATUSES);
  const scopeFilter = isAdminRole(role)
    ? statusFilter
    : and(
        statusFilter,
        or(eq(projects.leaderId, userId), eq(tasks.ownerId, userId)),
      );

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      ownerId: tasks.ownerId,
      ownerName: user.name,
      projectId: tasks.projectId,
      projectCode: projects.code,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(user, eq(user.id, tasks.ownerId))
    .where(scopeFilter)
    .orderBy(asc(projects.name), asc(tasks.order));
}

export async function moveTask(
  id: string,
  direction: "subir" | "bajar",
  actorId: string,
) {
  const task = await getTask(id);
  if (!task) return undefined;

  await db.transaction(async (tx) => {
    if (task.projectId) {
      await tx
        .select()
        .from(projects)
        .where(eq(projects.id, task.projectId))
        .for("update");
    }

    // NULL nunca es igual a NULL en SQL — `eq` no sirve para agrupar
    // tareas independientes, hace falta `isNull`.
    const siblings = await tx
      .select()
      .from(tasks)
      .where(
        task.projectId
          ? eq(tasks.projectId, task.projectId)
          : isNull(tasks.projectId),
      )
      .orderBy(asc(tasks.order));

    const index = siblings.findIndex((t) => t.id === id);
    const neighborIndex = direction === "subir" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= siblings.length) {
      throw new HttpError(400, "la tarea ya está en el extremo del orden");
    }
    const neighbor = siblings[neighborIndex];

    const ordersAfter = new Map(siblings.map((s) => [s.id, s.order]));
    ordersAfter.set(task.id, neighbor.order);
    ordersAfter.set(neighbor.id, task.order);

    const dependencyOrderOk = (t: (typeof siblings)[number]) => {
      if (!t.dependencyId) return true;
      const depOrder = ordersAfter.get(t.dependencyId);
      if (depOrder === undefined) return true;
      const myOrder = ordersAfter.get(t.id);
      return depOrder < (myOrder ?? 0);
    };

    // Chequear todos los hermanos, no solo task/neighbor: una tercera tarea
    // puede depender de cualquiera de los dos y quedar con el orden roto.
    if (siblings.some((t) => !dependencyOrderOk(t))) {
      throw new HttpError(
        400,
        "ese movimiento deja una dependencia después de la tarea que depende de ella",
      );
    }

    await tx
      .update(tasks)
      .set({ order: neighbor.order, updatedAt: new Date() })
      .where(eq(tasks.id, task.id));
    await tx
      .update(tasks)
      .set({ order: task.order, updatedAt: new Date() })
      .where(eq(tasks.id, neighbor.id));
  });

  await recordChange({
    projectId: task.projectId,
    taskId: id,
    actorId,
    action: "task_order_changed",
    note: `tarea "${task.title}" se movió ${direction === "subir" ? "arriba" : "abajo"}`,
  });

  return getTask(id);
}

export interface UpdateTaskPatch {
  title?: string;
  deliverable?: string;
  description?: string;
  estimate?: string;
  weight?: number;
  priority?: string;
  dependencyId?: string | null;
  due?: string;
  ownerId?: string;
}

export async function updateTask(
  id: string,
  patch: UpdateTaskPatch,
  actorId: string,
  motivo: string,
) {
  const task = await getTask(id);
  if (!task) return undefined;

  if (task.status === "completada" || task.status === "cancelada") {
    throw new HttpError(
      400,
      "no se puede editar una tarea completada o cancelada",
    );
  }

  if (patch.dependencyId) {
    if (patch.dependencyId === id) {
      throw new HttpError(400, "una tarea no puede depender de sí misma");
    }
    const dep = await getTask(patch.dependencyId);
    if (!dep || dep.projectId !== task.projectId) {
      throw new HttpError(
        400,
        "la dependencia debe ser una tarea del mismo proyecto",
      );
    }
  }

  await assertDailyEstimateLimit(
    patch.ownerId ?? task.ownerId,
    patch.due ?? task.due,
    Number(patch.estimate ?? task.estimate),
    id,
  );

  const keys = Object.keys(patch) as (keyof UpdateTaskPatch)[];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const key of keys) {
    before[key] = task[key];
    after[key] = patch[key];
  }

  const [updated] = await db
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  await recordChange({
    projectId: task.projectId,
    taskId: id,
    actorId,
    action: "task_updated",
    note: `${motivo} — antes: ${JSON.stringify(before)} → después: ${JSON.stringify(after)}`,
  });

  return updated;
}

export async function listTasksForOwner(ownerId: string) {
  return db
    .select({
      task: tasks,
      projectName: projects.name,
      projectCode: projects.code,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.ownerId, ownerId))
    .orderBy(asc(tasks.due));
}

export async function listTasksForSupport(userId: string) {
  return db
    .select({
      task: tasks,
      projectName: projects.name,
      projectCode: projects.code,
    })
    .from(taskSupport)
    .innerJoin(tasks, eq(tasks.id, taskSupport.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(taskSupport.userId, userId))
    .orderBy(asc(tasks.due));
}

export async function teamLoad(dueRange?: { from: string; to: string }) {
  const activeUsers = await db
    .select()
    .from(user)
    .where(eq(user.isActive, true));
  if (activeUsers.length === 0) return [];

  const userIds = activeUsers.map((u) => u.id);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Una consulta agregada por métrica para todo el equipo a la vez, en vez de
  // 5 consultas por persona (N+1) — el resultado es idéntico, solo cambia
  // cómo se arma.
  const [
    pendingRows,
    activeRows,
    ownedRows,
    supportRows,
    openTaskRows,
    monthLogRows,
  ] = await Promise.all([
    db
      .select({ ownerId: tasks.ownerId, value: count() })
      .from(tasks)
      .where(
        and(
          inArray(tasks.ownerId, userIds),
          eq(tasks.status, "pendiente"),
          dueRange ? gte(tasks.due, dueRange.from) : undefined,
          dueRange ? lte(tasks.due, dueRange.to) : undefined,
        ),
      )
      .groupBy(tasks.ownerId),
    db
      .select({ ownerId: tasks.ownerId, value: count() })
      .from(tasks)
      .where(
        and(
          inArray(tasks.ownerId, userIds),
          eq(tasks.status, "activa"),
          dueRange ? gte(tasks.due, dueRange.from) : undefined,
          dueRange ? lte(tasks.due, dueRange.to) : undefined,
        ),
      )
      .groupBy(tasks.ownerId),
    db
      .select({ ownerId: tasks.ownerId, value: count() })
      .from(tasks)
      .where(
        and(
          inArray(tasks.ownerId, userIds),
          notInArray(tasks.status, ["completada", "cancelada"]),
          dueRange ? gte(tasks.due, dueRange.from) : undefined,
          dueRange ? lte(tasks.due, dueRange.to) : undefined,
        ),
      )
      .groupBy(tasks.ownerId),
    db
      .select({ userId: taskSupport.userId, value: count() })
      .from(taskSupport)
      .innerJoin(tasks, eq(tasks.id, taskSupport.taskId))
      .where(
        and(
          inArray(taskSupport.userId, userIds),
          notInArray(tasks.status, ["completada", "cancelada"]),
          dueRange ? gte(tasks.due, dueRange.from) : undefined,
          dueRange ? lte(tasks.due, dueRange.to) : undefined,
        ),
      )
      .groupBy(taskSupport.userId),
    db
      .select({
        taskId: tasks.id,
        ownerId: tasks.ownerId,
        estimate: tasks.estimate,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.ownerId, userIds),
          notInArray(tasks.status, ["completada", "cancelada"]),
          dueRange ? gte(tasks.due, dueRange.from) : undefined,
          dueRange ? lte(tasks.due, dueRange.to) : undefined,
        ),
      ),
    db
      .select({ userId: taskLogs.userId, hours: taskLogs.hours })
      .from(taskLogs)
      .innerJoin(tasks, eq(tasks.id, taskLogs.taskId))
      .where(
        and(
          inArray(taskLogs.userId, userIds),
          eq(tasks.status, "completada"),
          gte(taskLogs.date, monthStart),
        ),
      ),
  ]);

  // Horas abiertas = estimado - registrado (mínimo 0) de las tareas abiertas,
  // solo como responsable — el apoyo no suma acá. Necesita el registro por
  // tarea, no por usuario, así que es una consulta aparte una vez que se
  // sabe qué tareas están abiertas.
  const openLogsByTaskId = await listLogsByTaskIds(
    openTaskRows.map((t) => t.taskId),
  );
  const openTasksByUser = new Map<
    string,
    { estimate: string | null; logs: { hours: string }[] }[]
  >();
  for (const t of openTaskRows) {
    const list = openTasksByUser.get(t.ownerId) ?? [];
    list.push({
      estimate: t.estimate,
      logs: openLogsByTaskId.get(t.taskId) ?? [],
    });
    openTasksByUser.set(t.ownerId, list);
  }

  const countByUser = (
    rows: { ownerId?: string; userId?: string; value: number }[],
  ) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.ownerId ?? row.userId;
      if (key) map.set(key, row.value);
    }
    return map;
  };
  const logsByUser = (rows: { userId: string; hours: string }[]) => {
    const map = new Map<string, { hours: string }[]>();
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push({ hours: row.hours });
      map.set(row.userId, list);
    }
    return map;
  };

  const pendingByUser = countByUser(pendingRows);
  const activeByUser = countByUser(activeRows);
  const ownedByUser = countByUser(ownedRows);
  const supportByUser = countByUser(supportRows);
  const monthLogsByUser = logsByUser(monthLogRows);

  return activeUsers.map((u) => ({
    userId: u.id,
    name: u.name,
    color: u.color,
    pending: pendingByUser.get(u.id) ?? 0,
    active: activeByUser.get(u.id) ?? 0,
    owned: ownedByUser.get(u.id) ?? 0,
    support: supportByUser.get(u.id) ?? 0,
    openHours: openHoursRemaining(openTasksByUser.get(u.id) ?? []),
    confirmedMonthHours: declaredHours(monthLogsByUser.get(u.id) ?? []),
    weeklyCapacityHours: u.weeklyCapacityHours,
  }));
}

export interface DateRange {
  from: string;
  to: string;
}

export async function hoursByProject(range: DateRange) {
  const rows = await db
    .select({
      projectId: tasks.projectId,
      projectName: projects.name,
      hours: taskLogs.hours,
    })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(gte(taskLogs.date, range.from), lte(taskLogs.date, range.to)));

  const byProject = new Map<
    string,
    { projectId: string; projectName: string; hours: number }
  >();
  for (const row of rows) {
    // El inner join con projects garantiza que projectId nunca es null acá
    // (una tarea independiente no tiene fila de proyecto que machear).
    const projectId = row.projectId as string;
    const existing = byProject.get(projectId) ?? {
      projectId,
      projectName: row.projectName,
      hours: 0,
    };
    existing.hours += Number(row.hours);
    byProject.set(projectId, existing);
  }
  return Array.from(byProject.values());
}

export async function topTasksByHours(range: DateRange, limit: number) {
  const rows = await db
    .select({ taskId: tasks.id, title: tasks.title, hours: taskLogs.hours })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.taskId))
    .where(and(gte(taskLogs.date, range.from), lte(taskLogs.date, range.to)));

  const byTask = new Map<
    string,
    { taskId: string; title: string; hours: number }
  >();
  for (const row of rows) {
    const existing = byTask.get(row.taskId) ?? {
      taskId: row.taskId,
      title: row.title,
      hours: 0,
    };
    existing.hours += Number(row.hours);
    byTask.set(row.taskId, existing);
  }
  return Array.from(byTask.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}

export async function hoursByDay(range: DateRange) {
  const rows = await db
    .select({ date: taskLogs.date, hours: taskLogs.hours })
    .from(taskLogs)
    .where(and(gte(taskLogs.date, range.from), lte(taskLogs.date, range.to)));

  const byDay = new Map<string, number>();
  for (const row of rows) {
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + Number(row.hours));
  }
  return Array.from(byDay.entries()).map(([date, hours]) => ({
    date,
    hours,
  }));
}

export async function hoursByPersonAndDay(range: DateRange) {
  const rows = await db
    .select({
      userId: taskLogs.userId,
      name: user.name,
      date: taskLogs.date,
      hours: taskLogs.hours,
    })
    .from(taskLogs)
    .innerJoin(user, eq(user.id, taskLogs.userId))
    .where(and(gte(taskLogs.date, range.from), lte(taskLogs.date, range.to)));

  const byPersonDay = new Map<
    string,
    { userId: string; name: string; date: string; hours: number }
  >();
  for (const row of rows) {
    const key = `${row.userId}|${row.date}`;
    const existing = byPersonDay.get(key) ?? {
      userId: row.userId,
      name: row.name,
      date: row.date,
      hours: 0,
    };
    existing.hours += Number(row.hours);
    byPersonDay.set(key, existing);
  }
  return Array.from(byPersonDay.values());
}

export async function hoursByCollaborator(range: DateRange) {
  const rows = await db
    .select({ userId: taskLogs.userId, name: user.name, hours: taskLogs.hours })
    .from(taskLogs)
    .innerJoin(user, eq(user.id, taskLogs.userId))
    .where(and(gte(taskLogs.date, range.from), lte(taskLogs.date, range.to)));

  const byUser = new Map<
    string,
    { userId: string; name: string; hours: number }
  >();
  for (const row of rows) {
    const existing = byUser.get(row.userId) ?? {
      userId: row.userId,
      name: row.name,
      hours: 0,
    };
    existing.hours += Number(row.hours);
    byUser.set(row.userId, existing);
  }
  return Array.from(byUser.values()).sort((a, b) => b.hours - a.hours);
}

export async function estimateVsActual() {
  const doneTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "completada"));
  if (doneTasks.length === 0) return [];

  const taskIds = doneTasks.map((t) => t.id);
  const logs = await db
    .select({ taskId: taskLogs.taskId, hours: taskLogs.hours })
    .from(taskLogs)
    .where(inArray(taskLogs.taskId, taskIds));

  const logsByTask = new Map<string, { hours: string }[]>();
  for (const log of logs) {
    const list = logsByTask.get(log.taskId) ?? [];
    list.push({ hours: log.hours });
    logsByTask.set(log.taskId, list);
  }

  return doneTasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    estimate: Number(t.estimate),
    actual: declaredHours(logsByTask.get(t.id) ?? []),
  }));
}
