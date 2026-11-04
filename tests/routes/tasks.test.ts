import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";

async function signUpAndGetCookie(
  app: ReturnType<typeof createApp>,
  email: string,
) {
  const res = await supertest(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password: "supersecret123", name: "Test" });
  return res.headers["set-cookie"];
}

describe("GET/POST /tareas", () => {
  it("autenticado, GET /tareas responde 200", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "tareas1@test.local");
    const res = await supertest(app).get("/tareas").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("sin autenticar, GET /tareas redirige a /login", async () => {
    const app = createApp();
    const res = await supertest(app).get("/tareas");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("POST /tareas con title valido crea y redirige 303", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "tareas2@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({ title: "Tarea nueva" });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/tareas");
  });

  it("POST /tareas con title vacio responde 400 sin crear fila", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "tareas3@test.local");
    const res = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });
});
