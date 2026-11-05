import { count, eq, or } from "drizzle-orm";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import {
  auditLog,
  projects,
  supportRequests,
  taskLogs,
  tasks,
} from "./schema.ts";

export async function listAllUsers() {
  return db.select().from(user);
}

export async function deactivateUser(id: string) {
  await db.update(user).set({ isActive: false }).where(eq(user.id, id));
}

export async function deleteUser(id: string) {
  await db.delete(user).where(eq(user.id, id));
}

export async function getUserActivityCounts(id: string) {
  const [{ value: ledProjects }] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.leaderId, id));
  const [{ value: ownedTasks }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.ownerId, id));
  const [{ value: loggedHours }] = await db
    .select({ value: count() })
    .from(taskLogs)
    .where(eq(taskLogs.userId, id));
  const [{ value: auditRows }] = await db
    .select({ value: count() })
    .from(auditLog)
    .where(eq(auditLog.actorId, id));
  const [{ value: supportRequestRows }] = await db
    .select({ value: count() })
    .from(supportRequests)
    .where(
      or(
        eq(supportRequests.requestedBy, id),
        eq(supportRequests.targetUserId, id),
      ),
    );
  return {
    ledProjects,
    ownedTasks,
    loggedHours,
    auditRows,
    supportRequestRows,
  };
}
