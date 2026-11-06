import { desc, eq } from "drizzle-orm";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { auditLog, projects, tasks } from "./schema.ts";

export async function recordChange(input: {
  projectId: string;
  taskId?: string | null;
  actorId: string;
  action: string;
  note?: string;
}) {
  const [row] = await db
    .insert(auditLog)
    .values({
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      actorId: input.actorId,
      action: input.action,
      note: input.note ?? "",
    })
    .returning();
  return row;
}

export async function listByProject(projectId: string) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.projectId, projectId))
    .orderBy(desc(auditLog.createdAt));
}

export async function listByTask(taskId: string) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.taskId, taskId))
    .orderBy(desc(auditLog.createdAt));
}

export async function listByTaskEnriched(taskId: string) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      note: auditLog.note,
      createdAt: auditLog.createdAt,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(eq(auditLog.taskId, taskId))
    .orderBy(desc(auditLog.createdAt));
}

export async function listRecent(limit: number) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      note: auditLog.note,
      createdAt: auditLog.createdAt,
      actorName: user.name,
      projectId: auditLog.projectId,
      projectName: projects.name,
      taskId: auditLog.taskId,
      taskTitle: tasks.title,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .leftJoin(projects, eq(projects.id, auditLog.projectId))
    .leftJoin(tasks, eq(tasks.id, auditLog.taskId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
