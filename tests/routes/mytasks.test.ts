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
  return { app, cookie, me };
}

describe("GET /mis-tareas", () => {
  it("responde 200 sin tareas", async () => {
    const { app, cookie } = await setup("mt1@test.local");
    const res = await supertest(app).get("/mis-tareas").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sin tareas en esta vista");
  });

  it("responde 200 y lista una tarea propia", async () => {
    const { app, cookie, me } = await setup("mt2@test.local");
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
    await createTask({
      projectId: project.id,
      title: "Mi tarea",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "critica",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app).get("/mis-tareas").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Mi tarea");
  });

  it("filtra por estado via ?estado=", async () => {
    const { app, cookie, me } = await setup("mt3@test.local");
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
    await createTask({
      projectId: project.id,
      title: "Pendiente",
      deliverable: "E",
      description: "",
      ownerId: me.id,
      priority: "media",
      weight: 1,
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .get("/mis-tareas?estado=activa")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sin tareas en esta vista");
  });
});
