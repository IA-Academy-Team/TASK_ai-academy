import { and, count, desc, eq } from "drizzle-orm";
import { HttpError } from "../lib/http-error.ts";
import { isUuid } from "../lib/uuid.ts";
import { recordChange } from "./audit-repo.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { projects, supportRequests, taskSupport, tasks } from "./schema.ts";
import { getTask } from "./tasks-repo.ts";

export async function createRequest(input: {
  taskId: string;
  requestedBy: string;
  targetUserId: string;
  mode: string;
  reason: string;
}) {
  const [existing] = await db
    .select()
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.taskId, input.taskId),
        eq(supportRequests.targetUserId, input.targetUserId),
        eq(supportRequests.status, "pendiente"),
      ),
    );
  if (existing) {
    throw new HttpError(
      400,
      "ya hay una solicitud de apoyo pendiente para esta persona en esta tarea",
    );
  }

  const [row] = await db
    .insert(supportRequests)
    .values({
      taskId: input.taskId,
      requestedBy: input.requestedBy,
      targetUserId: input.targetUserId,
      mode: input.mode,
      reason: input.reason,
    })
    .returning();
  return row;
}

export async function listByTask(taskId: string) {
  return db
    .select()
    .from(supportRequests)
    .where(eq(supportRequests.taskId, taskId))
    .orderBy(desc(supportRequests.createdAt));
}

export async function listPendingForUser(userId: string) {
  return db
    .select()
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.targetUserId, userId),
        eq(supportRequests.status, "pendiente"),
      ),
    )
    .orderBy(desc(supportRequests.createdAt));
}

export async function countResolvedForUser(userId: string) {
  const rows = await db
    .select({ status: supportRequests.status, value: count() })
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.targetUserId, userId),
        eq(supportRequests.status, "aceptada"),
      ),
    )
    .groupBy(supportRequests.status);
  const rejected = await db
    .select({ value: count() })
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.targetUserId, userId),
        eq(supportRequests.status, "rechazada"),
      ),
    );
  return { accepted: rows[0]?.value ?? 0, rejected: rejected[0]?.value ?? 0 };
}

export async function listPendingForUserEnriched(userId: string) {
  return db
    .select({
      request: supportRequests,
      taskTitle: tasks.title,
      projectName: projects.name,
      requestedByName: user.name,
    })
    .from(supportRequests)
    .innerJoin(tasks, eq(tasks.id, supportRequests.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(user, eq(user.id, supportRequests.requestedBy))
    .where(
      and(
        eq(supportRequests.targetUserId, userId),
        eq(supportRequests.status, "pendiente"),
      ),
    )
    .orderBy(desc(supportRequests.createdAt));
}

export async function listPendingApplyForLeader(leaderId: string) {
  return db
    .select({
      request: supportRequests,
      taskTitle: tasks.title,
      projectName: projects.name,
      requestedByName: user.name,
    })
    .from(supportRequests)
    .innerJoin(tasks, eq(tasks.id, supportRequests.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(user, eq(user.id, supportRequests.requestedBy))
    .where(
      and(
        eq(supportRequests.status, "pendiente"),
        eq(supportRequests.mode, "apply"),
        eq(projects.leaderId, leaderId),
      ),
    )
    .orderBy(desc(supportRequests.createdAt));
}

export async function listPendingByTask(taskId: string) {
  return db
    .select()
    .from(supportRequests)
    .where(
      and(
        eq(supportRequests.taskId, taskId),
        eq(supportRequests.status, "pendiente"),
      ),
    )
    .orderBy(desc(supportRequests.createdAt));
}

// Reasigna el destinatario de una solicitud pendiente — para cuando la
// cuenta original fue desactivada o eliminada y el líder/admin necesita
// redirigirla a otra persona sin perder la solicitud.
export async function updateRequestTarget(id: string, targetUserId: string) {
  const request = await getRequest(id);
  if (!request) return undefined;
  if (request.status !== "pendiente") {
    throw new HttpError(400, "la solicitud ya fue resuelta");
  }
  const [row] = await db
    .update(supportRequests)
    .set({ targetUserId })
    .where(eq(supportRequests.id, id))
    .returning();
  return row;
}

export async function getRequest(id: string) {
  if (!isUuid(id)) return undefined;
  const [row] = await db
    .select()
    .from(supportRequests)
    .where(eq(supportRequests.id, id));
  return row;
}

export async function resolveRequest(
  id: string,
  status: "aceptada" | "rechazada",
  actorId: string,
) {
  const request = await getRequest(id);
  if (!request) return undefined;
  if (request.status !== "pendiente") {
    throw new HttpError(400, "la solicitud ya fue resuelta");
  }

  const [row] = await db
    .update(supportRequests)
    .set({ status, resolvedAt: new Date() })
    .where(eq(supportRequests.id, id))
    .returning();

  if (status === "aceptada") {
    const [existing] = await db
      .select()
      .from(taskSupport)
      .where(
        and(
          eq(taskSupport.taskId, request.taskId),
          eq(taskSupport.userId, request.targetUserId),
        ),
      );
    if (!existing) {
      await db
        .insert(taskSupport)
        .values({ taskId: request.taskId, userId: request.targetUserId });
    }
  }

  const task = await getTask(request.taskId);
  if (task) {
    await recordChange({
      projectId: task.projectId,
      taskId: task.id,
      actorId,
      action: "support_request_resolved",
      note: `solicitud de apoyo ${status}`,
    });
  }

  return row;
}
