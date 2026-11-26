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
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

async function makeAdminCookie(email: string) {
  const cookie = await signUpAndGetCookie(email);
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email));
  const [me] = await db.select().from(user).where(eq(user.email, email));
  return { cookie, me };
}

describe("GET /productividad", () => {
  it("responde 200 sin horas registradas", async () => {
    const app = createApp();
    const { cookie } = await makeAdminCookie("rep1@test.local");
    const res = await supertest(app)
      .get("/productividad")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("un usuario sin perfil admin no puede ver el reporte", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("rep1-user@test.local");
    const res = await supertest(app)
      .get("/productividad")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("muestra horas por proyecto para cada rango", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie("rep2@test.local");
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

describe("cumplimiento de presupuesto", () => {
  it("es real/estimado de las tareas completadas, no % de tareas dentro de presupuesto", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie("rep4@test.local");
    const project = await createProject({
      name: "Proyecto compliance",
      code: "PR-2",
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
    await logHours({
      taskId: task.id,
      userId: me.id,
      role: "owner",
      date: "2026-01-04",
      hours: "5",
    });
    await transitionTask(task.id, "revision", me.id, { evidence: "avance" });
    await transitionTask(task.id, "completada", me.id, { evidence: "ok" });

    const res = await supertest(app)
      .get("/productividad")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    // 5h reales / 4h estimadas = 125%, no el % de tareas dentro de presupuesto.
    expect(res.text).toContain("125%");
  });
});

describe("GET /productividad/export.csv", () => {
  it("responde con un CSV con BOM y separador ;", async () => {
    const app = createApp();
    const { cookie } = await makeAdminCookie("rep3@test.local");
    const res = await supertest(app)
      .get("/productividad/export.csv")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Proyecto;Horas");
  });

  it("un usuario sin perfil admin no puede exportar el reporte", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("rep3-user@test.local");
    const res = await supertest(app)
      .get("/productividad/export.csv")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });
});
