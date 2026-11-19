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
    expect(res.text).toContain("Equipo y carga de trabajo");
    expect(res.text).toContain("Carga por colaborador");
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
