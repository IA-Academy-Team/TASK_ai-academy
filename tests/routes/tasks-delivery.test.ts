import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import {
  createTask,
  getTask,
  transitionTask,
} from "../../src/db/tasks-repo.ts";
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
  await transitionTask(task.id, "activa", me.id, {});
  return { app, cookie, me, project, task };
}

describe("GET/POST /tareas/:id/entrega", () => {
  it("GET responde 200 para el responsable con la tarea activa", async () => {
    const { app, cookie, task } = await setup("td1@test.local");
    const res = await supertest(app)
      .get(`/tareas/${task.id}/entrega`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("GET responde 403 si no es el responsable", async () => {
    const { app, task } = await setup("td2-owner@test.local");
    const otherCookie = await signUpAndGetCookie("td2-other@test.local");
    const res = await supertest(app)
      .get(`/tareas/${task.id}/entrega`)
      .set("Cookie", otherCookie);
    expect(res.status).toBe(403);
  });

  it("POST registra horas, guarda evidencia y envía la tarea a revisión", async () => {
    const { app, cookie, task } = await setup("td3@test.local");
    const res = await supertest(app)
      .post(`/tareas/${task.id}/entrega`)
      .set("Cookie", cookie)
      .type("form")
      .send({ date: "2026-01-05", hours: "3", evidence: "Entregable adjunto" });
    expect(res.status).toBe(303);

    const updated = await getTask(task.id);
    expect(updated?.status).toBe("revision");
    expect(updated?.evidence).toBe("Entregable adjunto");
  });

  it("POST sin evidencia responde 400", async () => {
    const { app, cookie, task } = await setup("td4@test.local");
    const res = await supertest(app)
      .post(`/tareas/${task.id}/entrega`)
      .set("Cookie", cookie)
      .type("form")
      .send({ date: "2026-01-05", hours: "3" });
    expect(res.status).toBe(400);
  });
});
