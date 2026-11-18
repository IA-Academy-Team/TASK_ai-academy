import { hashPassword } from "better-auth/crypto";
import { and, count, eq, or } from "drizzle-orm";
import type { Role } from "../domain/roles.ts";
import { account, user } from "./auth-schema.ts";
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

export async function getUser(id: string) {
  const [row] = await db.select().from(user).where(eq(user.id, id));
  return row;
}

export async function deactivateUser(id: string) {
  await db.update(user).set({ isActive: false }).where(eq(user.id, id));
}

export async function setMustChangePassword(id: string, value: boolean) {
  await db
    .update(user)
    .set({ mustChangePassword: value })
    .where(eq(user.id, id));
}

export async function deleteUser(id: string) {
  await db.delete(user).where(eq(user.id, id));
}

export async function setUserRole(id: string, role: Role) {
  await db.update(user).set({ role }).where(eq(user.id, id));
}

// Reescribe la contraseña del usuario a mano (sin pasar por el flujo normal
// de better-auth, que exige la contraseña actual) — solo un admin puede
// llamar esta función, desde una ruta que ya pasa por authorize(ADMIN_ROLE).
export async function resetUserPassword(id: string, newPassword: string) {
  const hashed = await hashPassword(newPassword);
  await db
    .update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(and(eq(account.userId, id), eq(account.providerId, "credential")));
}

export async function updateUserColor(userId: string, color: string) {
  const [row] = await db
    .update(user)
    .set({ color, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();
  return row;
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
