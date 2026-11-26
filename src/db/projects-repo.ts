import { and, count, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import { ADMIN_ROLE } from "../domain/roles.ts";
import { isUuid } from "../lib/uuid.ts";
import { recordChange } from "./audit-repo.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { projectMembers, projects, taskLogs, tasks } from "./schema.ts";

const GENERIC_CODE_PREFIX = "PRY";

function codePrefixFromName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join("");
  }
  return (words[0] ?? GENERIC_CODE_PREFIX).slice(0, 3) || GENERIC_CODE_PREFIX;
}

function nextCodeForPrefix(prefix: string, existingCodes: string[]): string {
  const numberPattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxNumber = existingCodes.reduce((max, code) => {
    const match = code.match(numberPattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function generateProjectCode(name: string): Promise<string> {
  const prefix = codePrefixFromName(name);
  const existing = await db
    .select({ code: projects.code })
    .from(projects)
    .where(like(projects.code, `${prefix}-%`));

  return nextCodeForPrefix(
    prefix,
    existing.map((row) => row.code),
  );
}

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

    // El líder dirige el proyecto pero no cuenta como integrante.
    const memberIds = Array.from(new Set(input.memberIds)).filter(
      (id) => id !== input.leaderId,
    );
    if (memberIds.length > 0) {
      await tx
        .insert(projectMembers)
        .values(memberIds.map((userId) => ({ projectId: row.id, userId })));
    }

    return row;
  });
}

// Genera el código y crea el proyecto en la misma transacción, con un
// advisory lock por prefijo — a diferencia de llamar generateProjectCode()
// y createProject() por separado, dos altas concurrentes con el mismo
// prefijo no pueden calcular el mismo número correlativo. El lock es por
// transacción (pg_advisory_xact_lock): se libera solo al cerrar la tx, y
// cubre también el caso de un prefijo que todavía no tiene ninguna fila
// (un SELECT ... FOR UPDATE no bloquearía nada en ese caso).
export async function createProjectWithCode(input: {
  name: string;
  objective: string;
  leaderId: string;
  start: string;
  due: string;
  limitActive: number;
  limitReview: number;
  memberIds: string[];
}) {
  const prefix = codePrefixFromName(input.name);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${prefix}))`);

    const existing = await tx
      .select({ code: projects.code })
      .from(projects)
      .where(like(projects.code, `${prefix}-%`));
    const code = nextCodeForPrefix(
      prefix,
      existing.map((row) => row.code),
    );

    const [row] = await tx
      .insert(projects)
      .values({
        name: input.name,
        code,
        objective: input.objective,
        leaderId: input.leaderId,
        start: input.start,
        due: input.due,
        limitActive: input.limitActive,
        limitReview: input.limitReview,
      })
      .returning();

    const memberIds = Array.from(new Set(input.memberIds)).filter(
      (id) => id !== input.leaderId,
    );
    if (memberIds.length > 0) {
      await tx
        .insert(projectMembers)
        .values(memberIds.map((userId) => ({ projectId: row.id, userId })));
    }

    return row;
  });
}

export async function listProjects() {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt));
  const projectIds = rows.map((p) => p.id);

  // Acotada a las tareas/horas de estos proyectos (nunca todo el historial
  // del sistema, incluidas tareas independientes que no hacen falta acá).
  const allTasks =
    projectIds.length === 0
      ? []
      : await db
          .select()
          .from(tasks)
          .where(inArray(tasks.projectId, projectIds));
  const taskIds = allTasks.map((t) => t.id);
  const allLogs =
    taskIds.length === 0
      ? []
      : await db
          .select()
          .from(taskLogs)
          .where(inArray(taskLogs.taskId, taskIds));
  const allMembers = await db
    .select({
      projectId: projectMembers.projectId,
      userId: user.id,
      name: user.name,
    })
    .from(projectMembers)
    .innerJoin(user, eq(user.id, projectMembers.userId));
  const leaders = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(
      inArray(
        user.id,
        rows.map((p) => p.leaderId),
      ),
    );
  const leaderNameById = new Map(leaders.map((l) => [l.id, l.name]));

  return rows.map((p) => {
    const projectTasks = allTasks.filter((t) => t.projectId === p.id);
    const projectTaskIds = new Set(projectTasks.map((t) => t.id));
    const done = projectTasks.filter((t) => t.status === "completada").length;
    const members = allMembers.filter((m) => m.projectId === p.id);
    const logs = allLogs.filter((l) => projectTaskIds.has(l.taskId));
    return {
      ...p,
      taskCount: projectTasks.length,
      doneCount: done,
      members,
      leaderName: leaderNameById.get(p.leaderId) ?? "",
      tasks: projectTasks,
      logs,
    };
  });
}

export async function getProject(id: string | null | undefined) {
  if (!id || !isUuid(id)) return undefined;
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
  return db
    .select()
    .from(user)
    .where(and(inArray(user.id, ids), ne(user.role, ADMIN_ROLE)));
}

// Excluye administrador: nunca debe aparecer como opción asignable
// (líder, miembro, responsable, apoyo) en ningún formulario.
export async function listAllActiveUsers() {
  return db
    .select()
    .from(user)
    .where(and(eq(user.isActive, true), ne(user.role, ADMIN_ROLE)));
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

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
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
