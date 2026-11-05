import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";

async function signUpAndGetCookie(
  app: ReturnType<typeof createApp>,
  email: string,
) {
  const res = await supertest(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password: "supersecret123", name: "Test" });
  return res.headers["set-cookie"];
}

async function setup(email: string) {
  const app = createApp();
  const cookie = await signUpAndGetCookie(app, email);
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
  });

  it("GET /tareas/:id con id inexistente responde 404", async () => {
    const { app, cookie } = await setup("task2@test.local");
    const res = await supertest(app)
      .get("/tareas/00000000-0000-0000-0000-000000000000")
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

    const r2 = await supertest(app)
      .post(`/tareas/${task.id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "revision" });
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
    const memberCookie = await signUpAndGetCookie(
      app,
      "task4-member@test.local",
    );
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
