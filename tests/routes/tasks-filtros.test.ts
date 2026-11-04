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

describe("filtros y cambio de estado", () => {
  it("GET /tareas?estado=completada devuelve solo esas, el resto no cambia", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "filtros1@test.local");

    const a = await supertest(app)
      .post("/tareas")
      .set("Cookie", cookie)
      .type("form")
      .send({ title: "Tarea A" });
    expect(a.status).toBe(303);

    const list1 = await supertest(app).get("/tareas").set("Cookie", cookie);
    const idMatch = list1.text.match(/\/tareas\/([a-f0-9-]{36})\/estado/);
    expect(idMatch).not.toBeNull();
    const id = idMatch?.[1] as string;

    const changeRes = await supertest(app)
      .post(`/tareas/${id}/estado`)
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "completada" });
    expect(changeRes.status).toBe(303);

    const filtered = await supertest(app)
      .get("/tareas?estado=completada")
      .set("Cookie", cookie);
    expect(filtered.text).toContain("Tarea A");
    expect(filtered.text).not.toContain('pendiente">pendiente');
  });

  it("GET /tareas?estado=bogus responde 400", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "filtros2@test.local");
    const res = await supertest(app)
      .get("/tareas?estado=bogus")
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
  });

  it("POST /tareas/:id/estado con id inexistente responde 404", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "filtros3@test.local");
    const res = await supertest(app)
      .post("/tareas/00000000-0000-0000-0000-000000000000/estado")
      .set("Cookie", cookie)
      .type("form")
      .send({ status: "completada" });
    expect(res.status).toBe(404);
  });
});
