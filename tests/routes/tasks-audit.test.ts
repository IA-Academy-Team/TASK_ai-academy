import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /tareas/:id/auditoria", () => {
  it("responde 200 y lista la creación de la tarea", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("aud1@test.local");
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "aud1@test.local"));
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
      estimate: "1",
      dependencyId: null,
      due: "2026-01-10",
      supportIds: [],
      actorId: me.id,
    });

    const res = await supertest(app)
      .get(`/tareas/${task.id}/auditoria`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("task_created");
  });

  it("responde 404 para una tarea inexistente", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("aud2@test.local");
    const res = await supertest(app)
      .get("/tareas/00000000-0000-0000-0000-000000000000/auditoria")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});
