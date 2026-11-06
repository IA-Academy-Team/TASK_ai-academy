import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import {
  createTask,
  logHours,
  transitionTask,
} from "../../src/db/tasks-repo.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /notificaciones", () => {
  it("responde 200 sin nada pendiente", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("nt1@test.local");
    const res = await supertest(app)
      .get("/notificaciones")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Nada esperando tu aprobación");
  });

  it("muestra una tarea en revisión de un proyecto que lidera", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("nt2@test.local");
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "nt2@test.local"));
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
      title: "Tarea en revisión",
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
    await transitionTask(task.id, "activa", me.id, {});
    await logHours({
      taskId: task.id,
      userId: me.id,
      role: "owner",
      date: "2026-01-05",
      hours: "1",
    });
    await transitionTask(task.id, "revision", me.id, {
      evidence: "avance",
    });

    const res = await supertest(app)
      .get("/notificaciones")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Tarea en revisión");
  });
});
