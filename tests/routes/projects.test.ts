import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { ADMIN_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET/POST /proyectos", () => {
  it("autenticado, GET /proyectos responde 200", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj1@test.local");
    const res = await supertest(app).get("/proyectos").set("Cookie", cookie);
    expect(res.status).toBe(200);
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
    expect(res.headers.location).toBe("/proyectos?error=1");
  });

  it("GET /proyectos/:id con un id mal formado responde 404, no 500", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("proj4@test.local");
    const res = await supertest(app)
      .get("/proyectos/no-es-un-uuid")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});
