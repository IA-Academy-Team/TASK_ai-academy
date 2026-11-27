import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { createProject, getProject } from "../../src/db/projects-repo.ts";
import { createTask, getTask } from "../../src/db/tasks-repo.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

async function makeAdminCookie(email: string) {
  const cookie = await signUpAndGetCookie(email);
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email));
  const [me] = await db.select().from(user).where(eq(user.email, email));
  return { cookie, me };
}

describe("GET/POST /proyectos", () => {
  it("admin, GET /proyectos/nuevo muestra el formulario persistente", async () => {
    const app = createApp();
    const { cookie } = await makeAdminCookie("project-new-admin@test.local");
    const res = await supertest(app)
      .get("/proyectos/nuevo")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Crear proyecto");
    expect(res.text).toContain("aiacademy-project-create-draft");
    expect(res.text).toContain("aiacademy-project-create-submitted");
    expect(res.text).toContain("Proyectos activos");
  });

  it("usuario común no puede abrir /proyectos/nuevo", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("project-new-user@test.local");
    const res = await supertest(app)
      .get("/proyectos/nuevo")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("autenticado, GET /proyectos responde 200", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj1@test.local");
    const res = await supertest(app).get("/proyectos").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Crea proyectos nuevos");
    expect(res.text).toContain("project-list-grid");
  });

  it("admin, GET /proyectos?nombre filtra por nombre", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie(
      "proj-filter-nombre@test.local",
    );
    await createProject({
      name: "Proyecto Alfa",
      code: "PF-A",
      objective: "Objetivo",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });
    await createProject({
      name: "Proyecto Beta",
      code: "PF-B",
      objective: "Objetivo",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const res = await supertest(app)
      .get("/proyectos?nombre=Alfa")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Proyecto Alfa");
    expect(res.text).not.toContain("Proyecto Beta");
  });

  it("admin, GET /proyectos?responsable filtra por líder", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie(
      "proj-filter-leader-a@test.local",
    );
    const { me: otherLeader } = await makeAdminCookie(
      "proj-filter-leader-b@test.local",
    );
    await createProject({
      name: "Proyecto Liderado Por A",
      code: "PF-C",
      objective: "Objetivo",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });
    await createProject({
      name: "Proyecto Liderado Por B",
      code: "PF-D",
      objective: "Objetivo",
      leaderId: otherLeader.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const res = await supertest(app)
      .get(`/proyectos?responsable=${otherLeader.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Proyecto Liderado Por B");
    expect(res.text).not.toContain("Proyecto Liderado Por A");
  });

  it("GET /proyectos con estado inválido responde 400", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(
      "proj-filter-bad-estado@test.local",
    );
    const res = await supertest(app)
      .get("/proyectos?estado=no-existe")
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
  });

  it("sin autenticar, GET /proyectos redirige a /login", async () => {
    const app = createApp();
    const res = await supertest(app).get("/proyectos");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("admin, POST /proyectos crea el proyecto y redirige a su detalle", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj2@test.local");
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, "proj2@test.local"));
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "proj2@test.local"));
    const res = await supertest(app)
      .post("/proyectos")
      .set("Cookie", cookie)
      .type("form")
      .send({
        name: "Proyecto Test",
        code: "PT-1",
        objective: "Objetivo de prueba",
        leaderId: me.id,
        start: "2026-01-01",
        due: "2026-02-01",
        limitActive: "2",
        limitReview: "2",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/proyectos\//);
  });

  it("usuario comun, POST /proyectos responde 403", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj2b@test.local");
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "proj2b@test.local"));
    const res = await supertest(app)
      .post("/proyectos")
      .set("Cookie", cookie)
      .type("form")
      .send({
        name: "Proyecto Test",
        code: "PT-2",
        objective: "Objetivo de prueba",
        leaderId: me.id,
        start: "2026-01-01",
        due: "2026-02-01",
        limitActive: "2",
        limitReview: "2",
      });
    expect(res.status).toBe(403);
  });

  it("GET /proyectos/:id con un id inexistente responde 404", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj3@test.local");
    const res = await supertest(app)
      .get("/proyectos/00000000-0000-0000-0000-000000000000")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("admin, POST /proyectos con due anterior a start rechaza el formulario", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj5@test.local");
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, "proj5@test.local"));
    const [me] = await db
      .select()
      .from(user)
      .where(eq(user.email, "proj5@test.local"));
    const res = await supertest(app)
      .post("/proyectos")
      .set("Cookie", cookie)
      .type("form")
      .send({
        name: "Proyecto fechas invertidas",
        objective: "Objetivo de prueba",
        leaderId: me.id,
        start: "2026-02-01",
        due: "2026-01-01",
        limitActive: "2",
        limitReview: "2",
      });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/proyectos/nuevo?error=1");
  });

  it("GET /proyectos/:id con un id mal formado responde 404, no 500", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj4@test.local");
    const res = await supertest(app)
      .get("/proyectos/no-es-un-uuid")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("admin puede aparecer como líder y GET /proyectos/:id muestra su nombre", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie("proj5-admin@test.local");
    const project = await createProject({
      name: "Proyecto liderado por admin",
      code: "PLA-1",
      objective: "Objetivo",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const res = await supertest(app)
      .get(`/proyectos/${project.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain(me.name);
  });

  it("GET /proyectos/nuevo incluye administradores entre los líderes posibles", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie("proj6-admin@test.local");
    const res = await supertest(app)
      .get("/proyectos/nuevo")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`value="${me.id}"`);
  });
});

describe("POST /proyectos/:id/eliminar", () => {
  it("admin elimina el proyecto y sus tareas en cascada", async () => {
    const app = createApp();
    const { cookie, me } = await makeAdminCookie("projdel1@test.local");
    const project = await createProject({
      name: "Proyecto a borrar",
      code: "DEL-1",
      objective: "Probar el borrado",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });
    const task = await createTask({
      projectId: project.id,
      title: "Tarea del proyecto a borrar",
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
      .post(`/proyectos/${project.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/proyectos");

    expect(await getProject(project.id)).toBeUndefined();
    expect(await getTask(task.id)).toBeUndefined();
  });

  it("usuario comun no puede eliminar un proyecto (403)", async () => {
    const app = createApp();
    const { me } = await makeAdminCookie("projdel2-owner@test.local");
    const project = await createProject({
      name: "Proyecto protegido",
      code: "DEL-2",
      objective: "No se debe poder borrar sin ser admin",
      leaderId: me.id,
      start: "2026-01-01",
      due: "2026-02-01",
      limitActive: 2,
      limitReview: 2,
      memberIds: [],
    });

    const cookie = await signUpAndGetCookie("projdel2-attacker@test.local");
    const res = await supertest(app)
      .post(`/proyectos/${project.id}/eliminar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);

    expect(await getProject(project.id)).toBeDefined();
  });

  it("admin, eliminar un proyecto inexistente responde 404", async () => {
    const app = createApp();
    const { cookie } = await makeAdminCookie("projdel3@test.local");
    const res = await supertest(app)
      .post("/proyectos/00000000-0000-0000-0000-000000000000/eliminar")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});
