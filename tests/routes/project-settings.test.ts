import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask, getTask } from "../../src/db/tasks-repo.ts";
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

async function makeTask(projectId: string, ownerId: string) {
  return createTask({
    projectId,
    title: "T",
    deliverable: "E",
    description: "",
    ownerId,
    priority: "media",
    weight: 1,
    estimate: "1",
    dependencyId: null,
    due: "2026-01-10",
    supportIds: [],
    actorId: ownerId,
  });
}

describe("GET /proyectos/:id/configuracion", () => {
  it("responde 200 para el líder", async () => {
    const { app, cookie, project } = await setup("ps1@test.local");
    const res = await supertest(app)
      .get(`/proyectos/${project.id}/configuracion`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("responde 403 para quien no es líder ni admin", async () => {
    const { app, project } = await setup("ps2-leader@test.local");
    const memberCookie = await signUpAndGetCookie("ps2-member@test.local");
    const res = await supertest(app)
      .get(`/proyectos/${project.id}/configuracion`)
      .set("Cookie", memberCookie);
    expect(res.status).toBe(403);
  });
});

describe("POST /proyectos/:id/tareas/:taskId/mover", () => {
  it("sube una tarea e intercambia el order con la anterior", async () => {
    const { app, cookie, me, project } = await setup("ps3@test.local");
    const a = await makeTask(project.id, me.id);
    const b = await makeTask(project.id, me.id);

    const res = await supertest(app)
      .post(`/proyectos/${project.id}/tareas/${b.id}/mover`)
      .set("Cookie", cookie)
      .type("form")
      .send({ direction: "subir" });
    expect(res.status).toBe(303);

    const movedA = await getTask(a.id);
    const movedB = await getTask(b.id);
    expect(movedB?.order).toBe(1);
    expect(movedA?.order).toBe(2);
  });

  it("revierte si el movimiento rompe el orden de una dependencia", async () => {
    const { app, cookie, me, project } = await setup("ps4@test.local");
    const base = await makeTask(project.id, me.id);
    const dependent = await createTask({
      projectId: project.id,
      title: "Depende",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: base.id,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .post(`/proyectos/${project.id}/tareas/${base.id}/mover`)
      .set("Cookie", cookie)
      .type("form")
      .send({ direction: "bajar" });
    expect(res.status).toBe(400);

    const stillBase = await getTask(base.id);
    const stillDependent = await getTask(dependent.id);
    expect(stillBase?.order).toBe(1);
    expect(stillDependent?.order).toBe(2);
  });
});
