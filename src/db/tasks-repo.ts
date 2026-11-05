import { and, asc, count, eq, inArray, lt, notInArray } from "drizzle-orm";
import { HttpError } from "../lib/http-error.ts";
import { recordChange } from "./audit-repo.ts";
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

export async function transitionTask(
  id: string,
  nextStatus: string,
  actorId: string,
  input: { evidence?: string },
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
    note: `${task.status} → ${nextStatus}`,
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
