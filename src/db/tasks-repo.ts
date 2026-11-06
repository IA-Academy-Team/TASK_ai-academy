import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  lt,
  lte,
  notInArray,
} from "drizzle-orm";
import { declaredHours } from "../domain/hours.ts";
import { HttpError } from "../lib/http-error.ts";
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

export async function createTask(input: {
  projectId: string;
  title: string;
  deliverable: string;
  description: string;
  ownerId: string;
  priority: string;
  weight: number;
  estimate: string;
  dependencyId: string | null;
  due: string;
  supportIds: string[];
  actorId: string;
}) {
  if (input.dependencyId) {
    const [dep] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, input.dependencyId));
    if (!dep || dep.projectId !== input.projectId) {
      throw new HttpError(
        400,
        "la dependencia debe ser una tarea del mismo proyecto",
      );
    }
  }

  const row = await db.transaction(async (tx) => {
    // Lock the project row so two concurrent creates can't both count the
    // same "existing" total and land on the same order number.
    await tx
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .for("update");

    const [{ value: existing }] = await tx
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.projectId, input.projectId));

    const [created] = await tx
      .insert(tasks)
      .values({
        projectId: input.projectId,
        order: existing + 1,
        title: input.title,
        deliverable: input.deliverable,
        description: input.description,
        ownerId: input.ownerId,
        priority: input.priority,
        weight: input.weight,
        estimate: input.estimate,
        dependencyId: input.dependencyId,
        due: input.due,
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

export async function getTask(id: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  return row;
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
    if (nextStatus === "activa" || nextStatus === "revision") {
      // Lock the project row so two concurrent transitions into the same WIP
      // column can't both read the count as "under the limit" before either commits.
      await tx
        .select()
        .from(projects)
        .where(eq(projects.id, task.projectId))
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
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, task.projectId));
      const [{ value: activeCount }] = await tx
        .select({ value: count() })
        .from(tasks)
        .where(
          and(eq(tasks.projectId, task.projectId), eq(tasks.status, "activa")),
        );
      if (project && activeCount >= project.limitActive) {
        throw new HttpError(
          400,
          "el proyecto ya tiene el máximo de tareas activas",
        );
      }
    }

    if (nextStatus === "revision") {
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, task.projectId));
      const [{ value: reviewCount }] = await tx
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, task.projectId),
            eq(tasks.status, "revision"),
          ),
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
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.ownerId, ownerId),
        lt(tasks.due, today),
        notInArray(tasks.status, ["completada", "cancelada"]),
      ),
    )
    .orderBy(asc(tasks.due));
}

export async function listReviewPendingForLeader(leaderId: string | null) {
  return db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      leaderId
        ? and(eq(tasks.status, "revision"), eq(projects.leaderId, leaderId))
        : eq(tasks.status, "revision"),
    )
    .orderBy(asc(tasks.due));
}

export async function moveTask(
  id: string,
  direction: "subir" | "bajar",
  actorId: string,
) {
  const task = await getTask(id);
  if (!task) return undefined;

  await db.transaction(async (tx) => {
    await tx
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .for("update");

    const siblings = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, task.projectId))
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

    if (!dependencyOrderOk(task) || !dependencyOrderOk(neighbor)) {
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
    const [dep] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, patch.dependencyId));
    if (!dep || dep.projectId !== task.projectId) {
      throw new HttpError(
        400,
        "la dependencia debe ser una tarea del mismo proyecto",
      );
    }
  }

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
    .innerJoin(projects, eq(projects.id, tasks.projectId))
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
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(taskSupport.userId, userId))
    .orderBy(asc(tasks.due));
}

export async function teamLoad() {
  const activeUsers = await db
    .select()
    .from(user)
    .where(eq(user.isActive, true));

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const rows = [];
  for (const u of activeUsers) {
    const [{ value: pending }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.ownerId, u.id), eq(tasks.status, "pendiente")));
    const [{ value: active }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.ownerId, u.id), eq(tasks.status, "activa")));
    const [{ value: supportCount }] = await db
      .select({ value: count() })
      .from(taskSupport)
      .innerJoin(tasks, eq(tasks.id, taskSupport.taskId))
      .where(
        and(
          eq(taskSupport.userId, u.id),
          notInArray(tasks.status, ["completada", "cancelada"]),
        ),
      );

    const openLogs = await db
      .select({ hours: taskLogs.hours })
      .from(taskLogs)
      .innerJoin(tasks, eq(tasks.id, taskLogs.taskId))
      .where(
        and(
          eq(taskLogs.userId, u.id),
          notInArray(tasks.status, ["completada", "cancelada"]),
        ),
      );
    const monthLogs = await db
      .select({ hours: taskLogs.hours })
      .from(taskLogs)
      .innerJoin(tasks, eq(tasks.id, taskLogs.taskId))
      .where(
        and(
          eq(taskLogs.userId, u.id),
          eq(tasks.status, "completada"),
          gte(taskLogs.date, monthStart),
        ),
      );

    rows.push({
      userId: u.id,
      name: u.name,
      pending,
      active,
      support: supportCount,
      openHours: declaredHours(openLogs),
      confirmedMonthHours: declaredHours(monthLogs),
      weeklyCapacityHours: u.weeklyCapacityHours,
    });
  }
  return rows;
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
    const existing = byProject.get(row.projectId) ?? {
      projectId: row.projectId,
      projectName: row.projectName,
      hours: 0,
    };
    existing.hours += Number(row.hours);
    byProject.set(row.projectId, existing);
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

  const results = [];
  for (const t of doneTasks) {
    const logs = await listLogs(t.id);
    results.push({
      taskId: t.id,
      title: t.title,
      estimate: Number(t.estimate),
      actual: declaredHours(logs),
    });
  }
  return results;
}
