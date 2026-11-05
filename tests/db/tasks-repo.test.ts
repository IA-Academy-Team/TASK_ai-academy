import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import {
  createTask,
  listTasksByProject,
  logHours,
  transitionTask,
} from "../../src/db/tasks-repo.ts";
import { auth } from "../../src/lib/auth.ts";

async function makeUser(email: string) {
  await auth.api.signUpEmail({
    body: { email, password: "supersecret123", name: "Test" },
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

async function makeProject(leaderId: string) {
  return createProject({
    name: "Proyecto",
    code: "P-1",
    objective: "Objetivo",
    leaderId,
    start: "2026-01-01",
    due: "2026-02-01",
    limitActive: 1,
    limitReview: 1,
    memberIds: [],
  });
}

describe("tasks-repo", () => {
  it("createTask inserta con status pendiente y order correlativo", async () => {
    const leader = await makeUser("tr-leader1@test.local");
    const project = await makeProject(leader.id);

    const t1 = await createTask({
      projectId: project.id,
      title: "Tarea 1",
      deliverable: "Entregable",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });
    expect(t1.status).toBe("pendiente");
    expect(t1.order).toBe(1);

    const t2 = await createTask({
      projectId: project.id,
      title: "Tarea 2",
      deliverable: "Entregable",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "2",
      dependencyId: null,
      due: "2026-01-12",
      supportIds: [],
      actorId: leader.id,
    });
    expect(t2.order).toBe(2);

    const list = await listTasksByProject(project.id);
    expect(list.map((t) => t.title)).toEqual(["Tarea 1", "Tarea 2"]);
  });

  it("transitionTask bloquea activar si la dependencia no está completada", async () => {
    const leader = await makeUser("tr-leader2@test.local");
    const project = await makeProject(leader.id);
    const dep = await createTask({
      projectId: project.id,
      title: "Base",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-05",
      supportIds: [],
      actorId: leader.id,
    });
    const t = await createTask({
      projectId: project.id,
      title: "Depende",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: dep.id,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    await expect(transitionTask(t.id, "activa", leader.id, {})).rejects.toThrow(
      /depende/,
    );

    await transitionTask(dep.id, "activa", leader.id, {});
    await transitionTask(dep.id, "revision", leader.id, {});
    await transitionTask(dep.id, "completada", leader.id, {
      evidence: "listo",
    });

    const activated = await transitionTask(t.id, "activa", leader.id, {});
    expect(activated?.status).toBe("activa");
  });

  it("transitionTask respeta el límite de tareas activas del proyecto", async () => {
    const leader = await makeUser("tr-leader3@test.local");
    const project = await makeProject(leader.id); // limitActive: 1

    const a = await createTask({
      projectId: project.id,
      title: "A",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });
    const b = await createTask({
      projectId: project.id,
      title: "B",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    await transitionTask(a.id, "activa", leader.id, {});
    await expect(transitionTask(b.id, "activa", leader.id, {})).rejects.toThrow(
      /máximo/,
    );
  });

  it("transitionTask exige evidencia antes de completar", async () => {
    const leader = await makeUser("tr-leader4@test.local");
    const project = await makeProject(leader.id);
    const t = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });
    await transitionTask(t.id, "activa", leader.id, {});
    await transitionTask(t.id, "revision", leader.id, {});

    await expect(
      transitionTask(t.id, "completada", leader.id, {}),
    ).rejects.toThrow(/evidencia/);

    const done = await transitionTask(t.id, "completada", leader.id, {
      evidence: "ok",
    });
    expect(done?.status).toBe("completada");
    expect(done?.approvedAt).not.toBeNull();
  });

  it("transitionTask rechaza una transición no permitida", async () => {
    const leader = await makeUser("tr-leader5@test.local");
    const project = await makeProject(leader.id);
    const t = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    await expect(
      transitionTask(t.id, "completada", leader.id, { evidence: "x" }),
    ).rejects.toThrow(/no se puede pasar/);
  });

  it("transitionTask sobre un id inexistente devuelve undefined", async () => {
    const leader = await makeUser("tr-leader7@test.local");
    const result = await transitionTask(
      "00000000-0000-0000-0000-000000000000",
      "activa",
      leader.id,
      {},
    );
    expect(result).toBeUndefined();
  });

  it("logHours registra horas contra la tarea", async () => {
    const leader = await makeUser("tr-leader6@test.local");
    const project = await makeProject(leader.id);
    const t = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    const log = await logHours({
      taskId: t.id,
      userId: leader.id,
      role: "owner",
      date: "2026-01-02",
      hours: "3",
    });
    expect(log.hours).toBe("3.0");
  });
});
