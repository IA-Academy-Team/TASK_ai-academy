import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { ADMIN_ROLE, DEFAULT_ROLE } from "../../src/domain/roles.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

async function signUp(email: string, password: string) {
  const app = createApp();
  const cookie = await signUpAndGetCookie(email, password);
  return { app, cookie };
}

async function makeAdmin(email: string) {
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email));
}

describe("session and authorize", () => {
  it("GET /login sin sesion renderiza el formulario con 200", async () => {
    const app = createApp();
    const res = await supertest(app).get("/login");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Task by Academy");
  });

  it("una sesion valida deja req.user con role e isActive", async () => {
    const { app, cookie } = await signUp("user1@test.local", "supersecret1");
    app.get("/__whoami", (req, res) => {
      res.json({ role: req.user?.role, isActive: req.user?.isActive });
    });
    const res = await supertest(app).get("/__whoami").set("Cookie", cookie);
    expect(res.body).toEqual({ role: DEFAULT_ROLE, isActive: true });
  });

  it("authorize(ADMIN_ROLE) responde 403 para el rol por defecto", async () => {
    const { app, cookie } = await signUp("user2@test.local", "supersecret2");
    const { authorize } = await import("../../src/middleware/authorize.ts");
    app.get("/__admin-only", authorize(ADMIN_ROLE), (_req, res) =>
      res.json({ ok: true }),
    );
    app.use(
      (
        err: { status?: number; message?: string },
        _req: unknown,
        res: { status: (n: number) => { json: (b: unknown) => void } },
        _next: unknown,
      ) => {
        res.status(err.status ?? 500).json({ error: err.message });
      },
    );
    const res = await supertest(app).get("/__admin-only").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("sin sesion, una ruta protegida redirige a /login", async () => {
    const app = createApp();
    app.get("/__protected", (req, res) => {
      if (!req.user) {
        res.redirect("/login");
        return;
      }
      res.json({ ok: true });
    });
    const res = await supertest(app).get("/__protected");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("admin creado via makeAdmin tiene role administrador", async () => {
    const { cookie } = await signUp("admin1@test.local", "supersecret3");
    await makeAdmin("admin1@test.local");
    const app2 = createApp();
    app2.get("/__whoami2", (req, res) => res.json({ role: req.user?.role }));
    const res = await supertest(app2).get("/__whoami2").set("Cookie", cookie);
    expect(res.body).toEqual({ role: ADMIN_ROLE });
  });

  it("POST /api/auth/sign-up/email (alta pública) responde 404", async () => {
    const app = createApp();
    const res = await supertest(app).post("/api/auth/sign-up/email").send({
      email: "intruso@test.local",
      password: "supersecret4",
      name: "X",
    });
    expect(res.status).toBe(404);

    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "intruso@test.local"));
    expect(created).toBeUndefined();
  });
});
