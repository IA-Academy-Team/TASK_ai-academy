import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask, listSupport } from "../../src/db/tasks-repo.ts";
import { subscribe, unsubscribe } from "../../src/lib/sse-hub.ts";
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

describe("solicitudes de apoyo", () => {
  it("POST /tareas/:id/apoyo crea la solicitud y el destinatario la ve en /solicitudes", async () => {
    const { app, cookie, task } = await setup("sup1-owner@test.local");
    const targetCookie = await signUpAndGetCookie("sup1-target@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "sup1-target@test.local"));

    const res = await supertest(app)
      .post(`/tareas/${task.id}/apoyo`)
      .set("Cookie", cookie)
      .type("form")
      .send({
        targetUserId: target.id,
        mode: "invite",
        reason: "Necesito ayuda",
      });
    expect(res.status).toBe(303);

    const list = await supertest(app)
      .get("/solicitudes")
      .set("Cookie", targetCookie);
    expect(list.status).toBe(200);
  });

  it("POST /tareas/:id/apoyo avisa en tiempo real al usuario destinatario", async () => {
    const { app, cookie, task } = await setup("sup5-owner@test.local");
    await signUpAndGetCookie("sup5-target@test.local");
    const [targetRow] = await db
      .select()
      .from(user)
      .where(eq(user.email, "sup5-target@test.local"));

    const chunks: string[] = [];
    const fakeRes = {
      write(chunk: string) {
        chunks.push(chunk);
      },
    } as unknown as import("express").Response;
    subscribe(targetRow.id, fakeRes);

    await supertest(app)
      .post(`/tareas/${task.id}/apoyo`)
      .set("Cookie", cookie)
      .type("form")
      .send({
        targetUserId: targetRow.id,
        mode: "invite",
        reason: "Necesito ayuda",
      });

    unsubscribe(targetRow.id, fakeRes);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("event: support-request");
    expect(chunks[0]).toContain(task.title);
  });

  it("POST /tareas/:id/apoyo responde 403 si no es responsable ni líder", async () => {
    const { app, task } = await setup("sup2-owner@test.local");
    const otherCookie = await signUpAndGetCookie("sup2-other@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "sup2-owner@test.local"));

    const res = await supertest(app)
      .post(`/tareas/${task.id}/apoyo`)
      .set("Cookie", otherCookie)
      .type("form")
      .send({ targetUserId: target.id, mode: "invite", reason: "x" });
    expect(res.status).toBe(403);
  });

  it("aceptar una solicitud agrega al usuario como apoyo de la tarea", async () => {
    const { app, cookie, task } = await setup("sup3-owner@test.local");
    const targetCookie = await signUpAndGetCookie("sup3-target@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "sup3-target@test.local"));

    await supertest(app)
      .post(`/tareas/${task.id}/apoyo`)
      .set("Cookie", cookie)
      .type("form")
      .send({
        targetUserId: target.id,
        mode: "invite",
        reason: "Necesito ayuda",
      });

    const forMe = await supertest(app)
      .get("/solicitudes")
      .set("Cookie", targetCookie);
    const match = forMe.text.match(/\/solicitudes\/([a-f0-9-]+)\/aceptar/);
    expect(match).not.toBeNull();

    const res = await supertest(app)
      .post(`/solicitudes/${match?.[1]}/aceptar`)
      .set("Cookie", targetCookie);
    expect(res.status).toBe(303);

    const support = await listSupport(task.id);
    expect(support.map((s) => s.userId)).toContain(target.id);
  });

  it("GET /tareas/:id/horas-apoyo responde 403 si no es apoyo aceptado", async () => {
    const { app, cookie, task } = await setup("sup4@test.local");
    const res = await supertest(app)
      .get(`/tareas/${task.id}/horas-apoyo`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });
});
