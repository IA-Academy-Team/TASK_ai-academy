import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask, getTask } from "../../src/db/tasks-repo.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

async function setup(email: string) {
  const app = createApp();
  const cookie = await signUpAndGetCookie(email);
  const [me] = await db.select().from(user).where(eq(user.email, email));
  const project = await createProject({
    name: "Proyecto",
    code: "PR-1",
    objective: "Objetivo",
    leaderId: me.id,
    start: "2026-01-01",
    due: "2026-02-01",
    limitActive: 2,
    limitReview: 2,
    memberIds: [],
  });
  return { app, cookie, me, project };
}

describe("GET/POST /tareas/:id", () => {
  it("GET /tareas/:id responde 200 para una tarea del proyecto", async () => {
    const { app, cookie, me, project } = await setup("task1@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .get(`/tareas/${task.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Ficha de la tarea");
    expect(res.text).toContain("Editar / reprogramar");
    expect(res.text).toContain("Solicitar apoyo");
    expect(res.text).not.toContain("Peso del avance");
  });

  it("GET /tareas/:id con id inexistente responde 404", async () => {
    const { app, cookie } = await setup("task2@test.local");
    const res = await supertest(app)
      .get("/tareas/00000000-0000-0000-0000-000000000000")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("GET /tareas/:id con id mal formado responde 404, no 500", async () => {
    const { app, cookie } = await setup("task2b@test.local");
    const res = await supertest(app)
      .get("/tareas/no-es-un-uuid")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("POST /tareas/:id/estado activa->revision->completada (líder) funciona de punta a punta", async () => {
    const { app, cookie, me, project } = await setup("task3@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const r1 = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "activa" });
    expect(r1.status).toBe(303);

    await supertest(app)
      .post(`/tareas/${task.id}/horas`)
      .set("Cookie", cookie)
      .type("form")
      .send({ date: "2026-01-05", hours: "2" });

    const r2 = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "revision", evidence: "avance parcial" });
    expect(r2.status).toBe(303);

    const r3 = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "completada", evidence: "listo" });
    expect(r3.status).toBe(303);
  });

  it("POST /tareas/:id/estado a completada sin ser líder/admin responde 403", async () => {
    const { app, project } = await setup("task4-leader@test.local");
    const memberCookie = await signUpAndGetCookie("task4-member@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: project.leaderId,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: project.leaderId,
    });
    await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", memberCookie)
      .type("form")
      .send({ status: "activa" });
    await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", memberCookie)
      .type("form")
      .send({ status: "revision" });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", memberCookie)
      .type("form")
      .send({ status: "completada", evidence: "listo" });
    expect(res.status).toBe(403);
  });

  it("POST /tareas/:id/estado a bloqueada sin motivo responde 400", async () => {
    const { app, cookie, me, project } = await setup("task6@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "bloqueada" });
    expect(res.status).toBe(400);
  });

  it("POST /tareas/:id/estado a bloqueada con motivo funciona", async () => {
    const { app, cookie, me, project } = await setup("task7@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "bloqueada", note: "Esperando insumos" });
    expect(res.status).toBe(303);
  });

  it("POST /tareas/:id/horas registra horas para el responsable", async () => {
    const { app, cookie, me, project } = await setup("task5@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/horas`)
      .set("Cookie", cookie)
      .type("form")
      .send({ date: "2026-01-02", hours: "3" });
    expect(res.status).toBe(303);
  });
});

describe("POST /tareas/:id/eliminar", () => {
  it("el responsable elimina su propia tarea y redirige al proyecto", async () => {
    const { app, cookie, me, project } = await setup("taskdel1@test.local");
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/proyectos/${project.id}`);
    expect(await getTask(task.id)).toBeUndefined();
  });

  it("el responsable elimina una tarea independiente y redirige a /mis-tareas", async () => {
    const { app, cookie, me } = await setup("taskdel2@test.local");
    const task = await createTask({
      projectId: null,
      title: "Independiente",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/mis-tareas");
    expect(await getTask(task.id)).toBeUndefined();
  });

  it("un apoyo puede eliminar la tarea", async () => {
    const { app, me, project } = await setup("taskdel3-owner@test.local");
    const supportCookie = await signUpAndGetCookie(
      "taskdel3-support@test.local",
    );
    const [supportUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, "taskdel3-support@test.local"));
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [supportUser.id],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/eliminar`)
      .set("Cookie", supportCookie);
    expect(res.status).toBe(303);
    expect(await getTask(task.id)).toBeUndefined();
  });

  it("un tercero sin relación con la tarea responde 403", async () => {
    const { app, me, project } = await setup("taskdel4-owner@test.local");
    const strangerCookie = await signUpAndGetCookie(
      "taskdel4-stranger@test.local",
    );
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/eliminar`)
      .set("Cookie", strangerCookie);
    expect(res.status).toBe(403);
    expect(await getTask(task.id)).toBeDefined();
  });

  it("un admin puede eliminar cualquier tarea", async () => {
    const { app, me, project } = await setup("taskdel5-owner@test.local");
    const adminCookie = await signUpAndGetCookie("taskdel5-admin@test.local");
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, "taskdel5-admin@test.local"));
    const task = await createTask({
      projectId: project.id,
      title: "T",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/tareas/${task.id}/eliminar`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(303);
    expect(await getTask(task.id)).toBeUndefined();
  });

  it("muestra el nombre del responsable cuando es un admin, no su id crudo", async () => {
    const { app, cookie, me, project } = await setup(
      "task-owner-admin@test.local",
    );
    await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.id, me.id));
    const task = await createTask({
      projectId: project.id,
      title: "Tarea con responsable admin",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .get(`/tareas/${task.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain(me.name);
    expect(res.text).not.toContain(me.id);
  });
});
