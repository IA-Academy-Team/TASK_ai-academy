import { and, desc, eq } from "drizzle-orm";
import { HttpError } from "../lib/http-error.ts";
import { db } from "./client.ts";
import { supportRequests, taskSupport } from "./schema.ts";

export async function createRequest(input: {
  taskId: string;
  requestedBy: string;
  targetUserId: string;
  mode: string;
  reason: string;
}) {
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

export async function getRequest(id: string) {
  const [row] = await db
    .select()
    .from(supportRequests)
    .where(eq(supportRequests.id, id));
  return row;
}

export async function resolveRequest(
  id: string,
  status: "aceptada" | "rechazada",
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

  return row;
}
