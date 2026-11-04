import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";

async function signUpAndGetCookie(
  app: ReturnType<typeof createApp>,
  email: string,
) {
  const res = await supertest(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password: "supersecret123", name: "Test" });
  return res.headers["set-cookie"];
}

describe("admin usuarios", () => {
  it("admin GET /admin/usuarios responde 200", async () => {
    const app = createApp();
    const email = "adminx1@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("usuario comun GET /admin/usuarios responde 403", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie(app, "userx2@test.local");
    const res = await supertest(app)
      .get("/admin/usuarios")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("POST /admin/usuarios crea con role usuario", async () => {
    const app = createApp();
    const email = "adminx3@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    const res = await supertest(app)
      .post("/admin/usuarios")
      .set("Cookie", cookie)
      .type("form")
      .send({
        email: "nuevo1@test.local",
        password: "supersecret999",
        name: "Nuevo",
      });
    expect(res.status).toBe(303);

    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "nuevo1@test.local"));
    expect(created.role).toBe("usuario");
  });

  it("POST /admin/usuarios/:id/desactivar pone isActive=false", async () => {
    const app = createApp();
    const email = "adminx4@test.local";
    const cookie = await signUpAndGetCookie(app, email);
    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));

    await signUpAndGetCookie(app, "target1@test.local");
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target1@test.local"));

    const res = await supertest(app)
      .post(`/admin/usuarios/${target.id}/desactivar`)
      .set("Cookie", cookie);
    expect(res.status).toBe(303);

    const [after] = await db
      .select()
      .from(user)
      .where(eq(user.email, "target1@test.local"));
    expect(after.isActive).toBe(false);
  });
});
