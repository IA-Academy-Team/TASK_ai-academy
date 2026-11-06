import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
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
  return { app, cookie, me, project, task };
}

describe("GET/POST /tareas/:id/editar", () => {
  it("GET responde 200 para el líder", async () => {
    const { app, cookie, task } = await setup("te1@test.local");
    const res = await supertest(app)
      .get(`/tareas/${task.id}/editar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("GET responde 403 para un usuario que no es líder ni admin", async () => {
    const { app, task } = await setup("te2-leader@test.local");
    const memberCookie = await signUpAndGetCookie("te2-member@test.local");
    const res = await supertest(app)
      .get(`/tareas/${task.id}/editar`)
      .set("Cookie", memberCookie);
    expect(res.status).toBe(403);
  });

  it("POST sin motivo responde 400 y vuelve al formulario", async () => {
    const { app, cookie, me, task } = await setup("te3@test.local");
    const res = await supertest(app)
      .post(`/tareas/${task.id}/editar`)
      .set("Cookie", cookie)
      .type("form")
      .send({
        title: "Nuevo título",
        deliverable: "E",
        ownerId: me.id,
        priority: "media",
        weight: "1",
        estimate: "4",
        due: "2026-01-10",
      });
    expect(res.status).toBe(400);
  });

  it("POST con motivo actualiza la tarea y redirige al detalle", async () => {
    const { app, cookie, me, task } = await setup("te4@test.local");
    const res = await supertest(app)
      .post(`/tareas/${task.id}/editar`)
      .set("Cookie", cookie)
      .type("form")
      .send({
        motivo: "Ajuste de alcance",
        title: "Título actualizado",
        deliverable: "E",
        ownerId: me.id,
        priority: "alta",
        weight: "2",
        estimate: "6",
        due: "2026-01-15",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/tareas/${task.id}`);
  });
});
