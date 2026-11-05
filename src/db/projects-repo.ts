import { count, desc, eq, inArray } from "drizzle-orm";
import { recordChange } from "./audit-repo.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { projectMembers, projects, tasks } from "./schema.ts";

export async function createProject(input: {
  name: string;
  code: string;
  objective: string;
  leaderId: string;
  start: string;
  due: string;
  limitActive: number;
  limitReview: number;
  memberIds: string[];
}) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({
        name: input.name,
        code: input.code,
        objective: input.objective,
        leaderId: input.leaderId,
        start: input.start,
        due: input.due,
        limitActive: input.limitActive,
        limitReview: input.limitReview,
      })
      .returning();

    const memberIds = Array.from(new Set([...input.memberIds, input.leaderId]));
    await tx
      .insert(projectMembers)
      .values(memberIds.map((userId) => ({ projectId: row.id, userId })));

    return row;
  });
}

export async function listProjects() {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt));
  const allTasks = await db.select().from(tasks);

  return rows.map((p) => {
    const projectTasks = allTasks.filter((t) => t.projectId === p.id);
    const done = projectTasks.filter((t) => t.status === "completada").length;
    return { ...p, taskCount: projectTasks.length, doneCount: done };
  });
}

export async function getProject(id: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return row;
}

export async function listMembers(projectId: string) {
  const memberRows = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  const ids = memberRows.map((m) => m.userId);
  if (ids.length === 0) return [];
  return db.select().from(user).where(inArray(user.id, ids));
}

export async function listAllActiveUsers() {
  return db.select().from(user).where(eq(user.isActive, true));
}

export async function countActiveProjects() {
  const [{ value }] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.status, "activo"));
  return value;
}

export async function updateSettings(
  id: string,
  input: {
    limitActive: number;
    limitReview: number;
    due: string;
    actorId: string;
  },
) {
  const [row] = await db
    .update(projects)
    .set({
      limitActive: input.limitActive,
      limitReview: input.limitReview,
      due: input.due,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  await recordChange({
    projectId: id,
    actorId: input.actorId,
    action: "project_settings_updated",
    note: `límites ${input.limitActive}/${input.limitReview}, vence ${input.due}`,
  });

  return row;
}

export async function setMembers(projectId: string, memberIds: string[]) {
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    const unique = Array.from(new Set(memberIds));
    if (unique.length > 0) {
      await tx
        .insert(projectMembers)
        .values(unique.map((userId) => ({ projectId, userId })));
    }
  });
}
