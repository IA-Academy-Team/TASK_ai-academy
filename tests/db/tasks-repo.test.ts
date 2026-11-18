import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { tasks } from "../../src/db/schema.ts";
import {
  createTask,
  listRequestableTasksForUser,
  listTasksByProject,
  logHours,
  teamLoad,
  transitionTask,
  updateTask,
} from "../../src/db/tasks-repo.ts";
import { ADMIN_ROLE, DEFAULT_ROLE } from "../../src/domain/roles.ts";
import { auth } from "../../src/lib/auth.ts";
import { HttpError } from "../../src/lib/http-error.ts";

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
    await logHours({
      taskId: dep.id,
      userId: leader.id,
      role: "owner",
      date: "2026-01-04",
      hours: "1",
    });
    await transitionTask(dep.id, "revision", leader.id, {
      evidence: "avance",
    });
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
    await logHours({
      taskId: t.id,
      userId: leader.id,
      role: "owner",
      date: "2026-01-04",
      hours: "1",
    });
    await transitionTask(t.id, "revision", leader.id, { evidence: "avance" });
    // Un registro sin evidencia no puede llegar normalmente a "revision" (el
    // guard de arriba lo exige), así que se simula el caso borde a mano para
    // seguir cubriendo el guard de "completada".
    await db.update(tasks).set({ evidence: null }).where(eq(tasks.id, t.id));

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

  it("listRequestableTasksForUser solo trae las tareas del líder o propias", async () => {
    const leader = await makeUser("tr-leader7@test.local");
    const owner = await makeUser("tr-owner7@test.local");
    const stranger = await makeUser("tr-stranger7@test.local");
    const project = await makeProject(leader.id);
    const task = await createTask({
      projectId: project.id,
      title: "Tarea del equipo",
      deliverable: "E",
      description: "",
      ownerId: owner.id,
      priority: "media",
      weight: 1,
      estimate: "2",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    const forLeader = await listRequestableTasksForUser(
      leader.id,
      DEFAULT_ROLE,
    );
    expect(forLeader.map((t) => t.id)).toContain(task.id);

    const forOwner = await listRequestableTasksForUser(owner.id, DEFAULT_ROLE);
    expect(forOwner.map((t) => t.id)).toContain(task.id);

    const forStranger = await listRequestableTasksForUser(
      stranger.id,
      DEFAULT_ROLE,
    );
    expect(forStranger.map((t) => t.id)).not.toContain(task.id);

    const forAdmin = await listRequestableTasksForUser(stranger.id, ADMIN_ROLE);
    expect(forAdmin.map((t) => t.id)).toContain(task.id);
  });

  it("listRequestableTasksForUser excluye tareas canceladas", async () => {
    const leader = await makeUser("tr-leader8@test.local");
    const project = await makeProject(leader.id);
    const task = await createTask({
      projectId: project.id,
      title: "Tarea cancelada",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "2",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });
    await transitionTask(task.id, "cancelada", leader.id, {
      note: "ya no aplica",
    });

    const result = await listRequestableTasksForUser(leader.id, DEFAULT_ROLE);
    expect(result.map((t) => t.id)).not.toContain(task.id);
  });
});

describe("teamLoad", () => {
  it("horas abiertas = estimado - registrado de tareas abiertas como responsable, no las horas ya registradas", async () => {
    const leader = await makeUser("team-open1@test.local");
    const project = await makeProject(leader.id);

    // Sin horas registradas todavía: abiertas = estimado completo, no 0.
    const untouched = await createTask({
      projectId: project.id,
      title: "Sin registrar",
      deliverable: "E",
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

    const partial = await createTask({
      projectId: project.id,
      title: "Parcial",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-11",
      supportIds: [],
      actorId: leader.id,
    });
    await transitionTask(partial.id, "activa", leader.id, {});
    await logHours({
      taskId: partial.id,
      userId: leader.id,
      role: "owner",
      date: "2026-01-04",
      hours: "1",
    });

    const rows = await teamLoad();
    const row = rows.find((r) => r.userId === leader.id);
    expect(row?.openHours).toBe(4 + (4 - 1));
    expect(untouched.status).toBe("pendiente");
  });
});

describe("límite de 4h estimadas por día", () => {
  it("createTask rechaza una tarea que haría superar 4h estimadas el mismo día", async () => {
    const leader = await makeUser("daily-limit1@test.local");
    const project = await makeProject(leader.id);

    await createTask({
      projectId: project.id,
      title: "Tarea A",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "3",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    await expect(
      createTask({
        projectId: project.id,
        title: "Tarea B",
        deliverable: "E",
        description: "",
        ownerId: leader.id,
        priority: "media",
        weight: 1,
        estimate: "2",
        dependencyId: null,
        due: "2026-01-10",
        supportIds: [],
        actorId: leader.id,
      }),
    ).rejects.toThrow(HttpError);
  });

  it("createTask permite tareas del mismo día que en total no superan 4h", async () => {
    const leader = await makeUser("daily-limit2@test.local");
    const project = await makeProject(leader.id);

    await createTask({
      projectId: project.id,
      title: "Tarea A",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "2.5",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    const second = await createTask({
      projectId: project.id,
      title: "Tarea B",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1.5",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    expect(second.status).toBe("pendiente");
  });

  it("createTask ignora tareas canceladas al calcular el total del día", async () => {
    const leader = await makeUser("daily-limit3@test.local");
    const project = await makeProject(leader.id);

    const first = await createTask({
      projectId: project.id,
      title: "Tarea cancelada",
      deliverable: "E",
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
    await transitionTask(first.id, "cancelada", leader.id, {
      note: "no aplica",
    });

    const second = await createTask({
      projectId: project.id,
      title: "Tarea nueva",
      deliverable: "E",
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

    expect(second.status).toBe("pendiente");
  });

  it("updateTask rechaza mover una tarea a un día donde el responsable ya supera 4h", async () => {
    const leader = await makeUser("daily-limit4@test.local");
    const project = await makeProject(leader.id);

    await createTask({
      projectId: project.id,
      title: "Tarea A",
      deliverable: "E",
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
    const toMove = await createTask({
      projectId: project.id,
      title: "Tarea B",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-11",
      supportIds: [],
      actorId: leader.id,
    });

    await expect(
      updateTask(toMove.id, { due: "2026-01-10" }, leader.id, "reprogramar"),
    ).rejects.toThrow(HttpError);
  });

  it("updateTask permite editar la propia tarea sin contarla dos veces", async () => {
    const leader = await makeUser("daily-limit5@test.local");
    const project = await makeProject(leader.id);

    const task = await createTask({
      projectId: project.id,
      title: "Tarea A",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "3",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: leader.id,
    });

    const updated = await updateTask(
      task.id,
      { estimate: "4" },
      leader.id,
      "ajuste",
    );
    expect(Number(updated?.estimate)).toBe(4);
  });
});
