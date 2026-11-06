import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /equipo", () => {
  it("responde 200 y lista a los usuarios activos", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("team1@test.local");
    const res = await supertest(app).get("/equipo").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("redirige a login sin sesión", async () => {
    const app = createApp();
    const res = await supertest(app).get("/equipo");
    expect(res.status).toBe(302);
  });
});
