import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject } from "../../src/db/projects-repo.ts";
import { createTask } from "../../src/db/tasks-repo.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

async function makeAdminCookie(email: string) {
  const cookie = await signUpAndGetCookie(email);
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email));
  const [me] = await db.select().from(user).where(eq(user.email, email));
  return { cookie, me };
}

describe("GET /equipo", () => {
  it("responde 200 y lista a los usuarios activos", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("team1@test.local");
    const res = await supertest(app).get("/equipo").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Operatividad");
    expect(res.text).toContain("Operatividad por colaborador");
  });

  it("redirige a login sin sesión", async () => {
    const app = createApp();
    const res = await supertest(app).get("/equipo");
    expect(res.status).toBe(302);
  });

  it.each(["dia", "semana", "mes"])(
    "responde 200 con periodo=%s",
    async (periodo) => {
      const app = createApp();
      const cookie = await signUpAndGetCookie(
        `team-period-${periodo}@test.local`,
      );
      const res = await supertest(app)
        .get(`/equipo?periodo=${periodo}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
    },
  );

  it("un periodo inválido cae al semanal por defecto (200)", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("team-period-bad@test.local");
    const res = await supertest(app)
      .get("/equipo?periodo=invalido")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });
});

describe("GET /equipo/:userId/detalle", () => {
  async function setup() {
    const { cookie: leaderCookie, me: leader } = await (async () => {
      const cookie = await signUpAndGetCookie("team-detail-leader@test.local");
      const [me] = await db
        .select()
        .from(user)
        .where(eq(user.email, "team-detail-leader@test.local"));
      return { cookie, me };
    })();
    const strangerCookie = await signUpAndGetCookie(
      "team-detail-stranger@test.local",
    );
    const [stranger] = await db
      .select()
      .from(user)
      .where(eq(user.email, "team-detail-stranger@test.local"));
    const { cookie: adminCookie } = await makeAdminCookie(
      "team-detail-admin@test.local",
    );

    const project = await createProject({
      name: "Proyecto detalle equipo",
      code: "TDE",
      objective: "o",
      leaderId: leader.id,
      start: "2026-01-01",
      due: "2026-12-31",
      limitActive: 5,
      limitReview: 5,
      memberIds: [],
    });

    const task = await createTask({
      projectId: project.id,
      title: "Tarea de equipo",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "4",
      dependencyId: null,
      due: "2026-01-10",
      dueTime: null,
      supportIds: [],
      actorId: leader.id,
    });

    return {
      app: createApp(),
      leader,
      leaderCookie,
      stranger,
      strangerCookie,
      adminCookie,
      project,
      task,
    };
  }

  it("el admin ve las tareas de cualquier persona", async () => {
    const { app, leader, adminCookie } = await setup();
    const res = await supertest(app)
      .get(`/equipo/${leader.id}/detalle`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].tasks[0].title).toBe("Tarea de equipo");
  });

  it("cada quien ve su propio detalle", async () => {
    const { app, leader, leaderCookie } = await setup();
    const res = await supertest(app)
      .get(`/equipo/${leader.id}/detalle`)
      .set("Cookie", leaderCookie);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
  });

  it("un tercero sin relación no ve las tareas de otra persona", async () => {
    const { app, leader, strangerCookie } = await setup();
    const res = await supertest(app)
      .get(`/equipo/${leader.id}/detalle`)
      .set("Cookie", strangerCookie);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
  });

  it("el líder del proyecto ve las tareas de sus integrantes", async () => {
    const { app, leader, leaderCookie, stranger, project } = await setup();
    await createTask({
      projectId: project.id,
      title: "Tarea de apoyo",
      deliverable: "E",
      description: "",
      ownerId: leader.id,
      priority: "media",
      weight: 1,
      estimate: "2",
      dependencyId: null,
      due: "2026-01-12",
      dueTime: null,
      supportIds: [stranger.id],
      actorId: leader.id,
    });

    const res = await supertest(app)
      .get(`/equipo/${stranger.id}/detalle`)
      .set("Cookie", leaderCookie);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].tasks[0].title).toBe("Tarea de apoyo");
  });
});
