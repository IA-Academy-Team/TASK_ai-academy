import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /", () => {
  it("autenticado, responde 200 con el dashboard", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("dash1@test.local");
    const res = await supertest(app).get("/").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Centro de control");
    expect(res.text).toContain("Proyectos activos");
    expect(res.text).toContain("Avance de proyectos");
    expect(res.text).toContain("Atención prioritaria");
    expect(res.text).toContain('href="/tareas/nueva"');
    expect(res.text).toContain('href="/proyectos/nuevo"');
    expect(res.text).toContain('href="/planeacion"');
    expect(res.text).toContain('href="/mis-tareas?estado=urgentes"');
  });

  it("sin autenticar, redirige a /login", async () => {
    const app = createApp();
    const res = await supertest(app).get("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });
});
