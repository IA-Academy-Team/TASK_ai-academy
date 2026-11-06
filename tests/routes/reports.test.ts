import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask, logHours } from "../../src/db/tasks-repo.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /productividad", () => {
  it("responde 200 sin horas registradas", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("rep1@test.local");
    const res = await supertest(app)
      .get("/productividad")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("muestra horas por proyecto para cada rango", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("rep2@test.local");
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "rep2@test.local"));
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
    const today = new Date().toLocaleDateString("en-CA");
    await logHours({
      taskId: task.id,
      userId: me.id,
      role: "owner",
      date: today,
      hours: "3",
    });

    for (const rango of ["dia", "semana", "mes"]) {
      const res = await supertest(app)
        .get(`/productividad?rango=${rango}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Proyecto");
    }
  });
});

describe("GET /productividad/export.csv", () => {
  it("responde con un CSV con BOM y separador ;", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("rep3@test.local");
    const res = await supertest(app)
      .get("/productividad/export.csv")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Proyecto;Horas");
  });
});
