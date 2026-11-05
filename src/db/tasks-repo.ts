import { and, asc, count, eq } from "drizzle-orm";
import { HttpError } from "../lib/http-error.ts";
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

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.projectId, input.projectId));

  const [row] = await db
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
    await db
      .insert(taskSupport)
      .values(supportIds.map((userId) => ({ taskId: row.id, userId })));
  }

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
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId));
    const activeCount = await countByStatus(task.projectId, "activa");
    if (project && activeCount >= project.limitActive) {
      throw new HttpError(
        400,
        "el proyecto ya tiene el máximo de tareas activas",
      );
    }
  }

  if (nextStatus === "revision") {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId));
    const reviewCount = await countByStatus(task.projectId, "revision");
    if (project && reviewCount >= project.limitReview) {
      throw new HttpError(
        400,
        "el proyecto ya tiene el máximo de tareas en revisión",
      );
    }
  }

  if (nextStatus === "completada" && !task.evidence && !input.evidence) {
    throw new HttpError(
      400,
      "hace falta registrar la evidencia antes de aprobar",
    );
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
    updatedAt: new Date(),
  };
  if (input.evidence) patch.evidence = input.evidence;
  if (nextStatus === "completada") patch.approvedAt = new Date();

  const [row] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning();
  void actorId;
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
  return row;
}

export async function listLogs(taskId: string) {
  return db
    .select()
    .from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(asc(taskLogs.date));
}
