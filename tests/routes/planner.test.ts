import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /planeacion", () => {
  it("responde 200 sin proyectos", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("pl1@test.local");
    const res = await supertest(app).get("/planeacion").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("responde 200 con filtro de semana y proyecto", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("pl2@test.local");
    const res = await supertest(app)
      .get("/planeacion?semana=1")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("redirige a login sin sesión", async () => {
    const app = createApp();
    const res = await supertest(app).get("/planeacion");
    expect(res.status).toBe(302);
  });
});
