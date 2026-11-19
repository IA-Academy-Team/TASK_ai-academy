import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
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

describe("GET/POST /tareas/nueva", () => {
  it("GET /tareas/nueva sin proyecto muestra el selector", async () => {
    const { app, cookie } = await setup("tc1@test.local");
    const res = await supertest(app).get("/tareas/nueva").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Tarea personal (sin proyecto)");
    expect(res.text).toContain("Proyecto al que pertenece");
  });

  it("GET /tareas/nueva?project=:id muestra el formulario completo", async () => {
    const { app, cookie, project } = await setup("tc2@test.local");
    const res = await supertest(app)
      .get(`/tareas/nueva?project=${project.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("POST /tareas crea la tarea en el proyecto y redirige", async () => {
    const { app, cookie, me, project } = await setup("tc3@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({
        projectId: project.id,
        title: "Tarea nueva",
        deliverable: "Entregable",
        ownerId: me.id,
        priority: "media",
        weight: "1",
        estimate: "4",
        due: "2026-01-10",
        dueTime: "10:00",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/proyectos/${project.id}`);
  });

  it("POST /tareas crea una tarea personal sin proyecto", async () => {
    const { app, cookie, me } = await setup("tc-personal@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({
        projectId: "",
        title: "Tarea personal",
        deliverable: "Entregable personal",
        ownerId: me.id,
        priority: "media",
        estimate: "2",
        due: "2026-01-10",
        dueTime: "10:00",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/mis-tareas");
  });

  it("POST /tareas con datos inválidos vuelve al formulario con error", async () => {
    const { app, cookie, project } = await setup("tc4@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({ projectId: project.id, title: "" });
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("/tareas/nueva");
  });

  it("POST /tareas rechaza una entrega durante la pausa de mediodía", async () => {
    const { app, cookie, me, project } = await setup("tc-lunch@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({
        projectId: project.id,
        title: "Tarea fuera de horario",
        deliverable: "Entregable",
        ownerId: me.id,
        priority: "media",
        estimate: "4",
        due: "2026-01-10",
        dueTime: "12:30",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("error=1");
  });

  it("POST /tareas rechaza más de 16 horas estimadas", async () => {
    const { app, cookie, me, project } = await setup("tc-max@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({
        projectId: project.id,
        title: "Tarea extensa",
        deliverable: "Entregable",
        ownerId: me.id,
        priority: "media",
        estimate: "16.5",
        due: "2026-01-10",
        dueTime: "10:00",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("error=1");
  });
});
